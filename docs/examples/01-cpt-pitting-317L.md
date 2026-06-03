# Worked Example 1 — CPT / pitting (PREN_N30 → predicted CPT)

**Engine:** `pitcast.js` — CRA pitting / CPT / PREN
**Tier:** ✅ **Validated** (per `docs/ENGINE-STATUS.md`) — `CPT = f(PREN_N30)` on two separate
measurement bases; ASTM G48 / FeCl₃ basis: leave-one-out MAE **6.6 °C** (n = 52, Nyby 2021).
**Reproduces:** the calibrated correlation `CPT = 2.038176·PREN_N30 − 32.730883`.

This example takes one cited stainless steel, computes its nitrogen-weighted PREN, predicts the
Critical Pitting Temperature on the ASTM G48 (6 % FeCl₃) basis, and compares to a **cited measured
G48 CPT**. The point of the example is also to show the **prediction interval** — for a screening
correlation the band, not the bare number, is the decision-relevant output.

---

## Alloy & inputs

**Type 317 stainless (UNS S31700)** — composition from `data/grades.json` (line 11):

| Element | Cr | Ni | Mo | N | Mn | C |
|---|--:|--:|--:|--:|--:|--:|
| wt % | 19.0 | 13.0 | 3.2 | 0.05 | 1.6 | 0.05 |

Only Cr, Mo, N enter the CPT descriptor.

---

## Step-by-step expected output

### Step 1 — PREN_N30 (the CPT descriptor)

`pitcast.js` uses the **N×30** pitting descriptor (not the reported N×16 PREN):

```
PREN_N30 = Cr + 3.3·Mo + 30·N
         = 19.0 + 3.3·(3.2) + 30·(0.05)
         = 19.0 + 10.56 + 1.50
         = 31.06
```

### Step 2 — Predicted CPT (ASTM G48 / FeCl₃ basis)

```
CPT = 2.038176·PREN_N30 − 32.730883
    = 2.038176·(31.06) − 32.730883
    = 63.306 − 32.731
    = 30.57 °C        (engine: cptMean → 30.574863…; report rounds to 30.6 °C)
```

### Step 3 — Prediction interval (the honest output)

The engine returns a Student-t prediction interval, not a bare point. The standard error grows away
from the fit centroid (`prenMean = 36.17`, `n = 51`, `resid = 8.033`, `sxx = 3821.56`):

```
se = resid·√(1 + 1/n + (PREN_N30 − prenMean)² / sxx)
   = 8.033·√(1 + 1/51 + (31.06 − 36.17)² / 3821.56)
   = 8.14 °C          (engine: cptSE → 8.1386…)
```

So the screening read is **CPT ≈ 31 °C, with a 1σ scatter of ≈ ±8 °C** — i.e. a ~95 % t-interval
of roughly **14–47 °C**. Treat 317 as marginal for pitting much above ambient in aggressive
chlorides; confirm any critical selection with alloy/heat-specific G48 testing.

---

## Comparison to cited measured data

| Quantity | Value | Source |
|---|--:|---|
| **Measured CPT (317L, FeCl₃)** | **28.9 °C** | Brigham & Tozer, *Corrosion* 30 (1974) 161 (DOI 10.5006/0010-9312-30.5.161) |
| Predicted CPT (G48 basis) | 30.6 °C | `pitcast.js` `cptMean` |
| **Δ (predicted − measured)** | **+1.7 °C** | well inside the 6.6 °C LOO MAE and the ±8 °C interval |

This is the "317L stainless – CPT in ferric chloride" anchor in `data/validations.json` and the
on-basis spot-check row in `benchmark/REPORT.md` §2 (predicted 30.6, Δ +1.7). The cited heat is
19Cr-14Ni-3.1Mo; the catalogue grade matched by the harness is the nominal 317 (S31700) above.

### Second on-basis check — 2205 duplex (UNS S32205)

Same procedure, composition from `data/grades.json` (Cr 22.0, Mo 3.1, N 0.17):

```
PREN_N30 = 22.0 + 3.3·(3.1) + 30·(0.17) = 22.0 + 10.23 + 5.10 = 37.33
CPT      = 2.038176·37.33 − 32.730883 = 43.35 °C   (report rounds to 43.4 °C)
```

| Quantity | Value | Source |
|---|--:|---|
| Measured CPT (2205, acidified FeCl₃) | 40 °C | Hoseinpoor et al., *Corros. Sci.* 80 (2014) 197 (DOI 10.1016/j.corsci.2013.11.023) |
| Predicted CPT (G48 basis) | 43.4 °C | `pitcast.js` |
| **Δ** | **+3.4 °C** | within LOO MAE |

The two on-basis cases (317L Δ +1.7, 2205 Δ +3.4) are part of the **3.53 °C on-basis MAE** spot-check
in `benchmark/REPORT.md` §2.

---

## Honest limitations

- **Basis matters.** This correlation is on the **ASTM G48 / 6 % FeCl₃** immersion basis only. A
  *separate* electrochemical (potentiodynamic) correlation exists (`cptMeanElec`, slope 4.10,
  n = 123, npj 2025) and is **never merged** with this one — the two scale differently with PREN
  (e.g. 2205 on the electrochemical fit ≈ 56.7 °C, not 43 °C). Do not compare a G48 prediction to a
  1 M NaCl electrochemical measurement; `benchmark/REPORT.md` deliberately shows the off-basis 904L
  and 254 SMO NaCl rows missing by −14.5 / −25.2 °C to make exactly this point.
- Individual alloys can miss by ≫ MAE in leave-one-out (worst case N06625, −24.2 °C — see
  `benchmark/REPORT.md` §1). **Read the interval, not the point.**
- Screening / education only — not a fitness-for-service determination.

---

## How to reproduce

**In the app:** open the **Pitting / CRA** tab, enter the composition (Cr 19, Ni 13, Mo 3.2,
N 0.05), and read the predicted CPT and prediction interval.

**From a Node REPL (exact arithmetic above):**

```js
const PitCast = require('./pitcast.js');
const c = { Cr: 19.0, Ni: 13.0, Mo: 3.2, N: 0.05, Mn: 1.6, C: 0.05 };
PitCast.prenN30(c);   // 31.06
PitCast.cptMean(c);   // 30.5748…  (G48 basis)
PitCast.cptSE(c);     // 8.1386…   (prediction-interval SE)
```

**Whole-corpus metric:** `node benchmark/run.js` regenerates the LOO MAE (6.6 °C, n = 52) and the
on-basis spot-check table into `benchmark/REPORT.md` §1–§2.
