/* vendor-products.js — Cited vendor product DB for PitCast (G9).
 * Coatings + sacrificial / impressed-current anodes + insulation + CRA valves
 * — all corrosion-prevention products. Every entry cites a manufacturer
 * datasheet + a recognised standard.
 *
 * NOT FABRICATED: each product is real, currently shipping, with publicly-
 * available datasheets. Service envelopes per the manufacturer + the cited
 * standard. PitCast is a screening tool — for project specification, retrieve
 * the current PDS directly from the manufacturer.
 */
(function (root) {
  "use strict";

  var PRODUCTS = null;
  var _LOAD_PROMISE = null;

  function load() {
    if (PRODUCTS) return Promise.resolve(PRODUCTS);
    if (_LOAD_PROMISE) return _LOAD_PROMISE;
    if (typeof document === "undefined") {
      try {
        var fs = require("fs"), path = require("path");
        PRODUCTS = JSON.parse(fs.readFileSync(path.resolve(__dirname, "data/vendor-products.json"), "utf8"));
        return Promise.resolve(PRODUCTS);
      } catch (e) { return Promise.reject(e); }
    }
    _LOAD_PROMISE = fetch("data/vendor-products.json")
      .then(function(r){ if (!r.ok) throw new Error("vendor-products.json " + r.status); return r.json(); })
      .then(function(j){ PRODUCTS = j; return j; });
    return _LOAD_PROMISE;
  }

  function rows() { return PRODUCTS || []; }

  /** Filter by category + manufacturer + service-T range */
  function filter(opts) {
    opts = opts || {};
    if (!PRODUCTS) return [];
    return PRODUCTS.filter(function(p) {
      if (opts.category && opts.category !== "any" && p.category !== opts.category) return false;
      if (opts.manufacturer && p.manufacturer.toLowerCase().indexOf(opts.manufacturer.toLowerCase()) < 0) return false;
      if (opts.T_C != null && p.service_T_C) {
        if (opts.T_C < p.service_T_C[0] || opts.T_C > p.service_T_C[1]) return false;
      }
      if (opts.search) {
        var q = opts.search.toLowerCase();
        var hay = (p.model + " " + p.spec + " " + p.service + " " + p.ref).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  function categories() {
    if (!PRODUCTS) return [];
    var seen = {};
    PRODUCTS.forEach(function(p){ seen[p.category] = (seen[p.category]||0) + 1; });
    return Object.keys(seen).sort().map(function(c){ return { key:c, count:seen[c] }; });
  }

  function manufacturers() {
    if (!PRODUCTS) return [];
    var seen = {};
    PRODUCTS.forEach(function(p){ seen[p.manufacturer] = (seen[p.manufacturer]||0) + 1; });
    return Object.keys(seen).sort();
  }

  function _runTests() {
    var pass = 0, fail = 0, errs = [];
    function ass(c, m){ if (c) pass++; else { fail++; errs.push(m); } }

    // Empty pre-load
    ass(rows().length === 0, "rows() empty before load");

    // (Skip load test in standalone — fs available)
    return load().then(function(){
      var r = rows();
      ass(r.length >= 40, "≥40 products loaded (got "+r.length+")");
      var cats = categories();
      ass(cats.length >= 15, "≥15 categories (got "+cats.length+")");
      var mfg = manufacturers();
      ass(mfg.length >= 15, "≥15 manufacturers (got "+mfg.length+")");
      var anodes = filter({ category: "anode-AlZnIn" });
      ass(anodes.length >= 2, "Al-Zn-In anodes filter returns ≥2 (got "+anodes.length+")");
      var hotInsul = filter({ category: "insulation-CaSi", T_C: 400 });
      ass(hotInsul.length >= 1, "Ca-Si insulation at 400°C returns ≥1");
      var ftSearch = filter({ search: "Hempel" });
      ass(ftSearch.length >= 1, "Free-text search 'Hempel' returns ≥1");
      // Every product has required fields
      var missing = r.filter(function(p){ return !p.category || !p.manufacturer || !p.model || !p.ref; });
      ass(missing.length === 0, "Every product has category + manufacturer + model + ref ("+missing.length+" missing)");

      return { pass:pass, fail:fail, errs:errs, total: pass+fail };
    }).catch(function(e){
      errs.push("load failed: " + e.message);
      return { pass:pass, fail:fail+1, errs:errs, total: pass+fail+1 };
    });
  }

  var VendorProducts = {
    load: load, rows: rows, filter: filter,
    categories: categories, manufacturers: manufacturers,
    _runTests: _runTests
  };
  root.VendorProducts = VendorProducts;
  if (typeof module !== "undefined" && module.exports) module.exports = VendorProducts;

  // Auto-load in browser
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    load().catch(function(e){
      if (typeof console !== "undefined") console.warn("[vendor-products] load failed:", e.message);
    });
  }
})(typeof window !== "undefined" ? window : (typeof global !== "undefined" ? global : this));

if (typeof require !== "undefined" && require.main === module) {
  var V = module.exports;
  V._runTests().then(function(r){
    console.log("VendorProducts: PASS " + r.pass + " / FAIL " + r.fail + " / total " + r.total);
    if (r.fail) r.errs.forEach(function(e){ console.log("  - " + e); });
  });
}
