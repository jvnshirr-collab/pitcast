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
 *     properties), §10 (current demand & anode mass). Table 10-1 / 10-2 give
 *     current-density ranges by climatic zone; mid-band values used as screening
 *     defaults. Verify against the controlling edition for project use.
 *   - NACE SP0387 (Metallurgical and Inspection Requirements for Cast Sacrificial
 *     Anodes for Offshore Applications) — anode alloy chemistry & utilisation.
 *   - NACE SP0169 — buried steel CP (onshore current demand).
 *   - NACE SP0572 — Mg anodes; NACE SP0492 / SP0490 — FBE / 3LPE pipeline coatings;
 *     NACE SP0212 / AWS C2.18 / ISO 2063 — Thermal-Spray Aluminium (TSA / TSZ).
 *   - ISO 21809-1/-2/-3 — external pipeline coatings (FBE, 3LPE/3LPP).
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
  // the typical ranges in DNV-RP-B401 Tables 10-1 / 10-2 (mean values within
  // the cited bands) and NACE SP0176 (offshore zones). Soil values per
  // NACE SP0169 / SP0572 typical practice.
  // i_init = polarisation initial demand; i_mean = lifetime average;
  // i_final = end-of-life (polarised structure).
  // ------------------------------------------------------------------------
  var ENVIRONMENTS = {
    // ---- Open seawater, by climatic zone (DNV-RP-B401 Table 10-1) ----
    "north-sea":         { i_init: 0.200, i_mean: 0.100, i_final: 0.130, label: "North Sea seawater (open, >30 m, 7–12 °C)" },
    "norwegian-sea":     { i_init: 0.220, i_mean: 0.110, i_final: 0.140, label: "Norwegian / Arctic seawater (cold)" },
    "north-atlantic":    { i_init: 0.180, i_mean: 0.090, i_final: 0.120, label: "North Atlantic open seawater" },
    "gulf-of-mexico":    { i_init: 0.150, i_mean: 0.070, i_final: 0.100, label: "Gulf of Mexico seawater" },
    "tropical-seawater": { i_init: 0.150, i_mean: 0.070, i_final: 0.090, label: "Tropical seawater (Atlantic / Pacific, ≥20 °C)" },
    "mediterranean":     { i_init: 0.130, i_mean: 0.065, i_final: 0.090, label: "Mediterranean seawater" },
    "persian-gulf":      { i_init: 0.180, i_mean: 0.090, i_final: 0.120, label: "Persian / Arabian Gulf (warm, hi-salinity)" },
    "red-sea":           { i_init: 0.200, i_mean: 0.100, i_final: 0.130, label: "Red Sea (very high salinity ~40 ‰)" },
    "caspian":           { i_init: 0.100, i_mean: 0.055, i_final: 0.075, label: "Caspian (brackish, low salinity)" },
    "baltic":            { i_init: 0.090, i_mean: 0.050, i_final: 0.070, label: "Baltic Sea (low-salinity brackish)" },
    "south-china-sea":   { i_init: 0.170, i_mean: 0.085, i_final: 0.110, label: "South China Sea (warm tropical)" },
    "deep-water":        { i_init: 0.220, i_mean: 0.120, i_final: 0.150, label: "Deep water (>300 m, cold + O₂)" },
    "splash-zone":       { i_init: 0.350, i_mean: 0.250, i_final: 0.300, label: "Splash zone (worst-case, intermittent O₂)" },
    "tidal-zone":        { i_init: 0.300, i_mean: 0.180, i_final: 0.220, label: "Tidal zone (intermittent immersion)" },
    "stagnant-seawater": { i_init: 0.080, i_mean: 0.040, i_final: 0.060, label: "Stagnant seawater (closed system)" },
    // ---- Buried in marine sediment ----
    "subsea-mud":        { i_init: 0.025, i_mean: 0.020, i_final: 0.020, label: "Subsea mud / sediment (buried offshore)" },
    "subsea-mud-warm":   { i_init: 0.030, i_mean: 0.025, i_final: 0.025, label: "Tropical sediment (warm, biologically active)" },
    // ---- Brackish / coastal ----
    "brackish":          { i_init: 0.100, i_mean: 0.050, i_final: 0.070, label: "Brackish estuarine (mixing zone)" },
    "produced-water":    { i_init: 0.200, i_mean: 0.110, i_final: 0.150, label: "Oilfield produced water (high TDS + H₂S)" },
    // ---- Onshore buried steel (NACE SP0169) ----
    "buried-soil":       { i_init: 0.050, i_mean: 0.020, i_final: 0.030, label: "Buried steel — generic soil (NACE SP0169)" },
    "buried-clay":       { i_init: 0.060, i_mean: 0.025, i_final: 0.035, label: "Buried — clay soil (low-ρ, aggressive)" },
    "buried-sand":       { i_init: 0.030, i_mean: 0.012, i_final: 0.018, label: "Buried — dry sandy soil (high-ρ)" },
    "buried-peat":       { i_init: 0.080, i_mean: 0.040, i_final: 0.055, label: "Buried — peat / organic soil (acidic, low-ρ)" },
    "buried-saturated":  { i_init: 0.075, i_mean: 0.035, i_final: 0.050, label: "Buried — water-saturated clay" },
    "made-ground":       { i_init: 0.070, i_mean: 0.035, i_final: 0.045, label: "Made-ground / urban fill (variable)" },
    "permafrost":        { i_init: 0.010, i_mean: 0.005, i_final: 0.008, label: "Permafrost / frozen ground (very low demand)" },
    "concrete-encased":  { i_init: 0.010, i_mean: 0.005, i_final: 0.008, label: "Concrete-encased steel (passivated by Ca(OH)₂)" },
    // ---- Internal / process water ----
    "freshwater":        { i_init: 0.050, i_mean: 0.025, i_final: 0.035, label: "Freshwater (river / lake intake)" },
    "potable-water":     { i_init: 0.030, i_mean: 0.015, i_final: 0.020, label: "Potable / treated water (low aggressive)" },
    "fpso-slop-tank":    { i_init: 0.250, i_mean: 0.150, i_final: 0.200, label: "FPSO slop / ballast tank (alternating wet/dry)" },
    "cooling-tower":     { i_init: 0.180, i_mean: 0.100, i_final: 0.130, label: "Cooling-tower basin (treated recirc)" }
  };

  // ------------------------------------------------------------------------
  // Coating-category linear breakdown factor: f_c(t) = a + b * t, capped at 1.0.
  // DNV-RP-B401 §6 typical screening values + specific pipeline coating systems
  // per NACE SP0490 (FBE), SP0492 (3LPE), SP0212 (TSA), ISO 21809 series.
  // ------------------------------------------------------------------------
  var COATINGS = {
    "bare":             { a: 1.00, b: 0.000, label: "Bare steel (no coating)" },
    "I":                { a: 0.10, b: 0.050, label: "DNV Cat I — single-coat (basic)" },
    "II":               { a: 0.05, b: 0.025, label: "DNV Cat II — multi-coat or one-coat thick film" },
    "III":              { a: 0.02, b: 0.012, label: "DNV Cat III — multi-coat fusion-bonded epoxy / TSA" },
    "FBE":              { a: 0.03, b: 0.015, label: "FBE (fusion-bonded epoxy, NACE SP0490 / ISO 21809-2)" },
    "3LPE":             { a: 0.02, b: 0.010, label: "3LPE (3-layer polyethylene, ISO 21809-1)" },
    "3LPP":             { a: 0.02, b: 0.010, label: "3LPP (3-layer polypropylene, high-T)" },
    "coal-tar-enamel":  { a: 0.06, b: 0.018, label: "Coal-tar enamel (legacy, AWWA C203)" },
    "neoprene":         { a: 0.04, b: 0.012, label: "Neoprene / chloroprene rubber" },
    "polyurethane":     { a: 0.04, b: 0.015, label: "Polyurethane (subsea flowline)" },
    "glass-flake-epoxy":{ a: 0.03, b: 0.012, label: "Glass-flake epoxy (heavy-duty marine)" },
    "TSA":              { a: 0.02, b: 0.010, label: "Thermal-sprayed Al — pure (NACE SP0212 / AWS C2.18)" },
    "TSA-AlMg":         { a: 0.02, b: 0.008, label: "Thermal-sprayed Al-5Mg (high-T marine, ISO 2063)" },
    "TSZ":              { a: 0.04, b: 0.020, label: "Thermal-sprayed Zn (atmospheric, AWS C2.18)" },
    "concrete-weight":  { a: 0.20, b: 0.030, label: "Concrete weight-coating (CWC, pipe ballast)" }
  };

  // ------------------------------------------------------------------------
  // Anode alloy properties: ε (Ah/kg), utilisation u, driving voltage ΔE_a (V vs.
  // Ag/AgCl seawater or Cu/CuSO4 onshore), typical unit (single-anode) net mass.
  // DNV-RP-B401 Table 7-1 typical values; vendor data sheets vary. NACE SP0387
  // specifies casting + chemistry. Hg-bearing alloys deprecated environmentally.
  // ------------------------------------------------------------------------
  var ANODES = {
    "AlZnIn":           { epsilon: 2000, u: 0.85, dEa: 0.30, unit_kg: 200, env: "seawater",
                          label: "Al-Zn-In standard (DNV-RP-B401 §7, sea ≤25 °C)" },
    "AlZnInSi":         { epsilon: 2200, u: 0.90, dEa: 0.30, unit_kg: 200, env: "seawater",
                          label: "Al-Zn-In-Si (high-capacity, deep cold seawater)" },
    "AlZnInSnMg":       { epsilon: 2400, u: 0.90, dEa: 0.30, unit_kg: 200, env: "seawater",
                          label: "Al-Zn-In-Sn-Mg (high-driving, modified Galvalum)" },
    "AlZnHg":           { epsilon: 2500, u: 0.95, dEa: 0.30, unit_kg: 200, env: "seawater",
                          label: "Al-Zn-Hg (LEGACY — Hg restricted, do not specify new)" },
    "Galvalum-III":     { epsilon: 2300, u: 0.90, dEa: 0.30, unit_kg: 200, env: "seawater",
                          label: "Galvalum III (Al-Zn-In high-T, hot mud)" },
    "Zn-MIL":           { epsilon:  780, u: 0.90, dEa: 0.25, unit_kg: 150, env: "seawater",
                          label: "Zn high-purity (MIL-DTL-18001K, seawater / brackish)" },
    "Zn-Al-Cd":         { epsilon:  810, u: 0.90, dEa: 0.25, unit_kg: 150, env: "seawater",
                          label: "Zn-Al-Cd (legacy MIL spec; Cd restricted)" },
    "Mg-H1":            { epsilon: 1230, u: 0.50, dEa: 0.65, unit_kg:  17, env: "soil",
                          label: "Mg H-1 ASTM B843 (onshore packaged, high ρ soil)" },
    "Mg-AZ63":          { epsilon: 1100, u: 0.50, dEa: 0.55, unit_kg:  17, env: "soil",
                          label: "Mg AZ-63B (standard cast, ASTM B843)" },
    "Mg-Hi-Pot":        { epsilon: 1100, u: 0.50, dEa: 0.75, unit_kg:  17, env: "soil",
                          label: "Mg high-potential (Mn alloyed, very high ρ soil)" },
    "Mg-ribbon":        { epsilon: 1230, u: 0.50, dEa: 0.65, unit_kg:   1, env: "soil",
                          label: "Mg ribbon (continuous, well-casing / cased pipe)" }
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
      ref: "DNV-RP-B401 §6 (coating breakdown), §7 (anode capacity, Table 7-1), "
         + "§10 (current demand & mass, Tables 10-1/10-2); NACE SP0387 (offshore "
         + "sacrificial anodes); SP0169 (buried steel CP); SP0572 (Mg anodes); "
         + "SP0490/SP0492/SP0212 + ISO 21809 + AWS C2.18 (FBE / 3LPE / TSA). "
         + "Screening — final geometry / attenuation / end-of-life polarisation "
         + "verification requires a detailed CP design per project spec."
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
