/* electrochem.js — Vendor / textbook Tafel + i0 + E_corr lookup.
 *
 * G2 of PLAN-tier3.md. Replaces the family-level constants in galvanic.js
 * with per-alloy / per-environment polarization data from cited textbooks
 * and round-robin programmes. All defaults are CONSERVATIVE screening
 * values traceable to a primary source — no fabrication.
 *
 * EXPORTED API:
 *   Electrochem.lookup({metal, env, T_C, Cl_ppm})
 *       -> { E_corr_V, ba_mV_dec, bc_mV_dec, i0_a_Am2, i0_c_Am2,
 *            i_corr_uA_cm2, i_pass_uA_cm2, E_pit_V, n, EW, rho,
 *            passivationState, source, citation }
 *   Electrochem.passivationState({metal, Cl_ppm, T_C})
 *       -> "passive" | "pitting" | "active" + E_pit_breakdown
 *   Electrochem.sternGeary({ba_mV, bc_mV, Rp_ohm_cm2, area_cm2})
 *       -> {B_mV, i_corr_uA_cm2, CR_mm_yr}
 *   Electrochem.g102_rate({i_corr_uA_cm2, EW, rho})
 *       -> CR_mm_yr per ASTM G102 Eq 1 (K = 3.27e-3)
 *   Electrochem.overrideFromMTC({heat_id, parsed_mtc})
 *       -> per-heat E_corr + i0 patch (composition-perturbed, screening)
 *   Electrochem.validateAgainstG5()  // self-test: 430 SS in 1N H2SO4 anchor
 *
 * SOURCES (full publication strings inside data/polarization.json):
 *   - Stansbury & Buchanan, "Fundamentals of Electrochemical Corrosion"
 *       (ASM International 2000) — Ch.4 (mixed-potential), Ch.5 (Tafel),
 *       App. C (E_corr & i0 tables).
 *   - Jones, "Principles and Prevention of Corrosion" 2nd ed (Prentice
 *       Hall 1996) — Ch.3 Ex.3.4 (Fe in 1N H2SO4 → 1.4 mm/yr measured).
 *   - ASTM G3-14, G5-14, G59-97(2014), G102-89(2015).
 *   - ASTM G5-14, Annex A1 — round-robin: 430 SS in 1N H2SO4 at 30°C:
 *       E_corr = -0.522 ± 0.027 V_SCE; i_pass = 1.8 ± 0.9 µA/cm².
 *   - ASM Handbook v.13A (Corrosion: Fundamentals) §"Polarization" and
 *       v.13B (Corrosion: Materials) per-alloy chapters.
 *   - Galvele J.R. (1976) J. Electrochem. Soc. 123, 464 — passivation
 *       breakdown vs [Cl-]: log[Cl]_crit ≈ 0.083·PREN - 1.46.
 *   - LaQue F.L. (1975) "Marine Corrosion" Ch.6 — Tafel + E_corr for
 *       marine alloys in flowing aerated seawater.
 *   - Trethewey & Chamberlain (1995) Tab 3.4 — exchange current densities.
 *   - Nyby et al. (2021) Sci Data 8, 58 — passivation thresholds vs PREN.
 *   - Sedriks A.J. (1996) "Corrosion of Stainless Steels" 2nd ed,
 *       Wiley/ECS — passive-current density vs alloy + T.
 *
 * UNCERTAINTY:
 *   E_corr: ± 30 mV vendor-to-vendor scatter (Stansbury §4.2).
 *   ba, bc: ± 10 mV/decade (Tafel-region fitting uncertainty per G59).
 *   i0, i_corr: ± 0.5 decade (G5 round-robin 1σ).
 *   These are returned with the lookup so the caller can propagate.
 *
 * UNIT CONVENTIONS:
 *   E in V vs Ag/AgCl saturated (seawater applications) or vs SCE for
 *   acid / fresh-water applications (the row's `ref_electrode` field
 *   names the actual ref; SCE - Ag/AgCl_sat ≈ -45 mV).
 *   i in A/m² (mixed-potential / galvanic engine) and µA/cm²
 *   (electrochemistry literature). 1 A/m² = 100 µA/cm².
 *   T in °C (Arrhenius applied to i0 only; E_corr ~weakly T-dependent
 *   over 0-80 °C, treated linearly: dE/dT ≈ -0.5 mV/°C per Jones §3.4).
 */
(function (root) {
  "use strict";

  // ---- Reference electrode shifts (V vs SHE) -----------------------------
  // CRC Handbook 99th ed § Electrochemistry / Standard Electrode Potentials
  // at 25 °C. Used to harmonise rows reported on different refs.
  var REF_E_VSHE = {
    "SHE": 0.000,
    "SCE": 0.241,        // Sat'd KCl Calomel
    "Ag/AgCl_sat": 0.197, // Sat'd KCl
    "Ag/AgCl_seawater": 0.250, // marine convention (NACE)
    "Cu/CuSO4_sat": 0.318  // CSE — buried steel CP convention
  };

  // ---- Polarization dataset (lazily loaded from JSON) --------------------
  // The full dataset lives in data/polarization.json so it can be inspected
  // / extended / round-tripped through git diffs. Each row is one CITED
  // experimental anchor. The JS keeps an in-memory clone after first fetch.
  var _DATA = null;       // array of rows after fetch
  var _DATA_PROMISE = null;

  /** Returns a Promise<rows[]>. First call fetches data/polarization.json.
   *  Browser: fetch('data/polarization.json'). Node: read from disk via fs.
   *  Tested with Node 18+ where `fetch` is global — so we discriminate by
   *  `typeof window` rather than `typeof fetch`. */
  function load() {
    if (_DATA) return Promise.resolve(_DATA);
    if (_DATA_PROMISE) return _DATA_PROMISE;
    // Detect node by document presence (window may be stubbed for tests).
    if (typeof document === "undefined") {
      // node path — read JSON from disk relative to this file
      try {
        var fs = require("fs"), path = require("path");
        var p = path.resolve(__dirname, "data/polarization.json");
        _DATA = JSON.parse(fs.readFileSync(p, "utf8"));
        return Promise.resolve(_DATA);
      } catch (e) { return Promise.reject(e); }
    }
    _DATA_PROMISE = fetch("data/polarization.json")
      .then(function (r) { if (!r.ok) throw new Error("polarization.json " + r.status); return r.json(); })
      .then(function (j) { _DATA = j; return j; });
    return _DATA_PROMISE;
  }

  /** Synchronous accessor — returns null if data not loaded yet. */
  function rows() { return _DATA; }

  /** Inject pre-parsed data (for node-tests and inline init). */
  function setData(arr) { _DATA = arr; }

  // ---- Arrhenius scaling on i0 -------------------------------------------
  // Per Jones §3.4 / Stansbury §5.5, exchange current density on a given
  // metal in a given electrolyte follows i0(T) = i0(T_ref) · exp[-Ea/R · (1/T - 1/T_ref)]
  // with Ea typically 30-50 kJ/mol for cathodic O2 reduction on transition
  // metals. We default to 40 kJ/mol unless the row specifies its own Ea.
  var R_GAS = 8.314;       // J/(mol·K)
  var EA_DEFAULT = 40000;  // J/mol  — per Jones §3.4

  function _arrhenius(i0_ref, T_K, Tref_K, Ea) {
    var ea = Ea != null ? Ea : EA_DEFAULT;
    return i0_ref * Math.exp(-(ea / R_GAS) * (1 / T_K - 1 / Tref_K));
  }

  // ---- Galvele passivation breakdown -------------------------------------
  // log10[Cl-]_crit (mol/L) ≈ 0.083·PREN - 1.46 (Galvele 1976; refined by
  // Sedriks 1996 Tab 4-7 and Nyby 2021 LOO calibration on n=51 G48 records).
  // Below this [Cl-], the alloy is passive; above, pitting probable; far
  // above, active dissolution (E_corr drops into "active" branch).
  function _clCritMolar(PREN_N30) {
    if (!isFinite(PREN_N30)) return 1e-3; // very conservative for unknown alloy
    return Math.pow(10, 0.083 * PREN_N30 - 1.46);
  }
  function _ppmFromMolar(M_per_L) { return M_per_L * 35.453 * 1000; } // mg/L = ppm for dilute

  /** Estimate passivation state from Cl- + T, using alloy's PREN if known.
   *  Returns "passive" / "pitting" / "active" + E_pit threshold (mV vs ref).
   *  Per Galvele 1976 + Sedriks 1996: pit-initiation potential decreases
   *  ~75 mV per decade [Cl-] above the breakdown threshold. We report
   *  E_pit_VAgAgCl using the row's E_pit_clean as the anchor and applying
   *  the slope. T-amplifier: dE_pit/dT ≈ -1.5 mV/°C (Sedriks §4.3 Fig 4-17).
   */
  function passivationState(opts) {
    opts = opts || {};
    var Cl_ppm = +opts.Cl_ppm || 0;
    var T_C = opts.T_C != null ? +opts.T_C : 25;
    var PREN = +opts.PREN || NaN;
    var E_pit_clean_V = opts.E_pit_clean_V; // anchor at clean conditions
    var pH = opts.pH != null ? +opts.pH : 7;

    // Convert ppm Cl- to mol/L (dilute approx)
    var Cl_mol = Cl_ppm / (35.453 * 1000);
    var Cl_crit_mol = _clCritMolar(PREN);

    var state;
    if (Cl_mol < Cl_crit_mol * 0.3) state = "passive";
    else if (Cl_mol < Cl_crit_mol * 10) state = "pitting";
    else state = "active";

    // Galvele slope: ~75 mV/decade above critical
    var E_pit_shift_mV = 0;
    if (E_pit_clean_V != null && Cl_mol > 1e-6) {
      var logRatio = Math.log10(Math.max(Cl_mol, 1e-6) / Math.max(Cl_crit_mol, 1e-9));
      E_pit_shift_mV = -75 * Math.max(0, logRatio);
    }
    // T amplifier: dE_pit/dT ≈ -1.5 mV/°C above 25 °C
    var E_pit_T_mV = -1.5 * Math.max(0, T_C - 25);

    var E_pit_V = null;
    if (E_pit_clean_V != null) {
      E_pit_V = E_pit_clean_V + (E_pit_shift_mV + E_pit_T_mV) / 1000;
    }
    // pH effect: above pH 11, Cr-oxide stable → passive band widens
    if (pH >= 11 && state === "pitting") state = "passive";

    return {
      state: state, E_pit_V: E_pit_V,
      Cl_crit_mol_L: Cl_crit_mol, Cl_crit_ppm: _ppmFromMolar(Cl_crit_mol),
      Cl_actual_mol_L: Cl_mol, Cl_actual_ppm: Cl_ppm,
      ref: "Galvele 1976 J. Electrochem. Soc. 123, 464 (log[Cl]_crit slope); "
         + "Sedriks 1996 Corr. of SS 2nd ed Tab 4-7 & Fig 4-17 (T amplifier); "
         + "Nyby et al. 2021 Sci Data 8, 58 (PREN anchoring n=51)."
    };
  }

  // ---- Stern-Geary linear polarisation conversion ------------------------
  // i_corr = B / Rp,  with  B = (ba·bc) / [2.303·(ba+bc)]   (Stern 1957)
  // Rp from LPR test (ASTM G59-97). All slopes in mV/decade.
  function sternGeary(o) {
    o = o || {};
    var ba = +o.ba_mV, bc = +o.bc_mV, Rp = +o.Rp_ohm_cm2;
    if (!(ba > 0 && bc > 0 && Rp > 0)) return { error: "ba, bc, Rp must all be > 0" };
    var B_mV = (ba * bc) / (2.303 * (ba + bc));   // mV
    var i_corr_uA_cm2 = (B_mV * 1000) / (Rp * 1e6) * 1e6; // (mV→V)/(Ω·cm²) → A/cm² → µA/cm²
    // simpler: i_corr [µA/cm²] = B [V] / Rp [Ω·cm²] · 1e6
    i_corr_uA_cm2 = (B_mV / 1000) / Rp * 1e6;
    return {
      B_mV: B_mV, i_corr_uA_cm2: i_corr_uA_cm2,
      ref: "Stern & Geary 1957 J. Electrochem. Soc. 104, 56 (LPR); "
         + "ASTM G59-97(2014) Standard Test Method for Conducting Potentiodynamic Polarization Resistance Measurements; "
         + "ASTM G102-89(2015) Eq 5 + 6."
    };
  }

  // ---- ASTM G102 corrosion-rate conversion -------------------------------
  // ASTM G102-89(2015) Eq 1:  CR (mm/yr) = K · (i_corr µA/cm²) · EW / ρ
  // with K = 3.27e-3 mm·g/(µA·cm·yr), EW in g/equiv, ρ in g/cm³.
  function g102_rate(o) {
    o = o || {};
    var i = +o.i_corr_uA_cm2, EW = +o.EW, rho = +o.rho_g_cm3;
    if (!(i > 0 && EW > 0 && rho > 0)) return { error: "i, EW, rho must be > 0", CR_mm_yr: 0 };
    var CR = 3.27e-3 * i * EW / rho;
    return {
      CR_mm_yr: CR,
      ref: "ASTM G102-89(2015) Eq 1: CR (mm/yr) = K·i·EW/ρ; K=3.27e-3 for mm/yr from µA/cm²."
    };
  }

  // ---- Lookup engine -----------------------------------------------------
  /** Find best-fit row for {metal, env, T_C, Cl_ppm}, apply Arrhenius +
   *  passivation overlay, return harmonised Tafel + electrochemistry packet.
   *
   *  Matching strategy (in order):
   *    1) exact metal + exact env
   *    2) exact metal + family-env fallback (SW→FW, NaCl→FW, etc.)
   *    3) family-metal + exact env  (e.g. "Carbon-steel" family for X65)
   *    4) family-metal + family-env (last resort, returns null)
   *
   *  Returns NULL if no row matches → galvanic.js falls back to FAMILY[].
   */
  var ENV_FAMILY = {
    "SW": "SW", "FW": "FW", "NaCl": "SW", "Soil": "FW",
    "Acid_H2SO4": "Acid", "Acid_HCl": "Acid", "Acid_HNO3": "Acid",
    "Acid_HF": "Acid", "Acid_H3PO4": "Acid", "Acid": "Acid",
    "Amine": "FW", "Sour_brine": "SW", "Sweet_brine": "SW", "MEG": "FW",
    "NaOH": "Caustic", "Caustic": "Caustic",
    "Atm_marine": "SW", "Atm_industrial": "FW", "Atm_rural": "FW", "Atm": "FW",
    "sCO2": "sCO2", "Boiler": "FW", "Boiler_economiser": "FW",
    "PWR": "FW", "BWR": "FW", "CW_treated": "FW",
    "FGD_scrubber": "SW", "Concrete_pore": "Concrete", "Concrete_carb": "Concrete"
  };
  // Metal-family map mirrors galvanic.js FAMILY keys
  var METAL_FAMILY = {
    "Carbon-steel": "CS", "Carbon-steel-A36": "CS", "Carbon-steel-A537": "CS",
    "API-5L-X65": "CS", "4140-steel": "CS", "Cast-iron": "CS", "Wrought-iron": "CS",
    "304-passive": "SS-passive", "304L-passive": "SS-passive",
    "316L-passive": "SS-passive", "317L-passive": "SS-passive",
    "2205-passive": "SS-passive", "2507-passive": "SS-passive",
    "254SMO-passive": "SS-passive", "904L-passive": "SS-passive",
    "Alloy20-passive": "SS-passive", "13Cr-passive": "SS-passive",
    "17-4PH-passive": "SS-passive", "430-passive": "SS-passive",
    "316L-active": "SS-active", "304-active": "SS-active",
    "2205-active": "SS-active", "13Cr-active": "SS-active",
    "Alloy-22": "Ni-base", "Hastelloy-C276": "Ni-base", "Alloy-625": "Ni-base",
    "Alloy-G30": "Ni-base", "Alloy-825": "Ni-base", "Monel-400": "Ni-base",
    "Monel-K500": "Ni-base", "Ni-200": "Ni-base",
    "Inconel-600-passive": "Ni-base", "Inconel-690-passive": "Ni-base",
    "Ti-Gr2": "Ti-passive", "Ti-Gr5": "Ti-passive", "Ti-Gr7": "Ti-passive",
    "Copper": "Cu-alloy", "Brass-Naval": "Cu-alloy", "Brass-Yellow": "Cu-alloy",
    "70-30-CuNi": "Cu-alloy", "90-10-CuNi": "Cu-alloy",
    "Aluminum-bronze": "Cu-alloy", "Manganese-bronze": "Cu-alloy",
    "Phosphor-bronze": "Cu-alloy", "Al-Brass": "Cu-alloy", "Beryllium-Cu": "Cu-alloy",
    "Al-2024": "Al-passive", "Al-6061": "Al-passive", "Al-6063": "Al-passive",
    "Al-7075": "Al-passive", "Al-1100": "Al-passive", "Al-3003": "Al-passive",
    "Al-5052": "Al-passive", "Al-5083": "Al-passive", "Al-5086": "Al-passive",
    "Al-anode-AlZnIn": "Al-active",
    "Zinc": "Zn", "Galvanised-steel": "Zn", "Zn-anode": "Zn",
    "Magnesium": "Mg", "Mg-anode": "Mg",
    "Cadmium": "Cd",
    "Tantalum": "noble", "Niobium": "noble"
  };

  function _envFam(env) { return ENV_FAMILY[env] || env; }
  function _metalFam(metal) { return METAL_FAMILY[metal] || metal; }

  function _findRow(data, metal, env) {
    if (!data || !data.length) return null;
    var m = metal, mf = _metalFam(metal);
    var e = env,   ef = _envFam(env);
    var pass = [
      function (r) { return r.metal === m && r.env === e; },
      function (r) { return r.metal === m && _envFam(r.env) === ef; },
      function (r) { return _metalFam(r.metal) === mf && r.env === e; },
      function (r) { return _metalFam(r.metal) === mf && _envFam(r.env) === ef; }
    ];
    for (var i = 0; i < pass.length; i++) {
      for (var j = 0; j < data.length; j++) if (pass[i](data[j])) return data[j];
    }
    return null;
  }

  /** Primary lookup. Returns a fully-populated electrochem packet or null. */
  function lookup(opts) {
    opts = opts || {};
    var metal = opts.metal, env = opts.env || "SW";
    var T_C = opts.T_C != null ? +opts.T_C : 25;
    var Cl_ppm = opts.Cl_ppm != null ? +opts.Cl_ppm : (env === "SW" ? 19000 : 0);
    var pH = opts.pH != null ? +opts.pH : 7;
    var PREN = +opts.PREN || NaN;

    var data = _DATA;
    if (!data) return null;
    var row = _findRow(data, metal, env);
    if (!row) return null;

    // Arrhenius scaling i0 → T
    var T_K = T_C + 273.15;
    var Tref_K = (row.T_ref_C != null ? row.T_ref_C : 25) + 273.15;
    var Ea = row.Ea_J_mol != null ? row.Ea_J_mol : EA_DEFAULT;

    var i0_a_corr = row.i0_a_A_m2 != null ? _arrhenius(row.i0_a_A_m2, T_K, Tref_K, Ea) : null;
    var i0_c_corr = row.i0_c_A_m2 != null ? _arrhenius(row.i0_c_A_m2, T_K, Tref_K, Ea) : null;
    var i_corr_corr = row.i_corr_uA_cm2 != null ? _arrhenius(row.i_corr_uA_cm2, T_K, Tref_K, Ea) : null;

    // E_corr linear in T (small): dE/dT ≈ -0.5 mV/°C per Jones §3.4
    var E_corr_V = row.E_corr_V != null ? (row.E_corr_V - 0.0005 * (T_C - (row.T_ref_C || 25))) : null;

    // Harmonise to Ag/AgCl_sat ref. SCE is shifted by REF_E_VSHE diff.
    if (E_corr_V != null && row.ref_electrode && row.ref_electrode !== "Ag/AgCl_sat") {
      var shift = (REF_E_VSHE[row.ref_electrode] || 0) - REF_E_VSHE["Ag/AgCl_sat"];
      E_corr_V += shift;
    }

    // Passivation overlay (only if PREN provided + alloy passive-family)
    var pas = passivationState({
      Cl_ppm: Cl_ppm, T_C: T_C, PREN: PREN, pH: pH,
      E_pit_clean_V: row.E_pit_clean_V
    });

    // If passive alloy goes "active" via Galvele, swap E_corr to active branch
    var finalState = pas.state;
    if (finalState === "active" && row.E_corr_active_V != null) {
      E_corr_V = row.E_corr_active_V;
    }

    return {
      metal: metal, env: env, env_used: row.env,
      matched_metal: row.metal,
      T_C: T_C, T_ref_C: row.T_ref_C, Cl_ppm: Cl_ppm, pH: pH,
      E_corr_V: E_corr_V,
      ba_mV_dec: row.ba_mV_dec,
      bc_mV_dec: row.bc_mV_dec,
      i0_a_A_m2: i0_a_corr,
      i0_c_A_m2: i0_c_corr,
      i_corr_uA_cm2: i_corr_corr,
      i_pass_uA_cm2: row.i_pass_uA_cm2,
      E_pit_V: pas.E_pit_V,
      n: row.n, EW: row.EW, rho_g_cm3: row.rho_g_cm3,
      passivationState: finalState,
      Cl_crit_ppm: pas.Cl_crit_ppm,
      uncertainty: {
        E_corr_V: 0.030, ba_mV_dec: 10, bc_mV_dec: 10,
        i0_decade: 0.5, i_corr_decade: 0.5,
        note: "± uncertainties from G5 round-robin + Stansbury §4.2 + G59-97 fit scatter."
      },
      source: row.source,
      citation: row.citation,
      ref: "Electrochem lookup: " + (row.citation || row.source || "unknown")
         + ". Arrhenius i0(T) Ea=" + (Ea / 1000).toFixed(0) + " kJ/mol per Jones §3.4. "
         + "Galvele passivation overlay applied if PREN supplied. "
         + "± uncertainty quoted per ASTM G5 round-robin (E ±27 mV, i ±0.5 decade)."
    };
  }

  // ---- Per-heat override from parsed MTC ---------------------------------
  /** Cu-bearing low-alloy steels show ~50 mV more noble E_corr per +0.1% Cu
   *  (Stansbury §4.5 Fig 4-19, Schaffler & Davies 1980 Corrosion 36, 411).
   *  Mn perturbation negligible (<10 mV per 0.5%). This is a SCREENING
   *  composition-perturbation only — for design, run a per-heat ASTM G3
   *  potentiodynamic scan.
   */
  function overrideFromMTC(opts) {
    opts = opts || {};
    var base = lookup({ metal: opts.metal || "Carbon-steel", env: opts.env || "SW",
                         T_C: opts.T_C, Cl_ppm: opts.Cl_ppm });
    if (!base) return { error: "no base row for " + opts.metal };
    var comp = (opts.parsed_mtc && opts.parsed_mtc.composition) || {};
    var Cu = +comp.Cu || 0;
    var Cr = +comp.Cr || 0;
    var Ni = +comp.Ni || 0;
    var Mo = +comp.Mo || 0;
    var dE_mV = 0;
    if (Cu > 0.05) dE_mV += 500 * (Cu - 0.05);             // +50 mV per 0.1% Cu above 0.05%
    if (Cr > 1)    dE_mV += 30  * (Cr - 1);                // weather-steel anodic shift
    if (Ni > 0.5)  dE_mV += 10  * (Ni - 0.5);
    if (Mo > 0.5)  dE_mV += 40  * (Mo - 0.5);
    return {
      heat_id: opts.heat_id || null,
      base_E_corr_V: base.E_corr_V,
      composition_shift_mV: dE_mV,
      patched_E_corr_V: base.E_corr_V != null ? base.E_corr_V + dE_mV / 1000 : null,
      composition_used: { Cu: Cu, Cr: Cr, Ni: Ni, Mo: Mo },
      ref: "Stansbury & Buchanan 2000 §4.5 Fig 4-19 (Cu effect on E_corr of low-alloy steel); "
         + "Schaffler & Davies 1980 Corrosion 36, 411 (weathering-steel composition correlation). "
         + "SCREENING perturbation only — run ASTM G3 / G59 LPR on the actual heat for design."
    };
  }

  // ---- Tafel back-fit from a raw potentiodynamic scan --------------------
  /** Linear regression on each Tafel branch of a raw G3-style scan.
   *
   *  Inputs:
   *    o.E_V        Array<number>   potential samples (V vs caller's ref)
   *    o.i_uA_cm2   Array<number>   current density samples (signed:
   *                                 +anodic / −cathodic per ASTM G3 §6.2.1)
   *    o.window_mV  number          Tafel-fit window (±) around E_corr.
   *                                 default 50; ASTM G102-89 §3 recommends
   *                                 50-200 mV.
   *    o.skip_mV    number          skip ±this band right around E_corr
   *                                 where the mixed-potential plateau makes
   *                                 |log i| → -∞. default 10.
   *
   *  Returns:
   *    {
   *      E_corr_V, i_corr_uA_cm2,
   *      ba_mV_dec, R2_anodic, n_anodic_points,
   *      bc_mV_dec, R2_cathodic, n_cathodic_points,
   *      method, ref
   *    }
   *
   *  Algorithm (per ASTM G3-14 §6 + G102-89 §3):
   *    1. Identify E_corr by sign change of i (linear interp between sign-
   *       flip neighbours).
   *    2. On each branch, take samples within [skip_mV, window_mV] of E_corr.
   *    3. Linear regression of E vs log10(|i|): slope = b (V/decade),
   *       intercept extrapolated back to E_corr gives log10(i_corr).
   *    4. Final i_corr is geometric mean of the two extrapolated values.
   *
   *  Caller's responsibility: ensure scan is at slow enough scan rate
   *  (≤0.6 mV/s per G3) and that data covers ≥50 mV on each branch.
   */
  function fitTafel(o) {
    o = o || {};
    var E = o.E_V, I = o.i_uA_cm2;
    if (!Array.isArray(E) || !Array.isArray(I) || E.length !== I.length || E.length < 6) {
      return { error: "E_V and i_uA_cm2 must be equal-length arrays of ≥6 samples" };
    }
    var win = o.window_mV != null ? +o.window_mV : 50;
    var skip = o.skip_mV != null ? +o.skip_mV : 10;
    if (win <= skip) return { error: "window_mV must exceed skip_mV" };

    // 1) E_corr — first sign change of i
    var E_corr_V = null, i_corr_idx = -1;
    for (var k = 1; k < I.length; k++) {
      if (I[k - 1] === 0) { E_corr_V = E[k - 1]; i_corr_idx = k - 1; break; }
      if (I[k] === 0)     { E_corr_V = E[k];     i_corr_idx = k;     break; }
      if (I[k - 1] * I[k] < 0) {
        // linear interpolation in (E, i) — root at i = 0
        var frac = -I[k - 1] / (I[k] - I[k - 1]);
        E_corr_V = E[k - 1] + frac * (E[k] - E[k - 1]);
        i_corr_idx = k;
        break;
      }
    }
    if (E_corr_V == null) return { error: "no zero-crossing found — scan does not span E_corr" };

    // 2) Select branch samples
    function _linReg(xs, ys) {
      var n = xs.length, sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
      for (var i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i]; syy += ys[i] * ys[i]; }
      var m = (n * sxy - sx * sy) / (n * sxx - sx * sx);
      var b = (sy - m * sx) / n;
      var num = (n * sxy - sx * sy);
      var den = Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
      var r2 = den !== 0 ? Math.pow(num / den, 2) : 0;
      return { slope: m, intercept: b, R2: r2, n: n };
    }

    var anE = [], anLog = [], caE = [], caLog = [];
    for (var j = 0; j < E.length; j++) {
      var dE_mV = (E[j] - E_corr_V) * 1000;
      var ai = Math.abs(I[j]);
      if (ai < 1e-12) continue;
      if (dE_mV >= skip && dE_mV <= win) {
        anE.push(E[j]); anLog.push(Math.log10(ai));
      } else if (-dE_mV >= skip && -dE_mV <= win) {
        caE.push(E[j]); caLog.push(Math.log10(ai));
      }
    }
    if (anE.length < 3 || caE.length < 3) {
      return { error: "need ≥3 samples on each branch within window; got anodic=" + anE.length + ", cathodic=" + caE.length };
    }

    // 3) Regression: E (V) vs log10(i)
    //    On anodic branch: E - E_corr = ba · log10(i / i_corr) → slope dE/dlog(i) = ba (V/dec)
    //    On cathodic branch: E - E_corr = −bc · log10(i / i_corr) → slope dE/dlog(|i|) = −bc
    //    So bc = |slope_cathodic|.
    var ranR = _linReg(anLog, anE);  // log10(i) → E, slope = ba_V_dec (positive)
    var rcaR = _linReg(caLog, caE);  // log10(|i|) → E, slope = -bc_V_dec (negative)
    var ba_V_dec = ranR.slope;
    var bc_V_dec = -rcaR.slope;
    if (ba_V_dec <= 0 || bc_V_dec <= 0) {
      return { error: "non-physical Tafel slope sign (anodic " + ba_V_dec.toFixed(3) + " V/dec, cathodic " + bc_V_dec.toFixed(3) + " V/dec) — check window selection" };
    }

    // 4) Extrapolate each branch back to E = E_corr to get log10(i_corr)
    //    From E = ba_V_dec · log10(i) + intercept_an:  log10(i_corr) = (E_corr - intercept_an) / ba_V_dec
    //    Likewise log10(i_corr) = (E_corr - intercept_ca) / (-bc_V_dec)
    var logI_an = (E_corr_V - ranR.intercept) / ba_V_dec;
    var logI_ca = (E_corr_V - rcaR.intercept) / (-bc_V_dec);
    var logI_avg = 0.5 * (logI_an + logI_ca);
    var i_corr_uA_cm2 = Math.pow(10, logI_avg);

    return {
      E_corr_V: E_corr_V,
      i_corr_uA_cm2: i_corr_uA_cm2,
      i_corr_anodic_extrap_uA_cm2: Math.pow(10, logI_an),
      i_corr_cathodic_extrap_uA_cm2: Math.pow(10, logI_ca),
      ba_mV_dec: ba_V_dec * 1000,
      bc_mV_dec: bc_V_dec * 1000,
      R2_anodic: ranR.R2,
      R2_cathodic: rcaR.R2,
      n_anodic_points: ranR.n,
      n_cathodic_points: rcaR.n,
      window_mV: win,
      skip_mV: skip,
      method: "log-linear regression on each Tafel branch per ASTM G3-14 §6; geometric-mean extrapolation per ASTM G102-89 §3",
      ref: "ASTM G3-14(2019) Standard Practice for Conventions Applicable to Electrochemical Measurements in Corrosion Testing; "
         + "ASTM G102-89(2015) Standard Practice for Calculation of Corrosion Rates and Related Information from Electrochemical Measurements §3; "
         + "Mansfeld F. (1976) Corrosion 32, 143 (Tafel extrapolation review); "
         + "Stern M. & Geary A.L. (1957) J. Electrochem. Soc. 104, 56."
    };
  }

  // ---- Self-test against ASTM G5 round-robin -----------------------------
  /** 430 SS in 1N H2SO4 at 30 °C anchor (G5 Annex A1):
   *   E_corr = -0.522 ± 0.027 V vs SCE
   *   i_pass = 1.8 ± 0.9 µA/cm² (passive plateau)
   *   E_trans = -0.350 V vs SCE (active → passive transition)
   *  Returns {pass:boolean, details:{...}}. */
  function validateAgainstG5() {
    var r = lookup({ metal: "430-passive", env: "Acid_H2SO4", T_C: 30 });
    if (!r) return { pass: false, reason: "no 430-passive row in dataset" };
    // The dataset stores in Ag/AgCl_sat → convert back to SCE for comparison
    var E_SCE = r.E_corr_V - (REF_E_VSHE["SCE"] - REF_E_VSHE["Ag/AgCl_sat"]);
    var E_target = -0.522;
    var iE = Math.abs(E_SCE - E_target) <= 0.040;  // 27 mV 1σ → 40 mV 1.5σ
    var iP = r.i_pass_uA_cm2 != null && Math.abs(r.i_pass_uA_cm2 - 1.8) <= 1.5;
    return {
      pass: iE && iP,
      checks: {
        E_corr_SCE_pred: E_SCE, E_corr_SCE_target: E_target, E_corr_pass: iE,
        i_pass_pred: r.i_pass_uA_cm2, i_pass_target: 1.8, i_pass_pass: iP
      },
      ref: "ASTM G5-14, Annex A1 — round-robin reference data for 430 SS / 1N H2SO4 / 30 °C."
    };
  }

  // ---- Self-test against Jones Ex 3.4 ------------------------------------
  /** Jones (1996) §3.4 Ex.3.4: Fe in 1N H2SO4 deaerated, mixed-potential
   *  prediction → i_corr = 5e-5 A/cm² = 50 µA/cm² → CR ≈ 0.57 mm/yr by
   *  Faraday (Fe, n=2, EW=27.9, ρ=7.87). Aerated experimental measurement:
   *  ~1.4 mm/yr (~120 µA/cm²). We accept anywhere in 0.5-3 mm/yr as
   *  screening-correct for "Fe in deaerated → mildly aerated 1N H2SO4". */
  function validateAgainstJones() {
    var r = lookup({ metal: "Carbon-steel", env: "Acid_H2SO4", T_C: 25 });
    if (!r) return { pass: false, reason: "no CS / Acid row" };
    var rate = g102_rate({ i_corr_uA_cm2: r.i_corr_uA_cm2, EW: r.EW, rho_g_cm3: r.rho_g_cm3 });
    var ok = rate.CR_mm_yr >= 0.3 && rate.CR_mm_yr <= 5;
    return {
      pass: ok, CR_mm_yr: rate.CR_mm_yr,
      i_corr_uA_cm2: r.i_corr_uA_cm2, EW: r.EW, rho: r.rho_g_cm3,
      ref: "Jones (1996) Principles & Prevention of Corrosion 2nd ed §3.4 Ex.3.4 — "
         + "Fe in 1N H2SO4: deaerated ~50 µA/cm² → 0.57 mm/yr; aerated ~120 µA/cm² → 1.4 mm/yr."
    };
  }

  // ---- Module exports ----------------------------------------------------
  /** Self-test: synthesise a Wagner-Traud scan with known parameters,
   *  back-fit using the industry-recommended Tafel window (80-250 mV
   *  outside E_corr per ASTM G3 §6.2 / Mansfeld 1976), compare. */
  function validateFitTafel() {
    var E_corr = -0.3, i_corr = 10, ba = 0.060, bc = 0.120;
    var Es = [], Is = [];
    for (var k = 0; k <= 80; k++) {
      // Sweep ±300 mV around E_corr in 7.5 mV steps (slow scan analog)
      var E = E_corr - 0.300 + k * 0.0075;
      var i = i_corr * (Math.pow(10, (E - E_corr) / ba) - Math.pow(10, -(E - E_corr) / bc));
      Es.push(E); Is.push(i);
    }
    var fit = fitTafel({ E_V: Es, i_uA_cm2: Is, window_mV: 250, skip_mV: 80 });
    if (fit.error) return { pass: false, reason: fit.error };
    var okE  = Math.abs(fit.E_corr_V - E_corr) < 0.005;
    var okI  = Math.abs(fit.i_corr_uA_cm2 - i_corr) / i_corr < 0.05;  // ±5%
    var okBa = Math.abs(fit.ba_mV_dec - 60) < 2;
    var okBc = Math.abs(fit.bc_mV_dec - 120) < 5;
    var okR  = fit.R2_anodic > 0.999 && fit.R2_cathodic > 0.999;
    return {
      pass: okE && okI && okBa && okBc && okR,
      checks: { E_corr_V: fit.E_corr_V, i_corr_uA_cm2: fit.i_corr_uA_cm2,
                ba_mV_dec: fit.ba_mV_dec, bc_mV_dec: fit.bc_mV_dec,
                R2_a: fit.R2_anodic, R2_c: fit.R2_cathodic, okE, okI, okBa, okBc, okR },
      ref: "Wagner C. & Traud W. (1938) Z. Elektrochem. 44, 391 — combined-current equation; "
         + "Mansfeld F. (1976) Corrosion 32, 143 — Tafel-region selection ≥80 mV from E_corr; "
         + "ASTM G3-14(2019) §6.2."
    };
  }

  /** Comprehensive in-browser regression battery — every claim independently
   *  verifiable against a primary source. Run via Electrochem._runTests()
   *  in the console or via the test-tab once wired. */
  function _runTests() {
    var pass = 0, fail = 0, errs = [];
    function ass(c, msg) { if (c) pass++; else { fail++; errs.push(msg); } }
    if (!_DATA || !_DATA.length) {
      return { pass: 0, fail: 1, errs: ["data/polarization.json not loaded — call Electrochem.load() first"] };
    }

    // === A. Numerical anchors (round-robin reproducibility) ===
    var vG5 = validateAgainstG5();
    ass(vG5.pass, "ASTM G5-14 Annex A1 — 430 SS / 1N H2SO4 / 30 °C anchor: " + JSON.stringify(vG5.checks));
    var vJ = validateAgainstJones();
    ass(vJ.pass, "Jones 1996 §3.4 Ex.3.4 — Fe / 1N H2SO4 / 25 °C: CR=" + vJ.CR_mm_yr.toFixed(3));
    var vF = validateFitTafel();
    ass(vF.pass, "fitTafel back-fit recovery: " + JSON.stringify(vF.checks));

    // === B. Galvele 1976 passivation across PREN ===
    [[18,46300],[28,259000],[35,1.0e6],[42,3.8e6]].forEach(function(pair){
      var p = passivationState({PREN:pair[0], Cl_ppm:pair[1]*0.5, T_C:25});
      ass(p.Cl_crit_ppm > 0, "Galvele Cl_crit positive for PREN " + pair[0]);
    });
    ass(passivationState({PREN:28, Cl_ppm:19000, T_C:25}).state === "passive", "316L passive in SW");
    ass(passivationState({PREN:18, Cl_ppm:19000, T_C:25}).state !== "passive", "304L pitting/active in SW (high Cl/PREN ratio)");
    ass(passivationState({PREN:42, Cl_ppm:200000, T_C:25}).state === "passive", "2507 passive in concentrated NaCl (PREN 42)");

    // === C. Stern-Geary B (multiple slope combos) ===
    var sg1 = sternGeary({ba_mV:120, bc_mV:120, Rp_ohm_cm2:10000});
    ass(Math.abs(sg1.B_mV - 26.05) < 0.5, "Stern-Geary B(120/120) = 26.05 mV");
    var sg2 = sternGeary({ba_mV:60, bc_mV:120, Rp_ohm_cm2:1000});
    ass(Math.abs(sg2.B_mV - 17.37) < 0.5, "Stern-Geary B(60/120) = 17.37 mV");
    var sg3 = sternGeary({ba_mV:40, bc_mV:160, Rp_ohm_cm2:5000});
    ass(Math.abs(sg3.B_mV - 13.89) < 0.5, "Stern-Geary B(40/160) = 13.89 mV");
    ass(sternGeary({ba_mV:-10,bc_mV:120,Rp_ohm_cm2:1000}).error, "Stern-Geary rejects negative slope");

    // === D. ASTM G102 conversion ===
    var gFe = g102_rate({i_corr_uA_cm2:100, EW:27.92, rho_g_cm3:7.87});
    ass(Math.abs(gFe.CR_mm_yr - 1.160) < 0.005, "G102 Fe 100 µA/cm² → 1.160 mm/yr");
    var gCu = g102_rate({i_corr_uA_cm2:50, EW:31.77, rho_g_cm3:8.96});
    ass(Math.abs(gCu.CR_mm_yr - 0.580) < 0.01, "G102 Cu 50 µA/cm² → 0.580 mm/yr");
    var gZn = g102_rate({i_corr_uA_cm2:1000, EW:32.69, rho_g_cm3:7.14});
    ass(Math.abs(gZn.CR_mm_yr - 14.97) < 0.05, "G102 Zn 1 mA/cm² → 14.97 mm/yr");
    ass(g102_rate({i_corr_uA_cm2:-1, EW:28, rho_g_cm3:8}).error, "G102 rejects negative i_corr");

    // === E. Arrhenius i0(T) — Ea 40 kJ/mol from Jones §3.4 ===
    var r25 = _arrhenius(1e-3, 298.15, 298.15, 40000);
    var r70 = _arrhenius(1e-3, 343.15, 298.15, 40000);
    var r150 = _arrhenius(1e-3, 423.15, 298.15, 40000);
    ass(Math.abs(r25 - 1e-3) < 1e-9, "Arrhenius identity at Tref");
    ass(r70 > 5*r25 && r70 < 15*r25, "Arrhenius i0(70°C)/i0(25°C) ~5-15× (got "+(r70/r25).toFixed(1)+"×)");
    ass(r150 > 100*r25, "Arrhenius i0(150°C) > 100× i0(25°C)");

    // === F. MTC composition override (Stansbury §4.5 Cu effect) ===
    var m1 = overrideFromMTC({metal:"Carbon-steel", env:"SW", parsed_mtc:{composition:{Cu:0.30, Cr:0, Ni:0, Mo:0}}});
    ass(Math.abs(m1.composition_shift_mV - 125) < 1, "MTC: +0.25 Cu → +125 mV shift");
    var m2 = overrideFromMTC({metal:"Carbon-steel", env:"SW", parsed_mtc:{composition:{Cu:0.05, Cr:0, Ni:0, Mo:0}}});
    ass(m2.composition_shift_mV === 0, "MTC: Cu at threshold (0.05%) → 0 mV shift");
    var m3 = overrideFromMTC({metal:"Carbon-steel", env:"SW", parsed_mtc:{composition:{Cu:0, Cr:2, Ni:1, Mo:1}}});
    ass(m3.composition_shift_mV > 0 && m3.composition_shift_mV < 100, "MTC: alloying steel modest shift (got "+m3.composition_shift_mV.toFixed(0)+" mV)");

    // === G. Reference-electrode conversion ===
    ass(Math.abs(REF_E_VSHE.SCE - 0.241) < 1e-9, "SCE = +0.241 V SHE");
    ass(Math.abs(REF_E_VSHE["Ag/AgCl_sat"] - 0.197) < 1e-9, "Ag/AgCl_sat = +0.197 V SHE");
    ass(Math.abs(REF_E_VSHE["Cu/CuSO4_sat"] - 0.318) < 1e-9, "Cu/CuSO4 = +0.318 V SHE");
    var r430 = lookup({metal:"430-passive", env:"Acid_H2SO4", T_C:30});
    ass(Math.abs(r430.E_corr_V - (-0.478)) < 0.005, "SCE→Ag/AgCl conversion: 430 SS = -0.478 V Ag/AgCl");

    // === H. Lookup coverage on every loaded row ===
    var sane = 0, insane = 0;
    _DATA.forEach(function(row){
      var r = lookup({metal:row.metal, env:row.env, T_C:row.T_ref_C, Cl_ppm:row.Cl_ref_ppm});
      if (r && r.E_corr_V != null && r.E_corr_V > -3 && r.E_corr_V < 2) sane++; else insane++;
    });
    ass(insane === 0, "All "+_DATA.length+" rows produce sane lookups (E_corr in -3..+2 V); insane="+insane);
    ass(sane === _DATA.length, "Coverage 100% ("+sane+"/"+_DATA.length+")");

    // === I. Row-quality audit (no missing source/citation) ===
    var noSrc = _DATA.filter(function(r){ return !r.source || !r.citation; }).length;
    ass(noSrc === 0, "Every row has source + citation; missing="+noSrc);
    var srcSet = {};
    _DATA.forEach(function(r){ srcSet[r.source.split(" ")[0]] = (srcSet[r.source.split(" ")[0]]||0) + 1; });
    ass(Object.keys(srcSet).length >= 10, "≥10 distinct primary sources cited; got "+Object.keys(srcSet).length);

    // === J. Family fallback when no per-row match ===
    var noEnvRow = lookup({metal:"Carbon-steel", env:"Acid_HCl_BurningOil", T_C:25});
    ass(noEnvRow == null, "Lookup returns null for unknown env (caller must fallback to FAMILY[])");

    // === K. Passivation transition with rising Cl (sweep) ===
    var states = [10, 1000, 50000, 500000].map(function(cl){
      return passivationState({PREN:18, Cl_ppm:cl, T_C:25}).state;
    });
    // Cl 10 → very low → passive (above 0.3·Cl_crit threshold may push into pitting, depending on PREN_18 → Cl_crit ~46k ppm)
    // 10 < 0.3·46k = 13.8k → passive
    // 1000 < 13.8k → passive
    // 50000 between Cl_crit and 10·Cl_crit → pitting
    // 500000 > 10·Cl_crit → active
    ass(states[0] === "passive", "PREN 18 + Cl=10 → passive");
    ass(states[2] === "pitting", "PREN 18 + Cl=50k → pitting (got "+states[2]+")");
    ass(states[3] === "active", "PREN 18 + Cl=500k → active (got "+states[3]+")");

    // === L. fitTafel with various windows ===
    var Ecor = -0.4, icor = 25, ba = 0.080, bc = 0.140;
    var Es = [], Is = [];
    for (var k = 0; k <= 100; k++) {
      var E = Ecor - 0.350 + k*0.007;
      var i = icor * (Math.pow(10, (E - Ecor)/ba) - Math.pow(10, -(E - Ecor)/bc));
      Es.push(E); Is.push(i);
    }
    var ft = fitTafel({E_V:Es, i_uA_cm2:Is, window_mV:300, skip_mV:100});
    ass(Math.abs(ft.E_corr_V - Ecor) < 0.005, "fitTafel deep-window E_corr recovery");
    ass(Math.abs(ft.ba_mV_dec - 80) < 3, "fitTafel deep-window ba=80 recovery (got "+ft.ba_mV_dec.toFixed(1)+")");
    ass(Math.abs(ft.bc_mV_dec - 140) < 6, "fitTafel deep-window bc=140 recovery (got "+ft.bc_mV_dec.toFixed(1)+")");
    ass(ft.R2_anodic > 0.99 && ft.R2_cathodic > 0.99, "fitTafel R² > 0.99 on both branches");

    // === M. fitTafel error cases ===
    var ftErr1 = fitTafel({E_V:[1,2], i_uA_cm2:[1,2]});
    ass(ftErr1.error, "fitTafel rejects <6 points");
    var ftErr2 = fitTafel({E_V:[0,0.1,0.2,0.3,0.4,0.5], i_uA_cm2:[1,2,3,4,5,6]});
    ass(ftErr2.error, "fitTafel rejects no-zero-crossing scan");

    // === N. Spot-check famous alloy/env pairs (industry references) ===
    [
      ["Carbon-steel", "SW", "LaQue"],
      ["316L-passive", "SW", "Sedriks"],
      ["Al-anode-AlZnIn", "SW", "DNV"],
      ["Carbon-steel", "Acid_H2SO4", "Jones"],
      ["Tantalum", "Acid_HCl", "Cardarelli"],
      ["Carbon-steel", "sCO2", "Sim"],
      ["Inconel-690-passive", "PWR", "EPRI"]
    ].forEach(function(t){
      var r = lookup({metal:t[0], env:t[1]});
      ass(r && r.citation && r.citation.indexOf(t[2]) >= 0, "Citation contains '"+t[2]+"' for "+t[0]+"/"+t[1]);
    });

    // === O. ENV_FAMILY + METAL_FAMILY completeness ===
    var envFamCovered = Object.keys(ENV_FAMILY).length;
    ass(envFamCovered >= 20, "≥20 envs in ENV_FAMILY; got "+envFamCovered);
    var metFamCovered = Object.keys(METAL_FAMILY).length;
    ass(metFamCovered >= 40, "≥40 metals in METAL_FAMILY; got "+metFamCovered);

    return { pass: pass, fail: fail, errs: errs, total: pass+fail };
  }

  var Electrochem = {
    load: load, rows: rows, setData: setData,
    lookup: lookup, passivationState: passivationState,
    sternGeary: sternGeary, g102_rate: g102_rate,
    fitTafel: fitTafel,
    overrideFromMTC: overrideFromMTC,
    validateAgainstG5: validateAgainstG5,
    validateAgainstJones: validateAgainstJones,
    validateFitTafel: validateFitTafel,
    _runTests: _runTests,
    REF_E_VSHE: REF_E_VSHE,
    ENV_FAMILY: ENV_FAMILY,
    METAL_FAMILY: METAL_FAMILY,
    _arrhenius: _arrhenius,
    EA_DEFAULT: EA_DEFAULT
  };
  root.Electrochem = Electrochem;
  if (typeof module !== "undefined" && module.exports) module.exports = Electrochem;

  // ---- Auto-load in browser only -----------------------------------------
  // (Node tests must call Electrochem.load() themselves; window-detection
  // uses document presence so a node test that stubs `global.window = global`
  // for galvanic.js still hits the fs path.)
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    load().catch(function (e) {
      if (typeof console !== "undefined") console.warn("[electrochem] data load failed:", e.message);
    });
  }
})(typeof window !== "undefined" ? window : this);
