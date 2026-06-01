# PitCast

**An open, reproducible, uncertainty-quantified corrosion-screening console.**

PitCast is a browser-based tool for *screening-level* corrosion engineering: ranking
corrosion-resistant alloys for chloride pitting, estimating carbon-steel CO₂ ("sweet")
corrosion rates, checking sour-service acceptability against ISO 15156 / NACE MR0175,
and estimating the remaining strength of corroded pipe with ASME B31G. Every result
surfaces its governing equation, primary citation, calibration provenance, and
quantified uncertainty rather than hiding them.

It runs entirely client-side — no server, account, or telemetry — and ships with a
single-command benchmark that regenerates every reported figure from cited, openly
redistributable measured data, with no synthetic or fabricated points.

- **Live:** https://pitcast.austenite.org
- **Paper:** `docs/preprint/paper.md` (JOSS); long-form methods in `docs/preprint/METHODS-NOTE.md`
- **Archive (DOI):** [10.5281/zenodo.20466523](https://doi.org/10.5281/zenodo.20466523) — every tagged release is permanently archived on Zenodo
- **License:** Apache-2.0

> **Scope.** PitCast is a screening-grade research and educational artifact. It is
> **not** validated for final design and is not a substitute for alloy- or heat-specific
> qualification testing. It complements — never replaces — a qualified corrosion engineer.

## What it does

- **Pitting (CPT).** Critical-pitting-temperature correlation
  `CPT = 2.038·PREN_N30 − 32.73 °C` (PREN_N30 = Cr + 3.3·Mo + 30·N), recalibrated on the
  open Nyby et al. (2021) dataset — leave-one-out MAE **6.58 °C** (n = 51, ASTM G48 /
  FeCl₃ basis). Pitting risk is reported as a probability via a Student-*t* prediction
  interval, not a bare point estimate.
- **CO₂ corrosion ensemble.** Five canonical models (de Waard–Milliams 1975, de Waard
  1995, NORSOK M-506, NESC/Cassandra, Multicorp/FreeCorp) with an explicit
  **model-disagreement (envelope) view** that exposes where single-model estimates are unsafe.
  Each model carries its **validated accuracy** on the cited corpus, and `recommendModel()`
  names the best-fit with an honest spread caveat — see [`docs/CO2-WEDGE.md`](docs/CO2-WEDGE.md).
- **Sour-service spec.** ISO 15156 / NACE MR0175 decision tree returning citation-grounded
  acceptability verdicts.
- **Corroded-pipe fitness-for-service.** ASME B31G and Modified B31G (RSTRENG)
  remaining-strength estimates, plus batch assessment of in-line-inspection (ILI) defect lists.
- **Glass-box + Learn.** Every engine exposes its equation, citation, validity envelope,
  and uncertainty; an in-console **Learn** track gives live worked-example walkthroughs.

## Reproduce the benchmark

Requires Node.js (the app itself is dependency-free vanilla JS — no build step).

```bash
node benchmark/run.js       # regenerates results.json + REPORT.md from cited data
node benchmark/test-all.js  # 92 oracle assertions (standards worked examples) — the pre-deploy gate
```

The benchmark spans three validation domains, all built on cited measured data:

| Domain | Data | Headline result |
|---|---|---|
| Pitting CPT | n = 51 (Nyby 2021, ASTM G48 basis) | leave-one-out MAE 6.58 °C |
| CO₂ ensemble | 10 in-scope cases, 20–80 °C, 5 cited sources | models disagree ~10×; envelope brackets ~30% |
| Corroded-pipe burst | 52 full-scale tests, API 5L X42–X70, OD 273–864 mm (Benjamin 2016 MTI-JIP; Cronin 2000 Waterloo real-corrosion DB; Qi 2023; He & Zhao 2024) | Mod-B31G mean 0.766× measured, 96% conservative (50/52), MAPE 25.6% — matches Zhou & Huang 2012 (n=149) |

Every benchmark point is tabulated, in-envelope, and DOI-cited. See
`benchmark/INCLUSION-RULES.md` for the data-inclusion rules and the honest rejected-data log.

## Run locally

It is a static site — serve the repository root with any static file server:

```bash
python -m http.server 8137     # then open http://localhost:8137
# or:  npx serve .
```

## Cite

If you use PitCast, please cite it via `CITATION.cff` (GitHub's "Cite this repository"
button), or the JOSS paper once it is published.

## Limitations (honest)

- Screening-grade correlations — not mechanistic or design-qualified models.
- The open benchmark is small but **fully disclosed**: its value is reproducibility and
  transparency, not raw dataset size (large corrosion datasets remain proprietary).
- The CO₂ models are validated only inside their published envelope (T 20–150 °C,
  pH 3.5–6.5, pCO₂ ≲ 10 bar); high-pressure / supercritical CO₂ is out of scope and
  flagged as such by the tool.

## License

Apache-2.0 — see [`LICENSE`](LICENSE).
