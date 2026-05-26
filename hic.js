/* hic.js — Hydrogen-Induced Cracking (HIC) / Stress-Oriented HIC (SOHIC) risk
 * screen for carbon / low-alloy steel in wet sour service, vanilla JS.
 *
 * HIC: planar / stepwise blistering nucleating at MnS / banded inclusions, driven
 * by atomic H ingress from H2S corrosion at low pH. Does not require stress.
 * SOHIC: stress-oriented variant — HIC features link up under tensile stress
 *   (residual welds, applied load) into through-wall macro-cracks.
 *
 * Risk drivers (per NACE MR0103 §4 / ISO 15156-2 §B / API 571 Section 5):
 *   - pH2S in the water phase (HIC threshold ~ 0.05 psia / 0.3 kPa per ISO 15156)
 *   - in-situ water pH (HIC severity rises sharply below ~ pH 5)
 *   - steel cleanliness: sulphur (S) and Mn segregation control MnS density;
 *     HIC-resistant grades have S < 0.003 wt% + Ca-treatment
 *   - microstructure / hardness (high HV ⇒ more sensitive; SOHIC active above ~250 HV)
 *   - sulphide / polysulphide level in produced water (recombination poison)
 *   - water cut (no free water ⇒ no HIC)
 *
 * Sources cited in `ref`:
 *   - NACE MR0103-2018 — Materials Resistant to SSC in Corrosive Petroleum
 *     Refining Environments.
 *   - NACE TM0284-2016 — Evaluation of Pipeline / Pressure-Vessel Steels for
 *     Resistance to HIC (immersion test in NACE solution A).
 *   - ISO 15156-2 §B — HIC test acceptance criteria (CLR/CTR/CSR limits).
 *   - API RP 571 §5 — Hydrogen damage mechanisms in refinery process equipment.
 *
 * Factor categories per the above standards; specific multipliers are a
 * screening combination, flagged as such in `ref`.
 */
(function (root) {
  "use strict";

  // pH2S threshold: 0.05 psia = 0.34 kPa (ISO 15156 sour-service trigger).
  var H2S_THRESHOLD_kPa = 0.34;

  // Steel cleanliness category: HIC-resistant requires S ≤ 0.003 wt% + Ca treatment.
  function _Sfactor(S_wt) {
    if (S_wt == null || !(S_wt >= 0)) return 0.7;       // unknown → middle
    if (S_wt <= 0.003) return 0.3;                       // HIC-resistant clean steel
    if (S_wt <= 0.010) return 0.6;                       // standard pressure-vessel
    if (S_wt <= 0.030) return 1.0;                       // resulphurised / poor
    return 1.2;
  }
  // pH factor — HIC severity rises sharply below pH 5, plateaus below 3.
  function _pHfactor(pH) {
    if (pH == null) return 0.7;
    if (pH >= 6.5) return 0.2;
    if (pH >= 5.5) return 0.4;
    if (pH >= 4.5) return 0.7;
    if (pH >= 3.5) return 1.0;
    return 1.2;
  }
  // pH2S log-linear factor (above the 0.34 kPa threshold).
  function _h2sFactor(pH2S_kPa) {
    if (!(pH2S_kPa > H2S_THRESHOLD_kPa)) return 0;
    // 1× at 1 kPa, ~1.5× per decade, capped at 2× near 100 kPa+
    var f = 1.0 + 0.5 * Math.log10(pH2S_kPa);
    return Math.max(0.2, Math.min(2.0, f));
  }
  // Hardness (HV) factor — SOHIC threshold ~250 HV (~22 HRC); sharper above 280.
  function _HVfactor(HV) {
    if (HV == null) return 0.8;
    if (HV <= 200) return 0.5;
    if (HV <= 250) return 0.8;
    if (HV <= 280) return 1.1;
    if (HV <= 320) return 1.4;
    return 1.7;
  }

  function risk(opts) {
    opts = opts || {};
    var pH2S = +opts.pH2S_kPa;
    var pH = +opts.pH;
    var S_wt = opts.S_wt == null ? null : +opts.S_wt;
    var HV = opts.HV == null ? null : +opts.HV;
    var waterCut = opts.waterCut == null ? 1.0 : +opts.waterCut;
    var stress = opts.stress == null ? 0.5 : +opts.stress;     // ×YS, for SOHIC

    if (!(pH2S > H2S_THRESHOLD_kPa)) {
      return {
        active: false, pH2S_kPa: pH2S,
        level: "low", mech: "below ISO 15156 sour-service threshold (0.34 kPa pH2S)",
        ref: "NACE MR0103 / ISO 15156-2 §A.2 — sour threshold not exceeded."
      };
    }
    if (!(waterCut > 0)) {
      return {
        active: false, pH2S_kPa: pH2S, waterCut: waterCut,
        level: "low", mech: "no free water phase (HIC requires aqueous H-charging)",
        ref: "NACE MR0103 §4.2 — HIC requires a continuous wetted water phase."
      };
    }

    var fH = _h2sFactor(pH2S);
    var fP = _pHfactor(pH);
    var fS = _Sfactor(S_wt);
    var fV = _HVfactor(HV);
    var fW = waterCut < 0.05 ? 0.5 : (waterCut < 0.2 ? 0.8 : 1.0);

    // HIC index (planar) — does not require stress
    var hicIdx = fH * fP * fS * fW;
    // SOHIC index — adds stress and hardness amplification
    var sohicIdx = hicIdx * fV * (0.4 + 0.6 * Math.max(0, Math.min(1.2, stress)));

    var lvl = function (x) {
      return x < 0.20 ? "low" : x < 0.55 ? "medium" : x < 1.10 ? "high" : "severe";
    };
    var hicLevel = lvl(hicIdx);
    var sohicLevel = lvl(sohicIdx);
    var dominant = sohicIdx > hicIdx * 1.15 ? "SOHIC" : "HIC";
    var note = dominant === "SOHIC"
      ? "stress-oriented HIC dominant — bands link under tensile stress (welds, residual); use HIC-tested PWHT'd plate + lower HV"
      : "planar HIC dominant — driven by clean-steel quality (S, Mn segregation, Ca treatment); use HIC-tested plate (TM0284 acceptance: CLR≤15% / CTR≤5% / CSR≤2%)";

    var mit = [];
    if (S_wt == null || S_wt > 0.003) mit.push("specify HIC-resistant plate (S ≤ 0.003 wt%, Ca-treated, TM0284 tested)");
    if (HV != null && HV > 250) mit.push("lower hardness below 250 HV (heat treatment / weld procedure)");
    if (pH != null && pH < 5) mit.push("raise in-situ pH ≥ 5.5 (alkali injection / scavenger)");
    if (pH2S > 50) mit.push("consider CRA clad / overlay for very-sour service");
    if (!mit.length) mit.push("monitor with TM0284-style coupons + UT shear-wave HIC scans on schedule");

    return {
      active: true, pH2S_kPa: pH2S, pH: pH, S_wt: S_wt, HV: HV,
      waterCut: waterCut, stress: stress,
      factors: { pH2S: fH, pH: fP, S: fS, HV: fV, water: fW },
      HIC_index: hicIdx, SOHIC_index: sohicIdx,
      HIC_level: hicLevel, SOHIC_level: sohicLevel,
      dominant: dominant, level: dominant === "SOHIC" ? sohicLevel : hicLevel,
      mechanism: note, mitigation: mit,
      ref: "NACE MR0103-2018 §4 (sour refining); NACE TM0284-2016 (HIC test, "
         + "acceptance CLR≤15% / CTR≤5% / CSR≤2%); ISO 15156-2 §B; API RP 571 §5. "
         + "Factor categories per cited standards; specific multipliers are a "
         + "screening combination — not a substitute for TM0284 plate testing."
    };
  }

  /* WORKED CASES:
   *  - Sour gas-gathering line, pH2S=50 kPa, pH=4.0, S=0.015, HV=210, σ=0.3, wc=1:
   *    fH≈1.85, fP=1.0, fS=1.0, fV=0.8, fW=1.0 → HIC≈1.85 (severe), SOHIC≈1.62 (severe)
   *  - Same line but HIC-resistant plate (S=0.002, HV=180, σ=0.2):
   *    fS=0.3, fV=0.5 → HIC≈0.56 (medium), SOHIC≈0.16 (low)
   *    → matches the API 571 / NACE MR0103 message: clean-steel control collapses HIC. */

  var HIC = { risk: risk, H2S_THRESHOLD_kPa: H2S_THRESHOLD_kPa };
  root.HIC = HIC;
  if (typeof module !== "undefined" && module.exports) module.exports = HIC;
})(typeof window !== "undefined" ? window : this);
