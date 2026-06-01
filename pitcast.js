/* PitCast engine — faithful in-browser port of the calibrated Python models.
   Constants extracted from the validated pitcast package (124 tests). Screening-
   grade; cited/flagged in the Python VALIDATION_LOG. */

// ---- calibrated constants (from fit_cpt_pren_model N30 + modules) -----------
// CPT correlation refit on 51 cited ASTM G48-type (FeCl3 immersion) records from the
// Nyby 2021 open dataset: CPT = 2.038*PREN_N30 - 32.73 (R2=0.83, residual SE 8.0 C, df=49).
// Replaces the earlier 9-point handbook calibration; reported on an ASTM G48 (6% FeCl3) basis.
const CPT = { slope: 2.038176, intercept: -32.730883, resid: 8.033109,
              prenMean: 36.1689, sxx: 3821.5641, n: 51, prenMin: 18.24, prenMax: 65.55 };
// SECOND CPT correlation on a DISTINCT basis: electrochemical (potentiodynamic) CPT in chloride,
// n=123 austenitic-SS records (npj Materials Degradation 2025, DOI 10.1038/s41529-025-00563-0;
// leave-one-out MAE 6.11 C, R2 0.93). NEVER merged with the G48/FeCl3 model above — the two scale
// differently with PREN (slope 4.10 vs 2.04). Reported as a separate, broader-coverage estimate.
const CPT_ELEC = { slope: 4.0958, intercept: -96.223, resid: 7.450,
                   prenMean: 31.06, sxx: 5478.4, n: 123, prenMin: 23.9, prenMax: 47.2 };
const C_SIGMA_CPT = 5.0, SIGMA_CR = 30.0, SIGMA_MO = 8.0;
const SIGMA = { Tlow: 600, Thigh: 1000, Tnose: 850, W: 110, jmakN: 1.5, feq: 0.12,
                tauRef: 3.0, prenRef: 35.0, kPren: 0.43, tauMin: 0.005,
                // Single-phase austenitic / Ni-base alloys: sigma nucleates from austenite
                // (no delta-ferrite to accelerate it), so the TTT nose sits HIGHER (~900 C,
                // sensitive range ~875-1050 C) and kinetics are several-fold SLOWER than
                // ferrite-bearing duplex/ferritic. Refs: Hsieh & Wu, ISRN Mater. Sci. 2012
                // (732471); Sourmail, Mater. Sci. Technol. 17 (2001) 1; 20Cr-24Ni-6Mo TTT
                // nose 875-925 C. Without this the high-Mo super-austenitics wrongly lost CPT
                // at 600 C (faster than super-duplex, which is backwards).
                // narrower nose too: the super-austenitic sensitive band (~875-1025 C) is
                // tighter than duplex's (~600-1000 C), so sigma falls off faster below the nose.
                austTnose: 900, austTlow: 700, austThigh: 1050, austSlow: 6.0, austW: 70 };
const CL_SCC = {
  austenitic:   { T: 60,  Cl: 50,    stress: 0.30 },
  duplex:       { T: 130, Cl: 1000,  stress: 0.50 },
  super_duplex: { T: 150, Cl: 1500,  stress: 0.60 },
  ferritic:     { T: 300, Cl: 1e6,   stress: 0.90 },
  nickel:       { T: 250, Cl: 1e5,   stress: 0.80 },
  Tscale: 15, ClScale: 0.5, Sscale: 0.08 };
// ISO 15156-3 max hardness by CRA family (Vickers): 22 HRC->250 HV (austenitic/ferritic),
// 28 HRC->~290 HV (duplex), 35-40 HRC->~360 HV (Ni-base). Replaces the carbon-steel ladder.
const SOUR = { threshold: 0.3,
  hvByFamily: { austenitic: 250, ferritic: 250, duplex: 290, super_duplex: 290, nickel: 360 },
  hvSd: 15 };
const PRICE = { Fe:0.6, Cr:10, Ni:17, Mo:53, W:35, Nb:45, Cu:9, Mn:2, Si:1.5, Co:40, N:0, C:0 };
const REF304_COST = 3.6295;

const GRADES_BUILTIN = [
  { uns:"S30403", name:"304L", comp:{Cr:18.0,Ni:9.0,Mo:0.0,N:0.06,Mn:1.6,C:0.02,Si:0.45} },
  { uns:"S31603", name:"316L", comp:{Cr:17.0,Ni:10.0,Mo:2.1,N:0.05,Mn:1.6,C:0.02,Si:0.45} },
  { uns:"S31703", name:"317L", comp:{Cr:18.5,Ni:13.0,Mo:3.1,N:0.06,Mn:1.6,C:0.02,Si:0.45} },
  { uns:"N08904", name:"904L", comp:{Cr:20.0,Ni:25.0,Mo:4.3,N:0.05,Cu:1.5,Mn:1.6,C:0.01} },
  { uns:"S31254", name:"254 SMO", comp:{Cr:20.0,Ni:18.0,Mo:6.1,N:0.20,Cu:0.7,Mn:0.5,C:0.01} },
  { uns:"N08367", name:"AL-6XN", comp:{Cr:20.5,Ni:24.0,Mo:6.3,N:0.22,Mn:0.4,C:0.02} },
  { uns:"S32205", name:"2205", comp:{Cr:22.0,Ni:5.7,Mo:3.1,N:0.17,Mn:1.5,C:0.02} },
  { uns:"S32750", name:"2507", comp:{Cr:25.0,Ni:7.0,Mo:3.8,N:0.27,Mn:0.5,C:0.02} },
  { uns:"S32760", name:"Zeron 100", comp:{Cr:25.0,Ni:7.0,Mo:3.6,W:0.6,Cu:0.7,N:0.25,Mn:0.5,C:0.02} },
  { uns:"S32707", name:"2707 HD", comp:{Cr:27.0,Ni:6.5,Mo:4.8,N:0.40,Mn:1.0,C:0.02} },
  { uns:"N06625", name:"Alloy 625", comp:{Cr:21.5,Ni:61.0,Mo:9.0,Nb:3.6,Fe:3.0,N:0.0} },
  { uns:"N10276", name:"C-276", comp:{Cr:16.0,Ni:57.0,Mo:16.0,W:3.75,Fe:5.0,N:0.0} },
];

// Live data: grades + real measured records are loaded at runtime from data/*.json
// (falls back to the built-in 12 if the fetch fails). This is the "data-driven"
// fix — the catalogue is no longer hard-coded.
let GRADES = GRADES_BUILTIN;
let MEASUREMENTS = [];
function setGrades(g){ GRADES = (g && g.length) ? g : GRADES_BUILTIN; }
function setMeasurements(m){ MEASUREMENTS = m || []; }
// Real measured CPT (literature) for a grade, matched by UNS or grade name in the
// material code (codes in the source mix UNS, names, and lab heat IDs).
const _UNS_ALIAS = { S32205: ["S31803"] };   // 2205 current/old UNS
function measuredCPT(uns, name){
  const u = (uns || "").toUpperCase();
  const keys = [u, ...(_UNS_ALIAS[u] || [])].filter(Boolean);
  const nm = (name || "").toUpperCase().trim();
  const vals = MEASUREMENTS.filter(r => {
    if (r.metric !== "CPT" || !r.code) return false;
    const c = String(r.code).toUpperCase();
    if (keys.some(k => c.includes(k))) return true;
    if (nm.length >= 3 && (c === nm || c.split(/[^A-Z0-9.]+/).includes(nm))) return true;
    return false;
  }).map(r => r.value);
  if (!vals.length) return null;
  return { n: vals.length, min: Math.min(...vals), max: Math.max(...vals),
           avg: vals.reduce((a, b) => a + b, 0) / vals.length };
}

// ---- helpers ----------------------------------------------------------------
const v = (c, el) => c[el] || 0;
const logistic = x => 1 / (1 + Math.exp(-x));
function erf(x){ const t=1/(1+0.3275911*Math.abs(x));
  const y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x);
  return x>=0?y:-y; }
const normCDF = z => 0.5*(1+erf(z/Math.SQRT2));
// Student-t CDF — matches the validated Python prediction interval (df = n-2). Using the
// Gaussian here under-states the tail at small n (the live engine was ~2x overconfident).
function _gln(x){ const g=[76.18009172947146,-86.50532032941677,24.01409824083091,-1.231739572450155,0.1208650973866179e-2,-0.5395239384953e-5];
  let y=x, tmp=x+5.5; tmp-=(x+0.5)*Math.log(tmp); let s=1.000000000190015;
  for(let j=0;j<6;j++){ y++; s+=g[j]/y; } return -tmp+Math.log(2.5066282746310005*s/x); }
function _betacf(a,b,x){ const FPMIN=1e-300; let qab=a+b,qap=a+1,qam=a-1,c=1,d=1-qab*x/qap;
  if(Math.abs(d)<FPMIN)d=FPMIN; d=1/d; let h=d;
  for(let m=1;m<=200;m++){ const m2=2*m;
    let aa=m*(b-m)*x/((qam+m2)*(a+m2)); d=1+aa*d; if(Math.abs(d)<FPMIN)d=FPMIN; c=1+aa/c; if(Math.abs(c)<FPMIN)c=FPMIN; d=1/d; h*=d*c;
    aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2)); d=1+aa*d; if(Math.abs(d)<FPMIN)d=FPMIN; c=1+aa/c; if(Math.abs(c)<FPMIN)c=FPMIN; d=1/d; const del=d*c; h*=del;
    if(Math.abs(del-1)<1e-12) break; }
  return h; }
function _ibeta(x,a,b){ if(x<=0)return 0; if(x>=1)return 1;
  const bt=Math.exp(_gln(a+b)-_gln(a)-_gln(b)+a*Math.log(x)+b*Math.log(1-x));
  return x<(a+1)/(a+b+2) ? bt*_betacf(a,b,x)/a : 1-bt*_betacf(b,a,1-x)/b; }
const tCDF = (t, df) => { const ib=0.5*_ibeta(df/(df+t*t), df/2, 0.5); return t>=0 ? 1-ib : ib; };

// ---- materials science ------------------------------------------------------
const pren   = c => v(c,"Cr") + 3.3*v(c,"Mo") + 16*v(c,"N");                 // reported (N16)
const prenW  = c => v(c,"Cr") + 3.3*(v(c,"Mo")+0.5*v(c,"W")) + 16*v(c,"N");
const prenN30= c => v(c,"Cr") + 3.3*v(c,"Mo") + 30*v(c,"N");                 // CPT descriptor

function ferritePct(c){
  const creq = v(c,"Cr")+v(c,"Mo")+0.7*v(c,"Nb");
  const nieq = v(c,"Ni")+35*v(c,"C")+20*v(c,"N")+0.25*v(c,"Cu");
  return Math.max(0, Math.min(100, 5.4*(creq-nieq)-35));
}
function inferFamily(c){
  if (v(c,"Ni")>=30) return "nickel";
  const f = ferritePct(c);
  if (f>=30){ if (v(c,"N")<0.06) return "ferritic";   // high ferrite + ~no N = ferritic, not duplex
              return pren(c)>=40 ? "super_duplex" : "duplex"; }
  if (f<=10 && v(c,"Ni")>=6) return "austenitic";
  return "ferritic";
}
function sigmaFraction(c, T, t){
  if (t<=0) return 0;
  const fam = inferFamily(c);
  const aust = (fam==="austenitic" || fam==="nickel");   // single-phase: higher nose, slower
  const Tnose = aust ? SIGMA.austTnose : SIGMA.Tnose;
  const Tlow  = aust ? SIGMA.austTlow  : SIGMA.Tlow;
  const Thigh = aust ? SIGMA.austThigh : SIGMA.Thigh;
  const slow  = aust ? SIGMA.austSlow  : 1;
  const W     = aust ? SIGMA.austW     : SIGMA.W;
  if (T<Tlow || T>Thigh) return 0;
  const rate = Math.exp(-Math.pow((T-Tnose)/W,2));
  if (rate<1e-6) return 0;
  const tauNose = slow*Math.max(SIGMA.tauMin, SIGMA.tauRef*Math.exp(-SIGMA.kPren*(pren(c)-SIGMA.prenRef)));
  const tau = tauNose/rate;
  return Math.max(0, Math.min(SIGMA.feq, SIGMA.feq*(1-Math.exp(-Math.pow(t/tau,SIGMA.jmakN)))));
}

// ---- CPT (pitting) ----------------------------------------------------------
function cptMean(c){ return CPT.slope*prenN30(c) + CPT.intercept; }
function cptSE(c){
  const p = prenN30(c);
  return CPT.resid*Math.sqrt(1 + 1/CPT.n + Math.pow(p-CPT.prenMean,2)/CPT.sxx);
}
// Electrochemical (potentiodynamic) basis CPT — separate correlation (see CPT_ELEC, n=123).
function cptMeanElec(c){ return CPT_ELEC.slope*prenN30(c) + CPT_ELEC.intercept; }
function cptSEElec(c){
  const p = prenN30(c);
  return CPT_ELEC.resid*Math.sqrt(1 + 1/CPT_ELEC.n + Math.pow(p-CPT_ELEC.prenMean,2)/CPT_ELEC.sxx);
}
// CPT chloride dependence (screening). CPT falls ~linearly with log[Cl-]; slope B ~ 24 C per
// decade (Abd El Meguid & Abd El Latif, Corros. Sci. 49 (2007) 263: Type 254 SMO CPT 89/67/57 C
// at 4/10/30 wt% NaCl). Anchored at the ASTM G48 6% FeCl3 reference, ~1.1 mol/L Cl-; the ferric
// oxidiser makes G48 more aggressive than NaCl at equal [Cl-], so the anchor is conservative.
// Clamped: the curve flattens above ~5-6 M (Ernst & Newman, Corros. Sci. 49 (2007) 3705) and the
// dilute-side rise is capped to avoid unphysical extrapolation.
const CL_CPT = { B: 24.0, ClRef_M: 1.1, ppmPerMol: 35450, adjMin: -15, adjMax: 40 };
function cptChlorideAdj(Cl_ppm){
  if (Cl_ppm == null || !(Cl_ppm > 0)) return 0;        // no chloride given -> G48 basis
  const Cl_M = Cl_ppm / CL_CPT.ppmPerMol;
  const adj = CL_CPT.B * Math.log10(CL_CPT.ClRef_M / Cl_M);
  return Math.max(CL_CPT.adjMin, Math.min(CL_CPT.adjMax, adj));
}
// P(pit) = P(CPT < T_service); CPT = G48 PREN fit + chloride term - sigma degradation.
// Clamped to a physical aqueous-service window: >=120 C means effectively immune to pitting
// in practical aqueous service (the test electrolyte boils), so the exact value above that is
// not meaningful; <=-15 C means it pits at any service temperature.
const CPT_CEIL = 120, CPT_FLOOR = -15;
// Honest-precision caveat carried on every CPT result: a SCREENING correlation fit on
// n=51 ASTM G48 points (leave-one-out MAE 6.58 C). The Student-t prediction interval (se),
// not the point CPT, is the decision-relevant output — never over-trust a single value.
const CPT_SCREENING = "SCREENING correlation (CPT = 2.038*PREN_N30 - 32.73), fit on n=51 ASTM G48 " +
  "points; leave-one-out MAE 6.58 C. The point CPT carries real scatter — read the prediction " +
  "interval (from se), not the bare value, and confirm critical selections with alloy/heat-specific G48 testing.";
function pPit(c, Tservice, aged, Cl){
  let mean = cptMean(c) + cptChlorideAdj(Cl), fsig = 0;
  if (aged && aged.t>0){ fsig = sigmaFraction(c, aged.T, aged.t); mean -= C_SIGMA_CPT*fsig*100; }
  const capped = mean > CPT_CEIL;
  mean = Math.max(CPT_FLOOR, Math.min(CPT_CEIL, mean));
  const p = tCDF((Tservice-mean)/cptSE(c), CPT.n - 2);   // Student-t (df=n-2), matches Python
  return { p, cptLocal: mean, fsig, se: cptSE(c), capped, screening: CPT_SCREENING };
}

// ---- chloride SCC -----------------------------------------------------------
function clSCC(family, T, Cl, stress){
  const th = CL_SCC[family] || CL_SCC.austenitic;
  const cl = Math.max(Cl, 1e-6);
  const gT = logistic((T-th.T)/CL_SCC.Tscale);
  const gC = logistic((Math.log10(cl)-Math.log10(th.Cl))/CL_SCC.ClScale);
  const gS = logistic((stress-th.stress)/CL_SCC.Sscale);
  return gT*gC*gS;
}

// ---- sour SSC ---------------------------------------------------------------
// Coarse sour-severity tier (1 mild .. 3 severe). NOTE: for CRAs the binding criterion is the
// per-family hardness limit below (ISO 15156-3), not this tier — qualification still requires the
// alloy-specific T/Cl/pH2S/S envelope in ISO 15156-3.
function sourRegion(pp, pH){
  if (pp<SOUR.threshold) return 0;
  if (pp>=10 || pH<3.5) return 3;
  if (pp>=1  || pH<4.5) return 2;
  return 1;
}
function sourFail(HV, pp, pH, family){
  if (pp<SOUR.threshold) return { sour:false, region:0, pFail:0 };
  const region = sourRegion(pp, pH);
  const lim = SOUR.hvByFamily[family] || SOUR.hvByFamily.austenitic;
  const pass = normCDF((lim - HV)/SOUR.hvSd);
  return { sour:true, region, pFail: 1-pass };
}

// ISO 15156-3:2020 Annex A "use-without-further-testing" sour envelopes — SCREENING ONLY.
// Limits apply collectively (T, pH2S, Cl all simultaneously), for production service, and the
// per-table metallurgical condition (hardness/ferrite/PREN) must also hold. Each group is a
// ladder of {T:max degC, pp:max kPa H2S}; the alloy qualifies if ANY row's caps both hold.
// Compiled from ISO 15156-3:2020 (Tables A.2/A.8/A.14/A.24) + Swagelok MS-06-124 RevB / Sandvik.
const ISO_SOUR = {
  austenitic_std:  { label:"austenitic SS (A.2)",            rows:[{T:60,pp:100},{T:90,pp:1},{T:149,pp:10}], cite:"ISO 15156-3 A.2" },
  super_aust_6mo:  { label:"6Mo super-austenitic (A.8)",     rows:[{T:60,pp:100}], cite:"ISO 15156-3 A.8" },
  duplex_22:       { label:"duplex FPREN 30-40 (A.24)",      rows:[{T:232,pp:10}], cite:"ISO 15156-3 A.24" },
  super_duplex_25: { label:"super-duplex FPREN 40-45 (A.24)",rows:[{T:232,pp:20}], maxCl:120000, cite:"ISO 15156-3 A.24" },
  ni_fecrmo_825:   { label:"Ni-Fe-Cr-Mo, 825 type (A.14)",   rows:[{T:232,pp:200},{T:218,pp:700},{T:204,pp:1000},{T:177,pp:1400},{T:132,pp:1e9}], cite:"ISO 15156-3 A.14" },
  ni_crmonb_625:   { label:"Ni-Cr-Mo-Nb, 625 type (A.14)",   rows:[{T:232,pp:200},{T:218,pp:2000},{T:149,pp:1e9}], cite:"ISO 15156-3 A.14" },
  ni_crmo_c276:    { label:"Ni-Cr-Mo high-Mo, C-276 (A.14)", rows:[{T:232,pp:7000},{T:204,pp:1e9}], cite:"ISO 15156-3 A.14" },
};
function isoGroup(family, c){
  const Mo=v(c,"Mo"), Fe=v(c,"Fe"), Ni=v(c,"Ni");
  if (family==="nickel" || Ni>=30){
    if (Mo>=12) return "ni_crmo_c276";
    if (Fe>=15 && Mo<5) return "ni_fecrmo_825";
    return "ni_crmonb_625";
  }
  if (family==="duplex" || family==="super_duplex") return prenW(c)>=40 ? "super_duplex_25" : "duplex_22";
  if (family==="austenitic") return Mo>=5.5 ? "super_aust_6mo" : "austenitic_std";
  return null;   // ferritic / martensitic: not screened here
}
function isoSourCheck(family, c, svc){
  if (svc.pH2S==null || svc.pH2S<SOUR.threshold) return null;     // not sour service
  const key=isoGroup(family,c);
  if (!key) return { group:null, status:"untabulated", cite:"ISO 15156-3" };
  const g=ISO_SOUR[key];
  const clOk = !g.maxCl || svc.Cl==null || svc.Cl<=g.maxCl;
  const within = clOk && g.rows.some(r => svc.T<=r.T && svc.pH2S<=r.pp);
  const maxT=Math.max(...g.rows.map(r=>r.T));
  const reason = within ? null
    : (!clOk ? ("Cl "+svc.Cl+" mg/L > "+g.maxCl+" cap")
    : (svc.T>maxT ? ("T "+svc.T+"°C > "+maxT+"°C cap")
    : ("pH2S "+svc.pH2S+" kPa exceeds the cap at "+svc.T+"°C")));
  return { group:g.label, status: within?"within":"exceeds", maxT, reason, cite:g.cite };
}

// ---- cost -------------------------------------------------------------------
function relativeCost(c){
  let total = 0, sum = 0;
  for (const el in c) if (el!=="Fe"){ total += (PRICE[el]||0)*c[el]/100; sum += c[el]; }
  const fe = Math.max(0, 100-sum);
  total += PRICE.Fe*fe/100;
  if (c.Fe) total += PRICE.Fe*c.Fe/100;   // explicit Fe (Ni-base)
  return total/REF304_COST;
}

// ---- unified assessment -----------------------------------------------------
function assess(c, svc){
  const family = svc.family || inferFamily(c);
  const aged = (svc.ageT && svc.aget) ? { T:svc.ageT, t:svc.aget } : null;
  const pit = pPit(c, svc.T, aged, svc.Cl);
  let pScc = null, pSourFail = null, sour = null;
  if (svc.stress!=null && svc.Cl>0) pScc = clSCC(family, svc.T, svc.Cl, svc.stress);
  if (svc.pH2S>=SOUR.threshold && svc.HV!=null){ sour = sourFail(svc.HV, svc.pH2S, svc.pH, family); pSourFail = sour.pFail; }
  const iso = isoSourCheck(family, c, svc);
  const risks = { pitting: svc.Cl>0?pit.p:null, "chloride-SCC": pScc, "sour-SSC": pSourFail };
  const active = Object.entries(risks).filter(([k,x])=>x!=null);
  const overall = active.length ? Math.max(...active.map(([k,x])=>x)) : 0;
  const dominant = active.length ? active.reduce((a,b)=>b[1]>a[1]?b:a)[0] : "none";
  return { family, pren: pren(c), prenW: prenW(c), ferrite: ferritePct(c),
           cpt: pit.cptLocal, cptG48: cptMean(c), cptSE: pit.se, fsig: pit.fsig, aged: !!aged,
           cptCapped: pit.capped, clAdj: cptChlorideAdj(svc.Cl),
           pPit: svc.Cl>0?pit.p:null, pScc, pSourFail, sourRegion: sour?sour.region:null,
           cost: relativeCost(c), overall, dominant, risks, iso };
}

// ---- selection --------------------------------------------------------------
function selectAlloys(svc, threshold){
  threshold = threshold ?? 0.15;
  const ranked = GRADES.map(g => {
    const a = assess(g.comp, svc);
    return { name:g.name, uns:g.uns, overall:a.overall, dominant:a.dominant, cost:a.cost, a };
  }).sort((x,y)=>x.overall-y.overall);
  const acceptable = ranked.filter(r=>r.overall<=threshold);
  const recommended = acceptable.length
    ? acceptable.reduce((a,b)=>b.cost<a.cost?b:a)   // cheapest that clears
    : (ranked[0]||null);
  return { ranked, acceptable, recommended, threshold };
}

// ---- operating envelope (Material Selection Diagram) ------------------------
// Sweeps the validated assess() engine over a 2-D service window and returns the
// overall-risk surface, the governing (dominant) mechanism at each cell, and the
// ISO 15156-3 status at each cell. This is a pure integration layer over the
// physics above — no new constants. Axes are any of: T (degC), Cl (ppm),
// pH2S (kPa), pH, stress (xYS). Cl and pH2S sweep on a log scale by default.
const _LOG_AXES = { Cl: true, pH2S: true };
function _axisVals(min, max, n, log){
  const out = [];
  for (let i = 0; i < n; i++){
    const t = n > 1 ? i / (n - 1) : 0;
    out.push(log ? Math.pow(10, Math.log10(min) + (Math.log10(max) - Math.log10(min)) * t)
                 : min + (max - min) * t);
  }
  return out;
}
function envelope(c, opts){
  opts = opts || {};
  const xKey = opts.xKey || "T";
  const yKey = opts.yKey || "Cl";
  const n = Math.max(6, Math.min(80, opts.n || 40));
  const xLog = opts.xLog != null ? opts.xLog : !!_LOG_AXES[xKey];
  const yLog = opts.yLog != null ? opts.yLog : !!_LOG_AXES[yKey];
  const fixed = Object.assign({ T:60, Cl:50000, pH:4.5, pH2S:0, stress:0.5, HV:250 }, opts.fixed || {});
  const xs = _axisVals(opts.xMin, opts.xMax, n, xLog);
  const ys = _axisVals(opts.yMin, opts.yMax, n, yLog);
  // per-mechanism surfaces (each may be null where that mechanism is inactive)
  const grid = [], dominant = [], iso = [], pitting = [], scc = [], sour = [];
  for (let j = 0; j < n; j++){
    const row=[], drow=[], irow=[], prow=[], srow=[], qrow=[];
    for (let i = 0; i < n; i++){
      const svc = Object.assign({}, fixed);
      svc[xKey] = xs[i]; svc[yKey] = ys[j];
      const a = assess(c, svc);
      row.push(a.overall); drow.push(a.dominant);
      irow.push(a.iso ? a.iso.status : null);
      prow.push(a.pPit); srow.push(a.pScc); qrow.push(a.pSourFail);
    }
    grid.push(row); dominant.push(drow); iso.push(irow);
    pitting.push(prow); scc.push(srow); sour.push(qrow);
  }
  // operating-point assessment (the fixed point, with the axes at their op value)
  const op = Object.assign({}, fixed);
  if (opts.xOp != null) op[xKey] = opts.xOp;
  if (opts.yOp != null) op[yKey] = opts.yOp;
  return { xKey, yKey, xLog, yLog, xs, ys, grid, dominant, iso,
           surfaces: { overall: grid, pitting, "chloride-SCC": scc, "sour-SSC": sour },
           fixed, op, opAssess: assess(c, op), opSvc: op };
}

// ---- compliance bridge: physics result vs governing code limit --------------
// Turns one assess() at the operating point into an explicit per-mechanism diff
// between what the alloy can take (probabilistic physics) and what the code
// requires (ASTM G48 CPT margin, the Cl-SCC screen, ISO 15156-3 sour envelope).
function complianceDiff(c, svc){
  const a = assess(c, svc);
  const rows = [];
  // Pitting / crevice — CPT margin vs service temperature (ASTM G48 basis)
  if (svc.Cl > 0){
    const margin = a.cpt - svc.T;                 // degC of headroom to the CPT
    rows.push({
      mechanism: "Pitting / crevice",
      physics: "P(pit) " + (a.pPit*100).toFixed(0) + "% · CPT " + a.cpt.toFixed(0) + "°C",
      code: "ASTM G48 CPT vs T " + svc.T.toFixed(0) + "°C",
      pass: margin > 0 && a.pPit < 0.5,
      margin: (margin >= 0 ? "+" : "") + margin.toFixed(0) + "°C to CPT",
      p: a.pPit
    });
  }
  // Chloride SCC
  if (a.pScc != null){
    rows.push({
      mechanism: "Chloride-SCC",
      physics: "P(SCC) " + (a.pScc*100).toFixed(0) + "%",
      code: "Cl⁻ " + (svc.Cl||0) + " ppm · " + svc.T.toFixed(0) + "°C · σ " + ((svc.stress||0)).toFixed(2) + "·YS",
      pass: a.pScc < 0.5,
      margin: a.pScc < 0.15 ? "low" : a.pScc < 0.5 ? "elevated" : "high",
      p: a.pScc
    });
  }
  // Sour SSC vs ISO 15156-3 envelope
  if (a.iso){
    rows.push({
      mechanism: "Sour SSC (ISO 15156-3)",
      physics: a.pSourFail != null ? ("P(fail) " + (a.pSourFail*100).toFixed(0) + "%") : "hardness-screened",
      code: a.iso.group ? ("group " + a.iso.group) : "ISO 15156-3",
      pass: a.iso.status === "within",
      margin: a.iso.status,
      note: a.iso.reason || a.iso.cite,
      p: a.pSourFail
    });
  }
  return { assess: a, rows, overall: a.overall, dominant: a.dominant };
}

var _PitCastAPI = {
  get GRADES(){ return GRADES; }, get MEASUREMENTS(){ return MEASUREMENTS; },
  setGrades, setMeasurements, measuredCPT,
  assess, selectAlloys, envelope, complianceDiff, pren, prenW, prenN30, ferritePct,
  inferFamily, relativeCost, cptMean, cptSE, cptMeanElec, cptSEElec,
  cptConstants: CPT, cptElecConstants: CPT_ELEC };
// Browser: attach to window. Node (benchmark/V&V harness): export via module.
if (typeof window !== 'undefined') window.PitCast = _PitCastAPI;
if (typeof module !== 'undefined' && module.exports) module.exports = _PitCastAPI;
