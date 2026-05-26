/* rbi.js — Risk-Based Inspection (RBI) "lite" screen per API RP 581, vanilla JS.
 *
 * Maps a piece of equipment to a 5x5 risk matrix (PoF 1..5 × CoF A..E) and a
 * recommended inspection interval. Screening-grade — the full API 581 method is
 * far more involved (damage-factor tables, generic-failure-frequency, financial
 * + safety CoF, MTTF, ageing curves). This is the "first-pass" used by FEED /
 * inspection-planning engineers to triage equipment before a full RBI study.
 *
 * Probability of Failure (PoF) → score 1..5:
 *   driver = damage_factor × (1 / remaining_margin)
 *   damage_factor = (CR_mm_yr × age_since_last_insp_yr) / WT_nominal      // unitless
 *   remaining_margin = (WT_current − WT_min) / WT_nominal                  // 0..1
 * Higher driver → higher PoF score. Bands per API 581 Table 5.16 logic (screening).
 *
 * Consequence of Failure (CoF) → category A..E:
 *   - fluid hazard:    water/oil → A, hydrocarbon liquid → B, gas → C,
 *                      sour gas/H2S → D, HF/Cl2/strong acid → E
 *   - inventory:       small (<1 m^3) keeps category as-is; medium (1-50 m^3) bumps +1;
 *                      large (>50 m^3) bumps +2 (capped at E)
 *
 * Risk = PoF × CoF position in the 5x5 matrix, classified low / medium / high / extreme,
 * with a screening inspection interval per API 581 §16 typical ranges.
 *
 * Sources cited in `ref`:
 *   - API RP 581, 3rd ed. (2016) — Risk-Based Inspection Methodology, Parts 1-3.
 *   - API RP 580 — Risk-Based Inspection (programme).
 *   - API 510 / 570 — vessel / piping inspection codes (for the inspection-
 *     interval upper bounds referenced here).
 */
(function (root) {
  "use strict";

  function _pofScore(opts) {
    var CR = +opts.CR_mmyr;
    var age = +opts.ageSinceLastInsp_yr;
    var tNom = +opts.tNom_mm;
    var tCur = +opts.tCurrent_mm;
    var tMin = +opts.tMin_mm;
    var DF = (CR > 0 && tNom > 0 && age > 0) ? (CR * age) / tNom : 0;        // unitless
    var margin = (tCur - tMin) / Math.max(0.001, tNom);                       // 0..1
    var driver = DF / Math.max(0.01, margin);
    var pof;
    if (driver < 0.02)      pof = 1;
    else if (driver < 0.08) pof = 2;
    else if (driver < 0.25) pof = 3;
    else if (driver < 0.80) pof = 4;
    else                    pof = 5;
    return { PoF: pof, damageFactor: DF, remainingMargin: margin, driver: driver };
  }

  // Fluid hazard base category, before inventory bump.
  function _fluidBase(fluid) {
    return ({
      "water":      "A",
      "oil":        "A",
      "hc-liquid":  "B",
      "hc-gas":     "C",
      "sour-gas":   "D",
      "HF":         "E",
      "Cl2":        "E",
      "acid":       "E"
    })[fluid] || "C";
  }
  function _bumpCat(cat, n) {
    var order = ["A","B","C","D","E"];
    var i = Math.max(0, Math.min(4, order.indexOf(cat) + n));
    return order[i];
  }
  function _cofScore(opts) {
    var cat = _fluidBase(opts.fluid);
    var v = +opts.inventory_m3 || 1;
    if (v >  1)  cat = _bumpCat(cat, 1);
    if (v > 50)  cat = _bumpCat(cat, 1);       // total of +2 for large
    var idx = ["A","B","C","D","E"].indexOf(cat);
    return { CoF: cat, CoF_index: idx };
  }

  // 5x5 risk matrix (rows PoF 1..5, cols CoF A..E) — bands per typical API 581 layout.
  // L=low, M=medium, H=high, E=extreme.
  var RISK_MATRIX = [
    /* PoF=1 */ ["L","L","L","M","H"],
    /* PoF=2 */ ["L","L","M","H","H"],
    /* PoF=3 */ ["L","M","M","H","E"],
    /* PoF=4 */ ["M","M","H","E","E"],
    /* PoF=5 */ ["M","H","E","E","E"]
  ];

  // Screening inspection-interval bands.
  var INTERVAL = {
    "L": "5–10 yr (per API 510 / 570 max)",
    "M": "3–5 yr (targeted visual + UT)",
    "H": "1–3 yr (planned NDT + thinning monitoring)",
    "E": "< 1 yr (immediate inspection + risk-reduction action)"
  };

  function score(opts) {
    opts = opts || {};
    var p = _pofScore(opts);
    var c = _cofScore(opts);
    var band = RISK_MATRIX[p.PoF - 1][c.CoF_index];
    var label = { L: "low", M: "medium", H: "high", E: "extreme" }[band];
    return {
      PoF: p.PoF, CoF: c.CoF, riskBand: band, riskLevel: label,
      damageFactor: p.damageFactor, remainingMargin: p.remainingMargin,
      driver: p.driver, fluid: opts.fluid, inventory_m3: opts.inventory_m3,
      inspectionInterval: INTERVAL[band],
      matrix: RISK_MATRIX,    // included so the UI can highlight the cell
      ref: "API RP 581 (3rd ed., 2016) Parts 1-3 — damage-factor / consequence "
         + "framework + 5x5 risk matrix; API RP 580 (programme); inspection-"
         + "interval upper bounds per API 510 (vessels) / API 570 (piping). "
         + "Screening only — a full RBI study uses detailed DFM tables, "
         + "generic-failure-frequency, financial/safety CoF, and quantitative "
         + "ageing curves."
    };
  }

  /* WORKED CASES:
   *  - CS sour-gas line, CR=0.4 mm/y, last insp 5 yr ago, tNom=8, tCur=6.2, tMin=5.0,
   *    sour-gas, 20 m^3 inventory → DF = 0.4*5/8 = 0.25; margin = 1.2/8 = 0.15;
   *    driver = 1.67 → PoF=5; fluid=D + 1 (inventory) = E → cell E5 → extreme.
   *  - Same line freshly inspected (age=0) → DF=0, driver=0, PoF=1, cell E1 → high
   *    (cell colour driven entirely by CoF). */

  var RBI = { score: score, RISK_MATRIX: RISK_MATRIX, INTERVAL: INTERVAL };
  root.RBI = RBI;
  if (typeof module !== "undefined" && module.exports) module.exports = RBI;
})(typeof window !== "undefined" ? window : this);
