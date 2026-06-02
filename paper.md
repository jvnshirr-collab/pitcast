---
title: 'PitCast: an open, browser-based screening tool for localized corrosion and corroded-pipe fitness-for-service'
tags:
  - corrosion
  - materials engineering
  - pitting
  - critical pitting temperature
  - CO2 corrosion
  - pipeline integrity
  - JavaScript
authors:
  - name: Javanshir Hasanov
    orcid: 0009-0004-3573-5709
    affiliation: 1
affiliations:
  - index: 1
    name: Department of Metallurgical and Materials Engineering, Middle East Technical University (METU), Ankara, Türkiye
date: 2 June 2026
bibliography: paper.bib
---

# Summary

`PitCast` is an open-source, dependency-free tool that runs entirely in a web browser and
provides **screening-grade** estimates for several common corrosion-engineering decisions on
stainless/corrosion-resistant alloys and carbon/low-alloy steels: the critical pitting
temperature (CPT) of an alloy from its composition, CO\textsubscript{2} ("sweet") corrosion rate
of carbon steel, sour-service acceptability against ISO 15156/NACE MR0175, and the remaining
burst strength of a corroded pipe (ASME B31G / Modified B31G). Every result is shown together
with the governing equation, its source standard or dataset, the validity envelope, and an
explicit uncertainty (a prediction interval or a model-disagreement band). The application has no
server, no account, and no telemetry; all computation is client-side, and a reproducible
benchmark (`node benchmark/run.js`) regenerates every reported accuracy figure from cited,
in-repository measured data.

# Statement of need

Corrosion screening in industry and teaching is dominated by two unsatisfying options. Commercial
calculators (for CO\textsubscript{2} rate, pitting resistance, or fitness-for-service) are
closed-source and paywalled, so their assumptions, calibration data, and error are not auditable.
The common alternative — ad-hoc spreadsheets — is unverified, uncited, and gives a single number
with no uncertainty. Students and early-stage screening engineers therefore lack an open tool that
(a) implements the published models transparently, (b) shows each model's citation and validity
range, (c) reports an honest out-of-sample error, and (d) states plainly that it is a screening
aid, not a fitness-for-service determination. `PitCast` fills that gap: it is open
(Apache-2.0), runs anywhere a browser does, and pairs every estimate with its provenance and
uncertainty so the user can judge whether to trust it.

# State of the field

Open implementations of individual corrosion models exist (e.g. scripts for the
de Waard–Milliams CO\textsubscript{2} correlation or for ASME B31G), but we are not aware of an
open tool that combines multiple corrosion mechanisms, attaches a citation and validity envelope
to each, exposes a *reproducible* benchmark against cited measured data, and surfaces uncertainty
on every output. Commercial packages (e.g. Honeywell Predict, DNV/various NORSOK M-506
calculators) are closed and cannot be inspected or cited at the equation level. `PitCast` is a new
implementation rather than an extension of an existing project because its differentiator is
exactly the cross-cutting transparency layer — equation, source, envelope, uncertainty, and a
deploy-gating oracle/validation suite — applied uniformly across mechanisms.

# Software design

`PitCast` is written in vanilla JavaScript with no runtime dependencies; each corrosion model is
an isolated, side-effect-free function (`co2.js`, `b31g.js`, `pitcast.js`, `ffs.js`, `mr0175.js`)
that returns the numeric result plus its equation string, citation, validity bounds, and
uncertainty. Two test layers run as a **deploy gate**: closed-form *oracle* tests that reproduce
worked examples from the source standards (e.g. ASME B31G-2012 Appendix B; NORSOK M-506; ISO
15156-3 Annex A), and a *validation* benchmark that scores predictions against cited measured
datasets. Safety-relevant verdicts (B31G/FFS bands, CPT) carry an on-screen screening caveat.

# Research impact statement

`PitCast` ships a reproducible, cited validation corpus rather than self-reported accuracy:

- **Pitting CPT** — two clearly-separated correlations: an ASTM G48/FeCl\textsubscript{3}
  immersion fit (n = 52, leave-one-out MAE 6.6 °C; Nyby 2021 [@nyby2021] + a cited wrought point)
  and a *separate* electrochemical/potentiodynamic fit (n = 123, leave-one-out MAE 6.11 °C,
  R² 0.93; npj Materials Degradation 2025 [@npj2025]). The two bases are never merged.
- **Corroded-pipe burst** — 75 full-scale tests (API 5L A25–X80, OD 76–864 mm) from Benjamin,
  Souza/Freire, Cronin, Qi, and He & Zhao [@benjamin2016; @cronin2000]; original-B31G predicts
  0.678× the measured burst (100 % conservative), matching the independent 149-specimen
  model-error study of Zhou & Huang [@zhou2012] (0.679).
- **CO\textsubscript{2} corrosion** — a five-model ensemble whose *disagreement* (≈10×–1000×) is
  the deliverable, validated on cited carbon-steel cases.

All figures regenerate via `node benchmark/run.js` (a 121-assertion oracle gate plus
leave-one-out validation), and a versioned archive is deposited on Zenodo
(DOI 10.5281/zenodo.20466523). The tool is used as a transparent teaching and early-screening
aid; its honest, auditable error reporting is the contribution.

# AI usage disclosure

Implementation and documentation of `PitCast` were assisted by AI coding tools. The engineering
content — selection of the governing models, the test oracles drawn from the source standards, the
data-inclusion rules, and the validation of predictions against cited literature — was framed and
**independently verified by the author** against the primary sources; data points are transcribed
only from tables/text (never read off figures) and every benchmark value is reproducible from
the cited data in the repository. Development is carried out in the open with a public commit
history.

# Acknowledgements

No external funding was received for this work.

# References
