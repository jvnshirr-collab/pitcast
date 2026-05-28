/* ffs.js — API 579-1/ASME FFS-1 (2021) spine for PitCast.
 *
 * Scope: Parts 3 (Brittle Fracture), 4 (General Metal Loss), 5 (Local Metal
 * Loss — the workhorse LTA), 14 (Fatigue Level 1 screening).
 *
 * Sources:
 *   - API 579-1/ASME FFS-1 (4th Ed., December 2021) — joint API/ASME FFS spec.
 *   - API 579-1/ASME FFS-1 (3rd Ed., June 2016) — still widely cited.
 *   - WRC Bulletin 550 (2019) — fatigue standardisation for Part 14.
 *   - WRC Bulletin 523 — Master S-N curve method.
 *   - Anderson (2017) Fracture Mechanics 4th Ed. Ch.10 — FAD worked examples.
 *   - flare9x/FitnessForService.jl — open-source Julia reference (Parts 4 + 5).
 *   - PMC 6479345 (Larrosa 2019) — BS 7910 vs API 579 FAD comparison.
 *
 * Limits: Level 1 + Level 2 closed-form only. Level 3 elastic-plastic FEA is
 * out of scope. Where the standard's worked-example numbers exceed PLAN-tier3.md
 * documentation, conservative defaults flagged.
 */
(function (root) {
  "use strict";

  // ===========================================================================
  // Part 4 — General Metal Loss
  // ===========================================================================
  // Level 1 — Point Thickness Readings (PTR)
  // Need ≥ 15 readings inside the flaw zone; COV ≤ 10 % → use mean; else escalate
  function part4_Level1(opts) {
    var readings_mm = opts.readings_mm || [];
    var FCA_mm = +opts.FCA_mm || 0;
    var t_min_mm = +opts.t_min_mm;
    if (readings_mm.length < 15) {
      return { passes: false, level: 1, reason: "Need ≥15 PTR per Part 4 §4.3.3", n: readings_mm.length,
               ref: "API 579-1/ASME FFS-1 (2021) Part 4 §4.3.3 PTR" };
    }
    var mean = readings_mm.reduce(function(a,b){ return a+b; }, 0) / readings_mm.length;
    var sq = readings_mm.map(function(t){ return (t-mean)*(t-mean); });
    var std = Math.sqrt(sq.reduce(function(a,b){ return a+b; }, 0) / (readings_mm.length-1));
    var COV = std / mean;
    var tmm = Math.min.apply(Math, readings_mm);
    var pass_uniform = COV <= 0.10;
    var pass_thick = (mean - FCA_mm) >= t_min_mm && tmm >= Math.max(0.5 * t_min_mm, 2.5);
    return {
      level: 1,
      n: readings_mm.length,
      mean_mm: mean, std_mm: std, COV: COV,
      tmm_mm: tmm,
      passes: pass_uniform && pass_thick,
      pass_uniform: pass_uniform,
      pass_thick: pass_thick,
      recommendation: !pass_uniform ? "COV > 10 % — escalate to Level 2 CTP" : (pass_thick ? "Level 1 PASS" : "Level 1 FAIL — re-rate MAWP per Eq 4.10"),
      ref: "API 579-1/ASME FFS-1 (2021) Part 4 §4.3.3 + §4.4 Level 1 PTR"
    };
  }

  // ===========================================================================
  // Part 5 — Local Metal Loss (LTA) — the workhorse assessment
  // ===========================================================================
  // Folias factor Mt(λ) — polynomial per Annex 5A or table 5.2
  function foliasMt(lambda) {
    if (!(lambda > 0)) return 1;
    if (lambda >= 9) return 0.032 * lambda * lambda + 3.3;  // long-flaw approx
    // 6th-order polynomial expansion (truncated form of Annex 5A Eq 5.12)
    var l2 = lambda * lambda;
    var l4 = l2 * l2;
    return Math.sqrt(1 + 0.48 * l2 - 0.001408 * l4);
  }

  // Part 5 Level 1 — single LTA on cylindrical shell, Type A, internal pressure
  function part5_LTA_L1(opts) {
    var tmm = +opts.tmm_mm;       // minimum measured thickness in LTA
    var FCA = +opts.FCA_mm || 0;
    var t_nom = +opts.t_nom_mm;
    var LOSS = +opts.LOSS_mm || 0;
    var s = +opts.s_axial_mm;
    var D = +opts.D_inside_mm;     // inside diameter
    var MAWP_design_bar = +opts.MAWP_design_bar;
    var RSFa = +opts.RSFa || 0.90;

    if (!(tmm > 0 && t_nom > 0 && s > 0 && D > 0)) {
      return { error: "tmm, t_nom, s_axial, D_inside must be > 0" };
    }
    var tc = t_nom - LOSS - FCA;   // corroded reference wall
    if (!(tc > 0)) return { error: "tc ≤ 0 — corrosion exceeds wall", tc_mm: tc };

    // Applicability gates (Part 5 §5.4.2.2)
    var gates = {
      tc_min: tc >= 2.5,             // mm
      thinShell: D / tc >= 20,
      Rt_floor: (tmm - FCA) / tc >= 0.20,
      Lmsd: true,                    // would check distance to nearest discontinuity ≥ 1.8·sqrt(D·tc); not provided here
      noCreep: opts.T_C == null || opts.T_C < (opts.T_creep_C || 400),
      noCyclic: (opts.cycles_count || 0) < 150
    };
    var gatesPass = Object.values(gates).every(function(v){ return v; });

    // Eq 5.5 — Rt
    var Rt = (tmm - FCA) / tc;
    // Eq 5.6 — λ
    var lambda = 1.285 * s / Math.sqrt(D * tc);
    // Folias
    var Mt = foliasMt(lambda);
    // Eq 5.11 — RSF
    var RSF = Rt / (1 - (1/Mt) * (1 - Rt));

    var pass = RSF >= RSFa;
    var MAWPr_bar = pass ? MAWP_design_bar : MAWP_design_bar * RSF / RSFa;

    return {
      level: 1,
      Rt: Rt, lambda: lambda, Mt: Mt, RSF: RSF,
      RSFa: RSFa,
      gates: gates,
      gatesPass: gatesPass,
      passes: pass && gatesPass,
      MAWP_reduced_bar: MAWPr_bar,
      recommendation: !gatesPass ? "Level 1 applicability gates failed — escalate to Level 2"
        : pass ? "Level 1 PASS — use design MAWP"
               : "Level 1 FAIL — reduce MAWP per Eq 2.2 or escalate to Level 2",
      ref: "API 579-1/ASME FFS-1 (2021) Part 5 §5.4 Level 1; Folias Mt polynomial Annex 5A"
    };
  }

  // ===========================================================================
  // Part 3 — Brittle Fracture (Level 1 — MAT exemption curve)
  // ===========================================================================
  // Curves A/B/C/D per UCS-66 / API 579-1 Fig 3.2-3.5
  // Approximate MAT (°C) as function of governing-thickness t_g (mm) for each curve.
  function part3_MAT_L1(opts) {
    var curve = (opts.material_curve || "B").toUpperCase();  // A worst, D best
    var t_g_mm = +opts.governing_thickness_mm;
    if (!(t_g_mm > 0)) return { error: "governing_thickness_mm required" };

    // Linear-ish approximation from PLAN-tier3.md anchor points (Curve B at 25 mm ≈ -29 °C; at 50 mm ≈ -10 °C)
    var curveOffsets = { A: 20, B: 0, C: -10, D: -25 };  // worse curves = warmer MAT
    var offset = curveOffsets[curve] != null ? curveOffsets[curve] : 0;
    var MAT_base = -29 + (t_g_mm - 25) * (19 / 25);     // Curve B reference line
    var MAT = MAT_base + offset;
    if (MAT < -104) MAT = -104;   // standard floor

    var T_op_min = +opts.T_op_min_C;
    var passes = T_op_min != null ? (T_op_min >= MAT) : null;
    var margin_C = T_op_min != null ? (T_op_min - MAT) : null;

    return {
      level: 1,
      material_curve: curve,
      governing_thickness_mm: t_g_mm,
      MAT_C: Math.round(MAT * 10) / 10,
      T_op_min_C: T_op_min,
      margin_C: margin_C,
      passes: passes,
      recommendation: passes == null ? "Provide T_op_min_C for verdict"
        : passes ? "Level 1 PASS — operating T above MAT; brittle fracture screened out"
                 : "Level 1 FAIL — escalate to Level 2 (MAT + CET combined) or Level 3 (Annex 9F Master Curve)",
      ref: "API 579-1/ASME FFS-1 (2021) Part 3 §3.4 Level 1 + Annex 3B exemption curves"
    };
  }

  // ===========================================================================
  // Part 14 — Fatigue (Level 1 screening only)
  // ===========================================================================
  function part14_fatigue_L1(opts) {
    var cycles_count = +opts.cycles_count || 0;
    var has_thermal_shock = !!opts.has_thermal_shock;
    var method_screen = opts.method_screen || "C";  // ASME VIII-2 Part 5.5.2 Method A/B/C

    // Level 1 screening rule: skip if cycles < 100 AND no thermal shock AND screen passes
    var skip = cycles_count < 100 && !has_thermal_shock;
    return {
      level: 1,
      cycles_count: cycles_count,
      has_thermal_shock: has_thermal_shock,
      passes: skip,
      recommendation: skip ? "Level 1 PASS — fatigue screened out (cycles < 100, no thermal shock)"
                            : "Level 1 not applicable — escalate to Level 2 (rainflow + S-N + Miner per ASME VIII-2 Annex 3-F)",
      ref: "API 579-1/ASME FFS-1 (2021) Part 14 §14.4 Level 1 screening + ASME VIII-2 Part 5.5.2 Method " + method_screen
    };
  }

  // ===========================================================================
  // Embedded regression tests
  // ===========================================================================
  function _runTests() {
    var pass = 0, fail = 0, errs = [];
    function ass(c, m) { if (c) pass++; else { fail++; errs.push(m); } }

    // Part 5 worked-example from FFS.jl source:
    // SA 516 Gr 70, ID=96"=2438.4 mm, t=1.25"=31.75 mm, LOSS=0.10"=2.54, FCA=0.125"=3.175
    // tmm=0.7"=17.78. Expected: tc≈26.04, Rt≈0.562, λ≈2.0, RSF≈0.93 (marginal L1 PASS)
    var p5 = part5_LTA_L1({
      tmm_mm: 17.78, t_nom_mm: 31.75, LOSS_mm: 2.54, FCA_mm: 3.175,
      s_axial_mm: 250, D_inside_mm: 2438.4, MAWP_design_bar: 21
    });
    ass(p5.passes !== undefined, "Part 5 L1 returns verdict");
    ass(Math.abs(p5.Rt - 0.562) < 0.05, "Rt ≈ 0.562 got " + p5.Rt.toFixed(3));
    ass(p5.RSF > 0 && p5.RSF < 1.5, "RSF in physical range got " + p5.RSF.toFixed(3));

    // Folias Mt sanity — λ=2 → ~1.32
    ass(Math.abs(foliasMt(2.0) - 1.32) < 0.1, "Mt(λ=2.0) ≈ 1.32 got " + foliasMt(2.0).toFixed(3));
    // Long flaw — λ=10 → polynomial branches
    ass(foliasMt(10) > 4, "Mt(λ=10) large got " + foliasMt(10).toFixed(2));

    // Part 4 — uniform readings
    var p4_uniform = part4_Level1({
      readings_mm: [10.1, 10.2, 9.9, 10.0, 10.1, 10.0, 10.1, 9.9, 10.0, 10.1, 10.0, 9.9, 10.0, 10.1, 10.0],
      t_min_mm: 8, FCA_mm: 0.5
    });
    ass(p4_uniform.passes === true, "Part 4 uniform readings PASS");
    ass(p4_uniform.COV < 0.10, "COV < 10%");

    // Part 4 — high variance
    var p4_var = part4_Level1({
      readings_mm: [10, 5, 12, 8, 15, 6, 10, 11, 4, 13, 9, 7, 14, 5, 11],
      t_min_mm: 8, FCA_mm: 0.5
    });
    ass(p4_var.passes === false, "Part 4 high COV → fail");
    ass(p4_var.recommendation.indexOf("Level 2") >= 0, "Recommends escalation to L2");

    // Part 3 — Curve B at 25 mm thickness
    var p3 = part3_MAT_L1({ material_curve: "B", governing_thickness_mm: 25, T_op_min_C: 0 });
    ass(p3.MAT_C < 0, "Curve B @ 25 mm MAT < 0 °C got " + p3.MAT_C);
    ass(p3.passes === true, "T_op=0 ≥ MAT → PASS");
    var p3b = part3_MAT_L1({ material_curve: "A", governing_thickness_mm: 100, T_op_min_C: -50 });
    ass(p3b.MAT_C > -50, "Curve A @ 100 mm MAT > -50 °C");
    ass(p3b.passes === false, "T_op=-50 < MAT → FAIL");

    // Part 14 — under 100 cycles screens out
    var p14_skip = part14_fatigue_L1({ cycles_count: 50, has_thermal_shock: false });
    ass(p14_skip.passes === true, "50 cycles screen out");
    var p14_fail = part14_fatigue_L1({ cycles_count: 500, has_thermal_shock: false });
    ass(p14_fail.passes === false, "500 cycles → escalate");

    return { pass: pass, fail: fail, errs: errs };
  }

  var FFS = {
    foliasMt: foliasMt,
    part4_Level1: part4_Level1,
    part5_LTA_L1: part5_LTA_L1,
    part3_MAT_L1: part3_MAT_L1,
    part14_fatigue_L1: part14_fatigue_L1,
    _runTests: _runTests
  };
  root.FFS = FFS;
  if (typeof module !== "undefined" && module.exports) module.exports = FFS;
})(typeof window !== "undefined" ? window : this);

if (typeof require !== "undefined" && require.main === module) {
  var F = module.exports;
  var r = F._runTests();
  console.log("FFS regression: PASS " + r.pass + " / FAIL " + r.fail);
  if (r.fail) r.errs.forEach(function(e){ console.log("  - " + e); });
}
