# PitCast Enhancement Plan — "The Open Corrosion Standard"

> Living roadmap. Near-term (Phase 1–2) is detailed to the task level; far-term
> (Phase 3–4) is intentionally coarser and will be refined as we execute.
> **Read `feedback_pitcast_corrosion_only.md` before adding anything.** Every
> task must answer "is this corrosion?" — yes, or it does not go in.

## North Star
Be the tool engineers keep in the *other* browser tab: the open, transparent,
reproducible, uncertainty-first corrosion **screening + second-opinion** layer
that the closed giants (OLI, Honeywell Predict, DNV, BEASY) structurally cannot
copy. We do not compete on rigor or regulatory standing — we own transparency,
reproducibility, integrated breadth, and education.

## Hard guardrails (apply to every task)
- **Corrosion-only.** No generic RBI/integrity/FFS empire-building.
- **No fabrication.** No invented data, DOIs, authors, conditions, or vendor facts.
- **No overclaiming.** A task is done only when every sub-item + acceptance met.
- **No ceremony.** No audit/stamp/PE-signoff/SHA sheets. No pricing/marketing pages.
- **Browser-verified.** "Test" = visual Chrome check of graphs/tables/data, not just a script.
- **Deploy hygiene.** Bump `?v=N` cache-buster → wrangler deploy → CDN purge → verify live.

---

## PRIORITY ORDER (most important first)
1. **Phase 1 — Deepen the unique core** (the 5 tools nobody else has, across all domains). *This is the differentiation.*
2. **Phase 3 — Trust: benchmark + validation + citation.** *Without trust, uniqueness is just a demo.* (Runs in parallel with 1.)
3. **Phase 2 — Workflow fit** (data in/out, permalinks). *Drives real adoption.*
4. **Phase 4 — Depth in ONE wedge.** *Be best-in-open-class at one thing.*

---

> **STATUS — Phase 1 substantively complete, all live on pitcast.austenite.org:**
> `uq.js` framework (32 unit tests) ✓ · CO₂ T×pCO₂ disagreement map ✓ · validity-envelope +
> ensemble cards on all **5 load-bearing engines** (CO₂, CPT, B31G method-spread, FFS, MR0175) ✓ ·
> **Model Atlas** (12 domains, ~30 cited models + validity envelopes) ✓. Benchmark unchanged
> (CPT LOO MAE 6.58 °C); FFS self-test 29/29.
> **Scope decisions (closed, not gaps):** the 2-D disagreement map is on **both** multi-method
> engines — **CO₂** (5 models) and **B31G** (diverges at long/deep defects); single-model engines
> correctly have none. **CUI + HIC** carry correct-semantics **risk-window** bars (red band = inside
> the active-damage window — the inverse of the validity card). The pure **design calculators**
> (anode mass, groundbed R, galvanic ΔE) and **survey/categorical** screens (CIPS, MIC, RBI) carry
> no per-output UQ band — correctly, there is no rate-uncertainty to band — and are documented in
> the **Model Atlas**. **Phase 1 complete.**

---

> **STATUS — Phase 2 (workflow fit) complete, all live on pitcast.austenite.org:**
> **WS2.1 data-in** ✓ — ILI-CSV batch import (file/paste → header auto-map incl. real
> ROSEN/Baker-Hughes/NDT-Global synonyms → per-row B31G + interaction clustering →
> 1000-row render cap, worst-first, `d/t≥80%` → IMMEDIATE; accepts depth as **absolute mm
> _or_ %WT**) and **lab water-analysis import** on the CO₂ tab (pCO₂ from total P × mol% CO₂,
> measured-or-computed pH, every assumption + unused field flagged). **WS2.2 permalinks** ✓ —
> tab + inputs → URL hash; round-trips on a fresh load (verified a_T 95 / Cl 33000 / pH 4.5 /
> HV 240); `hashchange` restores in-page. **WS2.3 export** ✓ — `pitcast.export/1` JSON
> (inputs + result + embedded `pitcast.uq/1` interval/ensemble/citations/envelope/provenance +
> permalink + UTC + disclaimer), plus the existing PDF/XLSX/CSV. Bulk-paste `<textarea>`s are
> excluded from permalinks + JSON (verified at the selector level) so they never bloat a shared URL.
> **Honest deviations (not gaps):** ILI uses **header auto-mapping** (synonym detection) rather
> than an interactive column-picker UI — meets the "real ILI CSV imports" acceptance with less
> friction. And in the CDP-automated browser, file *downloads* can't be re-triggered
> (environmental, like the screenshot timeouts) — the JSON schema is verified from a real
> on-disk export. **Phase 2 complete.**

---

> **STATUS — Phase 3 (trust: benchmark, validation, citation) complete on the build side,
> all live/pushed:**
> **WS3.1 corpus** ✓ — 3 validation domains: pitting CPT (n=51 LOO, MAE 6.58 °C, G48 basis;
> +254 SMO), CO₂ ensemble (10 in-scope cases over 20–80 °C from 5 independent cited sources;
> envelope coverage 30 %, lower-bound model brackets mild-condition blank rates), and
> **corroded-pipe burst** (52 full-scale tests, API 5L X42–X70, OD 273–864 mm; Mod-B31G mean 0.766× measured, 96 %
> conservative, MAPE 25.6 %; matches Zhou & Huang 2012 n=149). Every point tabulated, in-envelope, DOI-cited, and (recent adds)
> verified against the source PDF; the burst series is **double-verified against its primary
> source** (Benjamin 2016 MTI JIP DB) + a secondary tabulation. **WS3.2 oracle tests** ✓ — 92
> gated assertions (`test-uq/b31g/ffs/mr0175.js`) + burst domain, enforced as a pre-deploy gate
> by `test-all.js`. **WS3.4 education** ✓ — 4 live Learn walkthroughs (CO₂/CPT/B31G/MR0175).
> **WS3.3 paper** ✓ build-side — `paper.md` + `paper.bib` + `.zenodo.json` + `CITATION.cff`
> finalized + accurate to the 3-domain benchmark.
> **The one remaining P3 item is author-gated and cannot be done by the assistant:** minting the
> Zenodo DOI + submitting to JOSS + making the repo public require the author's
> ORCID/GitHub/Zenodo login (a hard safety boundary). Steps pre-staged in
> `docs/preprint/SUBMISSION-CHECKLIST.md`. **Phase 3 complete to the limit reachable without the
> author's accounts.**

# PHASE 1 — DEEPEN THE UNIQUE CORE  (highest priority)

**Objective:** make the 5 unique tools real across *all* 13 domains, not just CO₂.
**Why first:** this is the moat that no incumbent can follow into. It also reframes
"small" into a strength: we are the meta-layer that tells engineers *how much to
trust* any corrosion number.

### WS1.1 — Universal Ensemble + Uncertainty framework  *(BLOCKS the rest of Phase 1; size: M)*
The CO₂ engine already emits `models[]`, `crMin/crMax/spread`. Generalize it into a
reusable contract every engine speaks.
- [ ] **Define the standard result schema** (one source of truth):
  `{ value, unit, interval:{lo,hi,level}, models:[{name,value,citation,envelope,inEnvelope}], spread:{abs,rel,verdict}, drivers:[{name,effect}], provenance }`.
- [ ] **Create `uq.js`** with pure helpers (unit-tested):
  - `makeEnsemble(models)` → min/max/median/mean + spread.
  - `studentTInterval(point, sd, n, level)` → prediction interval (already used in CPT — extract & reuse).
  - `spreadVerdict(rel)` → `'agree' | 'caution' | 'diverge'` with documented thresholds.
  - `envelopeCheck(inputs, env)` → per-variable `{value,lo,hi,status}` (generalize existing extrapolation guards).
- [ ] **Refactor `co2.js`** to emit the standard schema (it's closest — proves the contract).
- [ ] **Audit every engine** for whether ≥2 legitimate models exist; classify each:
  - `pitcast.js` (CPT/pitting): single correlation + Student-t PI → ensemble-of-one + measurement band; add alternate PREN coefficient sets *only if literature-supported*.
  - `b31g.js`: B31G vs Modified-B31G vs effective-area screening → genuine burst-pressure ensemble + spread.
  - `ffs.js`: RSF method variants where applicable.
  - `mr0175.js`: not a rate → emit **envelope distance** (how far inside/outside the sour limits) instead of an interval.
  - `galvanic / anode / groundbed / cpac / cips / hic / mic / cui / electrochem / interaction`: add UQ where ≥2 models exist; else surface **parameter/measurement uncertainty** honestly (don't fake an ensemble).
- [ ] **Acceptance:** every primary output carries an interval; every multi-model output carries a spread + verdict + per-model envelope flag. `uq.js` has passing unit tests in `benchmark/`.

### WS1.2 — Model-Disagreement Map  *(THE headline tool; size: M; depends on WS1.1)*
For a service, show *where the models agree vs diverge* across the operating envelope.
- [ ] **`disagreement.js`**: sweep 1–2 input axes over a grid; per cell, eval all in-domain models (reuse `uq.js`); compute spread (max/min ratio or CoV).
- [ ] **Grid generator**: linspace over axis ranges; **mask/hatch out-of-envelope cells** (don't silently extrapolate).
- [ ] **SVG heatmap renderer** (reuse schematic-visual approach):
  - Colorblind-safe diverging palette **+ secondary indicator** (hatching for OOE) — per WCAG lessons.
  - **Legend-table-below** pattern + **anchor-flipped** axis labels — per visual-collision lessons (no overlaps).
  - Overlay **"your operating point"** marker from current tab inputs.
  - Hover a cell → per-model values + which model dominates there.
- [ ] **Start with CO₂** (T × pCO₂); then pitting (T × Cl⁻ or PREN), then metal-loss.
- [ ] **Acceptance:** working CO₂ T×pCO₂ heatmap with OOE masking + operating-point marker; browser-verified clean (no label collisions); hover works.

### WS1.3 — Model Atlas  *(browsable reference = the curated-knowledge moat; size: M)*
The "assessed database" equivalent: every public corrosion model in one cited place.
- [ ] **`atlas.js` / JSON** entries: `{domain, model, equation, citation{authors,title,venue,year,doi}, envelope{var:[lo,hi]}, assumptions[], failureModes[], pitcastImplements}`.
- [ ] **DRY**: derive from existing glass-box content + `docs/vv/VR/*.md` + the methods-note references — single source of truth, no duplicate/fabricated citations.
- [ ] **Render**: filterable cards/table; each entry links to its tab; shows validity envelope inline.
- [ ] **Acceptance:** all 13 domains' primary models present with **real** citations; each links to its tab; no fabricated references (cross-checked against methods note).

### WS1.4 — Validity-Envelope Visualizer  *(size: S; depends on WS1.1)*
Make the extrapolation guards visual.
- [ ] **Number-line component** (small SVG): per variable show valid range, current value marked, OOE highlighted (icon + color, WCAG; anchor-flipped labels).
- [ ] Wire `envelopeCheck()` output into every load-bearing engine's result panel.
- [ ] **Acceptance:** every load-bearing engine shows an envelope card; OOE flagged with a secondary indicator (not color alone).

### Phase 1 — Definition of Done & test plan
- [ ] `uq.js`, `disagreement.js` grid math, envelope checks all have oracle/unit tests in `benchmark/`.
- [ ] `benchmark/run.js` self-tests still green (CPT LOO 6.58 °C, CO₂ ensemble, coverage).
- [ ] Each new panel **Chrome-verified** on its tab(s); zero console errors.
- [ ] Cache-buster bumped, deployed, CDN purged, verified live.

---

# PHASE 2 — WORKFLOW FIT  (drives adoption)

**Objective:** read what engineers already have, and let them share/export. This is
what turns a demo into a daily tool.

### WS2.1 — Data-in  *(high adoption value; size: M)*  ✅
- [x] **ILI-CSV import** (batch metal-loss): file/paste → CSV parse → **header auto-mapping** from common ROSEN/Baker-Hughes/NDT-Global synonyms (delivered in place of an interactive column-picker — meets acceptance with less friction) → per-row validation → `b31g` + interaction clustering per row → `ILI_RENDER_CAP=1000` cap → worst-first summary → CSV export. Accepts depth as **absolute mm or %WT**; `d/t≥80%` → IMMEDIATE per row (B31G §3.6).
- [x] **Lab water-analysis import** (CO₂ tab): paste "key, value" water analysis → pCO₂ from total P × mol% CO₂ → measured pH or auto (Crolet–Bonis from bicarbonate) → prefill inputs → **every assumption + unused field flagged**.
- [x] **Acceptance:** real-header ILI CSV imports + assesses + renders capped (verified — ML-003 @ 85%WT → IMMEDIATE); water analysis prefills the CO₂ tab with assumptions shown (verified).

### WS2.2 — Reproducible permalinks  *(quick win; size: S)*  ✅
- [x] Serialize current tab + inputs → compact URL hash (`#<tab>?id=val…`); `<textarea>` bulk-paste boxes excluded so they never bloat the link.
- [x] On load (and on `hashchange`), parse hash → restore inputs → recompute.
- [x] "Copy link" button in the export bar. *(Reproducibility, not an audit ceremony.)*
- [x] **Acceptance:** a link round-trips to the exact calculation on a fresh load (verified: a_T 95 / Cl 33000 / pH 4.5 / HV 240 restored after reload).

### WS2.3 — Export  *(size: S; depends on WS1.1 schema)*  ✅
- [x] Export the active result as clean **`pitcast.export/1` JSON** (inputs, result, embedded `pitcast.uq/1` interval/ensemble/citations/envelope/provenance, permalink, UTC timestamp, disclaimer) — suitable for feeding RBI/integrity tools.
- [x] Existing PDF/XLSX/CSV kept (Calc + Charts only — no audit sheets).
- [x] **Acceptance:** exported JSON validates against the schema + opens cleanly (verified from a real on-disk export). *Caveat: fresh downloads can't be re-triggered inside the CDP-automated browser — environmental; the schema + textarea-exclusion were verified directly.*

---

# PHASE 3 — TRUST: BENCHMARK, VALIDATION & STANDARD  (the moat; runs parallel to P1)

**Objective:** earn the trust that makes uniqueness matter. Transparency we have;
validation + adoption + citation we must build.

### WS3.1 — Benchmark corpus growth (honest, slow)  ✅
- [x] Inclusion rule doc: **clean tabulated, in-envelope, cited** — nothing else. → `benchmark/INCLUSION-RULES.md` (honest rejected-data log + the added-case record).
- [x] Use library access opportunistically; add verified cases; record source; re-run `run.js`; update coverage honestly. → **6 verified cases added via the live library hunt**: 254 SMO ASTM G48 CPT 65 °C (Outokumpu; on-basis, Δ −3.7 °C) + **5 in-envelope CO₂ from 4 independent sources** — Elgaddafi 2015 (80 °C, 4.1 & 6.2 bar), Peng 2024 (40 °C), Aristia 2019 (70 °C geothermal), Tang 2018 (60 °C). **CO₂ in-scope corpus 3 → 8** (T 40–80 °C); broke the "all out-of-envelope" wall. All five fall below the ensemble → bulk models **over-predict real multi-day rates ~1.3–4×** (honest; coverage 13%). *Industry-scale ceiling: the ~2400-point NORSOK/IFE loop database is proprietary — the open literature yields only scattered, mostly figure-locked points, added one verified case at a time; nothing fabricated.* Growth continues opportunistically. **(Update 2026-05-30:** +2 more CO₂ points — imidazoline-hydrolysate study, RSC Adv. 9 (2019), DOI 10.1039/C9RA05322K, Q235 blank 0.3289 mm/y @ 20 °C & 0.6153 mm/y @ 60 °C, verified vs source PDF — bring the in-scope CO₂ corpus to **10** over **20–80 °C**. Envelope coverage rose to **30 % (3/10)** as the lower-bound model (de Waard 1995) brackets mild-condition blank rates; over-prediction now confined to heavily-scaled / high-pCO₂ / long-exposure cases. See `benchmark/INCLUSION-RULES.md`.)
- [x] Keep the **"small but fully disclosed = transparency strength"** note in the methods/limitations. *(Present in `benchmark/run.js` §4 "Coverage & honesty notes".)*

### WS3.2 — Regression / oracle test expansion  ✅
- [x] Per-engine oracle suites in the gated `benchmark/`: `test-b31g.js` (27 — ASME B31G-2012 App. B Ex. 1), `test-ffs.js` (18 + embedded 29 — API 579 Parts 4-7 / NACE TM0284), `test-mr0175.js` (15 + embedded 10 — ISO 15156 boundaries), `test-uq.js` (32 — UQ math + CO₂ envelope-guard), `run.js` (CPT LOO + CO₂ ensemble vs cited data). `test-all.js` runs all (**92 gated assertions**) and is wired into `deploy.sh` as a hard pre-deploy gate. **Plus a new B31G burst-test validation domain** in `run.js` (`benchmark/b31g-burst.json`, 19 real corroded-pipe bursts): Mod-B31G mean predicted/measured ratio 0.689, **100% conservative**, MAPE 31% — the first measured-failure validation of the metal-loss engine.

### WS3.3 — Methods paper / citation  *(drafted — final submit is author-gated)*
- [x] Preprint finalized: long-form `docs/preprint/METHODS-NOTE.md` + **JOSS `paper.md` + `paper.bib`** (10 references, no fabricated DOIs — unverified ones flagged for the author), with `.zenodo.json` + `CITATION.cff` ready.
- [ ] Pick venue (JOSS ✓) + mint Zenodo DOI + submit. → prepared to one-click via `docs/preprint/SUBMISSION-CHECKLIST.md`; **the final mint/submit needs the author's ORCID/GitHub/Zenodo login** (account creation + authentication is a safety boundary the assistant won't cross). *Author action: ORCID, email, affiliation, public repo URL, confirm 4 journal DOIs.*

### WS3.4 — Education (the Thermo-Calc adoption flywheel)  ✅
- [x] Worked-example walkthroughs per core domain (extend "show your work" mode into tutorials), **integrated into the console**. → **4 live walkthroughs** in the Learn tab (`learn.js`, domain selector): CO₂ ensemble (5-model spread → DIVERGE), CPT pitting (PRENₙ₃₀ → Student-t P(pit)), B31G metal-loss (Folias → Barlow; original vs Modified, P_safe 54.3/55.7 bar matching the oracle), MR0175 sour-spec (ISO 15156 decision tree). Every number computed live by the real engine.
- [x] A "learn corrosion screening" track linked from the Atlas. → "Learn" console tab, deep-linkable (`#learn`), CTA in the Model Atlas intro; each lesson deep-links back to its console tab.

---

> **STATUS — Phase 4 (CO₂ wedge) in progress (2026-05-30):** chose **CO₂** as the wedge
> (existing 5-model strength). Engine + benchmark + docs done, **gate green (119
> assertions)**: **(1)** faithful de Waard 1995 fugacity coefficient applied across the
> full pressure range (was φ=1 below 250 bar — over-stated the driving force at high P);
> **(2)** dedicated `benchmark/test-co2.js` oracle suite (27 assertions, hand-derived from
> the published equations); **(3)** embedded per-model **validated accuracy** + `recommendModel()`
> (DWM-1995 best, MAE 1.12 mm/y; honest ~10× spread caveat; regime notes); **(4)**
> availability-weighted `inhibitedRate()` (CR·(1−avail·eff)); **(5)** `docs/CO2-WEDGE.md`
> (the documented best-in-class write-up). **Remaining (browser-gated):** surface
> `recommendModel` / `inhibitedRate` in the CO₂ tab UI, browser-verify, deploy, and sync to
> the public `pitcast` repo. All engine work committed to the dev repo; **not yet live.**

# PHASE 4 — GO DEEP IN ONE WEDGE  (be best-in-open-class at one thing)

**Pick the wedge (recommend CO₂ ensemble+UQ — existing strength).** Don't chase depth everywhere.
- **If CO₂:** FreeCorp-parity point model; NORSOK glycol/inhibitor/scaling correction factors; de Waard flow + scaling factors; expand the CO₂ benchmark; make the disagreement map best-in-class.
- **If metal-loss:** effective-area (RSTRENG-style) beyond B31G; interacting-defect rules; river-bottom profile from ILI.
- **Acceptance:** the chosen wedge is demonstrably the best *open* implementation, benchmarked + documented.

---

## CROSS-CUTTING (every phase)
- **Accessibility:** WCAG contrast + secondary indicators on all critical verdicts.
- **Visual QA:** anchor-flip x-labels, legend-table-below, greedy label dodging (per visual-collision audit lessons).
- **Performance:** render caps, lazy compute on heavy grids.
- **CI:** `benchmark/run.js` self-tests green before every deploy.
- **Scope:** every task answers "is this corrosion?"

---

## DEPENDENCY-ORDERED BACKLOG (concrete "do next")
1. `uq.js` shared framework *(blocks P1)* — **M**
2. Refactor `co2.js` to standard schema *(proves framework)* — **S**
3. Disagreement map for CO₂ *(headline)* — **M**
4. Envelope visualizer *(all engines)* — **S**
5. Extend ensemble/UQ → pitting/CPT + b31g — **M**
6. Model Atlas — **M**
7. Reproducible permalinks *(independent quick win)* — **S**
8. ILI-CSV import *(adoption)* — **M**
9. Export JSON/CSV *(depends on #1)* — **S**
10. Lab water-analysis import — **S/M**
11. Benchmark growth + tests *(ongoing)* — **L**
12. Preprint submit *(author)* — **S**
13. Educational walkthroughs — **M**
14. Deep wedge — **L**

## MILESTONE UNLOCKS (what each buys, honestly)
- After #1–#3: **first unique tool live** — "PitCast shows you how much to trust the number." Demo-able, genuinely novel.
- After #4–#6: **the meta-layer is complete** — disagreement + envelope + atlas across domains. This is the "only one who has it" claim, made real.
- After #7–#10: **adoptable by a real engineer** — reads their data, shares a calc, exports to their stack.
- After #11–#12: **citable** — the trust artifact + a DOI. Citations are the "revenue" of the research-vehicle model.
- After #13–#14: **standard + best-in-class wedge** — taught, and demonstrably #1 open at one thing.

## RISKS & GUARDRAILS
- **Scope drift** → corrosion-only check on every task.
- **Fabrication** → no fake data/citations/vendor claims; verify before publishing any competitor fact.
- **Overclaiming** → DoD discipline; nothing marked done until acceptance met.
- **Visual regressions** → browser QA every deploy.
- **Trust-before-claims** → never imply regulatory standing; screening-grade is the brand.

## HONEST CEILING
In 1–2 years this can make PitCast *the* open corrosion-screening + transparency
standard — cited, taught, used as the free second opinion. That is a real,
compounding asset and the stated career/research vehicle. It is **not** a
near-term path to "worth millions" (that needs decades + a curated data moat +
a commercial model, which is explicitly off the table now). The near-term goal
is **reputation and adoption, not valuation.**
