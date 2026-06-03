# PitCast — Worked-Example Library

A small set of **fully reproducible** validation cases, one per core PitCast engine. Each example
takes a single cited specimen or alloy, walks the calculation through the engine step by step, and
compares the result to **cited measured / standard data**. Every number traces to a file in this
repository — nothing is hand-fabricated.

PitCast is an open-source corrosion **screening** tool (`docs/VALIDATION.md`, `docs/ENGINE-STATUS.md`).
These examples are meant to let a skeptical engineer reproduce a result and judge how far to trust it.

## The examples

| # | Example | Engine | Tier | Cited comparison |
|---|---|---|---|---|
| [01](01-cpt-pitting-317L.md) | **CPT / pitting** — Type 317 (S31700): PREN_N30 → predicted CPT | `pitcast.js` | ✅ Validated | Measured G48 CPT 28.9 °C vs predicted 30.6 °C (Δ +1.7 °C). Brigham & Tozer 1974. Plus 2205 duplex (Δ +3.4 °C). |
| [02](02-b31g-burst-IDTS14.md) | **Corroded-pipe burst** — IDTS 14 (X70): D,t,SMYS,L,d → predicted P_f | `b31g.js` | ✅ Validated + 📐 | Measured burst 26.7 MPa vs predicted 22.93 MPa (ratio 0.859, conservative). Benjamin et al. 2016. |
| [03](03-co2-ensemble-Nesic2007.md) | **CO₂ corrosion** — Nešić 2007 5 % CO₂ loop: the 5-model spread | `co2.js` | ✅ (as ensemble) + 📐 | Measured 2.0 ± 0.6 mm/y vs ensemble band 1.1–13.7 mm/y (12.6× spread, in-envelope). Nešić 2007. |

The **tier** column is from `docs/ENGINE-STATUS.md`:

- ✅ **Validated** — predictions checked against cited *measured* data, with reproducible tests/anchors.
- 📐 **Standard-reproducing** — faithfully implements + reproduces a named published standard/correlation.

## Source data (every number traces here)

| File | What it provides |
|---|---|
| `docs/VALIDATION.md` | The validated cases + headline numbers (LOO MAE, % conservative, envelope coverage). |
| `docs/ENGINE-STATUS.md` | The honest per-engine tier classification. |
| `benchmark/b31g-burst.json` | 75 real corroded-pipe burst specimens: inputs (D,t,SMYS,L,d) + measured burst + citations. |
| `benchmark/co2-inputs.json` | Machine-runnable structured inputs for each cited CO₂ case. |
| `data/validations.json` | Cited measured anchors (CPT FeCl₃, CO₂ field/lab) with source + DOI. |
| `data/grades.json` | Alloy compositions used by the CPT engine. |
| `data/measurements.json` | The full CPT measurement corpus (n = 52 FeCl₃-basis, Nyby 2021 + AL-6XN). |
| `data/cpt-electrochemical.json` | The separate electrochemical CPT corpus (n = 123, npj 2025). |
| `benchmark/results.json`, `benchmark/REPORT.md` | The regenerated metrics + per-case/per-specimen tables. |
| `b31g.js`, `co2.js`, `pitcast.js` | The engine source (function signatures used in each example). |

## How to reproduce everything

```sh
# Regenerate every headline figure (CPT LOO, CO2 ensemble, B31G burst) from cited data:
node benchmark/run.js          # writes benchmark/results.json + benchmark/REPORT.md

# Per-engine oracle tests (closed-form standard reproductions):
node benchmark/test-b31g.js    # 29 B31G assertions (incl. ASME App. B + Benjamin paper-reproduction)
node benchmark/test-co2.js     # 27 CO2 assertions (de Waard, NORSOK K_t, Crolet-Bonis pH)
```

Each example file also gives the exact in-app tab to enter the inputs, and a short Node REPL snippet
that reproduces the step-by-step arithmetic.

## Honest scope

These three cover the **core load-bearing engines**. The other core engines are
**standard-reproducing** (📐), not measured-data-validated, so they are not given a measured-vs-predicted
worked example here:

- `ffs.js` (API 579 FFS) and `mr0175.js` (ISO 15156 / NACE MR0175 sour service) reproduce their
  governing standards' worked examples / envelope boundaries; their verification lives in
  `benchmark/test-ffs.js` (18 oracles) and `benchmark/test-mr0175.js` (15 oracles).

PitCast is a screening / education tool. It does **not** establish fitness-for-service adequacy,
independent third-party V&V, or peer review (`docs/VALIDATION.md` §5). High-consequence integrity
decisions require a qualified engineer, verified inputs, and the full code procedures.
