(() => {
'use strict';
const $ = s => document.querySelector(s);
const E = Engine;
const SERIF = "'STIX Two Text','Cambria Math','Times New Roman',serif";
const SANS = "'Instrument Sans',system-ui,-apple-system,'Segoe UI',sans-serif";
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let C = {};
function readColors(){
  const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim();
  C = {paper:g('--paper'),ink:g('--ink'),muted:g('--muted'),faint:g('--faint'),line:g('--line'),soft:g('--soft'),
       navy:g('--navy'),brick:g('--brick'),forest:g('--forest'),forestSoft:g('--forest-soft'),navySoft:g('--navy-soft'),brickSoft:g('--brick-soft')};
  const dark = C.paper.toLowerCase() !== '#fff' && C.paper.toLowerCase() !== '#ffffff';
  C.traj = dark ? ['#E0A640','#B28AD6','#3FC1C1','#E77BA6','#A7BD4E','#E6E9EF'] : ['#C8871A','#7A4FA0','#0F8A8A','#C2477A','#6B7F1E','#1A2130'];
}
const fmt = v => {
  if(!isFinite(v)) return '—';
  const a = Math.abs(v); let s;
  if(a !== 0 && (a < 1e-3 || a >= 1e5)) s = v.toExponential(2).replace('e', '×10^');
  else s = String(+v.toPrecision(4));
  return s.replace('-', '−');
};
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const SUBS = {a:'ₐ',e:'ₑ',h:'ₕ',i:'ᵢ',j:'ⱼ',k:'ₖ',l:'ₗ',m:'ₘ',n:'ₙ',o:'ₒ',p:'ₚ',r:'ᵣ',s:'ₛ',t:'ₜ',u:'ᵤ',v:'ᵥ',x:'ₓ','0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉'};
function plain(name){
  let base = name, sub = '', deco = '';
  const us = name.indexOf('_'); if(us > 0){ base = name.slice(0, us); sub = name.slice(us + 1); }
  let m;
  if((m = base.match(/^(.+?)star$/))) { base = m[1]; deco = '*'; }
  else if((m = base.match(/^(.+?)bar$/))) { base = m[1]; deco = '\u0304'; }
  let s = (E.GREEK[base] || base) + deco;
  if(sub){ const g = E.GREEK[sub] || sub; s += [...g].every(c => SUBS[c]) ? [...g].map(c => SUBS[c]).join('') : '_' + g; }
  return s;
}
const H = s => E.nameHTML(s, false, false);

/* ---------------- state ---------------- */
const S = {
  def:null, model:null, pv:[], view:null, sys:null, eqs:[], main:null, mf:[], nullc:null,
  trajs:[], nTraj:0, shock:{on:false}, shockPath:null, flow:!reduceMotion, tab:'time', horizon:100,
  anim:null, bif:{param:0, v:0, pts:[], key:'', token:0, busy:false, done:false}
};
let needCompute = false, needDraw = false, needPanel = false;
const invalidate = (c = true) => { if(c) needCompute = true; needDraw = true; needPanel = true; };

/* ---------------- canvases ---------------- */
function fitCanvas(cv){
  const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d));
  if(cv.width !== w || cv.height !== h){ cv.width = w; cv.height = h; }
  const ctx = cv.getContext('2d'); ctx.setTransform(d, 0, 0, d, 0, 0);
  return {ctx, W:r.width, H:r.height};
}
const cvSt = $('#cv-st'), cvDyn = $('#cv-dyn'), cvPn = $('#cv-pn');
let G = null; // stage geometry
function mapper(box, win){
  const [x0,x1] = win[0], [y0,y1] = win[1];
  return {box, win,
    X: v => box.x + (v - x0) / (x1 - x0) * box.w,
    Y: v => box.y + box.h - (v - y0) / (y1 - y0) * box.h,
    iX: p => x0 + (p - box.x) / box.w * (x1 - x0),
    iY: p => y0 + (box.y + box.h - p) / box.h * (y1 - y0)};
}
function ticks(a, b, n = 6){
  const span = b - a; if(!(span > 0)) return [a];
  const st0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(st0))), r = st0 / mag;
  const st = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag, out = [];
  for(let v = Math.ceil(a / st - 1e-9) * st; v <= b + st * 1e-9; v += st) out.push(Math.abs(v) < st * 1e-6 ? 0 : +v.toPrecision(12));
  return out;
}
const tickLabel = v => { const a = Math.abs(v); return (a !== 0 && (a < 1e-3 || a >= 1e5) ? v.toExponential(1) : String(+v.toPrecision(6))).replace('-', '−'); };
function axes(ctx, M, xl, yl, o = {}){
  const {box} = M;
  ctx.save();
  ctx.font = `11.5px ${SANS}`; ctx.fillStyle = C.muted; ctx.strokeStyle = C.line; ctx.lineWidth = 1;
  const xt = ticks(M.win[0][0], M.win[0][1], Math.max(3, Math.round(box.w / 90)));
  const yt = o.noY ? [] : ticks(M.win[1][0], M.win[1][1], Math.max(3, Math.round(box.h / 60)));
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for(const t of xt){ const x = Math.round(M.X(t)) + .5; if(o.grid !== false){ ctx.beginPath(); ctx.moveTo(x, box.y); ctx.lineTo(x, box.y + box.h); ctx.stroke(); } ctx.fillText(tickLabel(t), x, box.y + box.h + 6); }
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for(const t of yt){ const y = Math.round(M.Y(t)) + .5; if(o.grid !== false){ ctx.beginPath(); ctx.moveTo(box.x, y); ctx.lineTo(box.x + box.w, y); ctx.stroke(); } ctx.fillText(tickLabel(t), box.x - 7, y); }
  ctx.strokeStyle = C.faint;
  ctx.beginPath(); ctx.moveTo(box.x + .5, box.y); ctx.lineTo(box.x + .5, box.y + box.h + .5); ctx.lineTo(box.x + box.w, box.y + box.h + .5); ctx.stroke();
  ctx.fillStyle = C.ink; ctx.font = `italic 15px ${SERIF}`;
  if(xl){ ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(xl, box.x + box.w - 4, box.y + box.h - 5); }
  if(yl){ ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(yl, box.x + 7, box.y + 5); }
  ctx.restore();
}
const varLabel = v => S.model.labels[v] || plain(v);

/* ---------------- model loading ---------------- */
function customs(){ try { return JSON.parse(localStorage.getItem('attractor.models.v1') || '[]'); } catch(e){ return []; } }
function saveCustoms(a){ try { localStorage.setItem('attractor.models.v1', JSON.stringify(a)); return true; } catch(e){ return false; } }
function customDef(c){ const t = (c.src.match(/^\s*title\s*:\s*(.+)$/mi) || [, 'Untitled model'])[1].trim(); return {id:c.id, src:c.src, custom:true, family:'Your models', title:t, glyph:'mine'}; }
function allDefs(){ return [...LIBRARY, ...customs().map(customDef)]; }
function titleOf(d){ return d.title || (d.src.match(/^\s*title\s*:\s*(.+)$/mi) || [, 'Untitled'])[1].trim(); }

function load(def, keepHash){
  const m = E.parseModel(def.src);
  if(m.errors){ openEditor(def.src, def.custom ? def.id : null, m.errors); return false; }
  S.def = def; S.model = m; S.pv = m.params.map(p => p.value);
  S.view = m.vars.map(v => m.windows[v].slice());
  if(m.dim === 1 && m.discrete) S.view[1] = S.view[0].slice();
  if(m.dim === 1 && !m.discrete) S.view[1] = [0, 1];
  S.trajs = []; S.nTraj = 0; S.anim = null; S.horizon = m.horizon;
  setShock(false, true);
  $('#horizon').value = S.horizon;
  buildHead(); buildParams(); buildAbout(); buildLib(); buildBifSelects(); buildLegend();
  resetParticles = true;
  if(!keepHash){ try { history.replaceState(null, '', '#' + encodeURIComponent(def.id)); } catch(e){} }
  compute();
  const init = m.vars.map((v, i) => v in m.init ? m.init[v] : (S.main ? S.main.x[i] * 0.4 + S.view[i][0] * 0.6 : (S.view[i][0] + S.view[i][1]) / 2));
  launch(init, true);
  const sd = saddlePath(init); if(sd) launch(sd.start, true, sd);
  invalidate(false);
  return true;
}

function buildHead(){
  const m = S.model, d = S.def;
  $('#m-fam').textContent = (d.family || 'Your models') + (m.discrete ? ', discrete time' : ', continuous time');
  $('#m-title').textContent = m.title;
  document.title = m.title + ' – Attractor';
  let h = m.eqHTML.map(e => `<span class="eq">${e.lhs} = ${e.rhs}</span>`).join('');
  if(m.letHTML.length) h += `<span class="where">where ${m.letHTML.map(e => `${e.lhs} = ${e.rhs}`).join(', ')}</span>`;
  $('#m-eqs').innerHTML = h;
}
function buildParams(){
  const box = $('#params'); box.innerHTML = '';
  S.model.params.forEach((p, k) => {
    const row = document.createElement('div'); row.className = 'prm';
    const step = (p.max - p.min) / 1000 || 0.001;
    row.innerHTML = `<label for="pr-${k}"><span class="sym">${H(p.name)}</span><span class="lab">${esc(p.label)}</span></label>
      <input class="num" type="number" step="any" id="pn-${k}" aria-label="${esc(p.label || p.name)} value">
      <input type="range" id="pr-${k}" min="${p.min}" max="${p.max}" step="${step}">`;
    box.appendChild(row);
    const r = row.querySelector('input[type=range]'), n = row.querySelector('.num');
    r.value = S.pv[k]; n.value = +S.pv[k].toPrecision(4);
    const paint = () => { r.style.setProperty('--pct', ((clamp(S.pv[k], p.min, p.max) - p.min) / (p.max - p.min || 1) * 100) + '%'); row.classList.toggle('moved', Math.abs(S.pv[k] - p.value) > 1e-12); };
    paint();
    r.addEventListener('input', () => { S.pv[k] = +r.value; n.value = +S.pv[k].toPrecision(4); paint(); invalidate(); });
    n.addEventListener('change', () => { const v = parseFloat(n.value.replace('−','-')); if(isFinite(v)){ S.pv[k] = v; r.value = v; paint(); invalidate(); } else n.value = +S.pv[k].toPrecision(4); });
    row._sync = () => { r.value = S.pv[k]; n.value = +S.pv[k].toPrecision(4); paint(); };
  });
}
function syncParams(){ [...$('#params').children].forEach(r => r._sync && r._sync()); }
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function buildAbout(){
  const d = S.def, a = $('#about');
  if(d.custom || !d.blurb){
    a.innerHTML = `<h3>About this model</h3><p>${d.custom ? 'One of your models. It is stored in this browser.' : 'A draft model, not saved yet.'}</p>
      <button class="btn small" type="button" id="ab-edit">Edit model</button>`;
  } else {
    a.innerHTML = `<h3>About this model</h3><p>${esc(d.blurb)}</p>
      <h4>Things to try</h4><ul>${d.tries.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      <p class="ref">${esc(d.ref)}</p>`;
  }
  const b = $('#ab-edit'); if(b) b.onclick = () => openEditor(S.def.src, S.def.custom ? S.def.id : null);
}
const GLYPH = {
  line:'<path d="M3 12h18" stroke="currentColor" stroke-width="1.6"/><path d="M6 9.5l2.5 2.5L6 14.5M18 9.5L15.5 12l2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="2.3" fill="currentColor"/>',
  bistable:'<path d="M2 12h20" stroke="currentColor" stroke-width="1.6"/><circle cx="6.5" cy="12" r="2.2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="17.5" cy="12" r="2.2" fill="currentColor"/>',
  node:'<path d="M3 5l7 6M21 5l-7 6M3 19l7-6M21 19l-7-6" stroke="currentColor" stroke-width="1.6" fill="none"/><circle cx="12" cy="12" r="2.4" fill="currentColor"/>',
  saddle:'<path d="M3 3c5 6 13 6 18 0M3 21c5-6 13-6 18 0" stroke="currentColor" stroke-width="1.4" fill="none" opacity=".55"/><path d="M4 20L20 4" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.4" fill="currentColor"/>',
  spiral:'<path d="M12 12c1.5 0 2 1.6.6 2.6-2 1.4-5-.4-4.8-3 .3-3.4 4.6-5 7.5-2.8 3.6 2.7 2.3 8.6-2.2 9.6C8 19.5 3.8 16.3 4 11.6 4.3 6.5 9 3.3 13.8 4" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  centre:'<ellipse cx="12" cy="12" rx="9" ry="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><ellipse cx="12" cy="12" rx="4.5" ry="3.2" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".6"/>',
  cycle:'<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 12c1.2-.2 1.6 1.2.5 1.9-1.6 1-3.6-.4-3.3-2.3.4-2.4 3.7-3.3 5.5-1.6" fill="none" stroke="currentColor" stroke-width="1.3" opacity=".6"/>',
  stair:'<path d="M3 21L21 3" stroke="currentColor" stroke-width="1.2" opacity=".5"/><path d="M5 20V9h4v4h3v-2h3v1" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  chaos:'<path d="M3 16l2.5-9 2.4 11 2.3-13 2.2 10 2.4-6 2.1 9 2.3-12L21 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  mine:'<path d="M5 19l1-4L16 5l3 3L9 18z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'
};
function buildLib(){
  const nav = $('#lib'), sel = $('#mob-sel'); nav.innerHTML = ''; sel.innerHTML = '';
  const fams = [];
  LIBRARY.forEach(d => { if(!fams.includes(d.family)) fams.push(d.family); });
  const cust = customs().map(customDef);
  const groups = fams.map(f => [f, LIBRARY.filter(d => d.family === f)]);
  groups.push(['Your models', cust]);
  if(S.def && S.def.id === 'draft') groups[groups.length - 1][1] = [...cust, S.def];
  for(const [f, list] of groups){
    const h = document.createElement('h2'); h.textContent = f; nav.appendChild(h);
    const og = document.createElement('optgroup'); og.label = f; sel.appendChild(og);
    const ul = document.createElement('ul');
    if(!list.length){ const p = document.createElement('p'); p.className = 'empty'; p.textContent = 'Models you write appear here.'; nav.appendChild(p); continue; }
    for(const d of list){
      const li = document.createElement('li');
      const b = document.createElement('button'); b.type = 'button'; b.className = 'it';
      b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${GLYPH[d.glyph] || GLYPH.mine}</svg><span>${esc(titleOf(d))}${d.id === 'draft' ? ' (draft)' : ''}</span>`;
      if(S.def && S.def.id === d.id) b.setAttribute('aria-current', 'true');
      b.onclick = () => load(d);
      li.appendChild(b);
      if(d.custom){
        const x = document.createElement('button'); x.type = 'button'; x.className = 'del'; x.textContent = '×'; x.setAttribute('aria-label', 'Delete ' + titleOf(d));
        x.onclick = () => { if(!confirm(`Delete “${titleOf(d)}” from your models?`)) return; saveCustoms(customs().filter(c => c.id !== d.id)); if(S.def.id === d.id) load(LIBRARY[0]); else buildLib(); };
        li.appendChild(x);
      }
      ul.appendChild(li);
      const o = document.createElement('option'); o.value = d.id; o.textContent = titleOf(d); if(S.def && S.def.id === d.id) o.selected = true; og.appendChild(o);
    }
    nav.appendChild(ul);
  }
}
$('#mob-sel').addEventListener('change', e => { const d = allDefs().find(x => x.id === e.target.value) || (S.def.id === e.target.value ? S.def : null); if(d) load(d); });

function buildLegend(){
  const m = S.model, L = $('#legend'), v = m.vars;
  const dotH = x => m.discrete ? `Δ${H(x)} = 0` : `${m.eqHTML[v.indexOf(x)].lhs} = 0`;
  let h = '';
  if(m.dim === 2){
    h += `<span style="color:var(--navy)"><i class="sw"></i><span class="m">${dotH(v[0])}</span></span>`;
    h += `<span style="color:var(--brick)"><i class="sw"></i><span class="m">${dotH(v[1])}</span></span>`;
    if(!m.discrete) h += `<span style="color:var(--forest)"><i class="sw" style="border-top-width:3px"></i>Saddle path</span>`;
  } else if(m.discrete){
    h += `<span style="color:var(--navy)"><i class="sw"></i><span class="m">${H(v[0])}<sub><i>t</i>+1</sub> = <i>F</i>(${H(v[0])}<sub><i>t</i></sub>)</span></span><span style="color:var(--faint)"><i class="sw"></i>45° line</span>`;
  } else {
    if(m.curves.length) m.curves.forEach((c, i) => { h += `<span style="color:${i ? 'var(--brick)' : 'var(--navy)'}"><i class="sw"></i>${esc(c.label)}</span>`; });
    else h += `<span style="color:var(--navy)"><i class="sw"></i><span class="m">${m.eqHTML[0].lhs}</span></span>`;
  }
  h += `<span><i class="pt"></i>Stable</span><span><i class="pt h"></i>Unstable</span>`;
  L.innerHTML = h;
}

/* ---------------- computation ---------------- */
const span = i => S.view[i][1] - S.view[i][0];
function viewWin(){ return S.model.dim === 1 ? [S.view[0]] : S.view; }
function compute(){
  needCompute = false;
  const m = S.model;
  S.sys = E.makeSystem(m, S.pv);
  const win = viewWin();
  const seeds = S.eqs.map(e => e.x).filter(x => x.length === m.dim);
  S.eqs = E.findEquilibria(S.sys, win, {seeds});
  S.main = pickMain(S.eqs);
  S.mf = [];
  if(m.dim === 2 && !m.discrete){
    for(const e of S.eqs) if(e.saddle) S.mf.push({eq:e, ...E.manifolds(S.sys, e, S.view, S.horizon)});
    S.nullc = E.contours(S.sys, S.view, 110, 84);
  } else if(m.dim === 2){
    S.nullc = E.contours(S.sys, S.view, 110, 84);
  } else S.nullc = null;
  for(const t of S.trajs){ if(t.saddle){ const sp = saddlePath(t.x0); if(sp){ t.x0 = sp.start; t.res = sp.res; continue; } } t.res = simulate(t.x0); }
  S.shockPath = computeShock();
  speedScale();
  syncBifKey();
}
function pickMain(eqs){
  let best = null, bs = -1;
  eqs.forEach((e, i) => { const nontriv = e.x.every(v => Math.abs(v) > 1e-9) ? 4 : 0; const s = (e.stable ? 3 : e.saddle || e.type === 'centre' ? 2 : 1) + nontriv; if(s > bs){ bs = s; best = e; } });
  return best;
}
function simulate(x0){
  const m = S.model, sp = m.vars.map((v, i) => span(i));
  const box = m.vars.map((v, i) => [S.view[i][0] - 3 * sp[i], S.view[i][1] + 3 * sp[i]]);
  return E.simulate(S.sys, x0, S.horizon, {scale:sp, box, hmax:S.horizon / 400});
}
function saddlePath(x0){
  const m = S.model; if(!m.jump || m.dim !== 2 || m.discrete || !S.mf) return null;
  const q = 1 - m.vars.indexOf(m.jump);
  for(const mf of S.mf.slice().sort((a, b) => dist(a.eq.x, x0) - dist(b.eq.x, x0))){
    let hit = null;
    for(const br of mf.stable){ const X = br.x, T = br.t;
      for(let i = 0; i < X.length - 1; i++){ const a = X[i][q] - x0[q], b = X[i + 1][q] - x0[q];
        if(a === 0 || a * b < 0){ const f = a === 0 ? 0 : a / (a - b); const p = [X[i][0] + f * (X[i + 1][0] - X[i][0]), X[i][1] + f * (X[i + 1][1] - X[i][1])]; p[q] = x0[q];
          if(!hit || dist(p, x0) < dist(hit.p, x0)) hit = {p, tc:T[i] + f * (T[i + 1] - T[i]), br, i}; break; } } }
    if(hit){
      const eq = mf.eq.x, ts = [0], xs = [hit.p.slice()];
      for(let k = hit.i; k >= 0; k--){ ts.push(hit.br.t[k] - hit.tc); xs.push(hit.br.x[k].slice()); }
      ts.push(ts[ts.length - 1] + 1e-6); xs.push(eq.slice());
      if(ts[ts.length - 1] < S.horizon){ ts.push(S.horizon); xs.push(eq.slice()); }
      return {start:hit.p, res:{t:ts, x:xs, end:'done'}};
    }
  }
  return null;
}
function computeShock(){
  const sh = S.shock; if(!sh.on || !sh.base) return null;
  const m = S.model, x0 = sh.base.slice();
  const moved = S.pv.some((v, i) => Math.abs(v - sh.pv[i]) > 1e-12);
  if(!moved) return {x0, res:null};
  let start = x0, jump = null, res = null;
  if(m.jump && m.dim === 2 && !m.discrete){
    const j = m.vars.indexOf(m.jump), q = 1 - j;
    const cand = S.mf.slice().sort((a, b) => dist(a.eq.x, x0) - dist(b.eq.x, x0));
    for(const mf of cand){
      const eq = mf.eq.x;
      if(Math.abs(eq[q] - x0[q]) < 1e-9 * span(q)){ start = eq.slice(); res = {t:[0, S.horizon], x:[eq.slice(), eq.slice()], end:'done'}; break; }
      let hit = null;
      for(const br of mf.stable){
        const X = br.x, T = br.t;
        for(let i = 0; i < X.length - 1; i++){
          const a = X[i][q] - x0[q], b = X[i + 1][q] - x0[q];
          if(a === 0 || a * b < 0){
            const f = a === 0 ? 0 : a / (a - b);
            const p = [X[i][0] + f * (X[i + 1][0] - X[i][0]), X[i][1] + f * (X[i + 1][1] - X[i][1])], tc = T[i] + f * (T[i + 1] - T[i]);
            if(!hit || tc > hit.tc) hit = {p, tc, br, i};
            break;
          }
        }
      }
      if(hit){
        start = hit.p; start[q] = x0[q];
        const ts = [0], xs = [start.slice()];
        for(let k = hit.i; k >= 0; k--){ ts.push(hit.br.t[k] - hit.tc); xs.push(hit.br.x[k].slice()); }
        ts.push(ts[ts.length - 1] + 1e-6); xs.push(eq.slice());
        if(ts[ts.length - 1] < S.horizon){ ts.push(S.horizon); xs.push(eq.slice()); }
        res = {t:ts, x:xs, end:'done'};
        break;
      }
    }
    if(res) jump = {from:x0, to:start};
    else return {x0, res:null, fail:true};
  }
  if(!res) res = simulate(start);
  return {x0, jump, res};
}
const dist = (a, b) => Math.hypot(...a.map((v, i) => (v - b[i]) / span(i)));
function setShock(on, silent){
  const b = $('#shock'); b.setAttribute('aria-checked', on ? 'true' : 'false');
  $('#shock-row').hidden = !on;
  if(on){
    if(!S.main){ S.shock = {on:false}; b.setAttribute('aria-checked', 'false'); $('#shock-row').hidden = true; flash('Shock mode needs a steady state in view.'); return; }
    S.shock = {on:true, base:S.main.x.slice(), pv:S.pv.slice(), label:S.main};
  } else S.shock = {on:false};
  S.shockPath = null;
  if(!silent) invalidate();
}
$('#shock').onclick = () => setShock(!S.shock.on);
$('#shock-base').onclick = () => { setShock(false, true); setShock(true); };
function flash(msg){ const h = $('#hint'); h.innerHTML = msg; h.style.opacity = 1; clearTimeout(flash.t); flash.t = setTimeout(() => { h.style.opacity = 0; }, 3200); }

/* ---------------- stage drawing ---------------- */
function layout(){
  const {W, H: HH} = fitCanvas(cvSt); fitCanvas(cvDyn);
  const m = S.model, L = 54, R = 18, T = 16, B = 38;
  const g = {W, H:HH, mode: m.discrete ? (m.dim === 1 ? 'cobweb' : 'map2') : (m.dim === 1 ? 'line' : 'plane')};
  if(g.mode === 'line'){
    const strip = 58;
    g.plot = {x:L, y:T + 30, w:W - L - R, h:HH - T - 30 - B - strip - 16};
    g.strip = {x:L, y:g.plot.y + g.plot.h + 32, w:g.plot.w, h:strip - 22};
    const yr = curveRange();
    S.view[1] = yr;
    g.M = mapper(g.plot, [S.view[0], yr]);
  } else {
    g.plot = {x:L, y:T, w:W - L - R, h:HH - T - B};
    if(g.mode === 'cobweb') S.view[1] = S.view[0].slice();
    g.M = mapper(g.plot, S.view);
  }
  G = g;
}
function curveFns(){
  const m = S.model;
  if(m.curves.length) return m.curves.map(c => x => S.sys.evalAt(c.fn, [x]));
  return [x => S.sys.evalAt(m.eqFn[0], [x])];
}
function curveRange(){
  const fs = curveFns(), [a, b] = S.view[0]; let lo = Infinity, hi = -Infinity;
  for(const f of fs) for(let i = 0; i <= 200; i++){ const v = f(a + (b - a) * i / 200); if(isFinite(v)){ lo = Math.min(lo, v); hi = Math.max(hi, v); } }
  if(!isFinite(lo)){ lo = -1; hi = 1; }
  lo = Math.min(lo, 0); hi = Math.max(hi, 0);
  const p = (hi - lo) * 0.08 || 1; return [lo - (S.model.curves.length ? 0 : p), hi + p];
}
function drawStage(){
  needDraw = false;
  readColors(); layout();
  const {ctx} = fitCanvas(cvSt), g = G, M = g.M, m = S.model;
  ctx.clearRect(0, 0, g.W, g.H);
  if(g.mode === 'plane' || g.mode === 'map2') drawPlane(ctx, M);
  else if(g.mode === 'line') drawLine(ctx, M);
  else drawCobweb(ctx, M);
}
function clipBox(ctx, b){ ctx.save(); ctx.beginPath(); ctx.rect(b.x, b.y, b.w, b.h); ctx.clip(); }
function polyline(ctx, M, xs, i0 = 0, i1 = xs.length){
  ctx.beginPath(); let pen = false;
  for(let i = i0; i < i1; i++){ const p = xs[i]; const X = M.X(p[0]), Y = M.Y(p[1]); if(!isFinite(X) || !isFinite(Y) || Math.abs(X) > 1e5 || Math.abs(Y) > 1e5){ pen = false; continue; } if(pen) ctx.lineTo(X, Y); else { ctx.moveTo(X, Y); pen = true; } }
  ctx.stroke();
}
function drawPlane(ctx, M){
  const m = S.model;
  axes(ctx, M, varLabel(m.vars[0]), varLabel(m.vars[1]));
  clipBox(ctx, M.box);
  if(G.mode === 'map2') drawArrows(ctx, M);
  // nullclines
  if(S.nullc){
    ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    [[S.nullc[0], C.navy], [S.nullc[1], C.brick]].forEach(([seg, col]) => {
      ctx.strokeStyle = col; ctx.beginPath();
      for(let i = 0; i < seg.length; i += 4){ ctx.moveTo(M.X(seg[i]), M.Y(seg[i + 1])); ctx.lineTo(M.X(seg[i + 2]), M.Y(seg[i + 3])); }
      ctx.stroke();
    });
  }
  // manifolds
  for(const mf of S.mf){
    ctx.strokeStyle = C.forest; ctx.globalAlpha = .45; ctx.lineWidth = 1.3; ctx.setLineDash([5, 5]);
    for(const br of mf.unstable) polyline(ctx, M, br.x);
    ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.lineWidth = 3.2;
    for(const br of mf.stable) polyline(ctx, M, br.x);
    // arrows on saddle path pointing to the steady state
    ctx.fillStyle = C.forest;
    for(const br of mf.stable){ const n = br.x.length; if(n < 8) continue; const k = Math.floor(n * 0.35); arrowOn(ctx, M, br.x[k], br.x[Math.max(0, k - 2)], 7); }
  }
  // user trajectories
  S.trajs.forEach(t => { if(S.anim && S.anim.traj === t) return; drawTraj(ctx, M, t, 1); });
  drawShock(ctx, M);
  ctx.restore();
  drawEqMarks(ctx, M);
}
function drawArrows(ctx, M){
  const n = 22, mm = Math.round(n * M.box.h / M.box.w), g = new Float64Array(2), [x0, x1] = S.view[0], [y0, y1] = S.view[1];
  ctx.strokeStyle = C.faint; ctx.lineWidth = 1; ctx.globalAlpha = .75;
  for(let i = 0; i < n; i++) for(let j = 0; j < mm; j++){
    const x = x0 + (x1 - x0) * (i + .5) / n, y = y0 + (y1 - y0) * (j + .5) / mm;
    S.sys.field([x, y], g); const dx = M.X(x + g[0]) - M.X(x), dy = M.Y(y + g[1]) - M.Y(y), L = Math.hypot(dx, dy);
    if(!(L > 1e-9)) continue;
    const s = 9 / L, X = M.X(x), Y = M.Y(y), ex = X + dx * s, ey = Y + dy * s;
    ctx.beginPath(); ctx.moveTo(X - dx * s * .5, Y - dy * s * .5); ctx.lineTo(ex, ey);
    const a = Math.atan2(dy, dx); ctx.lineTo(ex - 3.5 * Math.cos(a - .5), ey - 3.5 * Math.sin(a - .5)); ctx.moveTo(ex, ey); ctx.lineTo(ex - 3.5 * Math.cos(a + .5), ey - 3.5 * Math.sin(a + .5)); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function arrowOn(ctx, M, p, q, s){
  const X = M.X(p[0]), Y = M.Y(p[1]), a = Math.atan2(M.Y(q[1]) - Y, M.X(q[0]) - X);
  if(!isFinite(a)) return;
  ctx.beginPath(); ctx.moveTo(X + s * Math.cos(a), Y + s * Math.sin(a)); ctx.lineTo(X + s * .9 * Math.cos(a + 2.4), Y + s * .9 * Math.sin(a + 2.4)); ctx.lineTo(X + s * .9 * Math.cos(a - 2.4), Y + s * .9 * Math.sin(a - 2.4)); ctx.closePath(); ctx.fill();
}
function drawTraj(ctx, M, t, frac){
  const r = t.res; if(!r) return; const m = S.model, xs = r.x;
  ctx.strokeStyle = t.color; ctx.fillStyle = t.color; ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
  let n = xs.length;
  if(frac < 1){ const T = r.t[r.t.length - 1] * frac; n = 1; while(n < xs.length && r.t[n] <= T) n++; }
  if(G.mode === 'map2'){
    ctx.globalAlpha = .35; ctx.lineWidth = 1; polyline(ctx, M, xs, 0, n); ctx.globalAlpha = 1;
    for(let i = 0; i < n; i++){ const X = M.X(xs[i][0]), Y = M.Y(xs[i][1]); ctx.beginPath(); ctx.arc(X, Y, i === 0 ? 4 : 2.6, 0, 7); ctx.fill(); }
    return;
  }
  polyline(ctx, M, xs, 0, n);
  ctx.beginPath(); ctx.arc(M.X(xs[0][0]), M.Y(xs[0][1]), 4, 0, 7); ctx.fill();
  if(n > 12 && frac === 1){ const k = Math.floor(n * 0.3); arrowOn(ctx, M, xs[k], xs[k - 3], 6); }
  if(frac < 1 && n > 0){ const p = xs[n - 1]; ctx.beginPath(); ctx.arc(M.X(p[0]), M.Y(p[1]), 5, 0, 7); ctx.fill(); }
}
function drawShock(ctx, M){
  const sp = S.shockPath; if(!sp) return;
  const X = M.X(sp.x0[0]), Y = M.Y(sp.x0[1]);
  if(sp.res){
    ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    if(G.mode === 'map2'){ ctx.lineWidth = 1.2; polyline(ctx, M, sp.res.x); ctx.fillStyle = C.ink; sp.res.x.forEach(p => { ctx.beginPath(); ctx.arc(M.X(p[0]), M.Y(p[1]), 2.8, 0, 7); ctx.fill(); }); }
    else polyline(ctx, M, sp.res.x);
    if(sp.jump){ ctx.setLineDash([4, 4]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(M.X(sp.jump.to[0]), M.Y(sp.jump.to[1])); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.ink; arrowOn(ctx, M, sp.jump.to, sp.x0, 7); }
  }
  ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(X, Y, 9, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = C.ink; ctx.font = `600 12px ${SANS}`; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText('before', X + 11, Y - 6);
}
function eqMark(ctx, X, Y, e, r = 5.5){
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(X, Y, r + 2.5, 0, 7); ctx.fillStyle = C.paper; ctx.fill();
  ctx.beginPath(); ctx.arc(X, Y, r, 0, 7);
  if(e.stable){ ctx.fillStyle = C.forest; ctx.fill(); }
  else { ctx.strokeStyle = C.ink; ctx.stroke(); if(e.saddle){ ctx.beginPath(); ctx.arc(X, Y, 1.8, 0, 7); ctx.fillStyle = C.ink; ctx.fill(); } if(e.type === 'centre'){ ctx.beginPath(); ctx.arc(X, Y, r + 4, 0, 7); ctx.lineWidth = 1; ctx.stroke(); } }
}
function drawEqMarks(ctx, M){
  const b = M.box;
  S.eqs.forEach((e, i) => {
    const X = M.X(e.x[0]), Y = M.Y(e.x[1]);
    if(X < b.x - 8 || X > b.x + b.w + 8 || Y < b.y - 8 || Y > b.y + b.h + 8) return;
    eqMark(ctx, X, Y, e);
    ctx.font = `600 13px ${SERIF}`; ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('E' + (i + 1), X + 9, Y + 5);
  });
}
function drawLine(ctx, M){
  const m = S.model, b = G.plot, st = G.strip, fs = curveFns();
  axes(ctx, M, '', m.curves.length ? '' : plain(m.vars[0]) + '̇', {});
  // x axis label under strip
  ctx.font = `italic 15px ${SERIF}`; ctx.fillStyle = C.ink; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
  ctx.fillText(varLabel(m.vars[0]), b.x + b.w - 6, b.y + b.h - 5);
  clipBox(ctx, b);
  if(M.win[1][0] < 0){ ctx.strokeStyle = C.faint; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(b.x, M.Y(0)); ctx.lineTo(b.x + b.w, M.Y(0)); ctx.stroke(); }
  const cols = [C.navy, C.brick, C.forest, C.muted];
  fs.forEach((f, k) => {
    ctx.strokeStyle = cols[k % 4]; ctx.lineWidth = 2.2; ctx.beginPath(); let pen = false;
    for(let i = 0; i <= b.w; i += 1.5){ const x = M.iX(b.x + i), v = f(x); if(!isFinite(v)){ pen = false; continue; } const Y = M.Y(v); if(pen) ctx.lineTo(b.x + i, Y); else { ctx.moveTo(b.x + i, Y); pen = true; } }
    ctx.stroke();
  });
  if(m.curves.length){
    ctx.font = `13px ${SANS}`; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    fs.forEach((f, k) => { const x = M.iX(b.x + b.w * .97), v = f(x); if(isFinite(v)){ ctx.fillStyle = cols[k % 4]; ctx.fillText(m.curves[k].label, b.x + b.w - 6, clamp(M.Y(v) - 6, b.y + 14, b.y + b.h - 4)); } });
  }
  // equilibria guides
  S.eqs.forEach(e => { const X = M.X(e.x[0]); ctx.strokeStyle = C.faint; ctx.setLineDash([3, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X, b.y); ctx.lineTo(X, b.y + b.h); ctx.stroke(); ctx.setLineDash([]); });
  ctx.restore();
  // phase line strip
  const cy = st.y + st.h / 2;
  ctx.fillStyle = C.soft; roundRect(ctx, st.x, st.y, st.w, st.h, 10); ctx.fill();
  ctx.strokeStyle = C.faint; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(st.x + 8, cy); ctx.lineTo(st.x + st.w - 8, cy); ctx.stroke();
  const f0 = x => S.sys.evalAt(m.eqFn[0], [x]);
  const xs = [st.x + 8, ...S.eqs.map(e => M.X(e.x[0])).filter(X => X > st.x && X < st.x + st.w), st.x + st.w - 8].sort((a, c) => a - c);
  ctx.fillStyle = C.navy;
  for(let i = 0; i < xs.length - 1; i++){
    const a = xs[i], c = xs[i + 1]; if(c - a < 26) continue;
    const mid = (a + c) / 2, v = f0(M.iX(mid)); if(!isFinite(v) || v === 0) continue;
    const d = v > 0 ? 1 : -1;
    ctx.beginPath(); ctx.moveTo(mid + d * 7, cy); ctx.lineTo(mid - d * 5, cy - 6); ctx.lineTo(mid - d * 5, cy + 6); ctx.closePath(); ctx.fill();
  }
  ctx.font = `11.5px ${SANS}`; ctx.fillStyle = C.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for(const t of ticks(M.win[0][0], M.win[0][1], Math.max(3, Math.round(st.w / 90)))){ ctx.fillText(tickLabel(t), M.X(t), st.y + st.h + 6); }
  S.eqs.forEach((e, i) => { const X = M.X(e.x[0]); if(X < st.x - 4 || X > st.x + st.w + 4) return; eqMark(ctx, X, cy, e, 6); ctx.font = `600 13px ${SERIF}`; ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText('E' + (i + 1), X + 7, cy - 4);
    ctx.save(); clipBox(ctx, b); fs.forEach((f, k) => { if(m.curves.length){ const v = f(e.x[0]); if(isFinite(v)){ eqMark(ctx, X, M.Y(v), e, 4.5); } } }); ctx.restore(); ctx.restore(); });
  // trajectories: start marker and reach on the strip
  S.trajs.forEach((t, i) => { if(S.anim && S.anim.traj === t) return; lineTraj(ctx, M, t, 1, cy, i); });
  const sp = S.shockPath;
  if(sp){ const X = M.X(sp.x0[0]); ctx.strokeStyle = C.ink; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(X, cy, 11, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    if(sp.res){ const xe = sp.res.x[sp.res.x.length - 1][0]; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X, cy - 15); ctx.lineTo(M.X(xe), cy - 15); ctx.stroke(); ctx.fillStyle = C.ink; arrowOnPx(ctx, M.X(xe), cy - 15, Math.sign(M.X(xe) - X) || 1); } }
}
function lineTraj(ctx, M, t, frac, cy, i){
  const r = t.res; if(!r) return;
  let n = r.x.length; if(frac < 1){ const T = r.t[r.t.length - 1] * frac; n = 1; while(n < r.x.length && r.t[n] <= T) n++; }
  const y = cy + 12 + (i % 3) * 5, X0 = M.X(r.x[0][0]), X1 = M.X(r.x[n - 1][0]);
  ctx.strokeStyle = ctx.fillStyle = t.color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(X0, y); ctx.lineTo(X1, y); ctx.stroke();
  ctx.beginPath(); ctx.arc(X0, y, 3.5, 0, 7); ctx.fill();
  if(Math.abs(X1 - X0) > 6) arrowOnPx(ctx, X1, y, Math.sign(X1 - X0));
}
function arrowOnPx(ctx, X, Y, d){ ctx.beginPath(); ctx.moveTo(X + d * 3, Y); ctx.lineTo(X - d * 5, Y - 5); ctx.lineTo(X - d * 5, Y + 5); ctx.closePath(); ctx.fill(); }
function roundRect(ctx, x, y, w, h, r){ ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawCobweb(ctx, M){
  const m = S.model, b = M.box, v = m.vars[0];
  axes(ctx, M, plain(v) + 'ₜ', plain(v) + 'ₜ₊₁');
  clipBox(ctx, b);
  ctx.strokeStyle = C.faint; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(M.X(M.win[0][0]), M.Y(M.win[0][0])); ctx.lineTo(M.X(M.win[0][1]), M.Y(M.win[0][1])); ctx.stroke();
  ctx.strokeStyle = C.navy; ctx.lineWidth = 2.2; ctx.beginPath(); let pen = false; const out = [0];
  for(let i = 0; i <= b.w; i += 1.5){ const x = M.iX(b.x + i); S.sys.f([x], out); const y = out[0]; if(!isFinite(y)){ pen = false; continue; } if(pen) ctx.lineTo(b.x + i, M.Y(y)); else { ctx.moveTo(b.x + i, M.Y(y)); pen = true; } }
  ctx.stroke();
  S.trajs.forEach(t => { if(S.anim && S.anim.traj === t) return; stair(ctx, M, t.res, t.color, 1); });
  if(S.shockPath && S.shockPath.res) stair(ctx, M, S.shockPath.res, C.ink, 1, 2.6);
  ctx.restore();
  S.eqs.forEach((e, i) => { const X = M.X(e.x[0]), Y = M.Y(e.x[0]); if(X < b.x - 5 || X > b.x + b.w + 5) return; eqMark(ctx, X, Y, e); ctx.font = `600 13px ${SERIF}`; ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('E' + (i + 1), X + 9, Y + 5); });
  if(S.shockPath){ const X = M.X(S.shockPath.x0[0]); ctx.strokeStyle = C.ink; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(X, M.Y(S.shockPath.x0[0]), 10, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
}
function stair(ctx, M, r, col, frac, lw = 1.8){
  if(!r) return; const xs = r.x; let n = xs.length; if(frac < 1) n = Math.max(1, Math.round(xs.length * frac));
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw; ctx.globalAlpha = .9;
  ctx.beginPath(); ctx.moveTo(M.X(xs[0][0]), M.Y(xs[0][0]));
  for(let i = 0; i < n - 1; i++){ const a = xs[i][0], c = xs[i + 1][0]; ctx.lineTo(M.X(a), M.Y(c)); ctx.lineTo(M.X(c), M.Y(c)); }
  ctx.stroke(); ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.arc(M.X(xs[0][0]), M.Y(xs[0][0]), 4, 0, 7); ctx.fill();
}

/* ---------------- flow particles ---------------- */
let resetParticles = true;
const PT = {n:0, x:null, y:null, age:null, life:null, hx:null, hy:null, L:11, ptr:0, k:1};
function speedScale(){
  if(!G || !S.sys) return;
  const m = S.model; if(m.discrete){ PT.k = 0; return; }
  const M = G.M, g = new Float64Array(2), sp = [];
  const sx = G.plot.w / span(0), sy = m.dim === 2 ? G.plot.h / span(1) : 0;
  for(let i = 0; i < 24; i++) for(let j = 0; j < (m.dim === 2 ? 18 : 1); j++){
    const x = [S.view[0][0] + span(0) * (i + .5) / 24]; if(m.dim === 2) x.push(S.view[1][0] + span(1) * (j + .5) / 18);
    S.sys.f(x, g); const v = Math.hypot(g[0] * sx, m.dim === 2 ? g[1] * sy : 0); if(isFinite(v) && v > 0) sp.push(v);
  }
  sp.sort((a, b) => a - b);
  const med = sp.length ? sp[Math.floor(sp.length * .5)] : 1;
  PT.k = 1.5 / (med || 1);
}
function initParticles(){
  resetParticles = false;
  if(!G) return;
  const m = S.model;
  PT.n = m.discrete ? 0 : m.dim === 2 ? clamp(Math.round(G.plot.w * G.plot.h / 420), 250, 1600) : 70;
  PT.x = new Float64Array(PT.n); PT.y = new Float64Array(PT.n); PT.age = new Float64Array(PT.n); PT.life = new Float64Array(PT.n);
  PT.hx = new Float32Array(PT.n * PT.L); PT.hy = new Float32Array(PT.n * PT.L);
  for(let i = 0; i < PT.n; i++){ spawn(i); PT.age[i] = Math.random() * PT.life[i]; }
}
function spawn(i){
  const m = S.model;
  PT.x[i] = S.view[0][0] + Math.random() * span(0);
  PT.y[i] = m.dim === 2 ? S.view[1][0] + Math.random() * span(1) : Math.random();
  PT.age[i] = 0; PT.life[i] = 50 + Math.random() * 110;
  const X = G.M.X(PT.x[i]), Y = m.dim === 2 ? G.M.Y(PT.y[i]) : 0;
  for(let j = 0; j < PT.L; j++){ PT.hx[i * PT.L + j] = X; PT.hy[i * PT.L + j] = Y; }
}
const _g = new Float64Array(2), _p = [0, 0];
function stepParticles(){
  const m = S.model, M = G.M, k = PT.k, L = PT.L, sx = G.plot.w / span(0), sy = m.dim === 2 ? G.plot.h / span(1) : 1;
  PT.ptr = (PT.ptr + 1) % L;
  const maxd = 4.5;
  for(let i = 0; i < PT.n; i++){
    let x = PT.x[i], y = PT.y[i];
    _p[0] = x; _p[1] = y; S.sys.f(_p, _g);
    let vx = _g[0] * sx, vy = m.dim === 2 ? _g[1] * sy : 0;
    let s = k, d = Math.hypot(vx, vy) * s; if(d > maxd) s *= maxd / d;
    // midpoint
    _p[0] = x + _g[0] * s * .5; _p[1] = m.dim === 2 ? y + _g[1] * s * .5 : y; S.sys.f(_p, _g);
    x += _g[0] * s; if(m.dim === 2) y += _g[1] * s;
    PT.age[i]++;
    if(!isFinite(x) || !isFinite(y) || PT.age[i] > PT.life[i] || x < S.view[0][0] || x > S.view[0][1] || (m.dim === 2 && (y < S.view[1][0] || y > S.view[1][1]))){ spawn(i); continue; }
    PT.x[i] = x; PT.y[i] = y;
    PT.hx[i * L + PT.ptr] = M.X(x); PT.hy[i * L + PT.ptr] = m.dim === 2 ? M.Y(y) : 0;
  }
}
function drawParticles(ctx){
  const m = S.model, L = PT.L, n = PT.n;
  if(m.dim === 2){
    ctx.save(); ctx.beginPath(); const b = G.plot; ctx.rect(b.x, b.y, b.w, b.h); ctx.clip();
    ctx.strokeStyle = C.navy; ctx.lineWidth = 1.15; ctx.lineCap = 'round';
    for(let s = L - 1; s >= 1; s--){
      const a = (s - 1 + 0) % L; // segment age s (older) to s-1
      ctx.globalAlpha = 0.42 * Math.pow(1 - (s - 1) / (L - 1), 1.3);
      ctx.beginPath();
      const i1 = (PT.ptr - s + L * 2) % L, i0 = (PT.ptr - s + 1 + L * 2) % L;
      for(let i = 0; i < n; i++){ const o = i * L; const x1 = PT.hx[o + i1], y1 = PT.hy[o + i1], x0 = PT.hx[o + i0], y0 = PT.hy[o + i0]; if(x1 === x0 && y1 === y0) continue; ctx.moveTo(x1, y1); ctx.lineTo(x0, y0); }
      ctx.stroke();
    }
    ctx.restore(); ctx.globalAlpha = 1;
  } else {
    const st = G.strip, cy = st.y + st.h / 2;
    ctx.fillStyle = C.navy;
    for(let i = 0; i < n; i++){
      const a = Math.min(PT.age[i] / 12, 1, (PT.life[i] - PT.age[i]) / 12);
      ctx.globalAlpha = .5 * Math.max(0, a);
      ctx.beginPath(); ctx.arc(G.M.X(PT.x[i]), cy - 9 + PT.y[i] * 18, 1.7, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
function drawDyn(ts){
  const {ctx, W, H: HH} = fitCanvas(cvDyn);
  ctx.clearRect(0, 0, W, HH);
  if(!G) return;
  const m = S.model;
  if(!m.discrete && PT.n){ if(S.flow) stepParticles(); drawParticles(ctx); }
  if(S.anim){
    const a = S.anim, f = Math.min(1, (ts - a.t0) / a.dur);
    const M = G.M;
    if(G.mode === 'cobweb'){ ctx.save(); clipBox(ctx, M.box); stair(ctx, M, a.traj.res, a.traj.color, f); ctx.restore(); ctx.restore(); }
    else if(G.mode === 'line'){ const i = S.trajs.indexOf(a.traj); lineTraj(ctx, M, a.traj, f, G.strip.y + G.strip.h / 2, i); }
    else { ctx.save(); clipBox(ctx, M.box); drawTraj(ctx, M, a.traj, f); ctx.restore(); ctx.restore(); }
    if(f >= 1){ S.anim = null; needDraw = true; needPanel = true; }
    else needPanel = S.tab === 'time';
  }
}

/* ---------------- interaction ---------------- */
function launch(x0, quiet, preset){
  const t = {x0:x0.slice(), color:C.traj ? C.traj[S.nTraj % C.traj.length] : '#C8871A'};
  if(!C.traj) readColors(), t.color = C.traj[S.nTraj % C.traj.length];
  S.nTraj++;
  if(preset){ t.res = preset.res; t.saddle = true; } else t.res = simulate(t.x0);
  S.trajs.push(t); if(S.trajs.length > 8) S.trajs.shift();
  S.anim = reduceMotion ? null : {traj:t, t0:performance.now(), dur:m_dur()};
  needDraw = true; needPanel = true;
  if(!quiet) $('#hint').style.opacity = 0;
}
const m_dur = () => S.model.discrete ? 1400 : 1600;
const stage = $('#stage');
let drag = null;
stage.addEventListener('pointerdown', e => {
  if(e.target.closest('.tools')) return;
  stage.setPointerCapture(e.pointerId);
  drag = {x:e.clientX, y:e.clientY, v:S.view.map(w => w.slice()), moved:false};
});
stage.addEventListener('pointermove', e => {
  const r = stage.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
  if(drag){
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if(Math.hypot(dx, dy) > 4) drag.moved = true;
    if(drag.moved){
      const m = S.model;
      const ux = dx / G.plot.w * (drag.v[0][1] - drag.v[0][0]);
      S.view[0] = [drag.v[0][0] - ux, drag.v[0][1] - ux];
      if(m.dim === 2){ const uy = dy / G.plot.h * (drag.v[1][1] - drag.v[1][0]); S.view[1] = [drag.v[1][0] + uy, drag.v[1][1] + uy]; }
      resetParticles = true; invalidate();
    }
  }
  readout(px, py);
});
stage.addEventListener('pointerup', e => {
  if(!drag) return; const d = drag; drag = null;
  if(d.moved) return;
  const r = stage.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, M = G.M, b = G.plot;
  if(px < b.x || px > b.x + b.w) return;
  if(G.mode === 'plane' || G.mode === 'map2'){ if(py < b.y || py > b.y + b.h) return; launch([M.iX(px), M.iY(py)]); }
  else launch([M.iX(px)]);
});
stage.addEventListener('pointerleave', () => { $('#readout').innerHTML = ''; });
stage.addEventListener('wheel', e => {
  e.preventDefault();
  const r = stage.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, M = G.M;
  const f = Math.exp(clamp(e.deltaY, -60, 60) * 0.004), m = S.model;
  const cx = M.iX(px); S.view[0] = [cx + (S.view[0][0] - cx) * f, cx + (S.view[0][1] - cx) * f];
  if(m.dim === 2){ const cy = M.iY(py); S.view[1] = [cy + (S.view[1][0] - cy) * f, cy + (S.view[1][1] - cy) * f]; }
  resetParticles = true; invalidate();
}, {passive:false});
function readout(px, py){
  if(!G) return; const M = G.M, b = G.plot, m = S.model, el = $('#readout');
  if(px < b.x || px > b.x + b.w || ((G.mode === 'plane' || G.mode === 'map2') && (py < b.y || py > b.y + b.h))){ el.innerHTML = ''; return; }
  const x = G.mode === 'plane' || G.mode === 'map2' ? [M.iX(px), M.iY(py)] : [M.iX(px)];
  const g = new Float64Array(2); S.sys.f(x, g);
  const parts = m.vars.map((v, i) => `${H(v)} = ${fmt(x[i])}`);
  const rhs = m.vars.map((v, i) => m.discrete ? `${H(v)}<sub><i>t</i>+1</sub> = ${fmt(g[i])}` : `${m.eqHTML[i].lhs} = ${fmt(g[i])}`);
  el.innerHTML = parts.join(', ') + '&ensp;→&ensp;' + rhs.join(', ');
}
$('#t-flow').onclick = e => { S.flow = !S.flow; e.currentTarget.setAttribute('aria-pressed', S.flow); };
$('#t-flow').setAttribute('aria-pressed', S.flow);
$('#t-clear').onclick = () => { S.trajs = []; S.anim = null; invalidate(false); };
$('#t-view').onclick = () => { const m = S.model; S.view = m.vars.map(v => m.windows[v].slice()); if(m.dim === 1) S.view[1] = m.discrete ? S.view[0].slice() : [0, 1]; resetParticles = true; invalidate(); };
$('#p-reset').onclick = () => { S.pv = S.model.params.map(p => p.value); syncParams(); invalidate(); };
$('#horizon').addEventListener('change', e => { const v = parseFloat(e.target.value); if(v > 0){ S.horizon = S.model.discrete ? Math.round(Math.min(v, 5000)) : Math.min(v, 1e5); invalidate(); } e.target.value = S.horizon; });

/* ---------------- side panel ---------------- */
function drawSide(){
  const m = S.model, ul = $('#eqlist');
  if(!S.eqs.length){ ul.innerHTML = `<li class="none" style="display:block">No steady state in view. Pan or zoom out, or move a parameter.</li>`; }
  else ul.innerHTML = S.eqs.map((e, i) => {
    const cls = e.stable ? 'stable' : e.saddle ? 'saddle' : e.stable === null ? 'neutral' : 'unstable';
    const co = m.vars.map((v, k) => `${H(v)}<sup>*</sup> = ${fmt(e.x[k])}`).join(', ');
    const ev = e.eig.map(l => l.im ? `${fmt(l.re)} ${l.im < 0 ? '−' : '+'} ${fmt(Math.abs(l.im))}i` : fmt(l.re));
    const evs = e.eig.length === 2 && e.eig[0].im ? ev[1] + ' and its conjugate' : ev.join(', ');
    let extra = '';
    if(e.saddle && m.jump) extra = `. ${H(m.jump)} jumps onto the saddle path`;
    return `<li><span class="mk ${cls}"></span><b>E${i + 1}</b><span class="co">${co}</span><span class="ty ${cls}">${e.label}${extra}</span><span class="ev">${m.discrete ? 'Multipliers' : 'Eigenvalues'} λ = ${evs}</span></li>`;
  }).join('');
  const rp = $('#reports');
  if(m.reports.length && S.main){
    const k = S.eqs.indexOf(S.main) + 1;
    rp.innerHTML = `<div class="hd">At E${k}</div>` + m.reports.map(r => `<dt>${esc(r.label)}</dt><dd>${fmt(S.sys.evalAt(r.fn, S.main.x))}</dd>`).join('');
  } else rp.innerHTML = '';
}

/* ---------------- analysis panel ---------------- */
const tabs = {time:$('#tab-time'), bif:$('#tab-bif'), eig:$('#tab-eig')};
Object.entries(tabs).forEach(([k, b]) => b.onclick = () => setTab(k));
$('.tabs').addEventListener('keydown', e => {
  if(e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const ks = Object.keys(tabs), i = ks.indexOf(S.tab), n = ks[(i + (e.key === 'ArrowRight' ? 1 : ks.length - 1)) % ks.length];
  setTab(n); tabs[n].focus();
});
function setTab(k){
  S.tab = k;
  Object.entries(tabs).forEach(([n, b]) => { b.setAttribute('aria-selected', n === k); b.tabIndex = n === k ? 0 : -1; });
  $('#opt-time').hidden = k !== 'time'; $('#opt-bif').hidden = k !== 'bif';
  needPanel = true;
}
function drawPanel(){
  needPanel = false;
  readColors();
  const {ctx, W, H: HH} = fitCanvas(cvPn); ctx.clearRect(0, 0, W, HH);
  $('#pn-note').textContent = '';
  if(S.tab === 'time') drawTime(ctx, W, HH);
  else if(S.tab === 'bif') drawBif(ctx, W, HH);
  else drawEig(ctx, W, HH);
}
function drawTime(ctx, W, HH){
  const m = S.model, n = m.dim, sp = S.shockPath && S.shockPath.res ? S.shockPath : null;
  const pre = sp ? S.horizon * 0.12 : 0, T = S.horizon;
  const series = S.trajs.map(t => ({res:t.res, color:t.color, lw:1.8, frac:S.anim && S.anim.traj === t ? Math.min(1, (performance.now() - S.anim.t0) / S.anim.dur) : 1}));
  if(sp) series.push({res:sp.res, color:C.ink, lw:2.6, frac:1, shock:true});
  $('#pn-cap').textContent = sp ? 'Shock at t = 0. Before it, the economy rests at its old steady state; dashed lines mark the new one.' : (m.discrete ? 'Each dot is one period.' : 'Paths launched on the diagram, in the same colours.') + (S.main ? ' Dashed lines mark the steady state E' + (S.eqs.indexOf(S.main) + 1) + '.' : '');
  if(!series.length){ $('#pn-note').textContent = 'Click on the diagram to launch an economy and see its time path.'; }
  const gap = 18, top = 12, bot = 30, h = (HH - top - bot - gap * (n - 1)) / n;
  for(let k = 0; k < n; k++){
    let lo = Infinity, hi = -Infinity;
    for(const s of series){ for(const p of s.res.x){ const v = p[k]; if(isFinite(v)){ lo = Math.min(lo, v); hi = Math.max(hi, v); } } }
    if(sp){ lo = Math.min(lo, sp.x0[k]); hi = Math.max(hi, sp.x0[k]); }
    if(S.main){ lo = Math.min(lo, S.main.x[k]); hi = Math.max(hi, S.main.x[k]); }
    if(!isFinite(lo)){ lo = S.view[k][0]; hi = S.view[k][1]; }
    const lim = [S.view[k][0] - 3 * span(k), S.view[k][1] + 3 * span(k)]; lo = Math.max(lo, lim[0]); hi = Math.min(hi, lim[1]);
    const pd = (hi - lo) * .1 || Math.abs(hi) * .1 || 1; lo -= pd; hi += pd;
    const box = {x:54, y:top + k * (h + gap), w:W - 54 - 18, h};
    const M = mapper(box, [[-pre, T], [lo, hi]]);
    axes(ctx, M, k === n - 1 ? 't' : '', varLabel(m.vars[k]), {});
    clipBox(ctx, box);
    if(S.main){ ctx.strokeStyle = C.forest; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(box.x, M.Y(S.main.x[k])); ctx.lineTo(box.x + box.w, M.Y(S.main.x[k])); ctx.stroke(); ctx.setLineDash([]); }
    if(sp){ ctx.strokeStyle = C.faint; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(M.X(0), box.y); ctx.lineTo(M.X(0), box.y + box.h); ctx.stroke(); }
    for(const s of series){
      const r = s.res; let N = r.x.length; if(s.frac < 1){ const Tt = r.t[r.t.length - 1] * s.frac; N = 1; while(N < r.x.length && r.t[N] <= Tt) N++; }
      ctx.strokeStyle = ctx.fillStyle = s.color; ctx.lineWidth = s.lw; ctx.lineJoin = 'round';
      ctx.beginPath();
      if(s.shock){ ctx.moveTo(M.X(-pre), M.Y(sp.x0[k])); ctx.lineTo(M.X(0), M.Y(sp.x0[k])); }
      let pen = !!s.shock;
      for(let i = 0; i < N; i++){ const X = M.X(r.t[i]), Y = M.Y(r.x[i][k]); if(!isFinite(Y) || Math.abs(Y) > 1e5){ pen = false; continue; } if(pen) ctx.lineTo(X, Y); else { ctx.moveTo(X, Y); pen = true; } }
      ctx.globalAlpha = m.discrete ? .5 : 1; ctx.stroke(); ctx.globalAlpha = 1;
      if(m.discrete && N < 400) for(let i = 0; i < N; i++){ const Y = M.Y(r.x[i][k]); if(isFinite(Y)){ ctx.beginPath(); ctx.arc(M.X(r.t[i]), Y, s.shock ? 2.6 : 2.1, 0, 7); ctx.fill(); } }
    }
    ctx.restore();
  }
}

// bifurcation
function buildBifSelects(){
  const m = S.model, ps = $('#bif-p'), vs = $('#bif-v');
  ps.innerHTML = m.params.map((p, k) => `<option value="${k}">${esc(plain(p.name))}${p.label ? ' – ' + esc(p.label) : ''}</option>`).join('');
  vs.innerHTML = m.vars.map((v, k) => `<option value="${k}">${esc(plain(v))}</option>`).join('');
  const pref = m.params.findIndex(p => p.name === S.def.bif);
  S.bif.param = pref >= 0 ? pref : 0; S.bif.v = 0; S.bif.key = ''; S.bif.pts = []; S.bif.done = false;
  ps.value = S.bif.param; vs.value = 0;
}
$('#bif-p').onchange = e => { S.bif.param = +e.target.value; S.bif.key = ''; syncBifKey(); needPanel = true; };
$('#bif-v').onchange = e => { S.bif.v = +e.target.value; S.bif.key = ''; syncBifKey(); needPanel = true; };
function syncBifKey(){
  const k = S.bif.param, key = S.def.id + '|' + k + '|' + S.bif.v + '|' + S.pv.map((v, i) => i === k ? '' : v).join(',') + '|' + JSON.stringify(S.view) + '|' + S.horizon;
  if(key !== S.bif.key){ S.bif.key = key; S.bif.dirty = true; }
}
let bifTimer = null;
function scheduleBif(){
  if(S.tab !== 'bif' || !S.bif.dirty) return;
  clearTimeout(bifTimer);
  bifTimer = setTimeout(runBif, 220);
}
function runBif(){
  const m = S.model, B = S.bif, k = B.param, vi = B.v, P = m.params[k];
  B.dirty = false; B.pts = []; B.done = false; B.token++; const tok = B.token;
  const N = m.discrete ? 420 : (m.dim === 1 ? 240 : 120);
  const sp = m.vars.map((v, i) => span(i)), win = viewWin().map((w, j) => [w[0] - (w[0] >= 0 && w[0] - sp[j] < 0 ? w[0] : sp[j]), w[1] + 0.5 * sp[j]]);
  const x0 = m.vars.map((v, i) => v in m.init ? m.init[v] : (S.view[i][0] + S.view[i][1]) / 2);
  let seeds = [], i = 0;
  const box = m.vars.map((v, j) => [S.view[j][0] - 3 * sp[j], S.view[j][1] + 3 * sp[j]]);
  function chunk(){
    if(tok !== B.token) return;
    const t0 = performance.now();
    while(i < N && performance.now() - t0 < 24){
      const p = P.min + (P.max - P.min) * i / (N - 1), pv = S.pv.slice(); pv[k] = p;
      const sys = E.makeSystem(m, pv);
      const eqs = E.findEquilibria(sys, win, {seeds, grid: m.dim === 2 ? 6 : undefined, N:300});
      seeds = eqs.map(e => e.x);
      for(const e of eqs) B.pts.push([p, e.x[vi], e.stable ? 1 : e.saddle ? 4 : e.type === 'centre' ? 5 : 0]);
      const conservative = eqs.some(e => e.type === 'centre');
      if(m.discrete){
        const r = E.iterateMap(sys, x0, 520, {box});
        if(r.end === 'done') for(let j = 360; j < r.x.length; j++) B.pts.push([p, r.x[j][vi], 3]);
      } else if(m.dim === 2 && !conservative){
        const r = E.integrate(sys, x0, S.horizon * 3, {scale:sp, box, hmax:S.horizon / 100, maxSteps:5000});
        if(r.end === 'done'){
          const cut = r.t[r.t.length - 1] * 0.6; let lo = Infinity, hi = -Infinity;
          for(let j = 0; j < r.x.length; j++) if(r.t[j] >= cut){ lo = Math.min(lo, r.x[j][vi]); hi = Math.max(hi, r.x[j][vi]); }
          if(hi - lo > 2e-3 * sp[vi]){ B.pts.push([p, lo, 2], [p, hi, 2]); }
        }
      }
      i++;
    }
    B.progress = i / N; needPanel = true;
    if(i < N) setTimeout(chunk, 0); else B.done = true;
  }
  chunk();
}
let bifM = null;
function drawBif(ctx, W, HH){
  const m = S.model, B = S.bif, P = m.params[B.param], vi = B.v;
  scheduleBif();
  let lo = S.view[vi][0], hi = S.view[vi][1];
  if(B.pts.length){ let a = Infinity, b = -Infinity; for(const q of B.pts) if(isFinite(q[1])){ a = Math.min(a, q[1]); b = Math.max(b, q[1]); } if(a < lo || b > hi){ lo = Math.min(lo, a); hi = Math.max(hi, b); const pd = (hi - lo) * 0.05; if(a < S.view[vi][0]) lo -= pd; hi += pd; } }
  const box = {x:54, y:14, w:W - 54 - 18, h:HH - 14 - 34};
  const M = mapper(box, [[P.min, P.max], [lo, hi]]); bifM = M;
  axes(ctx, M, plain(P.name), varLabel(m.vars[vi]) + (m.discrete ? ', long run' : ''));
  clipBox(ctx, box);
  const cols = {0:C.faint, 1:C.forest, 2:C.navy, 3:C.navy, 4:C.brick, 5:C.muted};
  for(const [p, v, t] of B.pts){
    const X = M.X(p), Y = M.Y(v); if(!isFinite(Y)) continue;
    ctx.fillStyle = cols[t];
    if(t === 3){ ctx.globalAlpha = .45; ctx.fillRect(X - .6, Y - .6, 1.2, 1.2); ctx.globalAlpha = 1; }
    else { ctx.beginPath(); ctx.arc(X, Y, t === 0 || t === 5 ? 1.4 : 1.9, 0, 7); ctx.fill(); }
  }
  const cur = S.pv[B.param];
  ctx.strokeStyle = C.ink; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(M.X(cur), box.y); ctx.lineTo(M.X(cur), box.y + box.h); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
  const kinds = new Set(B.pts.map(q => q[2]));
  const bits = [['Stable steady state', C.forest]];
  if(kinds.has(4)) bits.push(['Saddle point (stable path)', C.brick]);
  if(kinds.has(5)) bits.push(['Centre (closed orbits)', C.muted]);
  bits.push(['Unstable', C.faint]);
  if(m.discrete) bits.push(['Long-run values of the orbit', C.navy]); else if(kinds.has(2)) bits.push(['Cycle, lowest and highest value', C.navy]);
  ctx.font = `12px ${SANS}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  let y = box.y + 12;
  for(const [t, c] of bits){ ctx.fillStyle = C.paper; const w = ctx.measureText(t).width; ctx.globalAlpha = .85; ctx.fillRect(box.x + box.w - w - 28, y - 8, w + 24, 16); ctx.globalAlpha = 1; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(box.x + box.w - 10, y, 3.5, 0, 7); ctx.fill(); ctx.fillStyle = C.muted; ctx.fillText(t, box.x + box.w - 20, y); y += 17; }
  $('#pn-note').textContent = B.done ? '' : 'Computing… ' + Math.round((B.progress || 0) * 100) + '%';
  $('#pn-cap').textContent = `Each column is a separate economy with a different value of ${plain(P.name)}, everything else held at today's values. Click the diagram to set ${plain(P.name)}.`;
}
cvPn.addEventListener('click', e => {
  if(S.tab !== 'bif' || !bifM) return;
  const r = cvPn.getBoundingClientRect(), px = e.clientX - r.left;
  if(px < bifM.box.x || px > bifM.box.x + bifM.box.w) return;
  const P = S.model.params[S.bif.param]; S.pv[S.bif.param] = clamp(bifM.iX(px), P.min, P.max); syncParams(); invalidate();
});

// stability
function drawEig(ctx, W, HH){
  const m = S.model, eqs = S.eqs.filter(e => e.eig.length);
  const two = m.dim === 2, gap = 30;
  const wA = two ? (W - gap) / 2 : W;
  // complex plane
  let R = m.discrete ? 1.35 : 0.1;
  for(const e of eqs) for(const l of e.eig){ const a = Math.max(Math.abs(l.re), Math.abs(l.im)); if(isFinite(a) && a < 1e3) R = Math.max(R, a * 1.25); }
  if(!m.discrete){ const mains = S.main ? S.main.eig.map(l => Math.max(Math.abs(l.re), Math.abs(l.im))) : []; const rm = Math.max(0.1, ...mains) * 1.6; R = Math.min(R, Math.max(rm, 0.1)); }
  const bh = HH - 16 - 32, bw = Math.min(wA - 70, bh * 1.8);
  const box = {x:50 + (wA - 70 - bw) / 2, y:16, w:bw, h:bh};
  const M = mapper(box, [[-R * bw / bh, R * bw / bh], [-R, R]]);
  ctx.save(); clipBox(ctx, box);
  ctx.fillStyle = C.forestSoft;
  if(m.discrete){ ctx.beginPath(); ctx.ellipse(M.X(0), M.Y(0), M.X(1) - M.X(0), M.Y(0) - M.Y(1), 0, 0, 7); ctx.fill(); ctx.strokeStyle = C.forest; ctx.lineWidth = 1.5; ctx.stroke(); }
  else { ctx.fillRect(box.x, box.y, M.X(0) - box.x, box.h); ctx.strokeStyle = C.forest; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(M.X(0), box.y); ctx.lineTo(M.X(0), box.y + box.h); ctx.stroke(); }
  ctx.restore(); ctx.restore();
  axes(ctx, M, 'Re λ', 'Im λ', {grid:false});
  ctx.strokeStyle = C.faint; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(box.x, M.Y(0)); ctx.lineTo(box.x + box.w, M.Y(0)); ctx.stroke();
  S.eqs.forEach((e, i) => e.eig.forEach(l => {
    let X = M.X(l.re), Y = M.Y(l.im); const off = X < box.x || X > box.x + box.w || Y < box.y || Y > box.y + box.h;
    X = clamp(X, box.x + 4, box.x + box.w - 4); Y = clamp(Y, box.y + 4, box.y + box.h - 4);
    eqMark(ctx, X, Y, e, 4.5);
    ctx.font = `600 12px ${SERIF}`; ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText('E' + (i + 1) + (off ? ' (off scale)' : ''), X + 7, Y - 3);
  }));
  ctx.font = `12px ${SANS}`; ctx.fillStyle = C.forestInk || C.forest; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = C.muted; ctx.fillText(m.discrete ? 'Stable inside the unit circle' : 'Stable in the shaded half-plane', box.x + 6, box.y + box.h - 18);
  if(!two){ $('#pn-cap').textContent = m.discrete ? 'A fixed point is stable when |F′(x*)| < 1; a negative slope means convergence by oscillation.' : 'A steady state is stable when the slope of the right-hand side is negative there.'; return; }
  // trace–determinant plane
  const x2 = wA + gap, bw2 = W - x2 - 60, box2 = {x:x2 + 44, y:16, w:bw2, h:bh};
  let rt = m.discrete ? 2.6 : 0.1, rd = m.discrete ? 1.6 : 0.01;
  for(const e of eqs){ if(isFinite(e.tr) && Math.abs(e.tr) < 1e3) rt = Math.max(rt, Math.abs(e.tr) * 1.3); if(isFinite(e.det) && Math.abs(e.det) < 1e6) rd = Math.max(rd, Math.abs(e.det) * 1.3); }
  if(!m.discrete) rd = Math.max(rd, rt * rt / 4 * 1.15);
  const M2 = mapper(box2, [[-rt, rt], [-rd, rd]]);
  ctx.save(); clipBox(ctx, box2);
  if(m.discrete){
    ctx.fillStyle = C.forestSoft; ctx.beginPath(); ctx.moveTo(M2.X(-2), M2.Y(1)); ctx.lineTo(M2.X(2), M2.Y(1)); ctx.lineTo(M2.X(0), M2.Y(-1)); ctx.closePath(); ctx.fill(); ctx.strokeStyle = C.forest; ctx.lineWidth = 1.5; ctx.stroke();
  } else {
    ctx.fillStyle = C.forestSoft; ctx.fillRect(box2.x, M2.Y(rd), M2.X(0) - box2.x, M2.Y(0) - M2.Y(rd));
    ctx.fillStyle = C.brickSoft; ctx.globalAlpha = .6; ctx.fillRect(box2.x, M2.Y(0), box2.w, box2.y + box2.h - M2.Y(0)); ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = C.muted; ctx.lineWidth = 1.3; ctx.setLineDash([4, 3]); ctx.beginPath();
  for(let i = 0; i <= 100; i++){ const t = -rt + 2 * rt * i / 100, X = M2.X(t), Y = M2.Y(m.discrete ? t * t / 4 : t * t / 4); if(i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }
  ctx.stroke(); ctx.setLineDash([]);
  ctx.restore(); ctx.restore();
  axes(ctx, M2, 'trace', 'det', {grid:false});
  ctx.strokeStyle = C.faint; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(M2.X(0), box2.y); ctx.lineTo(M2.X(0), box2.y + box2.h); ctx.moveTo(box2.x, M2.Y(0)); ctx.lineTo(box2.x + box2.w, M2.Y(0)); ctx.stroke();
  ctx.font = `12px ${SANS}`; ctx.fillStyle = C.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if(!m.discrete){
    ctx.fillText('saddles', box2.x + box2.w / 2, M2.Y(-rd * .6));
    ctx.fillText('stable', box2.x + box2.w * .18, M2.Y(rd * .88));
    ctx.fillText('unstable', box2.x + box2.w * .82, M2.Y(rd * .88));
    ctx.fillText('spirals above the curve', box2.x + box2.w / 2, M2.Y(rd * .7));
  } else ctx.fillText('stable inside the triangle', box2.x + box2.w / 2, M2.Y(rd * .88));
  S.eqs.forEach((e, i) => { if(!isFinite(e.tr)) return; let X = clamp(M2.X(e.tr), box2.x + 4, box2.x + box2.w - 4), Y = clamp(M2.Y(e.det), box2.y + 4, box2.y + box2.h - 4); eqMark(ctx, X, Y, e, 4.5); ctx.font = `600 12px ${SERIF}`; ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText('E' + (i + 1), X + 7, Y - 3); });
  $('#pn-cap').textContent = m.discrete ? 'Left: multipliers of the linearised map. Right: the stability triangle, |tr J| < 1 + det J < 2.' : 'Left: eigenvalues of the Jacobian. Right: the Poincaré diagram. Below the axis, saddles; above the dashed parabola, spirals; the sign of the trace decides stability.';
}

/* ---------------- editor ---------------- */
const dlg = $('#ed');
let edId = null;
const BLANK = `title: My model
# One or two equations. Use x' for continuous time, x(t+1) for discrete time.
k' = s*k^alpha - (n + delta)*k
param s = 0.25 [0.01, 0.9] Saving rate
param alpha = 0.33 [0.05, 0.95] Capital share
param n = 0.01 [0, 0.08] Population growth
param delta = 0.05 [0, 0.2] Depreciation rate
window k [0, 25]
init k = 2`;
function openEditor(src, id, errs){
  edId = id || null;
  $('#ed-src').value = src;
  $('#ed-h').textContent = id ? 'Edit your model' : 'Write a model';
  showErrs(errs || []);
  $('#ed-ok').hidden = true;
  if(typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  setTimeout(() => $('#ed-src').focus(), 30);
}
function showErrs(errs){ $('#ed-errs').innerHTML = errs.map(e => `<li>${e.line ? 'Line ' + e.line + ': ' : ''}${esc(e.msg)}</li>`).join(''); }
function edParse(){ const src = $('#ed-src').value, m = E.parseModel(src); showErrs(m.errors || []); return m.errors ? null : src; }
$('#ed-src').addEventListener('input', () => { clearTimeout(edParse.t); edParse.t = setTimeout(() => { const ok = edParse(); const o = $('#ed-ok'); o.hidden = !ok; if(ok) o.textContent = 'The model reads correctly.'; }, 350); });
$('#ed-src').addEventListener('keydown', e => { if((e.ctrlKey || e.metaKey) && e.key === 'Enter'){ e.preventDefault(); $('#ed-run').click(); } });
$('#ed-run').onclick = () => { const src = edParse(); if(!src) return; closeEd(); const d = edId ? {...customDef({id:edId, src})} : {id:'draft', src, custom:false, family:'Your models', title:null, glyph:'mine'}; if(edId){ const a = customs(); const i = a.findIndex(c => c.id === edId); if(i >= 0){ a[i].src = src; saveCustoms(a); } } load(d); };
$('#ed-save').onclick = () => {
  const src = edParse(); if(!src) return;
  const a = customs(); let id = edId;
  if(id){ const i = a.findIndex(c => c.id === id); if(i >= 0) a[i].src = src; else a.push({id, src}); }
  else { id = 'u' + Date.now().toString(36); a.push({id, src}); }
  if(!saveCustoms(a)){ showErrs([{line:0, msg:'This browser refused to store the model. Copy the text somewhere safe.'}]); return; }
  closeEd(); load(customDef({id, src}));
};
$('#ed-close').onclick = closeEd;
function closeEd(){ if(dlg.open) dlg.close(); }
$('#b-new').onclick = () => openEditor(BLANK, null);
$('#b-copy').onclick = () => { const d = S.def; openEditor(d.custom ? d.src : d.src.replace(/^(\s*title\s*:\s*)(.+)$/mi, (a, p, t) => p + t + ' (my version)'), d.custom ? d.id : null); };

/* ---------------- main loop ---------------- */
function tick(ts){
  requestAnimationFrame(tick);
  if(!S.model) return;
  if(needCompute){ layout(); compute(); }
  if(needDraw){ drawStage(); drawSide(); if(resetParticles) initParticles(); }
  if(needPanel) drawPanel();
  drawDyn(ts);
}
new ResizeObserver(() => { if(!S.model) return; resetParticles = true; invalidate(false); }).observe(stage);
new ResizeObserver(() => { needPanel = true; }).observe($('#pn'));
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readColors(); S.trajs.forEach((t, i) => t.color = C.traj[i % C.traj.length]); invalidate(false); });

readColors();
const want = decodeURIComponent((location.hash || '').slice(1));
const first = allDefs().find(d => d.id === want) || LIBRARY.find(d => d.id === 'ramsey');
setTab('time');
// layout needs a model before the first compute
S.model = E.parseModel(first.src); S.pv = S.model.params.map(p => p.value); S.sys = E.makeSystem(S.model, S.pv); S.view = S.model.vars.map(v => S.model.windows[v].slice()); if(S.model.dim === 1) S.view[1] = S.model.discrete ? S.view[0].slice() : [0, 1];
layout();
load(first, true);
if(reduceMotion) { S.flow = false; $('#t-flow').setAttribute('aria-pressed', 'false'); }
requestAnimationFrame(tick);
if(document.fonts) document.fonts.ready.then(() => invalidate(false));
setTimeout(() => { $('#hint').style.opacity = 0; }, 9000);
})();
