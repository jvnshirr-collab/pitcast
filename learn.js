/* learn.js — PitCast "Learn corrosion screening" track (P3 WS3.4).
 *
 * Guided, worked-example walkthroughs that teach HOW the screening works, using
 * the *same* engines the console uses — every number is computed live, nothing
 * is hard-coded. Four domains share one philosophy: show the equation, the
 * uncertainty/disagreement, the validity, and the citation. Integrated into the
 * console (Learn tab), linked from the Model Atlas. No marketing copy.
 *
 * A Javanshir Hasanov production.
 */
(function (root) {
  "use strict";

  function _g(name) {
    if (typeof window !== "undefined" && window[name]) return window[name];
    if (typeof require === "function") { try { return require("./" + name.toLowerCase() + ".js"); } catch (e) {} }
    return null;
  }
  function f(x, d) { if (x == null || !isFinite(x)) return "–"; var p = Math.pow(10, d == null ? 2 : d); return (Math.round(x * p) / p).toString(); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function card(accent, inner) {
    return '<div style="margin:12px 0;padding:14px 16px;border-left:3px solid ' + accent +
      ';background:rgba(255,255,255,.02);border-radius:0 8px 8px 0">' + inner + '</div>';
  }
  function step(n, title) { return '<div style="font-size:13px;color:#7dd3fc;font-weight:700;margin-bottom:6px">STEP ' + n + ' · ' + title + '</div>'; }
  function p(txt) { return '<div style="font-size:13px;color:var(--dim);line-height:1.65">' + txt + '</div>'; }
  function live(txt) { return '<div style="margin-top:8px;font-size:14px;color:var(--ink)">' + txt + '</div>'; }
  function gboxLite(eq, cite) {
    return '<details style="margin:8px 0 2px;border:1px solid var(--line,#243042);border-radius:6px;background:rgba(255,255,255,.02)">' +
      '<summary style="cursor:pointer;padding:6px 10px;font-size:11px;color:var(--dim);user-select:none">▸ equation &amp; citation</summary>' +
      '<div style="padding:0 10px 8px;font-size:11px;color:var(--dim);line-height:1.6">' +
      '<div style="font-family:var(--mono,monospace);color:var(--ink)">' + eq + '</div>' +
      '<div style="margin-top:4px">Cite: ' + cite + '</div></div></details>';
  }
  function opbox(txt) {
    return '<div style="font-size:12px;background:#0b1220;border:1px solid var(--line,#243042);border-radius:8px;padding:10px 12px;color:var(--ink);font-family:var(--mono,monospace)">' + txt + '</div>';
  }
  function intro(title, sub) {
    return '<h2 style="margin:0 0 4px">' + title + '</h2><div style="font-size:13px;color:var(--dim);line-height:1.6;margin-bottom:8px">' + sub + '</div>';
  }
  function scopeNote(txt) {
    return '<div style="margin-top:10px;font-size:11px;color:var(--dim)">' + txt + ' · screening-grade, glass-box, Apache-2.0.</div>';
  }

  // ════════════════════════════════════════════════════ CO₂ (sweet) ════════
  function lessonCO2() {
    var CO2 = _g("CO2");
    if (!CO2 || !CO2.assess) return p("CO₂ engine not loaded.");
    var IN = { T: 60, pCO2: 5, velocity: 2, pipeID: 0.2, bicarbonate: 500 };
    var r = CO2.assess(IN), uq = r.uq || {}, ens = uq.ensemble || {}, sp = ens.spread || {}, env = uq.envelope || { variables: [] };
    var BLURB = {
      "DWM-1975": "earliest correlation — pCO₂ + temperature only, no protective-scale credit, so usually the most conservative.",
      "DWM-1995": "adds in-situ pH, flow and a scale factor → drops below 1975 once FeCO₃ can form.",
      "NORSOK": "the regulator model — wall-shear-stress + a pH function; the de-facto design basis.",
      "NESC": "mechanistic baseline scaled by protective-film, oil-wetting and velocity factors.",
      "FreeCorp": "mechanistic (Ohio U.) — explicit surface-film, H₂S and mass-transfer terms."
    };
    var rows = (r.models || []).map(function (m) {
      var cr = (typeof m.cr === "number") ? m.cr : (m.cr && m.cr.CR_mmpy);
      return '<tr><td style="padding:5px 8px;border-bottom:1px solid rgba(255,255,255,.05)"><b style="color:var(--ink)">' + esc(m.name) + '</b></td>' +
        '<td style="padding:5px 8px;border-bottom:1px solid rgba(255,255,255,.05);text-align:right;font-family:var(--mono,monospace);color:#7dd3fc">' + f(cr, 2) + '</td>' +
        '<td style="padding:5px 8px;border-bottom:1px solid rgba(255,255,255,.05);font-size:11px;color:var(--dim)">' + (BLURB[m.id] || "") + '</td></tr>';
    }).join("");
    var vWord = sp.verdict === "diverge" ? "DIVERGE — distrust any single number" : sp.verdict === "caution" ? "CAUTION — models partly disagree" : "AGREE — models concur";
    var vC = sp.verdict === "diverge" ? "#ef4444" : sp.verdict === "caution" ? "#f59e0b" : "#22c55e";
    var envRows = (env.variables || []).map(function (v) {
      var ok = v.inEnvelope === true;
      return '• ' + (v.name === "T_C" ? "Temperature" : v.name === "pH" ? "in-situ pH" : v.name) + ' = ' + f(v.value, 1) + ' vs valid ' + f(v.lo, 1) + '–' + f(v.hi, 1) +
        ' &nbsp;<b style="color:' + (ok ? "#22c55e" : "#f59e0b") + '">' + (ok ? "✓ in range" : "⚠ extrapolated") + '</b>';
    }).join("<br>");
    var H = intro("Sweet (CO₂) corrosion — why five models beat one",
      "A worked example, every number computed live by <code>CO2.assess()</code>. The lesson: the model <b>spread</b> is the honest measure of confidence.");
    H += opbox("Operating point — carbon-steel flowline:<br>T = " + IN.T + " °C · pCO₂ = " + IN.pCO2 + " bar · flow = " + IN.velocity + " m/s · ID = " + IN.pipeID + " m · HCO₃⁻ = " + IN.bicarbonate + " mg/L");
    H += card('#64748b', step(1, "Why five models, not one?") + p("Sweet-corrosion rate models are <i>semi-empirical</i> — each fit to a different dataset with different assumptions about protective scale, flow and chemistry. None is “the” answer, so PitCast runs five and shows the spread."));
    H += card('#38bdf8', step(2, "In-situ pH — the master variable") + p("Dissolved CO₂ forms carbonic acid; bicarbonate buffers it back up. The Crolet–Bonis charge balance gives the surface pH.") +
      live("→ in-situ pH = <b style=\"color:#7dd3fc\">" + f(r.pH_insitu, 2) + "</b>") +
      p("<span style=\"font-size:12px\">Higher pH → more FeCO₃ scale → slower corrosion. Most of the disagreement below is about how each model credits that scale.</span>") +
      gboxLite("in-situ pH from CO₂–H₂CO₃–HCO₃⁻ charge balance (T-dependent K_H, K₁, K_sp)", "Crolet &amp; Bonis, Corrosion 47 (1991) 351"));
    H += card('#a78bfa', step(3, "The five rate models — same conditions, different answers") +
      '<div style="overflow:auto"><table style="border-collapse:collapse;width:100%;font-size:12px;margin-top:4px"><thead><tr><th style="text-align:left;padding:5px 8px;color:var(--dim);font-size:11px">Model</th><th style="text-align:right;padding:5px 8px;color:var(--dim);font-size:11px">CR (mm/y)</th><th style="text-align:left;padding:5px 8px;color:var(--dim);font-size:11px">what it captures</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      live("They range from <b>" + f(r.crMin, 2) + "</b> to <b>" + f(r.crMax, 2) + "</b> mm/y — a <b style=\"color:#f59e0b\">" + f(r.spread, 1) + "×</b> spread on the <i>same</i> point. Not an error — the genuine state of the science."));
    H += card(vC, step(4, "The ensemble &amp; the disagreement verdict") +
      p("Median <b style=\"color:var(--ink)\">" + f(ens.median, 2) + "</b> mm/y, range <b style=\"color:var(--ink)\">" + f(ens.min, 2) + "–" + f(ens.max, 2) + "</b>, spread ratio <b style=\"color:var(--ink)\">" + f(sp.ratio, 1) + "×</b>.") +
      '<div style="margin-top:8px;font-size:14px"><span style="display:inline-block;padding:3px 10px;border-radius:6px;background:' + vC + '22;color:' + vC + ';font-weight:700">' + vWord + '</span></div>' +
      p("<span style=\"font-size:12px\">Thresholds: ≤1.5× agree · ≤3× caution · &gt;3× diverge. A <i>diverge</i> verdict says plainly: don’t bet on one number — get data. The honest signal a single-number tool hides.</span>"));
    H += card('#22c55e', step(5, "Is the point in range? (validity envelope)") +
      p("A model is trustworthy only inside its calibration envelope (NORSOK M-506: T 20–150 °C, pH 3.5–6.5). PitCast flags extrapolation, never hides it.") +
      '<div style="margin-top:8px;font-size:12px;color:var(--ink);font-family:var(--mono,monospace);line-height:1.8">' + (envRows || "(n/a)") + '</div>');
    H += card('#7dd3fc', step(6, "The verdict — and what it is (and isn’t)") +
      p("Engine verdict: <b style=\"color:var(--ink)\">" + esc(r.verdict || "–") + "</b>" + (r.regime ? " (regime: " + esc(r.regime) + ")" : "") + ".") +
      p("<span style=\"font-size:12px\">A <b>screening</b> result — it narrows options and flags risk, it is <b>not</b> a substitute for a corrosion engineer or lab data.</span>"));
    return H;
  }

  // ════════════════════════════════════════════════════ CPT (pitting) ═══════
  function lessonCPT() {
    var PC = _g("PitCast");
    if (!PC || !PC.assess || !PC.prenN30) return p("CPT engine (pitcast.js) not loaded.");
    var comp = { Cr: 22, Mo: 3.16, N: 0.17, Ni: 5.5, Fe: 69 };           // 2205 duplex (S32205)
    var svc = { T: 50, Cl: 50000 };                                       // 50 °C, ~5 % NaCl brine
    var pren = PC.prenN30(comp);
    var a = PC.assess(comp, svc);
    var pPct = (a.pPit != null) ? (a.pPit * 100) : null;
    var pC = pPct == null ? "#94a3b8" : pPct < 5 ? "#22c55e" : pPct < 50 ? "#f59e0b" : "#ef4444";
    var pWord = pPct == null ? "n/a" : pPct < 5 ? "LOW pitting risk" : pPct < 50 ? "ELEVATED — marginal" : "HIGH pitting risk";
    var H = intro("Pitting (CPT) — a probability, not a yes/no",
      "Live <code>PitCast.assess()</code> on a duplex stainless. The lesson: a calibrated correlation + its scatter give a <b>probability of pitting</b>, not false-precise certainty.");
    H += opbox("Alloy 2205 duplex (S32205): Cr 22 · Mo 3.16 · N 0.17 (wt%)<br>Service: " + svc.T + " °C, " + svc.Cl.toLocaleString() + " mg/L chloride");
    H += card('#64748b', step(1, "The question: will it pit here?") +
      p("Every stainless has a <b>critical pitting temperature</b> (CPT): below it the passive film holds; above it, chloride pits initiate. So the question is whether service temperature exceeds this alloy’s CPT — and how sure we are."));
    H += card('#38bdf8', step(2, "PRENₙ₃₀ — the pitting-resistance number") +
      p("Resistance is summarised by the Pitting Resistance Equivalent: Cr, Mo and N each raise it.") +
      live("→ PRENₙ₃₀ = <b style=\"color:#7dd3fc\">" + f(pren, 1) + "</b>") +
      gboxLite("PRENₙ₃₀ = Cr + 3.3·Mo + 30·N", "ISO 15156-3; N-weighting per Nyby 2021 calibration"));
    H += card('#a78bfa', step(3, "CPT from PREN — a calibrated correlation") +
      p("PitCast fits CPT to PRENₙ₃₀ on an open measured dataset (G48 / 6% FeCl₃ basis).") +
      live("→ CPT (G48 basis) = <b style=\"color:#7dd3fc\">" + f(a.cptG48, 1) + " °C</b>") +
      p("<span style=\"font-size:12px\">Calibration: n = 51 alloys, R² = 0.83, leave-one-out MAE <b>6.58 °C</b> — the honest out-of-sample error, reproduced by <code>node benchmark/run.js</code>.</span>") +
      gboxLite("CPT = 2.038·PRENₙ₃₀ − 32.73 (°C)", "Nyby et&nbsp;al., Sci. Data 8:58 (2021), CC-BY; ASTM G48"));
    H += card('#f59e0b', step(4, "Chloride shifts the CPT") +
      p("Real brine isn’t the G48 reference. CPT falls ~24 °C per decade of [Cl⁻]; PitCast adjusts off the G48 anchor.") +
      live("→ chloride adjustment = <b style=\"color:#7dd3fc\">" + (a.clAdj >= 0 ? "+" : "") + f(a.clAdj, 1) + " °C</b> → in-service CPT ≈ <b style=\"color:#7dd3fc\">" + f(a.cpt, 1) + " °C</b>"));
    H += card(pC, step(5, "P(pit) — propagating the uncertainty") +
      p("We don’t pretend the CPT is exact. The correlation’s scatter (prediction SE ≈ <b style=\"color:var(--ink)\">" + f(a.cptSE, 1) + " °C</b>) is carried through a Student-t (df = n−2 = 49) to give the probability that service temperature exceeds the true CPT.") +
      '<div style="margin-top:8px;font-size:14px">→ P(pit) = P(CPT &lt; ' + svc.T + ' °C) = <b style="color:' + pC + '">' + (pPct == null ? "n/a" : f(pPct, 1) + " %") + '</b> &nbsp;<span style="font-size:12px;color:' + pC + '">' + pWord + '</span></div>' +
      p("<span style=\"font-size:12px\">This is the uncertainty-first idea: a calibrated <b>probability</b>, not a single threshold that pretends to a precision the data don’t support.</span>") +
      gboxLite("P = t-CDF((T_service − CPT) / SE_pred, df = n−2); SE_pred = s·√(1 + 1/n + (PREN−mean)²/Sxx)", "Student-t prediction interval; PitCast CPT fit (n=51)"));
    H += card('#7dd3fc', step(6, "Read it as a screen") +
      p("<span style=\"font-size:12px\">Use P(pit) to rank candidates and flag risk — then confirm marginal calls (5–50%) with a real G48/G150 test on the actual heat. Screening narrows the field; it doesn’t replace the test.</span>"));
    return H;
  }

  // ════════════════════════════════════════════════════ B31G (metal loss) ══
  function lessonB31G() {
    var B = _g("B31G");
    if (!B || !B.failurePressure) return p("B31G engine not loaded.");
    var D = 609.6, t = 7.137, L = 254, d = 2.54, grade = "X52";
    var SMYS = (B.GRADES[grade] || {}).SMYS || 359;
    var b = B.failurePressure({ D: D, t: t, SMYS: SMYS, L: L, d: d, method: "b31g" });
    var m = B.failurePressure({ D: D, t: t, SMYS: SMYS, L: L, d: d, method: "modb31g" });
    var MAOP = 50;
    var cls = B.classify(Math.min(b.P_safe_bar, m.P_safe_bar), MAOP, b.depthRatio, b.throughWall);
    var H = intro("Corroded-pipe strength (B31G) — two codes, two answers",
      "Live <code>B31G.failurePressure()</code> on the ASME B31G worked example. The lesson: even a code calculation carries method choice — we show both.");
    H += opbox("24″ OD × 0.281″ WT API 5L " + grade + " pipeline (D " + D + " mm, t " + t + " mm)<br>External metal-loss patch: length " + L + " mm, max depth " + d + " mm · MAOP " + MAOP + " bar");
    H += card('#64748b', step(1, "The question: is the corroded patch safe at MAOP?") +
      p("A pipeline has lost wall to a corrosion patch. B31G estimates the <b>failure pressure</b> of the remaining metal, then derates it by a safety factor to a <b>safe operating pressure</b> to compare against MAOP."));
    H += card('#38bdf8', step(2, "Defect shape — short or long?") +
      p("The dimensionless length z = L²/(D·t) sets whether the flaw bulges like a short or long defect.") +
      live("→ z = <b style=\"color:#7dd3fc\">" + f(b.z, 1) + "</b> · d/t = <b style=\"color:#7dd3fc\">" + f(b.depthRatio * 100, 1) + " %</b> (" + esc(b.regime) + ")"));
    H += card('#a78bfa', step(3, "Folias factor &amp; failure pressure") +
      p("The Folias bulging factor M magnifies stress at the flaw; flow stress × a depth term, put through Barlow’s thin-shell relation, gives the failure pressure.") +
      live("→ M = <b style=\"color:#7dd3fc\">" + f(b.M, 2) + "</b> · σ_flow-limited ≈ <b style=\"color:#7dd3fc\">" + f(b.sigma_f_MPa, 0) + " MPa</b> · P_f = <b style=\"color:#7dd3fc\">" + f(b.P_f_bar, 1) + " bar</b>") +
      gboxLite("P_f = (2·σ_f·t/D)·(1 − d/t)/(1 − (d/t)/M); M = √(1 + 0.8·z)", "ASME B31G-2012 §2; Folias 1965"));
    H += card('#f59e0b', step(4, "Two methods disagree — by design") +
      p("Original B31G uses a 2/3-area parabola; <b>Modified B31G (RSTRENG)</b> uses a less-conservative 0.85-area rule and a higher flow stress. Same flaw, different safe pressure:") +
      '<div style="margin-top:8px;font-size:13px;font-family:var(--mono,monospace);color:var(--ink);line-height:1.9">' +
      '• Original B31G: P_safe = <b style="color:#7dd3fc">' + f(b.P_safe_bar, 1) + ' bar</b><br>' +
      '• Modified B31G: P_safe = <b style="color:#7dd3fc">' + f(m.P_safe_bar, 1) + ' bar</b></div>' +
      p("<span style=\"font-size:12px\">Both are accepted code; the engineer picks the basis. PitCast shows both so the choice is explicit — and these match our regression oracle (<code>benchmark/test-b31g.js</code>).</span>"));
    H += card('#22c55e', step(5, "Safety factor → verdict") +
      p("Safe pressure = failure pressure ÷ 1.39 (ASME B31G). Compared against MAOP " + MAOP + " bar:") +
      '<div style="margin-top:8px;font-size:14px"><span style="display:inline-block;padding:3px 10px;border-radius:6px;background:#22c55e22;color:#22c55e;font-weight:700">' + esc(cls.status) + '</span> &nbsp;<span style="font-size:12px;color:var(--dim)">' + esc(cls.note) + '</span></div>');
    H += card('#7dd3fc', step(6, "Scope") +
      p("<span style=\"font-size:12px\">Single axial external metal-loss flaw, screening level. Interacting defects, dents, or cracks need the full assessment (and PitCast’s ILI-batch tab for many flaws at once).</span>"));
    return H;
  }

  // ════════════════════════════════════════════════════ MR0175 (sour spec) ═
  function lessonMR() {
    var MR = _g("MR0175");
    if (!MR || !MR.issue) return p("MR0175 engine not loaded.");
    var comp = { C: 0.2, Mn: 1.1, Cr: 0.1 };
    var args = { composition: comp, T_C: 60, pH2S_kPa: 50, pH_in_situ: 4.0, Cl_mg_L: 60000, hardness_HRC: 22 };
    var v = MR.issue(args);
    var region = (typeof MR._regionLookup === "function") ? MR._regionLookup(args.pH2S_kPa, args.pH_in_situ) : null;
    var inOK = v.IN_SCOPE === true;
    var H = intro("Sour-service materials (MR0175 / ISO 15156) — a decision tree",
      "Live <code>MR0175.issue()</code>. The lesson: not every answer is a number — some are a <b>standards decision</b>, and the value is showing every branch + its citation.");
    H += opbox("Carbon steel (C 0.2 · Mn 1.1 wt%) flowline<br>Sour service: H₂S " + args.pH2S_kPa + " kPa · in-situ pH " + args.pH_in_situ + " · " + args.Cl_mg_L.toLocaleString() + " mg/L Cl⁻ · " + args.T_C + " °C · hardness " + args.hardness_HRC + " HRC");
    H += card('#64748b', step(1, "Is it even sour service?") +
      p("ISO 15156 applies once H₂S partial pressure reaches <b>0.3 kPa</b> (0.05 psia). Below that, ordinary selection applies.") +
      live("→ H₂S " + args.pH2S_kPa + " kPa ≥ 0.3 → <b style=\"color:#7dd3fc\">sour — ISO 15156 applies</b>"));
    H += card('#38bdf8', step(2, "Classify the material family") +
      p("The standard routes carbon/low-alloy steels (Part 2) differently from corrosion-resistant alloys (Part 3, Annex A by family).") +
      live("→ family = <b style=\"color:#7dd3fc\">carbon / low-alloy steel</b> → Part 2 route"));
    H += card('#a78bfa', step(3, "Locate the severity region (Part 2, Figure 1)") +
      p("For C-steel, H₂S partial pressure and in-situ pH place the service in Region 0–3, each with its own qualification demands.") +
      live("→ H₂S " + args.pH2S_kPa + " kPa, pH " + args.pH_in_situ + " → <b style=\"color:#7dd3fc\">Region " + (region == null ? "?" : region) + "</b>") +
      gboxLite("Region 0: pH₂S &lt; 0.3 kPa · 1: &lt;10 · 2: &lt;100 · 3: ≥10 kPa or pH &lt; 3.5", "ISO 15156-2:2020 Figure 1"));
    H += card('#f59e0b', step(4, "Hardness ceiling") +
      p("C-Mn steel qualifies for sour service only if base metal, HAZ and welds stay at or below <b>22 HRC</b> — hard microstructures crack (SSC).") +
      live("→ " + args.hardness_HRC + " HRC " + (args.hardness_HRC <= 22 ? "≤ 22 → <b style=\"color:#22c55e\">within ceiling</b>" : "&gt; 22 → <b style=\"color:#ef4444\">exceeds ceiling</b>")));
    H += card(inOK ? '#22c55e' : '#ef4444', step(5, "Verdict + citation") +
      '<div style="font-size:14px"><span style="display:inline-block;padding:3px 10px;border-radius:6px;background:' + (inOK ? "#22c55e" : "#ef4444") + '22;color:' + (inOK ? "#22c55e" : "#ef4444") + ';font-weight:700">' + (inOK ? "ACCEPTABLE" : "NOT QUALIFIED") + ' · route ' + esc(v.route) + '</span></div>' +
      p("<span style=\"font-size:12px\">" + esc((v.citations && v.citations[0]) || "ISO 15156") + ". Every verdict carries the clause it came from — that traceability is the whole point of a spec issuer.</span>") +
      ((v.manufacturing_annotations && v.manufacturing_annotations.length) ? p("<span style=\"font-size:11px\">Note: " + esc(v.manufacturing_annotations[0]) + "</span>") : ""));
    H += card('#7dd3fc', step(6, "Scope") +
      p("<span style=\"font-size:12px\">A screening dispatcher over the ISO 15156 envelopes — confirm against the current standard (it is paywalled and periodically amended) before issuing a procurement spec.</span>"));
    return H;
  }

  var DOMAINS = [
    { id: "co2", label: "CO₂ (sweet)", fn: lessonCO2 },
    { id: "cpt", label: "Pitting (CPT)", fn: lessonCPT },
    { id: "b31g", label: "Metal loss (B31G)", fn: lessonB31G },
    { id: "mr0175", label: "Sour spec (MR0175)", fn: lessonMR }
  ];

  function render(host, domain) {
    if (!host) return;
    domain = domain || "co2";
    var sel = DOMAINS.map(function (d) {
      var on = d.id === domain;
      return '<button type="button" class="learn-dom" data-dom="' + d.id + '" style="padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;border:1px solid ' +
        (on ? 'rgba(56,189,248,.5)' : 'var(--line,#243042)') + ';background:' + (on ? 'rgba(56,189,248,.18)' : 'rgba(255,255,255,.02)') + ';color:' + (on ? '#7dd3fc' : 'var(--dim)') + '">' + d.label + '</button>';
    }).join("");
    var dom = DOMAINS.filter(function (d) { return d.id === domain; })[0] || DOMAINS[0];
    var body;
    try { body = dom.fn(); } catch (e) { body = p("Could not build this walkthrough: " + esc(e.message)); }
    host.innerHTML = '<div style="max-width:760px">' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px">' + sel + '</div>' +
      '<div style="font-size:11px;color:var(--dim);margin-bottom:10px">Pick a domain — each walkthrough is computed live by the same engine the console uses.</div>' +
      body +
      '<div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">' +
      '<button type="button" class="learn-goto" data-tab="' + (domain === "cpt" ? "assess" : domain === "b31g" ? "integrity" : domain) + '" style="padding:8px 14px;background:rgba(56,189,248,.15);border:1px solid rgba(56,189,248,.3);color:#7dd3fc;border-radius:6px;cursor:pointer;font-weight:600">Try it yourself → console</button>' +
      '<button type="button" class="learn-goto" data-tab="atlas" style="padding:8px 14px;background:rgba(167,139,250,.15);border:1px solid rgba(167,139,250,.3);color:#c4b5fd;border-radius:6px;cursor:pointer;font-weight:600">Every model’s equation → Model atlas</button>' +
      '</div>' + scopeNote("More domains share this template") + '</div>';

    host.querySelectorAll(".learn-dom").forEach(function (b) {
      b.onclick = function () { render(host, b.dataset.dom); };
    });
    host.querySelectorAll(".learn-goto").forEach(function (b) {
      b.onclick = function () { var t = document.querySelector('.tab[data-tab="' + b.dataset.tab + '"]'); if (t) { t.click(); window.scrollTo({ top: 0, behavior: "auto" }); } };
    });
  }

  root.Learn = { render: render, renderCO2: function (host) { return render(host, "co2"); }, DOMAINS: DOMAINS };
  if (typeof module !== "undefined" && module.exports) module.exports = root.Learn;
})(typeof window !== "undefined" ? window : this);
