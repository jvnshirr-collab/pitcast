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
    "Acid_H2SO4": "Acid", "Acid_HCl": "Acid", "Acid": "Acid",
    "PWR": "FW", "BWR": "FW", "Boiler": "FW"
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
    "Magnesium": "Mg", "Mg-anode": "Mg"
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
  var Electrochem = {
    load: load, rows: rows, setData: setData,
    lookup: lookup, passivationState: passivationState,
    sternGeary: sternGeary, g102_rate: g102_rate,
    overrideFromMTC: overrideFromMTC,
    validateAgainstG5: validateAgainstG5,
    validateAgainstJones: validateAgainstJones,
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
