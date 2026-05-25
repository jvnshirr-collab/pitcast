/* CPAC — Cathodic-Protection criteria + AC-corrosion screening for buried
   carbon-steel pipelines. Self-contained vanilla JS; attaches to window.CPAC.
   No imports / exports / requires / deps. Screening-grade — every result
   carries the governing standard in a `ref` field and order-of-magnitude
   outputs are explicitly flagged "indicative".

   Scope: external corrosion control of buried/submerged carbon-steel pipe
   under impressed-current or galvanic CP, with stray/induced AC interference.
   This is the corrosion engineer's daily toolkit (AMPP CP-4 syllabus): is the
   pipe protected per SP0169, and is AC corrosion a threat per ISO 18086?

   ---------------------------------------------------------------------------
   PROVENANCE
   ---------------------------------------------------------------------------
   The SP0169 criterion logic + clause citations are ported from the repo's
   Python reference  austenite/strategy/applications/17_cathodic_protection.py
   (assess_cathodic). The AC-corrosion / ISO 18086 / holiday spread-resistance
   physics did not exist anywhere in the repo and is implemented here directly
   from the standards (ISO 18086:2019; AMPP/NACE SP21424; spread-resistance
   theory). House style matches pitcast.js (window namespace, cited constants).

   ---------------------------------------------------------------------------
   SIGN CONVENTION
   ---------------------------------------------------------------------------
   All pipe-to-soil potentials are in millivolts vs a saturated Cu/CuSO4
   reference electrode (CSE), the standard reference for buried steel. Values
   are NEGATIVE (more cathodic = more negative = more protected). So "more
   negative than -850 mV" means E <= -850 (e.g. -950 mV qualifies, -800 does
   not). Inputs may be passed with or without the sign; we normalise to
   negative since steel under CP is always cathodic.
*/

(function (root) {
  "use strict";

  // ===========================================================================
  // SECTION 1 — CP CRITERIA  (NACE/AMPP SP0169, formerly RP0169)
  // ===========================================================================
  //
  //  SP0169 §6.2.2 gives the accepted criteria for steel/cast-iron piping:
  //   (a) -850 mV vs CSE with the CP CURRENT APPLIED, provided IR drop (the
  //       ohmic error in the measurement) is accounted for. In practice the
  //       IR-free ("polarized") potential is taken as the INSTANT-OFF reading
  //       (NACE TM0497): cut the current and read before depolarization. The
  //       polarized potential must be <= -850 mV.
  //   (b) 100 mV of cathodic POLARIZATION — the difference between the
  //       instant-off (polarized) potential and the native/depolarized
  //       potential. Demonstrated by either polarization FORMATION or DECAY.
  //
  //  We implement BOTH and report which are met. The -850 mV "ON" potential
  //  (current-applied, IR-included) is reported for context but is NOT a
  //  compliant criterion by itself unless IR drop is shown negligible — we
  //  flag this explicitly (the classic field over-read trap).

  var CSE_THRESHOLD_MV   = -850.0;  // §6.2.2.1.1 polarized criterion
  var POLARIZATION_MV    =  100.0;  // §6.2.2.1.2 / §6.2.2.1.3 shift criterion
  var REF_SP0169 = "NACE/AMPP SP0169 (R2018) §6.2.2 — external corrosion " +
                   "control of buried/submerged metallic piping; " +
                   "measurement per NACE TM0497.";

  // Force a potential to the cathodic (negative) convention. Accepts -950,
  // 950, or "-950" and returns -950. null/undefined pass through unchanged.
  function _neg(mV) {
    if (mV === null || mV === undefined || mV === "") return null;
    var x = Number(mV);
    if (!isFinite(x)) return null;
    return x > 0 ? -x : x;
  }

  /**
   * cpCriteria — verdict against the SP0169 -850 mV and 100 mV criteria.
   *
   * @param {object} o
   * @param {number} o.Eon_mV         Pipe-to-soil ON potential (current applied,
   *                                   IR-INCLUDED), mV vs CSE. Optional.
   * @param {number} o.Einstantoff_mV Instant-off / polarized (IR-free)
   *                                   potential, mV vs CSE. This is the value
   *                                   the -850 mV criterion is judged on.
   * @param {number} o.Edepol_mV      Native or fully-depolarized potential,
   *                                   mV vs CSE. With Einstantoff this gives the
   *                                   100 mV polarization shift. Optional.
   * @returns {{meets850:boolean, meets100mV:boolean, polarized_mV:number,
   *            polarizationShift_mV:(number|null), irDrop_mV:(number|null),
   *            verdict:string, notes:string[], ref:string}}
   */
  function cpCriteria(o) {
    o = o || {};
    var Eon  = _neg(o.Eon_mV);
    var Eio  = _neg(o.Einstantoff_mV);
    var Edep = _neg(o.Edepol_mV);
    var notes = [];

    // The polarized potential is the instant-off if available; otherwise we
    // can only fall back to the ON potential and must warn that it is
    // IR-contaminated (over-reads how protected the pipe really is).
    var polarized, irDrop = null;
    if (Eio !== null) {
      polarized = Eio;
      if (Eon !== null) {
        irDrop = Eon - Eio;  // negative number: ON is more negative than OFF
        notes.push("IR drop = E_on - E_instant-off = " + irDrop.toFixed(0) +
                   " mV (ohmic error removed by using instant-off).");
      }
    } else if (Eon !== null) {
      polarized = Eon;
      notes.push("No instant-off supplied: judging -850 mV on the ON " +
                 "potential, which INCLUDES IR drop and can falsely pass. " +
                 "Per TM0497, confirm with an instant-off reading.");
    } else {
      return {
        meets850: false, meets100mV: false, polarized_mV: null,
        polarizationShift_mV: null, irDrop_mV: null,
        verdict: "INSUFFICIENT DATA",
        notes: ["Provide at least Einstantoff_mV (preferred) or Eon_mV."],
        ref: REF_SP0169
      };
    }

    // Criterion (a): polarized potential more negative than -850 mV CSE.
    var meets850 = polarized <= CSE_THRESHOLD_MV;

    // Criterion (b): >= 100 mV cathodic polarization (instant-off vs depol).
    // Depolarization shift = (native/depolarized) - (polarized). Both are
    // negative; a protected pipe is MORE negative when polarized, so the
    // shift is positive. E.g. depol -650, polarized -780 -> shift = 130 mV.
    var shift = null, meets100 = false;
    if (Edep !== null) {
      shift = Edep - polarized;
      meets100 = shift >= POLARIZATION_MV;
    } else {
      notes.push("No depolarized potential supplied: 100 mV criterion not " +
                 "evaluated (needs Edepol_mV from a depolarization survey).");
    }

    // Verdict: SP0169 protection is satisfied if EITHER criterion is met.
    var verdict;
    if (meets850 && meets100) {
      verdict = "PROTECTED (both -850 mV and 100 mV criteria met)";
    } else if (meets850) {
      verdict = "PROTECTED (-850 mV polarized criterion met)";
    } else if (meets100) {
      verdict = "PROTECTED (100 mV polarization criterion met)";
    } else {
      verdict = "NOT PROTECTED (no SP0169 criterion met)";
    }
    // Over-protection caution: polarized < -1100..-1200 mV risks coating
    // disbondment / hydrogen evolution on coated steel (SP0169 §6.2.5).
    if (polarized <= -1200) {
      notes.push("Polarized potential " + polarized.toFixed(0) + " mV is very " +
                 "negative (< -1200 mV CSE): screen for coating disbondment / " +
                 "hydrogen embrittlement (SP0169 §6.2.5).");
    }

    return {
      meets850: meets850,
      meets100mV: meets100,
      polarized_mV: polarized,
      polarizationShift_mV: shift,
      irDrop_mV: irDrop,
      verdict: verdict,
      notes: notes,
      ref: REF_SP0169
    };
  }

  // ===========================================================================
  // SECTION 2 — HOLIDAY (coating-defect) AC CURRENT-DENSITY MODEL
  // ===========================================================================
  //
  //  A modern pipeline is well coated; AC corrosion concentrates at small
  //  coating "holidays" (defects) where bare steel contacts soil. For a small
  //  CIRCULAR bare-steel disc of diameter d (m) flush with a half-space of
  //  uniform soil resistivity rho (ohm.m), the spread (earthing) resistance to
  //  remote earth is the classic disc-electrode result:
  //
  //        R_spread = rho / (2 * d)            [ohm]
  //
  //  (Equivalently rho/(4*a) with a = d/2 = radius — same thing.) The AC
  //  current driven through the defect by an AC touch voltage Vac (pipe-to-
  //  remote-earth AC, V) is I = Vac / R_spread, and the defect area is
  //  A = pi*d^2/4, so the AC current DENSITY at the holiday is:
  //
  //        Jac = I / A = (Vac / (rho/(2d))) / (pi*d^2/4)
  //            = (2 d Vac / rho) * 4/(pi d^2)
  //            = 8 * Vac / (rho * pi * d)        [A/m^2]
  //
  //  This is the standard circular-defect spread-resistance form used in
  //  ISO 18086 / AMPP AC-corrosion practice and in the literature (Büchler;
  //  the 1-cm^2 coupon convention d ≈ 0.0113 m underlies field AC coupons).
  //
  //  ASSUMPTIONS (state them): uniform isotropic soil; defect small vs burial
  //  depth and pipe diameter (half-space, no proximity correction); circular
  //  bare-steel defect; the soil spread resistance dominates over the metal/
  //  electrolyte interface impedance; Vac is the steady AC pipe-to-earth touch
  //  voltage. Real holidays are irregular and films form — treat as screening.

  var REF_HOLIDAY = "Spread-resistance (disc-electrode) model R=rho/(2d); " +
                    "Jac=8*Vac/(rho*pi*d). Circular coating-defect convention " +
                    "per ISO 18086:2019 Annex / AMPP AC-corrosion practice.";

  /**
   * holidayJac — AC current density at a circular coating defect.
   * @param {number} Vac            AC touch voltage (pipe-to-remote-earth), V.
   * @param {number} soilResistivity Soil resistivity rho, ohm.m.
   * @param {number} d_m            Holiday diameter, m.
   * @returns {{jac:number, rSpread:number, current_A:number, area_m2:number,
   *            ref:string}}
   */
  function holidayJac(Vac, soilResistivity, d_m) {
    var rho = Number(soilResistivity), d = Number(d_m), V = Number(Vac);
    var rSpread = rho / (2 * d);              // ohm
    var area = Math.PI * d * d / 4.0;         // m^2
    var current = V / rSpread;                // A
    var jac = (8.0 * V) / (rho * Math.PI * d); // A/m^2  (== current/area)
    return {
      jac: jac,
      rSpread: rSpread,
      current_A: current,
      area_m2: area,
      ref: REF_HOLIDAY
    };
  }

  // ===========================================================================
  // SECTION 3 — AC-CORROSION RISK BANDS  (ISO 18086:2019 / AMPP)
  // ===========================================================================
  //
  //  ISO 18086:2019 ("Determination of AC corrosion — Protection criteria")
  //  assesses AC corrosion risk on coated cathodically-protected steel from
  //  the AC current density Jac AND its interplay with the DC (CP) current
  //  density Jdc, both referred to a 1-cm^2 coupon/probe:
  //
  //    Jac BANDS (A/m^2, time-average over representative period):
  //        Jac < 30        -> LOW: AC corrosion unlikely.
  //        30 <= Jac < 100 -> ELEVATED: AC corrosion possible; investigate /
  //                           consider mitigation.
  //        Jac >= 100      -> HIGH: AC corrosion likely; mitigation required.
  //
  //    Jdc TARGET: keep the CP DC current density in ~1..5 A/m^2. Below ~1
  //    A/m^2 the steel may not stay protected; ABOVE ~5 A/m^2 the high
  //    cathodic current can itself drive AC-corrosion damage (alkalinity /
  //    film breakdown) even when Jac is only moderate.
  //
  //    Jac/Jdc RATIO (ISO 18086 combined criterion): AC corrosion is
  //    considered controlled when EITHER Jac < 30 A/m^2 OR, where Jdc has been
  //    kept low (Jdc < 1 A/m^2), the ratio Jac/Jdc < ~5. A ratio Jac/Jdc > 10
  //    (with elevated Jac) indicates a high likelihood of AC corrosion. We
  //    encode: ratio < 5 favourable, 5..10 watch, > 10 adverse.
  //
  //  The standard's protection target is a SUFFICIENTLY-LOW Jac together with a
  //  CONTROLLED Jdc — not Jac alone. We therefore combine both into the
  //  mitigation flag.

  var REF_ISO18086 = "ISO 18086:2019 — AC corrosion of buried steel: Jac " +
                     "bands (<30 low / 30-100 elevated / >100 high), Jdc " +
                     "target ~1-5 A/m^2, and Jac/Jdc interplay; cf. AMPP/NACE " +
                     "SP21424.";

  var JAC_LOW = 30.0, JAC_HIGH = 100.0;   // A/m^2 band edges
  var JDC_MIN = 1.0,  JDC_MAX = 5.0;      // A/m^2 CP DC target window
  var RATIO_OK = 5.0, RATIO_BAD = 10.0;   // Jac/Jdc interplay thresholds

  function _jacBand(jac) {
    if (jac < JAC_LOW)  return "low";
    if (jac < JAC_HIGH) return "elevated";
    return "high";
  }

  /**
   * acRisk — full AC-corrosion screen for a holiday under AC interference.
   *
   * Computes Jac from the holiday spread-resistance model, classifies it into
   * the ISO 18086 bands, evaluates the Jac/Jdc interplay, and returns a single
   * mitigation flag. This is the primary entry point.
   *
   * @param {object} p
   * @param {number} p.Vac             AC touch voltage (pipe-to-earth), V.
   * @param {number} p.soilResistivity Soil resistivity rho, ohm.m.
   * @param {number} p.holidayDia_mm   Holiday diameter, MILLIMETRES.
   * @param {number} [p.Jdc]           CP DC current density at the defect,
   *                                   A/m^2 (optional but enables the full
   *                                   ISO 18086 combined criterion).
   * @returns {{jac:number, jdc:(number|null), ratio:(number|null),
   *            band:string, rSpread:number, mitigate:boolean,
   *            jdcStatus:string, ratioStatus:string, rationale:string,
   *            ref:string}}
   */
  function acRisk(p) {
    p = p || {};
    var Vac = Number(p.Vac);
    var rho = Number(p.soilResistivity);
    var d_m = Number(p.holidayDia_mm) / 1000.0;  // mm -> m
    var jdc = (p.Jdc === null || p.Jdc === undefined || p.Jdc === "")
                ? null : Number(p.Jdc);

    var h = holidayJac(Vac, rho, d_m);
    var jac = h.jac;
    var band = _jacBand(jac);

    // Jdc window check.
    var jdcStatus = "n/a";
    if (jdc !== null) {
      if (jdc < JDC_MIN)      jdcStatus = "below target (<1 A/m2: CP may be insufficient)";
      else if (jdc > JDC_MAX) jdcStatus = "above target (>5 A/m2: excess CP can itself drive AC corrosion)";
      else                    jdcStatus = "in target (1-5 A/m2)";
    }

    // Jac/Jdc interplay.
    var ratio = null, ratioStatus = "n/a";
    if (jdc !== null && jdc > 0) {
      ratio = jac / jdc;
      if (ratio < RATIO_OK)       ratioStatus = "favourable (<5)";
      else if (ratio < RATIO_BAD) ratioStatus = "watch (5-10)";
      else                        ratioStatus = "adverse (>10)";
    }

    // Mitigation decision (ISO 18086 combined logic):
    //  - High Jac band  -> always mitigate.
    //  - Elevated Jac: mitigate unless the ratio is favourable (Jac/Jdc < 5)
    //    with Jdc in/under target; otherwise investigate -> flag mitigate.
    //  - Low Jac: controlled, UNLESS Jdc is excessive (>5) which itself is an
    //    AC-corrosion driver.
    var mitigate, rationale;
    if (band === "high") {
      mitigate = true;
      rationale = "Jac " + jac.toFixed(0) + " A/m2 >= 100 (HIGH band): AC " +
                  "corrosion likely; mitigation required.";
    } else if (band === "elevated") {
      var ratioFav = (ratio !== null && ratio < RATIO_OK);
      mitigate = !ratioFav;
      rationale = "Jac " + jac.toFixed(0) + " A/m2 in 30-100 (ELEVATED): " +
        (ratioFav
          ? "Jac/Jdc " + ratio.toFixed(1) + " < 5 -> AC corrosion controlled, monitor."
          : (ratio !== null
              ? "Jac/Jdc " + ratio.toFixed(1) + " >= 5 -> mitigate."
              : "no Jdc given -> investigate/mitigate."));
    } else { // low
      if (jdc !== null && jdc > JDC_MAX) {
        mitigate = true;
        rationale = "Jac " + jac.toFixed(0) + " A/m2 < 30 (LOW) but Jdc " +
                    jdc.toFixed(1) + " A/m2 > 5 -> excess CP itself drives AC " +
                    "corrosion; reduce CP / mitigate.";
      } else {
        mitigate = false;
        rationale = "Jac " + jac.toFixed(0) + " A/m2 < 30 (LOW): AC corrosion " +
                    "unlikely; maintain CP.";
      }
    }

    return {
      jac: jac,
      jdc: jdc,
      ratio: ratio,
      band: band,
      rSpread: h.rSpread,
      mitigate: mitigate,
      jdcStatus: jdcStatus,
      ratioStatus: ratioStatus,
      rationale: rationale,
      ref: REF_ISO18086
    };
  }

  // ===========================================================================
  // SECTION 4 — COARSE AC CORROSION-RATE ESTIMATE  (INDICATIVE ONLY)
  // ===========================================================================
  //
  //  ***ORDER-OF-MAGNITUDE / INDICATIVE ONLY — NOT A DESIGN CORROSION RATE.***
  //
  //  AC corrosion rate has no single closed-form law; it depends on soil,
  //  spread resistance, CP level, film chemistry and AC waveform. As a coarse
  //  screening proxy aligned with the ISO 18086 bands and reported field
  //  experience, AC corrosion of steel becomes significant above Jac ~ 30
  //  A/m^2 and severe (multi-mm/yr) above ~100 A/m^2. A convenient upper-bound
  //  proxy is a Faradaic-style scaling in which a fraction of the AC charge
  //  acts anodically: ~0.4 mm/yr per (A/m^2) of "effective" AC density, which
  //  here we apply only to the portion of Jac above a ~10 A/m^2 practical
  //  threshold (below which films/CP suppress damage). This deliberately
  //  brackets the documented "tens of A/m^2 -> ~1 mm/yr, hundreds -> tens of
  //  mm/yr" field range. Use ONLY to rank/triage, never to set a design life.
  //
  //  Faraday sanity note: full-Faradaic dissolution of iron at 1 A/m^2 (2 e-,
  //  M=55.85 g/mol, rho=7870 kg/m^3) is ~1.16 mm/yr; AC corrosion realises a
  //  small, conditions-dependent fraction of that — hence the 0.4 factor and
  //  the suppression threshold, both clearly flagged as indicative.

  var REF_RATE = "INDICATIVE order-of-magnitude only — coarse proxy " +
                 "consistent with ISO 18086:2019 Jac bands and reported AC- " +
                 "corrosion field rates; NOT a design corrosion rate.";

  var RATE_THRESHOLD = 10.0;   // A/m^2 below which damage is suppressed
  var RATE_FACTOR    = 0.4;    // mm/yr per (A/m^2) of effective AC density

  /**
   * acCorrRate — indicative AC corrosion rate from Jac. FLAGGED indicative.
   * @param {number} jac  AC current density, A/m^2.
   * @returns {{mmYr_indicative:number, band:string, indicative:boolean,
   *            ref:string}}
   */
  function acCorrRate(jac) {
    var j = Number(jac);
    var effective = Math.max(0, j - RATE_THRESHOLD);
    var mmYr = RATE_FACTOR * effective;
    return {
      mmYr_indicative: mmYr,
      band: _jacBand(j),
      indicative: true,
      ref: REF_RATE
    };
  }

  // ===========================================================================
  // WORKED EXAMPLES  (numbers reproducible by calling the functions below)
  // ===========================================================================
  //
  //  --- Example A: CP criteria, healthy impressed-current pipe ---------------
  //  Instant-off -1050 mV CSE, native/depolarized -550 mV, ON -1300 mV.
  //    cpCriteria({Eon_mV:-1300, Einstantoff_mV:-1050, Edepol_mV:-550})
  //    -> polarized_mV = -1050; meets850 = true (-1050 <= -850);
  //       polarizationShift_mV = (-550)-(-1050) = 500 mV; meets100mV = true;
  //       irDrop_mV = (-1300)-(-1050) = -250 mV;
  //       verdict = "PROTECTED (both -850 mV and 100 mV criteria met)".
  //
  //  --- Example B: CP criteria, IR-drop trap --------------------------------
  //  ON reads -900 mV (looks protected) but instant-off is only -780 mV.
  //    cpCriteria({Eon_mV:-900, Einstantoff_mV:-780})
  //    -> polarized_mV = -780; meets850 = false (-780 > -850);
  //       irDrop_mV = -120 mV; 100 mV criterion not evaluated (no Edepol);
  //       verdict = "NOT PROTECTED (no SP0169 criterion met)".
  //    The 50 mV "pass" on the ON potential was pure IR drop.
  //
  //  --- Example C: AC risk, small holiday in low-resistivity soil ------------
  //  Vac = 15 V, rho = 25 ohm.m, holiday d = 11.3 mm (~1 cm^2 coupon),
  //  Jdc = 1.0 A/m^2.
  //    acRisk({Vac:15, soilResistivity:25, holidayDia_mm:11.3, Jdc:1.0})
  //    -> rSpread = 25/(2*0.0113) = ~1106 ohm;
  //       Jac = 8*15/(25*pi*0.0113) = 120/(0.8875) = ~135 A/m^2 (HIGH band);
  //       ratio = 135/1.0 = ~135 (adverse); mitigate = true.
  //    acCorrRate(135) -> ~0.4*(135-10) = ~50 mm/yr indicative (severe).
  //
  //  --- Example D: AC risk, same defect in high-resistivity soil ------------
  //  Vac = 4 V, rho = 200 ohm.m, d = 11.3 mm, Jdc = 2.0 A/m^2.
  //    acRisk({Vac:4, soilResistivity:200, holidayDia_mm:11.3, Jdc:2.0})
  //    -> Jac = 8*4/(200*pi*0.0113) = 32/(7.10) = ~4.5 A/m^2 (LOW band);
  //       ratio = 4.5/2.0 = ~2.25 (favourable); mitigate = false.
  //    acCorrRate(4.5) -> 0 mm/yr (below the 10 A/m^2 suppression threshold).

  root.CPAC = {
    // primary API
    acRisk: acRisk,
    cpCriteria: cpCriteria,
    acCorrRate: acCorrRate,
    // building blocks (exposed for reuse / testing)
    holidayJac: holidayJac,
    // constants (cited)
    CSE_THRESHOLD_MV: CSE_THRESHOLD_MV,
    POLARIZATION_MV: POLARIZATION_MV,
    JAC_LOW: JAC_LOW,
    JAC_HIGH: JAC_HIGH,
    JDC_MIN: JDC_MIN,
    JDC_MAX: JDC_MAX,
    refs: {
      cp: REF_SP0169,
      holiday: REF_HOLIDAY,
      ac: REF_ISO18086,
      rate: REF_RATE
    }
  };

})(typeof window !== "undefined" ? window : this);
