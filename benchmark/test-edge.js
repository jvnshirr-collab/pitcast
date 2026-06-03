#!/usr/bin/env node
/* test-edge.js — adversarial EDGE-CASE / ROBUSTNESS gate for the PitCast core
 * engines (b31g.js, co2.js, pitcast.js, ffs.js, mr0175.js).
 *
 * This is NOT an accuracy oracle (the per-engine test-*.js files already pin the
 * physics against the literature). This suite asks a different, industry-readiness
 * question: do the engines DEGRADE GRACEFULLY on garbage input?
 *
 * For every adversarial input — NaN, undefined, null, negative, zero, empty
 * string, extremely large (1e12), out-of-range (d/t>1, T=-300, pH=-5), and
 * wrong-type — each engine entry point must:
 *   (a) NOT throw an uncaught exception (a throw = FAIL), and
 *   (b) NOT silently emit NaN / Infinity / a negative value in a declared
 *       CRITICAL numeric output field. A headline NaN/Inf/neg is a FAIL UNLESS
 *       the engine clearly flags the bad input (an `error` string on the result,
 *       or a documented sentinel — e.g. B31G's through-wall P_f = 0, or
 *       remainingLife's yearsToMinWT = +Infinity when CR = 0, which is a
 *       meaningful "never reaches t_min", not a silent blow-up).
 *
 * Convention matches the other benchmark/test-*.js files (vanilla Node, no deps):
 *   node benchmark/test-edge.js      (exits non-zero on any failure; gates CI)
 *
 * IMPORTANT: this file does NOT modify the engines. A case that throws or returns
 * a silent NaN is a REAL robustness bug and is left failing on purpose so CI and
 * the engineer see it.
 */
'use strict';
const path = require('path');
const B31G = require(path.join(__dirname, '..', 'b31g.js'));
const CO2 = require(path.join(__dirname, '..', 'co2.js'));
const PitCast = require(path.join(__dirname, '..', 'pitcast.js'));
const FFS = require(path.join(__dirname, '..', 'ffs.js'));
const MR = require(path.join(__dirname, '..', 'mr0175.js'));

let pass = 0, fail = 0;
const failures = [];
function ok(cond, msg) {
  if (cond) { pass++; }
  else { fail++; failures.push(msg); console.error('  ✗ ' + msg); }
}

// ── helpers ──────────────────────────────────────────────────────────────────
function isBadNum(x) { return typeof x === 'number' && !Number.isFinite(x); }
function looksFlagged(res) {
  // The engine has *explicitly* signalled it rejected the input if the result
  // is null, or an object carrying a non-empty `error` string. That is graceful
  // degradation, not a silent NaN, so such a result passes the (b) gate.
  if (res == null) return true;
  if (typeof res === 'object' && typeof res.error === 'string' && res.error.length) return true;
  return false;
}

/* runs `fn` under try/catch.
 *   label      — human-readable "engine.method(input)" tag
 *   critical   — array of property names that must be finite (and, if in
 *                `nonNeg`, >= 0) on the returned object — UNLESS the result is
 *                flagged (null / {error}).
 *   nonNeg     — subset of `critical` that must additionally be >= 0.
 *   sentinelOK — map { field: predicate } of fields allowed to hold a documented
 *                non-finite sentinel (e.g. +Infinity) when the predicate is true.
 */
function probe(label, fn, opts) {
  opts = opts || {};
  const critical = opts.critical || [];
  const nonNeg = opts.nonNeg || [];
  const sentinelOK = opts.sentinelOK || {};
  let res;
  try {
    res = fn();
  } catch (e) {
    ok(false, 'THROWS: ' + label + ' -> ' + (e && e.message ? e.message : e));
    return undefined;
  }
  // (a) survived — now (b) check critical fields, unless the engine flagged it.
  if (looksFlagged(res)) { ok(true, label); return res; }
  if (typeof res !== 'object') {
    // a bare scalar return (e.g. cptMean) — treat the value itself as critical
    if (isBadNum(res)) ok(false, 'SILENT NaN/Inf (scalar): ' + label + ' -> ' + res);
    else ok(true, label);
    return res;
  }
  let clean = true;
  for (const f of critical) {
    const val = res[f];
    if (val === undefined || val === null) continue;       // absent ≠ NaN
    if (isBadNum(val)) {
      if (sentinelOK[f] && sentinelOK[f](val, res)) continue; // documented sentinel
      ok(false, 'SILENT NaN/Inf in ' + f + ': ' + label + ' -> ' + f + '=' + val);
      clean = false;
    } else if (nonNeg.indexOf(f) >= 0 && typeof val === 'number' && val < 0) {
      ok(false, 'SILENT NEGATIVE in ' + f + ': ' + label + ' -> ' + f + '=' + val);
      clean = false;
    }
  }
  if (clean) ok(true, label);
  return res;
}

// A shared bag of adversarial scalars to fan out across numeric inputs.
const BAD = [
  ['NaN', NaN], ['undefined', undefined], ['null', null], ['negative', -5],
  ['zero', 0], ['emptyStr', ''], ['huge', 1e12], ['string', 'abc'],
  ['bool', true], ['object', {}], ['array', []]
];

console.log('— B31G ————————————————————————————————————————————————————————');
// ── B31G.failurePressure — critical headline outputs: P_f_bar, P_safe_bar,
//    sigma_f_MPa. Documented sentinel: through-wall returns P_f_bar=P_safe_bar=0
//    and M=NaN (M not headline-critical there). D/t/SMYS<=0 returns {error}.
{
  const base = { D: 609.6, t: 7.137, SMYS: 359, L: 254, d: 2.54, method: 'modb31g' };
  const crit = { critical: ['P_f_bar', 'P_safe_bar', 'sigma_f_MPa', 'P_f_MPa', 'P_safe_MPa'],
                 nonNeg:   ['P_f_bar', 'P_safe_bar', 'sigma_f_MPa', 'P_f_MPa', 'P_safe_MPa'] };
  // whole-object missing / wrong type
  probe('B31G.failurePressure(undefined)', () => B31G.failurePressure(undefined), crit);
  probe('B31G.failurePressure(null)', () => B31G.failurePressure(null), crit);
  probe('B31G.failurePressure({})', () => B31G.failurePressure({}), crit);
  probe('B31G.failurePressure("abc")', () => B31G.failurePressure('abc'), crit);
  // each geometric field individually poisoned
  for (const fld of ['D', 't', 'SMYS', 'L', 'd', 'SF']) {
    for (const [nm, bad] of BAD) {
      const o = Object.assign({}, base); o[fld] = bad;
      probe('B31G.failurePressure(' + fld + '=' + nm + ')', () => B31G.failurePressure(o), crit);
    }
  }
  // out-of-range: d > t (deeper than wall), d/t >> 1, negative depth, huge L
  probe('B31G.failurePressure(d>t)', () => B31G.failurePressure(Object.assign({}, base, { d: 99 })), crit);
  probe('B31G.failurePressure(d=t exactly)', () => B31G.failurePressure(Object.assign({}, base, { d: 7.137 })), crit);
  probe('B31G.failurePressure(negative d)', () => B31G.failurePressure(Object.assign({}, base, { d: -3 })), crit);
  probe('B31G.failurePressure(t>D nonsense geom)', () => B31G.failurePressure(Object.assign({}, base, { t: 9999 })), crit);
  probe('B31G.failurePressure(b31g long z>20)', () => B31G.failurePressure(Object.assign({}, base, { method: 'b31g', L: 1e6 })), crit);
}

// ── B31G.foliasM — must not return NaN/Inf for degenerate geometry.
for (const [nm, bad] of BAD) {
  probe('B31G.foliasM(L=' + nm + ')', () => ({ M: B31G.foliasM(bad, 609.6, 7.137, 'modb31g') }),
        { critical: ['M'], nonNeg: ['M'] });
}
probe('B31G.foliasM(D*t=0)', () => ({ M: B31G.foliasM(254, 0, 0, 'modb31g') }), { critical: ['M'] });

// ── B31G.classify — returns {status, note}; status must always be a string.
for (const [nm, bad] of BAD) {
  const r = (() => { try { return B31G.classify(bad, 50, bad, false); } catch (e) { return { __throw: e }; } })();
  if (r && r.__throw) ok(false, 'THROWS: B31G.classify(' + nm + ') -> ' + r.__throw.message);
  else ok(typeof r.status === 'string' && r.status.length > 0, 'B31G.classify(' + nm + ') -> status string');
}

// ── B31G.remainingLife — critical: yearsToMinWT, effective_CR_mmyr,
//    fractionConsumed, required_inhibitor_efficiency.
//    Documented sentinel: yearsToMinWT = +Infinity when effective CR = 0
//    (means "never reaches t_min" — a real engineering answer, not a blow-up).
{
  const base = { CR: 0.2, tNom: 12, tMin: 6, designLifeYr: 20, inhEff: 0.5 };
  const crit = {
    critical: ['yearsToMinWT', 'effective_CR_mmyr', 'fractionConsumed', 'required_inhibitor_efficiency', 'consumed_mm', 'CA_mm'],
    nonNeg:   ['effective_CR_mmyr', 'fractionConsumed', 'required_inhibitor_efficiency', 'CA_mm'],
    sentinelOK: { yearsToMinWT: (v) => v === Infinity }      // CR=0 => never reaches t_min
  };
  probe('B31G.remainingLife(undefined)', () => B31G.remainingLife(undefined || {}), crit);
  probe('B31G.remainingLife({})', () => B31G.remainingLife({}), crit);
  for (const fld of ['CR', 'tNom', 'tMin', 'designLifeYr', 'inhEff']) {
    for (const [nm, bad] of BAD) {
      const o = Object.assign({}, base); o[fld] = bad;
      probe('B31G.remainingLife(' + fld + '=' + nm + ')', () => B31G.remainingLife(o), crit);
    }
  }
  probe('B31G.remainingLife(tMin>tNom)', () => B31G.remainingLife(Object.assign({}, base, { tMin: 99 })), crit);
  probe('B31G.remainingLife(CR=0)', () => B31G.remainingLife(Object.assign({}, base, { CR: 0, inhEff: 0 })), crit);
}

// ── B31G.allowableDepth — returns a number in (0,t) or null.
{
  const base = { D: 609.6, t: 7.137, SMYS: 359, L: 254, MAOP_bar: 50, method: 'modb31g' };
  for (const fld of ['D', 't', 'SMYS', 'L', 'MAOP_bar']) {
    for (const [nm, bad] of BAD) {
      const o = Object.assign({}, base); o[fld] = bad;
      const r = (() => { try { return { v: B31G.allowableDepth(o) }; } catch (e) { return { __throw: e }; } })();
      if (r.__throw) ok(false, 'THROWS: B31G.allowableDepth(' + fld + '=' + nm + ') -> ' + r.__throw.message);
      else ok(r.v === null || (typeof r.v === 'number' && Number.isFinite(r.v)),
              'B31G.allowableDepth(' + fld + '=' + nm + ') -> null or finite (got ' + r.v + ')');
    }
  }
}

console.log('— CO2 ————————————————————————————————————————————————————————');
// ── CO2.assess — unified entry, heaviest-used. Critical headline: crMax, crMin,
//    spread. The `num()` coalescer should default non-finite inputs, so assess()
//    is expected to be robust on every poisoned scalar.
{
  const base = { T: 60, pCO2: 5, velocity: 1, pipeID: 0.1, fe2: 10, pH: 4.0, pH2S: 0 };
  const crit = { critical: ['crMax', 'crMin', 'spread'], nonNeg: ['crMax', 'crMin', 'spread'] };
  probe('CO2.assess(undefined)', () => CO2.assess(undefined), crit);
  probe('CO2.assess(null)', () => CO2.assess(null), crit);
  probe('CO2.assess({})', () => CO2.assess({}), crit);
  probe('CO2.assess("abc")', () => CO2.assess('abc'), crit);
  for (const fld of ['T', 'pCO2', 'velocity', 'pipeID', 'fe2', 'pH', 'pH2S', 'waterCut', 'glycol', 'ageH', 'bicarbonate']) {
    for (const [nm, bad] of BAD) {
      const o = Object.assign({}, base); o[fld] = bad;
      probe('CO2.assess(' + fld + '=' + nm + ')', () => CO2.assess(o), crit);
    }
  }
  // out-of-range physical chemistry
  probe('CO2.assess(T=-300C abs zero)', () => CO2.assess(Object.assign({}, base, { T: -300 })), crit);
  probe('CO2.assess(pH=-5)', () => CO2.assess(Object.assign({}, base, { pH: -5 })), crit);
  probe('CO2.assess(pH=99)', () => CO2.assess(Object.assign({}, base, { pH: 99 })), crit);
  probe('CO2.assess(pCO2=1e12)', () => CO2.assess(Object.assign({}, base, { pCO2: 1e12 })), crit);
}

// ── individual CO2 models — these take a flat opts object and do NOT all run
//    inputs through num(); critical output is CR_mmpy.
{
  const dwBase = { T_C: 60, pCO2_bar: 5, u_m_s: 1, d_pipe_m: 0.1, pH: 4.0, X_glycol: 0 };
  const crit = { critical: ['CR_mmpy'], nonNeg: ['CR_mmpy'] };
  probe('CO2.deWaard1995(undefined)', () => CO2.deWaard1995(undefined || {}), crit);
  probe('CO2.deWaard1995({})', () => CO2.deWaard1995({}), crit);
  for (const fld of ['T_C', 'pCO2_bar', 'u_m_s', 'd_pipe_m', 'pH', 'X_glycol']) {
    for (const [nm, bad] of BAD) {
      const o = Object.assign({}, dwBase); o[fld] = bad;
      probe('CO2.deWaard1995(' + fld + '=' + nm + ')', () => CO2.deWaard1995(o), crit);
    }
  }
  const nkBase = { T_C: 60, pCO2_bar: 5, u_m_s: 1, d_pipe_m: 0.1, pH: 4.0 };
  probe('CO2.norsokM506({})', () => CO2.norsokM506({}), crit);
  for (const fld of ['T_C', 'pCO2_bar', 'u_m_s', 'd_pipe_m', 'pH']) {
    for (const [nm, bad] of BAD) {
      const o = Object.assign({}, nkBase); o[fld] = bad;
      probe('CO2.norsokM506(' + fld + '=' + nm + ')', () => CO2.norsokM506(o), crit);
    }
  }
  // de Waard 1975 returns a bare number
  for (const [nm, bad] of BAD) {
    probe('CO2.deWaard1975(T=' + nm + ')', () => ({ CR_mmpy: CO2.deWaard1975(bad, 5) }), crit);
    probe('CO2.deWaard1975(pCO2=' + nm + ')', () => ({ CR_mmpy: CO2.deWaard1975(60, bad) }), crit);
  }
}

console.log('— PitCast (pitcast.js) ————————————————————————————————————————');
// ── PitCast.assess(comp, svc) — critical: cpt, overall, cost, pren, prenW,
//    ferrite. overall is a probability in [0,1]; cpt/cost/pren must be finite.
{
  const comp = { Cr: 22, Ni: 5.7, Mo: 3.1, N: 0.17, Mn: 1.5, C: 0.02 };
  const svc = { T: 60, Cl: 50000, pH2S: 0, pH: 4.5, stress: 0.5, HV: 250 };
  const crit = { critical: ['cpt', 'overall', 'cost', 'pren', 'prenW', 'ferrite', 'cptG48', 'cptSE'],
                 nonNeg: ['overall', 'cost', 'cptSE'] };
  // poisoned service object
  for (const fld of ['T', 'Cl', 'pH2S', 'pH', 'stress', 'HV', 'ageT', 'aget']) {
    for (const [nm, bad] of BAD) {
      const s = Object.assign({}, svc); s[fld] = bad;
      probe('PitCast.assess(svc.' + fld + '=' + nm + ')', () => PitCast.assess(comp, s), crit);
    }
  }
  // poisoned composition (a single element key set to garbage)
  for (const el of ['Cr', 'Mo', 'N', 'Ni']) {
    for (const [nm, bad] of BAD) {
      const c = Object.assign({}, comp); c[el] = bad;
      probe('PitCast.assess(comp.' + el + '=' + nm + ')', () => PitCast.assess(c, svc), crit);
    }
  }
  // whole-object missing / empty
  probe('PitCast.assess({},{})', () => PitCast.assess({}, {}), crit);
  probe('PitCast.assess(null,svc)', () => PitCast.assess(null, svc), crit);
  probe('PitCast.assess(comp,null)', () => PitCast.assess(comp, null), crit);
  probe('PitCast.assess(undefined,undefined)', () => PitCast.assess(undefined, undefined), crit);
  // out-of-range service
  probe('PitCast.assess(T=-300)', () => PitCast.assess(comp, Object.assign({}, svc, { T: -300 })), crit);
  probe('PitCast.assess(T=1e12)', () => PitCast.assess(comp, Object.assign({}, svc, { T: 1e12 })), crit);
  probe('PitCast.assess(Cl=1e12)', () => PitCast.assess(comp, Object.assign({}, svc, { Cl: 1e12 })), crit);
  probe('PitCast.assess(pH=-5)', () => PitCast.assess(comp, Object.assign({}, svc, { pH: -5, pH2S: 5, HV: 250 })), crit);
  probe('PitCast.assess(empty comp)', () => PitCast.assess({}, svc), crit);
}

// ── PitCast scalar property functions — must each return finite.
{
  const crit = { critical: ['v'] };
  for (const [nm, bad] of BAD) {
    probe('PitCast.cptMean(comp.Cr=' + nm + ')', () => ({ v: PitCast.cptMean({ Cr: bad, Mo: 3, N: 0.2 }) }), crit);
    probe('PitCast.prenN30(comp.Cr=' + nm + ')', () => ({ v: PitCast.prenN30({ Cr: bad, Mo: 3, N: 0.2 }) }), crit);
    probe('PitCast.cptSE(comp.Cr=' + nm + ')', () => ({ v: PitCast.cptSE({ Cr: bad, Mo: 3, N: 0.2 }) }), crit);
    probe('PitCast.ferritePct(comp.Cr=' + nm + ')', () => ({ v: PitCast.ferritePct({ Cr: bad, Ni: 8 }) }), crit);
    probe('PitCast.relativeCost(comp.Cr=' + nm + ')', () => ({ v: PitCast.relativeCost({ Cr: bad, Ni: 8, Mo: 2 }) }), crit);
  }
  probe('PitCast.cptMean(null)', () => ({ v: (() => { const r = PitCast.cptMean(null); return r; })() }), crit);
  probe('PitCast.inferFamily(null)', () => {
    const f = PitCast.inferFamily(null);
    return (typeof f === 'string') ? { ok: 1 } : { v: NaN };
  }, { critical: ['v'] });
}

// ── PitCast.selectAlloys / envelope / complianceDiff — integration layers.
{
  const svc = { T: 60, Cl: 50000, pH2S: 0, pH: 4.5, stress: 0.5, HV: 250 };
  // selectAlloys returns { recommended, ranked, ... }; recommended may be null.
  for (const [nm, bad] of [['NaN T', { T: NaN }], ['neg T', { T: -300 }], ['empty', {}], ['huge Cl', { Cl: 1e12 }]]) {
    const r = (() => { try { return { v: PitCast.selectAlloys(Object.assign({}, svc, bad)) }; } catch (e) { return { __throw: e }; } })();
    if (r.__throw) ok(false, 'THROWS: PitCast.selectAlloys(' + nm + ') -> ' + r.__throw.message);
    else ok(r.v && Array.isArray(r.v.ranked), 'PitCast.selectAlloys(' + nm + ') -> ranked array');
  }
  // complianceDiff returns { rows, overall, ... }
  for (const [nm, bad] of [['NaN T', { T: NaN }], ['neg pH', { pH: -5, pH2S: 5 }], ['empty', {}]]) {
    probe('PitCast.complianceDiff(' + nm + ')',
          () => PitCast.complianceDiff({ Cr: 22, Ni: 5.7, Mo: 3.1, N: 0.17 }, Object.assign({}, svc, bad)),
          { critical: ['overall'], nonNeg: ['overall'] });
  }
}

console.log('— FFS (ffs.js) ————————————————————————————————————————————————');
// ── FFS.part5_LTA_L1 — critical: RSF, MAWP_reduced_bar, Rt, lambda, Mt.
//    Guards tmm/t_nom/s/D>0 with {error}; tc<=0 with {error}.
{
  const base = { tmm_mm: 17.78, t_nom_mm: 31.75, LOSS_mm: 2.54, FCA_mm: 3.175,
                 s_axial_mm: 250, D_inside_mm: 2438.4, MAWP_design_bar: 21 };
  const crit = { critical: ['RSF', 'MAWP_reduced_bar', 'Rt', 'lambda', 'Mt'],
                 nonNeg: ['RSF', 'MAWP_reduced_bar', 'lambda', 'Mt'] };
  probe('FFS.part5_LTA_L1({})', () => FFS.part5_LTA_L1({}), crit);
  probe('FFS.part5_LTA_L1(undefined)', () => FFS.part5_LTA_L1(undefined || {}), crit);
  for (const fld of ['tmm_mm', 't_nom_mm', 'LOSS_mm', 'FCA_mm', 's_axial_mm', 'D_inside_mm', 'MAWP_design_bar', 'RSFa']) {
    for (const [nm, bad] of BAD) {
      const o = Object.assign({}, base); o[fld] = bad;
      probe('FFS.part5_LTA_L1(' + fld + '=' + nm + ')', () => FFS.part5_LTA_L1(o), crit);
    }
  }
  // out-of-range: total loss exceeds wall; tmm > t_nom (impossible reading)
  probe('FFS.part5_LTA_L1(LOSS>wall)', () => FFS.part5_LTA_L1(Object.assign({}, base, { LOSS_mm: 999 })), crit);
  probe('FFS.part5_LTA_L1(tmm>t_nom)', () => FFS.part5_LTA_L1(Object.assign({}, base, { tmm_mm: 999 })), crit);
  probe('FFS.part5_LTA_L1(huge s)', () => FFS.part5_LTA_L1(Object.assign({}, base, { s_axial_mm: 1e12 })), crit);
}

// ── FFS.foliasMt — must be finite & >=1 for any lambda.
for (const [nm, bad] of BAD) {
  probe('FFS.foliasMt(' + nm + ')', () => ({ Mt: FFS.foliasMt(bad) }), { critical: ['Mt'] });
}
probe('FFS.foliasMt(1e12)', () => ({ Mt: FFS.foliasMt(1e12) }), { critical: ['Mt'], nonNeg: ['Mt'] });
probe('FFS.foliasMt(-5)', () => ({ Mt: FFS.foliasMt(-5) }), { critical: ['Mt'], nonNeg: ['Mt'] });

// ── FFS.part4_Level1 — critical: COV, mean_mm, std_mm (when >=15 readings).
{
  const crit = { critical: ['COV', 'mean_mm', 'std_mm', 'tmm_mm'], nonNeg: ['mean_mm', 'std_mm'] };
  probe('FFS.part4_Level1({})', () => FFS.part4_Level1({}), crit);
  probe('FFS.part4_Level1(undefined)', () => FFS.part4_Level1(undefined || {}), crit);
  probe('FFS.part4_Level1(<15 readings)', () => FFS.part4_Level1({ readings_mm: [10, 10, 10], t_min_mm: 8 }), crit);
  // 15 readings, but some are garbage values
  probe('FFS.part4_Level1(NaN reading)',
        () => FFS.part4_Level1({ readings_mm: [10, 10, NaN, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10], t_min_mm: 8 }), crit);
  probe('FFS.part4_Level1(negative readings)',
        () => FFS.part4_Level1({ readings_mm: new Array(15).fill(-5), t_min_mm: 8 }), crit);
  probe('FFS.part4_Level1(all zero)',
        () => FFS.part4_Level1({ readings_mm: new Array(15).fill(0), t_min_mm: 8 }), crit);
  probe('FFS.part4_Level1(string in readings)',
        () => FFS.part4_Level1({ readings_mm: ['a', 'b', 'c', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], t_min_mm: 8 }), crit);
}

// ── FFS.part6_pitting_L1 / L2 — critical: RSF (may be null=escalate), depth_ratio.
{
  const base = { max_pit_depth_mm: 4, pit_density_per_m2: 50000, t_nom_mm: 12, MAWP_design_bar: 20 };
  const crit = { critical: ['depth_ratio', 'density_per_mm2', 'MAWP_reduced_bar'], nonNeg: ['depth_ratio', 'density_per_mm2'] };
  probe('FFS.part6_pitting_L1({})', () => FFS.part6_pitting_L1({}), crit);
  for (const fld of ['max_pit_depth_mm', 'pit_density_per_m2', 't_nom_mm', 'MAWP_design_bar']) {
    for (const [nm, bad] of BAD) {
      const o = Object.assign({}, base); o[fld] = bad;
      probe('FFS.part6_pitting_L1(' + fld + '=' + nm + ')', () => FFS.part6_pitting_L1(o), crit);
    }
  }
  probe('FFS.part6_pitting_L1(depth>t_nom)', () => FFS.part6_pitting_L1(Object.assign({}, base, { max_pit_depth_mm: 999 })), crit);

  const l2base = { max_pit_depth_mm: 3, pit_diameter_mm: 2, pit_spacing_mm: 20, t_nom_mm: 12, MAWP_design_bar: 20 };
  const crit2 = { critical: ['R_wt', 'Mt_pit', 'RSF', 'MAWP_reduced_bar'], nonNeg: ['R_wt', 'Mt_pit'] };
  probe('FFS.part6_pitting_L2({})', () => FFS.part6_pitting_L2({}), crit2);
  for (const fld of ['max_pit_depth_mm', 'pit_diameter_mm', 'pit_spacing_mm', 't_nom_mm', 'FCA_mm']) {
    for (const [nm, bad] of BAD) {
      const o = Object.assign({}, l2base); o[fld] = bad;
      probe('FFS.part6_pitting_L2(' + fld + '=' + nm + ')', () => FFS.part6_pitting_L2(o), crit2);
    }
  }
  // spacing < diameter (overlapping pits — ratio could blow Mt_pit to Inf)
  probe('FFS.part6_pitting_L2(spacing<diam)', () => FFS.part6_pitting_L2(Object.assign({}, l2base, { pit_diameter_mm: 10, pit_spacing_mm: 1 })), crit2);
  probe('FFS.part6_pitting_L2(spacing=diam)', () => FFS.part6_pitting_L2(Object.assign({}, l2base, { pit_diameter_mm: 5, pit_spacing_mm: 5 })), crit2);
}

// ── FFS.part7_HIC_L1 / L2 — critical: RSF (L2), pass flags. L1 guards null ratios.
{
  const crit1 = { critical: [] };  // L1 has no headline numeric; just must not throw / must flag
  probe('FFS.part7_HIC_L1({})', () => FFS.part7_HIC_L1({}), crit1);
  for (const [nm, bad] of BAD) {
    probe('FFS.part7_HIC_L1(CLR=' + nm + ')', () => FFS.part7_HIC_L1({ CLR_pct: bad, CTR_pct: 3, CSR_pct: 1 }), crit1);
  }
  const l2base = { blister_diameter_mm: 20, blister_density_per_m2: 5, t_loss_fraction: 0.1, t_nom_mm: 16, MAWP_design_bar: 20 };
  const crit2 = { critical: ['RSF', 'blister_area_fraction', 'MAWP_reduced_bar'], nonNeg: ['RSF', 'blister_area_fraction'] };
  probe('FFS.part7_HIC_L2({})', () => FFS.part7_HIC_L2({}), crit2);
  for (const fld of ['blister_diameter_mm', 'blister_density_per_m2', 't_loss_fraction', 't_nom_mm', 'FCA_mm']) {
    for (const [nm, bad] of BAD) {
      const o = Object.assign({}, l2base); o[fld] = bad;
      probe('FFS.part7_HIC_L2(' + fld + '=' + nm + ')', () => FFS.part7_HIC_L2(o), crit2);
    }
  }
  probe('FFS.part7_HIC_L2(t_loss>1)', () => FFS.part7_HIC_L2(Object.assign({}, l2base, { t_loss_fraction: 5 })), crit2);
}

console.log('— MR0175 (mr0175.js) ——————————————————————————————————————————');
// ── MR0175.issue — critical: must return an object with a boolean IN_SCOPE and a
//    string `route`, never throw. (Citation-grounded verdict — text, not numbers.)
{
  const base = { uns: 'S31803', composition: { Cr: 22, Mo: 3.0, Ni: 5, N: 0.18 },
                 T_C: 90, pH2S_kPa: 30, Cl_mg_L: 120000, pH_in_situ: 4.5, stress_pct_SMYS: 70, hardness_HRC: 28 };
  function probeIssue(label, o) {
    let res;
    try { res = MR.issue(o); }
    catch (e) { ok(false, 'THROWS: ' + label + ' -> ' + (e && e.message ? e.message : e)); return; }
    ok(res && typeof res.route === 'string' && typeof res.IN_SCOPE === 'boolean',
       label + ' -> {IN_SCOPE:bool, route:string}');
  }
  probeIssue('MR0175.issue(undefined)', undefined);
  probeIssue('MR0175.issue(null)', null);
  probeIssue('MR0175.issue({})', {});
  probeIssue('MR0175.issue("abc")', 'abc');
  for (const fld of ['T_C', 'pH2S_kPa', 'Cl_mg_L', 'pH_in_situ', 'stress_pct_SMYS', 'hardness_HRC', 'cold_work_pct']) {
    for (const [nm, bad] of BAD) {
      const o = Object.assign({}, base); o[fld] = bad;
      probeIssue('MR0175.issue(' + fld + '=' + nm + ')', o);
    }
  }
  // poisoned composition keys
  for (const el of ['Cr', 'Mo', 'Ni', 'N']) {
    for (const [nm, bad] of BAD) {
      const o = Object.assign({}, base, { composition: Object.assign({}, base.composition) });
      o.composition[el] = bad;
      probeIssue('MR0175.issue(comp.' + el + '=' + nm + ')', o);
    }
  }
  // wrong-type uns / scope / owner
  probeIssue('MR0175.issue(uns=number)', Object.assign({}, base, { uns: 12345 }));
  probeIssue('MR0175.issue(scope=garbage)', Object.assign({}, base, { scope: 'zzz' }));
  probeIssue('MR0175.issue(owner=string)', Object.assign({}, base, { owner_specs: 'not-an-array' }));
  probeIssue('MR0175.issue(composition=null)', Object.assign({}, base, { composition: null }));
  probeIssue('MR0175.issue(composition=string)', Object.assign({}, base, { composition: 'abc' }));
  // out-of-range
  probeIssue('MR0175.issue(T=-300)', Object.assign({}, base, { T_C: -300 }));
  probeIssue('MR0175.issue(pH=-5)', Object.assign({}, base, { pH_in_situ: -5 }));
  probeIssue('MR0175.issue(pH2S=1e12)', Object.assign({}, base, { pH2S_kPa: 1e12 }));
  probeIssue('MR0175.issue(HRC=1e12)', Object.assign({}, base, { hardness_HRC: 1e12 }));
}

// ── MR0175 internal helpers — _classifyFamily / _pren / _regionLookup / HRC<->HV.
{
  for (const [nm, bad] of BAD) {
    const r = (() => { try { return { v: MR._classifyFamily({ Cr: bad, Ni: 8, Mo: 2 }, '') }; } catch (e) { return { __throw: e }; } })();
    if (r.__throw) ok(false, 'THROWS: MR0175._classifyFamily(Cr=' + nm + ') -> ' + r.__throw.message);
    else ok(typeof r.v === 'string', 'MR0175._classifyFamily(Cr=' + nm + ') -> family string');
    probe('MR0175._pren(Cr=' + nm + ')', () => ({ v: MR._pren({ Cr: bad, Mo: 3, N: 0.2 }) }), { critical: ['v'] });
  }
  probe('MR0175._classifyFamily(null,null)', () => {
    const f = MR._classifyFamily(null, null);
    return typeof f === 'string' ? { ok: 1 } : { v: NaN };
  }, { critical: ['v'] });
  // _regionLookup must return null or 0..3 for any pH2S/pH
  for (const [nm, bad] of BAD) {
    const r = (() => { try { return { v: MR._regionLookup(bad, bad) }; } catch (e) { return { __throw: e }; } })();
    if (r.__throw) ok(false, 'THROWS: MR0175._regionLookup(' + nm + ') -> ' + r.__throw.message);
    else ok(r.v === null || (typeof r.v === 'number' && r.v >= 0 && r.v <= 3),
            'MR0175._regionLookup(' + nm + ') -> null or 0..3 (got ' + r.v + ')');
  }
  // HRC<->HV converters — finite or null
  for (const [nm, bad] of BAD) {
    probe('MR0175._HRCtoHV10(' + nm + ')', () => ({ v: MR._HRCtoHV10(bad) }), { critical: ['v'] });
    probe('MR0175._HV10toHRC(' + nm + ')', () => ({ v: MR._HV10toHRC(bad) }), { critical: ['v'] });
  }
}

// ── summary ──────────────────────────────────────────────────────────────────
console.log('\n' + (fail
  ? ('  EDGE-CASE robustness gate: ' + fail + ' FAILED of ' + (pass + fail)
      + ' (these are real degrade-gracefully bugs — see list above)')
  : ('✓ all ' + pass + ' edge cases degrade gracefully (no throws, no silent NaN/Inf/neg in headline outputs)')));
console.log('test-edge: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
