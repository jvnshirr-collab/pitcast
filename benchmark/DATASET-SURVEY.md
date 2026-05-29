# Public measured-corrosion dataset survey

For PLAN-differentiation **move #1** (grow the open benchmark toward 150–300 cited
measured cases). **Honest headline finding:** large *open* measured-corrosion
datasets are rare — which is precisely why a transparent open benchmark is
differentiating. Confirmed by literature search (2026-05): model-comparison papers
validate on proprietary or paper-specific data; **no central open repository exists.**

## What is openly available

| Source | Domain | Access | Status in PitCast |
|---|---|---|---|
| Nyby et al. 2021, *Sci. Data* 8:58 (CC-BY; figshare 10.6084/m9.figshare.13038257) | CPT / E_pit, CRAs | **Open** | ✅ in `data/measurements.json` (729 records); 51 FeCl₃ points back the CPT fit |
| Individual CO₂ papers (Nesic 2007, Singer 2017, Nyborg 2007, Kahyarian 2017, Mishina 2014) | CO₂ field/lab CR | per-paper (some paywalled) | ✅ 5 cited cases in `data/validations.json`; more need manual extraction |
| ASTM G48 inter-laboratory studies | CPT reproducibility | per-paper | partial (scatter cited in `docs/vv/VR/cpt.md`) |
| NORSOK M-506 validation set | CO₂ CR | inside the standard (purchase) | ⛔ not ingested (license) |
| OLI / DNV / Honeywell validation decks | mixed | **proprietary** | ⛔ closed — the gap we exploit |

## Honest conclusion
- **Nyby 2021** is the principal open dataset and is already used.
- CO₂/sour measured data lives in **individual papers** → must be extracted **one cited
  case at a time**. This is the human-gated growth path. **No fabrication, ever.**
- Building the open, reproducible benchmark *is* the contribution because nobody else
  publishes one.

## How to add a case (harness is ready)
- **CPT:** append a record to `data/measurements.json` (`metric:"CPT", code, value, comp,
  sol, doi`). Leave-one-out auto-includes it.
- **CO₂:** add the cited case to `data/validations.json` + structured, scope-tagged inputs
  to `benchmark/co2-inputs.json`.
- Re-run `node benchmark/run.js` → `REPORT.md` regenerates.

## Target
150–300 cited cases across CPT / CO₂ / sour. Each carries a primary citation (DOI or
standard clause). **Provenance over volume.**
