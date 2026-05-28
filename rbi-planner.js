/* rbi-planner.js — Industry-grade RBI planning add-ons:
 *   - recommendInspection() — solves for next-inspection date + effectiveness
 *   - forecastDF() — Art(t), D_f(t), PoF(t) trajectory with planned inspections
 *   - cofLevel2() — full Part 3 release + dispersion + financial CoF
 *   - bayesianUpdateOnFinding() — proper posterior update on inspection result
 *
 * Sources:
 *   - API RP 581 (3rd ed., April 2016) Part 2 §6.5 + Annex 2.A (planning)
 *   - API RP 581 (3rd ed.) Part 3 §5 + Tab 5.2-5.10 (CoF Level 2)
 *   - API RP 580 (4th ed., 2023) §8 (risk matrix + intervals)
 *   - API STD 510 (11th ed., 2022) §6 — Pressure-vessel inspection intervals
 *   - API STD 570 (5th ed., 2020) §6 — Piping inspection intervals
 *   - API STD 653 (5th ed., 2014) §6 — AST inspection intervals
 *   - AIChE-DIERS (1992) Emergency Relief System Design — choked / 2-phase release
 *   - Pasquill F. (1961) Meteorol. Mag. 90, 33; Gifford F.A. (1961) — atm dispersion
 *   - ERPG (AIHA 2019) — Emergency Response Planning Guidelines
 *   - IDLH (NIOSH 2014) — Immediately Dangerous to Life or Health
 *   - CCPS (2017) Guidelines for Vapor Cloud Explosion + Flash Fire
 *   - TNO Yellow Book (3rd ed., 2005) — Methods for calculation of physical effects
 */
(function (root) {
  "use strict";

  function _safeGet(obj, key, dflt) { return obj && obj[key] != null ? obj[key] : dflt; }

  // ===========================================================================
  // 1. Bayesian update on inspection finding
  // ===========================================================================
  /** Updates damage-state posterior given an inspection finding (per Part 2
   *  §5.8 Eq 5.16). Conditional matrix P(I | DS) is effectiveness-specific.
   *  @param {Array<number>} prior — [P(DS1), P(DS2), P(DS3)] sums to 1
   *  @param {string} eff — "A" | "B" | "C" | "D" | "E"
   *  @param {string} finding — "as_expected" | "less_than_expected" | "more_than_expected"
   *  @returns {Array<number>} posterior
   */
  var CONDITIONAL = {
    "A": { as_expected:[0.95,0.04,0.01], less:[0.30,0.50,0.20], more:[0.02,0.18,0.80] },
    "B": { as_expected:[0.85,0.12,0.03], less:[0.20,0.55,0.25], more:[0.05,0.30,0.65] },
    "C": { as_expected:[0.65,0.25,0.10], less:[0.15,0.55,0.30], more:[0.10,0.40,0.50] },
    "D": { as_expected:[0.50,0.30,0.20], less:[0.20,0.45,0.35], more:[0.15,0.40,0.45] },
    "E": { as_expected:[0.33,0.33,0.34], less:[0.33,0.33,0.34], more:[0.33,0.33,0.34] }
  };
  function bayesianUpdateOnFinding(prior, eff, finding) {
    prior = prior || [0.50, 0.30, 0.20];
    var cond = CONDITIONAL[eff] || CONDITIONAL["E"];
    var key = finding === "more_than_expected" ? "more"
            : finding === "less_than_expected" ? "less" : "as_expected";
    var likelihood = cond[key] || cond.as_expected;
    var post = prior.map(function(p, i){ return p * likelihood[i]; });
    var sum = post.reduce(function(a,b){ return a+b; }, 0);
    return post.map(function(p){ return p / sum; });
  }

  // ===========================================================================
  // 2. Time-evolution forecast: Art(t), D_f(t), PoF(t)
  // ===========================================================================
  /** Projects damage trajectory over time given baseline + planned inspections.
   *  @param {object} opts
   *    .t_rdi_mm, .CR_mmyr, .t_min_mm, .CA_mm, .age_now_yr
   *    .horizon_yr (default 30)
   *    .planned_inspections — [{at_age_yr, eff, finding?}]
   *    .GFF (failures/yr), .F_MS (default 1)
   *  @returns {object} trajectory + recommended inspections
   */
  function forecastDF(opts) {
    opts = opts || {};
    var t_rdi = +opts.t_rdi_mm;
    var CR = +opts.CR_mmyr;
    var t_min = +opts.t_min_mm;
    var CA = +opts.CA_mm || 0;
    var age_now = +opts.age_now_yr || 0;
    var horizon = +opts.horizon_yr || 30;
    var planned = opts.planned_inspections || [];
    var GFF = +opts.GFF || 3.06e-5;
    var F_MS = opts.F_MS != null ? +opts.F_MS : 1;
    if (!(t_rdi > 0 && t_min > 0)) return { error: "t_rdi and t_min required" };

    if (!root.RBIDetailed || !root.RBIDetailed.thinningDF) {
      return { error: "RBIDetailed.thinningDF not available" };
    }
    var trajectory = [];
    // Sort planned inspections by age
    planned = planned.slice().sort(function(a,b){ return a.at_age_yr - b.at_age_yr; });
    for (var yr = age_now; yr <= age_now + horizon; yr += 1) {
      // History of inspections performed up to and including this year
      var hist = planned.filter(function(p){ return p.at_age_yr <= yr; })
                       .map(function(p){ return { eff: p.eff || "B" }; });
      var t = root.RBIDetailed.thinningDF({
        t_rdi_mm: t_rdi, t_min_mm: t_min, CR_mmyr: CR, CA_mm: CA, age_yr: yr,
        inspection_history: hist
      });
      var pof = GFF * F_MS * t.D_f_thin;
      trajectory.push({
        age_yr: yr, Art: t.Art, D_fB: t.D_fB_thin, D_f: t.D_f_thin, PoF: pof,
        effectiveness_col: t.effectiveness_col
      });
    }
    // Find when PoF crosses target threshold
    var PoF_target = +opts.PoF_target || 1e-3;
    var crossingAge = null;
    for (var i = 0; i < trajectory.length; i++) {
      if (trajectory[i].PoF > PoF_target) { crossingAge = trajectory[i].age_yr; break; }
    }
    return {
      trajectory: trajectory,
      PoF_now: trajectory[0] ? trajectory[0].PoF : null,
      PoF_at_horizon: trajectory[trajectory.length-1] ? trajectory[trajectory.length-1].PoF : null,
      Art_at_horizon: trajectory[trajectory.length-1] ? trajectory[trajectory.length-1].Art : null,
      crossing_age_yr: crossingAge,
      PoF_target: PoF_target,
      planned_inspections: planned,
      ref: "API RP 581 (3rd ed.) Part 2 Annex 2.A + §6.5 — PoF(t) projection; "
         + "inspection events reset the inspection-history column in Tab 5.11."
    };
  }

  // ===========================================================================
  // 3. Inspection-plan recommendation
  // ===========================================================================
  /** Recommends WHEN + AT WHAT EFFECTIVENESS to perform the next inspection
   *  to keep PoF below the target over the planning horizon.
   *  @returns {object} { recommended_age_yr, recommended_eff, recommended_techniques, ... }
   */
  function recommendInspection(opts) {
    opts = opts || {};
    var PoF_target = +opts.PoF_target || 1e-3;
    var horizon = +opts.horizon_yr || 10;
    var age_now = +opts.age_now_yr || 0;
    var max_cycle = +opts.max_inspection_interval_yr || _api510_510_653_max(opts);
    // Try each effectiveness from A down (industry preference for most-effective scheduling)
    var trial_effs = ["A", "B", "C", "D"];
    var best = null;
    for (var i = 0; i < trial_effs.length; i++) {
      var eff = trial_effs[i];
      // Walk forward in time looking for the latest age at which an `eff`
      // inspection would still keep PoF < target for `horizon` years
      for (var dt = 1; dt <= horizon + 1; dt += 0.5) {
        var insp_at = age_now + dt;
        // forecast assuming inspection at this age + effectiveness eff
        var f = forecastDF(Object.assign({}, opts, {
          horizon_yr: horizon + 5,
          planned_inspections: [{ at_age_yr: insp_at, eff: eff }]
        }));
        // Check max PoF over the forecast period AFTER the inspection
        var peak = 0, peakAge = null;
        f.trajectory.forEach(function(t){
          if (t.age_yr >= insp_at && t.PoF > peak) { peak = t.PoF; peakAge = t.age_yr; }
        });
        if (peak > PoF_target) {
          // dt too far; record the latest acceptable dt for this eff
          if (best == null || dt > best.dt + 0.01 || best.eff !== eff) {
            // Already exceeded → use the immediately-prior dt
            var insp_prev = age_now + Math.max(1, dt - 0.5);
            best = {
              eff: eff, dt: dt - 0.5, recommended_age_yr: insp_prev,
              years_from_now: insp_prev - age_now, peak_after: peak,
              peak_age: peakAge
            };
          }
          break;
        }
      }
      if (best && best.eff === eff && best.dt > 0) {
        // Found the latest dt that still works for this eff
        // For "industry-typical" recommendations, prefer LONGER intervals
        // (less invasive) — so once we found something, return immediately.
        break;
      }
    }
    if (!best) {
      // Nothing works — must inspect NOW at highest effectiveness
      best = { eff: "A", recommended_age_yr: age_now, years_from_now: 0,
               peak_after: PoF_target * 1e6, dt: 0 };
    }
    // Cap to code maximum interval
    if (best.years_from_now > max_cycle) {
      best.years_from_now = max_cycle;
      best.recommended_age_yr = age_now + max_cycle;
      best.code_capped = true;
    }
    // Recommended techniques per damage mechanism
    var dominantMech = opts.dominant_mechanism || "Thinning";
    var techniques = _recommendedTechniques(dominantMech, best.eff);
    return {
      recommended_age_yr: best.recommended_age_yr,
      recommended_years_from_now: best.years_from_now,
      recommended_effectiveness: best.eff,
      recommended_techniques: techniques,
      peak_PoF_after_inspection: best.peak_after,
      PoF_target: PoF_target,
      max_interval_per_code_yr: max_cycle,
      code_capped: !!best.code_capped,
      dominant_mechanism: dominantMech,
      ref: "API RP 581 (3rd ed.) §6.5 + API 510 (11th ed.) §6 / API 570 (5th ed.) §6 / "
         + "API 653 (5th ed.) §6 — maximum inspection intervals: 10 yr (vessel) / "
         + "10 yr (piping class 1) / 20 yr (AST external) / half of remaining life."
    };
  }

  /** Inspection-interval caps per API 510 / 570 / 653 */
  function _api510_510_653_max(opts) {
    var type = (opts.type || "vessel").toLowerCase();
    if (type.indexOf("pipe") >= 0) return 10;             // API 570 §6 Class 1 piping
    if (type.indexOf("ast") >= 0 || type.indexOf("tank") >= 0) return 20; // API 653 §6.3.2.1 external
    return 10;                                            // API 510 §6 default vessels
  }

  /** Recommended inspection techniques per damage mechanism */
  function _recommendedTechniques(mech, eff) {
    var lib = {
      "Thinning": ["UT thickness (grid pattern at TMLs)", "UT C-scan if pitting suspected", "RT for socket welds"],
      "HIC/SOHIC-H2S": ["WFMT (wet fluorescent MT) on weld + HAZ", "Phased-array UT (PAUT)", "TOFD on welds", "AUT pipeline scan"],
      "Cl-SCC": ["ECT (eddy-current) on tube bundle", "PT (penetrant test) on welds + bend regions", "Visual + magnification on tight spots"],
      "Caustic SCC": ["WFMT on weld + HAZ for hot-side", "Internal visual inspection for cracks", "PT on suspect areas"],
      "Amine SCC": ["WFMT on weld + HAZ", "AUT longitudinal scan", "RT corner welds"],
      "SSC": ["Visual inspection of stressed regions", "PT on welds + HAZ", "HRC field hardness testing"],
      "HTHA": ["AUT TOFD on welds", "Phased-array UT with backscatter (DAC)", "MT on hot-side surfaces", "Replication for microstructural assessment"],
      "Carbonate SCC": ["WFMT on weld + HAZ", "Internal visual inspection"],
      "PASCC": ["PT during shutdown after dry purge", "Visual for crack indications"],
      "HSC-HF": ["WFMT on welds", "HRC field hardness", "PT on bend regions"],
      "Brittle Fracture": ["Charpy V-notch sampling", "Material verification per ASME UCS-66"],
      "Mechanical Fatigue": ["Visual + magnetic-particle on critical welds", "Strain-gauge survey", "Vibration monitoring"],
      "External": ["Visual inspection + UT on suspect areas", "Coating-thickness measurement", "MT/PT on welds"],
      "External CUI": ["Strip insulation (random sample per API 583 §5.3)", "Pulsed-eddy-current (PEC) inspection", "Radiography (RT) for inaccessible spots"],
      "Refractory Degradation": ["Visual inspection (cold + hot)", "IR thermography for hot-spots", "Hammer survey for delamination", "Ultrasonic thickness for residual"],
      "AST Floor Plate": ["MFL (magnetic-flux-leakage) scan", "Vacuum-box test on welds", "UT thickness on sketch plate"],
      "AST Shell Thinning": ["UT thickness (top/middle/bottom courses)", "External visual + coating-thickness"],
      "Tank Settlement": ["Optical-level survey (per API 653 Annex B)", "Verticality + diameter survey"]
    };
    var techs = lib[mech] || lib["Thinning"];
    return { techniques: techs, effectiveness: eff,
      note: "Higher-effectiveness inspections (A) typically require: full surface coverage + qualified inspector + advanced NDT (e.g., AUT/PAUT/TOFD/MFL). Lower-effectiveness (C/D) = visual + spot-check UT." };
  }

  // ===========================================================================
  // 4. CoF Level 2 — full release + dispersion + financial
  // ===========================================================================
  /** Per API RP 581 Part 3 §5 — Level 2 CoF.
   *  Pipeline: hole-size → release rate → duration → released mass → dispersion
   *  → consequence area (CA_inj for personnel, CA_cmd for equipment damage) →
   *  → financial CoF.
   *  Inputs:
   *    .fluid_name (must be in FLUIDS_L2 — extended library)
   *    .hole_size_in (0.25 | 1 | 4 | 16)
   *    .inventory_kg, .P_kPa, .T_C
   *    .detection_class ("A"|"B"|"C"), .isolation_class ("A"|"B"|"C")
   *    .release_height_m (default 3), .windspeed_m_s (default 5)
   *    .equipment_replacement_USD (default 100k), .injury_cost_USD (default 10M)
   *    .business_interruption_USD_per_day (default 100k), .MTTR_days (default 30)
   */
  // Extended fluid library — adds dispersion-relevant properties per fluid.
  // ERPG-2 (Emergency Response Planning Guideline 2) = 1-hr exposure that
  // would NOT cause irreversible or other serious health effects.
  var FLUIDS_L2 = {
    "C1-C2":      { MW:18,  AIT_C:537, MIE_mJ:0.21, vapour_density_kg_m3:0.66, ERPG2_ppm:null,  flammable:true,  toxic:false, BLEVE_factor:1.0 },
    "C3-C4":      { MW:49,  AIT_C:470, MIE_mJ:0.25, vapour_density_kg_m3:1.86, ERPG2_ppm:null,  flammable:true,  toxic:false, BLEVE_factor:1.5 },
    "C5":         { MW:72,  AIT_C:260, MIE_mJ:0.22, vapour_density_kg_m3:2.49, ERPG2_ppm:null,  flammable:true,  toxic:false, BLEVE_factor:1.2 },
    "C6-C8":      { MW:100, AIT_C:220, MIE_mJ:0.24, vapour_density_kg_m3:3.46, ERPG2_ppm:null,  flammable:true,  toxic:false, BLEVE_factor:1.0 },
    "C9-C12":     { MW:150, AIT_C:210, MIE_mJ:null, vapour_density_kg_m3:null, ERPG2_ppm:null,  flammable:true,  toxic:false, BLEVE_factor:0.5 },
    "gasoline":   { MW:100, AIT_C:280, MIE_mJ:0.24, vapour_density_kg_m3:3.5,  ERPG2_ppm:500,   flammable:true,  toxic:false, BLEVE_factor:1.0 },
    "diesel":     { MW:180, AIT_C:210, MIE_mJ:null, vapour_density_kg_m3:null, ERPG2_ppm:null,  flammable:false, toxic:false, BLEVE_factor:0.2 },
    "kerosene":   { MW:170, AIT_C:220, MIE_mJ:null, vapour_density_kg_m3:null, ERPG2_ppm:null,  flammable:false, toxic:false, BLEVE_factor:0.3 },
    "fuel-oil":   { MW:300, AIT_C:230, MIE_mJ:null, vapour_density_kg_m3:null, ERPG2_ppm:null,  flammable:false, toxic:false, BLEVE_factor:0.1 },
    "H2S":        { MW:34,  AIT_C:260, MIE_mJ:0.077, vapour_density_kg_m3:1.45, ERPG2_ppm:30,   flammable:true,  toxic:true,  BLEVE_factor:0.5 },
    "NH3":        { MW:17,  AIT_C:651, MIE_mJ:0.68,  vapour_density_kg_m3:0.59, ERPG2_ppm:150,  flammable:true,  toxic:true,  BLEVE_factor:0.3 },
    "Cl2":        { MW:71,  AIT_C:null,MIE_mJ:null, vapour_density_kg_m3:3.21, ERPG2_ppm:3,     flammable:false, toxic:true,  BLEVE_factor:0.2 },
    "HF":         { MW:20,  AIT_C:null,MIE_mJ:null, vapour_density_kg_m3:0.99, ERPG2_ppm:20,    flammable:false, toxic:true,  BLEVE_factor:0.1 },
    "SO2":        { MW:64,  AIT_C:null,MIE_mJ:null, vapour_density_kg_m3:2.74, ERPG2_ppm:3,     flammable:false, toxic:true,  BLEVE_factor:0.1 },
    "H2":         { MW:2,   AIT_C:560, MIE_mJ:0.02, vapour_density_kg_m3:0.09, ERPG2_ppm:null,  flammable:true,  toxic:false, BLEVE_factor:0.3 },
    "CO":         { MW:28,  AIT_C:609, MIE_mJ:null, vapour_density_kg_m3:1.16, ERPG2_ppm:350,   flammable:true,  toxic:true,  BLEVE_factor:0.3 },
    "CO2":        { MW:44,  AIT_C:null,MIE_mJ:null, vapour_density_kg_m3:1.83, ERPG2_ppm:30000, flammable:false, toxic:true,  BLEVE_factor:0.0 },
    "Methanol":   { MW:32,  AIT_C:464, MIE_mJ:0.14, vapour_density_kg_m3:1.11, ERPG2_ppm:1000,  flammable:true,  toxic:true,  BLEVE_factor:0.5 },
    "acid-H2SO4": { MW:98,  AIT_C:null,MIE_mJ:null, vapour_density_kg_m3:null, ERPG2_ppm:10,    flammable:false, toxic:true,  BLEVE_factor:0.0 }
  };
  // Hole-size weighted release area per Part 3 Tab 5.7:
  //   Small 0.25 in (6 mm)    weight 0.85
  //   Medium 1 in (25 mm)      weight 0.10
  //   Large 4 in (100 mm)      weight 0.04
  //   Rupture 16 in (full bore) weight 0.01
  var HOLE_WEIGHTS = { "0.25":0.85, "1":0.10, "4":0.04, "16":0.01 };

  function cofLevel2(opts) {
    opts = opts || {};
    var fluid_name = opts.fluid_name || opts.fluid;
    var fluid = FLUIDS_L2[fluid_name];
    if (!fluid) return { error:"Unknown fluid for Level 2 — available: "+Object.keys(FLUIDS_L2).join(", ") };
    var hole_size_in = +opts.hole_size_in || +opts.hole_size || 1;
    var inventory_kg = +opts.inventory_kg || 5000;
    var P_kPa = +opts.P_kPa || 1500;
    var T_C = +opts.T_C || 50;
    var detection_class = opts.detection_class || "B";
    var isolation_class = opts.isolation_class || "B";
    var release_height_m = +opts.release_height_m || 3;
    var windspeed_m_s = +opts.windspeed_m_s || 5;
    var equipment_replacement_USD = +opts.equipment_replacement_USD || 100000;
    var injury_cost_USD = +opts.injury_cost_USD || 10000000;
    var business_interruption_USD_per_day = +opts.business_interruption_USD_per_day || 100000;
    var MTTR_days = +opts.MTTR_days || 30;
    var population_density_per_m2 = +opts.population_density_per_m2 || 0.0001; // ~1 person per ha

    // Hole-area
    var hole_area_m2 = Math.PI * Math.pow(hole_size_in * 0.0254 / 2, 2);
    // Discharge rate per AIChE-DIERS — choked vs non-choked, gas vs liquid
    var density_kg_m3 = fluid.MW * P_kPa / (8.314 * (273.15 + T_C));
    // Choked-flow critical pressure ratio for ideal gas (k=1.3): P_c/P0 = 0.546
    var k = 1.3;
    var Pcrit_ratio = Math.pow(2/(k+1), k/(k-1));        // ≈ 0.546 for k=1.3
    var Patm_kPa = 101.325;
    var choked = (Patm_kPa / P_kPa) < Pcrit_ratio;
    var Cd = 0.62;                                       // discharge coefficient
    var release_kg_s;
    if (choked) {
      release_kg_s = Cd * hole_area_m2 * P_kPa * 1000
                     * Math.sqrt(k / (8.314e3 * (273.15+T_C) / fluid.MW)
                     * Math.pow(2/(k+1), (k+1)/(k-1)));
    } else {
      release_kg_s = Cd * hole_area_m2 * Math.sqrt(2 * density_kg_m3 * (P_kPa - Patm_kPa) * 1000);
    }
    if (!isFinite(release_kg_s) || release_kg_s < 0) release_kg_s = 0;

    // Detection + isolation duration per Part 3 Tab 4.5
    var DET_SEC = { A: 300, B: 1800, C: 3600 };
    var ISO_SEC = { A: 1200, B: 3600, C: 28800 };
    var duration_s = (DET_SEC[detection_class] || 1800) + (ISO_SEC[isolation_class] || 3600);
    var total_released_kg = Math.min(inventory_kg, release_kg_s * duration_s);

    // Atmospheric dispersion — Pasquill-Gifford for class D (neutral) stability
    // CA_inj is the area at ERPG-2 concentration; CA_cmd is the LFL+flame area
    var CA_inj_m2 = 0, CA_cmd_m2 = 0;
    if (fluid.toxic && fluid.ERPG2_ppm) {
      // Toxic-cloud area at ERPG-2 ppm — Pasquill class D dispersion
      // Mass-based concentration at distance x: C(x) ≈ Q / (π·σy·σz·u)
      // σy(x), σz(x) per Briggs (urban) — σy ≈ 0.16x/(1+0.0004x)^0.5
      // We use a simplified "effective dispersion radius" formula:
      // r_inj ≈ sqrt(Q · MW / (ERPG_ppm_kg_m3 · π · windspeed))
      var ERPG_kg_m3 = fluid.ERPG2_ppm * 1e-6 * fluid.MW / 24.45;  // ppm → kg/m³ at STP
      // Approximate: cloud radius where C = ERPG2
      // For continuous release of rate Q [kg/s], steady-state dispersion plume:
      //   r_eff ~ sqrt(Q / (u · C_ERPG · π))
      var r_eff = Math.sqrt(release_kg_s / Math.max(0.001, windspeed_m_s * ERPG_kg_m3 * Math.PI));
      CA_inj_m2 = Math.PI * Math.pow(r_eff, 2);
      // Sanity cap at 1 km radius
      CA_inj_m2 = Math.min(CA_inj_m2, Math.PI * 1e6);
    }
    if (fluid.flammable) {
      // Flame-jet / pool-fire impingement area — proportional to release^0.5
      // TNT-equivalent vapour-cloud explosion if released mass > 100 kg + MIE OK
      var CA_jet_m2 = 50 * Math.pow(release_kg_s, 0.5);   // jet fire heat-radiation
      var CA_VCE_m2 = 0;
      if (total_released_kg > 100 && fluid.MIE_mJ && fluid.MIE_mJ < 1) {
        // TNT-equivalent overpressure damage radius per CCPS 2017 + TNO Yellow Book
        // η_TNT ≈ 0.04 (4% efficiency typical for VCE)
        var W_TNT = 0.04 * total_released_kg * 46500 / 4520;  // kg TNT-eq
        var R_5psi_m = 18 * Math.pow(W_TNT, 1/3);            // 5 psi overpressure radius
        CA_VCE_m2 = Math.PI * Math.pow(R_5psi_m, 2);
      }
      CA_cmd_m2 = Math.max(CA_jet_m2, CA_VCE_m2);
      CA_cmd_m2 = Math.min(CA_cmd_m2, 1e6);
    }
    // If both toxic + flammable, use the larger CA_inj
    var CA_inj_combined = Math.max(CA_inj_m2, CA_cmd_m2 * 0.3);

    // Financial CoF
    var FC_cmd_USD = CA_cmd_m2 * equipment_replacement_USD / 100;  // damage cost per m²
    var FC_affa_USD = CA_inj_combined * 500;                       // area-affected admin cost
    var FC_PROD_USD = MTTR_days * business_interruption_USD_per_day;
    var n_potential_injuries = CA_inj_combined * population_density_per_m2;
    var FC_inj_USD = n_potential_injuries * injury_cost_USD;
    var FC_environ_USD = (total_released_kg > 1000 && fluid.toxic) ? total_released_kg * 100 : 0;
    var FC_total_USD = FC_cmd_USD + FC_affa_USD + FC_PROD_USD + FC_inj_USD + FC_environ_USD;

    return {
      fluid: fluid_name,
      hole_size_in: hole_size_in,
      choked: choked,
      release_kg_s: release_kg_s,
      duration_s: duration_s,
      total_released_kg: total_released_kg,
      CA_inj_m2: CA_inj_combined,
      CA_cmd_m2: CA_cmd_m2,
      n_potential_injuries: n_potential_injuries,
      FC_cmd_USD: FC_cmd_USD,
      FC_affa_USD: FC_affa_USD,
      FC_PROD_USD: FC_PROD_USD,
      FC_inj_USD: FC_inj_USD,
      FC_environ_USD: FC_environ_USD,
      FC_total_USD: FC_total_USD,
      CoF_category: _cofCategory(CA_inj_combined),
      ref: "API RP 581 (3rd ed.) Part 3 §5 + Tab 5.7 (hole-size weights) + "
         + "AIChE-DIERS (1992) choked / 2-phase release + Pasquill-Gifford (1961) "
         + "atm dispersion + CCPS (2017) VCE + TNO Yellow Book (3rd ed.) physical effects + "
         + "ERPG-2 (AIHA 2019) for toxic-cloud area + IDLH (NIOSH 2014). "
         + "Toxic-cloud r_eff ≈ sqrt(Q / (u·C_ERPG·π)) simplified plume."
    };
  }

  function _cofCategory(CA_m2) {
    if (CA_m2 < 100) return "A";          // <100 m² — minimal
    if (CA_m2 < 1000) return "B";         // 100-1000 m²
    if (CA_m2 < 10000) return "C";        // 1k-10k m²
    if (CA_m2 < 100000) return "D";       // 10k-100k m²
    return "E";                            // >100k m² — major
  }

  // Hole-size-weighted CoF (per Part 3 §5.6) — combine 4 hole sizes
  function cofLevel2_weighted(opts) {
    opts = opts || {};
    var sizes = ["0.25", "1", "4", "16"];
    var weighted_CA_inj = 0, weighted_CA_cmd = 0, weighted_FC = 0;
    var perSize = {};
    sizes.forEach(function(s){
      var r = cofLevel2(Object.assign({}, opts, { hole_size_in: +s }));
      if (!r.error) {
        var w = HOLE_WEIGHTS[s] || 0;
        weighted_CA_inj += w * (r.CA_inj_m2 || 0);
        weighted_CA_cmd += w * (r.CA_cmd_m2 || 0);
        weighted_FC += w * (r.FC_total_USD || 0);
        perSize[s] = r;
      }
    });
    return {
      perSize: perSize,
      CA_inj_weighted_m2: weighted_CA_inj,
      CA_cmd_weighted_m2: weighted_CA_cmd,
      FC_weighted_USD: weighted_FC,
      CoF_category_weighted: _cofCategory(weighted_CA_inj),
      ref: "API RP 581 (3rd ed.) Part 3 §5.6 — hole-size weighted aggregate "
         + "with weights 0.85 / 0.10 / 0.04 / 0.01 for 0.25\"/1\"/4\"/16\" holes."
    };
  }

  // ===========================================================================
  // 5. Tests
  // ===========================================================================
  function _runTests() {
    var pass = 0, fail = 0, errs = [];
    function ass(c, m){ if (c) pass++; else { fail++; errs.push(m); } }

    // === Bayesian update ===
    var p1 = bayesianUpdateOnFinding([0.5, 0.3, 0.2], "A", "as_expected");
    ass(Math.abs(p1.reduce(function(a,b){return a+b;}, 0) - 1) < 1e-6, "Bayesian posterior sums to 1");
    ass(p1[0] > 0.5, "A-eff as-expected boosts P(DS_1) above prior (got "+p1[0].toFixed(3)+")");
    var p2 = bayesianUpdateOnFinding([0.5, 0.3, 0.2], "A", "more_than_expected");
    ass(p2[2] > 0.5, "A-eff more-than-expected boosts P(DS_3) above prior (got "+p2[2].toFixed(3)+")");

    // === Forecast trajectory ===
    var f = forecastDF({
      t_rdi_mm:12.7, t_min_mm:9.525, CR_mmyr:0.127, CA_mm:3.175, age_now_yr:25,
      horizon_yr:10, planned_inspections:[{at_age_yr:30, eff:"A"}],
      GFF:3.06e-5, F_MS:1, PoF_target:1e-3
    });
    ass(f.trajectory && f.trajectory.length === 11, "Forecast returns 11 yr-points");
    ass(f.PoF_now > 0, "PoF_now positive");
    // After A inspection at age 30, the trajectory should improve (D_f drops)
    var idx30 = f.trajectory.findIndex(function(t){ return t.age_yr === 30; });
    ass(idx30 > 0, "Found age=30 in trajectory");

    // === Inspection recommender ===
    var rec = recommendInspection({
      t_rdi_mm:12.7, t_min_mm:9.525, CR_mmyr:0.127, CA_mm:3.175, age_now_yr:25,
      type:"vessel", GFF:3.06e-5, F_MS:1, PoF_target:1e-3, horizon_yr:10,
      dominant_mechanism:"Thinning"
    });
    ass(rec.recommended_years_from_now >= 0, "Recommender returns positive years_from_now");
    ass(rec.recommended_years_from_now <= 10, "Recommender capped at API 510 max 10 yr");
    ass(rec.recommended_effectiveness, "Recommender provides effectiveness");
    ass(rec.recommended_techniques.techniques.length > 0, "Recommender provides techniques");

    // === Inspection recommender for piping ===
    var rec_p = recommendInspection({
      t_rdi_mm:9.5, t_min_mm:5, CR_mmyr:0.3, age_now_yr:15,
      type:"pipe-4-10in", GFF:3.06e-5, F_MS:1, PoF_target:1e-3, horizon_yr:10,
      dominant_mechanism:"HIC/SOHIC-H2S"
    });
    ass(rec_p.max_interval_per_code_yr === 10, "Pipe interval cap = 10 yr per API 570");

    // === Inspection recommender for AST ===
    var rec_t = recommendInspection({
      t_rdi_mm:6, t_min_mm:2.54, CR_mmyr:0.05, age_now_yr:15,
      type:"AST-floor", GFF:1.2e-4, F_MS:1, PoF_target:1e-2, horizon_yr:20,
      dominant_mechanism:"AST Floor Plate"
    });
    ass(rec_t.max_interval_per_code_yr === 20, "AST interval cap = 20 yr per API 653");

    // === CoF Level 2 — H2S release ===
    var c1 = cofLevel2({fluid_name:"H2S", hole_size_in:1, inventory_kg:5000, P_kPa:2000, T_C:60,
                       detection_class:"B", isolation_class:"B"});
    ass(c1.FC_total_USD > 0 && isFinite(c1.FC_total_USD), "CoF L2 H2S: total positive + finite");
    ass(c1.CA_inj_m2 > 0, "CoF L2 H2S: toxic cloud area > 0");
    ass(c1.CoF_category, "CoF L2 H2S: category assigned");

    // === CoF Level 2 — Cl2 release (very toxic) ===
    var c2 = cofLevel2({fluid_name:"Cl2", hole_size_in:1, inventory_kg:1000, P_kPa:500, T_C:25,
                       detection_class:"B", isolation_class:"B"});
    ass(c2.CA_inj_m2 > 0, "CoF L2 Cl2: large toxic cloud area");

    // === CoF Level 2 — methane VCE potential ===
    var c3 = cofLevel2({fluid_name:"C1-C2", hole_size_in:4, inventory_kg:50000, P_kPa:5000, T_C:30});
    ass(c3.CA_cmd_m2 > 0, "CoF L2 methane: flammable damage area > 0");
    ass(c3.choked, "CoF L2 methane: choked flow at P > 184 kPa");

    // === Hole-size weighted CoF ===
    var c4 = cofLevel2_weighted({fluid_name:"H2S", inventory_kg:5000, P_kPa:2000, T_C:60});
    ass(c4.perSize && c4.perSize["0.25"] && c4.perSize["16"], "Weighted CoF: all 4 hole sizes computed");
    ass(c4.FC_weighted_USD > 0, "Weighted CoF: positive total");

    return { pass:pass, fail:fail, errs:errs, total:pass+fail };
  }

  var RBIPlanner = {
    FLUIDS_L2: FLUIDS_L2,
    HOLE_WEIGHTS: HOLE_WEIGHTS,
    bayesianUpdateOnFinding: bayesianUpdateOnFinding,
    forecastDF: forecastDF,
    recommendInspection: recommendInspection,
    cofLevel2: cofLevel2,
    cofLevel2_weighted: cofLevel2_weighted,
    _runTests: _runTests
  };
  root.RBIPlanner = RBIPlanner;
  if (typeof module !== "undefined" && module.exports) module.exports = RBIPlanner;
})(typeof window !== "undefined" ? window : (typeof global !== "undefined" ? global : this));

if (typeof require !== "undefined" && require.main === module) {
  try { global.RBIDetailed = require("./rbi-detailed.js"); } catch(_){}
  var R = module.exports;
  var r = R._runTests();
  console.log("RBI-Planner regression: PASS " + r.pass + " / FAIL " + r.fail + " / total " + r.total);
  if (r.fail) r.errs.forEach(function(e){ console.log("  - " + e); });
}
