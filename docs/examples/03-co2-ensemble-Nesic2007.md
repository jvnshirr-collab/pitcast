# Worked Example 3 — CO₂ corrosion (5-model disagreement ensemble)

**Engine:** `co2.js` — CO₂ 5-model ensemble
**Tier:** ✅ **Validated *as a disagreement ensemble*** + 📐 reproduces 5 published models (per
`docs/ENGINE-STATUS.md`). The five open CO₂ models disagree by **~10× to >1000×**; **the
disagreement envelope — not a single number — is the deliverable.** Over the in-scope carbon-steel
corpus the ensemble brackets the measurement in **56 %** of cases (9/16).

This example runs all five models for one cited carbon-steel CO₂ case and shows that the honest
output is a **band**, then compares the band (and the per-model rates) to the cited measured rate.

---

## Case & inputs

**Nesic 2007 — 5 % CO₂ flow-loop at 60 °C** (the reference dataset behind FreeCorp/Multicorp
calibration). Structured inputs from `benchmark/co2-inputs.json`:

| Input | Value |
|---|--:|
| Temperature T | 60 °C |
| CO₂ partial pressure pCO₂ | 5 bar |
| pH | 5.0 |
| Flow velocity u | 1.0 m/s |
| Pipe ID | 0.015 m (15 mm) |
| Fe²⁺ | 5 ppm |
| Scope | `cs_aqueous` (in-scope carbon steel) |

Source: Nešić S., *Corrosion Sci.* 49 (2007) 4308 (DOI 10.1016/j.corsci.2007.06.006); Ohio U
flow-loop. **Measured corrosion rate = 2.0 ± 0.6 mm/y** (`data/validations.json`).

---

## Step-by-step expected output — run all 5 models

`co2.js` `assess(inputs)` returns one corrosion rate per model. The five models and the rates for
this case (`benchmark/results.json`, case "Nesic 2007 - 5% CO2 flow-loop at 60 C"):

| Model (`id`) | Full name / standard | Predicted CR (mm/y) | Err vs measured |
|---|---|--:|--:|
| `NORSOK` | NORSOK M-506:2017 | **1.09** ← envelope min | −0.91 |
| `DWM-1995` | de Waard, Lotz & Dugstad 1995 (NACE Corrosion/95 Paper 128) | 4.34 | +2.34 |
| `NESC` | NESC / Cassandra (Nyborg 2010) | 3.46 | +1.46 |
| `FreeCorp` | Multicorp / FreeCorp (Nešić 2007) | 12.19 | +10.19 |
| `DWM-1975` | de Waard & Milliams 1975 (*Corrosion* 31, 177) | **13.66** ← envelope max | +11.66 |

### The disagreement band

```
ensemble min  = 1.09 mm/y   (NORSOK)
ensemble max  = 13.66 mm/y  (DWM-1975)
spread        = 13.66 / 1.09 = 12.6×
```

So the five open models disagree by a factor of **~12.6×** for the *same* inputs. Reporting any
single one of these as "the" answer would be misleading — the honest screening output is the
**1.1 – 13.7 mm/y band**.

For reference, the earliest model (de Waard-Milliams 1975) has no FeCO₃-scale or pH correction and
runs hot; the calibrated DWM-1995 and NORSOK add scaling/pH terms and sit much lower. This is the
physical reason for the spread.

---

## Comparison to the cited measured rate

| Quantity | Value |
|---|--:|
| **Measured CR** | **2.0 ± 0.6 mm/y** |
| Ensemble band (min…max) | 1.09 … 13.66 mm/y |
| Measured inside the band? | **✓ Yes** (`measured_in_envelope: true`) |
| Spread | 12.6× |
| Best single model here | NORSOK (1.09 mm/y, err −0.91) |

The measurement falls **inside** the 5-model envelope — one of the 9/16 in-scope cases where the
ensemble brackets the blank rate. At these mild conditions the lower-bound calibrated models track
the data (DWM-1995 is the best per-model performer corpus-wide, MAE **0.94 mm/y**), while DWM-1975
and FreeCorp run an order of magnitude high.

### Corpus context (per-model MAE over the 16 in-scope cases)

From `benchmark/REPORT.md` §3:

| Model | MAE (mm/y) |
|---|--:|
| DWM-1995 | **0.94** (best) |
| NORSOK | 2.95 |
| NESC | 3.06 |
| FreeCorp | 32.59 |
| DWM-1975 | 140.32 |

The point is not that one model is "right" — it is that **a screening read must carry the whole
band** because in any given regime a different model is the closest, and the spread blows up
(to >1000×) for scaled / high-pCO₂ / long-exposure cases.

---

## Honest limitations

- **n = 16 in-scope is a small, indicative spot-check**, not a definitive validation. The large CO₂
  loop databases (NORSOK/IFE) are proprietary; most open CO₂ rates are figure-locked or
  electrochemical, so only table/text-stated weight-loss blanks are admitted (`benchmark/REPORT.md`
  §5).
- Two cited cases in the corpus are deliberately **out of model scope** to show the bulk
  carbon-steel models *correctly* failing: a 13Cr CRA (passivates, `cra_out_of_scope`) and a
  top-of-line condensing case (`tlc`). A bulk-flowline model getting these "wrong" is correct
  behaviour.
- The spread grows enormously where protective scale dominates — e.g. the Nyborg 2007 HP/HT case
  (175 °C, 100 bar CO₂) spreads **1330×** (1.59 … 2110 mm/y) while the measured scaled rate is only
  0.8 mm/y. **Never read the upper model as a design rate in a scaling regime.**

---

## How to reproduce

**In the app:** open the **CO₂ corrosion** tab, enter T = 60 °C, pCO₂ = 5 bar, pH = 5, u = 1 m/s,
pipe ID = 15 mm, Fe²⁺ = 5 ppm. The tab shows all five model rates and the disagreement band, with
the "CO₂/MR0175 Standard-reproducing" badge.

**From a Node REPL (the rates above):**

```js
const CO2 = require('./co2.js');
const r = CO2.assess({ T_C: 60, pCO2_bar: 5, pH: 5, u_m_s: 1, d_pipe_m: 0.015, Fe2_ppm: 5 });
r.crMin;   // 1.085…   (NORSOK)
r.crMax;   // 13.661…  (DWM-1975)
r.spread;  // 12.588…  (≈ 12.6×)
r.models.map(m => [m.id, m.cr]);  // all five per-model rates
```

**Whole-corpus metrics:** `node benchmark/run.js` runs all 5 models over every cited CO₂ case and
regenerates the per-case envelope table and per-model MAE/RMSE/bias into `benchmark/REPORT.md` §3.
`node benchmark/test-co2.js` runs the 27 CO₂ oracle assertions (de Waard fugacity, NORSOK K_t,
Crolet-Bonis pH).
