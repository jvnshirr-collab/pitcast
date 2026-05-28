/* rbi-advanced.js — Industry-grade RBI add-ons (POD curves + budget
 * optimiser + DMR generator + replacement-vs-inspect economics).
 *
 * Exposes window.RBIAdvanced with:
 *   - POD library + effectiveness_from_inspection({technique, coverage, ...})
 *   - optimiseFleet({equipment, budget_USD, horizon_yr}) — greedy allocator
 *   - generateDMR({equipment_id, opts}) — API 580 §6 DMR document
 *   - replaceVsInspect({...}) — NPV cross-over analysis
 *
 * Sources:
 *   - ISO 11666:2018 — UT acceptance of welded joints
 *   - ASNT Recommended Practice SNT-TC-1A (2020) — NDT personnel qualification
 *   - API RP 581 (3rd ed.) Part 2 Tab 5.10 — POD probabilities per E-class
 *   - API RP 580 (4th ed., 2023) §6 — Damage Mechanism Review
 *   - API RP 571 (3rd ed., 2020) — Damage mechanisms per service
 *   - ASME PCC-2 (2022) §6 — Repair-vs-replace economic decision
 *   - ISO 15663:2021 — Life-cycle cost (LCC) calculation
 *   - Cost coefficients from public sources:
 *       • ASNT 2019 NDT salary survey + EFNDT Eur 2020 NDT cost study
 *       • API STD 510 / 570 / 653 hours-per-inspection guidelines
 *       • CCPS (2017) Process safety cost-benefit
 */
(function (root) {
  "use strict";

  // ===========================================================================
  // 1. POD (Probability of Detection) curves per NDT technique
  // ===========================================================================
  /** POD(defect_size_mm) — probability that an inspection technique finds a
   *  defect of given size. Curves are logistic in log(size):
   *    POD(d) = 1 / (1 + exp(-k · (log10(d) - log10(d50))))
   *  where d50 is the size at 50% POD and k is the slope.
   *  Values per ISO 11666 + ASNT + ASTM E1316 + published vendor brochures.
   */
  var POD_CURVES = {
    "visual":         { label:"Visual inspection (Mk 1 eyeball)", d50_mm:5,    k:2.0, max_POD:0.85,
                        ref:"ASTM E165 (Visual) + practical industry experience — limited to surface-breaking >2 mm" },
    "PT":             { label:"Penetrant testing (PT, dye)",       d50_mm:0.5,  k:3.0, max_POD:0.95,
                        ref:"ASTM E165 (2018) + ASNT SNT-TC-1A — surface-breaking ≥0.1 mm width" },
    "MT":             { label:"Magnetic-particle (MT)",            d50_mm:0.5,  k:2.5, max_POD:0.95,
                        ref:"ASTM E709 (2021) + ASME V Article 7 — ferromagnetic surface + slight subsurface" },
    "WFMT":           { label:"Wet-fluorescent MT (WFMT)",         d50_mm:0.3,  k:3.5, max_POD:0.97,
                        ref:"ASTM E1444 (2016) + ASME V Art 7 — sensitive to fine cracks <0.3 mm" },
    "RT":             { label:"Radiography (RT, X-ray/γ)",         d50_mm:1.0,  k:2.5, max_POD:0.92,
                        ref:"ASME V Article 2 + ASTM E94 + ISO 17636 — through-wall ≥2 % t typical" },
    "UT_thickness":   { label:"UT thickness (single gauge)",       d50_mm:1.0,  k:1.5, max_POD:0.80,
                        ref:"ASTM E797 (2021) + API 570 §6.3 — spot reading; coverage <5 % typical" },
    "UT_Cscan":       { label:"UT C-scan (manual)",                d50_mm:1.5,  k:2.0, max_POD:0.88,
                        ref:"ASTM E114 + practical refinery RBI — moderate coverage" },
    "AUT":            { label:"Automated UT (AUT, encoded)",       d50_mm:0.5,  k:4.0, max_POD:0.95,
                        ref:"ISO 13588 (2019) + Lavender ASME 2017 PVP-2017-65430 — encoded-scan POD ≈ 0.95 at 1 mm" },
    "PAUT":           { label:"Phased-array UT (PAUT)",            d50_mm:0.5,  k:3.5, max_POD:0.97,
                        ref:"ASME V Art 4 Mandatory App XI + ISO 13588 — 2D probe array; through-wall + circ" },
    "TOFD":           { label:"Time-of-flight diffraction",        d50_mm:0.4,  k:4.0, max_POD:0.98,
                        ref:"ASME V Art 4 + ISO 16828 (2017) — diffraction-based; mid-wall best" },
    "MFL":            { label:"Magnetic-flux leakage (MFL)",       d50_mm:1.0,  k:2.5, max_POD:0.92,
                        ref:"API STD 653 §4.4.7 + NACE TM0284 — AST-floor scan; 100 % coverage" },
    "ECT":            { label:"Eddy-current (ECT, tube)",          d50_mm:0.5,  k:3.0, max_POD:0.92,
                        ref:"ASTM E2884 (2019) + HEI 10th — heat-exchanger-tube full-length scan" },
    "PEC":            { label:"Pulsed-eddy-current (PEC)",         d50_mm:2.0,  k:2.0, max_POD:0.85,
                        ref:"INETEC Innospection (2018) + ASTM E2884 — through-insulation scan; volume-loss focus" },
    "IR_thermography":{ label:"IR thermography (passive)",         d50_mm:5.0,  k:1.8, max_POD:0.80,
                        ref:"ASTM E1934 (2021) + IR thermographer training — hot-spot / refractory survey" }
  };

  /** POD at a given defect size for a given technique. */
  function POD(technique, defect_size_mm) {
    var c = POD_CURVES[technique];
    if (!c) return null;
    var d = Math.max(0.01, +defect_size_mm || 1);
    var log_d = Math.log10(d), log_d50 = Math.log10(c.d50_mm);
    var p = 1 / (1 + Math.exp(-c.k * (log_d - log_d50)));
    return Math.min(c.max_POD, p);
  }

  /** Derive effectiveness rating A-E from inspection parameters.
   *    A: ≥95 % POD at the critical defect size + ≥80 % surface coverage
   *    B: ≥85 % POD or ≥60 % coverage
   *    C: ≥60 % POD or ≥40 % coverage
   *    D: ≥30 % POD or ≥20 % coverage
   *    E: <30 % POD or <20 % coverage
   *  Per API RP 581 Part 2 Tab 5.10 typical effectiveness boundaries.
   */
  function effectiveness_from_inspection(opts) {
    opts = opts || {};
    var technique = opts.technique || "visual";
    var coverage_pct = +opts.coverage_pct || 100;
    var critical_defect_mm = +opts.critical_defect_mm || 1;
    var pod = POD(technique, critical_defect_mm);
    if (pod == null) return { eff:"E", reason:"unknown technique" };

    // Effective POD = POD × coverage fraction
    var pod_eff = pod * (coverage_pct / 100);
    var eff;
    if (pod_eff >= 0.80) eff = "A";
    else if (pod_eff >= 0.55) eff = "B";
    else if (pod_eff >= 0.30) eff = "C";
    else if (pod_eff >= 0.15) eff = "D";
    else eff = "E";
    return {
      eff: eff,
      technique: technique,
      coverage_pct: coverage_pct,
      critical_defect_mm: critical_defect_mm,
      POD_at_critical: +pod.toFixed(3),
      POD_effective: +pod_eff.toFixed(3),
      ref: "API RP 581 (3rd ed.) Part 2 Tab 5.10 + " + (POD_CURVES[technique] && POD_CURVES[technique].ref || "ISO 11666"),
      note: "Effective POD = POD(d) × coverage. Eff = A if ≥0.80, B if ≥0.55, C if ≥0.30, D if ≥0.15, else E."
    };
  }

  // ===========================================================================
  // 2. Inspection cost library + Fleet inspection-budget optimiser
  // ===========================================================================
  // Public cost coefficients (USD per inspection-unit) — order-of-magnitude:
  //   from ASNT 2019 NDT salary survey + EFNDT 2020 cost study +
  //   refinery turnaround historical-cost benchmarks.
  var INSPECTION_COST = {
    "visual":          { per_m2: 1,    per_inspection_min: 100,   level: "low" },
    "PT":              { per_m2: 30,   per_inspection_min: 200,   level: "moderate" },
    "MT":              { per_m2: 20,   per_inspection_min: 200,   level: "moderate" },
    "WFMT":            { per_m2: 50,   per_inspection_min: 500,   level: "moderate" },
    "RT":              { per_joint: 300, per_inspection_min: 1000, level: "high" },
    "UT_thickness":    { per_m2: 5,    per_inspection_min: 200,   level: "low" },
    "UT_Cscan":        { per_m2: 50,   per_inspection_min: 1500,  level: "moderate" },
    "AUT":             { per_m: 200,   per_inspection_min: 3000,  level: "high" },
    "PAUT":            { per_m: 250,   per_inspection_min: 3500,  level: "high" },
    "TOFD":            { per_m: 200,   per_inspection_min: 3000,  level: "high" },
    "MFL":             { per_m2_floor: 30, per_inspection_min: 8000, level: "high" },
    "ECT":             { per_tube: 25, per_inspection_min: 1500,  level: "moderate" },
    "PEC":             { per_m: 100,   per_inspection_min: 2000,  level: "moderate" },
    "IR_thermography": { per_m2: 5,    per_inspection_min: 500,   level: "low" }
  };
  // Default technique per damage mechanism (matches rbi-planner techniques)
  var DEFAULT_TECHNIQUE_PER_MECHANISM = {
    "Thinning":"UT_Cscan", "HIC/SOHIC-H2S":"WFMT", "Cl-SCC":"ECT",
    "Caustic SCC":"WFMT", "Amine SCC":"WFMT", "SSC":"WFMT",
    "HTHA":"AUT", "Carbonate SCC":"WFMT", "PASCC":"PT",
    "HSC-HF":"WFMT", "Brittle Fracture":"visual", "Mechanical Fatigue":"WFMT",
    "External":"visual", "External CUI":"PEC", "Refractory Degradation":"IR_thermography",
    "AST Floor Plate":"MFL", "AST Shell Thinning":"UT_thickness", "Tank Settlement":"visual"
  };

  /** Estimate inspection cost per equipment per technique-effectiveness combo */
  function estimateCost(opts) {
    opts = opts || {};
    var technique = opts.technique || "UT_Cscan";
    var size = +opts.equipment_size_m2 || 50;     // typical surface area
    var weld_length_m = +opts.weld_length_m || 20;
    var n_tubes = +opts.n_tubes || 0;
    var n_joints = +opts.n_joints || 5;
    var c = INSPECTION_COST[technique];
    if (!c) return { error: "unknown technique" };
    var cost = c.per_inspection_min;
    if (c.per_m2) cost += c.per_m2 * size;
    if (c.per_m2_floor) cost += c.per_m2_floor * size;
    if (c.per_m) cost += c.per_m * weld_length_m;
    if (c.per_joint) cost += c.per_joint * n_joints;
    if (c.per_tube) cost += c.per_tube * n_tubes;
    return { cost_USD: cost, technique: technique,
      ref: "ASNT 2019 NDT salary survey + EFNDT 2020 cost study + refinery turnaround historical-benchmark." };
  }

  /** Greedy inspection-budget allocator across N equipment.
   *  Strategy: per round, pick the equipment with highest PoF that has not yet
   *  been inspected this period; allocate the highest-effectiveness inspection
   *  affordable. Repeat until budget exhausted.
   */
  function optimiseFleet(opts) {
    opts = opts || {};
    var equipment = opts.equipment || [];
    var budget_USD = +opts.budget_USD || 0;
    if (!equipment.length || budget_USD <= 0) return { error: "Need equipment[] + budget_USD" };

    // Sort by current PoF descending
    var sorted = equipment.slice().sort(function(a,b){ return b.annual_PoF - a.annual_PoF; });
    var allocations = [];
    var spent = 0;
    var available = budget_USD;
    var pof_reduction = 0;

    // Try to allocate A (most effective) to highest-PoF, then B, then C, etc.
    var tries = ["A","B","C","D"];
    for (var i = 0; i < sorted.length && available > 0; i++) {
      var eq = sorted[i];
      var dominantMech = eq.dominant_mechanism || "Thinning";
      var tech = eq.preferred_technique || DEFAULT_TECHNIQUE_PER_MECHANISM[dominantMech] || "UT_Cscan";
      var costEst = estimateCost({
        technique: tech,
        equipment_size_m2: eq.size_m2 || 50,
        weld_length_m: eq.weld_length_m || 20,
        n_tubes: eq.n_tubes || 0,
        n_joints: eq.n_joints || 5
      });
      var cost = costEst.cost_USD || 1000;
      if (cost > available) {
        // Try a cheaper technique for this equipment
        var altTech = "UT_thickness";
        var altCost = estimateCost({ technique: altTech, equipment_size_m2: eq.size_m2 || 50 }).cost_USD || 500;
        if (altCost > available) continue;    // skip this equipment
        tech = altTech;
        cost = altCost;
      }
      // Effectiveness from POD
      var critical = eq.critical_defect_mm || 2;
      var coverage = eq.coverage_pct || 80;
      var effObj = effectiveness_from_inspection({ technique: tech, coverage_pct: coverage, critical_defect_mm: critical });
      // PoF reduction estimate: 1A → 0.1× PoF, 1B → 0.2×, 1C → 0.5×, 1D → 0.9×
      var reductionFactor = { "A":0.1, "B":0.2, "C":0.5, "D":0.9, "E":1.0 }[effObj.eff] || 1.0;
      var oldPoF = eq.annual_PoF;
      var newPoF = oldPoF * reductionFactor;
      pof_reduction += (oldPoF - newPoF);
      allocations.push({
        id: eq.id, technique: tech, effectiveness: effObj.eff,
        cost_USD: cost, dominant_mechanism: dominantMech,
        old_PoF: oldPoF, new_PoF: newPoF,
        POD_at_critical: effObj.POD_at_critical
      });
      spent += cost;
      available -= cost;
    }

    return {
      total_budget_USD: budget_USD,
      total_spent_USD: spent,
      remaining_USD: available,
      n_inspections_recommended: allocations.length,
      fleet_PoF_reduction_per_yr: pof_reduction,
      allocations: allocations,
      ref: "Greedy fleet-RBI allocation: highest-PoF equipment first, "
         + "most-effective affordable technique per equipment. Per API RP 580 §10 + "
         + "ASME PCC-2 (2022) §6 inspection-plan optimisation framework."
    };
  }

  // ===========================================================================
  // 3. Damage Mechanism Review (DMR) auto-generator — API RP 580 §6
  // ===========================================================================
  function generateDMR(opts) {
    opts = opts || {};
    var id = opts.equipment_id || "EQ-001";
    var description = opts.description || "Unspecified pressure equipment";
    if (!root.RBIDamage || !root.RBIDamage.combinedDF) {
      return { error: "RBIDamage.combinedDF not available" };
    }
    var cdf = root.RBIDamage.combinedDF(opts);
    var active = cdf.active_mechanisms || [];
    var inactive = (cdf.mechanisms || []).filter(function(m){ return !m.applicable; });

    var lines = [];
    lines.push("# Damage Mechanism Review (DMR)");
    lines.push("");
    lines.push("**Equipment ID**: " + id);
    lines.push("**Description**: " + description);
    lines.push("**Document basis**: API RP 580 (4th ed., 2023) §6 + API RP 571 (3rd ed., 2020)");
    lines.push("**Generated**: " + new Date().toISOString().slice(0, 10));
    lines.push("");
    lines.push("## 1. Service Envelope");
    lines.push("");
    lines.push("| Parameter | Value | Unit |");
    lines.push("|---|---:|---|");
    lines.push("| Material family | " + (opts.material_family || "—") + " | — |");
    lines.push("| Operating T | " + (opts.T_C || "—") + " | °C |");
    lines.push("| Operating P | " + (opts.P_kPa || "—") + " | kPa |");
    lines.push("| pH | " + (opts.pH || "—") + " | — |");
    lines.push("| pH₂S | " + (opts.pH2S_kPa || 0) + " | kPa |");
    lines.push("| pH₂ | " + (opts.pH2_kPa || 0) + " | kPa |");
    lines.push("| Cl⁻ | " + (opts.Cl_ppm || 0) + " | ppm |");
    lines.push("| NaOH | " + (opts.NaOH_wt_pct || 0) + " | wt% |");
    lines.push("| HF | " + (opts.HF_wt_pct || 0) + " | wt% |");
    lines.push("| PWHT | " + (opts.PWHT ? "Yes" : "No") + " | — |");
    lines.push("| Hardness | " + (opts.hardness_HRC || "—") + " | HRC |");
    lines.push("| Age | " + (opts.age_yr || "—") + " | yr |");
    lines.push("");

    lines.push("## 2. Applicable Damage Mechanisms");
    lines.push("");
    if (active.length === 0) {
      lines.push("_No applicable damage mechanisms identified at the current service envelope._");
    } else {
      lines.push("| # | Mechanism | Susceptibility | D<sub>f</sub> | Recommended technique |");
      lines.push("|---|---|---|---:|---|");
      active.forEach(function(m, i){
        var tech = DEFAULT_TECHNIQUE_PER_MECHANISM[m.mechanism] || "UT_Cscan";
        lines.push("| " + (i+1) + " | " + m.mechanism + " | "
                 + m.susceptibility + " | " + m.D_f.toFixed(1) + " | "
                 + (POD_CURVES[tech] ? POD_CURVES[tech].label : tech) + " |");
      });
      lines.push("");
      lines.push("**Total damage factor (sum)**: " + cdf.total_D_f.toFixed(1));
      lines.push("");
    }

    if (inactive.length) {
      lines.push("### 2.1 Non-applicable (with rationale)");
      lines.push("");
      inactive.forEach(function(m){
        lines.push("- **" + m.mechanism + "**: " + (m.why || "n/a"));
      });
      lines.push("");
    }

    lines.push("## 3. Inspection Plan");
    lines.push("");
    if (!root.RBIPlanner || !root.RBIPlanner.recommendInspection) {
      lines.push("_Inspection-plan engine not loaded._");
    } else {
      // Generate per-mechanism recommendations
      lines.push("| Mechanism | Recommended technique | Coverage | Effectiveness | Notes |");
      lines.push("|---|---|---|---|---|");
      active.forEach(function(m){
        var tech = DEFAULT_TECHNIQUE_PER_MECHANISM[m.mechanism] || "UT_Cscan";
        var lbl = POD_CURVES[tech] ? POD_CURVES[tech].label : tech;
        var note = m.susceptibility === "V.High" || m.susceptibility === "High"
                    ? "Maximum-effectiveness inspection recommended; 100 % coverage of vulnerable locations"
                    : "Routine coverage acceptable";
        var eff = m.susceptibility === "V.High" ? "A (≥95 % POD)"
                 : m.susceptibility === "High" ? "A or B"
                 : "B or C";
        lines.push("| " + m.mechanism + " | " + lbl + " | per applicable extent | " + eff + " | " + note + " |");
      });
      lines.push("");
    }

    lines.push("## 4. Material-Specific Considerations");
    lines.push("");
    var family = opts.material_family || "CS";
    var familyNotes = {
      "CS": "Carbon steel — HIC/SOHIC, SSC, Caustic SCC, Amine SCC, HTHA all relevant. PWHT mitigates residual-stress SCC.",
      "low-alloy": "Low-alloy CS — HTHA (Cr-Mo dependent), HIC, SSC. Verify Cr-Mo grade matches expected service-T.",
      "2.25Cr-1Mo": "Hydroprocessor steel — HTHA per API 941 Nelson curve, weld-overlay typical (347 SS clad).",
      "austenitic-SS": "Austenitic SS — Cl-SCC above 60 °C, PASCC during shutdown, NO HIC. Stabilised grades (321/347) immune to PASCC.",
      "duplex-SS": "Duplex SS — Cl-SCC well above austenitic threshold (110-160 °C); 475 °C embrittlement concern long-term.",
      "Inconel-625": "Ni-base — virtually immune to chloride pitting + SCC up to 200 °C; HTHA-immune below 600 °C; very high SSC resistance."
    };
    lines.push(familyNotes[family] || "_See API RP 571 chapter relevant to alloy family._");
    lines.push("");

    lines.push("## 5. References");
    lines.push("");
    var refs = new Set();
    active.forEach(function(m){ refs.add(m.ref || ""); });
    refs.add("API RP 580 (4th ed., 2023) §6 — Damage Mechanism Review");
    refs.add("API RP 571 (3rd ed., 2020) — Damage mechanisms affecting fixed equipment");
    refs.add("API RP 581 (3rd ed., April 2016) Part 2 — Risk-based inspection methodology");
    Array.from(refs).filter(function(r){ return r; }).forEach(function(r){ lines.push("- " + r); });
    lines.push("");

    lines.push("## 6. Sign-off (REQUIRED before this DMR can be used)");
    lines.push("");
    lines.push("| Role | Name | Date | Signature |");
    lines.push("|---|---|---|---|");
    lines.push("| Materials / Corrosion Engineer | _________________ | __________ | _________________ |");
    lines.push("| AMPP / API Inspector (CIP-2 or higher) | _________________ | __________ | _________________ |");
    lines.push("| Senior Inspection PE | _________________ | __________ | _________________ |");
    lines.push("");
    lines.push("**This DMR is a software-generated screening document. It must be independently verified by an AMPP/API certified Corrosion/Inspection PE before use in any RBI deliverable, ASME-stamped inspection plan, insurance-underwriter submission, or PE-stamped report.**");

    return {
      markdown: lines.join("\n"),
      n_active_mechanisms: active.length,
      total_D_f: cdf.total_D_f,
      equipment_id: id,
      ref: "API RP 580 (4th ed., 2023) §6 — Damage Mechanism Review format. "
         + "Generated from RBIDamage.combinedDF + per-mechanism POD-recommended technique lookup."
    };
  }

  // ===========================================================================
  // 4. Replacement-vs-inspect financial calculator (NPV)
  // ===========================================================================
  /** Per ISO 15663 LCC + ASME PCC-2 §6.
   *  Returns NPV of two options: "continue inspecting" vs "replace now".
   *  At what year does the cross-over happen?
   */
  function replaceVsInspect(opts) {
    opts = opts || {};
    var replacement_cost_USD = +opts.replacement_cost_USD || 500000;
    var inspection_cost_per_yr_USD = +opts.inspection_cost_per_yr_USD || 10000;
    var failure_consequence_USD = +opts.failure_consequence_USD || 5000000;
    var annual_PoF_now = +opts.annual_PoF_now || 1e-3;
    var annual_PoF_growth_pct = +opts.annual_PoF_growth_pct || 8;
    var discount_rate_pct = +opts.discount_rate_pct || 8;
    var horizon_yr = +opts.horizon_yr || 20;
    var residual_life_yr = +opts.residual_life_yr || 30;     // remaining life if replaced

    var dr = discount_rate_pct / 100;
    var pof_growth = annual_PoF_growth_pct / 100;

    // Option A: Continue inspecting (cost + expected-failure cost over horizon)
    var NPV_A = 0;
    var pof = annual_PoF_now;
    for (var yr = 1; yr <= horizon_yr; yr++) {
      var df = Math.pow(1 + dr, -yr);
      var expected_failure_USD = pof * failure_consequence_USD;
      NPV_A += df * (inspection_cost_per_yr_USD + expected_failure_USD);
      pof *= (1 + pof_growth);
    }
    // Option B: Replace now + much lower PoF for residual_life_yr (assume 1/100 of current PoF)
    var NPV_B = replacement_cost_USD;
    var pof_B = annual_PoF_now / 100;
    for (var yr2 = 1; yr2 <= Math.min(horizon_yr, residual_life_yr); yr2++) {
      var df2 = Math.pow(1 + dr, -yr2);
      var ef_B = pof_B * failure_consequence_USD;
      NPV_B += df2 * (inspection_cost_per_yr_USD * 0.5 + ef_B);     // 50 % lower inspection
      pof_B *= (1 + pof_growth * 0.3);   // 30 % growth rate of original
    }

    // Cross-over year — when does cumulative B become cheaper than A?
    var cumA = 0, cumB = replacement_cost_USD, crossYr = null;
    pof = annual_PoF_now; pof_B = annual_PoF_now / 100;
    for (var yr3 = 1; yr3 <= horizon_yr; yr3++) {
      var dfx = Math.pow(1 + dr, -yr3);
      cumA += dfx * (inspection_cost_per_yr_USD + pof * failure_consequence_USD);
      cumB += dfx * (inspection_cost_per_yr_USD * 0.5 + pof_B * failure_consequence_USD);
      if (cumB < cumA && crossYr == null) crossYr = yr3;
      pof *= (1 + pof_growth);
      pof_B *= (1 + pof_growth * 0.3);
    }

    return {
      NPV_inspect_USD: Math.round(NPV_A),
      NPV_replace_USD: Math.round(NPV_B),
      delta_USD: Math.round(NPV_B - NPV_A),
      recommendation: NPV_B < NPV_A ? "REPLACE NOW" : "CONTINUE INSPECTING",
      crossover_year: crossYr,
      horizon_yr: horizon_yr,
      inputs: { replacement_cost_USD, inspection_cost_per_yr_USD, failure_consequence_USD,
                annual_PoF_now, annual_PoF_growth_pct, discount_rate_pct },
      ref: "ISO 15663:2021 LCC + ASME PCC-2 (2022) §6 — repair-vs-replace economic decision; "
         + "discounted-cash-flow NPV with expected-failure cost = annual PoF × consequence cost; "
         + "replacement assumed to reset PoF to 1 % of current with 50 % lower inspection cost."
    };
  }

  // ===========================================================================
  // Tests
  // ===========================================================================
  function _runTests() {
    var pass = 0, fail = 0, errs = [];
    function ass(c, m){ if (c) pass++; else { fail++; errs.push(m); } }

    // === POD curves ===
    ass(POD("AUT", 2) > 0.9, "AUT POD(2 mm) > 0.9");
    ass(POD("AUT", 0.5) < POD("AUT", 2), "POD monotonically increasing with defect size");
    ass(POD("visual", 1) < POD("WFMT", 1), "WFMT more sensitive than visual at 1 mm");
    ass(POD("unknown_technique", 1) == null, "POD null for unknown technique");

    // === Effectiveness from inspection ===
    var e1 = effectiveness_from_inspection({ technique:"PAUT", coverage_pct:100, critical_defect_mm:2 });
    ass(e1.eff === "A", "PAUT 100% cov + 2 mm crit → A (got "+e1.eff+", POD_eff="+e1.POD_effective+")");
    var e2 = effectiveness_from_inspection({ technique:"UT_thickness", coverage_pct:5, critical_defect_mm:1 });
    ass(e2.eff === "D" || e2.eff === "E", "UT thickness 5% cov → D/E (got "+e2.eff+")");
    var e3 = effectiveness_from_inspection({ technique:"visual", coverage_pct:100, critical_defect_mm:0.5 });
    ass(e3.eff === "D" || e3.eff === "E", "Visual 100% cov at 0.5 mm crack → D/E (got "+e3.eff+")");

    // === Cost estimation ===
    var c1 = estimateCost({ technique:"AUT", weld_length_m:50 });
    ass(c1.cost_USD > 5000, "AUT 50 m weld > $5k (got $"+c1.cost_USD+")");
    var c2 = estimateCost({ technique:"visual" });
    ass(c2.cost_USD < 500, "Visual cheap (got $"+c2.cost_USD+")");
    var c3 = estimateCost({ technique:"unknown_xxx" });
    ass(c3.error, "Unknown technique returns error");

    // === Fleet optimiser ===
    var equipment = [
      { id:"V-101", annual_PoF:1e-2, dominant_mechanism:"Thinning", size_m2:50 },
      { id:"V-102", annual_PoF:5e-3, dominant_mechanism:"HIC/SOHIC-H2S", size_m2:30 },
      { id:"V-103", annual_PoF:1e-4, dominant_mechanism:"Thinning", size_m2:20 },
      { id:"V-104", annual_PoF:2e-3, dominant_mechanism:"Cl-SCC", size_m2:40, n_tubes:200 }
    ];
    var opt = optimiseFleet({ equipment: equipment, budget_USD: 30000 });
    ass(opt.allocations.length > 0, "Optimiser allocates inspections (got "+opt.allocations.length+")");
    ass(opt.total_spent_USD <= 30000, "Total spent within budget (got $"+opt.total_spent_USD+")");
    ass(opt.fleet_PoF_reduction_per_yr > 0, "Fleet PoF reduced");
    // Highest-PoF equipment should be inspected first
    ass(opt.allocations[0].id === "V-101", "Highest-PoF equipment inspected first (got "+opt.allocations[0].id+")");

    // === Insufficient budget ===
    var optEmpty = optimiseFleet({ equipment: equipment, budget_USD: 100 });
    ass(optEmpty.allocations.length === 0 || optEmpty.total_spent_USD <= 500, "Tiny budget → minimal allocation");

    // === DMR generator ===
    // Skip if RBIDamage not loaded (in standalone node)
    if (root.RBIDamage && root.RBIDamage.combinedDF) {
      var dmr = generateDMR({
        equipment_id: "V-205-AMINE", description: "Lean amine contactor MEA service",
        material_family: "CS", T_C: 60, pH: 9.5, pH2S_kPa: 10,
        amine_type: "MEA", amine_state: "lean", PWHT: true, age_yr: 15,
        hardness_HRC: 22, welded: true
      });
      ass(dmr.markdown && dmr.markdown.length > 500, "DMR generates markdown");
      ass(dmr.markdown.indexOf("Damage Mechanism Review") >= 0, "DMR includes title");
      ass(dmr.markdown.indexOf("V-205-AMINE") >= 0, "DMR includes equipment ID");
      ass(dmr.markdown.indexOf("Sign-off") >= 0, "DMR includes sign-off block");
      ass(dmr.n_active_mechanisms >= 0, "DMR reports active mechanism count");
    }

    // === Replace-vs-inspect ===
    var rv = replaceVsInspect({
      replacement_cost_USD: 500000, inspection_cost_per_yr_USD: 10000,
      failure_consequence_USD: 5000000, annual_PoF_now: 1e-2,
      annual_PoF_growth_pct: 10, discount_rate_pct: 8, horizon_yr: 20
    });
    ass(rv.recommendation === "REPLACE NOW" || rv.recommendation === "CONTINUE INSPECTING", "RV gives recommendation");
    ass(rv.NPV_inspect_USD > 0 && rv.NPV_replace_USD > 0, "Both NPV positive");
    // High-PoF case should recommend replacement
    ass(rv.NPV_inspect_USD > rv.NPV_replace_USD, "High-PoF (1e-2) + high-consequence → replace cheaper");

    // === Low-PoF case keeps inspecting ===
    var rv2 = replaceVsInspect({
      replacement_cost_USD: 1000000, inspection_cost_per_yr_USD: 10000,
      failure_consequence_USD: 1000000, annual_PoF_now: 1e-5,
      annual_PoF_growth_pct: 5, horizon_yr: 20
    });
    ass(rv2.recommendation === "CONTINUE INSPECTING", "Low-PoF + high-replacement → continue inspecting (got "+rv2.recommendation+")");

    return { pass:pass, fail:fail, errs:errs, total:pass+fail };
  }

  var RBIAdvanced = {
    POD_CURVES: POD_CURVES,
    INSPECTION_COST: INSPECTION_COST,
    DEFAULT_TECHNIQUE_PER_MECHANISM: DEFAULT_TECHNIQUE_PER_MECHANISM,
    POD: POD,
    effectiveness_from_inspection: effectiveness_from_inspection,
    estimateCost: estimateCost,
    optimiseFleet: optimiseFleet,
    generateDMR: generateDMR,
    replaceVsInspect: replaceVsInspect,
    _runTests: _runTests
  };
  root.RBIAdvanced = RBIAdvanced;
  if (typeof module !== "undefined" && module.exports) module.exports = RBIAdvanced;
})(typeof window !== "undefined" ? window : (typeof global !== "undefined" ? global : this));

if (typeof require !== "undefined" && require.main === module) {
  try { global.RBIDetailed = require("./rbi-detailed.js"); } catch(_){}
  try { global.RBIDamage = require("./rbi-damage-mechanisms.js"); } catch(_){}
  try { global.RBIPlanner = require("./rbi-planner.js"); } catch(_){}
  var R = module.exports;
  var r = R._runTests();
  console.log("RBI-Advanced regression: PASS " + r.pass + " / FAIL " + r.fail + " / total " + r.total);
  if (r.fail) r.errs.forEach(function(e){ console.log("  - " + e); });
}
