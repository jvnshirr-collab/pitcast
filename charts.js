/* PitCast charts — dependency-free SVG, dark theme. Exposes window.Charts.
   Each function returns an SVG string to inject into the DOM. */
(function(){
const PAL={ink:'#e6edf3',muted:'#8b98a9',dim:'#5c6b7a',grid:'#1b2430',line:'#26303c',
  green:'#22c55e',amber:'#f59e0b',red:'#ef4444',accent:'#2dd4bf',accent2:'#38bdf8',
  series:['#2dd4bf','#38bdf8','#f59e0b','#a78bfa','#22c55e','#ef4444']};
const E=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function niceTicks(min,max,n){ if(min===max){min-=1;max+=1;} const span=max-min; const s0=span/(n||5);
  const mag=Math.pow(10,Math.floor(Math.log10(s0))); const nm=s0/mag; const step=(nm<1.5?1:nm<3?2:nm<7?5:10)*mag;
  const out=[]; for(let v=Math.ceil(min/step)*step; v<=max+1e-9; v+=step) out.push(+v.toFixed(10)); return out; }
function logTicks(min,max){ const out=[]; for(let e=Math.floor(Math.log10(min)); e<=Math.ceil(Math.log10(max)); e++) out.push(Math.pow(10,e)); return out; }

// shared cartesian scaffold -> {s, tx, ty, m, pw, ph, W, H}
function plot(o){
  const W=o.w||620, H=o.h||300, m={l:54,r:o.mr||16,t:o.title?34:14,b:46};
  const pw=W-m.l-m.r, ph=H-m.t-m.b, xlog=o.xlog, ylog=o.ylog;
  const xmin=o.xmin, xmax=o.xmax, ymin=o.ymin, ymax=o.ymax;
  const tx=v=> m.l + ((xlog?(Math.log10(v)-Math.log10(xmin)):(v-xmin)) / ((xlog?(Math.log10(xmax)-Math.log10(xmin)):(xmax-xmin))||1))*pw;
  const ty=v=> m.t + ph - ((ylog?(Math.log10(v)-Math.log10(ymin)):(v-ymin)) / ((ylog?(Math.log10(ymax)-Math.log10(ymin)):(ymax-ymin))||1))*ph;
  let s='';
  if(o.title) s+=`<text x="${m.l}" y="18" fill="${PAL.muted}" font-size="11" letter-spacing="1">${E(o.title).toUpperCase()}</text>`;
  s+=`<rect x="${m.l}" y="${m.t}" width="${pw}" height="${ph}" fill="none" stroke="${PAL.line}"/>`;
  (xlog?logTicks(xmin,xmax):niceTicks(xmin,xmax,o.xn)).forEach(v=>{const X=tx(v); if(X<m.l-1||X>m.l+pw+1)return;
    s+=`<line x1="${X}" y1="${m.t}" x2="${X}" y2="${m.t+ph}" stroke="${PAL.grid}"/>`;
    s+=`<text x="${X}" y="${m.t+ph+16}" fill="${PAL.dim}" font-size="10" text-anchor="middle">${xlog?('10^'+Math.round(Math.log10(v))):E(o.xfmt?o.xfmt(v):v)}</text>`;});
  (ylog?logTicks(ymin,ymax):niceTicks(ymin,ymax,o.yn)).forEach(v=>{const Y=ty(v); if(Y<m.t-1||Y>m.t+ph+1)return;
    s+=`<line x1="${m.l}" y1="${Y}" x2="${m.l+pw}" y2="${Y}" stroke="${PAL.grid}"/>`;
    s+=`<text x="${m.l-6}" y="${Y+3}" fill="${PAL.dim}" font-size="10" text-anchor="end">${ylog?('10^'+Math.round(Math.log10(v))):E(o.yfmt?o.yfmt(v):v)}</text>`;});
  if(o.xlabel)s+=`<text x="${m.l+pw/2}" y="${H-6}" fill="${PAL.muted}" font-size="11" text-anchor="middle">${E(o.xlabel)}</text>`;
  if(o.ylabel)s+=`<text transform="translate(13,${m.t+ph/2}) rotate(-90)" fill="${PAL.muted}" font-size="11" text-anchor="middle">${E(o.ylabel)}</text>`;
  return {s,tx,ty,m,pw,ph,W,H};
}
const wrap=p=>`<svg viewBox="0 0 ${p.W} ${p.H}" width="100%" preserveAspectRatio="xMidYMid meet" style="display:block;font-family:var(--mono,monospace)">${p.s}</svg>`;
const linePath=(pts,tx,ty)=>pts.map((p,i)=>(i?'L':'M')+tx(p.x).toFixed(1)+' '+ty(p.y).toFixed(1)).join(' ');

window.Charts={
  lines:function(o){
    const all=o.series.flatMap(s=>s.pts); const xs=all.map(p=>p.x), ys=all.map(p=>p.y);
    const p=plot(Object.assign({},o,{xmin:o.xmin!=null?o.xmin:Math.min(...xs),xmax:o.xmax!=null?o.xmax:Math.max(...xs),
      ymin:o.ymin!=null?o.ymin:Math.min(0,...ys),ymax:o.ymax!=null?o.ymax:Math.max(...ys)*1.05}));
    o.series.forEach((ser,i)=>{const c=ser.color||PAL.series[i%PAL.series.length];
      p.s+=`<path d="${linePath(ser.pts,p.tx,p.ty)}" fill="none" stroke="${c}" stroke-width="2"/>`;});
    (o.vmarkers||[]).forEach(mk=>{const X=p.tx(mk.x);p.s+=`<line x1="${X}" y1="${p.m.t}" x2="${X}" y2="${p.m.t+p.ph}" stroke="${mk.color||PAL.amber}" stroke-dasharray="4 3"/><text x="${X+3}" y="${p.m.t+12}" fill="${mk.color||PAL.amber}" font-size="10">${E(mk.label)}</text>`;});
    let ly=p.m.t+12; o.series.forEach((ser,i)=>{const c=ser.color||PAL.series[i%PAL.series.length];
      p.s+=`<rect x="${p.m.l+6}" y="${ly-8}" width="9" height="9" fill="${c}"/><text x="${p.m.l+19}" y="${ly}" fill="${PAL.muted}" font-size="10">${E(ser.name)}</text>`; ly+=14;});
    return wrap(p);
  },
  scatterFit:function(o){
    const xs=o.points.map(p=>p.x).concat(o.highlight?[o.highlight.x]:[]);
    const ys=o.points.map(p=>p.y).concat(o.highlight?[o.highlight.y]:[]);
    const p=plot(Object.assign({},o,{xmin:o.xmin!=null?o.xmin:Math.min(...xs)-2,xmax:o.xmax!=null?o.xmax:Math.max(...xs)+2,
      ymin:o.ymin!=null?o.ymin:Math.min(...ys)-6,ymax:o.ymax!=null?o.ymax:Math.max(...ys)+6}));
    if(o.band&&o.band.length){const up=o.band.map(b=>p.tx(b.x).toFixed(1)+' '+p.ty(b.hi).toFixed(1));
      const dn=o.band.slice().reverse().map(b=>p.tx(b.x).toFixed(1)+' '+p.ty(b.lo).toFixed(1));
      p.s+=`<polygon points="${up.concat(dn).join(' ')}" fill="${PAL.accent}" opacity="0.13"/>`;}
    if(o.fit){const a=p.tx.length,x1=(o.xmin!=null?o.xmin:Math.min(...xs)-2),x2=(o.xmax!=null?o.xmax:Math.max(...xs)+2);
      p.s+=`<line x1="${p.tx(x1)}" y1="${p.ty(o.fit.m*x1+o.fit.b)}" x2="${p.tx(x2)}" y2="${p.ty(o.fit.m*x2+o.fit.b)}" stroke="${PAL.accent}" stroke-width="1.6"/>`;}
    (o.hlines||[]).forEach(h=>{const Y=p.ty(h.y);p.s+=`<line x1="${p.m.l}" y1="${Y}" x2="${p.m.l+p.pw}" y2="${Y}" stroke="${h.color||PAL.amber}" stroke-dasharray="5 3"/><text x="${p.m.l+p.pw-3}" y="${Y-3}" fill="${h.color||PAL.amber}" font-size="10" text-anchor="end">${E(h.label)}</text>`;});
    o.points.forEach(pt=>{p.s+=`<circle cx="${p.tx(pt.x).toFixed(1)}" cy="${p.ty(pt.y).toFixed(1)}" r="2.6" fill="${PAL.muted}" opacity="0.7"/>`;});
    if(o.highlight){const HX=p.tx(o.highlight.x),HY=p.ty(o.highlight.y);
      p.s+=`<circle cx="${HX}" cy="${HY}" r="5.5" fill="${PAL.green}" stroke="#0a0e14" stroke-width="1.5"/><text x="${HX}" y="${HY-10}" fill="${PAL.green}" font-size="11" text-anchor="middle" font-weight="600">${E(o.highlight.label)}</text>`;}
    return wrap(p);
  },
  heatmap:function(o){
    const W=o.w||620,H=o.h||300,m={l:54,r:16,t:o.title?34:14,b:46},pw=W-m.l-m.r,ph=H-m.t-m.b;
    const nx=o.xs.length,ny=o.ys.length,cw=pw/nx,ch=ph/ny;
    const color=v=>{for(const c of o.colors){if(v<=c.max)return c.color;} return o.colors[o.colors.length-1].color;};
    let s=o.title?`<text x="${m.l}" y="18" fill="${PAL.muted}" font-size="11" letter-spacing="1">${E(o.title).toUpperCase()}</text>`:'';
    for(let iy=0;iy<ny;iy++)for(let ix=0;ix<nx;ix++){const X=m.l+ix*cw,Y=m.t+(ny-1-iy)*ch;
      s+=`<rect x="${X.toFixed(1)}" y="${Y.toFixed(1)}" width="${(cw+0.7).toFixed(1)}" height="${(ch+0.7).toFixed(1)}" fill="${color(o.grid[iy][ix])}"/>`;}
    s+=`<rect x="${m.l}" y="${m.t}" width="${pw}" height="${ph}" fill="none" stroke="${PAL.line}"/>`;
    [0,Math.floor(nx/2),nx-1].forEach(ix=>{const X=m.l+(ix+0.5)*cw;s+=`<text x="${X}" y="${m.t+ph+16}" fill="${PAL.dim}" font-size="10" text-anchor="middle">${E(o.xfmt?o.xfmt(o.xs[ix]):o.xs[ix])}</text>`;});
    [0,Math.floor(ny/2),ny-1].forEach(iy=>{const Y=m.t+(ny-1-iy+0.5)*ch;s+=`<text x="${m.l-6}" y="${Y+3}" fill="${PAL.dim}" font-size="10" text-anchor="end">${E(o.yfmt?o.yfmt(o.ys[iy]):o.ys[iy])}</text>`;});
    if(o.xlabel)s+=`<text x="${m.l+pw/2}" y="${H-6}" fill="${PAL.muted}" font-size="11" text-anchor="middle">${E(o.xlabel)}</text>`;
    if(o.ylabel)s+=`<text transform="translate(13,${m.t+ph/2}) rotate(-90)" fill="${PAL.muted}" font-size="11" text-anchor="middle">${E(o.ylabel)}</text>`;
    if(o.point){const ix=o.xs.reduce((b,v,i)=>Math.abs(v-o.point.x)<Math.abs(o.xs[b]-o.point.x)?i:b,0);
      const iy=o.ys.reduce((b,v,i)=>Math.abs(v-o.point.y)<Math.abs(o.ys[b]-o.point.y)?i:b,0);
      s+=`<circle cx="${m.l+(ix+0.5)*cw}" cy="${m.t+(ny-1-iy+0.5)*ch}" r="5" fill="none" stroke="#fff" stroke-width="2"/>`;}
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" style="display:block;font-family:var(--mono,monospace)">${s}</svg>`;
  },
  bars:function(o){
    const w=o.w||620,rowH=30,H=o.items.length*rowH+10,labelW=o.labelW||180,barX=labelW+8,barW=w-barX-92;
    const max=o.max||Math.max.apply(null,o.items.map(i=>i.value))*1.05||1;
    let s=''; o.items.forEach((it,i)=>{const y=8+i*rowH, bw=Math.max(1,Math.min(1,it.value/max)*barW);
      s+=`<text x="0" y="${y+13}" fill="${PAL.ink}" font-size="12">${E(it.name)}</text>`;
      s+=`<rect x="${barX}" y="${y+4}" width="${barW}" height="12" fill="#0e141d" stroke="${PAL.line}" rx="3"/>`;
      s+=`<rect x="${barX}" y="${y+4}" width="${bw.toFixed(1)}" height="12" fill="${it.color||PAL.accent}" rx="3"/>`;
      s+=`<text x="${w}" y="${y+13}" fill="${it.color||PAL.ink}" font-size="12" text-anchor="end">${E(o.fmt?o.fmt(it.value):it.value)}${o.unit?(' '+o.unit):''}</text>`;});
    return `<svg viewBox="0 0 ${w} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" style="display:block;font-family:var(--mono,monospace)">${s}</svg>`;
  }
};
})();
