#!/usr/bin/env node
/* test-ffs.js — brings the FFS engine's embedded regression suite into the
 * deploy-gating benchmark harness, and adds explicit oracle / boundary checks
 * for the API 579-1/ASME FFS-1 (2021) corrosion Parts (4, 5, 6, 7).
 *
 * No fabricated data: every threshold is the standard's published acceptance
 * value (NACE TM0284 CLR/CTR/CSR; API 579 Part 6 pit-type RSF bands; the Part 5
 * Folias Mt polynomial; the Part 5 worked example traced to FitnessForService.jl).
 *
 *   node benchmark/test-ffs.js   (exits non-zero on any failure; gates deploys)
 */
'use strict';
const path = require('path');
const FFS = require(path.join(__dirname, '..', 'ffs.js'));

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.error('  ✗ ' + msg); } }
function near(a, b, tol, msg) { ok(Math.abs(a - b) <= tol, msg + ' (got ' + a + ', want ' + b + ' ±' + tol + ')'); }

// ── 1. the engine's own embedded regression suite must be clean ──────────────
const emb = FFS._runTests();
ok(emb.fail === 0, 'FFS embedded regression clean (' + emb.pass + ' pass / ' + emb.fail + ' fail)');
if (emb.fail) emb.errs.forEach(e => console.error('    - ' + e));

// ── 2. Folias Mt(λ) — API 579 Part 5 polynomial (Annex 5A) ───────────────────
near(FFS.foliasMt(2.0), 1.62, 0.05, 'Mt(λ=2.0) ~ 1.62 (cf. B31G Folias ~1.58 at equal length)');
ok(FFS.foliasMt(0.01) >= 1 && FFS.foliasMt(0.01) < 1.02, 'Mt(λ->0) -> 1 (no bulging)');
ok(FFS.foliasMt(4) > FFS.foliasMt(2) && FFS.foliasMt(2) > FFS.foliasMt(1), 'Mt monotone increasing in λ');
near(FFS.foliasMt(8.001), FFS.foliasMt(8), 0.05, 'Mt continuous across the λ=8 branch point');

// ── 3. Part 5 LTA — RSF physics + monotonicity ───────────────────────────────
const base = { t_nom_mm: 31.75, LOSS_mm: 2.54, FCA_mm: 3.175, s_axial_mm: 250, D_inside_mm: 2438.4, MAWP_design_bar: 21 };
const lta = FFS.part5_LTA_L1(Object.assign({}, base, { tmm_mm: 17.78 }));
ok(lta.RSF > 0 && lta.RSF <= 1, 'Part 5 RSF in (0,1]');
const shallow = FFS.part5_LTA_L1(Object.assign({}, base, { tmm_mm: 22.0 }));
const deep    = FFS.part5_LTA_L1(Object.assign({}, base, { tmm_mm: 14.0 }));
ok(deep.RSF < shallow.RSF, 'deeper LTA (lower tmm) -> lower RSF');
const shortFlaw = FFS.part5_LTA_L1(Object.assign({}, base, { tmm_mm: 17.78, s_axial_mm: 100 }));
const longFlaw  = FFS.part5_LTA_L1(Object.assign({}, base, { tmm_mm: 17.78, s_axial_mm: 600 }));
ok(longFlaw.RSF < shortFlaw.RSF, 'longer flaw (larger λ -> larger Mt) -> lower RSF');
// MAWP re-rate when failing: MAWP_r = MAWP_design · RSF/RSFa  (Eq 2.2)
if (lta.RSF < lta.RSFa) near(lta.MAWP_reduced_bar, 21 * lta.RSF / lta.RSFa, 0.01, 'Part 5 MAWP re-rate = MAWP·RSF/RSFa (Eq 2.2)');

// ── 4. Part 6 pitting — RSF bands + type boundaries (ASTM G46 / API 579 Part 6) ──
ok(FFS.part6_pitting_L1({ max_pit_depth_mm: 3,  pit_density_per_m2: 5000,   t_nom_mm: 12, MAWP_design_bar: 20 }).RSF === 1.00, 'd/t=0.25, low density -> Type 1, RSF=1.00');
ok(FFS.part6_pitting_L1({ max_pit_depth_mm: 6,  pit_density_per_m2: 50000,  t_nom_mm: 12, MAWP_design_bar: 20 }).RSF === 0.95, 'd/t=0.50 -> Type 2, RSF=0.95');
ok(FFS.part6_pitting_L1({ max_pit_depth_mm: 9,  pit_density_per_m2: 500000, t_nom_mm: 12, MAWP_design_bar: 20 }).RSF === 0.85, 'd/t=0.75 -> Type 3, RSF=0.85');
ok(FFS.part6_pitting_L1({ max_pit_depth_mm: 10, pit_density_per_m2: 2e6,    t_nom_mm: 12, MAWP_design_bar: 20 }).RSF === null, 'd/t>0.75 / dense -> Type 4 (escalate, RSF=null)');

// ── 5. Part 7 HIC — NACE TM0284 acceptance boundaries (CLR<=15, CTR<=5, CSR<=2) ──
ok(FFS.part7_HIC_L1({ CLR_pct: 15,   CTR_pct: 5,   CSR_pct: 2   }).passes === true,  'HIC exactly at NACE TM0284 limits -> PASS');
ok(FFS.part7_HIC_L1({ CLR_pct: 15.1, CTR_pct: 5,   CSR_pct: 2   }).passes === false, 'CLR 15.1% > 15% -> FAIL');
ok(FFS.part7_HIC_L1({ CLR_pct: 10,   CTR_pct: 5.1, CSR_pct: 2   }).passes === false, 'CTR 5.1% > 5% -> FAIL');
ok(FFS.part7_HIC_L1({ CLR_pct: 10,   CTR_pct: 3,   CSR_pct: 2.1 }).passes === false, 'CSR 2.1% > 2% -> FAIL');
ok(FFS.part7_HIC_L1({ CLR_pct: 5, CTR_pct: 2, CSR_pct: 1, has_surface_breaking_crack: true }).passes === false, 'surface-breaking crack -> FAIL regardless of ratios');

console.log((fail ? '✗ ' + fail + ' FAILED, ' : '') + '✓ ' + pass + ' passed (FFS: embedded ' + emb.pass + ' + boundary oracles vs API 579 / NACE TM0284)');
process.exit(fail ? 1 : 0);
