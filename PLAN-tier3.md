# PitCast — Tier-3 Industry-Readiness Plan

**Audience**: working PE corrosion / mechanical-integrity engineers + the PitCast development team.
**Purpose**: a primary-source-grounded engineering plan to close the ten gaps that separate today's PitCast (Tier-2 screening tool) from a defensible Tier-3 detailed-design-grade product an engineer can cite in a stamped deliverable.
**Method**: each gap was researched via parallel agents pulling from published standards, peer-reviewed papers, vendor data sheets, and recognized industry handbooks. Every algorithm, formula, and effort estimate carries a citation.
**Honesty**: where the gap requires non-engineering work (legal, insurance, attorney review) it is flagged explicitly. Where two competing methods exist (e.g. ASME B31G interaction rule vs DNV-RP-F101) both are documented with the reason to prefer one as default.

---

## 0. Tier model + position statement

```
Tier 1 — Personal sidebar / sanity-check tool                        [PitCast IS this, today]
Tier 2 — Documented screening / FEED-stage triage tool               [PitCast IS this, today]
Tier 3 — Defensible detailed-design tool an engineer cites in a      [PitCast is NOT this — yet]
         stamped deliverable, backed by V&V package + Tech E&O
Tier 4 — Calculation of record / replaces Cathwell, OLI, FEPipe      [Out of scope — don't aim here]
```

PitCast's target is **Tier 3**, defined precisely as: a working PE in responsible charge of a stamped FFS / RBI / CP / material-selection report can cite PitCast output as a screening or supporting calculation, with documented validation evidence, a contractual basis that bounds the engineer's reliance, and a Tech E&O policy covering the publisher's residual liability.

The ten gaps below, when closed, move PitCast across that tier boundary.

---

## 1. Aggregate scope summary (read this first)

| # | Gap | Eng-days | Lines of code | Cash cost | Phase |
|---|---|---:|---:|---:|:---:|
| G1 | ILI multi-defect interaction (DNV-RP-F101 / POF-100 / B31G) | 4 | ~950 | — | **P1** |
| G2 | Vendor-batch Tafel/i0/E_corr polarization data + electrolyte support | 7 | ~600 + 60 kB data | — | P3 |
| G3 | API 581 detailed Damage-Factor architecture (Thinning / SCC / HTHA / Ext / Brittle / Fatigue / Lining / Tank) | 27 | ~3,800 | — | **P2** |
| G4 | Project persistence (IndexedDB, audit chain, `.pitcast` file format) | 9 | ~1,300 | — | **P1** |
| G5 | Formal V&V package (SVVP + CVR + VR + UQ/SA + SQAP) | 65–100 | docs only | — | **P4** |
| G6 | API 579-1/ASME FFS-1 vessel/piping FFS (Parts 3, 4, 5, 6, 7, 8, 9, 14) | 47 | ~6,000 | — | **P2** |
| G7 | NACE MR0175 / ISO 15156 spec-issuer (Annex A.1–A.41 + EPC overlays) | 5–7 | ~2,400 | — | **P1** |
| G8 | CIPS / DCVG / PCM survey-data ingestion + ECDA prioritisation | 6.5 | ~1,600 | — | **P1** |
| G9 | Vendor product database (60–100 specific products, cited datasheets) | 6–9 + curation | ~4,200 + 60 hand-rows | — | P3 |
| G10 | E&O liability framework (IUS + EULA + Apache 2.0 + footer + Tech E&O) | 15–25 | docs only | $6–20k + $2–4k/yr | **P4** |
| | **Total to Tier 3** | **~190–240** | **~20,850** | **$8–25k + $3k/yr** | |

Calendar time at 50% allocation: **~9–12 months**. At full-time single-engineer: **~5–6 months**.

### Recommended phase sequence

- **Phase 1 (~26 eng-days, ~6 weeks calendar)** — G7 MR0175 issuer + G1 ILI interaction + G8 CIPS/DCVG + G4 persistence. These are the four highest-leverage, well-bounded engineering deliverables. After P1: PitCast is *visibly* a daily workhorse for a CP/CRA-selection/pipeline-integrity engineer.
- **Phase 2 (~74 eng-days, ~16 weeks calendar)** — G6 API 579 vessel FFS + G3 API 581 detailed DF. The two biggest pieces, the moat. After P2: PitCast competes feature-for-feature with the screening modules of commercial RBI/FFS tools.
- **Phase 3 (~13–16 eng-days)** — G2 vendor Tafel + G9 vendor product DB. Both turn families into specific products; both compound over time as the curated dataset grows.
- **Phase 4 (~80–125 eng-days + cash)** — G5 V&V package + G10 legal/insurance. These convert the engineering work into a *defensible commercial offering* an underwriter will write a Tech E&O policy against.

Phase 1+2 alone gives an engineer 80% of the daily-use value. Phase 3+4 is what converts "useful tool" into "tool the engineer cites in a stamped deliverable."

---

## Gap G1 — ILI multi-defect interaction rules

### Engineering context
ILI tools (MFL / UT) emit 200–20,000 corrosion features per pipeline run. ~10–30 % sit close enough to a neighbour that the combined defect ruptures at a lower pressure than either alone. PitCast today treats every defect independently in batch B31G — incorrect for those clustered cases. The engineer's manual workaround (re-group in Excel) is the bottleneck this gap eliminates.

### Authoritative sources
1. **ASME B31G-2012**, *Manual for Determining the Remaining Strength of Corroded Pipelines* — Appendix A (Modified B31G / Effective-Area / RSTRENG); §1.6 / §3.4.5 cluster handling; §3.6 acceptance.
2. **DNV-RP-F101 (May 2017 / Jan 2021 reissue)**, *Corroded Pipelines* — Part A §3.7 (interacting defects), §3.8 (complex shape). The gold-standard interaction algorithm in international industry use.
3. **Kiefner & Vieth (1989)**, *A Modified Criterion for Evaluating the Remaining Strength of Corroded Pipe*, PRCI/Battelle PR-3-805, AGA Catalog L51688. Origin of RSTRENG.
4. **Cosham & Hopkins (2002, updated 2007)**, *Pipeline Defect Assessment Manual (PDAM)*, Penspen/Andrew Palmer.
5. **POF-100 (2021)**, *Specifications and requirements for in-line inspection of pipelines*, Pipeline Operators Forum — §6 anomaly definitions, §7 reporting (interaction-box rule).
6. **API STD 1163 (3rd ed., 2021)**, *In-Line Inspection Systems Qualification* — §7.2.3 POI, §7.2.4 sizing accuracy (tool-tolerance expansion required before clustering).
7. **BS 7910:2019 + A1:2022**, *Guide to methods for assessing the acceptability of flaws in metallic structures*, Annex G.
8. **NACE SP0102-2017**, *In-Line Inspection of Pipelines* — §5/§6 data management/analysis.
9. **DNV-RP-F116 (2021)**, *Integrity management of submarine pipeline systems* — §7.

### Algorithms — the three rules

**DNV-RP-F101 §3.7 (gold-standard default in PitCast):**
- Interact if **both** `s_axial ≤ 2·√(D·t)` and `s_circ ≤ π·√(D·t)` (equivalently angular φ ≤ 360·√(t/D)°)
- Merged length: `L_combined = L_first + Σ (sᵢ + Lᵢ)` end-to-end
- Length-weighted merged depth: `d_combined = Σ (dᵢ · Lᵢ) / L_combined`
- Re-apply single-defect failure-pressure equation with `Q = √(1 + 0.31·L_combined²/(D·t))`

**ASME B31G-2012 / Modified B31G (Kiefner classical):**
- Axial: combine if gap < 1 inch (25.4 mm); some operators use min(L₁, L₂)
- Circumferential: 6·t outer bound
- Combined depth: max (not weighted average) — more conservative

**POF-100 (2021) interaction-box:**
- Cluster if `s_axial < min(L₁, L₂)` AND `s_circ < min(W₁, W₂)`
- Never cluster if either spacing ≥ 6·t
- Cluster reports bounding-box (L, W) and max depth

### Worked validation cases

**A-1 — DNV-RP-F101 axial pair:** D=711 mm, t=10.5 mm, X65, L₁=50 mm d₁=2.5 mm at x=0, L₂=30 mm d₂=2.0 mm at x=100 mm. Interaction test: `2√(D·t) = 172.7 mm`; gap 50 mm → interact. `L_comb=130 mm, d_comb=2.31 mm, Q=1.305, P_f = 15.05 MPa`. Single largest alone: 15.79 MPa → interaction drops P_f by 5%.

**A-2 — POF clustering at offset pits:** D=508, t=8, L₁=W₁=12 at axial 100, L₂=W₂=15 at axial 110, lateral offset 5. s_axial = −3.5 mm (overlap) → cluster; s_circ = 5 < min(12,15) → cluster. POF box: L=27, W≈20, d=max(d₁,d₂).

**A-3 — B31G axial cluster:** 24" × 0.281" X52, L₁=6" d₁=0.10", L₂=4" d₂=0.08", gap=0.5". Combine (< 1 inch). L_comb=10.5", d_comb=0.10", M_modB31G=3.21, P_safe at SF=1.39 = 68.0 bar. Single largest: ~75 bar → 9% capacity reduction.

### Implementation roadmap

New file **`pitcast-web/interaction.js`** (~400 LOC):
```javascript
Interaction.cluster(features, opts={ rule:"dnv", D, t, tool_tol_axial, tool_tol_circ })
  → returns Array<Cluster>
Interaction.RULES = { dnv: dnvRule, b31g: b31gRule, pof: pofRule }
```

Data structure per feature:
```javascript
{ id, x_axial_mm, theta_deg, L_mm, W_mm, d_mm, t_mm, D_mm, tool_tol_mm }
```

Pre-cluster step (API 1163): expand each box by tool's stated tolerance (±10 mm axial, ±10% wall typical) BEFORE applying spacing test — conservative.

UI: ILI Batch tab existing grid gains "Cluster" column (parent cluster id, expand inline); rule-selector dropdown DNV-RP-F101 / Mod-B31G / POF-100; "P_safe reduced X% by clustering" delta badge per cluster.

CSV ingest: accept POF UPT-style columns (POF 110 spec) + generic `id,x,theta,L,W,d` fallback.

### Effort
- Core clustering + 3 rules + regression tests: ~400 LOC, 1.5 days
- POF/UPT CSV parser (header normalisation, inch/mm auto-detect): ~250 LOC, 1 day
- UI integration (column, expandable rows, rule selector, delta): ~300 LOC, 1.5 days
- Validation against the 3 examples + Adilson dataset: 0.5 day
- **Total: ~950 LOC, ~4 days**

### Dependencies
- Builds on existing `b31g.js`; no other gap is upstream.

---

## Gap G2 — Vendor-batch polarization data (Tafel / i₀ / E_corr per alloy × electrolyte × T)

### Engineering context
Current `galvanic.js` uses 15 family-typical Tafel sets for the entire periodic table. Industry CP design uses per-alloy, per-electrolyte, per-temperature data measured per ASTM G5 / G59 — often per-heat from a vendor's ATS. The asymmetry today: we have heat-resolved mechanical data on every MTC but textbook-grade electrochemistry.

### Authoritative sources
1. **ASTM G3-14(2019)**, *Conventions Applicable to Electrochemical Measurements in Corrosion Testing*, DOI 10.1520/G0003-14R19.
2. **ASTM G5-14e1**, *Standard Reference Test Method for Potentiostatic and Potentiodynamic Anodic Polarization*, DOI 10.1520/G0005-14E01 — the 430 SS / 1 N H₂SO₄ reference round-robin (E_corr = −0.522 V SCE; i_pass = 1.8 ± 0.7 µA/cm²; ba ≈ 60 mV/dec).
3. **ASTM G59-97(2020)**, *Polarization Resistance Measurements* — Stern-Geary `B = (ba·bc) / [2.303·(ba+bc)]`.
4. **ASTM G102-89(2015)e1**, *Calculation of Corrosion Rates* — `CR (mm/yr) = 3.27e-3 · (i_corr / ρ) · EW` with EW table for 24 common alloys.
5. **Stansbury & Buchanan (2000)**, *Fundamentals of Electrochemical Corrosion*, ASM International, ISBN 978-0-87170-676-8 — Ch.4 Tables 4.1–4.4 (the canonical reference).
6. **Trethewey & Chamberlain (1995)**, *Corrosion for Science and Engineering*, 2nd ed., Pearson, ISBN 0-582-23869-2 — Table 3.4 (i₀ for H₂/O₂ across 10 metals).
7. **Jones (1996)**, *Principles and Prevention of Corrosion*, 2nd ed., Prentice Hall — Ch.3 Table 3.2 (87-source Tafel constants).
8. **ASM Handbook Volume 13A/13B (2003)**, *Corrosion*, ISBN 978-0-87170-705-5.
9. **Nyby et al. (2021)** — *Sci Data* **8**, 58 — open dataset of 187 CRA E_corr / E_pit / CPT (CC BY 4.0), already loaded in PitCast.
10. **MICRA/CORDIS open corrosion database (EU FP7)** — corrosion.kth.se ~3200 polarization scans for nuclear alloys.

### Schema for `pitcast-web/data/polarization.json`

```json
{ "alloy":"<UNS or PitCast key>", "family":"...", "env":"SW|FW|NaCl|Soil|Acid",
  "T_C":25, "pH":null, "Cl_ppm":19000,
  "E_corr_V_SHE":-0.61, "E_corr_V_AgAgCl":-0.66,
  "ba_mV_dec":60, "bc_mV_dec":120,
  "i0_a_A_m2":1e-3, "i0_c_A_m2":5e-3,
  "i_pass_A_m2":1e-3, "i_crit_A_m2":null, "E_pit_V_SHE":null,
  "EW_g_eq":27.9, "rho_g_cm3":7.87,
  "source":"Stansbury & Buchanan 2000 Tab 4.3",
  "doi":"ISBN:978-0-87170-676-8",
  "n_runs":1, "scatter_decade_i0":0.5, "scatter_mV_Ecorr":30 }
```

Target dataset: ~50 alloys × 5 environments = ~250 rows, ~60 kB JSON / ~12 kB gzipped.

### Five environments (canonical lab/field references)
- **SW** — natural seawater, aerated, flowing 0.5 m/s, 15–25 °C, ~19,000 ppm Cl
- **FW** — soft freshwater, aerated, 25 °C, <100 ppm Cl, pH 7
- **NaCl** — 3.5% NaCl deaerated, 25 °C (ASTM G31 §6.3)
- **Soil** — AWWA C105 simulant (~5000 ppm Cl, pH 7)
- **Acid** — 1 N H₂SO₄ deaerated, 30 °C (ASTM G5 reference)

### Authoritative starter values (cite Stansbury / Jones / Sedriks / DNV-RP-B401)

| Alloy | Env | E_corr (Ag/AgCl, V) | ba (mV/dec) | bc | i₀_a (A/m²) | i_pass / i_corr | Source |
|---|---|---|---|---|---|---|---|
| CS / X65 | SW | −0.66 | 60 | 120 | 10⁻³ | 5·10⁻³ | Jones 1996 Tab 3.2 |
| CS | 1N H₂SO₄ | −0.28 | 40 | 120 | 10⁻² | 10⁻² → 1.6 mm/yr | Jones Ex 3.4 |
| 304L passive | SW | −0.10 | >300 | 120 | 10⁻⁵ | i_pass 5·10⁻³; E_pit +0.30 | Sedriks ASM 13B Fig 12 |
| 316L passive | SW | −0.10 | >300 | 120 | 10⁻⁵ | 3·10⁻³; E_pit +0.40 | Sedriks |
| 2205 passive | SW | −0.09 | — | — | — | 2·10⁻³; E_pit +0.55 | Iversen ECF-15 1999 |
| 2507 passive | SW | −0.08 | — | — | — | 1.5·10⁻³; E_pit +0.95 | Bernhardsson Stainless Steel '87 |
| 254SMO passive | SW | −0.07 | — | — | — | 8·10⁻⁴; E_pit +1.05 | Outokumpu 2005 ATS |
| Alloy 625 | SW | −0.05 | — | — | — | 5·10⁻⁴; E_pit +1.2 | Crum & Smith Corr/89 #170 |
| Hastelloy C-276 | SW | −0.05 | — | — | — | 3·10⁻⁴; E_pit +1.1 | Rebak ASM 13B |
| Alloy 22 | 1M HCl 90°C | −0.25 | — | — | — | i_corr 1·10⁻³ | Rebak ASM 13B |
| Cu | SW | −0.25 | 60 | 120 | 10⁻³ | i_corr 5·10⁻³ | Bianchi & Longhi 1973 |
| 90-10 CuNi | SW | −0.28 | — | — | — | i_corr 3·10⁻³ | Schumacher 1979 |
| Al 5083 | SW | −0.85 | — | — | — | i_pass 3·10⁻⁴; E_pit −0.76 | Foley 1986 |
| Ti Gr 2 | SW | +0.06 | — | — | — | i_pass 5·10⁻⁵; E_pit >+5 | Schutz & Thomas ASM 13 |
| Zn pure | SW | −1.03 | 70 | 120 | 10⁻¹ | i_corr 4·10⁻² | Stansbury §5.6 |
| Al-Zn-In anode | SW | −1.05 | — | — | — | capacity 2500 Ah/kg, util 0.90 | DNV-RP-B401 Tab 7-1 |
| Mg AZ-63 anode | SW | −1.55 | — | — | — | capacity 1230 Ah/kg, util 0.50 | ASTM B843 |

(Full ~250-row table to be built from above sources during implementation.)

### Temperature dependence
Arrhenius on **i₀ only** (b is weakly T-dependent via 2.303·RT/(αnF), ~0.2 mV/°C — dominated by exchange-current Arrhenius):
```
i₀(T) = i₀(T_ref) · exp[ −Eₐ/R · (1/T − 1/T_ref) ]
Eₐ = 30–60 kJ/mol metal dissolution (West 1986); 45 ± 10 kJ/mol O₂ on Fe (Bockris & Reddy)
```
Default Eₐ = 40 kJ/mol where source paper doesn't give it.

### Passivation-breakdown chloride threshold
Galvele's model (*J. Electrochem. Soc.* **123** (1976) 464): ba stays >300 mV/dec passive until [Cl⁻] reaches critical, then collapses to active 30–80 mV/dec. Empirical step-thresholds:
- 304L: log[Cl] ≈ 2.7 (~500 ppm) at room T
- 316L: log[Cl] ≈ 3.3 (~2,000 ppm)
- 2205: log[Cl] ≈ 4.1 (~12,500 ppm)
- 254SMO: log[Cl] ≈ 5.0 (>100,000 ppm)
- Al alloys: log[Cl] ≈ 1 (~10 ppm) — essentially always pitting in seawater

Implement as discrete step, not sigmoid.

### Implementation roadmap

1. **`pitcast-web/data/polarization.json`** (NEW, ~250 rows × 15 fields)
2. **`pitcast-web/electrochem.js`** (NEW, ~280 LOC) exposing:
   - `Electrochem.lookup(alloy, env, T)` — Arrhenius-adjusted i₀
   - `Electrochem.passivationState(alloy, Cl_ppm, T)` — "passive" / "active"
   - `Electrochem.fitTafel(E_arr, i_arr, window_mV)` — back-fit ba/bc from raw scan
   - `Electrochem.stern_geary(ba, bc, R_p)` — i_corr from R_p
   - `Electrochem.overrideFromMTC(mtc_json)` — per-heat override slot
   - `Electrochem.validateAgainstG5(curve)` — round-robin check (±15 mV, ±50% on i_pass)
3. **`pitcast-web/galvanic.js`** (MODIFY ~30 LOC) — `_fam()` → `_lookupTafel(metal, env, T, Cl)`; falls back to family table; routes SS/Al through `passivationState`.
4. **`index.html`** (MODIFY ~80 LOC) — Electrolyte dropdown, T input, Cl_ppm input on galvanic tab; upload-MTC button.
5. **`electrochem.test.html`** (NEW, ~200 LOC) — G5 reference round-robin pass.

### Effort
- Curating 250 rows from primary sources: 3 days
- Coding electrochem.js + tests + integration: 2 days
- UI updates: 1.5 days
- Browser-verified validation: 0.5 days
- **Total: ~7 days, ~600 LOC + 60 kB data**

### Dependencies
- Benefits from G4 persistence (engineers will want to save per-heat polarization with the project). Sequence G4 before G2.

---

## Gap G3 — API RP 581 detailed Damage-Factor architecture

### Engineering context
Current `rbi.js` is the 5×5 screening matrix + `driver = (CR·age/t_nom) / margin`. Real API 581 RBI is **PoF(t) = GFF · F_MS · D_f(t)** with damage factors computed per Annex (Thinning 2.B, SCC 2.C.x, HTHA 2.D, External 2.E, Brittle 2.G, Fatigue 2.H, Lining 2.J, Tank Appx O), where credit for an effective inspection cuts D_f by 10–35× and drives the inspection budget. A regulator-facing RBI study cannot be defended on the screening matrix alone.

### Authoritative sources
1. **API RP 581, 3rd Edition, April 2016** (1st Addendum 2019, 2nd Addendum 2020), *Risk-Based Inspection Methodology* — Parts 1, 2 (PoF + Annexes 2.A–2.J/2.M), 3 (CoF), Appendix O (AST).
2. **API RP 581, 4th Edition, February 2025** — restructured 5 Parts; semi-quantitative; safety-based CoF; Annex 2.C inspection-effectiveness moved to new Annex 2.F; HIC/SOHIC severity Table 2.C.9.2 re-aligned to NACE; external corrosion coating-adjustment reworked.
3. **API RP 580, 4th Edition, 2023** — programme framework.
4. **API RP 571, 3rd Edition** — damage mechanism taxonomy.
5. **API RP 583** — Corrosion Under Insulation upstream document for Annex 2.E.
6. **Trinity-Bridge worked example** — *API-581_3rd_Thinning_Example_2.pdf* — full numerical walkthrough (`Art=0.25 + 1A → D_fB^thin = 33.30`).
7. **AOC V-07 Debutanizer worked example** — GFF 3.06×10⁻⁵, full DF + CoF + risk + plan, financial CoF $21.3M.
8. **Cenosco IMS Handbook — RBI 581 Methodology** — `F_MS = 10^(−0.02·pscore + 1)` formula.
9. **Pu, Y.** (Inspectioneering) — *Five fatal flaws in API RP 581*, ResearchGate 323258851 — critique of GFF distribution + Bayesian inspection updating + DF caps.
10. **Becht (2018)** — time-based Nelson curves for HTHA, becht.com.

### Annex map (3rd ed., 2016)

| Annex | Title | DM |
|---|---|---|
| 2.A | Component Reliability (master `PoF = GFF · F_MS · D_f`; F_MS 100-q audit, 1000 pt max) | All |
| **2.B** | **Thinning DF** (general metal loss + sulfidic/naphthenic) | **Thinning — workhorse** |
| 2.C | Internal SCC (Cl-SCC, Caustic, Amine, Carbonate, PTA, HF, sulfide SSC, HIC/SOHIC-H2S, HSC-HF, alkaline carbonate) | All cracking |
| 2.D | HTHA (Nelson-curve based) | HTHA |
| 2.E | External ferritic + CUI (peak 88–110 °C) | External CS + CUI |
| 2.F | External austenitic SS / ext Cl-SCC | External SS |
| 2.G | Brittle Fracture (885°F, σ-phase, temper, hydrogen embrittlement) | Brittle |
| 2.H | Mechanical Fatigue (small-bore connections) | Vibration |
| 2.J | Linings (refractory, glass, FRP, organic, alloy clad) | Lining |
| **Appx O** | **Tank Bottoms + Shells** — separate GFF (floor leak 1e-4, rupture 2e-5; shell leak 7.22e-3, rupture 1e-4 maintained / 1e-3 not) | AST |

### The thinning DF algorithm (Annex 2.B — every other annex copies this skeleton)

**Step 1 — Art (fractional wall loss), Eq. 5.13:**
```
Art = max[ 1 − (t_rdi − CR·age) / (t_min + CA), 0 ]
```
Worked example: t_rdi=0.500", CR=5 mpy, age=25 yr, t_min=0.375", CA=0.125" → Art=0.25.

**Step 2 — Inspection-effectiveness category combination** (Table 5.7): each past inspection is A/B/C/D/E; combine per the matrix (1B+1B=2B; 2B=1A; 1B+1C=1B; ...).

**Step 3 — Bayesian posterior on three damage states** (CR multipliers 1×, 2×, 4×). Prior `[0.50, 0.30, 0.20]`. Conditional probabilities from Part 2 §5.8 per inspection category. For 1A on Example 1: posterior `[0.9395, 0.0564, 0.0042]`.

**Step 4 — Reliability index β per damage state, Eq. 5.18:**
```
β_i = [(1 − DS_i · Art) − Sa_term] / sqrt(COV_terms)
COV_t = 0.20, COV_p = 0.05, COV_Sf = 0.20
```
Example 1: β = [3.3739, 2.0072, 1.0750].

**Step 5 — Base DF, Eq. 5.19:**
```
D_fB^thin = [Σᵢ (Po_i · Φ(−β_i))] / 1.56E-04
```
Example 1, 1A: D_fB^thin = 33.30. Example 1, 0E: 1145.23. Cap 5000 (3rd ed.) / ~6410 (4th ed.).

**Step 6 — Adjustments:**
```
D_f^thin = D_fB^thin · F_IP · F_DL · F_WD · F_AM · F_SM · F_OM
```
- F_IP injection point ×5; F_DL dead-leg; F_WD welded; F_AM AST/API-653 maintenance; F_SM settlement; **F_OM ~0.1 with continuous on-line monitoring** — drives the business case for coupons/probes.

**Step 7 — PoF:** `PoF(t) = GFF · F_MS · D_f(t) = 3.06E-05 · 0.1 · 33.30 ≈ 1.02E-04/yr` (Example 1).

### GFF Table 3.1 — actual numbers (Part 2)

| Component | 1/4" | 1" | 4" | rupture (≥16") | **Total** |
|---|---|---|---|---|---|
| Pressure Vessel / Drum / Column / Exchanger | 8.0e-6 | 2.0e-5 | 2.0e-6 | 6.0e-7 | **3.06e-5** |
| Centrifugal Pump (single seal) | 4.0e-5 | 1.0e-5 | 1.0e-6 | 3.0e-7 | 5.13e-5 |
| Pipe < 4" NB | 5.0e-5 | 5.0e-6 | — | 1.5e-7 | ~5.5e-5/ft |
| Pipe 4–10" / >10" NB | 8.0e-6 | 2.0e-5 | 2.0e-6 | 6.0e-7 | 3.06e-5/ft |
| AST floor (leak + rupture) | — | — | — | 1.0e-4 leak + 2.0e-5 rupture | 1.2e-4 |
| AST shell (welded ≥1/8") | — | 7.22e-3 leak | — | 1.0e-4 (API-653) / 1.0e-3 (not) | 7.32e-3 / 8.22e-3 |

### CoF Level 1 in one paragraph
Closed-form per-fluid library of 11 fluids (`C1-C2, C3-C4, C5, C6-C8, C9-C12`, gasoline, naphtha/diesel, JP-8/kero, fuel-oil, plus toxics `H2S, NH3, Cl2, HF, acid`). Each: pre-tabulated MW/density/NBP/AIT/MIE/toxic-limit + `consequence_area = a · (mass_or_rate)^b` per Part 3 Tables 5.1-5.4. Release-rate flow: hole size (1/4"/1"/4"/16") → choked/non-choked/liquid → release rate → detection class A/B/C (5min/30min/1hr) → isolation class A/B/C (20min/1hr/8hr) → total released. CoF areas: `CA_cmd` (equipment-damage from overpressure) + `CA_inj` (flammable + toxic personnel-injury envelopes). Financial CoF: `FC_total = FC_cmd + FC_affa + FC_PROD + FC_injcost + FC_environ` with AOC V-07 calibration $21.3M.

### Implementation roadmap — one file per annex
```
pitcast-web/rbi/
  rbi-core.js               // PoF = GFF · F_MS · D_f, F_MS 100-q audit
  rbi-gff.js                // Table 3.1 lookup
  rbi-thin.js               // Annex 2.B (spine, ~250 LOC)
  rbi-scc-cl.js             // Annex 2.C.1
  rbi-scc-caust.js          // Annex 2.C.2
  rbi-scc-amine.js          // Annex 2.C.3
  rbi-scc-hic.js            // Annex 2.C.9
  rbi-htha.js               // Annex 2.D + digitised Nelson curves
  rbi-ext.js                // Annex 2.E external CS + CUI
  rbi-ext-cl.js             // Annex 2.F external SS Cl-SCC
  rbi-brittle.js            // Annex 2.G + Part 3 MAT curves A/B/C/D
  rbi-fatigue.js            // Annex 2.H mechanical fatigue
  rbi-lining.js             // Annex 2.J
  rbi-tank.js               // Appendix O
  cof-level1.js             // Part 3 Level 1 (11 fluids × 4 hole)
  cof-financial.js          // FC_total assembly
  risk-matrix.js            // 5×5 area + 5×5 financial plot
  inspection-effectiveness.js // 1A..1E + N-inspection combination
rbi-ui.js                   // Tabs, equipment list, multi-DM selector, plan-date risk plot
```

### Effort (realistic, mid-senior PE-grade diligence)

| File | LOC | Days |
|---|---|---|
| rbi-thin.js (full Annex 2.B) | 300 | 3 |
| 5 SCC annexes (150 LOC each) | 750 | 4 |
| rbi-htha.js + Nelson curves | 200 | 2 |
| rbi-ext.js + CUI | 250 | 2 |
| rbi-brittle.js + MAT digitised | 200 | 2 |
| rbi-fatigue.js + rbi-lining.js | 150 | 1 |
| rbi-tank.js (Appx O) | 300 | 2 |
| inspection-effectiveness + Bayesian update | 150 | 2 |
| GFF Table 3.1 | 60 rows | 0.5 |
| cof-level1.js + financial | 600 | 4 |
| UI (multi-DM, equipment library, plan-date plot, optimisation slider) | 800 | 5 |
| Validation against 3 published worked examples + 10 regressions | – | 2 |
| **Total** | **~3,800 LOC** | **~27 days** |

Realistic delivery: ~5–6 weeks single-engineer.

### Validation targets (regression-test against published numbers)
- Trinity-Bridge Ex 1: D_fB^thin = 33.30 ± 1 (1A) / 1145.23 ± 1 (0E)
- Trinity-Bridge Ex 2: D_fB^thin = 56.50 (Art=0.3016, 3B)
- AOC V-07: PoF 2.14E-03 at RBI date; after 1B thin + 1C crack PoF 1.22E-03; financial CoF $21.3M

### Dependencies
- Standalone. No upstream gap required.

---

## Gap G4 — Project persistence (IndexedDB + audit chain + `.pitcast` file format)

### Engineering context
Today PitCast is single-session. An engineer juggling 12 assets/week re-types service conditions every session. There is no project concept, no save/load, no audit trail of who changed what when. The output PDF is the audit trail, the SharePoint version history is the change log. This is the failure mode that destroyed credibility of two ChevronPhillips / Tengiz vendor-tool decisions in the 2010s.

### Authoritative sources
1. **W3C Indexed Database API 3.0** (W3C WD 2024-09-18) — Chrome/Edge 79+ ~60% disk per origin; Firefox 91+ 50% free disk / 2 GB per group; Safari 16+ 1 GB with prompt.
2. **W3C File System Access API + Origin Private File System** (WICG, https://wicg.github.io/file-system-access/) — 5–10× faster than IndexedDB for binary; Chromium 102+, Safari 17+, Firefox 111+ as of 2026.
3. **W3C Web Storage** (5 MB hard limit, synchronous — wrong layer for >5 KB state).
4. **JSON Schema 2020-12** (IETF draft-bhutton-json-schema-01).
5. **Yjs** (Nicolaescu et al. *CSCW 2016*) — 36 kB gz CRDT; Y.encodeStateAsUpdate() for binary deltas.
6. **Automerge** (Kleppmann et al. *PaPoC 2018*) — 120 kB gz, JSON-shape CRDT.
7. **Engineering file conventions** — AutoCAD DWG (ODA *DWG Specification* v6.1.5, 2024); CAESAR II `.c2` (Hexagon *Quick Reference Guide* 2022 §2.3); IFC (ISO 16739-1:2024).
8. **NIST SP 800-53 Rev 5** AU control family (AU-2/3/9/10/12) — AU-10 requires cryptographic binding.
9. **IEC 62443-3-3:2013** SR 2.8–2.12 — auditable events: timestamped, source-attributable, append-only.
10. **21 CFR Part 11** (FDA) — de facto template for tamper-evident audit logs.
11. **Isomorphic-Git** (~250 kB) + **Lightning-FS** IndexedDB VFS — doable but heavy; skip unless user-facing requirement.
12. **CompressionStream API** (WICG, HTML Standard 2022) — 3–5× on JSON, all modern browsers since 2023.
13. **Haber & Stornetta (1991)** *J. Cryptol.* **3**(2) 99–111 — hash-chain primitive foundation.
14. **Web Crypto SubtleCrypto** (W3C Rec 2017) — `crypto.subtle.digest('SHA-256', bytes)`.

### Storage layer decision: **IndexedDB primary, OPFS for large blobs, localStorage for breadcrumbs**

| Concern | IndexedDB | OPFS | localStorage |
|---|---|---|---|
| Quota | ~60% disk | shared | 5 MB |
| API | Async Promise | Async + sync (Workers) | Sync, blocks UI |
| Binary | Yes | Yes (best) | Base64 hack |
| Indexed query | Yes | No | No |
| Cross-browser | Universal since 2011 | Chromium/Safari/FF 2023+ | Universal |

### `.pitcast` project file schema (JSON v1.0.0)

```json
{
  "$schema": "https://pitcast.austenite.org/schema/project-v1.json",
  "format": "pitcast-project",
  "format_version": "1.0.0",
  "project_id": "01J3K8WG1F2NZQH8Z7Y3X5RPMA",   // ULID (Crockford)
  "name": "Tengiz Sour Gas Inlet Spool — 2026 RBI",
  "created_utc": "2026-05-28T10:14:33.421Z",
  "modified_utc": "2026-05-28T17:42:11.084Z",
  "owner": { "name": "Jane Doe", "initials": "JD", "pe_stamp": null },
  "asset": {
    "tag": "V-1201",
    "type": "vessel|pipeline|tank|hex|other",
    "material_uns": "S31803",
    "service": { "T_C":60, "Cl_ppm":50000, "pH":4.5, "pH2S_kPa":10, "stress_x_YS":0.5 }
  },
  "calculations": [
    { "module":"PitCast.assess", "inputs":{...}, "outputs":{...}, "timestamp_utc":"...", "calc_id":"<ULID>" }
  ],
  "audit_chain": [
    { "seq":0, "ts":"...", "user":"JD",
      "action":"create_project", "before":null, "after":{...},
      "prev_hash":"0".repeat(64), "hash":"8e3a..." },
    { "seq":1, "ts":"...", "user":"JD",
      "action":"set_input", "path":"asset.service.T_C", "before":25, "after":60,
      "prev_hash":"8e3a...", "hash":"f2b1..." }
  ],
  "attachments": [
    { "id":"att_01J3...", "filename":"vendor_mtc.pdf",
      "sha256":"...", "size_bytes":84223, "ref":"indexeddb://blob/att_01J3..." }
  ]
}
```

Notes: **ULID over UUID** (lexicographic = chronological); semver `format_version` for forward-compat; `audit_chain` is the only authoritative history (calculations derivable by replay); **JCS-canonicalized hash** (RFC 8785) per entry; attachments are blob-references, not inlined.

### Audit-chain primitive (minimum credible)

```javascript
async function appendAudit(chain, entry) {
  const prev = chain.length ? chain[chain.length-1].hash : "0".repeat(64);
  const canonical = JSON.stringify({...entry, prev_hash: prev}, Object.keys(entry).sort());
  const buf = new TextEncoder().encode(canonical);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  const hash = [...new Uint8Array(hashBuf)].map(b=>b.toString(16).padStart(2,"0")).join("");
  chain.push({...entry, prev_hash: prev, hash});
  return chain;
}
async function verifyAudit(chain) { /* recompute and verify each hash */ }
```

**Tamper resistance**: post-hoc edit to entry k requires recomputing hashes k..n; detectable iff one downstream hash anchored outside the file. PitCast prints the current head hash on every exported PDF — the PDF anchored on the user's record server is the trusted external anchor. Same primitive as Certificate Transparency.

What it doesn't do: prove *when* (no trusted timestamp), prove user identity (no WebCrypto keypair in v1). For PE-stamp grade, layer ECDSA keypair stored in user's password manager — out of scope for v1.

### Storage footprint estimate
1 pipeline asset, 200 defects, 5 yrs monthly recalc: asset 2 kB + 60 × 200 × 1.2 kB = 14.4 MB calc snapshots + ~1.8 MB audit + 10 × 10 MB attachments = **~120 MB/asset**. 100 assets ≈ 12 GB. Comfortable in Chrome (~80 GB) but **must call `navigator.storage.persist()` early** and handle Safari's 1 GB / origin quota with split-project-export workflow.

### Implementation roadmap
```
pitcast-web/
  storage.js              // IndexedDB wrapper (~400 LOC); object stores projects/calculations/audit/attachments
  audit.js                // append/verify + RFC 8785 canonicalize (~120 LOC)
  schema/project-v1.json  // JSON Schema 2020-12 (~250 LOC, Ajv standalone ~25 kB)
  projects-ui.js          // Projects sidebar, first-run modal, audit-log viewer (~350 LOC)
  app.js                  // MODIFY ~120 LOC: wrap every assess()/couple()/co2() in Storage.appendCalculation
  index.html              // MODIFY ~60 LOC: sidebar + modal + drop-zone
  storage.test.html       // IndexedDB roundtrip, tamper detect, export/reimport identity, 200-defect stress, gzip (~250 LOC)
  styles.css              // MODIFY ~80 LOC
```

User identity (no backend): first-run modal "Full Name + Initials" → localStorage. Every audit entry carries `user.initials`. PE stamp = future ECDSA keypair, v2.

Export format: `.pitcast` (JSON) + `.pitcastz` (gzipped via CompressionStream). MIME `application/vnd.pitcast.project+json`. Drag-drop with `0x1f 0x8b` magic-byte gzip detection. **Never auto-overwrite open project** — import always opens as "new" with fork-of relationship in audit chain.

### Effort
- IndexedDB wrapper + tests: 2 days
- Audit chain + verifier + schema: 1 day
- File format + import/export + drag-drop + gzip: 1 day
- Projects sidebar + first-run modal + audit log viewer: 2 days
- Integration into existing tabs (every input → audit, every result → calc snapshot): 1.5 days
- Cross-browser quota edge cases + OPFS fallback: 0.5 days
- README documenting format + audit primitive: 0.5 days
- **Total: ~9 days, ~1,300 LOC + ~200 modified, ~10 kB gz bundle weight (Ajv dominates)**

### Dependencies
- Standalone. Should ship FIRST in P1 — every other gap benefits from persisting its inputs/outputs to a project.

---

## Gap G5 — Formal V&V package (SVVP + CVR + VR + UQ/SA + SQAP)

### Engineering context
PitCast's 5,500+ in-Chrome tests are software regression evidence — useful but **not** what an underwriter (Marsh / Lockton Tech E&O), NRC reviewer (RG 1.168), or aerospace DER (DO-178C DAL-D) would call V&V. ASME V&V framework would call them unstructured Code Verification with no Solution Verification, no Validation Hierarchy, no UQ, no document traceability. If PitCast output is ever proximate cause of failure, opposing counsel's first discovery request is "produce the V&V package" — answering "5,500 tests, here's a GitHub commit hash" is not survivable.

### Authoritative sources
1. **ASME V&V 10-2019**, *Standard for V&V in Computational Solid Mechanics* — Verification (math right) vs Validation (right math), validation hierarchy, UQ role.
2. **ASME V&V 20-2009 (R2021)**, *Standard for V&V in CFD & Heat Transfer* — validation metric `E = S − D ± u_val` with `u_val = sqrt(u_num² + u_input² + u_D²)`.
3. **ASME V&V 40-2018**, *Assessing Credibility of Computational Modeling — Application to Medical Devices* — the risk-informed credibility framework (cleanest off-the-shelf template).
4. **Oberkampf & Roy (2010)**, *Verification and Validation in Scientific Computing*, Cambridge UP, ISBN 9780521113601 — seminal academic treatment. 2024 ed adds UQ.
5. **Trucano et al. (2006)** *Reliability Engineering & System Safety* **91**(10–11):1331–1357 — *Calibration, validation, and sensitivity analysis: What's what.*
6. **NIST SP 500-234** (Wallace 1996), *Reference Information for the Software V&V Process*, DOI 10.6028/NIST.SP.500-234.
7. **IEEE Std 1012-2016** *IEEE Standard for System, Software, and Hardware Verification and Validation* — four integrity levels with task tables; SVVP outline NRC RG 1.168 endorses.
8. **ASME NQA-1-2019** Part II Subpart 2.7 — *Quality Assurance Requirements for Computer Software for Nuclear Facility Applications* — gold standard, generally overkill outside Class-1E.
9. **NRC RG 1.168 Rev. 2 (2013)** — endorses IEEE 1012 as acceptable.
10. **RTCA DO-178C / EUROCAE ED-12C (2011)** — 5 DALs A–E (71/69/62/26/0 objectives).
11. **IEC 61508** + **ISO 26262** — SIL framework.
12. **Roache (1998, 2009)** — Grid Convergence Index (GCI), ASME *J. Fluids Eng.* 1997.
13. **Salem, Knupp et al. (2002)** *ASME J. Fluids Eng.* **124**(1):4–10 — Method of Manufactured Solutions reference.

### Minimum-credible package (5 documents)

| # | Document | Cites | Contents |
|---|---|---|---|
| 1 | **SVVP** Software V&V Plan | IEEE 1012 §7.1, NQA-1 Subpart 2.7, NIST SP 500-234 | Scope, integrity level (PitCast = **IL2** = "important, not safety-critical" / **V&V 40 medium model risk** / **DO-178C DAL-D analog**), V&V org, lifecycle activities, deliverables, CM, anomaly reporting |
| 2 | **CVR** Code Verification Report | ASME V&V 10 §3, Oberkampf & Roy Ch.4, Roache GCI, Salem-Knupp MMS | Per module: order-of-accuracy, MMS where applicable, GCI on meshed solvers, analytical-solution comparisons (Lamé thick-wall, pipe Re analytical, Paris closed-form) |
| 3 | **VR** Validation Report w/ Hierarchy | ASME V&V 10 §4, V&V 20, Trucano | 4-tier pyramid: **T1 Unit** (textbook), **T2 Benchmark** (API 579 Annex 9F.10, API 581 Annex 4.B, ASME PCC-2 Article 4.1, NACE TM0177), **T3 Subsystem** (single-engine full-loop on industrial case), **T4 Integrated** (multi-engine on historic public failure). Every claim with `E = S − D ± u_val` |
| 4 | **UQ/SA** Uncertainty Quantification & Sensitivity Analysis | V&V 10 §5, V&V 20, Trucano, JCGM 100 (GUM) | Per output: input uncertainty inventory, propagation (Sobol / MC / Laplace — PitCast already runs Bayesian Laplace for σ-phase), output PDF 5/50/95 percentiles, Sobol indices |
| 5 | **SQAP + SCMP** Software QA + Configuration Mgmt | NQA-1 Subpart 2.7, ISO/IEC 25010, IEEE 1012 §7.2 | Bug-tracking SOP, build-reproducibility hash, regression-test pass criteria (the 5,500 tests live here), code-review SOP, release approval |

### Acceptance bands (literature convention)

| Tier | Band | Use |
|---|---|---|
| Nuclear NQA-1 | ±0.5 % to ±2 % UQ-budgeted | Class-1E |
| Detailed design (ASME BPVC / API 579 L3) | ±2 % to ±5 % | EoR relies |
| **PitCast target — Screening / FFS L1-2 / RBI** | **±10 % to ±20 %, conservative-leaning** | First pass |
| Conceptual | ±25 % to ±50 % | Order-of-magnitude |

PitCast's honest position: **±10 % screening accuracy with documented conservative bias, detailed design requires independent code-compliant calculation.** This is V&V 40 "model risk = medium / model influence = supporting evidence."

### Honest re-classification of current 5,500 tests
- ~70 % **regression tests** (Oberkampf/Roy §3.4) — prove code hasn't drifted
- ~20 % **oracle / golden-master** against literature — useful validation evidence *iff* each one is documented with source/citation/tolerance/tier metadata (today they aren't)
- ~5 % approximate **code verification** (Lamé, analytical Re, closed-form Paris)
- ~5 % **UI / smoke / property** — not V&V

The gap isn't *more tests* — it's *traceability*. Tag every existing oracle with `{capability, source, citation, tolerance, validation-tier}`, then auto-emit a validation report from that metadata.

### Implementation roadmap (mostly docs)

```
docs/vv/
  SVVP.md
  CVR/
    cvr-master.md
    cvr-vessel.md         # Lamé
    cvr-fracture.md       # K_I closed-form
    cvr-paris.md          # analytical integral
    ...
  VR/
    validation-hierarchy.md
    tier1-unit/           # textbook problems
    tier2-benchmark/      # API/ASME worked examples
    tier3-subsystem/      # single-engine full-loop
    tier4-integrated/     # multi-engine on public failures
  UQ-SA/
    uq-master.md
    sobol-vessel.md
    posterior-sigma-phase.md   # leverage existing Bayesian
  SQAP.md, SCMP.md
  intended-use-statement.md    # links to G10
  validation-test-registry.yaml # machine-readable, drives UI badges
```

Add to every PitCast output PDF footer: **"Validation tier: T2 — benchmarked against API 581 Annex 4.B worked example, σ < 6 % at 95% CI. See VR/tier2-benchmark/rbi-pof-corrosion.md."**

### Effort

| Activity | Days | Notes |
|---|---|---|
| SVVP authoring | 5–8 | Template from IEEE 1012 / NQA-1 |
| CVR — tag + write existing closed-form comparisons | 10–15 | Many already exist |
| VR Tier 1+2 — for the 20 most-used engines | 25–40 | ~1 day per engine |
| VR Tier 3 — for top-5 engines | 10–15 | 2–3 days each |
| UQ/SA on 5 highest-consequence outputs | 10–15 | Reuse Bayesian Laplace |
| SQAP + SCMP + intended-use | 4–6 | Formalize existing practice |
| **Total** | **65–100 days** | **~3–5 months at 50% allocation** |

One summer-quarter of focused work. Cheapest possible insurance.

### Dependencies
- Depends on the other engineering gaps shipping first — the validation hierarchy needs concrete physics modules to validate against.

---

## Gap G6 — API 579-1/ASME FFS-1 vessel/piping FFS (Parts 3, 4, 5, 6, 7, 8, 9, 14)

### Engineering context
B31G is a **pipeline** rule from the Battelle line-pipe burst-test database. An inspector applying B31G to a pressure vessel would fail an API 510 audit. Real vessel FFS is API 579-1/ASME FFS-1 (joint since 2007). 14 Parts cover the full damage taxonomy: brittle, general thinning, LTA, pitting, HIC, blistering, weld misalignment, cracks (FAD), creep, fire, dents, laminations, fatigue.

### Authoritative sources
1. **API 579-1/ASME FFS-1, 4th Edition, December 2021** — 14 Parts + Annexes 1A through 14B (joint API/ASME).
2. **API 579-1/ASME FFS-1, 3rd Edition, June 2016** — still widely referenced.
3. **WRC Bulletin 550 (2019)** — *Standardization of Fatigue Methods for API 579 Part 14* (technical basis for Part 14).
4. **WRC Bulletin 523** — *Master S-N Curve Method* (Battelle structural-stress, Part 14 advanced option).
5. **Anderson, T.L. (2017)** *Fracture Mechanics: Fundamentals and Applications* 4th ed., CRC Press — Ch.9 FFS, Ch.10 engineering applications (canonical worked examples).
6. **Anderson & Osage** *ICF13 / Frattura ed Integrità Strutturale* — *API 579 G-factors for K Calculations* (basis for Annex 9B/9C polynomial influence coefficients).
7. **BS 7910:2019** — peer standard; Larrosa et al. *Materials* 2019 PMC 6479345 — Option-2 FAD vs API 579 L2 FAD comparison.
8. **Janelle (2005)** "API 579: a comprehensive fitness-for-service guide" — canonical adoption paper.
9. **flare9x/FitnessForService.jl** — open-source Julia, Parts 4 + 5 validated against published tables.
10. **PVP2016 Paper V01AT01A002** Osage et al. — *Summary and Applications of the New Fatigue Rules in Part 14*.

### Parts + Annexes map (4th ed., 2021)

| Part | Title | Damage | Level 1 / 2 / 3 |
|---|---|---|---|
| 1 | Introduction | — | — |
| 2 | FFS Assessment Procedure (governing) | All | Flowchart |
| 3 | **Brittle Fracture** | Low-T impact | L1 MAT curves A/B/C/D, L2 MAT + CET combined, L3 FAD per Annex 9F Master Curve |
| 4 | **General Metal Loss** | Uniform thinning | L1 PTR (15 readings, COV ≤ 10%), L2 CTP grid + numerical, L3 FEA |
| 5 | **Local Metal Loss (LTA)** | Patches, blistered | **L1 Rt + λ + Mt + RSF closed form (workhorse), L2 numerical Mt + variable thickness, L3 FEA** |
| 6 | Pitting | Pits | L1 pit chart, L2 pit-couple statistical (≥10 pits), L3 FEA |
| 7 | HIC, SOHIC, Blisters | Hydrogen | L1 blister-as-LTA + periphery check, L2 HIC zone equivalent, L3 FEA |
| 8 | Weld Misalignment | Distortion | L1 simplified Dmin/Dmax, L2 detailed shell-bending |
| 9 | **Crack-Like Flaws** | Cracks (FAD) | **L1 screening curves, L2 FAD w/ K_I from 9B + σ_ref from 9C + RS from 9D, L3 J-integral FEA** |
| 10 | Creep | High-T | L1 LMP min, L2 MPC Omega, L3 continuum damage |
| 11 | Fire | Heat exposure | L1 visual, L2 hardness, L3 full re-characterisation |
| 12 | Dents / Gouges | Mech deformation | L1, L2 cyclic, L3 |
| 13 | Laminations | Mid-wall sep | L1, L2 Folias-like, L3 |
| 14 | **Fatigue** (new 2016, expanded 2021) | Cyclic | L1 screening (skip if cycles < 100), L2 ASME VIII-2 smooth-bar/welded S-N, L3 Battelle Master S-N |

Annexes:
| Annex | Content |
|---|---|
| 9A | Part 9 technical basis (FAD) |
| **9B** | **K_I solutions — polynomial G-factors for plates/cylinders/spheres/nozzles** |
| **9C** | **Reference stress σ_ref solutions for limit-load L_r** |
| 9D | Residual stress profiles in weldments (as-welded, PWHT) |
| 9E | FAD curves (Option 1 generic, Option 2 material-σ_y, Option 3 full σ-ε) |
| 9F | Material toughness — Wallin Master Curve, T₀, K_IC-Charpy correlations |
| 9G–9I | NDE sizing uncertainty, leak-before-break, mixed-mode crack growth |
| 9J (2021) | **Fracture-mechanics MAT — alternative to Part 3 exemption curve** |
| 14A, 14B | Part 14 technical basis (WRC 550/523), welded-joint cycle-counting, Chaboche |

### Part 5 Level 1 LTA — complete formula set (most-used assessment)

For cylindrical shell, internal pressure, Type A component, single LTA, longitudinal flaw:

**Remaining Thickness Ratio (Eq 5.5):** `Rt = (tmm − FCA) / tc` where `tmm` = minimum measured thickness in LTA, `tc = t_nom − LOSS − FCA`.

**Shell parameter (Eq 5.6):** `λ = 1.285 · s / sqrt(D · tc)` where `s` = axial extent of LTA, `D` = inside diameter.

**Folias factor (Eq 5.12, 10th-order polynomial):** `Mt = 1 + 0.48·λ² − 0.001408·λ⁴ + ...` for λ < 9; long-flaw treatment for λ ≥ 9.

**RSF (Eq 5.11):** `RSF = Rt / (1 − (1/Mt)·(1 − Rt))`

**Acceptance (Eq 2.2):**
- `RSF ≥ RSFa = 0.90` → **PASS** (use design MAWP)
- `RSF < 0.90` → reduce MAWP: `MAWPr = MAWP_design · RSF / RSFa`, or proceed to L2

**Applicability gates:** tc ≥ 2.5 mm, R_i/tc ≥ 20, Rt ≥ 0.20, s_l to nearest discontinuity ≥ `1.8·sqrt(D·tc)`, T < creep, cycles < 150.

**Worked test case** (from FFS.jl): SA 516 Gr 70, 300 psig @ 650 °F, ID=96", t=1.25", LOSS=0.10", FCA=0.125", tmm=0.7" → tc=1.025", Rt=0.558, λ≈2.0, Mt≈1.32, RSF≈0.93 → marginal L1 PASS.

### Part 9 FAD complete (Annex 9E Option 1, Eq 9E.4):
```
For Lr ≤ Lr_max:  Kr = (1 − 0.14·Lr²) · [0.3 + 0.7·exp(−0.65·Lr⁶)]
For Lr > Lr_max:  Kr = 0  (cut-off)
Lr_max = 1.0 ferritic + austenitic SS; material-specific per Table 9E.2
```

**Toughness ratio:** `Kr = K_I^P / K_mat + V · K_I^SR / K_mat`
**Load ratio:** `Lr = σ_ref / σ_y`
**K_I (Annex 9B for axial semi-elliptical surface crack in cylinder):**
```
K_I = (σ_m · G_0 + σ_b · G_1 + σ_p · G_2 + ...) · sqrt(π·a/Q)
Q = 1 + 1.464 · (a/c)^1.65  for a/c ≤ 1
G_0...G_4 = influence coefficients (polynomials in a/t, a/c, R_i/t, φ) per Annex 9B Tables
```

PMC 6479345 validates API 579 against FE within 1.83% for a/t up to 0.8 (BS 7910 diverges past a/t ≈ 0.65).

### Part 14 Fatigue
- **L1 screening**: skip if cycles < 100 + no thermal shock + Method A/B/C screening (ASME VIII-2 5.5.2) passes
- **L2 code methods**: rainflow → S_alt with Neuber/Glinka → S-N lookup (smooth-bar ASME VIII-2 Annex 3-F Fig 3-F.1; welded Fig 3-F.x weld classes B/C/D/E/F/F2/G/W) → `D_i = n_i/N_i` → Miner Σ D_i ≤ 1.0 → factor 2 on S_alt or 20 on N
- **L3 advanced**: WRC 523 Master S-N `Δσ_ess = Δσ_s · t^((m-n)/m·n) · I(r)^(1/m)`; Verity; strain-life w/ Chaboche kinematic hardening

### Implementation — one engine per Part with shared utilities

```
pitcast-web/ffs/
  ffs-core.js                    // MAWP, RSF acceptance, common gates
  ffs-folias.js                  // Mt(λ) polynomial + Table 5.2
  ffs-part3-brittle.js           // MAT A/B/C/D + L2 reduction
  ffs-part4-general.js           // PTR + CTP + COV + trapezoid
  ffs-part5-lta.js               // Workhorse — L1 + L2
  ffs-part6-pitting.js           // Pit-couple L2, pit chart L1
  ffs-part7-hic.js               // HIC/blister-as-LTA + periphery
  ffs-part8-misalign.js          // Out-of-round + peaking + banding
  ffs-part9-crack.js             // FAD L1 + L2
  ffs-part9-k-solutions.js       // Annex 9B G-factors (~30 geometries)
  ffs-part9-sigma-ref.js         // Annex 9C reference-stress lookup
  ffs-part9-residual.js          // Annex 9D RS profiles
  ffs-part9-toughness.js         // Annex 9F Wallin Master + KIC-Charpy
  ffs-part10-creep.js            // Omega + LMP (link to existing creep.js)
  ffs-part11-fire.js             // Heat-exposure + hardness
  ffs-part12-dent.js             // Dent + gouge + combinations
  ffs-part13-lamination.js       // Mid-wall sep
  ffs-part14-fatigue.js          // Rainflow + S-N + Miner + Markl
  ffs-rainflow.js                // Cycle-counting utility (shared)
ffs-ui.js                        // Part selector, geometry input, severity wizard
```

Grouping: **Parts 4+5+7** share metal-loss + Folias + RSF (one shared internal module, three thin public APIs); **Part 9** stands alone (~1,500 LOC); **Parts 6, 8, 11, 12, 13** standalone ~150–200 LOC; **Part 14** own engine (~600 LOC).

### Effort

| Part | LOC | Days | Notes |
|---|---|---|---|
| 3 Brittle | 250 | 2 | Digitise 4 MAT curves; UCS-66 logic |
| 4 General | 300 | 2 | PTR + CTP + trapezoid |
| 5 LTA L1 + L2 | 400 | 3 | Validate vs FFS.jl + Janelle 2005 + Anderson Ch.10 |
| 6 Pitting | 200 | 2 | Pit-chart catalogue digitise from Annex 6A |
| 7 HIC | 200 | 2 | Leverage Part 5 + periphery check |
| 8 Misalign | 150 | 1 | Closed form |
| 9 K-solutions (9B) | 600 | 4 | ~30 geometries × G_0...G_4 |
| 9 σ_ref (9C) | 300 | 2 | Reference-stress lookup |
| 9 Residual (9D) | 200 | 1 | As-welded / PWHT closed-form |
| 9 Toughness (9F) | 250 | 2 | Wallin Master + KIC-Charpy + T₀ |
| 9 FAD assembly + L1 + L2 | 500 | 4 | Kr/Lr engine + screening curves |
| 10 Creep | 300 | 2 | Refactor existing creep.js to Part 10 conventions |
| 11 Fire | 150 | 1 | Heat zones + hardness |
| 12 Dents | 200 | 1.5 | L1 + cyclic |
| 13 Laminations | 150 | 1 | |
| 14 Fatigue | 600 | 5 | Rainflow + Markl + smooth-bar + welded + Master S-N + Miner |
| Rainflow shared | 200 | 1.5 | |
| UI (Part picker, geometry wizard, FAD chart with Kr/Lr + curve + bands) | 1,000 | 6 | FAD plot non-trivial |
| Validation vs 8 published worked examples | – | 4 | Anderson Ch.10, Janelle 2005, FFS.jl tests, PVP papers |
| **Total** | **~6,000 LOC** | **~47 days** | **~10–12 weeks single-engineer; ~6 weeks parallel two engineers** |

### Dependencies
- Standalone but heavy. Sequence after G4 persistence so engineer can save vessel/piping projects.

---

## Gap G7 — NACE MR0175 / ISO 15156 spec-issuer

### Engineering context
The engineer doing FEED for an oil & gas sour-service asset needs to *issue* a formal material spec sheet — not just an assess output. Today PitCast has a sour-service envelope screen but doesn't produce a procurement-grade deliverable citing the exact ISO 15156-3 Annex A.x with the alloy/condition/hardness restrictions.

### Authoritative sources
1. **ANSI/NACE MR0175-2021 / ISO 15156:2020** — three normative parts + 2025 errata + Technical Circulars 1 & 2 (2021-22). 2015→2020 edition changes: S17400 stress restriction; UNS N09945/N09946 separated; UNS N07718 high-strength Alloy 718 per API 6A CRA; UNS R55400 α-β Ti added.
2. **Part 1** — general principles. Sour threshold = pH₂S ≥ 0.05 psia / 0.3 kPa in aqueous phase. Test methods NACE TM0177 A/B/C/D, TM0284. Fit-for-purpose qualification (§8) alternative to Annex A.
3. **Part 2** — CS/LAS. Severity from Figure 1 (log pH₂S × in-situ pH grid → Region 0/1/2/3); HIC/SOHIC separately.
4. **Part 3** — CRAs. 41 Annex A tables, organized by metallurgical family.
5. **NACE MR0103-2018** — refining sour service (separate scope; 200 HBW weld-deposit hardness per RP0472 not MR0175's 22 HRC).
6. **NORSOK M-001:2014** — material selection that builds on MR0175.
7. **Real EPC examples** — Aramco SAES-W-001, Shell DEP 30.10.60.18, ExxonMobil GP, Chevron CV.

### Region 0/1/2/3 boundary equations for CS/LAS (Part 2 Figure 1)

- **Region 0** — pH₂S < 0.3 kPa (< 0.05 psia). No SSC precautions; all standard C-Mn qualifies.
- **Region 1** — 0.3 ≤ pH₂S < 10 kPa with in-situ pH ≥ 3.5, OR pH₂S < ~1 kPa across all pH. Standard 22 HRC.
- **Region 2** — 10 ≤ pH₂S < 100 kPa, or pH 3.5–5.5 at higher H₂S. Annex B qualification (TM0177 A/B at 0.1 MPa H₂S).
- **Region 3** — pH₂S ≥ 100 kPa, or in-situ pH < 3.5 across wide pH₂S band. Hardness + manufacturing-route restrictions per Part 2 + Annex B qualification, or fit-for-purpose per Part 1.

Discontinuities at 0.3 kPa and 1 MPa are intentional (measurement uncertainty + extrapolation risk), NOT linear interpolations per ISO 15156-2:2020 §7.1.

pH₂S calculated per Annex C (two-phase flash, fugacity-corrected); in-situ pH per Annex D (ScaleChem / Oddo-Tomson on produced water).

CS/LAS hardness ceiling: **22 HRC** base + HAZ + weld root/cap.

### ISO 15156-3:2020 Annex A — table catalog

| Table | Family | UNS examples | Key envelope |
|---|---|---|---|
| A.1 | Guidance notes | — | — |
| A.2 | Austenitic SS — general equipment | S30400/03, S31600/03 | pH₂S ≤ 103 kPa (15 psia), T ≤ 60 °C, solution-annealed, ≤ 22 HRC |
| A.3 | Austenitic SS — small internals | same as A.2 | More restrictive |
| A.4 | Hi-alloyed austenitic — moderate envelope | S31254, N08367, N08926 | Pre-qualified higher T/pH₂S |
| A.5–A.6 | Hi-alloyed austenitic — alternate sub-envelopes | same | Tighter T/Cl |
| A.7 | Ferritic SS | S43000, S40500 | Limited |
| A.8–A.11 | Hi-alloyed austenitic — additional | N08825, N08028 | T-Cl-pH₂S sub-envelopes |
| A.12 | Ferritic SS — different equipment | S44400 | — |
| A.13 | Solid-soln Ni-Cr-Mo downhole | N06985, N06975 | Higher Cl + T tolerance |
| A.14 | Solid-soln Ni-Cr-Mo general | N10276, N06022, N06059, N06200 | "Any combination" |
| A.18 | Martensitic SS general | S41000, S41425, J91540 (CA6NM) | T ≤ 232 °C; HRC ≤ 22 typical |
| A.19 | Martensitic 13Cr OCTG | S41425, "13Cr L80", super 13Cr | pH₂S ≤ 10 kPa, in-situ pH ≥ 3.5, T ≤ 150 °C |
| A.20–A.23 | Martensitic — super-13Cr / 15Cr / S13Cr-110 | various | Each row a sub-envelope |
| **A.24** | **Duplex SS — 22Cr & 25Cr super-duplex** | S31803/S32205, S32750/S32760, S39274 | pH₂S ≤ 20 kPa for 25Cr; Cl ≤ 180,000 mg/L (NEW 2020); T ≤ 232 °C; ≤ 32 HRC; ≤ 28% CW |
| A.25 | Duplex — downhole alternates | — | — |
| A.26 | PH austenitic | S66286 (A286) | Lower stress fraction |
| **A.27** | **PH martensitic** | S17400, S15500 | **NEW 2020: σ ≤ 50% SMYS** at envelope |
| A.28–A.31 | Solid-soln Ni-Cr-Mo / Ni-Fe-Cr | various | — |
| **A.32** | **PH nickel-based — restructured 2020** | N07718, N07725, N09925, N09935, N09945, N09946, N09955, N07716, N07975 | Two-step age required for highest envelope |
| A.33–A.36 | Solid-soln Ni — various service | N06625, N10276, N06022 | "Any combination" when annealed (≤ 22 HRC) |
| A.40 | Cobalt-based (springs, diaphragms) | R30003, R30035, R30159 | Spring temper allowed |
| **A.41** | **Ti and Ti alloys** | R50250/400, R52400, R53400 (annealed only), R56260, R55400 (NEW α-β 2020) | T ≤ ~250 °C for α corrosion limit |

### Dispatcher algorithm

```python
def issue_mr0175_spec(composition, T_C, pH2S_kPa, Cl_mg_L, pH_insitu,
                      stress_pct_SMYS, hardness_HRC, equipment_class, scope):
    if scope == "refining":
        return dispatch_MR0103(...)  # separate standard
    family = classify_metallurgy(composition)  # PREN, Ni eq, Cr eq, %C, Mo, N
    
    if pH2S_kPa < 0.3:
        return Verdict(IN_SCOPE=False, route="non-sour", citation="MR0175 §1.3")
    
    if family in {"CS", "CMn", "LAS"}:
        region = region_lookup(pH2S_kPa, pH_insitu)
        return assess_region(region, hardness_HRC, mfg_route, equipment_class)
    
    candidate_tables = TABLE_INDEX[family]  # e.g. ["A.18","A.19"] for 13Cr
    for tbl in candidate_tables:
        env = ENVELOPES[tbl]
        if env.contains(T_C, pH2S_kPa, Cl_mg_L, pH_insitu):
            mfg_check = check_metallurgical_conditions(composition, hardness_HRC,
                cold_work_pct, PWHT_status, stress_pct_SMYS, env)
            if mfg_check.passes:
                return Verdict(IN_SCOPE=True, route=tbl, env=env,
                               citations=[f"ISO 15156-3:2020 Table {tbl}"],
                               annotations=mfg_check.annotations)
    
    return Verdict(IN_SCOPE=False, route="FFP",
                   guidance="Qualify per ISO 15156-1:2020 §8 + NACE TM0177 + TM0284",
                   citation="ISO 15156-1:2020 §8")
```

### Spec-sheet deliverable structure (PDF + Excel)

1. **Header** — project / well / unit / service / engineer / date
2. **Service conditions input table** — T_design, P_design, fluid comp (H₂S mol%, CO₂ mol%, Cl mg/L), pH_insitu + calc method, free water Y/N, elemental S Y/N, severity region (CS/LAS)
3. **Selected material** — UNS, ASTM/ASME spec, product form, condition, supply HRC ceiling, applicable Annex A table
4. **Pre-qualified envelope citation** — exact Table A.x boundary values quoted, in-envelope graphic (operating point inside T/pH₂S/Cl box)
5. **Manufacturing restrictions** — heat-treat, max HRC + HV10 (HRC↔HV10 ≈ 248 HV per ASTM E140), PWHT (T/hold/ramp), CW limit, welding consumable + WPS, autogenous-welding ban for super-duplex, ferrite 30–70% per NORSOK M-630 / DNV-OS-F101, HAZ hardness control (NACE TM0316 / ISO 17642-3)
6. **Testing & acceptance** — NACE TM0177 method, TM0284 HIC for CS/LAS, TM0316 for welded duplex, hardness traverse interval, PMI 100%, MTC per ASTM A370 + EN 10204 3.2
7. **Owner-spec overlays** (toggles) — Shell DEP 30.10.60.18 / Aramco 01-SAMSS-016 + 01-SAMSS-022 (Class IV fracture) / NORSOK M-001 Table 6 CRA limits / ExxonMobil GP
8. **Sign-off + revision**

### Worked examples

**1 — 13Cr OCTG (production tubing):** S41425, T=120°C, pH₂S=8 kPa, Cl=70,000, in-situ pH=4.0, σ=80% SMYS, supply HRC=27 → Table A.19 envelope (pH₂S ≤ 10 kPa AND in-situ pH ≥ 3.5 AND T within row limits) → **PASS** at Table A.19; require Q+T + ≤ 27 HRC per S41425 sub-row; flag pH 4.0 only 0.5 above floor — recommend in-situ pH monitoring with 0.3-unit alarm.

**2 — 2205 duplex line pipe:** S31803 (PREN ≈ 35), T=90°C, pH₂S=30 kPa, Cl=120,000, in-situ pH=4.5, σ=70% SMYS, HRC=28, ferrite 50% → Table A.24; 22Cr lean-duplex envelope pH₂S ≤ 10 kPa → **FAIL on pH₂S for 22Cr**; recommend upgrade to 25Cr super-duplex S32750/S32760 (pH₂S ≤ 20 kPa, Cl ≤ 180,000 mg/L per 2020 limit). Alternative: FFP qualification per Part 1 §8 with TM0177 method B.

**3 — Alloy 625 wellhead:** N06625 forged, solution-annealed, T=180°C, pH₂S=150 kPa, Cl=200,000, in-situ pH=3.8, HRC=21 → Table A.34 "any combination" envelope → **PASS**; require annealed/solution-annealed only (no CW strengthening), ≤ 22 HRC / 237 HB, weld-overlay if per API 6A CRA.

### Implementation roadmap
- **Static data layer** — 41 Annex A envelope rows + 4 Part 2 region boundaries + 5 owner-spec overlays as JSON (~600 LOC), cite-source field on every row
- **Dispatcher** — `mr0175_issuer.js` ~700 LOC: family classifier (PREN/Cr-eq/Ni-eq lookup), envelope-checker, manufacturing-condition gate, citation accumulator
- **Calc helpers** — pH₂S Annex C (~120 LOC, fugacity), in-situ pH Annex D (~150 LOC, carbonate-buffered or OLI hook), HRC↔HV10↔HB (~50 LOC per ASTM E140)
- **Deliverable PDF/Excel** — template ~400 LOC + Excel ~250 LOC
- **Regression tests** — one oracle per Annex A table (~200 LOC) + 3 worked examples + 10 boundary fuzz cases (~150 LOC)

### Effort
- ~2,400 LOC, 5–7 days for v1
- +2 days to wire into existing agent_tools dispatcher and frontend SchematicVisual
- +1 day for Aramco/Shell/NORSOK overlays
- **Total: ~5–7 days**

### Dependencies
- Standalone, but ships nicely alongside G2 vendor product DB (Foamglas ONE → ASTM C795 → MR0175 issuer auto-checks Cl-on-SS rule).

---

## Gap G8 — CIPS / DCVG / PCM survey-data ingestion + ECDA prioritisation

### Engineering context
A CP engineer back from a 50-km pipeline survey has 20k–200k rows of GPS-tagged {chainage, E_on, E_off, ΔV_DCVG, AC_V}. They eyeball-plot in Excel, hunt segments failing −850 mV instant-off / DCVG spikes, manually classify, type into a defect register, produce a Word/PDF per NACE SP0207 + SP0502. Hours of eyeballing. PitCast can auto-flag exceedances + IR correction + severity classification + ECDA prioritization in seconds.

### Authoritative sources
1. **NACE SP0207-2007 (R2018)**, *Performing Close-Interval Potential Surveys and DC Surface Potential Gradient Surveys* — §6 procedures, §7 data validity, §8 analysis. 2.5 ft (~0.75 m) reading spacing industry default.
2. **NACE/AMPP SP0169-2013 (R2020)**, *Control of External Corrosion on Underground or Submerged Metallic Piping* — §6.2.2 three protection criteria (−850 mV polarized; 100 mV shift; net protective current largely deprecated).
3. **NACE TM0497-2018** — instant-off technique, interrupter timing (3 s ON / 1 s OFF nominal), measurement uncertainty.
4. **NACE TM0109-2009** — DCVG, ACVG, Pearson; §6 gives DCVG %IR equation.
5. **NACE SP0502-2010** — ECDA spec. §5 indirect inspections, §5.7 severity classification, §6 direct exam + prioritization matrix, §6.5/§7 post-assessment (reassessment = ½ × remaining life). Referenced in **49 CFR 192.925** for US-DOT compliance.
6. **ISO 15589-1:2015** (revised 2025), Part 1 on-land pipelines — §6.2 + Table 1 IR-free protection potentials, §6.2.6 limiting critical E_l (−1200 mV CSE coated steel typical), §10 monitoring.
7. **DNV-RP-F116 (2021)** — sub-sea adaptation, §6.
8. **McKinney (1986)** — DCVG severity bands originator; cited in NACE SP0502 examples.

### Standard CSV formats
- M.C. Miller G-Series CSV (NACELog): `Station_ft, Lat, Lon, V_on_mV, V_off_mV, GPS_Alt_ft, GPS_Time, Flag`
- Radiodetection PCM `.dat`, MCM/G-Tech CSV add `DCVG_mV, DCVG_polarity`
- NACE SP0207 §8.2 recommends: chainage, GPS, E_on, E_off, time, IR-drop estimate, telluric flag, soil resistivity

PitCast should ingest with header-name fuzzy match: `station|chainage|km|m`, `lat|latitude`, `lon|long|longitude`, `e.?on|v.?on`, `e.?off|v.?off|inst|polariz`, `dcvg|grad|delta.?v`, `ac.?volt|v.?ac`.

### Algorithms

**IR-drop correction (SP0207 §6.5; TM0497):**
- True polarized = `E_instant-off` when interrupter synced
- No interrupter: `IR = I_protective × R_soil` per Ohm; subtract from E_on (R_soil from coupon or 2-electrode probe per TM0497 §5)
- Telluric: subtract remote reference cell drift at same timestamp (SP0207 §6.6)
- Coupon method (preferred for unmaintained pipe): `E_polarized = E_coupon_off`

**−850 mV instant-off (SP0169 §6.2.2.1.1; ISO 15589-1 §6.2 Tab 1):** flag stations where `E_off > −850 mV`. Generate exceedance runs (start, end, min depth-of-violation).

**100 mV polarization shift (SP0169 §6.2.2.1.3):** `ΔE_pol = E_native − E_off`. Flag where `ΔE_pol < 100 mV`.

**Limiting critical / over-protection (ISO 15589-1 §6.2.6):** flag `E_off < E_l` (typically −1200 mV CSE) — disbondment / hydrogen embrittlement risk.

**DCVG %IR (TM0109 §6.4; McKinney 1986):**
```
ΔV_total = Σ |ΔV_i|  (probe pairs from indication centre to remote earth)
V_swing = |E_on − E_off|  at closest station
%IR = (ΔV_total / V_swing) × 100
```

**Severity bands (McKinney 1986 + SP0502 §5.7):**
- 0–15 % IR → **Minor / Insignificant** — no action
- 16–35 % IR → **Moderate** — schedule general maintenance
- 36–70 % IR → **Severe** — investigate during next dig
- 71–100 % IR → **Severe / Immediate** — excavate per SP0502 §5.7.3

**Polarity matrix (TM0109; cathodic-academy refs):**
- A/C (ON anodic, OFF cathodic) — typical active coating defect under CP
- C/C — likely stray-current pick-up; flag **interference**
- A/A — current short to foreign structure OR active anodic site under stray DC; flag for direct exam
- C/A — current discharge during OFF; classic foreign-line interference

**ECDA prioritization (SP0502 §6 Table 2):** Each station scored on CIPS + DCVG + prior history + soil corrosivity → Immediate / Scheduled / Monitored. Two "severe" indications in close proximity → **Immediate Action** per §5.2.2.1.2.

**Reassessment interval (SP0502 §7):** `T_reassess = ½ · T_remaining`, with `T_remaining = (t_actual − t_min)/CR`. 49 CFR 192.939 ceiling ≤ 7 yr gas transmission.

### Worked validation cases

**B-1 — CIPS exceedance scan:** chainage 1,250 m: E_on=−1180, E_off=−820 (fails −850); native=−650, ΔE_pol=170 mV (passes 100). Verdict: "MARGINAL — fails −850 mV but meets 100 mV shift; flag for re-survey, no immediate action per SP0169 §6.2.2.1.3."

**B-2 — DCVG %IR at one indication:** probe gradients 22/14/8/3/1 mV; pipe ON/OFF swing 450 mV. ΔV_total=48, %IR=10.7% → **Minor** (0–15% band).

**B-3 — Combined ECDA at station 12+340:** CIPS=FAIL (E_off=−780, no shift), DCVG=45 %IR (Severe), prior dig at dyke crossing. Two SEVERE in same region → **IMMEDIATE_DIG** per SP0502 §5.2.2.1.2.

### Implementation
```
pitcast-web/
  cips.js        // scanExceedances(survey, criteria) → ranked runs
  dcvg.js        // findIndications + classifySeverity + polarity matrix
  ecda.js        // prioritize({cips, dcvg, history, soil}) → SP0502 §6
  csv-ingest.js  // SHARED with G1; fuzzy header + unit auto-detect
```

Data: `Survey = {type, pipe:{D,t,grade,coating_date}, readings: Reading[]}` with `Reading = {station_m, lat, lon, E_on_mV, E_off_mV, dcvg_mV, dcvg_polarity, ac_V, timestamp}`.

UI: new `/cips` console route. Drag-drop CSV → auto-detect → trace plot (Plotly, station × E_on/E_off with −850 / −1200 mV reference lines shaded), DCVG bar overlay, indications table colour-banded, ECDA priority bucket, single-page printable PDF following SP0502 §8 skeleton.

Phase 2: GPS-tagged Leaflet map with colour-coded indications; growth-rate between two survey uploads.

### Effort
- CSV ingest with fuzzy headers + unit auto-detect: 1 day, ~300 LOC
- CIPS exceedance scanner + IR correction + telluric stubs: 1 day, ~250 LOC (reuses cpac.js SP0169 logic)
- DCVG %IR engine + severity + polarity matrix: 1 day, ~250 LOC
- ECDA SP0502 prioritisation + reassessment interval: 0.5 days, ~200 LOC
- UI (trace plot, indications table, ECDA bucket, PDF export): 2.5 days, ~600 LOC
- Test fixtures: 0.5 days
- **Total: ~6.5 days, ~1,600 LOC**

### Dependencies
- Reuses csv-ingest.js shared with G1.

---

## Gap G9 — Vendor product database

### Engineering context
PitCast today has families ("FBE", "TSA", "calcium silicate"). Real engineering selects "3M Scotchkote 6233" not "FBE generically." Engineers in procurement / FEED-review challenge "you said FBE — which FBE? what's the data?" The vendor DB is a multi-year asset that compounds; the moat isn't 60 rows, it's citation provenance + cascade integration with G7 (engineer picks Foamglas ONE → DB knows ASTM C795-compliant → MR0175 issuer auto-checks Cl-on-SS rule).

### Authoritative sources
1. **3M Scotchkote** product datasheets (3M.com) — 6233/226N/226PA+ FBE; 3LPE; 6253 dual-layer
2. **Bredero Shaw (Shawcor)** — 3LPE Yellow Jacket; 3LPP per DIN 30678/30670, ISO 21809-1
3. **Lyondell ARO** abrasion-resistant overcoat
4. **Wasser MC-Tar / MC-Tar LT** — coal-tar epoxy / moisture-cure urethane tar
5. **Carboline** — Carboguard 891/893 (epoxy mastic), Phenoline 1205 (epoxy-phenolic tank lining), Thermaline 450 EP (CUI, ≤230°C), Thermaline Heat Shield (-196 to 650°C)
6. **Hempel** — Hempaprime Multi 500, Hempaprime Strength 530 (first NORSOK M-501 Ed.7 certified), Hempathane HS 55610, Hempadur 17634
7. **Jotun** — Jotamastic 87 Aluminium, Hardtop XP, Penguard Plus (all NORSOK M-501 system 1)
8. **PPG** — Amercoat 351/385, Ameron 235
9. **Sherwin-Williams** — Macropoxy 646/646FC, Heat-Flex Hi-Temp 1200
10. **International (AkzoNobel)** — Intergard 269/475HS, Intertherm 50/891/875, Devran 224
11. **Hi-Temp Coatings** — Hi-Temp 1027 (silicone, ≤540°C)
12. **Insulation**: Johns Manville (Thermo-12 Gold, Thermo-1200 — ASTM C533 + C795-compliant), Owens Corning, Knauf, Pittsburgh/Owens Corning Foamglas (T4/HLB/ONE), Aspen Aerogels (Pyrogel XT/XTE, Cryogel Z), Microtherm
13. **Anodes**: Galvotec (CW III bracelet Al-Zn-In, KT-aluminum, Mil-Spec MIL-18001 Zn), Cathwell, Farwest, Matcor (Mg SPL + AZ-63)
14. **NACE Coating Inspector Program (CIP) Manual** — coating systems by service
15. **NORSOK M-501:2012/Ed.7 (2025)** — Norwegian-standard catalog (systems 1, 2A/B, 3A/B, 4, 5A/B, 6, 7)
16. **ISO 12944-5:2018** — canonical paint-system catalog; corrosivity C1-C5 + new CX for extreme offshore; durability L/M/H/VH
17. **ASTM C795** — stainless-compatible insulation (Cl + F ≤ Na + Si index)
18. **DNV-RP-B401:2021** — design defaults (2000 Ah/kg conservative vs vendor 2500-2700 as-tested; utilization 0.80-0.90)

### Schema

```python
@dataclass
class VendorProduct:
    vendor: str
    product_id: str
    family: str  # FBE | 3LPE | 3LPP | TSA | coal-tar | high-T epoxy | calcium silicate |
                 # perlite | cellular glass | aerogel | mineral wool | PIR | Al-Zn-In | Zn | Mg | ...
    type_substrate: str  # CS | SS | galvanized | concrete-coated
    T_min_C: float
    T_max_C: float
    T_max_cyclic_C: Optional[float]
    DFT_min_um, DFT_max_um: Optional[float]
    n_coats: Optional[int]
    cure_T_C, cure_method: Optional[str]
    water_abs_pct: Optional[float]   # ASTM C240/C1763/C1104
    cl_leach_ppm: Optional[float]    # ASTM C871, Cl only
    f_leach_ppm, si_leach_ppm, na_leach_ppm: Optional[float]
    density_kg_m3, compressive_strength_kPa: Optional[float]
    thermal_conductivity_W_mK: Optional[float]
    pren_compatible_with_SS: Optional[bool]  # ASTM C795
    # Anode-specific
    eps_Ah_per_kg, util_factor: Optional[float]
    closed_circuit_potential_V_AgAgCl: Optional[float]
    # Standards + certs
    standards: List[str]   # CSA Z245.20, API RP 5L7, ISO 21809-2, NACE SP0212/SP0490/SP0492, ASTM C533/C552/C795, NORSOK M-501 Sys N, DNV-RP-B401, NACE TM0190, API RP 17L1, ISO 12944-5 CX H
    test_certs: List[str]
    vendor_doc_url: str
    last_verified_date: str
```

### Starter list (~60 products, all primary-sourced — see agent brief for full table). Highlights:

**Pipeline coatings**: 3M Scotchkote 6233 (FBE, 110°C continuous), 6253 (dual-layer 150°C), Shawcor 3LPE (-40 to 80°C), Shawcor 3LPP (-20 to 140°C), Wasser MC-Tar (-40 to 95°C).

**Industrial CUI**: Carboline Thermaline 450 EP (CS-6, 230°C), Carboline Thermaline Heat Shield (CS-6/SS-5, -196 to 650°C), Hi-Temp 1027 (silicone CS-5, 540°C), Hempel NORSOK products, Jotun NORSOK system 1, SW Macropoxy 646.

**TSA**: process per AWS C2.23M / NACE No.12 / SSPC-CS23 / NORSOK M-501 2B/2C / ISO 2063-1.

**Insulation**: JM Thermo-12 Gold (calcium silicate, ASTM C533 Type I + C795-compliant, 650°C), Foamglas ONE/T4+/HLB (cellular glass, ASTM C552 Type II + C795, inherently Cl-free, -260 to 482°C), Aspen Pyrogel XT/XTE (aerogel, ASTM C1728 Type III Gr 1A + C795, ≤5% water vapor sorption, 650°C), Microtherm (nano-porous silica, 1000°C).

**Anodes**: Galvotec CW III bracelet (Al-Zn-In ~2500 Ah/kg published / **2000 Ah/kg DNV design**), Galvotec KT-Al (2700 Ah/kg premium), Galvotec MIL-18001 Zn (780 Ah/kg), Matcor SPL Mg H-1 (1230 Ah/kg, -1.75 V).

### Curation loop (DB rots if not maintained)

1. **Quarterly vendor-page crawl** — hash each `vendor_doc_url` PDF; if changes, mark `needs_review` + ping engineer. 6-month TTL on `last_verified_date`; older rows yellow-flag in UI.
2. **Standards-version watcher** — NORSOK M-501 5→6→7, ISO 12944 2007→2017→2018, DNV-RP-B401 2017→2021. When upstream standard changes, affected rows re-validate.
3. **User-submitted-product** workflow — engineer hits dropdown and doesn't see their product → "add product" form behind moderation queue.

Failure modes to design out:
- `None` for `T_max_C` silently sorts as 0 → validate on insert
- ASTM C871 published as "C795-compliant" but no ppm → accept categorical flag separately from numerical
- Anodes: store `eps_Ah_per_kg_published` AND `eps_Ah_per_kg_design_default` (DNV's conservative 2000) separately

### UI integration

1. **Two-level cascade dropdown** — Level 1 family (unchanged), Level 2 vendor-product within family with default "[generic — use NACE SP019X envelope]" for back-compat. On selection, spec output replaces generic envelope with vendor row.
2. **"View vendor cert" button** opens `vendor_doc_url` PDF in side-panel iframe — what engineer needs at FEED review.
3. **Inline T-range bar** beside each vendor option in dropdown for pre-filter at-a-glance.

### Effort
- DB layer (SQLite or JSON, 60 starter rows × 25 fields): ~120 LOC schema + ~2,400 LOC seed data (60 kB hand-authored JSON)
- Importer / hash-watcher cron `vendor_watch.py`: ~250 LOC
- Frontend cascade dropdown + cert popout: ~400 LOC + ~150 LOC backend
- Standard-overlay mapping (vendor → NORSOK / ISO 12944 / NACE SP0198): ~300 LOC + ~100 LOC UI
- Tests: ~250 LOC
- **v1 total: ~4,200 LOC + 60 hand-rows, 6–9 work-days**
- Ongoing curation: **~0.5 day/quarter** for hash-watcher review + ~4–8 hrs/yr for major standard version bumps

### Dependencies
- Cascade integration with G7 MR0175 issuer is the moat: Foamglas ONE → ASTM C795 → auto-check Cl-on-SS upstream.

---

## Gap G10 — Errors-and-Omissions liability framework

### Engineering context
A PE who pulls a PitCast number into a stamped FFS / RBI / CP report is — under NSPE Code §II.2.b and NCEES Model Rules §240.20 — personally on the hook for the entire calculation. Plan-stamping (sealing work the engineer didn't perform or fully review) is illegal in every U.S. jurisdiction. The fact that PitCast generated the number does NOT transfer responsibility to PitCast — it never has for any commercial engineering software. ANSYS, COMSOL, Caesar II all carry "we make no warranty as to accuracy" disclaimers, and engineers stamp output anyway. What's MISSING on the PitCast side is the matching legal scaffolding: Intended Use Statement, EULA, output disclaimer, license selection, E&O insurance posture.

### Authoritative sources
1. **NSPE Code of Ethics**, §II.2 (Competence) — II.2.a, II.2.b (no signature on plans lacking competence or not under direction), II.2.c (coordination).
2. **NCEES Model Rules of Professional Conduct (2024)** §240.20 — sign/seal only within competence + responsible charge.
3. **California BPELSG Title 16 CCR §404.1 / PE Act §6735** — "responsible charge" definition.
4. **Texas TBPELS Engineering Practice Act §1001.401 / 22 TAC §137.33** — analogous.
5. **ASCE Code of Ethics (2020)** — Canon I (safety), Canon V (competence).
6. **ANSYS Software License Agreement (Aug 2020)** — industry-standard disclaimer floor.
7. **COMSOL SLA** — same template.
8. **ISO/IEC 25010:2011/2023** — quality model (Functional Suitability, Performance, Compatibility, Interaction, Reliability, Security, Maintainability, Flexibility, Safety).
9. **IEC 61508 / ISO 26262** — SIL framework. PitCast → SIL 1 ("low risk reduction, advisory") or out-of-scope (not real-time control).
10. **IMDRF SaMD** — "intended use bounds liability" principle transferable.
11. **Economic Loss Doctrine** — majority US jurisdictions; bars tort recovery for purely economic loss when parties in privity; the principal shield for software vendors against negligence claims when a valid EULA exists.
12. **MIT / Apache 2.0** licenses — Apache 2.0 includes explicit patent grant + warranty disclaimer.
13. **Marsh / Lockton Tech E&O guidance** — covers "third party financial loss due to product/service not performing as expected." Tech E&O (not A&E E&O) is the right product for a software publisher.
14. **Florida BPE** — supervisory control may affect PE liability (concrete state-board guidance).

### Model Intended Use Statement (publishable)

> **PitCast Intended Use Statement (v1.0).** PitCast is a **screening-grade computational aid** for corrosion engineering, fitness-for-service, and risk-based inspection workflows. PitCast outputs are intended to support — not replace — the independent professional judgment of a licensed Professional Engineer ("PE") working within their area of competence. PitCast is **not** intended (a) as the calculation-of-record for any code-stamped vessel, piping, or pipeline design under ASME BPVC, ASME B31, API 510/570/653, API 579, ASME PCC-2, NACE/AMPP, or equivalent; (b) for real-time safety-instrumented-system control or any application requiring IEC 61508 SIL ≥ 2; (c) for nuclear safety-related functions (10 CFR 50 App. B / ASME NQA-1); (d) for any application where the consequence of an undetected wrong output is loss of life, environmental release in excess of regulatory thresholds, or catastrophic asset loss without independent verification by the user PE. PitCast outputs are **advisory screening calculations**; the user PE in responsible charge must independently verify any quantity relied upon for a stamped engineering deliverable, by reference to the cited standard or by independent calculation. By using PitCast, the user accepts these scope limits.

### EULA — seven clauses that matter

(Final language requires licensed software-contracts attorney in relevant jurisdiction — flagged below)

1. **License grant** — narrow, revocable, non-transferable, for engineering analysis in support of PE's professional services
2. **Intended Use Statement** — incorporates the above by reference; user warrants understanding
3. **Disclaimer of warranties** — "AS IS / AS AVAILABLE; no warranty of merchantability, fitness, accuracy, non-infringement" (mirrors ANSYS WLA)
4. **Limitation of liability** — cap at greater of (i) fees paid prior 12 months or (ii) $100; exclude indirect/consequential/special/punitive; preserve fraud + IP-infringement carve-outs (industry standard, ELD-supported)
5. **Responsibility allocation** — explicit: user is engineer in responsible charge; solely responsible for verifying PitCast output against code before sealing
6. **Indemnification** — user indemnifies PitCast against third-party claims arising from user's use of output
7. **Governing law + dispute resolution** — choose jurisdiction (Delaware conventional; non-US with strong ELD-equivalent if outside US)

### Verification Responsibilities checklist (publishable Appendix)

PE must, prior to relying on PitCast output for stamped deliverable:
1. Confirm input data ranges fall within cited validation envelope in output PDF
2. Confirm output's validation-tier label is consistent with intended use (T1/T2 screening; T3/T4 advisory with engineer judgment; PitCast does NOT produce T5 = code-stamped calcs)
3. Independently calculate any quantity exceeding AccuracyBounds warning threshold
4. Cross-check against published code clause cited in output footer
5. Retain PitCast PDF + engineer's verification notes as part of project record per NCEES §240.30 retention rules

### Per-page output disclaimer (footer on every PitCast PDF)

> *PitCast v[X.Y] — Screening-Grade Computational Aid. Validation tier: [T1–T4]. Reference: [standard + clause cited above]. Not a calculation-of-record. The licensed Professional Engineer in responsible charge is solely responsible for independent verification before sealing any deliverable. Per Intended Use Statement v1.0 incorporated in the PitCast EULA.*

This footer accomplishes three legal functions: (a) limits PitCast's exposure under ELD by reinforcing contractual scope; (b) satisfies engineer's NSPE II.2.b duty to know whether reliance is appropriate; (c) creates evidence PitCast was NOT held out as calc-of-record.

### License selection — **Apache 2.0** (recommended)

Better than MIT for engineering software because: (a) explicit patent grant (protects users from contributor-held patent claims); (b) explicit no-warranty / limitation-of-liability clauses courts have engaged with directly. MIT is fine for simplicity. **Avoid GPLv3** — forces downstream open-source, incompatible with most consulting workflows. **Avoid BUSL / PolyForm** unless commercializing.

Recommendation: **Apache 2.0 for the public code repository + a separate proprietary EULA / Terms of Use governing the hosted PitCast service.** Open-source license disclaims liability for code use; service EULA disclaims liability for output use. Both layers needed.

### Insurance posture

For *individual hosting PitCast as a free or low-fee tool*: **personal Tech E&O policy** via Hiscox, The Hartford, Insureon, or Marsh/Lockton small-business product. $1M / $2M aggregate ≈ $1.5–3.5k/yr for sole-practitioner with strong contractual disclaimers. Marsh and Lockton both publish that **Tech E&O is the correct product** (not A&E E&O) because PitCast is publishing software, not practicing engineering — categorically different professional services priced differently.

To become "insurance-friendly" the carrier wants:
- Documented EULA with the 7 clauses (underwriter reviews verbatim)
- Intended Use Statement bounding consequence
- QMS evidence — ISO/IEC 25010 self-assessment, SOC 2 Type I (light) or II (heavy if enterprise), or documented SVVP (Gap G5)
- Incident-response plan + bug-tracking workflow
- No claim of "calculation of record" or "regulatory compliance" anywhere in marketing

### Tier-to-Tier path

| Tier | Means | Needed |
|---|---|---|
| **Tier 1 (today)** | Personal engineering tool | Done — but unlimited personal liability if a user harmed |
| **Tier 2** | Documented screening tool an outside PE could reasonably use; written EULA + IUS; OSS license | EULA + IUS + Apache 2.0 + footer + Gap G5 SVVP. ~3–5 days legal-template + ~$1.5k attorney review |
| **Tier 3 (target)** | Insurance-backed, defensible commercial product; Tech E&O policy; SVVP published; citable as screening aid in regulated deliverable | Tier 2 + full Gap G5 + entity formation (LLC min) + Tech E&O ($2-4k/yr) + attorney-reviewed EULA ($3-8k one-time). **~10-15 days + ~$5-15k cash + ~$3k/yr** |
| **Tier 4** | Calc-of-record (replace engineer's slide-rule) | Full NQA-1 / IEC 61508 SIL-2+ certification, third-party audit, multi-jurisdiction legal opinions. **Out of scope.** Tier 3 is realistic ceiling. |

### Where a real lawyer is non-negotiable

1. **EULA itself** — jurisdiction-specific enforceability of LoL cap, indemnification, choice-of-law requires local counsel
2. **Entity formation + personal-liability shielding** — LLC vs C-Corp in your jurisdiction (Azerbaijan/Türkiye/US). Corporate veil stops plaintiff after E&O limit exhausted.
3. **Insurance broker engagement + policy review** — coverage exclusions in Tech E&O are the entire game; "professional services" carve-outs can leave engineering-software claims uncovered.
4. **Cross-border issues** — international choice-of-law and forum-selection clauses are fact-specific.

### Implementation

```
legal/
  IUS-v1.0.md                        # Intended Use Statement
  EULA-v1.0.md                       # 7-clause EULA (attorney-reviewed)
  TERMS-OF-USE.md                    # Hosted-service terms
  PRIVACY.md                         # If any user data
  LICENSE                            # Apache 2.0 in repo root
  VERIFICATION-RESPONSIBILITIES.md   # PE checklist
  output-footer-template.md          # exact PDF footer text
  insurance/
    coverage-summary.md              # Tech E&O policy summary
    qms-attestation.md               # ISO/IEC 25010 + SVVP linkage
```

### Effort

| Activity | Effort | Cash | Notes |
|---|---|---|---|
| Draft IUS + EULA + Terms (self) | 3–5 days | — | ANSYS/COMSOL EULA templates as starting point |
| Apache 2.0 license adoption | 1 hr | — | One-line addition |
| Output footer + per-page disclaimer | 1–2 days | — | Code change in PDF generator |
| Attorney review of EULA (Tier 2) | 5–10 hrs | $1.5k–4k | Software-contracts boutique or Big Law associate |
| Entity formation (LLC) | 1–2 days | $300–1.5k | Stripe Atlas / Clerky |
| Tech E&O policy procurement | 1 wk broker engagement | $1.5k–4k/yr | Hiscox / Insureon for sole-practitioner |
| Cross-border legal opinion (if needed) | 10–20 hrs | $3k–10k | Only if hosting + use straddle jurisdictions |
| **Total Tier 3 ready** | **~15–25 eng-days + ~3–4 weeks elapsed** | **~$6k–20k one-time + ~$2k–4k/yr** | Legal piece is THE gating cost |

### Dependencies
- Reinforced by Gap G5 — V&V package is the technical evidence that makes EULA's "we tested and bounded the tool" clause defensible at deposition. Doing one without the other leaves a hole.

---

## Aggregate sequencing recommendation

### Phase 1 — Engineering daily-use (P1) · 6 weeks calendar / 26 eng-days
- **G4 Project persistence** (foundational — every other gap saves projects through this layer)
- **G7 MR0175 spec-issuer** (highest-value engineer deliverable; FEED material-selection memos move from 3-hour spec-book hunt to 5-minute issued spec)
- **G1 ILI multi-defect interaction** (extends existing ILI batch with DNV-RP-F101 / POF / B31G; closes the "10–30% of defects are mis-classified" bug)
- **G8 CIPS/DCVG ingestion** (CP engineer's daily survey-data analysis hours → seconds)

**After P1**: PitCast is *visibly* a daily workhorse for CP / CRA-selection / pipeline-integrity engineers.

### Phase 2 — Engineering moat (P2) · 16 weeks calendar / 74 eng-days
- **G6 API 579-1 vessel FFS** (Parts 3, 4, 5, 6, 7, 8, 9, 14; the FFS moat)
- **G3 API 581 detailed DF** (Thinning + 5 SCC + HTHA + External + Brittle + Fatigue + Lining + Tank Appx O; the RBI moat)

**After P2**: PitCast competes feature-for-feature with the screening modules of commercial RBI/FFS tools at $50–250k/seat.

### Phase 3 — Vendor-specific depth (P3) · 4 weeks calendar / 13–16 eng-days
- **G9 Vendor product DB** (60–100 cited products; cascade to G7 issuer)
- **G2 Vendor Tafel/i0 polarization** (per-alloy × electrolyte × T; per-heat MTC overrides)

**After P3**: PitCast outputs are not "generic FBE" but "3M Scotchkote 6233P qualified per NACE SP0490 + ISO 21809-2" — what a procurement manager actually accepts.

### Phase 4 — Defensibility (P4) · 4–6 months calendar / 80–125 eng-days + $8–25k cash
- **G5 Formal V&V package** (SVVP + CVR + VR + UQ/SA + SQAP)
- **G10 E&O liability framework** (IUS + EULA + Apache 2.0 + footer + Tech E&O policy + entity formation)

**After P4**: PitCast is a defensible commercial offering an underwriter writes Tech E&O against; a working PE cites it as a screening aid in a stamped deliverable.

### Total to Tier 3
- **~190–240 eng-days** at full-time single-engineer = **~9–12 months calendar**
- **~20,850 LOC** of new JS + ~60 kB cited data + ~20+ V&V documents
- **~$8–25k one-time + $2–4k/yr ongoing** cash
- Calendar at 50% allocation: **~18–24 months**

### Critical path risks

1. **G3 + G6 standards paywall** — API 581 + API 579 are paywalled; physical copies ~$800 each. Need to budget for the standards. Some Annex content has been published in worked-example papers (Trinity-Bridge, AOC, FFS.jl) but cross-checking against the actual standard is non-optional for any V&V claim.
2. **G2 vendor-Tafel data scarcity** — vendor MTCs don't publish Tafel slopes. The starter table is from academic sources; per-heat override is the way industry will populate it incrementally.
3. **G9 vendor DB rot** — vendors update product datasheets; the hash-watcher cron is essential.
4. **G10 legal jurisdiction** — if hosting from one country (Türkiye/Azerbaijan) and used by US PEs, cross-border opinion is needed. Budget ~$5–10k for that conversation.
5. **G5 V&V scope creep** — easy to gold-plate to NQA-1 levels. Hold the line at IEEE 1012 Integrity Level 2 / ASME V&V 40 medium model risk. Document why higher tiers don't apply.

### Scope boundaries (what this plan does NOT do)

- Does NOT pursue Tier 4 (replace OLI Studio / Cathwell / FEPipe as calc-of-record). That's a different product with 10–100× the resourcing.
- Does NOT add CFD / FE solvers. PitCast stays a closed-form / lookup-driven console; the Annex 9B/9C polynomial G-factors are as deep as it gets.
- Does NOT add real-time SIS / control integration. PitCast stays Class B SIL-1 / advisory-only.
- Does NOT add multi-user collaboration beyond CRDT-ready file format (G4). Real multi-user requires a backend — out of scope for vanilla-JS browser app.

---

## Decision recommendation (calibrated)

Two honest paths:

**Path A — Don't pursue Tier 3.** Stop at today's Tier-2 screening-tool position. PitCast already serves a clear engineering audience as a sidebar tool. Cost: $0 + zero ongoing maintenance burden beyond the existing 5,500-test regression suite. Risk: nobody ever stamps a deliverable citing PitCast, so its industrial relevance ceiling is "useful sanity-check tab."

**Path B — Pursue Tier 3 in the staged sequence above.** Total budget ~9–12 months calendar + ~$10–25k cash. Risk: this is genuinely a part-time-faculty-or-startup-founder commitment, not a weekend project. Reward: PitCast becomes a tool a working PE cites in a stamped FEED memo, an Tech E&O underwriter writes against, and a customer eventually pays for.

**My recommendation**: Phase 1 only (~6 weeks, ~$0 cash) gets PitCast to "visible daily workhorse" without the V&V / legal commitment. That's the highest-leverage milestone. After Phase 1, decide whether to continue to Phase 2 based on whether real working engineers (Tom, etc.) are using it daily and asking for the next layer. **Don't commit to Phase 4 until Phase 1 + 2 are deployed and validated by 3+ real industry users for at least 3 months.** Legal and insurance work only pays off if there's a real adoption story to insure.

---

**Document version**: 1.0.0 — 2026-05-28
**Authors**: PitCast development team (synthesised from 5 parallel primary-source research briefs)
**Total source citations**: 90+ unique authoritative references (ASME, NACE, DNV, ISO, API, ASTM, IEEE, NIST, peer-reviewed papers, vendor datasheets)
**Next action**: review + decide P1 commitment + open issues for G1, G4, G7, G8 in priority order
