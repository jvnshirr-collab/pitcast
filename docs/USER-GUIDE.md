# PitCast — User Guide

PitCast is an open-source (Apache-2.0), browser-based **corrosion-engineering screening
tool**. It estimates localized corrosion, corroded-pipe remaining strength, cathodic
protection, and several damage mechanisms — and shows the governing equation, the primary
standard citation, and an honest **validation tier** behind every number.

> **PitCast is a screening tool, not a fitness-for-service authority.** It has **no PE seal**,
> no third-party V&V, and no peer review. It is for triage, candidate-narrowing, and
> education. High-consequence integrity or material-selection decisions require a qualified
> engineer, verified inputs, and the full code procedure. See
> [Appropriate use & limitations](#5-appropriate-use--limitations).

This guide is honest about what each engine can and cannot do. The authoritative per-engine
classification lives in [`docs/ENGINE-STATUS.md`](ENGINE-STATUS.md); the numbers behind the
validated engines live in [`docs/VALIDATION.md`](VALIDATION.md). Where this guide quotes a
tier or a figure, it is copied from those documents.

---

## Contents

1. [What PitCast is, and how to run it](#1-what-pitcast-is-and-how-to-run-it)
2. [How to read an output](#2-how-to-read-an-output)
3. [The validation tiers](#3-the-validation-tiers)
4. [The tabs / engines, one by one](#4-the-tabs--engines-one-by-one)
   - [CRA pitting & selection — Assess / Select / Compare / Selection map / Browse data](#41-cra-pitting--selection-assess--select--compare--selection-map--browse-data)
   - [CO₂ corrosion](#42-co₂-corrosion)
   - [CP / AC](#43-cp--ac)
   - [Integrity (B31G)](#44-integrity-b31g)
   - [ILI batch](#45-ili-batch)
   - [FFS (API 579)](#46-ffs-api-579)
   - [MR0175 spec](#47-mr0175-spec)
   - [CIPS / DCVG](#48-cips--dcvg)
   - [Vendor products / Model atlas / Learn](#49-vendor-products--model-atlas--learn)
5. [Appropriate use & limitations](#5-appropriate-use--limitations)

---

## 1. What PitCast is, and how to run it

**What it is.** A glass-box console for *screening-level* corrosion engineering:

- Ranking corrosion-resistant alloys (CRAs) for chloride pitting, chloride-SCC and sour SSC.
- Estimating carbon-steel CO₂ ("sweet") corrosion rates with a five-model disagreement view.
- Checking sour-service acceptability against ISO 15156 / NACE MR0175.
- Estimating the remaining strength of corroded pipe with ASME B31G / Modified B31G, and
  triaging in-line-inspection (ILI) defect lists.
- A corrosion-only subset of API 579 fitness-for-service (general/local metal loss, pitting,
  HIC blistering).
- Cathodic-protection criteria, sacrificial-anode sizing, groundbed resistance, galvanic
  couples, and CIPS/DCVG survey ingestion.
- Damage-mechanism screens: CUI, HIC/SOHIC, MIC.

**What it is *not*.** It is not validated for final design; it is not a substitute for
alloy- or heat-specific qualification testing; it is not a fitness-for-service determination;
and it does not carry any professional-engineer sign-off. It *complements* a qualified
corrosion engineer — it never replaces one.

**How to run it.**

- **Online:** open <https://pitcast.austenite.org>. Everything runs client-side in your
  browser — no server, no account, no telemetry.
- **Locally:** it is a static site (dependency-free vanilla JS, no build step). Serve the
  repository root with any static file server and open `index.html`, e.g.

  ```bash
  python -m http.server 8137     # then open http://localhost:8137
  # or:  npx serve .
  ```

- **Reproduce the validation numbers** (requires Node.js):

  ```bash
  node benchmark/run.js       # regenerates results.json + REPORT.md from the cited data
  node benchmark/test-all.js  # the standards' worked-example oracle gate (pre-deploy)
  ```

  Every headline figure in `docs/VALIDATION.md` regenerates from `node benchmark/run.js`
  over only the cited, in-repo measured data. Nothing in the report is hand-edited.

**Exporting.** Each tab can copy a shareable link, print to PDF (one results card), or
export a multi-sheet XLSX (Inputs / Results / Citations), CSV, or JSON. Exports are pure
calculation plus cited references — no sign-off ceremony.

---

## 2. How to read an output

PitCast deliberately does **not** hand you a single confident number. Read the uncertainty,
not the point estimate. Three patterns recur across the tool:

### Prediction intervals (pitting / CPT)

The pitting engine fits the Critical Pitting Temperature (CPT) from composition and returns a
**Student-t prediction interval**, not a bare CPT. The point CPT carries real scatter; the
interval (built from the fit's residual standard error) is the decision-relevant output.
Pitting risk is then expressed as a **probability** — `P(pit) = P(CPT < service temperature)`
— rather than a yes/no. A 30 % pitting probability with a wide interval is a "go test it"
flag, not a "safe" verdict. Individual alloys can miss the correlation by far more than the
average error (see the CPT tier below), so confirm critical selections with alloy/heat-specific
ASTM G48 testing.

### The CO₂ model-disagreement band (the spread *is* the answer)

The CO₂ tab runs **five** published models on one operating point. They can disagree by
**~10× to >1000×**. PitCast reports the **envelope** (`crMin … crMax`) and treats that spread
as the honest uncertainty — point accuracy is explicitly **not** the deliverable. When the
models cluster tightly, you have a usable estimate; when they fan out, the domain genuinely
does not support a precise prediction and you should lean on the lower-bound model / measured
data / a specialist. The tab names the best-fit model on the cited corpus, but always with the
spread caveat attached.

### The validation-tier badge

Every engine carries one of three tier badges — **Validated**, **Standard-reproducing**, or
**Screening-only** — telling you exactly how far to trust the output. This is the single most
important thing to read before acting on a number. The tiers are defined next.

A footnote you will see on the load-bearing engines: a **screening caveat string** rides on
each B31G, API 579, and CPT result, restating that it is a Level-1 screen and not a
determination. That text is not boilerplate to skip — it is the engine telling you its limits.

---

## 3. The validation tiers

PitCast classifies each engine by *what is actually established about it*. These definitions
are copied verbatim from [`docs/ENGINE-STATUS.md`](ENGINE-STATUS.md):

| Tier | Meaning |
|---|---|
| **Validated** | Predictions checked against cited **measured** data, with reproducible tests/anchors. |
| **Standard-reproducing** | Faithfully implements + reproduces a named published standard/correlation (verification ✓). **Not** independently validated against measured data. |
| **Screening-only** | Heuristic / author-assembled factor model built on cited standards. **Not** validated and **not** a verbatim standard reproduction — a triage flag; refer to testing. |

Plain-language reading:

- **Validated** — the engine has been compared to real measured data and the error is known
  and reproducible. You can lean on it for screening with a stated error bar. (Still not a
  design authority.)
- **Standard-reproducing** — the engine computes the published standard correctly (its
  worked examples reproduce), but nobody has checked the *standard's* prediction against
  measured field outcomes inside PitCast. Trust the arithmetic; the standard's own
  conservatism and scope still apply.
- **Screening-only** — an author-assembled factor model that combines cited standards into a
  risk ranking. Use it to *prioritize and triage*, never as a number to design to. Most of
  these self-flag "order-of-magnitude only" in their output.

The badge you see in the UI is wired from the same matrix as the table below.

---

## 4. The tabs / engines, one by one

For each tab: purpose, inputs (with units), outputs (and how to read the uncertainty),
validity envelope, and the validation tier copied from `ENGINE-STATUS.md`.

> Conventions used throughout: temperature in °C unless toggled; chloride in ppm or mg/L (the
> input label says which); H₂S as a partial pressure in kPa; pressures in bar (absolute for
> pCO₂); hardness as Vickers HV unless stated. The **Integrity (B31G)** tab has an SI ↔
> US-customary units toggle (see [§4.4](#44-integrity-b31g)).

---

### 4.1 CRA pitting & selection (Assess / Select / Compare / Selection map / Browse data)

**Engine:** `pitcast.js` · **Tier: ✅ Validated** (CPT/PREN correlation), with a separate
**Standard-reproducing** sour-envelope screen (ISO 15156-3 Annex A) and **Screening-only**
chloride-SCC and sour-SSC sub-scores layered on top.

Five tabs share this one engine:

- **Assess an alloy** — one grade vs one service condition.
- **Select the best alloy** — recommends the *cheapest* built-in grade whose overall risk
  clears a threshold you set (avoids over-specification).
- **Compare grades** — up to 5 candidates side-by-side against shared conditions; best/worst
  cell per metric highlighted; the cheapest grade clearing the threshold is starred.
- **Selection map** — a probabilistic Material Selection Diagram: sweeps the engine across a
  T × Cl⁻ (or sour pH₂S × T) window and overlays the safe operating limit, plus a
  physics-vs-ISO-15156-3-code diff at the operating point.
- **Browse data** — the cited measured records (Nyby et al., *Scientific Data* 2021, CC BY
  4.0); click any record to load its composition into Assess.

**Inputs.** Grade (search 400+ alloys by name / UNS / element, or load a composition);
Temperature (°C); Chloride (ppm); pH; H₂S partial pressure (kPa); Tensile stress (× yield,
0–1); Hardness (HV). *Advanced:* ageing/PWHT temperature (°C) and time (h) for a σ-phase
estimate — e.g. ~850 °C for 4 h precipitates σ-phase and sharply lowers CPT. Select/Compare
add an acceptable-risk threshold P.

**Outputs.**
- **PREN** (reported as Cr + 3.3·Mo + 16·N) and the **PREN_N30** descriptor (30·N) used for
  CPT, plus ferrite % and inferred family.
- **CPT** with a **Student-t prediction interval** (the headline uncertainty — read this, not
  the point value), on an ASTM G48 / 6 % FeCl₃ basis. A **separate** electrochemical
  (potentiodynamic) CPT estimate is available from a distinct correlation; the two are never
  merged (they scale differently with PREN).
- **P(pitting)**, **P(chloride-SCC)**, **P(sour-SSC)**, an **overall** risk (the max), and the
  **dominant** mechanism.
- **ISO 15156-3 sour envelope** status (within / exceeds / untabulated) at the operating point.
- **Relative cost** (vs 304L) for the selection logic.

**How to read it.** Pitting risk is a probability with an interval, not a pass/fail. CPT is
clamped to a physical window (≥120 °C ≈ effectively immune in practical aqueous service, since
the test electrolyte boils; ≤−15 °C ≈ pits at any service temperature). The σ-phase ageing
input *lowers* CPT — useful for weld/PWHT screening — but is itself a screening estimate.

**Validity / limits.** The CPT correlation is fit on **ASTM G48 (6 % FeCl₃) lab data**, not
service conditions; individual alloys can miss by ≫ the average error in leave-one-out (the
docs cite N06625 missing by −23.6 °C). The chloride adjustment, chloride-SCC logistic, and
sour-SSC hardness penalty are **screening** factor models. The ISO 15156-3 Annex-A sour
envelope is a **Standard-reproducing** boundary check, not a substitute for the full
alloy-specific T/Cl/pH₂S/S qualification in ISO 15156-3.

**Validation tier detail (from `ENGINE-STATUS.md` / `VALIDATION.md`).** The CPT engine is
**Validated** on two separate measured bases:
- **ASTM G48 / FeCl₃ basis:** leave-one-out MAE **6.6 °C** (n = 52), RMSE 8.45 °C, bias
  −0.01 °C; full-sample R² 0.84. Deployed model `CPT = 2.038·PREN_N30 − 32.73`.
- **Electrochemical (potentiodynamic) basis:** leave-one-out MAE **6.11 °C** (n = 123),
  R² 0.93 — a *separate* correlation (slope 4.10 vs 2.04), surfaced as a distinct estimate.
- Total CPT validation = **175 points across two bases** (Nyby et al. 2021 + AL-6XN;
  npj Materials Degradation 2025).

---

### 4.2 CO₂ corrosion

**Engine:** `co2.js` · **Tier: ✅ Validated *(as a disagreement ensemble)* + 📐 reproduces 5
models.**

**Purpose.** Sweet (CO₂) corrosion of carbon steel: run five canonical models on one operating
point and read their disagreement as your uncertainty. Also computes in-situ pH, FeCO₃ scaling
tendency, the sweet/sour regime, an API RP 14E erosional-velocity check, and corrosion-allowance
/ inhibitor-efficiency bookkeeping.

**The five models:** de Waard–Milliams 1975 (classical, conservative, no flow/scale/pH);
de Waard 1995 (resistance-in-series + fluid/pH/scale/glycol factors); NORSOK M-506:2017
(K_T table × fugacity × wall-shear × f(pH)); NESC / Cassandra (mechanistic); Multicorp /
FreeCorp (mechanistic, with an H₂S co-effect).

**Inputs.** Temperature (°C); pCO₂ (bar abs); in-situ pH (blank = auto via Crolet–Bonis charge
balance); liquid velocity (m/s); pipe ID (m); Fe²⁺ (mg/L); pH₂S (kPa); water cut (0–1);
glycol/MEG fraction; bicarbonate (mg/L HCO₃⁻); hydrocarbon type (crude / condensate /
water-only); exposure age (h); plus a corrosion-allowance block (design life yr, allowance mm).
A preset list and a "paste lab water analysis" importer are provided.

**Outputs.** A corrosion rate (mm/y) per model; the **envelope `crMin … crMax`** and its spread
factor; a verdict band on `crMax` (PASS < 0.1 / WATCH 0.1–1 / CRA candidate 1–5 / CRA mandatory
> 5 mm/y); in-situ pH; FeCO₃ scaling tendency (protective if ST > 1); the sweet/mixed/sour
regime from the pCO₂/pH₂S ratio; rate drivers (what is moving the number); and the
corrosion-allowance / required-inhibitor-efficiency result.

**How to read it (important).** **The spread is the answer.** Do not pick one model's number.
At mild conditions (≲ 1 bar, 20–90 °C) the ensemble brackets measured rates well and the
lower-bound model tracks them; the spread blows up — and coverage fails — for scaled, high-pCO₂,
or long-exposure cases. The tab names a best-fit model but always with the disagreement caveat.
A few cited cases are shown deliberately **out of scope** (e.g. a 13Cr CRA, a top-of-line
condensing case) to demonstrate the bulk-flowline models correctly failing.

**Validity envelope.** Carbon steel, sweet (CO₂-dominated) aqueous service. The models are
validated only inside their published envelope: **T 20–150 °C, pH 3.5–6.5, pCO₂ ≲ 10 bar**.
High-pressure / supercritical CO₂ is out of scope and flagged by the tool. If the pCO₂/pH₂S
ratio puts you in the **mixed or sour** regime, the CO₂ models are unreliable and PitCast says
so (use a sour model + NACE MR0175 / ISO 15156 cracking checks).

**Validation tier detail (from `VALIDATION.md`).** Treated as a **disagreement ensemble**:
16 in-scope cited carbon-steel cases (20–90 °C, 8 independent sources). **Envelope coverage
56 %** — measurement falls inside the 5-model spread in 9/16 cases. Per-model MAE (mm/y):
DWM-1995 **0.94** (best) · NORSOK 2.95 · NESC 3.06 · FreeCorp 32.59 · DWM-1975 140.32. This is
a small, indicative spot-check: the large CO₂-loop databases are proprietary and most open CO₂
rates are figure-locked. The individual models are **Standard-reproducing** (27 oracle
assertions in `test-co2.js`).

---

### 4.3 CP / AC

This tab hosts five corrosion-control engines.

#### CP criteria + AC-corrosion screen — `cpac.js`
**Tier: 📐 Standard-reproducing (CP criteria); 🔎 Screening-only (the AC corrosion-*rate*
sub-output, self-flagged indicative).**

- **Purpose.** Is buried/submerged carbon-steel pipe protected per AMPP/NACE SP0169, and is AC
  corrosion a threat per ISO 18086 at a coating holiday?
- **Inputs.** AC touch voltage Vac (V); soil resistivity (Ω·m); holiday diameter (mm); CP DC
  current density Jdc (A/m²); CP potentials in mV vs Cu/CuSO₄ — ON (IR-included), instant-off
  (polarized), and native/depolarized.
- **Outputs.** Whether the −850 mV (polarized) and 100 mV polarization-shift criteria are met
  and the IR drop between ON and instant-off (the classic over-read trap); the AC current
  density Jac at the holiday (spread-resistance model), its ISO 18086 band (< 30 low / 30–100
  elevated / ≥ 100 high), the Jac/Jdc interplay, and a mitigation flag; plus an **indicative**
  AC corrosion rate.
- **How to read it.** The −850 mV criterion is judged on the **instant-off** (IR-free) reading
  — the ON potential includes IR drop and can falsely "pass". The AC corrosion *rate* is
  **order-of-magnitude only**, explicitly flagged "indicative — not a design corrosion rate";
  use it only to rank/triage.
- **Limits.** Uniform isotropic soil; small circular defect (half-space, no proximity
  correction); steady AC touch voltage. Screening.

#### Sacrificial-anode sizing — `anode.js`
**Tier: 📐 Standard-reproducing (DNV-RP-B401).**

- **Purpose.** Required net sacrificial-anode mass and per-zone current demand for a structure.
- **Inputs.** Structure area (m²); design life (yr); environment (pick from a catalogue of
  seawater / brackish / buried-soil / tank environments, each carrying T, depth, salinity, O₂,
  resistivity context); coating category (DNV linear-breakdown class / FBE / 3LPE / TSA …);
  anode alloy (Al-Zn-In / Zn / Mg variants). Optional service-T and depth overrides.
- **Outputs.** Initial/mean/final current demand (A), charge Q (Ah), net and gross anode mass
  (kg), and number of standard anodes; coating-breakdown and T/depth correction factors shown.
- **Limits.** The environment current densities and T/depth corrections are DNV "typicals."
  Final geometry, attenuation, resistance to remote earth, and end-of-life polarization
  verification still require a detailed CP design.

#### Galvanic couple — `galvanic.js`
**Tier: 🔎 Screening-only.**

- **Purpose.** Two-metal couple in a shared electrolyte: which member dissolves, the driving
  ΔE, and a mixed-potential rate estimate on the anode.
- **Inputs.** Metal A and Metal B (from a cited alloy series); electrolyte (seawater / 3.5 %
  NaCl / fresh / soil / 1N H₂SO₄ / 1N HCl); temperature (°C); cathode/anode area ratio (≥ 1);
  chloride (ppm, overrides env); flow regime (sets the O₂-diffusion limit); optional per-heat
  MTC E_corr overrides.
- **Outputs.** Identified anode/cathode and their E_corr; ΔE (mV); a risk band keyed to ΔE and
  area ratio; and a **screening** anode penetration rate (mm/yr) via ASTM G102, capped at the
  cathodic O₂-diffusion limit.
- **How to read it.** The **compatibility decision** rests on the ΔE bands (< 50 mV compatible;
  50–100 minor; 100–250 isolate; > 250 severe). The **rate** is a screening estimate — the
  E_corr/Tafel/i₀ inputs are family typicals (vendor data varies by ±30 mV and ±a decade in
  i₀), and the rate is self-flagged as screening. Use vendor-specific polarization data for
  design.

#### Groundbed resistance — `groundbed.js`
**Tier: 📐 Standard-reproducing (Dwight 1936 / Sunde 1949 closed-form).**

- **Purpose.** Anode-to-earth resistance for an impressed-current bed (sets the current a
  rectifier can drive at a given voltage).
- **Inputs.** Soil resistivity (Ω·m); number of anodes n; anode length L (m); diameter d (mm);
  spacing s (m); driving voltage (V).
- **Outputs.** Single vertical/horizontal anode resistance, the multi-anode bed resistance
  (self + mutual-interference terms, Sunde), and the resulting current (Ohm's law).
- **Limits.** Uniform soil; the Sunde multi-rod term is best for s ≫ L. Reproduces the NACE
  SP0169 Appendix-A worked example (≈13.7 Ω single vertical anode).

#### Electrochemistry reference — `electrochem.js`
**Tier: ✅ Validated** (ASTM G3/G5/G59/G102; Stern–Geary; Galvele) with measured anchors
(ASTM G5-14 round-robin on 430 SS; Jones 1996). It supplies cited polarization parameters to
the galvanic engine. *(Per `ENGINE-STATUS.md`, wiring its embedded measured-data checks into
the deploy gate is a tracked follow-up action.)*

---

### 4.4 Integrity (B31G)

**Engines:** `b31g.js` (burst + remaining life) plus the **screening** damage screens
`cui.js`, `mic.js`, and `hic.js` on the same tab.

**B31G corroded-pipe FFS — `b31g.js` · Tier: ✅ Validated + 📐 reproduces ASME B31G.**

- **Purpose.** Remaining strength of pipe carrying an axial **external metal-loss** defect:
  predicted failure pressure, safe operating pressure (P_f / SF), and a triage band. Plus a
  general uniform-rate remaining-life calculator.
- **Units toggle (NEW).** This tab has an **SI ↔ US-customary** units selector. SI = mm · bar
  · MPa · mm/yr; US = in · psi · ksi · mpy. **Conversions happen only at the UI boundary** —
  the engine always computes in SI, so toggling units never changes the physics. The factors
  are exact and oracle-tested (`benchmark/test-units.js`).
- **Inputs.** Pipe OD (D) and wall thickness (t); API 5L grade (sets SMYS); MAOP; defect
  length (L) and max depth (d); method (Modified B31G = 0.85·dL, RSTRENG-derived; or Original
  B31G = 0.667·dL, most conservative). Remaining-life block: corrosion rate (CR), design life,
  minimum WT, inhibitor efficiency η.
- **Outputs.** Folias bulging factor M; flow stress; failure pressure P_f and safe pressure
  P_safe (both in your chosen units); the d/t ratio and a verdict band — **PASS** (within
  allowable) / **MONITOR** (50–80 % wall loss) / **REPAIR** (P_safe < MAOP) / **IMMEDIATE**
  (≥ 80 % wall, replace before re-pressurise). Remaining life returns years to minimum WT and
  required inhibitor efficiency.
- **How to read it.** **Original B31G is the safe-side choice** (100 % conservative on the
  cited corpus); **Modified B31G over-predicts** some deep/low-grade defects. Every result
  carries a screening caveat: B31G is a Level-1 screen, not an FFS determination — use verified
  (not vendor-default) inputs and the full ASME B31G / API 579 procedure for any
  run/repair/replace decision.
- **Validity / limits.** Single axial external metal-loss defects (the parabolic/area methods);
  through-wall and very deep defects are flagged. Thin-shell (Barlow) pressure. No
  interaction handling here — use the ILI tab for clustering.
- **Validation tier detail (from `VALIDATION.md`).** Validated against **75 full-scale burst
  tests**, API 5L A25–X80, OD 76–864 mm, real + machined defects. **Original B31G:** mean
  predicted/measured **0.678**, **100 % conservative (75/75)**, MAPE 32.2 %. **Modified B31G:**
  mean **0.822**, 80 % conservative, MAPE 24 %. Independently cross-checked against Zhou &
  Huang 2012 (n = 149; their predicted/measured 0.679 — near-exact agreement). Also reproduces
  the ASME B31G-2012 Appendix B Example 1 (P_safe ≈ 54.3 bar).

**CUI risk — `cui.js` · Tier: 🔎 Screening-only.**
- Corrosion-under-insulation (carbon steel) and external chloride-SCC (austenitic SS) risk
  ranking. **Inputs:** material (CS / SS); service T (°C); insulation type; weather jacket;
  under-insulation coating; ambient (ISO 9223 corrosivity); age in service; cyclic/wet-dry
  flag. **Outputs:** a risk score and level (low/medium/high/severe), an indicative inspection
  interval, the contributing factors, and warnings when an insulation/coating is used outside
  its service-T window or has high ASTM C871 leachable chloride (which amplifies SS ext-CSCC).
  **Limit:** self-flagged "order-of-magnitude risk ranking only" — not a CUI inspection plan or
  FFS.

**MIC risk — `mic.js` · Tier: 🔎 Screening-only.**
- Microbiologically-influenced-corrosion family screen (SRB / APB / IRB / SOB). **Inputs:**
  system T (°C); sulphate (mg/L); oxygen state; nutrient level; flow regime; biocide programme.
  **Outputs:** dominant organism family, a risk score/level, and a monitoring/treatment
  recommendation. **Limit:** self-flagged "not a substitute for site-specific bug counts and
  corrosion coupons."

**HIC / SOHIC risk — `hic.js` · Tier: 🔎 Screening-only.**
- Hydrogen-induced-cracking / stress-oriented-HIC screen for carbon/low-alloy steel in wet
  sour service. **Inputs:** pH₂S in water (kPa); in-situ pH; steel S (wt %); hardness (HV);
  water cut; stress (× YS). **Outputs:** HIC and SOHIC indices and levels, the dominant
  mechanism, and a mitigation hierarchy. HIC requires free water and pH₂S > 0.34 kPa
  (ISO 15156 sour threshold); SOHIC adds tensile-stress amplification, dominant above ~250 HV.
  **Limit:** self-flagged "not a substitute for NACE TM0284 plate testing."

---

### 4.5 ILI batch

**Engine:** `b31g.js` (per-defect burst) + `interaction.js` (clustering) · **Tier: ✅
Validated** (the B31G burst calc) **+ 📐 Standard-reproducing** (`interaction.js` clustering
rules). *(Per `ENGINE-STATUS.md`, adding a dedicated oracle test for `interaction.js` is a
tracked follow-up action.)*

**Purpose.** Triage a whole ILI defect list: upload/paste a CSV of corrosion features, apply
pipeline-level geometry + grade + MAOP, optionally cluster interacting defects, and get a
sortable, colour-coded PASS / MONITOR / REPAIR / IMMEDIATE grid with summary stats.

**Inputs.** Pipeline defaults: OD, WT, API 5L grade, MAOP, FFS method (Modified or Original
B31G). Defect CSV with **required** columns `id, length_mm, depth_mm` (optional: `chainage_m,
clock_pos, width_mm, defect_type`); a sample CSV is provided. **Multi-defect interaction
(clustering) rule:** None / DNV-RP-F101 §3.7 (axial 2√(D·t), circ π√(D·t)) / B31G–Mod-B31G
(25.4 mm axial threshold) / POF-100 §7 (interaction-box). Tool-tolerance box expansion per API
1163 §7.2.4 is applied to the spacing test.

**Outputs.** Per-defect (or per-cluster) P_safe, d/t, and verdict band; a severity histogram;
and summary counts. Clustering merges interacting features into effective anomalies (combined
length, depth, circumferential width) before the burst calc.

**How to read it.** Same verdict bands and conservatism notes as the Integrity tab. Clustering
*lowers* the predicted safe pressure where defects interact — choosing a stricter rule (or
"None") materially changes the triage, so state which rule you used. This is screening triage
to prioritize a dig list, **not** an FFS determination per defect.

---

### 4.6 FFS (API 579)

**Engine:** `ffs.js` · **Tier: 📐 Standard-reproducing.**

**Purpose.** The **corrosion-damage subset** of API 579-1/ASME FFS-1 (2021), Level 1 + Level 2
closed-form only:
- **Part 4** — General Metal Loss (uniform thinning, point-thickness readings).
- **Part 5** — Local Metal Loss (LTA, the workhorse).
- **Part 6** — Pitting Damage (ASTM G46 classification + pit-couple RSF).
- **Part 7** — HIC / SOHIC / Hydrogen Blistering (NACE TM0284 acceptance + blister-density RSF).

Non-corrosion FFS (brittle fracture, fatigue, creep, dents, crack-like flaws, Level 3
elastic-plastic FEA) is **out of scope** — use a dedicated FFS tool.

**Inputs (by part).**
- *Part 5 LTA:* minimum measured wall in the LTA (tmm), nominal thickness, metal LOSS, future
  corrosion allowance (FCA), axial extent s, inside diameter D, design MAWP, allowable
  remaining-strength factor RSFa.
- *Part 6 pitting:* max pit depth, pit density (per m²), and (Level 2) pit diameter and spacing.
- *Part 7 HIC:* CLR %, CTR %, CSR % (NACE TM0284 measurements), SOHIC flag, surface-breaking-
  crack flag; and (Level 2) blister diameter, blister density, through-wall loss fraction.

**Outputs.** Remaining-thickness ratio Rt, the Folias factor, the **Remaining Strength Factor
(RSF)**, a pass/fail vs RSFa, and a **reduced MAWP** when it fails; applicability-gate results
(escalate to Level 2 if gates fail); pitting Type 1–4 classification; and for Part 7 the
NACE TM0284 CLR/CTR/CSR pass/fail with disqualifiers (surface-breaking crack or active SOHIC
force escalation/repair).

**How to read it.** This **reproduces the API 579 procedure** — it is not independently
validated against measured remaining life. Treat the output as "what the code says, computed
correctly," with the screening caveat that a run/repair/replace decision needs a qualified
engineer, verified inputs, and the full API 579 procedure (including the Level-2/Level-3 paths
this tool does not implement). A Level-1 FAIL or gate failure means *escalate*, not *condemn*.

**Validity / limits.** Level 1 and Level 2 closed-form only; Level 3 FEA out of scope. Some
RSF screening thresholds (e.g. the pitting Type table) come from public training tabulations
and are conservative. Reproduces the FFS Part 5 worked example (Rt ≈ 0.562, RSF ≈ 0.85). 18
oracle assertions in `test-ffs.js`.

---

### 4.7 MR0175 spec

**Engine:** `mr0175.js` · **Tier: 📐 Standard-reproducing.**

**Purpose.** A NACE MR0175 / ISO 15156:2020 sour-service material **spec-issuer**: maps a
composition + service condition + equipment class to the applicable Annex A envelope (CRA) or
Region 0/1/2/3 (carbon/low-alloy steel), returning a procurement-grade acceptability verdict
with the standard citation.

**Inputs.** UNS (optional) and/or composition (Cr, Mo, Ni, N wt %); service T (°C); pH₂S (kPa);
Cl⁻ (mg/L); in-situ pH; sustained stress (% SMYS); supply hardness (HRC); equipment class
(general / downhole-OCTG / wellhead / small-internal / spring); scope (upstream production, or
refining → routes to NACE MR0103).

**Outputs.** Whether the material is **in scope** for the conditions, the matched Annex A table
or Region, the governing envelope, manufacturing annotations (hardness/cold-work/PREN/condition
limits), failure reasons when it does not qualify, and alternative-material recommendations
(e.g. upgrade 22Cr duplex → 25Cr super-duplex). Owner-spec overlays (NORSOK, Shell DEP, Aramco,
ExxonMobil, Chevron) are advisory annotations.

**How to read it.** It **reproduces the ISO 15156-3 Annex-A envelope boundaries** — a
dispatcher, not a validated predictor. Crucially: where the open literature does not document
an exact numerical threshold (the standard itself is paywalled), the data layer carries a
`needs_review` flag and the verdict is **conservatively flagged for engineer override** —
**numbers are never fabricated**. Always cross-check a borderline verdict against the
ISO 15156-3:2020 hard copy.

**Validity / limits.** Sour-service threshold pH₂S ≥ 0.3 kPa (below that it returns "non-sour,
standard selection applies"). Family classification is best via UNS; the composition heuristic
is informational. 15 oracle assertions in `test-mr0175.js`.

---

### 4.8 CIPS / DCVG

**Engine:** `cips.js` · **Tier: 📐 Standard-reproducing.** *(Per `ENGINE-STATUS.md`, wiring its
embedded tests into the deploy gate is a tracked follow-up action.)*

**Purpose.** Ingest a close-interval potential survey (CIPS) / DCVG / PCM vendor CSV and return
a −850 mV instant-off exceedance scan, the 100 mV polarization-shift check, DCVG %IR severity
banding, and an ECDA prioritization (NACE SP0502).

**Inputs.** Paste a survey CSV (M.C. Miller G-Series / Radiodetection PCM / generic — headers
are fuzzy-matched, and ft↔m and V↔mV are auto-detected). CP-criteria thresholds: E_off
threshold (default −850 mV), native potential (default −650 mV), and a limiting over-protection
floor.

**Outputs.** Per-station verdicts (fails −850 mV instant-off / fails 100 mV shift /
over-protection), grouped into failing runs; DCVG indications with %IR severity bands (Minor /
Moderate / Severe / Immediate, McKinney 1986 + SP0502); polarity interpretation (interference
vs the pipe's own defect); and an ECDA priority list (IMMEDIATE / SCHEDULED / MONITORED) plus a
reassessment interval (½ × remaining life, capped at the 49 CFR 192.939 7-yr ceiling).

**How to read it.** Reproduces the NACE SP0169 / SP0207 / SP0502 / TM0109 criteria and the
McKinney DCVG bands. As with all CP work, the −850 mV criterion is meaningful on the
**instant-off** (IR-free) reading. Verdicts are standards-reproducing; the dig-priority output
is decision support, not a determination.

---

### 4.9 Vendor products / Model atlas / Learn

These are reference/utility tabs, not predictive engines:

- **Vendor products** — a cited catalogue of corrosion-prevention products (coatings, anodes,
  insulation, CRA valves). Every entry cites a manufacturer data sheet **and** a recognised
  standard. Filter by category, service-T, and free text. *(Informational reference — verify
  current vendor data before specifying.)*
- **Model atlas** — a browsable reference of every model in PitCast with its governing
  equation, citation, and validity envelope.
- **Learn** — guided worked-example walkthroughs, every number live-computed by the same
  engines.

---

## 5. Appropriate use & limitations

**Use PitCast for:**
- **Screening and triage** — narrowing an alloy shortlist, ranking ILI defects for a dig
  campaign, sanity-checking a CO₂ rate against five models, flagging CUI/MIC/HIC concerns,
  first-pass anode/groundbed sizing, reviewing a CP survey.
- **Education** — seeing the governing equation, the citation, and the uncertainty behind each
  standard corrosion calculation.
- **Reproducible transparency** — every validated figure regenerates from cited, in-repo
  measured data via `node benchmark/run.js`.

**Do NOT use PitCast for** (without a qualified engineer in the loop):
- **High-consequence integrity or material-selection decisions.** Those require a qualified
  engineer, **verified** (not vendor-default) inputs, and the **full code procedure** — the
  complete ASME B31G / API 579 / ISO 15156 / DNV / NACE workflow, not a Level-1 screen.
- **Final design or run/repair/replace determinations.** PitCast's B31G and API 579 outputs are
  Level-1/2 **screens**, explicitly not FFS determinations.
- **Substituting for physical testing.** CPT screening does not replace alloy/heat-specific
  ASTM G48 testing; HIC screening does not replace NACE TM0284 plate testing; MIC screening
  does not replace site-specific bug counts and coupons; galvanic/anode rates use family
  typicals, not vendor polarization data.

**Honest status of the project.**
- There is **no PE seal** and **no professional sign-off** on any output.
- There has been **no independent third-party V&V** and **no formal peer review** (the JOSS
  paper is not yet published); the tool is **self-validated**.
- The open benchmark is **small but fully disclosed** — its value is reproducibility and
  transparency, not dataset size (the large corrosion datasets remain proprietary or
  figure-locked). Data inclusion rules and the rejected-data log are in
  `benchmark/INCLUSION-RULES.md`.
- Tiers matter: only the **Validated** engines (CPT pitting, B31G burst, the electrochem
  reference, and the CO₂ ensemble *as a disagreement view*) are checked against measured data.
  **Standard-reproducing** engines compute their standard correctly but are not validated
  against field outcomes. **Screening-only** engines (galvanic rate, CUI, HIC, MIC, the AC
  corrosion-rate sub-output) are triage flags — refer to testing.

When in doubt, read the tier badge, read the prediction interval or model spread, and treat the
number as a starting point for a qualified engineer — never as the final answer.

---

*PitCast is open-source under Apache-2.0 and lives at <https://pitcast.austenite.org>. Built as
a materials-engineering research and portfolio project. For the authoritative per-engine status
see [`docs/ENGINE-STATUS.md`](ENGINE-STATUS.md); for the validation numbers see
[`docs/VALIDATION.md`](VALIDATION.md).*
