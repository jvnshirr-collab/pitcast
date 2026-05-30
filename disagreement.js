/* disagreement.js — generic 2-D model-disagreement grid for PitCast.
 *
 * Builds a grid of ensemble-spread over any two input axes, so a tab can show
 * a heatmap of WHERE its models agree vs diverge across the operating envelope
 * — the "how much should I trust this number?" view no closed tool offers.
 *
 * Engine-agnostic: the caller supplies an evalCell(x, y) that returns the model
 * values (and an optional out-of-envelope flag) for that operating point; the
 * spread is computed with the shared UQ.ensemble().  Attaches window.DIS;
 * module.exports for Node tests.
 *
 * A Javanshir Hasanov production.
 */
(function (global) {
  'use strict';

  function _UQ() {
    if (typeof window !== 'undefined' && window.UQ) return window.UQ;
    if (typeof require === 'function') { try { return require('./uq.js'); } catch (e) {} }
    return null;
  }

  function linspace(a, b, n) {
    var o = []; for (var i = 0; i < n; i++) o.push(a + (b - a) * (n > 1 ? i / (n - 1) : 0)); return o;
  }
  function logspace(a, b, n) {
    var la = Math.log10(a), lb = Math.log10(b), o = [];
    for (var i = 0; i < n; i++) o.push(Math.pow(10, la + (lb - la) * (n > 1 ? i / (n - 1) : 0)));
    return o;
  }

  /** grid({ xs, ys, evalCell }) -> { xs, ys, ratio[iy][ix], ooe[iy][ix], min, max }
   *  evalCell(x, y) -> { values:[numbers], ooe?:bool }  (iy=0 is the bottom row). */
  function grid(opts) {
    var UQ = _UQ();
    var xs = opts.xs, ys = opts.ys;
    var ratio = [], ooe = [], lo = [], hi = [];
    for (var iy = 0; iy < ys.length; iy++) {
      var rR = [], rO = [], rL = [], rH = [];
      for (var ix = 0; ix < xs.length; ix++) {
        var cell = opts.evalCell(xs[ix], ys[iy]) || {};
        var ens = UQ ? UQ.ensemble(cell.values || []) : { spread: { ratio: 1 }, min: NaN, max: NaN };
        rR.push(ens.spread.ratio);
        rO.push(!!cell.ooe);
        rL.push(ens.min); rH.push(ens.max);
      }
      ratio.push(rR); ooe.push(rO); lo.push(rL); hi.push(rH);
    }
    return { xs: xs, ys: ys, ratio: ratio, ooe: ooe, min: lo, max: hi };
  }

  // Spread-ratio colour buckets (matches the site's green->red MSD convention:
  // green = models agree, red = models diverge). OOE is encoded separately by hatch.
  var SPREAD_COLORS = [
    { max: 1.5, color: '#0f3d24' }, // agree (<=1.5x)
    { max: 2.0, color: '#1c6b3a' },
    { max: 3.0, color: '#3f7d18' }, // caution boundary
    { max: 5.0, color: '#7a7416' },
    { max: 10.0, color: '#9a6312' },
    { max: 1e12, color: '#b4471a' } // diverge (>10x)
  ];

  global.DIS = { grid: grid, linspace: linspace, logspace: logspace, SPREAD_COLORS: SPREAD_COLORS };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.DIS;

})(typeof window !== 'undefined' ? window : this);
