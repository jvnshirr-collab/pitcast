#!/usr/bin/env node
/* test-uq.js — unit tests for the shared UQ framework (uq.js) + the CO2
 * standard-schema hook. Pure logic; exits non-zero on any failure so it can
 * gate deploys.   Run:  node benchmark/test-uq.js
 */
'use strict';
const path = require('path');
const UQ = require(path.join(__dirname, '..', 'uq.js'));
const CO2 = require(path.join(__dirname, '..', 'co2.js'));

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.error('  ✗ ' + msg); } }
function near(a, b, tol, msg) { ok(Math.abs(a - b) <= tol, msg + ' (got ' + a + ', want ' + b + ' ±' + tol + ')'); }

// ── ensemble ────────────────────────────────────────────────────────────────
const e = UQ.ensemble([1, 2, 3, 4]);
near(e.min, 1, 1e-9, 'ensemble min');
near(e.max, 4, 1e-9, 'ensemble max');
near(e.median, 2.5, 1e-9, 'ensemble median');
near(e.mean, 2.5, 1e-9, 'ensemble mean');
near(e.spread.ratio, 4, 1e-9, 'ensemble ratio = max/min');
ok(e.spread.verdict === 'diverge', 'ensemble verdict diverge');

const eFlat = UQ.ensemble([{ value: 2 }, { value: 2 }, { value: 2 }]);
ok(eFlat.spread.verdict === 'agree', 'flat ensemble agree');
near(eFlat.spread.rel, 0, 1e-9, 'flat relative spread 0');

const eCr = UQ.ensemble([{ cr: 1 }, { cr: 2 }]); // tolerate engine-native .cr key
near(eCr.max, 2, 1e-9, 'ensemble reads .cr key');

// ── spreadVerdict thresholds (must match CO2 UI: >=3 => diverge) ─────────────
ok(UQ.spreadVerdict(1.2) === 'agree', 'verdict 1.2 -> agree');
ok(UQ.spreadVerdict(1.5) === 'caution', 'verdict 1.5 boundary -> caution');
ok(UQ.spreadVerdict(2) === 'caution', 'verdict 2 -> caution');
ok(UQ.spreadVerdict(3) === 'diverge', 'verdict 3 boundary -> diverge');
ok(UQ.spreadVerdict(5) === 'diverge', 'verdict 5 -> diverge');

// ── tQuantile vs published Student-t table ───────────────────────────────────
near(UQ.tQuantile(0.975, 1000), 1.962, 0.01, 't .975, df=1000 (~1.96)');
near(UQ.tQuantile(0.975, 10), 2.228, 0.01, 't .975, df=10');
near(UQ.tQuantile(0.975, 2), 4.303, 0.02, 't .975, df=2');

// ── studentTInterval ─────────────────────────────────────────────────────────
const ci = UQ.studentTInterval(10, 2, 1000, 0.95);
near(ci.lo, 6.08, 0.05, 'CI lower ~6.08');
near(ci.hi, 13.92, 0.05, 'CI upper ~13.92');
const deg = UQ.studentTInterval(5, 0, 10); // sd=0 -> degenerate
ok(deg.degenerate && deg.lo === 5 && deg.hi === 5, 'degenerate interval (sd=0)');

// ── envelopeCheck ────────────────────────────────────────────────────────────
const env = UQ.envelopeCheck({ T_C: 200, pH: 5 }, { T_C: [20, 150], pH: [3.5, 6.5] });
ok(env.anyOutside === true, 'envelope anyOutside true');
ok(env.variables.find(v => v.name === 'T_C').status === 'above', 'T_C flagged above');
ok(env.variables.find(v => v.name === 'pH').status === 'within', 'pH within');
const env2 = UQ.envelopeCheck({ T_C: 60, pH: 5 }, { T_C: [20, 150], pH: [3.5, 6.5] });
ok(env2.allInEnvelope === true, 'envelope allInEnvelope when both within');

// ── integration: CO2.assess attaches the standard schema, consistent ─────────
const r = CO2.assess({ T: 60, pCO2: 5, velocity: 1, pipeID: 0.1, pH: 5 });
ok(r.uq && r.uq.schema === 'pitcast.uq/1', 'CO2.assess attaches uq schema');
near(r.uq.ensemble.min, r.crMin, 1e-6, 'uq.ensemble.min == legacy crMin');
near(r.uq.ensemble.max, r.crMax, 1e-6, 'uq.ensemble.max == legacy crMax');
near(r.uq.ensemble.spread.ratio, r.spread, 1e-6, 'uq spread.ratio == legacy spread');
ok(Array.isArray(r.uq.models) && r.uq.models.length === 5, 'uq carries 5 models');
ok(r.uq.envelope && r.uq.envelope.variables.length === 2, 'uq envelope present (T, pH)');
ok(r.uq.unit === 'mm/y', 'uq unit mm/y');

// out-of-envelope CO2 case flags correctly (T=200 C is above NORSOK validity)
const rOOE = CO2.assess({ T: 200, pCO2: 5, velocity: 1, pipeID: 0.1, pH: 5 });
ok(rOOE.uq.envelope.anyOutside === true, 'CO2 at T=200C flags out-of-envelope');

console.log((fail ? '✗ ' + fail + ' FAILED, ' : '') + '✓ ' + pass + ' passed');
process.exit(fail ? 1 : 0);
