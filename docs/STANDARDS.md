# PitCast Standards Register & Currency

Which **edition** of each standard every engine implements, the **current** edition
as of this register's date, and any **delta** to track. This closes risk **R5
(standards drift)** in `../PLAN-differentiation.md`. Auditors and reviewers check
edition currency first — so it is tracked explicitly here rather than buried in
source comments.

**Register date:** 2026-05-29 · **Scope:** corrosion-only (see
`../../memory`-tracked scope rule / PLAN-tier3.md).

## Engine → standard edition map

| Engine | Standard(s) | Edition implemented | Current (2026-05) | Status |
|---|---|---|---|---|
| `pitcast.js` (CPT/PREN/SCC) | ASTM G48; ISO 15156-3; Nyby 2021 dataset | G48-15(2020); ISO 15156-3:2020 | same | ✅ current |
| `co2.js` | de Waard-Milliams 1975; de Waard 1995 (NACE Corr/95 P128); NORSOK M-506; Nyborg NESC 2010; Nesic Multicorp | NORSOK M-506:2017 rev 3 | M-506:2017 | ✅ current |
| `b31g.js` | ASME B31G; Kiefner & Vieth 1989; Folias 1965 | B31G-2012 | B31G-2012 | ✅ current (no newer ed.) |
| `mr0175.js` | NACE MR0175 / ISO 15156 (Parts 1-3) + Tech Circulars | MR0175-2021 / ISO 15156:2020 +TC1&2 | same | ✅ current |
| `interaction.js` | DNV-RP-F101; POF-100; API STD 1163; B31G-2012 | F101 (2021); POF-100 (2021); 1163 3rd (2021) | same | ✅ current |
| `cips.js` | NACE SP0207; SP0169; SP0502; TM0109; ISO 15589-1 | SP0169-2013; ISO 15589-1:2015 | SP0169-2013; ISO 15589-1:2015 | ✅ current |
| `hic.js` | NACE MR0103; TM0284; ISO 15156-2 | MR0103-2018; TM0284-2016; ISO 15156-2:2020 | same | ✅ current |
| `anode.js` / `groundbed.js` | DNV-RP-B401; NACE SP0169/SP0387; Dwight/Sunde | B401:2017; SP0169-2013 | same | ✅ current |
| `galvanic.js` / `electrochem.js` | ASTM G82/G102/G5/G59; Stansbury 2000; LaQue 1975 | G102-89(2015); G5-14; G59-97(2020) | same | ✅ current |
| `cui.js` | API 583; NACE SP0198; ASTM C871 | API 583 (2014); SP0198-2017 | same | ✅ current |
| `mic.js` | NACE TM0194/TM0212/SP0775 | as cited | same | ✅ current |
| `ffs.js` | API 579-1/ASME FFS-1 (Parts 4,5,6,7) | **4th ed (2021)** | 4th ed (2021) | ✅ current |
| `rbi-detailed.js` / `rbi-damage-mechanisms.js` | API RP 581 (corrosion DFs); API 941/945/751/571/583 | **3rd ed (2016) + Add 1 (2019) + Add 2 (2020)** | **4th ed (Feb 2025)** | ⚠️ **trails — see delta below** |

## Known deltas to track

1. **API RP 581 — 3rd ed (implemented) → 4th ed (Feb 2025, current).** This is the
   one place PitCast trails. Impact on PitCast's **in-scope corrosion content** is
   limited: the damage-mechanism logic (thinning, SCC sub-types, HTHA, external/CUI)
   is broadly stable between editions; the main 4th-ed changes are **Damage-Factor
   coefficient tables and some inspection-effectiveness factors**. **Action:** review
   the 4th-ed Annex 2.B/2.C coefficient tables against the implemented values; tag any
   changed DF coefficients. Until done, the detailed-RBI DF outputs are labelled
   3rd-ed-basis. (Note: RBI infrastructure beyond corrosion DFs is out of PitCast scope.)

2. All other engines: **current** as of the register date. ASME B31G-2012 and NORSOK
   M-506:2017 remain the latest published editions (no newer revision exists).

## Currency policy (how this stays honest)

- Each engine header already carries inline edition citations; this register is the
  single roll-up.
- When a referenced standard issues a new edition, add a row to the changelog below,
  assess the delta for **in-scope corrosion content only**, and either update the
  engine or label the output with the implemented edition.
- Never silently imply currency: an output citing a superseded edition must say so
  (the detailed-RBI DF card states "API 581 3rd ed. basis").

## Changelog

| Date | Change |
|---|---|
| 2026-05-29 | Register created. Flagged API RP 581 4th ed (2025) delta vs implemented 3rd ed. All other engines verified current. |
