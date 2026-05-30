/* atlas.js — PitCast Model Atlas (WS1.3).
 *
 * A browsable, cited reference of EVERY model PitCast runs: its governing
 * equation, the primary-standard citation, and its validity envelope — the
 * open "curated knowledge" layer no closed corrosion tool publishes. Each
 * domain links to its console tab.
 *
 * Every citation here is traced from the engine source (co2.js, pitcast.js,
 * b31g.js, ffs.js, mr0175.js, cpac.js, anode.js, galvanic.js, groundbed.js,
 * cips.js, hic.js, mic.js, cui.js, rbi.js) — none fabricated.
 *
 * A Javanshir Hasanov production.
 */
(function (root) {
  "use strict";

  var DOMAINS = [
    { tab: "co2", domain: "Sweet CO₂ corrosion (carbon steel)",
      validation: "5-model ensemble; per-model MAE + envelope-coverage on cited cases — node benchmark/run.js · VR/co2.md",
      models: [
        { name: "de Waard–Milliams 1975", eq: "log₁₀CR = 5.8 − 1710/T(K) + 0.67·log₁₀pCO₂", env: "moderate pCO₂; no flow/scale", cite: "de Waard & Milliams, Corrosion 31 (1975) 177" },
        { name: "de Waard 1995", eq: "1/CR = 1/CR_react + 1/CR_mass × F_pH·F_scale·F_glycol", env: "T ≲ 85 °C; pH 3.5–6.5", cite: "de Waard, Lotz, Dugstad, NACE Corrosion/95 Paper 128" },
        { name: "NORSOK M-506", eq: "CR = K_T·f_CO₂^0.62·(S/19)^x·f(pH)", env: "T 20–150 °C; pH 3.5–6.5", cite: "NORSOK M-506:2017" },
        { name: "NESC / Cassandra", eq: "CR_blank·F_scale·F_oil·F_velocity", env: "sweet oilfield", cite: "Nyborg, Energy Materials 5 (2010) 91" },
        { name: "Multicorp / FreeCorp", eq: "CR_react·F_H2S·F_film·F_v", env: "incl. H₂S co-effect", cite: "Nešić, Corros. Sci. 49 (2007) 4308; Sun & Nešić, NACE 09572" },
        { name: "In-situ pH (Crolet–Bonis)", eq: "[H⁺]² + A[H⁺] − K₁[CO₂(aq)] = 0", env: "with bicarbonate alkalinity", cite: "Crolet & Bonis, Corrosion 47 (1991) 351" }
      ] },
    { tab: "assess", domain: "Pitting / CPT (CRA selection)",
      validation: "leave-one-out MAE 6.58 °C on n=51 cited FeCl₃ records — node benchmark/run.js · VR/cpt.md",
      models: [
        { name: "CPT–PREN correlation", eq: "CPT = 2.038·PREN_N30 − 32.73 (ASTM G48 / 6% FeCl₃)", env: "PREN_N30 18.24–65.55", cite: "Nyby 2021, Sci. Data 8:58 (CC-BY); ASTM G48" },
        { name: "Chloride adjustment", eq: "ΔCPT ≈ −24 °C per decade [Cl⁻]", env: "~0.1–5 M Cl⁻", cite: "Abd El Meguid & Abd El Latif, Corros. Sci. 49 (2007) 263" },
        { name: "σ-phase TTT (CPT loss)", eq: "JMAK f_σ(T,t)", env: "ageing 600–1050 °C", cite: "Hsieh & Wu, ISRN Mater. Sci. 2012; Sourmail, MST 17 (2001) 1" },
        { name: "Chloride-SCC screen", eq: "logistic(T, Cl, σ) family thresholds", env: "per CRA family", cite: "screening thresholds (austenitic/duplex/SD/Ni)" },
        { name: "Sour SSC (CRA)", eq: "use-without-testing envelope", env: "per alloy group", cite: "ISO 15156-3:2020 Annex A" }
      ] },
    { tab: "integrity", domain: "Pipeline metal-loss (corroded-pipe FFS)",
      validation: "ASME B31G Appx-B Ex 1 reproduced (P_safe 54.3 bar) · method-spread ensemble — VR/b31g.md",
      models: [
        { name: "ASME B31G (original)", eq: "σ_f = 1.1·SMYS; ⅔·dL parabolic; P_f = 2σ_f t/D·(1−⅔R)/(1−⅔R/M)", env: "d/t ≤ 80%", cite: "ASME B31G-2012 §2" },
        { name: "Modified B31G (RSTRENG)", eq: "σ_f = SMYS + 69 MPa; 0.85·dL effective area", env: "d/t ≤ 80%", cite: "Kiefner & Vieth 1989 (Battelle PR 3-805)" },
        { name: "Folias bulging factor", eq: "M = √(1 + 0.6275λ − 0.003375λ²), λ = L²/(Dt)", env: "λ ≲ 50", cite: "Folias, Int. J. Fract. Mech. 1 (1965) 104" }
      ] },
    { tab: "ffs", domain: "Fitness-for-service (API 579, corrosion subset)",
      validation: "Part 5 LTA reproduces FFS.jl reference; self-test 29/29 — VR",
      models: [
        { name: "Part 4 — General Metal Loss", eq: "PTR ≥ 15, COV ≤ 10% → mean", env: "uniform thinning", cite: "API 579-1/ASME FFS-1 (2021) Part 4" },
        { name: "Part 5 — Local Metal Loss (LTA)", eq: "RSF = Rt / (1 − (1/Mt)(1 − Rt))", env: "Rt ≥ 0.20; D/tc ≥ 20; tc ≥ 2.5 mm", cite: "API 579-1/ASME FFS-1 (2021) Part 5 + Folias Annex 5A" },
        { name: "Part 6 — Pitting", eq: "ASTM G46 Type 1–4 → tabulated RSF", env: "depth/density bands", cite: "API 579 Part 6 + ASTM G46-94(2018)" },
        { name: "Part 7 — HIC / blistering", eq: "NACE TM0284: CLR ≤ 15%, CTR ≤ 5%, CSR ≤ 2%", env: "sour H₂S service", cite: "API 579 Part 7 + NACE TM0284-2016" }
      ] },
    { tab: "mr0175", domain: "Sour-service materials selection (MR0175)",
      validation: "decision tree verified — node mr0175.js · VR/mr0175.md",
      models: [
        { name: "ISO 15156-3 Annex A (CRA)", eq: "family → use-without-testing envelope (T, pH₂S, Cl)", env: "per Annex table", cite: "ANSI/NACE MR0175-2021 / ISO 15156-3:2020" },
        { name: "ISO 15156-2 Fig.1 (C/LAS)", eq: "Region by pH₂S × in-situ pH", env: "sour regions 0–3", cite: "ANSI/NACE MR0175-2021 / ISO 15156-2:2020" }
      ] },
    { tab: "cpac", domain: "Cathodic protection & AC corrosion",
      validation: "ISO 18086 / SP0169 / DNV-RP-B401 / Sunde worked examples reproduced",
      models: [
        { name: "AC corrosion (disc spread-resistance)", eq: "Jac = 8·Vac/(ρ·π·d)", env: "Jac > 30 A/m² → high risk", cite: "ISO 18086" },
        { name: "CP protection criteria", eq: "−850 mV CSE (instant-off) / 100 mV depolarisation", env: "polarised potential", cite: "AMPP/NACE SP0169" },
        { name: "Sacrificial-anode design", eq: "mass = I_mean·8760·t / (utilisation · capacity)", env: "design calc (no rate-uncertainty envelope)", cite: "DNV-RP-B401" },
        { name: "Groundbed resistance", eq: "Sunde / Dwight R_bed (self + mutual)", env: "soil resistivity", cite: "NACE SP0169 Appx-A; Sunde 1949; Dwight 1936" }
      ] },
    { tab: "cpac", domain: "Galvanic corrosion",
      validation: "ASTM G102 mixed-potential + LaQue marine 316L/CS bolt ~1.16 mm/yr reproduced",
      models: [
        { name: "Mixed-potential (Evans)", eq: "i_galv at E_couple; Tafel branches intersect", env: "design (area ratio, electrolyte)", cite: "ASTM G102; Stansbury & Buchanan (2000)" }
      ] },
    { tab: "cips", domain: "CIPS / DCVG survey + ECDA",
      validation: "NACE SP0502 ECDA prioritisation + McKinney DCVG bands reproduced",
      models: [
        { name: "ECDA prioritisation", eq: "−850 mV-off / 100 mV-shift exceedance runs", env: "survey-driven (no validity range)", cite: "NACE SP0502" },
        { name: "DCVG %IR severity", eq: "%IR bands → indication severity", env: "indication grading", cite: "McKinney 1986" },
        { name: "Pit-growth power law", eq: "d(t) = K·tⁿ (n 0.5 sub-linear … 1.0 active)", env: "soil-side projection", cite: "BS 7910 (2019) Annex M; API STD 1163 (2021) §7.5" }
      ] },
    { tab: "integrity", domain: "HIC / SOHIC (hydrogen damage)",
      validation: "MR0103 / TM0284 / ISO 15156-2 envelope reproduced",
      models: [
        { name: "HIC / SOHIC screen", eq: "index from pH₂S × pH × S × HV × water-cut", env: "pH₂S ≥ 0.3 kPa (sour onset)", cite: "NACE MR0103-2018; TM0284-2016; ISO 15156-2" }
      ] },
    { tab: "integrity", domain: "MIC (microbially-influenced corrosion)",
      validation: "NACE SP0775 / TM0194 / TM0212 family classification reproduced",
      models: [
        { name: "MIC family screen", eq: "T · O₂ · nutrient · SO₄ · flow · biocide", env: "mesophilic peak 25–45 °C", cite: "NACE SP0775 / TM0194 / TM0212" }
      ] },
    { tab: "integrity", domain: "CUI (corrosion under insulation)",
      validation: "API 583 §4.3 + ASTM C871 leachable-Cl patterns reproduced",
      models: [
        { name: "CUI risk score", eq: "T · insulation · jacket · coating · ambient · age", env: "CUI window ≈ −4 to 175 °C", cite: "API RP 583; ASTM C871; ISO 9223" }
      ] },
    { tab: "integrity", domain: "RBI (risk-based inspection screen)",
      validation: "API RP 581 3rd-ed basis (STANDARDS.md notes the 4th-ed 2025 delta) — research-grade",
      models: [
        { name: "PoF × CoF matrix", eq: "damage factor × consequence → 5×5 risk cell", env: "corrosion-driven screen (not a full RBI study)", cite: "API RP 581 (3rd ed., 2016)" }
      ] }
  ];

  function _esc(s){ return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  function render(host) {
    if (!host) return;
    var L = '<div class="datastat" style="margin-bottom:12px">Every model PitCast runs — governing equation, primary-standard citation, and validity envelope — in one browsable place. ' +
            'The open reference no closed corrosion tool publishes. Each card links to its console tab. ' +
            '<button class="atlas-link" data-tab="learn" style="margin-left:6px;padding:3px 10px;background:rgba(167,139,250,.15);border:1px solid rgba(167,139,250,.35);color:#c4b5fd;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600">New to this? Start with the CO₂ walkthrough →</button></div>';
    DOMAINS.forEach(function (d) {
      L += '<div style="margin:0 0 14px;border:1px solid var(--line,#1e293b);border-radius:10px;overflow:hidden">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 14px;background:rgba(45,212,191,.06)">' +
          '<b style="color:var(--ink)">' + _esc(d.domain) + '</b>' +
          '<button class="atlas-link" data-tab="' + d.tab + '" style="flex:none;background:rgba(45,212,191,.12);color:#2dd4bf;border:1px solid rgba(45,212,191,.3);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px">open ' + d.tab + ' →</button>' +
        '</div>' +
        '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">' +
          '<thead><tr style="color:var(--dim);text-align:left">' +
            '<th style="padding:6px 14px;font-weight:500">Model</th>' +
            '<th style="padding:6px 8px;font-weight:500">Governing equation</th>' +
            '<th style="padding:6px 8px;font-weight:500">Validity envelope</th>' +
            '<th style="padding:6px 14px;font-weight:500">Primary source</th></tr></thead><tbody>' +
          d.models.map(function (m) {
            return '<tr style="border-top:1px solid var(--line,#1e293b)">' +
              '<td style="padding:6px 14px;color:var(--ink);white-space:nowrap">' + _esc(m.name) + '</td>' +
              '<td style="padding:6px 8px;font-family:var(--mono,monospace);color:var(--dim)">' + _esc(m.eq) + '</td>' +
              '<td style="padding:6px 8px;color:var(--dim)">' + _esc(m.env || "—") + '</td>' +
              '<td style="padding:6px 14px;color:var(--dim)">' + _esc(m.cite) + '</td></tr>';
          }).join("") +
        '</tbody></table></div>' +
        '<div style="padding:6px 14px;font-size:11px;color:var(--dim);border-top:1px solid var(--line,#1e293b)">✓ Validation: ' + _esc(d.validation) + '</div>' +
      '</div>';
    });
    var nModels = DOMAINS.reduce(function (s, d) { return s + d.models.length; }, 0);
    L += '<div style="font-size:11px;color:var(--dim);margin-top:4px">' + nModels + ' models across ' + DOMAINS.length + ' corrosion domains · all citations traced to the engine source, none fabricated.</div>';
    host.innerHTML = L;
    // link each card to its console tab
    host.querySelectorAll(".atlas-link").forEach(function (b) {
      b.onclick = function () {
        var t = document.querySelector('.tab[data-tab="' + b.dataset.tab + '"]');
        if (t) { t.click(); window.scrollTo({ top: 0, behavior: "auto" }); }
      };
    });
  }

  root.Atlas = { DOMAINS: DOMAINS, render: render };
  if (typeof module !== "undefined" && module.exports) module.exports = root.Atlas;

})(typeof window !== "undefined" ? window : this);
