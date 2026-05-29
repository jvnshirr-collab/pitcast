# VR — CPT / PREN pitting model (`pitcast.js`)

**Intended use**: screening-level pitting-resistance ranking and P(pit) for
corrosion-resistant alloys in chloride service. **Not** a substitute for
alloy-/heat-specific qualification testing.

**Governing model**
- `CPT = 2.038·PREN_N30 − 32.73` on an **ASTM G48-type (FeCl₃ immersion)** basis,
  with `PREN_N30 = Cr + 3.3·Mo + 30·N`.
- Chloride adjustment (screening overlay), σ-phase degradation term, and a
  **Student-t prediction interval** (df = n−2) for P(pit) = P(CPT < T_service).
- Physical clamps: CPT_CEIL 120 °C, CPT_FLOOR −15 °C.

**Cited basis**: ASTM G48; Nyby C. et al., *Sci. Data* 8:58 (2021), CC-BY
(dataset DOI 10.6084/m9.figshare.13038257); primary CPT sources therein.

**Verification (math right)** — `benchmark/run.js` independently re-derives the
correlation from the in-repo records: slope **2.0382** (vs published 2.038176),
intercept **−32.731** (vs −32.730883), R² **0.834**. The JS port reproduces the
calibrated Python fit to 4 sig-figs — verification by reproduction.

**Validation (right vs reality)** — leave-one-out (out-of-sample) on the cited data:

| Metric | Value |
|---|---|
| LOO MAE (FeCl₃/G48 basis, n=51) | **6.58 °C** |
| LOO RMSE / bias | 8.49 / −0.01 °C |
| LOO MAE (all methods, n=117) | 13.33 °C |
| CRA anchor spot-check, on-basis MAE | 3.49 °C |

ASTM G48 **inter-laboratory reproducibility is itself ≈ ±10–15 °C**, so a 6.58 °C
LOO error is at or below the scatter of the test the model predicts — the model is
about as accurate as the measurement.

**Known limitations**
- G48/FeCl₃ basis. Electrochemical-NaCl CPT runs systematically higher
  (+14 to +25 °C in the spot-check, e.g. 254 SMO, 904L) — flagged, not corrected.
- Linear in PREN_N30: high-PREN Ni-base (e.g. N06625, PREN≈66) shows the largest
  LOO miss (−23.6 °C). Treat the extremes as ranking-only.
- Chloride/σ adjustments are screening overlays; crevice corrosion not separately modelled.

**Acceptance band**: ±10 °C screening (SVVP §4). **Reproduce**: `node benchmark/run.js` → §1.
