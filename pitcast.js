/* PitCast engine — faithful in-browser port of the calibrated Python models.
   Constants extracted from the validated pitcast package (124 tests). Screening-
   grade; cited/flagged in the Python VALIDATION_LOG. */

// ---- calibrated constants (from fit_cpt_pren_model N30 + modules) -----------
const CPT = { slope: 3.009571, intercept: -62.405047, resid: 8.884714,
              prenMean: 36.98, sxx: 804.4502, n: 9, prenMin: 19.8, prenMax: 47.89 };
const C_SIGMA_CPT = 5.0, SIGMA_CR = 30.0, SIGMA_MO = 8.0;
const SIGMA = { Tlow: 600, Thigh: 1000, Tnose: 850, W: 110, jmakN: 1.5, feq: 0.12,
                tauRef: 3.0, prenRef: 35.0, kPren: 0.43, tauMin: 0.005 };
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
  if (f>=30) return pren(c)>=40 ? "super_duplex" : "duplex";
  if (f<=10 && v(c,"Ni")>=6) return "austenitic";
  return "ferritic";
}
function sigmaFraction(c, T, t){
  if (t<=0 || T<SIGMA.Tlow || T>SIGMA.Thigh) return 0;
  const rate = Math.exp(-Math.pow((T-SIGMA.Tnose)/SIGMA.W,2));
  if (rate<1e-6) return 0;
  const tauNose = Math.max(SIGMA.tauMin, SIGMA.tauRef*Math.exp(-SIGMA.kPren*(pren(c)-SIGMA.prenRef)));
  const tau = tauNose/rate;
  return Math.max(0, Math.min(SIGMA.feq, SIGMA.feq*(1-Math.exp(-Math.pow(t/tau,SIGMA.jmakN)))));
}

// ---- CPT (pitting) ----------------------------------------------------------
function cptMean(c){ return CPT.slope*prenN30(c) + CPT.intercept; }
function cptSE(c){
  const p = prenN30(c);
  return CPT.resid*Math.sqrt(1 + 1/CPT.n + Math.pow(p-CPT.prenMean,2)/CPT.sxx);
}
// P(pit) = P(CPT < T_service); optional sigma degradation from thermal history
function pPit(c, Tservice, aged){
  let mean = cptMean(c), fsig = 0;
  if (aged && aged.t>0){ fsig = sigmaFraction(c, aged.T, aged.t); mean -= C_SIGMA_CPT*fsig*100; }
  const p = tCDF((Tservice-mean)/cptSE(c), CPT.n - 2);   // Student-t (df=n-2), matches Python
  return { p, cptLocal: mean, fsig, se: cptSE(c) };
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
  const pit = pPit(c, svc.T, aged);
  let pScc = null, pSourFail = null, sour = null;
  if (svc.stress!=null && svc.Cl>0) pScc = clSCC(family, svc.T, svc.Cl, svc.stress);
  if (svc.pH2S>=SOUR.threshold && svc.HV!=null){ sour = sourFail(svc.HV, svc.pH2S, svc.pH, family); pSourFail = sour.pFail; }
  const risks = { pitting: svc.Cl>0?pit.p:null, "chloride-SCC": pScc, "sour-SSC": pSourFail };
  const active = Object.entries(risks).filter(([k,x])=>x!=null);
  const overall = active.length ? Math.max(...active.map(([k,x])=>x)) : 0;
  const dominant = active.length ? active.reduce((a,b)=>b[1]>a[1]?b:a)[0] : "none";
  return { family, pren: pren(c), prenW: prenW(c), ferrite: ferritePct(c),
           cpt: pit.cptLocal, cptSE: pit.se, fsig: pit.fsig, aged: !!aged,
           pPit: svc.Cl>0?pit.p:null, pScc, pSourFail, sourRegion: sour?sour.region:null,
           cost: relativeCost(c), overall, dominant, risks };
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

window.PitCast = {
  get GRADES(){ return GRADES; }, get MEASUREMENTS(){ return MEASUREMENTS; },
  setGrades, setMeasurements, measuredCPT,
  assess, selectAlloys, pren, prenW, prenN30, ferritePct,
  inferFamily, relativeCost, cptMean, cptSE };
