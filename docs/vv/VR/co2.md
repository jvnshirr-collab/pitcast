# VR — CO₂ sweet-corrosion ensemble (`co2.js`)

**Intended use**: screening corrosion rate for **carbon steel** in CO₂/brine, and
an honest **model-disagreement** view. **Not** for CRAs, **not** for
top-of-line/condensing (TLC) service, **not** for sour cracking (see `mr0175.js`/`hic.js`).

**Governing models** (5-model ensemble): De Waard-Milliams 1975; De Waard 1995
(resistance-in-series + F_pH/F_scale/F_glycol); NORSOK M-506:2017; NESC/Cassandra
(Nyborg 2010); Multicorp/FreeCorp (Nesic). Shared chemistry: fugacity, Crolet-Bonis
in-situ pH, Sun-Nesic FeCO₃ scaling.

**Verification (math right)**: each model is a formula-for-formula port of the
published correlation (parity with the austenite `co2.ts` console module); all
closed-form.

**Validation (right vs reality)** — `benchmark/run.js` vs cited field/lab cases,
per-model error over **n=3 in-scope carbon-steel cases** (mm/y):

| Model | MAE | bias | Verdict |
|---|--:|--:|---|
| NORSOK M-506 | 2.16 | +1.55 | **primary** |
| De Waard 1995 | 2.80 | +2.80 | **primary** |
| NESC/Cassandra | 9.85 | +9.85 | secondary |
| FreeCorp | 153.86 | +153.86 | unreliable at HP/HT |
| De Waard 1975 | 722.11 | +722.11 | **conservative upper bound only** |

**Envelope coverage = 33%** (1/3): where protective films dominate the measurement
falls **below** the ensemble floor — FeCO₃ scale at HP/HT (Nyborg 2007, measured
0.8 mm/y) and FeS in sour-sweet service (Tengiz 2017, 0.55 mm/y). The ensemble is
**conservative** in those regimes.

**How to use the output**: take **NORSOK + DWM-1995** as primary; treat the model
**spread as the uncertainty band**; never trust a single model where scale/FeS
dominates; read DWM-1975 only as a conservative ceiling.

**Known limitations**: n=3 in-scope is **indicative, not definitive** (growth path:
PLAN-differentiation move #1). No TLC model. CRA passivation out of scope (a CS
model "failing" the 13Cr case is correct behaviour, recorded in the benchmark).

**Acceptance**: the **spread is the deliverable**; reliable members within
≈2–3 mm/y on in-scope cases. **Reproduce**: `node benchmark/run.js` → §3.
