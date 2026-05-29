# PitCast — Differentiation & Industry-Readiness Plan

**Purpose**: a single, honest roadmap for closing the strategic risks/gaps,
building a moat the commercial giants *structurally cannot* copy, and reaching
industry-credibility — without drifting into breadth, commercial-vendor
scaffolding, or non-corrosion scope.

**Companion docs**: `PLAN-tier3.md` (feature backlog G1–G10), memory file
`project_pitcast_tier3_progress.md` (gap status). This plan reorganizes that
work around *differentiation* and *credibility* rather than feature count.

**Calendar note**: phases are *sequencing*, not deadlines. Week ranges assume a
solo part-time student effort; compress in summer, stretch during term.

---

## 0. North Star & Non-Goals

**North Star** — *The open, transparent, validated-uncertainty corrosion
screening reference: the tool practicing engineers cite and sanity-check
against, students learn on, and small operators rely on when OLI/Honeywell are
out of reach.*

**Reachable 12-month target**: industry-**credible** for screening + at least
one peer-reviewable research artifact. NOT industry-trusted-for-final-design
(that requires V&V pedigree, QMS, support, and a multi-year trust track record a
solo author cannot supply — and the liability exposure is real).

**Hard non-goals** (these are how we avoid repeating past mistakes):
- ❌ No 14th engine. Differentiation is **depth**, not breadth. The biggest
  competitor is the instinct to add another tab.
- ❌ No out-scoping OLI's thermodynamic depth — wrong fight, guaranteed loss.
- ❌ No non-corrosion features (corrosion-only scope rule stands).
- ❌ No commercial-vendor scaffolding: no pricing, no LLC, no insurance, no
  license fees. Austenite stays an open engineering/research tool.
- ❌ No audit/stamp ceremony as a user-facing feature.
- ❌ No marketing landing pages. Visibility is **academic** (preprint,
  citations, community), not a SaaS pitch.
- ❌ No half-baked ML model bolted on for buzzword value.

---

## 1. Risk & Gap Register (the spine)

Each risk is paired with its mitigation and the phase that delivers it.

| # | Risk / gap | Why it matters | Mitigation | Phase |
|---|---|---|---|---|
| R1 | **Breadth trap** — 13 engines at ~28% each | Wide+shallow reads as a student project; maintenance scales superlinearly | Freeze scope; write a "definition of done" per engine; finish-or-park the partials | P0 |
| R2 | **Re-implementation ceiling** — recoding public correlations isn't research | Caps credibility; nothing publishable | The open benchmark + the open-calibrated probabilistic CPT model = the original contribution | P1, P3 |
| R3 | **Self-validation only** — everything checked against your own code | A senior reviewer discounts self-graded work | External benchmark on public measured data + preprint + open data → invite scrutiny | P1, P3 |
| R4 | **Authority-vs-disclaimer tension** — outputs say `IMMEDIATE`/`spec` but footer says "screening" | Reviewer asks who's liable / what QA pedigree | Glass-box every output (equation + source + calibration + uncertainty + scope) so the number is *defensible*, not authoritative-looking | P1, P2 |
| R5 | **Standards drift** — e.g. API 581 4th ed. (2025) already out | Stale editions fail an audit | Standards-currency changelog + per-engine edition tags | P2 |
| R6 | **Bus factor** — solo, self-reviewed | No continuity, no peer eyes | Contribution-ready repo (docs, CONTRIBUTING, test rationale); reduce surface area | P3 |
| R7 | **Overselling stats** — "5,500+ assertions" reads as marketing | Skeptics discount it; weakens the real signal | Lead with the 6.6 °C LOO MAE; reframe stats honestly; one external benchmark > 5,500 self-checks | P1 |
| R8 | **ML black-box wave (2025)** — transformer/hybrid-ML CO₂ models flooding in | Field moving to opaque ML | Don't out-ML; **out-transparent**. Position physics + validated-UQ + open as the trust alternative | P1–P3 |

---

## 2. Differentiation Pillars (the moat)

Each pillar attacks a giant weakness that their **business model forbids them
from fixing** — so it's a permanent advantage, not a feature they can out-build.

| Pillar | Giant weakness it exploits | Built on what we already have |
|---|---|---|
| **P1 Glass-box** — every number shows equation + source + calibration data | Closed-source; opening equations kills their moat | Citations already in the JS/JSON; this is a presentation layer |
| **P2 Free & open** (Apache 2.0) | Can't go free without collapsing revenue | Already open + free |
| **P3 Uncertainty-first** — probabilistic outputs + documented model error | Point estimates; UQ bolted on, not honest | LOO MAE 6.6 °C, P(pit) credible intervals already exist |
| **P4 The open benchmark** — the reproducible reference nobody has | Calibration data proprietary; can't disclose | Nyby 2021 dataset (729 pts) in-repo; 4 CO₂ models implemented |
| **P5 Model-disagreement view** — show the spread across models honestly | Each vendor sells one model; won't show disagreement | 4 CO₂ models already coded (de Waard '75/'95, NORSOK M-506, NESC) |
| **P6 Education lane** — "show your work" mode | Giants are useless for learning | Glass-box layer doubles as a teaching tool |

---

## 3. Phased Roadmap

### Phase 0 — Stabilize & Freeze (Weeks 1–2) · addresses R1
**Goal**: stop the bleeding, establish a state-of-truth, freeze breadth.
- [ ] **Scope freeze**: no new engines until Phase 3 ships. Write it at the top of PLAN-tier3.md.
- [ ] **Definition of done** per existing engine (1 line each): what "complete" means.
- [ ] **Finish-or-park triage** of the partials: G3 (RBI detail), G4 (persistence), G5 (V&V), G7 (MR0175 envelopes), G10 (framing) — for each, decide *finish in this plan* or *park honestly* (mark `beta`/`research-grade` in the UI, don't pretend).
- [ ] **Live audit**: confirm deploy == code; click every tab; log any broken/dead output or console error; fix the cheap ones.
- **Acceptance**: a one-page "state of truth" + frozen scope committed.

### Phase 1 — The Benchmark + Glass-box (Weeks 3–10) · THE CRITICAL PATH · R2,R3,R4,R7,R8
**Goal**: the keystone artifact — research, validation, and academic visibility in one.
- [ ] **1a Dataset survey**: catalog *public* measured corrosion datasets. Seeds: Nyby 2021 (in-repo, CPT/E_pit), published CO₂ field/lab sets from the model-review literature, NORSOK validation data, sour-service published cases. Target **150–300 cases** across CO₂ / CPT / sour.
- [ ] **1b Benchmark harness** (reproducible script/notebook in-repo): PitCast vs de Waard vs NORSOK vs (public others) → MAE / RMSE / bias, per-regime breakdown (T, pCO₂, pH, flow), parity plots. Everything reproducible from `data/` + a single command.
- [ ] **1c Glass-box UI**: every result card gets an expandable panel → governing equation, citation, calibration provenance, and uncertainty band. (Data exists; this is presentation.)
- [ ] **1d Model-disagreement view**: run all 4 CO₂ models, plot the envelope, annotate where they diverge >2× ("treat with caution").
- [ ] **1e Honest-stats pass**: demote "5,500+ assertions" copy; lead with the LOO MAE and the benchmark results.
- **Acceptance**: reproducible benchmark in-repo + a results page on the site + glass-box live on the top 4 engines.

### Phase 2 — Validated Uncertainty + V&V (Weeks 8–16, overlaps P1) · R4,R5
**Goal**: convert "looks credible" into "is credible." The unglamorous, highest-value gate.
- [ ] **2a Uncertainty-first outputs**: every *primary* output reframed as value + CI + "validated against N cases, MAE X." Not point estimates.
- [ ] **2b V&V package (finishes G5)** for the **load-bearing engines only** (CPT, CO₂, B31G, MR0175 — not all 13): per-engine CVR/VR per ASME V&V 10 / IEEE 1012 framing, tied to the Phase-1 benchmark. Frame as *scientific* credibility, not compliance ceremony.
- [ ] **2c Standards-currency**: changelog + per-engine edition tags (e.g. "API 581 3rd ed. 2016 +Add2; 4th ed. 2025 delta tracked").
- **Acceptance**: V&V doc for ≥4 engines; every primary output shows uncertainty + a validation tier badge.

### Phase 3 — Research Output + Community (Weeks 14–24) · R3,R6
**Goal**: turn the work into a citable credential and a maintainable open project.
- [ ] **3a Preprint / methods note**: the open-calibrated probabilistic CPT model + the benchmark. Target a preprint server, then a journal (e.g. *Materials and Corrosion*, *npj Materials Degradation*, *Corrosion Science*). This is the research vehicle.
- [ ] **3b Versioned, citable release**: tag a release; mint a **Zenodo DOI** so a specific version is citable.
- [ ] **3c Education mode**: "show your work" walkthroughs + a short tutorial set (corrosion course / AMPP-CIP candidate friendly).
- [ ] **3d Open for contribution**: CONTRIBUTING, issue templates, documented test rationale, modular structure → lower bus-factor risk.
- **Acceptance**: preprint submitted; DOI minted; education mode live; repo contribution-ready.

---

## 4. Industry-Readiness Checklist (the gate, not the glamour)

Invest here **instead of** new tabs:
- [ ] V&V package for load-bearing engines (ASME V&V 10 / IEEE 1012 framing)
- [ ] Standards-edition register + changelog
- [ ] Versioned, citable releases (Zenodo DOI)
- [ ] Reproducible benchmark in-repo (single-command)
- [ ] Scope + intended-use framing on every output (screening, not final design)
- [ ] Test-coverage docs: what each `_runTests()` proves, against which worked example

**Explicitly skip** (wrong target + off-brand for an open academic tool):
enterprise support, SOC2, liability/insurance, pricing tiers, commercial EULA.

---

## 5. Critical Path & Sequencing

```
P0 freeze ──▶ P1 benchmark+glass-box ──▶ P2 V&V+uncertainty ──▶ P3 preprint+DOI+community
                  │                                                  ▲
                  └── keystone: research + validation + visibility ──┘
```

- **The benchmark (P1) is the keystone** — it is research, validation, and
  academic mindshare simultaneously. Do it first and well.
- **Glass-box (P1c) is cheap + high-trust** — the data already exists.
- **V&V (P2) is the credibility gate** — unglamorous, do it anyway.
- **Preprint (P3) converts the work into a credential** you can put on a CV / grad-school / research application.

---

## 6. Success Metrics (12 months)

- ✅ 1 preprint/paper submitted citing the open benchmark
- ✅ Benchmark used or cited by ≥1 external party
- ✅ ≥4 engines with documented V&V + uncertainty-first outputs
- ✅ **0 new engines added** (discipline metric — fewer-is-better)
- ✅ Zenodo DOI on a tagged release
- ✅ A practicing engineer can defend any PitCast number from the UI alone

---

## 7. The One Move (if nothing else)

**The open benchmark + a short preprint**, built on the two assets the giants
can't match: the open-data-calibrated probabilistic CPT model and the four-model
CO₂ ensemble. That single artifact is *simultaneously* your differentiation,
your research credibility, and your academic visibility — and it forces depth
instead of breadth.
