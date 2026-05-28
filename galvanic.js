/* galvanic.js — Galvanic couple risk screen with mixed-potential I_corr.
 *
 * Vanilla JS. Two-metal couple in a shared electrolyte. The less-noble member
 * (anode) dissolves; the more-noble (cathode) is protected. The driving force
 * is the free-corrosion potential difference ΔE; the rate on the anode comes
 * from mixed-potential theory (Stansbury & Buchanan §4 / ASTM G102).
 *
 * MIXED-POTENTIAL RATE CALC:
 *   At the couple's mixed potential E_couple:
 *     log(i_galv / i0_a) = (E_couple - E_a) / ba_a       (anode anodic Tafel branch)
 *     log(i_galv / i0_c) = (E_c - E_couple) / bc_c       (cathode cathodic Tafel branch)
 *   Adding gives:
 *     log(i_galv) = [ΔE + ba_a·log(i0_a) + bc_c·log(i0_c)] / (ba_a + bc_c)
 *   Then ANODE current density on the (smaller) anode:
 *     i_anode = min(i_lim_c, i_galv · A_c/A_a)
 *   where i_lim_c is the cathode mass-transfer limit (O₂ diffusion ≈ 0.1–5 A/m²
 *   depending on flow). The rate (mm/yr) on the anode follows ASTM G102:
 *     CR_mm_yr = 3.27e-3 · i_µA_cm² · EW / ρ   (with i_µA_cm² = i_A_m² × 0.1)
 *
 * Sources cited in `ref`:
 *   - ASTM G82-98(2014) — Standard Guide for Development and Use of a Galvanic
 *     Series for Predicting Galvanic Corrosion Performance.
 *   - ASTM G102-89(2015) — Standard Practice for Calculation of Corrosion Rates
 *     and Related Information from Electrochemical Measurements.
 *   - MIL-STD-889C — Dissimilar Metals (galvanic series in seawater).
 *   - NACE TM0394 — Galvanic-series measurement protocol.
 *   - LaQue F.L., "Marine Corrosion: Causes and Prevention" (Wiley, 1975) Ch.6
 *     — E_corr + Tafel parameters for marine alloys.
 *   - Stansbury & Buchanan, "Fundamentals of Electrochemical Corrosion" (ASM 2000)
 *     Ch. 4 — mixed-potential theory & Tafel parameter reference values.
 *   - Trethewey & Chamberlain, "Corrosion for Science and Engineering" 2nd ed
 *     (Longman 1995) Tab. 3.4 — exchange current densities.
 *
 * E_corr values are screening typicals in flowing aerated natural seawater at
 * ambient T (~15–25 °C), Ag/AgCl reference. Tafel + i0 are family typicals;
 * vendor data varies ±30 mV (E) and ±decade (i0). The COMPATIBILITY DECISION
 * still rests on ΔE bands; the rate is a screening estimate flagged as such.
 */
(function (root) {
  "use strict";

  // --------------------------------------------------------------------
  // FAMILY defaults for Tafel + electrochemistry. Industry typical values
  // per Stansbury & Buchanan (2000) §4 + Trethewey & Chamberlain Tab 3.4.
  //   ba_mV   anodic Tafel slope (mV/decade)
  //   bc_mV   cathodic Tafel slope (mV/decade, default O₂ reduction)
  //   i0_a    anodic exchange current density (A/m²)
  //   i0_c    cathodic exchange current density (A/m²) — O₂ red. on this metal
  //   n       electrons per atom dissolving
  //   EW      equivalent weight (g/mol-eq) = M_atomic / n
  //   rho     density (g/cm³)
  // --------------------------------------------------------------------
  var FAMILY = {
    "noble":         { ba: 60, bc: 120, i0_a: 1e-7, i0_c: 1e-2, n: 1, EW:100,  rho:10.0 },
    "Ti-passive":    { ba: 50, bc: 120, i0_a: 1e-7, i0_c: 1e-3, n: 4, EW: 12,  rho: 4.5 },
    "Ni-base":       { ba: 60, bc: 120, i0_a: 1e-4, i0_c: 5e-3, n: 2, EW: 29,  rho: 8.9 },
    "SS-passive":    { ba: 60, bc: 120, i0_a: 1e-5, i0_c: 5e-3, n: 2, EW: 28,  rho: 7.9 },
    "SS-active":     { ba: 80, bc: 120, i0_a: 1e-2, i0_c: 5e-3, n: 2, EW: 28,  rho: 7.9 },
    "Cu-alloy":      { ba: 60, bc: 120, i0_a: 1e-3, i0_c: 5e-3, n: 2, EW: 31.7,rho: 8.96 },
    "Sn":            { ba: 70, bc: 120, i0_a: 1e-3, i0_c: 1e-3, n: 2, EW: 59.4,rho: 7.30 },
    "Pb":            { ba: 80, bc: 120, i0_a: 1e-3, i0_c: 5e-3, n: 2, EW:103.6,rho:11.34 },
    "Cd":            { ba: 80, bc: 120, i0_a: 1e-2, i0_c: 1e-3, n: 2, EW: 56.2,rho: 8.65 },
    "Cr":            { ba: 60, bc: 120, i0_a: 1e-4, i0_c: 1e-3, n: 3, EW: 17.3,rho: 7.19 },
    "CS":            { ba: 80, bc: 120, i0_a: 1e-3, i0_c: 1e-3, n: 2, EW: 27.9,rho: 7.87 },
    "Al-passive":    { ba: 80, bc: 120, i0_a: 1e-5, i0_c: 1e-3, n: 3, EW:  9.0,rho: 2.70 },
    "Al-active":     { ba: 80, bc: 120, i0_a: 1e-1, i0_c: 1e-3, n: 3, EW:  9.0,rho: 2.70 },
    "Zn":            { ba: 70, bc: 120, i0_a: 1e-1, i0_c: 1e-2, n: 2, EW: 32.7,rho: 7.14 },
    "Be":            { ba: 80, bc: 120, i0_a: 1e-1, i0_c: 1e-3, n: 2, EW:  4.5,rho: 1.85 },
    "Mg":            { ba: 80, bc: 120, i0_a: 1.0e0,i0_c: 1e-2, n: 2, EW: 12.2,rho: 1.74 }
  };

  // E_corr (V vs Ag/AgCl, flowing aerated seawater, ambient T). Listed
  // noble → active. `f` is family key for Tafel + EW lookup.
  var METALS = {
    "Graphite":          { E: +0.30, f: "noble",      label: "Graphite (impressed-current anode / brushes)" },
    "Platinum":          { E: +0.25, f: "noble",      label: "Platinum" },
    "Gold":              { E: +0.15, f: "noble",      label: "Gold" },
    "Silver":            { E: +0.05, f: "noble",      label: "Silver" },
    "Ti-Gr2":            { E: +0.06, f: "Ti-passive", label: "Titanium Gr 2 (commercially pure)" },
    "Ti-Gr5":            { E: +0.04, f: "Ti-passive", label: "Titanium Gr 5 (Ti-6Al-4V)" },
    "Ti-Gr7":            { E: +0.07, f: "Ti-passive", label: "Titanium Gr 7 (Ti-Pd, hi-corrosion)" },
    "Tantalum":          { E: +0.05, f: "noble",      label: "Tantalum" },
    "Niobium":           { E: +0.00, f: "noble",      label: "Niobium / columbium" },
    "Alloy-22":          { E: -0.03, f: "Ni-base",    label: "Hastelloy C-22 (Ni-Cr-Mo, passive)" },
    "Hastelloy-C276":    { E: -0.05, f: "Ni-base",    label: "Hastelloy C-276 (passive)" },
    "Alloy-625":         { E: -0.05, f: "Ni-base",    label: "Inconel 625 (Ni-Cr-Mo, passive)" },
    "Alloy-G30":         { E: -0.06, f: "Ni-base",    label: "Hastelloy G-30 (passive)" },
    "Alloy-825":         { E: -0.08, f: "Ni-base",    label: "Incoloy 825 (Ni-Fe-Cr-Mo, passive)" },
    "Inconel-600-passive":{E: -0.10, f: "Ni-base",    label: "Inconel 600 (N06600, PWR steam-generator legacy)" },
    "Inconel-690-passive":{E: -0.10, f: "Ni-base",    label: "Inconel 690 (N06690, 30Cr — PWR replacement)" },
    "904L-passive":      { E: -0.08, f: "SS-passive", label: "904L super-austenitic SS (passive)" },
    "254SMO-passive":    { E: -0.07, f: "SS-passive", label: "254SMO / S31254 6Mo super-austenitic (passive)" },
    "Alloy20-passive":   { E: -0.10, f: "SS-passive", label: "Alloy 20 / CN-7M (passive, acid service)" },
    "316L-passive":      { E: -0.10, f: "SS-passive", label: "316L stainless (passive, aerated)" },
    "317L-passive":      { E: -0.11, f: "SS-passive", label: "317L stainless (passive)" },
    "304-passive":       { E: -0.10, f: "SS-passive", label: "304/304L stainless (passive, aerated)" },
    "2205-passive":      { E: -0.09, f: "SS-passive", label: "2205 duplex (S32205, passive)" },
    "2507-passive":      { E: -0.08, f: "SS-passive", label: "2507 super-duplex (S32750, passive)" },
    "13Cr-passive":      { E: -0.15, f: "SS-passive", label: "13Cr martensitic SS (S41000 / S42000, passive)" },
    "17-4PH-passive":    { E: -0.10, f: "SS-passive", label: "17-4PH precipitation-hard SS (passive)" },
    "430-passive":       { E: -0.15, f: "SS-passive", label: "430 ferritic SS (S43000, passive) — ASTM G5 reference" },
    "Ni-200":            { E: -0.10, f: "Ni-base",    label: "Nickel 200 / 201 (pure)" },
    "Monel-400":         { E: -0.15, f: "Ni-base",    label: "Monel 400 (Ni-Cu)" },
    "Monel-K500":        { E: -0.14, f: "Ni-base",    label: "Monel K-500 (age-hard Ni-Cu)" },
    "Beryllium-Cu":      { E: -0.20, f: "Cu-alloy",   label: "Beryllium-copper (C17200)" },
    "70-30-CuNi":        { E: -0.25, f: "Cu-alloy",   label: "70-30 Cu-Ni (C71500)" },
    "90-10-CuNi":        { E: -0.28, f: "Cu-alloy",   label: "90-10 Cu-Ni (C70600)" },
    "Aluminum-bronze":   { E: -0.31, f: "Cu-alloy",   label: "Aluminium-bronze (C95800 / NAB)" },
    "Manganese-bronze":  { E: -0.27, f: "Cu-alloy",   label: "Manganese bronze (C86500)" },
    "Phosphor-bronze":   { E: -0.31, f: "Cu-alloy",   label: "Phosphor bronze (C51000)" },
    "Copper":            { E: -0.30, f: "Cu-alloy",   label: "Copper (pure)" },
    "Brass-Naval":       { E: -0.30, f: "Cu-alloy",   label: "Naval brass (C46400)" },
    "Brass-Yellow":      { E: -0.28, f: "Cu-alloy",   label: "Yellow brass (C26800)" },
    "Tin":               { E: -0.35, f: "Sn",         label: "Tin (Sn)" },
    "Lead":              { E: -0.50, f: "Pb",         label: "Lead (Pb)" },
    "Chromium":          { E: -0.45, f: "Cr",         label: "Chromium (electroplated)" },
    "316L-active":       { E: -0.55, f: "SS-active",  label: "316L stainless (ACTIVE — crevice / no O₂)" },
    "304-active":        { E: -0.55, f: "SS-active",  label: "304 stainless (ACTIVE — crevice / no O₂)" },
    "2205-active":       { E: -0.50, f: "SS-active",  label: "2205 duplex (ACTIVE state)" },
    "13Cr-active":       { E: -0.60, f: "SS-active",  label: "13Cr martensitic SS (ACTIVE)" },
    "Cast-iron":         { E: -0.65, f: "CS",         label: "Cast iron (gray / ductile)" },
    "Carbon-steel":      { E: -0.68, f: "CS",         label: "Carbon / low-alloy steel (generic)" },
    "Carbon-steel-A36":  { E: -0.68, f: "CS",         label: "Carbon steel ASTM A36 (structural)" },
    "Carbon-steel-A537": { E: -0.68, f: "CS",         label: "Carbon steel ASTM A537 (PV plate)" },
    "API-5L-X65":        { E: -0.68, f: "CS",         label: "API 5L X65 pipeline steel" },
    "4140-steel":        { E: -0.68, f: "CS",         label: "AISI 4140 low-alloy (Cr-Mo)" },
    "Wrought-iron":      { E: -0.65, f: "CS",         label: "Wrought iron (legacy)" },
    "Cadmium":           { E: -0.75, f: "Cd",         label: "Cadmium (plating, restricted)" },
    "Al-2024":           { E: -0.80, f: "Al-passive", label: "Al 2024 (Cu-bearing, aerospace)" },
    "Al-6061":           { E: -0.85, f: "Al-passive", label: "Aluminium 6061 (general)" },
    "Al-6063":           { E: -0.85, f: "Al-passive", label: "Aluminium 6063 (extrusion)" },
    "Al-7075":           { E: -0.85, f: "Al-passive", label: "Aluminium 7075 (aerospace)" },
    "Al-1100":           { E: -0.85, f: "Al-passive", label: "Aluminium 1100 (commercially pure)" },
    "Al-3003":           { E: -0.85, f: "Al-passive", label: "Aluminium 3003 (Mn-bearing)" },
    "Al-5052":           { E: -0.85, f: "Al-passive", label: "Aluminium 5052 (marine)" },
    "Al-5083":           { E: -0.85, f: "Al-passive", label: "Aluminium 5083 (marine, hi-Mg, ABS)" },
    "Al-5086":           { E: -0.85, f: "Al-passive", label: "Aluminium 5086 (marine plate)" },
    "Al-Brass":          { E: -0.32, f: "Cu-alloy",   label: "Aluminium brass (C68700, condenser tube)" },
    "Galvanised-steel":  { E: -1.00, f: "Zn",         label: "Galvanised (Zn-coated) steel" },
    "Zinc":              { E: -1.03, f: "Zn",         label: "Zinc (pure)" },
    "Zn-anode":          { E: -1.05, f: "Zn",         label: "Zn sacrificial anode (MIL-DTL-18001)" },
    "Al-anode-AlZnIn":   { E: -1.05, f: "Al-active",  label: "Al-Zn-In sacrificial anode (DNV-RP-B401)" },
    "Beryllium":         { E: -1.60, f: "Be",         label: "Beryllium" },
    "Magnesium":         { E: -1.62, f: "Mg",         label: "Magnesium (pure)" },
    "Mg-anode":          { E: -1.65, f: "Mg",         label: "Mg sacrificial anode (ASTM B843 H-1 / AZ-63)" }
  };

  function _fam(metalKey){
    var m = METALS[metalKey];
    return m ? FAMILY[m.f] || FAMILY["CS"] : FAMILY["CS"];
  }

  /** Vendor / textbook polarisation lookup with graceful fallback.
   *  Returns a Tafel + EW packet shaped like FAMILY[], but pulled from
   *  the cited polarisation dataset (electrochem.js) when available. */
  function _lookupTafel(metalKey, env, T_C, Cl_ppm, PREN) {
    var fallback = _fam(metalKey);
    if (typeof window === "undefined" || !window.Electrochem || !window.Electrochem.rows) return fallback;
    var pol = window.Electrochem.lookup({
      metal: metalKey, env: env || "SW",
      T_C: T_C != null ? T_C : 25,
      Cl_ppm: Cl_ppm != null ? Cl_ppm : (env === "FW" ? 10 : 19000),
      PREN: PREN
    });
    if (!pol) return fallback;
    return {
      ba: pol.ba_mV_dec != null ? pol.ba_mV_dec : fallback.ba,
      bc: pol.bc_mV_dec != null ? pol.bc_mV_dec : fallback.bc,
      i0_a: pol.i0_a_A_m2 != null ? pol.i0_a_A_m2 : fallback.i0_a,
      i0_c: pol.i0_c_A_m2 != null ? pol.i0_c_A_m2 : fallback.i0_c,
      n: pol.n || fallback.n,
      EW: pol.EW || fallback.EW,
      rho: pol.rho_g_cm3 || fallback.rho,
      E_corr_V: pol.E_corr_V,
      i_pass_uA_cm2: pol.i_pass_uA_cm2,
      E_pit_V: pol.E_pit_V,
      passivationState: pol.passivationState,
      uncertainty: pol.uncertainty,
      source: pol.source,
      citation: pol.citation,
      cited: true
    };
  }

  /** Galvanic couple risk + mixed-potential I_corr per ASTM G102.
   * @param {object} o
   * @param {string} o.a    member A key (METALS)
   * @param {string} o.b    member B key
   * @param {number} o.areaRatio  A_cathode / A_anode (≥1 = small anode, worst case)
   * @param {string} [o.flow]     "stagnant" | "moderate" | "flowing" — sets O₂-limited i_lim
   * @param {string} [o.env]      "SW" | "FW" | "NaCl" | "Soil" | "Acid_H2SO4" | "Acid_HCl"
   * @param {number} [o.T_C]      electrolyte temperature, °C (defaults 25)
   * @param {number} [o.Cl_ppm]   chloride concentration (defaults SW 19k / FW 10)
   * @param {number} [o.PREN]     PREN_N30 of any passive alloy (Galvele overlay)
   */
  function couple(o) {
    o = o || {};
    var A = METALS[o.a], B = METALS[o.b];
    if (!A || !B) return { error: "unknown metal", a: o.a, b: o.b };

    // anode = less noble (lower E), with override from cited polarisation
    // data if E_corr is present (per Stansbury §4 the published E_corr in
    // the *specific* electrolyte trumps the screening series value).
    var env  = o.env || "SW";
    var T_C  = o.T_C != null ? +o.T_C : 25;
    var Cl_ppm = o.Cl_ppm != null ? +o.Cl_ppm : (env === "FW" ? 10 : 19000);
    var PREN = +o.PREN || NaN;
    var fA_full = _lookupTafel(o.a, env, T_C, Cl_ppm, PREN);
    var fB_full = _lookupTafel(o.b, env, T_C, Cl_ppm, PREN);
    var EA = fA_full.E_corr_V != null ? fA_full.E_corr_V : A.E;
    var EB = fB_full.E_corr_V != null ? fB_full.E_corr_V : B.E;
    var anode = EA < EB ? { k: o.a, m: A, E: EA, f: fA_full }
                        : { k: o.b, m: B, E: EB, f: fB_full };
    var cath  = EA < EB ? { k: o.b, m: B, E: EB, f: fB_full }
                        : { k: o.a, m: A, E: EA, f: fA_full };
    var fA = anode.f, fC = cath.f;
    var dE_V  = Math.abs(EA - EB);
    var dE_mV = dE_V * 1000;
    var rA = +o.areaRatio; if (!(rA > 0)) rA = 1;

    // Mass-transfer limit on the cathode (O₂ diffusion in seawater).
    // ISO 12473 / LaQue: stagnant ≈ 0.1, moderate ≈ 1, flowing ≈ 5 A/m².
    var i_lim_c = { stagnant: 0.1, moderate: 1.0, flowing: 5.0 }[o.flow || "moderate"];

    // Mixed-potential current density (A/m²) at parity area:
    //   log(i_galv) = [ΔE_V + ba·log(i0_a) + bc·log(i0_c)] / (ba + bc)
    // with ba & bc in V/decade (mV/dec ÷ 1000).
    var ba_V = fA.ba / 1000;
    var bc_V = fC.bc / 1000;
    var logI = (dE_V + ba_V*Math.log10(fA.i0_a) + bc_V*Math.log10(fC.i0_c)) / (ba_V + bc_V);
    var i_galv = Math.pow(10, logI);                            // A/m², parity-area
    var i_anode = Math.min(i_lim_c, i_galv * rA);               // small-anode amplification, capped at O₂ limit
    var capped = (i_galv * rA >= i_lim_c);

    // ASTM G102 conversion: CR (mm/yr) = 3.27e-3 · i_µA_cm² · EW / ρ
    // and 1 A/m² = 0.1 µA/cm² × 1000 = 100 µA/cm² (1 A/m² = 100 µA/cm²)
    // → CR_mm_yr = 3.27e-3 · (i_A_m² · 100) · EW / ρ = 0.327 · i_A_m² · EW / ρ
    // Hmm — ASTM G102 Eq 1: CR (mm/yr) = K · (i_µA_cm²) · EW / ρ ; K = 3.27e-3.
    // 1 A/m² ≡ 0.1 mA/cm² ≡ 100 µA/cm². So:
    //   CR = 3.27e-3 · (i_A_m² × 100) · EW / ρ = 0.327 · i_A_m² · EW / ρ
    var CR_mm_yr_anode = 0.327 * i_anode * fA.EW / fA.rho;

    // Engineering risk band (driven by ΔE, modulated by area ratio)
    var raw;
    if (dE_mV < 50)       raw = 0.10;
    else if (dE_mV < 100) raw = 0.30;
    else if (dE_mV < 250) raw = 0.60;
    else if (dE_mV < 500) raw = 0.85;
    else                  raw = 1.10;
    var areaMult = 1 + Math.log10(Math.max(1, rA));
    var score = Math.min(2.0, raw * Math.max(1, areaMult * 0.7));
    var level = score < 0.20 ? "low"
              : score < 0.55 ? "medium"
              : score < 1.00 ? "high" : "severe";

    var msg;
    if (dE_mV < 50) msg = "ΔE < 50 mV — compatible; no isolation required for typical service.";
    else if (dE_mV < 100) msg = "ΔE 50–100 mV — minor galvanic; consider isolation where ingress likely.";
    else if (dE_mV < 250) msg = "ΔE 100–250 mV — galvanic likely; electrically isolate (gasket / spool / coating).";
    else msg = "ΔE > 250 mV — severe; isolate, and avoid small-anode geometries entirely.";
    if (rA > 10) msg += " Cathode/anode area ratio " + rA.toFixed(0) + "× — small-anode amplification: dissolution on " + anode.m.label + " will concentrate at the smallest exposed feature.";
    if (capped) msg += " Anode current capped at cathodic O₂-diffusion limit (" + i_lim_c.toFixed(1) + " A/m²) — actual rate may be lower in stagnant / oxygen-depleted electrolyte.";

    return {
      a: o.a, b: o.b,
      anode: anode.m.label, anode_E: anode.E,
      cathode: cath.m.label, cathode_E: cath.E,
      deltaE_mV: dE_mV, areaRatio: rA, areaMultiplier: areaMult,
      flow: o.flow || "moderate", i_lim_cathode_Am2: i_lim_c,
      env: env, T_C: T_C, Cl_ppm: Cl_ppm, PREN: isFinite(PREN) ? PREN : null,
      i_galv_parity_Am2: i_galv,
      i_anode_Am2: i_anode,
      mass_transfer_capped: capped,
      CR_anode_mm_yr: CR_mm_yr_anode,
      ba_anode_mV_dec: fA.ba, bc_cathode_mV_dec: fC.bc,
      i0_anode_Am2: fA.i0_a, i0_cathode_Am2: fC.i0_c,
      EW_anode: fA.EW, rho_anode_g_cm3: fA.rho,
      anode_polarisation_cited: !!fA.cited, cathode_polarisation_cited: !!fC.cited,
      anode_source: fA.source || null, cathode_source: fC.source || null,
      anode_passivation: fA.passivationState || null,
      cathode_passivation: fC.passivationState || null,
      anode_E_pit_V: fA.E_pit_V != null ? fA.E_pit_V : null,
      cathode_E_pit_V: fC.E_pit_V != null ? fC.E_pit_V : null,
      score: score, level: level,
      note: msg,
      ref: "ASTM G82-98(2014) galvanic series; ASTM G102-89(2015) corrosion-rate "
         + "calculation; MIL-STD-889C (Dissimilar Metals); NACE TM0394; "
         + "LaQue (1975) Marine Corrosion Ch.6; Stansbury & Buchanan (2000) "
         + "Ch.4 (mixed-potential theory + Tafel); Trethewey & Chamberlain (1995) "
         + "Tab 3.4. " + (fA.cited || fC.cited
           ? "Polarisation parameters from cited rows (electrochem.js / data/polarization.json) "
           + "with Arrhenius i0(T) Ea=40 kJ/mol per Jones §3.4; Galvele 1976 passivation overlay. "
           : "Tafel ba/bc + i0 are family screening typicals; vendor-specific "
           + "polarization data should be used for design. ")
         + "O₂-diffusion limit per ISO 12473 (stagnant 0.1 / moderate 1 / flowing 5 A/m²)."
    };
  }

  /* WORKED EXAMPLES (rate-grade):
   *  - 316L (pass) bolt in CS flange, A_c/A_a = 50, moderate flow:
   *      ΔE = 580 mV; ba_a=80 mV/dec, bc_c=120 mV/dec, i0_a=1e-3, i0_c=5e-3
   *      logI = (0.580 + 0.080·log(1e-3) + 0.120·log(5e-3)) / 0.200
   *           = (0.580 - 0.240 - 0.276) / 0.200 = 0.064/0.200 = 0.32
   *      i_galv ≈ 2.1 A/m², · A_c/A_a 50 = 105 A/m² → capped at i_lim 1.0 A/m²
   *      Bolt CR ≈ 0.327·1.0·27.9/7.87 ≈ 1.16 mm/yr — realistic acceleration.
   *  - Cu pipe + 316L fitting, A_c/A_a = 0.1 (large Cu, small SS):
   *      ΔE=200 mV, i_anode caps similarly → SS rate ~0.3 mm/yr — matches
   *      published "Cu pipework accelerates SS fitting" anecdote. */

  var Galvanic = { METALS: METALS, FAMILY: FAMILY, couple: couple };
  root.Galvanic = Galvanic;
  if (typeof module !== "undefined" && module.exports) module.exports = Galvanic;
})(typeof window !== "undefined" ? window : this);
