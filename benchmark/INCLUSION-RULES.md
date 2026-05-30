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

**Open-access hunt, 2026-05-30 (library + OA search) — all examined and rejected:**
- NACE Paper 11242 (figure-based corrosion rates; pCO₂ to 70 bar — out of envelope).
- Bai et al., *Materials* 11(9):1765 (2018), J55 — corrosion rate only in Figures 4/13,
  pCO₂ 1.5–15 MPa (out of envelope + rule 1). DOI 10.3390/ma11091765.
- Dong et al., *Materials* 17(16):4046 (2024), ML model — only summary statistics
  (Table 1), raw points "cannot be publicly disclosed", supercritical-CO₂ training
  sources. DOI 10.3390/ma17164046.
- Yin et al., *Surf. Interface Anal.* 41(6):517 (2009), DOI 10.1002/sia.3057 — full text
  obtained via library (Wiley); high-pressure autoclave at **pCO₂ 4 MPa (40 bar), T
  50–180 °C** → out of envelope (rule 3); the study is corrosion-product-layer focused
  (SEM/XRD/XPS), weight-loss rate not tabulated at in-envelope conditions.
- CPT side: reachable duplex CPT values are either electrochemical-basis (ASTM G150 in
  NaCl — **not** the G48 / 6% FeCl₃ basis the PitCast correlation is calibrated on; a
  basis mismatch would corrupt the spot-check), or the open reviews tabulate only
  composition / PREN, not measured CPT.

**Five CO₂ sources examined, all out of envelope or figure-only** (incl. the
library-accessible ones). The in-envelope (≤10 bar) regime's measured data lives in
older paywalled NACE/AMPP papers (e.g. Gray 1989 CORROSION/89 Paper 464; Dugstad 1994
CORROSION/94) not reachable through the current subscriptions. A point is added the
moment such a source is in hand — not before.

Conclusion: no responsibly-addable point was found. The corpus is held at its
fully-trustworthy state (CPT n=51 leave-one-out; CO₂ small cited spot-check) rather
than admit a figure-read, out-of-envelope, or wrong-basis entry. That is the correct
outcome under these rules — integrity over a larger `n`.

Excluding these is the correct outcome, not a gap. The honest statement in the
methods/limitations stands: **the corpus is small but every point is disclosed
and reproducible** — which is more than the closed validation decks of
commercial corrosion tools offer.

## ✓ Added to the corpus (2026-05-30)

After the hunt above, one source cleared every rule and **was added**:
**254 SMO (UNS S31254) — CPT 65 °C by ASTM G48 Method E** (6% FeCl₃ immersion — the
same basis the PitCast CPT correlation is calibrated on), from Outokumpu, the alloy's
originator. On-basis, in-envelope, text-stated numeric value, labelled + stable source.
It is the first high-PREN (6Mo) point on the G48 spot-check: the engine predicts
61.3 °C vs the measured 65 °C (Δ −3.7 °C, within the 6.58 °C LOO MAE). The same source's
electrochemical (ASTM G150) value of 85 °C corroborates the existing 86.49 °C
electrochemical row.

**CO₂ (in-envelope, library-sourced):** Elgaddafi et al. 2015 (*J. Nat. Gas Sci. Eng.*
27:1620; DOI 10.1016/j.jngse.2015.10.034) — autoclave, 2% NaCl, 80 °C, **pCO₂ 4.1 &
6.2 bar (in-envelope)**, text-stated steady-state LPR rates 0.32 & 0.28 mm/y. These
**break the "all CO₂ out-of-envelope" wall** — and honestly show the bulk models
*over-predict* the deeply FeCO₃-scaled steady-state rate by ~4× (in-scope envelope
coverage 33%→20%): a real, documented limitation, surfaced not hidden.

**CO₂ (in-envelope, second independent source):** Peng et al. 2024 (*Materials* 17(5):1094;
DOI 10.3390/ma17051094, MDPI open access) — Table 1 blank L360N carbon steel,
**0.323 ± 0.005 mm/y**, 40 °C, CO₂-saturated (~0.93 bar), 5 wt% NaCl, 72 h weight-loss.
Measured 0.323 vs ensemble 0.5–5.06 (best model de Waard 1995 ≈ 0.5, ~1.5× over — the
closest fit of any case).

**CO₂ (more in-envelope sources):** Aristia et al. 2019 (*Materials* 12(22):3801; DOI
10.3390/ma12223801) — St-37, 0.16 mm/y at 70 °C, CO₂-purged geothermal brine, pH 4; and
Tang et al. 2018 (*Molecules* 23(12):3270; DOI 10.3390/molecules23123270) — Q235 blank
0.385 mm/y (converted from 0.345 g/m²·h, ρ 7.85) at 60 °C, CO₂-saturated 3.5% NaCl.

Net: **6 verified cases added** this session (1 CPT G48 + **5 in-envelope CO₂ from 4
independent sources** — Elgaddafi, Peng, Aristia, Tang). The CO₂ in-scope corpus went
**3 → 8**, spanning 40–80 °C. **All five in-envelope CO₂ points fall below the model
ensemble** — the active-corrosion screening models **over-predict real multi-day
weight-loss rates by ~1.3–4× (up to ~20× for heavily-scaled / long-exposure cases)**: a
robust, quantified, decision-relevant finding (in-scope coverage 13%), surfaced not hidden.

**New domain — B31G burst validation (19 cases):** added `benchmark/b31g-burst.json` —
19 full-scale / ring corroded-pipe burst tests with **measured burst pressure** (18 from
*Eng. Failure Analysis* 108:104284 Table 4, IDTS series, DOI 10.1016/j.engfailanal.2019.104284;
1 from Qi et al. 2023, X52). `run.js` now validates `b31g.js` against them using each
specimen's actual yield: Modified-B31G mean predicted/measured ratio **0.689 (100%
conservative, MAPE 31%)**, original B31G 0.659 — i.e. the engine is appropriately
conservative (never over-predicts a burst), matching the literature (~0.72). This is the
first **measured-failure** validation of the metal-loss engine, diversifying the benchmark
beyond CPT and CO₂.

**On "industry scale":** the large CO₂ databases that would give it (e.g. the ~2400-point
NORSOK / IFE loop database, 20–160 °C) are **proprietary** — which is precisely why an open
benchmark like this is needed. The open literature yields only scattered, mostly
figure-locked points, added here one verified case at a time; no point is fabricated or
figure-read to inflate scale.

## The one rule under all the others

**Never invent a datapoint, DOI, author, or condition.** A benchmark that lies
once is worthless forever. If a number cannot be sourced, it does not exist.
