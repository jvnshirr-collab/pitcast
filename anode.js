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
 * Physical-context enrichment over base DNV defaults:
 *   - Each environment carries T_C, depth_range_m, salinity_ppt, O2_mg_L,
 *     resistivity_ohm_m. The size() function optionally accepts a service T
 *     override and a depth (m), and applies a DNV-RP-B401 §10 Arrhenius-like
 *     temperature correction on i_mean (≈ +1%/°C above 12 °C, capped) and a
 *     depth/oxygen correction (oxygen falls past ~30 m, raising i_mean per
 *     Galvalum Reactivity literature). Both corrections are flagged in `ref`.
 *
 * Sources cited in `ref`:
 *   - DNV-RP-B401 (Cathodic Protection Design), §6 (coating breakdown), §7
 *     (anode properties, Table 7-1), §10 (current demand & mass; Tables 10-1
 *     / 10-2 by climatic zone). T- and depth-correction factors per §10.5.
 *   - NACE SP0387 (Metallurgical / Inspection Reqts for Cast Sacrificial
 *     Anodes); SP0169 (buried steel CP); SP0572 (Mg anodes).
 *   - NACE SP0492 / SP0490 / SP0212 + ISO 21809 + AWS C2.18 + ISO 2063 +
 *     AWWA C203 — pipeline coating systems referenced in COATINGS.
 *
 * Limits: screening only. Anode placement, attenuation, resistance to remote
 *   earth, structure-to-anode resistance, and end-of-life polarisation
 *   verification still require a detailed CP design per project spec.
 */
(function (root) {
  "use strict";

  // ------------------------------------------------------------------------
  // ENVIRONMENTS — current densities (A/m²) PLUS physical context:
  //   T_C            : typical operating temperature (°C)
  //   depth_range_m  : characteristic depth window
  //   salinity_ppt   : total dissolved salt (parts per thousand)
  //   O2_mg_L        : dissolved oxygen (mg/L)
  //   rho_ohm_m      : electrolyte resistivity (Ω·m)
  // Sources: DNV-RP-B401 Tab 10-1/10-2; NACE SP0176 (Offshore Pipeline CP);
  // NACE SP0169 (Soil CP); IEEE 81 (soil resistivity).
  // ------------------------------------------------------------------------
  var ENVIRONMENTS = {
    "north-sea":         { i_init: 0.200, i_mean: 0.100, i_final: 0.130, T_C: 9,  depth_range_m: "30–150", salinity_ppt: 35, O2_mg_L: 7.0, rho_ohm_m: 0.30, label: "North Sea seawater (open, >30 m, 7–12 °C)" },
    "norwegian-sea":     { i_init: 0.220, i_mean: 0.110, i_final: 0.140, T_C: 5,  depth_range_m: "100–1000",salinity_ppt: 35, O2_mg_L: 7.5, rho_ohm_m: 0.30, label: "Norwegian / Arctic seawater (cold)" },
    "north-atlantic":    { i_init: 0.180, i_mean: 0.090, i_final: 0.120, T_C: 12, depth_range_m: "50–500", salinity_ppt: 35, O2_mg_L: 6.5, rho_ohm_m: 0.30, label: "North Atlantic open seawater" },
    "gulf-of-mexico":    { i_init: 0.150, i_mean: 0.070, i_final: 0.100, T_C: 22, depth_range_m: "30–2000",salinity_ppt: 35, O2_mg_L: 5.5, rho_ohm_m: 0.27, label: "Gulf of Mexico seawater" },
    "tropical-seawater": { i_init: 0.150, i_mean: 0.070, i_final: 0.090, T_C: 27, depth_range_m: "0–200",  salinity_ppt: 35, O2_mg_L: 5.0, rho_ohm_m: 0.25, label: "Tropical seawater (Atlantic / Pacific, ≥20 °C)" },
    "mediterranean":     { i_init: 0.130, i_mean: 0.065, i_final: 0.090, T_C: 18, depth_range_m: "10–1000",salinity_ppt: 38, O2_mg_L: 6.0, rho_ohm_m: 0.23, label: "Mediterranean seawater" },
    "persian-gulf":      { i_init: 0.180, i_mean: 0.090, i_final: 0.120, T_C: 28, depth_range_m: "10–90",  salinity_ppt: 41, O2_mg_L: 5.0, rho_ohm_m: 0.20, label: "Persian / Arabian Gulf (warm, hi-salinity)" },
    "red-sea":           { i_init: 0.200, i_mean: 0.100, i_final: 0.130, T_C: 28, depth_range_m: "20–500", salinity_ppt: 41, O2_mg_L: 4.8, rho_ohm_m: 0.18, label: "Red Sea (very high salinity ~41 ‰)" },
    "caspian":           { i_init: 0.100, i_mean: 0.055, i_final: 0.075, T_C: 18, depth_range_m: "10–500", salinity_ppt: 13, O2_mg_L: 7.0, rho_ohm_m: 0.65, label: "Caspian (brackish, low salinity)" },
    "baltic":            { i_init: 0.090, i_mean: 0.050, i_final: 0.070, T_C: 8,  depth_range_m: "5–150",  salinity_ppt: 8,  O2_mg_L: 8.0, rho_ohm_m: 1.20, label: "Baltic Sea (low-salinity brackish)" },
    "south-china-sea":   { i_init: 0.170, i_mean: 0.085, i_final: 0.110, T_C: 27, depth_range_m: "30–2000",salinity_ppt: 34, O2_mg_L: 5.0, rho_ohm_m: 0.26, label: "South China Sea (warm tropical)" },
    "deep-water":        { i_init: 0.220, i_mean: 0.120, i_final: 0.150, T_C: 4,  depth_range_m: ">300",   salinity_ppt: 35, O2_mg_L: 6.0, rho_ohm_m: 0.30, label: "Deep water (>300 m, cold + O₂)" },
    "splash-zone":       { i_init: 0.350, i_mean: 0.250, i_final: 0.300, T_C: 20, depth_range_m: "0",      salinity_ppt: 35, O2_mg_L: 8.5, rho_ohm_m: 0.25, label: "Splash zone (worst-case, intermittent O₂)" },
    "tidal-zone":        { i_init: 0.300, i_mean: 0.180, i_final: 0.220, T_C: 20, depth_range_m: "0–2",    salinity_ppt: 35, O2_mg_L: 8.0, rho_ohm_m: 0.25, label: "Tidal zone (intermittent immersion)" },
    "stagnant-seawater": { i_init: 0.080, i_mean: 0.040, i_final: 0.060, T_C: 22, depth_range_m: "any",    salinity_ppt: 35, O2_mg_L: 1.5, rho_ohm_m: 0.30, label: "Stagnant seawater (closed system)" },
    "subsea-mud":        { i_init: 0.025, i_mean: 0.020, i_final: 0.020, T_C: 8,  depth_range_m: "buried", salinity_ppt: 35, O2_mg_L: 0.5, rho_ohm_m: 1.0,  label: "Subsea mud / sediment (buried offshore)" },
    "subsea-mud-warm":   { i_init: 0.030, i_mean: 0.025, i_final: 0.025, T_C: 25, depth_range_m: "buried", salinity_ppt: 35, O2_mg_L: 0.5, rho_ohm_m: 0.8,  label: "Tropical sediment (warm, biologically active)" },
    "brackish":          { i_init: 0.100, i_mean: 0.050, i_final: 0.070, T_C: 15, depth_range_m: "5–30",   salinity_ppt: 15, O2_mg_L: 7.0, rho_ohm_m: 0.80, label: "Brackish estuarine (mixing zone)" },
    "produced-water":    { i_init: 0.200, i_mean: 0.110, i_final: 0.150, T_C: 50, depth_range_m: "tank",   salinity_ppt: 80, O2_mg_L: 0.1, rho_ohm_m: 0.10, label: "Oilfield produced water (high TDS + H₂S)" },
    "buried-soil":       { i_init: 0.050, i_mean: 0.020, i_final: 0.030, T_C: 12, depth_range_m: "buried", salinity_ppt: 0,  O2_mg_L: 2.0, rho_ohm_m: 50,   label: "Buried steel — generic soil (NACE SP0169)" },
    "buried-clay":       { i_init: 0.060, i_mean: 0.025, i_final: 0.035, T_C: 12, depth_range_m: "buried", salinity_ppt: 0,  O2_mg_L: 1.0, rho_ohm_m: 20,   label: "Buried — clay soil (low-ρ, aggressive)" },
    "buried-sand":       { i_init: 0.030, i_mean: 0.012, i_final: 0.018, T_C: 15, depth_range_m: "buried", salinity_ppt: 0,  O2_mg_L: 4.0, rho_ohm_m: 200,  label: "Buried — dry sandy soil (high-ρ)" },
    "buried-peat":       { i_init: 0.080, i_mean: 0.040, i_final: 0.055, T_C: 10, depth_range_m: "buried", salinity_ppt: 0,  O2_mg_L: 0.5, rho_ohm_m: 30,   label: "Buried — peat / organic soil (acidic, low-ρ)" },
    "buried-saturated":  { i_init: 0.075, i_mean: 0.035, i_final: 0.050, T_C: 12, depth_range_m: "buried", salinity_ppt: 5,  O2_mg_L: 0.5, rho_ohm_m: 25,   label: "Buried — water-saturated clay" },
    "made-ground":       { i_init: 0.070, i_mean: 0.035, i_final: 0.045, T_C: 14, depth_range_m: "buried", salinity_ppt: 0,  O2_mg_L: 3.0, rho_ohm_m: 35,   label: "Made-ground / urban fill (variable)" },
    "permafrost":        { i_init: 0.010, i_mean: 0.005, i_final: 0.008, T_C: -5, depth_range_m: "buried", salinity_ppt: 0,  O2_mg_L: 0.1, rho_ohm_m: 5000, label: "Permafrost / frozen ground (very low demand)" },
    "concrete-encased":  { i_init: 0.010, i_mean: 0.005, i_final: 0.008, T_C: 15, depth_range_m: "encased",salinity_ppt: 0,  O2_mg_L: 2.0, rho_ohm_m: 100,  label: "Concrete-encased steel (passivated by Ca(OH)₂)" },
    "freshwater":        { i_init: 0.050, i_mean: 0.025, i_final: 0.035, T_C: 15, depth_range_m: "1–50",   salinity_ppt: 0.2,O2_mg_L: 9.0, rho_ohm_m: 50,   label: "Freshwater (river / lake intake)" },
    "potable-water":     { i_init: 0.030, i_mean: 0.015, i_final: 0.020, T_C: 18, depth_range_m: "tank",   salinity_ppt: 0.3,O2_mg_L: 8.0, rho_ohm_m: 100,  label: "Potable / treated water (low aggressive)" },
    "fpso-slop-tank":    { i_init: 0.250, i_mean: 0.150, i_final: 0.200, T_C: 30, depth_range_m: "tank",   salinity_ppt: 35, O2_mg_L: 2.0, rho_ohm_m: 0.30, label: "FPSO slop / ballast tank (alternating wet/dry)" },
    "cooling-tower":     { i_init: 0.180, i_mean: 0.100, i_final: 0.130, T_C: 35, depth_range_m: "basin",  salinity_ppt: 5,  O2_mg_L: 8.0, rho_ohm_m: 2,    label: "Cooling-tower basin (treated recirc)" }
  };

  // Coating-category linear breakdown factor: f_c(t) = a + b * t, capped at 1.0.
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

  // Anode alloy properties (DNV-RP-B401 Table 7-1).
  var ANODES = {
    "AlZnIn":           { epsilon: 2000, u: 0.85, dEa: 0.30, unit_kg: 200, env: "seawater", label: "Al-Zn-In standard (DNV-RP-B401 §7, sea ≤25 °C)" },
    "AlZnInSi":         { epsilon: 2200, u: 0.90, dEa: 0.30, unit_kg: 200, env: "seawater", label: "Al-Zn-In-Si (high-capacity, deep cold seawater)" },
    "AlZnInSnMg":       { epsilon: 2400, u: 0.90, dEa: 0.30, unit_kg: 200, env: "seawater", label: "Al-Zn-In-Sn-Mg (high-driving, modified Galvalum)" },
    "AlZnHg":           { epsilon: 2500, u: 0.95, dEa: 0.30, unit_kg: 200, env: "seawater", label: "Al-Zn-Hg (LEGACY — Hg restricted, do not specify new)" },
    "Galvalum-III":     { epsilon: 2300, u: 0.90, dEa: 0.30, unit_kg: 200, env: "seawater", label: "Galvalum III (Al-Zn-In high-T, hot mud)" },
    "Zn-MIL":           { epsilon:  780, u: 0.90, dEa: 0.25, unit_kg: 150, env: "seawater", label: "Zn high-purity (MIL-DTL-18001K, seawater / brackish)" },
    "Zn-Al-Cd":         { epsilon:  810, u: 0.90, dEa: 0.25, unit_kg: 150, env: "seawater", label: "Zn-Al-Cd (legacy MIL spec; Cd restricted)" },
    "Mg-H1":            { epsilon: 1230, u: 0.50, dEa: 0.65, unit_kg:  17, env: "soil",     label: "Mg H-1 ASTM B843 (onshore packaged, high ρ soil)" },
    "Mg-AZ63":          { epsilon: 1100, u: 0.50, dEa: 0.55, unit_kg:  17, env: "soil",     label: "Mg AZ-63B (standard cast, ASTM B843)" },
    "Mg-Hi-Pot":        { epsilon: 1100, u: 0.50, dEa: 0.75, unit_kg:  17, env: "soil",     label: "Mg high-potential (Mn alloyed, very high ρ soil)" },
    "Mg-ribbon":        { epsilon: 1230, u: 0.50, dEa: 0.65, unit_kg:   1, env: "soil",     label: "Mg ribbon (continuous, well-casing / cased pipe)" }
  };

  /** Sacrificial-anode total net mass + per-zone current demand.
   *  Optional service overrides:
   *    T_C_override : applies +1%/°C above 12 °C (DNV §10.5 T-correction)
   *    depth_m      : >300 m bumps i_mean (deep-O₂ effect) by ~10%
   */
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
    // Temperature correction (DNV-RP-B401 §10.5 typical +1%/°C above 12 °C, capped at +50%)
    var T_service = (opts.T_C_override != null) ? +opts.T_C_override : env.T_C;
    var f_T = 1.0;
    if (T_service > 12) f_T = Math.min(1.5, 1.0 + 0.01 * (T_service - 12));
    if (T_service < 2) f_T = Math.max(0.5, 1.0 + 0.02 * (T_service - 12));   // cold reduces demand

    // Depth correction — typical surface→300 m has reasonably constant demand;
    // deep cold O₂-rich waters show 10–20% higher i_mean (DNV §10.5 + UK HSE 2003)
    var depth = +opts.depth_m;
    var f_D = 1.0;
    if (depth >= 300 && depth < 1000) f_D = 1.10;
    else if (depth >= 1000) f_D = 1.20;

    // Coating breakdown over life
    var fc_mean = Math.min(1.0, coat.a + coat.b * T / 2);
    var fc_final = Math.min(1.0, coat.a + coat.b * T);
    var fc_initial = Math.min(1.0, coat.a);

    // Current demand
    var i_init_adj  = env.i_init  * f_T * f_D;
    var i_mean_adj  = env.i_mean  * f_T * f_D;
    var i_final_adj = env.i_final * f_T * f_D;
    var I_init  = A * i_init_adj  * fc_initial;
    var I_mean  = A * i_mean_adj  * fc_mean;
    var I_final = A * i_final_adj * fc_final;
    var Q = I_mean * T * 8760;
    var M_net = Q / (an.epsilon * an.u);
    var N = Math.ceil(M_net / Math.max(1, an.unit_kg));

    var corrNotes = [];
    if (Math.abs(f_T - 1) > 0.001) corrNotes.push("T-correction × " + f_T.toFixed(2) + " (service " + T_service + " °C vs ref 12 °C)");
    if (Math.abs(f_D - 1) > 0.001) corrNotes.push("Depth correction × " + f_D.toFixed(2) + " (depth " + depth + " m)");

    return {
      area_m2: A, lifeYr: T,
      environment: env.label, coating: coat.label, anode: an.label,
      T_C_service: T_service, T_C_env_default: env.T_C, depth_m: depth || null,
      env_properties: {
        T_C: env.T_C, depth_range_m: env.depth_range_m, salinity_ppt: env.salinity_ppt,
        O2_mg_L: env.O2_mg_L, rho_ohm_m: env.rho_ohm_m
      },
      corrections: { f_T: f_T, f_D: f_D, notes: corrNotes },
      fc_initial: fc_initial, fc_mean: fc_mean, fc_final: fc_final,
      i_init_Am2:  i_init_adj,  i_mean_Am2: i_mean_adj, i_final_Am2: i_final_adj,
      i_init_base: env.i_init, i_mean_base: env.i_mean, i_final_base: env.i_final,
      I_initial_A: I_init, I_mean_A: I_mean, I_final_A: I_final,
      Q_Ah: Q,
      anodeMass_kg_net: M_net,
      anodeMass_kg_gross: M_net / Math.max(0.01, an.u),
      epsilon_Ahkg: an.epsilon, utilization: an.u, dEa_V: an.dEa,
      anodeUnit_kg: an.unit_kg, numAnodes: N,
      ref: "DNV-RP-B401 §6 (coating breakdown), §7 (anode capacity, Table 7-1), "
         + "§10 (current demand & mass, Tables 10-1/10-2; T-correction §10.5 "
         + "≈+1%/°C above 12 °C; depth/O₂ uplift in cold deep water); "
         + "NACE SP0387 (offshore sacrificial anodes); SP0169 (buried steel CP); "
         + "SP0572 (Mg anodes); SP0490/SP0492/SP0212 + ISO 21809 + AWS C2.18 "
         + "(FBE / 3LPE / TSA). Screening — final geometry / attenuation / "
         + "end-of-life polarisation verification requires a detailed CP design."
    };
  }

  /** Worked example (offshore subsea pipeline, 1 km of 12-inch OD):
   *  A = pi * 0.3239 m * 1000 m ≈ 1018 m^2; coat II; North Sea; 25-yr life; Al-Zn-In.
   *  fc_mean ≈ 0.05 + 0.025*12.5 = 0.3625; I_mean ≈ 1018 * 0.10 * 0.3625 ≈ 36.9 A.
   *  Q ≈ 36.9 * 25 * 8760 ≈ 8.08e6 Ah.
   *  M_net ≈ 8.08e6 / (2000 * 0.85) ≈ 4753 kg of Al-Zn-In (~24 of 200 kg "bracelet"
   *  anodes — within order-of-magnitude of typical SLP-CP design).
   *
   *  Same pipeline at 1500 m depth: f_D=1.2 → mass scales to ~5704 kg. */

  var Anode = {
    ENVIRONMENTS: ENVIRONMENTS, COATINGS: COATINGS, ANODES: ANODES,
    size: size
  };
  root.Anode = Anode;
  if (typeof module !== "undefined" && module.exports) module.exports = Anode;
})(typeof window !== "undefined" ? window : this);
