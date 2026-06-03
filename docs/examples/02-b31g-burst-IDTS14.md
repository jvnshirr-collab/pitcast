# Worked Example 2 — Corroded-pipe burst (B31G)

**Engine:** `b31g.js` — corroded-pipe burst (ASME B31G + Modified B31G)
**Tier:** ✅ **Validated** + 📐 **Standard-reproducing** (per `docs/ENGINE-STATUS.md`) — reproduces
ASME B31G-2012, and over **75** cited full-scale burst specimens the **original B31G** prediction is
**0.678× measured (100 % conservative)**, matching the 149-specimen Zhou & Huang 2012 study.

This example takes one cited specimen, feeds its geometry to `b31g.js`, and compares the **predicted
failure pressure (SF = 1)** to the **measured burst** recorded in the source paper. Using SF = 1 (no
safety factor) and the specimen's **actual measured yield** as SMYS isolates *method* error from
material over-strength and from the design safety factor.

---

## Specimen & inputs

**IDTS 14** — API 5L X70, spark-eroded single defect. From `benchmark/b31g-burst.json` (source
`BENJAMIN2016`):

| Input | Symbol | Value |
|---|---|--:|
| Outside diameter | D | 457.3 mm |
| Wall thickness | t | 7.9 mm |
| Yield (actual, used as SMYS) | SMYS | 639 MPa |
| Defect axial length | L | 30 mm |
| Defect max depth | d | 4.8 mm |
| → depth ratio | d/t | 0.61 (61 %) |
| **Measured burst** | P_burst | **26.7 MPa** |

Source: Benjamin, Freire, Vieira & Cunha, "Interaction of corrosion defects in pipelines — Part 2:
MTI JIP database of corroded pipe tests," *Int. J. Press. Vessels Pip.* 145 (2016) 41–59
(DOI 10.1016/j.ijpvp.2016.06.006). Geometry = Table 6, yield = Table 1, measured burst = Table 8.

---

## Step-by-step expected output (Original B31G)

`b31g.js` `failurePressure({ D, t, SMYS, L, d, method: 'b31g', SF: 1 })`.

### Step 1 — defect-length parameter z

```
z = L² / (D·t) = 30² / (457.3 · 7.9) = 900 / 3612.7 = 0.249
```

z ≤ 20 → **short defect**, parabolic (2/3 dL) form with the Folias bulging factor M.

### Step 2 — Folias (bulging) factor M

```
M = √(1 + 0.8·z) = √(1 + 0.8·0.249) = √1.1993 = 1.0951
```

### Step 3 — flow stress and failure hoop stress

Original B31G uses flow stress `σ_flow = 1.1·SMYS` and the parabolic 2/3 dL area term:

```
σ_flow = 1.1 · 639 = 702.9 MPa
σ_f    = σ_flow · (1 − (2/3)(d/t)) / (1 − (2/3)(d/t)/M)
       = 702.9 · (1 − 0.6667·0.6076) / (1 − 0.6667·0.6076 / 1.0951)
       = 702.9 · (1 − 0.4051) / (1 − 0.3699)
       = 702.9 · 0.5949 / 0.6301
       = 663.65 MPa
```

### Step 4 — failure pressure (Barlow thin-shell)

```
P_f = 2·σ_f·t / D = 2·663.65·7.9 / 457.3 = 22.93 MPa
```

(Engine: `P_f_MPa = 22.929…`; `benchmark/results.json` stores `b31g_Pf_MPa: 22.93`.)

### Modified B31G (for comparison)

Same call with `method: 'modb31g'` (flow stress `SMYS + 68.95 MPa`, 0.85 dL area, piecewise M):

```
M    = √(1 + 0.6275·z − 0.003375·z²) = 1.0752
σ_f  = (639 + 68.95) · (1 − 0.85·0.6076) / (1 − 0.85·0.6076/1.0752) = 658.73 MPa
P_f  = 2·658.73·7.9 / 457.3 = 22.76 MPa
```

(`benchmark/results.json`: `modb31g_Pf_MPa: 22.76`.)

---

## Comparison to the measured burst

| Method | Predicted P_f (SF = 1) | Measured burst | Ratio pred/meas | Conservative? |
|---|--:|--:|--:|:--:|
| **Original B31G** | **22.93 MPa** | 26.7 MPa | **0.859** | ✓ (under-predicts) |
| Modified B31G | 22.76 MPa | 26.7 MPa | 0.852 | ✓ |

Both ratios match `benchmark/results.json` exactly (`ratio_b31g: 0.859`, `ratio_modb31g: 0.852`).
The method is conservative for this specimen (predicts burst ~14 % below the real burst), consistent
with the corpus-level original-B31G mean ratio of **0.678** (100 % conservative over 75 specimens).

### Independent verification that the engine *is* B31G

Benjamin (2016) publishes its **own** B31G prediction for this specimen. Reproducing the paper's
single-defect calculation with the paper's geometry (D = 458.6 mm) gives:

- IDTS 14 → `b31g.js` **22.87 MPa** vs paper's published **22.9 MPa** (0.1 % diff)
- IDTS 13 → `b31g.js` **22.24 MPa** vs paper's published **22.2 MPa**

These are pinned in `benchmark/test-b31g.js` (lines 90–91). The benchmark row uses the stored
specimen OD (457.3 mm → 22.93 MPa); the tiny OD difference vs the paper-reproduction (458.6 mm) is
why the two values differ in the second decimal. Either way the engine reproduces the published B31G
to well under 1 %.

### Closed-form standard check (ASME B31G-2012 Appendix B, Example 1)

A 24″ OD × 0.281″ WT X52 pipe with L = 10″, d = 0.1″ (SI: D = 609.6, t = 7.137, SMYS = 359,
L = 254, d = 2.54) gives `b31g.js` **P_f = 75.5 bar**, **P_safe = 54.3 bar** (≈ 787 psi) at the
default SF = 1.39 — matching the published worked example (see the `b31g.js` header comment, and
`docs/VALIDATION.md` §4 / the deploy-gate oracles).

---

## Honest limitations

- B31G is a **Level-1 screen**, not a fitness-for-service determination (the engine attaches this
  caveat to every result). High-consequence decisions require a qualified engineer, verified inputs,
  and the full ASME B31G / API 579 procedure.
- **Modified B31G can be non-conservative** on deep/low-grade defects: over the 75-specimen corpus
  its mean ratio is 0.822 but only **80 % conservative** (max ratio 1.587, the He & Zhao X65
  d/t = 0.78 case). **Original B31G is the safe-side choice** (100 % conservative here). See
  `docs/VALIDATION.md` §3.

---

## How to reproduce

**In the app:** open the **B31G / Integrity** tab, enter D = 457.3 mm, t = 7.9 mm, grade/SMYS = 639
MPa (custom yield), defect L = 30 mm, d = 4.8 mm. Set the safety factor to 1.0 to compare directly to
the measured burst (the tab defaults to SF = 1.39 for a *safe operating* pressure, which would give
P_safe ≈ 16.5 MPa = 165 bar for this geometry). A US-customary units toggle (psi / in / ksi) is
available on the tab.

**From a Node REPL (exact arithmetic above):**

```js
const B31G = require('./b31g.js');
const s = { D: 457.3, t: 7.9, SMYS: 639, L: 30, d: 4.8 };
B31G.failurePressure({ ...s, method: 'b31g',    SF: 1 }).P_f_MPa;  // 22.929…
B31G.failurePressure({ ...s, method: 'modb31g', SF: 1 }).P_f_MPa;  // 22.759…
```

**Whole-corpus metrics:** `node benchmark/run.js` runs all 75 specimens and regenerates the
mean-ratio / %-conservative / MAPE table into `benchmark/REPORT.md` §4. `node benchmark/test-b31g.js`
runs the 29 B31G oracle assertions (including the IDTS 13/14 paper-reproduction pins).
