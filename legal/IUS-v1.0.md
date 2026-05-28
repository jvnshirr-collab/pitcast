# PitCast Intended Use Statement (v1.0)

**Effective**: 2026-05-28
**Authority**: austenite.org (research project)

---

PitCast is a **screening-grade computational aid** for corrosion engineering, fitness-for-service, and risk-based inspection workflows. PitCast outputs are intended to support — **not replace** — the independent professional judgment of a working engineer.

## PitCast IS intended for:

- First-pass screening / FEED-stage triage of CRA selection, pipeline B31G FFS, RBI screening, CP design, CUI risk, sour-service material specification
- Cross-checks against independent calculations
- Educational use teaching corrosion engineering concepts with cited standards
- Conceptual / pre-FEED material-selection thinking where the engineer cites PitCast as a screening reference and re-validates with detailed calculation before sealing any deliverable

## PitCast is NOT intended:

- **(a)** as the calculation-of-record for any code-stamped vessel, piping, or pipeline design under ASME BPVC, ASME B31, API 510/570/653, API 579, ASME PCC-2, NACE/AMPP, or equivalent;
- **(b)** for real-time safety-instrumented-system control or any application requiring IEC 61508 SIL ≥ 2;
- **(c)** for nuclear safety-related functions (10 CFR 50 App. B / ASME NQA-1);
- **(d)** for any application where the consequence of an undetected wrong output is loss of life, environmental release in excess of regulatory thresholds, or catastrophic asset loss without independent verification.

## Engineer responsibilities

PitCast outputs are **advisory screening calculations**. A working engineer who relies on PitCast output for a stamped deliverable should:

1. Confirm input data ranges fall within the cited validation envelope shown in the output
2. Confirm the output's validation-tier label is consistent with intended use (T1/T2 screening; T3/T4 advisory only with engineer judgment; PitCast does not produce T5 = code-stamped calcs)
3. Independently calculate any quantity that crosses an AccuracyBounds warning threshold
4. Cross-check against the published code clause cited in the output footer
5. Retain the PitCast output + verification notes as part of the project record

This is the same professional-judgment-by-the-engineer standard that applies when using any engineering software (ANSYS, COMSOL, Caesar II, etc.). The engineer who stamps the work is responsible, regardless of which tool produced the underlying numbers.

## Validation tier semantics (per ASME V&V 10-2019 / IEEE 1012-2016 framework)

- **T1 Unit** — closed-form textbook problem; ±5% typical
- **T2 Benchmark** — standard's published worked example; ±2–10% typical
- **T3 Subsystem** — single-engine full-loop on industrial case; ±10–20% typical
- **T4 Integrated** — multi-engine workflow on public failure case; ±20% typical
- **T5 Code-of-record** — NOT produced by PitCast

PitCast self-classifies at IEEE 1012 Integrity Level 2 / ASME V&V 40 medium model risk / DO-178C DAL-D analog (important software, not safety-critical).

## No warranty

PitCast is offered free of charge under the Apache License, Version 2.0. The Apache 2.0 license disclaims all warranties, express or implied, including merchantability, fitness for particular purpose, and accuracy. See `LICENSE` in the repository root.

---

**References:**
- ASME V&V 10-2019, *Standard for V&V in Computational Solid Mechanics*
- ASME V&V 40-2018, *Assessing Credibility of Computational Modeling*
- IEEE 1012-2016, *Standard for System, Software, and Hardware V&V*
- NSPE Code of Ethics §II.2 (Competence)
- NCEES Model Rules of Professional Conduct (2024) §240.20
- IEC 61508 (functional safety SIL framework)
- ANSI/NACE MR0175-2021 / ISO 15156:2020
- API RP 581 (3rd ed., 2016; 4th ed., 2025) — RBI methodology
- API 579-1/ASME FFS-1 (2021) — Fitness-for-Service
- Apache License, Version 2.0
