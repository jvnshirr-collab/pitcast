#!/usr/bin/env node
/* test-co2.js — oracle + fidelity tests for the CO2 corrosion ensemble (co2.js).
 *
 * Every expected number is hand-derived from the published model equations — no
 * fabricated or fitted values:
 *   De Waard & Milliams, Corrosion 31 (1975) 177      — classical nomogram.
 *   De Waard, Lotz & Dugstad, NACE Corrosion/95 P.128 — fugacity coefficient.
 *   NORSOK M-506:2017 Annex A                          — K_t temperature table.
 *   Crolet & Bonis, Corrosion 47 (1991) 351            — in-situ pH.
 *
 * Locks in the P4 fugacity-coefficient fix (phi applied across all pressures,
 * capped at 250 bar, phi<=1) so it cannot silently regress.
 *
 *   node benchmark/test-co2.js   (exits non-zero on any failure; gates deploys)
 */
'use strict';
const path = require('path');
const CO2 = require(path.join(__dirname, '..', 'co2.js'));

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.error('  ✗ ' + msg); } }
function near(a, b, tol, msg) { ok(Math.abs(a - b) <= tol, msg + ' (got ' + a + ', want ' + b + ' ±' + tol + ')'); }

// ── De Waard 1995 fugacity coefficient  phi = f_CO2 / pCO2  (Paper 128) ──────
//   log10(phi) = (0.0031 - 1.4/T_K)*P ,  P capped at 250 bar,  phi <= 1.
near(CO2.fugacity_CO2(1, 60) / 1, 0.997, 0.003, 'phi(1 bar, 60C) ~ 0.997 (near-ideal at low P)');
near(CO2.fugacity_CO2(100, 60) / 100, 0.776, 0.005, 'phi(100 bar, 60C) ~ 0.776');
near(CO2.fugacity_CO2(250, 60) / 250, 0.530, 0.005, 'phi(250 bar, 60C) ~ 0.530');
const phi250 = CO2.fugacity_CO2(250, 60) / 250, phi300 = CO2.fugacity_CO2(300, 60) / 300;
ok(Math.abs(phi300 - phi250) < 1e-6, 'phi exponent capped at 250 bar (phi(300)==phi(250))');
const phi1 = CO2.fugacity_CO2(1, 60) / 1, phi10 = CO2.fugacity_CO2(10, 60) / 10;
ok(phi1 <= 1.0001 && phi10 < phi1, 'phi <= 1 and strictly decreasing with pressure');

// ── De Waard 1975 classical nomogram  log10 CR = 5.8 - 1710/T_K + 0.67 log10(pCO2) ─
near(CO2.deWaard1975(60, 1), 4.65, 0.05, 'DWM-1975(60C, 1 bar) ~ 4.65 mm/y');
near(CO2.deWaard1975(20, 1), 0.93, 0.03, 'DWM-1975(20C, 1 bar) ~ 0.93 mm/y');
near(CO2.deWaard1975(60, 10), 21.7, 0.4, 'DWM-1975(60C, 10 bar) ~ 21.7 mm/y (+0.67 decade)');

// ── NORSOK M-506 K_t temperature table + linear interpolation (M-506:2017) ───
const nT = function (T) { return CO2.norsokM506({ T_C: T, pCO2_bar: 1, u_m_s: 1, d_pipe_m: 0.1, pH: 4 }).K_T; };
near(nT(60), 10.695, 0.01, 'NORSOK K_t(60C) = 10.695 (table value)');
near(nT(50), 9.811, 0.02, 'NORSOK K_t(50C) = 9.811 (interp 40-60)');
near(nT(20), 4.762, 0.01, 'NORSOK K_t(20C) = 4.762 (table value)');

// ── Crolet-Bonis in-situ pH for CO2-saturated water (Corrosion 47:351) ───────
near(CO2.co2InSituPH({ pCO2_bar: 1, T_C: 25 }).pH_in_situ, 3.88, 0.12, 'in-situ pH (1 bar, 25C, no buffer) ~ 3.9');
ok(CO2.co2InSituPH({ pCO2_bar: 10, T_C: 25 }).pH_in_situ < CO2.co2InSituPH({ pCO2_bar: 1, T_C: 25 }).pH_in_situ,
   'higher pCO2 -> lower in-situ pH');

// ── ensemble assess() contract (the disagreement view + UQ schema) ───────────
const a = CO2.assess({ T: 60, pCO2: 5, velocity: 1, pipeID: 0.1, fe2: 10, pH: 4.0 });
ok(a.models.length === 5, 'assess() returns all 5 models');
ok(a.crMax >= a.crMin && a.crMin > 0, 'crMax >= crMin > 0');
ok(a.spread > 1, 'ensemble shows genuine model disagreement (spread > 1)');
ok(typeof a.verdict === 'string' && a.verdict.length > 0, 'verdict band present');
ok(a.uq && a.uq.models && a.uq.models.length === 5, 'standard UQ schema present (5 models)');

// ── validated model-accuracy guidance (P4 best-in-class differentiator) ──────
const rec = CO2.recommendModel({ T_C: 60, u_m_s: 1 });
ok(rec.recommended === 'DWM-1995', 'recommendModel() picks the validated best-fit (DWM-1995)');
ok(rec.ranked[0] === 'DWM-1995' && rec.ranked.length === 5, 'ranking lists all 5 models, best MAE first');
ok(CO2.MODEL_VALIDATION.perModel['DWM-1995'].MAE < CO2.MODEL_VALIDATION.perModel['NORSOK'].MAE, 'validated ordering: DWM-1995 MAE < NORSOK MAE');
ok(/spread/i.test(rec.caveat), 'recommendation carries the honest ensemble-spread caveat');
ok(a.recommendation && a.recommendation.recommended === 'DWM-1995', 'assess() surfaces the recommendation');
ok(a.models[0].validation && typeof a.models[0].validation.MAE === 'number', 'each model annotated with its validated accuracy');

console.log(fail
  ? ('  CO2 suite: ' + fail + ' FAILED (' + pass + ' passed)')
  : ('✓ ' + pass + ' passed (CO2 ensemble: De Waard 1975/1995 fugacity, NORSOK M-506 K_t, Crolet-Bonis pH)'));
process.exit(fail ? 1 : 0);
