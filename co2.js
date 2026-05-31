/* co2.js — Sweet (CO2) corrosion models for carbon steel, vanilla JS.
 *
 * Self-contained in-browser port of the models behind
 * austenite.org/console/corrosion-co2. Ported faithfully (formula-for-formula)
 * from austenite/apps/web/src/lib/corrosion/co2.ts so the numbers MATCH the
 * live console page. No bundler, no imports/exports — attaches to window.CO2.
 *
 *  ── References ──────────────────────────────────────────────────────────
 *   De Waard C., Milliams D.E., Corrosion 31 (1975) 177
 *      "Carbonic acid corrosion of steel" — classical hand-calc, conservative.
 *   De Waard C., Lotz U., Dugstad A., NACE Corrosion/95 Paper 128 (1995)
 *      Revised semi-empirical correlation with reaction + mass-transfer
 *      resistance in series, F_pH, F_scale, F_glycol.
 *   NORSOK Standard M-506:2017 (rev 3) — "CO2 corrosion rate calculation model"
 *      K_T(T) table x fugacity x wall-shear-stress term x f(pH).
 *   Crolet J.-L., Bonis M.R., Corrosion 90 Paper 466 (1990) / NACE Corrosion 47
 *      (1991) 351 — in-situ pH via charge balance with bicarbonate alkalinity.
 *   Sun W., Nesic S., NACE Paper 09572 (2009) — FeCO3 scaling tendency ST.
 *   Nyborg R., Energy Materials 5 (2010) 91 — NESC / Cassandra (mechanistic).
 *   Nesic S., Corrosion Sci. 49 (2007) 4308; Sun-Nesic, Corrosion 65 (2009) 291
 *      — Multicorp / FreeCorp mixed-film kinetics (H2S co-effect).
 *
 *  ── Conventions ─────────────────────────────────────────────────────────
 *   T_C    temperature (degC)         T_K = T_C + 273.15
 *   pCO2   CO2 partial pressure (bar absolute)
 *   pH     in-situ pH (dimensionless)
 *   u      liquid superficial velocity (m/s)
 *   d      pipe ID (m)
 *   Fe2    ferrous-ion concentration (mg/L)
 *   CR     corrosion rate (mm/year)
 *
 *  A Javanshir Hasanov production.
 */
(function (global) {
  'use strict';

  var R_GAS = 8.314;

  // ══════════════════════════════════════════════════════════════════════
  // SHARED HELPERS
  // ══════════════════════════════════════════════════════════════════════

  /** Henry-law CO2 solubility (mol/L per bar). 0.0344 at 25 C, falling to
   *  ~0.0173 at 60 C (CO2 is less soluble when hot). Same Crolet-Bonis
   *  temperature dependence used by the in-situ pH solver, so the scaling
   *  and pH calculations stay internally consistent.
   *  Crolet J.-L., Bonis M.R., CORROSION/91 Paper 22; Corrosion 47 (1991) 351. */
  function K_H_CO2(T_C) {
    return 0.0344 * Math.pow(10, -0.0085 * (T_C - 25));
  }

  /** Aqueous CO2 -> carbonic-acid equilibrium pH at given pCO2 (no buffer).
   *  Crolet-Bonis 1991 closed-form for pure CO2-water. */
  function pH_carbonic(pCO2_bar, T_C) {
    if (T_C === undefined) T_C = 25;
    return 3.71 + 0.00417 * T_C - 0.5 * Math.log10(Math.max(1e-6, pCO2_bar));
  }

  /** CO2 fugacity f_CO2 = phi * pCO2 (bar). De Waard-Lotz-Dugstad 1995
   *  fugacity coefficient applied across the WHOLE pressure range (the old
   *  code left phi=1 below 250 bar, over-stating the CO2 driving force at
   *  elevated pressure):
   *      log10(phi) = (0.0031 - 1.4/T_K) * P ,   P capped at 250 bar
   *  phi is clamped <= 1 (CO2 fugacity never exceeds partial pressure within
   *  the model's T window). Sanity: ~0.99 at 1 bar, ~0.78 at 100 bar/60 C,
   *  ~0.53 at >=250 bar — the documented de Waard 1995 behaviour.
   *  De Waard, Lotz & Dugstad, NACE Corrosion/95 Paper 128. */
  function fugacity_CO2(pCO2_bar, T_C) {
    if (T_C === undefined) T_C = 60;
    var T = T_C + 273.15;
    var P = Math.max(0, pCO2_bar);
    var logPhi = Math.min(0, (0.0031 - 1.4 / T) * Math.min(P, 250));
    return Math.pow(10, logPhi) * P;
  }

  // ══════════════════════════════════════════════════════════════════════
  // MODEL 1 — De Waard & Milliams 1975 (classical)
  //   log10 CR_mmpy = 5.8 - 1710/T(K) + 0.67*log10(pCO2_bar)
  //   Corrosion 31 (1975) 177. Conservative — no flow, scale, or pH.
  // ══════════════════════════════════════════════════════════════════════
  function deWaard1975(T_C, pCO2_bar) {
    var T = T_C + 273.15;
    var logCR = 5.8 - 1710 / T + 0.67 * Math.log10(Math.max(1e-6, pCO2_bar));
    return Math.max(0, Math.pow(10, logCR));
  }

  // ══════════════════════════════════════════════════════════════════════
  // MODEL 2 — De Waard 1995 (resistance model + fluid factor)
  //   1/CR = 1/CR_react + 1/CR_mass  (resistance in series)
  //   log10 CR_react = 5.8 - 1710/T + 0.67*log10(f_CO2)
  //   CR_mass        = 2.45 * u^0.8 / d^0.2 * f_CO2
  //   F_pH    = 1 - 0.31*(pH - pH_sat)^1.6   (if pH > pH_sat)
  //   F_scale = 10^(2400/T - 0.6*log10(f_CO2) - 6.7)  (clamp <= 1, T>=60)
  //   F_glycol= 1 - 1.6*X_MEG
  //   NACE Corrosion/95 Paper 128.
  // opts: { T_C, pCO2_bar, u_m_s, d_pipe_m, pH, X_glycol?, applyScale? }
  // ══════════════════════════════════════════════════════════════════════
  function deWaard1995(opts) {
    var T = opts.T_C + 273.15;
    var f = fugacity_CO2(opts.pCO2_bar, opts.T_C);

    // 1) Reaction-controlled rate (no flow, no scale)
    var log_react = 5.8 - 1710 / T + 0.67 * Math.log10(Math.max(1e-6, f));
    var CR_react = Math.pow(10, log_react);

    // 2) Mass-transport-controlled rate (liquid-side film, turbulent pipe)
    var u = Math.max(0.05, opts.u_m_s);
    var d = Math.max(0.01, opts.d_pipe_m);
    var CR_mass = 2.45 * Math.pow(u, 0.8) / Math.pow(d, 0.2) * f;

    // 3) Combine in resistance-in-series
    var CR_combined = CR_react * CR_mass / Math.max(1e-9, CR_react + CR_mass);

    // 4) pH correction (only if pH > saturation pH of pure carbonic)
    var pH_sat = pH_carbonic(opts.pCO2_bar, opts.T_C);
    var dPH = Math.max(0, opts.pH - pH_sat);
    var F_pH = Math.max(0.05, 1 - 0.31 * Math.pow(dPH, 1.6));

    // 5) Scale-formation correction (FeCO3 film throttles CR, T >= 60 C)
    var F_scale = 1;
    if (opts.applyScale !== false && opts.T_C >= 60) {
      var log_F = 2400 / T - 0.6 * Math.log10(Math.max(1e-6, f)) - 6.7;
      F_scale = Math.min(1, Math.pow(10, log_F));
    }

    // 6) Glycol/MEG correction
    var Xg = opts.X_glycol == null ? 0 : opts.X_glycol;
    var F_glycol = Math.max(0.05, 1 - 1.6 * Math.max(0, Math.min(0.9, Xg)));

    return {
      CR_mmpy: CR_combined * F_pH * F_scale * F_glycol,
      CR_react_mmpy: CR_react,
      CR_mass_mmpy: CR_mass,
      F_pH: F_pH,
      F_scale: F_scale,
      F_glycol: F_glycol
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // MODEL 3 — NORSOK M-506:2017
  //   CR = K_T * f_CO2^0.62 * (S/19)^(0.146 + 0.0324*log10(f_CO2)) * f(pH)
  //   K_T : table A.1 interpolation; S : wall shear stress (Pa); f(pH) bracketed.
  //   NORSOK Standard M-506:2017, Annex A.
  // opts: { T_C, pCO2_bar, u_m_s, d_pipe_m, pH, rho_kgm3?, mu_PaS? }
  // ══════════════════════════════════════════════════════════════════════
  function norsokM506(opts) {
    var T_table = [5, 15, 20, 40, 60, 80, 90, 120, 150];
    var K_table = [0.42, 1.59, 4.762, 8.927, 10.695, 9.949, 6.250, 7.770, 5.203];
    var T = opts.T_C;
    var K_T = K_table[0];
    if (T <= T_table[0]) {
      K_T = K_table[0];
    } else if (T >= T_table[T_table.length - 1]) {
      K_T = K_table[K_table.length - 1];
    } else {
      for (var i = 0; i < T_table.length - 1; i++) {
        if (T >= T_table[i] && T < T_table[i + 1]) {
          var frac = (T - T_table[i]) / (T_table[i + 1] - T_table[i]);
          K_T = K_table[i] + frac * (K_table[i + 1] - K_table[i]);
          break;
        }
      }
    }

    // Wall shear stress S (Pa). Default rho = 1025 (brine), mu = 0.001 Pa.s.
    var rho = opts.rho_kgm3 == null ? 1025 : opts.rho_kgm3;
    var mu = opts.mu_PaS == null ? 0.001 : opts.mu_PaS;
    var u = Math.max(0.05, opts.u_m_s);
    var d = Math.max(0.01, opts.d_pipe_m);
    var Re = rho * u * d / mu;
    var f_f = 0.001375 * (1 + Math.pow(2e4 / Re + 1e6 / Re, 1 / 3)); // Colebrook-style
    var S = 0.5 * rho * u * u * f_f;
    var f_CO2 = fugacity_CO2(opts.pCO2_bar, T);

    // f(pH) — bracketed by T (NORSOK M-506 surface table, closed form)
    var f_pH;
    if (T <= 20) {
      if (opts.pH <= 4.6) f_pH = 2.0676 - 0.2309 * opts.pH;
      else f_pH = 4.342 - 1.051 * opts.pH + 0.0708 * opts.pH * opts.pH;
    } else if (T < 80) {
      if (opts.pH <= 4.6) f_pH = 2.0676 - 0.2309 * opts.pH;
      else f_pH = 5.486 - 1.718 * opts.pH + 0.1233 * opts.pH * opts.pH;
    } else {
      if (opts.pH <= 4.6) f_pH = 0.4254 - 0.0857 * opts.pH;
      else f_pH = 6.1473 - 1.7757 * opts.pH + 0.1254 * opts.pH * opts.pH;
    }
    f_pH = Math.max(0.05, f_pH);

    var expo = 0.146 + 0.0324 * Math.log10(Math.max(1e-6, f_CO2));
    var CR = K_T * Math.pow(f_CO2, 0.62) * Math.pow(Math.max(0.01, S / 19), expo) * f_pH;

    return { CR_mmpy: Math.max(0, CR), K_T: K_T, shear_Pa: S, f_pH: f_pH };
  }

  // ══════════════════════════════════════════════════════════════════════
  // MODEL 4 — NESC / Cassandra (Shell internal — Nyborg 2010)
  //   CR_blank (de Waard anchor) x F_scale(Sun-Nesic SR) x F_oil x F_velocity.
  // opts: { T_C, pCO2_bar, u_m_s, pH, Fe2_ppm, water_cut, oil_type }
  //   oil_type: 'condensate' | 'crude' | 'water-only'
  // ══════════════════════════════════════════════════════════════════════
  function nescCassandra(opts) {
    var T = opts.T_C + 273.15;
    var f = fugacity_CO2(opts.pCO2_bar, opts.T_C);

    // 1) Blank rate (de Waard anchor)
    var CR_baseline = Math.pow(10, 5.8 - 1710 / T + 0.67 * Math.log10(Math.max(1e-6, f)));

    // 2) FeCO3 scaling factor (Sun-Nesic 2009 supersaturation)
    var log_Ksp = -10.13 - 0.0182 * opts.T_C; // simplified linear with T_C
    var K_sp = Math.pow(10, log_Ksp);
    var K_H = K_H_CO2(opts.T_C);
    var CO2_aq = K_H * f;
    var H_plus = Math.pow(10, -opts.pH);
    var K1 = Math.pow(10, -(6.351 - 0.0019 * opts.T_C));
    var K2 = Math.pow(10, -(10.329 - 0.0024 * opts.T_C));
    var CO3 = K1 * K2 * CO2_aq / (H_plus * H_plus);
    var Fe2_M = opts.Fe2_ppm / 55847; // mg/L -> mol/L
    var SR = (Fe2_M * CO3) / K_sp;
    var F_scale = 1 / (1 + Math.pow(Math.max(1e-9, SR), 0.8));

    // 3) Oil-wetting / water-cut (NESC empirical)
    // Oil/water wetting (NESC empirical, smoothed). A protective oil film forms
    // while the steel is oil-wet (low water cut); above the water-wetting
    // transition the steel is water-wet and corrodes fully. Crude wets steel to
    // a higher water cut than condensate. A sigmoid in water cut replaces the
    // old hard step so the hydrocarbon choice changes the rate continuously
    // (Smart 1993 / de Waard water-wetting concept).
    var ot = opts.oil_type, wc = (opts.water_cut == null ? 0.5 : opts.water_cut);
    var F_oil = 1;
    if (ot === 'crude' || ot === 'condensate') {
      var wc_t = ot === 'crude' ? 0.45 : 0.28;   // water-wetting transition (water cut)
      var floor = ot === 'crude' ? 0.10 : 0.05;  // residual rate when fully oil-wet
      var ww = 1 / (1 + Math.exp(-(wc - wc_t) / 0.08)); // water-wet fraction 0..1
      F_oil = floor + (1 - floor) * ww;
    }

    // 4) Velocity / Schmidt-Sherwood (Berger-Hau correlation)
    var u = Math.max(0.05, opts.u_m_s);
    var F_velocity = Math.min(2.5, 0.4 + 0.18 * Math.pow(u, 0.8));

    return {
      CR_mmpy: CR_baseline * F_scale * F_oil * F_velocity,
      F_scale: F_scale,
      F_oil: F_oil,
      F_velocity: F_velocity,
      CR_baseline: CR_baseline
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // MODEL 5 — Multicorp / FreeCorp (Ohio U, Nesic et al.) with H2S co-effect
  //   CR_FC = CR_react * F_H2S * F_film * F_kin * F_v
  // opts: { T_C, pCO2_bar, pH2S_bar, pH, u_m_s, age_h }
  // ══════════════════════════════════════════════════════════════════════
  function multicorpFreeCorp(opts) {
    var T = opts.T_C + 273.15;
    var f = fugacity_CO2(opts.pCO2_bar, opts.T_C);

    var CR_react = Math.pow(10, 5.8 - 1710 / T + 0.67 * Math.log10(Math.max(1e-6, f)));

    // H2S co-effect (Sun-Nesic 2009)
    var ratio = opts.pH2S_bar / Math.max(1e-6, opts.pCO2_bar);
    var F_H2S = 1;
    if (ratio < 0.05) {
      F_H2S = 1 + 4.5 * Math.log10(1 + 100 * ratio); // mild acceleration
    } else {
      F_H2S = 1.8 / (1 + 8 * (ratio - 0.05)); // FeS protective film throttles
    }
    F_H2S = Math.max(0.05, Math.min(5, F_H2S));

    // Film-build factor (Nesic 2007). A protective FeCO3 layer only forms where
    // the scale is thermodynamically stable (supersaturation SR >= 1); it then
    // matures with exposure time. Undersaturated brine (e.g. cold or low-Fe2+)
    // grows no scale, so F_film stays ~1 (no protection). Protection is capped
    // at ~2 orders of magnitude, the upper bound Nesic reports for FeCO3 films.
    var f_film = fugacity_CO2(opts.pCO2_bar, opts.T_C);
    var CO2_aq_f = K_H_CO2(opts.T_C) * f_film;
    var K1f = Math.pow(10, -(6.351 - 0.0019 * opts.T_C));
    var K2f = Math.pow(10, -(10.329 - 0.0024 * opts.T_C));
    var Hf = Math.pow(10, -opts.pH);
    var CO3f = K1f * K2f * CO2_aq_f / (Hf * Hf);
    var Fe2f = Math.max(0, opts.Fe2_ppm == null ? 10 : opts.Fe2_ppm) / 55847;
    var Ksp_f = Math.pow(10, -10.13 - 0.0182 * opts.T_C);
    var SR_f = (Fe2f * CO3f) / Ksp_f;
    var scaleReady = SR_f > 1 ? (SR_f - 1) / SR_f : 0;            // 0..1 (0 if undersaturated)
    var ageGrowth = 1 - Math.exp(-Math.max(0, opts.age_h) / 4380); // film matures, tau ~ 6 months
    var coverage = scaleReady * ageGrowth;                        // 0..1 protective coverage
    var F_film = Math.max(0.01, 1 - 0.99 * coverage);            // <= 2 orders of magnitude

    // NB: no separate Arrhenius factor — CR_react already carries the de Waard
    // temperature term (-1710/T, effective Ea ~ 33 kJ/mol). A second Arrhenius
    // multiplier would double-count temperature and blow up the hot end.

    // Velocity (lighter than NESC)
    var F_v = 0.8 + 0.1 * Math.min(8, opts.u_m_s);

    return {
      CR_mmpy: CR_react * F_H2S * F_film * F_v,
      F_H2S: F_H2S,
      F_film: F_film,
      F_v: F_v,
      CR_react_mmpy: CR_react
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // FeCO3 SCALING TENDENCY — Sun & Nesic 2009 (NACE 09572)
  //   ST = R_precip / R_corr ; ST>1 protective, ST<1 active.
  // opts: { T_C, pCO2_bar, pH, Fe2_ppm, CR_mmpy }
  // ══════════════════════════════════════════════════════════════════════
  function feCO3_scaling_tendency(opts) {
    var T = opts.T_C + 273.15;
    var f = fugacity_CO2(opts.pCO2_bar, opts.T_C);
    var K_H = K_H_CO2(opts.T_C);
    var CO2_aq = K_H * f;
    var K1 = Math.pow(10, -(6.351 - 0.0019 * opts.T_C));
    var K2 = Math.pow(10, -(10.329 - 0.0024 * opts.T_C));
    var H_plus = Math.pow(10, -opts.pH);
    var CO3 = K1 * K2 * CO2_aq / (H_plus * H_plus);
    var Fe2_M = opts.Fe2_ppm / 55847;
    var log_Ksp = -10.13 - 0.0182 * opts.T_C;
    var K_sp = Math.pow(10, log_Ksp);
    var SR = (Fe2_M * CO3) / K_sp;

    // Precipitation rate (kg/m2/s) -> mm/year of FeCO3-equivalent
    var Ep = 64850;
    var A = 52.4;
    var Rp = A * Math.exp(-Ep / (R_GAS * T)) * Math.max(0, SR - 1);
    var Rp_mmpy = Rp * 31557600 / 3.85e3 * 1000; // rho_FeCO3 = 3.85 g/cm3

    var ST = opts.CR_mmpy > 0 ? Rp_mmpy / opts.CR_mmpy : 0;
    return { ST: ST, SR: SR, protective: ST > 1 };
  }

  // ══════════════════════════════════════════════════════════════════════
  // IN-SITU pH — Crolet-Bonis charge balance
  //   [H+]^2 + A[H+] - K1[CO2(aq)] = 0
  //   [H+] = (-A + sqrt(A^2 + 4 K1 [CO2(aq)])) / 2
  //   A = added bicarbonate alkalinity (mol/L); [CO2(aq)] = K_H * fCO2.
  //   Corrosion 90 Paper 466 / NACE Corrosion 47 (1991) 351.
  // opts: { pCO2_bar, T_C?, bicarbonate_mg_l? }
  // ══════════════════════════════════════════════════════════════════════
  function co2InSituPH(opts) {
    var T_C = opts.T_C == null ? 25 : opts.T_C;
    var f = fugacity_CO2(opts.pCO2_bar, T_C);
    var kH = 0.0344 * Math.pow(10, -0.0085 * (T_C - 25));
    var co2_aq = kH * f;
    var K1 = Math.pow(10, -(6.351 - 1.94e-3 * T_C));
    var A = (opts.bicarbonate_mg_l == null ? 0 : opts.bicarbonate_mg_l) / (61.017 * 1000);
    var disc = A * A + 4 * K1 * co2_aq;
    var h = Math.max(1e-12, (-A + Math.sqrt(disc)) / 2);
    var h0 = Math.sqrt(K1 * co2_aq);
    return {
      pH_in_situ: -Math.log10(h),
      pH_pure_water: -Math.log10(Math.max(1e-12, h0))
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // SWEET / SOUR / MIXED REGIME — Pots ratio map
  //   ratio = pCO2/pH2S : >500 sweet, 20..500 mixed, <20 sour.
  //   Pots CORROSION/02-02235; Smith & Joosten CORROSION/06-06115.
  // ══════════════════════════════════════════════════════════════════════
  function co2H2SRegime(pCO2_bar, pH2S_bar) {
    if (pH2S_bar <= 0) {
      return {
        regime: 'sweet', ratio: Infinity, product: 'FeCO3 (siderite)',
        model: 'de Waard / NORSOK M-506 (pure CO2)'
      };
    }
    var ratio = pCO2_bar / pH2S_bar;
    if (ratio > 500) {
      return {
        regime: 'sweet', ratio: ratio, product: 'FeCO3 (siderite)',
        model: 'de Waard / NORSOK M-506 (CO2 controls)'
      };
    }
    if (ratio >= 20) {
      return {
        regime: 'mixed', ratio: ratio, product: 'FeCO3 + FeS (mixed scale)',
        model: 'Mixed — CO2 models unreliable; FeS film usually lowers rate'
      };
    }
    return {
      regime: 'sour', ratio: ratio, product: 'FeS (mackinawite)',
      model: 'Sour/H2S model + NACE MR0175 / ISO 15156 cracking checks'
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // CORROSION-ALLOWANCE + REQUIRED-INHIBITOR-EFFICIENCY SIZING
  //   Matches the InhibitionPanel bookkeeping on the console page.
  //   consumed = CR * life ; eta_req = max(0, 1 - CA/consumed).
  // opts: { cr, designLifeYr, caMm }
  // ══════════════════════════════════════════════════════════════════════
  function allowance(opts) {
    var cr = Math.max(0, opts.cr == null ? 0 : opts.cr);
    var life = opts.designLifeYr == null ? 20 : opts.designLifeYr;
    var CA = opts.caMm == null ? 3 : opts.caMm;
    var consumed = cr * life;
    var ok = consumed <= CA;
    var etaReq = consumed > 0 ? Math.max(0, 1 - CA / consumed) : 0;
    return {
      uninhibited_CR_mmpy: cr,
      designLifeYr: life,
      caMm: CA,
      consumed_mm: consumed,
      ca_sufficient: ok,
      verdict: ok ? 'CA SUFFICIENT' : 'INHIBITION NEEDED',
      required_inhibitor_efficiency: etaReq, // fraction 0..1
      required_inhibitor_efficiency_pct: etaReq * 100,
      // inhibited CR at typical achievable availabilities
      inhibited_CR_90: cr * 0.10,
      inhibited_CR_95: cr * 0.05,
      inhibited_CR_99: cr * 0.01,
      // field availability >~95% is hard to sustain
      achievable: etaReq <= 0.95
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // EROSIONAL VELOCITY — API RP 14E
  //   Ve = C / sqrt(rho_mix)  [ft/s, lb/ft^3];  SI: Ve[m/s] = 1.22*C/sqrt(rho[kg/m^3]).
  //   C ~ 100 for continuous solids-free service (conservative); 150-200 where
  //   corrosion is controlled (inhibited CS / CRA). High velocity also strips the
  //   protective FeCO3 film and accelerates the CO2 corrosion modelled above.
  // ══════════════════════════════════════════════════════════════════════
  function erosionalVelocity(opts) {
    opts = opts || {};
    var rho = opts.rho_kg_m3 == null ? 1025 : opts.rho_kg_m3;   // produced-brine default
    var u = opts.velocity_ms;
    var Cc = opts.cContinuous == null ? 100 : opts.cContinuous;
    var Cr = opts.cControlled == null ? 200 : opts.cControlled;
    var Ve_c = 1.22 * Cc / Math.sqrt(Math.max(1, rho));
    var Ve_r = 1.22 * Cr / Math.sqrt(Math.max(1, rho));
    var status = null, ratio = null;
    if (u != null && isFinite(u)) {
      ratio = u / Ve_c;
      status = u <= Ve_c ? 'below continuous limit'
             : u <= Ve_r ? 'above C=100 — needs corrosion control / CRA'
             : 'above C=200 — erosion-corrosion likely';
    }
    return {
      Ve_continuous_ms: Ve_c, Ve_controlled_ms: Ve_r, velocity_ms: u,
      ratio_to_continuous: ratio, status: status, rho_kg_m3: rho,
      cContinuous: Cc, cControlled: Cr,
      ref: 'API RP 14E (Ve = C/sqrt(rho_mix)); liquid/brine basis.'
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // VERDICT — same bands the console page uses on CR_max
  // ══════════════════════════════════════════════════════════════════════
  function verdictFor(CR_max) {
    if (CR_max < 0.1) return 'PASS — negligible CR (< 0.1 mm/y)';
    if (CR_max < 1) return 'WATCH — moderate CR (0.1-1 mm/y)';
    if (CR_max < 5) return 'CRA candidate — high CR (1-5 mm/y)';
    return 'CRA mandatory — severe CR (> 5 mm/y)';
  }

  // ══════════════════════════════════════════════════════════════════════
  // assess() — unified entry point. Runs every model on one operating point.
  //
  //   CO2.assess({ T, pCO2, pH, velocity, pipeID, fe2, pH2S, waterCut,
  //                oilType, ageH, glycol, bicarbonate, designLifeYr, caMm })
  //
  //   pH is optional: if omitted, in-situ pH is computed from pCO2/T/bicarb
  //   (Crolet-Bonis). Returns { models, pH_insitu, feco3_st, crMax, crMin,
  //   verdict, ... }.
  // ══════════════════════════════════════════════════════════════════════
  function assess(o) {
    o = o || {};
    var T_C = num(o.T, num(o.T_C, 60));
    var pCO2 = num(o.pCO2, num(o.pCO2_bar, 5));
    var u = num(o.velocity, num(o.u_m_s, 1.0));
    var d = num(o.pipeID, num(o.d_pipe_m, 0.1));
    var fe2 = num(o.fe2, num(o.Fe2_ppm, 10));
    var pH2S = num(o.pH2S, num(o.pH2S_bar, 0));
    var waterCut = num(o.waterCut, num(o.water_cut, 0.5));
    var oilType = o.oilType || o.oil_type || 'crude';
    var ageH = num(o.ageH, num(o.age_h, 8760));
    var glycol = num(o.glycol, num(o.X_glycol, 0));
    var bicarb = num(o.bicarbonate, num(o.bicarbonate_mg_l, 0));

    // in-situ pH (Crolet-Bonis); fall back to user-supplied if given
    var ph = co2InSituPH({ pCO2_bar: pCO2, T_C: T_C, bicarbonate_mg_l: bicarb });
    var pH = (o.pH != null && isFinite(o.pH)) ? o.pH : ph.pH_in_situ;
    var pH_sat = pH_carbonic(pCO2, T_C);

    var m1 = deWaard1975(T_C, pCO2);
    var m2 = deWaard1995({ T_C: T_C, pCO2_bar: pCO2, u_m_s: u, d_pipe_m: d, pH: pH, X_glycol: glycol, applyScale: true });
    var m3 = norsokM506({ T_C: T_C, pCO2_bar: pCO2, u_m_s: u, d_pipe_m: d, pH: pH });
    var m4 = nescCassandra({ T_C: T_C, pCO2_bar: pCO2, u_m_s: u, pH: pH, Fe2_ppm: fe2, water_cut: waterCut, oil_type: oilType });
    var m5 = multicorpFreeCorp({ T_C: T_C, pCO2_bar: pCO2, pH2S_bar: pH2S, pH: pH, u_m_s: u, age_h: ageH, Fe2_ppm: fe2 });

    var scale = feCO3_scaling_tendency({ T_C: T_C, pCO2_bar: pCO2, pH: pH, Fe2_ppm: fe2, CR_mmpy: m3.CR_mmpy });
    var regime = co2H2SRegime(pCO2, pH2S);

    var models = [
      {
        name: 'De Waard-Milliams 1975', id: 'DWM-1975', kind: 'classical',
        cr: m1,
        decomposition: { formula: 'log CR = 5.8 - 1710/T(K) + 0.67*log10(pCO2)' },
        ref: 'De Waard & Milliams, Corrosion 31 (1975) 177'
      },
      {
        name: 'De Waard 1995', id: 'DWM-1995', kind: 'semi-emp',
        cr: m2.CR_mmpy,
        decomposition: {
          CR_react: m2.CR_react_mmpy, CR_mass: m2.CR_mass_mmpy,
          F_pH: m2.F_pH, F_scale: m2.F_scale, F_glycol: m2.F_glycol
        },
        ref: 'De Waard, Lotz, Dugstad, NACE Corrosion/95 Paper 128'
      },
      {
        name: 'NORSOK M-506', id: 'NORSOK', kind: 'regulator',
        cr: m3.CR_mmpy,
        decomposition: { K_T: m3.K_T, shear_Pa: m3.shear_Pa, f_pH: m3.f_pH },
        ref: 'NORSOK Standard M-506:2017'
      },
      {
        name: 'NESC / Cassandra', id: 'NESC', kind: 'mechanistic',
        cr: m4.CR_mmpy,
        decomposition: {
          CR_baseline: m4.CR_baseline, F_scale: m4.F_scale,
          F_oil: m4.F_oil, F_velocity: m4.F_velocity
        },
        ref: 'Nyborg R., Energy Materials 5 (2010) 91'
      },
      {
        name: 'Multicorp / FreeCorp', id: 'FreeCorp', kind: 'mechanistic',
        cr: m5.CR_mmpy,
        decomposition: {
          CR_react: m5.CR_react_mmpy, F_H2S: m5.F_H2S,
          F_film: m5.F_film, F_v: m5.F_v
        },
        ref: 'Nesic S., Corrosion Sci. 49 (2007) 4308; Sun-Nesic, NACE 09572'
      }
    ];

    var crs = models.map(function (m) { return m.cr; });
    var crMax = Math.max.apply(null, crs.concat([0.01]));
    var crMin = Math.min.apply(null, crs);
    var spread = crMax > 0 ? crMax / Math.max(0.001, crMin) : 1;

    // Standard UQ result schema (ADDITIVE — does not change any field below).
    // Lets the universal disagreement-map / validity-envelope / export layers
    // consume CO2 through the same contract every engine will speak (uq.js).
    var _uq = _UQ();
    var uqResult = _uq ? _uq.buildResult({
      unit: 'mm/y',
      verdict: verdictFor(crMax),
      models: models.map(function (m) { return { name: m.name, id: m.id, value: m.cr, citation: m.ref }; }),
      interval: { lo: crMin, hi: crMax, level: 'model-spread' },
      envelope: _uq.envelopeCheck({ T_C: T_C, pH: pH }, { T_C: [20, 150], pH: [3.5, 6.5] }),
      drivers: _co2Drivers(m2),
      provenance: { basis: 'screening · carbon steel · sweet CO₂', benchmark: 'node benchmark/run.js', standard: 'NORSOK M-506:2017 validity: T 20–150 °C, pH 3.5–6.5' }
    }) : null;

    return {
      models: models,
      uq: uqResult,
      pH_insitu: pH,
      pH_pure_water: ph.pH_pure_water,
      pH_sat: pH_sat,
      feco3_st: scale.ST,
      feco3_sr: scale.SR,
      feco3_protective: scale.protective,
      regime: regime,
      crMax: crMax,
      crMin: crMin,
      spread: spread,
      verdict: verdictFor(crMax),
      inputs: {
        T_C: T_C, pCO2_bar: pCO2, pH: pH, u_m_s: u, d_pipe_m: d,
        Fe2_ppm: fe2, pH2S_bar: pH2S, water_cut: waterCut,
        oil_type: oilType, age_h: ageH, X_glycol: glycol
      }
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // SWEEP HELPERS — arrays for charting (mirror the console page sweeps)
  // ══════════════════════════════════════════════════════════════════════

  /** CR vs temperature. Returns [{ T, dw1975, dw95, norsok, nesc, freecorp }]. */
  function sweepT(opts) {
    opts = opts || {};
    var Tmin = num(opts.Tmin, 20);
    var Tmax = num(opts.Tmax, 150);
    var n = Math.max(2, num(opts.n, 53));
    var pCO2 = num(opts.pCO2, num(opts.pCO2_bar, 5));
    var u = num(opts.velocity, num(opts.u_m_s, 1.0));
    var d = num(opts.pipeID, num(opts.d_pipe_m, 0.1));
    var fe2 = num(opts.fe2, num(opts.Fe2_ppm, 10));
    var waterCut = num(opts.waterCut, num(opts.water_cut, 0.5));
    var oilType = opts.oilType || opts.oil_type || 'crude';
    var pH2S = num(opts.pH2S, num(opts.pH2S_bar, 0));
    var ageH = num(opts.ageH, num(opts.age_h, 8760));
    var glycol = num(opts.glycol, num(opts.X_glycol, 0));
    var pHfixed = (opts.pH != null && isFinite(opts.pH)) ? opts.pH : null;
    var bicarb = num(opts.bicarbonate, num(opts.bicarbonate_mg_l, 0));

    var out = [];
    for (var i = 0; i < n; i++) {
      var T = Tmin + (Tmax - Tmin) * (i / (n - 1));
      var pH = pHfixed != null ? pHfixed : co2InSituPH({ pCO2_bar: pCO2, T_C: T, bicarbonate_mg_l: bicarb }).pH_in_situ;
      out.push({
        T: T,
        dw1975: deWaard1975(T, pCO2),
        dw95: deWaard1995({ T_C: T, pCO2_bar: pCO2, u_m_s: u, d_pipe_m: d, pH: pH, X_glycol: glycol, applyScale: true }).CR_mmpy,
        norsok: norsokM506({ T_C: T, pCO2_bar: pCO2, u_m_s: u, d_pipe_m: d, pH: pH }).CR_mmpy,
        nesc: nescCassandra({ T_C: T, pCO2_bar: pCO2, u_m_s: u, pH: pH, Fe2_ppm: fe2, water_cut: waterCut, oil_type: oilType }).CR_mmpy,
        freecorp: multicorpFreeCorp({ T_C: T, pCO2_bar: pCO2, pH2S_bar: pH2S, pH: pH, u_m_s: u, age_h: ageH, Fe2_ppm: fe2 }).CR_mmpy
      });
    }
    return out;
  }

  /** CR vs CO2 partial pressure (log-spaced). Returns same series keyed by pCO2. */
  function sweepPCO2(opts) {
    opts = opts || {};
    var pMin = num(opts.pMin, 0.1);
    var pMax = num(opts.pMax, 100);
    var n = Math.max(2, num(opts.n, 53));
    var T = num(opts.T, num(opts.T_C, 60));
    var u = num(opts.velocity, num(opts.u_m_s, 1.0));
    var d = num(opts.pipeID, num(opts.d_pipe_m, 0.1));
    var fe2 = num(opts.fe2, num(opts.Fe2_ppm, 10));
    var waterCut = num(opts.waterCut, num(opts.water_cut, 0.5));
    var oilType = opts.oilType || opts.oil_type || 'crude';
    var pH2S = num(opts.pH2S, num(opts.pH2S_bar, 0));
    var ageH = num(opts.ageH, num(opts.age_h, 8760));
    var glycol = num(opts.glycol, num(opts.X_glycol, 0));
    var pHfixed = (opts.pH != null && isFinite(opts.pH)) ? opts.pH : null;
    var bicarb = num(opts.bicarbonate, num(opts.bicarbonate_mg_l, 0));

    var lpMin = Math.log10(pMin), lpMax = Math.log10(pMax);
    var out = [];
    for (var i = 0; i < n; i++) {
      var pCO2 = Math.pow(10, lpMin + (lpMax - lpMin) * (i / (n - 1)));
      var pH = pHfixed != null ? pHfixed : co2InSituPH({ pCO2_bar: pCO2, T_C: T, bicarbonate_mg_l: bicarb }).pH_in_situ;
      out.push({
        pCO2: pCO2,
        dw1975: deWaard1975(T, pCO2),
        dw95: deWaard1995({ T_C: T, pCO2_bar: pCO2, u_m_s: u, d_pipe_m: d, pH: pH, X_glycol: glycol, applyScale: true }).CR_mmpy,
        norsok: norsokM506({ T_C: T, pCO2_bar: pCO2, u_m_s: u, d_pipe_m: d, pH: pH }).CR_mmpy,
        nesc: nescCassandra({ T_C: T, pCO2_bar: pCO2, u_m_s: u, pH: pH, Fe2_ppm: fe2, water_cut: waterCut, oil_type: oilType }).CR_mmpy,
        freecorp: multicorpFreeCorp({ T_C: T, pCO2_bar: pCO2, pH2S_bar: pH2S, pH: pH, u_m_s: u, age_h: ageH, Fe2_ppm: fe2 }).CR_mmpy
      });
    }
    return out;
  }

  // ── small numeric coalescer: first finite of (v, fallback) ──────────────
  function num(v, fallback) {
    return (v != null && isFinite(v)) ? Number(v) : fallback;
  }

  // ── UQ framework resolver (browser global or Node require; cached) ───────
  var _uqCache;
  function _UQ() {
    if (_uqCache !== undefined) return _uqCache;
    var u = null;
    if (typeof window !== 'undefined' && window.UQ) u = window.UQ;
    else if (typeof require === 'function') { try { u = require('./uq.js'); } catch (e) { u = null; } }
    _uqCache = u; return u;
  }

  // ── CO2 rate drivers (what is moving the number) — read off the de Waard-95
  //    decomposition; surfaced in the standard UQ schema for the engineer. ──
  function _co2Drivers(m2) {
    function r2(x) { return Math.round(x * 100) / 100; }
    var d = [];
    if (m2 && m2.F_scale < 0.7) d.push({ name: 'FeCO₃ scaling', effect: 'suppresses rate', factor: r2(m2.F_scale) });
    if (m2 && m2.F_pH < 0.7) d.push({ name: 'in-situ pH', effect: 'suppresses rate', factor: r2(m2.F_pH) });
    if (m2 && m2.F_glycol < 0.95) d.push({ name: 'glycol/MEG', effect: 'suppresses rate', factor: r2(m2.F_glycol) });
    if (m2) d.push({ name: 'flow regime', effect: (m2.CR_mass_mmpy < m2.CR_react_mmpy ? 'mass-transfer limited (flow-sensitive)' : 'reaction limited') });
    return d;
  }

  // ── Math.log10 polyfill (older engines) ─────────────────────────────────
  if (typeof Math.log10 !== 'function') {
    Math.log10 = function (x) { return Math.log(x) / Math.LN10; };
  }

  // ══════════════════════════════════════════════════════════════════════
  // EXPORT
  // ══════════════════════════════════════════════════════════════════════
  var CO2 = {
    // unified API
    assess: assess,
    sweepT: sweepT,
    sweepPCO2: sweepPCO2,
    allowance: allowance,
    erosionalVelocity: erosionalVelocity,
    // individual models
    deWaard1975: deWaard1975,
    deWaard1995: deWaard1995,
    norsokM506: norsokM506,
    nescCassandra: nescCassandra,
    multicorpFreeCorp: multicorpFreeCorp,
    // chemistry / scaling
    feCO3_scaling_tendency: feCO3_scaling_tendency,
    co2InSituPH: co2InSituPH,
    co2H2SRegime: co2H2SRegime,
    pH_carbonic: pH_carbonic,
    fugacity_CO2: fugacity_CO2,
    K_H_CO2: K_H_CO2,
    verdictFor: verdictFor
  };

  global.CO2 = CO2;
  // also expose under module.exports when run in Node for validation
  if (typeof module !== 'undefined' && module.exports) module.exports = CO2;

})(typeof window !== 'undefined' ? window : this);
