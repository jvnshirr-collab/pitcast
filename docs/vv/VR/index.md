# Validation Records (VR) — load-bearing engines

Per-engine verification & validation records for the four **load-bearing** PitCast
engines, per the SVVP (`../SVVP.md`) and ASME V&V 10-2019 / IEEE 1012-2016.

These four carry the most user weight, so they are validated first and deepest.
Each record ties to the **reproducible open benchmark** (`../../../benchmark/`,
run `node benchmark/run.js`) — an auditable alternative to the closed validation
decks of commercial tools.

| Engine | Record | Headline validation | Acceptance |
|---|---|---|---|
| CPT / PREN (`pitcast.js`) | [cpt.md](cpt.md) | LOO MAE **6.58 °C** (n=51, FeCl₃ basis) — reproduced by `benchmark/run.js` | ±10 °C screening |
| CO₂ (`co2.js`) | [co2.md](co2.md) | 5-model ensemble; NORSOK MAE 2.16, DWM-95 MAE 2.8 mm/y on in-scope cited cases | spread = uncertainty band |
| Corroded-pipe FFS (`b31g.js`) | [b31g.md](b31g.md) | ASME B31G-2012 Appx B Ex 1 → P_safe 54.3 bar (exact) | closed-form, exact |
| Sour spec (`mr0175.js`) | [mr0175.md](mr0175.md) | ISO 15156-3 decision tree; 13Cr→A.19, 2205@30 kPa→out | traceability, not numeric |

## Validation philosophy (honest, not ceremony)

- **Verification** ("math right") = the engine's embedded `_runTests()` against
  published worked examples. Run `node <engine>.js`.
- **Validation** ("right vs reality") = the benchmark, on cited measured data.
- We report what is **genuinely validated** and flag what is **screening-grade or
  needs-review** — we do not paper over gaps. A model correctly refusing to apply
  out-of-scope (e.g. CO₂ models on a 13Cr CRA) is *correct behaviour*, recorded as such.
- No fabricated validation data, ever. The growth path to 150–300 cited cases is
  in `../../../PLAN-differentiation.md` (move #1) and is human-gated.

## Status

- ✅ 4 load-bearing engines: VR records complete, benchmark-backed.
- 🔜 Remaining engines retain the SVVP §2 tier table; per-engine VR records added
  as they become load-bearing. Breadth is frozen (see PLAN-differentiation P0).
