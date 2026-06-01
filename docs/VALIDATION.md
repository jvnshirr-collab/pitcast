# PitCast — Validation & Verification Summary

**Status:** open-source **screening-grade** corrosion tool. This document consolidates the
quantitative validation of PitCast's load-bearing engines against **cited, tabulated, measured
data** and against **independent peer-reviewed studies**. It is deliberately honest about
limitations: PitCast is *not* a qualified fitness-for-service tool and has not undergone
independent third-party V&V or formal peer review.

All headline numbers regenerate from `node benchmark/run.js` over only the cited data in this
repository (`data/measurements.json`, `data/validations.json`, `benchmark/*.json`). Data-inclusion
rules and the full rejected-data log are in `benchmark/INCLUSION-RULES.md`.

_Generated against benchmark state of 2026-06-01._

---

## 1. Pitting — Critical Pitting Temperature (CPT) correlation

| Item | Value |
|---|---|
| Model | `CPT = 2.0382·PREN_N30 − 32.731`  (PREN_N30 = Cr + 3.3·Mo + 30·N) |
| Validation | **Leave-one-out** (out-of-sample): refit on every subset excluding the held-out alloy |
| **LOO MAE (ASTM G48 / FeCl₃ basis)** | **6.58 °C** (n = 51), RMSE 8.49 °C, bias −0.01 °C |
| Full-sample fit | slope 2.0382, intercept −32.731, **R² 0.834** |
| Spot-check vs cited CRA anchors (on-basis) | MAE **3.53 °C** |
| Source | Nyby et al. 2021, *Sci. Data* 8:58 (CC-BY) — the principal open CPT dataset |

**Honest bounds.** The basis is **lab** ASTM G48 (6 % FeCl₃ immersion), not service conditions.
Individual alloys can miss by ≫MAE in leave-one-out — e.g. N06625 −23.6 °C, S31266 +19.5 °C,
S32050 +18.4 °C. The UI returns a Student-t **prediction interval**, not a bare point, and the
console carries a screening caveat directing critical selections to alloy/heat-specific G48 testing.

**On the n = 51 ceiling (audited 2026-06-01).** The repository holds **117** CPT records with
composition; exactly **51 are ferric-chloride/G48 basis** (the model's calibration basis). The
other 66 are electrochemical (NaCl) measurements — a *different* basis that would corrupt the
correlation, so they are correctly excluded from the headline fit. There are **no mislabelled
recoverable points**: 51 is the complete, correct open ceiling. Growing it requires new G48 CPT
data with composition from the (paywalled, scattered) journal literature; **the corpus is not
padded** with off-basis or "approximate" vendor values.

---

## 2. CO₂ corrosion — 5-model disagreement ensemble

| Item | Value |
|---|---|
| Models | de Waard 1975, de Waard-Milliams 1995, NORSOK M-506, NESC, FreeCorp |
| In-scope cited cases | **11** carbon-steel aqueous, 20–80 °C, 6 independent sources |
| **Envelope coverage** | **36 %** — the measurement falls inside the 5-model spread in 4/11 cases |
| Per-model MAE (mm/y) | DWM-1995 **1.13** (best) · NORSOK 2.87 · NESC 4.38 · FreeCorp 46.87 · DWM-1975 203.34 |

**Interpretation (the honest output).** The five open CO₂ models disagree by **~10× to >1000×**.
This domain is **not** a precise predictor and is presented as such: the **disagreement envelope is
the deliverable**, not any single number. At mild conditions (≲1 bar, 20–60 °C) the lower-bound
model (DWM-1995) tracks measured blank rates; single high-rate estimates over-predict by up to ~10×.
Two further cited cases (a 13Cr CRA, a top-of-line condensing case) are shown deliberately
**out-of-scope** to demonstrate the bulk-flowline models correctly failing. n = 11 is a small,
indicative spot-check — the large CO₂ loop databases (e.g. NORSOK/IFE) are proprietary.

---

## 3. Corroded-pipe burst — B31G / Modified-B31G

| Item | Value |
|---|---|
| Validation | predicted failure pressure (SF = 1) vs **measured burst**, specimen **actual yield** used as SMYS |
| **Specimens** | **52** full-scale bursts, **API 5L X42–X70**, OD **273–864 mm** |
| Modified-B31G | mean predicted/measured **0.766**, **96 % conservative (50/52)**, MAPE **25.6 %** |
| Original B31G | mean predicted/measured **0.695** |

**Sources & extraction.**
- **Benjamin et al. 2016**, *Int. J. Press. Vessels Pip.* 145 — MTI-JIP, 18 machined-defect IDTS
  (X70); double-verified against the primary tables; `b31g.js` reproduces the paper's own B31G
  predictions (IDTS 13 → 22.24 vs 22.2 MPa).
- **Cronin 2000**, PhD thesis, University of Waterloo (UWSpace open access) — **32 full-scale
  bursts of pipe sections from operating pipelines with single isolated REAL corrosion defects**
  (X42/X46/X52/X56). Tables extracted with PyMuPDF `find_tables()`; **every row geometry-verified**
  by reproducing Cronin's own tabulated original-B31G prediction with `b31g.js` (systematic
  −2…−6 % B31G-variant offset, same sign across all specimens → extraction confirmed). 8 of 40
  rows excluded (depth/length not cleanly extractable) — integrity over count.
- **Qi 2023** (Frontiers, open) — 1 X52 single-defect, verified against its Table 6.
- **He & Zhao 2024** (MDPI JMSE, open) — 1 X65 hydrostatic burst.

**Independent cross-validation.** PitCast's measured/predicted ratios match the peer-reviewed
**149-specimen** model-error study of **Zhou & Huang 2012**, *Int. J. Press. Vessels Pip.* 99–100
(DOI 10.1016/j.ijpvp.2012.06.001): their test/predicted **1.473** for B31G (→ predicted/measured
**0.679**) and **1.297** for Modified-B31G (→ **0.771**), versus PitCast's **0.695 / 0.766**. This
is external corroboration of `b31g.js` against a body of data ~3× larger than PitCast's own.

**Honest bounds.** B31G approximates real corrosion by max-depth + length; on real (irregular)
defects it is conservative *on average* but **not always** (hence 96 %, not 100 %) and carries
~25 % scatter — consistent with the literature. The UI labels every B31G/FFS verdict a **Level-1
screening band**, not a fitness-for-service determination.

---

## 4. Engine oracles (regression protection)

Closed-form worked examples from the standards are pinned in `benchmark/test-*.js` and run as a
**deploy gate** (121 assertions, all green): ASME B31G-2012 App. B Ex. 1; de Waard 1975/1995
fugacity + NORSOK M-506 K_t + Crolet-Bonis pH; API 579 Part 5/6/7 + NACE TM0284; ISO 15156
Annex-A boundaries.

---

## 5. What this validation does and does not establish

**Establishes:** the engines reproduce their governing standards (oracle suites), the CPT
correlation generalizes out-of-sample to **6.58 °C** on the open G48 corpus, the CO₂ ensemble
honestly exposes model disagreement, and the B31G engine is conservative and **agrees with a
149-specimen peer-reviewed study** over 52 cited bursts spanning many grades and diameters.

**Does NOT establish:** fitness-for-service adequacy, independent third-party V&V, or peer review.
PitCast remains a **screening / education** tool. High-consequence integrity decisions require a
qualified engineer, verified inputs, and the full code procedures. Data ceilings are real and
disclosed: CPT is basis-limited to n = 51 open G48 points; CO₂ in-envelope measured data is scarce
and largely proprietary.

**Reproducibility:** `node benchmark/run.js` regenerates `benchmark/REPORT.md` and
`benchmark/results.json` from the cited data. Nothing here is hand-edited.
