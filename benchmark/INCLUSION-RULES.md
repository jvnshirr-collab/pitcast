# PitCast Benchmark — Data Inclusion Rules

_The benchmark's only value is that **every point is real and traceable**. A
small, fully-disclosed corpus is a transparency **strength**; a larger corpus
padded with figure-scraped or fabricated points destroys the entire claim. This
doc is the gate. When in doubt, **exclude**._

## A datapoint may enter the corpus only if ALL of these hold

1. **Tabulated numeric value** — read from a table or text, **not** estimated off
   a plotted figure. If the only source is a chart, it is **out** (digitised
   points carry uncontrolled reading error and cannot be independently checked).
2. **Cited + retrievable** — a specific source with a **DOI**, standard number,
   or stable identifier. "Personal communication", unlabelled vendor slides, and
   un-findable conference papers are **out**.
3. **In the tested model's envelope** — the conditions must lie inside the
   validity envelope of the engine being benchmarked (e.g. NORSOK M-506: T
   20–150 °C, pH 3.5–6.5). Out-of-envelope points are kept **only** when the
   explicit purpose is to show the model *correctly* failing (and are labelled
   `scope` ≠ in-scope so they are excluded from headline error stats).
4. **Fully specified conditions** — every input the engine consumes is given
   (composition / T / pCO₂ / pH / velocity / etc.). Missing a load-bearing
   input → **out** (no back-filling with assumptions).
5. **Corrosion scope** — the measurement is a corrosion quantity (CR, CPT, pit
   depth, metal loss, cracking acceptance). Non-corrosion data is out of scope
   for PitCast entirely.

## Recording a case

- Add it to the appropriate file with its source + DOI inline:
  - `data/validations.json` — CPT/CRA + CO₂ cited cases (carries `source`).
  - `benchmark/co2-inputs.json` — machine-runnable structured CO₂ inputs.
  - `data/measurements.json` — measured CPT records (each carries its own
    composition + test solution).
- Re-run `node benchmark/run.js` and update coverage **honestly** — report the
  new n and error, never round up. The report is auto-generated; do not hand-edit.
- Engine-oracle cases (closed-form worked examples from standards) go in the
  `benchmark/test-*.js` suites instead, anchored on the standard's documented
  numbers (e.g. ASME B31G-2012 App. B Ex. 1).

## Rejected — and why (honest log)

These were evaluated this development cycle and **excluded** under the rules above:

- **NACE Paper 11242, "Corrosion of Carbon Steel in High CO₂ Environment: Flow
  Effect"** (examined directly via library access, 2026-05-30): corrosion-rate
  results are presented only as bar charts (Figures 3–5), not tables — **rule 1**;
  and the test matrix spans pH 3 and pCO₂ 70 bar, outside the de Waard / NORSOK
  validity envelope (pH ≥ 3.5, pCO₂ ≲ 10 bar) — **rule 3**. The single in-envelope
  subset (pH 4, pCO₂ 10 bar, 25–50 °C) exists only inside the figures, so no clean
  tabulated point can be extracted without figure-reading. Excluded.
- Other figure-only CO₂ flow-effect data (values only on plots, no table) — rule 1.
- Extreme-condition lab cases far outside NORSOK/de Waard validity — rule 3
  (would only ever show the bulk-flowline model failing, which is expected).
- Conference papers whose full text could not be retrieved to confirm the exact
  conditions — rule 2.

**Standing note on corpus growth:** the binding constraint is *extractable,
tabulated, in-envelope, cited* measured data — not access. With METU library access
available, the readily-reachable CO₂ sources are either image-only PDFs (no
machine-readable table), figure-based, or run at out-of-envelope conditions
(supercritical / very-low-pH). Growth therefore stays opportunistic and honest: a
case is added only when a real tabulated in-envelope value with a retrievable
identifier is in hand. No point is added to inflate `n`.

Excluding these is the correct outcome, not a gap. The honest statement in the
methods/limitations stands: **the corpus is small but every point is disclosed
and reproducible** — which is more than the closed validation decks of
commercial corrosion tools offer.

## The one rule under all the others

**Never invent a datapoint, DOI, author, or condition.** A benchmark that lies
once is worthless forever. If a number cannot be sourced, it does not exist.
