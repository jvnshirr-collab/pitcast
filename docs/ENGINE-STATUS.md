# PitCast — Per-Engine Validation Status

*Honest classification of every engine by what is actually established about it. Produced by a
file-by-file audit (2026-06-02). The single most important thing a skeptical engineer can read:
it tells you exactly how far to trust each output.* See `docs/VALIDATION.md` for the numbers and
`benchmark/INCLUSION-RULES.md` for the data rules.

## Legend

| Tier | Meaning |
|---|---|
| ✅ **Validated** | Predictions checked against cited **measured** data, with reproducible tests/anchors. |
| 📐 **Standard-reproducing** | Faithfully implements + reproduces a named published standard/correlation (verification ✓). **Not** independently validated against measured data. |
| 🔎 **Screening-only** | Heuristic / author-assembled factor model built on cited standards. **Not** validated and **not** a verbatim standard reproduction — a triage flag, refer to testing. |
| ❌ **Removed** | Out of PitCast's corrosion-only scope. |

## Core (load-bearing) engines

| Engine | Tier | Basis | Validation | Tests |
|---|---|---|---|---|
| `pitcast.js` — CRA pitting / CPT / PREN | ✅ Validated | `CPT = f(PREN_N30)`; 2 separate bases | Nyby 2021 LOO MAE 6.6 °C (n=52) + npj 2025 electrochemical LOO 6.11 °C (n=123) | gate (CPT/PREN oracles) + `run.js` LOO |
| `co2.js` — CO₂ 5-model ensemble | ✅ Validated *(as a disagreement ensemble)* + 📐 reproduces 5 models | de Waard 1975/1995, NORSOK M-506:2017, NESC, FreeCorp | ensemble brackets cited cases (56 % envelope coverage); **point accuracy is not the deliverable — the spread is** | `test-co2.js` (27 oracles) |
| `b31g.js` — corroded-pipe burst | ✅ Validated + 📐 reproduces ASME B31G | ASME B31G-2012 / Modified-B31G | 75 specimens; orig-B31G 0.678× measured (100 % conservative); matches Zhou & Huang 2012 (n=149) | `test-b31g.js` (29) + `b31g-burst.json` |
| `ffs.js` — API 579 FFS | 📐 Standard-reproducing | API 579-1/ASME FFS-1 Part 5/6/7 | reproduces code worked examples (not independently validated vs measured remaining-life) | `test-ffs.js` (18) |
| `mr0175.js` — sour service | 📐 Standard-reproducing | ISO 15156-3 / NACE MR0175 Annex A | reproduces standard envelope boundaries | `test-mr0175.js` (15) |

## Periphery — corrosion control / electrochemistry

| Engine | Tier | Basis | Note |
|---|---|---|---|
| `electrochem.js` | ✅ Validated | ASTM G3/G5/G59/G102; Stern-Geary; Galvele | measured anchors: ASTM G5-14 round-robin (430SS, E_corr −0.522 V_SCE), Jones 1996 (Fe ~1.4 mm/y). **Action: wire its embedded `validateAgainstG5/Jones` into the benchmark gate.** |
| `cips.js` — CP survey/DCVG/ECDA | 📐 Standard-reproducing | NACE SP0169/SP0502, McKinney 1986, 49 CFR 192.939 | embedded `_runTests` (node). **Action: wire into gate.** |
| `groundbed.js` — ICCP anode-bed R | 📐 Standard-reproducing | Dwight 1936 / Sunde 1949 closed-form | — |
| `anode.js` — sacrificial-anode sizing | 📐 Standard-reproducing | DNV-RP-B401 | env current-density + T/depth factors are standard "typicals" |
| `cpac.js` — CP criteria + AC | 📐 Standard-reproducing (CP criteria) | NACE SP0169 + ISO 18086:2019 | the **AC-corrosion-rate** sub-output is 🔎 Screening-only (self-flagged indicative) |
| `galvanic.js` — galvanic couple | 🔎 Screening-only | ASTM G82/G102 mixed-potential method | E_corr/Tafel inputs are family typicals (±30 mV, ±decade i₀); rate self-flagged screening |

## Periphery — damage-mechanism screens (heuristic)

| Engine | Tier | Basis | Note |
|---|---|---|---|
| `cui.js` — CUI + external Cl-SCC | 🔎 Screening-only | API RP 583/581, NACE SP0198, ASTM C871 | self-flagged "order-of-magnitude risk ranking only" |
| `hic.js` — HIC / SOHIC | 🔎 Screening-only | NACE MR0103/TM0284, ISO 15156-2, API 571 | self-flagged "not a substitute for TM0284 plate testing" |
| `mic.js` — MIC | 🔎 Screening-only | NACE TM0194/TM0212/SP0775/SP0106 | self-flagged "not a substitute for site-specific bug counts" |

## Periphery — ILI support

| Engine | Tier | Basis | Note |
|---|---|---|---|
| `interaction.js` — ILI defect clustering | 📐 Standard-reproducing | DNV-RP-F101 §3.7, ASME B31G §3.4.5, POF-100, API 1163 | feeds burst calcs. **Action: add an oracle test.** |

## ❌ Removed 2026-06-02 — out of corrosion scope

| File | Why removed |
|---|---|
| `rbi.js` | Generic/process-safety RBI — CoF folds in flammability/toxicity/explosion + inventory. Not a corrosion mechanism. |
| `rbi-detailed.js` | API 581 with financial/explosion consequence + self-admittedly interpolated tables. Was **dead code** (loaded but never called by the UI). |
| `rbi-damage-mechanisms.js` | API 581 RBI damage-factor framework (PoF/inspection-interval). Its corrosion mechanisms (SCC/HIC/CUI/HTHA) are already covered by dedicated engines. |

These completed the 2026-05-28 scope-freeze (PitCast is corrosion-only; generic RBI/PSM was meant
to be removed). Their removal also deleted a compliance-theater caveat block (insurance-underwriter
/ PE-stamped / commercial-software cross-check). Git history retains the files if ever needed.

## Follow-up actions (tracked in `PLAN-industry-ready.md` WS-B2/B5)

1. Add a visible per-tab status badge (✅/📐/🔎) wired from this matrix.
2. Wire `electrochem.js` and `cips.js` embedded tests into the deploy gate.
3. Add an oracle test for `interaction.js`.
