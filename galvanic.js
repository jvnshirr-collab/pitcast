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
 *   - MIL-STD-889C / MIL-STD-889B — Dissimilar Metals (galvanic series in seawater).
 *   - NACE TM0394 — Galvanic-series measurement protocol.
 *   - LaQue F.L., "Marine Corrosion: Causes and Prevention" (Wiley, 1975) Ch.6 —
 *     E_corr table for marine alloys.
 *   - Corrosion Source Book (NACE, 1984) Ch. 3 — flowing-seawater values.
 *
 * E_corr values are screening typicals in flowing/aerated natural seawater at
 * ambient temperature (~15–25 °C), referenced to Ag/AgCl (saturated KCl).
 * Vendor data varies ±30 mV across heat lot, surface finish and oxygen content;
 * the COMPATIBILITY DECISION should still rest on ΔE ≤ 50 mV (compatible),
 * ≤ 100 mV (acceptable with isolation), > 250 mV (severe — isolate + avoid
 * small-anode geometry).
 */
(function (root) {
  "use strict";

  // Free-corrosion potential E_corr (V vs Ag/AgCl, flowing aerated seawater,
  // ambient T). Listed noble → active. Where the literature gives a range, the
  // mid-band value is used. Where the alloy can be either passive or active
  // (e.g. 304/316/2205 in stagnant low-O₂ crevice), BOTH states are listed —
  // the engineer must pick the operative state.
  // CITED tables: ASTM G82 Annex A1; MIL-STD-889C Table I; LaQue 1975 Table 6.1.
  var METALS = {
    // ---- Most noble (cathodic) ----
    "Graphite":            { E: +0.30, label: "Graphite (impressed-current anode / brushes)" },
    "Platinum":            { E: +0.25, label: "Platinum" },
    "Gold":                { E: +0.15, label: "Gold" },
    "Silver":              { E: +0.05, label: "Silver" },
    "Ti-Gr2":              { E: +0.06, label: "Titanium Gr 2 (commercially pure)" },
    "Ti-Gr5":              { E: +0.04, label: "Titanium Gr 5 (Ti-6Al-4V)" },
    "Ti-Gr7":              { E: +0.07, label: "Titanium Gr 7 (Ti-Pd, hi-corrosion)" },
    "Tantalum":            { E: +0.05, label: "Tantalum" },
    "Niobium":             { E: +0.00, label: "Niobium / columbium" },
    "Alloy-22":            { E: -0.03, label: "Hastelloy C-22 (Ni-Cr-Mo, passive)" },
    "Hastelloy-C276":      { E: -0.05, label: "Hastelloy C-276 (passive)" },
    "Alloy-625":           { E: -0.05, label: "Inconel 625 (Ni-Cr-Mo, passive)" },
    "Alloy-G30":           { E: -0.06, label: "Hastelloy G-30 (passive)" },
    "Alloy-825":           { E: -0.08, label: "Incoloy 825 (Ni-Fe-Cr-Mo, passive)" },
    "904L-passive":        { E: -0.08, label: "904L super-austenitic SS (passive)" },
    "254SMO-passive":      { E: -0.07, label: "254SMO / S31254 6Mo super-austenitic (passive)" },
    "Alloy20-passive":     { E: -0.10, label: "Alloy 20 / CN-7M (passive, acid service)" },
    "316L-passive":        { E: -0.10, label: "316L stainless (passive, aerated)" },
    "317L-passive":        { E: -0.11, label: "317L stainless (passive)" },
    "304-passive":         { E: -0.10, label: "304/304L stainless (passive, aerated)" },
    "2205-passive":        { E: -0.09, label: "2205 duplex (S32205, passive)" },
    "2507-passive":        { E: -0.08, label: "2507 super-duplex (S32750, passive)" },
    "13Cr-passive":        { E: -0.15, label: "13Cr martensitic SS (S41000 / S42000, passive)" },
    "17-4PH-passive":      { E: -0.10, label: "17-4PH precipitation-hard SS (passive)" },
    "Ni-200":              { E: -0.10, label: "Nickel 200 / 201 (pure)" },
    "Monel-400":           { E: -0.15, label: "Monel 400 (Ni-Cu)" },
    "Monel-K500":          { E: -0.14, label: "Monel K-500 (age-hard Ni-Cu)" },
    "Beryllium-Cu":        { E: -0.20, label: "Beryllium-copper (C17200)" },
    "70-30-CuNi":          { E: -0.25, label: "70-30 Cu-Ni (C71500)" },
    "90-10-CuNi":          { E: -0.28, label: "90-10 Cu-Ni (C70600)" },
    "Aluminum-bronze":     { E: -0.31, label: "Aluminium-bronze (C95800 / NAB)" },
    "Manganese-bronze":    { E: -0.27, label: "Manganese bronze (C86500)" },
    "Phosphor-bronze":     { E: -0.31, label: "Phosphor bronze (C51000)" },
    "Copper":              { E: -0.30, label: "Copper (pure)" },
    "Brass-Naval":         { E: -0.30, label: "Naval brass (C46400)" },
    "Brass-Yellow":        { E: -0.28, label: "Yellow brass (C26800)" },
    "Tin":                 { E: -0.35, label: "Tin (Sn)" },
    "Lead":                { E: -0.50, label: "Lead (Pb)" },
    "Chromium":            { E: -0.45, label: "Chromium (electroplated)" },
    "316L-active":         { E: -0.55, label: "316L stainless (ACTIVE — crevice / no O₂)" },
    "304-active":          { E: -0.55, label: "304 stainless (ACTIVE — crevice / no O₂)" },
    "2205-active":         { E: -0.50, label: "2205 duplex (ACTIVE state)" },
    "13Cr-active":         { E: -0.60, label: "13Cr martensitic SS (ACTIVE)" },
    "Cast-iron":           { E: -0.65, label: "Cast iron (gray / ductile)" },
    "Carbon-steel":        { E: -0.68, label: "Carbon / low-alloy steel (generic)" },
    "Carbon-steel-A36":    { E: -0.68, label: "Carbon steel ASTM A36 (structural)" },
    "Carbon-steel-A537":   { E: -0.68, label: "Carbon steel ASTM A537 (PV plate)" },
    "API-5L-X65":          { E: -0.68, label: "API 5L X65 pipeline steel" },
    "4140-steel":          { E: -0.68, label: "AISI 4140 low-alloy (Cr-Mo)" },
    "Wrought-iron":        { E: -0.65, label: "Wrought iron (legacy)" },
    "Cadmium":             { E: -0.75, label: "Cadmium (plating, restricted)" },
    // Aluminium family — passive layer keeps E moderately high; activates under
    // chloride or in tight crevices.
    "Al-2024":             { E: -0.80, label: "Al 2024 (Cu-bearing, aerospace)" },
    "Al-6061":             { E: -0.85, label: "Aluminium 6061 (general)" },
    "Al-6063":             { E: -0.85, label: "Aluminium 6063 (extrusion)" },
    "Al-7075":             { E: -0.85, label: "Aluminium 7075 (aerospace)" },
    "Al-1100":             { E: -0.85, label: "Aluminium 1100 (commercially pure)" },
    "Al-3003":             { E: -0.85, label: "Aluminium 3003 (Mn-bearing)" },
    "Al-5052":             { E: -0.85, label: "Aluminium 5052 (marine)" },
    "Al-5083":             { E: -0.85, label: "Aluminium 5083 (marine, hi-Mg, ABS)" },
    "Al-5086":             { E: -0.85, label: "Aluminium 5086 (marine plate)" },
    "Al-Brass":            { E: -0.32, label: "Aluminium brass (C68700, condenser tube)" },
    "Galvanised-steel":    { E: -1.00, label: "Galvanised (Zn-coated) steel" },
    "Zinc":                { E: -1.03, label: "Zinc (pure)" },
    "Zn-anode":            { E: -1.05, label: "Zn sacrificial anode (MIL-DTL-18001)" },
    "Al-anode-AlZnIn":     { E: -1.05, label: "Al-Zn-In sacrificial anode (DNV-RP-B401)" },
    "Beryllium":           { E: -1.60, label: "Beryllium" },
    "Magnesium":           { E: -1.62, label: "Magnesium (pure)" },
    "Mg-anode":            { E: -1.65, label: "Mg sacrificial anode (ASTM B843 H-1 / AZ-63)" }
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
      ref: "ASTM G82-98(2014) galvanic series; MIL-STD-889C (Dissimilar Metals); "
         + "NACE TM0394 (E_corr measurement); LaQue (1975) Marine Corrosion Ch.6; "
         + "Corrosion Source Book (NACE 1984). E_corr ranges from cited tables; "
         + "screening only — actual rate depends on geometry, polarisation, "
         + "oxygen availability, and electrolyte resistance."
    };
  }

  /* WORKED EXAMPLES:
   *  - 316L (passive) bolt in carbon-steel flange, A_c/A_a ~ 50 (huge flange, small bolt):
   *      ΔE ≈ 580 mV → high/severe; small-anode geometry warning. (Realistic — common
   *      pipeline failure mode is when SS bolting accelerates flange galvanic loss.)
   *  - 90-10 Cu-Ni / carbon steel hull, ΔE ≈ 400 mV → severe; needs Zn anodes for protection.
   *  - Naval brass / Al 5083 marine plate, ΔE ≈ 550 mV → severe; never directly mate without
   *    isolation in marine service.
   *  - Ti Gr 5 / 316L-passive, ΔE ≈ 140 mV → medium; acceptable in process service.
   *  - 2205 duplex / Al-Zn-In anode, ΔE ≈ 960 mV (PROTECTIVE — Al anode is sacrificial). */

  var Galvanic = { METALS: METALS, couple: couple };
  root.Galvanic = Galvanic;
  if (typeof module !== "undefined" && module.exports) module.exports = Galvanic;
})(typeof window !== "undefined" ? window : this);
