# PitCast — V&V framing (ASME V&V 10) + JOSS peer-review readiness

This document maps PitCast's existing validation to the **ASME V&V 10** verification-&-validation
framework and records its **JOSS** (Journal of Open Source Software) submission readiness. It is
deliberately blunt about what is and is not established. Companion files: `docs/VALIDATION.md`
(detailed numbers), `benchmark/INCLUSION-RULES.md` (data rules + honest rejected log), `paper.md`
(the JOSS submission paper).

## 1. The honest frame: "industry-ready" ≠ dataset size

ASME V&V 10 establishes a model's credibility for an **intended use** through **Verification**
("solving the equations right"), **Validation** ("solving the right equations" — predictions vs
measured data), **Uncertainty Quantification**, and a stated **domain of applicability**. None of
these is a row count. A larger dataset improves *validation coverage* only; it does nothing for
verification, UQ, or — the real gate — independent qualification. **PitCast is a validated
screening tool, not an independently qualified fitness-for-service tool**, and no quantity of
added data changes that line. (NSPE Code of Ethics II.2.a/b, II.3.a: claims truthful and within
competence; no professional-engineer seal is implied or present.)

## 2. Verification — "are we solving the equations right?"

- **Oracle gate (121 assertions, run on every deploy via `node benchmark/test-all.js`):** each
  engine reproduces worked examples / tabulated values from its source standard — ASME B31G-2012
  App. B Ex. 1; de Waard 1975/1995 fugacity + NORSOK M-506 K_t + Crolet-Bonis pH; API 579 Part
  5/6/7 + NACE TM0284; ISO 15156-3 Annex A.
- **Cross-implementation check:** `b31g.js` reproduces the *source papers' own* B31G predictions
  exactly (0.0–2.3 %) for the Benjamin/Souza/Freire burst specimens.
- Unit/dimensional consistency and edge-input guards (no NaN/negative leakage; extrapolation
  flags) are enforced in-engine.

## 3. Validation — "are we solving the right equations?" (predictions vs measured)

| Domain | Validation | Result |
|---|---|---|
| Pitting CPT (G48 basis) | leave-one-out, n=52 | MAE 6.6 °C, R² 0.84 |
| Pitting CPT (electrochemical basis, **separate**) | leave-one-out, n=123 | MAE 6.11 °C, R² 0.93 |
| Corroded-pipe burst | predicted vs measured, n=75 | orig-B31G 0.678× (100 % conservative); matches Zhou & Huang 2012 (n=149, 0.679) |
| CO₂ rate | 5-model ensemble vs cited cases | model disagreement ≈10–1000× (the honest deliverable) |

Total measured validation points: **175 CPT (two cited bases) + 75 burst + CO₂ ensemble.** Every
figure regenerates from `node benchmark/run.js`; data rules + the honest rejected-data log are in
`benchmark/INCLUSION-RULES.md`.

## 4. Uncertainty Quantification

- CPT outputs are returned as **Student-t prediction intervals**, not bare points.
- CO₂ is reported as a **model-disagreement band** (the spread *is* the message).
- B31G/burst carry the conservative-bias statistic + screening caveat.

## 5. Intended use, domain of applicability, limitations

- **Intended use:** screening / triage / education. **NOT** a basis for fitness-for-service
  determinations or remaining-life sign-off.
- **Domain:** each engine enforces its published validity envelope (T, pH, pCO₂, chloride, alloy
  class, PREN range) and flags or refuses out-of-domain inputs.
- **Qualification status:** no independent third-party V&V, no peer review (yet), no PE seal.
  High-consequence decisions require a qualified engineer, verified inputs, and the full code
  procedure.

## 6. JOSS submission readiness

| Requirement | Status |
|---|---|
| OSI-approved license file | ✅ Apache-2.0 |
| Public repo, cloneable without registration | ✅ github.com/jvnshirr-collab/pitcast |
| `paper.md` + `paper.bib` (current 6-section format incl. AI-usage disclosure) | ✅ in repo root |
| Automated tests / documented checks | ✅ 121-assertion oracle gate + LOO validation |
| Documentation (install/usage, per-engine equations + citations) | ✅ README + glass-box UI + `docs/` |
| Archived versioned release (DOI) | ✅ Zenodo 10.5281/zenodo.20466523 |
| Statement of need / state of the field / software design / research impact | ✅ in `paper.md` |

**Honest caveats before submitting (do not skip):**
1. **AI-assisted build + recent public history.** JOSS's Jan-2026 policy scrutinizes rapidly-/
   recently-generated code and expects a *sustained* public commit history (≥6 months for new
   repos). PitCast's public history is recent. `paper.md` discloses AI assistance honestly; the
   author should let the open history accumulate and be ready to show human-directed model
   selection, oracle design, and literature verification. **Submission is prepared; acceptance is
   not guaranteed**, and rushing it risks a desk-reject.
2. **Scholarly-effort floor** (≥~1000 LOC, ~3 months) is comfortably met by the multi-engine
   codebase + benchmark, but the reviewers assess *substance*, not size.
3. The author performs the actual submission at `joss.theoj.org/papers/new`; the review happens in
   an open GitHub issue.

_Sources: JOSS docs (joss.readthedocs.io, openjournals/joss review_checklist), JOSS Jan-2026
GenAI policy, ASME V&V 10-2019 (R2025), NSPE Code of Ethics._
