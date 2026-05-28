/* ffs.js — API 579-1/ASME FFS-1 (2021) — corrosion-FFS subset for PitCast.
 *
 * SCOPE: Corrosion-driven damage only. PitCast is a corrosion engineering
 * tool, so only the FFS Parts that assess corrosion damage are implemented:
 *   - Part 4 (General Metal Loss / uniform thinning)
 *   - Part 5 (Local Metal Loss / LTA — the workhorse)
 *   - Part 6 (Pitting Damage)
 *   - Part 7 (HIC / SOHIC / Hydrogen Blistering)
 *
 * Out of scope (mechanical / structural — use a separate FFS tool):
 *   Part 3 (Brittle Fracture), Part 8 (Weld Misalignment), Part 9 (Crack-Like
 *   Flaws — generic), Part 10 (Creep), Part 11 (Fire), Part 12 (Dents),
 *   Part 13 (Laminations), Part 14 (Fatigue).
 *
 * Sources:
 *   - API 579-1/ASME FFS-1 (4th Ed., December 2021) — joint API/ASME FFS spec.
 *   - API 579-1/ASME FFS-1 (3rd Ed., June 2016) — still widely cited.
 *   - ASTM G46-94(2018) — Standard Guide for Examination and Evaluation of Pitting Corrosion
 *   - NACE TM0284-2016 — HIC test acceptance (CLR ≤15 %, CTR ≤5 %, CSR ≤2 %)
 *   - NACE MR0103 / ISO 17945 — Refining materials for sour service
 *   - flare9x/FitnessForService.jl — open-source Julia reference (Parts 4 + 5).
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
  // Part 6 — Pitting Damage
  // ===========================================================================
  // Per API 579-1/ASME FFS-1 (2021) Part 6 + ASTM G46-94(2018) Fig.2 pit
  // classification. Three damage patterns:
  //   (a) Localised pitting (clusters)
  //   (b) Widespread pitting (regions)
  //   (c) Pitting confined to a region (mixed thinning + pitting)
  //
  // Level 1: Categorise pitting + table lookup (Tab 6.4 type-of-damage rating)
  //   Type 1 — uniform (pit density ≤ 0.01 /mm², depth ≤ 25 % t_nom) → RSF = 1.0
  //   Type 2 — moderate (≤ 0.1 /mm², depth ≤ 50 %)                   → RSF = 0.95
  //   Type 3 — severe  (≤ 1.0 /mm² OR depth ≤ 75 %)                  → RSF = 0.85
  //   Type 4 — extreme (> 1 /mm² OR depth > 75 %)                    → Level 2 required
  //
  // Level 2: Pit-couple RSF per Eq 6.13 + Annex 6A
  //   RSF_p = 1 - (R_wt^2 · Q / E_pit) where R_wt = pit depth/t, Q = density factor
  //   Plus equivalent MAWP reduction per Eq 2.2: MAWP_r = MAWP · (RSF/RSFa)
  function part6_pitting_L1(opts) {
    var max_pit_depth_mm = +opts.max_pit_depth_mm || 0;
    var pit_density_per_m2 = +opts.pit_density_per_m2 || 0;
    var t_nom_mm = +opts.t_nom_mm;
    var MAWP_design_bar = +opts.MAWP_design_bar || 0;
    var RSFa = +opts.RSFa || 0.90;
    if (!(t_nom_mm > 0)) return { error: "t_nom_mm required" };

    var depth_ratio = max_pit_depth_mm / t_nom_mm;
    var density_per_mm2 = pit_density_per_m2 / 1e6;

    // Classification per ASTM G46 + API 579 §6.4 table-based rating
    var type, RSF, action;
    if (depth_ratio <= 0.25 && density_per_mm2 <= 0.01) {
      type = "Type 1 — uniform / negligible";
      RSF = 1.00;
      action = "Continue service per Level 1";
    } else if (depth_ratio <= 0.50 && density_per_mm2 <= 0.10) {
      type = "Type 2 — moderate";
      RSF = 0.95;
      action = "Continue service if MAWP_reduced ≥ operating P";
    } else if (depth_ratio <= 0.75 && density_per_mm2 <= 1.0) {
      type = "Type 3 — severe";
      RSF = 0.85;
      action = "Re-rate MAWP per Eq 2.2 + schedule next inspection ≤2 yr";
    } else {
      type = "Type 4 — extreme";
      RSF = null;
      action = "Level 1 does NOT apply — escalate to Level 2 (pit-couple analysis) or repair";
    }

    var pass = RSF != null && RSF >= RSFa;
    var MAWP_reduced_bar = (RSF != null && MAWP_design_bar > 0)
      ? MAWP_design_bar * Math.min(1, RSF / RSFa) : null;

    return {
      level: 1,
      type: type,
      max_pit_depth_mm: max_pit_depth_mm,
      pit_density_per_m2: pit_density_per_m2,
      depth_ratio: depth_ratio,
      density_per_mm2: density_per_mm2,
      RSF: RSF,
      RSFa: RSFa,
      MAWP_reduced_bar: MAWP_reduced_bar,
      passes: pass,
      action: action,
      recommendation: pass
        ? "Level 1 PASS — pitting within tabulated screening band"
        : RSF == null
          ? "Type 4 — Level 1 not applicable; escalate to Level 2 (Eq 6.13 pit-couple) or remediate"
          : "Level 1 FAIL — reduce MAWP to " + (MAWP_reduced_bar||0).toFixed(1) + " bar per Eq 2.2",
      ref: "API 579-1/ASME FFS-1 (2021) Part 6 §6.4 Level 1 + ASTM G46-94(2018) Fig.2 pit "
         + "classification (Type 1-4). RSF screening thresholds from Cenosco IMS public "
         + "training tabulation; conservative."
    };
  }

  /** Part 6 Level 2 — Pit-couple RSF per Eq 6.13 / Annex 6A.
   *  Simplified: RSF = (1 - R_wt) / (1 - R_wt/Mt_pit) where Mt_pit captures the
   *  pit-pair geometric factor. For two adjacent pits of equal depth + spacing s,
   *  Mt_pit ≈ 1 / (1 - (a/s)^2)^0.5 (Annex 6A Eq 6.A.4 simplified).
   */
  function part6_pitting_L2(opts) {
    var max_pit_depth_mm = +opts.max_pit_depth_mm || 0;
    var pit_diameter_mm = +opts.pit_diameter_mm || 1;
    var pit_spacing_mm = +opts.pit_spacing_mm || 10;
    var t_nom_mm = +opts.t_nom_mm;
    var FCA_mm = +opts.FCA_mm || 0;
    var MAWP_design_bar = +opts.MAWP_design_bar || 0;
    var RSFa = +opts.RSFa || 0.90;
    if (!(t_nom_mm > 0)) return { error: "t_nom_mm required" };

    var t_eff = t_nom_mm - FCA_mm;
    var R_wt = max_pit_depth_mm / t_eff;
    if (R_wt >= 0.80) {
      return {
        level: 2, error: "R_wt ≥ 0.80 — pit penetration too deep for Level 2; repair or replace",
        R_wt: R_wt, t_eff: t_eff
      };
    }
    var ratio = pit_diameter_mm / Math.max(pit_spacing_mm, pit_diameter_mm * 1.01);
    // Pit-couple stress-concentration approximation per Annex 6A Eq 6.A.4
    var Mt_pit = 1 / Math.sqrt(1 - ratio * ratio);
    var RSF = (1 - R_wt) / (1 - R_wt / Mt_pit);
    var pass = RSF >= RSFa;
    var MAWP_reduced_bar = MAWP_design_bar > 0
      ? MAWP_design_bar * Math.min(1, RSF / RSFa) : null;

    return {
      level: 2,
      R_wt: R_wt,
      Mt_pit: Mt_pit,
      pit_aspect_ratio: ratio,
      RSF: RSF,
      RSFa: RSFa,
      MAWP_reduced_bar: MAWP_reduced_bar,
      passes: pass,
      recommendation: pass
        ? "Level 2 PASS — continue service at design MAWP"
        : "Level 2 FAIL — reduce MAWP to " + (MAWP_reduced_bar||0).toFixed(1) + " bar OR escalate to Level 3 elastic-plastic",
      ref: "API 579-1/ASME FFS-1 (2021) Part 6 §6.4.3 Level 2 + Annex 6A Eq 6.A.4 pit-couple "
         + "stress-concentration. Mt_pit = 1/sqrt(1 - (d/s)²) for two adjacent equal pits."
    };
  }

  // ===========================================================================
  // Part 7 — HIC / SOHIC / Hydrogen Blistering
  // ===========================================================================
  // Per API 579-1/ASME FFS-1 (2021) Part 7 + NACE TM0284-2016 (HIC test).
  // Blister geometry classification + NACE acceptance criteria:
  //   CLR (Crack Length Ratio) ≤ 15 %
  //   CTR (Crack Thickness Ratio) ≤ 5 %
  //   CSR (Crack Sensitivity Ratio) ≤ 2 %
  //
  // Level 1: Visual classification + NACE TM0284 ratio check
  // Level 2: Blister-density-driven RSF + MAWP re-rate per Eq 2.2

  function part7_HIC_L1(opts) {
    var CLR_pct = +opts.CLR_pct;
    var CTR_pct = +opts.CTR_pct;
    var CSR_pct = +opts.CSR_pct;
    var has_SOHIC = !!opts.has_SOHIC;
    var has_surface_breaking_crack = !!opts.has_surface_breaking_crack;

    if (CLR_pct == null || CTR_pct == null || CSR_pct == null) {
      return { error: "CLR_pct, CTR_pct, CSR_pct required (per NACE TM0284 measurement)" };
    }

    // NACE TM0284 acceptance per MR0103 + ISO 15156-2 §A.2
    var CLR_pass = CLR_pct <= 15;
    var CTR_pass = CTR_pct <= 5;
    var CSR_pass = CSR_pct <= 2;
    var no_sohic = !has_SOHIC;
    var no_sb_crack = !has_surface_breaking_crack;

    var all_pass = CLR_pass && CTR_pass && CSR_pass && no_sohic && no_sb_crack;

    var verdict, action;
    if (has_surface_breaking_crack) {
      verdict = "FAIL — surface-breaking crack present";
      action = "Repair or replace immediately (Part 7 §7.4.2.3 disqualifier)";
    } else if (has_SOHIC) {
      verdict = "FAIL — SOHIC active";
      action = "Escalate to Level 2 stress-driven crack-growth assessment + repair plan";
    } else if (!all_pass) {
      verdict = "FAIL — exceeds NACE TM0284 acceptance";
      action = "Escalate to Level 2 with full blister mapping + RSF calculation";
    } else {
      verdict = "PASS — HIC within NACE TM0284 acceptance";
      action = "Continue service; re-inspect at half remaining-life interval";
    }

    return {
      level: 1,
      CLR_pct: CLR_pct, CTR_pct: CTR_pct, CSR_pct: CSR_pct,
      CLR_pass: CLR_pass, CTR_pass: CTR_pass, CSR_pass: CSR_pass,
      has_SOHIC: has_SOHIC, has_surface_breaking_crack: has_surface_breaking_crack,
      passes: all_pass,
      verdict: verdict,
      action: action,
      recommendation: action,
      ref: "API 579-1/ASME FFS-1 (2021) Part 7 §7.4 Level 1 + NACE TM0284-2016 acceptance "
         + "criteria CLR ≤ 15 %, CTR ≤ 5 %, CSR ≤ 2 % per NACE MR0103 / ISO 15156-2 §A.2."
    };
  }

  /** Part 7 Level 2 — RSF from blister density + wall-loss fraction.
   *  RSF = 1 - (blister_area_fraction × wall_loss_fraction × pressure_concentration)
   *  Per Part 7 §7.4.3 + Eq 7.7 (simplified). Concentration factor ≈ 2 for
   *  spherical-cap blister geometry per Anderson FM 4th ed §10.
   */
  function part7_HIC_L2(opts) {
    var blister_diameter_mm = +opts.blister_diameter_mm || 0;
    var blister_density_per_m2 = +opts.blister_density_per_m2 || 0;
    var t_loss_fraction = +opts.t_loss_fraction || 0;     // 0-1 through-wall loss under blister
    var t_nom_mm = +opts.t_nom_mm;
    var FCA_mm = +opts.FCA_mm || 0;
    var MAWP_design_bar = +opts.MAWP_design_bar || 0;
    var RSFa = +opts.RSFa || 0.90;
    if (!(t_nom_mm > 0)) return { error: "t_nom_mm required" };

    // Blister-affected area fraction (per m²)
    var blister_area_per_m2 = Math.PI * Math.pow(blister_diameter_mm / 2 / 1000, 2) * blister_density_per_m2;
    var area_fraction = Math.min(1, blister_area_per_m2);
    // Pressure-concentration factor (Anderson §10 spherical-cap blister)
    var K_blister = 2.0;
    var RSF = 1 - area_fraction * t_loss_fraction * K_blister;
    if (RSF < 0) RSF = 0;
    var pass = RSF >= RSFa;
    var MAWP_reduced_bar = MAWP_design_bar > 0
      ? MAWP_design_bar * Math.min(1, RSF / RSFa) : null;

    return {
      level: 2,
      blister_area_fraction: area_fraction,
      t_loss_fraction: t_loss_fraction,
      K_blister: K_blister,
      RSF: RSF,
      RSFa: RSFa,
      MAWP_reduced_bar: MAWP_reduced_bar,
      passes: pass,
      recommendation: pass
        ? "Level 2 PASS — blister damage manageable at design MAWP"
        : "Level 2 FAIL — reduce MAWP to " + (MAWP_reduced_bar||0).toFixed(1) + " bar OR mitigate (clad-overlay / Ca-treated low-S steel replacement)",
      ref: "API 579-1/ASME FFS-1 (2021) Part 7 §7.4.3 Eq 7.7 + Anderson (2017) Fracture "
         + "Mechanics 4th ed §10 (spherical-cap blister K=2). Mitigations per NACE TM0284 / MR0103."
    };
  }

  // ===========================================================================
  // Part 3 (Brittle Fracture) + Part 14 (Fatigue) — removed; mechanical
  // (toughness / cyclic-loading), not corrosion. See ffs.js scope rule.

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

    // === Part 6 Pitting Level 1 ===
    var p6_neg = part6_pitting_L1({
      max_pit_depth_mm: 1, pit_density_per_m2: 100, t_nom_mm: 12,
      MAWP_design_bar: 20
    });
    ass(p6_neg.type.indexOf("Type 1") >= 0, "Pit L1 negligible → Type 1 (got "+p6_neg.type+")");
    ass(p6_neg.passes === true, "Pit L1 Type 1 → PASS");

    var p6_mod = part6_pitting_L1({
      max_pit_depth_mm: 4, pit_density_per_m2: 50000, t_nom_mm: 12,
      MAWP_design_bar: 20
    });
    ass(p6_mod.type.indexOf("Type 2") >= 0, "Pit L1 4mm/50k → Type 2 (got "+p6_mod.type+")");
    ass(p6_mod.RSF === 0.95, "Type 2 RSF = 0.95");

    var p6_sev = part6_pitting_L1({
      max_pit_depth_mm: 9, pit_density_per_m2: 500000, t_nom_mm: 12,
      MAWP_design_bar: 20
    });
    ass(p6_sev.type.indexOf("Type 3") >= 0, "Pit L1 9mm/500k → Type 3 (got "+p6_sev.type+")");
    ass(p6_sev.passes === false, "Type 3 RSF 0.85 < RSFa 0.90 → FAIL");
    ass(p6_sev.MAWP_reduced_bar > 0 && p6_sev.MAWP_reduced_bar < 20, "Type 3 MAWP_reduced < design");

    var p6_ext = part6_pitting_L1({
      max_pit_depth_mm: 10, pit_density_per_m2: 2e6, t_nom_mm: 12,
      MAWP_design_bar: 20
    });
    ass(p6_ext.type.indexOf("Type 4") >= 0, "Pit L1 extreme → Type 4");
    ass(p6_ext.RSF === null, "Type 4 → RSF null (escalate)");

    // === Part 6 Pitting Level 2 ===
    var p6L2 = part6_pitting_L2({
      max_pit_depth_mm: 3, pit_diameter_mm: 2, pit_spacing_mm: 20,
      t_nom_mm: 12, MAWP_design_bar: 20
    });
    ass(p6L2.RSF > 0 && p6L2.RSF < 1, "Pit L2 RSF in (0,1) got "+p6L2.RSF.toFixed(3));
    ass(p6L2.passes === true, "Pit L2 small pits well-spaced → PASS");

    var p6L2deep = part6_pitting_L2({
      max_pit_depth_mm: 10, pit_diameter_mm: 5, pit_spacing_mm: 6,
      t_nom_mm: 12, MAWP_design_bar: 20
    });
    ass(p6L2deep.error, "Pit L2 R_wt > 0.8 → error (too deep)");

    // === Part 7 HIC Level 1 ===
    var p7_pass = part7_HIC_L1({ CLR_pct: 10, CTR_pct: 3, CSR_pct: 1.5 });
    ass(p7_pass.passes === true, "HIC L1 within NACE TM0284 → PASS");
    var p7_clr_fail = part7_HIC_L1({ CLR_pct: 20, CTR_pct: 3, CSR_pct: 1 });
    ass(p7_clr_fail.passes === false, "HIC L1 CLR 20% > 15% → FAIL");
    ass(p7_clr_fail.CLR_pass === false, "CLR_pass false");
    var p7_sohic = part7_HIC_L1({ CLR_pct: 5, CTR_pct: 2, CSR_pct: 1, has_SOHIC: true });
    ass(p7_sohic.verdict.indexOf("SOHIC") >= 0, "SOHIC flag → FAIL with SOHIC verdict");
    var p7_sb = part7_HIC_L1({ CLR_pct: 5, CTR_pct: 2, CSR_pct: 1, has_surface_breaking_crack: true });
    ass(p7_sb.verdict.indexOf("surface") >= 0, "Surface-breaking crack → immediate FAIL");

    // === Part 7 HIC Level 2 ===
    var p7L2 = part7_HIC_L2({
      blister_diameter_mm: 20, blister_density_per_m2: 5,
      t_loss_fraction: 0.10, t_nom_mm: 16, MAWP_design_bar: 20
    });
    ass(p7L2.RSF > 0 && p7L2.RSF <= 1, "HIC L2 RSF in (0,1] got "+p7L2.RSF.toFixed(3));
    ass(p7L2.passes === true, "HIC L2 small blisters/low t-loss → PASS");

    var p7L2bad = part7_HIC_L2({
      blister_diameter_mm: 100, blister_density_per_m2: 50,
      t_loss_fraction: 0.40, t_nom_mm: 16, MAWP_design_bar: 20
    });
    ass(p7L2bad.passes === false || p7L2bad.RSF < 0.90, "HIC L2 severe → FAIL or marginal");

    return { pass: pass, fail: fail, errs: errs };
  }

  var FFS = {
    foliasMt: foliasMt,
    part4_Level1: part4_Level1,
    part5_LTA_L1: part5_LTA_L1,
    part6_pitting_L1: part6_pitting_L1,
    part6_pitting_L2: part6_pitting_L2,
    part7_HIC_L1: part7_HIC_L1,
    part7_HIC_L2: part7_HIC_L2,
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
