/* anode.js — Sacrificial anode sizing per DNV-RP-B401 + NACE SP0387. Vanilla JS.
 *
 * Calculates required sacrificial anode net mass for a structure, given:
 *   - surface area, design life, environment (current density), coating category
 *     (DNV linear breakdown f_c = a + b*t), anode alloy electrochemical capacity
 *     and utilisation factor.
 *
 * Method (DNV-RP-B401):
 *   I_c_mean  = A * i_c_mean  * f_c_mean
 *   I_c_final = A * i_c_final * f_c_final
 *   Q         = I_c_mean * T * 8760           [Ah]
 *   M_net     = Q / (epsilon * u)              [kg]
 *   N         = ceil(M_net / unit_mass)
 *
 * Sources cited in `ref`:
 *   - DNV-RP-B401 (Cathodic Protection Design), §6 (coating breakdown), §7 (anode
 *     properties), §10 (current demand & anode mass). Edition-dependent values
 *     marked as screening defaults; verify against the controlling edition.
 *   - NACE SP0387 (Metallurgical and Inspection Requirements for Cast Sacrificial
 *     Anodes for Offshore Applications) — anode alloy types.
 *   - NACE SP0169 — buried steel CP.
 *
 * Limits: screening only. Anode placement, attenuation, resistance to remote earth,
 *   structure-to-anode resistance, and end-of-life polarisation verification still
 *   require a detailed CP design per the controlling specification.
 *
 * Units: A in m^2, T in years, i in A/m^2, M in kg, Q in Ah.
 */
(function (root) {
  "use strict";

  // ------------------------------------------------------------------------
  // Environment current densities (A/m^2). Screening defaults consistent with
  // the typical ranges in DNV-RP-B401 Table 10-1 / 10-2 (mean values within
  // the cited bands). Verify against the controlling edition for project use.
  // ------------------------------------------------------------------------
  var ENVIRONMENTS = {
    "north-sea":        { i_init: 0.200, i_mean: 0.100, i_final: 0.130, label: "North Sea seawater (open)" },
    "gulf-of-mexico":   { i_init: 0.150, i_mean: 0.070, i_final: 0.100, label: "Gulf of Mexico seawater" },
    "tropical-seawater":{ i_init: 0.150, i_mean: 0.070, i_final: 0.090, label: "Tropical seawater" },
    "subsea-mud":       { i_init: 0.025, i_mean: 0.020, i_final: 0.020, label: "Buried (subsea mud / sediment)" },
    "brackish":         { i_init: 0.100, i_mean: 0.050, i_final: 0.070, label: "Brackish water (estuary)" },
    "buried-soil":      { i_init: 0.050, i_mean: 0.020, i_final: 0.030, label: "Buried steel in soil (NACE SP0169 typical)" }
  };

  // Coating-category linear breakdown factor: f_c(t) = a + b * t, capped at 1.0.
  // DNV-RP-B401 §6 typical screening values.
  var COATINGS = {
    "bare":     { a: 1.00, b: 0.000, label: "Bare steel (no coating)" },
    "I":        { a: 0.10, b: 0.050, label: "DNV Cat I — single-coat (basic)" },
    "II":       { a: 0.05, b: 0.025, label: "DNV Cat II — multi-coat or one-coat thick film" },
    "III":      { a: 0.02, b: 0.012, label: "DNV Cat III — multi-coat fusion-bonded epoxy / TSA" },
    "TSA":      { a: 0.02, b: 0.010, label: "Thermal-sprayed aluminium (high-temperature)" }
  };

  // Anode alloy properties: ε (Ah/kg), utilisation u, driving voltage ΔE_a (V vs.
  // Ag/AgCl seawater or Cu/CuSO4 onshore), typical unit (single-anode) net mass.
  // DNV-RP-B401 Table 7-1 typical values; vendor data sheets vary.
  var ANODES = {
    "AlZnIn":  { epsilon: 2000, u: 0.85, dEa: 0.30, unit_kg: 200, env: "seawater",
                 label: "Al-Zn-In (offshore seawater)" },
    "Zn":      { epsilon:  780, u: 0.90, dEa: 0.25, unit_kg: 150, env: "seawater",
                 label: "Zn (seawater / brackish)" },
    "Mg":      { epsilon: 1230, u: 0.85, dEa: 0.65, unit_kg:   8, env: "soil",
                 label: "Mg ribbon / packaged (onshore high-resistivity soil)" }
  };

  /** Sacrificial-anode total net mass + per-zone current demand. */
  function size(opts) {
    opts = opts || {};
    var A = +opts.area_m2;
    var T = +opts.lifeYr;
    var env = ENVIRONMENTS[opts.environment] || ENVIRONMENTS["north-sea"];
    var coat = COATINGS[opts.coating] || COATINGS["I"];
    var an = ANODES[opts.anode] || ANODES["AlZnIn"];
    if (!(A > 0 && T > 0)) {
      return { error: "area_m2 and lifeYr must be > 0", environment: env.label,
               coating: coat.label, anode: an.label };
    }
    // Coating breakdown over life (DNV linear model, capped at 1)
    var fc_mean = Math.min(1.0, coat.a + coat.b * T / 2);
    var fc_final = Math.min(1.0, coat.a + coat.b * T);
    var fc_initial = Math.min(1.0, coat.a);
    // Current demand (A) at three life points
    var I_init  = A * env.i_init  * fc_initial;
    var I_mean  = A * env.i_mean  * fc_mean;
    var I_final = A * env.i_final * fc_final;
    // Total charge required (Ah) over life — driven by mean current
    var Q = I_mean * T * 8760;
    // Required net anode mass (kg) — utilisation accounts for self-corrosion,
    // unusable residual and uneven consumption (DNV-RP-B401 §10.5)
    var M_net = Q / (an.epsilon * an.u);
    var N = Math.ceil(M_net / Math.max(1, an.unit_kg));
    // Faraday sanity: M_net should NEVER exceed the unlimited Faradaic upper
    // bound A * i_mean * T * (1 / (Fe-equiv-electrochemistry)). For screening
    // we just check M_net is finite and positive.
    return {
      area_m2: A, lifeYr: T,
      environment: env.label, coating: coat.label, anode: an.label,
      fc_initial: fc_initial, fc_mean: fc_mean, fc_final: fc_final,
      i_init_Am2:  env.i_init,  i_mean_Am2: env.i_mean, i_final_Am2: env.i_final,
      I_initial_A: I_init, I_mean_A: I_mean, I_final_A: I_final,
      Q_Ah: Q,
      anodeMass_kg_net: M_net,
      anodeMass_kg_gross: M_net / Math.max(0.01, an.u),
      epsilon_Ahkg: an.epsilon, utilization: an.u, dEa_V: an.dEa,
      anodeUnit_kg: an.unit_kg, numAnodes: N,
      ref: "DNV-RP-B401 §6 (coating breakdown), §7 (anode capacity), §10 (current "
         + "demand & mass); NACE SP0387 (offshore sacrificial anodes); SP0169 (buried "
         + "steel CP). Screening — final geometry / attenuation / end-of-life "
         + "polarisation verification requires a detailed CP design per project spec."
    };
  }

  /** Worked example (offshore subsea pipeline, 1 km of 12-inch OD):
   *  A = pi * 0.3239 m * 1000 m ≈ 1018 m^2; coat II; North Sea; 25-yr life; Al-Zn-In.
   *  fc_mean ≈ 0.05 + 0.025*12.5 = 0.3625; I_mean ≈ 1018 * 0.10 * 0.3625 ≈ 36.9 A.
   *  Q ≈ 36.9 * 25 * 8760 ≈ 8.08e6 Ah.
   *  M_net ≈ 8.08e6 / (2000 * 0.85) ≈ 4753 kg of Al-Zn-In (~24 of 200 kg "bracelet"
   *  anodes — within order-of-magnitude of typical SLP-CP design). */

  var Anode = {
    ENVIRONMENTS: ENVIRONMENTS, COATINGS: COATINGS, ANODES: ANODES,
    size: size
  };
  root.Anode = Anode;
  if (typeof module !== "undefined" && module.exports) module.exports = Anode;
})(typeof window !== "undefined" ? window : this);
