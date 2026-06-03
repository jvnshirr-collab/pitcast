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
| **2nd basis — electrochemical (potentiodynamic)** | **123 pts**, LOO MAE **6.11 °C**, R² **0.93**, fit slope 4.10 (npj Materials Degradation 2025, DOI 10.1038/s41529-025-00563-0; austenitic-SS, with composition + test conditions). A **separate** correlation — never merged with G48 (slope 4.10 vs 2.04). Surfaced in the UI as a distinct, clearly-labeled estimate; **total CPT validation = 52 + 123 = 175 points across two bases.** |

**Honest bounds.** Lab ASTM G48 (6 % FeCl₃) basis, not service conditions. Individual alloys
miss by ≫MAE in leave-one-out (e.g. N06625 −23.6 °C). The UI returns a Student-t **prediction
interval**, not a bare point, with a screening caveat. **On the two bases:** the G48/FeCl₃
correlation is basis-limited to **52** points — a 5-agent, ~30-paper journal sweep confirmed that
G48-CPT-with-composition is genuinely scarce (it added only the wrought AL-6XN; weld-clad and
electrochemical points were **excluded** as off-basis / different-population). Rather than pad G48,
the abundant **electrochemical** literature now powers a *separate* correlation built on the
**123-point npj 2025 dataset** (single potentiodynamic method, with composition) → LOO MAE 6.11 °C,
R² 0.93. The G48 corpus is **never** padded with off-basis, weld, spec-range, or vendor
"approximate" values; the two bases are reported and surfaced independently.

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

**Independent equation re-derivation (2026-06-03).** Beyond the in-repo oracles (written by the same
author, so not fully independent), the de Waard-Milliams models were re-derived from the primary
papers and checked against the *deployed* engine. `CO2.deWaard1975` reproduces
`log₁₀(CR_mm/y) = 5.8 − 1710/T(K) + 0.67·log₁₀(pCO₂)` (de Waard & Milliams, *Corrosion* 31 (1975) 177)
to **< 0.1 %** vs an external hand-calculation (60 °C / 1 bar → 4.647 vs 4.648; 20 °C / 1 bar → 0.926
vs 0.927; 60 °C / 10 bar → 21.74 vs 21.7 mm/y). `CO2.deWaard1995` adds the documented fugacity
coefficient `log₁₀φ = (0.0031 − 1.4/T)·P` (P ≤ 250 bar, φ ≤ 1), the mass-transport term
`2.45·u^0.8/d^0.2·f_CO₂`, and the F_pH / F_scale corrections in series — matching de Waard, Lotz &
Dugstad, NACE Corrosion/95 Paper 128. The implementations are faithful to the published equations.

---

## 5. Independent cross-checks (journal harvest, 2026-06-03)

Cited spot-checks gathered from full-text literature (METU / ScienceDirect / Wiley). Every value is
table/text-stated (never read off a figure) and verified here.

**CPT — the electrochemical correlation predicts independent alloys to ≈1 °C.** PitCast's 2nd-basis
electrochemical CPT correlation (fit on the **austenitic** npj-2025 set) applied to cited
electrochemical CPT for alloys *outside* that fit:

| Alloy | PREN<sub>N30</sub> | Predicted | Measured | Δ | Source |
|---|--:|--:|--:|--:|---|
| **2205 / S31803** (duplex — *out of the austenitic fit*) | 38.1 | 59.9 °C | 59.6 °C | +0.3 | Deng 2008, Electrochim. Acta 53:5220 (DOI 10.1016/j.electacta.2008.02.047), 1 M NaCl |
| **2507 / S32750** (super-duplex — *out of fit*) | 44.6 | 86.3 °C | 87.5 °C | −1.2 | Deng 2008, same |
| 254 SMO / S31254 (super-austenitic) | 45.4 | 89.5 °C | 89 °C | +0.5 | Abd El Meguid 2007, Corros. Sci. 49:263 (DOI 10.1016/j.corsci.2006.06.011), 4 % NaCl |

The two **duplex** alloys are genuine *out-of-sample* points (the npj corpus is austenitic-only), yet
the correlation reproduces their measured CPT within **1.2 °C** — independent corroboration that the
PREN<sub>N30</sub>→CPT map holds across austenitic *and* duplex CRAs. (254 SMO may overlap the
austenitic corpus → consistency check.) Reproducible: `PitCast.cptMeanElec({Cr,Mo,N})`. The chloride
dependence the PREN-only map omits is visible in the same source (254 SMO: 89/67/57 °C at 4/10/30 % NaCl).

**Burst — B31G stays conservative beyond its thin-wall domain.** Li et al. 2019 (*J. Hazard. Mater.*
366:65, DOI 10.1016/j.jhazmat.2018.11.089) report 9 full-scale internal-pressure burst tests of
**P110 OCTG tubing** with machined grooves (OD 73, t 5.5 mm, σ<sub>y</sub> 760 MPa, **D/t ≈ 13.3 —
thick-wall, outside ASME B31G's thin-wall D/t > 20 domain**). Through `b31g.js`: original-B31G predicts
**0.72× the measured burst, 9/9 conservative**; Modified-B31G 0.97×. So B31G's safe-side bias extends
even into thick-wall OCTG. **Kept separate from the 75-specimen thin-wall corpus** (which the Zhou &
Huang 2012 comparison is calibrated to) — an out-of-domain robustness note, not a headline-stat input.

**CO₂ — independent reviews corroborate the "disagreement is the deliverable" framing.** Nešić 2007
(*Corros. Sci.* 49:4308, DOI 10.1016/j.corsci.2007.06.006; ~1,700 cites) and Simonsen et al. 2026
(*Processes* 14:170, DOI 10.3390/pr14010170) independently document that the open CO₂ models disagree
substantially. Mori & Bauernfeind 2004 (*Mater. Corros.* 55:164, DOI 10.1002/maco.200303746) find CPT
correlates *better* with Speidel's MARC than with PREN — i.e. PREN is an imperfect CPT predictor,
consistent with PitCast's "ranking-grade, read the interval" caveat. **Honest gap (confirmed by a
full-text search):** there is **no open, peer-reviewed, tabulated de Waard / NORSOK
predicted-vs-measured accuracy statistic with a stated n** — the strong databases (IFE / NORSOK
round-robins) are proprietary. So CO₂ has **no B31G/Zhou-Huang-equivalent external numeric cross-check**,
and none is manufactured here.

---

## 6. What this validation does and does not establish

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
