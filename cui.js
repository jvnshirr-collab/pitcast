/* cui.js — Corrosion Under Insulation (CUI) risk screen per API 583 + NACE SP0198.
 *
 * Screening risk-ranking for insulated carbon/low-alloy steel (CUI) and austenitic
 * stainless steel (external chloride stress-corrosion cracking, ext-CSCC) piping
 * and vessels. Combines the documented temperature windows with multiplicative
 * factors for cyclic service, insulation type, weather jacket, surface coating,
 * age, and ambient atmosphere. Also flags insulation chosen outside its
 * service-T window and amplifies ext-CSCC risk for insulations with high
 * leachable chloride per ASTM C871.
 *
 * Sources cited in `ref`:
 *   - API RP 583 — Corrosion Under Insulation and Fireproofing (2nd ed., 2014).
 *     §4.3 (temperature windows), §5 (risk factors).
 *   - NACE SP0198-2017 — Control of Corrosion Under Thermal Insulation and
 *     Fireproofing Materials — A Systems Approach.
 *   - API RP 581 — Risk-Based Inspection Methodology, for inspection intervals.
 *   - ASTM C871-18 — Standard Test Methods for Chemical Analysis of Thermal
 *     Insulation Materials for Leachable Chloride, Fluoride, Silicate, and Sodium
 *     Ions. (THE definitive test for SS ext-CSCC hazard.)
 *   - Insulation property specs: ASTM C449 (cal-sil), C547 (mineral wool),
 *     C552 (cellular glass), C610 (perlite), C591 (PIR/PUR), C612 (fiberglass),
 *     C1126 (PIR), C1728 (aerogel), C534 (elastomeric), C1136 (jacketing).
 *   - NACE SP0212 / AWS C2.18 — TSA under-insulation coatings.
 *   - ISO 9223 — Atmospheric corrosivity categories C1–CX.
 *
 * Limits: order-of-magnitude risk ranking only. Not a substitute for a CUI
 * inspection plan or fitness-for-service evaluation of insulated piping.
 */
(function (root) {
  "use strict";

  // Temperature windows from API 583 §4.3 / §4.4
  function _tempFactor(material, T) {
    if (material === "SS") {
      if (T < 50 || T > 175) return { f: 0.0, region: "outside ext-CSCC window" };
      if (T >= 60 && T <= 150) return { f: 0.7, region: "peak ext-CSCC zone (60-150 °C)" };
      return { f: 0.4, region: "edge of ext-CSCC window" };
    }
    if (T < -12 || T > 175) return { f: 0.0, region: "outside CUI window" };
    if (T >= 60 && T <= 120) return { f: 0.7, region: "peak CUI zone (60-120 °C, API 583)" };
    if (T >= 0  && T <= 175) return { f: 0.4, region: "active CUI window" };
    return { f: 0.2, region: "low-T edge of CUI window" };
  }

  // ----------------------------------------------------------------------
  // INSULATION — each entry carries:
  //   f          : screening absorbency factor (relative)
  //   T_max_C    : max continuous service temperature (°C)
  //   T_min_C    : min continuous service temperature (°C)
  //   Cl_ppm     : ASTM C871 leachable chloride (ppm-Cl) — DRIVES SS ext-CSCC
  //   water_pct  : water absorption per ASTM C209/C447 (%)
  //   label      : marketing / standard name + standard ref
  // C871 leach values are typical max-spec for "low-chloride" / "SCC-safe"
  // formulations vs un-inhibited; vendors publish per-batch certificates.
  // ----------------------------------------------------------------------
  var INSULATION = {
    "cal-sil":         { f: 1.00, T_max_C: 650,  T_min_C: -45, Cl_ppm: 80,   water_pct: 90, label: "Calcium silicate (ASTM C449, wicks water)" },
    "cal-sil-hiT":     { f: 0.95, T_max_C: 1000, T_min_C: 0,   Cl_ppm: 60,   water_pct: 85, label: "Calcium silicate high-T (refractory-grade)" },
    "mineral-wool":    { f: 0.90, T_max_C: 650,  T_min_C: -50, Cl_ppm: 30,   water_pct: 50, label: "Mineral / rock wool (ASTM C547)" },
    "fiberglass":      { f: 0.85, T_max_C: 450,  T_min_C: -50, Cl_ppm: 25,   water_pct: 40, label: "Fiberglass blanket / board (ASTM C612)" },
    "ceramic-fiber":   { f: 0.85, T_max_C: 1260, T_min_C: 0,   Cl_ppm: 40,   water_pct: 30, label: "Refractory ceramic fiber (high-T furnace)" },
    "vermiculite":     { f: 0.80, T_max_C: 1100, T_min_C: 0,   Cl_ppm: 50,   water_pct: 60, label: "Vermiculite (exfoliated, lightweight)" },
    "perlite":         { f: 0.70, T_max_C: 650,  T_min_C: -45, Cl_ppm: 40,   water_pct: 30, label: "Perlite expanded (ASTM C610)" },
    "perlite-hydroph": { f: 0.55, T_max_C: 650,  T_min_C: -45, Cl_ppm: 25,   water_pct: 5,  label: "Hydrophobic perlite (treated, low wick)" },
    "PUF":             { f: 0.60, T_max_C: 110,  T_min_C: -180,Cl_ppm: 15,   water_pct: 3,  label: "Polyurethane foam PUR (ASTM C591)" },
    "PIR":             { f: 0.55, T_max_C: 150,  T_min_C: -180,Cl_ppm: 15,   water_pct: 3,  label: "Polyisocyanurate PIR (ASTM C1126, hi-T PUR)" },
    "elastomeric":     { f: 0.65, T_max_C: 105,  T_min_C: -50, Cl_ppm: 20,   water_pct: 5,  label: "Elastomeric foam (Armaflex/K-Flex, ASTM C534)" },
    "aerogel":         { f: 0.50, T_max_C: 200,  T_min_C: -200,Cl_ppm: 10,   water_pct: 2,  label: "Aerogel blanket (Cryogel/Pyrogel, ASTM C1728)" },
    "pyrogel-XT":      { f: 0.40, T_max_C: 650,  T_min_C: -40, Cl_ppm: 10,   water_pct: 2,  label: "Pyrogel XT/XTE (high-T aerogel, hydrophobic)" },
    "microporous":     { f: 0.40, T_max_C: 1000, T_min_C: 0,   Cl_ppm: 15,   water_pct: 3,  label: "Microporous silica (Microtherm, hi-T)" },
    "VIP":             { f: 0.30, T_max_C: 80,   T_min_C: -200,Cl_ppm: 5,    water_pct: 0,  label: "Vacuum insulation panel (VIP, cryogenic)" },
    "cellular-glass":  { f: 0.40, T_max_C: 480,  T_min_C: -260,Cl_ppm: 5,    water_pct: 0,  label: "Cellular / foam glass (ASTM C552, hydrophobic)" },
    "cellular-glass-CT":{ f: 0.35, T_max_C: 480, T_min_C: -260,Cl_ppm: 5,    water_pct: 0,  label: "Cellular glass cryogenic (Foamglas T4/HLB)" }
  };

  // JACKET per NACE SP0198 §7 + ASTM C1136.
  var JACKET = {
    "SS316":           { f: 0.45, label: "Stainless steel 316 jacket (ASTM A240)" },
    "SS304":           { f: 0.50, label: "Stainless steel 304 jacket (ASTM A240)" },
    "Al-5052":         { f: 0.65, label: "Aluminium 5052 jacket (marine grade)" },
    "Al-6061":         { f: 0.70, label: "Aluminium 6061 jacket (general)" },
    "Al-3003":         { f: 0.72, label: "Aluminium 3003 jacket (commodity)" },
    "Galv":            { f: 0.85, label: "Galvanised steel jacket (G90/G140)" },
    "GRP":             { f: 0.55, label: "GRP / FRP jacket (glass-reinforced polyester)" },
    "PVC":             { f: 0.75, label: "PVC jacket (lo-T, indoor)" },
    "Mylar":           { f: 0.95, label: "Mylar / Tedlar laminate (vapour barrier)" },
    "polysurlyn":      { f: 0.60, label: "Polysurlyn moisture barrier (under-jacket film)" },
    "stucco-Al":       { f: 0.68, label: "Stucco-embossed Al jacket (textured)" },
    "smooth-Al":       { f: 0.70, label: "Smooth Al jacket" },
    "painted-CS":      { f: 1.00, label: "Painted carbon-steel jacket (degraded)" },
    "none":            { f: 1.10, label: "No jacket / severely damaged" }
  };

  // COATING (under-insulation) per API 583 §5.4 / NACE SP0198 §5.
  var COATING = {
    "TSA-sealed":       { f: 0.15, T_max_C: 595, label: "TSA + sealer (NACE SP0212, premium long-life)" },
    "TSA":              { f: 0.20, T_max_C: 595, label: "Thermal-sprayed Al (TSA, no sealer)" },
    "high-T-epoxy":     { f: 0.35, T_max_C: 205, label: "High-T multi-coat epoxy phenolic (≤205 °C)" },
    "epoxy":            { f: 0.45, T_max_C: 120, label: "High-build epoxy / phenolic (≤120 °C)" },
    "inorganic-Zn":     { f: 0.55, T_max_C: 400, label: "Inorganic zinc primer (with topcoat ≤400 °C)" },
    "organic-Zn":       { f: 0.65, T_max_C: 120, label: "Organic zinc-rich primer (lower-T)" },
    "high-T-silicone":  { f: 0.60, T_max_C: 540, label: "High-T silicone (≤540 °C, refractory)" },
    "urethane-mastic":  { f: 0.70, T_max_C: 95,  label: "Urethane mastic (single-coat, mid-T)" },
    "ceramic-coating":  { f: 0.40, T_max_C: 760, label: "Ceramic coating (sol-gel / vitreous, hi-T)" },
    "fluoropolymer":    { f: 0.50, T_max_C: 260, label: "Fluoropolymer (PTFE / ETFE-based topcoat)" },
    "phenolic-mod":     { f: 0.55, T_max_C: 230, label: "Modified phenolic (acid-resistant)" },
    "alkyd":            { f: 0.80, T_max_C: 95,  label: "Alkyd / heat-resistant alkyd (degrades >120 °C)" },
    "alkyd-silicone":   { f: 0.70, T_max_C: 250, label: "Alkyd-silicone (legacy heat-resistant)" },
    "bare":             { f: 1.00, T_max_C: 1500,label: "Bare steel (no coating)" }
  };

  // AMBIENT — ISO 9223 atmospheric corrosivity categories C1–CX.
  // Each entry carries the assigned ISO 9223 class for cross-ref.
  var AMBIENT = {
    "marine":          { f: 1.30, iso: "C4-C5", label: "Marine — coastal Cl⁻ aerosol (ISO 9223 C4-C5)" },
    "tropical-coastal":{ f: 1.50, iso: "CX",    label: "Tropical coastal — marine + UV + heat (CX)" },
    "industrial":      { f: 1.10, iso: "C4",    label: "Industrial — SO₂ / acid rain (ISO 9223 C4)" },
    "urban-acid":      { f: 1.20, iso: "C4",    label: "Urban heavy-acid — refinery / coke plant" },
    "rural":           { f: 1.00, iso: "C2-C3", label: "Rural / suburban mild (ISO 9223 C2-C3)" },
    "arid":            { f: 0.80, iso: "C1-C2", label: "Arid / dry desert (ISO 9223 C1-C2)" },
    "polar":           { f: 0.90, iso: "C2",    label: "Polar / arctic (freeze-thaw cycles)" },
    "high-altitude":   { f: 0.85, iso: "C1",    label: "High altitude (cold, low-RH, UV)" },
    "fpso-topside":    { f: 1.60, iso: "CX",    label: "FPSO topside — extreme marine + process" },
    "refinery-vicinity":{ f: 1.40, iso: "C5",   label: "Refinery vicinity — acid + HC vapour" },
    "cooling-tower":   { f: 1.45, iso: "C5",    label: "Cooling-tower mist — chemical drift" },
    "geothermal":      { f: 1.40, iso: "C5",    label: "Geothermal — H₂S + CO₂ + steam" }
  };

  function risk(opts) {
    opts = opts || {};
    var mat = opts.material === "SS" ? "SS" : "CS";
    var T = +opts.T_C;
    var t = _tempFactor(mat, T);
    var warnings = [];
    if (!(t.f > 0)) {
      return {
        material: mat, T_C: T, inWindow: false, region: t.region,
        score: 0, level: "low", inspectionInterval: "routine",
        warnings: [],
        ref: "API RP 583 §4.3 / §4.4 — outside CUI / ext-CSCC temperature window."
      };
    }
    var ins = INSULATION[opts.insulation] || INSULATION["cal-sil"];
    var jac = JACKET[opts.jacket]         || JACKET["Galv"];
    var coat= COATING[opts.coating]       || COATING["bare"];
    var amb = AMBIENT[opts.ambient]       || AMBIENT["industrial"];
    var ageYr = +opts.ageYr || 0;
    var cyclic = !!opts.cyclic;

    // Service-T sanity checks vs. material limits
    if (T > ins.T_max_C) warnings.push("Service T (" + T + "°C) exceeds insulation T_max (" + ins.T_max_C + "°C, " + ins.label + ") — insulation will degrade / off-gas / lose binder.");
    if (T < ins.T_min_C) warnings.push("Service T (" + T + "°C) below insulation T_min (" + ins.T_min_C + "°C, " + ins.label + ") — risk of cracking / vapour-stop failure.");
    if (T > coat.T_max_C) warnings.push("Service T (" + T + "°C) exceeds coating T_max (" + coat.T_max_C + "°C, " + coat.label + ") — coating chalks / blisters / loses adhesion.");

    // ASTM C871 leachable chloride amplifies SS ext-CSCC.
    // Industry rule of thumb: Cl-leach > 25 ppm raises ext-CSCC concern.
    var f_Cl = 1.0;
    if (mat === "SS") {
      // log-linear ramp: 5 ppm → 1.0, 100 ppm → 1.6, capped
      f_Cl = Math.min(1.8, Math.max(0.8, 1.0 + 0.3 * Math.log10(Math.max(1, ins.Cl_ppm / 5))));
      if (ins.Cl_ppm > 50) warnings.push("Insulation C871 leachable Cl (" + ins.Cl_ppm + " ppm) > 50 ppm — for SS ext-CSCC service, prefer cellular glass / aerogel / VIP (<10 ppm Cl).");
    }

    var f_age = Math.min(1.5, 0.6 + 0.04 * Math.max(0, ageYr));   // saturates around ~20 yr
    var f_cyc = cyclic ? 1.5 : 1.0;
    var score = t.f * ins.f * jac.f * coat.f * amb.f * f_age * f_cyc * f_Cl;
    score = Math.max(0, Math.min(3.0, score));
    var level, interval;
    if      (score < 0.20) { level = "low";     interval = "5–10 yr (routine external visual)"; }
    else if (score < 0.55) { level = "medium";  interval = "3–5 yr (targeted visual + selective NDT)"; }
    else if (score < 1.10) { level = "high";    interval = "1–3 yr (planned insulation-removal NDT)"; }
    else                   { level = "severe";  interval = "< 1 yr / immediate (insulation strip + 100% NDT)"; }
    return {
      material: mat, T_C: T, inWindow: true, region: t.region,
      ageYr: ageYr, cyclic: cyclic,
      factors: {
        temperature: t.f, insulation: ins.f, jacket: jac.f,
        coating: coat.f, ambient: amb.f, age: f_age, cyclic: f_cyc,
        leachable_Cl: f_Cl
      },
      properties: {
        insulation_T_max_C: ins.T_max_C, insulation_T_min_C: ins.T_min_C,
        insulation_Cl_ppm_C871: ins.Cl_ppm, insulation_water_pct: ins.water_pct,
        coating_T_max_C: coat.T_max_C, ambient_ISO9223: amb.iso
      },
      categories: {
        insulation: ins.label, jacket: jac.label, coating: coat.label, ambient: amb.label
      },
      score: score, level: level, inspectionInterval: interval,
      warnings: warnings,
      ref: "API RP 583 §4.3-4.4 (CUI / ext-CSCC T windows), §5 (factors); NACE SP0198-2017 "
         + "(systems approach: coatings, insulation, jacketing); inspection intervals "
         + "per API RP 581; insulation ASTM specs (C449/C547/C552/C591/C610/C612/C1126/C1728); "
         + "ASTM C871 leachable-Cl test (drives SS ext-CSCC); jacketing ASTM C1136; "
         + "ISO 9223 atmospheric corrosivity. Specific multipliers are a screening "
         + "combination of cited factor categories — flag as screening, not a "
         + "single-paper formula."
    };
  }

  /* Worked examples (API 583 case-study patterns):
   *  - Cold-end caustic line, CS, T=90 °C, cal-sil insulation, galv jacket, alkyd coat,
   *    marine, 12 yr in service, cyclic:
   *    score ≈ 1.00 → high. Plus warning: alkyd T_max=95 °C is borderline.
   *  - SS line same T but cal-sil (C871=80 ppm Cl) vs cellular-glass (5 ppm Cl):
   *    cal-sil: f_Cl ≈ 1 + 0.3*log10(80/5) = 1 + 0.36 = 1.36 → score amplified 36%
   *    cellular: f_Cl = 1.0 → no amplification.
   *    The C871 differential is exactly why insulation choice matters for SS.
   */

  var CUI = {
    INSULATION: INSULATION, JACKET: JACKET, COATING: COATING, AMBIENT: AMBIENT,
    risk: risk
  };
  root.CUI = CUI;
  if (typeof module !== "undefined" && module.exports) module.exports = CUI;
})(typeof window !== "undefined" ? window : this);
