/* test-units.js — oracle for the SI<->US presentation layer (units.js).
 * Conversions are pure; this project has a history of unit-factor bugs, so every
 * factor is pinned to a known reference value and round-tripped. Run: node benchmark/test-units.js */
"use strict";
const U = require("../units.js");

let pass = 0, fail = 0;
function ok(name, got, want, tol) {
  tol = tol === undefined ? 1e-6 : tol;
  const good = (typeof want === "number")
    ? Math.abs(got - want) <= tol * Math.max(1, Math.abs(want))
    : got === want;
  if (good) { pass++; }
  else { fail++; console.log(`  ✗ ${name}: got ${got}, want ${want}`); }
}

// --- known reference conversions (SI -> US) ---
U.setSystem("US");
ok("100 degC -> 212 degF", U.fromSI("temp", 100), 212);
ok("0 degC -> 32 degF",    U.fromSI("temp", 0), 32);
ok("-40 degC -> -40 degF", U.fromSI("temp", -40), -40);
ok("25.4 mm -> 1 in",      U.fromSI("length", 25.4), 1);
ok("1 bar -> 14.5037738 psi", U.fromSI("pressure_bar", 1), 14.503773773, 1e-5);
ok("70 bar -> 1015.26 psi", U.fromSI("pressure_bar", 70), 1015.264, 1e-4);
ok("1 kPa -> 0.14503774 psi", U.fromSI("pp_kPa", 1), 0.1450377377, 1e-6);
ok("100 MPa -> 14.503774 ksi", U.fromSI("stress_MPa", 100), 14.50377377, 1e-5);
ok("358 MPa(X52 SMYS) -> 51.9 ksi", U.fromSI("stress_MPa", 358), 51.923, 1e-3);
ok("1 mm/y -> 39.3700787 mpy", U.fromSI("rate_mmpy", 1), 39.3700787, 1e-5);
ok("1 m/s -> 3.280840 ft/s", U.fromSI("velocity", 1), 3.280839895, 1e-6);
ok("0.1 m -> 3.93701 in", U.fromSI("length_m", 0.1), 3.937007874, 1e-6);
ok("0.3048 m -> 12 in", U.fromSI("length_m", 0.3048), 12, 1e-5);
ok("0.1 mm/y -> 3.937 mpy", U.fromSI("rate_mmpy", 0.1), 3.93700787, 1e-5);

// --- US -> SI (input read-in) ---
ok("212 degF -> 100 degC", U.toSI("temp", 212), 100);
ok("1 in -> 25.4 mm",      U.toSI("length", 1), 25.4);
ok("14.5037738 psi -> 1 bar", U.toSI("pressure_bar", 14.503773773), 1, 1e-6);
ok("14.50377 ksi -> 100 MPa", U.toSI("stress_MPa", 14.50377377), 100, 1e-5);
ok("39.37 mpy -> 1 mm/y",  U.toSI("rate_mmpy", 39.3700787), 1, 1e-5);

// --- round-trips across every quantity ---
["temp","length","pressure_bar","pp_kPa","stress_MPa","rate_mmpy","velocity","length_m"].forEach(q => {
  const v = 73.21;
  ok(`round-trip ${q}`, U.toSI(q, U.fromSI(q, v)), v, 1e-9);
});

// --- SI system is identity (no conversion) ---
U.setSystem("SI");
ok("SI fromSI identity (temp)", U.fromSI("temp", 100), 100);
ok("SI fromSI identity (pressure)", U.fromSI("pressure_bar", 70), 70);
ok("SI toSI identity", U.toSI("stress_MPa", 358), 358);

// --- labels ---
ok("label temp SI", U.label("temp", "SI"), "°C");
ok("label temp US", U.label("temp", "US"), "°F");
ok("label pressure US", U.label("pressure_bar", "US"), "psi");
ok("label rate US", U.label("rate_mmpy", "US"), "mpy");
ok("label stress US", U.label("stress_MPa", "US"), "ksi");

// --- null/NaN passthrough (never crash a render) ---
ok("null passthrough", U.fromSI("temp", null, "US"), null);
ok("NaN passthrough", Number.isNaN(U.fromSI("temp", NaN, "US")), true);
ok("undefined passthrough", U.toSI("length", undefined, "US"), undefined);

// --- unknown quantity throws (fail loud) ---
let threw = false; try { U.fromSI("bogus", 1, "US"); } catch (e) { threw = true; }
ok("unknown quantity throws", threw, true);

console.log(`\nunits.js: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
