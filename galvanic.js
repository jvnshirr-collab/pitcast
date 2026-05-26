/* galvanic.js — Galvanic couple risk screen, vanilla JS.
 *
 * Two-metal couple in a shared electrolyte. The less-noble member (anode)
 * dissolves; the more-noble (cathode) is protected. The driving force is the
 * free-corrosion potential difference ΔE in that electrolyte; the rate on the
 * anode is amplified when the cathode area is much larger than the anode area
 * (the classic "small-anode / large-cathode" failure pattern).
 *
 * Sources cited in `ref`:
 *   - ASTM G82-98(2014) — Standard Guide for Development and Use of a Galvanic
 *     Series for Predicting Galvanic Corrosion Performance.
 *   - MIL-STD-889B — Dissimilar Metals (galvanic series in seawater).
 *   - NACE TM0394 — Galvanic-series measurement protocol.
 *   - LaQue, "Marine Corrosion: Causes and Prevention" — typical E_corr values.
 *
 * E_corr values below are screening typicals in flowing seawater at ambient
 * temperature, vs. Ag/AgCl (saturated KCl). Source-specific values vary ±30 mV.
 */
(function (root) {
  "use strict";

  // Free-corrosion potential E_corr (V vs Ag/AgCl, seawater, ambient).
  // Sorted noble→active (top noble, bottom active).
  var METALS = {
    "Graphite":         { E: +0.30, label: "Graphite" },
    "Platinum":         { E: +0.25, label: "Platinum" },
    "Titanium-Gr2":     { E: +0.06, label: "Titanium Gr 2" },
    "Hastelloy C-276":  { E: -0.05, label: "Hastelloy C-276 (passive)" },
    "Inconel-625":      { E: -0.05, label: "Inconel 625 (passive)" },
    "316L-passive":     { E: -0.10, label: "316L stainless (passive)" },
    "304-passive":      { E: -0.10, label: "304 stainless (passive)" },
    "Nickel-200":       { E: -0.10, label: "Nickel 200" },
    "Monel-400":        { E: -0.15, label: "Monel 400 (Ni-Cu)" },
    "70-30-CuNi":       { E: -0.25, label: "70-30 Cu-Ni" },
    "90-10-CuNi":       { E: -0.28, label: "90-10 Cu-Ni" },
    "Copper":           { E: -0.30, label: "Copper / brass / bronze" },
    "Tin":              { E: -0.35, label: "Tin" },
    "Lead":             { E: -0.50, label: "Lead" },
    "316L-active":      { E: -0.55, label: "316L stainless (ACTIVE — crevice / no O2)" },
    "Cast-iron":        { E: -0.65, label: "Cast iron" },
    "Carbon-steel":     { E: -0.68, label: "Carbon / low-alloy steel" },
    "Aluminum-6061":    { E: -0.85, label: "Aluminium 6061" },
    "Galvanised-steel": { E: -1.00, label: "Galvanised (Zn-coated) steel" },
    "Zinc":             { E: -1.03, label: "Zinc" },
    "Magnesium":        { E: -1.62, label: "Magnesium" }
  };

  /** Galvanic couple risk.
   * @param {object} o
   * @param {string} o.a    member A key (METALS)
   * @param {string} o.b    member B key
   * @param {number} o.areaRatio  A_cathode / A_anode (≥1 = small anode, worst case)
   */
  function couple(o) {
    o = o || {};
    var A = METALS[o.a], B = METALS[o.b];
    if (!A || !B) return { error: "unknown metal", a: o.a, b: o.b };
    // anode = less noble (lower E)
    var anode = A.E < B.E ? { k: o.a, m: A } : { k: o.b, m: B };
    var cath  = A.E < B.E ? { k: o.b, m: B } : { k: o.a, m: A };
    var dE_V = Math.abs(A.E - B.E);                       // mV-scale driver
    var dE_mV = dE_V * 1000;
    var rA = +o.areaRatio; if (!(rA > 0)) rA = 1;
    // Area-ratio amplifier on the anode dissolution rate (qualitative, log-linear).
    var areaMult = 1 + Math.log10(Math.max(1, rA));        // 1× at parity, ~2× at A_c/A_a=10, ~3× at 100
    // Risk band — driven by ΔE, modulated by area ratio.
    var raw;
    if (dE_mV < 50)      raw = 0.10;
    else if (dE_mV < 100) raw = 0.30;
    else if (dE_mV < 250) raw = 0.60;
    else if (dE_mV < 500) raw = 0.85;
    else                  raw = 1.10;
    var score = Math.min(2.0, raw * Math.max(1, areaMult * 0.7));
    var level = score < 0.20 ? "low"
              : score < 0.55 ? "medium"
              : score < 1.00 ? "high" : "severe";
    var msg;
    if (dE_mV < 50) msg = "ΔE < 50 mV — compatible; no isolation required for typical service.";
    else if (dE_mV < 100) msg = "ΔE 50–100 mV — minor galvanic; consider isolation where ingress likely.";
    else if (dE_mV < 250) msg = "ΔE 100–250 mV — galvanic likely; electrically isolate (gasket / spool / coating).";
    else msg = "ΔE > 250 mV — severe; isolate, and avoid small-anode geometries entirely.";
    if (rA > 10) msg += " Cathode/anode area ratio " + rA.toFixed(0) + "× — small-anode amplification: dissolution on " + anode.m.label + " will concentrate at the smallest exposed feature.";
    return {
      a: o.a, b: o.b,
      anode: anode.m.label, anode_E: anode.m.E,
      cathode: cath.m.label, cathode_E: cath.m.E,
      deltaE_mV: dE_mV, areaRatio: rA, areaMultiplier: areaMult,
      score: score, level: level,
      note: msg,
      ref: "ASTM G82-98(2014) galvanic series; MIL-STD-889B (Dissimilar Metals); "
         + "NACE TM0394 (E_corr measurement). Screening only — actual rate depends "
         + "on geometry, polarisation, oxygen availability, and electrolyte resistance."
    };
  }

  /* WORKED EXAMPLES:
   *  - 316L (passive) bolt in carbon-steel flange, A_c/A_a ~ 50 (huge flange, small bolt):
   *      ΔE ≈ 580 mV → high/severe; small-anode geometry warning. (Realistic — common
   *      pipeline failure mode is when SS bolting accelerates flange galvanic loss.)
   *  - Copper / 316L passive, ΔE ≈ 200 mV → medium-high; classic copper-tube-with-SS-fitting issue.
   *  - 90-10 Cu-Ni / carbon steel hull, ΔE ≈ 400 mV → severe; needs Zn anodes for protection. */

  var Galvanic = { METALS: METALS, couple: couple };
  root.Galvanic = Galvanic;
  if (typeof module !== "undefined" && module.exports) module.exports = Galvanic;
})(typeof window !== "undefined" ? window : this);
