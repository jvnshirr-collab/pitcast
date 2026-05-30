---
title: 'PitCast: an open, reproducible, uncertainty-quantified corrosion-screening console'
tags:
  - corrosion engineering
  - materials selection
  - pitting corrosion
  - CO2 corrosion
  - uncertainty quantification
  - reproducible research
  - JavaScript
authors:
  - name: Javanshir Hasanov
    orcid: 0000-0000-0000-0000   # [AUTHOR TO ADD a real ORCID before submission]
    affiliation: 1
affiliations:
  - name: Department of Metallurgical and Materials Engineering, Middle East Technical University (METU), Ankara, Türkiye   # [confirm; list as independent / student contributor if preferred]
    index: 1
date: 30 May 2026
bibliography: paper.bib
---

# Summary

PitCast is an open-source (Apache-2.0), browser-based console for *screening-level*
corrosion engineering: ranking corrosion-resistant alloys for chloride pitting,
estimating carbon-steel CO\textsubscript{2} ("sweet") corrosion rates, checking
sour-service acceptability against ISO 15156 / NACE MR0175, and estimating the
remaining strength of corroded pipe with ASME B31G. Each engine is a
vanilla-JavaScript port of a published, closed-form correlation, and every result
surfaces its governing equation, primary citation, calibration provenance, and
quantified uncertainty rather than hiding them. The tool runs entirely client-side
— no server, account, or telemetry — and ships with a single-command benchmark
(`node benchmark/run.js`) that regenerates every reported figure from cited, openly
redistributable measured data, with no synthetic or fabricated points.

# Statement of need

Screening-level corrosion prediction is a routine input to materials selection and
asset-integrity decisions, and the underlying correlations are well established and
largely published [@deWaard1975; @deWaard1995; @norsok2017]. Yet the widely used
predictive packages are closed-source: their equations, calibration datasets, and
validation decks are proprietary, so a practitioner cannot audit *why* a number was
produced or reproduce it independently. Published model-comparison studies, in turn,
validate against proprietary or paper-specific datasets and so generally cannot be
reproduced or extended by a third party. Finally, screening outputs are usually
reported as single numbers, even though the correlations carry large,
regime-dependent uncertainty and different accepted models routinely disagree by an
order of magnitude in the same service.

PitCast addresses this gap not by claiming greater raw accuracy than commercial
tools — it explicitly does not — but by being an open, glass-box, uncertainty-first
reference that closed tools structurally cannot provide, since disclosing their
equations and calibration data would dissolve their commercial moat. Its intended
users are engineers and students performing early-stage screening, and anyone
needing a transparent, reproducible sanity-check reference. PitCast is a
screening-grade research and educational artifact; it is **not** validated for final
design and is not a substitute for alloy- or heat-specific qualification testing.

# Functionality

- **Pitting (CPT).** A critical-pitting-temperature correlation,
  $\mathrm{CPT} = 2.038\,\mathrm{PREN_{N30}} - 32.73$ (°C, with
  $\mathrm{PREN_{N30}} = \mathrm{Cr} + 3.3\,\mathrm{Mo} + 30\,\mathrm{N}$),
  recalibrated on the open Nyby et al. dataset [@nyby2021] with a **leave-one-out
  MAE of 6.58 °C** (RMSE 8.49 °C, $n = 51$, ASTM G48 / FeCl\textsubscript{3} basis
  [@astmG48]) — at or below the inter-laboratory reproducibility of the G48 test it
  predicts. Pitting risk is reported as a probability through a Student-*t*
  prediction interval, not a point estimate.
- **CO\textsubscript{2} corrosion ensemble.** Five canonical models
  [@deWaard1975; @deWaard1995; @norsok2017; @nyborg2010; @nesic2007] run on one
  operating point with an explicit **model-disagreement (envelope) view**. Across ten
  independent in-envelope carbon-steel cases (20–80 °C) [@elgaddafi2015], the models
  disagree by ~10× and the envelope brackets the measurement in ~30 % of cases: the
  lower-bound model (de Waard 1995) tracks mild-condition blank weight-loss rates,
  while single high-rate point estimates over-predict by up to ~10× — an honest,
  decision-relevant warning against trusting any one model where protective
  FeCO\textsubscript{3} scale forms.
- **Sour-service spec issuer.** An ISO 15156 / NACE MR0175 [@iso15156] decision tree
  returning citation-grounded acceptability verdicts.
- **Corroded-pipe fitness-for-service.** ASME B31G and Modified B31G (RSTRENG)
  [@asmeB31G; @kiefner1989] remaining-strength estimates, including batch assessment
  of in-line-inspection (ILI) defect lists, **validated against 19 full-scale
  corroded-pipe burst tests** [@efa2020; @qi2023]: Modified-B31G predicts a mean
  0.689× the measured burst (100 % conservative across all 19), reproducing the
  literature and confirming the method's safe-side bias.
- **Glass-box + education.** Every engine exposes its equation, citation, validity
  envelope, and uncertainty; an integrated "Learn" track provides live worked-example
  walkthroughs.

# Quality control and reproducibility

All headline numbers regenerate from `node benchmark/run.js` using only cited
in-repository data, now spanning **three validation domains** — pitting CPT (n=51
leave-one-out, MAE 6.58 °C), the CO\textsubscript{2} ensemble (independent in-envelope
cases), and **corroded-pipe burst tests** (19 measured bursts vs B31G). The
load-bearing engines also carry literature-anchored regression / oracle suites — the
ASME B31G Appendix-B worked example
[@asmeB31G], the ISO 15156-2 Figure 1 region boundaries [@iso15156], and the NACE
TM0284 HIC acceptance limits — aggregated by `benchmark/test-all.js` and enforced as
a pre-deployment gate. A documented data-inclusion rule
(`benchmark/INCLUSION-RULES.md`) requires every benchmark point to be tabulated,
in-envelope, and cited with a retrievable identifier; nothing is fabricated, and the
corpus is deliberately kept small but fully disclosed.

# Acknowledgements

The CPT correlation is calibrated on the openly licensed (CC-BY) dataset of Nyby et
al. [@nyby2021]. PitCast ports only published, openly citable correlations and
standards, each credited inline in the software and in the references below.

# References
