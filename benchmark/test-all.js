#!/usr/bin/env node
/* test-all.js — run every PitCast benchmark / engine-oracle suite and exit
 * non-zero if any fails. This is the deploy gate (also invoked by deploy.sh).
 *
 *   node benchmark/test-all.js
 *
 * Suites:
 *   test-uq.js      — shared UQ framework math + CO2 standard-schema hook
 *   test-b31g.js    — B31G corroded-pipe oracle (ASME B31G-2012 App. B Ex. 1)
 *   test-ffs.js     — API 579 corrosion Parts 4/5/6/7 (embedded 29 + boundaries)
 *   test-mr0175.js  — ISO 15156 spec-issuer (embedded 10 + decision boundaries)
 *   run.js          — CPT leave-one-out + CO2 ensemble vs cited data (report only)
 */
'use strict';
const { execFileSync } = require('child_process');
const path = require('path');

const suites = ['test-uq.js', 'test-b31g.js', 'test-ffs.js', 'test-mr0175.js'];
let failed = 0;

for (const s of suites) {
  try {
    process.stdout.write(execFileSync('node', [path.join(__dirname, s)], { encoding: 'utf8' }));
  } catch (e) {
    failed++;
    if (e.stdout) process.stdout.write(e.stdout);
    if (e.stderr) process.stderr.write(e.stderr);
    console.error('  ✗ SUITE FAILED: ' + s);
  }
}

// run.js regenerates results.json/REPORT.md (always exits 0); run last so the
// report stays fresh, but it does not gate the deploy.
try { execFileSync('node', [path.join(__dirname, 'run.js')], { encoding: 'utf8' }); } catch (e) {}

console.log(failed ? ('\n✗ ' + failed + ' SUITE(S) FAILED — deploy blocked') : '\n✓ ALL BENCHMARK SUITES GREEN');
process.exit(failed ? 1 : 0);
