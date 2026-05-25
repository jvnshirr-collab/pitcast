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
});

// ---- grade dropdown (populated after real data loads) -----------------------
const sel = $("a_grade");
let customGrade = null;   // a composition loaded from the data browser
function populateGrades(){
  sel.innerHTML = "";
  PitCast.GRADES.forEach((g,i) => {
    const o = document.createElement("option");
    o.value = i; o.textContent = `${g.name}  (${g.uns})`;
    sel.appendChild(o);
  });
  const i2205 = PitCast.GRADES.findIndex(g => g.name === "2205");
  sel.value = i2205 >= 0 ? i2205 : 0;
}

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
function renderAssess(){
  const g = (sel.value === "custom" && customGrade) ? customGrade : PitCast.GRADES[+sel.value];
  $("a_comp").textContent = compString(g.comp);
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
    ${(() => { const mc = PitCast.measuredCPT(g.uns, g.name); return mc
      ? `<div class="measured">📊 Real measured CPT (literature): <b>${mc.min.toFixed(0)}–${mc.max.toFixed(0)} °C</b>
         · ${mc.n} record${mc.n>1?"s":""} <span style="color:var(--dim)">(cited dataset, CC BY) — vs PitCast ${r.cpt.toFixed(0)} °C predicted</span></div>`
      : ""; })()}
    <div class="explain">
      ${g.name}: PREN ${r.pren.toFixed(0)}, ferrite ≈ ${r.ferrite.toFixed(0)}%, CPT ≈ ${r.cpt.toFixed(0)} °C.
      At ${svc.T} °C${svc.Cl>0?` / ${svc.Cl.toLocaleString()} ppm Cl⁻`:""}${svc.pH2S>=0.3?` / ${svc.pH2S} kPa H₂S`:""},
      the dominant risk is <b>${dom}</b>.${agedNote}
      <span style="color:var(--dim)"> Screening estimate — see limits below.</span>
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
      <tbody>${rows}</tbody></table>${reco}`;
}
$("selectForm").addEventListener("input", renderSelect);

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
  let opt=[...sel.options].find(o=>o.value==="custom");
  if(!opt){ opt=document.createElement("option"); opt.value="custom"; sel.insertBefore(opt, sel.firstChild); }
  opt.textContent=`★ ${customGrade.name} (from data)`;
  sel.value="custom";
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
}
init();
