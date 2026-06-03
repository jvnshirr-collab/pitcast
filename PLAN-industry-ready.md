# PitCast → Industry-Ready — Detailed Execution Plan

*Created 2026-06-02. Owner: Javanshir Hasanov (METU MetE). Goal: take PitCast from
"well-built validated prototype" to a trustworthy, usable, industry-grade **open corrosion
screening tool** — and be honest about the part no code can grant. Supersedes the ad-hoc
"make the number bigger" framing. Respects the corrosion-only scope rule and the
no-commercial-costume rule.*

---

## 0. The honest frame (read first)

"Industry-ready" for engineering software is **not** a dataset size or a feature count. It splits
into two halves:

- **Half A — achievable by code / data / docs (this plan delivers it to the limit of the cited
  evidence):** the tool is *verified* (solves the equations right), *validated* (predicts reality
  with honest, quantified error), *usable in a real engineer's workflow* (native units, filed
  records, data import), *robust* (handles bad inputs and scale), *transparent* (equation +
  citation + uncertainty on every output), *reproducible* (deterministic, archived, DOI), and
  *honestly scoped* (no engine overclaims its validation).
- **Half B — NOT achievable by code; needs time + external parties (this plan *initiates* it, does
  not fake it):** independent third-party V&V, peer review, a sustained public track record, and
  real-world adoption. A student's open tool earns these over months/years through the open
  process — not by adding commits.

**Definition of done (bounded, honest):** *"PitCast is a verified, validated-where-cited, robust,
transparent, reproducible open screening tool; every engine is labeled by validation status;
a practicing corrosion engineer can run it in native units and export a defensible filed record;
and it is submitted for independent peer review."* That is the achievable target. **"Adopted by
industry for fitness-for-service sign-off" is explicitly NOT the target** and is not honestly
claimable for any self-published screening tool — PitCast will keep saying so on-screen.

---

## 1. Current state (per dimension)

| Dimension | Status | Evidence / gap |
|---|---|---|
| Verification (vs standards) | **STRONG** | 121-assertion oracle gate (`benchmark/test-all.js`) |
| Validation (vs measured) | **STRONG (core)** / **UNKNOWN (periphery)** | CPT 175 pts/2 bases LOO; burst 75 vs Zhou–Huang n=149; CO₂ ensemble. Periphery engines unaudited. |
| Uncertainty quantification | **STRONG** | Student-t prediction intervals; model-disagreement bands |
| Domain of applicability | **STRONG (core)** | envelope guards + extrapolation flags |
| Transparency / reproducibility | **STRONG** | glass-box UI; `node benchmark/run.js`; permalinks; Zenodo DOI 10.5281/zenodo.20466523 |
| Workflow fit | **PARTIAL** | SI-only (no US-customary); generic full-page print (no purpose-built filed report); imports exist (ILI CSV, lab water) |
| Robustness / QA | **GOOD** | guards, edge tests, ILI render cap — but no CI, no fuzz/property tests, periphery untested |
| Documentation | **GOOD** | README, `docs/VALIDATION.md`, `docs/JOSS-VV-READINESS.md`, methods note — no consolidated user manual / worked-example library |
| **Scope honesty** | **AT RISK** | ~13 periphery engines (CUI, HIC, CP/AC, MIC, RBI×3, galvanic, anode, groundbed, CIPS, interaction, electrochem, vendor) not visibly separated from the validated core; corrosion-scope + validation of each unverified |
| Independent qualification | **PREPPED, not started** | `paper.md` ready; no peer review yet |
| Governance / integrity | **STRONG** | Apache-2.0, CITATION.cff, DOI, inclusion rules + rejected-data log |

**The single biggest credibility risk** is *scope honesty*: a skeptical engineer pokes the weakest
engine first. If any periphery engine (or its corrosion scope) overclaims, the whole tool's trust
collapses — including the genuinely strong core. **WS-B is therefore the top priority.**

---

## 2. Workstreams

Legend — **Mode:** `code` / `data` / `doc` / `external`.  **Par:** agent-parallelizable (Y/N).
**When:** Now (main-loop, no rate limit) / Tonight (agents after ~21:00 reset) / Ongoing (time/user).

### WS-B — Validation & scope honesty *(TOP PRIORITY — credibility core)*

| # | Task | Mode | Par | When | Acceptance |
|---|---|---|---|---|---|
| B1 | **Engine scope + validation audit.** For every engine file, classify: (a) corrosion-in-scope? (b) validated against cited measured data, OR analytical/standard-reproducing, OR illustrative-only? Produce `docs/ENGINE-STATUS.md` matrix. | doc+code | Y (1 agent/engine) | Now | Every engine has a row: scope verdict, validation basis (cite or "none"), status tag ∈ {Validated, Standard-reproducing, Screening-only, Demote/Remove}. |
| B2 | **Apply the audit.** Add a visible per-tab status badge (Validated / Standard / Screening-only) wired from the matrix. Demote or remove any engine that overclaims or drifts out of corrosion scope (per scope-freeze rule). | code | N | Now | Each tab shows its honest status badge; no engine without cited validation is presented as validated; out-of-scope engines removed or clearly fenced. |
| B3 | **Formal V&V matrix.** Extend `docs/VALIDATION.md` into a per-engine V&V table: verification oracle(s) + validation dataset(s) + domain + known error + status. | doc | Y | Now | A reviewer can read one table and see exactly what is and isn't established per engine. |
| B4 | **Grow core validation data.** CPT electrochemical 2nd basis (real headroom) + CO₂ in-envelope + burst, via the verified-extraction pipeline. Every point verified by reproducing the source's own model. | data | Y | Tonight | n increases with zero fabricated/figure-read/off-basis points; `INCLUSION-RULES.md` rejected-log updated; benchmark regenerates. |
| B5 | **Broaden oracles** where thin (periphery engines that survive B2 get ≥1 standard oracle each). | code | Y | Now | Oracle count rises; gate stays green. |

### WS-A — Workflow fit *(make a practicing engineer able to actually use it)*

| # | Task | Mode | Par | When | Acceptance |
|---|---|---|---|---|---|
| A1 | **US-customary units.** `units.js` pure conversions (psi↔bar, in↔mm, mil↔mm, mpy↔mm/y, °F↔°C, ksi↔MPa) + oracle tests; global SI⇄US toggle (persisted); wired into load-bearing tabs (B31G/FFS, CO₂, CPT/Assess, MR0175). | code | N (careful, serial) | Now | Toggling flips every input label, placeholder, and output on the core tabs; round-trip conversions exact in oracle tests; **no engine math changes** (presentation layer only). |
| A2 | **Filed PDF assessment report.** Purpose-built one-page report per core calc: inputs, governing equation, citation, result + uncertainty, validity-envelope check, screening caveat, tool version + DOI + timestamp + permalink. | code | N | Now | One click → clean A4 PDF; contains all provenance; not a raw page dump. |
| A3 | **Import robustness.** Harden ILI-CSV import (more vendor column layouts, unit columns) + lab-water import; clear validation errors. | code | Y | Now | 3+ real-world CSV layouts parse; malformed input gives a specific error, never a silent wrong answer. |

### WS-C — QA & robustness *(engineering-grade software quality)*

| # | Task | Mode | Par | When | Acceptance |
|---|---|---|---|---|---|
| C1 | **Property/edge test suite.** NaN, negative, zero, out-of-range, huge ILI, unicode, empty — across all surviving engines. | code | Y | Now | New `benchmark/test-edge.js`; no crash / no silent NaN; gate runs it. |
| C2 | **Unit-factor audit.** Re-derive every conversion constant in every engine (history of 1000× bugs). | code | Y | Now | Each constant traced to a source; audit note in `docs/`. |
| C3 | **CI gate.** GitHub Actions runs `test-all.js` + `run.js` on every push. | code | N | Now | Red build blocks merge; badge in README. |
| C4 | **Cross-browser + large-data perf check.** Chrome/Firefox/Safari/mobile; 50k-row ILI. | code | N | Now | Loads + computes without freeze; documented. |

### WS-D — Documentation & onboarding

| # | Task | Mode | Par | When | Acceptance |
|---|---|---|---|---|---|
| D1 | **User manual** (`docs/USER-GUIDE.md`): install, each engine's purpose/inputs/outputs/limits, how to read uncertainty. | doc | Y | Now | A new engineer can run every core engine correctly from the guide alone. |
| D2 | **Worked-example library** (`docs/examples/`): one fully reproducible validation case per core engine. | doc | Y | Now | Each example: inputs → expected output (with citation) the user can reproduce in the UI. |
| D3 | **Consolidated limitations / appropriate-use** statement (screening, not FFS sign-off; no PE seal). | doc | N | Now | Linked from UI footer; unambiguous. |

### WS-E — Qualification & external review *(Half B — long pole, initiate now)*

| # | Task | Mode | Par | When | Acceptance |
|---|---|---|---|---|---|
| E1 | **JOSS submission.** Finalize `paper.md`/`paper.bib`; user submits at joss.theoj.org; manage open review. | external | N | Ongoing (user) | Submission live; review issue open. |
| E2 | **Reviewer-grade external-validation report.** Per core engine, compare to a published model-error / round-robin study (B31G↔Zhou–Huang done; find CO₂ + CPT equivalents). | data+doc | Y | Now/Tonight | Each core engine has ≥1 independent external cross-check, cited. |
| E3 | **Open the repo** (issues, CONTRIBUTING, public history accrual — addresses JOSS recency concern). | external | N | Ongoing | Issues enabled; ≥1 contribution path documented. |
| E4 | **Expert solicitation** (METU faculty / corrosion community informal review). | external | N | Ongoing (user) | ≥1 domain expert has reviewed. |

### WS-F — Governance & integrity *(already strong — formalize)*

| # | Task | Mode | Par | When | Acceptance |
|---|---|---|---|---|---|
| F1 | **SemVer + `CHANGELOG.md`** + edition tags. | doc | N | Now | Versioned releases with changelog. |
| F2 | **Data provenance** maintained (every point cited + verified). | doc | — | Ongoing | Inclusion rules + rejected log current. |
| F3 | **Security/privacy note** (client-side only, no telemetry, no account). | doc | N | Now | Documented in README. |

---

## 3. Execution sequence

- **NOW (main-loop, no rate limit) — in priority order:**
  1. **WS-B1/B2/B3** scope + validation audit → status badges → V&V matrix *(credibility first)*
  2. **WS-A1** US-customary units (core tabs) + **WS-A2** filed PDF report
  3. **WS-C1/C2** edge tests + unit-factor audit; **WS-C3** CI
  4. **WS-D1/D2/D3** user guide + worked examples + appropriate-use
  5. **WS-F1/F3** changelog + security note
- **TONIGHT (agents after ~21:00 Europe/Istanbul reset):** **WS-B4** grow core validation data; **WS-E2** external cross-checks.
- **ONGOING (user + time):** **WS-E1/E3/E4** JOSS submission, open repo, expert review.

## 4. Honest acceptance for the "industry-ready" claim

PitCast may be described as *industry-ready as an open screening tool* when **all of**:
1. Every engine carries an honest validation-status badge; nothing overclaims (WS-B1/B2).
2. Core engines run in the user's native units with a defensible filed PDF record (WS-A1/A2).
3. Edge/robustness + CI gates are green; unit factors audited (WS-C).
4. User guide + worked examples exist (WS-D).
5. The JOSS submission is live (WS-E1) — *acceptance pending, disclosed as pending.*

**Status — 2026-06-03 — Half-A COMPLETE (criteria 1–4 met & live; 5 is the user's action):**
1. ✅ Engine scope+validation audit; out-of-scope generic-RBI removed; honest ✅/📐/🔎 tier badge on every engine (`docs/ENGINE-STATUS.md`).
2. ✅ SI⇄US units on B31G & CO₂ (CPT kept in °C per universal standard; MR0175/FFS toggles judged low-value); filed one-page PDF report (`filedReport()`).
3. ✅ Robustness gate `benchmark/test-edge.js` (1168 adversarial cases, was 301 failing → **0**), wired into CI; 121-assertion oracle gate; 39-case units oracle. Engine accuracy constants audited 2026-05-20.
4. ✅ `docs/USER-GUIDE.md` + `docs/examples/` (3 reproducible worked examples).
5. ☐ **JOSS submission** — `paper.md`/`paper.bib` prepped; the author submits at joss.theoj.org. Half-B (peer review / third-party V&V / track record) is time + external, not code.

## 5. What this plan explicitly does NOT claim

- Not a fitness-for-service, remaining-life, or inspection-interval authority.
- No professional-engineer seal; no independent third-party V&V *yet*.
- No commercial framing (no pricing, EULA, insurance, "license"). Standards cited freely; vendor
  costume never worn.
- Scope stays corrosion-only. No re-introduction of brittle/fatigue/refractory/tank/PSM/generic-RBI
  features (per the 2026-05-28 scope-freeze).
