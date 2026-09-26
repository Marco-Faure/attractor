/* ===== Attractor engine: expression language, model compiler, numerics ===== */
const Engine = (() => {
  const GREEK = {alpha:'α',beta:'β',gamma:'γ',delta:'δ',epsilon:'ε',zeta:'ζ',eta:'η',theta:'θ',kappa:'κ',lambda:'λ',mu:'μ',nu:'ν',xi:'ξ',pi:'π',rho:'ρ',sigma:'σ',tau:'τ',phi:'φ',chi:'χ',psi:'ψ',omega:'ω',Gamma:'Γ',Delta:'Δ',Theta:'Θ',Lambda:'Λ',Pi:'Π',Sigma:'Σ',Phi:'Φ',Psi:'Ψ',Omega:'Ω'};
  const FUNCS = {
    exp:Math.exp, log:Math.log, ln:Math.log, log10:Math.log10, sqrt:Math.sqrt, abs:Math.abs,
    sin:Math.sin, cos:Math.cos, tan:Math.tan, tanh:Math.tanh, sinh:Math.sinh, cosh:Math.cosh,
    atan:Math.atan, arctan:Math.atan, sign:Math.sign, floor:Math.floor,
    min:Math.min, max:Math.max, pow:Math.pow
  };
  const ARITY = {min:2,max:2,pow:2};

  /* ---------- tokenizer & parser ---------- */
  function tokenize(s){
    const out=[]; const re=/\s*(?:(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)|([A-Za-z_][A-Za-z_0-9]*)|(\*\*|[-+*/^(),]))/y;
    let i=0; s=s.replace(/[−–]/g,'-').replace(/[·×]/g,'*');
    while(i<s.length){
      if(/^\s*$/.test(s.slice(i))) break;
      re.lastIndex=i; const m=re.exec(s);
      if(!m) throw new Error(`Unexpected character "${s.slice(i).trim()[0]}"`);
      if(m[1]!==undefined) out.push({k:'num',n:parseFloat(m[1]),v:m[1]});
      else if(m[2]!==undefined) out.push({k:'id',v:m[2]});
      else out.push({k:'op',v:m[3]==='**'?'^':m[3]});
      i=re.lastIndex;
    }
    return out;
  }
  function parse(src){
    const t=tokenize(src); let i=0;
    const peek=v=>t[i]&&t[i].k==='op'&&t[i].v===v;
    const expect=v=>{ if(!peek(v)) throw new Error(t[i]?`Expected "${v}" before "${t[i].v}"`:`Missing "${v}"`); i++; };
    function add(){ let a=mul(); while(peek('+')||peek('-')){ const op=t[i++].v; a={t:'bin',op,a,b:mul()}; } return a; }
    function mul(){ let a=unary(); while(peek('*')||peek('/')){ const op=t[i++].v; a={t:'bin',op,a,b:unary()}; } return a; }
    function unary(){ if(peek('-')){ i++; return {t:'neg',a:unary()}; } if(peek('+')){ i++; return unary(); } return pw(); }
    function pw(){ const a=atom(); if(peek('^')){ i++; return {t:'bin',op:'^',a,b:unary()}; } return a; }
    function atom(){
      const k=t[i++]; if(!k) throw new Error('Expression ends too early');
      if(k.k==='num') return {t:'num',v:k.n,raw:k.v};
      if(k.k==='id'){
        if(peek('(')){ i++; const args=[]; if(!peek(')')){ args.push(add()); while(peek(',')){ i++; args.push(add()); } } expect(')'); return {t:'call',f:k.v,args}; }
        return {t:'var',name:k.v};
      }
      if(k.v==='('){ const e=add(); expect(')'); return e; }
      throw new Error(`Unexpected "${k.v}"`);
    }
    if(!t.length) throw new Error('Empty expression');
    const e=add(); if(i<t.length) throw new Error(`Unexpected "${t[i].v}"`); return e;
  }
  function compile(n,sym){
    switch(n.t){
      case 'num': { const v=n.v; return ()=>v; }
      case 'var': {
        if(sym.has(n.name)){ const k=sym.get(n.name); return e=>e[k]; }
        if(n.name==='pi') return ()=>Math.PI;
        if(n.name==='e') return ()=>Math.E;
        throw new Error(`Unknown symbol "${n.name}". Declare it with "param ${n.name} = …"`);
      }
      case 'neg': { const a=compile(n.a,sym); return e=>-a(e); }
      case 'bin': {
        const a=compile(n.a,sym), b=compile(n.b,sym);
        switch(n.op){
          case '+': return e=>a(e)+b(e);
          case '-': return e=>a(e)-b(e);
          case '*': return e=>a(e)*b(e);
          case '/': return e=>a(e)/b(e);
          case '^': if(n.b.t==='num'&&n.b.v===2) return e=>{const x=a(e);return x*x;}; return e=>Math.pow(a(e),b(e));
        }
      }
      case 'call': {
        const f=FUNCS[n.f]; if(!f) throw new Error(`Unknown function "${n.f}()"`);
        const ar=ARITY[n.f]||1; if(n.args.length!==ar) throw new Error(`${n.f}() takes ${ar} argument${ar>1?'s':''}`);
        const A=n.args.map(x=>compile(x,sym));
        if(ar===1){ const a=A[0]; return e=>f(a(e)); }
        const a=A[0], b=A[1]; return e=>f(a(e),b(e));
      }
    }
  }
  const constVal=s=>{ const f=compile(parse(s),new Map()); const v=f([]); if(!isFinite(v)) throw new Error(`"${s}" is not a number`); return v; };

  /* ---------- pretty printing to HTML ---------- */
  function nameHTML(name, discrete, isVar){
    let base=name, sub='', deco='';
    const us=name.indexOf('_'); if(us>0){ base=name.slice(0,us); sub=name.slice(us+1); }
    let m;
    if((m=base.match(/^(.+?)(star)$/))&&m[1]){ base=m[1]; deco='*'; }
    else if((m=base.match(/^(.+?)(bar)$/))&&m[1]){ base=m[1]; deco='bar'; }
    let b=GREEK[base]||base;
    if(deco==='bar') b=`<span class="ov">${b}</span>`;
    let s=`<i>${b}</i>`;
    if(deco==='*') s+='<sup>*</sup>';
    const subs=[]; if(sub) subs.push(GREEK[sub]||sub); if(discrete&&isVar) subs.push('<i>t</i>');
    if(subs.length) s+=`<sub>${subs.join(',')}</sub>`;
    return s;
  }
  const PREC={'+':1,'-':1,'*':2,'/':2,'neg':3,'^':4};
  function fmtNum(v){ return String(+v.toPrecision(6)).replace('-','−'); }
  function toHTML(n, ctx, parent=0, right=false){
    const wrap=(s,p)=>(p<parent||(right&&p===parent&&p<4&&parent!==4))?`(${s})`:s;
    switch(n.t){
      case 'num': return fmtNum(n.v);
      case 'var': return nameHTML(n.name, ctx.discrete, ctx.vars.includes(n.name));
      case 'neg': return wrap('−'+toHTML(n.a,ctx,2),3);
      case 'call': {
        const fn={atan:'arctan',ln:'ln',log:'ln'}[n.f]||n.f;
        return `${fn}(${n.args.map(a=>toHTML(a,ctx,0)).join(', ')})`;
      }
      case 'bin': {
        const p=PREC[n.op];
        if(n.op==='^'){
          const base=toHTML(n.a,ctx,5);
          return `${base}<sup>${toHTML(n.b,ctx,0)}</sup>`;
        }
        const A=toHTML(n.a,ctx,p,false); let B=toHTML(n.b,ctx,p,n.op==='-'||n.op==='/');
        if(n.b.t==='neg') B=`(${B})`;
        if(n.op==='*'){
          const numR=n.b.t==='num';
          const numL=n.a.t==='num';
          const sep=(numR||(numL&&n.b.t==='num'))?' · ':'';
          return wrap(A+(sep||'\u2009')+B,p);
        }
        const sym={'+':' + ','-':' − ','/':'/'}[n.op];
        return wrap(A+sym+B,p);
      }
    }
  }

  /* ---------- model language ---------- */
  function parseModel(src){
    const m={title:'Untitled model',vars:[],eqSrc:[],params:[],lets:[],windows:{},curves:[],reports:[],labels:{},jump:null,init:{},horizon:null,discrete:null};
    const errs=[];
    src.split(/\r?\n/).forEach((raw,li)=>{
      const line=raw.replace(/\s+#.*$/,'').replace(/^#.*$/,'').trim(); if(!line) return;
      const L=li+1; let r;
      try{
        if((r=line.match(/^title\s*:\s*(.+)$/i))) m.title=r[1].trim();
        else if((r=line.match(/^param(?:eter)?\s+([A-Za-z_]\w*)\s*=\s*([^\[]+?)\s*(?:\[\s*([^,\]]+)\s*,\s*([^\]]+)\]\s*(.*))?$/i))){
          const v=constVal(r[2]); let lo=r[3]!==undefined?constVal(r[3]):(v===0?-1:Math.min(0,2*v)), hi=r[4]!==undefined?constVal(r[4]):(v===0?1:Math.max(0,2*v));
          if(lo>hi) [lo,hi]=[hi,lo];
          m.params.push({name:r[1],value:Math.min(hi,Math.max(lo,v)),min:lo,max:hi,label:(r[5]||'').trim()});
        }
        else if((r=line.match(/^window\s+(.+)$/i))){
          const re=/([A-Za-z_]\w*)\s*\[\s*([^,\]]+)\s*,\s*([^\]]+)\]/g; let q, any=false;
          while((q=re.exec(r[1]))){ any=true; let a=constVal(q[2]), b=constVal(q[3]); if(a>b)[a,b]=[b,a]; if(a===b) b=a+1; m.windows[q[1]]=[a,b]; }
          if(!any) throw new Error('Write "window x [min, max]"');
        }
        else if((r=line.match(/^let\s+([A-Za-z_]\w*)\s*=\s*(.+)$/i))) m.lets.push({name:r[1],src:r[2],line:L});
        else if((r=line.match(/^curve\s+(.+?)\s*:\s*(.+)$/i))) m.curves.push({label:r[1],src:r[2],line:L});
        else if((r=line.match(/^report\s+(.+?)\s*:\s*(.+)$/i))) m.reports.push({label:r[1],src:r[2],line:L});
        else if((r=line.match(/^label\s+([A-Za-z_]\w*)\s*:\s*(.+)$/i))) m.labels[r[1]]=r[2].trim();
        else if((r=line.match(/^jump\s+([A-Za-z_]\w*)$/i))) m.jump=r[1];
        else if((r=line.match(/^horizon\s+(.+)$/i))) m.horizon=Math.abs(constVal(r[1]));
        else if((r=line.match(/^init\s+(.+)$/i))){ r[1].split(',').forEach(p=>{ const q=p.match(/^\s*([A-Za-z_]\w*)\s*=\s*(.+)$/); if(!q) throw new Error('Write "init x = 1, y = 2"'); m.init[q[1]]=constVal(q[2]); }); }
        else if((r=line.match(/^(?:d([A-Za-z_]\w*)\s*\/\s*dt|([A-Za-z_]\w*)\s*(?:'|\u2032|\.))\s*=\s*(.+)$/))){ addEq(r[1]||r[2],r[3],false,L); }
        else if((r=line.match(/^([A-Za-z_]\w*)\s*(?:\(\s*t\s*\+\s*1\s*\)|\[\s*t\s*\+\s*1\s*\]|\+|_next)\s*=\s*(.+)$/))){ addEq(r[1],r[2],true,L); }
        else throw new Error(`Can't read this line. Equations look like "k' = …" (continuous) or "k(t+1) = …" (discrete)`);
      }catch(e){ errs.push({line:L,msg:e.message}); }
    });
    function addEq(name,src,disc,L){
      if(m.discrete!==null&&m.discrete!==disc) throw new Error('Mix of continuous (x\') and discrete (x(t+1)) equations');
      if(m.vars.includes(name)) throw new Error(`Two equations for "${name}"`);
      m.discrete=disc; m.vars.push(name); m.eqSrc.push({src,line:L});
    }
    if(!m.vars.length) errs.push({line:0,msg:'Add at least one equation, e.g. "k\' = s*k^alpha - delta*k"'});
    if(m.vars.length>2) errs.push({line:m.eqSrc[2].line,msg:'This version draws one- and two-variable systems. Keep two equations.'});
    if(errs.length) return {errors:errs};
    // symbols
    const sym=new Map(); const all=[...m.vars,...m.params.map(p=>p.name),...m.lets.map(l=>l.name)];
    const seen=new Set(); for(const n of all){ if(seen.has(n)) errs.push({line:0,msg:`"${n}" is declared twice`}); seen.add(n); }
    all.forEach((n,k)=>sym.set(n,k));
    const ctx={discrete:m.discrete,vars:m.vars};
    const comp=(o)=>{ try{ o.ast=parse(o.src); o.fn=compile(o.ast,sym); }catch(e){ errs.push({line:o.line,msg:e.message}); } };
    m.lets.forEach(comp); m.eqSrc.forEach(comp); m.curves.forEach(comp); m.reports.forEach(comp);
    if(m.jump&&!m.vars.includes(m.jump)) errs.push({line:0,msg:`jump "${m.jump}" is not a state variable`});
    if(errs.length) return {errors:errs};
    m.dim=m.vars.length; m.discrete=!!m.discrete;
    if(m.jump&&(m.dim!==2||m.discrete)) m.jump=null;
    m.vars.forEach(v=>{ if(!m.windows[v]) m.windows[v]=[0,10]; });
    if(!m.horizon) m.horizon=m.discrete?50:100;
    m.nEnv=all.length; m.np=m.params.length; m.nl=m.lets.length;
    m.letsFn=m.lets.map(l=>l.fn); m.eqFn=m.eqSrc.map(e=>e.fn);
    m.ctx=ctx;
    m.eqHTML=m.eqSrc.map((e,i)=>{ const v=m.vars[i]; const lhs=m.discrete?nameHTML(v,false,false)+'<sub><i>t</i>+1</sub>':dotName(v); return {lhs,rhs:toHTML(e.ast,ctx)}; });
    m.letHTML=m.lets.map(l=>({lhs:nameHTML(l.name,m.discrete,false),rhs:toHTML(l.ast,ctx)}));
    m.nameHTML=n=>nameHTML(n,false,false);
    return m;
  }
  function dotName(v){
    const h=nameHTML(v,false,false);
    const plain=v.replace(/_.*/,''); const g=GREEK[plain]||plain;
    if([...g].length===1&&!/star|bar/.test(v)) return h.replace(/<i>(.)<\/i>/,'<i class="dot">$1</i>');
    return `d${h}/d<i>t</i>`;
  }

  /* ---------- systems ---------- */
  function makeSystem(m, pv){
    const env=new Float64Array(m.nEnv), nv=m.dim, np=m.np, L=m.letsFn, E=m.eqFn;
    for(let j=0;j<np;j++) env[nv+j]=pv[j];
    const load=x=>{ env[0]=x[0]; if(nv>1) env[1]=x[1]; for(let j=0;j<L.length;j++) env[nv+np+j]=L[j](env); };
    const map=(x,out)=>{ load(x); out[0]=E[0](env); if(nv>1) out[1]=E[1](env); return out; };
    // "field": time derivative (continuous) or displacement (discrete); zeros = equilibria
    const field=m.discrete?(x,out)=>{ map(x,out); out[0]-=x[0]; if(nv>1) out[1]-=x[1]; return out; }:map;
    const evalAt=(fn,x)=>{ load(x); return fn(env); };
    return {dim:nv, discrete:m.discrete, f:map, field, evalAt};
  }

  /* ---------- Dormand–Prince 5(4) ---------- */
  const DP={c:[0,1/5,3/10,4/5,8/9,1,1],
    a:[[],[1/5],[3/40,9/40],[44/45,-56/15,32/9],[19372/6561,-25360/2187,64448/6561,-212/729],[9017/3168,-355/33,46732/5247,49/176,-5103/18656],[35/384,0,500/1113,125/192,-2187/6784,11/84]],
    e:[71/57600,0,-71/16695,71/1920,-17253/339200,22/525,-1/40]};
  function integrate(sys, x0, T, o={}){
    const n=sys.dim, dir=T<0?-1:1, TT=Math.abs(T), f=sys.f;
    const scale=o.scale||[1,1], box=o.box;
    const rtol=o.rtol||1e-7, atol=(o.atol||1e-9);
    const hmax=o.hmax||TT/300;
    let h=o.h0||Math.min(hmax,TT/1000), t=0;
    const x=Float64Array.from(x0), K=[...Array(7)].map(()=>new Float64Array(n)), y=new Float64Array(n), xn=new Float64Array(n);
    const ts=[0], xs=[Array.from(x)];
    const F=(xx,out)=>{ f(xx,out); if(dir<0) for(let i=0;i<n;i++) out[i]=-out[i]; return out; };
    F(x,K[0]); if(!K[0].every(isFinite)) return {t:ts,x:xs,end:'nan'};
    let steps=0, end='done'; const maxSteps=o.maxSteps||6000;
    while(t<TT-1e-12){
      if(steps++>maxSteps){ end='steps'; break; }
      if(t+h>TT) h=TT-t;
      for(let s=1;s<7;s++){ const a=DP.a[s]; for(let i=0;i<n;i++){ let acc=x[i]; for(let j=0;j<s;j++) acc+=h*a[j]*K[j][i]; y[i]=acc; } F(y,K[s]); }
      for(let i=0;i<n;i++) xn[i]=y[i]; // 7th stage point = 5th order solution
      let err=0, bad=false;
      for(let i=0;i<n;i++){ let ei=0; for(let j=0;j<7;j++) ei+=DP.e[j]*K[j][i]; ei*=h; const sc=atol*scale[i]+rtol*Math.max(Math.abs(x[i]),Math.abs(xn[i])); const r=ei/sc; err+=r*r; if(!isFinite(xn[i])) bad=true; }
      err=Math.sqrt(err/n);
      if(bad||!isFinite(err)){ if(h<1e-10*TT){ end='nan'; break; } h*=0.25; continue; }
      if(err<=1){
        t+=h; for(let i=0;i<n;i++){ x[i]=xn[i]; K[0][i]=K[6][i]; }
        ts.push(dir*t); xs.push(Array.from(x));
        if(box&&!inBox(x,box)){ end='out'; break; }
        if(o.stop&&o.stop(x,dir*t)){ end='stop'; break; }
        if(!K[0].every(isFinite)){ end='nan'; break; }
      }
      h=Math.min(hmax, h*Math.min(5,Math.max(0.2,0.9*Math.pow(err||1e-10,-0.2))));
    }
    return {t:ts,x:xs,end};
  }
  function iterateMap(sys, x0, N, o={}){
    const n=sys.dim, x=Array.from(x0), out=new Array(n); const ts=[0], xs=[x.slice()];
    for(let k=1;k<=N;k++){ sys.f(x,out); for(let i=0;i<n;i++) x[i]=out[i]; if(!x.every(isFinite)) return {t:ts,x:xs,end:'nan'}; ts.push(k); xs.push(x.slice()); if(o.box&&!inBox(x,o.box)) return {t:ts,x:xs,end:'out'}; }
    return {t:ts,x:xs,end:'done'};
  }
  const inBox=(x,b)=>{ for(let i=0;i<x.length;i++){ if(x[i]<b[i][0]||x[i]>b[i][1]) return false; } return true; };
  function simulate(sys,x0,T,o={}){ return sys.discrete?iterateMap(sys,x0,Math.round(T),o):integrate(sys,x0,T,o); }

  /* ---------- Jacobian, equilibria, stability ---------- */
  function jacobian(fn, x, n){
    const J=[...Array(n)].map(()=>new Array(n).fill(NaN)), a=new Float64Array(n), b=new Float64Array(n), x1=Array.from(x), x2=Array.from(x);
    for(let j=0;j<n;j++){
      const h=1e-6*Math.max(1e-3,Math.abs(x[j]));
      x1[j]=x[j]+h; x2[j]=x[j]-h; fn(x1,a); fn(x2,b);
      let ok=true; for(let i=0;i<n;i++) if(!isFinite(a[i])||!isFinite(b[i])) ok=false;
      if(ok) for(let i=0;i<n;i++) J[i][j]=(a[i]-b[i])/(2*h);
      else { const c=new Float64Array(n); fn(x,c); if(c.every(isFinite)){ const useA=Array.from(a).every(isFinite); for(let i=0;i<n;i++) J[i][j]=useA?(a[i]-c[i])/h:(c[i]-b[i])/h; } }
      x1[j]=x2[j]=x[j];
    }
    return J;
  }
  function newton(fn, x0, n, it=60){
    const x=Array.from(x0), g=new Float64Array(n);
    for(let k=0;k<it;k++){
      fn(x,g); if(!g.every(isFinite)) return null;
      const J=jacobian(fn,x,n); let dx;
      if(n===1){ if(!isFinite(J[0][0])||J[0][0]===0) return null; dx=[g[0]/J[0][0]]; }
      else { const [[a,b],[c,d]]=J, det=a*d-b*c; if(!isFinite(det)||Math.abs(det)<1e-300) return null; dx=[(d*g[0]-b*g[1])/det,(-c*g[0]+a*g[1])/det]; }
      let lam=1, ok=false;
      for(let ls=0;ls<12;ls++){ const y=x.map((v,i)=>v-lam*dx[i]); const gy=new Float64Array(n); fn(y,gy); if(gy.every(isFinite)){ for(let i=0;i<n;i++) x[i]=y[i]; ok=true; break; } lam*=0.5; }
      if(!ok) return null;
      if(dx.every((d,i)=>Math.abs(d)<=1e-12*(1+Math.abs(x[i])))) { fn(x,g); return g.every(v=>Math.abs(v)<1e-6)?x:null; }
    }
    fn(x,g); return g.every(v=>Math.abs(v)<1e-8)?x:null;
  }
  function findEquilibria(sys, win, o={}){
    const n=sys.dim, fn=sys.field, out=[];
    const span=win.map(w=>w[1]-w[0]);
    const pad=o.pad??0.04;
    const inside=x=>x.every((v,i)=>v>=win[i][0]-pad*span[i]&&v<=win[i][1]+pad*span[i]);
    const add=x=>{ if(!x||!inside(x)) return; if(out.some(e=>e.x.every((v,i)=>Math.abs(v-x[i])<1e-5*span[i]))) return; out.push({x}); };
    const g=new Float64Array(1);
    if(n===1){
      const N=o.N||500, a=win[0][0]-pad*span[0], b=win[0][1]+pad*span[0];
      const val=x=>{ fn([x],g); return g[0]; };
      let xp=a, vp=val(a);
      for(const c of [win[0][0],win[0][1],0]){ const v=val(c); if(isFinite(v)&&Math.abs(v)<1e-12) add([c]); }
      for(let k=1;k<=N;k++){
        const xc=a+(b-a)*k/N, vc=val(xc);
        if(vc===0) add([xc]);
        else if(isFinite(vp)&&isFinite(vc)&&vp*vc<0){
          let lo=xp, hi=xc, flo=vp; for(let it=0;it<80;it++){ const mid=(lo+hi)/2, fm=val(mid); if(!isFinite(fm)) break; if(fm*flo<=0) hi=mid; else { lo=mid; flo=fm; } }
          const r=(lo+hi)/2; if(Math.abs(val(r))<1e-6*(1+Math.abs(vp)+Math.abs(vc))) add([r]);
        }
        xp=xc; vp=vc;
      }
    } else {
      const seeds=o.seeds?o.seeds.slice():[]; const G=o.grid||9;
      for(let i=0;i<G;i++) for(let j=0;j<G;j++) seeds.push([win[0][0]+span[0]*(i+0.5)/G, win[1][0]+span[1]*(j+0.5)/G]);
      for(const s of seeds) add(newton(fn,s,2));
    }
    out.forEach(e=>Object.assign(e,classify(sys,e.x)));
    out.sort((p,q)=>p.x[0]-q.x[0]||p.x[1]-q.x[1]);
    return out;
  }
  function classify(sys,x){
    const n=sys.dim, J=jacobian(sys.f,x,n); // f: derivative (cont.) or map (disc.)
    const bad=J.flat().some(v=>!isFinite(v));
    if(bad) return {J,eig:[],type:'singular',stable:false,label:'Singular point'};
    if(n===1){
      const l=J[0][0], eig=[{re:l,im:0}];
      if(!sys.discrete){ if(Math.abs(l)<1e-9) return {J,eig,type:'nonhyperbolic',stable:null,label:'Non-hyperbolic'}; return l<0?{J,eig,type:'stable',stable:true,label:'Stable'}:{J,eig,type:'unstable',stable:false,label:'Unstable'}; }
      const a=Math.abs(l);
      if(Math.abs(a-1)<1e-7) return {J,eig,type:'nonhyperbolic',stable:null,label:l<0?'Flip point (λ = −1)':'Fold point (λ = 1)'};
      if(a<1) return {J,eig,type:'stable',stable:true,label:l<0?'Stable, oscillating':'Stable, monotone'};
      return {J,eig,type:'unstable',stable:false,label:l<0?'Unstable, oscillating':'Unstable, monotone'};
    }
    const [[a,b],[c,d]]=J, tr=a+d, det=a*d-b*c, disc=tr*tr-4*det;
    let eig; if(disc>=0){ const s=Math.sqrt(disc); eig=[{re:(tr-s)/2,im:0},{re:(tr+s)/2,im:0}]; } else { const s=Math.sqrt(-disc); eig=[{re:tr/2,im:-s/2},{re:tr/2,im:s/2}]; }
    const info={J,eig,tr,det,disc};
    if(!sys.discrete){
      const sc=Math.abs(a)+Math.abs(b)+Math.abs(c)+Math.abs(d)||1;
      if(Math.abs(det)<1e-10*sc*sc) return {...info,type:'degenerate',stable:null,label:'Degenerate'};
      if(det<0) return {...info,type:'saddle',stable:false,saddle:true,label:'Saddle point'};
      if(Math.abs(tr)<1e-6*Math.sqrt(det)) return {...info,type:'centre',stable:null,label:'Centre'};
      if(disc<0) return tr<0?{...info,type:'sfocus',stable:true,label:'Stable focus'}:{...info,type:'ufocus',stable:false,label:'Unstable focus'};
      return tr<0?{...info,type:'snode',stable:true,label:'Stable node'}:{...info,type:'unode',stable:false,label:'Unstable node'};
    }
    const mods=eig.map(e=>Math.hypot(e.re,e.im)), cx=disc<0;
    const lo=Math.min(...mods), hi=Math.max(...mods);
    if(Math.abs(hi-1)<1e-7) return {...info,type:'nonhyperbolic',stable:null,label:cx?'Neimark–Sacker point':'Non-hyperbolic'};
    if(hi<1) return {...info,type:cx?'sfocus':'snode',stable:true,label:cx?'Stable, spiralling':'Stable node'};
    if(lo>1) return {...info,type:cx?'ufocus':'unode',stable:false,label:cx?'Unstable, spiralling':'Unstable node'};
    return {...info,type:'saddle',stable:false,saddle:true,label:'Saddle point'};
  }
  function eigvec(J,l){ const [[a,b],[c,d]]=J; let v=Math.abs(b)+Math.abs(l-a)>Math.abs(l-d)+Math.abs(c)?[b,l-a]:[l-d,c]; const h=Math.hypot(v[0],v[1])||1; return [v[0]/h,v[1]/h]; }
  // stable/unstable manifolds of a continuous saddle, as polylines with times (arrival time at the saddle for the stable one)
  function manifolds(sys, eq, win, horizon){
    const span=win.map(w=>w[1]-w[0]);
    const box=win.map((w,i)=>[w[0]-0.3*span[i],w[1]+0.3*span[i]]);
    const res={stable:[],unstable:[]};
    const [ls,lu]=eq.eig[0].re<eq.eig[1].re?[eq.eig[0].re,eq.eig[1].re]:[eq.eig[1].re,eq.eig[0].re];
    [['stable',ls,-1],['unstable',lu,1]].forEach(([kind,l,dir])=>{
      let v=eigvec(eq.J,l); const vs=[v[0]/span[0],v[1]/span[1]]; const h=Math.hypot(...vs); v=[v[0]/h,v[1]/h];
      const eps=2e-5;
      for(const sgn of [1,-1]){
        const x0=[eq.x[0]+sgn*eps*v[0]*span[0], eq.x[1]+sgn*eps*v[1]*span[1]];
        const T=Math.max(horizon*4, 40/Math.max(1e-6,Math.abs(l)));
        const tr=integrate(sys,x0,dir*T,{scale:span,box,hmax:T/400,maxSteps:4000});
        res[kind].push(tr);
      }
    });
    return res;
  }

  /* ---------- nullclines (marching squares) ---------- */
  function contours(sys, win, nx, ny){
    const fn=sys.field, out=[[],[]], g=new Float64Array(2);
    const V0=new Float64Array((nx+1)*(ny+1)), V1=new Float64Array((nx+1)*(ny+1));
    const X=k=>win[0][0]+(win[0][1]-win[0][0])*k/nx, Y=k=>win[1][0]+(win[1][1]-win[1][0])*k/ny;
    for(let j=0;j<=ny;j++) for(let i=0;i<=nx;i++){ fn([X(i),Y(j)],g); V0[j*(nx+1)+i]=g[0]; V1[j*(nx+1)+i]=g[1]; }
    [V0,V1].forEach((V,c)=>{
      const seg=out[c];
      for(let j=0;j<ny;j++) for(let i=0;i<nx;i++){
        const a=V[j*(nx+1)+i], b=V[j*(nx+1)+i+1], cc=V[(j+1)*(nx+1)+i+1], d=V[(j+1)*(nx+1)+i];
        if(!(isFinite(a)&&isFinite(b)&&isFinite(cc)&&isFinite(d))) continue;
        const idx=(a>0?1:0)|(b>0?2:0)|(cc>0?4:0)|(d>0?8:0); if(idx===0||idx===15) continue;
        const x0=X(i),x1=X(i+1),y0=Y(j),y1=Y(j+1);
        const e=[ // bottom,right,top,left
          ()=>[x0+(x1-x0)*a/(a-b),y0], ()=>[x1,y0+(y1-y0)*b/(b-cc)], ()=>[x0+(x1-x0)*d/(d-cc),y1], ()=>[x0,y0+(y1-y0)*a/(a-d)]];
        const T={1:[[0,3]],2:[[0,1]],3:[[1,3]],4:[[1,2]],5:[[0,1],[2,3]],6:[[0,2]],7:[[2,3]],8:[[2,3]],9:[[0,2]],10:[[0,3],[1,2]],11:[[1,2]],12:[[1,3]],13:[[0,1]],14:[[0,3]]}[idx];
        let pairs=T;
        if((idx===5||idx===10)&&(a+b+cc+d)<=0) pairs=idx===5?[[0,3],[1,2]]:[[0,1],[2,3]];
        // reject jumps across poles
        const mx=Math.max(Math.abs(a),Math.abs(b),Math.abs(cc),Math.abs(d)), mn=Math.min(Math.abs(a),Math.abs(b),Math.abs(cc),Math.abs(d));
        if(mx>1e8*(mn+1e-12)&&mx>1e6) continue;
        for(const [p,q] of pairs){ const P=e[p](),Q=e[q](); seg.push(P[0],P[1],Q[0],Q[1]); }
      }
    });
    return out;
  }

  return {parse,compile,parseModel,makeSystem,integrate,iterateMap,simulate,findEquilibria,classify,manifolds,contours,jacobian,nameHTML,GREEK};
})();
if(typeof module!=='undefined') module.exports=Engine;
