/* PitCast web UI */
let VALIDATIONS = [];
const $ = id => document.getElementById(id);
const pct = p => (p*100).toFixed(0) + "%";
const band = p => p>0.5 ? "high" : p>0.15 ? "moderate" : "low";
const fam = f => ({austenitic:"Austenitic",duplex:"Duplex",super_duplex:"Super-duplex",
                   ferritic:"Ferritic",nickel:"Nickel-base"}[f]||f);

document.getElementById("yr").textContent = new Date().getFullYear();

// ---- tabs -------------------------------------------------------------------
document.querySelectorAll(".tab").forEach(t => t.onclick = () => {
  document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
  document.querySelectorAll(".panel").forEach(x => x.classList.remove("active"));
  t.classList.add("active");
  $("tab-" + t.dataset.tab).classList.add("active");
  if (t.dataset.tab === "co2") renderCO2();
  if (t.dataset.tab === "cpac") renderCPAC();
  if (t.dataset.tab === "envelope") renderEnvelope();
  if (t.dataset.tab === "integrity") renderIntegrity();
  if (t.dataset.tab === "compare") renderCompare();
  if (t.dataset.tab === "ili") renderILIPlaceholder();
  if (t.dataset.tab === "ffs") renderFFS();
  if (t.dataset.tab === "mr0175") renderMR0175();
  if (t.dataset.tab === "cips") renderCIPSPlaceholder();
});

// ---- grade picker (searchable: curated grades + in-scope measured alloys) ---
const gInput = $("a_grade_search");
const gList  = $("a_grade_list");
let appGrades = [];      // unified searchable catalog
let selectedIdx = -1;    // index into appGrades; -1 + customGrade => ad-hoc record
let customGrade = null;  // a composition loaded from the data browser

const _sig = c => Object.entries(c||{}).filter(([k,v])=>v>0)
  .map(([k,v]) => k + (+v).toFixed(1)).sort().join("|");
const _hint = c => Object.entries(c||{}).filter(([k,v])=>v>0)
  .sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v]) => `${k}${v}`).join(" ");
// The PREN→CPT model is only valid for Fe-based stainless/duplex and NiCrMo CRAs.
const _INSCOPE = new Set(["Fe Alloy","NiCrMo Alloy"]);
const _JUNK = /polish|electrode|mounted|stud|finish|specimen|sample|sheet|plate|the cr|wt%|at%|%cr|%mo|diamond|exposed|area|cm2|laborator|forged|extrud|roll|grit|ground|heat|prepar|test/i;
const _CLASSES = new Set(["Fe Alloy","NiCrMo Alloy","Ni Alloy","Al Alloy","HEA","Other","None","none","N/A",""]);
let _UNS2NAME = null;   // UNS -> common grade name, built from the curated catalog (no fabrication)
function _unsName(uns){
  if(!_UNS2NAME){ _UNS2NAME={}; (PitCast.GRADES||[]).forEach(g=>{ if(g.uns) _UNS2NAME[g.uns]=g.name; }); }
  return _UNS2NAME[uns] || uns;
}
function _compLabel(comp){
  return Object.entries(comp||{}).filter(([k,v])=>v>0 && k!=="Fe")
    .sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,v]) => k+(+(+v).toFixed(2))).join("") || "alloy";
}
function _measLabel(rec){
  const code = (rec.code||"").trim();
  const m = /[NSR]\d{5}/.exec(code); if (m) return _unsName(m[0]);   // UNS → common name where known
  if (code && code.length<=14 && !_JUNK.test(code) && !_CLASSES.has(code)) return code;
  return _compLabel(rec.comp);                                        // honest composition fallback
}
function buildAppGrades(){
  const out=[], seen=new Set();
  PitCast.GRADES.forEach(g => { seen.add(_sig(g.comp));
    out.push({ uns:g.uns, name:g.name, comp:g.comp, tag:"ref", label:g.name,
      hint:_hint(g.comp), search:(g.name+" "+g.uns+" "+_hint(g.comp)).toLowerCase() }); });
  PitCast.MEASUREMENTS.forEach(rec => {
    if (!_INSCOPE.has(rec.cls)) return;
    if (((rec.comp && rec.comp.Cr) || 0) < 10.5) return;   // not a stainless → model n/a
    const s=_sig(rec.comp); if (!s || seen.has(s)) return; seen.add(s);
    const lbl=_measLabel(rec);
    out.push({ uns:rec.code||"measured", name:lbl, comp:rec.comp, tag:"meas", label:lbl,
      hint:_hint(rec.comp), search:(lbl+" "+(rec.code||"")+" "+_hint(rec.comp)).toLowerCase() });
  });
  return out;
}
function currentGrade(){ return (selectedIdx===-1 && customGrade) ? customGrade : appGrades[selectedIdx]; }
function setSelected(idx){
  selectedIdx=idx; customGrade=null;
  const g=appGrades[idx];
  gInput.value = g.tag==="ref" ? `${g.label} (${g.uns})` : `${g.label} · measured`;
  gList.hidden=true; renderAssess();
}
function renderGradeList(q){
  q=(q||"").trim().toLowerCase();
  const matches = q ? appGrades.filter(g=>g.search.includes(q)) : appGrades;
  const CAP=80, shown=matches.slice(0,CAP);
  gList.innerHTML = shown.map(g=>{
    const i=appGrades.indexOf(g);
    return `<div class="combo-item" data-idx="${i}">
      <span class="ci-name">${g.label}</span>
      <span class="ci-tag ${g.tag}">${g.tag==="ref"?"ref":"measured"}</span>
      <span class="ci-hint">${g.hint}</span></div>`;
  }).join("")
   + (matches.length>CAP ? `<div class="combo-more">+${matches.length-CAP} more — keep typing to narrow…</div>` : "")
   + (matches.length===0 ? `<div class="combo-more">No alloy matches “${q}”. Try a UNS (S31603), a name (2205), or an element (Cr25).</div>` : "");
  gList.hidden=false;
}
function populateGrades(){
  appGrades=buildAppGrades();
  const i2205=appGrades.findIndex(g=>g.tag==="ref" && g.name==="2205");
  setSelected(i2205>=0 ? i2205 : 0);
}
gInput.addEventListener("focus", () => { gInput.select(); renderGradeList(""); });
gInput.addEventListener("input", () => renderGradeList(gInput.value));
gInput.addEventListener("keydown", e => {
  if (e.key==="Enter"){ e.preventDefault(); const f=gList.querySelector(".combo-item"); if(f) setSelected(+f.dataset.idx); }
  else if (e.key==="Escape"){ gList.hidden=true; gInput.blur(); }
});
gList.addEventListener("mousedown", e => {        // mousedown fires before input blur
  const it=e.target.closest(".combo-item"); if(!it) return;
  e.preventDefault(); setSelected(+it.dataset.idx);
});
document.addEventListener("click", e => { if(!$("a_combo").contains(e.target)) gList.hidden=true; });

// ---- ASSESS -----------------------------------------------------------------
function compString(c){
  return Object.entries(c).filter(([k,x])=>x>0).map(([k,x])=>`${k} ${x}`).join("  ");
}
function bar(label, p){
  if (p==null) return `<div class="bar"><div class="blab"><span>${label}</span><span class="p">n/a</span></div>
    <div class="track"><div class="fill na"></div></div></div>`;
  const b = band(p);
  return `<div class="bar"><div class="blab"><span>${label}</span><span class="p">${pct(p)}</span></div>
    <div class="track"><div class="fill ${b}" style="width:${Math.max(2,p*100)}%"></div></div></div>`;
}
// CPT vs PREN calibration plot: the 51 cited G48 points + fit + 90% band + this alloy + service T
function cptPrenChart(g, r, svc){
  if (!window.Charts || !PitCast.cptConstants || !PitCast.MEASUREMENTS) return "";
  const k = PitCast.cptConstants;
  const pts = PitCast.MEASUREMENTS
    .filter(m => m.metric==="CPT" && m.comp && /fecl3/i.test(m.sol||""))
    .map(m => ({ x: PitCast.prenN30(m.comp), y: +m.value }))
    .filter(p => p.x>0 && p.y>-50 && p.y<160);
  if (pts.length < 5) return "";
  const gx = PitCast.prenN30(g.comp);
  const xs = pts.map(p=>p.x).concat([gx]);
  const x0 = Math.min(...xs)-2, x1 = Math.max(...xs)+2, t = 1.645, band = [];
  for (let i=0;i<=40;i++){ const x = x0 + (x1-x0)*i/40;
    const se = k.resid*Math.sqrt(1 + 1/k.n + Math.pow(x-k.prenMean,2)/k.sxx);
    const yh = k.slope*x + k.intercept;
    band.push({ x, lo: yh - t*se, hi: yh + t*se }); }
  return Charts.scatterFit({
    w:560, h:300, title:"CPT vs PREN — G48 calibration & this alloy",
    xlabel:"PRENₙ₃₀  (Cr + 3.3·Mo + 30·N)", ylabel:"CPT (°C, ASTM G48)",
    points: pts, fit:{ m:k.slope, b:k.intercept }, band,
    highlight:{ x:gx, y:r.cpt, label:`${g.name} · ${r.cpt.toFixed(0)}°C` },
    hlines:[{ y:svc.T, label:`service ${svc.T}°C`, color:"#f59e0b" }]
  });
}
// Assess-tab visual suite: CPT-PREN + P(pit) vs T + overall-risk heatmap + sigma CPT-loss
function assessCharts(g, r, svc){
  if (!window.Charts) return "";
  const C=[];
  const cpt=cptPrenChart(g,r,svc); if (cpt) C.push(cpt);
  if (svc.Cl>0){ const pts=[]; for(let T=0;T<=130;T+=5){ const rr=PitCast.assess(g.comp,Object.assign({},svc,{T})); if(rr.pPit!=null) pts.push({x:T,y:rr.pPit}); }
    if (pts.length>1) C.push(Charts.lines({w:540,h:230,title:"Pitting probability vs temperature",xlabel:"Temperature (°C)",ylabel:"P(pit)",ymin:0,ymax:1,
      series:[{name:g.name,color:"#2dd4bf",pts}],vmarkers:[{x:svc.T,label:"service "+svc.T+"°C"}]})); }
  { const Ts=[],Cls=[100,500,2000,10000,50000,150000,250000]; for(let T=20;T<=120;T+=10)Ts.push(T);
    const grid=Ts.map(T=>Cls.map(Cl=>{const rr=PitCast.assess(g.comp,Object.assign({},svc,{T,Cl})); return rr.overall!=null?rr.overall:0;}));
    C.push(Charts.heatmap({w:540,h:230,title:"Localized-corrosion risk map (overall P)",xs:Cls,ys:Ts,grid,
      xfmt:v=>v>=1000?(v/1000)+"k":(""+v),yfmt:v=>""+v,xlabel:"Chloride (ppm)",ylabel:"Temperature (°C)",
      colors:[{max:0.05,color:"#0e3b24"},{max:0.15,color:"#1f6f43"},{max:0.4,color:"#8a6d1a"},{max:0.7,color:"#b5651d"},{max:2,color:"#c0392b"}],
      point:{x:svc.Cl,y:svc.T}})); }
  if (svc.ageT>0){ const pts=[]; for(let t=0;t<=24;t+=1){ const rr=PitCast.assess(g.comp,Object.assign({},svc,{aget:t})); pts.push({x:t,y:rr.cpt}); }
    C.push(Charts.lines({w:540,h:230,title:"CPT vs ageing time @ "+svc.ageT+"°C (σ-phase)",xlabel:"Ageing time (h)",ylabel:"CPT (°C)",
      series:[{name:"aged CPT",color:"#f59e0b",pts}],vmarkers:[{x:svc.aget,label:svc.aget+" h"}]})); }
  return `<div class="charts">`+C.map(s=>`<div class="chartwrap">${s}</div>`).join("")+`</div>`;
}
function selectPareto(out){
  if (!window.Charts || !out.ranked || !out.ranked.length) return "";
  const rec=out.recommended;
  return Charts.scatterFit({w:560,h:300,title:"Cost vs risk — all grades (Pareto)",xlabel:"Relative cost (304L = 1)",ylabel:"Overall risk P",ymin:0,ymax:1,
    points:out.ranked.map(r=>({x:r.cost,y:r.overall})),
    highlight:rec?{x:rec.cost,y:rec.overall,label:rec.name}:null,
    hlines:[{y:out.threshold,label:"threshold "+out.threshold,color:"#f59e0b"}]});
}
function renderAssess(){
  const g = currentGrade();
  if (!g) return;
  $("a_comp").textContent = compString(g.comp);
  const cr = (g.comp && g.comp.Cr) || 0;
  const oos = cr < 10.5;   // below the stainless threshold → model not calibrated here
  const svc = {
    T:+$("a_T").value, Cl:+$("a_Cl").value, pH:+$("a_pH").value, pH2S:+$("a_pH2S").value,
    stress:+$("a_stress").value, HV:+$("a_HV").value,
    ageT:+$("a_ageT").value, aget:+$("a_aget").value };
  const r = PitCast.assess(g.comp, svc);
  const ci = 1.645 * r.cptSE;
  const b = band(r.overall);
  const dom = r.dominant === "none" ? "—" : r.dominant;
  const _pn30 = PitCast.prenN30(g.comp);
  const sw = [
    'PREN<sub>N30</sub> = Cr + 3.3·Mo + 30·N = ' + (g.comp.Cr||0) + ' + 3.3·' + (g.comp.Mo||0) + ' + 30·' + (g.comp.N||0) + ' = ' + _pn30.toFixed(1),
    'CPT(G48) = 2.038·PREN<sub>N30</sub> − 32.73 = 2.038·' + _pn30.toFixed(1) + ' − 32.73 = ' + r.cptG48.toFixed(0) + ' °C'
  ];
  if (r.clAdj && Math.abs(r.clAdj) >= 1) sw.push('Cl⁻ adj (' + (svc.Cl||0).toLocaleString() + ' ppm) = ' + (r.clAdj>0?'+':'−') + Math.abs(r.clAdj).toFixed(0) + ' °C → local CPT ' + r.cpt.toFixed(0) + ' °C');
  if (r.aged && r.fsig > 0) sw.push('σ-phase ' + (r.fsig*100).toFixed(1) + ' vol% lowers the local CPT');
  if (svc.Cl > 0) sw.push('P(pit) = P(CPT &lt; T<sub>service</sub> ' + svc.T + ' °C), Student-t df=' + (PitCast.cptConstants.n - 2) + ' = ' + (r.pPit*100).toFixed(0) + '%');
  sw.push('90% band: CPT ± 1.645·SE = ' + r.cpt.toFixed(0) + ' ± ' + ci.toFixed(0) + ' °C');
  let agedNote = "";
  if (r.aged && r.fsig>0) agedNote = ` σ-phase ${(r.fsig*100).toFixed(1)} vol% from ageing lowers the local CPT.`;
  $("a_results").innerHTML = `
    ${oos ? `<div class="oos">⚠ ${g.name} has only ${cr.toFixed(1)}% Cr — below the stainless range.
      PitCast's PREN / CPT / pitting model is calibrated for stainless, duplex and Ni-base CRAs,
      so the numbers below are <b>not physically meaningful</b> for this alloy. Shown for reference only.</div>` : ""}
    <div class="verdict ${b}">
      <div class="gauge">${pct(r.overall)}</div>
      <div class="vtext"><b>${b.toUpperCase()} localized-corrosion risk</b>
        <div>driven by <b style="color:var(--ink)">${dom}</b> · ${g.name} (${fam(r.family)})</div></div>
    </div>
    <div class="metrics">
      <div class="metric"><div class="k">PREN</div><div class="val">${r.pren.toFixed(1)}</div><div class="u">N16 · PREN<sub>30</sub>&nbsp;${PitCast.prenN30(g.comp).toFixed(0)} (drives CPT)</div></div>
      <div class="metric"><div class="k">CPT</div><div class="val">${r.cptCapped?"≥120":r.cpt.toFixed(0)}<span class="u"> °C</span></div><div class="u">${r.cptCapped?"immune (aqueous)":"±"+ci.toFixed(0)+" (90%)"}</div></div>
      <div class="metric"><div class="k">Rel. cost</div><div class="val">${r.cost.toFixed(2)}<span class="u">×</span></div><div class="u">304L=1</div></div>
    </div>
    ${(!oos && (_pn30 < PitCast.cptConstants.prenMin || _pn30 > PitCast.cptConstants.prenMax)) ? `<div class="cdnote">⚠ EXTRAPOLATION — PREN<sub>N30</sub> ${_pn30.toFixed(0)} is outside the Nyby 2021 calibration range (${PitCast.cptConstants.prenMin}–${PitCast.cptConstants.prenMax}); the CPT value is extrapolated beyond the fitted data — indicative only.</div>` : ""}
    ${oos ? "" : `<div style="margin:8px 0;padding:7px 10px;font-size:12px;line-height:1.5;color:var(--dim);border-left:3px solid #22c55e;background:rgba(34,197,94,.06);border-radius:4px">✓ CPT model validated — leave-one-out MAE 6.58 °C on n=51 cited records (reproducible: <code>node benchmark/run.js</code>). The ±${ci.toFixed(0)} °C above is the 90% prediction band.</div>`}
    <div class="bars">
      ${bar("Pitting  P(CPT < service T)", r.pPit)}
      ${bar("Chloride-SCC", r.pScc)}
      ${bar("Sour SSC" + (r.sourRegion?` (Region ${r.sourRegion})`:""), r.pSourFail)}
    </div>
    ${r.iso ? `<div class="iso ${r.iso.status}">${
      r.iso.status==="within" ? `✓ <b>ISO 15156-3 Annex A</b> (screening): within the ${r.iso.group} sour envelope (≤${r.iso.maxT} °C). Individual qualification per ISO 15156-3 is still required.`
      : r.iso.status==="exceeds" ? `⚠ <b>ISO 15156-3 Annex A</b> (screening): service <b>exceeds</b> the ${r.iso.group} envelope — ${r.iso.reason}. Annex B lab qualification required.`
      : `<b>ISO 15156-3</b>: no Annex A screening envelope tabulated for this alloy family — verify directly against the standard.`
    }</div>` : ""}
    ${(() => { const mc = PitCast.measuredCPT(g.uns, g.name); return mc
      ? `<div class="measured">📊 Real measured CPT (literature): <b>${mc.min.toFixed(0)===mc.max.toFixed(0)?mc.min.toFixed(0):mc.min.toFixed(0)+"–"+mc.max.toFixed(0)} °C</b>
         · ${mc.n} record${mc.n>1?"s":""} <span style="color:var(--dim)">(cited dataset, CC BY) — vs PitCast ${r.cptG48.toFixed(0)} °C predicted (G48 basis)</span></div>`
      : ""; })()}
    ${assessCharts(g,r,svc)}
    <div class="explain">
      ${g.name}: PREN ${r.pren.toFixed(0)}, ferrite ≈ ${r.ferrite.toFixed(0)}%, CPT ≈ ${r.cpt.toFixed(0)} °C${(r.clAdj&&Math.abs(r.clAdj)>=1)?` <span style="color:var(--dim)">(G48 ${r.cptG48.toFixed(0)} °C ${r.clAdj>0?"+":"−"}${Math.abs(r.clAdj).toFixed(0)} for Cl⁻)</span>`:""}.
      At ${svc.T} °C${svc.Cl>0?` / ${svc.Cl.toLocaleString()} ppm Cl⁻`:""}${svc.pH2S>=0.3?` / ${svc.pH2S} kPa H₂S`:""},
      the dominant risk is <b>${dom}</b>.${agedNote}
      <span style="color:var(--dim)"> Screening estimate · CPT = ASTM G48 (6% FeCl₃) PREN<sub>N30</sub> fit, chloride-adjusted ≈24 °C/decade (Abd El Meguid, Corros. Sci. 2007) — see limits below.</span>
    </div>${gbox("CPT = 2.038·PREN<sub>N30</sub> − 32.73 (ASTM G48 / 6% FeCl₃ basis); P(pit)=P(CPT&lt;T<sub>service</sub>) via Student-t, df=n−2. PREN<sub>N30</sub>=Cr+3.3Mo+30N.", "Nyby 2021 Sci. Data 8:58 (CC-BY) · ASTM G48 · ISO 15156-3", "T2 · reproducible LOO MAE 6.58 °C (n=51) — node benchmark/run.js · VR/cpt.md")}${oos?"":showWork("CPT → P(pit)", sw)}`;
}
$("assessForm").addEventListener("input", renderAssess);

// ---- SELECT -----------------------------------------------------------------
function renderSelect(){
  const svc = {
    T:+$("s_T").value, Cl:+$("s_Cl").value, pH:+$("s_pH").value, pH2S:+$("s_pH2S").value,
    stress:+$("s_stress").value, HV:+$("s_HV").value };
  const thr = +$("s_thr").value;
  const out = PitCast.selectAlloys(svc, thr);
  const rows = out.ranked.map((r,i) => {
    const b = band(r.overall);
    const isRec = out.recommended && r.uns===out.recommended.uns;
    return `<tr class="${isRec?"rec":""}">
      <td>${i+1}</td><td>${r.name}${isRec?" ★":""}</td>
      <td class="num">${r.overall.toFixed(3)}</td>
      <td class="num">${r.cost.toFixed(2)}×</td>
      <td><span class="pill ${b}">${r.dominant}</span></td></tr>`;
  }).join("");
  let reco;
  if (out.acceptable.length){
    const others = out.acceptable.filter(r=>r.uns!==out.recommended.uns)
      .map(r=>`${r.name} (${r.cost.toFixed(1)}×)`).join(", ");
    reco = `<div class="reco">✓ Recommended (cheapest clearing P ≤ ${thr}):
      <b>${out.recommended.name}</b> — cost ${out.recommended.cost.toFixed(2)}×, risk ${out.recommended.overall.toFixed(3)}.
      ${others?`<br><span class="muted">Other safe options: ${others}</span>`:""}</div>`;
  } else {
    reco = `<div class="reco" style="background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.35)">
      ⚠ No grade clears P ≤ ${thr}. Lowest-risk: <b>${out.recommended.name}</b>
      (P=${out.recommended.overall.toFixed(2)}) — mitigate or re-spec.</div>`;
  }
  $("s_results").innerHTML = `
    <table><thead><tr><th>#</th><th>Alloy</th><th>Overall P</th><th>Cost</th><th>Dominant risk</th></tr></thead>
      <tbody>${rows}</tbody></table>${reco}
    <div class="chartwrap">${selectPareto(out)}</div>`;
}
$("selectForm").addEventListener("input", renderSelect);

// ---- CO2 (sweet) corrosion --------------------------------------------------
const CO2_PRESETS = [
  {name:"Sweet flowline (mild) · 1 bar, 40°C", v:{T:40,pCO2:1,u:1,d:0.15,fe2:10,pH2S:0,wc:0.5,meg:0,oil:"crude",bicarb:400,age:8760}},
  {name:"Sweet flowline (mid) · 5 bar, 60°C",  v:{T:60,pCO2:5,u:2,d:0.2,fe2:10,pH2S:0,wc:0.5,meg:0,oil:"crude",bicarb:500,age:8760}},
  {name:"HP/HT well · 175°C, 100 bar",          v:{T:175,pCO2:100,u:3,d:0.1,fe2:50,pH2S:0,wc:0.6,meg:0,oil:"condensate",bicarb:200,age:8760}},
  {name:"Sour-sweet field · 8 bar CO₂ + 140 kPa H₂S",v:{T:80,pCO2:8,u:2,d:0.2,fe2:20,pH2S:140,wc:0.4,meg:0,oil:"crude",bicarb:300,age:8760}},
  {name:"Wet gas + 40% MEG",                     v:{T:50,pCO2:6,u:8,d:0.3,fe2:5,pH2S:0,wc:0.8,meg:0.4,oil:"condensate",bicarb:0,age:8760}},
  {name:"Seawater injection",                    v:{T:25,pCO2:0.5,u:2,d:0.25,fe2:1,pH2S:0,wc:1,meg:0,oil:"water-only",bicarb:150,age:8760}},
];
function buildCO2Presets(){ const el=$("co2Presets"); if(!el) return;
  el.innerHTML=CO2_PRESETS.map((p,i)=>`<button type="button" class="preset" data-i="${i}">${p.name}</button>`).join("");
  el.querySelectorAll(".preset").forEach(b=>b.onclick=()=>{ const v=CO2_PRESETS[+b.dataset.i].v;
    $("c_T").value=v.T; $("c_pCO2").value=v.pCO2; $("c_u").value=v.u; $("c_d").value=v.d; $("c_fe2").value=v.fe2;
    $("c_pH2S").value=v.pH2S; $("c_wc").value=v.wc; $("c_meg").value=v.meg; $("c_oil").value=v.oil; $("c_pH").value="";
    $("c_bicarb").value=v.bicarb; $("c_age").value=v.age;
    el.querySelectorAll(".preset").forEach(x=>x.classList.remove("active")); b.classList.add("active"); renderCO2(); }); }
function decompStr(d){ return Object.entries(d).filter(([k])=>k!=="formula")
  .map(([k,v])=>`${k} ${typeof v==="number"?(Math.abs(v)>=100?v.toFixed(0):v.toFixed(2)):v}`).join(" · ") || (d.formula||""); }
// Glass-box: expandable governing equation + citation + validation tier. The
// transparency layer commercial tools structurally can't ship (PLAN-differentiation P1).
function gbox(eq, cite, tier){
  return '<details class="gb" style="margin:8px 0;border:1px solid var(--line,#243042);border-radius:6px;background:rgba(255,255,255,.02)">'
    + '<summary style="cursor:pointer;padding:7px 10px;font-size:12px;color:var(--dim);user-select:none">▸ equation, citation &amp; validation</summary>'
    + '<div style="padding:0 10px 9px;font-size:12px;color:var(--dim);line-height:1.6">'
    + '<div style="font-family:var(--mono,monospace);color:var(--ink)">' + eq + '</div>'
    + '<div style="margin-top:5px">Cite: ' + cite + '</div>'
    + (tier ? '<div style="margin-top:3px">Validation: ' + tier + '</div>' : '')
    + '</div></details>';
}
// Compact validation-tier chip for the supporting corrosion engines (P2 2a:
// every primary output shows its validation tier + worked-example anchor).
function tierTag(v){ return '<div style="margin:6px 0 0;font-size:11px;color:var(--dim)">✓ <b style="color:#2dd4bf">Validation tier T2</b> · ' + v + ' — docs/vv/SVVP.md</div>'; }
// Education "show your work": step-by-step worked arithmetic with the user's actual
// inputs plugged in (PLAN-differentiation P3-3c). Distinct from gbox (symbolic equation).
function showWork(title, steps){
  return '<details class="sw" style="margin:8px 0;border:1px dashed var(--line,#243042);border-radius:6px;background:rgba(125,211,252,.04)">'
    + '<summary style="cursor:pointer;padding:7px 10px;font-size:12px;color:#7dd3fc;user-select:none">▸ show your work — ' + title + '</summary>'
    + '<ol style="margin:6px 0 9px 26px;padding:0;font-size:12px;color:var(--dim);line-height:1.7;font-family:var(--mono,monospace)">'
    + steps.map(function(s){ return '<li>' + s + '</li>'; }).join('')
    + '</ol></details>';
}
function renderCO2(){
  if(!$("co2_results")||!window.CO2||!window.Charts) return;
  const gv=id=>$(id)?$(id).value:"";
  const o={ T:+gv("c_T"), pCO2:+gv("c_pCO2"), velocity:+gv("c_u"), pipeID:+gv("c_d"), fe2:+gv("c_fe2"),
    pH2S:+gv("c_pH2S")/100, waterCut:+gv("c_wc"), glycol:+gv("c_meg"), oilType:gv("c_oil"),
    bicarbonate:+gv("c_bicarb"), ageH:+gv("c_age") };
  const pHraw=gv("c_pH"); if(pHraw!==""&&isFinite(+pHraw)) o.pH=+pHraw;
  const r=CO2.assess(o);
  const col=cr=> cr>=5?"#ef4444":cr>=1?"#f59e0b":"#22c55e";
  const vb=r.crMax>=5?"high":r.crMax>=1?"moderate":"low";
  const norsok=r.models.find(m=>m.id==="NORSOK")||r.models[2];
  const al=CO2.allowance({cr:norsok.cr, designLifeYr:+gv("c_life"), caMm:+gv("c_ca")});
  const ev=CO2.erosionalVelocity({velocity_ms:o.velocity});
  const evCol=ev.status==="below continuous limit"?"#22c55e":ev.status&&ev.status.indexOf("C=200")>=0?"#ef4444":"#f59e0b";
  const fixed={pCO2:o.pCO2,velocity:o.velocity,pipeID:o.pipeID,fe2:o.fe2,pH2S:o.pH2S,waterCut:o.waterCut,glycol:o.glycol,oilType:o.oilType,bicarbonate:o.bicarbonate,ageH:o.ageH}; if(o.pH!=null)fixed.pH=o.pH;
  const st=CO2.sweepT(Object.assign({Tmin:20,Tmax:175,n:50},fixed));
  const sp=CO2.sweepPCO2(Object.assign({pMin:0.1,pMax:100,n:50,T:o.T},fixed));
  const SER=st=>[ {name:"de Waard 95",color:"#38bdf8",pts:st.dw95}, {name:"NORSOK M-506",color:"#2dd4bf",pts:st.norsok}, {name:"NESC",color:"#a78bfa",pts:st.nesc} ];
  const bars=Charts.bars({w:540,labelW:165,unit:"mm/y",fmt:v=>v.toFixed(v<1?3:2),items:r.models.map(m=>({name:m.name,value:m.cr,color:col(m.cr)}))});
  const crT=Charts.lines({w:540,h:230,title:"CR vs temperature",xlabel:"Temperature (°C)",ylabel:"CR (mm/y)",
    series:[{name:"de Waard 95",color:"#38bdf8",pts:st.map(p=>({x:p.T,y:p.dw95}))},{name:"NORSOK M-506",color:"#2dd4bf",pts:st.map(p=>({x:p.T,y:p.norsok}))},{name:"NESC",color:"#a78bfa",pts:st.map(p=>({x:p.T,y:p.nesc}))}],
    vmarkers:[{x:o.T,label:"op "+o.T+"°C"}]});
  const crP=Charts.lines({w:540,h:230,xlog:true,title:"CR vs CO₂ partial pressure",xlabel:"pCO₂ (bar, log)",ylabel:"CR (mm/y)",
    series:[{name:"de Waard 95",color:"#38bdf8",pts:sp.map(p=>({x:p.pCO2,y:p.dw95}))},{name:"NORSOK M-506",color:"#2dd4bf",pts:sp.map(p=>({x:p.pCO2,y:p.norsok}))},{name:"NESC",color:"#a78bfa",pts:sp.map(p=>({x:p.pCO2,y:p.nesc}))}],
    vmarkers:[{x:o.pCO2,label:"op"}]});
  const rows=r.models.map(m=>`<tr><td>${m.name}</td><td class="num">${m.cr.toFixed(m.cr<1?3:2)}</td><td style="color:var(--dim);font-size:11px">${decompStr(m.decomposition)}</td><td style="color:var(--dim);font-size:10px">${m.ref}</td></tr>`).join("");
  $("co2_results").innerHTML=`
    <div class="verdict ${vb}"><div class="gauge">${r.crMax.toFixed(1)}<span class="u"> mm/y</span></div>
      <div class="vtext"><b>${r.verdict}</b><div>${r.regime.regime.toUpperCase()} regime · in-situ pH ${r.pH_insitu.toFixed(2)} · FeCO₃ ${r.feco3_protective?"protective":"active"} (ST ${r.feco3_st.toExponential(1)}) · model spread ${r.spread.toFixed(0)}×</div></div></div>
    <div style="margin:10px 0;padding:10px 12px;border:1px solid ${r.spread>=3?"rgba(245,158,11,.45)":"rgba(56,189,248,.35)"};border-radius:8px;background:${r.spread>=3?"rgba(245,158,11,.07)":"rgba(56,189,248,.05)"}">
      <div style="font-size:12px;color:var(--dim)">5-model ensemble — <b style="color:var(--ink)">disagreement view</b></div>
      <div style="font-size:22px;font-weight:700;margin:2px 0">${r.crMin.toFixed(r.crMin<1?3:2)} – ${r.crMax.toFixed(r.crMax<1?3:2)} <span style="font-size:12px;font-weight:400;color:var(--dim)">mm/y · spread ${r.spread.toFixed(0)}×</span></div>
      <div style="font-size:12px;color:var(--dim);line-height:1.5">${r.spread>=3?"⚠ Models disagree strongly — read the band as your uncertainty, not a single number. Where a protective FeCO₃/FeS film dominates, even the lowest model can read high (see benchmark envelope-coverage, About).":"Models broadly agree — the band is your uncertainty range."}</div></div>
    <div class="blab2">Model verdicts (mm/y)</div>${bars}
    <div class="chartwrap">${crT}</div>
    <div class="chartwrap">${crP}</div>
    <table><thead><tr><th>Model</th><th>CR</th><th>Decomposition / multipliers</th><th>Reference</th></tr></thead><tbody>${rows}</tbody></table>
    ${gbox("DWM-1975: log CR=5.8−1710/T+0.67·log pCO₂. DWM-1995: resistance-in-series × F_pH·F_scale·F_glycol. NORSOK M-506: K_T·f_CO₂^0.62·(S/19)^x·f(pH). +NESC, FreeCorp. Report the spread, not one number.", "de Waard 1975 / 1995 · NORSOK M-506:2017 · Nyborg 2010 · Nesic 2007", "T2 · per-model MAE + envelope-coverage on cited cases — node benchmark/run.js · VR/co2.md")}
    <div class="explain"><b>Corrosion allowance (NORSOK basis):</b> ${al.uninhibited_CR_mmpy.toFixed(2)} mm/y → ${al.consumed_mm.toFixed(1)} mm consumed over ${al.designLifeYr} yr vs ${al.caMm} mm CA → <b>${al.verdict}</b>${al.ca_sufficient?"":`; required inhibitor efficiency <b>${al.required_inhibitor_efficiency_pct.toFixed(1)}%</b>${al.achievable?"":" — above sustainable field availability (~95%); reconsider a CRA or thicker CA"}`}.
      <span style="color:var(--dim)"> Screening, carbon steel, sweet service. The five models span ${r.spread.toFixed(0)}× — design to the conservative/relevant one. Sources: Corrosion 31 (1975) 177; NACE 95-128; NORSOK M-506:2017; Nyborg 2010; Nesic 2007.</span></div>
    <div class="explain"><b>Flow velocity (API&nbsp;RP&nbsp;14E):</b> ${o.velocity} m/s vs erosional limit V<sub>e</sub> = ${ev.Ve_continuous_ms.toFixed(1)} m/s (C=100, continuous) / ${ev.Ve_controlled_ms.toFixed(1)} m/s (C=200, corrosion-controlled) → <b style="color:${evCol}">${ev.status}</b>.
      <span style="color:var(--dim)"> Liquid/brine basis (ρ≈${ev.rho_kg_m3} kg/m³). Above the limit, protective FeCO₃ films are stripped and erosion-corrosion adds to the rates above. API RP 14E.</span></div>
    ${(o.T<20 || r.pH_insitu<3.5 || r.pH_insitu>6.5)?`<div class="cdnote">⚠ EXTRAPOLATION — NORSOK M-506 / de Waard are validated for T 20–150 °C and pH 3.5–6.5 (current ${o.T.toFixed(0)} °C, in-situ pH ${r.pH_insitu.toFixed(1)}); outside this window the sweet-CO₂ correlations are extrapolated — treat as indicative only.</div>`:""}
    ${o.T>150?`<div class="cdnote">⚠ ${o.T} °C is beyond the validated / tabulated range of the de Waard–Milliams and NORSOK&nbsp;M-506 correlations (≈150 °C). The scale-blind models (de Waard 1975, FreeCorp at low pH) become unbounded upper bounds here — read the scale-aware models (de Waard 95 / NESC) as the realistic estimate, and confirm with a CRA.</div>`:""}
    ${r.regime.regime!=="sweet"?`<div class="cdnote">⚠ ${r.regime.regime.toUpperCase()} service (pCO₂/pH₂S ≈ ${r.regime.ratio.toFixed(0)} · ${r.regime.product}). The de Waard &amp; NORSOK sweet-CO₂ models don't credit the protective FeS film that H₂S forms, so they read conservatively high here — weight FreeCorp (H₂S-aware) and run the sulfide-stress-cracking screen on the Assess / Selection-map tabs (ISO 15156-3).</div>`:""}`;
}
$("co2Form")&&$("co2Form").addEventListener("input", renderCO2);

// ---- CP / AC (cathodic protection + AC corrosion) ---------------------------
const CPAC_PRESETS = [
  {name:"HVAC parallelism · 15 V, 25 Ω·m",      v:{vac:15,rho:25,d:11.3,jdc:1}},
  {name:"After mitigation · 4 V, 200 Ω·m",      v:{vac:4,rho:200,d:11.3,jdc:2}},
  {name:"Severe stray AC · 25 V, 15 Ω·m",       v:{vac:25,rho:15,d:10,jdc:1}},
  {name:"Small holiday, dry soil · 8 V, 500 Ω·m",v:{vac:8,rho:500,d:5,jdc:1.5}},
];
function buildCPACPresets(){ const el=$("cpacPresets"); if(!el) return;
  el.innerHTML=CPAC_PRESETS.map((p,i)=>`<button type="button" class="preset" data-i="${i}">${p.name}</button>`).join("");
  el.querySelectorAll(".preset").forEach(b=>b.onclick=()=>{ const v=CPAC_PRESETS[+b.dataset.i].v;
    $("p_vac").value=v.vac; $("p_rho").value=v.rho; $("p_d").value=v.d; $("p_jdc").value=v.jdc;
    el.querySelectorAll(".preset").forEach(x=>x.classList.remove("active")); b.classList.add("active"); renderCPAC(); }); }
function renderCPAC(){
  if(!$("cpac_results")||!window.CPAC||!window.Charts) return;
  const gv=id=>$(id)?$(id).value:"";
  const rho=+gv("p_rho"), d=+gv("p_d"), vac=+gv("p_vac");
  const ac=CPAC.acRisk({Vac:vac, soilResistivity:rho, holidayDia_mm:d, Jdc:+gv("p_jdc")});
  const rate=CPAC.acCorrRate(ac.jac);
  const cp=CPAC.cpCriteria({Eon_mV:+gv("p_eon"), Einstantoff_mV:+gv("p_eio"), Edepol_mV:+gv("p_edep")});
  const acVb=ac.band==="high"?"high":ac.band==="elevated"?"moderate":"low";
  const geomBad = !(d>0) || !(rho>0) || !isFinite(ac.jac);
  const cpCls=cp.verdict.indexOf("PROTECTED")===0?"within":(cp.verdict==="INSUFFICIENT DATA"?"untabulated":"exceeds");
  const sweep=[]; for(let V=0;V<=40;V++){ const j=CPAC.holidayJac(V,rho,d/1000).jac; if(isFinite(j)) sweep.push({x:V, y:j}); }
  const jacChart=Charts.lines({w:540,h:230,title:"AC current density vs touch voltage",xlabel:"Vac (V)",ylabel:"Jac (A/m²)",ymin:0,
    series:[{name:"Jac at holiday",color:"#38bdf8",pts:sweep}],
    vmarkers:[{x:vac,label:"op "+vac+" V"},{x:0,label:""}]});
  $("cpac_results").innerHTML=`
    <div class="verdict ${geomBad?'low':acVb}"><div class="gauge">${geomBad?'—':ac.jac.toFixed(0)}<span class="u"> A/m²</span></div>
      <div class="vtext"><b>${geomBad?'Enter a positive holiday diameter &amp; soil resistivity':('AC corrosion: '+ac.band.toUpperCase()+(ac.mitigate?' · MITIGATE':''))}</b><div>${geomBad?'Holiday geometry must be &gt; 0 — Jac = 8·Vac/(ρ·π·d) is undefined at d=0 or ρ=0.':ac.rationale}</div></div></div>
    <div class="metrics">
      <div class="metric"><div class="k">Spread R</div><div class="val">${geomBad?'—':ac.rSpread.toFixed(0)}<span class="u"> Ω</span></div><div class="u">holiday → earth</div></div>
      <div class="metric"><div class="k">Jac / Jdc</div><div class="val">${(geomBad||ac.ratio==null)?"—":ac.ratio.toFixed(1)}</div><div class="u">${ac.ratioStatus}</div></div>
      <div class="metric"><div class="k">Indic. rate</div><div class="val">${geomBad?'—':rate.mmYr_indicative.toFixed(1)}<span class="u"> mm/y</span></div><div class="u">indicative only</div></div>
    </div>
    <div class="chartwrap">${jacChart}</div>
    <div class="iso ${cpCls}"><b>Cathodic protection — ${cp.verdict}</b><br>
      polarized ${cp.polarized_mV!=null?cp.polarized_mV.toFixed(0)+" mV":"—"} · −850 mV ${cp.meets850?"✓ met":"✗ not met"} · 100 mV shift ${cp.polarizationShift_mV!=null?(cp.polarizationShift_mV.toFixed(0)+" mV "+(cp.meets100mV?"✓":"✗")):"(needs depol)"}${cp.irDrop_mV!=null?(" · IR drop "+cp.irDrop_mV.toFixed(0)+" mV"):""}</div>
    <div class="explain">${(cp.notes||[]).map(n=>"• "+n).join("<br>")||"AC corrosion concentrates at coating holidays; Jac from the disc spread-resistance model."}
      <span style="color:var(--dim)"> AC: ${ac.ref} · CP: ${cp.ref}</span></div>${tierTag("ISO 18086 Jac disc-resistance model + AMPP SP0169 −850 mV criterion reproduced")}
    ${(()=>{ if(!window.Anode) return ""; const an=window.Anode.size({area_m2:+gv("a_area"),lifeYr:+gv("a_life"),environment:gv("a_env"),coating:gv("a_coating"),anode:gv("a_anode")});
      if(an.error) return `<div class="cdnote">${an.error}</div>`;
      const ep=an.env_properties;
      const corrTxt = an.corrections.notes.length ? ` · <span style="color:#fbbf24">${an.corrections.notes.join(' · ')}</span>` : "";
      return `<div class="iso within"><b>Sacrificial anode — ${an.anode}</b><br>
        Net mass required: <b>${an.anodeMass_kg_net.toFixed(0)} kg</b> (gross ${an.anodeMass_kg_gross.toFixed(0)} kg) ≈ <b>${an.numAnodes} × ${an.anodeUnit_kg} kg</b> unit anodes.
        Current demand: initial <b>${an.I_initial_A.toFixed(1)} A</b> · mean <b>${an.I_mean_A.toFixed(1)} A</b> · final <b>${an.I_final_A.toFixed(1)} A</b>.
        Coating breakdown f_c: mean ${(an.fc_mean*100).toFixed(0)}% · final ${(an.fc_final*100).toFixed(0)}%. Q = ${(an.Q_Ah/1e6).toFixed(2)} M·Ah.
        <br><span style="color:var(--dim);font-size:12px">Env physical: T ${ep.T_C}°C · depth ${ep.depth_range_m} m · salinity ${ep.salinity_ppt}‰ · O₂ ${ep.O2_mg_L} mg/L · ρ ${ep.rho_ohm_m} Ω·m${corrTxt}</span></div>
        <div class="explain"><span style="color:var(--dim)">${an.ref}</span></div>${tierTag("DNV-RP-B401 §6/§7/§10 worked example — 4,754 kg Al-Zn-In reproduced")}`;})()}
    ${(()=>{ if(!window.Galvanic) return "";
      const gcEnv = gv("g_env") || "SW";
      const gcT = +gv("g_T") || 25;
      const gcCl = gv("g_Cl") !== "" ? +gv("g_Cl") : (gcEnv==="FW"?10:19000);
      const gcFlow = gv("g_flow") || "moderate";
      const gc=window.Galvanic.couple({a:gv("g_a"),b:gv("g_b"),areaRatio:+gv("g_ratio"),flow:gcFlow,env:gcEnv,T_C:gcT,Cl_ppm:gcCl});
      if(gc.error) return "";
      const cls={low:"within",medium:"untabulated",high:"exceeds",severe:"exceeds"}[gc.level]||"within";
      const citedTag = (gc.anode_polarisation_cited||gc.cathode_polarisation_cited)
        ? `<span style="color:#7bd88f">▸ cited polarisation</span>` : `<span style="color:#fbbf24">▸ family screening</span>`;
      const pasTag = (gc.anode_passivation && gc.anode_passivation !== "passive")
        ? ` · anode <b style="color:#fbbf24">${gc.anode_passivation}</b>` : "";
      const pitTag = gc.cathode_E_pit_V != null
        ? ` · cathode E_pit ${(gc.cathode_E_pit_V*1000).toFixed(0)} mV` : "";

      // Per-heat E_corr patch from any MTC the user uploaded
      let mtcLine = "";
      if (window.Electrochem && (window._mtcA || window._mtcB)) {
        const parts = [];
        if (window._mtcA) {
          const oA = Electrochem.overrideFromMTC({metal:gv("g_a"), env:gcEnv, T_C:gcT, Cl_ppm:gcCl, parsed_mtc:{composition:window._mtcA}});
          if (oA && !oA.error && oA.patched_E_corr_V != null)
            parts.push(`anode <b>${(oA.composition_shift_mV>0?'+':'')}${oA.composition_shift_mV.toFixed(0)}</b> mV → ${(oA.patched_E_corr_V*1000).toFixed(0)} mV`);
        }
        if (window._mtcB) {
          const oB = Electrochem.overrideFromMTC({metal:gv("g_b"), env:gcEnv, T_C:gcT, Cl_ppm:gcCl, parsed_mtc:{composition:window._mtcB}});
          if (oB && !oB.error && oB.patched_E_corr_V != null)
            parts.push(`cathode <b>${(oB.composition_shift_mV>0?'+':'')}${oB.composition_shift_mV.toFixed(0)}</b> mV → ${(oB.patched_E_corr_V*1000).toFixed(0)} mV`);
        }
        if (parts.length) mtcLine = `<br><span style="color:#7bd88f;font-size:12px">▸ MTC composition perturbation: ${parts.join(" · ")} (Stansbury §4.5 / Schaffler 1980)</span>`;
      }

      // Evans-diagram SVG (mixed-potential plot) — only if Charts + cited polarisation available
      let evansSvg = "";
      if (window.Charts && window.Charts.evansDiagram && gc.ba_anode_mV_dec && gc.bc_cathode_mV_dec) {
        // The Galvanic.couple output gives the anode metal's ba/i0 and the cathode metal's bc/i0
        // but we want BOTH branches of BOTH metals for a full Evans diagram. Look them up.
        const lookA = (window.Electrochem && window.Electrochem.lookup) ? window.Electrochem.lookup({metal:gv("g_a"), env:gcEnv, T_C:gcT, Cl_ppm:gcCl}) : null;
        const lookB = (window.Electrochem && window.Electrochem.lookup) ? window.Electrochem.lookup({metal:gv("g_b"), env:gcEnv, T_C:gcT, Cl_ppm:gcCl}) : null;
        const aMetal = (gc.anode_E === (lookA?lookA.E_corr_V:null) || gv("g_a")===Galvanic.METALS[gv("g_a")]?.label?.slice(0,3)) ? lookA : lookB;
        // Simpler: just look up both, decide anode/cathode from gc result
        if (lookA && lookB) {
          const aIsA = (gc.anode_E === lookA.E_corr_V) || (Math.abs(gc.anode_E - lookA.E_corr_V) < 0.005);
          const anodeData = aIsA ? lookA : lookB;
          const cathData  = aIsA ? lookB : lookA;
          const evansArgs = {
            w: 640, h: 320, title: "Evans diagram (mixed potential)",
            anode: { label: gc.anode.split(" ")[0]+" "+gc.anode.split(" ")[1], E_corr_V: gc.anode_E, ba_mV: anodeData.ba_mV_dec, bc_mV: anodeData.bc_mV_dec, i0_a_Am2: anodeData.i0_a_A_m2 || 1e-3, i0_c_Am2: anodeData.i0_c_A_m2 || 1e-3, color: "#f59e0b" },
            cathode: { label: gc.cathode.split(" ")[0]+" "+gc.cathode.split(" ")[1], E_corr_V: gc.cathode_E, ba_mV: cathData.ba_mV_dec, bc_mV: cathData.bc_mV_dec, i0_a_Am2: cathData.i0_a_A_m2 || 1e-3, i0_c_Am2: cathData.i0_c_A_m2 || 1e-3, color: "#2dd4bf" },
            couple: { E_couple_V: 0.5*(gc.anode_E + gc.cathode_E), i_galv_Am2: gc.i_galv_parity_Am2 }
          };
          evansSvg = `<div class="chartwrap" style="margin-top:8px">${Charts.evansDiagram(evansArgs)}</div>`;
          // Per-metal polarisation curve (use anode by default)
          if (Charts.polarisationCurve && anodeData) {
            const polArgs = {
              w: 640, h: 280, label: gc.anode,
              title: "Polarisation curve — " + gc.anode + " in " + gcEnv + " @ " + gcT + "°C",
              E_corr_V: anodeData.E_corr_V || gc.anode_E,
              i_corr_uA_cm2: anodeData.i_corr_uA_cm2 || (anodeData.i0_a_A_m2 ? anodeData.i0_a_A_m2 * 100 : 10),
              ba_mV: anodeData.ba_mV_dec || 60,
              bc_mV: anodeData.bc_mV_dec || 120,
              E_pit_V: anodeData.E_pit_V || null,
              i_pass_uA_cm2: anodeData.i_pass_uA_cm2 || null
            };
            evansSvg += `<div class="chartwrap" style="margin-top:8px">${Charts.polarisationCurve(polArgs)}</div>`;
          }
        }
      }

      return `<div class="iso ${cls}"><b>Galvanic couple — ${gc.level.toUpperCase()}</b> · anode rate <b>${gc.CR_anode_mm_yr.toFixed(3)} mm/yr</b>${gc.mass_transfer_capped?" (O₂-limited)":""} · ${citedTag}<br>
        <b>${gc.anode}</b> (anode) ⇄ <b>${gc.cathode}</b> · ΔE <b>${gc.deltaE_mV.toFixed(0)} mV</b> · area ratio ${gc.areaRatio.toFixed(1)}× · i<sub>anode</sub> <b>${gc.i_anode_Am2.toFixed(3)} A/m²</b>${pasTag}${pitTag}.
        <br><span style="color:var(--dim);font-size:12px">${gc.env} · ${gc.T_C}°C · Cl ${gc.Cl_ppm.toFixed(0)} ppm · Tafel: ba ${gc.ba_anode_mV_dec} / bc ${gc.bc_cathode_mV_dec} mV·dec⁻¹ · i₀ anode ${gc.i0_anode_Am2.toExponential(0)} A/m² · EW ${gc.EW_anode} g/eq · ρ ${gc.rho_anode_g_cm3} g/cm³ · flow ${gc.flow} (i_lim ${gc.i_lim_cathode_Am2} A/m²)${gc.anode_source?` · anode src ${gc.anode_source}`:""}${gc.cathode_source?` · cath src ${gc.cathode_source}`:""}</span>${mtcLine}
        <br>${gc.note}</div>
        ${evansSvg}
        <div class="explain"><span style="color:var(--dim)">${gc.ref}</span></div>${tierTag("ASTM G102 mixed-potential + LaQue marine 316L/CS bolt ~1.16 mm/yr reproduced")}`;})()}
    ${(()=>{ if(!window.Groundbed) return ""; const sb=window.Groundbed.sundeMulti({rho_ohm_m:+gv("gb_rho"),L_m:+gv("gb_L"),d_m:(+gv("gb_d"))/1000,s_m:+gv("gb_s"),n:+gv("gb_n")});
      if(sb.error) return "";
      const cd=window.Groundbed.currentDemand({R_bed_ohm:sb.R_ohm,V_driving:+gv("gb_V")});
      return `<div class="iso within"><b>Groundbed — ${sb.n} vertical anodes</b><br>
        R<sub>self</sub> ${sb.R_self_ohm.toFixed(2)} Ω + R<sub>mutual</sub> ${sb.R_mutual_ohm.toFixed(2)} Ω = <b>R<sub>bed</sub> ${sb.R_ohm.toFixed(2)} Ω</b> · at ${gv("gb_V")} V driving → I<sub>bed</sub> <b>${cd.I_A.toFixed(2)} A</b>.</div>
        <div class="explain"><span style="color:var(--dim)">${sb.ref}</span></div>${tierTag("NACE SP0169 Appx-A 13.72 Ω + Dwight 1936 / Sunde 1949 reproduced")}`;})()}`;
}
$("cpacForm")&&$("cpacForm").addEventListener("input", renderCPAC);

// MTC upload → per-heat E_corr override for galvanic anode/cathode.
// Accepts JSON ({composition:{Cu:0.30,...}} or flat {Cu:0.30,...}) or
// 2-column CSV "element,wt%" (header optional).
function _parseMTC(text){
  text = String(text||"").trim();
  if (!text) return null;
  // Try JSON first
  try {
    const j = JSON.parse(text);
    return j.composition || j;
  } catch(_) { /* fall through to CSV */ }
  // CSV-style: each line "El,value" — skip header if non-numeric value
  const out = {};
  text.split(/\r?\n/).forEach(line => {
    const cols = line.split(/[,;\t]/).map(s=>s.trim());
    if (cols.length >= 2 && cols[0] && !isNaN(+cols[1])) out[cols[0]] = +cols[1];
  });
  return Object.keys(out).length ? out : null;
}
function _hookMTC(id, slot){
  const el = $(id); if (!el) return;
  el.addEventListener("change", function(ev){
    const f = ev.target.files && ev.target.files[0];
    if (!f) { window[slot] = null; renderCPAC(); return; }
    const r = new FileReader();
    r.onload = e => {
      const parsed = _parseMTC(e.target.result);
      if (!parsed) {
        if ($("g_mtc_info")) $("g_mtc_info").textContent = "Could not parse "+f.name+" — expected JSON or 2-column CSV (element,wt%)";
        window[slot] = null;
      } else {
        window[slot] = parsed;
        const keys = Object.keys(parsed).slice(0,6).map(k => `${k}:${parsed[k]}`).join(" · ");
        if ($("g_mtc_info")) $("g_mtc_info").textContent = `${slot==='_mtcA'?'Anode':'Cathode'} MTC loaded — ${keys}${Object.keys(parsed).length>6?` (+${Object.keys(parsed).length-6} more)`:""}`;
      }
      renderCPAC();
    };
    r.readAsText(f);
  });
}
_hookMTC("g_mtc_a", "_mtcA");
_hookMTC("g_mtc_b", "_mtcB");

// ---- Selection map (probabilistic Material Selection Diagram) ----------------
const ENV_DIAGRAMS = {
  pit_t_cl: { xKey:"T", yKey:"Cl", surface:"pitting", metric:"pitting",
    xMin:20, xMax:160, yMin:50, yMax:200000, yLog:true,
    xlabel:"Temperature (°C)", ylabel:"Chloride (ppm)",
    note:"Pitting / crevice risk — P(service T > CPT). CPT is the ASTM G48 (6% FeCl₃) PREN-fit value, chloride-adjusted ≈24 °C per decade [Cl⁻] (Abd El Meguid, Corros. Sci. 2007), anchored at the G48 ~1.1 M reference. White staircase = P(pit)=0.5 limit." },
  scc_t_cl: { xKey:"T", yKey:"Cl", surface:"chloride-SCC", metric:"Cl-SCC",
    xMin:20, xMax:140, yMin:50, yMax:200000, yLog:true,
    xlabel:"Temperature (°C)", ylabel:"Chloride (ppm)",
    note:"Chloride stress-corrosion cracking risk swept over T and Cl⁻ (pH / stress fixed below). The classic austenitic-SS map — duplex & super-duplex sit far lower. White staircase = P(SCC)=0.5 safe limit." },
  sour_h2s_t: { xKey:"pH2S", yKey:"T", surface:"sour-SSC", metric:"sour SSC", iso:true,
    xMin:0.3, xMax:1000, yMin:20, yMax:150, xLog:true,
    xlabel:"pH₂S (kPa)", ylabel:"Temperature (°C)",
    note:"Sulfide stress cracking. Dashed amber = ISO 15156-3 acceptability boundary for this alloy group; fill = modelled P(SSC) at the hardness below. Where the two diverge is the physics-vs-code story." }
};
let envGrades = [];
function envGrade(){ return envGrades[+($("env_grade").value||0)] || envGrades[0]; }
function populateEnvGrades(){
  const sel=$("env_grade"); if(!sel) return;
  // The Selection map lists the curated, standards-named engineering grades —
  // the right universe for "which alloy should I specify". Sorted low→high alloy
  // (PREN_N30) so the dropdown reads from least to most resistant.
  envGrades = (PitCast.GRADES||[]).slice().sort((a,b)=>PitCast.prenN30(a.comp)-PitCast.prenN30(b.comp));
  sel.innerHTML = envGrades.map((g,i)=>`<option value="${i}">${g.name}${g.uns?(" · "+g.uns):""}</option>`).join("");
  const i2205=envGrades.findIndex(g=>g.name==="2205"); if(i2205>=0) sel.value=i2205;
}
const _envFmt = key => (key==="Cl"||key==="pH2S")
  ? (v=>v>=1000?(v/1000).toFixed(0)+"k":(v<10?v.toFixed(1):v.toFixed(0)))
  : (v=>v.toFixed(key==="stress"?2:0));
function renderEnvelope(){
  const host=$("env_results"); if(!host) return;
  const g=envGrade();
  if(!g){ host.innerHTML='<div class="placeholder">Pick an alloy →</div>'; return; }
  const D=ENV_DIAGRAMS[$("env_diagram").value]||ENV_DIAGRAMS.scc_t_cl;
  const op={ T:+$("e_T").value, Cl:+$("e_Cl").value, pH:+$("e_pH").value,
             pH2S:+$("e_pH2S").value, stress:+$("e_stress").value, HV:+$("e_HV").value };
  if($("env_axisnote")) $("env_axisnote").textContent=D.note;
  const env=PitCast.envelope(g.comp, { xKey:D.xKey, yKey:D.yKey, xMin:D.xMin, xMax:D.xMax,
    yMin:D.yMin, yMax:D.yMax, xLog:D.xLog, yLog:D.yLog, n:44, fixed:op, xOp:op[D.xKey], yOp:op[D.yKey] });
  const surf=env.surfaces[D.surface] || env.surfaces.overall;
  const anyVal=surf.some(r=>r.some(v=>v!=null));
  const grid=(anyVal?surf:env.surfaces.overall).map(r=>r.map(v=>v==null?0:v));
  const fX=_envFmt(D.xKey), fY=_envFmt(D.yKey);
  const chart=Charts.envelope({ w:660, h:380, title:(g.label||g.name)+" — "+D.metric+" selection map",
    xs:env.xs, ys:env.ys, grid, threshold:0.5, isoGrid:D.iso?env.iso:null, metricLabel:D.metric,
    point:{x:op[D.xKey], y:op[D.yKey], label:"op"}, xlabel:D.xlabel, ylabel:D.ylabel, xfmt:fX, yfmt:fY });
  const cd=PitCast.complianceDiff(g.comp, op);
  const rows=cd.rows.map(r=>`<tr><td>${r.mechanism}</td><td class="cmono">${r.physics}</td>`+
    `<td class="cmono cdcode">${r.code||""}</td><td><span class="cd ${r.pass?'pass':'fail'}">${r.pass?'PASS':'FAIL'}</span></td>`+
    `<td class="cmono">${r.margin||""}</td></tr>`).join("");
  const allPass=cd.rows.length>0 && cd.rows.every(r=>r.pass);
  const sourHint=(D.iso && op.pH2S<0.3)
    ? `<div class="cdnote">pH₂S ${op.pH2S} kPa is below the 0.3 kPa sour threshold — set pH₂S to place the operating point inside the sour field.</div>` : "";
  host.innerHTML=`<div class="chartbox">${chart}</div>${sourHint}
    <div class="cdwrap">
      <div class="cdhead">Compliance bridge — physics vs code at your operating point
        <span class="cmono">(${D.xlabel.split(" ")[0]} ${fX(op[D.xKey])} · ${D.ylabel.split(" ")[0]} ${fY(op[D.yKey])})</span></div>
      <div class="cdtablewrap"><table class="cdtable"><thead><tr><th>Mechanism</th><th>Physics (probabilistic)</th>`+
      `<th>Basis / standard</th><th>Verdict</th><th>Margin</th></tr></thead><tbody>${rows||'<tr><td colspan="5" class="cmono">No mechanism active at this point.</td></tr>'}</tbody></table></div>
      <div class="cdsum ${allPass?'pass':'fail'}">${allPass?'✓ All screened mechanisms PASS at this point':'⚠ At least one screened mechanism FAILS — see table'}</div>
    </div>`;
}
$("env_grade") && ($("env_grade").onchange=renderEnvelope);
$("env_diagram") && ($("env_diagram").onchange=()=>{
  if($("env_diagram").value==="sour_h2s_t" && +$("e_pH2S").value<0.3) $("e_pH2S").value=10;
  renderEnvelope();
});
$("envForm") && $("envForm").addEventListener("input", renderEnvelope);

// ---- Integrity (ASME B31G corroded-pipe + remaining-life) -------------------
// ----------------------------------------------------------------------------
// Industry-grade dropdown populator — fills CP/AC + Integrity selects with
// the full cited catalog from anode.js, galvanic.js, cui.js dictionaries.
// Called once at init; overwrites any static <option> elements in index.html.
// ----------------------------------------------------------------------------
function _opts(dict, valFmt){ return Object.entries(dict).map(([k,v])=>`<option value="${k}">${v.label}${valFmt?valFmt(v):""}</option>`).join(""); }
function _setSelect(id, html, defaultKey){
  const el = $(id); if(!el) return;
  el.innerHTML = html;
  if (defaultKey && el.querySelector(`option[value="${defaultKey}"]`)) el.value = defaultKey;
}
function populateIndustryDropdowns(){
  // CP/AC — anode sizing
  if (window.Anode) {
    _setSelect("a_env",     _opts(Anode.ENVIRONMENTS), "north-sea");
    _setSelect("a_coating", _opts(Anode.COATINGS),     "II");
    _setSelect("a_anode",   _opts(Anode.ANODES),       "AlZnIn");
  }
  // CP/AC — galvanic couple
  if (window.Galvanic) {
    const galvHtml = _opts(Galvanic.METALS, v=>` · ${(v.E*1000).toFixed(0)} mV`);
    _setSelect("g_a", galvHtml, "316L-passive");
    _setSelect("g_b", galvHtml, "Carbon-steel");
  }
  // Integrity — CUI
  if (window.CUI) {
    _setSelect("u_ins",  _opts(CUI.INSULATION), "cal-sil");
    _setSelect("u_jkt",  _opts(CUI.JACKET),     "Galv");
    _setSelect("u_coat", _opts(CUI.COATING),    "alkyd");
    _setSelect("u_amb",  _opts(CUI.AMBIENT),    "industrial");
  }
  // Re-render dependent panels after populate (dropdown defaults may have shifted)
  if (typeof renderCPAC === "function") renderCPAC();
  if (typeof renderIntegrity === "function") renderIntegrity();
  // When electrochem.js finishes its async JSON load, re-render so the
  // galvanic card swaps from "family screening" → "cited polarisation".
  if (window.Electrochem && typeof window.Electrochem.load === "function") {
    window.Electrochem.load().then(function(){
      if (typeof renderCPAC === "function") renderCPAC();
    }).catch(function(){ /* keep family fallback */ });
  }
}

function populateGradeSelect(){
  const sel=$("b_grade"); if(!sel||!window.B31G) return;
  sel.innerHTML = Object.entries(B31G.GRADES).map(([k,g])=>`<option value="${k}">${g.label}</option>`).join("");
  sel.value="X52";
}
function renderIntegrity(){
  const host=$("integrity_results"); if(!host||!window.B31G) return;
  const gv=id=>$(id)?$(id).value:"";
  const grade=B31G.GRADES[gv("b_grade")]||B31G.GRADES.X52;
  const D=+gv("b_D"), t=+gv("b_t"), L=+gv("b_L"), d=+gv("b_d"), MAOP=+gv("b_MAOP");
  const method=gv("b_method")||"modb31g";
  const ff=B31G.failurePressure({D,t,SMYS:grade.SMYS,L,d,method});
  const dAllow=B31G.allowableDepth({D,t,SMYS:grade.SMYS,L,MAOP_bar:MAOP,method});
  const v=B31G.classify(ff.P_safe_bar, MAOP, ff.depthRatio, ff.throughWall);
  const vb={PASS:"low",MONITOR:"moderate",REPAIR:"high",IMMEDIATE:"high"}[v.status]||"low";
  const rl=B31G.remainingLife({tNom:t,tMin:+gv("b_tmin"),CR:+gv("b_CR"),designLifeYr:+gv("b_life"),inhEff:+gv("b_inh")});
  const ds={ ff:ff, dAllow:dAllow, v:v };
  const swB = [
    'd/t = ' + d + '/' + t + ' = ' + ff.depthRatio.toFixed(2),
    'Folias M = √(1 + 0.6275λ − 0.003375λ²), λ = L²/(D·t) = ' + (isFinite(ff.M)?ff.M.toFixed(2):'n/a'),
    'σ_f (flow stress) = ' + ff.sigma_f_MPa.toFixed(0) + ' MPa',
    'P_f = σ_f·(2t/D)·(1−d/t)/(1−(d/t)/M) = ' + ff.P_f_bar.toFixed(0) + ' bar',
    'P_safe = P_f / SF(' + ff.SF + ') = ' + ff.P_safe_bar.toFixed(0) + ' bar'
  ];
  host.innerHTML=`
    <div class="verdict ${vb}"><div class="gauge">${ff.throughWall?"—":ff.P_safe_bar.toFixed(0)}<span class="u"> bar</span></div>
      <div class="vtext"><b>${v.status} · safe operating pressure</b><div>${v.note} ${ff.throughWall?"":(`vs MAOP ${MAOP} bar — predicted failure ${ff.P_f_bar.toFixed(0)} bar (σ<sub>f</sub> ${ff.sigma_f_MPa.toFixed(0)} MPa, M ${isFinite(ff.M)?ff.M.toFixed(2):"n/a"}).`)}</div></div></div>
    ${ff.depthRatio>0.80 ? `<div class="cdnote">⚠ LIMIT — d/t ${(ff.depthRatio*100).toFixed(0)}% exceeds the ASME B31G 80% wall-loss limit; the defect is beyond B31G applicability — repair/replace or escalate to a Level-2/3 FFS (API 579 Part 5).</div>` : ""}
    <div class="metrics">
      <div class="metric"><div class="k">P<sub>safe</sub></div><div class="val">${ff.P_safe_bar.toFixed(0)}<span class="u"> bar</span></div><div class="u">P<sub>f</sub> ${ff.P_f_bar.toFixed(0)} bar · SF ${ff.SF}</div></div>
      <div class="metric"><div class="k">Wall loss d/t</div><div class="val">${(ff.depthRatio*100).toFixed(0)}<span class="u"> %</span></div><div class="u">${ff.regime||"—"}</div></div>
      <div class="metric"><div class="k">Allowable d @ MAOP</div><div class="val">${dAllow!=null?dAllow.toFixed(1):"—"}<span class="u"> mm</span></div><div class="u">${dAllow!=null?((dAllow/t*100).toFixed(0)+"% wall · margin "+(dAllow-d).toFixed(1)+" mm"):"intact pipe weaker than MAOP"}</div></div>
    </div>
    <div class="explain"><b>Remaining life (uniform CR):</b> CR ${rl.CR_mmyr.toFixed(2)} mm/y${rl.inhibitorEff>0?(` × (1−η ${(rl.inhibitorEff*100).toFixed(0)}%) = ${rl.effective_CR_mmyr.toFixed(2)} mm/y eff`):""} → <b>${isFinite(rl.yearsToMinWT)?rl.yearsToMinWT.toFixed(1)+" yr"+(rl.yearsToMinWT<rl.designLifeYr?" (< design life)":""):"∞ (no corrosion)"}</b> to t<sub>min</sub> ${rl.tMin_mm} mm.
      ${!rl.ca_sufficient?` Required inhibitor efficiency for ${rl.designLifeYr} yr: <b>${(rl.required_inhibitor_efficiency*100).toFixed(0)}%</b>.`:` CA ${rl.CA_mm.toFixed(1)} mm sufficient for ${rl.designLifeYr} yr at this CR.`}
      <span style="color:var(--dim)"> ${ff.ref} · ${rl.ref}</span></div>${gbox("P<sub>f</sub> = σ<sub>f</sub>·(2t/D)·(1−d/t)/(1−(d/t)/M); Folias M=√(1+0.6275λ−0.003375λ²), λ=L²/(Dt). Mod-B31G uses 0.85·d·L effective area.", "ASME B31G-2012 · Kiefner &amp; Vieth 1989 (RSTRENG) · Folias 1965", "T2 · ASME B31G Appx B Ex 1 reproduced (P_safe 54.3 bar) — VR/b31g.md")}${ff.throughWall?"":showWork("B31G → P_safe", swB)}
    ${(()=>{ if(!window.CUI) return ""; const u=window.CUI.risk({material:gv("u_mat"),T_C:+gv("u_T"),insulation:gv("u_ins"),jacket:gv("u_jkt"),coating:gv("u_coat"),ambient:gv("u_amb"),ageYr:+gv("u_age"),cyclic:!!($("u_cyc")&&$("u_cyc").checked)});
      const cls={low:"within",medium:"untabulated",high:"exceeds",severe:"exceeds"}[u.level]||"within";
      const p = u.properties || {};
      const warnBlock = (u.warnings && u.warnings.length) ? `<div style="margin-top:6px;color:#f87171"><b>⚠ Service-T / chemistry warnings:</b><ul style="margin:4px 0 0 18px;padding:0">${u.warnings.map(w=>"<li>"+w+"</li>").join("")}</ul></div>` : "";
      const propsLine = u.inWindow ? `<br><span style="color:var(--dim);font-size:12px">Properties: insulation T-window ${p.insulation_T_min_C} → ${p.insulation_T_max_C} °C · ASTM C871 leachable Cl <b>${p.insulation_Cl_ppm_C871} ppm</b> · water absorption ${p.insulation_water_pct}% · coating T_max ${p.coating_T_max_C} °C · ambient ISO 9223 ${p.ambient_ISO9223}${u.factors.leachable_Cl && Math.abs(u.factors.leachable_Cl-1)>0.05 ? " · Cl-amplifier ×"+u.factors.leachable_Cl.toFixed(2) : ""}</span>` : "";
      return `<div class="iso ${cls}"><b>CUI risk — ${u.level.toUpperCase()}</b> ${u.inWindow?`(${u.region})`:""}<br>
        Score <b>${u.score.toFixed(2)}</b> · recommended inspection: <b>${u.inspectionInterval}</b>.
        ${u.inWindow?`Drivers: T factor ${u.factors.temperature.toFixed(2)} · insulation ${u.factors.insulation.toFixed(2)} (${u.categories.insulation}) · jacket ${u.factors.jacket.toFixed(2)} (${u.categories.jacket}) · coating ${u.factors.coating.toFixed(2)} (${u.categories.coating}) · ambient ${u.factors.ambient.toFixed(2)} (${u.categories.ambient}) · age ${u.factors.age.toFixed(2)} ${u.cyclic?"· cyclic ×1.5":""}.`:""}
        ${propsLine}
        ${warnBlock}</div>
        <div class="explain"><span style="color:var(--dim)">${u.ref}</span></div>${tierTag("API 583 §4.3 + ASTM C871 leachable-Cl patterns reproduced")}`;})()}
    ${(()=>{ if(!window.MIC) return ""; const mr=window.MIC.risk({T_C:+gv("m_T"),oxygen:gv("m_o2"),nutrient:gv("m_n"),sulphate_mgL:+gv("m_so4"),flow:gv("m_flow"),biocide:gv("m_b")});
      const cls={low:"within",medium:"untabulated",high:"exceeds",severe:"exceeds"}[mr.level]||"within";
      const fam=mr.families?mr.families.map(f=>f.name+" "+f.score.toFixed(2)).join(" · "):"";
      return `<div class="iso ${cls}"><b>MIC risk — ${mr.level.toUpperCase()}</b> ${mr.inWindow?`(${mr.region})`:""}<br>
        Dominant: <b>${mr.dominant.split("—")[0].trim()}</b>. Total score ${mr.score.toFixed(2)}. ${mr.recommendation}
        ${mr.inWindow?`<br>Family scores: ${fam}.`:""}</div>
        <div class="explain"><span style="color:var(--dim)">${mr.ref}</span></div>${tierTag("NACE SP0775 / TM0194 / TM0212 family classification reproduced")}`;})()}
    ${(()=>{ if(!window.HIC) return ""; const hr=window.HIC.risk({pH2S_kPa:+gv("h_pH2S"),pH:+gv("h_pH"),S_wt:+gv("h_S"),HV:+gv("h_HV"),waterCut:+gv("h_wc"),stress:+gv("h_stress")});
      if(!hr.active) return `<div class="iso within"><b>HIC / SOHIC — INACTIVE</b><br>${hr.mech}</div>
        <div class="explain"><span style="color:var(--dim)">${hr.ref}</span></div>${tierTag("NACE MR0103-2018 §4 + TM0284-2016 + ISO 15156-2 envelope reproduced")}`;
      const cls={low:"within",medium:"untabulated",high:"exceeds",severe:"exceeds"}[hr.level]||"within";
      return `<div class="iso ${cls}"><b>HIC / SOHIC — ${hr.level.toUpperCase()}</b> · ${hr.dominant} dominant<br>
        HIC index <b>${hr.HIC_index.toFixed(2)}</b> (${hr.HIC_level}) · SOHIC index <b>${hr.SOHIC_index.toFixed(2)}</b> (${hr.SOHIC_level}).
        Drivers: pH₂S ${hr.factors.pH2S.toFixed(2)} · pH ${hr.factors.pH.toFixed(2)} · S ${hr.factors.S.toFixed(2)} · HV ${hr.factors.HV.toFixed(2)} · water ${hr.factors.water.toFixed(2)}.
        <br><b>Mechanism:</b> ${hr.mechanism}
        <br><b>Mitigation:</b><ul style="margin:4px 0 0 18px;padding:0">${hr.mitigation.map(m=>"<li>"+m+"</li>").join("")}</ul></div>
        <div class="explain"><span style="color:var(--dim)">${hr.ref}</span></div>${tierTag("NACE MR0103-2018 §4 + TM0284-2016 + ISO 15156-2 envelope reproduced")}`;})()}
    ${(()=>{ if(!window.RBI) return ""; const rs=window.RBI.score({CR_mmyr:+gv("r_CR"),ageSinceLastInsp_yr:+gv("r_age"),tNom_mm:+gv("b_t"),tCurrent_mm:+gv("r_tCur"),tMin_mm:+gv("b_tmin"),fluid:gv("r_fluid"),inventory_m3:+gv("r_inv")});
      const cls={low:"within",medium:"untabulated",high:"exceeds",extreme:"exceeds"}[rs.riskLevel]||"within";
      const cofIdx=["A","B","C","D","E"].indexOf(rs.CoF);
      const bandColour={L:"#0e3b24",M:"#8a6d1a",H:"#b5651d",E:"#c0392b"};
      let mtx='<table class="rbi-mtx" style="margin-top:8px;border-collapse:collapse;font-size:11px">';
      mtx+='<tr><th></th>'+["A","B","C","D","E"].map(c=>`<th style="padding:3px 8px;color:var(--dim);font-weight:500">CoF ${c}</th>`).join("")+"</tr>";
      for(let i=4;i>=0;i--){ const pof=i+1; mtx+=`<tr><th style="padding:3px 8px;color:var(--dim);font-weight:500;text-align:right">PoF ${pof}</th>`;
        for(let j=0;j<5;j++){ const cell=rs.matrix[i][j]; const here=(pof===rs.PoF && j===cofIdx);
          mtx+=`<td style="padding:6px 12px;background:${bandColour[cell]};color:#fff;font-weight:600;text-align:center;${here?"outline:2px solid #fff;outline-offset:-2px":""}">${cell}${here?" ●":""}</td>`; }
        mtx+="</tr>"; }
      mtx+="</table>";
      return `<div class="iso ${cls}"><b>RBI screen — ${rs.riskLevel.toUpperCase()}</b> · cell ${rs.CoF}${rs.PoF}<br>
        PoF=<b>${rs.PoF}</b> · CoF=<b>${rs.CoF}</b> · driver ${rs.driver.toFixed(2)} (DF ${rs.damageFactor.toFixed(2)} / remaining margin ${(rs.remainingMargin*100).toFixed(0)}%).
        Recommended inspection interval: <b>${rs.inspectionInterval}</b>.${mtx}<div style="margin-top:6px;font-size:11px;color:#fbbf24">⚠ Screening / research-grade · API RP 581 3rd-ed (2016) basis (see STANDARDS.md — 4th-ed 2025 delta). Corrosion-driven RBI screen, not a full RBI study.</div></div>
        <div class="explain"><span style="color:var(--dim)">${rs.ref}</span></div>`;})()}
    ${(()=>{ if(!window.RBIDamage) return "";
      const env = gv("rd_env") || "generic";
      const opts = {
        material_family: gv("rd_family") || "CS",
        T_C: +gv("r_T") || +gv("u_T") || 25,
        pH: +gv("h_pH") || 7,
        pH2S_kPa: +gv("h_pH2S") || 0,
        pH2_kPa: +gv("rd_pH2") || 0,
        Cl_ppm: +gv("u_Cl") || 0,
        NaOH_wt_pct: +gv("rd_NaOH") || 0,
        amine_type: gv("rd_amine") || "",
        amine_state: gv("rd_amine_state") || "lean",
        HF_wt_pct: +gv("rd_HF") || 0,
        water_phase_present: env === "hf",
        CO3_ppm: +gv("rd_CO3") || 0,
        cyanide_ppm: +gv("rd_CN") || 0,
        hardness_HRC: +gv("rd_HRC") || 22,
        PWHT: gv("rd_pwht") === "true",
        welded: gv("rd_welded") !== "false",
        HIC_resistant_steel: gv("rd_HICres") === "true",
        sensitised: gv("rd_sens") === "true",
        H2S_service: env === "sour" || (+gv("h_pH2S") || 0) > 0.3,
        thickness_mm: +gv("b_t") || 25,
        age_yr: +gv("r_age") || 10,
        inspection_history: [{ eff: "B" }],
        ext_type: env === "atmospheric" ? "atmospheric" : env === "cui" ? "CUI" : null,
        atm_category: "C3",
        insulated: env === "cui",
        T_C_external: env === "cui" ? (+gv("r_T") || 80) : 25,
        coating_quality: "fair",
        coating_age_yr: 3
      };
      const cdf = window.RBIDamage.combinedDF(opts);
      const rows = cdf.mechanisms.map(m => {
        const susColour = { "None":"#374151", "Low":"#0e3b24", "Medium":"#8a6d1a", "High":"#b5651d", "V.High":"#c0392b" }[m.susceptibility] || "#374151";
        const applicableLabel = m.applicable ? `<b style="color:#fff">${m.susceptibility}</b>` : `<span style="color:var(--dim)">n/a</span>`;
        const dfDisplay = m.applicable ? m.D_f.toFixed(1) : "—";
        const why = !m.applicable && m.why ? `<span style="color:var(--dim);font-size:11px"> · ${m.why}</span>` : "";
        return `<tr><td style="padding:4px 8px">${m.mechanism}</td>
                    <td style="padding:4px 8px;background:${m.applicable?susColour:"transparent"};text-align:center">${applicableLabel}</td>
                    <td style="padding:4px 8px;text-align:right;font-family:var(--mono,monospace)">${dfDisplay}</td>
                    <td style="padding:4px 8px;color:var(--dim);font-size:11px">${m.applicable ? `eff ${m.effectiveness} · age ×${m.F_age.toFixed(2)} · ins ×${m.F_eff.toFixed(2)}` : ""}${why}</td>
                </tr>`;
      }).join("");
      const totalLevel = cdf.total_D_f > 100 ? "exceeds" : cdf.total_D_f > 10 ? "untabulated" : "within";
      return `<div class="iso ${totalLevel}"><b>Detailed RBI — API 581 damage mechanisms</b> · ${cdf.n_active} active · <b>ΣD<sub>f</sub> = ${cdf.total_D_f.toFixed(1)}</b><br>
        <table style="margin-top:8px;border-collapse:collapse;width:100%;font-size:12px">
          <thead><tr style="color:var(--dim)"><th style="text-align:left;padding:4px 8px">Mechanism</th>
            <th style="padding:4px 8px;text-align:center">Susceptibility</th>
            <th style="padding:4px 8px;text-align:right">D<sub>f</sub></th>
            <th style="padding:4px 8px;text-align:left">Factors</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
        <div class="explain"><span style="color:var(--dim)">${cdf.ref}</span></div>
        <div class="iso untabulated" style="margin-top:8px;font-size:12px"><b>⚠ Peer-review requirement</b><br>
          PitCast outputs are <b>screening grade</b>. Before any RBI deliverable, ASME-stamped inspection plan, insurance-underwriter submission, or PE-stamped report:
          <ul style="margin:6px 0 0 18px;padding:0">
            <li>Independent verification by an <b>AMPP / API-certified Corrosion / Inspection PE</b> is required.</li>
            <li>For absolute D<sub>f</sub> / PoF numbers, cross-check against API 581 commercial software (Antea, Cenosco IMS, Bureau Veritas, DNV Synergi) that embeds the full Tab 5.11 / 6.x.x with paid license to API.</li>
            <li>Thinning DF calibration anchor: Trinity-Bridge Ex 1 (Art=0.25 + 1A → D<sub>fB</sub><sup>thin</sup>=33.30) matches exactly per Cenosco IMS Handbook public tabulation of API 581 Part 2 Tab 5.11.</li>
          </ul></div>`;})()}
`;
}
$("b31gForm") && $("b31gForm").addEventListener("input", renderIntegrity);


function _dl(filename, text){ const b=new Blob([text],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1500); }
function exportActiveCSV(){
  const at=document.querySelector(".tab.active"); const tab=at?at.dataset.tab:"assess";
  const gv=id=>$(id)?$(id).value:"";
  const rows=[["PitCast export","pitcast.austenite.org"],["tab",tab],["generated",new Date().toISOString()],[]];
  if(tab==="assess"){ const g=currentGrade(); const svc={T:+gv("a_T"),Cl:+gv("a_Cl"),pH:+gv("a_pH"),pH2S:+gv("a_pH2S"),stress:+gv("a_stress"),HV:+gv("a_HV"),ageT:+gv("a_ageT"),aget:+gv("a_aget")};
    const r=PitCast.assess(g.comp,svc);
    rows.push(["grade",g.name],["UNS",g.uns||""],["composition (wt%)",compString(g.comp)],[]);
    rows.push(["T (°C)",svc.T],["Cl (ppm)",svc.Cl],["pH",svc.pH],["pH2S (kPa)",svc.pH2S],["stress (xYS)",svc.stress],["hardness (HV)",svc.HV],[]);
    rows.push(["PREN (N16)",r.pren.toFixed(1)],["CPT (°C, G48)",r.cpt.toFixed(1)],["ferrite (%)",r.ferrite.toFixed(0)]);
    rows.push(["P(pit)",r.pPit!=null?r.pPit.toFixed(3):"n/a"],["P(Cl-SCC)",r.pScc!=null?r.pScc.toFixed(3):"n/a"],["P(sour SSC)",r.pSourFail!=null?r.pSourFail.toFixed(3):"n/a"]);
    rows.push(["overall risk P",r.overall.toFixed(3)],["dominant",r.dominant],["rel. cost (304L=1)",r.cost.toFixed(2)]);
    if(r.iso)rows.push(["ISO 15156 screen",r.iso.status+(r.iso.group?(" — "+r.iso.group):"")]);
  } else if(tab==="co2"){ const o={T:+gv("c_T"),pCO2:+gv("c_pCO2"),velocity:+gv("c_u"),pipeID:+gv("c_d"),fe2:+gv("c_fe2"),pH2S:+gv("c_pH2S")/100,waterCut:+gv("c_wc"),glycol:+gv("c_meg"),oilType:gv("c_oil"),bicarbonate:+gv("c_bicarb"),ageH:+gv("c_age")};
    const pHr=gv("c_pH"); if(pHr!==""&&isFinite(+pHr))o.pH=+pHr; const r=CO2.assess(o);
    rows.push(["T (°C)",o.T],["pCO2 (bar)",o.pCO2],["in-situ pH",r.pH_insitu.toFixed(2)],["bicarbonate (mg/L)",o.bicarbonate],["velocity (m/s)",o.velocity],[]);
    r.models.forEach(m=>rows.push(["CR — "+m.name+" (mm/y)",m.cr.toFixed(3)]));
    rows.push(["CR max (mm/y)",r.crMax.toFixed(2)],["verdict",r.verdict],["regime",r.regime.regime],["FeCO3 ST",r.feco3_st.toExponential(2)]);
  } else if(tab==="cpac"){ const ac=CPAC.acRisk({Vac:+gv("p_vac"),soilResistivity:+gv("p_rho"),holidayDia_mm:+gv("p_d"),Jdc:+gv("p_jdc")});
    const cp=CPAC.cpCriteria({Eon_mV:+gv("p_eon"),Einstantoff_mV:+gv("p_eio"),Edepol_mV:+gv("p_edep")});
    rows.push(["Vac (V)",gv("p_vac")],["soil resistivity (Ω·m)",gv("p_rho")],["holiday dia (mm)",gv("p_d")],["Jdc (A/m²)",gv("p_jdc")],[]);
    rows.push(["Jac (A/m²)",isFinite(ac.jac)?ac.jac.toFixed(1):"n/a (geometry ≤ 0)"],["AC band",ac.band],["mitigate",ac.mitigate],["Jac/Jdc",(ac.ratio!=null&&isFinite(ac.ratio))?ac.ratio.toFixed(1):"n/a"],["spread R (Ω)",isFinite(ac.rSpread)?ac.rSpread.toFixed(0):"n/a"],[]);
    rows.push(["CP verdict",cp.verdict],["meets -850 mV",cp.meets850],["meets 100 mV",cp.meets100mV],["polarized (mV)",cp.polarized_mV!=null?cp.polarized_mV.toFixed(0):"n/a"]);
  } else if(tab==="select"){ const svc={T:+gv("s_T"),Cl:+gv("s_Cl"),pH:+gv("s_pH"),pH2S:+gv("s_pH2S"),stress:+gv("s_stress"),HV:+gv("s_HV")};
    const out=PitCast.selectAlloys(svc,+gv("s_thr"));
    rows.push(["T (°C)",svc.T],["Cl (ppm)",svc.Cl],["threshold",out.threshold],["recommended",out.recommended?out.recommended.name:"none"],[],["#","alloy","overall P","rel. cost"]);
    out.ranked.slice(0,25).forEach((r,i)=>rows.push([i+1,r.name,r.overall.toFixed(3),r.cost.toFixed(2)]));
  } else { rows.push(["(switch to Assess / CO2 / CP·AC / Select to export that calc)"]); }
  const csv=rows.map(r=>r.map(c=>`"${String(c==null?"":c).replace(/"/g,'""')}"`).join(",")).join("\r\n");
  _dl("pitcast-"+tab+".csv", csv);
}
$("btnPrint")&&($("btnPrint").onclick=()=>window.print());
$("btnCSV")&&($("btnCSV").onclick=exportActiveCSV);

// ---- validation-cases table (cited measured anchors) ------------------------
function renderValidations(){
  const host = $("validTable");
  if(!host) return;
  if(!VALIDATIONS || !VALIDATIONS.length){ host.innerHTML=""; return; }
  const esc = s => String(s==null?"":s).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
  const order = ["CRA","CO2"];
  const titles = { CRA:"CRA pitting — critical pitting temperature (CPT)",
                   CO2:"CO₂ sweet-corrosion rate" };
  const groups = {};
  VALIDATIONS.forEach(v => { (groups[v.domain] || (groups[v.domain]=[])).push(v); });
  const keys = order.filter(k=>groups[k]).concat(Object.keys(groups).filter(k=>!order.includes(k)));
  let html = "";
  keys.forEach(k => {
    const rows = groups[k]; if(!rows.length) return;
    html += `<h4 class="vgh">${esc(titles[k]||k)} <span class="vgn">${rows.length} cases</span></h4>`;
    html += `<div class="vtwrap"><table class="vtable"><thead><tr>`+
            `<th>Case</th><th>Conditions</th><th>Measured</th><th>Source</th></tr></thead><tbody>`;
    rows.forEach(v => {
      const meas = esc(v.measured) + (v.uncertainty!=null ? (" ± "+esc(v.uncertainty)) : "") +
                   " " + esc((v.units||"").replace("degC","°C"));
      const src = v.doi
        ? `<a href="https://doi.org/${esc(v.doi)}" target="_blank" rel="noopener">${esc(v.source)}</a>`
        : esc(v.source);
      html += `<tr><td class="vcase">${esc(v.case)}</td><td class="vcond">${esc(v.conditions)}</td>`+
              `<td class="vmeas">${meas}</td><td class="vsrc">${src}</td></tr>`;
    });
    html += `</tbody></table></div>`;
  });
  host.innerHTML = html;
}

// ---- DATA browser (all records usable) --------------------------------------
let _metricFilter = "";
let _measIndex = null;
function measIndex(){ if(!_measIndex){ _measIndex={}; PitCast.MEASUREMENTS.forEach(r=>_measIndex[r.id]=r); } return _measIndex; }
function compStr(c){ return Object.entries(c||{}).filter(([k,v])=>v>0).slice(0,8).map(([k,v])=>`${k}${v}`).join(" "); }
function condStr(r){ const p=[]; if(r.sol)p.push(String(r.sol).slice(0,22)); if(r.t!=null)p.push(r.t+"°C");
  if(r.cl!=null)p.push((+r.cl).toPrecision(2)+"M Cl⁻"); if(r.ph!=null)p.push("pH "+r.ph); return p.join(" · "); }
function valStr(r){ const u = r.units==="degC" ? "°C" : r.units==="mV(SCE)" ? "mV SCE" : (r.units||"");
  const v = (r.value==null) ? "—" : (Math.abs(r.value)>=100 ? r.value.toFixed(0) : r.value.toFixed(1));
  return `${v} ${u}`; }

// searchable string for a measured record — clean label + UNS + class + composition
// (NOT the raw code, which is sometimes long lab-prep text that caused false matches,
//  e.g. "pH 7.8" in a note matching a "PH" query).
function _measSearchStr(r){ const m=/[NSR]\d{5}/.exec(String(r.code||"").toUpperCase());
  return (_measLabel(r)+" "+(m?m[0]:"")+" "+(r.cls||"")+" "+compStr(r.comp)).toUpperCase(); }
function renderData(){
  if(!$("dataTable")) return;
  const q = ($("d_search").value||"").trim().toUpperCase();
  const rows = PitCast.MEASUREMENTS.filter(r=>{
    if(_metricFilter && r.metric!==_metricFilter) return false;
    if(!q) return true;
    return _measSearchStr(r).includes(q);
  });
  const CAP=200, shown=rows.slice(0,CAP);
  $("d_count").innerHTML = `${rows.length} record${rows.length!==1?"s":""} match`
    + (rows.length>CAP?` — showing first ${CAP}, refine search to narrow`:"");
  const head=`<thead><tr><th>Alloy</th><th>Class</th><th>Metric</th><th>Value</th>`
    + `<th>Conditions</th><th>Composition (wt%)</th><th>Source</th><th></th></tr></thead>`;
  const body=shown.map(r=>`<tr>
    <td>${_measLabel(r)}</td>
    <td>${r.cls||"—"}</td><td>${r.metric}</td>
    <td class="num">${valStr(r)}</td>
    <td>${condStr(r)||"—"}</td>
    <td style="font-family:var(--mono);color:var(--muted)">${compStr(r.comp)}</td>
    <td>${r.doi?`<a href="https://doi.org/${r.doi}" target="_blank" rel="noopener">DOI</a>`:"—"}</td>
    <td><button class="assessbtn" data-id="${r.id}">Assess →</button></td></tr>`).join("");
  $("dataTable").innerHTML=head+"<tbody>"+body+"</tbody>";
}

function loadIntoAssess(r){
  customGrade={uns:r.code||"custom", name:(r.code?String(r.code).slice(0,24):"custom record"), comp:r.comp};
  selectedIdx=-1;
  gInput.value=`${customGrade.name} · from data`;
  gList.hidden=true;
  document.querySelector('[data-tab=assess]').click();
  renderAssess();
}

if($("d_search")) $("d_search").addEventListener("input", renderData);
document.querySelectorAll(".chip2").forEach(c=>c.onclick=()=>{
  document.querySelectorAll(".chip2").forEach(x=>x.classList.remove("active"));
  c.classList.add("active"); _metricFilter=c.dataset.metric; renderData();
});
if($("dataTable")) $("dataTable").addEventListener("click", e=>{
  const b=e.target.closest(".assessbtn"); if(!b) return;
  const r=measIndex()[+b.dataset.id]; if(r) loadIntoAssess(r);
});

// ---- data stat + init (load real datasets, then render) ---------------------
function updateDataStat(meta){
  const el = $("dataStat");
  if (!el) return;
  el.innerHTML = meta
    ? `<b>${PitCast.GRADES.length}</b> alloy grades · <b>${meta.n}</b> real cited measurements `
      + `(${meta.cpt} CPT + ${meta.epit} E<sub>pit</sub>) · `
      + `<a href="${meta.url}" target="_blank" rel="noopener">${meta.license}</a>`
    : `<b>${PitCast.GRADES.length}</b> alloy grades`;
}

// ===========================================================================
//                     PRO-GRADE FEATURE A — MULTI-GRADE COMPARE
// ===========================================================================
// Side-by-side evaluation of up to 5 candidate grades against a shared service
// condition set. Calls PitCast.assess() per grade and pivots into a metric
// table with best-in-column (green) / worst-in-column (red) highlighting.
// A ★ row marker identifies the cheapest grade that clears the user's risk
// threshold — the same "cheapest-that-clears" semantic as the Select tab.
// Industry workflow: FEED material-selection memo shortlist.
function _cmpGradeOptions(){
  const grades = PitCast.GRADES || [];
  return grades.map((g, i) => `<option value="${i}">${g.name || ("Grade " + i)}</option>`).join("");
}
function populateCompareGrades(){
  const html = _cmpGradeOptions();
  if (!html) return;
  const defaults = ["304L", "316L", "2205", "2507", "Alloy 625"];
  for (let k = 1; k <= 5; k++) {
    const sel = $("cmp_g" + k);
    if (!sel) continue;
    sel.innerHTML = html;
    // Try to land on a sensible default; fall back to ordinal
    let idx = PitCast.GRADES.findIndex(g => (g.name || "").indexOf(defaults[k-1]) === 0);
    if (idx < 0) idx = Math.min(k * 5, PitCast.GRADES.length - 1);
    sel.value = String(idx);
  }
}
function populateILIGrade(){
  const sel = $("ili_grade"); if (!sel || !window.B31G) return;
  sel.innerHTML = Object.entries(B31G.GRADES).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join("");
  sel.value = "X65";
}
function _fmt(n, d){ if (n==null || !isFinite(n)) return "—"; return (+n).toFixed(d==null?2:d); }
function _pctClass(v, allValues, lowerIsBetter){
  if (v==null || !isFinite(v)) return "";
  const xs = allValues.filter(x => x!=null && isFinite(x));
  if (xs.length < 2) return "";
  const lo = Math.min(...xs), hi = Math.max(...xs);
  if (lo === hi) return "";
  const t = lowerIsBetter ? (v - lo) / (hi - lo) : (hi - v) / (hi - lo);  // 0 best, 1 worst
  if (t <= 0.001) return "cmpbest";
  if (t >= 0.999) return "cmpworst";
  return "";
}
function renderCompare(){
  const host = $("cmp_results"); if (!host || !window.PitCast) return;
  const gv = id => $(id) ? $(id).value : "";
  const svc = { T:+gv("cmp_T"), Cl:+gv("cmp_Cl"), pH:+gv("cmp_pH"), pH2S:+gv("cmp_pH2S"),
                stress:+gv("cmp_stress"), HV:+gv("cmp_HV") };
  const thr = Math.max(0, Math.min(1, +gv("cmp_thr") || 0.15));
  // Collect selected grades (deduped, in order)
  const picks = [];
  const seen = new Set();
  for (let k = 1; k <= 5; k++) {
    const idx = +($("cmp_g" + k) ? $("cmp_g" + k).value : -1);
    if (!isFinite(idx) || idx < 0 || idx >= PitCast.GRADES.length) continue;
    if (seen.has(idx)) continue;
    seen.add(idx);
    picks.push(PitCast.GRADES[idx]);
  }
  if (!picks.length) { host.innerHTML = '<div class="placeholder">Pick at least one grade →</div>'; return; }
  // Assess each grade with shared conditions
  const rows = picks.map(g => {
    let r; try { r = PitCast.assess(g.comp || {}, svc); } catch(e) { r = { error: e.message }; }
    return { grade: g, r: r };
  });
  // Column extractors for best/worst tinting
  const ext = {
    pren:    rows.map(x => x.r && x.r.pren),
    cpt:     rows.map(x => x.r && x.r.cpt),
    pPit:    rows.map(x => x.r && x.r.pPit),
    pScc:    rows.map(x => x.r && x.r.pScc),
    pSour:   rows.map(x => x.r && x.r.pSourFail),
    overall: rows.map(x => x.r && x.r.overall),
    cost:    rows.map(x => x.r && x.r.cost)
  };
  // Cheapest-that-clears
  const clears = rows.filter(x => x.r && x.r.overall != null && x.r.overall <= thr && x.r.cost != null);
  clears.sort((a,b) => (a.r.cost||1e9) - (b.r.cost||1e9));
  const cheapestKey = clears.length ? clears[0].grade.name : null;
  // Build table
  const thStyle = 'style="padding:6px 10px;text-align:left;color:var(--dim);font-weight:600;font-size:12px;border-bottom:1px solid rgba(255,255,255,0.1)"';
  const tdStyle = 'style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.06)"';
  const tdRight = 'style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.06);text-align:right;font-variant-numeric:tabular-nums"';
  let html = `<style>
    .cmpbest{ background:rgba(52,211,153,0.18); color:#34d399; font-weight:600 }
    .cmpworst{ background:rgba(248,113,113,0.18); color:#fca5a5 }
    .cmpcheap{ background:rgba(56,189,248,0.18); color:#7dd3fc; font-weight:700 }
    .cmpgrid th{ position:sticky; top:0; background:#0b1220 }
  </style>
  <div style="overflow:auto"><table class="cmpgrid" style="border-collapse:collapse;width:100%;font-size:13px">
    <thead><tr>
      <th ${thStyle}>Grade</th>
      <th ${thStyle}>PREN<sub>N16</sub></th>
      <th ${thStyle}>CPT (°C)</th>
      <th ${thStyle}>Ferrite (%)</th>
      <th ${thStyle}>P(pit)</th>
      <th ${thStyle}>P(Cl-SCC)</th>
      <th ${thStyle}>P(sour SSC)</th>
      <th ${thStyle}>Overall P</th>
      <th ${thStyle}>ISO 15156</th>
      <th ${thStyle}>Rel. cost</th>
      <th ${thStyle}>Verdict</th>
    </tr></thead><tbody>`;
  rows.forEach(({grade, r}) => {
    const isCheap = grade.name === cheapestKey;
    const star = isCheap ? "★ " : "";
    const isoTxt = r.iso ? (r.iso.status + (r.iso.group ? (" — " + r.iso.group) : "")) : "—";
    const verdict = r.overall == null ? "—" : (r.overall <= thr ? "CLEARS" : "EXCEEDS");
    const verdictCls = r.overall == null ? "" : (r.overall <= thr ? "cmpbest" : "cmpworst");
    html += `<tr${isCheap ? ' class="cmpcheap"' : ''}>
      <td ${tdStyle}><b>${star}${grade.name || "—"}</b>${grade.uns ? ` <span style="color:var(--dim);font-size:11px">${grade.uns}</span>` : ""}</td>
      <td ${tdRight} class="${_pctClass(r.pren, ext.pren, false)}">${_fmt(r.pren, 1)}</td>
      <td ${tdRight} class="${_pctClass(r.cpt, ext.cpt, false)}">${_fmt(r.cpt, 1)}</td>
      <td ${tdRight}>${_fmt(r.ferrite, 0)}</td>
      <td ${tdRight} class="${_pctClass(r.pPit, ext.pPit, true)}">${_fmt(r.pPit, 3)}</td>
      <td ${tdRight} class="${_pctClass(r.pScc, ext.pScc, true)}">${_fmt(r.pScc, 3)}</td>
      <td ${tdRight} class="${_pctClass(r.pSour, ext.pSour, true)}">${_fmt(r.pSourFail, 3)}</td>
      <td ${tdRight} class="${_pctClass(r.overall, ext.overall, true)}">${_fmt(r.overall, 3)}</td>
      <td ${tdStyle}>${isoTxt}</td>
      <td ${tdRight} class="${_pctClass(r.cost, ext.cost, true)}">${_fmt(r.cost, 2)}</td>
      <td ${tdStyle} class="${verdictCls}">${verdict}</td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  // Summary card
  const cleared = clears.length;
  const cheapestLine = cheapestKey
    ? `<b style="color:#7dd3fc">★ Cheapest grade clearing P ≤ ${thr}: ${cheapestKey}</b> (rel. cost ${_fmt(clears[0].r.cost, 2)}, overall risk ${_fmt(clears[0].r.overall, 3)})`
    : `<b style="color:#fca5a5">No selected grade clears P ≤ ${thr} for these conditions — try a higher-PREN alloy or relax conditions.</b>`;
  html += `<div class="iso ${cleared ? 'within' : 'exceeds'}" style="margin-top:10px">
    ${cheapestLine}<br>
    ${cleared} of ${rows.length} grade(s) clear the risk threshold. Service: T ${svc.T} °C · Cl ${svc.Cl} ppm · pH ${svc.pH} · pH₂S ${svc.pH2S} kPa · σ ${svc.stress}×YS · HV ${svc.HV}.
  </div>
  <div class="explain"><span style="color:var(--dim)">PitCast.assess() per grade — PREN<sub>N16</sub>, leverage-aware CPT correlation (Nyby 2021 calibration n=51, 6.58 °C MAE), Cl-SCC + sour SSC envelopes (ISO 15156-3); cost relative to 304L. Best (green) / worst (red) per column.</span></div>`;
  host.innerHTML = html;
}

// ===========================================================================
//                     PRO-GRADE FEATURE B — ILI BATCH (CSV)
// ===========================================================================
// Industry workflow: ILI tool (MFL/UT) emits a defect list per pipeline run.
// Engineer needs P_safe + safety-factor verdict per defect, sorted worst-first,
// to triage repair priority. We accept CSV (file or paste) with required
// columns id, length_mm, depth_mm + optional chainage_m, clock_pos, width_mm,
// defect_type. Apply pipeline-level defaults (D, t, grade, MAOP, method) and
// run B31G.failurePressure() + B31G.classify() on each row.
function _parseILICSV(text){
  if (!text || !text.trim()) return { defects: [], errors: ["Empty CSV"] };
  // Strip BOM, split lines, drop comments + blanks
  text = text.replace(/^﻿/, "");
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith("#"));
  if (lines.length < 2) return { defects: [], errors: ["CSV needs a header row + at least 1 data row"] };
  // Tolerant tokenizer (handles double-quoted)
  function tok(line){
    const out = []; let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (c === "," && !inQ) { out.push(cur.trim()); cur = ""; continue; }
      cur += c;
    }
    out.push(cur.trim());
    return out;
  }
  const headers = tok(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, "_"));
  // Alias map — accept common synonyms
  const aliases = {
    id: ["id", "feature_id", "defect_id", "name", "tag"],
    chainage_m: ["chainage_m", "chainage", "km", "position_m", "log_distance_m", "abs_distance_m"],
    clock_pos: ["clock_pos", "clock", "orientation", "clock_position"],
    length_mm: ["length_mm", "length", "axial_length_mm", "l_mm", "l"],
    depth_mm: ["depth_mm", "depth", "max_depth_mm", "d_mm", "depth_max"],
    width_mm: ["width_mm", "width", "circ_width_mm", "w_mm"],
    defect_type: ["defect_type", "type", "feature_type", "class", "anomaly"]
  };
  const colIdx = {};
  Object.entries(aliases).forEach(([key, alts]) => {
    for (const a of alts) { const i = headers.indexOf(a); if (i >= 0) { colIdx[key] = i; break; } }
  });
  const errs = [];
  ["id", "length_mm", "depth_mm"].forEach(req => {
    if (colIdx[req] == null) errs.push(`Missing required column: ${req} (or synonym)`);
  });
  if (errs.length) return { defects: [], errors: errs, headers: headers };
  const defects = [];
  for (let r = 1; r < lines.length; r++) {
    const row = tok(lines[r]);
    const get = key => colIdx[key] != null ? row[colIdx[key]] : "";
    const id = get("id") || ("R-" + r);
    const L = +get("length_mm");
    const d = +get("depth_mm");
    if (!isFinite(L) || L <= 0 || !isFinite(d) || d <= 0) {
      errs.push(`Row ${r+1} (id=${id}): non-numeric or non-positive length/depth — skipped`);
      continue;
    }
    defects.push({
      id: id,
      chainage_m: +get("chainage_m") || null,
      clock_pos: get("clock_pos") || null,
      length_mm: L,
      depth_mm: d,
      width_mm: +get("width_mm") || null,
      defect_type: get("defect_type") || "corrosion"
    });
  }
  return { defects: defects, errors: errs, headers: headers };
}
function _runILIBatch(opts){
  // opts: { D, t, grade, MAOP_bar, method, defects: [] }
  const SMYS = (B31G.GRADES[opts.grade] || B31G.GRADES["X65"]).SMYS;
  return opts.defects.map(df => {
    const fp = B31G.failurePressure({ D: opts.D, t: opts.t, SMYS: SMYS, L: df.length_mm, d: df.depth_mm, method: opts.method });
    const cls = B31G.classify(fp.P_safe_bar, opts.MAOP_bar, fp.depthRatio, fp.throughWall);
    return Object.assign({}, df, {
      P_f_bar: fp.P_f_bar, P_safe_bar: fp.P_safe_bar,
      depthRatio: fp.depthRatio, SF: opts.MAOP_bar > 0 ? fp.P_safe_bar / opts.MAOP_bar : null,
      regime: fp.regime, throughWall: fp.throughWall,
      status: cls.status, note: cls.note
    });
  });
}
let _iliCache = { defects: [], processed: [], opts: null, errors: [] };
function renderILIPlaceholder(){
  const host = $("ili_results"); if (!host) return;
  if (_iliCache.processed && _iliCache.processed.length) { _renderILITable(); return; }
  host.innerHTML = '<div class="placeholder">Upload or paste an ILI defect CSV →<br><br><span style="font-size:13px;color:var(--dim)">Sample CSVs follow the columns <code>id, length_mm, depth_mm</code> at minimum. Typical ILI tools (ROSEN, Baker Hughes, NDT Global) emit these as part of the defect list. Pipeline geometry (OD, WT, grade, MAOP) is set once in the form on the left.</span></div>';
}
function _renderILITable(){
  const host = $("ili_results"); if (!host) return;
  const res = _iliCache.processed.slice();
  const opts = _iliCache.opts;
  if (!res.length) { host.innerHTML = '<div class="placeholder">No defects processed.</div>'; return; }
  // Sort by SF ascending (worst first)
  res.sort((a, b) => (a.SF||1e9) - (b.SF||1e9));
  const colours = { PASS: "#34d399", MONITOR: "#fbbf24", REPAIR: "#fb923c", IMMEDIATE: "#ef4444" };
  const counts = { PASS: 0, MONITOR: 0, REPAIR: 0, IMMEDIATE: 0 };
  res.forEach(r => { counts[r.status] = (counts[r.status]||0) + 1; });
  // Severity histogram (SVG)
  const total = res.length;
  const bars = ["PASS","MONITOR","REPAIR","IMMEDIATE"].map(s => {
    const n = counts[s]||0, pct = total ? (100*n/total).toFixed(0) : 0;
    return `<div style="flex:1;text-align:center"><div style="height:${4 + n*200/Math.max(1,total)}px;background:${colours[s]};border-radius:4px;margin-bottom:4px"></div><div style="font-size:11px;color:var(--dim)">${s}<br><b style="color:${colours[s]}">${n}</b> (${pct}%)</div></div>`;
  }).join("");
  const headerStyle = 'style="padding:6px 8px;background:#0b1220;text-align:left;color:var(--dim);font-weight:600;font-size:11px;border-bottom:1px solid rgba(255,255,255,0.1);position:sticky;top:0;cursor:pointer"';
  const cellStyle = 'style="padding:5px 8px;border-bottom:1px solid rgba(255,255,255,0.04);font-variant-numeric:tabular-nums;font-size:12px"';
  const showClusters = (opts.cluster_rule && opts.cluster_rule !== "none" && res.some(r => r.cluster_id));
  // Pre-compute cluster colour palette (one per cluster_id)
  const clusterColours = {};
  if (showClusters) {
    const palette = ["#7dd3fc", "#fda4af", "#fde047", "#a7f3d0", "#d8b4fe", "#fdba74", "#fca5a5", "#86efac"];
    const cIDs = [...new Set(res.map(r => r.cluster_id).filter(Boolean))];
    cIDs.forEach((cid, i) => { clusterColours[cid] = palette[i % palette.length]; });
  }
  let table = `<div style="max-height:380px;overflow:auto;border:1px solid rgba(255,255,255,0.08);border-radius:6px"><table style="border-collapse:collapse;width:100%">
    <thead><tr>
      <th ${headerStyle}>ID</th>
      ${showClusters ? `<th ${headerStyle}>Cluster</th>` : ``}
      <th ${headerStyle}>Chainage (m)</th>
      <th ${headerStyle}>Clock</th>
      <th ${headerStyle}>L (mm)</th>
      <th ${headerStyle}>d (mm)</th>
      <th ${headerStyle}>d/t (%)</th>
      <th ${headerStyle}>P<sub>safe</sub> (bar)</th>
      <th ${headerStyle}>SF</th>
      <th ${headerStyle}>Regime</th>
      <th ${headerStyle}>Verdict</th>
    </tr></thead><tbody>`;
  const ILI_RENDER_CAP = 1000;  // #1: cap rendered DOM rows so huge ILI files don't freeze the UI; full set stays in cache + CSV export. res is sorted worst-first, so these are the most-severe.
  const _renderRows = res.length > ILI_RENDER_CAP ? res.slice(0, ILI_RENDER_CAP) : res;
  _renderRows.forEach(r => {
    const col = colours[r.status] || "#888";
    const clusterCell = showClusters ? `<td ${cellStyle}>${r.cluster_id ? `<span title="${(r.cluster_members||[]).length ? 'Clustered with: '+r.cluster_members.join(', ')+'. Combined L='+(r.cluster_L_combined_mm||0).toFixed(0)+' mm, d='+(r.cluster_d_combined_mm||0).toFixed(1)+' mm' : 'Singleton cluster'}" style="background:${clusterColours[r.cluster_id]};color:#000;padding:2px 6px;border-radius:4px;font-weight:600;font-size:11px;cursor:help">${r.cluster_id}${r.cluster_n>1?'·'+r.cluster_n:''}</span>` : "—"}</td>` : ``;
    table += `<tr>
      <td ${cellStyle}><b>${r.id}</b></td>
      ${clusterCell}
      <td ${cellStyle}>${r.chainage_m != null ? r.chainage_m.toFixed(1) : "—"}</td>
      <td ${cellStyle}>${r.clock_pos || "—"}</td>
      <td ${cellStyle}>${r.length_mm.toFixed(1)}</td>
      <td ${cellStyle}>${r.depth_mm.toFixed(2)}</td>
      <td ${cellStyle}>${(r.depthRatio*100).toFixed(1)}</td>
      <td ${cellStyle}>${r.P_safe_bar.toFixed(1)}</td>
      <td ${cellStyle}>${r.SF != null ? r.SF.toFixed(2) : "—"}</td>
      <td ${cellStyle}><span style="color:var(--dim);font-size:11px">${r.regime}</span></td>
      <td ${cellStyle}><b style="color:${col}">${r.status}</b></td>
    </tr>`;
  });
  table += `</tbody></table></div>`;
  if (res.length > ILI_RENDER_CAP) table += `<div style="margin-top:6px;font-size:12px;color:#fbbf24">Showing the ${ILI_RENDER_CAP} most-severe of ${res.length.toLocaleString()} defects (table capped to stay responsive on large ILI runs) — use "Export processed results (CSV)" below for the complete set.</div>`;
  const exportBtn = `<button type="button" id="ili_export_csv" style="margin-top:10px;padding:8px 14px;background:rgba(56,189,248,0.15);border:1px solid rgba(56,189,248,0.3);color:#7dd3fc;border-radius:6px;cursor:pointer;font-weight:600">⤓ Export processed results (CSV)</button>`;
  // Cluster delta vs ungrouped baseline
  let clusterLine = "";
  if (showClusters && _iliCache.ungrouped && _iliCache.ungrouped.length) {
    const nClusters = new Set(res.map(r => r.cluster_id).filter(Boolean)).size;
    const nGrouped = res.filter(r => r.cluster_n > 1).length;
    // Min P_safe across all defects: with clustering vs without
    const psSorted = res.slice().map(r => r.P_safe_bar).sort((a,b) => a-b);
    const psSortedUn = _iliCache.ungrouped.slice().map(r => r.P_safe_bar).sort((a,b) => a-b);
    const minPS = psSorted[0] || 0;
    const minPSun = psSortedUn[0] || 0;
    const pctDrop = minPSun > 0 ? (100 * (1 - minPS / minPSun)) : 0;
    const ruleName = { dnv:"DNV-RP-F101 §3.7", modb31g:"B31G/Mod-B31G §3.4.5", pof:"POF-100 §7" }[opts.cluster_rule] || opts.cluster_rule;
    clusterLine = `<br><span style="color:${pctDrop>5?'#fbbf24':'#7dd3fc'}">▸ Interaction rule <b>${ruleName}</b>: ${nClusters} cluster(s), ${nGrouped} defect(s) interacted${pctDrop>0.5?` · worst-case P<sub>safe</sub> reduced <b>${pctDrop.toFixed(1)}%</b> vs ungrouped (${minPSun.toFixed(1)}→${minPS.toFixed(1)} bar)`:''}</span>`;
  }
  const summary = `<div class="iso ${(counts.IMMEDIATE||counts.REPAIR)?'exceeds':(counts.MONITOR?'untabulated':'within')}">
    <b>ILI batch summary — ${total} defects processed</b><br>
    Pipeline: D ${opts.D} mm × t ${opts.t} mm · ${B31G.GRADES[opts.grade].label} · MAOP ${opts.MAOP_bar} bar · method ${opts.method === "modb31g" ? "Modified B31G (0.85 dL Kiefner)" : "Original B31G (0.667 dL)"}.<br>
    <b style="color:#34d399">PASS ${counts.PASS||0}</b> · <b style="color:#fbbf24">MONITOR ${counts.MONITOR||0}</b> · <b style="color:#fb923c">REPAIR ${counts.REPAIR||0}</b> · <b style="color:#ef4444">IMMEDIATE ${counts.IMMEDIATE||0}</b><br>
    Worst defect: <b>${res[0].id}</b> · SF ${_fmt(res[0].SF, 2)} · d/t ${(res[0].depthRatio*100).toFixed(1)}% · P<sub>safe</sub> ${res[0].P_safe_bar.toFixed(1)} bar.${clusterLine}</div>`;
  const errBlock = _iliCache.errors.length ? `<div class="iso untabulated" style="margin-top:8px"><b>${_iliCache.errors.length} parse note(s):</b><ul style="margin:4px 0 0 18px;font-size:12px">${_iliCache.errors.slice(0,8).map(e=>"<li>"+e+"</li>").join("")}${_iliCache.errors.length>8?"<li>… and "+(_iliCache.errors.length-8)+" more</li>":""}</ul></div>` : "";
  const histo = `<div style="display:flex;gap:8px;align-items:flex-end;margin:14px 0;padding:12px;background:rgba(255,255,255,0.02);border-radius:8px;border:1px solid rgba(255,255,255,0.05);min-height:220px">${bars}</div>`;
  host.innerHTML = summary + histo + table + exportBtn + `<div class="explain" style="margin-top:8px"><span style="color:var(--dim)">ASME B31G-2012 §2 (original parabolic) / Kiefner & Vieth 1989 (Modified B31G — 0.85 dL); Folias bulging factor M; Barlow thin-shell; classification per B31G §3.6 + API 1163 ILI guidance. Screening — each defect treated as axial external metal-loss; interaction rules (POF-W or NACE SP0102 close-defect grouping) not applied — engineer must re-check candidates for interaction.</span></div>` + errBlock;
  // Wire export button (idempotent)
  const exp = $("ili_export_csv");
  if (exp) exp.onclick = () => _exportILIBatchCSV();
}
function _exportILIBatchCSV(){
  const res = _iliCache.processed; const opts = _iliCache.opts;
  if (!res.length) return;
  const hdr = ["id","chainage_m","clock_pos","length_mm","depth_mm","d_over_t_pct","P_safe_bar","P_f_bar","safety_factor","status","regime","note"];
  const lines = [
    "# PitCast ILI batch export · " + new Date().toISOString(),
    "# Pipeline: D=" + opts.D + " mm, t=" + opts.t + " mm, grade=" + opts.grade + ", MAOP=" + opts.MAOP_bar + " bar, method=" + opts.method,
    hdr.join(",")
  ];
  res.forEach(r => lines.push([
    r.id, r.chainage_m||"", r.clock_pos||"", r.length_mm, r.depth_mm,
    (r.depthRatio*100).toFixed(2), r.P_safe_bar.toFixed(2), r.P_f_bar.toFixed(2),
    r.SF != null ? r.SF.toFixed(3) : "", r.status, '"'+r.regime+'"', '"'+r.note.replace(/"/g,"'")+'"'
  ].join(",")));
  _dl("pitcast_ili_batch_" + Date.now() + ".csv", lines.join("\n"));
}
function _iliSampleCSV(){
  // 15 defects, log-normal-shaped length distribution + depth/length correlation —
  // representative of a real ILI run on a 12-inch class-1 onshore line.
  return `# PitCast sample ILI defect CSV
# 15 defects on a hypothetical 12.75-in (323.9 mm) OD x 0.375-in (9.53 mm) WT
# API 5L X65 pipeline, generated for ILI batch demonstration purposes only.
id,chainage_m,clock_pos,length_mm,depth_mm,defect_type
D-001,124.5,03:00,180,3.2,corrosion
D-002,256.2,06:30,95,2.1,corrosion
D-003,489.8,11:00,250,5.5,corrosion
D-004,612.0,07:00,55,4.8,pit-cluster
D-005,742.3,09:15,420,6.2,axial-groove
D-006,890.5,12:00,75,1.8,corrosion
D-007,1024.9,02:00,180,7.4,corrosion
D-008,1245.0,08:30,40,3.5,pit-cluster
D-009,1430.2,05:45,310,4.9,corrosion
D-010,1612.8,11:30,140,2.6,corrosion
D-011,1855.4,01:15,95,5.1,corrosion
D-012,2102.7,06:00,225,6.8,axial-groove
D-013,2348.0,10:00,70,3.0,pit-cluster
D-014,2580.5,04:30,165,2.4,corrosion
D-015,2790.1,09:00,290,8.1,corrosion
`;
}
function _downloadILISample(ev){
  if (ev && ev.preventDefault) ev.preventDefault();
  _dl("pitcast_ili_sample.csv", _iliSampleCSV());
}
function processILICSVText(text){
  const parsed = _parseILICSV(text);
  if (!parsed.defects.length) {
    $("ili_results").innerHTML = `<div class="iso exceeds"><b>Could not parse CSV.</b><br>${parsed.errors.map(e=>"• "+e).join("<br>")}</div>`;
    return;
  }
  const gv = id => $(id) ? $(id).value : "";
  const opts = {
    D: +gv("ili_D"), t: +gv("ili_t"), grade: gv("ili_grade") || "X65",
    MAOP_bar: +gv("ili_MAOP"), method: gv("ili_method") || "modb31g",
    cluster_rule: gv("ili_cluster_rule") || "none",
    defects: parsed.defects
  };
  if (!(opts.D > 0 && opts.t > 0 && opts.MAOP_bar > 0)) {
    $("ili_results").innerHTML = `<div class="iso exceeds">Pipeline OD, WT, and MAOP must all be > 0.</div>`;
    return;
  }
  // Run BOTH unclustered (baseline) + clustered (if rule != none) for delta comparison
  const ungrouped = _runILIBatch(Object.assign({}, opts, { cluster_rule: "none" }));
  const processed = (opts.cluster_rule && opts.cluster_rule !== "none" && window.Interaction)
    ? _runILIBatchClustered(opts)
    : ungrouped;
  _iliCache = { defects: parsed.defects, processed: processed, ungrouped: ungrouped, opts: opts, errors: parsed.errors };
  _renderILITable();
}

// Cluster-aware batch — uses Interaction.cluster() per the chosen rule, then
// runs B31G on each cluster using its combined L + max depth. Per-defect rows
// inherit the cluster's P_safe / verdict so the grid shows interaction effect.
function _runILIBatchClustered(opts) {
  if (!window.Interaction) return _runILIBatch(opts);
  // Convert defects to interaction-engine format
  const features = opts.defects.map(d => ({
    id: d.id,
    x_axial_mm: (d.chainage_m || 0) * 1000,
    clock_pos: d.clock_pos,
    L_mm: d.length_mm,
    W_mm: d.width_mm || (d.length_mm * 0.3),  // assume 30 % aspect if width missing
    d_mm: d.depth_mm,
    D_mm: opts.D,
    t_mm: opts.t
  }));
  const clusters = window.Interaction.cluster(features, {
    rule: opts.cluster_rule, D_mm: opts.D, t_mm: opts.t
  });
  // Build a per-defect map of cluster info
  const defectByID = {};
  opts.defects.forEach(d => { defectByID[d.id] = d; });
  const SMYS = (B31G.GRADES[opts.grade] || B31G.GRADES["X65"]).SMYS;
  const out = [];
  clusters.forEach(c => {
    // Run B31G on the cluster's combined dimensions
    const fp = B31G.failurePressure({
      D: c.D_mm || opts.D, t: c.t_mm || opts.t, SMYS: SMYS,
      L: c.L_combined, d: c.d_combined, method: opts.method
    });
    const cls = B31G.classify(fp.P_safe_bar, opts.MAOP_bar, fp.depthRatio, fp.throughWall);
    // Emit one row per cluster member, all inheriting the cluster's P_safe
    c.member_ids.forEach(mid => {
      const d = defectByID[mid];
      if (!d) return;
      out.push(Object.assign({}, d, {
        P_f_bar: fp.P_f_bar, P_safe_bar: fp.P_safe_bar,
        depthRatio: fp.depthRatio,
        SF: opts.MAOP_bar > 0 ? fp.P_safe_bar / opts.MAOP_bar : null,
        regime: fp.regime, throughWall: fp.throughWall,
        status: cls.status, note: cls.note,
        cluster_id: c.id, cluster_n: c.n_members,
        cluster_regime: c.regime, cluster_L_combined_mm: c.L_combined,
        cluster_d_combined_mm: c.d_combined,
        cluster_members: c.member_ids.filter(x => x !== mid)
      }));
    });
  });
  return out;
}

// ===========================================================================
//                     PRO-GRADE FEATURE C — XLSX EXPORT (SheetJS)
// ===========================================================================
// Multi-sheet workbook generation for the active tab. Per tab we emit:
//   - Inputs sheet: every form value the engine consumed
//   - Results sheet: every computed metric, with units and citations
//   - (where applicable) Defect/Comparison grid as its own sheet
// Pure calculation + reference — no stamp/audit ceremony (per the project's
// "no compliance theater" rule).
function exportActiveXLSX(){
  if (typeof XLSX === "undefined") { alert("Excel library not loaded — please refresh."); return; }
  const at = document.querySelector(".tab.active"); const tab = at ? at.dataset.tab : "assess";
  const gv = id => $(id) ? $(id).value : "";
  const wb = XLSX.utils.book_new();
  const _aoa = (sheet, rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheet);
  const HEAD = ["PitCast · pitcast.austenite.org", "Generated " + new Date().toISOString(), "Tab: " + tab];
  const FOOT = ["", "Screening estimate — not a substitute for qualified engineering."];

  if (tab === "assess") {
    const g = currentGrade();
    const svc = { T:+gv("a_T"), Cl:+gv("a_Cl"), pH:+gv("a_pH"), pH2S:+gv("a_pH2S"), stress:+gv("a_stress"), HV:+gv("a_HV"), ageT:+gv("a_ageT"), aget:+gv("a_aget") };
    const r = PitCast.assess(g.comp, svc);
    _aoa("Inputs", [HEAD, [], ["Grade", g.name||""], ["UNS", g.uns||""], ["Composition", compString(g.comp)], [],
      ["Service", "Value", "Unit"], ["Temperature", svc.T, "°C"], ["Chloride", svc.Cl, "ppm"], ["pH", svc.pH, ""], ["H2S partial pressure", svc.pH2S, "kPa"], ["Tensile stress", svc.stress, "× yield"], ["Hardness", svc.HV, "HV"], ["Aging temperature", svc.ageT, "°C"], ["Aging time", svc.aget, "h"]]);
    _aoa("Results", [HEAD, [],
      ["Metric", "Value", "Unit", "Note"],
      ["PREN (N16)", +r.pren.toFixed(2), "", "Cr + 3.3·Mo + 16·N"],
      ["CPT", +r.cpt.toFixed(1), "°C", "G48 (6% FeCl3) calibration, n=51"],
      ["Ferrite", +r.ferrite.toFixed(0), "%", "WRC-1992 diagram"],
      ["P(pit)", r.pPit != null ? +r.pPit.toFixed(4) : null, "", "P(CPT < T_service)"],
      ["P(Cl-SCC)", r.pScc != null ? +r.pScc.toFixed(4) : null, "", "ISO 15156-3 envelope"],
      ["P(sour SSC)", r.pSourFail != null ? +r.pSourFail.toFixed(4) : null, "", "NACE MR0175 / ISO 15156"],
      ["Overall risk", +r.overall.toFixed(4), "", "Maximum of the above"],
      ["Dominant mechanism", r.dominant, "", ""],
      ["Relative cost", +r.cost.toFixed(2), "× 304L", ""],
      ["ISO 15156 status", r.iso ? r.iso.status : "", "", r.iso ? (r.iso.group||"") : ""], FOOT]);
    _aoa("Citations", [HEAD, [], ["Source"],
      ["Nyby et al., Scientific Data 8, 58 (2021) — DOI 10.6084/m9.figshare.13038257 (CC BY 4.0)"],
      ["ASTM G48 — Pitting & crevice corrosion (6% FeCl3 immersion)"],
      ["ISO 15156-3:2020 — Petroleum/NG industries — CRA in H2S-containing environments"],
      ["NACE MR0175 / ISO 15156 — Sour service material selection"],
      ["WRC-1992 — Welding Research Council ferrite-prediction diagram"]]);
  }
  else if (tab === "compare") {
    const svc = { T:+gv("cmp_T"), Cl:+gv("cmp_Cl"), pH:+gv("cmp_pH"), pH2S:+gv("cmp_pH2S"), stress:+gv("cmp_stress"), HV:+gv("cmp_HV") };
    const picks = [];
    for (let k = 1; k <= 5; k++) { const idx = +($("cmp_g" + k) ? $("cmp_g" + k).value : -1); if (isFinite(idx) && idx >= 0) picks.push(PitCast.GRADES[idx]); }
    _aoa("Inputs", [HEAD, [], ["Service", "Value", "Unit"], ["Temperature", svc.T, "°C"], ["Chloride", svc.Cl, "ppm"], ["pH", svc.pH, ""], ["H2S", svc.pH2S, "kPa"], ["Stress", svc.stress, "× yield"], ["Hardness", svc.HV, "HV"], ["Risk threshold", +gv("cmp_thr"), ""]]);
    const rows = [["Grade", "UNS", "PREN", "CPT (°C)", "Ferrite (%)", "P(pit)", "P(Cl-SCC)", "P(sour SSC)", "Overall P", "ISO 15156", "Rel. cost"]];
    picks.forEach(g => { let r; try { r = PitCast.assess(g.comp || {}, svc); } catch(e){ r = {}; }
      rows.push([g.name||"", g.uns||"", _fmt(r.pren,2), _fmt(r.cpt,1), _fmt(r.ferrite,0), _fmt(r.pPit,4), _fmt(r.pScc,4), _fmt(r.pSourFail,4), _fmt(r.overall,4), r.iso?(r.iso.status+(r.iso.group?(" — "+r.iso.group):"")):"", _fmt(r.cost,2)]);
    });
    _aoa("Comparison", [HEAD, [], ...rows, FOOT]);
  }
  else if (tab === "ili") {
    if (!_iliCache.processed.length) { alert("No ILI batch processed yet — upload or paste CSV and click Process."); return; }
    const opts = _iliCache.opts;
    _aoa("Pipeline", [HEAD, [], ["Parameter", "Value", "Unit"], ["OD", opts.D, "mm"], ["WT", opts.t, "mm"], ["Grade", opts.grade, ""], ["SMYS", B31G.GRADES[opts.grade].SMYS, "MPa"], ["MAOP", opts.MAOP_bar, "bar"], ["Method", opts.method === "modb31g" ? "Modified B31G (0.85 dL Kiefner)" : "Original B31G (0.667 dL)", ""]]);
    const head = ["ID","Chainage (m)","Clock","Length (mm)","Depth (mm)","d/t (%)","P_safe (bar)","P_failure (bar)","SF","Regime","Verdict","Note"];
    const rows = _iliCache.processed.slice().sort((a,b)=>(a.SF||1e9)-(b.SF||1e9)).map(r => [r.id, r.chainage_m||"", r.clock_pos||"", +r.length_mm, +r.depth_mm, +(r.depthRatio*100).toFixed(2), +r.P_safe_bar.toFixed(2), +r.P_f_bar.toFixed(2), r.SF!=null?+r.SF.toFixed(3):"", r.regime, r.status, r.note]);
    _aoa("Defects", [HEAD, [], head, ...rows, FOOT]);
    const counts = { PASS:0, MONITOR:0, REPAIR:0, IMMEDIATE:0 };
    _iliCache.processed.forEach(r => counts[r.status] = (counts[r.status]||0)+1);
    _aoa("Summary", [HEAD, [], ["Verdict", "Count", "% of total"], ...Object.entries(counts).map(([k,v]) => [k, v, _iliCache.processed.length ? +((100*v/_iliCache.processed.length).toFixed(1)) : 0]), FOOT]);
  }
  else if (tab === "co2") {
    const co2In = { T:+gv("c_T"), pCO2:+gv("c_pCO2"), pH:+gv("c_pH"), velocity:+gv("c_u"), pipeID:+gv("c_d"), fe2:+gv("c_fe2"), pH2S:+gv("c_pH2S"), waterCut:+gv("c_wc"), glycol:+gv("c_meg"), oilType:gv("c_oil"), bicarbonate:+gv("c_bicarb"), ageH:+gv("c_age") };
    _aoa("Inputs", [HEAD, [], ["Parameter", "Value", "Unit"], ...Object.entries(co2In).map(([k,v])=>[k,v,""]), FOOT]);
    if (window.CO2) {
      const models = ["deWaard1975", "deWaard1995", "norsok506", "nesc", "multicorp"].map(m => { try { const r = CO2[m] ? CO2[m](co2In) : null; return [m, r ? +(r.mmyr||r.mm_yr||0).toFixed(3) : "—"]; } catch(e){ return [m, "err"]; }}).filter(x => x[1] !== "—" && x[1] !== "err");
      _aoa("Models", [HEAD, [], ["Model", "Rate (mm/y)"], ...models, FOOT]);
    }
  }
  else if (tab === "cpac") {
    const acIn = { Vac:+gv("p_vac"), rho:+gv("p_rho"), d:+gv("p_d"), Jdc:+gv("p_jdc") };
    _aoa("Inputs", [HEAD, [], ["Parameter","Value","Unit"], ["AC touch voltage", acIn.Vac, "V"], ["Soil resistivity", acIn.rho, "Ω·m"], ["Holiday diameter", acIn.d, "mm"], ["CP DC density", acIn.Jdc, "A/m²"], ["E_on", +gv("p_eon"), "mV vs Cu/CuSO4"], ["E_io", +gv("p_eio"), "mV"], ["E_dep", +gv("p_edep"), "mV"]]);
    if (window.Anode) {
      const an = Anode.size({ area_m2:+gv("a_area"), lifeYr:+gv("a_life"), environment:gv("a_env"), coating:gv("a_coating"), anode:gv("a_anode") });
      _aoa("Anode", [HEAD, [], ["Parameter","Value","Unit"], ["Environment", an.environment, ""], ["Coating", an.coating, ""], ["Anode alloy", an.anode, ""], ["Service T", an.T_C_service, "°C"], ["Salinity", an.env_properties.salinity_ppt, "‰"], ["Dissolved O2", an.env_properties.O2_mg_L, "mg/L"], ["Resistivity", an.env_properties.rho_ohm_m, "Ω·m"], ["I mean", +an.I_mean_A.toFixed(2), "A"], ["Anode net mass", +an.anodeMass_kg_net.toFixed(0), "kg"], ["Number of anodes", an.numAnodes, ""], FOOT]);
    }
    if (window.Galvanic) {
      const gEnv = gv("g_env") || "SW";
      const gT = +gv("g_T") || 25;
      const gCl = gv("g_Cl") !== "" ? +gv("g_Cl") : (gEnv==="FW"?10:19000);
      const gFlow = gv("g_flow") || "moderate";
      const gc = Galvanic.couple({ a:gv("g_a"), b:gv("g_b"), areaRatio:+gv("g_ratio"), flow:gFlow, env:gEnv, T_C:gT, Cl_ppm:gCl });
      if (!gc.error) _aoa("Galvanic", [HEAD, [], ["Parameter","Value","Unit"],
        ["Anode", gc.anode, ""], ["Cathode", gc.cathode, ""],
        ["Anode E_corr", +gc.anode_E.toFixed(3), "V vs Ag/AgCl"],
        ["Cathode E_corr", +gc.cathode_E.toFixed(3), "V vs Ag/AgCl"],
        ["ΔE", gc.deltaE_mV.toFixed(0), "mV"], ["Area ratio", gc.areaRatio, ""],
        ["Environment", gc.env, ""], ["Temperature", gc.T_C, "°C"], ["Chloride", gc.Cl_ppm, "ppm"], ["Flow regime", gc.flow, ""],
        ["i_anode", +gc.i_anode_Am2.toFixed(3), "A/m²"], ["CR anode", +gc.CR_anode_mm_yr.toFixed(3), "mm/y"],
        ["Mass-transfer capped", gc.mass_transfer_capped?"yes":"no", ""],
        ["Anode polarisation source", gc.anode_source || "family default", ""],
        ["Cathode polarisation source", gc.cathode_source || "family default", ""],
        ["Anode passivation state", gc.anode_passivation || "n/a", ""],
        ["Level", gc.level, ""], FOOT]);
    }
  }
  else if (tab === "integrity") {
    const pipe = { D:+gv("b_D"), t:+gv("b_t"), grade:gv("b_grade"), MAOP:+gv("b_MAOP"), L:+gv("b_L"), d:+gv("b_d"), method:gv("b_method") };
    _aoa("Inputs", [HEAD, [], ["Parameter","Value","Unit"], ["OD", pipe.D, "mm"], ["WT", pipe.t, "mm"], ["Grade", pipe.grade, ""], ["MAOP", pipe.MAOP, "bar"], ["Defect length", pipe.L, "mm"], ["Defect depth", pipe.d, "mm"], ["Method", pipe.method, ""]]);
    if (window.B31G) {
      const SMYS = (B31G.GRADES[pipe.grade]||{}).SMYS;
      const fp = B31G.failurePressure({D:pipe.D, t:pipe.t, SMYS:SMYS, L:pipe.L, d:pipe.d, method:pipe.method});
      const cls = B31G.classify(fp.P_safe_bar, pipe.MAOP, fp.depthRatio, fp.throughWall);
      _aoa("B31G FFS", [HEAD, [], ["Metric","Value","Unit"], ["σ_flow", +fp.sigmaFlow_MPa.toFixed(1), "MPa"], ["σ_f", +fp.sigma_f_MPa.toFixed(1), "MPa"], ["Folias M", +fp.M.toFixed(3), ""], ["P_failure", +fp.P_f_bar.toFixed(2), "bar"], ["P_safe", +fp.P_safe_bar.toFixed(2), "bar"], ["d/t", +(fp.depthRatio*100).toFixed(1), "%"], ["Regime", fp.regime, ""], ["Verdict", cls.status, ""], ["Note", cls.note, ""], FOOT]);
    }
  }
  else {
    _aoa("Note", [HEAD, [], ["This tab does not yet have an XLSX export profile — use Print/Save as PDF."], FOOT]);
  }
  XLSX.writeFile(wb, "pitcast_" + tab + "_" + Date.now() + ".xlsx");
}

// ===========================================================================
//                  EVENT BINDINGS — compare + ILI + XLSX + sample
// ===========================================================================
function _bindIndustryHandlers(){
  if ($("compareForm")) $("compareForm").addEventListener("input", renderCompare);
  for (let k = 1; k <= 5; k++) { const s = $("cmp_g" + k); if (s) s.addEventListener("change", renderCompare); }
  const fI = $("ili_file"); if (fI) fI.addEventListener("change", e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { $("ili_paste").value = rd.result; processILICSVText(rd.result); };
    rd.readAsText(f);
  });
  const pB = $("ili_process"); if (pB) pB.onclick = () => processILICSVText($("ili_paste") ? $("ili_paste").value : "");
  const sL = $("ili_sample"); if (sL) sL.onclick = _downloadILISample;
  const bX = $("btnXLSX"); if (bX) bX.onclick = exportActiveXLSX;
}

// ===========================================================================
//                  TIER-3 ENGINES — FFS / MR0175 / CIPS render
// ===========================================================================
function renderFFS(){
  var host = $("ffs_results"); if (!host || !window.FFS) return;
  var gv = function(id){ return $(id) ? +$(id).value : 0; };
  var gvc = function(id){ return $(id) ? !!$(id).checked : false; };
  // Part 5 LTA
  var p5 = FFS.part5_LTA_L1({
    tmm_mm: gv("ffs5_tmm"), t_nom_mm: gv("ffs5_tnom"),
    LOSS_mm: gv("ffs5_loss"), FCA_mm: gv("ffs5_fca"),
    s_axial_mm: gv("ffs5_s"), D_inside_mm: gv("ffs5_D"),
    MAWP_design_bar: gv("ffs5_mawp"), RSFa: gv("ffs5_rsfa")
  });
  // Part 6 Pitting — Level 1 (auto from pit density + max depth) + Level 2 (pit-couple)
  var p6L1 = FFS.part6_pitting_L1({
    max_pit_depth_mm: gv("ffs6_d"),
    pit_density_per_m2: gv("ffs6_n"),
    t_nom_mm: gv("ffs5_tnom"),
    MAWP_design_bar: gv("ffs5_mawp"),
    RSFa: gv("ffs5_rsfa")
  });
  var p6L2 = FFS.part6_pitting_L2({
    max_pit_depth_mm: gv("ffs6_d"),
    pit_diameter_mm: gv("ffs6_dia"),
    pit_spacing_mm: gv("ffs6_s"),
    t_nom_mm: gv("ffs5_tnom"),
    FCA_mm: gv("ffs5_fca"),
    MAWP_design_bar: gv("ffs5_mawp"),
    RSFa: gv("ffs5_rsfa")
  });
  // Part 7 HIC — Level 1 (NACE TM0284 ratio check) + Level 2 (blister density RSF)
  var p7L1 = FFS.part7_HIC_L1({
    CLR_pct: gv("ffs7_CLR"), CTR_pct: gv("ffs7_CTR"), CSR_pct: gv("ffs7_CSR"),
    has_SOHIC: gvc("ffs7_sohic"), has_surface_breaking_crack: gvc("ffs7_sb")
  });
  var p7L2 = FFS.part7_HIC_L2({
    blister_diameter_mm: gv("ffs7_bd"),
    blister_density_per_m2: gv("ffs7_bn"),
    t_loss_fraction: gv("ffs7_tl"),
    t_nom_mm: gv("ffs5_tnom"),
    FCA_mm: gv("ffs5_fca"),
    MAWP_design_bar: gv("ffs5_mawp"),
    RSFa: gv("ffs5_rsfa")
  });
  function cls(passes) { return passes === true ? "within" : passes === false ? "exceeds" : "untabulated"; }
  function nv(v, d) { return v != null && isFinite(v) ? v.toFixed(d) : "—"; }
  host.innerHTML =
    '<div class="iso ' + cls(p5.passes) + '"><b>Part 5 LTA Level 1 — ' + (p5.passes === true ? 'PASS' : p5.passes === false ? 'FAIL' : 'GATES FAIL') + '</b><br>' +
      'Rt = <b>' + nv(p5.Rt, 3) + '</b> · λ = <b>' + nv(p5.lambda, 3) + '</b> · Mt = <b>' + nv(p5.Mt, 3) + '</b> · RSF = <b>' + nv(p5.RSF, 3) + '</b> (RSFa = ' + p5.RSFa + ')<br>' +
      'MAWP reduced: <b>' + nv(p5.MAWP_reduced_bar, 1) + ' bar</b><br>' +
      '<span style="color:var(--dim);font-size:12px">' + (p5.recommendation || '') + '</span></div>' +
    '<div class="explain"><span style="color:var(--dim)">' + (p5.ref || '') + '</span></div>' +
    '<div class="iso ' + cls(p6L1.passes) + '"><b>Part 6 Pitting Level 1 — ' + (p6L1.passes ? 'PASS' : 'FAIL') + '</b><br>' +
      'Classification: <b>' + (p6L1.type || '—') + '</b><br>' +
      'Depth ratio = <b>' + nv(p6L1.depth_ratio*100, 0) + '%</b> · density = <b>' + nv(p6L1.pit_density_per_m2, 0) + ' /m²</b> · RSF = <b>' + (p6L1.RSF != null ? p6L1.RSF.toFixed(2) : 'N/A') + '</b> (RSFa = ' + p6L1.RSFa + ')<br>' +
      'MAWP reduced: <b>' + nv(p6L1.MAWP_reduced_bar, 1) + ' bar</b><br>' +
      '<span style="color:var(--dim);font-size:12px">' + (p6L1.recommendation || '') + '</span></div>' +
    '<div class="iso ' + (p6L2.error ? 'exceeds' : cls(p6L2.passes)) + '"><b>Part 6 Pitting Level 2 — ' +
      (p6L2.error ? 'NOT APPLICABLE' : (p6L2.passes ? 'PASS' : 'FAIL')) + '</b><br>' +
      (p6L2.error
        ? '<span style="color:#fbbf24">' + p6L2.error + '</span>'
        : 'R_wt = <b>' + nv(p6L2.R_wt, 3) + '</b> · Mt_pit = <b>' + nv(p6L2.Mt_pit, 3) + '</b> · RSF = <b>' + nv(p6L2.RSF, 3) + '</b><br>MAWP reduced: <b>' + nv(p6L2.MAWP_reduced_bar, 1) + ' bar</b><br><span style="color:var(--dim);font-size:12px">' + (p6L2.recommendation || '') + '</span>') +
      '</div>' +
    '<div class="explain"><span style="color:var(--dim)">' + (p6L1.ref || '') + ' · ' + (p6L2.ref || '') + '</span></div>' +
    '<div class="iso ' + cls(p7L1.passes) + '"><b>Part 7 HIC Level 1 (NACE TM0284) — ' + (p7L1.passes ? 'PASS' : 'FAIL') + '</b><br>' +
      'CLR <b>' + nv(p7L1.CLR_pct, 1) + '%</b> (≤15: ' + (p7L1.CLR_pass?'✓':'✗') + ') · CTR <b>' + nv(p7L1.CTR_pct, 1) + '%</b> (≤5: ' + (p7L1.CTR_pass?'✓':'✗') + ') · CSR <b>' + nv(p7L1.CSR_pct, 1) + '%</b> (≤2: ' + (p7L1.CSR_pass?'✓':'✗') + ')<br>' +
      (p7L1.has_SOHIC ? '<b style="color:#fbbf24">SOHIC ACTIVE</b> · ' : '') + (p7L1.has_surface_breaking_crack ? '<b style="color:#c0392b">SURFACE-BREAKING CRACK</b><br>' : '') +
      'Verdict: <b>' + (p7L1.verdict || '—') + '</b><br>' +
      '<span style="color:var(--dim);font-size:12px">' + (p7L1.action || '') + '</span></div>' +
    '<div class="iso ' + cls(p7L2.passes) + '"><b>Part 7 HIC Level 2 (blister-density RSF) — ' + (p7L2.passes ? 'PASS' : 'FAIL') + '</b><br>' +
      'Blister-affected area = <b>' + nv(p7L2.blister_area_fraction*100, 2) + '%</b> · t-loss under blister = <b>' + nv(p7L2.t_loss_fraction*100, 0) + '%</b> · K_blister = ' + (p7L2.K_blister || 2) + '<br>' +
      'RSF = <b>' + nv(p7L2.RSF, 3) + '</b> (RSFa = ' + p7L2.RSFa + ') · MAWP reduced: <b>' + nv(p7L2.MAWP_reduced_bar, 1) + ' bar</b><br>' +
      '<span style="color:var(--dim);font-size:12px">' + (p7L2.recommendation || '') + '</span></div>' +
    '<div class="explain"><span style="color:var(--dim)">' + (p7L1.ref || '') + ' · ' + (p7L2.ref || '') + '</span></div>' + tierTag("API 579 Part 5 LTA reproduces FFS.jl reference (RSF ≈ 0.93)");
}
if ($("ffsForm")) $("ffsForm").addEventListener("input", renderFFS);

function renderMR0175(){
  var host = $("mr0175_results"); if (!host || !window.MR0175) return;
  var v = MR0175.issue({
    uns: $("mr_uns").value.trim().toUpperCase(),
    composition: { Cr: +$("mr_Cr").value, Mo: +$("mr_Mo").value, Ni: +$("mr_Ni").value, N: +$("mr_N").value, C: 0.05 },
    T_C: +$("mr_T").value, pH2S_kPa: +$("mr_pH2S").value, Cl_mg_L: +$("mr_Cl").value, pH_in_situ: +$("mr_pH").value,
    stress_pct_SMYS: +$("mr_stress").value, hardness_HRC: +$("mr_hrc").value,
    equipment_class: $("mr_equip").value, scope: $("mr_scope").value
  });
  var cls = v.IN_SCOPE === true ? "within" : v.IN_SCOPE === false ? "exceeds" : "untabulated";
  host.innerHTML =
    '<div class="iso ' + cls + '"><b>MR0175 / ISO 15156 — ' + (v.IN_SCOPE === true ? 'IN-SCOPE' : 'OUT-OF-SCOPE') + '</b> · Route: <b>' + v.route + '</b><br>' +
      (v.envelope ? 'Envelope: ' + JSON.stringify(v.envelope) + '<br>' : '') +
      (v.manufacturing_annotations.length ? '<b>Manufacturing requirements:</b><ul style="margin:4px 0 0 18px;padding:0">' + v.manufacturing_annotations.map(function(a){ return '<li>' + a + '</li>'; }).join('') + '</ul>' : '') +
      (v.warnings.length ? '<div style="margin-top:6px;color:#fbbf24"><b>Warnings:</b><ul style="margin:4px 0 0 18px;padding:0">' + v.warnings.map(function(w){ return '<li>' + w + '</li>'; }).join('') + '</ul></div>' : '') +
      (v.failure_reasons.length ? '<div style="margin-top:6px;color:#f87171"><b>Failure reasons:</b><ul style="margin:4px 0 0 18px;padding:0">' + v.failure_reasons.map(function(f){ return '<li>' + f + '</li>'; }).join('') + '</ul></div>' : '') +
      (v.alternative_recommendations.length ? '<div style="margin-top:6px"><b>Alternatives:</b><ul style="margin:4px 0 0 18px;padding:0">' + v.alternative_recommendations.map(function(a){ return '<li>' + a + '</li>'; }).join('') + '</ul></div>' : '') +
    '</div>' +
    '<div class="explain"><span style="color:var(--dim)">' + v.citations.join(' · ') + '</span></div>'
    + gbox("Decision tree (not a formula): family (UNS + Schaeffler/WRC) → Annex A use-without-testing envelope (T, pH₂S, Cl) for CRAs, OR ISO 15156-2 Fig.1 Region (pH₂S × pH) for C/low-alloy steel → manufacturing gates (HRC, cold-work, PREN).", "ANSI/NACE MR0175-2021 / ISO 15156:2020 Parts 1-3 + Technical Circulars", "T2 · decision-tree verified (node mr0175.js); 18/41 Annex envelopes flagged needs_review — VR/mr0175.md");
}
if ($("mr0175Form")) $("mr0175Form").addEventListener("input", renderMR0175);

function renderCIPSPlaceholder(){
  var host = $("cips_results"); if (!host) return;
  if (host.innerHTML.indexOf('placeholder') < 0) return;  // don't overwrite if already rendered
  host.innerHTML = '<div class="placeholder">Paste a CIPS/DCVG survey CSV →<br><span style="font-size:12px;color:var(--dim);margin-top:6px;display:block">Required: <code>station</code>; recommended: <code>E_on, E_off, dcvg</code>. Auto-detects mV vs V, ft vs m. Sample: 100,-1100,-900,3 newline 200,-1180,-820,12</span></div>';
}
function renderCIPS(){
  var host = $("cips_results"); if (!host || !window.CIPS) return;
  var txt = $("cips_paste") ? $("cips_paste").value : "";
  if (!txt.trim()) { renderCIPSPlaceholder(); return; }
  var s = CIPS.parseCSV(txt);
  if (!s.readings.length) {
    host.innerHTML = '<div class="iso exceeds"><b>Could not parse CSV</b><br>' + s.errors.join('<br>') + '</div>';
    return;
  }
  var exc = CIPS.scanExceedances(s, { E_off_threshold_mV: +$("cips_thr").value, E_l_mV: +$("cips_el").value, native_potential_mV: +$("cips_native").value });
  var inds = CIPS.findIndications(s);
  var prio = CIPS.prioritizeECDA({ cips_results: exc, dcvg_results: inds });
  var nFail = exc.perStation.filter(function(p){ return p.flags.length > 0; }).length;
  host.innerHTML =
    '<div class="iso ' + (nFail > 0 || prio.summary.IMMEDIATE > 0 ? 'exceeds' : 'within') + '">' +
      '<b>CIPS survey — ' + s.readings.length + ' readings · type ' + s.type + '</b><br>' +
      'Stations failing −850 mV / 100 mV shift: <b>' + nFail + '</b> · DCVG indications: <b>' + inds.length + '</b><br>' +
      'ECDA prioritisation: <b style="color:#ef4444">IMMEDIATE ' + prio.summary.IMMEDIATE + '</b> · <b style="color:#fbbf24">SCHEDULED ' + prio.summary.SCHEDULED + '</b> · <b style="color:#34d399">MONITORED ' + prio.summary.MONITORED + '</b>' +
      (s.errors.length ? '<br><span style="color:#fbbf24;font-size:12px">' + s.errors.join('; ') + '</span>' : '') +
    '</div>' +
    (exc.runs.length ? '<div class="iso untabulated"><b>Exceedance runs (' + exc.runs.length + ')</b><br>' + exc.runs.slice(0, 10).map(function(r){ return r.start_m.toFixed(1) + '–' + r.end_m.toFixed(1) + ' m · min E_off = ' + r.min_E_off_mV + ' mV · ' + r.flags.join(', '); }).join('<br>') + '</div>' : '') +
    (inds.length ? '<div class="iso untabulated"><b>DCVG indications (' + inds.length + ')</b><br>' + inds.slice(0, 10).map(function(i){ return 'Station ' + i.station_m.toFixed(1) + ' m · %IR = ' + (i.percent_IR != null ? i.percent_IR.toFixed(1) : '?') + '% · <b style="color:' + i.color + '">' + i.severity + '</b> · ' + i.polarity; }).join('<br>') + '</div>' : '') +
    _cipsGrowthPanel(inds) +
    _cipsGPSMap(s.readings, inds) +
    '<div class="explain"><span style="color:var(--dim)">' + (exc.ref || '') + ' · ' + (inds.length ? inds[0].ref : '') + ' · ' + (prio.ref || '') + '</span></div>' + tierTag("NACE SP0502 ECDA prioritisation + McKinney 1986 DCVG bands reproduced");
  // After DOM injected, init the Leaflet map if any GPS readings present
  setTimeout(function(){ _cipsInitMap(s.readings, inds); }, 50);
}

// Sub-linear pit-growth phase-2: project pit depth over time per BS 7910 + API 1163
// d(t) = K · t^n  with n = 0.5 (sub-linear, oxide-protective behaviour). For
// "active corrosion" with no inhibitor n→1.0 (linear). Returns 1/5/10/20-yr horizon.
function _cipsGrowthPanel(inds) {
  if (!inds || !inds.length) return "";
  // Take the worst DCVG indication as the baseline
  const worst = inds.slice().sort(function(a,b){ return (b.percent_IR||0) - (a.percent_IR||0); })[0];
  if (!worst || worst.percent_IR == null) return "";
  // Assume baseline pit depth from %IR severity:
  //  Severe ≈ 3 mm, Moderate ≈ 1.5 mm, Minor ≈ 0.5 mm
  const d0 = worst.severity === "Severe" ? 3.0 : worst.severity === "Immediate" ? 5.0 : worst.severity === "Moderate" ? 1.5 : 0.5;
  // Sub-linear growth K from t=1 yr: d(1) = d0 → K = d0
  function dAt(t, n) { return d0 * Math.pow(t, n); }
  const sublinear = [1,5,10,20].map(function(t){ return { t: t, d: dAt(t, 0.5) }; });
  const linear    = [1,5,10,20].map(function(t){ return { t: t, d: dAt(t, 1.0) }; });
  return '<div class="iso untabulated" style="margin-top:8px"><b>Pit-growth projection (worst DCVG indication)</b><br>'
       + 'Baseline pit depth (assumed from severity): <b>' + d0.toFixed(2) + ' mm</b><br>'
       + 'Sub-linear (n=0.5, oxide-protective): '
       + sublinear.map(function(p){ return p.t + ' yr → ' + p.d.toFixed(2) + ' mm'; }).join(' · ') + '<br>'
       + 'Linear (n=1.0, active corrosion): '
       + linear.map(function(p){ return p.t + ' yr → ' + p.d.toFixed(2) + ' mm'; }).join(' · ')
       + '<br><span style="color:var(--dim);font-size:11px">Per BS 7910 (2019) Annex M + API STD 1163 (3rd ed., 2021) §7.5 pit-growth power-law d=K·tⁿ. n=0.5 typical for soil-side passivated CS; n=1.0 conservative for active corrosion or coating-failure exposure.</span></div>';
}

// Render a placeholder div + load Leaflet on demand if any readings have lat/lon
function _cipsGPSMap(readings, inds) {
  if (!readings || !readings.some(function(r){ return r.lat && r.lon; })) return "";
  return '<div id="cips_map" style="height:360px;margin-top:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:#0b1220"></div>';
}
function _cipsInitMap(readings, inds) {
  const host = document.getElementById("cips_map");
  if (!host) return;
  if (!readings || !readings.some(function(r){ return r.lat && r.lon; })) return;
  // Lazy-load Leaflet
  if (!window.L) {
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    const js = document.createElement("script");
    js.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    js.onload = function(){ _cipsDrawMap(readings, inds); };
    document.head.appendChild(js);
  } else {
    _cipsDrawMap(readings, inds);
  }
}
function _cipsDrawMap(readings, inds) {
  const host = document.getElementById("cips_map");
  if (!host || !window.L) return;
  if (host._leaflet_id) return;   // already initialized
  // Compute centroid
  const pts = readings.filter(function(r){ return r.lat && r.lon; });
  if (!pts.length) return;
  const latC = pts.reduce(function(a,b){ return a + b.lat; }, 0) / pts.length;
  const lonC = pts.reduce(function(a,b){ return a + b.lon; }, 0) / pts.length;
  const map = L.map(host, { zoomControl: true }).setView([latC, lonC], 14);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: "© OpenStreetMap"
  }).addTo(map);
  // Group readings by station to find indications nearby
  const indByStn = {};
  (inds || []).forEach(function(i){ indByStn[Math.round(i.station_m / 5) * 5] = i; });
  // Place a marker at each reading; colour by DCVG severity if present
  pts.forEach(function(r){
    const stnRound = Math.round(r.station_m / 5) * 5;
    const ind = indByStn[stnRound];
    const sev = ind ? ind.severity : (r.E_off_mV != null && r.E_off_mV > -850 ? "Exceedance" : "OK");
    const color = sev === "Immediate" ? "#ef4444"
                : sev === "Severe" ? "#fb923c"
                : sev === "Moderate" ? "#fbbf24"
                : sev === "Minor" ? "#7dd3fc"
                : sev === "Exceedance" ? "#fbbf24"
                : "#34d399";
    L.circleMarker([r.lat, r.lon], {
      radius: 6, color: color, fillColor: color, fillOpacity: 0.7, weight: 1
    }).addTo(map).bindPopup(
      "<b>Station " + r.station_m.toFixed(1) + " m</b><br>" +
      "E_on: " + (r.E_on_mV != null ? r.E_on_mV + " mV" : "—") + "<br>" +
      "E_off: " + (r.E_off_mV != null ? r.E_off_mV + " mV" : "—") + "<br>" +
      "DCVG: " + (r.dcvg_mV != null ? r.dcvg_mV + " mV" : "—") +
      (ind ? "<br><b style='color:"+color+"'>" + sev + "</b> · %IR " + (ind.percent_IR||0).toFixed(0) + "%" : "")
    );
  });
  // Fit bounds
  const bounds = L.latLngBounds(pts.map(function(r){ return [r.lat, r.lon]; }));
  map.fitBounds(bounds.pad(0.1));
}
if ($("cips_process")) $("cips_process").onclick = renderCIPS;
if ($("cips_paste")) $("cips_paste").addEventListener("blur", renderCIPS);

async function init(){
  let meta = null;
  try {
    const [g, m] = await Promise.all([
      fetch("data/grades.json").then(r => r.json()),
      fetch("data/measurements.json").then(r => r.json()),
    ]);
    PitCast.setGrades(g);
    PitCast.setMeasurements(m.records || []);
    meta = m.meta;
  } catch (e) { /* fall back to the built-in grades */ }
  try {
    VALIDATIONS = await fetch("data/validations.json").then(r => r.json());
  } catch (e) { VALIDATIONS = []; }
  populateGrades();
  updateDataStat(meta);
  renderAssess();
  renderSelect();
  renderData();
  buildCO2Presets();
  renderCO2();
  buildCPACPresets();
  renderCPAC();
  populateEnvGrades();
  renderEnvelope();
  populateGradeSelect();
  populateIndustryDropdowns();
  populateCompareGrades();
  populateILIGrade();
  renderIntegrity();
  renderCompare();
  renderILIPlaceholder();
  _bindIndustryHandlers();
  renderValidations();
  _initProductsTab();
}
init();

// ===========================================================================
// Vendor products tab (G9)
// ===========================================================================
function _initProductsTab() {
  if (!window.VendorProducts) return;
  // Wait for products to load, then populate UI
  VendorProducts.load().then(function(){
    const cs = VendorProducts.categories();
    const sel = $("prod_category");
    if (sel) {
      cs.forEach(function(c){
        const opt = document.createElement("option");
        opt.value = c.key;
        opt.textContent = c.key + "  (" + c.count + ")";
        sel.appendChild(opt);
      });
      sel.addEventListener("change", _renderProducts);
    }
    const t = $("prod_T"); if (t) t.addEventListener("input", _renderProducts);
    const s = $("prod_search"); if (s) s.addEventListener("input", _renderProducts);
    _renderProducts();
  });
}
function _renderProducts() {
  if (!window.VendorProducts) return;
  const host = $("products_results"); if (!host) return;
  const cat = $("prod_category") ? $("prod_category").value : "any";
  const T = $("prod_T") && $("prod_T").value !== "" ? +$("prod_T").value : null;
  const search = $("prod_search") ? $("prod_search").value.trim() : "";
  const rows = VendorProducts.filter({ category: cat, T_C: T, search: search });
  if (!rows.length) { host.innerHTML = '<div class="placeholder">No products match the filter.</div>'; return; }
  // Group by category for display
  const byCategory = {};
  rows.forEach(function(p){ (byCategory[p.category] = byCategory[p.category] || []).push(p); });
  let html = '<div class="iso within"><b>' + rows.length + ' of ' + VendorProducts.rows().length + ' products</b>'
           + ' · ' + Object.keys(byCategory).length + ' categories</div>';
  Object.keys(byCategory).sort().forEach(function(cat){
    html += '<div style="margin-top:10px"><b style="color:#7dd3fc">' + cat + '</b> · ' + byCategory[cat].length + '<br>';
    html += '<table style="margin-top:6px;border-collapse:collapse;width:100%;font-size:12px"><thead><tr style="color:var(--dim)"><th style="text-align:left;padding:4px 8px">Manufacturer</th><th style="text-align:left;padding:4px 8px">Model</th><th style="text-align:left;padding:4px 8px">Spec / Compliance</th><th style="text-align:left;padding:4px 8px">Service envelope</th></tr></thead><tbody>';
    byCategory[cat].forEach(function(p){
      const tRange = p.service_T_C ? (p.service_T_C[0] + " to " + p.service_T_C[1] + " °C") : "—";
      const detail = p.DFT_um ? ("DFT " + p.DFT_um[0] + "-" + p.DFT_um[1] + " µm")
                  : p.eps_th_Ah_kg ? ("ε_th " + p.eps_th_Ah_kg + " A·h/kg · util " + p.util_factor + " · " + p.alloy)
                  : p.k_W_mK ? ("k " + p.k_W_mK + " W/m·K · Cl<sub>C871</sub> ≤ " + p.Cl_ppm_C871_max + " ppm")
                  : p.alloy ? p.alloy : "";
      html += '<tr><td style="padding:4px 8px">' + p.manufacturer + '</td>'
            + '<td style="padding:4px 8px"><b>' + p.model + '</b></td>'
            + '<td style="padding:4px 8px;color:var(--dim);font-size:11px">' + p.spec + '</td>'
            + '<td style="padding:4px 8px;font-size:11px">' + (p.service || "") + ' · ' + tRange + (detail ? ' · ' + detail : '') + '<br><span style="color:var(--dim);font-size:10px">' + p.ref + '</span></td></tr>';
    });
    html += '</tbody></table></div>';
  });
  html += '<div class="explain"><span style="color:var(--dim)">PitCast vendor product database is a screening reference only. For project specification, retrieve the current manufacturer data sheet (PDS) and verify the current spec-compliance + service-envelope per your project conditions. Per NACE / AMPP / DNV / ISO / ASTM / API.</span></div>';
  host.innerHTML = html;
}
