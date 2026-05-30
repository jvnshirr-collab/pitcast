/* uq.js — shared uncertainty & ensemble framework for PitCast engines.
 *
 * Pure, framework-agnostic, ES5. No imports. Attaches to window.UQ in the
 * browser; also module.exports for the Node benchmark/test harness.
 *
 * This is the ONE result contract every engine will speak, so the universal
 * disagreement-map, validity-envelope, and export layers can consume any
 * corrosion mode the same way:
 *
 *   UQ.buildResult({ value?, unit?, verdict?, models, interval?, envelope?, drivers?, provenance? })
 *       -> standard schema { schema, value, unit, verdict, interval, ensemble, models, envelope, drivers, provenance }
 *   UQ.ensemble(models)            -> { n, values, min, max, median, mean, stdev, range, spread{ratio,rel,abs,verdict} }
 *   UQ.spreadVerdict(ratio)        -> 'agree' | 'caution' | 'diverge'
 *   UQ.studentTInterval(point, sd, df, level)  -> { lo, hi, level, t, df, sd }
 *   UQ.tQuantile(p, df)            -> inverse Student-t (prediction intervals)
 *   UQ.envelopeCheck(inputs, env)  -> per-variable validity status
 *
 * Disagreement thresholds match the CO2 tab's existing UI (ratio >= 3 ==
 * "models disagree strongly"), so the new universal layer stays consistent
 * with what users already see.
 *
 * A Javanshir Hasanov production.
 */
(function (global) {
  'use strict';

  // ════════════════════════════════════════════════════════════════════════
  // Student-t CDF — Lentz continued fraction for the regularized incomplete
  // beta. These are the same standard numerical routines used by the validated
  // CPT prediction interval in pitcast.js; duplicated here so uq.js is fully
  // standalone and can load before any engine.
  // ════════════════════════════════════════════════════════════════════════
  function _gln(x) {
    var g = [76.18009172947146, -86.50532032941677, 24.01409824083091,
             -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    var y = x, tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp);
    var s = 1.000000000190015;
    for (var j = 0; j < 6; j++) { y++; s += g[j] / y; }
    return -tmp + Math.log(2.5066282746310005 * s / x);
  }
  function _betacf(a, b, x) {
    var FPMIN = 1e-300, qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; var h = d;
    for (var m = 1; m <= 200; m++) {
      var m2 = 2 * m;
      var aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d;
      var del = d * c; h *= del;
      if (Math.abs(del - 1) < 1e-12) break;
    }
    return h;
  }
  function _ibeta(x, a, b) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    var bt = Math.exp(_gln(a + b) - _gln(a) - _gln(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * _betacf(a, b, x) / a : 1 - bt * _betacf(b, a, 1 - x) / b;
  }
  function tCDF(t, df) {
    var ib = 0.5 * _ibeta(df / (df + t * t), df / 2, 0.5);
    return t >= 0 ? 1 - ib : ib;
  }

  /** Inverse Student-t CDF via bisection on tCDF (monotone in t). p in (0,1). */
  function tQuantile(p, df) {
    if (!(df > 0)) df = 1e6;
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    if (Math.abs(p - 0.5) < 1e-12) return 0;
    var lo = -1000, hi = 1000;
    for (var i = 0; i < 200; i++) {
      var mid = 0.5 * (lo + hi), c = tCDF(mid, df);
      if (c < p) lo = mid; else hi = mid;
      if (hi - lo < 1e-9) break;
    }
    return 0.5 * (lo + hi);
  }

  /** Two-sided Student-t interval: point ± t(level, df)·sd. */
  function studentTInterval(point, sd, df, level) {
    level = (level == null) ? 0.95 : level;
    if (!(sd > 0) || !(df >= 1) || !isFinite(point)) {
      return { lo: point, hi: point, level: level, t: 0, df: df, sd: sd, degenerate: true };
    }
    var t = tQuantile(1 - (1 - level) / 2, df);
    return { lo: point - t * sd, hi: point + t * sd, level: level, t: t, df: df, sd: sd };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Ensemble statistics + disagreement verdict
  // ════════════════════════════════════════════════════════════════════════
  var SPREAD = { agree: 1.5, diverge: 3.0 }; // ratio = max/min thresholds

  function spreadVerdict(ratio) {
    if (!isFinite(ratio) || ratio < 1) return 'agree';
    if (ratio < SPREAD.agree) return 'agree';
    if (ratio < SPREAD.diverge) return 'caution';
    return 'diverge';
  }

  function _valueOf(m) {
    if (typeof m === 'number') return m;
    if (m == null) return NaN;
    if (typeof m.value === 'number') return m.value;
    if (typeof m.cr === 'number') return m.cr; // tolerate engine-native key
    return NaN;
  }
  function median(arr) {
    var a = arr.slice().sort(function (x, y) { return x - y; }), n = a.length;
    if (!n) return NaN;
    return n % 2 ? a[(n - 1) / 2] : 0.5 * (a[n / 2 - 1] + a[n / 2]);
  }

  /** Ensemble summary over an array of numbers or model objects ({value} or {cr}). */
  function ensemble(models, opts) {
    opts = opts || {};
    var floor = opts.floor == null ? 1e-3 : opts.floor; // guards div-by-zero on ratio
    var list = (models || []).map(_valueOf).filter(function (x) { return isFinite(x); });
    var n = list.length;
    if (!n) {
      return { n: 0, values: [], min: NaN, max: NaN, median: NaN, mean: NaN, stdev: NaN,
               range: NaN, spread: { ratio: 1, rel: 0, abs: 0, verdict: 'agree' } };
    }
    var min = Math.min.apply(null, list), max = Math.max.apply(null, list);
    var mean = list.reduce(function (s, x) { return s + x; }, 0) / n;
    var med = median(list);
    var variance = n > 1 ? list.reduce(function (s, x) { return s + (x - mean) * (x - mean); }, 0) / (n - 1) : 0;
    var ratio = max / Math.max(floor, min);
    var rel = med > 0 ? (max - min) / med : 0;
    return { n: n, values: list, min: min, max: max, median: med, mean: mean,
             stdev: Math.sqrt(variance), range: max - min,
             spread: { ratio: ratio, rel: rel, abs: max - min, verdict: spreadVerdict(ratio) } };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Validity-envelope check
  //   inputs: { key: value };  env: { key: [lo, hi] }  (lo/hi may be null = unbounded)
  // ════════════════════════════════════════════════════════════════════════
  function envelopeCheck(inputs, env) {
    inputs = inputs || {}; env = env || {};
    var vars = [], outside = [];
    for (var k in env) {
      if (!env.hasOwnProperty(k)) continue;
      var range = env[k] || [], lo = range[0], hi = range[1];
      var val = inputs[k], status, inEnv;
      if (val == null || !isFinite(val)) { status = 'unknown'; inEnv = null; }
      else if (lo != null && val < lo) { status = 'below'; inEnv = false; }
      else if (hi != null && val > hi) { status = 'above'; inEnv = false; }
      else { status = 'within'; inEnv = true; }
      if (inEnv === false) outside.push(k);
      vars.push({ name: k, value: (val == null ? null : val),
                  lo: (lo == null ? null : lo), hi: (hi == null ? null : hi),
                  status: status, inEnvelope: inEnv });
    }
    return { variables: vars, outside: outside, anyOutside: outside.length > 0,
             allInEnvelope: vars.length > 0 && vars.every(function (v) { return v.inEnvelope === true; }) };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Standard result schema builder — the one contract every engine emits.
  // ════════════════════════════════════════════════════════════════════════
  function buildResult(o) {
    o = o || {};
    var models = (o.models || []).map(function (m) {
      return { name: m.name, id: m.id, value: _valueOf(m), unit: m.unit || o.unit || null,
               citation: m.citation || m.ref || null,
               inEnvelope: (m.inEnvelope == null ? null : m.inEnvelope) };
    });
    var ens = o.ensemble || ensemble(models);
    var value = (o.value != null) ? o.value : ens.median;
    return {
      schema: 'pitcast.uq/1',
      value: value,
      unit: o.unit || null,
      verdict: (o.verdict == null ? null : o.verdict),
      interval: o.interval || (isFinite(ens.min) ? { lo: ens.min, hi: ens.max, level: 'model-spread' } : null),
      ensemble: ens,
      models: models,
      envelope: o.envelope || null,
      drivers: o.drivers || [],
      provenance: o.provenance || null
    };
  }

  var UQ = {
    buildResult: buildResult, ensemble: ensemble, spreadVerdict: spreadVerdict,
    studentTInterval: studentTInterval, tQuantile: tQuantile, tCDF: tCDF,
    envelopeCheck: envelopeCheck, median: median, SPREAD: SPREAD
  };

  global.UQ = UQ;
  if (typeof module !== 'undefined' && module.exports) module.exports = UQ;

})(typeof window !== 'undefined' ? window : this);
