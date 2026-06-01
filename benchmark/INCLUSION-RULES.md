# PitCast Benchmark — Data Inclusion Rules

_The benchmark's only value is that **every point is real and traceable**. A
small, fully-disclosed corpus is a transparency **strength**; a larger corpus
padded with figure-scraped or fabricated points destroys the entire claim. This
doc is the gate. When in doubt, **exclude**._

## A datapoint may enter the corpus only if ALL of these hold

1. **Tabulated numeric value** — read from a table or text, **not** estimated off
   a plotted figure. If the only source is a chart, it is **out** (digitised
   points carry uncontrolled reading error and cannot be independently checked).
2. **Cited + retrievable** — a specific source with a **DOI**, standard number,
   or stable identifier. "Personal communication", unlabelled vendor slides, and
   un-findable conference papers are **out**.
3. **In the tested model's envelope** — the conditions must lie inside the
   validity envelope of the engine being benchmarked (e.g. NORSOK M-506: T
   20–150 °C, pH 3.5–6.5). Out-of-envelope points are kept **only** when the
   explicit purpose is to show the model *correctly* failing (and are labelled
   `scope` ≠ in-scope so they are excluded from headline error stats).
4. **Fully specified conditions** — every input the engine consumes is given
   (composition / T / pCO₂ / pH / velocity / etc.). Missing a load-bearing
   input → **out** (no back-filling with assumptions).
5. **Corrosion scope** — the measurement is a corrosion quantity (CR, CPT, pit
   depth, metal loss, cracking acceptance). Non-corrosion data is out of scope
   for PitCast entirely.

## Recording a case

- Add it to the appropriate file with its source + DOI inline:
  - `data/validations.json` — CPT/CRA + CO₂ cited cases (carries `source`).
  - `benchmark/co2-inputs.json` — machine-runnable structured CO₂ inputs.
  - `data/measurements.json` — measured CPT records (each carries its own
    composition + test solution).
- Re-run `node benchmark/run.js` and update coverage **honestly** — report the
  new n and error, never round up. The report is auto-generated; do not hand-edit.
- Engine-oracle cases (closed-form worked examples from standards) go in the
  `benchmark/test-*.js` suites instead, anchored on the standard's documented
  numbers (e.g. ASME B31G-2012 App. B Ex. 1).

## Rejected — and why (honest log)

These were evaluated this development cycle and **excluded** under the rules above:

- **NACE Paper 11242, "Corrosion of Carbon Steel in High CO₂ Environment: Flow
  Effect"** (examined directly via library access, 2026-05-30): corrosion-rate
  results are presented only as bar charts (Figures 3–5), not tables — **rule 1**;
  and the test matrix spans pH 3 and pCO₂ 70 bar, outside the de Waard / NORSOK
  validity envelope (pH ≥ 3.5, pCO₂ ≲ 10 bar) — **rule 3**. The single in-envelope
  subset (pH 4, pCO₂ 10 bar, 25–50 °C) exists only inside the figures, so no clean
  tabulated point can be extracted without figure-reading. Excluded.
- Other figure-only CO₂ flow-effect data (values only on plots, no table) — rule 1.
- Extreme-condition lab cases far outside NORSOK/de Waard validity — rule 3
  (would only ever show the bulk-flowline model failing, which is expected).
- Conference papers whose full text could not be retrieved to confirm the exact
  conditions — rule 2.

**Standing note on corpus growth:** the binding constraint is *extractable,
tabulated, in-envelope, cited* measured data — not access. With METU library access
available, the readily-reachable CO₂ sources are either image-only PDFs (no
machine-readable table), figure-based, or run at out-of-envelope conditions
(supercritical / very-low-pH). Growth therefore stays opportunistic and honest: a
case is added only when a real tabulated in-envelope value with a retrievable
identifier is in hand. No point is added to inflate `n`.

**Open-access hunt, 2026-05-30 (library + OA search) — all examined and rejected:**
- NACE Paper 11242 (figure-based corrosion rates; pCO₂ to 70 bar — out of envelope).
- Bai et al., *Materials* 11(9):1765 (2018), J55 — corrosion rate only in Figures 4/13,
  pCO₂ 1.5–15 MPa (out of envelope + rule 1). DOI 10.3390/ma11091765.
- Dong et al., *Materials* 17(16):4046 (2024), ML model — only summary statistics
  (Table 1), raw points "cannot be publicly disclosed", supercritical-CO₂ training
  sources. DOI 10.3390/ma17164046.
- Yin et al., *Surf. Interface Anal.* 41(6):517 (2009), DOI 10.1002/sia.3057 — full text
  obtained via library (Wiley); high-pressure autoclave at **pCO₂ 4 MPa (40 bar), T
  50–180 °C** → out of envelope (rule 3); the study is corrosion-product-layer focused
  (SEM/XRD/XPS), weight-loss rate not tabulated at in-envelope conditions.
- CPT side: reachable duplex CPT values are either electrochemical-basis (ASTM G150 in
  NaCl — **not** the G48 / 6% FeCl₃ basis the PitCast correlation is calibrated on; a
  basis mismatch would corrupt the spot-check), or the open reviews tabulate only
  composition / PREN, not measured CPT.

**Five CO₂ sources examined, all out of envelope or figure-only** (incl. the
library-accessible ones). The in-envelope (≤10 bar) regime's measured data lives in
older paywalled NACE/AMPP papers (e.g. Gray 1989 CORROSION/89 Paper 464; Dugstad 1994
CORROSION/94) not reachable through the current subscriptions. A point is added the
moment such a source is in hand — not before.

Conclusion: no responsibly-addable point was found. The corpus is held at its
fully-trustworthy state (CPT n=51 leave-one-out; CO₂ small cited spot-check) rather
than admit a figure-read, out-of-envelope, or wrong-basis entry. That is the correct
outcome under these rules — integrity over a larger `n`.

Excluding these is the correct outcome, not a gap. The honest statement in the
methods/limitations stands: **the corpus is small but every point is disclosed
and reproducible** — which is more than the closed validation decks of
commercial corrosion tools offer.

## ✓ Added to the corpus (2026-05-30)

After the hunt above, one source cleared every rule and **was added**:
**254 SMO (UNS S31254) — CPT 65 °C by ASTM G48 Method E** (6% FeCl₃ immersion — the
same basis the PitCast CPT correlation is calibrated on), from Outokumpu, the alloy's
originator. On-basis, in-envelope, text-stated numeric value, labelled + stable source.
It is the first high-PREN (6Mo) point on the G48 spot-check: the engine predicts
61.3 °C vs the measured 65 °C (Δ −3.7 °C, within the 6.58 °C LOO MAE). The same source's
electrochemical (ASTM G150) value of 85 °C corroborates the existing 86.49 °C
electrochemical row.

**CO₂ (in-envelope, library-sourced):** Elgaddafi et al. 2015 (*J. Nat. Gas Sci. Eng.*
27:1620; DOI 10.1016/j.jngse.2015.10.034) — autoclave, 2% NaCl, 80 °C, **pCO₂ 4.1 &
6.2 bar (in-envelope)**, text-stated steady-state LPR rates 0.32 & 0.28 mm/y. These
**break the "all CO₂ out-of-envelope" wall** — and honestly show the bulk models
*over-predict* the deeply FeCO₃-scaled steady-state rate by ~4× (in-scope envelope
coverage 33%→20%): a real, documented limitation, surfaced not hidden.

**CO₂ (in-envelope, second independent source):** Peng et al. 2024 (*Materials* 17(5):1094;
DOI 10.3390/ma17051094, MDPI open access) — Table 1 blank L360N carbon steel,
**0.323 ± 0.005 mm/y**, 40 °C, CO₂-saturated (~0.93 bar), 5 wt% NaCl, 72 h weight-loss.
Measured 0.323 vs ensemble 0.5–5.06 (best model de Waard 1995 ≈ 0.5, ~1.5× over — the
closest fit of any case).

**CO₂ (more in-envelope sources):** Aristia et al. 2019 (*Materials* 12(22):3801; DOI
10.3390/ma12223801) — St-37, 0.16 mm/y at 70 °C, CO₂-purged geothermal brine, pH 4; and
Tang et al. 2018 (*Molecules* 23(12):3270; DOI 10.3390/molecules23123270) — Q235 blank
0.385 mm/y (converted from 0.345 g/m²·h, ρ 7.85) at 60 °C, CO₂-saturated 3.5% NaCl.

Net: **6 verified cases added** this session (1 CPT G48 + **5 in-envelope CO₂ from 4
independent sources** — Elgaddafi, Peng, Aristia, Tang). The CO₂ in-scope corpus went
**3 → 8**, spanning 40–80 °C. **All five in-envelope CO₂ points fall below the model
ensemble** — the active-corrosion screening models **over-predict real multi-day
weight-loss rates by ~1.3–4× (up to ~20× for heavily-scaled / long-exposure cases)**: a
robust, quantified, decision-relevant finding (in-scope coverage 13%), surfaced not hidden.

**New domain — B31G burst validation (19 cases):** added `benchmark/b31g-burst.json` —
19 full-scale / ring corroded-pipe burst tests with **measured burst pressure** (18 from
*Eng. Failure Analysis* 108:104284 Table 4, IDTS series, DOI 10.1016/j.engfailanal.2019.104284;
1 from Qi et al. 2023, X52). `run.js` now validates `b31g.js` against them using each
specimen's actual yield: Modified-B31G mean predicted/measured ratio **0.689 (100%
conservative, MAPE 31%)**, original B31G 0.659 — i.e. the engine is appropriately
conservative (never over-predicts a burst), matching the literature (~0.72). This is the
first **measured-failure** validation of the metal-loss engine, diversifying the benchmark
beyond CPT and CO₂.

**On "industry scale":** the large CO₂ databases that would give it (e.g. the ~2400-point
NORSOK / IFE loop database, 20–160 °C) are **proprietary** — which is precisely why an open
benchmark like this is needed. The open literature yields only scattered, mostly
figure-locked points, added here one verified case at a time; no point is fabricated or
figure-read to inflate scale.

## ✓ Added (2026-05-30, cont.) — imidazoline RSC 2019, two low-T points

**Imidazoline-hydrolysate CO₂-inhibition study, RSC Adv. 9 (2019), DOI 10.1039/C9RA05322K**
(open access; values verified against the source PDF Table 1): Q235 blank **0.3289 mm/y at
20 °C (293 K)** and **0.6153 mm/y at 60 °C (333 K)**, CO₂-saturated 2 wt% NaCl, pH 4.11, 72 h
weight-loss, reported directly in mm/y (no unit conversion). The **20 °C point is the corpus's
lowest-temperature anchor.**

This grows the in-scope CO₂ corpus **8 → 10** (now **20–80 °C**); total verified cases added
this session **8** (1 CPT G48 + 7 CO₂ from 5 independent sources: Elgaddafi, Peng, Aristia,
Tang, imidazoline RSC). **Refined finding (more honest than the earlier "always
over-predicts"):** the five CO₂ models **disagree by ~10×**, and the envelope now **brackets
the measurement in ~30 % of cases (3/10)** — at mild conditions (≲1 bar, 20–60 °C, 72 h) the
**lower-bound model (de Waard 1995) tracks the measured blank rate**, while single high-rate
point estimates over-predict by up to ~10×, and for heavily-scaled / high-pCO₂ / long-exposure
cases (Elgaddafi 80 °C, 187 h) even the lowest model over-predicts ~1.3–4×. The
decision-relevant lesson stands: **never trust a single CO₂ model — the disagreement envelope
is the honest output.**

## ✓ Verified + upgraded (2026-05-30, cont.) — burst data traced to its primary source

Via METU/Elsevier access the **primary** source of the IDTS burst series was opened —
Benjamin, Freire, Vieira & Cunha, *Int. J. Press. Vessels Pip.* 145 (2016) 41–59
(DOI 10.1016/j.ijpvp.2016.06.006), "MTI JIP database of corroded pipe tests" — and:
- **Re-attributed** all 18 IDTS specimens in `b31g-burst.json` to Benjamin 2016 (primary);
  Mousavi 2020 (EFA 108:104284) is retained as the secondary tabulation.
- **Double-verified** every measured failure pressure: Benjamin Table 8 and Mousavi Table 4
  agree exactly with the stored values (e.g. IDTS 13 = 26.6 MPa, IDTS 26 = 19.8 MPa);
  geometry cross-checked against Benjamin Table 6.
- **Cross-checked the engine** against the source's own published B31G results: Benjamin
  reports B31G predicted/measured ratios of 0.39–0.83 (uniformly conservative; single-defect
  mean error 15.4 %). PitCast's `b31g.js` gives mean ratio 0.689 across all 19 — same band,
  100 % conservative. No contradiction.

The burst data is now traced to, and verified against, its origin — the strongest provenance
any point in the corpus has.

## Considered, not added (2026-06-01) — open CPT sweep after external feedback

A reviewer (asset-integrity/RBI practitioner) flagged that "extrapolating a pitting
model from 51 data points risks an illusion of precision." Acting on it, the open web
was swept for more cited, on-basis G48 CPT data:

- **Outokumpu** CPT article — only the single 254 SMO example (already in the corpus).
- **Rolled Alloys** ferric-chloride table (316L, 2205, 2507, AL-6XN, Zeron 100, 625,
  C-276; CPT 17.8 → 112.9 °C) — **NOT added.** It is **G48 Method C** (vs the
  correlation's Method A/E ferric-chloride basis), the values are explicitly labelled
  **"approximate,"** and **no per-grade composition is stated** — adding them would mean
  back-filling Cr/Mo/N from nominal specs (rule 4) on top of an approximate, off-method
  number. Padding `n` with such points is precisely the *illusion of precision* the
  feedback warns against. (Informally, the correlation predicts these seven within
  ~5 °C MAE using nominal compositions — consistent with the LOO 6.58 °C, reassuring but
  **not** benchmark-grade.)

**Conclusion:** the admissible, on-basis G48 CPT data *with stated compositions and
precise (non-approximate) values* lives in paywalled journal papers
(ScienceDirect / Elsevier) reachable only via the METU library (IP/login-gated). That
is the responsible way to grow `n` — pending library access. Growing the set with
distributor "approximate" numbers would weaken, not strengthen, the trust claim.

## ✓ Added (2026-06-01) — B31G burst corpus 19 → 52 (METU/open-repo access)

After the external reviewer's "51 points = illusion of precision" feedback and with
journal/library access available, the burst corpus was grown with **real, cited,
table-sourced** specimens. **+33 specimens (19 → 52):**

- **Cronin, D.S., *Assessment of Corrosion Defects in Pipelines*, PhD thesis, University of
  Waterloo, 2000** (UWSpace, **open access**). **32 full-scale burst tests of pipe sections
  removed from operating pipelines** — single isolated **real corrosion** defects, API 5L
  **X42 / X46 / X52 / X56**, OD **273–864 mm**. Geometry + measured failure pressure from
  Table 4.2.1; Cronin's own per-model predictions (B31G/RSTRENG/PCORRC/Ritchie&Last) from the
  page-182 table. Tables extracted with **PyMuPDF `find_tables()`** (not pdftotext, which
  scrambled the columns; not figure-reading).
- **He, P.; Zhao, B., *J. Mar. Sci. Eng.* 12(10):1810 (2024)**, DOI 10.3390/jmse12101810
  (MDPI, open). **1 X65 hydrostatic burst** (Test Pipeline 1): OD 325, t 12, L 395, d 9.3 mm,
  measured 11.4 MPa. Tests 2–4 gave only *normalized* pf/p0 → **excluded** (no absolute value).

**Extraction integrity gate (every Cronin row):** each specimen's geometry was independently
**verified** by reproducing Cronin's own tabulated original-B31G prediction with `b31g.js`.
All 32 kept rows reproduce it to within a **systematic −2…−6 %** (same sign across every
specimen — a B31G-variant offset, not a transcription error; random mis-reads would scatter).
**8 of 40 Cronin rows were excluded** because their defect depth/length did not extract cleanly
(`depth=0` artifacts) — **integrity over count**, per rule 1/4.

**Result (auto-generated `REPORT.md`):** Modified-B31G mean predicted/measured **0.766**
(96 % conservative, 50/52; MAPE **25.6 %**), original B31G **0.695** — over a now **grade- and
diameter-diverse** set. This **independently matches the peer-reviewed 149-specimen model-error
study** of Zhou, W. & Huang, G.X., *Int. J. Press. Vessels Pip.* 99–100 (2012) 1–8, DOI
10.1016/j.ijpvp.2012.06.001 (B31G test/predicted 1.473 → 0.679; Modified 1.297 → 0.771) — a
strong external cross-validation of `b31g.js`, not just a larger `n`.

## ✓ Added (2026-06-01, EXPANSION 2) — parallel-agent journal sweep (Wiley/ScienceDirect unlocked)

With the user's METU session unlocking Wiley + ScienceDirect full text, four extraction agents
swept the literature **through the authenticated browser** (each in its own tab). **Every returned
value was independently re-verified by the maintainer before admission** — agents discover/extract,
the maintainer is the integrity gate.

**Added (+30 datapoints):**
- **Burst +23 → 75 total.** Souza/Benjamin *"Part 4"* 2007 (Exp. Tech., DOI 10.1111/j.1747-1567.2006.00134.x)
  — 7 single-defect **real-corrosion** bursts (X42/X46); Freire/Benjamin *"Part 3"* 2006 (DOI
  10.1111/j.1747-1567.2006.00109.x) — 16 single machined/spark-eroded defects (X60/X80/X46/A25,
  OD 76–508 mm; depth d = t − t*). **Verification:** `b31g.js` reproduces each paper's *own* tabulated
  original-B31G **exactly (0.0 % for Part 4, ≤2.3 % for Part 3)** — definitive extraction confirmation.
- **CO₂ +5 → 16 in-scope.** 2-phenyl imidazoline (Jiang & Wang, *Arabian J. Chem.* 16:104774, 2023,
  DOI 10.1016/j.arabjc.2023.104774) — X65 blank weight-loss at 20/30/40/50 °C, Table 2 (DOI verified
  to resolve to the real peer-reviewed Elsevier-origin paper; values present in source);
  thiophene-imidazoline (Jia et al., *RSC Adv.* 2025, DOI 10.1039/d5ra04201a) — Q235 blank 1.8115 mm/a
  at **90 °C** (text-stated, maintainer-verified after two agents disagreed on text-vs-figure).
- **CPT +1 → 52.** AL-6XN wrought base metal (Qian & DuPont, *Corros. Sci.* 2010,
  DOI 10.1016/j.corsci.2010.07.007) — CPT 74 °C by 6 % FeCl₃ + 1 % HCl G48-97 immersion;
  composition matches textbook N08367.

**Excluded under the rules (honest log):**
- **Gum Arabic / N80** (JMEP 2019) — blank 4.2–4.8 mm/y looked anomalously high, KCl (not NaCl) brine,
  and the mg cm⁻²h⁻¹ → mm/y conversion is 24×-sensitive → too uncertain (excluded, not risked).
- **ER2594N super-duplex weld claddings** (Surf. Coat. Tech. 2014) — clean G48 Method-E CPT (50/40 °C),
  but **weld metal is a different metallurgical population** than the wrought-calibrated correlation
  (segregation/N-loss → systematically lower CPT); would bias the fit. Held out.
- **L360N 5 % NaCl 40 °C** (Materials 2024) — duplicate of the existing Peng 2024 case.
- **Al-Owaisi 2016** (EFA 68) — **FEA-only**; its "experimental" burst values are cited from other
  papers (one = the Part-3 IDTS2 already captured), its own values are finite-element.
- **Under-deposit X65, Nd³⁺/X52, LaCl₃/1018, 2-thiobarbituric/X60, AGGPAM, Frontiers C1018, etc.** —
  electrochemical (Icorr/LPR/EIS) or figure-only blank rates, or localized/under-deposit (out of bulk scope).

The verification gate caught a real agent error (one agent rejected the thiophene point as
figure-only; the maintainer confirmed the blank rate IS text-stated and admitted it) and a duplicate —
exactly why agent output is re-verified, never trusted blind.

## ✓ Added (2026-06-01, EXPANSION 3) — second CPT basis (electrochemical), not padding

A 5-agent / ~30-paper journal sweep (Wiley + ScienceDirect unlocked) **confirmed the G48 ceiling**:
zero new admissible wrought-base-metal G48 CPT points (the field measures CPT electrochemically;
weld-clad = different population, spec-range/nominal compositions, censored ">85 °C", and paywalled
Mori-2004 were all correctly rejected). The G48 correlation therefore stays at **n=52** — its honest,
structurally-limited ceiling.

Instead of padding G48 with off-basis values, the abundant electrochemical data was used to build a
**genuinely separate** correlation:
- **`data/cpt-electrochemical.json`** — 123 austenitic-SS records, electrochemical (potentiodynamic)
  CPT + composition + test conditions, from **Liu et al., npj Materials Degradation 2025, DOI
  10.1038/s41529-025-00563-0** (open-access Supplementary Table S1; transcribed via pdftotext).
- Fit (`run.js`): **CPT_elec = 4.096·PREN_N30 − 96.22, R² 0.93, leave-one-out MAE 6.11 °C** (n=123).
  Slope 4.10 vs the G48 slope 2.04 — the two bases scale **differently** with PREN and are **NEVER
  merged**. The benchmark reports them in separate sections (§1 G48, §1b electrochemical); `pitcast.js`
  exposes `cptMeanElec`/`cptSEElec`; the UI shows the electrochemical estimate as a distinct,
  clearly-labelled second basis (with an extrapolation guard outside PREN 23.9–47.2).

Net: **CPT validation = 52 (G48) + 123 (electrochemical) = 175 points across two cited, clearly-
separated bases.** The G48 corpus is still never padded; the electrochemical corpus is a distinct,
single-method, peer-reviewed dataset — not a dumping ground for mixed off-basis values.

## The one rule under all the others

**Never invent a datapoint, DOI, author, or condition.** A benchmark that lies
once is worthless forever. If a number cannot be sourced, it does not exist.
