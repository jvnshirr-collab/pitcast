# The CO₂ corrosion wedge — models, fidelity, validation, and guidance

PitCast's deepest engine is its **CO₂ ("sweet") corrosion ensemble**. This note
documents what it does, how faithful each model is to its published source, how
accurate each is against cited measured data, and *which to trust* — a level of
transparency no closed CO₂ tool (OLI, Honeywell Predict, or NORSOK's own deck)
exposes.

> **Scope.** Screening-grade, carbon steel, aqueous sweet service. Validity
> envelope (de Waard / NORSOK): **T 20–150 °C, pH 3.5–6.5, pCO₂ ≲ 10 bar.**
> High-pressure / supercritical CO₂, top-of-line condensation, and sour
> (H₂S-dominated) service are out of scope and flagged by the tool.

## 1. The five models

| Model | Type | Captures | Reference |
|---|---|---|---|
| **De Waard–Milliams 1975** | classical nomogram | T, pCO₂ only (no flow/scale/pH) — conservative bound | Corrosion 31 (1975) 177 |
| **De Waard–Lotz–Dugstad 1995** | semi-empirical | reaction + mass-transfer in series; F_pH, F_scale, F_glycol, fugacity | NACE Corrosion/95 Paper 128 |
| **NORSOK M-506:2017** | regulator model | K_t(T) table × fugacity^0.62 × wall-shear-stress term × f(pH) | NORSOK M-506 rev 3 |
| **NESC / Cassandra** | mechanistic | de Waard anchor × FeCO₃ supersaturation × oil-wetting × velocity | Nyborg, Energy Mater. 5 (2010) 91 |
| **Multicorp / FreeCorp** | mechanistic | mixed FeCO₃/FeS film kinetics + H₂S co-effect + film ageing | Nešić, Corros. Sci. 49 (2007) 4308 |

Supporting chemistry: Crolet–Bonis in-situ pH (charge balance), Sun–Nešić FeCO₃
scaling tendency, the de Waard fugacity coefficient, and a CO₂/H₂S regime map.

## 2. Fidelity — faithful to the published equations

- **Fugacity coefficient.** `f_CO₂ = φ·pCO₂` with the de Waard 1995 coefficient
  `log₁₀φ = (0.0031 − 1.4/T_K)·P` (P capped at 250 bar, φ ≤ 1) applied across the
  **whole** pressure range — φ ≈ 0.997 at 1 bar, 0.78 at 100 bar, 0.53 at ≥250 bar.
  (Earlier code left φ = 1 below 250 bar, over-stating the CO₂ driving force at
  elevated pressure; corrected in P4.)
- **NORSOK K_t** uses the published M-506 temperature table (0.42 → 10.695 → 5.203
  over 5–150 °C) with linear interpolation; the wall-shear-stress and f(pH) terms
  follow Annex A.
- Both are pinned by oracle assertions in `benchmark/test-co2.js`, each
  hand-derived from the source equation (no fitted or fabricated expectations).

## 3. Validated accuracy — which model to trust

Against the **n = 10 cited in-scope carbon-steel cases (20–80 °C)** in the open
benchmark (regenerate with `node benchmark/run.js`):

| Model | MAE (mm/y) | Bias (mm/y) | Note |
|---|---|---|---|
| **De Waard 1995** | **1.12** | +1.09 | best single fit — the default recommendation |
| NORSOK M-506 | 3.03 | +2.84 | conservative |
| NESC / Cassandra | 4.74 | +4.73 | over-predicts |
| Multicorp / FreeCorp | 51.4 | +51.4 | over-predicts hot scaled cases |
| De Waard 1975 | 223 | +223 | no scale term — unusable above ~60 °C |

`CO2.recommendModel()` encodes this: it returns **De Waard 1995** as the validated
best-fit, the full ranking, and an honest caveat — *all five disagree by ~10×, so
the ensemble spread (crMin…crMax), not any single number, is the real uncertainty.*

**The honest finding the benchmark surfaces:** at mild conditions (≲1 bar,
20–60 °C, short exposure) the ensemble **brackets** the measured rate; at heavily
scaled, hot, stagnant conditions **every** model over-predicts the multi-day
weight-loss rate — so screening there should lean on the lower bound, not the mean.

## 4. Correction factors

- **pH** (F_pH) — suppression above the carbonic-saturation pH (de Waard).
- **FeCO₃ scale** (F_scale) — throttles CR above ~60 °C where the film is stable.
- **Glycol/MEG** (F_glycol) — water-fraction dilution of the corrosive phase.
- **Inhibitor availability** — `CR_inh = CR·(1 − availability·efficiency)`
  (`CO2.inhibitedRate`): a 95 %-efficient inhibitor at 80 % availability still
  leaves ~24 % of the bare rate. This is why field corrosion control chases
  *availability*, not just lab efficiency.

## 5. The disagreement philosophy

PitCast does **not** pick one number and hide the rest. It runs all five, shows the
**spread**, flags out-of-envelope inputs, names the validated best-fit, and reports
the FeCO₃ scaling tendency. The disagreement *is* the decision-relevant output: a
10× spread is a signal to get data, not to trust a point estimate.

## 6. Reproducibility

- `node benchmark/run.js` — regenerates the per-model accuracy table from cited data.
- `node benchmark/test-co2.js` — oracle assertions for fugacity, the de Waard 1975
  nomogram, the NORSOK K_t table, Crolet–Bonis pH, the validated recommendation, and
  the inhibitor-availability model; gated by `benchmark/test-all.js`.
- Every benchmark point is tabulated, in-envelope, and DOI-cited
  (`benchmark/INCLUSION-RULES.md`).

## 7. Honest limitations

- Screening-grade correlations, not a mechanistic electrochemical solver.
- The open corpus is small (n = 10 in-scope); large CO₂ datasets remain proprietary.
- Out of scope (and flagged by the tool): supercritical / high-pressure CO₂,
  top-of-line condensation, and sour (H₂S-dominated) service.
