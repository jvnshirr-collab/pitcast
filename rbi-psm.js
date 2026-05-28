/* rbi-psm.js — 14-element Process-Safety-Management evaluation that drives
 * the management-system factor F_MS used in API RP 581 PoF assembly.
 *
 * Sources:
 *   - API RP 581 (3rd ed., April 2016) Part 2 §5.5 + Annex 2.A.1.4 — F_MS
 *   - OSHA 29 CFR 1910.119 — Process Safety Management of Highly Hazardous
 *     Chemicals (the 14-element standard)
 *   - EPA 40 CFR Part 68 — Risk Management Plan (mirrors OSHA PSM)
 *   - CCPS (2007) Guidelines for Risk Based Process Safety (RBPS) —
 *     20 elements, includes the OSHA 14 as a subset
 *   - API RP 750 — Management of Process Hazards (legacy, mostly superseded)
 *   - Cenosco IMS Handbook (public training) — Part 2 §5.5 F_MS formula
 *
 * The 14 OSHA-PSM elements with API 581 Part 2 §5.5 default weights summing
 * to 100. Each scored 0-100 (0 = absent/dysfunctional, 100 = best-practice).
 * Aggregate → pscore on 0-1000 scale (×10) → fed to RBIDetailed.F_MS():
 *   F_MS = 10^(-0.02·(pscore/10) + 1)
 *
 *   pscore = 0   → F_MS = 10   (worst, 10× PoF amplifier)
 *   pscore = 500 → F_MS = 1    (industry median, no effect)
 *   pscore = 1000→ F_MS = 0.1  (best-decile, 10× PoF reduction)
 */
(function (root) {
  "use strict";

  // Elements per OSHA 29 CFR 1910.119 with API 581 / CCPS-derived weights.
  // Weights sum to 100. Mechanical Integrity is the heaviest because it
  // directly drives RBI quality (per API 581 Annex 2.A.1.4 commentary).
  var ELEMENTS = [
    { key: "EP",     label: "Employee Participation",         weight: 5,
      ref: "29 CFR 1910.119(c) — written plan for worker participation in PSM",
      anchors: { 0:"No worker involvement in PHA / inspections",
                 50:"Workers participate in PHA reviews",
                 100:"Documented worker programme, council-led, root-cause feedback loop" } },
    { key: "PSI",    label: "Process Safety Information",     weight: 8,
      ref: "29 CFR 1910.119(d) — written PSI on chemicals, technology, equipment",
      anchors: { 0:"No P&IDs / MSDS / equipment files",
                 50:"P&IDs / MSDS available but not current",
                 100:"Current P&IDs, MOC-tracked equipment files, all relief valves indexed" } },
    { key: "PHA",    label: "Process Hazard Analysis",        weight: 12,
      ref: "29 CFR 1910.119(e) — HAZOP / What-If / LOPA every 5 yr",
      anchors: { 0:"No PHA ever conducted",
                 50:"PHA done >7 yr ago, no LOPA",
                 100:"Up-to-date HAZOP + LOPA + SIL on demand, recommendations closed" } },
    { key: "OP",     label: "Operating Procedures",           weight: 7,
      ref: "29 CFR 1910.119(f) — written SOPs, start-up / shutdown / abnormal",
      anchors: { 0:"No written procedures",
                 50:"SOPs exist but not certified annually",
                 100:"Certified-annually SOPs, controlled-document system" } },
    { key: "TR",     label: "Training",                       weight: 7,
      ref: "29 CFR 1910.119(g) — initial + refresher every 3 yr",
      anchors: { 0:"No formal training",
                 50:"Initial training only, no refresher",
                 100:"Documented competency-based programme with refresher every 3 yr" } },
    { key: "CS",     label: "Contractor Safety",              weight: 4,
      ref: "29 CFR 1910.119(h) — owner evaluates contractor PSM programme",
      anchors: { 0:"No contractor pre-qualification",
                 50:"Contractor on insurance / safety record",
                 100:"Full PSM-aligned contractor pre-qual, on-site training, audit" } },
    { key: "PSSR",   label: "Pre-Startup Safety Review",       weight: 5,
      ref: "29 CFR 1910.119(i) — PSSR for new / modified facilities before start",
      anchors: { 0:"No PSSR programme",
                 50:"Informal walk-down before start",
                 100:"Formal PSSR sign-off by operations / maintenance / safety / engineering" } },
    { key: "MI",     label: "Mechanical Integrity",           weight: 18,
      ref: "29 CFR 1910.119(j) — written programme for inspection / testing / repair; THE driver of API 581 inspection effectiveness",
      anchors: { 0:"No formal MI programme",
                 50:"Inspections done but no written intervals / no QA on inspector qualifications",
                 100:"API 510/570/653 program with certified inspectors, RBI-driven intervals, repair-quality QA" } },
    { key: "HW",     label: "Hot Work Permit",                weight: 3,
      ref: "29 CFR 1910.119(k) — permit for fire/spark work in process areas",
      anchors: { 0:"No hot-work permit system",
                 50:"Permit signed but no gas-test verification",
                 100:"Gas-test + fire-watch + permit signed by 2 levels, controlled-document" } },
    { key: "MOC",    label: "Management of Change",           weight: 10,
      ref: "29 CFR 1910.119(l) — written procedure for tech / personnel / facility changes",
      anchors: { 0:"No MOC procedure",
                 50:"MOC done informally for major changes only",
                 100:"All changes (incl. like-for-like with material substitution) tracked, P&IDs updated, training closed" } },
    { key: "II",     label: "Incident Investigation",         weight: 5,
      ref: "29 CFR 1910.119(m) — root-cause for incidents w/in 48 hr",
      anchors: { 0:"No incident-investigation programme",
                 50:"Investigations done but not RCA-trained team",
                 100:"RCA-trained team, recommendations tracked to closure, lessons-learned to peer sites" } },
    { key: "EP_EMG", label: "Emergency Planning & Response",  weight: 4,
      ref: "29 CFR 1910.119(n) — written emergency plan + drills",
      anchors: { 0:"No emergency plan",
                 50:"Plan exists, no drills in past year",
                 100:"Multi-scenario drills with LFD / mutual-aid annually, post-drill action items closed" } },
    { key: "CA",     label: "Compliance Audits",              weight: 7,
      ref: "29 CFR 1910.119(o) — certified PSM audit every 3 yr",
      anchors: { 0:"No PSM audits",
                 50:"Audits done but findings not closed",
                 100:"3-yr-cycle 3rd-party audit, findings tracked to closure in CMMS" } },
    { key: "TS",     label: "Trade Secrets",                  weight: 2,
      ref: "29 CFR 1910.119(p) — workers may access trade-secret info needed for PSM",
      anchors: { 0:"No worker access to chemical-property info",
                 50:"Workers can request info via supervisor",
                 100:"Workers have direct read-access to all PSM-relevant chemical-property data" } },
    { key: "EP_EAR", label: "Employee Awareness Programme",    weight: 3,
      ref: "CCPS RBPS — supplement to OSHA PSM, RBI awareness for ops",
      anchors: { 0:"Operators unaware of inspection findings / RBI",
                 50:"Quarterly meeting on inspection / RBI status",
                 100:"Operators trained on RBI methodology, attend RBI workshops" } }
  ];

  function _weightSum() { return ELEMENTS.reduce(function(a,e){ return a + e.weight; }, 0); }

  /** Score a complete PSM programme.
   *  @param {object} scores — { EP:80, PSI:70, ... } per-element 0-100
   *  @param {object} [opts] — { strict:true } to fail-loud on missing elements
   *  @returns {object} — { pscore_0_1000, weighted_avg_pct, per_element, F_MS, recommendations }
   */
  function score(scores, opts) {
    scores = scores || {};
    opts = opts || {};
    var totalWeight = _weightSum();
    var weightedSum = 0;
    var perElement = [];
    var missingElements = [];

    ELEMENTS.forEach(function(elem){
      var s = scores[elem.key];
      if (s == null) {
        if (opts.strict) missingElements.push(elem.key);
        else s = 50;  // default to median if not supplied
      }
      s = Math.max(0, Math.min(100, +s || 0));
      var contribution = (s * elem.weight / totalWeight);
      weightedSum += contribution;
      perElement.push({
        key: elem.key, label: elem.label, weight: elem.weight,
        score: s, weighted_contribution: +contribution.toFixed(2),
        category: s < 30 ? "Deficient" : s < 60 ? "Developing" : s < 85 ? "Effective" : "Best-in-class",
        anchor: _matchAnchor(elem.anchors, s),
        ref: elem.ref
      });
    });

    if (opts.strict && missingElements.length) {
      return { error: "Missing required elements", missingElements: missingElements };
    }

    var pscore_pct = weightedSum;
    var pscore_0_1000 = pscore_pct * 10;
    var F_MS = (root.RBIDetailed && root.RBIDetailed.F_MS)
                ? root.RBIDetailed.F_MS({ pscore_0_1000: pscore_0_1000 })
                : Math.pow(10, -0.02 * pscore_pct + 1);

    // Recommendations — flag the lowest-scoring high-weight elements
    var recommendations = perElement
      .filter(function(e){ return e.score < 60; })
      .map(function(e){
        return { key:e.key, label:e.label, current:e.score, weight:e.weight,
                 anchor:_matchAnchor(ELEMENTS.find(function(x){return x.key===e.key;}).anchors, Math.min(100, e.score+30)),
                 ref:e.ref };
      })
      .sort(function(a,b){ return (b.weight*(60-b.current)) - (a.weight*(60-a.current)); });

    return {
      pscore_0_1000: +pscore_0_1000.toFixed(1),
      pscore_pct: +pscore_pct.toFixed(2),
      F_MS: +F_MS.toFixed(4),
      F_MS_interpretation: F_MS > 5 ? "Severe PoF amplifier (×"+F_MS.toFixed(1)+") — PSM gaps drive risk"
                        : F_MS > 1.5 ? "PoF amplifier ×"+F_MS.toFixed(2)+" — PSM below median"
                        : F_MS > 0.7 ? "Near-neutral PSM (×"+F_MS.toFixed(2)+")"
                        : F_MS > 0.3 ? "PoF reducer ×"+F_MS.toFixed(2)+" — good PSM"
                        : "Best-in-class PSM, max ~10× PoF reduction (×"+F_MS.toFixed(3)+")",
      per_element: perElement,
      recommendations: recommendations.slice(0, 5),
      ref: "OSHA 29 CFR 1910.119 14-element PSM + API RP 581 (3rd ed.) Part 2 "
         + "§5.5 + Annex 2.A.1.4 management-system evaluation + CCPS (2007) "
         + "Guidelines for Risk Based Process Safety. F_MS = 10^(-0.02·pscore_pct + 1)."
    };
  }

  function _matchAnchor(anchors, s) {
    // Find the closest anchor by score key
    var keys = Object.keys(anchors).map(Number).sort(function(a,b){ return a-b; });
    var best = keys[0], bestDiff = Math.abs(s - keys[0]);
    for (var i = 1; i < keys.length; i++) {
      var d = Math.abs(s - keys[i]);
      if (d < bestDiff) { best = keys[i]; bestDiff = d; }
    }
    return anchors[best];
  }

  /** Generate a starter PSM rubric (all elements at 50 = industry median). */
  function defaultScores() {
    var r = {};
    ELEMENTS.forEach(function(e){ r[e.key] = 50; });
    return r;
  }

  // ============= Tests =====================================================
  function _runTests() {
    var pass = 0, fail = 0, errs = [];
    function ass(c, m){ if (c) pass++; else { fail++; errs.push(m); } }

    // === All elements at 50 → pscore = 500, F_MS = 1 ===
    var r1 = score(defaultScores());
    ass(Math.abs(r1.pscore_0_1000 - 500) < 1, "All 50 → pscore 500 (got "+r1.pscore_0_1000+")");
    ass(Math.abs(r1.F_MS - 1.0) < 0.01, "All 50 → F_MS 1.0 (got "+r1.F_MS+")");

    // === All elements at 100 → pscore 1000, F_MS 0.1 ===
    var maxScores = {}; ELEMENTS.forEach(function(e){ maxScores[e.key] = 100; });
    var r2 = score(maxScores);
    ass(Math.abs(r2.pscore_0_1000 - 1000) < 1, "All 100 → pscore 1000 (got "+r2.pscore_0_1000+")");
    ass(Math.abs(r2.F_MS - 0.1) < 0.005, "All 100 → F_MS 0.1 (got "+r2.F_MS+")");

    // === All elements at 0 → pscore 0, F_MS 10 ===
    var zeroScores = {}; ELEMENTS.forEach(function(e){ zeroScores[e.key] = 0; });
    var r3 = score(zeroScores);
    ass(Math.abs(r3.pscore_0_1000) < 0.1, "All 0 → pscore 0");
    ass(Math.abs(r3.F_MS - 10) < 0.05, "All 0 → F_MS 10 (got "+r3.F_MS+")");

    // === Strict mode flags missing element ===
    var r4 = score({ EP:80, PSI:70 }, { strict:true });
    ass(r4.error && r4.missingElements && r4.missingElements.length === ELEMENTS.length - 2,
        "Strict mode flags " + (ELEMENTS.length-2) + " missing elements (got "+(r4.missingElements?r4.missingElements.length:"err")+")");

    // === Per-element categorisation ===
    var r5 = score({ MI:15 });
    var miElem = r5.per_element.find(function(e){ return e.key === "MI"; });
    ass(miElem.category === "Deficient", "MI=15 → Deficient");

    // === Recommendations sorted by weight × deficit ===
    var r6 = score({ MI:20, PHA:20, EP:20 });   // 3 deficient
    ass(r6.recommendations.length >= 3, "3+ recommendations for 3 deficient elements");
    ass(r6.recommendations[0].key === "MI" || r6.recommendations[0].key === "PHA",
        "First recommendation is highest-weighted deficient element (got "+r6.recommendations[0].key+")");

    // === 14 OSHA + 1 CCPS = 15 elements total ===
    ass(ELEMENTS.length === 15, "ELEMENTS array has 14 OSHA + 1 CCPS = 15 entries");
    ass(_weightSum() === 100, "Weights sum to 100 (got "+_weightSum()+")");

    // === Element-weight monotonicity sanity: MI > PHA > MOC > PSI > others ===
    var mi = ELEMENTS.find(function(e){return e.key==="MI"; }).weight;
    var pha = ELEMENTS.find(function(e){return e.key==="PHA"; }).weight;
    var moc = ELEMENTS.find(function(e){return e.key==="MOC"; }).weight;
    var psi = ELEMENTS.find(function(e){return e.key==="PSI"; }).weight;
    ass(mi > pha && pha > moc && moc > psi, "Weights ordered: MI > PHA > MOC > PSI (got "+mi+">"+pha+">"+moc+">"+psi+")");

    // === Best-in-class PSM should yield 10× PoF reduction vs median ===
    var pof_median = 1 * 1;   // GFF × F_MS(1) × DF (set DF=1)
    var pof_best = 1 * r2.F_MS;
    ass(pof_median / pof_best > 9.5, "Best-in-class PSM = ~10× PoF reduction (got ratio "+(pof_median/pof_best).toFixed(2)+")");

    return { pass: pass, fail: fail, errs: errs, total: pass+fail };
  }

  var RBIPSM = {
    ELEMENTS: ELEMENTS,
    score: score,
    defaultScores: defaultScores,
    _runTests: _runTests
  };
  root.RBIPSM = RBIPSM;
  if (typeof module !== "undefined" && module.exports) module.exports = RBIPSM;
})(typeof window !== "undefined" ? window : (typeof global !== "undefined" ? global : this));

if (typeof require !== "undefined" && require.main === module) {
  try { global.RBIDetailed = require("./rbi-detailed.js"); } catch(_){}
  var R = module.exports;
  var r = R._runTests();
  console.log("RBI-PSM regression: PASS " + r.pass + " / FAIL " + r.fail + " / total " + r.total);
  if (r.fail) r.errs.forEach(function(e){ console.log("  - " + e); });
}
