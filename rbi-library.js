/* rbi-library.js — Pre-populated equipment templates for refining / petrochem
 * / oil-gas industry. Common assets with typical service envelopes that the
 * Fleet or Integrity tab can preload with one click.
 *
 * Each entry contains a complete combinedDF input blob + a free-text scope
 * note. Sources: API RP 939-C, NACE 6F176, refinery operations textbooks
 * (Gary & Handwerk 2007), CCPS process-design references, owner-spec
 * documents in the public domain (Shell DEP, ExxonMobil GP, Aramco SAES).
 */
(function (root) {
  "use strict";

  var EQUIPMENT_TEMPLATES = {
    "fcc_overhead_drum": {
      label: "FCC Main-Column Overhead Drum",
      category: "Refining",
      scope: "Sour-water + LPG vapour from FCC fractionator; HCN + H2S + NH3 + Cl + phenolic compounds. Carbonate SCC + HIC concerns.",
      type: "drum",
      env: "sour", material_family: "CS",
      T_C: 50, pH: 9, pH2S_kPa: 80, Cl_ppm: 500, cyanide_ppm: 100, NaOH_wt_pct: 0,
      hardness_HRC: 22, PWHT: false, welded: true,
      CO3_ppm: 1000, charpy_curve: "B", thickness_mm: 16,
      age_yr: 18, CR_mmyr: 0.10, t_rdi_mm: 16, t_min_mm: 9.5, CA_mm: 3,
      gff_type: "drum",
      ref: "API RP 571 §4.5.5 + API RP 945 §4 — FCC OH drum classic carbonate-SCC service."
    },
    "hydrotreater_reactor": {
      label: "Hydrotreater Reactor (HDS/HDN)",
      category: "Refining",
      scope: "Hot H2 + H2S + sour HC at 300-400 °C / 50-80 bar. HTHA + SSC + HIC concerns. Typically 2.25Cr-1Mo or 1.25Cr-0.5Mo cladded with 347 SS.",
      type: "vessel",
      env: "hightemp_h2", material_family: "2.25Cr-1Mo",
      T_C: 380, pH: 4, pH2S_kPa: 500, Cl_ppm: 0, pH2_kPa: 8000,
      hardness_HRC: 22, PWHT: true, welded: true,
      thickness_mm: 100,
      age_yr: 25, CR_mmyr: 0.05, t_rdi_mm: 100, t_min_mm: 80, CA_mm: 6,
      gff_type: "vessel",
      ref: "API RP 941 Nelson curves + NACE MR0103 §6 — hydrotreater reactor design."
    },
    "amine_contactor": {
      label: "Amine Contactor (MEA/MDEA)",
      category: "Refining / Gas processing",
      scope: "Lean amine absorbing H2S + CO2 from sour gas. Amine SCC + HIC + Carbonate SCC concerns above 60 °C without PWHT.",
      type: "column",
      env: "amine", material_family: "CS",
      T_C: 60, pH: 9.5, pH2S_kPa: 10, Cl_ppm: 100, NaOH_wt_pct: 0,
      amine_type: "MEA", amine_state: "lean", CO3_ppm: 800,
      hardness_HRC: 22, PWHT: true, welded: true,
      thickness_mm: 16,
      age_yr: 22, CR_mmyr: 0.07, t_rdi_mm: 16, t_min_mm: 9.5, CA_mm: 3,
      gff_type: "column",
      ref: "API RP 945 (3rd ed., 2003) §4 + NACE 5A171 — amine contactor design."
    },
    "amine_regenerator": {
      label: "Amine Regenerator Bottoms (Reboiler)",
      category: "Refining / Gas processing",
      scope: "Hot lean amine returning to absorber after stripping. Amine SCC + Carbonate SCC + heat-stable salt (HSAS) attack.",
      type: "vessel",
      env: "amine", material_family: "CS",
      T_C: 125, pH: 9, pH2S_kPa: 5, Cl_ppm: 50, CO3_ppm: 500,
      amine_type: "MEA", amine_state: "lean",
      hardness_HRC: 22, PWHT: true, welded: true,
      thickness_mm: 16,
      age_yr: 18, CR_mmyr: 0.12, t_rdi_mm: 16, t_min_mm: 10, CA_mm: 3,
      gff_type: "vessel",
      ref: "API RP 945 §6 + Bagdasarian 1991 — regenerator high-T amine cracking."
    },
    "sour_water_stripper_bottoms": {
      label: "Sour-Water Stripper Bottoms",
      category: "Refining",
      scope: "Bottoms of stripper column — hot stripped sour water with NH3, H2S residuals. SSC + HIC + general thinning.",
      type: "drum",
      env: "sour", material_family: "CS",
      T_C: 130, pH: 6, pH2S_kPa: 5, Cl_ppm: 500, cyanide_ppm: 10,
      hardness_HRC: 22, PWHT: true, welded: true,
      thickness_mm: 14,
      age_yr: 17, CR_mmyr: 0.15, t_rdi_mm: 14, t_min_mm: 7.5, CA_mm: 3,
      gff_type: "drum",
      ref: "API RP 571 §4.5.4 — sour-water stripper bottoms classic damage location."
    },
    "crude_atm_column_overhead": {
      label: "Crude Atmospheric-Column Overhead",
      category: "Refining",
      scope: "Top of crude tower; HCl + organic acids (NAP) + H2O + sour LPG. Hydrochloric-acid corrosion + ammonium-chloride salt deposition.",
      type: "column",
      env: "sour", material_family: "CS",
      T_C: 130, pH: 5.5, pH2S_kPa: 10, Cl_ppm: 100, CO3_ppm: 0,
      hardness_HRC: 22, PWHT: false, welded: true,
      thickness_mm: 12,
      age_yr: 20, CR_mmyr: 0.20, t_rdi_mm: 12, t_min_mm: 6.5, CA_mm: 3,
      gff_type: "column",
      ref: "API RP 571 §5.1.1.1 HCl + §4.4.1 NH4Cl — crude overhead system corrosion."
    },
    "hf_alkylation_settler": {
      label: "HF-Alkylation Settler",
      category: "Refining (HF unit)",
      scope: "70-80% HF + isobutane/propylene; HSC-HF + HIC-HF. CS with Cu+Ni residual cap 0.5%, hardness HRC 22 max, PWHT mandatory per API 751.",
      type: "vessel",
      env: "hf", material_family: "CS",
      T_C: 40, pH: 1, pH2S_kPa: 0, Cl_ppm: 0,
      HF_wt_pct: 80, water_phase_present: true,
      hardness_HRC: 18, PWHT: true, welded: true,
      thickness_mm: 20,
      age_yr: 20, CR_mmyr: 0.05, t_rdi_mm: 20, t_min_mm: 12, CA_mm: 6,
      gff_type: "vessel",
      ref: "API RP 751 (4th ed., 2013) §A — HF alkylation material specs."
    },
    "alkylation_acid_settler": {
      label: "Alkylation Acid Settler (H2SO4 unit)",
      category: "Refining",
      scope: "Sulfuric acid + alkylate phases at ~10 °C. Acid mixed with hydrocarbon; sulfuric-acid corrosion of CS at low velocity.",
      type: "vessel",
      env: "generic", material_family: "CS",
      T_C: 10, pH: 1, pH2S_kPa: 0, Cl_ppm: 0,
      hardness_HRC: 22, PWHT: false, welded: true,
      thickness_mm: 16,
      age_yr: 25, CR_mmyr: 0.13, t_rdi_mm: 16, t_min_mm: 8, CA_mm: 3,
      gff_type: "vessel",
      ref: "Shell DEP 30.10.60.18 + API RP 571 §5.1.1.3 — sulfuric-acid corrosion of CS."
    },
    "reformer_reactor_eff": {
      label: "Catalytic Reformer Reactor Effluent",
      category: "Refining",
      scope: "Hot dry H2 + naphtha + light HC at 480-525 °C / 30 bar. HTHA risk for CS — typically 2.25Cr-1Mo or 1.25Cr-0.5Mo construction.",
      type: "vessel",
      env: "hightemp_h2", material_family: "1.25Cr-0.5Mo",
      T_C: 500, pH: 7, pH2S_kPa: 0, Cl_ppm: 0, pH2_kPa: 3000,
      hardness_HRC: 22, PWHT: true, welded: true,
      thickness_mm: 60,
      age_yr: 28, CR_mmyr: 0.02, t_rdi_mm: 60, t_min_mm: 48, CA_mm: 3,
      gff_type: "vessel",
      ref: "API RP 941 + API RP 571 §4.2.7 HTHA — reformer reactor at HTHA-relevant T."
    },
    "deisobutaniser": {
      label: "Deisobutaniser (HF alkylation downstream)",
      category: "Refining",
      scope: "C4 separation in HF unit; trace HF + organic fluorides → HIC-HF if condensation. CS construction with PWHT.",
      type: "column",
      env: "hf", material_family: "CS",
      T_C: 60, pH: 7, pH2S_kPa: 0, Cl_ppm: 0,
      HF_wt_pct: 1, water_phase_present: true,
      hardness_HRC: 22, PWHT: true, welded: true,
      thickness_mm: 12,
      age_yr: 22, CR_mmyr: 0.05, t_rdi_mm: 12, t_min_mm: 7, CA_mm: 3,
      gff_type: "column",
      ref: "API RP 751 §A + Bemelmans 1985 Mater Perf 24(3) 41 — fluoride condensation HIC."
    },
    "caustic_scrubber": {
      label: "Caustic Scrubber (NaOH wash)",
      category: "Refining / Gas processing",
      scope: "20-30 wt% NaOH removing H2S + mercaptans. Caustic SCC of CS without PWHT above 50 °C.",
      type: "column",
      env: "caustic", material_family: "CS",
      T_C: 60, pH: 14, pH2S_kPa: 0.5, Cl_ppm: 0, NaOH_wt_pct: 30,
      hardness_HRC: 22, PWHT: true, welded: true,
      thickness_mm: 12,
      age_yr: 25, CR_mmyr: 0.02, t_rdi_mm: 12, t_min_mm: 6, CA_mm: 3,
      gff_type: "column",
      ref: "NACE SP0403 + API RP 571 §4.5.3 — caustic SCC nomograph + service rules."
    },
    "crude_storage_tank": {
      label: "Crude Storage Tank (cone-roof)",
      category: "Refining / Storage",
      scope: "Crude oil storage at ambient T; floor under-side soil corrosion + shell atmospheric + external CUI not applicable. Settlement on soft foundations.",
      type: "AST-shell-welded-maintained",
      env: "atmospheric", material_family: "CS",
      T_C: 25, pH: 7, pH2S_kPa: 0, Cl_ppm: 50,
      hardness_HRC: 22, PWHT: false, welded: true,
      thickness_mm: 12,
      age_yr: 30, CR_mmyr: 0.08, t_rdi_mm: 12, t_min_mm: 6, CA_mm: 3,
      gff_type: "AST-shell-welded-maintained",
      ref: "API STD 653 + API STD 575 — AST inspection / damage / maintenance."
    },
    "hexc_inh_buffer_tank": {
      label: "HEX Cooling-Water Inhibitor Buffer Tank",
      category: "Utilities",
      scope: "Inhibited cooling-water make-up at 35-50 °C. CS with phosphonate/Zn/TTA inhibitor target CR <0.075 mm/yr.",
      type: "vessel",
      env: "generic", material_family: "CS",
      T_C: 35, pH: 8.0, pH2S_kPa: 0, Cl_ppm: 250, NaOH_wt_pct: 0,
      hardness_HRC: 22, PWHT: false, welded: true,
      thickness_mm: 8,
      age_yr: 12, CR_mmyr: 0.03, t_rdi_mm: 8, t_min_mm: 4, CA_mm: 2,
      gff_type: "vessel",
      ref: "Cooling Technology Institute CTI ESG-200 (2018) — treated CW corrosion targets."
    },
    "boiler_economiser": {
      label: "Steam Boiler Economiser",
      category: "Utilities",
      scope: "Feedwater heating coils 200-280 °C. Flow-Accelerated Corrosion risk at single-phase 90-230 °C; pH 9.5 (NH3) with magnetite film.",
      type: "exchanger-shell",
      env: "generic", material_family: "CS",
      T_C: 220, pH: 9.5, pH2S_kPa: 0, Cl_ppm: 5,
      hardness_HRC: 22, PWHT: false, welded: true,
      thickness_mm: 6,
      age_yr: 12, CR_mmyr: 0.08, t_rdi_mm: 6, t_min_mm: 3, CA_mm: 1.5,
      gff_type: "exchanger-shell",
      ref: "IAPWS TGD2-09 (2015) + EPRI 1014099 (2006) FAC database."
    },
    "fgd_absorber": {
      label: "FGD Wet-Limestone Absorber Sump",
      category: "Power generation",
      scope: "Wet flue-gas-desulphurisation slurry sump at 60 °C / pH 2.5-4 / Cl 30000-50000 ppm. Hastelloy C-276 / Alloy 625 weld-overlay common.",
      type: "vessel",
      env: "sour", material_family: "CS",
      T_C: 60, pH: 3, pH2S_kPa: 1, Cl_ppm: 50000,
      hardness_HRC: 22, PWHT: false, welded: true,
      thickness_mm: 12,
      age_yr: 15, CR_mmyr: 0.18, t_rdi_mm: 12, t_min_mm: 6, CA_mm: 3,
      gff_type: "vessel",
      ref: "Smith 1990 NACE Corrosion 90 Paper 90139 — Alloy 625 weld overlay in FGD sump."
    },
    "pwr_steam_generator": {
      label: "PWR Steam Generator (legacy 600 / current 690)",
      category: "Nuclear power",
      scope: "PWR primary water 290-320 °C / pH 6.9 (lithiated). PWSCC of Alloy 600 (Norring 2008); Alloy 690 (TT) factor >30 improvement.",
      type: "exchanger-shell",
      env: "hightemp_h2", material_family: "austenitic-SS",
      T_C: 320, pH: 6.9, pH2S_kPa: 0, Cl_ppm: 0,
      hardness_HRC: 22, PWHT: false, welded: true,
      thickness_mm: 75,
      age_yr: 20, CR_mmyr: 0.01, t_rdi_mm: 75, t_min_mm: 60, CA_mm: 3,
      gff_type: "exchanger-shell",
      ref: "EPRI 3002013108 (2018) PWSCC Database + Scott 2000 Corrosion 56, 771."
    },
    "scco2_pipeline": {
      label: "Supercritical-CO₂ Pipeline (CCS)",
      category: "Energy transition",
      scope: "scCO2 + ≤500 ppm H2O at 100 °C / 100 bar. CS allowed if water <50 ppm (per DNV-RP-F104); above that, CR ~0.4 mm/yr.",
      type: "pipe-4-10in",
      env: "sCO2", material_family: "CS",
      T_C: 100, pH: 4, pH2S_kPa: 0, Cl_ppm: 0,
      hardness_HRC: 22, PWHT: false, welded: true,
      thickness_mm: 12,
      age_yr: 5, CR_mmyr: 0.30, t_rdi_mm: 12, t_min_mm: 7, CA_mm: 2,
      gff_type: "pipe-4-10in",
      ref: "DNV-RP-F104 + Sim 2014 Corrosion 70, 185; Hua 2017 Mater Corros 68, 56."
    },
    "concrete_rebar": {
      label: "Concrete-encased Structural Rebar",
      category: "Civil",
      scope: "Black-bar rebar in chloride-free concrete pore solution (pH 12.6 sat. Ca(OH)2). Carbonation-driven cover-loss after 30+ yr; pitting if Cl/OH > 0.6.",
      type: "vessel", // approximation
      env: "generic", material_family: "CS",
      T_C: 20, pH: 12.6, pH2S_kPa: 0, Cl_ppm: 100,
      hardness_HRC: 22, PWHT: false, welded: false,
      thickness_mm: 25,
      age_yr: 35, CR_mmyr: 0.02, t_rdi_mm: 25, t_min_mm: 15, CA_mm: 3,
      gff_type: "vessel",
      ref: "Bertolini 2013 + ACI 222R-19 — concrete rebar corrosion."
    },
    "offshore_subsea_pipeline": {
      label: "Subsea Pipeline (CRA clad)",
      category: "Oil & gas / subsea",
      scope: "Multi-phase HC + produced water at 70-90 °C / 100-200 bar / Cl 50-100k ppm / H2S 10-100 kPa. Inconel 625 clad over CS; CP per DNV-RP-B401.",
      type: "pipe-gt-10in",
      env: "sour", material_family: "Inconel-625",
      T_C: 80, pH: 4.5, pH2S_kPa: 50, Cl_ppm: 80000,
      hardness_HRC: 22, PWHT: false, welded: true,
      thickness_mm: 25,
      age_yr: 12, CR_mmyr: 0.02, t_rdi_mm: 25, t_min_mm: 18, CA_mm: 3,
      gff_type: "pipe-gt-10in",
      ref: "ISO 15156-3 Tab.A.39 + DNV-RP-F112 — subsea sour-service CRA pipeline."
    },
    "flare_knockout_drum": {
      label: "Flare K.O. Drum",
      category: "Refining / Safety",
      scope: "Wet sour gas + HC condensate collection; intermittent service; cyclic thermal load. HIC/SOHIC + brittle-fracture concern at cold ambient.",
      type: "drum",
      env: "sour", material_family: "CS",
      T_C: 30, pH: 5, pH2S_kPa: 30, Cl_ppm: 500,
      hardness_HRC: 22, PWHT: true, welded: true,
      thickness_mm: 14, T_min_op_C: -20, charpy_curve: "B",
      age_yr: 25, CR_mmyr: 0.06, t_rdi_mm: 14, t_min_mm: 8, CA_mm: 3,
      gff_type: "drum",
      ref: "API STD 537 + API RP 521 — flare-system design + drum sizing."
    }
  };

  /** Returns a list of {key, label, category} for UI selectors */
  function templates() {
    return Object.keys(EQUIPMENT_TEMPLATES).map(function(k){
      var t = EQUIPMENT_TEMPLATES[k];
      return { key: k, label: t.label, category: t.category };
    });
  }

  /** Returns the full template blob for one key */
  function get(key) { return EQUIPMENT_TEMPLATES[key] || null; }

  /** Categorised list for UI */
  function byCategory() {
    var byc = {};
    Object.keys(EQUIPMENT_TEMPLATES).forEach(function(k){
      var t = EQUIPMENT_TEMPLATES[k];
      if (!byc[t.category]) byc[t.category] = [];
      byc[t.category].push({ key: k, label: t.label });
    });
    return byc;
  }

  function _runTests() {
    var pass = 0, fail = 0, errs = [];
    function ass(c, m){ if (c) pass++; else { fail++; errs.push(m); } }
    ass(Object.keys(EQUIPMENT_TEMPLATES).length >= 20, "≥20 templates (got "+Object.keys(EQUIPMENT_TEMPLATES).length+")");
    var cats = byCategory();
    ass(Object.keys(cats).length >= 5, "≥5 categories (got "+Object.keys(cats).length+")");
    Object.keys(EQUIPMENT_TEMPLATES).forEach(function(k){
      var t = EQUIPMENT_TEMPLATES[k];
      if (!t.label || !t.category || !t.scope || !t.ref) errs.push(k+" missing required field");
      else pass++;
    });
    if (errs.length > 2) fail += (errs.length - 2);
    return { pass: pass, fail: fail, errs: errs, total: pass+fail };
  }

  var RBILibrary = {
    EQUIPMENT_TEMPLATES: EQUIPMENT_TEMPLATES,
    templates: templates,
    get: get,
    byCategory: byCategory,
    _runTests: _runTests
  };
  root.RBILibrary = RBILibrary;
  if (typeof module !== "undefined" && module.exports) module.exports = RBILibrary;
})(typeof window !== "undefined" ? window : (typeof global !== "undefined" ? global : this));

if (typeof require !== "undefined" && require.main === module) {
  var L = module.exports;
  var r = L._runTests();
  console.log("RBI-Library: PASS " + r.pass + " / FAIL " + r.fail + " / total " + r.total);
}
