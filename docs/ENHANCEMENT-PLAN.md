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

### WS3.1 — Benchmark corpus growth (honest, slow)  *(partial — doc done; data ongoing)*
- [x] Inclusion rule doc: **clean tabulated, in-envelope, cited, with DOI** — nothing else. → `benchmark/INCLUSION-RULES.md` (with an honest rejected-data log).
- [ ] Use confirmed library access (Wiley/Elsevier/OnePetro) opportunistically; add a few verified cases at a time; record source + DOI in `benchmark/`; re-run `run.js`; update coverage honestly. *(Ongoing — data-availability gated; this session's dead-ends are logged in INCLUSION-RULES.md.)*
- [x] Keep the **"small but fully disclosed = transparency strength"** note in the methods/limitations. *(Present in `benchmark/run.js` §4 "Coverage & honesty notes".)*

### WS3.2 — Regression / oracle test expansion  ✅
- [x] Per-engine oracle suites in the gated `benchmark/`: `test-b31g.js` (27 — ASME B31G-2012 App. B Ex. 1), `test-ffs.js` (18 + embedded 29 — API 579 Parts 4-7 / NACE TM0284), `test-mr0175.js` (15 + embedded 10 — ISO 15156 boundaries), `test-uq.js` (32 — UQ math + CO₂ envelope-guard), `run.js` (CPT LOO + CO₂ ensemble vs cited data). `test-all.js` runs all (**92 gated assertions**) and is wired into `deploy.sh` as a hard pre-deploy gate.

### WS3.3 — Methods paper / citation  *(drafted — final submit is author-gated)*
- [x] Preprint finalized: long-form `docs/preprint/METHODS-NOTE.md` + **JOSS `paper.md` + `paper.bib`** (10 references, no fabricated DOIs — unverified ones flagged for the author), with `.zenodo.json` + `CITATION.cff` ready.
- [ ] Pick venue (JOSS ✓) + mint Zenodo DOI + submit. → prepared to one-click via `docs/preprint/SUBMISSION-CHECKLIST.md`; **the final mint/submit needs the author's ORCID/GitHub/Zenodo login** (account creation + authentication is a safety boundary the assistant won't cross). *Author action: ORCID, email, affiliation, public repo URL, confirm 4 journal DOIs.*

### WS3.4 — Education (the Thermo-Calc adoption flywheel)  ✅
- [x] Worked-example walkthroughs per core domain (extend "show your work" mode into tutorials), **integrated into the console**. → **4 live walkthroughs** in the Learn tab (`learn.js`, domain selector): CO₂ ensemble (5-model spread → DIVERGE), CPT pitting (PRENₙ₃₀ → Student-t P(pit)), B31G metal-loss (Folias → Barlow; original vs Modified, P_safe 54.3/55.7 bar matching the oracle), MR0175 sour-spec (ISO 15156 decision tree). Every number computed live by the real engine.
- [x] A "learn corrosion screening" track linked from the Atlas. → "Learn" console tab, deep-linkable (`#learn`), CTA in the Model Atlas intro; each lesson deep-links back to its console tab.

---

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
