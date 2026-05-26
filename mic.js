/* mic.js — Microbiologically-Influenced Corrosion (MIC) risk screen, vanilla JS.
 *
 * Screening risk-ranking for the four main MIC-active organism families on
 * carbon / low-alloy steel and on stainless steel in produced water, fuel
 * systems, seawater-injection, stagnant lines, etc. Output: dominant family
 * + risk level + monitoring / treatment recommendations.
 *
 * Active families considered (NACE TM0212 §1, NACE SP0775 §6):
 *   - SRB  : Sulphate-Reducing Bacteria (anaerobic, sulphate-rich, H2S generation)
 *   - APB  : Acid-Producing Bacteria (acetic / formic acid, often co-cultured with SRB)
 *   - IRB  : Iron-Reducing Bacteria (Fe(III) → Fe(II), pit initiation)
 *   - SOB  : Sulphur-Oxidising Bacteria (aerobic, sulphuric acid generation)
 *
 * Sources cited in `ref`:
 *   - NACE TM0194 — Field Monitoring of Bacterial Growth in Oil & Gas Systems.
 *   - NACE TM0212 — Detection, Testing, & Evaluation of Microbiologically
 *     Influenced Corrosion on Internal Surfaces of Pipelines.
 *   - NACE SP0775 — Preparation, Installation, Analysis, and Interpretation of
 *     Corrosion Coupons in Oilfield Operations.
 *   - NACE SP0106 — Control of Internal Corrosion in Steel Pipelines & Piping.
 *
 * Categories are per these standards; specific multipliers are a screening
 * combination of the cited drivers (T-window, O2, sulphate, organic nutrient,
 * stagnation, biocide). Not a substitute for site-specific bug-counts +
 * corrosion-coupon programme.
 */
(function (root) {
  "use strict";

  // Temperature factor — mesophilic peak ~30–40 °C; thermophilic SRB still active
  // to ~80 °C; >80 °C generally pasteurises (TM0212 §4).
  function _tempFactor(T) {
    if (T < 0 || T > 95) return { f: 0.0, region: "outside MIC viability (T)" };
    if (T >= 25 && T <= 45) return { f: 1.0, region: "mesophilic peak (25–45 °C)" };
    if (T < 25) return { f: 0.4 + 0.024 * Math.max(0, T), region: "cool, slow MIC" };  // ~0.4 at 0, 1.0 at 25
    if (T <= 70) return { f: 1.0 - 0.014 * (T - 45), region: "warm; SRB+APB active" }; // 1.0→0.65 at 70
    return { f: 0.65 - 0.045 * (T - 70), region: "thermophilic only; sterilising above ~85 °C" };
  }

  // Oxygen state: SRB are obligate anaerobes; SOB/APB tolerate O2.
  var O2 = { "anaerobic": 1.0, "low":    0.9, "intermittent": 0.7, "aerobic": 0.4 };

  // Nutrient (organic carbon / acetate / hydrocarbons in produced water).
  var NUTRIENT = { "high": 1.0, "moderate": 0.7, "low": 0.4 };

  // Sulphate (SRB substrate; >10 mg/L is meaningful).
  function sulphateFactor(mgL) {
    if (!(mgL > 1)) return 0.2;
    if (mgL < 10) return 0.5;
    if (mgL < 100) return 0.8;
    return 1.0;
  }

  // Flow regime (stagnation favours biofilm; turbulent shear inhibits attachment).
  var FLOW = { "stagnant": 1.2, "low": 1.0, "moderate": 0.8, "turbulent": 0.5 };

  // Biocide programme (NACE SP0106 §6.4).
  var BIOCIDE = { "none": 1.0, "intermittent": 0.6, "regular": 0.3, "continuous": 0.15 };

  function risk(opts) {
    opts = opts || {};
    var T = +opts.T_C;
    var t = _tempFactor(T);
    if (!(t.f > 0)) return {
      T_C: T, inWindow: false, region: t.region,
      score: 0, level: "low", dominant: "none (T-suppressed)",
      ref: "Outside the documented MIC T window (NACE TM0212)."
    };
    var fO2 = O2[opts.oxygen] != null ? O2[opts.oxygen] : 0.9;
    var fN  = NUTRIENT[opts.nutrient] != null ? NUTRIENT[opts.nutrient] : 0.7;
    var fS  = sulphateFactor(+opts.sulphate_mgL);
    var fF  = FLOW[opts.flow] != null ? FLOW[opts.flow] : 1.0;
    var fB  = BIOCIDE[opts.biocide] != null ? BIOCIDE[opts.biocide] : 1.0;

    // Per-family driver weights
    var srb = t.f * (opts.oxygen === "anaerobic" ? 1.0 : fO2 * 0.6) * fN * fS * fF * fB;
    var apb = t.f * fO2 * fN * fF * fB;
    var irb = t.f * fO2 * fN * fF * fB * 0.7;
    var sob = t.f * (opts.oxygen === "aerobic" ? 1.0 : fO2 * 0.4) * fN * fF * fB * 0.6;

    var families = [
      { name: "SRB (sulphate-reducing)", score: srb,
        note: "produces H2S → tubercles + cathodic depolarisation; can drop pH locally." },
      { name: "APB (acid-producing)", score: apb,
        note: "acetic / formic acid attack; often co-cultured with SRB." },
      { name: "IRB (iron-reducing)", score: irb,
        note: "Fe(III) → Fe(II); destabilises protective films, pit initiation." },
      { name: "SOB (sulphur-oxidising)", score: sob,
        note: "oxidises sulphide → sulphuric acid; aerobic, surface (mud-line)." }
    ].sort(function(a,b){ return b.score - a.score; });

    var total = families.reduce(function(s,x){ return s + x.score; }, 0);
    var level = total < 0.6 ? "low"
              : total < 1.4 ? "medium"
              : total < 2.5 ? "high" : "severe";
    var rec = level === "low"   ? "Routine coupons + quarterly bug counts (TM0194/TM0212)."
            : level === "medium"? "Monthly bug counts; consider biocide rotation (SP0106 §6.4)."
            : level === "high"  ? "Continuous biocide programme + sessile-bug monitoring (TM0212 §5); ER probes."
            :                     "Immediate biocide / chemical clean + mechanical pigging; weekly coupons.";

    return {
      T_C: T, inWindow: true, region: t.region,
      factors: { temperature: t.f, oxygen: fO2, nutrient: fN, sulphate: fS, flow: fF, biocide: fB },
      families: families,
      dominant: families[0].name + " — " + families[0].note,
      score: total, level: level, recommendation: rec,
      ref: "NACE TM0194 (planktonic) + TM0212 (sessile / pipeline MIC) + SP0775 "
         + "(coupons) + SP0106 §6 (internal corrosion control). Specific multipliers "
         + "are a screening combination of the cited factor categories — not a "
         + "substitute for site-specific bug counts and coupons."
    };
  }

  var MIC = { O2: O2, NUTRIENT: NUTRIENT, FLOW: FLOW, BIOCIDE: BIOCIDE, risk: risk };
  root.MIC = MIC;
  if (typeof module !== "undefined" && module.exports) module.exports = MIC;
})(typeof window !== "undefined" ? window : this);
