# PitCast — Release notes for the first citable release

**Status: [DRAFT — release not yet tagged.]** Confirm the version tag and date,
then create a GitHub release; Zenodo will read `.zenodo.json` and mint a DOI for
the archive. Add the resulting DOI to `CITATION.cff` and to the methods note's
"Data and code availability" section once issued.

---

## What PitCast is

An open-source (Apache-2.0), browser-based corrosion-engineering **screening** tool
with a fully reproducible benchmark built only on cited, openly redistributable
measured data. It is a screening-grade research and portfolio artifact — **not**
validated for final design, not an industrial platform, and not a substitute for
alloy- or heat-specific qualification testing.

The contribution is open, transparent, reproducible, uncertainty-quantified
screening — not greater raw accuracy than commercial tools.

## Highlights of this release

- **Open, reproducible benchmark.** A single command, `node benchmark/run.js`,
  regenerates every reported figure (`benchmark/REPORT.md`, `benchmark/results.json`)
  from cited in-repository data. No synthetic or fabricated points; every case
  carries a primary citation (DOI or standard clause).

- **Calibrated probabilistic CPT model.** Pitting critical temperature from
  `PREN_N30 = Cr + 3.3·Mo + 30·N`, recalibrated on the open Nyby et al. (2021)
  dataset:
  - Leave-one-out MAE **6.58 °C** (RMSE 8.49 °C, bias −0.01 °C; n = 51, ASTM G48 /
    FeCl₃ basis).
  - Full-sample fit slope 2.0382, intercept −32.731, R² 0.834.
  - On-basis CRA anchor spot-check MAE **3.49 °C** (304, 316L, 317L, 2205).
  - Pitting probability reported through a Student-*t* prediction interval, not a
    point estimate.

- **Five-model CO₂ ensemble with a model-disagreement view.** de Waard–Milliams
  1975, de Waard 1995, NORSOK M-506:2017, NESC/Cassandra, and Multicorp/FreeCorp,
  run per cited case. Over the in-scope carbon-steel cases, NORSOK (MAE 2.16 mm/y)
  and de Waard 1995 (MAE 2.80 mm/y) are the reliable members; envelope coverage is
  **33 %**, honestly flagging where protective films make every bulk-flowline model
  over-predict.

- **Glass-box outputs.** Every number surfaces its governing equation, primary
  citation, calibration provenance, and uncertainty.

- **Verification & validation records** for the load-bearing engines (CPT, CO₂,
  B31G, MR0175) in `docs/vv/`, plus a standards-edition currency register in
  `docs/STANDARDS.md`.

- **Worked-example reproductions.** B31G reproduces ASME B31G-2012 Appendix B,
  Example 1 (P_safe ≈ 54.3 bar); MR0175 reproduces representative ISO 15156 / NACE
  MR0175 routing decisions, with 18 of 41 Annex A envelopes honestly flagged
  `needs_review` rather than reconstructed from memory.

## Known limitations (read before use)

- Screening-grade only; **not for final design** or as a substitute for
  qualification testing.
- The CO₂ benchmark is small (n = 3 in-scope carbon-steel cases) — indicative, not
  definitive.
- Self-validated; not yet externally peer-reviewed.
- CPT model is on a single G48/FeCl₃ basis and linear in PREN_N30 (largest
  leave-one-out residual −23.6 °C at the high-PREN extreme, N06625); treat extremes
  as ranking-only.
- API RP 581 detailed-RBI damage factors are on a 3rd-edition basis (4th ed. 2025
  delta tracked in `docs/STANDARDS.md`).

## Data and licence

- Code: Apache-2.0.
- Calibration dataset: Nyby, C. et al., *Scientific Data* **8**, 58 (2021), CC-BY,
  dataset DOI [10.6084/m9.figshare.13038257](https://doi.org/10.6084/m9.figshare.13038257).
- Live tool: <https://pitcast.austenite.org>.

## How to cite

See `CITATION.cff`. Once this release is archived on Zenodo, cite the version DOI
issued for the archive.

## Reproduce the results

```
node benchmark/run.js
```

This regenerates `benchmark/REPORT.md` and `benchmark/results.json` from the cited
data in `data/measurements.json`, `data/validations.json`, and
`benchmark/co2-inputs.json`.
