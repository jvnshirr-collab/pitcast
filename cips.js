/* cips.js — CIPS / DCVG / PCM survey-data ingestion + ECDA prioritisation.
 *
 * Sources:
 *   - NACE SP0207-2007 (R2018) — Performing Close-Interval Potential Surveys
 *   - NACE/AMPP SP0169-2013 (R2020) §6.2.2 — three CP protection criteria
 *   - NACE TM0497-2018 — instant-off technique + interrupter timing
 *   - NACE TM0109-2009 — Aboveground Survey Techniques (DCVG, ACVG, Pearson)
 *   - NACE SP0502-2010 — Pipeline External Corrosion Direct Assessment (ECDA)
 *   - ISO 15589-1:2015 — CP of pipeline systems (on-land); IR-free potentials
 *   - DNV-RP-F116 (2021) — Integrity mgmt of submarine pipeline systems §6/§7
 *   - McKinney (1986) — DCVG severity-band originator
 *   - 49 CFR 192.939 — gas transmission reassessment ceiling (≤7 yr)
 */
(function (root) {
  "use strict";

  // ---- CSV parser with fuzzy header matching --------------------------
  // Accept M.C. Miller G-Series, Radiodetection PCM, generic CSV.
  // Auto-detect units (ft vs m, V vs mV).
  function _normHeader(h) {
    return String(h).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }
  var COL_PATTERNS = {
    station_m: /^(station|chainage|km|m|position|log_?distance|abs_?distance)/,
    lat:       /^(lat|latitude)/,
    lon:       /^(lon|long|longitude)/,
    E_on_mV:   /^(e_?on|v_?on|on_?potential|on)/,
    E_off_mV:  /^(e_?off|v_?off|inst|polariz|off)/,
    dcvg_mV:   /^(dcvg|grad|delta_?v|gradient)/,
    dcvg_polarity: /^(dcvg_?polarity|polarity)/,
    ac_V:      /^(ac_?volt|v_?ac|vac)/,
    timestamp: /^(time|timestamp|gps_?time)/,
    flag:      /^(flag|comment|note)/
  };

  function parseCSV(text) {
    if (!text || !text.trim()) return { type: "EMPTY", readings: [], errors: ["Empty input"] };
    text = text.replace(/^﻿/, "");  // strip BOM
    var lines = text.split(/\r?\n/).map(function(l){ return l.trim(); })
                    .filter(function(l){ return l && !l.startsWith("#"); });
    if (lines.length < 2) return { type: "EMPTY", readings: [], errors: ["Need header + ≥1 data row"] };

    function tokenise(line) {
      var out = [], cur = "", inQ = false;
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch === '"') { inQ = !inQ; continue; }
        if (ch === "," && !inQ) { out.push(cur.trim()); cur = ""; continue; }
        cur += ch;
      }
      out.push(cur.trim());
      return out;
    }

    var rawHeaders = tokenise(lines[0]).map(_normHeader);
    var colIdx = {};
    Object.keys(COL_PATTERNS).forEach(function(k){
      for (var i = 0; i < rawHeaders.length; i++) {
        if (COL_PATTERNS[k].test(rawHeaders[i])) { colIdx[k] = i; break; }
      }
    });

    var errors = [];
    if (colIdx.station_m == null) errors.push("Missing station/chainage column");
    if (colIdx.E_on_mV == null && colIdx.E_off_mV == null && colIdx.dcvg_mV == null) {
      errors.push("Need at least one of: E_on, E_off, DCVG");
    }

    var readings = [];
    for (var r = 1; r < lines.length; r++) {
      var row = tokenise(lines[r]);
      var get = function(k) { return colIdx[k] != null ? row[colIdx[k]] : null; };
      var stationRaw = +get("station_m");
      if (!isFinite(stationRaw)) continue;
      var entry = {
        station_m: stationRaw,
        lat: +get("lat") || null,
        lon: +get("lon") || null,
        E_on_mV: get("E_on_mV") != null ? +get("E_on_mV") : null,
        E_off_mV: get("E_off_mV") != null ? +get("E_off_mV") : null,
        dcvg_mV: get("dcvg_mV") != null ? +get("dcvg_mV") : null,
        dcvg_polarity: get("dcvg_polarity") || null,
        ac_V: get("ac_V") != null ? +get("ac_V") : null,
        timestamp: get("timestamp") || null,
        flag: get("flag") || null
      };
      readings.push(entry);
    }

    if (!readings.length) return { type: "EMPTY", readings: [], errors: errors.concat(["No numeric data rows parsed"]) };

    // Auto-detect units
    var stations = readings.map(function(x){ return x.station_m; });
    var maxStation = Math.max.apply(Math, stations);
    if (maxStation > 1e5) {
      // assume ft, convert to m
      readings.forEach(function(x){ x.station_m = x.station_m * 0.3048; });
      errors.push("Auto-converted station from ft → m (max value > 1e5 suggested ft)");
    }

    // Potential units (V vs mV) — if magnitudes all < 5 assume volts
    var pots = readings.map(function(x){ return x.E_on_mV; }).filter(function(v){ return v != null && isFinite(v); });
    if (pots.length && Math.max.apply(Math, pots.map(Math.abs)) < 10) {
      readings.forEach(function(x){
        if (x.E_on_mV != null) x.E_on_mV = x.E_on_mV * 1000;
        if (x.E_off_mV != null) x.E_off_mV = x.E_off_mV * 1000;
      });
      errors.push("Auto-converted potentials from V → mV (max |E| < 10 suggested V units)");
    }

    var type = "CIPS";
    if (readings.some(function(r){ return r.dcvg_mV != null; })) type = readings.some(function(r){ return r.E_on_mV != null; }) ? "COMBINED" : "DCVG";

    return {
      type: type,
      readings: readings,
      errors: errors,
      ref: "Parsed per NACE SP0207-2007 §8.2 + TM0109-2009 §6 columns; auto-detected units."
    };
  }

  // ---- IR-drop correction (no interrupter case) -----------------------
  function IRCorrect(E_on_mV, I_protective_A, R_soil_ohm) {
    if (E_on_mV == null || I_protective_A == null || R_soil_ohm == null) return E_on_mV;
    var IR_mV = I_protective_A * R_soil_ohm * 1000;
    return E_on_mV + IR_mV;  // less-negative correction for cathodic protection
  }

  // ---- CIPS exceedance scan -------------------------------------------
  // Three NACE SP0169 §6.2.2 criteria:
  //   (a) -850 mV polarized (E_off) — fails if E_off > -850
  //   (b) 100 mV polarisation shift — fails if (E_native − E_off) < 100
  //   (c) Limiting critical potential — fails if E_off < E_l (over-protection)
  function scanExceedances(survey, criteria) {
    criteria = criteria || {};
    var THR_OFF = criteria.E_off_threshold_mV != null ? criteria.E_off_threshold_mV : -850;
    var E_l = criteria.E_l_mV != null ? criteria.E_l_mV : -1200;
    var native = criteria.native_potential_mV != null ? criteria.native_potential_mV : -650;

    var perStation = survey.readings.map(function(r){
      var f = { station_m: r.station_m, verdicts: [], flags: [] };
      if (r.E_off_mV != null) {
        if (r.E_off_mV > THR_OFF) {  // less negative = fails
          f.flags.push("FAILS_850_INSTANT_OFF");
          f.verdicts.push({ test: "-850 mV instant-off", pass: false, margin_mV: r.E_off_mV - THR_OFF });
        } else {
          f.verdicts.push({ test: "-850 mV instant-off", pass: true, margin_mV: THR_OFF - r.E_off_mV });
        }
        // 100 mV shift
        var shift = native - r.E_off_mV;
        if (shift >= 100) {
          f.verdicts.push({ test: "100 mV shift", pass: true, shift_mV: shift });
        } else {
          f.flags.push("FAILS_100MV_SHIFT");
          f.verdicts.push({ test: "100 mV shift", pass: false, shift_mV: shift });
        }
        // Over-protection
        if (r.E_off_mV < E_l) {
          f.flags.push("OVER_PROTECTION");
          f.verdicts.push({ test: "Limiting critical E_l", pass: false, margin_mV: E_l - r.E_off_mV });
        }
      }
      return f;
    });

    // Group consecutive failing stations into runs
    var runs = [];
    var curRun = null;
    perStation.forEach(function(f){
      var failing = f.flags.length > 0;
      if (failing) {
        if (!curRun) {
          curRun = {
            start_m: f.station_m, end_m: f.station_m,
            min_E_off_mV: survey.readings.find(function(r){ return r.station_m === f.station_m; }).E_off_mV,
            max_violation_mV: 0,
            flags: f.flags.slice()
          };
        } else {
          curRun.end_m = f.station_m;
          var eOff = survey.readings.find(function(r){ return r.station_m === f.station_m; }).E_off_mV;
          if (eOff != null && eOff > curRun.min_E_off_mV) curRun.min_E_off_mV = eOff;
          f.flags.forEach(function(fl){ if (curRun.flags.indexOf(fl) < 0) curRun.flags.push(fl); });
        }
      } else {
        if (curRun) { runs.push(curRun); curRun = null; }
      }
    });
    if (curRun) runs.push(curRun);

    return {
      perStation: perStation,
      runs: runs,
      criteria: { THR_OFF: THR_OFF, E_l: E_l, native: native },
      ref: "NACE SP0169 §6.2.2 (-850 mV, 100 mV shift, limiting critical E_l); ISO 15589-1:2015 §6.2 Table 1."
    };
  }

  // ---- DCVG severity bands (McKinney 1986) ----------------------------
  function classifySeverity(percent_IR) {
    if (percent_IR < 16)   return { band: "Minor",     action: "No repair; routine monitoring",
                                    color: "#34d399",  ref: "McKinney 1986 + NACE SP0502 §5.7 (0–15 %IR)" };
    if (percent_IR < 36)   return { band: "Moderate",  action: "Schedule general maintenance",
                                    color: "#fbbf24",  ref: "NACE SP0502 §5.7 (16–35 %IR)" };
    if (percent_IR < 71)   return { band: "Severe",    action: "Investigate during next dig campaign",
                                    color: "#fb923c",  ref: "NACE SP0502 §5.7 (36–70 %IR)" };
    return                       { band: "Immediate", action: "Excavate per NACE SP0502 §5.7.3",
                                    color: "#ef4444",  ref: "McKinney 1986 + NACE SP0502 §5.7.3 (71–100 %IR)" };
  }

  // ---- Polarity classification (TM0109 / cathodic-academy refs) ------
  function classifyPolarity(E_on_mV, E_off_mV) {
    if (E_on_mV == null || E_off_mV == null) return { state: "?", interpretation: "Missing data", ref: "NACE TM0109 §6" };
    // Convention: more negative = cathodic, less negative = anodic
    var on_state = E_on_mV < E_off_mV ? "C" : "A";   // ON more negative than OFF → cathodic during ON
    var off_state = E_off_mV < -700 ? "C" : "A";      // OFF below -700 → still cathodic when polarised
    var state = on_state + "/" + off_state;
    var interp;
    if (state === "A/C") interp = "Typical active coating defect under CP — current flowing in";
    else if (state === "C/C") interp = "Stray-current pick-up; flag as INTERFERENCE (not pipe's own defect)";
    else if (state === "A/A") interp = "Possible current short to foreign structure OR active anodic site under stray DC; direct exam required";
    else if (state === "C/A") interp = "Current discharge during OFF cycle — classic foreign-line INTERFERENCE";
    else interp = "Inconclusive polarity pattern";
    return { state: state, interpretation: interp, ref: "NACE TM0109-2009 §6 polarity interpretation matrix" };
  }

  // ---- DCVG indication finder ----------------------------------------
  function findIndications(survey, gradient_threshold_mV) {
    var THR = gradient_threshold_mV != null ? gradient_threshold_mV : 5;
    var inds = [];
    var dcvgPoints = survey.readings.filter(function(r){ return r.dcvg_mV != null; });
    if (!dcvgPoints.length) return [];

    // Find local maxima above threshold
    for (var i = 1; i < dcvgPoints.length - 1; i++) {
      var prev = dcvgPoints[i-1].dcvg_mV;
      var cur = dcvgPoints[i].dcvg_mV;
      var nxt = dcvgPoints[i+1].dcvg_mV;
      if (Math.abs(cur) >= THR && Math.abs(cur) > Math.abs(prev) && Math.abs(cur) >= Math.abs(nxt)) {
        var matching = survey.readings.find(function(r){ return r.station_m === dcvgPoints[i].station_m; });
        var swing = (matching && matching.E_on_mV != null && matching.E_off_mV != null)
                    ? Math.abs(matching.E_on_mV - matching.E_off_mV) : null;
        // %IR is a fraction of the total IR drop, so it is bounded at 100% by definition; a DCVG
        // signal exceeding the on/off swing means an inconsistent/noisy reading — clamp (still Immediate).
        var pctIR = swing != null && swing > 0 ? Math.min(100, (Math.abs(cur) / swing) * 100) : null;
        var sev = pctIR != null ? classifySeverity(pctIR) : { band: "?", action: "Cannot classify without V_swing" };
        var pol = matching ? classifyPolarity(matching.E_on_mV, matching.E_off_mV) : { state: "?", interpretation: "n/a" };
        inds.push({
          id: "I-" + inds.length,
          station_m: dcvgPoints[i].station_m,
          dcvg_mV: cur,
          V_swing_mV: swing,
          percent_IR: pctIR,
          severity: sev.band,
          action: sev.action,
          color: sev.color,
          polarity: pol.state,
          polarity_interp: pol.interpretation,
          ref: sev.ref + " + " + pol.ref
        });
      }
    }
    return inds;
  }

  // ---- ECDA prioritization (SP0502 §6) -------------------------------
  function prioritizeECDA(opts) {
    var cipsRuns = (opts.cips_results && opts.cips_results.runs) || [];
    var dcvgInds = opts.dcvg_results || [];
    var history = opts.history || [];        // [{station_m, type: 'prior_dig'|'leak'|'repair'}]
    var soil = opts.soil_corrosivity || "moderate";  // 'low'|'moderate'|'high'

    // Bucket each location
    var buckets = [];
    // CIPS runs become bucket entries
    cipsRuns.forEach(function(r){
      var driving = ["CIPS_fail (" + r.flags.join(",") + ")"];
      var nearbyDCVG = dcvgInds.filter(function(d){
        return d.station_m >= r.start_m - 50 && d.station_m <= r.end_m + 50 &&
               (d.severity === "Severe" || d.severity === "Immediate");
      });
      nearbyDCVG.forEach(function(d){ driving.push("DCVG_" + d.severity + "_" + d.percent_IR.toFixed(0) + "%"); });
      var nearbyHistory = history.filter(function(h){
        return h.station_m >= r.start_m - 100 && h.station_m <= r.end_m + 100;
      });
      nearbyHistory.forEach(function(h){ driving.push("prior_" + h.type); });

      var verdict;
      if (driving.length >= 3) verdict = "IMMEDIATE";
      else if (driving.length === 2) verdict = "IMMEDIATE";  // SP0502 §5.2.2.1.2
      else if (nearbyHistory.length > 0) verdict = "SCHEDULED";
      else verdict = "MONITORED";

      buckets.push({
        location: r.start_m.toFixed(1) + "–" + r.end_m.toFixed(1) + " m",
        driving_indications: driving,
        verdict: verdict,
        ref: "NACE SP0502-2010 §6 Table 2 + §5.2.2.1.2"
      });
    });
    // DCVG-only indications (no CIPS overlap)
    dcvgInds.forEach(function(d){
      var inCIPS = cipsRuns.some(function(r){ return d.station_m >= r.start_m - 50 && d.station_m <= r.end_m + 50; });
      if (inCIPS) return;
      var verdict;
      if (d.severity === "Immediate") verdict = "IMMEDIATE";
      else if (d.severity === "Severe") verdict = "SCHEDULED";
      else verdict = "MONITORED";
      buckets.push({
        location: d.station_m.toFixed(1) + " m",
        driving_indications: ["DCVG_" + d.severity + "_" + (d.percent_IR ? d.percent_IR.toFixed(0) + "%" : "?")],
        verdict: verdict,
        ref: "NACE SP0502-2010 §6 Table 2 + McKinney 1986"
      });
    });

    return {
      buckets: buckets,
      summary: {
        IMMEDIATE: buckets.filter(function(b){ return b.verdict === "IMMEDIATE"; }).length,
        SCHEDULED: buckets.filter(function(b){ return b.verdict === "SCHEDULED"; }).length,
        MONITORED: buckets.filter(function(b){ return b.verdict === "MONITORED"; }).length
      },
      soil_corrosivity: soil,
      ref: "NACE SP0502-2010 §6 prioritization matrix + §5.2.2.1.2"
    };
  }

  // ---- Reassessment interval (SP0502 §7) ------------------------------
  function reassessmentInterval(opts) {
    opts = opts || {};
    var remaining = +opts.remaining_life_yr;
    var regMax = opts.regulatory_max_yr != null ? +opts.regulatory_max_yr : 7;
    if (!(remaining > 0)) return { years: regMax, ref: "Default to 49 CFR 192.939 ceiling (7 yr)" };
    var half = remaining / 2;
    return {
      years: Math.min(half, regMax),
      basis: "T_reassess = ½ × T_remaining_life capped at " + regMax + " yr",
      ref: "NACE SP0502-2010 §7 + 49 CFR 192.939 (US-DOT gas transmission)"
    };
  }

  // ---- Embedded regression tests --------------------------------------
  function _runTests() {
    var pass = 0, fail = 0, errs = [];
    function ass(c, m) { if (c) pass++; else { fail++; errs.push(m); } }

    // Test B-1: CIPS exceedance
    var sample = "station,E_on,E_off\n100,-1100,-900\n200,-1180,-820\n300,-1200,-950";
    var s = parseCSV(sample);
    ass(s.readings.length === 3, "parseCSV 3 rows");
    var exc = scanExceedances(s, { native_potential_mV: -650 });
    var midStation = exc.perStation.find(function(p){ return p.station_m === 200; });
    ass(midStation && midStation.flags.indexOf("FAILS_850_INSTANT_OFF") >= 0, "Station 200 fails -850");
    ass(midStation.verdicts.find(function(v){ return v.test === "100 mV shift"; }).pass === true, "Station 200 passes 100 mV shift");

    // Test B-2: DCVG severity classification
    ass(classifySeverity(10).band === "Minor", "10 %IR → Minor");
    ass(classifySeverity(20).band === "Moderate", "20 %IR → Moderate");
    ass(classifySeverity(50).band === "Severe", "50 %IR → Severe");
    ass(classifySeverity(85).band === "Immediate", "85 %IR → Immediate");

    // Test B-2 example: gradients 22/14/8/3/1, V_swing 450 → %IR=10.7% → Minor
    var sumGrad = 22 + 14 + 8 + 3 + 1;
    var pctIR = (sumGrad / 450) * 100;
    ass(Math.abs(pctIR - 10.67) < 0.1, "DCVG %IR calc 10.7% got " + pctIR.toFixed(2));
    ass(classifySeverity(pctIR).band === "Minor", "Example B-2 → Minor band");

    // Test reassessmentInterval
    var ra = reassessmentInterval({ remaining_life_yr: 20 });
    ass(ra.years === 7, "T_reassess = min(½·20, 7) = 7");
    var ra2 = reassessmentInterval({ remaining_life_yr: 10 });
    ass(ra2.years === 5, "T_reassess = min(5, 7) = 5");

    // Test polarity matrix
    var p1 = classifyPolarity(-1200, -950);  // ON more negative than OFF → C/C
    ass(p1.state === "C/C", "C/C polarity → " + p1.state);

    // Test ECDA priority — 2 severe in proximity
    var prio = prioritizeECDA({
      cips_results: { runs: [{ start_m: 100, end_m: 150, flags: ["FAILS_850_INSTANT_OFF"] }] },
      dcvg_results: [{ station_m: 120, severity: "Severe", percent_IR: 45 }],
      history: []
    });
    ass(prio.buckets[0].verdict === "IMMEDIATE", "CIPS fail + nearby DCVG Severe → IMMEDIATE");

    // CSV with V units → auto-convert
    var smallV = "station,E_on,E_off\n100,-1.2,-0.95";
    var sv = parseCSV(smallV);
    ass(sv.readings[0].E_on_mV === -1200, "V → mV auto-convert got " + sv.readings[0].E_on_mV);

    return { pass: pass, fail: fail, errs: errs };
  }

  var CIPS = {
    parseCSV: parseCSV, scanExceedances: scanExceedances,
    findIndications: findIndications, classifySeverity: classifySeverity,
    classifyPolarity: classifyPolarity, prioritizeECDA: prioritizeECDA,
    reassessmentInterval: reassessmentInterval, IRCorrect: IRCorrect,
    _runTests: _runTests
  };
  root.CIPS = CIPS;
  if (typeof module !== "undefined" && module.exports) module.exports = CIPS;
})(typeof window !== "undefined" ? window : this);

if (typeof require !== "undefined" && require.main === module) {
  var C = module.exports;
  var r = C._runTests();
  console.log("CIPS regression: PASS " + r.pass + " / FAIL " + r.fail);
  if (r.fail) r.errs.forEach(function(e){ console.log("  - " + e); });
}
