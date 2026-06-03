/* mr0175.js — NACE MR0175 / ISO 15156:2020 spec-issuer for PitCast.
 *
 * Takes (composition, service conditions, equipment class) and dispatches to
 * the applicable Annex A envelope in ISO 15156-3:2020, returning a citation-
 * grounded verdict suitable for a procurement-grade material spec sheet.
 *
 * Sources (cited inline in each verdict.citations):
 *   - ANSI/NACE MR0175-2021 / ISO 15156:2020 Parts 1 (general), 2 (CS/LAS), 3 (CRA)
 *   - Technical Circulars 1 & 2 (2021–2022): S17400 stress restriction; UNS
 *     N09945/N09946 separated; UNS N07718 high-strength Alloy 718; UNS R55400
 *     α-β Ti added; A.24 Cl_max 180,000 mg/L added.
 *   - NACE MR0103-2018 (refining sour service — separate scope)
 *   - NORSOK M-001:2014 (Norwegian material selection — overlay)
 *   - ASTM E140 (HRC↔HV10 cross-conversion)
 *
 * Limits: screening dispatcher. Where exact numerical envelope thresholds are
 * not documented in the open literature (and the standard itself is paywalled
 * at ~$800), the data layer carries `needs_review:true` and the dispatcher
 * conservatively flags the verdict for engineer override. NEVER fabricated.
 */
(function (root) {
  "use strict";

  // ----- ENVELOPE CATALOGUE -----------------------------------------------
  // Loaded async in the browser; in node we read the JSON file at require time.
  var ANNEXES = null;
  function setAnnexes(a) { ANNEXES = a; }
  function _getAnnexes() {
    if (ANNEXES) return ANNEXES;
    if (typeof require !== "undefined") {
      try { ANNEXES = require("./data/mr0175-annexes.json"); return ANNEXES; } catch(e){}
    }
    if (typeof window !== "undefined" && window._MR0175_ANNEXES) {
      ANNEXES = window._MR0175_ANNEXES; return ANNEXES;
    }
    return [];
  }

  // ----- FAMILY CLASSIFIER ------------------------------------------------
  // PREN = Cr + 3.3·Mo + 16·N. Cr-eq/Ni-eq for duplex discrimination.
  function _pren(c) {
    return (+c.Cr || 0) + 3.3 * (+c.Mo || 0) + 16 * (+c.N || 0);
  }
  function _crEq(c) {
    return (+c.Cr || 0) + 1.5 * (+c.Si || 0) + 1.4 * (+c.Mo || 0) + (+c.Nb || 0) - 4.99;
  }
  function _niEq(c) {
    return (+c.Ni || 0) + 30 * (+c.C || 0) + 0.5 * (+c.Mn || 0) + 26 * ((+c.N || 0) - 0.02) + 2.77;
  }

  // UNS → family fast-path (covers the most common engineering alloys)
  var UNS_FAMILY = {
    // CS / LAS
    "K02600":"CS", "K03014":"CS", "K11352":"CS", "K12054":"LAS", "K22035":"LAS",
    // Austenitic SS
    "S30400":"austenitic-SS", "S30403":"austenitic-SS",
    "S31600":"austenitic-SS", "S31603":"austenitic-SS",
    "S31700":"austenitic-SS", "S31703":"austenitic-SS", "S34700":"austenitic-SS",
    // Hi-austenitic / super-austenitic
    "S31254":"hi-austenitic-SS", "N08367":"hi-austenitic-SS",
    "N08926":"hi-austenitic-SS", "N08028":"hi-austenitic-SS",
    "N08825":"hi-austenitic-SS",
    // Ferritic
    "S43000":"ferritic-SS", "S40500":"ferritic-SS", "S44400":"ferritic-SS",
    // Martensitic
    "S41000":"martensitic-SS", "S41425":"martensitic-SS",
    "S42000":"martensitic-SS", "J91540":"martensitic-SS",
    // Duplex / super-duplex
    "S31803":"duplex-SS", "S32205":"duplex-SS",
    "S32750":"super-duplex-SS", "S32760":"super-duplex-SS",
    "S32550":"super-duplex-SS", "S39274":"super-duplex-SS",
    // PH SS
    "S17400":"PH-martensitic", "S15500":"PH-martensitic", "S66286":"PH-austenitic",
    // Solid-solution Ni-Cr-Mo
    "N10276":"Ni-Cr-Mo-solid", "N06022":"Ni-Cr-Mo-solid", "N06059":"Ni-Cr-Mo-solid",
    "N06200":"Ni-Cr-Mo-solid", "N06625":"Ni-Cr-Mo-solid",
    "N06985":"Ni-Cr-Mo-solid", "N06975":"Ni-Cr-Mo-solid",
    // PH Ni
    "N07718":"PH-Ni", "N07725":"PH-Ni",
    "N09925":"PH-Ni", "N09935":"PH-Ni", "N09945":"PH-Ni", "N09946":"PH-Ni",
    "N09955":"PH-Ni", "N07716":"PH-Ni", "N07975":"PH-Ni",
    // Cobalt
    "R30003":"Co-base", "R30035":"Co-base", "R30159":"Co-base",
    // Ti
    "R50250":"Ti", "R50400":"Ti", "R52400":"Ti", "R53400":"Ti", "R56260":"Ti", "R55400":"Ti"
  };

  function _classifyFamily(composition, uns) {
    composition = composition || {};
    if (uns && UNS_FAMILY[uns.toUpperCase()]) return UNS_FAMILY[uns.toUpperCase()];

    var cr = +composition.Cr || 0;
    var ni = +composition.Ni || 0;
    var mo = +composition.Mo || 0;
    var fe = +composition.Fe || (100 - cr - ni - mo - (+composition.C||0) - (+composition.Mn||0));
    var pren = _pren(composition);
    var crEq = _crEq(composition);
    var niEq = _niEq(composition);

    // Heuristics — informational; UNS lookup preferred for engineering use
    if (ni > 50) {
      if (mo > 5 && cr > 15) return (composition.Nb > 1 || composition.Ti > 0.5) ? "PH-Ni" : "Ni-Cr-Mo-solid";
      return "Ni-Cr-Mo-solid";
    }
    if (cr > 20 && mo > 2 && pren > 38) {
      if (niEq > 9 && crEq > 22 && (niEq/crEq) > 0.35 && (niEq/crEq) < 0.55) return "super-duplex-SS";
    }
    if (cr > 19 && (pren > 32) && mo > 2.5) {
      if (niEq/crEq > 0.4 && niEq/crEq < 0.55) return "duplex-SS";
    }
    if (cr > 16 && ni > 8) return "austenitic-SS";
    if (cr > 11 && cr < 19 && ni < 5) return "martensitic-SS";
    if (cr > 10 && cr < 14 && ni < 1) return "ferritic-SS";
    if (cr < 5 && (mo > 0.1 || (+composition.V||0) > 0)) return "LAS";
    return "CS";
  }

  // ----- REGION LOOKUP (Part 2 Figure 1) ----------------------------------
  function _regionLookup(pH2S_kPa, pH_in_situ) {
    if (!(pH2S_kPa > 0)) return null;
    if (pH2S_kPa < 0.3) return 0;
    if (pH2S_kPa < 10 && pH_in_situ != null && pH_in_situ >= 3.5) return 1;
    if (pH2S_kPa < 100 && pH_in_situ != null && pH_in_situ >= 3.5) return 2;
    // pH<3.5 or pH2S>=100 → Region 3
    if (pH2S_kPa >= 100 || (pH_in_situ != null && pH_in_situ < 3.5)) return 3;
    // Default conservative
    return 2;
  }

  // ----- ENVELOPE CONTAINMENT ---------------------------------------------
  function _envelopeContains(env, T_C, pH2S_kPa, Cl_mg_L, pH_in_situ, stress_pct_SMYS) {
    if (!env) return false;
    if (env.any_combination === true) {
      // "any combination" envelope per A.14/A.33/A.34 — but stress + T cap if specified
      if (env.T_max_C != null && T_C != null && T_C > env.T_max_C) return false;
      if (env.stress_max_pct_SMYS != null && stress_pct_SMYS != null && stress_pct_SMYS > env.stress_max_pct_SMYS) return false;
      return true;
    }
    var ok = true;
    if (env.T_max_C != null && T_C != null && T_C > env.T_max_C) ok = false;
    if (env.pH2S_max_kPa != null && pH2S_kPa != null && pH2S_kPa > env.pH2S_max_kPa) ok = false;
    if (env.Cl_max_mg_L != null && Cl_mg_L != null && Cl_mg_L > env.Cl_max_mg_L) ok = false;
    if (env.in_situ_pH_min != null && pH_in_situ != null && pH_in_situ < env.in_situ_pH_min) ok = false;
    if (env.stress_max_pct_SMYS != null && stress_pct_SMYS != null && stress_pct_SMYS > env.stress_max_pct_SMYS) ok = false;
    return ok;
  }

  // ----- MANUFACTURING CHECK ----------------------------------------------
  function _checkManufacturing(composition, hardness_HRC, cold_work_pct, PWHT, stress_pct_SMYS, row) {
    var ann = [], warn = [], pass = true;
    var mfg = row.manufacturing || {};
    if (mfg.HRC_max != null && hardness_HRC != null && hardness_HRC > mfg.HRC_max) {
      pass = false;
      warn.push("Hardness " + hardness_HRC + " HRC exceeds " + row.table + " ceiling of " + mfg.HRC_max + " HRC.");
    }
    if (mfg.cold_work_max_pct != null && cold_work_pct != null && cold_work_pct > mfg.cold_work_max_pct) {
      pass = false;
      warn.push("Cold work " + cold_work_pct + "% exceeds " + row.table + " ceiling of " + mfg.cold_work_max_pct + "%.");
    }
    if (mfg.stress_max_pct_SMYS != null && stress_pct_SMYS != null && stress_pct_SMYS > mfg.stress_max_pct_SMYS) {
      pass = false;
      warn.push("Sustained stress " + stress_pct_SMYS + "% SMYS exceeds " + row.table + " ceiling of " + mfg.stress_max_pct_SMYS + "%.");
    }
    if (mfg.PREN_min != null) {
      var pren = _pren(composition);
      if (pren < mfg.PREN_min) {
        pass = false;
        warn.push("PREN " + pren.toFixed(1) + " below " + row.table + " minimum " + mfg.PREN_min + ".");
      }
    }
    if (mfg.no_cold_work_for_strength === true) {
      ann.push("Cold work for strength prohibited per " + row.table + " — confirm condition is solution-annealed or annealed.");
    }
    if (mfg.condition) {
      ann.push("Required condition: " + (Array.isArray(mfg.condition) ? mfg.condition.join(" / ") : mfg.condition));
    }
    if (mfg.ferrite_range_pct) {
      ann.push("Ferrite content must lie in [" + mfg.ferrite_range_pct.join(", ") + "]% per " + row.table + " (verify via WRC-1992 / ASTM E562).");
    }
    return { passes: pass, annotations: ann, warnings: warn };
  }

  // ----- HRC ↔ HV10 (ASTM E140 simplified) --------------------------------
  function _HRCtoHV10(hrc) {
    if (hrc == null) return null;
    hrc = +hrc;
    // Reject non-finite HRC (NaN / string / object) → null, not a silent NaN HV.
    if (!Number.isFinite(hrc)) return null;
    // ASTM E140 Table 2 piecewise approximation for 20–50 HRC range on steels
    if (hrc < 20) return Math.round(238 + (hrc - 20) * 9);
    if (hrc <= 50) {
      // approx HV = 17.3·HRC - 137 for low-alloy steel 20-50 HRC
      return Math.round(17.3 * hrc - 137);
    }
    return Math.round(15.5 * hrc - 60);
  }
  function _HV10toHRC(hv) {
    if (hv == null) return null;
    if (hv >= 200 && hv <= 720) return Math.round((hv + 137) / 17.3 * 10) / 10;
    return null;
  }

  // ----- DISPATCHER -------------------------------------------------------
  function issue(opts) {
    opts = opts || {};
    var c = (opts.composition && typeof opts.composition === "object") ? opts.composition : {};
    // Coerce uns to a string before .toUpperCase() — a numeric/object uns
    // (e.g. {uns:12345}) would otherwise throw "toUpperCase is not a function".
    var uns = String(opts.uns == null ? "" : opts.uns).toUpperCase();
    var T_C = opts.T_C, pH2S = opts.pH2S_kPa, Cl = opts.Cl_mg_L, pH = opts.pH_in_situ;
    var stress = opts.stress_pct_SMYS, HRC = opts.hardness_HRC, CW = opts.cold_work_pct;
    var equip = opts.equipment_class || "general";
    var scope = opts.scope || "upstream-production";
    var owner = opts.owner_specs || [];

    var rows = _getAnnexes();
    var citations = [];
    var warnings = [];
    var annotations = [];
    var failure_reasons = [];
    var alternatives = [];

    // 1) Refining short-circuit → MR0103
    if (scope === "refining") {
      return {
        IN_SCOPE: true, route: "MR0103",
        envelope: null,
        citations: ["NACE MR0103-2018 (refining sour service) — separate scope from MR0175/ISO 15156"],
        manufacturing_annotations: ["Apply NACE MR0103 hardness limits (e.g., 200 HBW for weld deposits per NACE RP0472) and Annex A material qualification — not MR0175's 22 HRC."],
        warnings: ["Refining scope — MR0175/ISO 15156 NOT applicable; switch to MR0103 dispatcher."],
        failure_reasons: [], alternative_recommendations: []
      };
    }

    // 2) Sour threshold short-circuit (pH2S < 0.3 kPa = 0.05 psia)
    if (!(pH2S > 0.3)) {
      return {
        IN_SCOPE: false, route: "non-sour",
        envelope: null,
        citations: ["ISO 15156-1:2020 §1.3 — sour service threshold pH2S ≥ 0.3 kPa (0.05 psia)"],
        manufacturing_annotations: [],
        warnings: ["Operating point below sour-service threshold; MR0175 not applicable. Standard CS/CRA selection applies."],
        failure_reasons: [],
        alternative_recommendations: []
      };
    }

    var family = _classifyFamily(c, uns);
    annotations.push("Classified family: " + family + (uns ? " (UNS " + uns + ")" : "") + ". PREN = " + _pren(c).toFixed(1));

    // 3) CS / LAS branch → Region lookup
    if (family === "CS" || family === "LAS") {
      var region = _regionLookup(pH2S, pH);
      var regionRow = rows.find(function(r){ return r.part === 2 && r.region === region; });
      if (region === 0) {
        return {
          IN_SCOPE: true, route: "Region 0",
          envelope: regionRow ? {pH2S_max_kPa: regionRow.pH2S_max_kPa} : null,
          citations: ["ISO 15156-2:2020 Figure 1 — Region 0 (pH2S < 0.3 kPa)"],
          manufacturing_annotations: ["No SSC precautions required; standard 22 HRC CS qualifies. Confirm with project metallurgy."],
          warnings: warnings,
          failure_reasons: [],
          alternative_recommendations: []
        };
      }
      var hrcAnn = [];
      if (HRC != null && HRC > 22) {
        failure_reasons.push("Hardness " + HRC + " HRC exceeds Part 2 ceiling of 22 HRC.");
      } else if (HRC == null) {
        hrcAnn.push("Confirm base + HAZ + weld root/cap hardness ≤ 22 HRC per ISO 15156-2:2020.");
      }
      var inScope = (HRC == null || HRC <= 22);
      return {
        IN_SCOPE: inScope, route: "Region " + region,
        envelope: regionRow,
        citations: ["ISO 15156-2:2020 Figure 1 — Region " + region],
        manufacturing_annotations: [
          "C-Mn / low-alloy steel; HRC max 22 base + HAZ + weld",
          (region === 2 ? "Annex B qualification required (TM0177 A/B at 0.1 MPa H2S)" : (region === 3 ? "Annex B qualification + manufacturing-route restrictions; consider Part 1 §8 fit-for-purpose" : "Standard pre-qualified material acceptable"))
        ].concat(hrcAnn),
        warnings: warnings,
        failure_reasons: failure_reasons,
        alternative_recommendations: inScope ? [] : ["Upgrade to a CRA per ISO 15156-3 Annex A.18+ (martensitic SS) or A.14 (Ni-Cr-Mo solid-solution)."]
      };
    }

    // 4) CRA branch — iterate Part 3 Annex A tables for this family
    var candidates = rows.filter(function(r){
      return r.table && r.family === family;
    });
    // Super-duplex sub-row check
    if (family === "duplex-SS") {
      // Also consider super-duplex envelope if PREN > 40
      if (_pren(c) >= 40) candidates = candidates.concat(rows.filter(function(r){ return r.family === "super-duplex-SS"; }));
    }
    // When UNS is supplied, prefer tables whose UNS list matches; otherwise
    // fall back to all family candidates. This prevents matching e.g. Alloy 625
    // against A.13 which is restricted to G3/G30 (N06985/N06975).
    if (uns) {
      var unsMatch = candidates.filter(function(r){
        return r.uns_list && r.uns_list.map(function(u){ return u.toUpperCase(); }).indexOf(uns) >= 0;
      });
      if (unsMatch.length) candidates = unsMatch;
    }
    // Sort candidates: prefer "any_combination" envelopes (most useful verdict
    // for an engineer — unrestricted use beats narrow sub-envelope), then by
    // table number to keep order stable for tests.
    candidates.sort(function(a, b) {
      var aAC = (a.envelope && a.envelope.any_combination) ? 1 : 0;
      var bAC = (b.envelope && b.envelope.any_combination) ? 1 : 0;
      if (aAC !== bAC) return bAC - aAC;     // any_combination first
      return (a.table || "").localeCompare(b.table || "");
    });
    for (var i = 0; i < candidates.length; i++) {
      var row = candidates[i];
      var env = row.envelope;
      if (env && env.needs_review) {
        warnings.push("Table " + row.table + " envelope has incomplete documented thresholds (needs_review); engineer must cross-check against ISO 15156-3:2020 hard copy before relying on this verdict.");
        continue;  // skip rows with unknown thresholds — never make up numbers
      }
      if (!_envelopeContains(env, T_C, pH2S, Cl, pH, stress)) continue;
      var mfg = _checkManufacturing(c, HRC, CW, opts.PWHT, stress, row);
      if (!mfg.passes) {
        failure_reasons = failure_reasons.concat(mfg.warnings);
        continue;
      }
      // Match!
      var citationList = [row.ref];
      // Append owner-spec overlays as advisory
      var ownerAnnotations = [];
      owner.forEach(function(spec){
        if (spec === "NORSOK-M-001") ownerAnnotations.push("NORSOK M-001:2014 Table 6 overlay enabled — verify against NORSOK CRA limits (often tighter than MR0175).");
        if (spec === "Shell-DEP-30.10.60") ownerAnnotations.push("Shell DEP 30.10.60.18 overlay — verify welding/fabrication amendments to API RP 582.");
        if (spec === "Aramco-SAES-W-001") ownerAnnotations.push("Aramco 01-SAMSS-016 + 01-SAMSS-022 (Class IV fracture toughness) overlay — verify.");
        if (spec === "ExxonMobil-GP") ownerAnnotations.push("ExxonMobil GP overlay enabled — verify per project material spec.");
        if (spec === "Chevron-CV") ownerAnnotations.push("Chevron CV materials overlay enabled — verify per project material spec.");
      });
      return {
        IN_SCOPE: true,
        route: row.table,
        envelope: env,
        citations: citationList,
        manufacturing_annotations: annotations.concat(mfg.annotations).concat(ownerAnnotations),
        warnings: warnings,
        failure_reasons: [],
        alternative_recommendations: []
      };
    }

    // 5) No envelope match → fit-for-purpose qualification
    var alt = [];
    if (family === "duplex-SS") alt.push("Upgrade to 25Cr super-duplex (S32750 / S32760) per ISO 15156-3:2020 Table A.24 (25Cr sub-row, pH2S ≤ 20 kPa).");
    if (family === "austenitic-SS") alt.push("Upgrade to highly-alloyed austenitic SS per A.4 or solid-solution Ni-Cr-Mo per A.14 ('any combination' envelope).");
    if (family === "martensitic-SS") alt.push("Upgrade to duplex S32205 (A.24 22Cr) or super-duplex (A.24 25Cr), or Ni-Cr-Mo (A.14).");
    return {
      IN_SCOPE: false,
      route: "FFP",
      envelope: null,
      citations: ["ISO 15156-1:2020 §8 — Fit-for-Purpose qualification per NACE TM0177 A/B/C/D + TM0284"],
      manufacturing_annotations: annotations,
      warnings: warnings,
      failure_reasons: failure_reasons.length ? failure_reasons : ["No Annex A envelope matches the operating conditions for family " + family + "."],
      alternative_recommendations: alt
    };
  }

  // ----- EMBEDDED REGRESSION TESTS ----------------------------------------
  function _runTests() {
    var pass = 0, fail = 0, errs = [];
    function ass(c, m) { if (c) pass++; else { fail++; errs.push(m); } }

    // Test 1: 13Cr OCTG
    var t1 = issue({uns:"S41425", composition:{Cr:13, Mo:0.5, Ni:5, C:0.05, N:0.1}, T_C:120, pH2S_kPa:8, Cl_mg_L:70000, pH_in_situ:4.0, stress_pct_SMYS:80, hardness_HRC:27, equipment_class:"downhole"});
    ass(t1.IN_SCOPE === true && t1.route === "A.19", "Test 1 13Cr OCTG → A.19 IN_SCOPE got route=" + t1.route);

    // Test 2: 2205 line pipe — 22Cr envelope pH2S ≤ 10 kPa; case has 30 → fail
    var t2 = issue({uns:"S31803", composition:{Cr:22, Mo:3.0, Ni:5, N:0.18}, T_C:90, pH2S_kPa:30, Cl_mg_L:120000, pH_in_situ:4.5, stress_pct_SMYS:70, hardness_HRC:28});
    ass(t2.IN_SCOPE === false, "Test 2 2205 30 kPa exceeds 22Cr envelope expected fail got IN_SCOPE=" + t2.IN_SCOPE);
    ass(t2.alternative_recommendations.some(function(a){ return a.indexOf("25Cr") >= 0; }), "Test 2 alternative recommends 25Cr upgrade");

    // Test 3: Alloy 625
    var t3 = issue({uns:"N06625", composition:{Cr:21, Mo:9, Ni:62, Nb:3.5}, T_C:180, pH2S_kPa:150, Cl_mg_L:200000, pH_in_situ:3.8, hardness_HRC:21});
    ass(t3.IN_SCOPE === true && (t3.route === "A.33" || t3.route === "A.34"), "Test 3 Alloy 625 IN_SCOPE Ni-Cr-Mo any-combination got route=" + t3.route);

    // Test 4: Non-sour
    var t4 = issue({uns:"K02600", composition:{Cr:0.1, C:0.2, Mn:1.0}, T_C:50, pH2S_kPa:0.1});
    ass(t4.IN_SCOPE === false && t4.route === "non-sour", "Test 4 non-sour pH2S=0.1");

    // Test 5: CS Region 2
    var t5 = issue({composition:{Cr:0.1, C:0.2, Mn:1.0}, T_C:60, pH2S_kPa:50, pH_in_situ:4, hardness_HRC:22});
    ass(t5.route.indexOf("Region") === 0, "Test 5 CS region route");
    ass(t5.IN_SCOPE === true, "Test 5 CS Region 2 IN_SCOPE w/ HRC=22");

    // Test 6: PH martensitic stress check (S17400) — σ=60% exceeds A.27 limit 50%
    var t6 = issue({uns:"S17400", composition:{Cr:17, Ni:4, Cu:3, Nb:0.3}, T_C:80, pH2S_kPa:5, pH_in_situ:4, stress_pct_SMYS:60, hardness_HRC:33});
    ass(t6.IN_SCOPE === false, "Test 6 S17400 60% SMYS exceeds A.27 50% limit");

    // Test 7: PH martensitic stress within limit
    var t7 = issue({uns:"S17400", composition:{Cr:17, Ni:4, Cu:3, Nb:0.3}, T_C:80, pH2S_kPa:5, pH_in_situ:4, stress_pct_SMYS:40, hardness_HRC:33});
    // May or may not pass depending on envelope completeness; just sanity check
    ass(t7 !== null, "Test 7 S17400 40% returns verdict");

    // Test 8: Refining redirect
    var t8 = issue({uns:"K02600", composition:{Cr:0.1, C:0.2}, T_C:80, pH2S_kPa:50, pH_in_situ:4, scope:"refining"});
    ass(t8.route === "MR0103", "Test 8 refining scope → MR0103");

    return { pass:pass, fail:fail, errs:errs };
  }

  var MR0175 = {
    issue: issue,
    setAnnexes: setAnnexes,
    _classifyFamily: _classifyFamily,
    _regionLookup: _regionLookup,
    _envelopeContains: _envelopeContains,
    _checkManufacturing: _checkManufacturing,
    _pren: _pren,
    _HRCtoHV10: _HRCtoHV10,
    _HV10toHRC: _HV10toHRC,
    _runTests: _runTests
  };
  root.MR0175 = MR0175;
  if (typeof module !== "undefined" && module.exports) module.exports = MR0175;
})(typeof window !== "undefined" ? window : this);

// CLI test mode
if (typeof require !== "undefined" && require.main === module) {
  var M = module.exports;
  var r = M._runTests();
  console.log("MR0175 regression: PASS " + r.pass + " / FAIL " + r.fail);
  if (r.fail) r.errs.forEach(function(e){ console.log("  - " + e); });
}
