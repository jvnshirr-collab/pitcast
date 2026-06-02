/*
 * units.js — SI <-> US-customary presentation layer for PitCast.
 *
 * WHY: US oil-&-gas / pipeline corrosion engineers work in psi, inches, mils/yr, degF, ksi.
 * ASME B31G in particular is a US standard whose users expect psi and inches. PitCast computes
 * EVERYTHING internally in SI; this module converts ONLY at the UI boundary (input read-in and
 * output display). No engine math depends on it. Conversions are pure and oracle-tested
 * (benchmark/test-units.js) because this project has a history of unit-factor bugs.
 *
 * Convention per quantity:  us_value = si_value * factor + offset ;  si_value = (us_value - offset) / factor
 * Exact factors (PA-based):
 *   1 psi = 6894.757293168 Pa  ->  1 bar(1e5 Pa) = 14.503773773 psi ; 1 kPa = 0.1450377377 psi ; 1 MPa = 0.1450377377 ksi
 *   1 in  = 25.4 mm (exact)    ->  1 mm = 0.0393700787 in
 *   1 mil = 0.0254 mm          ->  1 mm/y = 39.3700787 mpy
 *   degF  = degC * 1.8 + 32
 */
(function (global) {
  "use strict";

  // quantity key -> {si:{u}, us:{u, f(actor), o(ffset)}}
  var QUANTS = {
    temp:        { si: { u: "°C"  }, us: { u: "°F",  f: 1.8,           o: 32 } },
    length:      { si: { u: "mm"   },     us: { u: "in",   f: 0.03937007874, o: 0 } },
    pressure_bar:{ si: { u: "bar"  },     us: { u: "psi",  f: 14.503773773,  o: 0 } },
    pp_kPa:      { si: { u: "kPa"  },     us: { u: "psi",  f: 0.1450377377,  o: 0 } },
    stress_MPa:  { si: { u: "MPa"  },     us: { u: "ksi",  f: 0.1450377377,  o: 0 } },
    rate_mmpy:   { si: { u: "mm/y" },     us: { u: "mpy",  f: 39.3700787,    o: 0 } }
  };

  var SYS = "SI"; // "SI" | "US"

  function _q(q) {
    var d = QUANTS[q];
    if (!d) throw new Error("units: unknown quantity '" + q + "'");
    return d;
  }

  // value stored/computed in SI -> value to DISPLAY in the active (or given) system
  function fromSI(q, si, sys) {
    sys = sys || SYS;
    if (si === null || si === undefined || (typeof si === "number" && isNaN(si))) return si;
    if (sys === "SI") return si;
    var d = _q(q);
    return si * d.us.f + d.us.o;
  }

  // value ENTERED in the active (or given) system -> SI value to feed the engines
  function toSI(q, v, sys) {
    sys = sys || SYS;
    if (v === null || v === undefined || (typeof v === "number" && isNaN(v))) return v;
    if (sys === "SI") return v;
    var d = _q(q);
    return (v - d.us.o) / d.us.f;
  }

  // unit label for the active (or given) system
  function label(q, sys) {
    sys = sys || SYS;
    var d = _q(q);
    return sys === "SI" ? d.si.u : d.us.u;
  }

  // convenience: format an SI value for display with its unit, e.g. fmt('pressure_bar', 70, 1) -> "1015.3 psi" (US)
  function fmt(q, si, digits, sys) {
    sys = sys || SYS;
    var v = fromSI(q, si, sys);
    if (v === null || v === undefined || (typeof v === "number" && isNaN(v))) return String(v);
    var d = (digits === undefined || digits === null) ? 2 : digits;
    return v.toFixed(d) + " " + label(q, sys);
  }

  function setSystem(sys) {
    SYS = (sys === "US") ? "US" : "SI";
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem("pitcast.units", SYS);
    } catch (e) { /* private mode / unavailable */ }
    return SYS;
  }
  function getSystem() { return SYS; }

  // restore persisted preference in the browser
  try {
    if (typeof localStorage !== "undefined") {
      var saved = localStorage.getItem("pitcast.units");
      if (saved === "US" || saved === "SI") SYS = saved;
    }
  } catch (e) { /* ignore */ }

  var Units = {
    QUANTS: QUANTS,
    fromSI: fromSI,
    toSI: toSI,
    label: label,
    fmt: fmt,
    setSystem: setSystem,
    getSystem: getSystem
  };

  global.Units = Units;
  if (typeof module !== "undefined" && module.exports) module.exports = Units;
})(typeof window !== "undefined" ? window : this);
