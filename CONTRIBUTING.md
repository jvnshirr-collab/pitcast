# Contributing to PitCast

PitCast is an open (Apache-2.0) corrosion-engineering screening tool. Its value is
**transparency, reproducibility, and cited provenance** — contributions must protect those.

## Non-negotiables

1. **Corrosion-only scope.** PitCast screens/quantifies corrosion and corrosion-adjacent
   hydrogen damage (pitting, CO₂, sour SSC/SCC, HIC/SOHIC, HTHA, CUI, galvanic, MIC,
   CP/AC, corroded-pipe FFS, CRA/MR0175 selection). It is **not** an RBI / fatigue /
   refractory / tank / PSM tool. Ask before adding: "is this corrosion?" If no, it
   belongs in a different project.
2. **No fabricated data.** Every measured datapoint, Tafel parameter, envelope, or
   threshold must carry a **primary citation** (DOI or standard clause). If you cannot
   cite it, flag it `needs_review` with null values — never guess. See
   `docs/STANDARDS.md` for the edition register.
3. **No commercial-vendor framing.** No pricing, license fees, entity/insurance, or
   stamp/audit ceremony. Cite standards (NSPE, ASME V&V 10, Apache 2.0) freely.
4. **Every output is glass-box.** A primary result must show its governing equation,
   citation, and validation tier (use `gbox()` / `tierTag()` in `app.js`).

## Before you open a PR

- [ ] Engine logic: run the engine's self-tests — `node <engine>.js` (e.g. `node co2.js`).
- [ ] Benchmark: `node benchmark/run.js` runs clean and `benchmark/REPORT.md` regenerates.
- [ ] If you touched a load-bearing engine (CPT, CO₂, B31G, MR0175), update its record in
      `docs/vv/VR/`.
- [ ] If you changed a standard's edition basis, update `docs/STANDARDS.md` + its changelog.
- [ ] UI change: bump `app.js?v=N` in `index.html` and verify all 13 tabs render with no
      console errors.

## Adding a benchmark case

See `benchmark/DATASET-SURVEY.md`. CPT → add a cited record to
`data/measurements.json`; CO₂ → add the cited case to `data/validations.json` +
structured inputs to `benchmark/co2-inputs.json`. Re-run `node benchmark/run.js`.

## Definition of done

See `docs/DEFINITION-OF-DONE.md` — an engine is "done" when it reproduces its cited
standard/data, shows its citation in-output, and (if load-bearing) has a VR record +
benchmark backing. Breadth is frozen (see the banner in `PLAN-tier3.md`); depth,
transparency, and validation are the priorities.
