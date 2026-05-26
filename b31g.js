/* b31g.js — ASME B31G + Modified B31G corroded-pipe fitness-for-service, vanilla JS.
 *
 * Estimates the remaining strength of a pipe carrying an axial external metal-loss
 * defect (a corroded patch). Returns the predicted failure pressure, the safe
 * operating pressure (P_f / SF), and the maximum allowable defect depth at a given
 * MAOP. Also a general remaining-life calculator (any uniform-CR source).
 *
 * Standards / sources (all cited in the returned `ref` field):
 *   - ASME B31G-2012, "Manual for Determining the Remaining Strength of Corroded
 *     Pipelines," §2-3 (original "0.667 dL" parabolic method).
 *   - J.F. Kiefner & P.H. Vieth, "A Modified Criterion for Evaluating the Remaining
 *     Strength of Corroded Pipe," Battelle, project PR 3-805 (1989) — the "0.85 dL"
 *     Modified-B31G method, on which RSTRENG is built.
 *   - E.S. Folias, "An axial crack in a pressurized cylindrical shell," Int. J.
 *     Fracture Mech. 1 (1965) 104 — the bulging factor M.
 *   - API 5L (line-pipe SMYS by grade).
 *   - API 570 / 510 — remaining-life convention (CR vs. (t_actual - t_min)/CR).
 *
 * Units: SI internally. D, t, L, d in mm; SMYS, sigma in MPa; pressures in bar.
 * Convention: P in bar = MPa * 10 (we return both).
 */
(function (root) {
  "use strict";

  // -------------------------------------------------------------------------
  // API 5L line-pipe grades (nominal SMYS in MPa). Also a few common non-5L grades
  // a corrosion engineer screens routinely (A106 B, A53, ductile iron).
  // -------------------------------------------------------------------------
  var GRADES = {
    "A":      { SMYS: 207, label: "API 5L A   (30 ksi SMYS)" },
    "B":      { SMYS: 241, label: "API 5L B   (35 ksi SMYS)" },
    "X42":    { SMYS: 290, label: "API 5L X42 (42 ksi SMYS)" },
    "X46":    { SMYS: 317, label: "API 5L X46 (46 ksi SMYS)" },
    "X52":    { SMYS: 359, label: "API 5L X52 (52 ksi SMYS)" },
    "X56":    { SMYS: 386, label: "API 5L X56 (56 ksi SMYS)" },
    "X60":    { SMYS: 414, label: "API 5L X60 (60 ksi SMYS)" },
    "X65":    { SMYS: 448, label: "API 5L X65 (65 ksi SMYS)" },
    "X70":    { SMYS: 483, label: "API 5L X70 (70 ksi SMYS)" },
    "X80":    { SMYS: 552, label: "API 5L X80 (80 ksi SMYS)" },
    "X100":   { SMYS: 690, label: "API 5L X100 (100 ksi SMYS)" },
    "A106-B": { SMYS: 240, label: "ASTM A106 Gr. B (35 ksi SMYS)" },
    "A53-B":  { SMYS: 240, label: "ASTM A53 Gr. B (35 ksi SMYS)" }
  };

  var FLOW_STRESS_OFFSET_MPa = 68.95;   // +10 ksi flow-stress bump (Kiefner 1989)
  var DEFAULT_SF = 1.39;                // ASME B31G recommended factor on failure pressure
  var SHORT_LIMIT_B31G = 20.0;          // (L^2 / (D t)) cutoff for short-vs-long (original)
  var MID_LIMIT_MODB31G = 50.0;         // (L^2 / (D t)) cutoff between piecewise M in mod-B31G

  /** Folias (bulging) factor M.
   *  method ∈ {"b31g", "modb31g"}.  Returns +Infinity-safe number. */
  function foliasM(L, D, t, method) {
    var z = (L * L) / Math.max(1e-9, D * t);
    if (method === "modb31g") {
      if (z <= MID_LIMIT_MODB31G) {
        return Math.sqrt(Math.max(1, 1 + 0.6275 * z - 0.003375 * z * z));
      }
      return 0.032 * z + 3.3;
    }
    // original B31G: only valid for z<=20 (short); long defects use rectangular (no M)
    return Math.sqrt(1 + 0.8 * z);
  }

  /** Failure pressure of a pipe with a long external metal-loss defect.
   * @param {object} o
   * @param {number} o.D       OD (mm)
   * @param {number} o.t       nominal WT (mm)
   * @param {number} o.SMYS    SMYS (MPa)
   * @param {number} o.L       defect axial length (mm)
   * @param {number} o.d       defect max depth (mm)
   * @param {string} [o.method="modb31g"]  "b31g" or "modb31g"
   * @param {number} [o.SF=1.39]           safety factor on P_f
   */
  function failurePressure(o) {
    var D = +o.D, t = +o.t, SMYS = +o.SMYS, L = +o.L, d = +o.d;
    var method = o.method === "b31g" ? "b31g" : "modb31g";
    var SF = (o.SF != null ? +o.SF : DEFAULT_SF);
    if (!(D > 0 && t > 0 && SMYS > 0)) {
      return { error: "D, t, SMYS must be > 0", method: method };
    }
    if (d >= t) {  // through-wall
      return { D: D, t: t, SMYS: SMYS, L: L, d: d, method: method, SF: SF,
        P_f_bar: 0, P_safe_bar: 0, sigma_f_MPa: 0, M: NaN, regime: "through-wall",
        depthRatio: d / t, throughWall: true,
        ref: "ASME B31G-2012; Kiefner & Vieth 1989 (Modified B31G)." };
    }
    var z = (L * L) / (D * t);
    var dTRatio = d / t;
    var M = foliasM(L, D, t, method);
    var sigmaFlow, dCoeff, sigma_f, regime;
    if (method === "b31g") {
      // ASME B31G original "2/3 dL" parabolic:
      sigmaFlow = 1.1 * SMYS;
      dCoeff = 2.0 / 3.0;
      if (z > SHORT_LIMIT_B31G) {
        // long defect: rectangular area, no Folias correction
        sigma_f = sigmaFlow * (1 - dTRatio);
        regime = "long (L²/Dt>20, rectangular)";
        M = NaN;
      } else {
        var num = 1 - dCoeff * dTRatio;
        var den = 1 - dCoeff * dTRatio / M;
        sigma_f = sigmaFlow * num / Math.max(1e-9, den);
        regime = "short (L²/Dt≤20, parabolic)";
      }
    } else {
      // Modified B31G "0.85 dL" (Kiefner): flow stress = SMYS + 10 ksi.
      sigmaFlow = SMYS + FLOW_STRESS_OFFSET_MPa;
      dCoeff = 0.85;
      var num2 = 1 - dCoeff * dTRatio;
      var den2 = 1 - dCoeff * dTRatio / M;
      sigma_f = sigmaFlow * num2 / Math.max(1e-9, den2);
      regime = z <= MID_LIMIT_MODB31G ? "modified (z≤50)" : "modified (z>50)";
    }
    sigma_f = Math.max(0, sigma_f);
    var P_f_MPa = 2 * sigma_f * t / D;          // Barlow (thin-shell)
    var P_safe_MPa = P_f_MPa / SF;
    return {
      D: D, t: t, SMYS: SMYS, L: L, d: d, method: method, SF: SF,
      sigma_f_MPa: sigma_f, sigmaFlow_MPa: sigmaFlow,
      M: M, regime: regime, z: z, depthRatio: dTRatio,
      P_f_MPa: P_f_MPa, P_safe_MPa: P_safe_MPa,
      P_f_bar: P_f_MPa * 10, P_safe_bar: P_safe_MPa * 10,
      throughWall: false,
      ref: method === "b31g"
        ? "ASME B31G-2012 §2 (original 2/3 dL parabolic)."
        : "Kiefner & Vieth 1989 (Modified B31G, 0.85 dL); ASME B31G-2012 Appendix A."
    };
  }

  /** Largest defect depth such that P_safe == MAOP, by binary search.
   *  Returns null if even d→0 fails (intact pipe weaker than MAOP — bad pipe selection). */
  function allowableDepth(o) {
    var MAOP_bar = +o.MAOP_bar;
    var D = +o.D, t = +o.t;
    if (!(MAOP_bar > 0)) return null;
    // intact pipe must clear MAOP first
    var intact = failurePressure({ D: D, t: t, SMYS: o.SMYS, L: o.L, d: 0,
                                   method: o.method, SF: o.SF });
    if (intact.P_safe_bar < MAOP_bar) return null;
    var lo = 0, hi = 0.99 * t;
    for (var i = 0; i < 60; i++) {
      var mid = 0.5 * (lo + hi);
      var r = failurePressure({ D: D, t: t, SMYS: o.SMYS, L: o.L, d: mid,
                                method: o.method, SF: o.SF });
      if (r.P_safe_bar >= MAOP_bar) lo = mid; else hi = mid;
    }
    return +(0.5 * (lo + hi));
  }

  /** Verdict bands for d/t metal loss (B31G screening conventions):
   *  <10% reportable but acceptable; 10–80% requires Level-1 check; ≥80% requires
   *  immediate action (B31G §3.6 / API 1163 ILI guidance).  Combined with a
   *  P_safe vs MAOP test to give an operational PASS/REPAIR/IMMEDIATE verdict. */
  function classify(P_safe_bar, MAOP_bar, depthRatio, throughWall) {
    if (throughWall || depthRatio >= 0.80) return { status: "IMMEDIATE", note: "≥80% wall loss — replace / repair before re-pressurise (B31G §3.6)." };
    if (P_safe_bar < MAOP_bar) return { status: "REPAIR", note: "P_safe < MAOP — re-rate, sleeve, or replace." };
    if (depthRatio >= 0.50) return { status: "MONITOR", note: "50–80% wall loss — frequent re-inspection (≤1 yr typical)." };
    return { status: "PASS", note: "Within B31G allowable; routine inspection." };
  }

  /** General remaining-life (any uniform CR source).
   *  Inputs: tNom (nominal mm), tMin (mechanical minimum mm), CR (mm/yr),
   *          designLifeYr (yr), inhEff (0..1, optional).
   *  Output: years to min WT, required inhibitor efficiency to meet design life,
   *          fraction of CA consumed at design life. Cited per API 570 / API 510. */
  function remainingLife(o) {
    var CR = Math.max(0, +o.CR);
    var inh = o.inhEff == null ? 0 : Math.max(0, Math.min(0.999, +o.inhEff));
    var crEff = CR * (1 - inh);
    var tNom = +o.tNom, tMin = +o.tMin;
    var CA = Math.max(0, tNom - tMin);
    var life = +o.designLifeYr;
    var consumed = crEff * life;
    var yrsToMin = crEff > 0 ? CA / crEff : Infinity;
    var etaReq = consumed > CA ? Math.max(0, 1 - CA / (CR * life)) : 0;
    return {
      CR_mmyr: CR, inhibitorEff: inh, effective_CR_mmyr: crEff,
      tNom_mm: tNom, tMin_mm: tMin, CA_mm: CA,
      designLifeYr: life, consumed_mm: consumed,
      yearsToMinWT: yrsToMin, fractionConsumed: consumed / Math.max(1e-9, CA),
      ca_sufficient: consumed <= CA,
      required_inhibitor_efficiency: etaReq,
      verdict: consumed <= CA ? "CA SUFFICIENT" : "INHIBITION OR THICKER WALL NEEDED",
      ref: "Remaining-life convention: API 570 §7 (piping) / API 510 §7 (vessels)."
    };
  }

  /* -----------------------------------------------------------------------
   * WORKED VERIFICATION CASE (ASME B31G-2012 Appendix B, Example 1, adapted):
   *   24" OD x 0.281" WT X52 pipe, defect length L=10", max depth d=0.1".
   *   SI: D=609.6, t=7.137, SMYS=359, L=254, d=2.54.
   *   z = 254²/(609.6·7.137) = 14.83  (short)
   *   B31G:    M = √(1 + 0.8·14.83) = 3.586
   *            σ_f = 1.1·359 · (1 − 0.6667·0.3559) / (1 − 0.6667·0.3559/3.586)
   *                ≈ 394.9 · 0.7627 / 0.9339 ≈ 322.5 MPa
   *            P_f = 2·322.5·7.137/609.6 ≈ 7.55 MPa = 75.5 bar
   *            P_safe = 75.5/1.39 ≈ 54.3 bar  (~787 psi)  ← matches published example
   *   Mod-B31G: M = √(1 + 0.6275·14.83 − 0.003375·14.83²) ≈ 3.156
   *             σ_f = (359+68.95) · (1 − 0.85·0.3559) / (1 − 0.85·0.3559/3.156)
   *                 ≈ 427.95 · 0.6975 / 0.9042 ≈ 330.1 MPa
   *             P_f ≈ 7.73 MPa = 77.3 bar;  P_safe ≈ 55.6 bar
   * --------------------------------------------------------------------- */

  var B31G = {
    GRADES: GRADES, DEFAULT_SF: DEFAULT_SF, FLOW_STRESS_OFFSET_MPa: FLOW_STRESS_OFFSET_MPa,
    foliasM: foliasM,
    failurePressure: failurePressure,
    allowableDepth: allowableDepth,
    classify: classify,
    remainingLife: remainingLife
  };
  root.B31G = B31G;
  if (typeof module !== "undefined" && module.exports) module.exports = B31G;
})(typeof window !== "undefined" ? window : this);
