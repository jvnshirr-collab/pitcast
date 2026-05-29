# PitCast — per-engine Definition of Done

What "complete" means for each engine, so we **stop adding once the bar is met**
(depth, not breadth). Closes PLAN-differentiation P0. Legend: ✅ meets DoD ·
🟡 partial · 🔒 parked (honestly scoped, beta-tagged).

## Load-bearing (DoD = benchmark-backed **and** a VR record)
- **pitcast.js** (CPT/PREN/SCC) — ✅ correlation reproduced by `benchmark/run.js`
  (LOO MAE ≤ G48 measurement scatter) + `VR/cpt.md` + glass-box + credible interval shown.
- **co2.js** — ✅ 5 cited models + ensemble spread + `VR/co2.md` + disagreement view +
  benchmark envelope-coverage reported.
- **b31g.js** — ✅ B31G-2012 + Mod-B31G + Folias, ASME Appx B Ex 1 reproduced + `VR/b31g.md`.
- **mr0175.js** — 🟡 ISO 15156-3 decision tree + every Annex A envelope **either cited or
  flagged `needs_review`** (18/41 still flagged) + `VR/mr0175.md`.

## Supporting corrosion engines (DoD = standard worked example reproduced + in-output citation)
- **cpac / anode / groundbed / galvanic / electrochem** — ✅ each reproduces its standard
  worked example (SVVP §2), citation in output.
- **hic.js** — ✅ NACE MR0103 / ISO 15156-2 screening envelope, cited.
- **cui.js** — ✅ API 583 patterns, cited. **mic.js** — ✅ NACE SP0775 classification, cited.
- **cips.js** — ✅ SP0207/SP0502 + ECDA prioritisation + GPS map, cited.
- **interaction.js** — ✅ DNV-RP-F101 / POF-100 / B31G interaction, cited.
- **ffs.js** — ✅ API 579 Parts 4/5/6/7 (corrosion scope), FFS.jl reference reproduced.
- **vendor-products.js** — ✅ cited product DB (43 products), filterable.

## Parked / beta (DoD = honestly scoped + visible beta tag, **not** pretending complete)
- **rbi-detailed.js / rbi-damage-mechanisms.js** — 🔒 corrosion DFs only, **API 581 3rd-ed
  basis** (see `STANDARDS.md` delta). RBI infrastructure beyond corrosion DFs is out of scope.
- **storage / audit / projects-ui** (G4 persistence) — 🔒 engines exist, not browser-verified
  end-to-end. Beta-tagged.
- **mr0175 `needs_review` envelopes** (G7) — 🔒 18/41 flagged; never fabricated.

## Utility (DoD = supports the engines)
- **app.js** — render + dispatch for all tabs. **charts.js** — SVG visuals.

**DoD principle:** an engine is "done" when it reproduces its cited standard/data, carries
its citation in-output, and (if load-bearing) has a VR record + benchmark backing. Beyond
that is breadth — which is frozen (PLAN-tier3 banner).
