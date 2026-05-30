/* learn.js — PitCast "Learn corrosion screening" track (P3 WS3.4).
 *
 * A guided, worked-example walkthrough that teaches HOW the screening works,
 * using the *same* engine the console uses — every number below is computed
 * live by CO2.assess(), nothing is hard-coded. Extends the per-card "show your
 * work" mode into a full lesson. Integrated into the console (a tab), linked
 * from the Model Atlas. No marketing copy; this is a teaching surface.
 *
 * A Javanshir Hasanov production.
 */
(function (root) {
  "use strict";

  function _CO2() {
    if (typeof window !== "undefined" && window.CO2) return window.CO2;
    if (typeof require === "function") { try { return require("./co2.js"); } catch (e) {} }
    return null;
  }
  function f(x, d) { if (x == null || !isFinite(x)) return "–"; var p = Math.pow(10, d == null ? 2 : d); return (Math.round(x * p) / p).toString(); }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  // one-line plain-English character of each model (accurate, sourced from the
  // model's own basis — not marketing). Keyed by engine model id.
  var BLURB = {
    "DWM-1975": "earliest correlation — pCO₂ + temperature only, no protective-scale credit, so usually the most conservative (highest).",
    "DWM-1995": "adds in-situ pH, flow and a protective-scale factor → drops below 1975 once FeCO₃ scale can form.",
    "NORSOK":   "the regulator model — wall-shear-stress + a pH function; the de-facto design basis on the Norwegian shelf.",
    "NESC":     "mechanistic baseline rate scaled by protective-film, oil-wetting and velocity factors.",
    "FreeCorp": "mechanistic (Ohio University) — explicit surface-film, H₂S and mass-transfer/velocity terms."
  };

  function card(accent, inner) {
    return '<div style="margin:12px 0;padding:14px 16px;border-left:3px solid ' + accent +
      ';background:rgba(255,255,255,.02);border-radius:0 8px 8px 0">' + inner + '</div>';
  }
  function step(n, title) {
    return '<div style="font-size:13px;color:#7dd3fc;font-weight:700;margin-bottom:6px">STEP ' + n + ' · ' + title + '</div>';
  }
  function gboxLite(eq, cite) {
    return '<details style="margin:8px 0 2px;border:1px solid var(--line,#243042);border-radius:6px;background:rgba(255,255,255,.02)">' +
      '<summary style="cursor:pointer;padding:6px 10px;font-size:11px;color:var(--dim);user-select:none">▸ equation &amp; citation</summary>' +
      '<div style="padding:0 10px 8px;font-size:11px;color:var(--dim);line-height:1.6">' +
      '<div style="font-family:var(--mono,monospace);color:var(--ink)">' + eq + '</div>' +
      '<div style="margin-top:4px">Cite: ' + cite + '</div></div></details>';
  }

  function renderCO2(host) {
    if (!host) return;
    var CO2 = _CO2();
    if (!CO2 || !CO2.assess) { host.innerHTML = '<div class="placeholder">CO₂ engine not loaded.</div>'; return; }

    // Teaching operating point — a typical carbon-steel flowline. Live-assessed.
    var IN = { T: 60, pCO2: 5, velocity: 2, pipeID: 0.2, bicarbonate: 500 };
    var r = CO2.assess(IN);
    var uq = r.uq || {};
    var ens = (uq.ensemble) || {};
    var sp = (ens.spread) || {};
    var env = (uq.envelope) || { variables: [] };
    var pHins = (r.pH_insitu != null) ? r.pH_insitu : (uq.value != null ? null : null);

    var H = [];
    H.push('<div style="max-width:760px">');
    H.push('<h2 style="margin:0 0 4px">Learn: how PitCast screens sweet (CO₂) corrosion</h2>');
    H.push('<div style="font-size:13px;color:var(--dim);line-height:1.6;margin-bottom:8px">A worked example you can follow end-to-end. Every number below is computed <b>live</b> by the same engine the CO₂ tab uses — nothing is hard-coded. Change the operating point on the CO₂ tab and the same logic runs.</div>');

    // operating-point box
    H.push('<div style="font-size:12px;background:#0b1220;border:1px solid var(--line,#243042);border-radius:8px;padding:10px 12px;color:var(--ink);font-family:var(--mono,monospace)">' +
      'Operating point — carbon-steel flowline:<br>T = ' + IN.T + ' °C · pCO₂ = ' + IN.pCO2 + ' bar · flow = ' + IN.velocity + ' m/s · ID = ' + IN.pipeID + ' m · HCO₃⁻ = ' + IN.bicarbonate + ' mg/L</div>');

    // Step 1
    H.push(card('#64748b', step(1, "Why five models, not one?") +
      '<div style="font-size:13px;color:var(--dim);line-height:1.65">Sweet-corrosion rate models are <i>semi-empirical</i>: each was fit to a different dataset and bakes in different assumptions about protective scale, flow and water chemistry. None is "the" answer. PitCast runs five canonical models on one operating point and shows you the <b>spread</b> — because the spread is the honest measure of how much to trust the number.</div>'));

    // Step 2 — in-situ pH
    H.push(card('#38bdf8', step(2, "In-situ pH — the master variable") +
      '<div style="font-size:13px;color:var(--dim);line-height:1.65">Before any rate, we need the pH at the metal surface. Dissolved CO₂ forms carbonic acid; bicarbonate alkalinity buffers it back up. The Crolet–Bonis charge balance gives the in-situ pH from pCO₂, temperature and HCO₃⁻.</div>' +
      '<div style="margin-top:8px;font-size:14px;color:var(--ink)">→ in-situ pH = <b style="color:#7dd3fc">' + f(pHins, 2) + '</b> &nbsp;<span style="font-size:12px;color:var(--dim)">(from pCO₂ ' + IN.pCO2 + ' bar, T ' + IN.T + ' °C, HCO₃⁻ ' + IN.bicarbonate + ' mg/L)</span></div>' +
      '<div style="margin-top:6px;font-size:12px;color:var(--dim);line-height:1.6">Why it matters: higher pH → more FeCO₃ scale → slower corrosion. <b>Most of the disagreement below comes from how each model credits that scale.</b></div>' +
      gboxLite("in-situ pH from CO₂–H₂CO₃–HCO₃⁻ charge balance (T-dependent K_H, K_1, K_sp)", "Crolet J.-L. &amp; Bonis M.R., Corrosion 47 (1991) 351 (CORROSION/91 Paper 22)")));

    // Step 3 — the five models (live table)
    var rows = (r.models || []).map(function (m) {
      var cr = (typeof m.cr === "number") ? m.cr : (m.cr && m.cr.CR_mmpy);
      return '<tr>' +
        '<td style="padding:5px 8px;border-bottom:1px solid rgba(255,255,255,.05)"><b style="color:var(--ink)">' + esc(m.name) + '</b></td>' +
        '<td style="padding:5px 8px;border-bottom:1px solid rgba(255,255,255,.05);text-align:right;font-family:var(--mono,monospace);color:#7dd3fc">' + f(cr, 2) + '</td>' +
        '<td style="padding:5px 8px;border-bottom:1px solid rgba(255,255,255,.05);font-size:11px;color:var(--dim)">' + (BLURB[m.id] || "") + '</td>' +
        '</tr>';
    }).join("");
    H.push(card('#a78bfa', step(3, "The five rate models — same conditions, different answers") +
      '<div style="overflow:auto"><table style="border-collapse:collapse;width:100%;font-size:12px;margin-top:4px">' +
      '<thead><tr><th style="text-align:left;padding:5px 8px;color:var(--dim);font-size:11px">Model</th><th style="text-align:right;padding:5px 8px;color:var(--dim);font-size:11px">CR (mm/y)</th><th style="text-align:left;padding:5px 8px;color:var(--dim);font-size:11px">what it captures</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>' +
      '<div style="margin-top:8px;font-size:13px;color:var(--ink);line-height:1.6">They range from <b>' + f(r.crMin, 2) + '</b> to <b>' + f(r.crMax, 2) + '</b> mm/y — a <b style="color:#f59e0b">' + f(r.spread, 1) + '×</b> spread on the <i>same</i> operating point. That is not an error; it is the genuine state of the science.</div>'));

    // Step 4 — ensemble + disagreement verdict
    var vWord = sp.verdict === "diverge" ? "DIVERGE — distrust any single number"
      : sp.verdict === "caution" ? "CAUTION — models partly disagree"
      : "AGREE — models concur";
    var vColor = sp.verdict === "diverge" ? "#ef4444" : sp.verdict === "caution" ? "#f59e0b" : "#22c55e";
    H.push(card(vColor, step(4, "The ensemble &amp; the disagreement verdict") +
      '<div style="font-size:13px;color:var(--dim);line-height:1.65">PitCast summarises the five as an ensemble: median <b style="color:var(--ink)">' + f(ens.median, 2) + '</b> mm/y, range <b style="color:var(--ink)">' + f(ens.min, 2) + '–' + f(ens.max, 2) + '</b>. The spread ratio (max/min) is <b style="color:var(--ink)">' + f(sp.ratio, 1) + '×</b>.</div>' +
      '<div style="margin-top:8px;font-size:14px"><span style="display:inline-block;padding:3px 10px;border-radius:6px;background:' + vColor + '22;color:' + vColor + ';font-weight:700">' + vWord + '</span></div>' +
      '<div style="margin-top:8px;font-size:12px;color:var(--dim);line-height:1.6">Thresholds: ≤ 1.5× <b>agree</b> · ≤ 3× <b>caution</b> · &gt; 3× <b>diverge</b>. A <i>diverge</i> verdict is the tool telling you plainly: <b>do not bet on a single number here</b> — get field data or a corrosion engineer. This honest "how much should I trust this?" signal is exactly what a single-number tool hides.</div>'));

    // Step 5 — validity envelope
    var envRows = (env.variables || []).map(function (v) {
      var ok = v.inEnvelope === true;
      return '• ' + (v.name === "T_C" ? "Temperature" : v.name === "pH" ? "in-situ pH" : v.name) +
        ' = ' + f(v.value, 1) + ' vs valid ' + f(v.lo, 1) + '–' + f(v.hi, 1) +
        ' &nbsp;<b style="color:' + (ok ? "#22c55e" : "#f59e0b") + '">' + (ok ? "✓ in range" : "⚠ extrapolated") + '</b>';
    }).join("<br>");
    H.push(card('#22c55e', step(5, "Is the point even in range? (validity envelope)") +
      '<div style="font-size:13px;color:var(--dim);line-height:1.65">A model is only trustworthy inside the conditions it was calibrated on (NORSOK M-506: T 20–150 °C, pH 3.5–6.5). PitCast checks the operating point against each envelope and <b>flags extrapolation rather than hiding it</b>.</div>' +
      '<div style="margin-top:8px;font-size:12px;color:var(--ink);font-family:var(--mono,monospace);line-height:1.8">' + (envRows || "(no envelope variables)") + '</div>'));

    // Step 6 — verdict + scope
    H.push(card('#7dd3fc', step(6, "The verdict — and what it is (and isn't)") +
      '<div style="font-size:13px;color:var(--dim);line-height:1.65">Engine verdict for this point: <b style="color:var(--ink)">' + esc(r.verdict || "–") + '</b>' + (r.regime ? ' &nbsp;<span style="font-size:12px">(regime: ' + esc(r.regime) + ')</span>' : '') + '.</div>' +
      '<div style="margin-top:8px;font-size:12px;color:var(--dim);line-height:1.6">This is a <b>screening</b> result — it narrows options and flags risk. It is <b>not</b> a substitute for a corrosion engineer or laboratory data. That is the whole philosophy of PitCast: show the equation, the spread, the envelope and the citation, so the number is <b>defensible</b> — not authoritative-looking.</div>'));

    // links
    H.push('<div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">' +
      '<button type="button" id="learn_go_co2" style="padding:8px 14px;background:rgba(56,189,248,.15);border:1px solid rgba(56,189,248,.3);color:#7dd3fc;border-radius:6px;cursor:pointer;font-weight:600">Try it yourself → CO₂ tab</button>' +
      '<button type="button" id="learn_go_atlas" style="padding:8px 14px;background:rgba(167,139,250,.15);border:1px solid rgba(167,139,250,.3);color:#c4b5fd;border-radius:6px;cursor:pointer;font-weight:600">Every model\'s equation → Model atlas</button>' +
      '</div>');
    H.push('<div style="margin-top:10px;font-size:11px;color:var(--dim)">Worked example computed live by <code>CO2.assess()</code> · screening-grade, glass-box, Apache-2.0. More domain walkthroughs to follow.</div>');
    H.push('</div>');

    host.innerHTML = H.join("");
    var b1 = document.getElementById("learn_go_co2");
    if (b1) b1.onclick = function () { var t = document.querySelector('[data-tab="co2"]'); if (t) t.click(); };
    var b2 = document.getElementById("learn_go_atlas");
    if (b2) b2.onclick = function () { var t = document.querySelector('[data-tab="atlas"]'); if (t) t.click(); };
  }

  root.Learn = { renderCO2: renderCO2 };
  if (typeof module !== "undefined" && module.exports) module.exports = root.Learn;
})(typeof window !== "undefined" ? window : this);
