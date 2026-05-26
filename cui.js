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
 *   - NACE SP0198 — Control of Corrosion Under Thermal Insulation and Fireproofing
 *     Materials — A Systems Approach. Sections on materials, coatings, jackets.
 *   - API RP 581 — Risk-Based Inspection Methodology, for inspection intervals.
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

  // Insulation absorbency / chloride leaching (relative ranking from NACE SP0198 §6):
  // calcium silicate (worst — wicks water, leaches alkali / chloride),
  // mineral wool (high absorbency), perlite (mid), polyurethane foam (moderate),
  // cellular glass / foam glass (best — hydrophobic), aerogel (very low absorbency).
  var INSULATION = {
    "cal-sil":        { f: 1.0, label: "Calcium silicate (high absorbency)" },
    "mineral-wool":   { f: 0.9, label: "Mineral wool / fiberglass" },
    "perlite":        { f: 0.7, label: "Perlite (expanded)" },
    "PUF":            { f: 0.6, label: "Polyurethane foam (PUF)" },
    "aerogel":        { f: 0.5, label: "Aerogel blanket" },
    "cellular-glass": { f: 0.4, label: "Cellular / foam glass (hydrophobic)" }
  };

  // Weather-jacket condition / material (NACE SP0198):
  // stainless > aluminium > galvanised > none.
  var JACKET = {
    "SS":     { f: 0.50, label: "Stainless steel jacket" },
    "Al":     { f: 0.70, label: "Aluminium jacket" },
    "Galv":   { f: 0.85, label: "Galvanised steel jacket" },
    "none":   { f: 1.10, label: "No jacket / damaged" }
  };

  // Surface coating under insulation (API 583 §5.4 / NACE SP0198 §5):
  // TSA (best) > inorganic-Zn / epoxy > bare steel.
  var COATING = {
    "TSA":          { f: 0.20, label: "Thermal-sprayed aluminium (TSA)" },
    "epoxy":        { f: 0.45, label: "High-build epoxy / phenolic" },
    "inorganic-Zn": { f: 0.55, label: "Inorganic zinc primer" },
    "alkyd":        { f: 0.80, label: "Alkyd / heat-resistant alkyd" },
    "bare":         { f: 1.00, label: "Bare steel" }
  };

  // Ambient atmosphere category (API 583 §5.5):
  var AMBIENT = {
    "marine":     { f: 1.30, label: "Marine (chloride-laden)" },
    "industrial": { f: 1.10, label: "Industrial (SO₂ / acid rain)" },
    "rural":      { f: 1.00, label: "Rural / mild" },
    "arid":       { f: 0.80, label: "Arid / dry" }
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
      ref: "API RP 583 §4.3-4.4 (CUI / ext-CSCC T windows), §5 (factors); NACE SP0198 "
         + "(systems approach: coatings, insulation, jacketing); inspection intervals "
         + "per API RP 581. Specific multipliers are a screening combination of the "
         + "cited factor categories — flag as screening, not a single-paper formula."
    };
  }

  /* Worked examples (API 583 case-study patterns):
   *  - Cold-end caustic line, CS, T=90 °C, cal-sil insulation, galv jacket, alkyd coat,
   *    marine, 12 yr in service, cyclic:
   *    f_T=0.7, ins=1.0, jac=0.85, coat=0.80, amb=1.30, age=0.6+0.04*12=1.08, cyc=1.5
   *    score = 0.7 * 1.0 * 0.85 * 0.80 * 1.30 * 1.08 * 1.5 ≈ 1.00 → high
   *  - Same line with TSA coating + SS jacket + cellular-glass insulation:
   *    coat=0.20, jac=0.50, ins=0.40
   *    score = 0.7 * 0.4 * 0.5 * 0.2 * 1.3 * 1.08 * 1.5 ≈ 0.06 → low.
   *  These match the API 583 ranking (TSA + SS jacket dramatically lowers CUI risk).
   */

  var CUI = {
    INSULATION: INSULATION, JACKET: JACKET, COATING: COATING, AMBIENT: AMBIENT,
    risk: risk
  };
  root.CUI = CUI;
  if (typeof module !== "undefined" && module.exports) module.exports = CUI;
})(typeof window !== "undefined" ? window : this);
