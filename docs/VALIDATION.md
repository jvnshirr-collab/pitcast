# PitCast — Validation & Verification Summary

**Status:** open-source **screening-grade** corrosion tool. This document consolidates the
quantitative validation of PitCast's load-bearing engines against **cited, tabulated, measured
data** and against **independent peer-reviewed studies**. It is deliberately honest about
limitations: PitCast is *not* a qualified fitness-for-service tool and has not undergone
independent third-party V&V or formal peer review.

All headline numbers regenerate from `node benchmark/run.js` over only the cited data in this
repository. Data-inclusion rules and the full rejected-data log are in
`benchmark/INCLUSION-RULES.md`. _Generated against benchmark state of 2026-06-01._

---

## 1. Pitting — Critical Pitting Temperature (CPT) correlation

| Item | Value |
|---|---|
| Model (deployed) | `CPT = 2.038·PREN_N30 − 32.73`  (PREN_N30 = Cr + 3.3·Mo + 30·N) |
| Validation | **Leave-one-out** (out-of-sample): refit on every subset excluding the held-out alloy |
| **LOO MAE (ASTM G48 / FeCl₃ basis)** | **6.6 °C** (n = 52), RMSE 8.45 °C, bias −0.01 °C |
| Full-sample data refit | slope 2.06, intercept −33.4, **R² 0.84** (deployed model held at 2.038/−32.73) |
| Spot-check vs cited CRA anchors (on-basis) | MAE **3.53 °C** |
| Sources | Nyby et al. 2021 *Sci. Data* 8:58 (51 FeCl₃ pts) + AL-6XN wrought base metal (Qian & DuPont, *Corros. Sci.* 2010, DOI 10.1016/j.corsci.2010.07.007, G48-97 immersion, CPT 74 °C) |

**Honest bounds.** Lab ASTM G48 (6 % FeCl₃) basis, not service conditions. Individual alloys
miss by ≫MAE in leave-one-out (e.g. N06625 −23.6 °C). The UI returns a Student-t **prediction
interval**, not a bare point, with a screening caveat. **On the open ceiling:** the repository
holds 118 CPT records; exactly **52 are ferric-chloride/G48 basis** (the model's calibration
basis) — the other 66 are electrochemical (NaCl), correctly excluded. G48 CPT *with composition*
is genuinely scarce in the open/journal literature (one wrought point, AL-6XN, was added this
cycle after a four-database journal sweep; superduplex weld-clad points were found but **excluded**
as a different metallurgical population). The corpus is **not** padded with off-basis or vendor
"approximate" values.

---

## 2. CO₂ corrosion — 5-model disagreement ensemble

| Item | Value |
|---|---|
| Models | de Waard 1975, de Waard-Milliams 1995, NORSOK M-506, NESC, FreeCorp |
| In-scope cited cases | **16** carbon-steel aqueous, 20–90 °C, 8 independent sources |
| **Envelope coverage** | **56 %** — measurement inside the 5-model spread in 9/16 cases |
| Per-model MAE (mm/y) | DWM-1995 **0.94** (best) · NORSOK 2.95 · NESC 3.06 · FreeCorp 32.59 · DWM-1975 140.32 |

**Interpretation (the honest output).** The five open CO₂ models disagree by **~10× to >1000×**.
This domain is **not** a precise predictor; the **disagreement envelope is the deliverable**. At
mild conditions (≲1 bar, 20–90 °C) the ensemble brackets measured blank rates well (hence 56 %
coverage over the expanded set), and the lower-bound model (DWM-1995, MAE 0.94 mm/y) tracks them;
the spread blows up and coverage fails for scaled / high-pCO₂ / long-exposure cases. Two cited
cases are shown deliberately **out-of-scope** (a 13Cr CRA, a top-of-line condensing case) to show
the bulk-flowline models correctly failing. n = 16 is still a small, indicative spot-check — the
large CO₂ loop databases (NORSOK/IFE) are proprietary, and most open CO₂ rates are figure-locked
or electrochemical (a 20-paper sweep this cycle yielded only the table/text-stated weight-loss
blanks admitted here).

---

## 3. Corroded-pipe burst — B31G / Modified-B31G

| Item | Value |
|---|---|
| Validation | predicted failure pressure (SF = 1) vs **measured burst**, specimen **actual yield** as SMYS |
| **Specimens** | **75** full-scale bursts, **API 5L A25–X80**, OD **76–864 mm**, real + machined defects |
| **Original B31G** | mean predicted/measured **0.678**, **100 % conservative (75/75)**, MAPE 32.2 % |
| Modified B31G | mean predicted/measured **0.822**, **80 % conservative (60/75)**, MAPE 24 % |

**Sources & extraction** (each row verified by reproducing the paper's *own* B31G prediction with `b31g.js`):
- **Benjamin et al. 2016** (IJPVP 145, MTI-JIP) — 18 machined IDTS (X70).
- **Cronin 2000** (Waterloo PhD, UWSpace open) — **32** operating-pipeline sections, single **real**
  corrosion defects (X42–X56). PyMuPDF table extraction; verified to a systematic −2…−6 % B31G-variant offset.
- **Souza/Benjamin "Part 4" 2007** (Exp. Tech., DOI …00134.x, Wiley) — **7** real-corrosion bursts (X42/X46);
  `b31g.js` reproduces the paper's B31G **exactly (0.0 %)**.
- **Freire/Benjamin "Part 3" 2006** (Exp. Tech., DOI …00109.x, Wiley) — **16** machined single defects
  (X60/X80/X46/A25, OD 76–508 mm); reproduced to ≤2.3 %.
- **Qi 2023** (Frontiers, open) — 1 X52. **He & Zhao 2024** (MDPI JMSE, open) — 1 X65.

**Independent cross-validation.** PitCast's **original-B31G 0.678** (100 % conservative) matches the
peer-reviewed **149-specimen** model-error study of **Zhou & Huang 2012** (IJPVP 99–100; their
test/predicted 1.473 → predicted/measured **0.679**) — near-exact agreement over a body ~2× larger
than PitCast's own corpus. Their Modified-B31G (0.771) sits between PitCast's 0.822 and the
conservative end; the difference reflects the deep-defect (d/t≈0.7) machined specimens in the
expanded set, where Modified-B31G is known to be **non-conservative** (hence 80 %, not 100 %).
**Decision-relevant takeaway: original B31G is the safe-side choice (100 % conservative here);
Modified-B31G over-predicts some deep/low-grade defects.**

---

## 4. Engine oracles (regression protection)

Closed-form worked examples from the standards run as a **deploy gate** (121 assertions, all green):
ASME B31G-2012 App. B Ex. 1; de Waard 1975/1995 fugacity + NORSOK M-506 K_t + Crolet-Bonis pH;
API 579 Part 5/6/7 + NACE TM0284; ISO 15156 Annex-A boundaries.

---

## 5. What this validation does and does not establish

**Establishes:** the engines reproduce their governing standards; the CPT correlation generalizes
out-of-sample to **6.6 °C** on the open G48 corpus; the CO₂ ensemble honestly exposes model
disagreement; and the B31G engine is conservative (original B31G 100 %) and **agrees with a
149-specimen peer-reviewed study** over **75** cited bursts spanning A25–X80 and 76–864 mm.

**Does NOT establish:** fitness-for-service adequacy, independent third-party V&V, or peer review.
PitCast remains a **screening / education** tool. High-consequence integrity decisions require a
qualified engineer, verified inputs, and the full code procedures. Data ceilings are real and
disclosed: CPT is basis-limited (G48 + composition is scarce); CO₂ in-envelope measured data is
mostly proprietary or figure-locked.

**Reproducibility:** `node benchmark/run.js` regenerates `benchmark/REPORT.md` +
`benchmark/results.json` from the cited data. Nothing here is hand-edited.
