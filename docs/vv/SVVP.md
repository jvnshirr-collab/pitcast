# PitCast Software Verification & Validation Plan (SVVP) v1.0

**Standard frameworks applied**: ASME V&V 10-2019, ASME V&V 40-2018, IEEE 1012-2016, NIST SP 500-234
**Integrity Level**: IEEE 1012 Level 2 ("important software, but not safety-critical")
**Model risk classification**: ASME V&V 40 — Medium model influence × Medium consequence-of-wrong-decision
**DO-178C analog**: DAL-D (failure causes minor consequences)

---

## 1. Scope

This SVVP defines the V&V activities for the PitCast corrosion-engineering screening tool (pitcast.austenite.org). The scope covers all engines listed in §2 below. Out-of-scope: real-time safety-instrumented-system applications, nuclear safety-related applications (NQA-1 not applicable), aerospace flight-critical applications (DO-178C DAL-A/B not applicable).

## 2. Software in scope

| Engine | Standard | Tier | Validation status |
|---|---|---|---|
| pitcast.js (CPT/PREN/SCC) | ASTM G48, ISO 15156-3, Nyby 2021 | T2 | LOO-calibrated n=51, MAE 6.6 °C |
| b31g.js | ASME B31G-2012, Kiefner & Vieth 1989, Folias 1965 | T2 | ASME B31G Appx B Ex 1 reproduced ±2 bar |
| anode.js | DNV-RP-B401, NACE SP0387 | T2 | DNV worked example 4754 kg reproduced |
| cui.js | API 583, NACE SP0198, ASTM C871 | T2 | API 583 case-study patterns reproduced |
| galvanic.js | ASTM G82, G102, MIL-STD-889C, Stansbury 2000 | T2 | LaQue marine 316L bolt 1.16 mm/yr reproduced |
| groundbed.js | Dwight 1936, Sunde 1949, NACE SP0169 | T2 | NACE SP0169 Appx-A 13.72 Ω reproduced |
| hic.js | NACE MR0103, TM0284, ISO 15156-2 | T2 | NACE MR0103 §4 envelope reproduced |
| mic.js | NACE TM0194/TM0212/SP0775 | T2 | NACE SP0775 family-classification reproduced |
| rbi.js | API RP 581 (3rd ed., 2016) | T1/T2 | 5×5 matrix per API 581 typical layout |
| cpac.js | AMPP SP0169, ISO 18086 | T2 | -850 mV criterion + Jac = 8·Vac/(ρ·π·d) reproduced |
| co2.js | de Waard 1995, NORSOK M-506, Nesic Multicorp | T2 | 5-model comparator |
| interaction.js | DNV-RP-F101, POF-100, B31G-2012 | T2 | DNV §3.7 worked example reproduced |
| mr0175.js | ANSI/NACE MR0175-2021 / ISO 15156:2020 | T2 | 41-Annex catalogue + 3 worked examples |
| cips.js | NACE SP0207, SP0169, SP0502, ISO 15589-1 | T2 | DCVG %IR + ECDA prioritisation per McKinney 1986 |
| ffs.js | API 579-1/ASME FFS-1 (2021) Parts 3,4,5,14 | T1/T2 | LTA Level 1 reproduces FFS.jl reference values |
| rbi-detailed.js | API RP 581 Annex 2.B + Part 3 Level 1 | T1/T2 | Trinity-Bridge worked example reproduced (within sim. approx.) |

## 3. V&V Activities (per IEEE 1012-2016 §7)

### 3.1 Code Verification (CVR) — "math right"
- Order-of-accuracy / convergence testing where applicable (only co2.js + cpac.js have mesh-like computations)
- Method of Manufactured Solutions: N/A (no PDEs solved; all engines closed-form or look-up)
- Closed-form analytical comparisons:
  - b31g.js → Barlow thin-shell (intact pipe)
  - cpac.js → Ohm's law (Jac at limiting cases)
  - groundbed.js → Single-rod limit
  - galvanic.js → ASTM G102 Eq 1 unit-check
- Code-review evidence: all engines authored with inline citations to standards; peer-review via git PR (when adopted)

### 3.2 Solution Verification — "numerics OK"
- Grid Convergence Index: N/A (no FEM)
- Floating-point sensitivity: Web Crypto SHA-256 for audit, Math.* IEEE 754 for engines — standard browser-platform precision
- Sensitivity to input perturbations: documented per-engine in `docs/vv/UQ-SA/*.md` (Sobol indices where Bayesian Laplace machinery exists)

### 3.3 Validation (VR) — "right math, traceable to physical reality"
Four-tier validation hierarchy per ASME V&V 10 §4:

**Tier 1 — Unit / textbook closed-form**: One per engine, documented in `docs/vv/VR/tier1-unit/*.md`.

**Tier 2 — Benchmark / standard worked example**: One per engine where the standard publishes a worked example:
- ASME B31G Appendix B Example 1 (P_safe = 54.3 bar)
- DNV-RP-F101 §3.7 worked example
- NACE SP0169 Appendix-A groundbed (13.72 Ω)
- DNV-RP-B401 1-km × 12-in offshore pipeline (4,754 kg Al-Zn-In)
- API 579-1 Part 5 LTA worked example (FFS.jl reference, RSF ≈ 0.93)
- Trinity-Bridge API 581 Thinning DF worked example (Art = 0.25, 1A → D_fB ~33.30)
- Nyby et al. 2021 LOO calibration on n=51 G48 CPT records (CC BY 4.0)

**Tier 3 — Subsystem industrial case**: Documented for top-5 engines in `docs/vv/VR/tier3-subsystem/*.md`.

**Tier 4 — Integrated multi-engine on historic public failure**: Future work.

Validation metric per ASME V&V 20 §3: `E = S − D` with uncertainty `u_val = sqrt(u_num² + u_input² + u_D²)`. Acceptance band per tier:
- T1/T2: ±5–10 %
- T3: ±10–20 %
- T4: ±20–30 %

### 3.4 Uncertainty Quantification & Sensitivity Analysis (UQ/SA)
- Per-engine input uncertainty inventory documented
- Propagation: Bayesian Laplace (existing on σ-phase) + Monte Carlo where applicable
- Output PDF reported as 5/50/95 percentiles where stochastic
- Sobol indices on the 5 highest-consequence outputs

## 4. Acceptance Criteria

PitCast outputs target **±10 % screening accuracy with documented conservative bias**. Detailed design requires independent code-compliant calculation per the user PE's responsibility (see `legal/IUS-v1.0.md`).

## 5. Regression Testing

PitCast maintains 5,500+ in-Chrome assertions across all engines (see test battery results). Each oracle test is tagged with `{capability, source, citation, tolerance, validation-tier}` metadata (work in progress — `docs/vv/validation-test-registry.yaml`).

## 6. Anomaly Reporting

Engine defects are reported via GitHub issues with mandatory fields: affected engine, input case, expected output (with citation), actual output, severity (P1/P2/P3), reproducibility steps.

## 7. Configuration Management

- Source repository: GitHub (jvnshirr-collab/austenite, branch main)
- Build artifacts: each deploy tagged with git SHA + app.js?v=N cache-buster
- Released artifacts immutable (CF Pages preserves all deployments)
- Audit trail: every project file carries SHA-256 hash chain per NIST SP 800-53 AU-10

## 8. V&V Documentation Index

```
docs/vv/
  SVVP.md                            # this document
  CVR/                                # code verification per engine
  VR/
    validation-hierarchy.md          # pyramid diagram
    tier1-unit/                      # textbook closed-form
    tier2-benchmark/                 # standard worked examples
    tier3-subsystem/                 # industrial cases
    tier4-integrated/                # multi-engine public-failure replays
  UQ-SA/
    uq-master.md
    sobol-*.md                       # one per high-stakes output
    posterior-*.md                   # Bayesian outputs
  validation-test-registry.yaml      # machine-readable, drives UI badges
```

## 9. References

- ASME V&V 10-2019, *Standard for V&V in Computational Solid Mechanics*
- ASME V&V 20-2009 (R2021), *V&V in CFD & Heat Transfer*
- ASME V&V 40-2018, *Assessing Credibility of Computational Modeling*
- Oberkampf & Roy (2010), *V&V in Scientific Computing*, Cambridge UP
- Trucano et al. (2006) *Reliability Engineering & System Safety* **91**(10-11):1331-1357
- NIST SP 500-234 (Wallace 1996)
- IEEE Std 1012-2016
- ASME NQA-1-2019 Subpart 2.7 (referenced, not adopted — NQA-1 is overkill for PitCast scope)
- RTCA DO-178C / ED-12C
- IEC 61508 / ISO 26262
- Roache GCI (1997, 1998)
- Salem-Knupp MMS (2002) ASME J. Fluids Eng. **124**(1):4-10

---

**Document status**: v1.0 minimum viable SVVP. Future work: full per-engine CVR/VR/UQ-SA expansion per the matrix in §3. See PLAN-tier3.md Gap G5 for the full 65-100 work-day formal V&V package roadmap.
