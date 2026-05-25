/* PitCast web UI */
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
const _JUNK = /polish|electrode|mounted|stud|finish|specimen|sample|sheet|plate|the cr|wt%|at%|%cr|%mo|diamond/i;
function _measLabel(rec){
  const code = (rec.code||"").trim();
  const m = /[NSR]\d{5}/.exec(code); if (m) return m[0];
  if (code && code.length<=18 && !_JUNK.test(code)) return code;
  return Object.entries(rec.comp||{}).filter(([k,v])=>v>0)
    .sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,v]) => k+v).join("");
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
      <div class="metric"><div class="k">PREN</div><div class="val">${r.pren.toFixed(1)}</div><div class="u">N=16</div></div>
      <div class="metric"><div class="k">CPT</div><div class="val">${r.cpt.toFixed(0)}<span class="u"> °C</span></div><div class="u">±${ci.toFixed(0)} (90%)</div></div>
      <div class="metric"><div class="k">Rel. cost</div><div class="val">${r.cost.toFixed(2)}<span class="u">×</span></div><div class="u">304L=1</div></div>
    </div>
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
      ? `<div class="measured">📊 Real measured CPT (literature): <b>${mc.min.toFixed(0)}–${mc.max.toFixed(0)} °C</b>
         · ${mc.n} record${mc.n>1?"s":""} <span style="color:var(--dim)">(cited dataset, CC BY) — vs PitCast ${r.cpt.toFixed(0)} °C predicted</span></div>`
      : ""; })()}
    ${assessCharts(g,r,svc)}
    <div class="explain">
      ${g.name}: PREN ${r.pren.toFixed(0)}, ferrite ≈ ${r.ferrite.toFixed(0)}%, CPT ≈ ${r.cpt.toFixed(0)} °C.
      At ${svc.T} °C${svc.Cl>0?` / ${svc.Cl.toLocaleString()} ppm Cl⁻`:""}${svc.pH2S>=0.3?` / ${svc.pH2S} kPa H₂S`:""},
      the dominant risk is <b>${dom}</b>.${agedNote}
      <span style="color:var(--dim)"> Screening estimate · CPT on ASTM G48 (6% FeCl₃) basis — see limits below.</span>
    </div>`;
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
  {name:"Sour-sweet field · 8 bar + 1.4 bar H₂S",v:{T:80,pCO2:8,u:2,d:0.2,fe2:20,pH2S:1.4,wc:0.4,meg:0,oil:"crude",bicarb:300,age:8760}},
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
function renderCO2(){
  if(!$("co2_results")||!window.CO2||!window.Charts) return;
  const gv=id=>$(id)?$(id).value:"";
  const o={ T:+gv("c_T"), pCO2:+gv("c_pCO2"), velocity:+gv("c_u"), pipeID:+gv("c_d"), fe2:+gv("c_fe2"),
    pH2S:+gv("c_pH2S"), waterCut:+gv("c_wc"), glycol:+gv("c_meg"), oilType:gv("c_oil"),
    bicarbonate:+gv("c_bicarb"), ageH:+gv("c_age") };
  const pHraw=gv("c_pH"); if(pHraw!==""&&isFinite(+pHraw)) o.pH=+pHraw;
  const r=CO2.assess(o);
  const col=cr=> cr>=5?"#ef4444":cr>=1?"#f59e0b":"#22c55e";
  const vb=r.crMax>=5?"high":r.crMax>=1?"moderate":"low";
  const norsok=r.models.find(m=>m.id==="NORSOK")||r.models[2];
  const al=CO2.allowance({cr:norsok.cr, designLifeYr:+gv("c_life"), caMm:+gv("c_ca")});
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
    <div class="blab2">Model verdicts (mm/y)</div>${bars}
    <div class="chartwrap">${crT}</div>
    <div class="chartwrap">${crP}</div>
    <table><thead><tr><th>Model</th><th>CR</th><th>Decomposition / multipliers</th><th>Reference</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="explain"><b>Corrosion allowance (NORSOK basis):</b> ${al.uninhibited_CR_mmpy.toFixed(2)} mm/y → ${al.consumed_mm.toFixed(1)} mm consumed over ${al.designLifeYr} yr vs ${al.caMm} mm CA → <b>${al.verdict}</b>${al.ca_sufficient?"":`; required inhibitor efficiency <b>${al.required_inhibitor_efficiency_pct.toFixed(1)}%</b>${al.achievable?"":" — above sustainable field availability (~95%); reconsider a CRA or thicker CA"}`}.
      <span style="color:var(--dim)"> Screening, carbon steel, sweet service. The five models span ${r.spread.toFixed(0)}× — design to the conservative/relevant one. Sources: Corrosion 31 (1975) 177; NACE 95-128; NORSOK M-506:2017; Nyborg 2010; Nesic 2007.</span></div>`;
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
  const cpCls=cp.verdict.indexOf("PROTECTED")===0?"within":(cp.verdict==="INSUFFICIENT DATA"?"untabulated":"exceeds");
  const sweep=[]; for(let V=0;V<=40;V++){ sweep.push({x:V, y:CPAC.holidayJac(V,rho,d/1000).jac}); }
  const jacChart=Charts.lines({w:540,h:230,title:"AC current density vs touch voltage",xlabel:"Vac (V)",ylabel:"Jac (A/m²)",ymin:0,
    series:[{name:"Jac at holiday",color:"#38bdf8",pts:sweep}],
    vmarkers:[{x:vac,label:"op "+vac+" V"},{x:0,label:""}]});
  $("cpac_results").innerHTML=`
    <div class="verdict ${acVb}"><div class="gauge">${ac.jac.toFixed(0)}<span class="u"> A/m²</span></div>
      <div class="vtext"><b>AC corrosion: ${ac.band.toUpperCase()}${ac.mitigate?" · MITIGATE":""}</b><div>${ac.rationale}</div></div></div>
    <div class="metrics">
      <div class="metric"><div class="k">Spread R</div><div class="val">${ac.rSpread.toFixed(0)}<span class="u"> Ω</span></div><div class="u">holiday → earth</div></div>
      <div class="metric"><div class="k">Jac / Jdc</div><div class="val">${ac.ratio!=null?ac.ratio.toFixed(1):"—"}</div><div class="u">${ac.ratioStatus}</div></div>
      <div class="metric"><div class="k">Indic. rate</div><div class="val">${rate.mmYr_indicative.toFixed(1)}<span class="u"> mm/y</span></div><div class="u">indicative only</div></div>
    </div>
    <div class="chartwrap">${jacChart}</div>
    <div class="iso ${cpCls}"><b>Cathodic protection — ${cp.verdict}</b><br>
      polarized ${cp.polarized_mV!=null?cp.polarized_mV.toFixed(0)+" mV":"—"} · −850 mV ${cp.meets850?"✓ met":"✗ not met"} · 100 mV shift ${cp.polarizationShift_mV!=null?(cp.polarizationShift_mV.toFixed(0)+" mV "+(cp.meets100mV?"✓":"✗")):"(needs depol)"}${cp.irDrop_mV!=null?(" · IR drop "+cp.irDrop_mV.toFixed(0)+" mV"):""}</div>
    <div class="explain">${(cp.notes||[]).map(n=>"• "+n).join("<br>")||"AC corrosion concentrates at coating holidays; Jac from the disc spread-resistance model."}
      <span style="color:var(--dim)"> AC: ${ac.ref} · CP: ${cp.ref}</span></div>`;
}
$("cpacForm")&&$("cpacForm").addEventListener("input", renderCPAC);

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

function renderData(){
  if(!$("dataTable")) return;
  const q = ($("d_search").value||"").trim().toUpperCase();
  const rows = PitCast.MEASUREMENTS.filter(r=>{
    if(_metricFilter && r.metric!==_metricFilter) return false;
    if(!q) return true;
    return (r.code||"").toUpperCase().includes(q) || (r.cls||"").toUpperCase().includes(q)
        || compStr(r.comp).toUpperCase().includes(q);
  });
  const CAP=200, shown=rows.slice(0,CAP);
  $("d_count").innerHTML = `${rows.length} record${rows.length!==1?"s":""} match`
    + (rows.length>CAP?` — showing first ${CAP}, refine search to narrow`:"");
  const head=`<thead><tr><th>Alloy</th><th>Class</th><th>Metric</th><th>Value</th>`
    + `<th>Conditions</th><th>Composition (wt%)</th><th>Source</th><th></th></tr></thead>`;
  const body=shown.map(r=>`<tr>
    <td>${r.code?String(r.code).slice(0,28):"—"}</td>
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
  populateGrades();
  updateDataStat(meta);
  renderAssess();
  renderSelect();
  renderData();
  buildCO2Presets();
  renderCO2();
  buildCPACPresets();
  renderCPAC();
}
init();
