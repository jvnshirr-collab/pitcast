#!/usr/bin/env node
/* test-b31g.js — oracle + behavioural tests for the B31G corroded-pipe engine.
 *
 * Headline oracle: ASME B31G-2012 Appendix B, Example 1 (adapted) — the worked
 * verification case documented in b31g.js itself. No fabricated data; every
 * expected number traces to ASME B31G-2012 / Kiefner & Vieth 1989 / Folias 1965.
 *
 *   Pipe:  24" OD x 0.281" WT API 5L X52  ->  D=609.6, t=7.137, SMYS=359 (mm/MPa)
 *   Flaw:  L=10" (254 mm), d=0.1" (2.54 mm)
 *   z = L^2/(D t) = 14.83 (short);  d/t = 0.3559
 *   B31G:     M = 3.586,  sigma_f ~ 322.5 MPa,  P_f ~ 75.5 bar,  P_safe ~ 54.3 bar
 *   Mod-B31G: M = 3.092,  sigma_f ~ 330.9 MPa,  P_f ~ 77.5 bar,  P_safe ~ 55.7 bar
 *
 *   (NB: an earlier b31g.js comment quoted Mod-B31G M ~ 3.156 — an arithmetic typo;
 *    the code computes 3.092 from the Kiefner z<=50 polynomial, which is correct.)
 *
 *   node benchmark/test-b31g.js   (exits non-zero on any failure; gates deploys)
 */
'use strict';
const path = require('path');
const B31G = require(path.join(__dirname, '..', 'b31g.js'));

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.error('  ✗ ' + msg); } }
function near(a, b, tol, msg) { ok(Math.abs(a - b) <= tol, msg + ' (got ' + a + ', want ' + b + ' ±' + tol + ')'); }

// geometry of the worked case
const D = 609.6, t = 7.137, SMYS = 359, L = 254, d = 2.54;

// ── Folias bulging factor M (Folias 1965 / Kiefner) ──────────────────────────
near(B31G.foliasM(L, D, t, 'b31g'), 3.586, 0.01, 'Folias M (B31G) = sqrt(1+0.8z) = 3.586');
near(B31G.foliasM(L, D, t, 'modb31g'), 3.092, 0.02, 'Folias M (Mod-B31G, z<=50 polynomial) = 3.092');

// ── original ASME B31G (2/3 dL parabolic) ────────────────────────────────────
const b = B31G.failurePressure({ D, t, SMYS, L, d, method: 'b31g' });
near(b.z, 14.83, 0.05, 'z = L^2/(D t) = 14.83');
near(b.depthRatio, 0.3559, 0.001, 'd/t = 0.3559');
near(b.M, 3.586, 0.01, 'B31G M carried in result');
near(b.sigma_f_MPa, 322.5, 2.0, 'B31G flow-limited sigma_f ~ 322.5 MPa');
near(b.P_f_bar, 75.5, 1.0, 'B31G P_f ~ 75.5 bar');
near(b.P_safe_bar, 54.3, 1.0, 'B31G P_safe ~ 54.3 bar (SF 1.39)');
ok(b.regime.indexOf('short') >= 0, 'B31G regime = short (z<=20)');

// ── Modified B31G (Kiefner 0.85 dL, +10 ksi flow stress) ─────────────────────
const m = B31G.failurePressure({ D, t, SMYS, L, d, method: 'modb31g' });
near(m.M, 3.092, 0.02, 'Mod-B31G M = 3.092');
near(m.sigma_f_MPa, 330.9, 2.0, 'Mod-B31G sigma_f ~ 330.9 MPa');
near(m.P_f_bar, 77.5, 1.0, 'Mod-B31G P_f ~ 77.5 bar');
near(m.P_safe_bar, 55.7, 1.0, 'Mod-B31G P_safe ~ 55.7 bar');

// ── internal consistency (must hold exactly) ─────────────────────────────────
near(b.P_f_MPa, 2 * b.sigma_f_MPa * t / D, 1e-6, 'Barlow thin-shell: P_f = 2 sigma_f t / D');
near(b.P_safe_bar, b.P_f_bar / 1.39, 1e-6, 'P_safe = P_f / SF(1.39)');
near(b.P_f_bar, b.P_f_MPa * 10, 1e-9, 'pressure bar = MPa x 10');

// ── through-wall guard ───────────────────────────────────────────────────────
const tw = B31G.failurePressure({ D, t, SMYS, L, d: t, method: 'modb31g' });
ok(tw.throughWall === true && tw.P_f_bar === 0, 'd>=t -> through-wall, P_f = 0');

// ── monotonicity: deeper defect must reduce safe pressure ────────────────────
const shallow = B31G.failurePressure({ D, t, SMYS, L, d: 1.0, method: 'modb31g' });
const deep    = B31G.failurePressure({ D, t, SMYS, L, d: 5.0, method: 'modb31g' });
ok(deep.P_safe_bar < shallow.P_safe_bar, 'deeper defect -> lower P_safe');

// ── classify bands (B31G §3.6 / API 1163 ILI guidance) ───────────────────────
ok(B31G.classify(100, 50, 0.85, false).status === 'IMMEDIATE', 'd/t>=80% -> IMMEDIATE');
ok(B31G.classify(0,   0,  0.50, true ).status === 'IMMEDIATE', 'through-wall -> IMMEDIATE');
ok(B31G.classify(40,  50, 0.30, false).status === 'REPAIR',    'P_safe<MAOP -> REPAIR');
ok(B31G.classify(80,  50, 0.60, false).status === 'MONITOR',   '50-80% wall (P_safe>=MAOP) -> MONITOR');
ok(B31G.classify(80,  50, 0.20, false).status === 'PASS',      '<50% wall, clears MAOP -> PASS');

// ── allowableDepth round-trips: P_safe(at allowable depth) ~ MAOP ────────────
const MAOP = 50;
const dAllow = B31G.allowableDepth({ D, t, SMYS, L, MAOP_bar: MAOP, method: 'modb31g' });
ok(dAllow != null && dAllow > 0 && dAllow < t, 'allowableDepth lies in (0, t)');
const atAllow = B31G.failurePressure({ D, t, SMYS, L, d: dAllow, method: 'modb31g' });
near(atAllow.P_safe_bar, MAOP, 0.5, 'P_safe at allowableDepth ~ MAOP (binary-search inverse)');

// ── Mod-B31G long-defect branch (z>50 uses linear M = 0.032 z + 3.3) ─────────
const long = B31G.failurePressure({ D, t, SMYS, L: 600, d, method: 'modb31g' });
ok(long.z > 50 && long.regime.indexOf('z>50') >= 0, 'Mod-B31G long-defect branch (z>50)');
near(long.M, 0.032 * long.z + 3.3, 0.01, 'Mod-B31G long M = 0.032 z + 3.3');

console.log((fail ? '✗ ' + fail + ' FAILED, ' : '') + '✓ ' + pass + ' passed (B31G oracle vs ASME B31G-2012 App. B Ex. 1)');
process.exit(fail ? 1 : 0);
