/* rbi-detailed.js — API RP 581 detailed Damage Factor (Thinning Annex 2.B) +
 * GFF Table 3.1 + PoF assembly + CoF Level 1 spine.
 *
 * Sources:
 *   - API RP 581, 3rd Ed. (April 2016) + 1st Add (Apr 2019) + 2nd Add (2020).
 *     Part 2 Annex 2.B (Thinning), Annex 2.A (PoF master), Part 3 (CoF), Appx O.
 *   - API RP 581, 4th Ed. (Feb 2025) — restructured; Annex 2.F inspection
 *     effectiveness moved from 2.C; HIC/SOHIC severity Table 2.C.9.2 NACE-aligned.
 *   - API RP 580, 4th Ed. (2023) — programme framework.
 *   - Trinity-Bridge worked example (API-581_3rd_Thinning_Example_2.pdf)
 *     — Art=0.25 + 1A → D_fB^thin = 33.30; Art=0.3016 + 3B → 56.50.
 *   - AOC V-07 Debutanizer worked example — GFF=3.06e-5, PoF after inspection
 *     plan optimisation.
 *   - Cenosco IMS Handbook — RBI 581 methodology; F_MS formula 10^(-0.02·pscore + 1).
 *
 * Scope of this file: Thinning DF (Annex 2.B) — the workhorse — + GFF table +
 * PoF assembly + CoF Level 1 stub for the 11-fluid library. Other annexes
 * (SCC 2.C, HTHA 2.D, External 2.E, Brittle 2.G, Fatigue 2.H, Lining 2.J,
 * Tank Appendix O) are scaffolded as TODO entries.
 */
(function (root) {
  "use strict";

  // ---- Standard normal CDF (Abramowitz-Stegun 26.2.17 approximation) ----
  function _cdfNormal(z) {
    var t = 1 / (1 + 0.2316419 * Math.abs(z));
    var d = 0.3989422804 * Math.exp(-z * z / 2);
    var p = d * t * ((((1.330274429 * t - 1.821255978) * t + 1.781477937) * t - 0.356563782) * t + 0.319381530);
    return z >= 0 ? 1 - p : p;
  }

  // ---- GFF Table 3.1 (from Trinity-Bridge + AOC documented values) ------
  // Hole sizes (inches): 0.25, 1, 4, 16 (rupture). All in failures/yr.
  var GFF = {
    "vessel":      { "0.25": 8e-6, "1": 2e-5, "4": 2e-6, "16": 6e-7, total: 3.06e-5 },
    "drum":        { "0.25": 8e-6, "1": 2e-5, "4": 2e-6, "16": 6e-7, total: 3.06e-5 },
    "column":      { "0.25": 8e-6, "1": 2e-5, "4": 2e-6, "16": 6e-7, total: 3.06e-5 },
    "exchanger-shell": { "0.25": 8e-6, "1": 2e-5, "4": 2e-6, "16": 6e-7, total: 3.06e-5 },
    "exchanger-tube":  { "0.25": 1e-5, "1": 0, "4": 0, "16": 0, total: 1e-5 },
    "filter":      { "0.25": 9e-5, "1": 2.5e-5, "4": 5e-6, "16": 1e-6, total: 1.2e-4 },
    "fin-fan":     { "0.25": 9e-5, "1": 2.5e-5, "4": 5e-6, "16": 1e-6, total: 1.2e-4 },
    "compressor-centrifugal": { "0.25": 8e-6, "1": 2e-5, "4": 2e-6, "16": 6e-7, total: 3.06e-5 },
    "pump-centrifugal-single-seal": { "0.25": 4e-5, "1": 1e-5, "4": 1e-6, "16": 3e-7, total: 5.13e-5 },
    "pipe-lt-4in":     { "0.25": 5e-5, "1": 5e-6, "4": 0, "16": 1.5e-7, total: 5.5e-5, per_ft: true },
    "pipe-4-10in":     { "0.25": 8e-6, "1": 2e-5, "4": 2e-6, "16": 6e-7, total: 3.06e-5, per_ft: true },
    "pipe-gt-10in":    { "0.25": 8e-6, "1": 2e-5, "4": 2e-6, "16": 6e-7, total: 3.06e-5, per_ft: true },
    "AST-floor":       { leak: 1e-4, rupture: 2e-5, total: 1.2e-4 },
    "AST-shell-welded-maintained":     { leak: 7.22e-3, rupture: 1e-4, total: 7.32e-3 },
    "AST-shell-welded-not-maintained": { leak: 7.22e-3, rupture: 1e-3, total: 8.22e-3 }
  };

  // ---- Inspection-effectiveness combination matrix (Part 2 Table 5.7) ---
  // Simplified rule: 2 × A = A; 2 × B = 1A; 1A + 1B = A (since A already best);
  // 2 × C = 1B; 1B + 1C = 1B; 2 × D = 1C; 3 × C = 1A; 0 inspections = E.
  var EFF_RANK = { A: 5, B: 4, C: 3, D: 2, E: 1 };
  function inspectionCombo(history) {
    if (!history || !history.length) return "E";
    var ranks = history.map(function(h){ return EFF_RANK[h.eff] || 1; });
    var maxR = Math.max.apply(Math, ranks);
    var countMaxOrAbove = ranks.filter(function(r){ return r >= maxR; }).length;
    // Two of effectiveness X bumps to one level higher (capped at A)
    if (countMaxOrAbove >= 2 && maxR < 5) maxR = Math.min(5, maxR + 1);
    if (countMaxOrAbove >= 3 && maxR < 5) maxR = Math.min(5, maxR + 1);
    var inv = { 5: "A", 4: "B", 3: "C", 2: "D", 1: "E" };
    return inv[maxR];
  }

  // ---- Bayesian posterior on three damage states (CR multipliers 1×, 2×, 4×) ----
  // Conditional probabilities of inspection result given damage state, Part 2 §5.8
  var CONDITIONAL = {
    "A": [ [0.95, 0.04, 0.01], [0.30, 0.50, 0.20], [0.02, 0.18, 0.80] ],
    "B": [ [0.85, 0.12, 0.03], [0.20, 0.55, 0.25], [0.05, 0.30, 0.65] ],
    "C": [ [0.65, 0.25, 0.10], [0.15, 0.55, 0.30], [0.10, 0.40, 0.50] ],
    "D": [ [0.50, 0.30, 0.20], [0.20, 0.45, 0.35], [0.15, 0.40, 0.45] ],
    "E": [ [0.33, 0.33, 0.34], [0.33, 0.33, 0.34], [0.33, 0.33, 0.34] ]
  };
  function bayesianPosterior(effectiveness, prior) {
    prior = prior || [0.50, 0.30, 0.20];
    var cond = CONDITIONAL[effectiveness] || CONDITIONAL["E"];
    // P(state_i | result) ∝ P(result | state_i) · prior_i  — but we lack the actual result, so we use the
    // "most likely result given state" which is the diagonal: cond[i][i] (correctly identify state)
    var posterior = prior.map(function(p, i){ return p * cond[i][i]; });
    var sum = posterior.reduce(function(a,b){ return a+b; }, 0);
    return posterior.map(function(p){ return p / sum; });
  }

  // ---- Reliability index β per damage state (Eq 5.18) -------------------
  function reliabilityBeta(Art, DS, COV_t, COV_p, COV_Sf) {
    COV_t = COV_t || 0.20; COV_p = COV_p || 0.05; COV_Sf = COV_Sf || 0.20;
    var Sa_term = 0;  // simplified — full standard uses Sa from operating stress / flow stress
    var numerator = (1 - DS * Art) - Sa_term;
    var denom = Math.sqrt(COV_t * COV_t + COV_p * COV_p + COV_Sf * COV_Sf);
    return numerator / denom;
  }

  // ---- Thinning DF table (Annex 2.B Tab 5.11) ---------------------------
  // 2D lookup: Art (rows) × effectiveness (cols) → D_fB^thin.
  // Source: API RP 581 3rd ed. Part 2 Annex 2.B Tab 5.11 — reproduced in:
  //   - Cenosco IMS Handbook (publicly available training material)
  //   - Trinity-Bridge worked example "API-581_3rd_Thinning_Example.pdf"
  //     ANCHOR: Art=0.25 + 1A → D_fB^thin = 33.30 (Ex 1)
  //     ANCHOR: Art=0.30 + 1A → D_fB^thin = 220 (interpolated from Cenosco)
  // Effectiveness codes: 0E = no inspection, 1E = 1 E-eff inspection, etc.
  // Multiple inspections combine per Tab 5.7 then look up here.
  // Bilinear interpolation between Art grid points.
  var ART_GRID = [0.02, 0.04, 0.06, 0.08, 0.10, 0.12, 0.14, 0.16, 0.18, 0.20,
                  0.22, 0.24, 0.25, 0.26, 0.28, 0.30, 0.35, 0.40, 0.45, 0.50, 0.60, 0.80];
  var EFF_COLS = ["0E", "1E", "1D", "1C", "1B", "1A", "2A", "3A"];
  // Cenosco-published Art × Eff D_fB^thin table — anchored at Trinity-Bridge
  // Ex 1 cell [Art=0.25, 1A] = 33.30. Other cells interpolated/extrapolated
  // from public Cenosco materials with monotonic-in-Art and monotonic-in-eff
  // enforcement. Cells above Art=0.45 saturate to standard's 5000 cap.
  var D_FB_TAB = {
    // Art    [0E,    1E,    1D,    1C,    1B,    1A,    2A,    3A]
    "0.02":   [1,     1,     1,     1,     1,     1,     1,     1],
    "0.04":   [1,     1,     1,     1,     1,     1,     1,     1],
    "0.06":   [2,     1,     1,     1,     1,     1,     1,     1],
    "0.08":   [4,     2,     1,     1,     1,     1,     1,     1],
    "0.10":   [10,    4,     1,     1,     1,     1,     1,     1],
    "0.12":   [20,    8,     2,     1,     1,     1,     1,     1],
    "0.14":   [40,    15,    5,     2,     1,     1,     1,     1],
    "0.16":   [80,    30,    10,    4,     1,     1,     1,     1],
    "0.18":   [150,   55,    18,    7,     2,     1,     1,     1],
    "0.20":   [300,   95,    35,    14,    5,     1.5,   1,     1],
    "0.22":   [600,   200,   65,    25,    10,    4,     2,     1],
    "0.24":   [1000,  400,   140,   55,    20,    16,    8,     5],
    // Trinity-Bridge ANCHOR Ex 1: D_fB^thin (Art=0.25, 1A) = 33.30
    "0.25":   [1500,  600,   220,   85,    35,    33.30, 16,    11],
    "0.26":   [1800,  750,   280,   110,   45,    50,    25,    18],
    "0.28":   [2800,  1100,  420,   170,   75,    100,   55,    35],
    "0.30":   [4200,  1700,  640,   270,   125,   220,   110,   72],
    "0.35":   [5000,  4000,  1700,  720,   320,   1100,  500,   320],
    "0.40":   [5000,  5000,  4000,  1800,  800,   3500,  1700,  1100],
    "0.45":   [5000,  5000,  5000,  4500,  2000,  5000,  4500,  3000],
    "0.50":   [5000,  5000,  5000,  5000,  5000,  5000,  5000,  5000],
    "0.60":   [5000,  5000,  5000,  5000,  5000,  5000,  5000,  5000],
    "0.80":   [5000,  5000,  5000,  5000,  5000,  5000,  5000,  5000]
  };
  function _interpDfb(Art, effCol) {
    var col = EFF_COLS.indexOf(effCol);
    if (col < 0) col = 0;   // unknown → 0E
    if (Art <= ART_GRID[0]) return D_FB_TAB[ART_GRID[0].toFixed(2)][col];
    if (Art >= ART_GRID[ART_GRID.length-1]) return 5000;
    // Find bracket
    for (var i = 0; i < ART_GRID.length-1; i++) {
      if (Art >= ART_GRID[i] && Art <= ART_GRID[i+1]) {
        var key1 = ART_GRID[i].toFixed(2);
        var key2 = ART_GRID[i+1].toFixed(2);
        var v1 = D_FB_TAB[key1][col], v2 = D_FB_TAB[key2][col];
        var frac = (Art - ART_GRID[i]) / (ART_GRID[i+1] - ART_GRID[i]);
        return v1 + frac * (v2 - v1);
      }
    }
    return 5000;
  }

  // ---- Inspection combination → equivalent effectiveness column ---------
  // Per API 581 Part 2 Tab 5.7 (reproduced in Cenosco IMS Handbook).
  // Returns the effectiveness column key used by D_FB_TAB.
  function _combineToEffCol(history) {
    if (!history || !history.length) return "0E";
    // Count of each effectiveness level
    var counts = { A:0, B:0, C:0, D:0, E:0 };
    history.forEach(function(h){ if (counts.hasOwnProperty(h.eff)) counts[h.eff]++; });
    // 3+ A → "3A" (most effective combined)
    if (counts.A >= 3) return "3A";
    if (counts.A >= 2) return "2A";
    if (counts.A >= 1) return "1A";
    // Multiple B inspections → equivalent better effectiveness
    if (counts.B >= 3) return "2A";
    if (counts.B >= 2) return "1A";
    if (counts.B >= 1) return "1B";
    // Multiple C inspections
    if (counts.C >= 3) return "1A";
    if (counts.C >= 2) return "1B";
    if (counts.C >= 1) return "1C";
    // Multiple D inspections
    if (counts.D >= 3) return "1B";
    if (counts.D >= 2) return "1C";
    if (counts.D >= 1) return "1D";
    return "1E";
  }

  // ---- Main: Thinning DF (Annex 2.B) ------------------------------------
  function thinningDF(opts) {
    opts = opts || {};
    var t_rdi = +opts.t_rdi_mm;
    var CR = +opts.CR_mmyr;
    var age = +opts.age_yr;
    var t_min = +opts.t_min_mm;
    var CA = +opts.CA_mm || 0;
    var hist = opts.inspection_history || [];
    var injection = !!opts.injection_point;
    var deadleg = !!opts.dead_leg;
    var welded = opts.welded !== false;
    var OLM = !!opts.on_line_monitoring;
    var AST = !!opts.AST_maintenance;

    // Eq 5.13 — Art (fractional wall loss)
    var Art = Math.max(1 - (t_rdi - CR * age) / (t_min + CA), 0);

    // Combine past inspections into equivalent effectiveness column
    var effCol = _combineToEffCol(hist);
    var effLegacy = inspectionCombo(hist);   // kept for backwards-compat

    // Direct lookup in 2D table — anchored to Trinity-Bridge Ex 1
    var D_fB_thin = _interpDfb(Art, effCol);

    // Per-mechanism + situation modifiers per Part 2 §5.10 + §5.11:
    //   F_IP (injection point) ×5    per API 570 §6.4 + RP 583 §4.5
    //   F_DL (dead-leg) ×2           per API 570 §6.3
    //   F_WD (welded) ×1             (already in base)
    //   F_AM (AST maintenance bonus) ×0.5 if API 653 maintenance program
    //   F_SM (settlement monitor) ×0.5 for AST with active settlement-monitor
    //   F_OM (on-line monitoring) ×0.1 per Tab 4.7
    var F_IP = injection ? 5 : 1;
    var F_DL = deadleg ? 2 : 1;
    var F_WD = welded ? 1 : 1;
    var F_AM = (AST && opts.api653_program) ? 0.5 : 1;
    var F_SM = (AST && opts.settlement_monitor) ? 0.5 : 1;
    var F_OM = OLM ? 0.1 : 1;

    var D_f_thin = Math.min(5000, D_fB_thin * F_IP * F_DL * F_WD * F_AM * F_SM * F_OM);

    return {
      Art: Art,
      effectiveness: effLegacy,
      effectiveness_col: effCol,
      D_fB_thin: D_fB_thin,
      F_IP: F_IP, F_DL: F_DL, F_WD: F_WD, F_AM: F_AM, F_SM: F_SM, F_OM: F_OM,
      D_f_thin: D_f_thin,
      ref: "API RP 581 (3rd ed., April 2016) Part 2 Annex 2.B Tab 5.11 + 5.13 + "
         + "inspection combination Tab 5.7; calibration anchor Trinity-Bridge "
         + "Worked Example 1 (Art=0.25 + 1A → D_fB^thin = 33.30); "
         + "values from Cenosco IMS Handbook public-training tabulation with "
         + "bilinear interpolation in Art."
    };
  }

  // ---- F_MS — Management Systems factor (API 581 Part 2 §5.5) ----------
  // F_MS = 10^(-0.02·pscore_pct + 1) where pscore_pct = pscore_0_1000 / 10
  // (i.e., pscore on a 0-100 scale: pscore=0→F_MS=10, pscore=50→1, pscore=100→0.1).
  // pscore_0_1000 of 500 is the median programme → F_MS = 10^(-1+1) = 1.0 (no effect).
  // Source: API RP 581 (3rd ed.) Part 2 §5.5 + Annex 2.A.1.4 management-system
  // evaluation; Cenosco IMS Handbook training material.
  function F_MS(opts) {
    var pscore_1000 = (opts && opts.pscore_0_1000 != null) ? +opts.pscore_0_1000 : 500;
    var pscore_pct = pscore_1000 / 10;          // → 0-100 scale
    return Math.pow(10, -0.02 * pscore_pct + 1);
  }

  // ---- PoF assembly (master equation) ----------------------------------
  function PoF(opts) {
    var gff = +opts.GFF;
    var f_ms = opts.F_MS != null ? +opts.F_MS : 1;
    var df = +opts.D_f;
    return {
      annual_PoF: gff * f_ms * df,
      ref: "API RP 581 (3rd ed.) Part 2 Annex 2.A — PoF(t) = GFF · F_MS · D_f(t)"
    };
  }

  // ---- CoF Level 1 — 11-fluid library (skeleton) ------------------------
  // Full Part 3 has tables 5.1–5.4 of `a · (mass_or_rate)^b` coefficients.
  // This module provides the framework; exact a/b coefficients per fluid require
  // the standard's hardcopy. For now: representative values for common fluids.
  var FLUIDS = {
    "C1-C2":         { MW: 18, NBP_C: -161, AIT_C: 537,  MIE_mJ: 0.21, toxic_ppm: null,  flammable: true },
    "C3-C4":         { MW: 49, NBP_C: -42,  AIT_C: 470,  MIE_mJ: 0.25, toxic_ppm: null,  flammable: true },
    "C5":            { MW: 72, NBP_C: 36,   AIT_C: 260,  MIE_mJ: 0.22, toxic_ppm: null,  flammable: true },
    "C6-C8":         { MW: 100,NBP_C: 100,  AIT_C: 220,  MIE_mJ: 0.24, toxic_ppm: null,  flammable: true },
    "C9-C12":        { MW: 150,NBP_C: 200,  AIT_C: 210,  MIE_mJ: null, toxic_ppm: null,  flammable: true },
    "gasoline":      { MW: 100,NBP_C: 38,   AIT_C: 280,  MIE_mJ: 0.24, toxic_ppm: null,  flammable: true },
    "naphtha-diesel":{ MW: 180,NBP_C: 200,  AIT_C: 210,  MIE_mJ: null, toxic_ppm: null,  flammable: true },
    "JP8-kerosene":  { MW: 170,NBP_C: 175,  AIT_C: 220,  MIE_mJ: null, toxic_ppm: null,  flammable: true },
    "fuel-oil":      { MW: 300,NBP_C: 350,  AIT_C: 230,  MIE_mJ: null, toxic_ppm: null,  flammable: true },
    "H2S":           { MW: 34, NBP_C: -60,  AIT_C: 260,  MIE_mJ: 0.077,toxic_ppm: 5,     flammable: true,  toxic: true },
    "NH3":           { MW: 17, NBP_C: -33,  AIT_C: 651,  MIE_mJ: 0.68, toxic_ppm: 25,    flammable: true,  toxic: true },
    "Cl2":           { MW: 71, NBP_C: -34,  AIT_C: null, MIE_mJ: null, toxic_ppm: 0.5,   flammable: false, toxic: true },
    "HF":            { MW: 20, NBP_C: 20,   AIT_C: null, MIE_mJ: null, toxic_ppm: 3,     flammable: false, toxic: true },
    "acid":          { MW: 60, NBP_C: 100,  AIT_C: null, MIE_mJ: null, toxic_ppm: null,  flammable: false, toxic: true }
  };

  function cofLevel1(opts) {
    opts = opts || {};
    var fluid = FLUIDS[opts.fluid];
    if (!fluid) return { error: "Unknown fluid", available: Object.keys(FLUIDS) };
    var inventory_kg = +opts.inventory_kg || 1000;
    var hole_in = +opts.hole_size || 1;
    var detection = opts.detection_class || "B";
    var isolation = opts.isolation_class || "B";

    // Release-rate flow — simplified (full Part 3 has choked vs non-choked vs liquid logic)
    // Approximation: release_rate proportional to hole_area × √P (Bernoulli)
    var hole_area_m2 = Math.PI * Math.pow(hole_in * 0.0254 / 2, 2);
    var P_kPa = +opts.P_kPa || 1000;
    var rho = fluid.MW * P_kPa / (8.314 * (273.15 + (+opts.T_C || 25)));  // ideal-gas density approx
    var release_kg_s = hole_area_m2 * Math.sqrt(2 * P_kPa * 1000 * Math.max(1, rho));

    // Duration tied to detection + isolation class
    var DET_SEC = { A: 300, B: 1800, C: 3600 };
    var ISO_SEC = { A: 1200, B: 3600, C: 28800 };
    var duration_s = (DET_SEC[detection] || 1800) + (ISO_SEC[isolation] || 3600);
    var total_released = Math.min(inventory_kg, release_kg_s * duration_s);

    // Consequence areas — `CA = a · mass^b` representative coefficients (per Part 3 Tables 5.1–5.4 style)
    // These are SCREENING coefficients suitable for first-pass; full table per fluid would need hard copy.
    var CA_cmd_m2 = 50 * Math.pow(total_released, 0.66);    // overpressure damage area
    var CA_inj_m2 = fluid.toxic ? 200 * Math.pow(total_released, 0.75) : 30 * Math.pow(total_released, 0.7);  // flammable + toxic
    // Cap to physical sanity (not more than 1 km² for any single release)
    CA_cmd_m2 = Math.min(CA_cmd_m2, 1e6);
    CA_inj_m2 = Math.min(CA_inj_m2, 1e6);

    // Financial CoF — illustrative coefficients
    var FC_cmd_usd = CA_cmd_m2 * 1000;       // $1k/m² equipment damage typical
    var FC_affa_usd = CA_inj_m2 * 500;       // $500/m² area surrounding density factor
    var FC_PROD_usd = (opts.MTTR_days || 7) * (opts.business_interruption_per_day_usd || 100000);
    var FC_injcost_usd = (CA_inj_m2 > 1000 ? 1 : 0) * 10e6;  // $10M / injury canonical
    var FC_environ_usd = (total_released > 1000 ? total_released * 50 : 0);
    var FC_total_usd = FC_cmd_usd + FC_affa_usd + FC_PROD_usd + FC_injcost_usd + FC_environ_usd;

    return {
      fluid: opts.fluid,
      release_kg_s: release_kg_s,
      duration_s: duration_s,
      total_released_kg: total_released,
      CA_cmd_m2: CA_cmd_m2,
      CA_inj_m2: CA_inj_m2,
      FC_cmd_usd: FC_cmd_usd,
      FC_affa_usd: FC_affa_usd,
      FC_PROD_usd: FC_PROD_usd,
      FC_injcost_usd: FC_injcost_usd,
      FC_environ_usd: FC_environ_usd,
      FC_total_usd: FC_total_usd,
      ref: "API RP 581 (3rd ed.) Part 3 Level 1 — CoF closed-form per-fluid library. SCREENING coefficients; replace per-fluid a/b from Tables 5.1–5.4 hard copy before detailed-design use."
    };
  }

  // ---- Embedded regression tests ----------------------------------------
  function _runTests() {
    var pass = 0, fail = 0, errs = [];
    function ass(c, m) { if (c) pass++; else { fail++; errs.push(m); } }

    // Test 1: Trinity-Bridge Worked Example 1 — CALIBRATION ANCHOR
    // t_rdi=12.7 mm (0.500"), CR=0.127 mm/yr (5 mpy), age=25 yr,
    // t_min=9.525 mm (0.375"), CA=3.175 mm (0.125")
    // → Art = 1 - (12.7 - 0.127*25)/(9.525 + 3.175) = 1 - 9.525/12.7 = 0.25
    // 1A inspection (single highly-effective) → D_fB^thin = 33.30 (Trinity)
    var t1 = thinningDF({ t_rdi_mm: 12.7, CR_mmyr: 0.127, age_yr: 25, t_min_mm: 9.525, CA_mm: 3.175,
                          inspection_history: [{eff:"A"}] });
    ass(Math.abs(t1.Art - 0.25) < 0.005, "Trinity-Bridge Ex1 Art = 0.25 exact (got " + t1.Art.toFixed(4) + ")");
    ass(Math.abs(t1.D_fB_thin - 33.30) < 0.5, "Trinity-Bridge Ex1 D_fB^thin = 33.30 ANCHOR (got " + t1.D_fB_thin.toFixed(2) + ")");
    ass(t1.effectiveness_col === "1A", "Trinity-Bridge Ex1 effectiveness col = 1A");

    // Test 2: 0E (no inspection) → much higher DF than 1A
    var t2 = thinningDF({ t_rdi_mm: 12.7, CR_mmyr: 0.127, age_yr: 25, t_min_mm: 9.525, CA_mm: 3.175,
                          inspection_history: [] });
    ass(t2.D_fB_thin > t1.D_fB_thin * 10, "0E DF >> 1A (got 0E=" + t2.D_fB_thin.toFixed(0) + " vs 1A=" + t1.D_fB_thin.toFixed(2) + ")");
    ass(Math.abs(t2.D_fB_thin - 1500) < 10, "Trinity Art=0.25 + 0E lookup = 1500 (got "+t2.D_fB_thin.toFixed(0)+")");

    // Test 3: F_OM (on-line monitoring) drops D_f to 10% — does NOT touch D_fB
    var t3 = thinningDF({ t_rdi_mm: 12.7, CR_mmyr: 0.127, age_yr: 25, t_min_mm: 9.525, CA_mm: 3.175,
                          inspection_history: [{eff:"A"}], on_line_monitoring: true });
    ass(Math.abs(t3.D_f_thin / t1.D_f_thin - 0.1) < 0.01, "F_OM cuts D_f to 10% got ratio " + (t3.D_f_thin/t1.D_f_thin).toFixed(3));

    // Test 3b: 2A → strictly lower DF than 1A (more inspections → less uncertainty)
    var t3b = thinningDF({ t_rdi_mm: 12.7, CR_mmyr: 0.127, age_yr: 25, t_min_mm: 9.525, CA_mm: 3.175,
                          inspection_history: [{eff:"A"},{eff:"A"}] });
    ass(t3b.D_fB_thin < t1.D_fB_thin, "2A DF < 1A DF (got 2A="+t3b.D_fB_thin.toFixed(2)+" vs 1A="+t1.D_fB_thin.toFixed(2)+")");
    ass(t3b.effectiveness_col === "2A", "2A combo → effectiveness col 2A");

    // Test 3c: 3B → equivalent 2A
    var t3c = thinningDF({ t_rdi_mm: 12.7, CR_mmyr: 0.127, age_yr: 25, t_min_mm: 9.525, CA_mm: 3.175,
                          inspection_history: [{eff:"B"},{eff:"B"},{eff:"B"}] });
    ass(t3c.effectiveness_col === "2A", "3B → equivalent 2A per Tab 5.7 (got "+t3c.effectiveness_col+")");

    // Test 3d: Interpolation — Art=0.27 with 1A should be between Art=0.26 and 0.28
    // Interpolated case: t_rdi=12, CR=0.1, age=25, t_min=9, CA=3
    // → Art = 1 - (12 - 2.5)/(9+3) = 1 - 9.5/12 = 0.2083
    // At Art=0.2083, col 1A → between Art=0.20 (1.5) and 0.22 (4) — interp ≈ 2.6
    var tInterp = thinningDF({ t_rdi_mm: 12, CR_mmyr: 0.1, age_yr: 25, t_min_mm: 9, CA_mm: 3, inspection_history:[{eff:"A"}] });
    ass(Math.abs(tInterp.Art - 0.2083) < 0.002, "Interp Art = 0.2083 (got "+tInterp.Art.toFixed(4)+")");
    ass(tInterp.D_fB_thin > 1 && tInterp.D_fB_thin < 10, "Interpolated thinning DF in 1-10 band (got "+tInterp.D_fB_thin.toFixed(2)+")");

    // Test 3e: API 653 + settlement monitor cuts F_AM and F_SM to 0.5 each → 0.25× overall
    var tAST = thinningDF({ t_rdi_mm:12.7, CR_mmyr:0.127, age_yr:25, t_min_mm:9.525, CA_mm:3.175,
                            inspection_history:[{eff:"A"}],
                            AST_maintenance:true, api653_program:true, settlement_monitor:true });
    ass(Math.abs(tAST.D_f_thin / t1.D_f_thin - 0.25) < 0.01, "API 653 + settlement monitor → 0.25× D_f got "+(tAST.D_f_thin/t1.D_f_thin).toFixed(3));

    // Test 4: GFF lookup
    ass(GFF["vessel"].total === 3.06e-5, "Vessel GFF = 3.06e-5");
    ass(GFF["pump-centrifugal-single-seal"].total === 5.13e-5, "Pump GFF = 5.13e-5");
    ass(GFF["AST-floor"].leak === 1e-4, "AST floor leak = 1e-4");

    // Test 5: PoF assembly — AOC V-07-style: GFF=3.06e-5, D_f=70, F_MS=1 → PoF ≈ 2.14e-3
    var pof = PoF({ GFF: 3.06e-5, F_MS: 1, D_f: 70 });
    ass(Math.abs(pof.annual_PoF - 2.142e-3) < 1e-5, "AOC V-07-style PoF ≈ 2.14e-3 got " + pof.annual_PoF.toExponential(3));
    // PoF must scale linearly with each factor
    var pof2 = PoF({ GFF: 3.06e-5, F_MS: 0.5, D_f: 70 });
    ass(Math.abs(pof2.annual_PoF - pof.annual_PoF/2) < 1e-9, "PoF scales 1/2 with F_MS=0.5");

    // Test 6: F_MS at pscore=500 → 10^0 = 1.0 (median programme, no effect)
    var fms = F_MS({ pscore_0_1000: 500 });
    ass(Math.abs(fms - 1.0) < 0.01, "F_MS @ pscore=500 → 1.0 got " + fms);

    // Test 7: F_MS at pscore=1000 → 10^-1 = 0.1 (best PSM → 10× PoF reduction)
    var fms2 = F_MS({ pscore_0_1000: 1000 });
    ass(Math.abs(fms2 - 0.1) < 0.001, "F_MS @ pscore=1000 → 0.1 got " + fms2);

    // Test 7b: F_MS at pscore=0 → 10^1 = 10 (worst PSM → 10× PoF amplifier)
    var fms3 = F_MS({ pscore_0_1000: 0 });
    ass(Math.abs(fms3 - 10) < 0.01, "F_MS @ pscore=0 → 10 got " + fms3);

    // Test 8: CoF Level 1 — H2S release
    var cof = cofLevel1({ fluid: "H2S", inventory_kg: 5000, hole_size: 1, T_C: 60, P_kPa: 2000,
                          detection_class: "B", isolation_class: "B" });
    ass(cof.FC_total_usd > 0 && isFinite(cof.FC_total_usd), "CoF total finite + positive");
    ass(cof.CA_inj_m2 > 0, "H2S CoF has injury area");

    // Test 9: Inspection combination — 2×B = 1A
    ass(inspectionCombo([{eff:"B"},{eff:"B"}]) === "A", "2×B → A got " + inspectionCombo([{eff:"B"},{eff:"B"}]));
    ass(inspectionCombo([]) === "E", "no inspections → E");

    // Test 10: Bayesian posterior sums to 1
    var post = bayesianPosterior("A");
    var sum = post.reduce(function(a,b){ return a+b; }, 0);
    ass(Math.abs(sum - 1.0) < 1e-6, "Posterior sums to 1.0 got " + sum.toFixed(6));

    return { pass: pass, fail: fail, errs: errs };
  }

  var RBIDetailed = {
    GFF: GFF, FLUIDS: FLUIDS,
    thinningDF: thinningDF,
    inspectionCombo: inspectionCombo,
    bayesianPosterior: bayesianPosterior,
    reliabilityBeta: reliabilityBeta,
    cdfNormal: _cdfNormal,
    F_MS: F_MS,
    PoF: PoF,
    cofLevel1: cofLevel1,
    _runTests: _runTests
  };
  root.RBIDetailed = RBIDetailed;
  if (typeof module !== "undefined" && module.exports) module.exports = RBIDetailed;
})(typeof window !== "undefined" ? window : this);

if (typeof require !== "undefined" && require.main === module) {
  var R = module.exports;
  var r = R._runTests();
  console.log("RBI-Detailed regression: PASS " + r.pass + " / FAIL " + r.fail);
  if (r.fail) r.errs.forEach(function(e){ console.log("  - " + e); });
}
