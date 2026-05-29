# An open, reproducible, uncertainty-quantified benchmark for screening-level corrosion prediction

**DRAFT methods note — not yet submitted.** Author/affiliation/venue are placeholders
for the author to confirm before submission. Every number here is reproduced by
`benchmark/run.js` in the PitCast repository; do not hand-edit figures — regenerate them.

**Author:** Javanshir Hasanov (confirm affiliation — e.g. Middle East Technical
University, Dept. of Metallurgical & Materials Engineering)
**Artifact:** PitCast — pitcast.austenite.org · Apache-2.0 · `benchmark/run.js`
**Suggested venues:** *Materials and Corrosion*, *npj Materials Degradation*, or a preprint server (arXiv cond-mat / ChemRxiv).

---

## Abstract

Commercial corrosion-prediction tools (OLI, Honeywell Predict, DNV) are accurate but
closed: their equations, calibration data, and validation decks are proprietary, and
they report point estimates rather than quantified uncertainty. We present an **open,
fully reproducible** screening-level corrosion benchmark built only on cited, openly
redistributable measured data. A pitting critical-temperature (CPT) correlation
recalibrated on the Nyby et al. (2021) open dataset achieves a **leave-one-out mean
absolute error of 6.58 °C** (RMSE 8.49 °C, n = 51, FeCl₃/G48 basis) — at or below the
inter-laboratory reproducibility of the ASTM G48 test it predicts. A five-model CO₂
corrosion ensemble is evaluated against cited field/lab cases with an explicit
**model-disagreement (envelope) metric** that exposes where single-model point estimates
are unsafe. The entire benchmark regenerates from one command, providing a transparent,
auditable reference that closed tools structurally cannot offer.

## 1. Introduction

Screening-level corrosion prediction underpins materials selection and integrity
decisions, yet the field lacks an **open, reproducible benchmark**. Published
model-comparison studies (e.g. reviews of de Waard–Milliams, NORSOK M-506, FreeCorp, OLI,
Predict) validate against proprietary or paper-specific data, so their results cannot be
independently reproduced or extended. Commercial tools are validated internally and ship
point estimates without transparent uncertainty. This note describes a small but fully
open and reproducible benchmark, and argues that **transparency + quantified uncertainty**
is a distinct and useful contribution independent of raw accuracy.

## 2. CPT correlation and uncertainty

We model the pitting critical temperature on an ASTM G48 (6 % FeCl₃ immersion) basis as a
linear function of the nitrogen-weighted pitting-resistance equivalent
`PREN_N30 = Cr + 3.3·Mo + 30·N`:

> CPT = a · PREN_N30 + b

Fitting on the FeCl₃-immersion subset of the Nyby et al. (2021) open dataset (n = 51)
gives **a = 2.038, b = −32.73, R² = 0.834**. Pitting probability is reported as
`P(pit) = P(CPT < T_service)` using a Student-t prediction interval (df = n − 2), which —
unlike a Gaussian — does not understate the tail at small n.

## 3. Validation

**Leave-one-out (out-of-sample).** Refitting the correlation on every n−1 subset and
predicting the held-out alloy yields **MAE 6.58 °C, RMSE 8.49 °C, bias −0.01 °C**
(n = 51). ASTM G48 inter-laboratory reproducibility is itself ≈ ±10–15 °C, so the model
is about as accurate as the measurement it predicts. Mixing electrochemical (1 M NaCl)
CPT with the FeCl₃ basis inflates the all-method LOO MAE to 13.33 °C (n = 117),
quantifying the importance of a consistent test basis.

**CRA anchor spot-check.** On the on-basis (FeCl₃) cited anchors (304, 316L, 317L, 2205),
predicted-vs-measured MAE is 3.49 °C; electrochemical-NaCl anchors (904L, 254 SMO) are
shown but excluded as off-basis.

**CO₂ ensemble.** Five published carbon-steel CO₂ models (de Waard–Milliams 1975; de Waard
1995; NORSOK M-506:2017; NESC/Cassandra; Multicorp/FreeCorp) are run per cited case. On the
in-scope carbon-steel cases, NORSOK (MAE 2.16 mm/y) and de Waard 1995 (MAE 2.8 mm/y) are the
reliable members; de Waard 1975 diverges by orders of magnitude at high T/P (no scale term),
a known conservative-only behaviour. We report an **envelope-coverage** metric — the fraction
of cases whose measurement falls within the model spread. Coverage is low because, where
protective FeCO₃/FeS films dominate (HP/HT and sour-sweet service), the measured rate falls
*below* every model: an honest, useful warning that single-model screening over-predicts in
those regimes.

## 4. The open benchmark

The benchmark is a single Node script (`benchmark/run.js`) operating on cited, in-repo data
(`data/measurements.json`, `data/validations.json`, `benchmark/co2-inputs.json`); it
regenerates `benchmark/REPORT.md`. No synthetic or fabricated data is used. New cases require
a primary citation (DOI or standard clause). This makes the benchmark **reproducible** and
**extensible** by anyone — properties no closed validation deck provides.

## 5. Discussion

The contribution is not "more accurate than OLI"; it is **open, transparent, reproducible,
and uncertainty-quantified**. The CPT correlation is recalibrated on public data anyone can
audit; the CO₂ disagreement view turns model uncertainty into an explicit, decision-relevant
band. **Limitations** are stated plainly: the CO₂ benchmark is small (indicative, not
definitive); the CPT model is on a G48 basis and is linear in PREN_N30 (larger residuals at
the high-PREN extreme); crevice corrosion and non-aqueous regimes are out of scope. The
planned extension is to grow the cited measured corpus toward 150–300 cases.

## 6. Code and data availability

PitCast is Apache-2.0 open source at pitcast.austenite.org. The benchmark, data, and
per-engine verification & validation records (`docs/vv/`) are in the repository. Reproduce
all figures with `node benchmark/run.js`.

## References (to complete)

- Nyby C. et al., *Scientific Data* **8**, 58 (2021), CC-BY, DOI 10.6084/m9.figshare.13038257.
- de Waard C., Milliams D.E., *Corrosion* **31** (1975) 177.
- de Waard C., Lotz U., Dugstad A., NACE Corrosion/95 Paper 128.
- NORSOK Standard M-506:2017.
- Nyborg R., *Energy Materials* **5** (2010) 91; Nešić S., *Corros. Sci.* **49** (2007) 4308.
- ASTM G48; ASTM G102-89(2015); ISO 15156-3:2020.
- (Add the specific cited CO₂ field/lab case sources from `data/validations.json`.)
