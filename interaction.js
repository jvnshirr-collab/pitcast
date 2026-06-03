/* interaction.js — ILI multi-defect interaction / clustering engine, vanilla JS.
 *
 * In-line inspection (ILI) tools emit hundreds to tens of thousands of corrosion
 * features per pipeline run. A non-trivial fraction sit close enough to one or
 * more neighbours that the combined defect ruptures at a lower pressure than
 * either alone. This module groups raw features into interacting clusters per
 * one of three industry rules, returning a list of effective merged anomalies
 * an engineer feeds into b31g / DNV-RP-F101 / RSTRENG downstream.
 *
 * Standards / primary sources (each cluster carries the active rule's full
 * citation string in its `ref` field):
 *   - DNV-RP-F101 (2017, reissued Jan 2021) "Corroded Pipelines", Part A §3.7
 *     (Interacting defects), §3.8 (complex shape). The gold-standard default.
 *   - ASME B31G-2012 "Manual for Determining the Remaining Strength of Corroded
 *     Pipelines", §3.4.5 (cluster handling).
 *   - J.F. Kiefner & P.H. Vieth, "A Modified Criterion for Evaluating the
 *     Remaining Strength of Corroded Pipe," Battelle PR-3-805 (1989) — origin
 *     of RSTRENG / classical 1-inch axial interaction rule.
 *   - Pipeline Operators Forum POF-100 (2021) "Specifications and requirements
 *     for in-line inspection of pipelines," §6 (anomaly definitions) and §7
 *     (reporting, interaction-box rule).
 *   - API STD 1163, 3rd ed. (2021) "In-Line Inspection Systems Qualification",
 *     §7.2.3 (Probability of Identification), §7.2.4 (sizing accuracy). The
 *     basis for pre-cluster tool-tolerance box expansion.
 *
 * Units: SI throughout. D, t, L, W, d, x_axial, spacings in mm; theta in
 * degrees (0..360). Circumferential arc length on a cylinder of OD D:
 *     s_circ_mm = |Δtheta_deg| · π · D / 360
 *
 * Public API:
 *   Interaction.cluster(features, opts)        // main entry
 *   Interaction.RULES = { dnv, modb31g, b31g, pof }
 *   Interaction._clockToDeg("HH:MM")           // 12:00=0, 03:00=90, ...
 *   Interaction._expandByTolerance(feature)    // API 1163 §7.2.4 inflation
 *   Interaction._interactDNV(a, b, D, t)       // pairwise predicate
 *   Interaction._interactPOF(a, b, t)          // pairwise predicate
 *   Interaction._interactB31G(a, b, t, axThr)  // pairwise predicate
 */
(function (root) {
  "use strict";

  // -------------------------------------------------------------------------
  // Citations — kept as long-form strings so they survive serialisation
  // straight onto an engineer-visible UI badge or PDF footnote.
  // -------------------------------------------------------------------------
  var REF_DNV     = "DNV-RP-F101 (2021) §3.7 Interacting defects; pre-clustering tolerance box per API STD 1163 (3rd ed., 2021) §7.2.3 + §7.2.4.";
  var REF_MODB31G = "ASME B31G-2012 §3.4.5 + Kiefner & Vieth 1989 (Modified B31G / RSTRENG); pre-clustering tolerance box per API STD 1163 (3rd ed., 2021) §7.2.3 + §7.2.4.";
  var REF_B31G    = "ASME B31G-2012 §3.4.5 + Kiefner & Vieth 1989; pre-clustering tolerance box per API STD 1163 (3rd ed., 2021) §7.2.3 + §7.2.4.";
  var REF_POF     = "Pipeline Operators Forum POF-100 (2021) §6, §7 (interaction-box); pre-clustering tolerance box per API STD 1163 (3rd ed., 2021) §7.2.3 + §7.2.4.";

  // -------------------------------------------------------------------------
  // API 1163 §7.2.4 default tool tolerances (typical MFL high-resolution).
  // These are deliberately conservative — a vendor-specific Performance
  // Specification overrides per feature.
  // -------------------------------------------------------------------------
  var DEFAULT_TOL_AXIAL_MM = 10.0;   // ±10 mm POI/sizing pooled
  var DEFAULT_TOL_CIRC_MM  = 10.0;   // ±10 mm circumferential location
  var DEFAULT_TOL_DEPTH_FRAC = 0.10; // ±10 % of wall thickness

  // -------------------------------------------------------------------------
  // Helpers — clock-position to angular degrees and arc-length conversion.
  //   12:00 → 0°, 03:00 → 90°, 06:00 → 180°, 09:00 → 270°.
  //   Accepts "HH:MM" with HH ∈ [01..12], MM ∈ [00..59]; also "12:00".
  // -------------------------------------------------------------------------
  function _clockToDeg(s) {
    if (s == null) return 0;
    var str = String(s).trim();
    var parts = str.split(":");
    if (parts.length !== 2) return NaN;
    var hh = parseInt(parts[0], 10);
    var mm = parseInt(parts[1], 10);
    if (!isFinite(hh) || !isFinite(mm)) return NaN;
    if (hh < 1 || hh > 12 || mm < 0 || mm > 59) return NaN;
    // hours portion: each hour = 30°, with 12 mapping to 0
    var hh12 = (hh % 12);
    var deg = hh12 * 30 + mm * 0.5;
    // wrap to [0, 360)
    deg = ((deg % 360) + 360) % 360;
    return deg;
  }

  /** Convert a circumferential angular gap (signed delta in degrees) to a
   *  shortest-arc length on the cylinder OD. Always returns non-negative mm. */
  function _arcMm(dtheta_deg, D_mm) {
    var d = Math.abs(+dtheta_deg);
    // shortest arc (defects 10° apart on a pipe are 10° apart, not 350°)
    if (d > 180) d = 360 - d;
    return d * Math.PI * (+D_mm) / 360;
  }

  // -------------------------------------------------------------------------
  // Normalise an input feature record into a canonical internal shape with
  // the tool-tolerance expansion already applied (per API STD 1163 §7.2.4).
  // The defensive coercion below lets the caller pass either explicit
  // tool_tol_*_mm fields per feature, or rely on the module defaults.
  // -------------------------------------------------------------------------
  function _expandByTolerance(f, defaults) {
    var d_tol_frac = (defaults && defaults.tol_depth_frac != null)
      ? +defaults.tol_depth_frac : DEFAULT_TOL_DEPTH_FRAC;
    var d_tol_ax = (defaults && defaults.tol_axial_mm != null)
      ? +defaults.tol_axial_mm : DEFAULT_TOL_AXIAL_MM;
    var d_tol_ci = (defaults && defaults.tol_circ_mm != null)
      ? +defaults.tol_circ_mm : DEFAULT_TOL_CIRC_MM;

    var L  = Math.max(0, +f.L_mm || 0);
    var W  = Math.max(0, +f.W_mm || 0);
    var d  = Math.max(0, +f.d_mm || 0);
    var t  = Math.max(0, +f.t_mm || (defaults && defaults.t_mm) || 0);
    var D  = Math.max(0, +f.D_mm || (defaults && defaults.D_mm) || 0);
    var x  = +f.x_axial_mm || 0;

    // theta: prefer explicit theta_deg, otherwise convert clock_pos.
    var theta;
    if (f.theta_deg != null && isFinite(+f.theta_deg)) {
      theta = ((+f.theta_deg % 360) + 360) % 360;
    } else if (f.clock_pos) {
      theta = _clockToDeg(f.clock_pos);
    } else {
      theta = 0;
    }

    // Per-feature tolerance overrides (vendor-specific PS).
    var tol_ax = (f.tool_tol_axial_mm != null) ? Math.max(0, +f.tool_tol_axial_mm) : d_tol_ax;
    var tol_ci = (f.tool_tol_circ_mm  != null) ? Math.max(0, +f.tool_tol_circ_mm)  : d_tol_ci;
    var tol_dp;
    if (f.tool_tol_depth_mm != null) {
      tol_dp = Math.max(0, +f.tool_tol_depth_mm);
    } else {
      // default expressed as fraction of wall
      tol_dp = (t > 0 ? t * d_tol_frac : 0);
    }

    // API 1163 §7.2.4 inflation: each dimension grows by 2× one-sided tolerance.
    // Length/width grow because either end of the box may be off by ±tol;
    // depth grows by +tol on the deeper side (conservative for FFS).
    var L_exp = L + 2 * tol_ax;
    var W_exp = W + 2 * tol_ci;
    var d_exp = Math.min(t > 0 ? t : Infinity, d + tol_dp);

    return {
      id: (f.id != null ? String(f.id) : null),
      x_axial_mm: x,
      theta_deg: theta,
      L_mm: L_exp,
      W_mm: W_exp,
      d_mm: d_exp,
      t_mm: t,
      D_mm: D,
      // also keep original (un-expanded) values for downstream reporting
      L_raw_mm: L, W_raw_mm: W, d_raw_mm: d,
      tol_axial_mm: tol_ax, tol_circ_mm: tol_ci, tol_depth_mm: tol_dp
    };
  }

  // -------------------------------------------------------------------------
  // Pairwise spacing primitives.
  //   axial gap  = (smaller-x feature's trailing edge) → (larger-x leading edge)
  //   circumferential gap = arc length between nearest box edges
  // Negative gap means the boxes overlap (used by POF / overlap detection).
  // -------------------------------------------------------------------------
  function _axialGap(a, b) {
    // Treat features as line segments [x - L/2, x + L/2].
    var aLo = a.x_axial_mm - a.L_mm / 2;
    var aHi = a.x_axial_mm + a.L_mm / 2;
    var bLo = b.x_axial_mm - b.L_mm / 2;
    var bHi = b.x_axial_mm + b.L_mm / 2;
    if (aHi < bLo) return bLo - aHi;          // a wholly before b
    if (bHi < aLo) return aLo - bHi;          // b wholly before a
    return -Math.min(aHi - bLo, bHi - aLo);   // overlap (negative)
  }

  function _circGap(a, b) {
    // Treat features as arcs of half-width W/2 mm centred on theta * arcLen.
    var D = (a.D_mm > 0) ? a.D_mm : b.D_mm;
    if (!(D > 0)) return Infinity;
    var dtheta = a.theta_deg - b.theta_deg;
    var arcCenter = _arcMm(dtheta, D);
    var halfWidthsSum = (a.W_mm + b.W_mm) / 2;
    var edgeToEdge = arcCenter - halfWidthsSum;
    return edgeToEdge;  // can be negative (overlap)
  }

  // -------------------------------------------------------------------------
  // DNV-RP-F101 §3.7 — interaction predicate.
  //   axial threshold : 2 · √(D · t)
  //   circ  threshold : π · √(D · t)   (equivalently angular φ ≤ 360·√(t/D)°)
  // The standard applies to the *centre-to-centre or edge-to-edge* gap; F101
  // examples (Annex B) use edge-to-edge "s" — we follow that convention.
  // -------------------------------------------------------------------------
  function _interactDNV(a, b, D, t) {
    if (!(D > 0 && t > 0)) return false;
    var sAxLim = 2.0 * Math.sqrt(D * t);
    var sCiLim = Math.PI * Math.sqrt(D * t);
    var sAx = _axialGap(a, b);
    var sCi = _circGap(a, b);
    // overlap (negative gap) trivially interacts
    if (sAx < 0) sAx = 0;
    if (sCi < 0) sCi = 0;
    return (sAx <= sAxLim) && (sCi <= sCiLim);
  }

  // -------------------------------------------------------------------------
  // ASME B31G-2012 / Mod-B31G (Kiefner) — interaction predicate.
  //   axial : combine if gap < axial_threshold_mm (default 25.4 mm = 1 inch)
  //   circ  : combine if gap < 6 · t  (outer bound recommendation)
  // -------------------------------------------------------------------------
  function _interactB31G(a, b, t, axial_threshold_mm) {
    if (!(t > 0)) return false;
    var axLim = (axial_threshold_mm != null ? +axial_threshold_mm : 25.4);
    var ciLim = 6.0 * t;
    var sAx = _axialGap(a, b);
    var sCi = _circGap(a, b);
    if (sAx < 0) sAx = 0;
    if (sCi < 0) sCi = 0;
    return (sAx < axLim) && (sCi < ciLim);
  }

  // -------------------------------------------------------------------------
  // Pipeline Operators Forum POF-100 (2021) — interaction-box predicate.
  //   cluster iff s_axial < min(L1, L2) AND s_circ < min(W1, W2)
  //   never cluster if either spacing ≥ 6 · t
  // (Overlap counts as cluster.)
  // -------------------------------------------------------------------------
  function _interactPOF(a, b, t) {
    if (!(t > 0)) return false;
    var sAx = _axialGap(a, b);
    var sCi = _circGap(a, b);
    var outerAx = 6.0 * t;
    var outerCi = 6.0 * t;
    // outer-bound veto (use the original edge-to-edge gap, post-clamp to 0)
    var sAxPos = sAx < 0 ? 0 : sAx;
    var sCiPos = sCi < 0 ? 0 : sCi;
    if (sAxPos >= outerAx) return false;
    if (sCiPos >= outerCi) return false;
    var minL = Math.min(a.L_mm, b.L_mm);
    var minW = Math.min(a.W_mm, b.W_mm);
    return (sAxPos < minL) && (sCiPos < minW);
  }

  // -------------------------------------------------------------------------
  // Union-find for connected-component clustering of the interaction graph.
  // -------------------------------------------------------------------------
  function _makeUF(n) {
    var p = new Array(n), r = new Array(n);
    for (var i = 0; i < n; i++) { p[i] = i; r[i] = 0; }
    function find(x) {
      while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; }
      return x;
    }
    function union(a, b) {
      var ra = find(a), rb = find(b);
      if (ra === rb) return false;
      if (r[ra] < r[rb])      p[ra] = rb;
      else if (r[ra] > r[rb]) p[rb] = ra;
      else                    { p[rb] = ra; r[ra]++; }
      return true;
    }
    return { find: find, union: union };
  }

  // -------------------------------------------------------------------------
  // Per-rule cluster-merge calculators.
  //   DNV §3.7 — end-to-end merged length, length-weighted depth.
  //   Mod-B31G — combined length end-to-end, max depth (conservative).
  //   POF      — bounding-box L,W and max depth.
  // -------------------------------------------------------------------------
  // Note on raw vs. tolerance-expanded merging:
  //   API 1163 §7.2.4 tolerance expansion is applied to the SPACING TEST only —
  //   i.e. we err on the conservative side when deciding whether two features
  //   interact. The MERGED engineering dimensions reported to the downstream
  //   strength calculator are the raw measured L/W/d (with raw x_axial), as
  //   that is what DNV-RP-F101 §3.7 and POF-100 §7 illustrate in their worked
  //   examples. The expanded values are kept on each member for inspection /
  //   uncertainty propagation but are not the calc-of-record geometry.
  function _mergeDNV(members) {
    // sort by raw leading edge
    var sorted = members.slice().sort(function (a, b) {
      return (a.x_axial_mm - a.L_raw_mm / 2) - (b.x_axial_mm - b.L_raw_mm / 2);
    });
    var first = sorted[0];
    var L_combined = first.L_raw_mm;
    for (var i = 1; i < sorted.length; i++) {
      var prev = sorted[i - 1];
      var cur  = sorted[i];
      var prevTrail = prev.x_axial_mm + prev.L_raw_mm / 2;
      var curLead   = cur.x_axial_mm  - cur.L_raw_mm / 2;
      var s_i = Math.max(0, curLead - prevTrail);   // spacing (clip overlap to 0)
      L_combined += s_i + cur.L_raw_mm;
    }
    // Combined depth = MAX member depth (conservative). Interacting defects rupture at a LOWER
    // pressure than any member alone, so the deepest point must govern the merged profile. A
    // length-weighted mean (used here previously) let a shallow neighbour dilute and MASK a deep
    // defect — non-conservative: an 89%-wall pit could be reported PASS. Matches the Mod-B31G / POF
    // merge. (DNV-RP-F101 §3.7 still sets the interaction criterion + the end-to-end combined length.)
    var d_combined = 0;
    for (var k = 0; k < sorted.length; k++) {
      if (sorted[k].d_raw_mm > d_combined) d_combined = sorted[k].d_raw_mm;
    }
    var x_start = sorted[0].x_axial_mm - sorted[0].L_raw_mm / 2;
    var x_end   = sorted[sorted.length - 1].x_axial_mm
                + sorted[sorted.length - 1].L_raw_mm / 2;
    var W_combined = _envelopeWidth(sorted, /*useRaw=*/true);
    return {
      L_combined: L_combined,
      d_combined: d_combined,
      W_combined: W_combined,
      x_start: x_start,
      x_end: x_end
    };
  }

  function _mergeB31G(members) {
    var sorted = members.slice().sort(function (a, b) {
      return (a.x_axial_mm - a.L_raw_mm / 2) - (b.x_axial_mm - b.L_raw_mm / 2);
    });
    var first = sorted[0];
    var L_combined = first.L_raw_mm;
    for (var i = 1; i < sorted.length; i++) {
      var prev = sorted[i - 1];
      var cur  = sorted[i];
      var prevTrail = prev.x_axial_mm + prev.L_raw_mm / 2;
      var curLead   = cur.x_axial_mm  - cur.L_raw_mm / 2;
      var s_i = Math.max(0, curLead - prevTrail);
      L_combined += s_i + cur.L_raw_mm;
    }
    var d_combined = -Infinity;
    for (var k = 0; k < sorted.length; k++) {
      if (sorted[k].d_raw_mm > d_combined) d_combined = sorted[k].d_raw_mm;
    }
    var x_start = sorted[0].x_axial_mm - sorted[0].L_raw_mm / 2;
    var x_end   = sorted[sorted.length - 1].x_axial_mm
                + sorted[sorted.length - 1].L_raw_mm / 2;
    var W_combined = _envelopeWidth(sorted, /*useRaw=*/true);
    return {
      L_combined: L_combined,
      d_combined: d_combined,
      W_combined: W_combined,
      x_start: x_start,
      x_end: x_end
    };
  }

  function _mergePOF(members) {
    // POF-100 §7 — combined reporting for an interaction cluster:
    //   L_combined : sum of member lengths with positive-only spacings, i.e.
    //     L1 + Σ max(0, sᵢ) + Σ Lᵢ_subsequent. Overlapping pits collapse
    //     their overlap to zero spacing — same algorithm POF worked examples
    //     use to feed the merged anomaly into the failure-pressure equation.
    //   W_combined : circumferential envelope (max W + sideways offset).
    //   d_combined : max member depth (POF reports the deepest pit).
    var sorted = members.slice().sort(function (a, b) {
      return (a.x_axial_mm - a.L_raw_mm / 2) - (b.x_axial_mm - b.L_raw_mm / 2);
    });
    var L_combined = sorted[0].L_raw_mm;
    for (var i = 1; i < sorted.length; i++) {
      var prev = sorted[i - 1];
      var cur  = sorted[i];
      var prevTrail = prev.x_axial_mm + prev.L_raw_mm / 2;
      var curLead   = cur.x_axial_mm  - cur.L_raw_mm / 2;
      var s_i = Math.max(0, curLead - prevTrail);
      L_combined += s_i + cur.L_raw_mm;
    }
    var d_max = -Infinity;
    for (var j = 0; j < sorted.length; j++) {
      if (sorted[j].d_raw_mm > d_max) d_max = sorted[j].d_raw_mm;
    }
    var x_start = sorted[0].x_axial_mm - sorted[0].L_raw_mm / 2;
    var x_end   = sorted[sorted.length - 1].x_axial_mm
                + sorted[sorted.length - 1].L_raw_mm / 2;
    var W_combined = _envelopeWidth(sorted, /*useRaw=*/true);
    return {
      L_combined: L_combined,
      d_combined: d_max,
      W_combined: W_combined,
      x_start: x_start,
      x_end: x_end
    };
  }

  /** Circumferential envelope width: project each member onto an arc-line
   *  modulo 360° and take the maximum extent. Cheap-and-correct version:
   *  unwrap relative to the first member's centre, then compute span.
   *  When `useRaw` is true, uses W_raw_mm rather than the tolerance-expanded
   *  W_mm — for downstream calc-of-record reporting. */
  function _envelopeWidth(members, useRaw) {
    if (members.length === 0) return 0;
    var pickW = function (m) { return useRaw ? m.W_raw_mm : m.W_mm; };
    if (members.length === 1) return pickW(members[0]);
    var D = 0;
    for (var i = 0; i < members.length; i++) {
      if (members[i].D_mm > D) D = members[i].D_mm;
    }
    if (!(D > 0)) {
      // no diameter — fall back to max W
      var wMax = 0;
      for (var k = 0; k < members.length; k++) {
        if (pickW(members[k]) > wMax) wMax = pickW(members[k]);
      }
      return wMax;
    }
    var ref = members[0].theta_deg;
    var lo = +Infinity, hi = -Infinity;
    for (var j = 0; j < members.length; j++) {
      var dtheta = members[j].theta_deg - ref;
      // shortest signed delta to ref
      if (dtheta > 180)  dtheta -= 360;
      if (dtheta < -180) dtheta += 360;
      var centreMm = dtheta * Math.PI * D / 360;
      var loEdge = centreMm - pickW(members[j]) / 2;
      var hiEdge = centreMm + pickW(members[j]) / 2;
      if (loEdge < lo) lo = loEdge;
      if (hiEdge > hi) hi = hiEdge;
    }
    return hi - lo;
  }

  // -------------------------------------------------------------------------
  // RULES table — exposed for testability per spec.
  // Each rule object: { name, ref, interact(a,b,ctx), merge(members) }.
  // -------------------------------------------------------------------------
  var RULES = {
    dnv: {
      name: "DNV-RP-F101 §3.7",
      ref: REF_DNV,
      interact: function (a, b, ctx) { return _interactDNV(a, b, ctx.D, ctx.t); },
      merge: _mergeDNV
    },
    modb31g: {
      name: "ASME B31G-2012 / Modified B31G (§3.4.5 + Kiefner & Vieth 1989)",
      ref: REF_MODB31G,
      interact: function (a, b, ctx) {
        return _interactB31G(a, b, ctx.t, ctx.b31g_axial_threshold_mm);
      },
      merge: _mergeB31G
    },
    b31g: {
      name: "ASME B31G-2012 / Modified B31G (§3.4.5 + Kiefner & Vieth 1989)",
      ref: REF_B31G,
      interact: function (a, b, ctx) {
        return _interactB31G(a, b, ctx.t, ctx.b31g_axial_threshold_mm);
      },
      merge: _mergeB31G
    },
    pof: {
      name: "POF-100 (2021) §6, §7",
      ref: REF_POF,
      interact: function (a, b, ctx) { return _interactPOF(a, b, ctx.t); },
      merge: _mergePOF
    }
  };

  // -------------------------------------------------------------------------
  // cluster(features, opts) — main entry point.
  //
  // Steps:
  //   1. De-duplicate by id (last write wins; per-spec a duplicate id collapses
  //      to a single feature so it returns one cluster of size 1).
  //   2. Sort by x_axial_mm.
  //   3. Expand each by tool tolerance (API 1163 §7.2.4).
  //   4. Build interaction graph (O(n²) — fine for typical n ≤ 20,000 ILI runs
  //      since rule-checks are cheap; would switch to axial-bin sweep for n>1e5).
  //   5. Union-find → connected components → clusters.
  //   6. Apply rule-specific merge to each cluster.
  // -------------------------------------------------------------------------
  function cluster(features, opts) {
    opts = opts || {};
    var ruleKey = String(opts.rule || "dnv").toLowerCase();
    var rule = RULES[ruleKey] || RULES.dnv;

    // Empty input → empty output (spec).
    if (!features || features.length === 0) return [];

    // Resolve global geometry context.
    var D_global = (+opts.D_mm > 0) ? +opts.D_mm : null;
    var t_global = (+opts.t_mm > 0) ? +opts.t_mm : null;

    var defaults = {
      tol_axial_mm: opts.tool_tol_axial_mm != null ? +opts.tool_tol_axial_mm : DEFAULT_TOL_AXIAL_MM,
      tol_circ_mm:  opts.tool_tol_circ_mm  != null ? +opts.tool_tol_circ_mm  : DEFAULT_TOL_CIRC_MM,
      tol_depth_frac: opts.tool_tol_depth_frac != null ? +opts.tool_tol_depth_frac : DEFAULT_TOL_DEPTH_FRAC,
      D_mm: D_global,
      t_mm: t_global
    };

    // Step 1 — de-dupe by id (preserve last occurrence's data).
    var seen = {}, dedup = [];
    for (var i = 0; i < features.length; i++) {
      var f = features[i];
      if (f == null) continue;
      var key = (f.id != null) ? String(f.id) : ("__anon_" + i);
      if (seen[key] != null) {
        dedup[seen[key]] = f;  // overwrite with later version
      } else {
        seen[key] = dedup.length;
        dedup.push(f);
      }
    }

    // Step 2 — sort by x_axial_mm.
    dedup.sort(function (a, b) {
      return (+a.x_axial_mm || 0) - (+b.x_axial_mm || 0);
    });

    // Step 3 — expand each by tool tolerance (API 1163 §7.2.4).
    var expanded = dedup.map(function (f) { return _expandByTolerance(f, defaults); });

    // Derive a per-cluster context (D, t) — prefer global opts, then per-feature.
    function ctxFor(idxs) {
      var D = D_global, t = t_global;
      if (!(D > 0)) {
        for (var i = 0; i < idxs.length; i++) {
          if (expanded[idxs[i]].D_mm > 0) { D = expanded[idxs[i]].D_mm; break; }
        }
      }
      if (!(t > 0)) {
        for (var j = 0; j < idxs.length; j++) {
          if (expanded[j].t_mm > 0) { t = expanded[j].t_mm; break; }
        }
      }
      return {
        D: D || 0,
        t: t || 0,
        b31g_axial_threshold_mm: opts.b31g_axial_threshold_mm
      };
    }

    // Step 4 — build interaction edges.
    var n = expanded.length;
    var uf = _makeUF(n);
    // Edge enumeration is O(n²); since the spec emphasises clarity over
    // optimality at typical ILI batch sizes (200–2000), pairwise is fine.
    for (var p = 0; p < n; p++) {
      for (var q = p + 1; q < n; q++) {
        var ctx = ctxFor([p, q]);
        if (rule.interact(expanded[p], expanded[q], ctx)) {
          uf.union(p, q);
        }
      }
    }

    // Step 5 — group by root.
    var groups = {};
    for (var k = 0; k < n; k++) {
      var r = uf.find(k);
      (groups[r] = groups[r] || []).push(k);
    }

    // Step 6 — emit clusters.
    var clusters = [];
    var cIdx = 0;
    Object.keys(groups).forEach(function (rootKey) {
      var idxs = groups[rootKey];
      var members = idxs.map(function (ix) { return expanded[ix]; });
      var member_ids = members.map(function (m, j) {
        return m.id != null ? m.id : ("__anon_" + idxs[j]);
      });
      var ctx = ctxFor(idxs);
      var merged = rule.merge(members);

      // Regime tag for engineer-readable UI badge.
      var regime = "single";
      if (members.length > 1) {
        if (ruleKey === "pof") regime = "interaction-box";
        else if (ruleKey === "dnv") regime = "axially-aligned";
        else regime = "axial-cluster";
      }

      clusters.push({
        id: "C" + (++cIdx),
        rule: rule.name,
        ref: rule.ref,
        member_ids: member_ids,
        n_members: members.length,
        x_start: merged.x_start,
        x_end: merged.x_end,
        L_combined: merged.L_combined,
        W_combined: merged.W_combined,
        d_combined: merged.d_combined,
        regime: regime,
        D_mm: ctx.D,
        t_mm: ctx.t
      });
    });

    // Stable order: sort returned clusters by x_start for engineer convenience.
    clusters.sort(function (a, b) { return a.x_start - b.x_start; });
    // Re-number so cluster ids align with axial position post-sort.
    for (var ci = 0; ci < clusters.length; ci++) {
      clusters[ci].id = "C" + (ci + 1);
    }
    return clusters;
  }

  // -------------------------------------------------------------------------
  // Public surface — exported per spec.
  // -------------------------------------------------------------------------
  var Interaction = {
    cluster: cluster,
    RULES: RULES,
    _clockToDeg: _clockToDeg,
    _expandByTolerance: _expandByTolerance,
    _interactDNV: _interactDNV,
    _interactPOF: _interactPOF,
    _interactB31G: _interactB31G,
    _axialGap: _axialGap,
    _circGap: _circGap,
    _arcMm: _arcMm,
    DEFAULT_TOL_AXIAL_MM: DEFAULT_TOL_AXIAL_MM,
    DEFAULT_TOL_CIRC_MM:  DEFAULT_TOL_CIRC_MM,
    DEFAULT_TOL_DEPTH_FRAC: DEFAULT_TOL_DEPTH_FRAC
  };
  root.Interaction = Interaction;
  if (typeof module !== "undefined" && module.exports) module.exports = Interaction;
})(typeof window !== "undefined" ? window : this);
