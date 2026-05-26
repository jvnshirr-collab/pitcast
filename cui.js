/* cui.js — Corrosion Under Insulation (CUI) risk screen per API 583 + NACE SP0198.
 *
 * Screening risk-ranking for insulated carbon/low-alloy steel (CUI) and austenitic
 * stainless steel (external chloride stress-corrosion cracking, ext-CSCC) piping
 * and vessels. Combines the documented temperature windows with multiplicative
 * factors for cyclic service, insulation type, weather jacket, surface coating,
 * age, and ambient atmosphere. Output: a risk level (low / medium / high / severe)
 * and a screening inspection-interval recommendation.
 *
 * Sources cited in `ref`:
 *   - API RP 583 — Corrosion Under Insulation and Fireproofing (2nd ed., 2014).
 *     Section 4.3 (temperature windows), Section 5 (risk factors), Annexes (data).
 *   - NACE SP0198-2017 — Control of Corrosion Under Thermal Insulation and
 *     Fireproofing Materials — A Systems Approach. Sections on materials,
 *     coatings, jackets, vapour stops.
 *   - API RP 581 — Risk-Based Inspection Methodology, for inspection intervals.
 *   - ASTM specifications for insulation: C449 (cal-sil), C547 (mineral wool),
 *     C552 (cellular glass), C610 (perlite), C591 (PIR/PUR), C1728 (aerogel
 *     blanket), C1136 (jacketing), C534 (elastomeric), C1126 (PIR-rigid).
 *   - NACE SP0212 / AWS C2.18 — TSA under-insulation coatings.
 *
 * Approach: the temperature window and the *categories* of contributing factor
 * (insulation absorbency, jacket integrity, coating type, age, atmosphere) are
 * directly per API 583 / NACE SP0198. The specific multipliers are a screening
 * combination consistent with those category rankings — NOT a single-paper
 * formula; flagged as screening in `ref`.
 *
 * Limits: order-of-magnitude risk ranking only. Not a substitute for a CUI
 * inspection plan or fitness-for-service evaluation of insulated piping.
 */
(function (root) {
  "use strict";

  // Temperature windows from API 583 §4.3 / §4.4
  // CS / low-alloy: water + O2 + steel → active CUI in approx -12 °C ... 175 °C.
  //   Peak (most aggressive, water present + active corrosion): ~60-120 °C.
  // Austenitic SS external Cl-SCC ("ext-CSCC"): ~50 °C ... 175 °C, peak ~60-150 °C.
  function _tempFactor(material, T) {
    if (material === "SS") {
      if (T < 50 || T > 175) return { f: 0.0, region: "outside ext-CSCC window" };
      if (T >= 60 && T <= 150) return { f: 0.7, region: "peak ext-CSCC zone (60-150 °C)" };
      return { f: 0.4, region: "edge of ext-CSCC window" };
    }
    // CS / low-alloy
    if (T < -12 || T > 175) return { f: 0.0, region: "outside CUI window" };
    if (T >= 60 && T <= 120) return { f: 0.7, region: "peak CUI zone (60-120 °C, API 583)" };
    if (T >= 0  && T <= 175) return { f: 0.4, region: "active CUI window" };
    return { f: 0.2, region: "low-T edge of CUI window" };
  }

  // ----------------------------------------------------------------------
  // INSULATION — relative absorbency / leached-chloride ranking from NACE
  // SP0198 §6 + manufacturer / standard data sheets. Cellular glass and
  // aerogel-XT are the lowest-risk under wetted service; cal-sil + mineral
  // wool the highest; PIR/elastomeric in the middle.
  // ----------------------------------------------------------------------
  var INSULATION = {
    "cal-sil":         { f: 1.00, label: "Calcium silicate (ASTM C449, wicks water)" },
    "cal-sil-hiT":     { f: 0.95, label: "Calcium silicate high-T (refractory-grade)" },
    "mineral-wool":    { f: 0.90, label: "Mineral / rock wool (ASTM C547)" },
    "fiberglass":      { f: 0.85, label: "Fiberglass blanket / board (ASTM C612)" },
    "ceramic-fiber":   { f: 0.85, label: "Refractory ceramic fiber (high-T furnace)" },
    "vermiculite":     { f: 0.80, label: "Vermiculite (exfoliated, lightweight)" },
    "perlite":         { f: 0.70, label: "Perlite expanded (ASTM C610)" },
    "perlite-hydroph": { f: 0.55, label: "Hydrophobic perlite (treated, low wick)" },
    "PUF":             { f: 0.60, label: "Polyurethane foam PUR (ASTM C591)" },
    "PIR":             { f: 0.55, label: "Polyisocyanurate PIR (ASTM C1126, hi-T PUR)" },
    "elastomeric":     { f: 0.65, label: "Elastomeric foam (Armaflex/K-Flex, ASTM C534)" },
    "aerogel":         { f: 0.50, label: "Aerogel blanket (Cryogel/Pyrogel, ASTM C1728)" },
    "pyrogel-XT":      { f: 0.40, label: "Pyrogel XT/XTE (high-T aerogel, hydrophobic)" },
    "microporous":     { f: 0.40, label: "Microporous silica (Microtherm, hi-T)" },
    "VIP":             { f: 0.30, label: "Vacuum insulation panel (VIP, cryogenic)" },
    "cellular-glass":  { f: 0.40, label: "Cellular / foam glass (ASTM C552, hydrophobic)" },
    "cellular-glass-CT":{ f: 0.35, label: "Cellular glass cryogenic (Foamglas T4/HLB)" }
  };

  // ----------------------------------------------------------------------
  // JACKET — relative integrity / chloride-permeability ranking per NACE
  // SP0198 §7 + ASTM C1136 jacketing standard.
  // ----------------------------------------------------------------------
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

  // ----------------------------------------------------------------------
  // COATING (under-insulation) per API 583 §5.4 / NACE SP0198 §5.
  // TSA is the gold-standard (long-life, self-passivating); high-T epoxy /
  // phenolic / silicone for elevated temperatures; bare = no protection.
  // ----------------------------------------------------------------------
  var COATING = {
    "TSA-sealed":       { f: 0.15, label: "TSA + sealer (NACE SP0212, premium long-life)" },
    "TSA":              { f: 0.20, label: "Thermal-sprayed Al (TSA, no sealer)" },
    "high-T-epoxy":     { f: 0.35, label: "High-T multi-coat epoxy phenolic (≤205 °C)" },
    "epoxy":            { f: 0.45, label: "High-build epoxy / phenolic (≤120 °C)" },
    "inorganic-Zn":     { f: 0.55, label: "Inorganic zinc primer (with topcoat ≤400 °C)" },
    "organic-Zn":       { f: 0.65, label: "Organic zinc-rich primer (lower-T)" },
    "high-T-silicone":  { f: 0.60, label: "High-T silicone (≤540 °C, refractory)" },
    "urethane-mastic":  { f: 0.70, label: "Urethane mastic (single-coat, mid-T)" },
    "ceramic-coating":  { f: 0.40, label: "Ceramic coating (sol-gel / vitreous, hi-T)" },
    "fluoropolymer":    { f: 0.50, label: "Fluoropolymer (PTFE / ETFE-based topcoat)" },
    "phenolic-mod":     { f: 0.55, label: "Modified phenolic (acid-resistant)" },
    "alkyd":            { f: 0.80, label: "Alkyd / heat-resistant alkyd (degrades >120 °C)" },
    "alkyd-silicone":   { f: 0.70, label: "Alkyd-silicone (legacy heat-resistant)" },
    "bare":             { f: 1.00, label: "Bare steel (no coating)" }
  };

  // ----------------------------------------------------------------------
  // AMBIENT — atmosphere severity per API 583 §5.5 / ISO 9223 atmospheric
  // corrosivity categories (C1 very low ... C5 very high / CX extreme).
  // ----------------------------------------------------------------------
  var AMBIENT = {
    "marine":          { f: 1.30, label: "Marine — coastal Cl⁻ aerosol (ISO 9223 C4-C5)" },
    "tropical-coastal":{ f: 1.50, label: "Tropical coastal — marine + UV + heat (CX)" },
    "industrial":      { f: 1.10, label: "Industrial — SO₂ / acid rain (ISO 9223 C4)" },
    "urban-acid":      { f: 1.20, label: "Urban heavy-acid — refinery / coke plant" },
    "rural":           { f: 1.00, label: "Rural / suburban mild (ISO 9223 C2-C3)" },
    "arid":            { f: 0.80, label: "Arid / dry desert (ISO 9223 C1-C2)" },
    "polar":           { f: 0.90, label: "Polar / arctic (freeze-thaw cycles)" },
    "high-altitude":   { f: 0.85, label: "High altitude (cold, low-RH, UV)" },
    "fpso-topside":    { f: 1.60, label: "FPSO topside — extreme marine + process" },
    "refinery-vicinity":{ f: 1.40, label: "Refinery vicinity — acid + HC vapour" },
    "cooling-tower":   { f: 1.45, label: "Cooling-tower mist — chemical drift" },
    "geothermal":      { f: 1.40, label: "Geothermal — H₂S + CO₂ + steam" }
  };

  function risk(opts) {
    opts = opts || {};
    var mat = opts.material === "SS" ? "SS" : "CS";
    var T = +opts.T_C;
    var t = _tempFactor(mat, T);
    if (!(t.f > 0)) {
      return {
        material: mat, T_C: T, inWindow: false, region: t.region,
        score: 0, level: "low", inspectionInterval: "routine",
        ref: "API RP 583 §4.3 / §4.4 — outside CUI / ext-CSCC temperature window."
      };
    }
    var ins = INSULATION[opts.insulation] || INSULATION["cal-sil"];
    var jac = JACKET[opts.jacket]         || JACKET["Galv"];
    var coat= COATING[opts.coating]       || COATING["bare"];
    var amb = AMBIENT[opts.ambient]       || AMBIENT["industrial"];
    var ageYr = +opts.ageYr || 0;
    var cyclic = !!opts.cyclic;
    var f_age = Math.min(1.5, 0.6 + 0.04 * Math.max(0, ageYr));   // saturates around ~20 yr
    var f_cyc = cyclic ? 1.5 : 1.0;
    var score = t.f * ins.f * jac.f * coat.f * amb.f * f_age * f_cyc;
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
        coating: coat.f, ambient: amb.f, age: f_age, cyclic: f_cyc
      },
      categories: {
        insulation: ins.label, jacket: jac.label, coating: coat.label, ambient: amb.label
      },
      score: score, level: level, inspectionInterval: interval,
      ref: "API RP 583 §4.3-4.4 (CUI / ext-CSCC T windows), §5 (factors); NACE SP0198-2017 "
         + "(systems approach: coatings, insulation, jacketing); inspection intervals "
         + "per API RP 581; insulation ASTM specs (C449/C547/C552/C591/C610/C1126/C1728); "
         + "jacketing ASTM C1136; ISO 9223 atmospheric corrosivity for ambient. Specific "
         + "multipliers are a screening combination of the cited factor categories — flag "
         + "as screening, not a single-paper formula."
    };
  }

  /* Worked examples (API 583 case-study patterns):
   *  - Cold-end caustic line, CS, T=90 °C, cal-sil insulation, galv jacket, alkyd coat,
   *    marine, 12 yr in service, cyclic:
   *    f_T=0.7, ins=1.0, jac=0.85, coat=0.80, amb=1.30, age=0.6+0.04*12=1.08, cyc=1.5
   *    score = 0.7 * 1.0 * 0.85 * 0.80 * 1.30 * 1.08 * 1.5 ≈ 1.00 → high
   *  - Same line with TSA-sealed + SS-316 jacket + cellular-glass insulation, FPSO topside:
   *    coat=0.15, jac=0.45, ins=0.40, amb=1.60
   *    score = 0.7 * 0.4 * 0.45 * 0.15 * 1.60 * 1.08 * 1.5 ≈ 0.05 → low.
   *  These match the API 583 ranking (TSA + SS jacket dramatically lowers CUI risk).
   */

  var CUI = {
    INSULATION: INSULATION, JACKET: JACKET, COATING: COATING, AMBIENT: AMBIENT,
    risk: risk
  };
  root.CUI = CUI;
  if (typeof module !== "undefined" && module.exports) module.exports = CUI;
})(typeof window !== "undefined" ? window : this);
