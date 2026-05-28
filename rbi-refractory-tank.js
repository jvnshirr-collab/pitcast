/* rbi-refractory-tank.js — API RP 581 Annex 2.J (Refractory) +
 * Appendix O (Atmospheric Tank-bottom and Shell) damage factors.
 *
 * Sources:
 *   - API RP 581 (3rd ed., April 2016) Annex 2.J Refractory; Appendix O AST
 *   - API RP 571 (3rd ed., 2020) §4.2.18 Refractory Degradation
 *   - API STD 936 (3rd ed., 2014) Refractory Installation Quality
 *   - API STD 653 (5th ed., 2014) Tank Inspection, Repair, Alteration
 *   - API STD 575 (3rd ed., 2014) Inspection Practices for AST
 *   - API STD 650 (12th ed., 2013) Welded Tanks for Oil Storage
 *   - Schaffel-Mancini D. et al. (2002) Mater. Perf. 41(2), 50 — Refractory wear
 *     in petroleum refineries (FCC regenerator, claus reactor)
 *   - EEMUA 159 (5th ed., 2017) — AST inspection, maintenance, repair
 *   - NACE SP0294 — Design, fabrication, inspection of tanks
 */
(function (root) {
  "use strict";

  // ============= Common helpers =============================================

  var SVI_LEVEL = { "None":1, "Low":10, "Medium":50, "High":100, "V.High":500 };
  var EFF_REDUCTION = { "A":10, "B":5, "C":2, "D":1, "E":1 };

  function _commonDF(opts, susceptibility, mechanism, ref) {
    opts = opts || {};
    var SVI = SVI_LEVEL[susceptibility] || 1;
    var age = +opts.age_yr || 0;
    var F_age = Math.max(0.1, Math.min(age, 30) / 10);
    var hist = opts.inspection_history || [];
    var eff = (root.RBIDetailed && root.RBIDetailed.inspectionCombo)
              ? root.RBIDetailed.inspectionCombo(hist) : "E";
    var red = EFF_REDUCTION[eff] || 1;
    var F_eff = 1 / red;
    var D_f = Math.max(SVI * F_age * F_eff, 1);
    return {
      mechanism: mechanism, susceptibility: susceptibility,
      SVI: SVI, F_age: F_age, F_eff: F_eff, effectiveness: eff,
      D_f: D_f, applicable: true, ref: ref
    };
  }
  function _notApplicable(mech, why) {
    return { mechanism: mech, applicable: false, susceptibility: "None",
             SVI: 1, F_age: 0, F_eff: 1, D_f: 1, why: why };
  }

  // ============= Annex 2.J Refractory ========================================
  /** Per API 581 Annex 2.J + API 571 §4.2.18 + API 936.
   *  Refractory types:
   *    castable     — monolithic Al2O3-SiO2 castable
   *    gunite       — high-Al gunite
   *    brick        — fired refractory brick
   *    ceramic_fibre — kaolin / Al-silicate blanket
   *    plastic      — plastic refractory ramming mix
   *  Damage mechanisms:
   *    spalling     — thermal-cycle delamination
   *    erosion      — particulate / fluidised-bed wear (FCC catalyst)
   *    chemical     — slag / alkali / sulphur attack
   *    creep        — sag at very-high T (>1300 °C)
   *    shrinkage    — drying / curing crack from improper installation
   */
  function refractory_DF(opts) {
    opts = opts || {};
    var refractory_type = opts.refractory_type || "castable";
    var T_service_C = +opts.T_service_C || 800;
    var T_max_design_C = +opts.T_max_design_C || 1000;
    var cycles_per_yr = +opts.thermal_cycles_per_yr || 12;       // start/stop/turnaround
    var has_erosive_flow = !!opts.has_erosive_flow;       // FCC catalyst / fluidised bed
    var has_chemical_attack = !!opts.has_chemical_attack; // slag / alkali / sulphur
    var dry_cure_proper = opts.dry_cure_proper !== false; // API 936 §6 cure schedule
    var QC_per_API_936 = !!opts.QC_per_API_936;

    if (!refractory_type) return _notApplicable("Refractory", "no refractory specified — bare CS / SS shell instead");

    // Base susceptibility from material × service-T proximity
    var sus = "None";
    var T_ratio = T_service_C / T_max_design_C;
    if (T_ratio > 1.0) sus = "V.High";        // operating above design
    else if (T_ratio > 0.95) sus = "High";
    else if (T_ratio > 0.80) sus = "Medium";
    else if (T_ratio > 0.60) sus = "Low";
    else sus = "None";

    // Cycle-driven spalling amplifier
    if (cycles_per_yr > 50) sus = sus === "None" ? "Medium" : sus === "Low" ? "High" : sus === "Medium" ? "High" : "V.High";
    else if (cycles_per_yr > 20) sus = sus === "None" ? "Low" : sus === "Low" ? "Medium" : sus;

    // Erosive flow (FCC riser / regenerator standpipe) — major refractory killer
    if (has_erosive_flow) {
      if (refractory_type === "ceramic_fibre" || refractory_type === "plastic") sus = "V.High";
      else if (refractory_type === "castable" || refractory_type === "gunite") sus = sus === "Low" ? "High" : sus === "Medium" ? "V.High" : sus === "High" ? "V.High" : sus;
    }

    // Chemical attack — sulphate-attack on Ca-bearing castables
    if (has_chemical_attack) {
      sus = sus === "None" ? "Medium" : sus === "Low" ? "High" : "V.High";
    }

    // Installation quality (API 936) — proper dry-cure-out + 3rd party QC
    if (!dry_cure_proper) {
      sus = sus === "None" ? "Medium" : sus === "Low" ? "Medium" : sus === "Medium" ? "High" : sus;
    }
    if (QC_per_API_936) {
      sus = sus === "V.High" ? "High" : sus === "High" ? "Medium" : sus === "Medium" ? "Low" : sus;
    }

    var res = _commonDF(opts, sus, "Refractory Degradation",
      "API RP 581 (3rd ed.) Annex 2.J + API RP 571 (3rd ed., 2020) §4.2.18 + "
      + "API STD 936 (3rd ed., 2014) installation QC + Schaffel-Mancini et al. "
      + "(2002) Mater. Perf. 41(2), 50. Erosive-flow service (FCC riser / "
      + "regenerator) is the dominant refractory damage mechanism.");
    res.refractory_type = refractory_type;
    res.T_ratio = T_ratio;
    res.cycles_per_yr = cycles_per_yr;
    return res;
  }

  // ============= Appendix O — Atmospheric Tank Bottom ========================
  /** Per API 581 Appendix O + API STD 653 + API STD 575 + API STD 650.
   *  Damage mechanisms covered:
   *    floor_internal     — top-side product-driven thinning of floor plate
   *    floor_underside    — under-side soil-side corrosion of floor plate
   *    shell_thinning     — atmospheric + product (separate from sketch plate)
   *    sketch_plate       — top-edge floor-to-shell weld zone
   *    settlement         — out-of-plane (cosine) or differential edge
   *  Returns aggregate floor + shell DF.
   */
  function tank_bottom_DF(opts) {
    opts = opts || {};
    var component = opts.component || "floor";    // "floor" | "shell" | "settlement"

    if (component === "settlement") {
      return _tank_settlement_DF(opts);
    }
    if (component === "shell") {
      return _tank_shell_DF(opts);
    }

    // floor (default) ----------------------------------------------------------
    var t_nom_mm = +opts.floor_t_nom_mm || 6;
    var t_min_mm = +opts.floor_t_min_mm || 2.54;       // API 653 §4.4.7.1 typical minimum
    var floor_age_yr = +opts.floor_age_yr || +opts.age_yr || 20;
    var CR_top_mmyr = +opts.floor_CR_top_mmyr || 0.05;     // product side
    var CR_bottom_mmyr = +opts.floor_CR_bottom_mmyr || 0.08;  // soil side
    var product_type = opts.product_type || "crude";    // crude/diesel/water/chemical
    var release_prevention = opts.release_prevention || "none"; // "RPB" | "double_bottom" | "none"
    var foundation = opts.foundation || "compacted_soil"; // "concrete" | "asphalt" | "sand" | "compacted_soil" | "vapour_barrier"
    var CP_present = !!opts.CP_present;
    var liner_present = !!opts.liner_present;

    // API 653 §4.4 / Appendix O — corrosion-allowance consumption:
    var CR_eff = CR_top_mmyr + CR_bottom_mmyr;
    if (CP_present) CR_eff *= 0.3;     // CP reduces under-side ~70%
    if (liner_present) CR_eff *= 0.2;  // proper liner ~80%
    if (release_prevention === "RPB") CR_eff *= 0.5;
    if (release_prevention === "double_bottom") CR_eff *= 0.2;
    // Foundation under-side CR multiplier
    var foundationMult = { "concrete":0.5, "asphalt":0.7, "vapour_barrier":0.3,
                            "compacted_soil":1.0, "sand":1.5 }[foundation] || 1.0;
    CR_eff *= foundationMult;

    var t_remaining = Math.max(0, t_nom_mm - CR_eff * floor_age_yr);
    // Art = consumed / allowable_consumption (per API 581 Annex 2.B convention)
    var consumed = t_nom_mm - t_remaining;
    var allowable_consumption = Math.max(0.01, t_nom_mm - t_min_mm);
    var Art = Math.max(0, Math.min(1, consumed / allowable_consumption));

    var sus;
    if (Art < 0.10) sus = "None";
    else if (Art < 0.30) sus = "Low";
    else if (Art < 0.50) sus = "Medium";
    else if (Art < 0.75) sus = "High";
    else sus = "V.High";

    var res = _commonDF(opts, sus, "AST Floor Plate",
      "API RP 581 (3rd ed.) Appendix O + API STD 653 (5th ed., 2014) §4.4 + "
      + "API STD 575 §6.3 + API STD 650 §3.5 (corrosion allowance). "
      + "Floor-plate damage combines top-side product-driven thinning + under-"
      + "side soil-driven corrosion, modulated by CP, liners, RPB / double-"
      + "bottom, and foundation type.");
    res.t_remaining_mm = t_remaining;
    res.Art = Art;
    res.CR_effective_mmyr = CR_eff;
    res.foundation_multiplier = foundationMult;
    return res;
  }

  function _tank_shell_DF(opts) {
    var t_nom_mm = +opts.shell_t_nom_mm || +opts.t_rdi_mm || 12;
    var t_min_mm = +opts.shell_t_min_mm || +opts.t_min_mm || 6;
    var shell_age_yr = +opts.age_yr || 20;
    var CR_atm_mmyr = +opts.shell_CR_atm_mmyr || 0.05;
    var CR_internal_mmyr = +opts.shell_CR_internal_mmyr || 0.05;
    var coating_quality = opts.coating_quality || "fair";
    var insulated = !!opts.insulated;
    var T_C_external = +opts.T_C_external || 25;

    var coatMult = { "good":0.1, "fair":0.5, "poor":1.0, "none":1.5 }[coating_quality] || 1.0;
    var CR_eff = CR_atm_mmyr * coatMult + CR_internal_mmyr;
    // CUI peak band amplifier
    if (insulated && T_C_external >= 60 && T_C_external <= 121) CR_eff *= 2;

    var t_remaining = Math.max(0, t_nom_mm - CR_eff * shell_age_yr);
    var consumed = t_nom_mm - t_remaining;
    var allowable_consumption = Math.max(0.01, t_nom_mm - t_min_mm);
    var Art = Math.max(0, Math.min(1, consumed / allowable_consumption));
    var sus;
    if (Art < 0.10) sus = "None";
    else if (Art < 0.30) sus = "Low";
    else if (Art < 0.50) sus = "Medium";
    else if (Art < 0.75) sus = "High";
    else sus = "V.High";

    var res = _commonDF(opts, sus, "AST Shell Thinning",
      "API RP 581 (3rd ed.) Appendix O + API STD 653 §4.3 + API STD 575 §6.2 + "
      + "ISO 9223:2012 atmospheric corrosivity (shell external CR multiplier).");
    res.t_remaining_mm = t_remaining;
    res.Art = Art;
    res.CR_effective_mmyr = CR_eff;
    return res;
  }

  function _tank_settlement_DF(opts) {
    // Cosine-curve (planar) settlement vs differential edge-settlement
    // per API 653 Annex B + EEMUA 159 §11.3
    var S_max_mm = +opts.settlement_max_mm || 0;
    var D_tank_m = +opts.tank_diameter_m || 30;
    var settlement_type = opts.settlement_type || "planar";   // "planar" | "differential" | "edge"
    var S_uniform_OK_mm = +opts.S_uniform_OK_mm || 0;        // uniform OK per Appendix B

    if (S_max_mm <= 0) return _notApplicable("Tank Settlement", "no settlement data provided");

    // API 653 Annex B Eq B.3.2.1 — allowable out-of-plane:
    //   S_allowable = 0.012 · D (m) · 1000 mm  per chord
    // Differential edge settlement allowable per Eq B.4.2.1:
    //   S_b allow = 11·R·Y / (E·H) (Bursi) — simplified to 50 mm for typical
    var S_allow_planar = 0.012 * D_tank_m * 1000;   // mm
    var S_allow_edge = 50;                          // mm — typical
    var allow = settlement_type === "edge" || settlement_type === "differential"
                ? S_allow_edge : S_allow_planar;
    var ratio = S_max_mm / allow;

    var sus;
    if (ratio < 0.3) sus = "None";
    else if (ratio < 0.6) sus = "Low";
    else if (ratio < 0.9) sus = "Medium";
    else if (ratio < 1.3) sus = "High";
    else sus = "V.High";

    var res = _commonDF(opts, sus, "Tank Settlement",
      "API STD 653 (5th ed., 2014) Annex B (settlement evaluation) + "
      + "EEMUA 159 (5th ed., 2017) §11.3 — differential / cosine-curve / "
      + "edge settlement against allowable per Eq B.3.2.1 (planar 0.012·D) "
      + "and Eq B.4.2.1 (edge ~50 mm typical for D=30 m tank).");
    res.settlement_max_mm = S_max_mm;
    res.S_allowable_mm = allow;
    res.settlement_ratio = ratio;
    res.settlement_type = settlement_type;
    return res;
  }

  // ============= Embedded regression tests ====================================
  function _runTests() {
    var pass = 0, fail = 0, errs = [];
    function ass(c, m){ if (c) pass++; else { fail++; errs.push(m); } }

    // === Refractory ===
    var r1 = refractory_DF({refractory_type:"castable", T_service_C:600, T_max_design_C:1000, thermal_cycles_per_yr:10});
    ass(r1.applicable && r1.susceptibility === "None", "Refractory: well below design + low cycles → None (got "+r1.susceptibility+")");
    var r2 = refractory_DF({refractory_type:"castable", T_service_C:900, T_max_design_C:1000, thermal_cycles_per_yr:60});
    ass(r2.susceptibility === "High" || r2.susceptibility === "V.High", "Refractory: near design + many cycles → High/V.High (got "+r2.susceptibility+")");
    var r3 = refractory_DF({refractory_type:"ceramic_fibre", T_service_C:700, T_max_design_C:1000, has_erosive_flow:true});
    ass(r3.susceptibility === "V.High", "Refractory: ceramic fibre in FCC riser → V.High");
    var r4 = refractory_DF({refractory_type:"castable", T_service_C:900, T_max_design_C:1000, thermal_cycles_per_yr:60, QC_per_API_936:true});
    ass(r4.SVI <= r2.SVI, "Refractory: API 936 QC reduces severity (got QC "+r4.susceptibility+" vs no-QC "+r2.susceptibility+")");

    // === Floor ===
    var f1 = tank_bottom_DF({component:"floor", floor_t_nom_mm:6, floor_t_min_mm:2.54, floor_age_yr:20, floor_CR_top_mmyr:0.05, floor_CR_bottom_mmyr:0.08});
    ass(f1.applicable, "Floor: standard 20-yr-old tank → applicable");
    var f2 = tank_bottom_DF({component:"floor", floor_t_nom_mm:6, floor_t_min_mm:2.54, floor_age_yr:20, floor_CR_top_mmyr:0.05, floor_CR_bottom_mmyr:0.08, CP_present:true, liner_present:true});
    ass(f2.Art < f1.Art, "Floor: CP + liner reduces Art (got "+f2.Art.toFixed(3)+" vs "+f1.Art.toFixed(3)+")");
    var f3 = tank_bottom_DF({component:"floor", floor_t_nom_mm:6, floor_t_min_mm:2.54, floor_age_yr:30, floor_CR_top_mmyr:0.10, floor_CR_bottom_mmyr:0.15, foundation:"sand"});
    ass(f3.susceptibility === "High" || f3.susceptibility === "V.High", "Floor: 30 yr + high CR + sand foundation → High/V.High (got "+f3.susceptibility+", Art="+f3.Art.toFixed(3)+")");

    // === Shell ===
    var s1 = tank_bottom_DF({component:"shell", shell_t_nom_mm:12, shell_t_min_mm:6, age_yr:25, shell_CR_atm_mmyr:0.05, shell_CR_internal_mmyr:0.05, coating_quality:"good"});
    ass(s1.applicable && s1.Art < 0.3, "Shell: good coating → low Art (got "+s1.Art.toFixed(3)+")");
    var s2 = tank_bottom_DF({component:"shell", shell_t_nom_mm:12, shell_t_min_mm:6, age_yr:25, shell_CR_atm_mmyr:0.05, shell_CR_internal_mmyr:0.05, coating_quality:"none", insulated:true, T_C_external:80});
    ass(s2.Art > s1.Art, "Shell: no coating + CUI band → higher Art");

    // === Settlement ===
    var st1 = tank_bottom_DF({component:"settlement", settlement_max_mm:0});
    ass(!st1.applicable, "Settlement: no data → not applicable");
    var st2 = tank_bottom_DF({component:"settlement", settlement_max_mm:50, tank_diameter_m:30, settlement_type:"planar"});
    // S_allow = 0.012·30·1000 = 360 mm, ratio = 50/360 = 0.14 → None
    ass(st2.applicable && st2.susceptibility === "None", "Settlement: 50 mm in 30 m tank planar → None (got "+st2.susceptibility+", ratio="+st2.settlement_ratio.toFixed(2)+")");
    var st3 = tank_bottom_DF({component:"settlement", settlement_max_mm:100, tank_diameter_m:30, settlement_type:"edge"});
    // S_allow_edge = 50 mm, ratio = 100/50 = 2.0 → V.High
    ass(st3.susceptibility === "V.High", "Settlement: 100 mm edge in 30 m tank → V.High (ratio 2.0)");

    return { pass: pass, fail: fail, errs: errs, total: pass+fail };
  }

  var RBIRefractoryTank = {
    SVI_LEVEL: SVI_LEVEL,
    refractory_DF: refractory_DF,
    tank_bottom_DF: tank_bottom_DF,
    _runTests: _runTests
  };
  root.RBIRefractoryTank = RBIRefractoryTank;
  if (typeof module !== "undefined" && module.exports) module.exports = RBIRefractoryTank;
})(typeof window !== "undefined" ? window : (typeof global !== "undefined" ? global : this));

if (typeof require !== "undefined" && require.main === module) {
  try { global.RBIDetailed = require("./rbi-detailed.js"); } catch(_){}
  var R = module.exports;
  var r = R._runTests();
  console.log("RBI-RefractoryTank regression: PASS " + r.pass + " / FAIL " + r.fail + " / total " + r.total);
  if (r.fail) r.errs.forEach(function(e){ console.log("  - " + e); });
}
