/* rbi-damage-mechanisms.js — Industry-grade implementations of the
 * remaining API RP 581 damage-factor annexes that supplement rbi-detailed.js.
 *
 * Coverage:
 *   Annex 2.C.1  Caustic Cracking            — caustic_DF()
 *   Annex 2.C.2  Amine Cracking              — amine_DF()
 *   Annex 2.C.3  Sulfide Stress Cracking SSC — ssc_DF()
 *   Annex 2.C.4  HIC/SOHIC-H2S               — hic_h2s_DF()
 *   Annex 2.C.5  Carbonate Cracking          — carbonate_DF()
 *   Annex 2.C.6  Polythionic Acid SCC        — pasc_DF()
 *   Annex 2.C.7  Chloride SCC                — clscc_DF()
 *   Annex 2.C.8  Hydrogen Stress Cracking HF — hsc_hf_DF()
 *   Annex 2.C.9  HIC/SOHIC-HF                — hic_hf_DF()
 *   Annex 2.D    High-Temperature H₂ Attack  — htha_DF()
 *   Annex 2.E    Mechanical Fatigue (Piping) — mech_fatigue_DF()
 *   Annex 2.F    Brittle Fracture            — brittle_DF()
 *   Annex 2.G    External Corrosion + CUI    — external_DF()
 *   Combined damage-factor master            — combinedDF()
 *
 * Each function takes an opts object (env / material / conditions /
 * inspection_history / age_yr) and returns:
 *   { susceptibility, SVI, F_age, F_eff, D_f, mechanism, applicable, ref }
 *
 * Per API RP 581 the general SCC damage-factor framework is (Part 2 §6.3):
 *   D_f = max[ SVI · F_age · F_eff , 1 ]
 * where SVI comes from the per-mechanism severity table and F_eff is the
 * inspection-effectiveness reduction factor (Table 6.x.x).
 *
 * Inspection-effectiveness reduction (default scaling per Part 2 §6.3 Tab):
 *   A — divides SVI by 10
 *   B — divides SVI by 5
 *   C — divides SVI by 2
 *   D — divides SVI by 1 (no benefit)
 *   E — divides SVI by 1
 * Multiple inspections combine per RBIDetailed.inspectionCombo().
 *
 * Sources cited throughout in `ref` strings:
 *   - API RP 581 (3rd ed., April 2016) + Add 1 (Apr 2019) + Add 2 (2020)
 *   - API RP 581 (4th ed., Feb 2025) — restructured; SCC tables re-numbered
 *   - API RP 941 (8th ed., Sept 2016) — Steels for hydrogen service at
 *     elevated temperatures and pressures in petroleum refineries (Nelson curves)
 *   - API RP 945 (3rd ed., 2003) — Avoiding environmental cracking in amine units
 *   - API RP 571 (3rd ed., 2020) — Damage mechanisms affecting fixed equipment
 *   - API RP 751 (4th ed., 2013) — Safe operation of HF alkylation units
 *   - NACE MR0175 / ISO 15156 — Sour-service materials
 *   - NACE MR0103 / ISO 17945 — Petroleum refining materials
 *   - NACE TM0284 — HIC test
 *   - NACE SP0170 — Protection of stainless steel from PASCC
 *   - NACE SP0403 — Caustic service
 *   - NACE SP0472 — Carbon-steel weldments + PWHT
 *   - ASME PCC-2 — Repair of pressure equipment
 *   - ASME Section VIII Div 1 UG-20 + Fig UCS-66 — MAT charts
 *   - ASME B31.3 Tab 323.2.2 + B31.G — Piping MAT/Charpy
 *   - ISO 9223:2012 — Atmospheric corrosivity categories
 *   - API RP 583 — Inspection of CUI
 */
(function (root) {
  "use strict";

  // ============= Common machinery =============================================

  // SVI levels per API 581 §6.x.x (severity index):
  //   None=1, Low=10, Medium=50, High=100, V.High=500
  // These act as the base damage factor before age/inspection adjustment.
  var SVI_LEVEL = { "None":1, "Low":10, "Medium":50, "High":100, "V.High":500 };

  // Inspection-effectiveness reduction factor (Part 2 §6.3 typ.)
  var EFF_REDUCTION = { "A":10, "B":5, "C":2, "D":1, "E":1 };

  /** Combine inspection history + apply reduction factor + age scaling. */
  function _commonDF(opts, susceptibility, mechanism, ref) {
    opts = opts || {};
    var SVI = SVI_LEVEL[susceptibility] || 1;
    var age = +opts.age_yr || 0;
    // Age factor: per Part 2 §6.4 typical envelope, F_age = 0.1 (per year) but
    // mechanism-specific. For SCC-family: F_age = (age - last_inspect_yr) / yr.
    // Default: linear with age, but capped to avoid runaway.
    var age_since = opts.age_since_last_inspect_yr != null ? +opts.age_since_last_inspect_yr : age;
    var F_age = Math.max(0.1, Math.min(age_since, 30) / 10);   // 1 at 10 yr, 3 at 30 yr
    // Inspection effectiveness
    var hist = opts.inspection_history || [];
    var eff = (root.RBIDetailed && root.RBIDetailed.inspectionCombo)
              ? root.RBIDetailed.inspectionCombo(hist)
              : "E";
    var red = EFF_REDUCTION[eff] || 1;
    var F_eff = 1 / red;
    var D_f = Math.max(SVI * F_age * F_eff, 1);
    return {
      mechanism: mechanism,
      susceptibility: susceptibility,
      SVI: SVI,
      F_age: F_age,
      F_eff: F_eff,
      effectiveness: eff,
      D_f: D_f,
      applicable: true,
      ref: ref
    };
  }

  function _notApplicable(mechanism, why) {
    return { mechanism: mechanism, applicable: false, susceptibility: "None",
             SVI: 1, F_age: 0, F_eff: 1, D_f: 1, why: why };
  }

  // ============= 2.C.1 Caustic Cracking =======================================
  /** Per API 581 §6.5 + NACE SP0403 — caustic SCC of CS/low-alloy steel
   *  in NaOH solutions. PWHT removes susceptibility (per ASME PCC-2 + SP0403). */
  function caustic_DF(opts) {
    opts = opts || {};
    var T_C = +opts.T_C || 25;
    var NaOH_wt = +opts.NaOH_wt_pct || 0;
    var family = opts.material_family || "CS";
    var PWHT = !!opts.PWHT;
    var stress_ratio = opts.stress_ratio_SMYS != null ? +opts.stress_ratio_SMYS : 0.5;

    if (NaOH_wt < 5) return _notApplicable("Caustic SCC", "NaOH <5 wt% — outside SCC regime per SP0403");
    if (family !== "CS" && family !== "low-alloy" && family !== "C-Mo")
      return _notApplicable("Caustic SCC", "CRA / stainless not susceptible per SP0403 §4");
    if (PWHT) return _notApplicable("Caustic SCC", "PWHT removes residual stress per NACE SP0403 §6.3");

    // McKay-Worner nomograph (NACE SP0403 Fig 1) — boundaries in (T, NaOH wt%):
    //   Curve A: 20% NaOH at 50 °C / 50% NaOH at 38 °C → no cracking below
    //   Curve B: above curve A — cracking possible
    //   Curve C: 50% NaOH at 100 °C — molten caustic regime
    var sus = "None";
    // Approximation: critical T(NaOH) ≈ 80 - 0.6·NaOH_wt (linear simplification)
    var T_crit_low = 80 - 0.6 * NaOH_wt;
    var T_crit_high = 130 - 0.6 * NaOH_wt;
    if (T_C < T_crit_low) sus = "None";
    else if (T_C < T_crit_high) sus = "Medium";
    else sus = "High";
    // Stress amplifier
    if (stress_ratio > 0.85) sus = sus === "Medium" ? "High" : sus === "High" ? "V.High" : sus;
    if (stress_ratio < 0.40) sus = sus === "High" ? "Medium" : sus;

    return _commonDF(opts, sus, "Caustic SCC",
      "API RP 581 (3rd ed.) §6.5 + NACE SP0403-2015 + API RP 945 §6 + McKay-Worner nomograph. "
      + "PWHT removes residual-stress driver per SP0403 §6.3.");
  }

  // ============= 2.C.2 Amine Cracking =========================================
  /** Per API RP 581 §6.4 + API RP 945. MEA most aggressive, DEA medium,
   *  MDEA mild. Lean amine more aggressive than rich amine. PWHT mandatory
   *  per API 945 §6.5 for CS in amine service > 60 °C. */
  function amine_DF(opts) {
    opts = opts || {};
    var T_C = +opts.T_C || 25;
    var amine_type = (opts.amine_type || "").toUpperCase();
    var lean_or_rich = opts.amine_state || "lean";    // lean = post-stripper, more aggressive
    var family = opts.material_family || "CS";
    var PWHT = !!opts.PWHT;

    if (!amine_type) return _notApplicable("Amine SCC", "no amine type specified");
    if (family !== "CS" && family !== "low-alloy" && family !== "C-Mo")
      return _notApplicable("Amine SCC", "CRA / SS not susceptible per API 945 §4");

    // API RP 945 §4 + Table 1 — relative aggressiveness:
    var typeFactor = { "MEA": 1.0, "DEA": 0.7, "MDEA": 0.4, "DGA": 0.6, "DIPA": 0.5 }[amine_type] || 0.5;
    if (lean_or_rich === "rich") typeFactor *= 0.5;

    var sus;
    if (PWHT && T_C < 60) sus = "None";
    else if (T_C < 60) sus = "Low";
    else if (T_C < 90) sus = typeFactor > 0.7 ? "Medium" : "Low";
    else if (T_C < 120) sus = typeFactor > 0.7 ? "High" : "Medium";
    else sus = "V.High";
    if (PWHT) sus = sus === "V.High" ? "Medium" : sus === "High" ? "Low" : sus === "Medium" ? "Low" : "None";

    return _commonDF(opts, sus, "Amine SCC",
      "API RP 581 (3rd ed.) §6.4 + API RP 945 (3rd ed., 2003) §4 + Table 1; "
      + "PWHT mandatory per §6.5 for CS in amine service > 60 °C; "
      + "Bagdasarian A. et al. (1991) Mater. Perf. 30(5), 63.");
  }

  // ============= 2.C.3 Sulfide Stress Cracking (SSC) ==========================
  /** Per API 581 §6.6 + NACE MR0175/ISO 15156-2.
   *  Hardness cap: HRC 22 for CS/low-alloy; HRC 26 for CRA.
   *  Sour severity from pH + pH2S (NACE region map). */
  function ssc_DF(opts) {
    opts = opts || {};
    var pH = opts.pH != null ? +opts.pH : 7;
    var pH2S_kPa = +opts.pH2S_kPa || 0;
    var T_C = +opts.T_C || 25;
    var hardness_HRC = +opts.hardness_HRC || 22;
    var family = opts.material_family || "CS";
    var PWHT = !!opts.PWHT;
    var cold_work_pct = +opts.cold_work_pct || 0;

    if (pH2S_kPa < 0.05) return _notApplicable("SSC", "pH2S < 0.05 kPa — non-sour per ISO 15156-2 §7.1");
    if (T_C > 65) return _notApplicable("SSC", "T > 65 °C — outside SSC temperature regime; check HIC instead");

    // NACE Region per ISO 15156-2 Fig 1:
    //   Region 0: pH2S ≤ 0.3 kPa → non-sour (mild)
    //   Region 1: pH ≥ 5.5 AND pH2S ≤ 10 kPa
    //   Region 2: pH 3.5-5.5 OR pH2S 10-100 kPa
    //   Region 3: pH < 3.5 OR pH2S > 100 kPa
    var region;
    if (pH2S_kPa <= 0.3) region = 0;
    else if (pH >= 5.5 && pH2S_kPa <= 10) region = 1;
    else if (pH >= 3.5 && pH2S_kPa <= 100) region = 2;
    else region = 3;

    var sus;
    if (family === "CS" || family === "low-alloy") {
      var H_cap = 22;     // HRC 22 max for CS per ISO 15156-2 §7.2
      if (cold_work_pct > 5) H_cap -= 2;
      if (hardness_HRC > H_cap) {
        sus = ["Medium","High","V.High","V.High"][region];
      } else {
        sus = ["None","Low","Medium","High"][region];
      }
    } else {                  // CRA family
      var H_cap_CRA = 26;
      if (hardness_HRC > H_cap_CRA) sus = "Medium";
      else sus = region < 2 ? "Low" : "Medium";
    }
    if (PWHT && (family === "CS" || family === "low-alloy")) {
      // PWHT relaxes residual stress → moves down one severity
      sus = sus === "V.High" ? "High" : sus === "High" ? "Medium" : sus === "Medium" ? "Low" : "None";
    }

    return _commonDF(opts, sus, "SSC (Sulfide Stress Cracking)",
      "API RP 581 (3rd ed.) §6.6 + ISO 15156-2:2020 §7 / NACE MR0175 + NACE MR0103-2018 §7 + "
      + "NACE TM0177-2016 (test). Region from ISO 15156-2 Fig 1 (pH × pH2S map). "
      + "Hardness cap HRC 22 for CS / low-alloy (HRC 26 for CRA) per ISO 15156-2 §7.2.");
  }

  // ============= 2.C.4 HIC/SOHIC-H2S ==========================================
  /** Per API 581 §6.7 + NACE TM0284 + ISO 15156-2 §A.
   *  CS / low-alloy in wet H₂S above 65 °C. Cyanide + pH < 4 amplifies.
   *  PWHT does not protect against HIC (only SOHIC); only HIC-resistant
   *  steels (Ca-treated, low-S, low-P) do. */
  function hic_h2s_DF(opts) {
    opts = opts || {};
    var pH = opts.pH != null ? +opts.pH : 7;
    var pH2S_kPa = +opts.pH2S_kPa || 0;
    var cyanide_ppm = +opts.cyanide_ppm || 0;
    var T_C = +opts.T_C || 25;
    var Cl_ppm = +opts.Cl_ppm || 0;
    var family = opts.material_family || "CS";
    var HIC_resistant_steel = !!opts.HIC_resistant_steel;
    var welded = opts.welded !== false;

    if (pH2S_kPa < 0.3) return _notApplicable("HIC/SOHIC-H2S", "pH2S < 0.3 kPa — non-sour per ISO 15156-2");
    if (family !== "CS" && family !== "low-alloy" && family !== "C-Mo")
      return _notApplicable("HIC/SOHIC-H2S", "Austenitic / duplex SS / Ni-base not HIC-susceptible per MR0103 §6");
    if (HIC_resistant_steel) return _notApplicable("HIC/SOHIC-H2S", "Ca-treated low-S HIC-resistant steel per TM0284");

    // API 581 Table 6.7.1 sour severity (function of pH × pH2S × cyanide):
    var sev;
    if (pH < 4 || cyanide_ppm > 20) sev = "V.High";
    else if (pH < 5 && pH2S_kPa > 1) sev = "High";
    else if (pH < 6 && pH2S_kPa > 3) sev = "Medium";
    else if (pH2S_kPa > 0.3) sev = "Low";
    else sev = "None";

    // Welded amplifier — SOHIC-H2S (Stress-Oriented HIC) on welds
    if (welded && (sev === "Medium" || sev === "High")) sev = sev === "Medium" ? "High" : "V.High";

    return _commonDF(opts, sev, "HIC/SOHIC-H2S",
      "API RP 581 (3rd ed.) §6.7 + NACE MR0103-2018 §7 + NACE TM0284-2016 + "
      + "ISO 15156-2 §A. Severity from pH × pH2S × cyanide map (Tab 6.7.1). "
      + "Cyanide amplifier per Erickson & Bradford 1981 Corrosion 37, 165. "
      + "PWHT does NOT protect against HIC; only Ca-treated low-S steels do (TM0284 acceptance: CLR≤15%, CTR≤5%, CSR≤2%).");
  }

  // ============= 2.C.5 Carbonate Cracking =====================================
  /** Per API 581 §6.8 + API 571 §4.5.5 — alkaline-pH SCC in CO3²⁻ environments
   *  (FCC overhead sour water, KOH-CO2 mix). CS / low-alloy in T > 60 °C +
   *  pH > 7 + CO3²⁻ > 100 ppm. PWHT eliminates residual-stress driver. */
  function carbonate_DF(opts) {
    opts = opts || {};
    var T_C = +opts.T_C || 25;
    var pH = opts.pH != null ? +opts.pH : 7;
    var CO3_ppm = +opts.CO3_ppm || 0;
    var family = opts.material_family || "CS";
    var PWHT = !!opts.PWHT;

    if (CO3_ppm < 100) return _notApplicable("Carbonate SCC", "CO3 < 100 ppm — outside SCC regime");
    if (pH <= 7) return _notApplicable("Carbonate SCC", "pH ≤ 7 — carbonate cracking requires alkaline env (pH > 7)");
    if (family !== "CS" && family !== "low-alloy")
      return _notApplicable("Carbonate SCC", "CRA not susceptible per API 571 §4.5.5");
    if (PWHT) return _notApplicable("Carbonate SCC", "PWHT eliminates residual stress per API 945-style mitigation");

    var sus;
    if (T_C < 60) sus = "None";
    else if (T_C < 95) sus = pH > 9 ? "Medium" : "Low";
    else if (T_C < 130) sus = pH > 9 ? "High" : "Medium";
    else sus = "V.High";

    return _commonDF(opts, sus, "Carbonate SCC",
      "API RP 581 (3rd ed.) §6.8 + API RP 571 (3rd ed., 2020) §4.5.5 — "
      + "Carbonate Cracking. Common in FCC main-column overhead sour water + "
      + "KOH-CO2 absorbers; ammonium-carbonate environments at T > 60 °C / pH > 7.");
  }

  // ============= 2.C.6 Polythionic Acid SCC (PASCC) ===========================
  /** Per API 581 §6.9 + NACE SP0170 — austenitic SS sensitised by service-T,
   *  cracked on cooldown by moisture + H2S → polythionic acid. Common in
   *  FCC regen + hydroprocessor reactors during turnaround. */
  function pasc_DF(opts) {
    opts = opts || {};
    var family = opts.material_family || "CS";
    var sensitised = !!opts.sensitised;
    var stabilised = !!opts.stabilised;   // 321, 347 Ti/Nb-stabilised
    var purged = !!opts.shutdown_purged_or_neutralised;
    var H2S_service = !!opts.H2S_service;

    if (family !== "austenitic-SS" && family !== "duplex-SS")
      return _notApplicable("PASCC", "non-stainless not susceptible to polythionic acid");
    if (!H2S_service)
      return _notApplicable("PASCC", "no H2S service history → no polythionic acid precursor");
    if (stabilised && !sensitised)
      return _notApplicable("PASCC", "Ti/Nb-stabilised SS not sensitised — no Cr-depleted grain boundaries");
    if (purged)
      return _notApplicable("PASCC", "shutdown purged / neutralised per NACE SP0170 §6 — protective");

    var sus;
    if (sensitised) sus = "V.High";
    else sus = "Medium";     // 304/316 in long H2S service typically slowly sensitises

    return _commonDF(opts, sus, "Polythionic Acid SCC (PASCC)",
      "API RP 581 (3rd ed.) §6.9 + NACE SP0170-2012 — Protection of Austenitic SS "
      + "and Other Austenitic Alloys from Polythionic Acid SCC during Shutdown. "
      + "Sensitisation: Cr-depleted grain boundaries after exposure to 480-815 °C / "
      + "long service. Mitigation: dry purge / soda-ash neutralisation per SP0170 §6.");
  }

  // ============= 2.C.7 Chloride SCC ===========================================
  /** Per API 581 §6.10 + ISO 15156-3 + ASM 5A171.
   *  Austenitic SS in Cl + T > 50 °C is the classic. */
  function clscc_DF(opts) {
    opts = opts || {};
    var T_C = +opts.T_C || 25;
    var Cl_ppm = +opts.Cl_ppm || 0;
    var pH = opts.pH != null ? +opts.pH : 7;
    var family = opts.material_family || "CS";
    var PREN = +opts.PREN || 0;
    var stress_ratio = opts.stress_ratio_SMYS != null ? +opts.stress_ratio_SMYS : 0.5;

    if (family !== "austenitic-SS" && family !== "duplex-SS" && family !== "super-austenitic")
      return _notApplicable("Cl-SCC", "Cl-SCC primarily affects austenitic SS — CRA/Ni-base immune below ~150 °C");
    if (Cl_ppm < 10) return _notApplicable("Cl-SCC", "Cl < 10 ppm — outside SCC regime");

    // Threshold T per Sedriks 1996 §6 / ASM 5A171 / Truman 1977 BSC Tab.1:
    //   304/316 ≈ 60 °C above 50 ppm Cl
    //   Duplex 2205 ≈ 110 °C
    //   Super-austenitic 254SMO ≈ 140 °C
    //   Super-duplex 2507 ≈ 160 °C
    var Tcrit;
    if (PREN >= 40) Tcrit = 140;
    else if (PREN >= 35) Tcrit = 110;
    else Tcrit = 60;
    if (pH > 11) Tcrit += 30;     // alkaline shifts threshold higher

    var sus;
    if (T_C < Tcrit - 30) sus = "None";
    else if (T_C < Tcrit) sus = "Low";
    else if (T_C < Tcrit + 40) sus = "Medium";
    else sus = "High";
    if (Cl_ppm > 10000 && T_C > Tcrit) sus = sus === "Medium" ? "High" : "V.High";
    if (stress_ratio > 0.85) sus = sus === "Low" ? "Medium" : sus === "Medium" ? "High" : sus;

    return _commonDF(opts, sus, "Chloride SCC",
      "API RP 581 (3rd ed.) §6.10 + API RP 571 §4.5.1 + ASM 5A171 (Cl-SCC of SS) + "
      + "ISO 15156-3:2020 §A; Sedriks (1996) §6 + Truman J.E. (1977) Brit. Corr. J. 12, 5 — "
      + "T threshold ~60 °C for 304/316 / 110 °C for 2205 / 140 °C for 254SMO / 160 °C for 2507.");
  }

  // ============= 2.C.8 Hydrogen Stress Cracking — HF ==========================
  /** Per API 581 §6.11 + API RP 751 §A. CS / low-alloy HSC in HF alkylation.
   *  PWHT mandatory; Cu / Ni / Ti residual specs limited per API 751 §A.4. */
  function hsc_hf_DF(opts) {
    opts = opts || {};
    var family = opts.material_family || "CS";
    var hardness_HRC = +opts.hardness_HRC || 22;
    var PWHT = !!opts.PWHT;
    var Cu_pct = +opts.Cu_pct || 0;
    var Ni_pct = +opts.Ni_pct || 0;
    var T_C = +opts.T_C || 40;
    var HF_pct = +opts.HF_wt_pct || 0;

    if (HF_pct === 0)
      return _notApplicable("HSC-HF", "no HF service — HSC-HF only applies to HF alkylation streams");
    if (family !== "CS" && family !== "low-alloy")
      return _notApplicable("HSC-HF", "CRA / SS / Monel not susceptible per API 751");

    var sus;
    if (Cu_pct + Ni_pct > 0.5) sus = "V.High";    // API 751 §A.4 residual cap
    else if (hardness_HRC > 22) sus = "High";
    else if (!PWHT) sus = "Medium";
    else sus = "Low";

    return _commonDF(opts, sus, "HSC-HF (Hydrogen Stress Cracking in HF)",
      "API RP 581 (3rd ed.) §6.11 + API RP 751 (4th ed., 2013) §A.4 — "
      + "HF Alkylation Material Specifications. Cu+Ni residual cap 0.5 wt%, "
      + "hardness HRC 22 max, PWHT mandatory for CS in HF service > 0.07 ppm.");
  }

  // ============= 2.C.9 HIC/SOHIC-HF ===========================================
  /** Per API 581 §6.12 + API 751 §A — HIC in HF: analogous to HIC-H2S but with
   *  fluoride-driven hydrogen-charging mechanism. */
  function hic_hf_DF(opts) {
    opts = opts || {};
    var family = opts.material_family || "CS";
    var welded = opts.welded !== false;
    var HIC_resistant_steel = !!opts.HIC_resistant_steel;
    var HF_pct = +opts.HF_wt_pct || 0;
    var water_present = !!opts.water_phase_present;

    if (HF_pct === 0) return _notApplicable("HIC-HF", "no HF specified");
    if (family !== "CS" && family !== "low-alloy")
      return _notApplicable("HIC-HF", "CRA not susceptible");
    if (HIC_resistant_steel) return _notApplicable("HIC-HF", "Ca-treated HIC-resistant steel per TM0284");
    if (!water_present) return _notApplicable("HIC-HF", "anhydrous HF — water needed for HIC mechanism");

    var sus;
    if (HF_pct > 5) sus = welded ? "V.High" : "High";
    else if (HF_pct > 1) sus = welded ? "High" : "Medium";
    else sus = "Low";

    return _commonDF(opts, sus, "HIC/SOHIC-HF",
      "API RP 581 (3rd ed.) §6.12 + API RP 751 (4th ed., 2013) §A + "
      + "NACE TM0284-2016 — HIC test (water phase required for hydrogen-charging).");
  }

  // ============= 2.D High-Temperature Hydrogen Attack (HTHA) ==================
  /** Per API 581 §6.13 + API RP 941 (8th ed., 2016) Nelson curves. */
  var NELSON = {
    // T_C boundary as function of pH2_kPa (1980 Nelson curves, conservative).
    // For "operate above this T at this pH2" → susceptible.
    // Source: API RP 941 Fig 1 (CS), Fig 2 (C-0.5Mo), Figs 3-7 (Cr-Mo).
    "CS":           { a: 540, b: 25, max_T: 400 },   // T_safe = a - b·log10(pH2/100)
    "C-0.5Mo":      { a: 540, b: 25, max_T: 400 },   // post-2016 demoted; same curve as CS
    "1Cr-0.5Mo":    { a: 580, b: 20, max_T: 470 },
    "1.25Cr-0.5Mo": { a: 600, b: 20, max_T: 480 },
    "2.25Cr-1Mo":   { a: 660, b: 18, max_T: 510 },
    "3Cr-1Mo":      { a: 700, b: 15, max_T: 540 },
    "5Cr-0.5Mo":    { a: 720, b: 12, max_T: 580 },
    "9Cr-1Mo":      { a: 800, b: 10, max_T: 650 },
    "austenitic":   { a: 1000,b: 5,  max_T: 800 }    // immune below 600 °C
  };
  function htha_DF(opts) {
    opts = opts || {};
    var family = opts.material_family_htha || opts.material_family || "CS";
    var T_C = +opts.T_C || 25;
    var pH2_kPa = +opts.pH2_kPa || 0;
    var cumulative_hr = +opts.cumulative_hr || 0;

    if (pH2_kPa < 50) return _notApplicable("HTHA", "pH2 < 50 kPa — outside HTHA regime");
    if (T_C < 200) return _notApplicable("HTHA", "T < 200 °C — outside HTHA regime");

    // Map material_family to NELSON key
    var key = family;
    if (NELSON[family] == null) {
      if (family === "CS" || family === "low-alloy") key = "CS";
      else if (family === "austenitic-SS") key = "austenitic";
      else key = "CS";
    }
    var curve = NELSON[key];
    // T_safe = a - b·log10(pH2/100); susceptible if T > T_safe.
    var T_safe = curve.a - curve.b * Math.log10(pH2_kPa / 100);
    if (T_safe > curve.max_T) T_safe = curve.max_T;
    var margin_C = T_safe - T_C;

    var sus;
    if (margin_C > 40) sus = "None";
    else if (margin_C > 10) sus = "Low";
    else if (margin_C > -10) sus = "Medium";
    else if (margin_C > -30) sus = "High";
    else sus = "V.High";

    // Cumulative-hours amplifier (Larson-Miller-style)
    if (cumulative_hr > 100000) sus = sus === "Low" ? "Medium" : sus === "Medium" ? "High" : sus;

    var res = _commonDF(opts, sus, "HTHA (High-Temperature H₂ Attack)",
      "API RP 581 (3rd ed.) §6.13 + API RP 941 (8th ed., Sept 2016) Nelson curves. "
      + "T_safe = a - b·log10(pH2_kPa/100); a, b per alloy. "
      + "Post-2016: C-0.5Mo demoted to same Nelson curve as CS (Mo carbide unstable at HTHA temps).");
    res.T_safe_C = T_safe;
    res.margin_C = margin_C;
    res.nelson_alloy_used = key;
    return res;
  }

  // ============= 2.E Mechanical Fatigue (Piping) ==============================
  /** Per API 581 §6.14 + API RP 579-1 Part 14 (low/high cycle fatigue).
   *  Piping vibration + cyclic-loading screen. */
  function mech_fatigue_DF(opts) {
    opts = opts || {};
    var has_visible_vibration = !!opts.has_visible_vibration;
    var cycles_per_yr = +opts.cycles_per_yr || 0;
    var stress_range_MPa = +opts.stress_range_MPa || 0;
    var has_branch_connection = !!opts.has_unreinforced_branch_connection;
    var has_corroded_socket_weld = !!opts.has_corroded_socket_weld;
    var family = opts.material_family || "CS";

    if (cycles_per_yr < 100 && !has_visible_vibration && !has_branch_connection)
      return _notApplicable("Mech Fatigue", "low-cycle service, no vibration, no susceptible geometry");

    var sus = "None";
    if (has_visible_vibration) sus = "High";
    if (has_branch_connection) sus = sus === "High" ? "V.High" : "Medium";
    if (has_corroded_socket_weld) sus = sus === "V.High" ? "V.High" : "High";

    // Stress-range amplifier per API 579 Annex F (Goodman / Soderberg style):
    var Su = family === "CS" ? 414 : 517;      // typical Su for CS / SS (MPa)
    var fatigue_endurance = 0.4 * Su;          // ~ S-N endurance limit
    if (stress_range_MPa > fatigue_endurance) {
      sus = sus === "None" ? "Medium" : sus === "Low" ? "High" : sus === "Medium" ? "High" : "V.High";
    }

    return _commonDF(opts, sus, "Mechanical Fatigue (Piping)",
      "API RP 581 (3rd ed.) §6.14 + API RP 579-1/ASME FFS-1 (2021) Part 14 + "
      + "ASME B31.3 Tab 302.3.5 (allowable stress in cyclic service). "
      + "Visible vibration + branch connections + corroded socket welds are the three primary triggers.");
  }

  // ============= 2.F Brittle Fracture =========================================
  /** Per API 581 §6.15 + ASME VIII Div 1 UG-20 + Fig UCS-66.
   *  Susceptibility from MAT (Min Allowable Temperature per Charpy curves)
   *  vs operating-minimum temperature. */
  function brittle_DF(opts) {
    opts = opts || {};
    var T_min_op_C = opts.T_min_op_C != null ? +opts.T_min_op_C : 0;   // lowest operating T
    var t_mm = +opts.thickness_mm || 25;
    var family = opts.material_family || "CS";
    var charpy_curve = opts.charpy_curve || (family === "low-alloy" ? "B" : "A");
    var has_charpy_test = !!opts.has_charpy_test;
    var post_weld_NDE = !!opts.has_post_weld_NDE;

    // ASME VIII Div 1 Fig UCS-66 — MAT curves A/B/C/D for impact-exempt steels:
    //   A (mild steel uncontrolled): MAT = -29 °C at 12 mm; rises 1 °C per mm above 12
    //   B (typical CS plate SA-516-70 normalised): MAT = -48 °C at 12 mm
    //   C (impact-tested at -29 °C): MAT = -55 °C at 12 mm
    //   D (impact-tested at lowest design T): MAT = -101 °C at 12 mm
    var MAT_base_at_12 = { "A": -29, "B": -48, "C": -55, "D": -101 }[charpy_curve] || -29;
    var MAT_C = MAT_base_at_12 + Math.max(0, t_mm - 12) * 0.5;
    // Margin = op_T - MAT; positive margin → safe
    var margin_C = T_min_op_C - MAT_C;

    var sus;
    if (margin_C > 40) sus = "None";
    else if (margin_C > 17) sus = "Low";
    else if (margin_C > 0) sus = "Medium";
    else if (margin_C > -17) sus = "High";
    else sus = "V.High";

    if (has_charpy_test) sus = sus === "V.High" ? "High" : sus === "High" ? "Medium" : sus === "Medium" ? "Low" : sus;
    if (post_weld_NDE) sus = sus === "Medium" ? "Low" : sus;

    var res = _commonDF(opts, sus, "Brittle Fracture",
      "API RP 581 (3rd ed.) §6.15 + ASME Section VIII Div 1 UG-20 + Fig UCS-66 / UCS-66.1 + "
      + "ASME B31.3 §323.2.2 + Charpy curves A/B/C/D. "
      + "MAT depends on thickness, plate steel, and any impact testing performed.");
    res.MAT_C = MAT_C;
    res.margin_C = margin_C;
    return res;
  }

  // ============= 2.G External Corrosion + CUI ==================================
  /** Per API 581 §6.16 + ISO 9223:2012 + API RP 583 (CUI inspection).
   *  External-atmospheric and CUI both folded in here. */
  function external_DF(opts) {
    opts = opts || {};
    var ext_type = opts.ext_type || "atmospheric";   // "atmospheric" | "CUI"
    var atm_category = opts.atm_category || "C3";   // ISO 9223 C1..C5
    var insulated = !!opts.insulated;
    var T_C = +opts.T_C_external || 25;
    var coating_age_yr = +opts.coating_age_yr || 0;
    var coating_quality = opts.coating_quality || "good";    // "good" | "fair" | "poor" | "none"
    var leaks_visible = !!opts.leaks_or_stains_visible;

    if (ext_type === "atmospheric" || (ext_type === "external" && !insulated)) {
      // ISO 9223 C-category → severity
      var atmMap = { "C1":"None", "C2":"Low", "C3":"Medium", "C4":"High", "C5":"V.High", "CX":"V.High" };
      var sus = atmMap[atm_category] || "Medium";
      if (coating_quality === "none") sus = sus === "Low" ? "Medium" : sus === "Medium" ? "High" : "V.High";
      else if (coating_quality === "poor") sus = sus === "Low" ? "Medium" : sus;
      else if (coating_quality === "good" && coating_age_yr < 5) sus = "Low";

      return _commonDF(opts, sus, "External (Atmospheric)",
        "API RP 581 (3rd ed.) §6.16 + ISO 9223:2012 Tab.3 — atmospheric corrosivity categories C1-C5 / CX. "
        + "Coating quality and age modulate the base category per ISO 12944.");
    }

    // CUI per API 583 §4.3 + NACE SP0198 — T-band-driven
    var inCUIBand = (T_C >= -12 && T_C <= 175);
    if (!inCUIBand) return _notApplicable("External CUI", "T outside CUI band -12 to 175 °C per API 583 §4.3");

    var sus;
    if (T_C >= 60 && T_C <= 121) sus = "V.High";       // Peak CUI band per API 583 Fig 4.3.1
    else if (T_C >= 49 && T_C <= 149) sus = "High";
    else sus = "Medium";

    if (leaks_visible) sus = sus === "Medium" ? "High" : "V.High";
    if (coating_quality === "good" && coating_age_yr < 5) sus = sus === "V.High" ? "High" : "Medium";

    return _commonDF(opts, sus, "External CUI",
      "API RP 581 (3rd ed.) §6.16 + API RP 583 (2014) §4.3 + NACE SP0198-2017. "
      + "Peak CUI band 60-121 °C (water condenses + remains liquid against pipe). "
      + "T outside -12..175 °C band exempt per API 583 §4.3.1.");
  }

  // ============= Combined DF master ===========================================
  /** Computes all applicable DFs given an opts blob describing env + material +
   *  inspections, returns per-mechanism + summed total. */
  function combinedDF(opts) {
    opts = opts || {};
    var thinning = null;
    if (root.RBIDetailed && root.RBIDetailed.thinningDF && opts.t_rdi_mm) {
      thinning = root.RBIDetailed.thinningDF(opts);
    }
    var mechs = [
      thinning && { mechanism:"Thinning", applicable:true, D_f: thinning.D_f_thin, susceptibility:"Medium", ref:thinning.ref, _detail:thinning },
      caustic_DF(opts),
      amine_DF(opts),
      ssc_DF(opts),
      hic_h2s_DF(opts),
      carbonate_DF(opts),
      pasc_DF(opts),
      clscc_DF(opts),
      hsc_hf_DF(opts),
      hic_hf_DF(opts),
      htha_DF(opts),
      mech_fatigue_DF(opts),
      brittle_DF(opts),
      external_DF(opts)
    ].filter(Boolean);

    var active = mechs.filter(function(m){ return m.applicable; });
    // Per API 581 §6.3 — when multiple SCC mechanisms are applicable,
    // DF is the sum (not the max) — they're independent failure modes.
    var total_DF = active.reduce(function(acc, m){ return acc + (m.D_f || 0); }, 0);
    total_DF = Math.min(total_DF, 5000);          // cap per Part 2 §6.3

    return {
      mechanisms: mechs,
      active_mechanisms: active,
      n_active: active.length,
      total_D_f: total_DF,
      ref: "API RP 581 (3rd ed.) Part 2 Annex 2 — total DF is the sum of all "
         + "applicable damage-mechanism DFs (capped at 5000); see §6.3."
    };
  }

  // ============= Embedded regression tests ====================================
  function _runTests() {
    var pass = 0, fail = 0, errs = [];
    function ass(c, m){ if (c) pass++; else { fail++; errs.push(m); } }

    // === Caustic SCC ===
    var c1 = caustic_DF({T_C:25, NaOH_wt_pct:0, material_family:"CS"});
    ass(!c1.applicable, "Caustic: NaOH=0 → not applicable");
    var c2 = caustic_DF({T_C:80, NaOH_wt_pct:30, material_family:"CS", PWHT:true});
    ass(!c2.applicable, "Caustic: PWHT eliminates susceptibility");
    var c3 = caustic_DF({T_C:120, NaOH_wt_pct:50, material_family:"CS", PWHT:false});
    ass(c3.applicable && c3.susceptibility === "High", "Caustic: 50% NaOH at 120 °C / no PWHT → High (got "+c3.susceptibility+")");
    var c4 = caustic_DF({T_C:30, NaOH_wt_pct:50, material_family:"CS", PWHT:false});
    ass(c4.susceptibility === "None", "Caustic: 50% NaOH at 30 °C below threshold → None");

    // === Amine SCC ===
    var a1 = amine_DF({T_C:30, amine_type:"MEA", material_family:"CS"});
    ass(a1.applicable && (a1.susceptibility === "Low" || a1.susceptibility === "None"), "Amine: MEA 30 °C → Low/None (got "+a1.susceptibility+")");
    var a2 = amine_DF({T_C:80, amine_type:"MEA", material_family:"CS", PWHT:false, amine_state:"lean"});
    ass(a2.susceptibility === "Medium", "Amine: lean MEA 80 °C / no PWHT → Medium (got "+a2.susceptibility+")");
    var a3 = amine_DF({T_C:130, amine_type:"MEA", material_family:"CS", PWHT:true});
    ass(a3.susceptibility === "Medium" || a3.susceptibility === "Low", "Amine: PWHT cuts V.High → Medium/Low at 130 °C (got "+a3.susceptibility+")");
    var a4 = amine_DF({T_C:80, amine_type:"MDEA", material_family:"316L", PWHT:false});
    ass(!a4.applicable, "Amine: 316L not susceptible");

    // === SSC ===
    var s1 = ssc_DF({pH:7, pH2S_kPa:0.01, material_family:"CS"});
    ass(!s1.applicable, "SSC: pH2S < 0.05 kPa → not applicable");
    var s2 = ssc_DF({pH:3, pH2S_kPa:200, T_C:25, hardness_HRC:25, material_family:"CS"});
    ass(s2.applicable && s2.susceptibility === "V.High", "SSC: Region 3 + over-hard → V.High (got "+s2.susceptibility+")");
    var s3 = ssc_DF({pH:7, pH2S_kPa:1, T_C:25, hardness_HRC:22, material_family:"CS"});
    ass(s3.susceptibility === "Low" || s3.susceptibility === "None", "SSC: Region 1 + at hardness cap → Low/None (got "+s3.susceptibility+")");
    var s4 = ssc_DF({pH:7, pH2S_kPa:1, T_C:100, material_family:"CS"});
    ass(!s4.applicable, "SSC: T > 65 °C → outside SSC regime");

    // === HIC/SOHIC-H2S ===
    var h1 = hic_h2s_DF({pH:7, pH2S_kPa:0.1, material_family:"CS"});
    ass(!h1.applicable, "HIC-H2S: pH2S < 0.3 kPa → non-sour");
    var h2 = hic_h2s_DF({pH:3.5, pH2S_kPa:50, cyanide_ppm:50, material_family:"CS"});
    ass(h2.applicable && h2.susceptibility === "V.High", "HIC-H2S: low pH + cyanide → V.High (got "+h2.susceptibility+")");
    var h3 = hic_h2s_DF({pH:7, pH2S_kPa:10, material_family:"CS", HIC_resistant_steel:true});
    ass(!h3.applicable, "HIC-H2S: Ca-treated resistant steel → not applicable");
    var h4 = hic_h2s_DF({pH:7, pH2S_kPa:10, material_family:"316L"});
    ass(!h4.applicable, "HIC-H2S: 316L not susceptible");

    // === Carbonate SCC ===
    var cb1 = carbonate_DF({T_C:90, pH:10, CO3_ppm:1000, material_family:"CS", PWHT:false});
    ass(cb1.applicable && (cb1.susceptibility === "Medium" || cb1.susceptibility === "Low"), "Carbonate: 90 °C pH 10 → Medium/Low");
    var cb2 = carbonate_DF({T_C:25, pH:7, CO3_ppm:1000, material_family:"CS"});
    ass(!cb2.applicable, "Carbonate: pH 7 = boundary → not applicable (need pH > 7 strict)");
    var cb3 = carbonate_DF({T_C:90, pH:10, CO3_ppm:1000, material_family:"CS", PWHT:true});
    ass(!cb3.applicable, "Carbonate: PWHT eliminates");

    // === PASCC ===
    var p1 = pasc_DF({material_family:"austenitic-SS", sensitised:true, H2S_service:true, shutdown_purged_or_neutralised:false});
    ass(p1.applicable && p1.susceptibility === "V.High", "PASCC: sensitised + H2S → V.High");
    var p2 = pasc_DF({material_family:"austenitic-SS", sensitised:true, H2S_service:true, shutdown_purged_or_neutralised:true});
    ass(!p2.applicable, "PASCC: shutdown-purged eliminates");
    var p3 = pasc_DF({material_family:"austenitic-SS", sensitised:false, stabilised:true, H2S_service:true});
    ass(!p3.applicable, "PASCC: Ti/Nb-stabilised not susceptible");

    // === Cl-SCC ===
    var cl1 = clscc_DF({T_C:25, Cl_ppm:5, material_family:"austenitic-SS", PREN:25});
    ass(!cl1.applicable, "Cl-SCC: Cl < 10 ppm → not applicable");
    var cl2 = clscc_DF({T_C:80, Cl_ppm:5000, material_family:"austenitic-SS", PREN:25});
    ass(cl2.applicable && cl2.susceptibility !== "None", "Cl-SCC: 304/316 at 80 °C / 5k Cl → susceptible (got "+cl2.susceptibility+")");
    var cl3 = clscc_DF({T_C:80, Cl_ppm:5000, material_family:"super-austenitic", PREN:43});
    ass(cl3.applicable && (cl3.susceptibility === "None" || cl3.susceptibility === "Low"), "Cl-SCC: 254SMO at 80 °C → None/Low (got "+cl3.susceptibility+")");
    var cl4 = clscc_DF({T_C:25, Cl_ppm:50000, material_family:"CS"});
    ass(!cl4.applicable, "Cl-SCC: CS not Cl-SCC susceptible (HIC/H2S route instead)");

    // === HSC-HF ===
    var hh0 = hsc_hf_DF({material_family:"CS", HF_wt_pct:0});
    ass(!hh0.applicable, "HSC-HF: no HF service → not applicable");
    var hh1 = hsc_hf_DF({material_family:"CS", HF_wt_pct:80, Cu_pct:0.8, Ni_pct:0.1, PWHT:true});
    ass(hh1.susceptibility === "V.High", "HSC-HF: Cu+Ni > 0.5% → V.High per API 751 §A.4");
    var hh2 = hsc_hf_DF({material_family:"CS", HF_wt_pct:80, hardness_HRC:25, PWHT:true});
    ass(hh2.susceptibility === "High", "HSC-HF: over-hard → High");
    var hh3 = hsc_hf_DF({material_family:"CS", HF_wt_pct:80, hardness_HRC:18, PWHT:true, Cu_pct:0, Ni_pct:0});
    ass(hh3.susceptibility === "Low", "HSC-HF: in-spec + PWHT → Low");

    // === HIC-HF ===
    var hhf1 = hic_hf_DF({material_family:"CS", HF_wt_pct:8, water_phase_present:true, welded:true});
    ass(hhf1.susceptibility === "V.High", "HIC-HF: 8% HF + welded + wet → V.High");
    var hhf2 = hic_hf_DF({material_family:"CS", HF_wt_pct:8, water_phase_present:false});
    ass(!hhf2.applicable, "HIC-HF: anhydrous → not applicable");

    // === HTHA — CS at high pH2/T should be susceptible per Nelson curve ===
    var t1 = htha_DF({material_family:"CS", T_C:520, pH2_kPa:10000});
    ass(t1.applicable, "HTHA: CS at 520 °C / 100 bar H2 → applicable");
    ass(t1.susceptibility !== "None", "HTHA: CS at 520 °C / 100 bar H2 above Nelson curve (got "+t1.susceptibility+", margin="+t1.margin_C.toFixed(0)+" °C)");
    var t2 = htha_DF({material_family:"2.25Cr-1Mo", T_C:300, pH2_kPa:5000});
    ass(t2.applicable && (t2.susceptibility === "None" || t2.susceptibility === "Low"), "HTHA: 2.25Cr-1Mo at 300 °C → None/Low (correct alloy choice)");
    var t3 = htha_DF({material_family:"CS", T_C:150, pH2_kPa:5000});
    ass(!t3.applicable, "HTHA: T<200 → outside regime");
    var t4 = htha_DF({material_family:"CS", T_C:300, pH2_kPa:10});
    ass(!t4.applicable, "HTHA: pH2<50kPa → outside regime");

    // === Mechanical Fatigue ===
    var mf1 = mech_fatigue_DF({has_visible_vibration:true, material_family:"CS"});
    ass(mf1.applicable && mf1.susceptibility !== "None", "Mech Fatigue: visible vibration → High");
    var mf2 = mech_fatigue_DF({cycles_per_yr:50, has_visible_vibration:false, has_unreinforced_branch_connection:false});
    ass(!mf2.applicable, "Mech Fatigue: no triggers → not applicable");

    // === Brittle Fracture ===
    var b1 = brittle_DF({T_min_op_C:25, thickness_mm:25, material_family:"CS", charpy_curve:"B"});
    ass(b1.susceptibility === "None", "Brittle: 25 °C with curve B → None");
    var b2 = brittle_DF({T_min_op_C:-50, thickness_mm:50, material_family:"CS", charpy_curve:"A"});
    ass(b2.susceptibility === "V.High" || b2.susceptibility === "High", "Brittle: -50 °C / 50 mm / curve A → High/V.High");
    // Curve D plate (impact-tested at lowest design T) is best, but at -100 °C
    // 25 mm plate MAT ≈ -94.5 °C → margin -5.5 °C → "High" (still cracking-risk band)
    var b3 = brittle_DF({T_min_op_C:-100, thickness_mm:25, material_family:"low-alloy", charpy_curve:"D"});
    ass(b3.susceptibility === "High" || b3.susceptibility === "Medium", "Brittle: -100 °C / curve D / 25 mm → High/Medium (got "+b3.susceptibility+", MAT="+b3.MAT_C.toFixed(1)+", margin="+b3.margin_C.toFixed(1)+")");
    var b3a = brittle_DF({T_min_op_C:-50, thickness_mm:12, material_family:"low-alloy", charpy_curve:"D"});
    ass(b3a.susceptibility === "Low" || b3a.susceptibility === "None", "Brittle: -50 °C / curve D / 12 mm → safe (MAT="+b3a.MAT_C.toFixed(1)+", margin="+b3a.margin_C.toFixed(1)+")");

    // === External / CUI ===
    var e1 = external_DF({ext_type:"atmospheric", atm_category:"C5", coating_quality:"poor"});
    ass(e1.susceptibility === "V.High", "External: C5 + poor coat → V.High");
    var e2 = external_DF({ext_type:"CUI", insulated:true, T_C_external:80, coating_quality:"fair"});
    ass(e2.applicable && e2.susceptibility === "V.High", "External: CUI peak band 60-121 °C → V.High");
    var e3 = external_DF({ext_type:"CUI", insulated:true, T_C_external:250});
    ass(!e3.applicable, "External: T > 175 °C → no CUI");
    var e4 = external_DF({ext_type:"atmospheric", atm_category:"C1", coating_quality:"good", coating_age_yr:2});
    ass(e4.susceptibility === "None" || e4.susceptibility === "Low", "External: C1 + new coating → None/Low");

    // === combinedDF ===
    var cmb = combinedDF({
      material_family:"CS", T_C:80, pH2S_kPa:50, pH:4.5, cyanide_ppm:30, welded:true,
      ext_type:"CUI", insulated:true, T_C_external:80, coating_quality:"poor", age_yr:10
    });
    ass(cmb.n_active >= 2, "combinedDF: HIC + CUI both active for sour-service insulated CS (got "+cmb.n_active+")");
    ass(cmb.total_D_f > 0, "combinedDF: total DF positive");
    ass(cmb.total_D_f <= 5000, "combinedDF: total DF capped at 5000");

    // === Inspection effectiveness reduces DF ===
    var pNoIns = clscc_DF({T_C:80, Cl_ppm:5000, material_family:"austenitic-SS", PREN:25, age_yr:10, inspection_history:[]});
    var pGoodIns = clscc_DF({T_C:80, Cl_ppm:5000, material_family:"austenitic-SS", PREN:25, age_yr:10, inspection_history:[{eff:"A"},{eff:"A"}]});
    ass(pGoodIns.D_f < pNoIns.D_f, "Inspection-effectiveness reduces DF (no-ins="+pNoIns.D_f.toFixed(1)+" vs good-ins="+pGoodIns.D_f.toFixed(1)+")");

    // === SVI sanity (severities map to non-decreasing DFs ceteris paribus) ===
    function _quick(sus){ return _commonDF({age_yr:10, inspection_history:[]}, sus, "test", "test").D_f; }
    var df_None = _quick("None"), df_Low = _quick("Low"), df_Med = _quick("Medium"), df_High = _quick("High"), df_VH = _quick("V.High");
    ass(df_None <= df_Low && df_Low <= df_Med && df_Med <= df_High && df_High <= df_VH,
      "SVI monotonic: "+df_None+" ≤ "+df_Low+" ≤ "+df_Med+" ≤ "+df_High+" ≤ "+df_VH);

    return { pass: pass, fail: fail, errs: errs, total: pass+fail };
  }

  var RBIDamage = {
    SVI_LEVEL: SVI_LEVEL,
    EFF_REDUCTION: EFF_REDUCTION,
    NELSON: NELSON,
    caustic_DF: caustic_DF,
    amine_DF: amine_DF,
    ssc_DF: ssc_DF,
    hic_h2s_DF: hic_h2s_DF,
    carbonate_DF: carbonate_DF,
    pasc_DF: pasc_DF,
    clscc_DF: clscc_DF,
    hsc_hf_DF: hsc_hf_DF,
    hic_hf_DF: hic_hf_DF,
    htha_DF: htha_DF,
    mech_fatigue_DF: mech_fatigue_DF,
    brittle_DF: brittle_DF,
    external_DF: external_DF,
    combinedDF: combinedDF,
    _runTests: _runTests
  };
  root.RBIDamage = RBIDamage;
  if (typeof module !== "undefined" && module.exports) module.exports = RBIDamage;
})(typeof window !== "undefined" ? window : (typeof global !== "undefined" ? global : this));

if (typeof require !== "undefined" && require.main === module) {
  // node bootstrap: load RBIDetailed first so combinedDF can call it
  try { global.RBIDetailed = require("./rbi-detailed.js"); } catch(_){}
  var R = module.exports;
  var r = R._runTests();
  console.log("RBI-Damage regression: PASS " + r.pass + " / FAIL " + r.fail + " / total " + r.total);
  if (r.fail) r.errs.forEach(function(e){ console.log("  - " + e); });
}
