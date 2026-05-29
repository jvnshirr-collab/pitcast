#!/usr/bin/env node
/* PitCast open benchmark harness — reproducible, in-repo, no fabricated data.
 *
 *   node benchmark/run.js
 *
 * Produces benchmark/results.json + benchmark/REPORT.md from the REAL cited
 * data already in the repo:
 *   - data/measurements.json  — measured CPT records (Nyby 2021 open dataset etc.);
 *                               each record carries its own composition + test solution
 *   - data/grades.json        — alloy compositions (for the CRA spot-check)
 *   - data/validations.json   — cited CO2 field/lab cases (+ benchmark/co2-inputs.json
 *                               for the machine-runnable structured inputs)
 *
 * CPT: reproduces the published correlation's LEAVE-ONE-OUT error (the honest,
 *      out-of-sample metric) by refitting CPT = a*PREN_N30 + b on every subset
 *      that excludes the held-out point. Headline subset = ASTM G48-type (FeCl3
 *      immersion), the basis the published model is calibrated on.
 * CO2: runs all 5 ensemble models per cited case; reports per-model error AND
 *      whether the model spread (envelope) brackets the measurement.
 *
 * Anything that cannot be sourced from cited data is NOT invented — it is
 * reported as a gap (see "Coverage & honesty notes" in the report).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PitCast = require(path.join(ROOT, 'pitcast.js'));
const CO2 = require(path.join(ROOT, 'co2.js'));

function loadJSON(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function round(x, d) { if (x == null || !isFinite(x)) return x; const f = 10 ** (d == null ? 2 : d); return Math.round(x * f) / f; }

const measurements = loadJSON(path.join(ROOT, 'data', 'measurements.json')).records;
const grades = loadJSON(path.join(ROOT, 'data', 'grades.json'));
const validations = loadJSON(path.join(ROOT, 'data', 'validations.json'));
const co2inputs = loadJSON(path.join(__dirname, 'co2-inputs.json')).cases;

// ── stats helpers ──────────────────────────────────────────────────────────
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const mae = r => mean(r.map(Math.abs));
const rmse = r => Math.sqrt(mean(r.map(x => x * x)));
const bias = r => mean(r);
function olsFit(pts) {                       // pts: [{x,y}] -> {slope, intercept, r2, n}
  const n = pts.length, mx = mean(pts.map(p => p.x)), my = mean(pts.map(p => p.y));
  let sxx = 0, sxy = 0, syy = 0;
  for (const p of pts) { sxx += (p.x - mx) ** 2; sxy += (p.x - mx) * (p.y - my); syy += (p.y - my) ** 2; }
  const slope = sxy / sxx, intercept = my - slope * mx;
  const ssRes = pts.reduce((s, p) => s + (p.y - (slope * p.x + intercept)) ** 2, 0);
  return { slope, intercept, r2: 1 - ssRes / syy, n };
}
function looStats(pts) {                      // leave-one-out residuals (measured - predicted)
  const resid = [];
  for (let i = 0; i < pts.length; i++) {
    const f = olsFit(pts.filter((_, j) => j !== i));
    resid.push(pts[i].y - (f.slope * pts[i].x + f.intercept));
  }
  return { n: pts.length, MAE_C: mae(resid), RMSE_C: rmse(resid), bias_C: bias(resid), resid };
}

// ── CPT: in-record compositions, leave-one-out on the FeCl3/G48 basis ───────
const cptAll = [];
let cptRecords = 0, cptNoComp = 0;
for (const r of measurements) {
  if (r.metric !== 'CPT') continue;
  cptRecords++;
  const val = Number(r.value);
  if (!isFinite(val)) continue;
  if (!r.comp || typeof r.comp !== 'object') { cptNoComp++; continue; }
  const pren = PitCast.prenN30(r.comp);
  if (!isFinite(pren) || pren <= 0) continue;
  cptAll.push({ code: r.code, x: pren, y: val, feCl3: /FeCl3|ferric/i.test(r.sol || '') });
}
const cptFeCl3 = cptAll.filter(p => p.feCl3);          // headline basis
const looFeCl3 = looStats(cptFeCl3);
const looAll = looStats(cptAll);
const fitFeCl3 = olsFit(cptFeCl3);
const cptResult = {
  basis: 'ASTM G48-type FeCl3 immersion (headline); all-method LOO shown for transparency',
  n_cpt_records: cptRecords,
  n_no_composition: cptNoComp,
  n_points_fecl3: cptFeCl3.length,
  n_points_all_methods: cptAll.length,
  full_sample_fit_fecl3: { slope: round(fitFeCl3.slope, 4), intercept: round(fitFeCl3.intercept, 3), r2: round(fitFeCl3.r2, 3) },
  published_fit: { slope: 2.038176, intercept: -32.730883, note: 'pitcast.js CPT constants (n=51)' },
  loo_fecl3: { MAE_C: round(looFeCl3.MAE_C, 2), RMSE_C: round(looFeCl3.RMSE_C, 2), bias_C: round(looFeCl3.bias_C, 2) },
  loo_all_methods: { n: looAll.n, MAE_C: round(looAll.MAE_C, 2), RMSE_C: round(looAll.RMSE_C, 2), bias_C: round(looAll.bias_C, 2) },
  parity: cptFeCl3.map((p, i) => ({ code: p.code, pren_n30: round(p.x, 2), measured_C: round(p.y, 1), loo_resid_C: round(looFeCl3.resid[i], 1) }))
};
const cptWorst = cptResult.parity.slice().sort((a, b) => Math.abs(b.loo_resid_C) - Math.abs(a.loo_resid_C)).slice(0, 5);

// ── CPT spot-check vs the fully-cited CRA validation cases ──────────────────
const cptSpot = [];
for (const vc of validations.filter(v => v.domain === 'CRA')) {
  const g = grades.find(gr => vc.case.toUpperCase().includes(gr.name.toUpperCase()))
        || grades.find(gr => vc.conditions.toUpperCase().includes(gr.uns.toUpperCase()));
  if (!g) continue;
  const onG48 = /FeCl3|ferric/i.test(vc.conditions);
  const predG48 = PitCast.cptMean(g.comp);
  cptSpot.push({
    case: vc.case, alloy: g.name, basis: onG48 ? 'G48/FeCl3 (on-basis)' : 'electrochemical NaCl (off-basis)',
    measured_C: vc.measured, predicted_G48_C: round(predG48, 1), delta_C: round(predG48 - vc.measured, 1),
    source: vc.source, on_basis: onG48
  });
}
const cptSpotOnBasis = cptSpot.filter(s => s.on_basis);
const cptSpotResult = {
  cases: cptSpot,
  on_basis_MAE_C: cptSpotOnBasis.length ? round(mae(cptSpotOnBasis.map(s => s.predicted_G48_C - s.measured_C)), 2) : null
};

// ── CO2: run the 5-model ensemble against each cited case ───────────────────
const co2cases = [];
for (const vc of validations.filter(v => v.domain === 'CO2')) {
  const inp = co2inputs[vc.case];
  if (!inp) continue;
  const r = CO2.assess(inp);
  const perModel = r.models.map(m => ({ id: m.id, cr: m.cr, err: m.cr - vc.measured }));
  const best = perModel.reduce((a, b) => Math.abs(b.err) < Math.abs(a.err) ? b : a);
  co2cases.push({
    case: vc.case, scope: inp.scope, note: inp.note || null,
    measured_mmpy: vc.measured, uncertainty_mmpy: vc.uncertainty,
    ensemble_min_mmpy: round(r.crMin, 2), ensemble_max_mmpy: round(r.crMax, 2),
    spread_x: round(r.spread, 1), measured_in_envelope: vc.measured >= r.crMin && vc.measured <= r.crMax,
    best_model: best.id, best_model_cr_mmpy: round(best.cr, 2),
    per_model: perModel.map(m => ({ id: m.id, cr_mmpy: round(m.cr, 2), err_mmpy: round(m.err, 2) })),
    source: vc.source
  });
}
const co2InScope = co2cases.filter(c => c.scope === 'cs_aqueous');
const modelIds = co2InScope.length ? co2InScope[0].per_model.map(m => m.id) : [];
const co2PerModel = modelIds.map(id => {
  const errs = co2InScope.map(c => c.per_model.find(m => m.id === id).err_mmpy);
  return { id, MAE_mmpy: round(mae(errs), 2), RMSE_mmpy: round(rmse(errs), 2), bias_mmpy: round(bias(errs), 2) };
});
const co2Result = {
  n_cases_total: co2cases.length,
  n_cases_in_scope_cs: co2InScope.length,
  envelope_coverage_in_scope: co2InScope.length ? round(co2InScope.filter(c => c.measured_in_envelope).length / co2InScope.length, 2) : null,
  per_model_error_in_scope: co2PerModel,
  cases: co2cases
};

// ── emit ────────────────────────────────────────────────────────────────────
const results = {
  generated_utc: new Date().toISOString(),
  about: 'PitCast reproducible open benchmark v0 — built only on cited in-repo data.',
  cpt_leave_one_out: cptResult,
  cpt_validation_spotcheck: cptSpotResult,
  co2_ensemble: co2Result
};
fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(results, null, 2));
fs.writeFileSync(path.join(__dirname, 'REPORT.md'), renderReport(results, cptWorst));

console.log('CPT LOO (FeCl3 basis): n=%d  MAE=%s C  RMSE=%s C  bias=%s C',
  cptResult.n_points_fecl3, cptResult.loo_fecl3.MAE_C, cptResult.loo_fecl3.RMSE_C, cptResult.loo_fecl3.bias_C);
console.log('CPT LOO (all methods): n=%d  MAE=%s C', cptResult.loo_all_methods.n, cptResult.loo_all_methods.MAE_C);
console.log('CPT fit (FeCl3): slope=%s intercept=%s R2=%s  (published 2.038 / -32.73)',
  cptResult.full_sample_fit_fecl3.slope, cptResult.full_sample_fit_fecl3.intercept, cptResult.full_sample_fit_fecl3.r2);
console.log('CPT spot-check on-basis MAE: %s C', cptSpotResult.on_basis_MAE_C);
console.log('CO2: in-scope cases=%d  envelope-coverage=%s', co2Result.n_cases_in_scope_cs, co2Result.envelope_coverage_in_scope);
co2PerModel.forEach(m => console.log('  %s MAE=%s bias=%s mm/y', m.id.padEnd(10), m.MAE_mmpy, m.bias_mmpy));
console.log('Wrote benchmark/results.json + benchmark/REPORT.md');

function renderReport(R, worst) {
  const c = R.cpt_leave_one_out, s = R.cpt_validation_spotcheck, q = R.co2_ensemble;
  const L = [];
  L.push('# PitCast Open Benchmark — Report', '');
  L.push('_Auto-generated by `benchmark/run.js` from cited in-repo data. Do not hand-edit._', '');
  L.push('**Generated:** ' + R.generated_utc, '');
  L.push('Reproducible (`node benchmark/run.js`), built on **only cited measured data already in');
  L.push('the repository** — no synthetic or fabricated points. A transparent, auditable');
  L.push('alternative to the closed validation decks of commercial corrosion tools.', '');

  L.push('## 1. CPT correlation — leave-one-out (out-of-sample) error', '');
  L.push('Model `CPT = a·PREN_N30 + b`, refit on every subset excluding the held-out alloy.', '');
  L.push('| Metric | Value |', '|---|---|');
  L.push('| **LOO MAE (FeCl₃/G48 basis)** | **' + c.loo_fecl3.MAE_C + ' °C** (n=' + c.n_points_fecl3 + ') |');
  L.push('| LOO RMSE / bias (FeCl₃) | ' + c.loo_fecl3.RMSE_C + ' / ' + c.loo_fecl3.bias_C + ' °C |');
  L.push('| LOO MAE (all methods) | ' + c.loo_all_methods.MAE_C + ' °C (n=' + c.loo_all_methods.n + ') |');
  L.push('| Full-sample fit (FeCl₃) | slope ' + c.full_sample_fit_fecl3.slope + ', intercept ' + c.full_sample_fit_fecl3.intercept + ', R² ' + c.full_sample_fit_fecl3.r2 + ' |');
  L.push('| Published fit (pitcast.js) | slope ' + c.published_fit.slope + ', intercept ' + c.published_fit.intercept + ' |');
  L.push('| CPT records in dataset / without composition | ' + c.n_cpt_records + ' / ' + c.n_no_composition + ' |');
  L.push('');
  L.push('Largest leave-one-out misses (FeCl₃ basis):', '');
  L.push('| Alloy/code | PREN_N30 | Measured °C | LOO resid °C |', '|---|--:|--:|--:|');
  for (const w of worst) L.push('| ' + w.code + ' | ' + w.pren_n30 + ' | ' + w.measured_C + ' | ' + w.loo_resid_C + ' |');
  L.push('');

  L.push('## 2. CPT spot-check vs fully-cited CRA anchor cases', '');
  L.push('| Case | Alloy | Basis | Measured °C | Predicted (G48) °C | Δ °C |', '|---|---|---|--:|--:|--:|');
  for (const r of s.cases) L.push('| ' + r.case + ' | ' + r.alloy + ' | ' + r.basis + ' | ' + r.measured_C + ' | ' + r.predicted_G48_C + ' | ' + r.delta_C + ' |');
  L.push('');
  if (s.on_basis_MAE_C != null) L.push('**On-basis (G48/FeCl₃) MAE:** ' + s.on_basis_MAE_C + ' °C. Electrochemical-NaCl rows are shown but excluded (model is on a G48 basis; method differs systematically).');
  L.push('');

  L.push('## 3. CO₂ ensemble vs cited field/lab cases', '');
  L.push('All 5 models run per case. "In env?" = the measurement falls within the model spread');
  L.push('(min…max) — the key signal behind the honest *model-disagreement* view.', '');
  L.push('**Envelope coverage over in-scope carbon-steel cases:** ' + (q.envelope_coverage_in_scope == null ? 'n/a' : (q.envelope_coverage_in_scope * 100).toFixed(0) + '%') + ' (' + q.n_cases_in_scope_cs + ' cases).', '');
  L.push('| Case | Scope | Measured | Ensemble min…max | Spread | In env? | Best model |', '|---|---|--:|--:|--:|:-:|---|');
  for (const r of q.cases) L.push('| ' + r.case + ' | ' + r.scope + ' | ' + r.measured_mmpy + ' | ' + r.ensemble_min_mmpy + '…' + r.ensemble_max_mmpy + ' | ' + r.spread_x + '× | ' + (r.measured_in_envelope ? '✓' : '✗') + ' | ' + r.best_model + ' |');
  L.push('');
  L.push('### Per-model error over in-scope carbon-steel cases (mm/y)', '');
  L.push('| Model | MAE | RMSE | bias |', '|---|--:|--:|--:|');
  for (const m of q.per_model_error_in_scope) L.push('| ' + m.id + ' | ' + m.MAE_mmpy + ' | ' + m.RMSE_mmpy + ' | ' + m.bias_mmpy + ' |');
  L.push('');

  L.push('## 4. Coverage & honesty notes', '');
  L.push('- **CPT** is the statistically meaningful part (n=' + c.n_points_fecl3 + ' FeCl₃-basis, leave-one-out).');
  L.push('- **CO₂ is a small, indicative spot-check (n=' + q.n_cases_in_scope_cs + ' in-scope), not a definitive validation.** Two cited cases are deliberately shown as *out of model scope*: a 13Cr CRA (passivates) and a top-of-line condensing case (not a bulk-flowline regime). A bulk carbon-steel model getting these "wrong" is correct behaviour.');
  L.push('- **Growth path (human-gated):** expanding to 150–300 cited measured cases across CO₂/CPT/sour is the planned next step (see `PLAN-differentiation.md`, move #1). New cases must be cited and traceable; none are to be invented.');
  return L.join('\n');
}
