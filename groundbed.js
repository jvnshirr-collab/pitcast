/* groundbed.js — Anode-to-earth resistance per Dwight & Sunde, vanilla JS.
 *
 * For impressed-current cathodic protection: the anode-bed resistance to remote
 * earth sets how much current the rectifier can drive at a given voltage.
 * Implements:
 *   - Dwight vertical single-anode resistance.
 *   - Dwight horizontal single-anode resistance.
 *   - Sunde multiple-anode bed (n vertical anodes spaced s apart) with mutual
 *     interference.
 *   - Current-from-voltage Ohm's-law solve.
 *
 * Sources cited in `ref`:
 *   - H.B. Dwight, "Calculation of Resistances to Ground," AIEE Trans. 55 (1936) 1319.
 *   - E.D. Sunde, "Earth Conduction Effects in Transmission Systems," Van Nostrand
 *     (1949) — multi-rod formula chapter.
 *   - NACE SP0169 §6.5 — Recommended Practice for buried-steel CP design.
 *   - IEEE Std 81 — IEEE Guide for Measuring Earth Resistivity / Ground Impedance.
 *
 * Units: SI throughout. ρ in Ω·m, L in m, d (anode diameter) in m, s (spacing
 * or burial depth) in m. Returns R in Ω.
 */
(function (root) {
  "use strict";

  /** Vertical anode (rod) in uniform soil — Dwight (1936). */
  function vertical(opts) {
    var rho = +opts.rho_ohm_m, L = +opts.L_m, d = +opts.d_m;
    if (!(rho > 0 && L > 0 && d > 0)) return { error: "rho, L, d must be > 0" };
    var R = (rho / (2 * Math.PI * L)) * (Math.log(8 * L / d) - 1);
    return { type: "vertical (Dwight)", rho_ohm_m: rho, L_m: L, d_m: d, R_ohm: R,
             ref: "Dwight, AIEE Trans. 55 (1936) 1319; NACE SP0169 §6.5." };
  }

  /** Horizontal anode buried at depth s — Dwight horizontal form. */
  function horizontal(opts) {
    var rho = +opts.rho_ohm_m, L = +opts.L_m, d = +opts.d_m, s = +opts.s_m;
    if (!(rho > 0 && L > 0 && d > 0 && s > 0)) return { error: "rho, L, d, s must be > 0" };
    var R = (rho / (2 * Math.PI * L)) * (Math.log(4 * L * L / (s * d)) - 1);
    return { type: "horizontal (Dwight)", rho_ohm_m: rho, L_m: L, d_m: d, s_m: s, R_ohm: R,
             ref: "Dwight, AIEE Trans. 55 (1936) 1319; horizontal-electrode case." };
  }

  /** n vertical anodes in a row, spacing s apart — Sunde (1949).
   *  R = (ρ / (2πnL))·(ln(8L/d) − 1) + (ρ / (πns))·(ln(0.656·n))
   *  for s >> L is OK; tighter spacings give larger mutual term. */
  function sundeMulti(opts) {
    var rho = +opts.rho_ohm_m, L = +opts.L_m, d = +opts.d_m, s = +opts.s_m, n = +opts.n;
    if (!(rho > 0 && L > 0 && d > 0 && s > 0 && n >= 1)) return { error: "rho, L, d, s, n required" };
    var self_term = (rho / (2 * Math.PI * n * L)) * (Math.log(8 * L / d) - 1);
    var mutual = n > 1 ? (rho / (Math.PI * n * s)) * Math.log(0.656 * n) : 0;
    var R = self_term + Math.max(0, mutual);   // mutual ≥ 0
    return {
      type: "vertical bed, n anodes (Sunde)",
      rho_ohm_m: rho, L_m: L, d_m: d, s_m: s, n: n,
      R_self_ohm: self_term, R_mutual_ohm: mutual, R_ohm: R,
      ref: "Sunde 1949, Earth-Conduction Effects (Van Nostrand) — multi-rod formula; "
         + "NACE SP0169 §6.5; IEEE Std 81 (resistivity measurement)."
    };
  }

  /** I = ΔV / R_total, with optional CP-circuit resistance R_circuit
   *  (cable + structure-to-earth + connection) added in series. */
  function currentDemand(opts) {
    var R_bed = +opts.R_bed_ohm, V = +opts.V_driving, R_extra = +(opts.R_circuit_ohm || 0);
    var R = R_bed + R_extra;
    if (!(R > 0)) return { error: "non-positive total resistance" };
    return { R_bed_ohm: R_bed, R_circuit_ohm: R_extra, R_total_ohm: R,
             V_driving_V: V, I_A: V / R,
             ref: "Ohm's law on the bed-to-structure CP circuit (NACE SP0169)." };
  }

  /* WORKED EXAMPLE (NACE SP0169 Appx-A typical):
   *  ρ = 50 Ω·m soil, 3 m long 50 mm diameter graphite anode:
   *  R_v = (50/(2π·3))·(ln(8·3/0.050) − 1) = 2.652·(6.165 − 1) = 13.7 Ω.
   *  Three-anode bed at 3 m spacing:
   *  self = (50/(2π·3·3))·5.165 = 4.57 Ω
   *  mutual = (50/(π·3·3))·ln(0.656·3) = 1.767·0.677 = 1.20 Ω
   *  R_bed = 5.77 Ω. At 50 V driving → I = 8.67 A. */

  var Groundbed = { vertical: vertical, horizontal: horizontal, sundeMulti: sundeMulti,
                    currentDemand: currentDemand };
  root.Groundbed = Groundbed;
  if (typeof module !== "undefined" && module.exports) module.exports = Groundbed;
})(typeof window !== "undefined" ? window : this);
