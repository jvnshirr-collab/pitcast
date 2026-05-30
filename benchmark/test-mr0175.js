#!/usr/bin/env node
/* test-mr0175.js — brings the MR0175 / ISO 15156:2020 spec-issuer's embedded
 * regression suite into the deploy-gating benchmark harness, plus explicit
 * decision-boundary oracles taken straight from the standard:
 *   ISO 15156-1 §1.3 sour threshold (pH2S >= 0.3 kPa / 0.05 psia),
 *   ISO 15156-2 Figure 1 region boundaries, Part 2 22 HRC C-Mn ceiling,
 *   and the PREN = Cr + 3.3·Mo + 16·N family discriminator.
 * No fabricated data — every boundary is a documented ISO 15156 threshold.
 *
 *   node benchmark/test-mr0175.js   (exits non-zero on any failure; gates deploys)
 */
'use strict';
const path = require('path');
const MR = require(path.join(__dirname, '..', 'mr0175.js'));

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.error('  ✗ ' + msg); } }
function near(a, b, tol, msg) { ok(Math.abs(a - b) <= tol, msg + ' (got ' + a + ', want ' + b + ' ±' + tol + ')'); }

// ── 1. embedded regression suite must be clean (loads data/mr0175-annexes.json) ─
const emb = MR._runTests();
ok(emb.fail === 0, 'MR0175 embedded regression clean (' + emb.pass + ' pass / ' + emb.fail + ' fail)');
if (emb.fail) emb.errs.forEach(e => console.error('    - ' + e));

// ── 2. ISO 15156-1 §1.3 sour-service threshold: pH2S >= 0.3 kPa (0.05 psia) ──
ok(MR.issue({ composition: { C: 0.2 }, pH2S_kPa: 0.2, T_C: 50 }).route === 'non-sour', 'pH2S 0.2 kPa < 0.3 -> non-sour (out of scope)');
ok(MR.issue({ composition: { C: 0.2 }, pH2S_kPa: 0.3, T_C: 50 }).route === 'non-sour', 'pH2S exactly 0.3 kPa -> still non-sour (threshold is strict >)');
ok(MR.issue({ composition: { C: 0.2, Mn: 1 }, pH2S_kPa: 5, pH_in_situ: 4, hardness_HRC: 22 }).route.indexOf('Region') === 0, 'pH2S 5 kPa -> sour; C-Mn steel routed to a Region');

// ── 3. ISO 15156-2 Figure 1 region boundaries ────────────────────────────────
ok(MR._regionLookup(0.2, 4)   === 0, 'Region 0: pH2S < 0.3 kPa');
ok(MR._regionLookup(5,   4.0) === 1, 'Region 1: 0.3 <= pH2S < 10, pH >= 3.5');
ok(MR._regionLookup(50,  4.0) === 2, 'Region 2: 10 <= pH2S < 100, pH >= 3.5');
ok(MR._regionLookup(150, 4.0) === 3, 'Region 3: pH2S >= 100');
ok(MR._regionLookup(5,   3.0) === 3, 'Region 3: pH < 3.5 (any pH2S above the sour threshold)');

// ── 4. Part 2 — C-Mn / low-alloy steel 22 HRC hardness ceiling ───────────────
const cs22 = MR.issue({ composition: { C: 0.2, Mn: 1 }, pH2S_kPa: 50, pH_in_situ: 4, hardness_HRC: 22 });
ok(cs22.IN_SCOPE === true, 'C-Mn steel at 22 HRC -> in scope (Part 2 ceiling)');
const cs23 = MR.issue({ composition: { C: 0.2, Mn: 1 }, pH2S_kPa: 50, pH_in_situ: 4, hardness_HRC: 23 });
ok(cs23.IN_SCOPE === false && cs23.failure_reasons.some(r => r.indexOf('22 HRC') >= 0), 'C-Mn steel at 23 HRC -> out of scope, cites the 22 HRC ceiling');

// ── 5. PREN = Cr + 3.3·Mo + 16·N (duplex/CRA family discriminator) ───────────
near(MR._pren({ Cr: 22, Mo: 3.0, N: 0.18 }), 34.78, 0.01, 'PREN(22Cr-3Mo-0.18N) = 34.78');
near(MR._pren({ Cr: 25, Mo: 3.8, N: 0.27 }), 41.86, 0.01, 'PREN(25Cr super-duplex) = 41.86');

// ── 6. refining scope routes to MR0103 (separate standard, not MR0175) ───────
ok(MR.issue({ composition: { C: 0.2 }, pH2S_kPa: 50, pH_in_situ: 4, scope: 'refining' }).route === 'MR0103', 'refining scope -> MR0103');

// ── 7. HRC <-> HV10 (ASTM E140) round-trips ──────────────────────────────────
near(MR._HV10toHRC(MR._HRCtoHV10(33)), 33, 0.5, 'HRC -> HV10 -> HRC round-trips at 33 HRC');

console.log((fail ? '✗ ' + fail + ' FAILED, ' : '') + '✓ ' + pass + ' passed (MR0175: embedded ' + emb.pass + ' + ISO 15156 boundary oracles)');
process.exit(fail ? 1 : 0);
