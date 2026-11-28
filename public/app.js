/* Alamb'hic — interface. Le serveur calcule les taux et les titres ; le mode démo calcule localement. */
"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const {PRESETS,MIN,fmt}=YD;
const hm=t=>new Date(t).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
const ls={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const COLORS=["#f7941d","#5ab0ff","#5bc88a","#e879f9","#f2c94c","#ff7a6e","#7dd3fc","#c4b5fd","#fda4af","#a3e635"];

/* état */
const S={screen:"boot",htab:"moi",user:null,me:null,code:null,snap:null,tab:"moi",cfg:{},week:null,ws:null,wsTry:0,err:"",authMode:"login"};
let noAdd=false, ago=0, feedUnread=0, seen=new Set(), bootT=Date.now(), my={};
let demo=false, demoStart=0, demoT=0, demoSeen=new Set(), demoTimer=null, demoPlayers={};
const NOW=()=>demo?demoT:Date.now();

/* API */
async function api(method,url,body){
  const r=await fetch(url,{method,headers:body?{"Content-Type":"application/json"}:{},body:body?JSON.stringify(body):undefined,credentials:"same-origin"});
  let data={}; try{data=await r.json()}catch(e){}
  if(!r.ok){const e=new Error(data.error||"Erreur réseau. Vérifiez votre connexion.");e.status=r.status;throw e}
  return data;
}
const profileReady=u=>u&&u.pseudo&&u.age>=18&&u.height&&u.weight;

/* liste des joueurs prête à afficher */
function compute(){
  const now=NOW();
  if(demo){
    const list=Object.values(demoPlayers).sort((a,b)=>a.joined-b.joined);
    list.forEach((p,i)=>{p.color=COLORS[i%COLORS.length];p.sim=YD.simulate(p,now);p.ev=YD.events(p,p.sim,now);p.score=YD.scoreOf(p.ev)});
    return {now,list,log:[]};
  }
  const list=(S.snap?.members||[]).map((m,i)=>({...m,color:COLORS[i%COLORS.length]}));
  return {now,list,log:S.snap?.log||[]};
}

function stateOf(b,cap){
  if(b>=1.5) return ["Alerte",`var(--care)`];
  if(b>=cap) return ["Au-dessus du plafond","var(--bad)"];
  if(b>=0.5) return ["Interdit de conduire","var(--warn)"];
  if(b>=0.2) return ["Pompette","var(--accent)"];
  return ["Sobre","var(--ok)"];
}

/* Lieu de la session : sélecteur avec favoris ; repris par l'historique, les groupes et les notifications des potes */
const PIN=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>`;
async function loadPlace(){ try{ S.place=await api("GET","/api/me/place") }catch(e){} }
/* position des favoris, gardée seulement sur ce téléphone (jamais envoyée) : pour proposer « Chez moi » quand on y revient */
const geoFavs=()=>ls.get("yd_placegeo",{});
const fmtD=d=>d<1000?`${Math.round(d/10)*10||10} m`:`${(d/1000).toFixed(1).replace(".",",")} km`;
function distM(a,b,c,d){ const R=6371e3,r=Math.PI/180,x=(c-a)*r,y=(d-b)*r,h=Math.sin(x/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(y/2)**2; return 2*R*Math.asin(Math.sqrt(h)) }
function favHere(pos){ if(!pos) return null; const G=geoFavs(); let best=null;
  for(const f of (S.place?.places||[])){ const g=G[f.toLowerCase()]; if(!g) continue; const d=distM(pos.lat,pos.lon,g[0],g[1]); if(d<=Math.max(120,pos.acc||0)&&(!best||d<best.d)) best={name:f,d} }
  return best }
function locate(silent){
  if(!navigator.geolocation){ if(!silent) S.near={err:"La localisation n'est pas disponible sur cet appareil."}; render(); return }
  S.near={busy:1}; render();
  navigator.geolocation.getCurrentPosition(async p=>{
    const pos={lat:p.coords.latitude,lon:p.coords.longitude,acc:Math.round(p.coords.accuracy||0),t:Date.now()}; S.pos=pos;
    try{ const r=await api("GET",`/api/places/near?lat=${pos.lat.toFixed(5)}&lon=${pos.lon.toFixed(5)}`); S.near={list:r.places,acc:pos.acc} }
    catch(e){ S.near={err:e.message,list:[]} }
    render();
  },e=>{ S.near=silent?null:{err:e.code===1?"Localisation refusée : autorisez-la dans les réglages du navigateur, ou choisissez un favori.":"Position introuvable pour l'instant. Choisissez un favori ou tapez le lieu."}; render() },
  {enableHighAccuracy:true,timeout:12000,maximumAge:60000});
}
function viewPlace(){
  const P=S.place; if(!P) return "";
  const head=`<button class="placebtn${P.place?" set":""}" id="placeBtn" aria-expanded="${!!S.placeOpen}">${PIN}${P.place?`<span data-noi18n>${esc(P.place)}</span>`:"<span>Où êtes-vous ?</span>"}<small>${S.placeOpen?"Fermer":P.place?"Changer":"Indiquer le lieu"}</small></button>`;
  if(!S.placeOpen) return head;
  const N=S.near, here=favHere(S.pos&&Date.now()-S.pos.t<10*MIN?S.pos:null);
  const favs=P.places.some(f=>f.toLowerCase()==="chez moi")?P.places:[...P.places,"Chez moi"];
  return head+`<div class="card placecard">
   ${here&&P.place!==here.name?`<button class="phere" data-plname="${esc(here.name)}">${PIN}<span>Vous êtes <b data-noi18n>${esc(here.name)}</b> ?</span><small>Oui</small></button>`:""}
   <button class="btn ghost small" id="placeNear" ${N&&N.busy?"disabled":""}>${N&&N.busy?"Recherche autour de vous…":"Autour de moi : bars, restaurants…"}</button>
   ${N&&N.err?`<span class="muted" style="font-size:13px">${esc(N.err)}</span>`:""}
   ${N&&N.list?(N.list.length?`<div class="plist">${N.list.map((x,i)=>`<button data-pn="${i}"><b data-noi18n>${esc(x.name)}</b><span>${esc(x.kind)} · ${fmtD(x.d)}</span></button>`).join("")}</div>${N.acc>150?`<span class="muted" style="font-size:12px">Position approximative (± ${fmtD(N.acc)}) : vérifiez le lieu.</span>`:""}`:`<span class="muted" style="font-size:13px">Aucun bar ni restaurant connu tout près. Lieu privé ? Choisissez « Chez moi » ou tapez-le.</span>`):""}
   <span class="label">Favoris${S.placeEdit?" · touchez × pour retirer":""}</span><div class="pfavs">${favs.map(f=>{ const i=P.places.indexOf(f); return `<span class="pfav${P.place===f?" on":""}"><button data-plname="${esc(f)}" data-noi18n>${esc(f)}</button>${S.placeEdit&&i>=0?`<button class="x" data-plx="${i}" aria-label="Retirer ce favori">×</button>`:""}</span>` }).join("")}</div>
   <div class="row" style="flex-wrap:nowrap"><input id="placeIn" maxlength="40" placeholder="Autre lieu : chez Paul, camping…" style="flex:1;min-width:0"><button class="btn small" id="placeOk">OK</button></div>
   <label class="toggle"><span>Ajouter aux favoris</span><input type="checkbox" id="placeFav" checked></label>
   <div class="row" style="justify-content:space-between">${P.place?`<button class="link" id="placeNone">Aucun lieu</button>`:"<span></span>"}${P.places.length?`<button class="link" id="placeEdit">${S.placeEdit?"Terminé":"Gérer les favoris"}</button>`:""}</div>
   <span class="muted" style="font-size:12px">Le lieu vaut pour la session en cours et les verres des 10 h qui suivent. Vos amis et vos groupes le voient (« Kiki remet le facteur sur le vélo – à La Folie Douce »). Votre position sert seulement à la recherche : elle n'est pas enregistrée ; celle de vos favoris reste sur ce téléphone.</span>
  </div>`;
}
async function setPlace(body,msg){
  try{
    S.place=await api("PUT","/api/me/place",body);
    /* retient la position de ce favori sur le téléphone, si on vient de se localiser */
    if(body.place&&S.pos&&Date.now()-S.pos.t<10*MIN&&S.pos.acc<=200&&S.place.places.includes(body.place)){ const G=geoFavs(); G[body.place.toLowerCase()]=[+S.pos.lat.toFixed(5),+S.pos.lon.toFixed(5)]; ls.set("yd_placegeo",G) }
    S.placeOpen=false; S.placeEdit=false; S.near=null; hubDirty("soirees","groupes"); if(msg) snack(msg,S.place.place||"");
    if(S.screen==="home") loadLive().then(render).catch(render); else render() }
  catch(e){ snack("Lieu non enregistré",e.message,{err:1}) }
}
function bindPlace(){
  const b=$("#placeBtn"); if(!b) return; const on=(id,f)=>{const el=$("#"+id); if(el) el.onclick=f};
  b.onclick=()=>{ S.placeOpen=!S.placeOpen; S.placeEdit=false; S.near=null; render();
    /* localisation déjà autorisée et des favoris situés : on cherche tout de suite, sans rien demander */
    if(S.placeOpen&&navigator.permissions&&Object.keys(geoFavs()).length) navigator.permissions.query({name:"geolocation"}).then(r=>{ if(r.state==="granted"&&S.placeOpen) locate(true) }).catch(()=>{}) };
  on("placeNear",()=>locate(false));
  document.querySelectorAll("[data-pn]").forEach(x=>x.onclick=()=>setPlace({place:S.near.list[+x.dataset.pn].name,fav:$("#placeFav").checked},"Lieu noté"));
  document.querySelectorAll("[data-plname]").forEach(x=>x.onclick=()=>setPlace({place:x.dataset.plname,fav:true},"Lieu noté"));
  document.querySelectorAll("[data-plx]").forEach(x=>x.onclick=()=>{ const favs=S.place.places.filter((_,i)=>i!==+x.dataset.plx); api("PUT","/api/me/place",{favs}).then(r=>{S.place=r;render()}).catch(e=>snack("Favori non retiré",e.message,{err:1})) });
  const ok=()=>{ const v=($("#placeIn").value||"").trim(); if(!v){ flash("Lieu vide","Tapez un nom de lieu ou choisissez un favori."); return } setPlace({place:v,fav:$("#placeFav").checked},"Lieu noté") };
  on("placeOk",ok); const i=$("#placeIn"); if(i) i.onkeydown=e=>{ if(e.key==="Enter") ok() };
  on("placeNone",()=>setPlace({place:""},"Lieu retiré")); on("placeEdit",()=>{ S.placeEdit=!S.placeEdit; render() });
}
function viewMe(p,now){
  const s=p.sim, cap=+my.cap||0.8, [lab,col]=stateOf(s.cur,cap), maxB=Math.max(1.6,cap+0.4);

  const std=(s.grams/10).toFixed(1).replace(".",",");
  const sub=s.peakT?`Pic ${fmt(s.peak)} à ${hm(s.peakT)} · ${std} verres standard`+(s.cur>0&&s.zeroT?` · retour à 0 vers ${hm(s.zeroT)}`:""):"Aucun verre d'alcool pour l'instant";
  const mine=(my.drinks||[]).slice().sort((a,b)=>b.t-a.t);
  const titles=p.ev.filter(e=>e.kind!=="info").sort((a,b)=>b.t-a.t), cur=titles[0];
  return `${mealQuestion()}<section>
  <div class="card" style="display:flex;flex-direction:column;gap:12px">
    <div class="row" style="justify-content:space-between"><span class="label">${esc(my.pseudo)} · taux estimé</span><span class="state" style="color:${col}">${lab}</span></div>
    <div class="row merow"><div class="avcol">${alertBtn()}${avx(p,88,lab,"me")}<span class="curt ${cur?cur.kind:""}" title="Titre actuel, visible par vos potes">${cur?esc(cur.title):"Pas encore de titre"}</span></div>${gauge(s.cur,maxB,cap,col,s.cur<s.prev-0.004)}<div class="bac">${fmt(s.cur)}<small>g/L</small></div></div>
    <div class="muted" style="font-size:13px">${sub}. Plafond perso : ${fmt(cap)} g/L.</div>
  </div></section>${S.alertOpen&&S.cal&&S.cal.alerts.length&&!demo?alertsCard(true):""}
  <section><h2>${my.sam?"Sam boit de l'eau":"Ajouter un verre"}</h2>
  ${demo?"":viewPlace()}
  <div class="field"><span class="label">Bu</span><div class="seg" id="ago">${[[0,"Maintenant"],[15,"il y a 15 min"],[30,"30 min"],[60,"1 h"]].map(([v,l])=>`<button data-v="${v}" aria-pressed="${ago===v}">${l}</button>`).join("")}</div></div>
  ${demo||S.screen!=="party"?"":`<label class="toggle"><span>Je suis Sam ce soir (zéro alcool)</span><input type="checkbox" id="samT" ${my.sam?"checked":""}></label>`}
  <div class="drinks">${PRESETS.filter(d=>!my.sam||d.water).map((d,i)=>`<button class="drink${d.water?" water":""}${pend["p"+PRESETS.indexOf(d)]?" "+pend["p"+PRESETS.indexOf(d)]:""}" data-p="${PRESETS.indexOf(d)}" ${pend["p"+PRESETS.indexOf(d)]==="sending"?'aria-busy="true"':""}><b>${d.l}</b><span>${d.d}</span></button>`).join("")}</div>
  ${my.sam?"":`<div class="row"><div class="field" style="flex:1;min-width:90px"><span class="label">Volume (cl)</span><input id="cml" type="number" inputmode="decimal" min="1" max="100" placeholder="15"></div><div class="field" style="flex:1;min-width:90px"><span class="label">Degré (%)</span><input id="cabv" type="number" inputmode="decimal" min="0" max="80" placeholder="13"></div><button class="btn${pend.perso?" "+pend.perso:""}" id="cadd" style="align-self:flex-end">${pend.perso==="ok"?"✓ Noté":pend.perso==="sending"?"Envoi…":"Ajouter"}</button></div>`}
  </section>
  ${viewMeals()}
  ${titles.length>1?`<section><details class="hq"><summary>Titres de la session (${titles.length})</summary><div class="badges" style="margin-top:8px">${titles.map(e=>`<span class="badge ${e.kind}">${esc(e.title)} · ${hm(e.t)}</span>`).join("")}</div></details></section>`:""}
  <section><h2>Mes verres</h2>${mine.length?`<div class="list">${mine.map(d=>`<div class="item"><span class="t">${hm(d.t)}</span><div class="grow"><b>${esc(d.l)}</b> <span class="muted">${d.ml/10} cl · ${String(d.abv).replace(".",",")} %</span></div><button class="x" data-del="${d.id}" aria-label="Supprimer ce verre">×</button></div>`).join("")}</div>`:`<p class="muted">Touchez une boisson ci-dessus pour l'enregistrer. Pensez à l'eau : trois verres débloquent le Chameau.</p>`}</section>${viewMealPop()}`;
}
/* Courbes sur une fenêtre : soirée (début → fin prévus), session (premier verre → retour à 0), groupe (48 h). */
/* Courbes sur une fenêtre : soirée (début → fin prévus), session (premier verre → retour à 0), groupe (48 h).
   Zoom et déplacement aux doigts : pincer pour zoomer, glisser pour se déplacer, double-toucher pour revenir à la vue entière.
   La vue choisie est gardée quand l'écran se redessine (CHV). */
const CH={}, CHV={};
function viewChart(list,now,o={}){
  const title=o.title||"Courbes de la soirée";
  const withD=list.filter(p=>p.sim.pts.some(x=>x[1]>0&&(o.t0==null||x[0]>=o.t0)&&(o.t1==null||x[0]<=o.t1)));
  if(!withD.length) return `<section><h2>${esc(title)}</h2><p class="muted">${o.empty||"Les courbes apparaissent dès le premier verre d'alcool enregistré."}</p></section>`;
  const t0=o.t0!=null?o.t0:Math.min(...withD.map(p=>p.sim.pts[0][0]));
  let t1=o.t1!=null?o.t1:Math.min(Math.max(now+30*MIN,...withD.map(p=>p.sim.zeroT||now)),now+10*3600e3);
  const ymax=Math.max(1.0,...withD.map(p=>Math.max(0,...p.sim.pts.filter(x=>x[0]>=t0&&x[0]<=t1).map(x=>x[1]))))*1.1;
  const W=Math.max(320,($("#app").clientWidth||340)), H=o.height||260;
  const id=(o.key||title)+"|"+Math.round(t0/MIN);
  CH[id]={t0,t1,now,ymax,W,H,series:withD.map(p=>({color:p.color,pts:p.sim.pts,cur:p.sim.cur}))};
  const v=CHV[id];
  return `<section><h2>${esc(title)}</h2><div class="card" style="padding:12px 8px"><div class="chart zoomable" data-ch="${esc(id)}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${chartBody(CH[id],v?v.a:t0,v?v.b:t1)}</svg><span class="zhint"${v?"":" hidden"}><button type="button" class="link" data-zreset>Vue entière</button></span></div></div>
  ${list.length>1||o.legend?`<div class="legend">${(o.legend?list:withD).map(p=>`<span><i class="dot" style="background:${p.color}"></i>${o.legend?o.legend(p):`${esc(p.pseudo)} · ${fmt(p.sim.cur)}`}</span>`).join("")}</div>`:""}
  <p class="muted" style="font-size:13px">${o.note||"Trait plein : taux estimé jusqu'à maintenant. Pointillés : redescente prévue si plus personne ne boit."} Pincez pour zoomer, glissez pour vous déplacer.</p></section>`;
}
/* dessin de la courbe entre les instants a et b */
function chartBody(c,a,b){
  const {now,ymax,W,H}=c, L=34, R=10, T=12, B=26, span=b-a;
  const X=t=>L+(t-a)/span*(W-L-R), Y=v=>T+(1-v/ymax)*(H-T-B);
  let g=`<defs><clipPath id="clp${Math.round(a)%100000}"><rect x="${L}" y="0" width="${W-L-R}" height="${H}"/></clipPath></defs>`;
  for(const [v,col,lab] of [[0.5,"var(--warn)","0,5"],[0.8,"var(--accent)","0,8"],[1.2,"var(--bad)","1,2"]]) if(v<ymax) g+=`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${col}" stroke-opacity=".45" stroke-dasharray="3 4"/><text x="${L-6}" y="${Y(v)+4}" text-anchor="end" fill="var(--muted)" font-size="11">${lab}</text>`;
  g+=`<line x1="${L}" x2="${W-R}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--line)"/><text x="${L-6}" y="${Y(0)+4}" text-anchor="end" fill="var(--muted)" font-size="11">0</text>`;
  /* graduations : de 10 min à 6 h selon le zoom */
  const steps=[10,15,30,60,120,180,360].map(m=>m*MIN), st=steps.find(x=>span/x<=7)||6*3600e3;
  let th=Math.ceil(a/st)*st; if(st>=3600e3){ const d=new Date(a); d.setMinutes(0,0,0); th=d.getTime(); while(th<a||new Date(th).getHours()%(st/3600e3)) th+=3600e3 }
  for(;th<b;th+=st){ const dd=new Date(th), midnight=dd.getHours()===0&&dd.getMinutes()===0;
    const lab=midnight&&span>20*3600e3?dd.toLocaleDateString("fr-FR",{weekday:"short"}):st<3600e3?dd.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}):dd.getHours()+"h";
    if(midnight) g+=`<line x1="${X(th)}" x2="${X(th)}" y1="${T}" y2="${Y(0)}" stroke="var(--line)" stroke-dasharray="2 4"/>`;
    g+=`<text x="${X(th)}" y="${H-8}" text-anchor="middle" fill="var(--muted)" font-size="11">${lab}</text>` }
  const live=now>=a&&now<=b;
  g+=`<g clip-path="url(#clp${Math.round(a)%100000})">`;
  if(live) g+=`<line x1="${X(now)}" x2="${X(now)}" y1="${T}" y2="${Y(0)}" stroke="var(--fg)" stroke-opacity=".35"/>`;
  const every=span>12*3600e3?3:1;   /* moins de points en vue large */
  for(const p of c.series){
    const pts=p.pts.filter((x,i)=>(i%every===0||Math.abs(x[0]-now)<=MIN)&&x[0]>=a-30*MIN&&x[0]<=b+30*MIN), past=pts.filter(x=>x[0]<=now), fut=pts.filter(x=>x[0]>=now);
    const d=arr=>arr.map((x,i)=>(i?"L":"M")+X(x[0]).toFixed(1)+" "+Y(x[1]).toFixed(1)).join("");
    if(past.length>1) g+=`<path d="${d(past)}" fill="none" stroke="${p.color}" stroke-width="2.5" stroke-linejoin="round"/>`;
    if(fut.length>1) g+=`<path d="${d(fut)}" fill="none" stroke="${p.color}" stroke-width="2" stroke-dasharray="4 5" stroke-opacity=".7"/>`;
    if(live) g+=`<circle cx="${X(now)}" cy="${Y(p.cur)}" r="4.5" fill="${p.color}" stroke="var(--bg)" stroke-width="2"/>`;
  }
  g+=`</g>`;
  if(live) g+=`<text x="${Math.min(X(now)+4,W-R-60)}" y="${T+10}" fill="var(--muted)" font-size="11">maintenant</text>`;
  return g;
}
/* gestes : 2 doigts = zoom autour du milieu, 1 doigt = déplacement (horizontal ; le défilement vertical de la page reste libre) */
function bindCharts(){
  document.querySelectorAll(".chart.zoomable").forEach(el=>{
    const id=el.dataset.ch, c=CH[id]; if(!c||el._z) return; el._z=1;
    const svg=el.querySelector("svg"), hint=el.querySelector(".zhint"), full=c.t1-c.t0, minSpan=Math.min(full,20*MIN);
    let v=CHV[id]||{a:c.t0,b:c.t1}; const P=new Map(); let g0=null, lastTap=0, raf=0;
    const clamp=(a,b)=>{ let s=Math.min(full,Math.max(minSpan,b-a)); if(a<c.t0){a=c.t0} if(a+s>c.t1){a=c.t1-s} return {a,b:a+s} };
    const draw=()=>{ raf=0; svg.innerHTML=chartBody(c,v.a,v.b); const zoomed=v.b-v.a<full-1000; if(zoomed) CHV[id]=v; else delete CHV[id]; hint.hidden=!zoomed };
    const sched=()=>{ if(!raf) raf=requestAnimationFrame(draw) };
    const tAt=x=>{ const r=svg.getBoundingClientRect(), L=34/c.W*r.width, w=r.width-(44/c.W)*r.width; return v.a+Math.min(1,Math.max(0,(x-r.left-L)/w))*(v.b-v.a) };
    const start=()=>{ const pts=[...P.values()];
      g0=pts.length>=2?{two:1,d:Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y)||1,mid:tAt((pts[0].x+pts[1].x)/2),v:{...v}}:{two:0,x:pts[0].x,y:pts[0].y,v:{...v},moved:0} };
    el.addEventListener("pointerdown",e=>{ if(e.target.closest("[data-zreset]")) return; P.set(e.pointerId,{x:e.clientX,y:e.clientY}); try{el.setPointerCapture(e.pointerId)}catch(_){}; start() });
    el.addEventListener("pointermove",e=>{ if(!P.has(e.pointerId)||!g0) return; P.set(e.pointerId,{x:e.clientX,y:e.clientY}); const pts=[...P.values()];
      if(g0.two&&pts.length>=2){ const d=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y)||1, k=g0.d/d, s=(g0.v.b-g0.v.a)*k, f=(g0.mid-g0.v.a)/(g0.v.b-g0.v.a);
        v=clamp(g0.mid-f*s,g0.mid-f*s+s); sched(); e.preventDefault() }
      else if(!g0.two){ const dx=e.clientX-g0.x, dy=e.clientY-g0.y; if(!g0.moved&&Math.abs(dx)<6) return; if(!g0.moved&&Math.abs(dy)>Math.abs(dx)){ P.delete(e.pointerId); g0=null; return }
        g0.moved=1; const r=svg.getBoundingClientRect(), dt=-dx/(r.width*0.88)*(g0.v.b-g0.v.a); v=clamp(g0.v.a+dt,g0.v.b+dt); sched(); e.preventDefault() } });
    const end=e=>{ if(!P.has(e.pointerId)) return; P.delete(e.pointerId);
      if(g0&&!g0.two&&!g0.moved&&e.type==="pointerup"){ const t=Date.now(); if(t-lastTap<320){ v={a:c.t0,b:c.t1}; sched(); lastTap=0 } else lastTap=t }
      if(P.size) start(); else g0=null };
    el.addEventListener("pointerup",end); el.addEventListener("pointercancel",end);
    el.addEventListener("wheel",e=>{ if(!e.ctrlKey&&!e.shiftKey&&Math.abs(e.deltaX)<Math.abs(e.deltaY)&&!e.altKey) return; e.preventDefault();
      if(e.shiftKey||Math.abs(e.deltaX)>Math.abs(e.deltaY)){ const dt=(e.deltaX||e.deltaY)/600*(v.b-v.a); v=clamp(v.a+dt,v.b+dt) }
      else{ const m=tAt(e.clientX), k=Math.exp(e.deltaY/300), s=(v.b-v.a)*k, f=(m-v.a)/(v.b-v.a); v=clamp(m-f*s,m-f*s+s) } sched() },{passive:false});
    const rb=el.querySelector("[data-zreset]"); if(rb) rb.onclick=()=>{ v={a:c.t0,b:c.t1}; sched() };
  });
}
/* ---------- animations ---------- */
const REDUCE=(()=>{try{return matchMedia("(prefers-reduced-motion: reduce)").matches}catch(e){return false}})();
/* Jauge : alambic qui se remplit de potion (dessin dans avatar.js), sans graduation (indicatif). */
let gaugePrev=null;
function gauge(cur,maxB,cap,col,down){
  const r=Math.max(0,Math.min(1,cur/maxB)), from=gaugePrev===null?r:gaugePrev; gaugePrev=r;
  return `<div class="gauge alam">${alambic(r,from,down)}</div>`;
}
function animateGauge(){
  document.querySelectorAll(".gauge .alq").forEach(q=>{ const go=()=>{q.style.transform=`translateY(${q.dataset.to}px)`};
    if(REDUCE) return go(); requestAnimationFrame(()=>requestAnimationFrame(go)) });
}
/* Une goutte de potion vole du bouton touché jusqu'à l'entrée du tuyau. */
function flyDrop(rect){
  if(REDUCE||!rect) return;
  const go=()=>{ const g=document.querySelector(".gauge svg"); if(!g) return; const t=g.getBoundingClientRect();
    const x0=rect.left+rect.width/2, y0=rect.top+rect.height/2, x1=t.left+t.width*0.5, y1=t.top-2;
    const d=document.createElement("div"); d.className="dropfx"; document.body.appendChild(d);
    const mx=(x0+x1)/2, my=Math.min(y0,y1)-90;
    const a=d.animate([{transform:`translate(${x0}px,${y0}px) scale(.6)`,opacity:0},{transform:`translate(${mx}px,${my}px) scale(1)`,opacity:1,offset:.45},{transform:`translate(${x1}px,${y1}px) scale(.8)`,opacity:1}],{duration:700,easing:"cubic-bezier(.4,0,.2,1)"});
    a.onfinish=()=>{ d.remove(); const s=document.createElement("div"); s.className="splashfx"; s.style.left=x1+"px"; s.style.top=y1+"px"; document.body.appendChild(s); setTimeout(()=>s.remove(),600) } };
  setTimeout(go,30);
}
/* Fiole qui se remplit, à la place de « Chargement… ». */
const loader=t=>`<div class="loader"><svg viewBox="0 0 40 48" aria-hidden="true"><path d="M15 4h10M17 4v12L7 34a8 8 0 0 0 7 12h12a8 8 0 0 0 7-12L23 16V4" class="lf"/><clipPath id="lc"><path d="M17 16L7 34a8 8 0 0 0 7 12h12a8 8 0 0 0 7-12L23 16z"/></clipPath><g clip-path="url(#lc)"><rect x="0" y="20" width="40" height="30" class="ll"/></g></svg><span>${t}</span></div>`;
let trendPrev={}, statePrev={};
/* Avatar vivant : il se balance d'autant plus que le taux est haut ; à chaque changement de stade (seuils fixes, pas le plafond perso), il sursaute et annonce son nouveau stade. */
function avx(p,size,_lab,key){
  key=key||p.id; const lab=AV_NAMES[avStage(Math.max(0,p.sim?.cur||0))]; const old=statePrev[key], now=Date.now();
  const at=old?(old.lab!==lab?now:old.at):0, el=now-at, changed=!!at&&el<2200&&!REDUCE;   // l'animation continue au fil des rafraîchissements
  const sw=Math.min(1.4,Math.max(0,p.sim?.cur||0))*4.5;
  return `<span class="avw${changed?" avchg":""}${sw<0.4?" still":""}" style="--sw:${sw.toFixed(2)}deg;--el:-${el}ms" data-st="${esc(key)}|${at}|${esc(lab)}">${avatar(p,size)}${changed?`<em class="avbub">${esc(lab)}</em>`:""}</span>`;
}

/* Potes en direct : taux, tendance façon bourse, mini-courbe, dernier titre */
const valAt=(pts,t)=>{let v=0;for(const [x,b] of pts||[]){if(x<=t)v=b;else break}return v};
function trendOf(p,now){
  const cur=p.sim.cur, past=valAt(p.sim.pts,now-15*MIN), rate=(cur-past)*4;   // g/L par heure, sur les 15 dernières minutes
  if(cur<0.01&&past<0.01) return {k:"flat",txt:"stable",rate:0};
  if(Math.abs(rate)<0.02) return {k:"flat",txt:"stable",rate};
  return rate>0?{k:"up",txt:`+${fmt(rate)}/h`,rate}:{k:"down",txt:`−${fmt(-rate)}/h`,rate};
}
function spark(p,now,color){
  const t0=now-120*MIN, t1=now+60*MIN, W=120, H=36, pts=(p.sim.pts||[]).filter(x=>x[0]>=t0-5*MIN&&x[0]<=t1);
  const mx=Math.max(0.6,...pts.map(x=>x[1]))*1.1, X=t=>((t-t0)/(t1-t0))*W, Y=b=>H-2-(b/mx)*(H-4);
  const path=a=>a.map((x,i)=>(i?"L":"M")+X(Math.max(t0,x[0])).toFixed(1)+" "+Y(x[1]).toFixed(1)).join("");
  const past=pts.filter(x=>x[0]<=now), fut=pts.filter(x=>x[0]>=now);
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <line x1="${X(now)}" x2="${X(now)}" y1="0" y2="${H}" stroke="var(--line)"/>
    ${past.length>1?`<path d="${path(past)}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round"/>`:""}
    ${fut.length>1?`<path d="${path(fut)}" fill="none" stroke="${color}" stroke-width="1.6" stroke-dasharray="3 4" opacity=".6"/>`:""}
    <circle cx="${X(now)}" cy="${Y(p.sim.cur)}" r="3" fill="${color}"/></svg>`;
}
function viewRank(list,now){
  const live=S.rankMode!=="points";
  const seg=`<div class="seg" id="rankSeg" style="margin-bottom:4px"><button data-rm="live" aria-pressed="${live}">En direct</button><button data-rm="points" aria-pressed="${!live}">Points</button></div>`;
  if(live){
    const r=list.slice().sort((a,b)=>(b.id===S.me)-(a.id===S.me)||b.sim.cur-a.sim.cur);
    return `<section><h2>Mes potes en direct</h2>${seg}
    <p class="muted" style="font-size:13px;margin:0">Taux estimé et tendance sur les 15 dernières minutes : ▲ ça monte, ▼ ça redescend.</p>
    <div class="live">${r.map(p=>{const [lab,col]=stateOf(p.sim.cur,+p.cap||0.8), tr=trendOf(p,now), last=p.ev.filter(e=>e.kind!=="info").sort((a,b)=>b.t-a.t)[0];
      return `<div class="lcard"><div class="lhead">${avx(p,58,lab)}<div class="lname"><b data-noi18n>${esc(p.pseudo)}</b>${p.id===S.me?'<span class="muted"> (vous)</span>':""}<span class="lstate" style="color:${col}">${lab}</span></div></div>
      <div class="lrow"><span class="lnum" style="color:${col}">${fmt(p.sim.cur)}<small>g/L</small></span><span class="ltr ${tr.k}${trendPrev[p.id]&&trendPrev[p.id]!==tr.k?" chg":""}" data-tk="${p.id}|${tr.k}">${tr.k==="up"?"▲":tr.k==="down"?"▼":"■"} ${tr.txt}</span></div>
      ${spark(p,now,p.color)}
      <div class="ltitle ${last?last.kind:""}">${last?`${esc(last.title)} <span class="muted">· ${hm(last.t)}</span>`:`<span class="muted">Pas encore de titre</span>`}</div></div>`}).join("")}</div></section>`;
  }
  const r=list.slice().sort((a,b)=>b.score-a.score||a.sim.peak-b.sim.peak);
  return `<section><h2>Classement des titres</h2>${seg}<p class="muted" style="font-size:13px">Titre gagné : +10. Titre de honte (plafond, Naufragé, Fusée) : −15. Rester raisonnable rapporte plus que grimper.</p>
  ${r.map((p,i)=>{const [lab,col]=stateOf(p.sim.cur,+p.cap||0.8);const t=p.ev.filter(e=>e.kind!=="info");return `<div class="card player">${avx(p,48,lab,"r"+p.id)}<div><b>${i+1}. ${esc(p.pseudo)}</b>${p.id===S.me?' <span class="muted">(vous)</span>':""}${p.sam?' <span class="badge trophy" style="padding:2px 6px;font-size:11px">Sam</span>':""}</div><div class="num" style="color:${col}">${fmt(p.sim.cur)}</div>
  <div class="meta">${lab} · pic ${fmt(p.sim.peak)} · <span class="score">${p.score>0?"+":""}${p.score} pts</span>${t.length?"<br>"+t.map(e=>esc(e.title)).join(", "):""}</div></div>`}).join("")}</section>`;
}

/* ---------- repas ---------- */
const {MEALS,MEAL_ORDER}=YD;
const SLOTS=[{k:"matin",l:"Petit-déjeuner",h:"08:00",def:"light",from:6,to:10.5},{k:"midi",l:"Déjeuner",h:"12:30",def:"full",from:11.5,to:15},
  {k:"gouter",l:"Goûter",h:"16:30",def:"snack",from:15.5,to:18},{k:"soir",l:"Dîner",h:"20:00",def:"full",from:18.5,to:22.5}];
/* La question « avez-vous mangé ? » ne s'affiche que sur les vrais créneaux de repas (déjeuner 12 h-14 h 30, dîner 19 h 30-22 h). */
const ASK={midi:[12,14.5],soir:[19.5,22]};
const myMeals=()=>demo?(demoPlayers[S.me]?.meals||[]):(S.meals||[]);
/* heure saisie dans le futur (au-delà de 15 min) : refusée plutôt que reportée à la veille */
const futureHM=hmS=>{const [h,m]=hmS.split(":").map(Number);const d=new Date(NOW());d.setHours(h,m,0,0);return d.getTime()>NOW()+15*MIN&&d.getHours()>=6};
const atHM=hmS=>{const [h,m]=hmS.split(":").map(Number);const d=new Date(NOW());d.setHours(h,m,0,0);if(d.getTime()>NOW()+15*MIN)d.setDate(d.getDate()-1);return d.getTime()};
const hourNow=()=>{const d=new Date(NOW());return d.getHours()+d.getMinutes()/60};
function kindSelect(id,val,withNone){return `<select id="${id}">${withNone?`<option value="">Rien</option>`:""}${MEAL_ORDER.map(k=>`<option value="${k}" ${val===k?"selected":""}>${MEALS[k].l}</option>`).join("")}</select>`}
/* Premier verre d'alcool de la session : fenêtre facultative « votre dernier repas ? » (heure et type), que l'on peut passer ou fermer. */
function needMealPop(d){
  if(demo||noAdd||d.water||my.sam) return false;
  if((my.drinks||[]).some(x=>x.abv>0)) return false;                  // pas le premier verre de la session
  if(myMeals().some(m=>m.t>NOW()-5*H_MS)) return false;               // un repas récent est déjà noté
  return NOW()-ls.get("yd_mpop",0)>8*H_MS;                            // déjà demandé il y a moins de 8 h
}
function guessKind(){ const h=hourNow(); const sl=SLOTS.slice().reverse().find(x=>x.from<=h); return sl?sl.def:"light" }
function viewMealPop(){
  const M=S.mealPop; if(!M) return "";
  return `<div class="mpop" role="dialog" aria-modal="true" aria-labelledby="mpTitle"><div class="card mpopc">
   <button class="x mpx" id="mpX" aria-label="Fermer">×</button>
   <span class="label" style="color:var(--accent)">Avant ce premier verre · facultatif</span>
   <h2 id="mpTitle">Votre dernier repas ?</h2>
   <p class="muted" style="margin:0;font-size:13px">Un repas ralentit le passage de l'alcool et baisse le pic : l'estimation sera plus juste.</p>
   <div class="mrow"><b>À</b><input type="time" id="mpT" value="${esc(M.t||"")}" aria-label="Heure du dernier repas">${kindSelect("mpK",M.kind,false)}</div>
   <button class="btn" id="mpOk">Noter le repas et le verre</button>
   <div class="row" style="justify-content:space-between"><button class="link" id="mpNone">Rien mangé depuis ce matin</button><button class="link" id="mpSkip">Passer</button></div>
  </div></div>`;
}
function bindMealPop(){
  const M=S.mealPop; if(!M) return;
  const t=$("#mpT"), k=$("#mpK"); if(t) t.oninput=()=>M.t=t.value; if(k) k.onchange=()=>M.kind=k.value;
  const go=()=>{ ls.set("yd_mpop",NOW()); S.mealPop=null; render(); addDrink(M.d,M.key,M.rect,true) };
  $("#mpX").onclick=go; $("#mpSkip").onclick=go; $("#mpNone").onclick=go;
  $("#mpOk").onclick=()=>run(async()=>{ const v=t.value; if(!v) throw new Error("Indiquez l'heure du repas, ou touchez « Passer »."); if(futureHM(v)) throw new Error("Cette heure n'est pas encore passée.");
    const meal={kind:k.value,t:atHM(v)}; ls.set("yd_mpop",NOW()); S.mealPop=null;
    await addMeals([meal]); addDrink(M.d,M.key,M.rect,true) });
  setTimeout(()=>{ if(t&&!M.t&&!M.focused){ M.focused=1; t.focus() } },50);
}
function mealSlotNow(){
  const h=hourNow(); const sl=SLOTS.find(x=>ASK[x.k]&&h>=ASK[x.k][0]&&h<=ASK[x.k][1]); if(!sl) return null;
  const since=atHM(String(Math.floor(sl.from-1)).padStart(2,"0")+":00");
  if(myMeals().some(m=>m.t>=since)) return null;
  const key=`yd_mq_${new Date(NOW()).toDateString()}_${sl.k}`, until=ls.get(key,0);
  if(until===-1||until>NOW()) return null;
  return {...sl,key};
}
function mealQuestion(){
  if(demo) return ""; const sl=mealSlotNow(); if(!sl) return "";
  return `<section><div class="card mq"><span class="label" style="color:var(--care)">Il est ${hm(NOW())}</span><h2>${sl.k==="soir"?"Avez-vous dîné ?":sl.k==="midi"?"Avez-vous déjeuné ?":"Avez-vous mangé quelque chose ?"}</h2>
  <div class="mrow"><b>Oui, à</b><input type="time" id="mqT" value="" aria-label="Heure du repas" placeholder="${sl.h}">${kindSelect("mqK",sl.def,false)}<button class="btn small" id="mqOk">Valider</button></div>
  <div class="row"><button class="btn ghost small" data-mqno="45">Pas encore</button><button class="btn ghost small" data-mqno="-1">Je ne mangerai pas</button></div></div></section>`;
}
function viewMeals(){
  const ms=myMeals().slice().sort((a,b)=>b.t-a.t);
  return `<section><h2>Mes repas</h2>
  ${ms.length?`<div class="list">${ms.map(m=>`<div class="item"><span class="t">${hm(m.t)}</span><div class="grow"><b>${MEALS[m.kind]?.l||m.kind}</b> <span class="muted">${MEALS[m.kind]?.d||""}</span></div><button class="x" data-mdel="${m.id??m.t}" aria-label="Supprimer ce repas">×</button></div>`).join("")}</div>`:`<p class="muted" style="margin:0">Aucun repas noté ces dernières 24 h : l'alcool est compté à jeun.</p>`}
  <div class="mrow add"><input type="time" id="mAddT" value="" aria-label="Heure du repas">${kindSelect("mAddK","full",false)}<button class="btn small" id="mAdd">Ajouter un repas</button></div></section>`;
}
async function addMeals(list){
  if(demo){ const p=demoPlayers[S.me]; p.meals=[...(p.meals||[]),...list]; render(); return }
  for(const m of list) await api("POST","/api/me/meals",m);
  await api("PUT","/api/me/meals-ok");
  await loadMeals(); await refresh();
}
async function loadMeals(){ if(demo) return; try{ S.meals=(await api("GET","/api/me/meals")).meals }catch(e){} }
function bindMeals(){
  const ok=$("#mealsOk"); if(ok) ok.onclick=()=>run(async()=>{
    const chosen=SLOTS.filter(x=>$("#mk-"+x.k)&&$("#mk-"+x.k).value), miss=chosen.find(x=>!$("#mt-"+x.k).value);
    if(miss) throw new Error(`Indiquez l'heure du ${miss.l.toLowerCase()}.`);
    const fut=chosen.find(x=>futureHM($("#mt-"+x.k).value)); if(fut) throw new Error(`L'heure du ${fut.l.toLowerCase()} n'est pas encore passée.`);
    const list=chosen.map(x=>({kind:$("#mk-"+x.k).value,t:atHM($("#mt-"+x.k).value)}));
    if(list.some(m=>m.t>NOW()+15*MIN)) throw new Error("Un repas ne peut pas être dans le futur.");
    await addMeals(list); flash("Repas enregistrés",list.length?list.map(m=>`${MEALS[m.kind].l} à ${hm(m.t)}`).join(", "):"Aucun repas : l'alcool sera compté à jeun.") });
  const none=$("#mealsNone"); if(none) none.onclick=()=>run(async()=>{ await addMeals([]); });
  const mq=$("#mqOk"); if(mq) mq.onclick=()=>run(async()=>{ const v=$("#mqT").value; if(!v) throw new Error("Indiquez l'heure du repas."); if(futureHM(v)) throw new Error("Cette heure n'est pas encore passée.");
    const t=atHM(v); await addMeals([{kind:$("#mqK").value,t}]); flash("Bon appétit",`${MEALS[$("#mqK")?.value||"full"]?.l||"Repas"} noté à ${hm(t)} : l'alcool passera plus lentement.`) });
  document.querySelectorAll("[data-mqno]").forEach(b=>b.onclick=()=>{ const sl=mealSlotNow(); if(sl) ls.set(sl.key,+b.dataset.mqno<0?-1:NOW()+45*MIN); render() });
  const ad=$("#mAdd"); if(ad) ad.onclick=()=>run(async()=>{ const v=$("#mAddT").value; if(!v) throw new Error("Indiquez l'heure du repas."); if(futureHM(v)) throw new Error("Cette heure n'est pas encore passée."); const t=atHM(v); await addMeals([{kind:$("#mAddK").value,t}]); flash("Repas ajouté",`${MEALS[$("#mAddK")?.value||"full"]?.l||"Repas"} à ${hm(t)}`) });
  document.querySelectorAll("[data-mdel]").forEach(b=>b.onclick=()=>run(async()=>{ const id=+b.dataset.mdel;
    if(demo){const p=demoPlayers[S.me];p.meals=p.meals.filter(m=>m.t!==id);render();return}
    await api("DELETE","/api/me/meals/"+id); await loadMeals(); await refresh() }));
}

/* ---------- notifications ---------- */
function notify(list,log){
  const all=list.flatMap(p=>p.ev).concat(log);
  let fresh=[];
  if(demo){ fresh=all.filter(e=>!demoSeen.has(e.key)); demoSeen=new Set(all.map(e=>e.key)); }
  else{
    for(const e of all){ if(!seen.has(e.key)){ seen.add(e.key); if(Date.now()-bootT>4000 || e.t>bootT-60000) fresh.push(e) } }
    if(fresh.length) ls.set("yd_seen_"+S.code,[...seen].slice(-600));
  }
  fresh.sort((a,b)=>a.t-b.t).slice(demo?-2:-4).forEach(e=>{toast(e); if(S.tab!=="fil") feedUnread++});
  if(fresh.some(e=>e.kind==="care")) buzz([200,100,200]); else if(fresh.length) buzz(60);
}
/* Notifications de la soirée : une seule à la fois, les suivantes attendent leur tour. */
const ICONS={
  trophy:'<path d="M7 4h10v3a5 5 0 0 1-10 0V4z"/><path d="M7 5H4v1a3 3 0 0 0 3 3M17 5h3v1a3 3 0 0 1-3 3M12 12v4M8 20h8M9 16h6"/>',
  shame:'<circle cx="12" cy="12" r="9"/><path d="M8.5 16c1-1.3 2.2-2 3.5-2s2.5.7 3.5 2M9 9.5h.01M15 9.5h.01"/>',
  care:'<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17h.01"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  ok:'<path d="M5 12.5l4.5 4.5L19 7.5"/>'};
const icon=k=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]||ICONS.info}</svg>`;
const TQ=[]; let tShown=null, tTimer=null;
function toast(e){ TQ.push(e); if(TQ.length>6) TQ.splice(0,TQ.length-6); updQ(); pump() }
function updQ(){ const q=document.querySelector("#toasts .tq"); if(q){ q.textContent=TQ.length?`+${TQ.length}`:""; q.hidden=!TQ.length } }
function pump(){
  if(tShown||!TQ.length) return;
  const e=TQ.shift(), k=e.kind||"info", dur=k==="care"?12000:k==="shame"?6500:4500;
  const d=document.createElement("div"); d.className="toast "+k; d.setAttribute("role","status");
  d.innerHTML=`<span class="ti">${icon(k)}${k==="trophy"?'<em class="hic">hic!</em><i class="sp s1"></i><i class="sp s2"></i><i class="sp s3"></i>':""}</span><div class="tx"><b>${esc(e.title)}</b><span>${esc(e.text)}</span></div><span class="tq" hidden></span><button class="tc" aria-label="Fermer">×</button><i class="tp" style="animation-duration:${dur}ms"></i>`;
  I18N.apply(d); const box=$("#toasts"); box.innerHTML=""; box.appendChild(d); tShown=d; updQ();
  requestAnimationFrame(()=>d.classList.add("in"));
  const close=()=>{ if(tShown!==d) return; clearTimeout(tTimer); d.classList.remove("in"); d.classList.add("out"); setTimeout(()=>{ d.remove(); tShown=null; pump() },200) };
  d.onclick=close; tTimer=setTimeout(close,dur);
}
/* Confirmations d'action : un bandeau en bas, avec « Annuler » quand c'est possible. */
let sTimer=null;
function snack(title,text="",opt={}){
  const s=$("#snack"); clearTimeout(sTimer);
  s.className="snack "+(opt.err?"err":"ok");
  s.innerHTML=`<span class="si">${icon(opt.err?"care":"ok")}</span><div class="sx"><b>${esc(title)}</b>${text?`<span>${esc(text)}</span>`:""}</div>${opt.undo?`<button class="su">Annuler</button>`:""}`;
  I18N.apply(s); if(opt.undo) s.querySelector(".su").onclick=()=>{ hideSnack(); opt.undo() };
  s.hidden=false; requestAnimationFrame(()=>s.classList.add("show"));
  sTimer=setTimeout(hideSnack,opt.undo?6000:opt.err?5000:2800);
}
function hideSnack(){ const s=$("#snack"); s.classList.remove("show"); clearTimeout(sTimer); sTimer=setTimeout(()=>{s.hidden=true},250) }
const flash=(title,text,kind="info")=>snack(title,text,{err:kind==="err"||kind==="shame"});
const buzz=p=>{ try{ navigator.vibrate&&navigator.vibrate(p) }catch(_){} };

/* ---------- écrans hors soirée ---------- */
function viewAuth(){
  const reg=S.authMode==="register";
  return `<div class="hero"><h1>On trinque, on se chambre, on se surveille.</h1>
  <p class="muted">Chacun note ses verres. Alamb'hic estime les taux, trace les courbes de tout le groupe et prévient les autres quand quelqu'un débloque un titre ou franchit un seuil.</p></div>
  <section>
  <div class="seg tabs2"><button id="mLogin" aria-pressed="${!reg}">Connexion</button><button id="mReg" aria-pressed="${reg}">Créer un compte</button></div>
  <form id="authForm" class="field" style="gap:10px" novalidate>
   <div class="field"><span class="label">E-mail</span><input id="email" type="email" autocomplete="email" required value="${esc(S.fEmail||"")}"></div>
   <div class="field"><span class="label">Mot de passe${reg?" (8 caractères minimum)":""}</span><input id="pass" type="password" autocomplete="${reg?"new-password":"current-password"}" required></div>
   ${reg?`<label class="toggle consent"><input type="checkbox" id="consent" required ${S.fConsent?"checked":""}><span>J'ai 18 ans ou plus, j'accepte les <a href="/conditions" target="_blank">conditions d'utilisation</a> et le traitement de mes consommations décrit dans la <a href="/confidentialite" target="_blank">politique de confidentialité</a>.</span></label>`:""}
   ${S.err?`<div class="banner">${esc(S.err)}</div>`:""}
   <button class="btn" type="submit">${reg?"Créer mon compte":"Me connecter"}</button>
   ${reg?"":`<button type="button" class="link" id="forgotBtn" style="align-self:flex-start">Mot de passe oublié ?</button>`}
  </form>
  ${S.cfg.googleClientId?`<div class="or">ou</div><div class="google" id="gbtn"></div><p class="muted" style="font-size:12px;margin:0;text-align:center">En continuant avec Google, vous confirmez avoir 18 ans ou plus et acceptez les <a href="/conditions" target="_blank">conditions</a> et la <a href="/confidentialite" target="_blank">politique de confidentialité</a>.</p>`:""}
  <div class="or">pour découvrir</div>
  <button class="btn ghost" id="demoBtn">Voir la démo : une soirée fictive en accéléré</button>
  <p class="note">Réservé aux 18 ans et plus. Les taux affichés sont des estimations, jamais une autorisation de conduire. <a href="/confidentialite">Confidentialité</a> · <a href="/conditions">Conditions</a> · <button class="link" id="helpBtn" style="padding:0;font-size:12px">Aide</button></p>
  <div class="row" style="justify-content:center">${Object.entries(LANGS).map(([k,l])=>`<button class="link langbtn" data-lang="${k}" aria-pressed="${I18N.lang===k}" style="font-size:12px">${l}</button>`).join("")}</div>
  </section>`;
}
function viewProfile(){
  const p={...(S.user||{}),...(S.fProf||{})}, edit=profileReady(S.user);
  const wk=S.week?weekView():"";
  return `<div class="hero"><h1>${edit?"Mon profil":"Votre profil"}</h1>${edit?"":`<p class="muted">Ces mesures servent au calcul de votre taux. Seuls votre pseudo, vos verres et vos taux sont visibles des autres joueurs.</p>`}</div>
  <section><div class="field"><span class="label">Pseudo</span><input id="pseudo" maxlength="20" value="${esc(p.pseudo||"")}" placeholder="Ex. Kiki"></div>
  <div class="grid2"><div class="field"><span class="label">Sexe biologique</span><select id="sex"><option value="H" ${p.sex!=="F"?"selected":""}>Homme</option><option value="F" ${p.sex==="F"?"selected":""}>Femme</option></select></div>
  <div class="field"><span class="label">Âge</span><input id="age" type="number" inputmode="numeric" min="18" max="99" value="${p.age||""}" placeholder="30"></div>
  <div class="field"><span class="label">Taille (cm)</span><input id="height" type="number" inputmode="numeric" min="130" max="220" value="${p.height||""}" placeholder="175"></div>
  <div class="field"><span class="label">Poids (kg)</span><input id="weight" type="number" inputmode="numeric" min="35" max="200" value="${p.weight||""}" placeholder="75"></div></div>
  <div class="field"><span class="label">Plafond perso (g/L)</span><select id="cap">${[0.5,0.6,0.8,1.0].map(v=>`<option value="${v}" ${(+p.cap||0.8)===v?"selected":""}>${fmt(v)}${v===0.8?" (conseillé)":""}</option>`).join("")}</select></div>
  ${S.err?`<div class="banner">${esc(S.err)}</div>`:""}
  <div class="row"><button class="btn" id="saveProf">Enregistrer</button>${edit?`<button class="btn ghost" id="back">Retour</button>`:""}</div>
  </section>
  ${wk}
  ${edit?viewBadges()+viewNotifs()+viewLang():""}
  ${edit?`<section><div class="row"><button class="btn ghost small" id="helpBtn2">Aide</button>${S.user?.admin?`<button class="btn ghost small" id="openDocs">Documentation</button>`:""}<button class="btn ghost small" id="demoBtn2">Voir la démo</button>${S.user?.admin?`<a class="btn ghost small" href="/demo.html" target="_blank" rel="noopener" style="text-decoration:none">Banc de test (ordinateur)</a>`:""}</div></section><section><div class="row">${S.code?`<button class="btn ghost small" id="leave">Quitter la soirée ${esc(S.code)}</button>`:""}<button class="btn ghost small" id="logout">Me déconnecter</button></div>
  <button class="link danger" id="delAcc">Supprimer mon compte et toutes mes données</button><div id="delConfirm" hidden class="banner">Tout sera effacé : profil, verres, titres. <div class="row" style="margin-top:8px"><button class="btn small" id="delYes">Oui, tout supprimer</button><button class="btn ghost small" id="delNo">Annuler</button></div></div></section>`:""}`;
}
function weekView(){
  const days=[]; const by=Object.fromEntries((S.week.days||[]).map(d=>[d.day,d.std]));
  for(let i=6;i>=0;i--){const d=new Date(Date.now()-i*864e5);const k=d.toLocaleDateString("fr-CA",{timeZone:"Europe/Paris"});days.push({k,std:by[k]||0,lab:d.toLocaleDateString("fr-FR",{weekday:"narrow"})})}
  const tot=days.reduce((s,d)=>s+d.std,0), free=days.filter(d=>!d.std).length, mx=Math.max(2,...days.map(d=>d.std));
  return `<section><h2>Mes 7 derniers jours</h2>
  <div class="card" style="display:flex;flex-direction:column;gap:10px">
   <div class="row" style="justify-content:space-between"><span><b style="font-size:22px;font-family:var(--display)">${tot.toFixed(1).replace(".",",")}</b> <span class="muted">verres standard</span></span><span class="state" style="color:${tot>10?"var(--bad)":"var(--ok)"}">${tot>10?"au-dessus du repère":"sous le repère"} de 10</span></div>
   <div class="week">${days.map(d=>`<div><i style="height:${d.std/mx*70}%;background:${d.std>2?"var(--bad)":"var(--accent)"}"></i>${d.lab}</div>`).join("")}</div>
   <div class="muted" style="font-size:13px">${free} jour${free>1?"s":""} sans alcool. Repères de Santé publique France : 10 verres par semaine au plus, 2 par jour, et des jours sans alcool.</div>
  </div></section>`;
}
function viewDocs(){
  const back=`<button class="btn ghost small" id="back">Retour</button>`;
  if(!S.docs) return `<div class="hero"><h1>Documentation</h1></div><section>${loader("Chargement…")}${back}</section>`;
  const cats=[...new Set(S.docs.map(d=>d.cat))];
  const fd=d=>new Date(d+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"});
  return `<div class="hero"><h1>Documentation</h1><p class="muted">Réservée aux administrateurs. Chaque document est un PDF daté, mis à jour au fil du projet.</p></div>
  ${cats.map(c=>`<section><h2>${esc(c)}</h2>${S.docs.filter(d=>d.cat===c).map(d=>`<a class="card doc" href="/docs/${encodeURI(d.file)}" target="_blank" rel="noopener"><div class="row" style="justify-content:space-between;align-items:baseline"><b>${esc(d.title)}</b><span class="muted" style="font-size:12px">${fd(d.date)}</span></div><span class="muted" style="font-size:13px">${esc(d.desc)}</span><span class="label" style="color:var(--accent)">Ouvrir le PDF</span></a>`).join("")}</section>`).join("")}
  <section>${back}</section>`;
}
/* ---------- amis ---------- */
let fTimer=null;
function stopFriendsPoll(){ if(fTimer){clearInterval(fTimer);fTimer=null} }
async function loadFriends(){ try{ S.friends=await api("GET","/api/friends") }catch(e){ if(!S.friends) S.err=e.message } }
function openFriends(){ S.err=""; S.screen="friends"; render(); loadFriends().then(render); stopFriendsPoll();
  fTimer=setInterval(()=>{ if(document.visibilityState!=="visible"||S.screen!=="friends") return; if(document.activeElement&&/INPUT/.test(document.activeElement.tagName)) return; loadFriends().then(render) },30000) }
const inviteLink=()=>`${location.origin}/?ami=${S.friends?.code||""}`;
function friendCard(f,i,now){
  const L=f.live, color=COLORS[(i+1)%COLORS.length];
  if(!L) return `<div class="lcard off"><div class="lhead">${avatar({id:f.id,color,cap:f.cap,sim:{cur:0,prev:0,peak:0},drinks:[]},50)}<div class="lname"><b data-noi18n>${esc(f.pseudo)}</b><span class="lstate muted">${f.share?"Pas en soirée":"Ne partage pas son taux"}</span></div></div><button class="link danger" data-unf="${f.id}" data-name="${esc(f.pseudo)}">Retirer</button></div>`;
  const p={id:f.id,color,cap:f.cap,sim:{cur:L.cur,prev:L.prev,peak:L.peak,pts:L.pts},drinks:L.drinks};
  const [lab,col]=stateOf(L.cur,+f.cap||0.8), tr=trendOf(p,now);
  return `<div class="lcard"><div class="lhead">${avx(p,58,L.sam?"Sam ce soir":lab,"f"+f.id)}<div class="lname"><b data-noi18n>${esc(f.pseudo)}</b><span class="lstate" style="color:${col}">${L.sam?"Sam ce soir":lab}</span></div></div>
    <div class="lrow"><span class="lnum" style="color:${col}">${fmt(L.cur)}<small>g/L</small></span><span class="ltr ${tr.k}${trendPrev["f"+f.id]&&trendPrev["f"+f.id]!==tr.k?" chg":""}" data-tk="f${f.id}|${tr.k}">${tr.k==="up"?"▲":tr.k==="down"?"▼":"■"} ${tr.txt}</span></div>
    ${spark(p,now,color)}
    <div class="ltitle ${L.last?L.last.kind:""}">${L.last?`${esc(L.last.title)} <span class="muted">· ${hm(L.last.t)}</span>`:`<span class="muted">Pas encore de titre</span>`}</div></div>`;
}
function viewFriends(){
  const F=S.friends, back=`<button class="btn ghost small" id="back">Retour</button>`;
  if(!F) return `<div class="hero"><h1>Mes amis</h1></div><section>${loader("Chargement…")}${back}</section>`;
  const now=Date.now(), on=F.friends.filter(f=>f.live).sort((a,b)=>b.live.cur-a.live.cur), off=F.friends.filter(f=>!f.live);
  const pre=ls.get("yd_ami","")||"";
  return `<div class="hero"><h1>Mes amis</h1><p class="muted">Leur taux en direct quand ils sont en soirée, leur avatar, leur tendance et leur dernier titre.</p></div>
  ${S.err?`<div class="banner">${esc(S.err)}</div>`:""}
  <section><div class="card fcode"><span class="label">Mon code ami</span><div class="row" style="justify-content:space-between"><b class="code">${esc(F.code)}</b><button class="btn small" id="shareLink">Partager mon lien</button></div>
  <label class="toggle" style="margin-top:4px"><span>Mes amis voient mon taux en direct pendant mes soirées</span><input type="checkbox" id="shareT" ${F.share?"checked":""}></label></div>
  <div class="row"><div class="field" style="flex:1;min-width:140px"><span class="label">Ajouter un ami avec son code</span><input id="fCode" maxlength="7" autocapitalize="characters" placeholder="ABC123" value="${esc(pre)}" style="text-transform:uppercase;letter-spacing:.15em"></div><button class="btn${pre?" pulse":""}" id="fAdd" style="align-self:flex-end">Ajouter</button></div></section>
  ${F.incoming.length?`<section><h2>Demandes reçues</h2>${F.incoming.map(r=>`<div class="item req"><div class="grow"><b>${esc(r.pseudo)}</b> <span class="muted">veut vous ajouter</span></div><button class="btn small" data-acc="${r.id}">Accepter</button><button class="btn ghost small" data-dec="${r.id}">Refuser</button></div>`).join("")}</section>`:""}
  <section><h2>En soirée${on.length?` (${on.length})`:""}</h2>${on.length?`<div class="live">${on.map((f,i)=>friendCard(f,i,now)).join("")}</div>`:`<p class="muted">Aucun ami en soirée pour l'instant. Leur taux apparaîtra ici dès qu'ils rejoindront une soirée.</p>`}</section>
  ${off.length?`<section><h2>Les autres</h2><div class="live">${off.map((f,i)=>friendCard(f,i+on.length,now)).join("")}</div></section>`:""}
  ${F.outgoing.length?`<section><h2>En attente</h2>${F.outgoing.map(r=>`<div class="item req"><div class="grow"><b>${esc(r.pseudo)}</b> <span class="muted">n'a pas encore accepté</span></div><button class="btn ghost small" data-dec="${r.id}">Annuler</button></div>`).join("")}</section>`:""}
  ${!F.friends.length&&!F.incoming.length&&!F.outgoing.length?`<section><p class="muted">Pas encore d'amis. Partagez votre lien ou demandez leur code à vos potes.</p></section>`:""}
  <section>${back}</section>`;
}
function rememberStates(){ document.querySelectorAll("[data-st]").forEach(e=>{const [k,at,...l]=e.dataset.st.split("|");statePrev[k]={lab:l.join("|"),at:+at}}) }
function bindFriends(){
  rememberStates();
  const on=(id,f)=>{const el=$("#"+id); if(el) el.onclick=f};
  on("shareLink",async()=>{ const txt=`Ajoute-moi sur Alamb'hic : ${inviteLink()}`;
    try{ if(navigator.share){await navigator.share({title:"Alamb'hic",text:txt});return} await navigator.clipboard.writeText(txt); snack("Lien copié","Envoie-le à tes potes") }catch(e){ snack("Mon lien ami",inviteLink()) } });
  on("fAdd",async()=>{ const c=$("#fCode").value; try{ const r=await api("POST","/api/friends",{code:c}); ls.set("yd_ami","");
      snack(r.state==="accepted"?`${r.pseudo} et vous êtes amis`:r.state==="already"?`Déjà ami avec ${r.pseudo}`:r.state==="pending"?"Demande déjà envoyée":`Demande envoyée à ${r.pseudo}`, r.state==="sent"?"Elle apparaîtra dès qu'il accepte":"");
      buzz(25); await loadFriends(); render() }catch(e){ snack("Ajout impossible",e.message,{err:1}) } });
  const sh=$("#shareT"); if(sh) sh.onchange=async()=>{ try{ await api("PUT","/api/me/share",{share:sh.checked}); S.friends.share=sh.checked; snack(sh.checked?"Partage activé":"Partage désactivé",sh.checked?"Vos amis voient votre taux pendant vos soirées":"Vos amis ne voient plus votre taux") }catch(e){ snack("Réglage non enregistré",e.message,{err:1}) } };
  document.querySelectorAll("[data-acc]").forEach(b=>b.onclick=async()=>{ b.disabled=true; try{ await api("POST",`/api/friends/${b.dataset.acc}/accept`); snack("Ami ajouté"); buzz(25); await loadFriends(); render() }catch(e){ b.disabled=false; snack("Impossible",e.message,{err:1}) } });
  document.querySelectorAll("[data-dec]").forEach(b=>b.onclick=async()=>{ b.disabled=true; try{ await api("DELETE",`/api/friends/${b.dataset.dec}`); snack("Demande retirée"); await loadFriends(); render() }catch(e){ b.disabled=false; snack("Impossible",e.message,{err:1}) } });
  document.querySelectorAll("[data-unf]").forEach(b=>b.onclick=async()=>{
    if(b.dataset.sure!=="1"){ b.dataset.sure="1"; b.textContent=`Retirer ${b.dataset.name} ?`; setTimeout(()=>{ if(b.isConnected){b.dataset.sure="";b.textContent="Retirer"} },3000); return }
    try{ await api("DELETE",`/api/friends/${b.dataset.unf}`); snack(`${b.dataset.name} retiré de vos amis`); await loadFriends(); render() }catch(e){ snack("Impossible",e.message,{err:1}) } });
  document.querySelectorAll("[data-tk]").forEach(e=>{const [id,k]=e.dataset.tk.split("|");trendPrev[id]=k});
}

function viewHome(){
  return `<div class="hero"><h1>Salut ${esc(S.user.pseudo)} !</h1><p class="muted">Créez une soirée et partagez son code, ou rejoignez celle de vos amis.</p></div>
  <section><button class="btn" id="create">Créer une soirée</button>
  <div class="row"><button class="btn ghost" id="friendsBtn2" style="flex:1">Mes amis</button><button class="btn ghost" id="demoBtn3" style="flex:1">Voir la démo</button></div>
  <div class="row"><div class="field" style="flex:1;min-width:120px"><span class="label">Rejoindre avec un code</span><input id="joinCode" maxlength="4" autocapitalize="characters" placeholder="ABCD" style="text-transform:uppercase;letter-spacing:.2em"></div><button class="btn ghost" id="join" style="align-self:flex-end">Rejoindre</button></div>
  ${S.err?`<div class="banner">${esc(S.err)}</div>`:""}</section>${S.week?weekView():""}`;
}


/* ---------- badges à paliers (bronze, argent, or) ---------- */
async function loadBadges(){ try{ const r=await api("GET","/api/me/badges"); S.badges=r.badges;
  r.badges.filter(b=>b.new).forEach(b=>toast({kind:"trophy",title:`Badge ${b.tierName} : ${b.title}`,text:`${b.desc} : ${b.count}.`})) }catch(e){} }
const MEDAL=["var(--line)","#cd7f32","#c9d2de","#ffcf4a"];
function viewBadges(){
  if(!S.badges) return "";
  return `<section><h2>Mes badges</h2><p class="muted" style="font-size:13px;margin:0">Ils suivent votre historique et récompensent la régularité et la modération, jamais l'excès.</p>
  <div class="bgrid">${S.badges.map(b=>{const top=b.steps[b.steps.length-1], pct=Math.min(100,b.count/(b.next||top)*100);
    return `<div class="bcard t${b.tier}"><span class="medal" style="--m:${MEDAL[b.tier]}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="7"/><path d="M8 3l2.5 4.5M16 3l-2.5 4.5"/></svg></span>
    <div class="bx"><b>${esc(b.title)}</b><span class="muted">${esc(b.desc)} : ${b.count}</span><span class="bt">${b.tier?esc(b.tierName):"À débloquer"}${b.next?` · prochain palier à ${b.next}`:" · palier maximal"}</span><i class="bbar"><i style="width:${pct.toFixed(0)}%"></i></i></div></div>`}).join("")}</div></section>`;
}

/* ---------- notifications push ---------- */
const pushOK=()=>"serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window;
async function loadNotifs(){ try{ S.notifs=await api("GET","/api/me/notifs"); const reg=pushOK()?await navigator.serviceWorker.ready:null; S.notifs.here=!!(reg&&await reg.pushManager.getSubscription()) }catch(e){} }
const b64u=s=>{const p="=".repeat((4-s.length%4)%4),b=atob((s+p).replace(/-/g,"+").replace(/_/g,"/"));return Uint8Array.from(b,c=>c.charCodeAt(0))};
async function enablePush(){
  if(!pushOK()) throw new Error(/iPhone|iPad/.test(navigator.userAgent)?"Sur iPhone, installez d'abord Alamb'hic sur l'écran d'accueil (Partager → Sur l'écran d'accueil), puis ouvrez-le depuis l'icône.":"Ce navigateur ne gère pas les notifications.");
  const perm=await Notification.requestPermission(); if(perm!=="granted") throw new Error("Notifications refusées. Autorisez-les dans les réglages du navigateur pour ce site.");
  const reg=await navigator.serviceWorker.ready, {key}=await api("GET","/api/push/key");
  let sub=await reg.pushManager.getSubscription(); if(!sub) sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(key)});
  await api("POST","/api/push/subscribe",{sub:sub.toJSON()});
}
async function disablePush(){ const reg=await navigator.serviceWorker.ready, sub=await reg.pushManager.getSubscription(); if(sub){ await api("POST","/api/push/unsubscribe",{endpoint:sub.endpoint}); await sub.unsubscribe() } }
function viewNotifs(){
  const N=S.notifs; if(!N) return "";
  return `<section><h2>Notifications</h2>
  <div class="card" style="display:flex;flex-direction:column;gap:10px">
   <div class="row" style="justify-content:space-between"><span>${N.here?"Activées sur cet appareil":"Désactivées sur cet appareil"}</span>${N.here?`<div class="row" style="gap:6px"><button class="btn ghost small" id="pushTest">Tester</button><button class="btn ghost small" id="pushOff">Couper</button></div>`:`<button class="btn small" id="pushOn">Activer sur cet appareil</button>`}</div>
   ${Object.entries(N.cats).map(([k,l])=>`<label class="toggle"><span>${esc(l)}</span><input type="checkbox" data-nc="${k}" ${N.prefs[k]?"checked":""}></label>`).join("")}
   ${N.exprModes?`<div class="field" style="margin:0"><span class="label">Expressions des potes (« Max remet le facteur sur le vélo »)</span><select id="exprSel">${Object.entries(N.exprModes).map(([k,l])=>`<option value="${k}" ${N.expr===k?"selected":""}>${esc(l)}</option>`).join("")}</select></div>`:""}
   <p class="muted" style="font-size:12px;margin:0">Elles arrivent même appli fermée. ${N.devices>1?`${N.devices} appareils abonnés.`:""}</p>
  </div></section>`;
}

/* ---------- langue ---------- */
const LANGS={fr:"Français",en:"English",es:"Español",pt:"Português"};
function viewLang(){ return `<section><div class="field"><span class="label">Langue</span><select id="langSel">${Object.entries(LANGS).map(([k,l])=>`<option value="${k}" ${I18N.lang===k?"selected":""}>${l}</option>`).join("")}</select></div></section>` }

/* ---------- aide ---------- */
async function openHelp(){ S.err=""; S.prevScreen=S.screen==="help"?S.prevScreen:S.screen; S.screen="help"; render(); if(!S.help){ try{ S.help=await api("GET","/api/help") }catch(e){ S.err=e.message } render() } }
function viewHelp(){
  const H=S.help, back=`<button class="btn ghost small" id="helpBack">Retour</button>`;
  if(!H) return `<div class="hero"><h1>Aide</h1></div><section>${loader("Chargement…")}${back}</section>`;
  const A=S.helpAns;
  return `<div class="hero"><h1>Aide</h1><p class="muted">Posez votre question ou parcourez les réponses.</p></div>
  <section><form id="helpForm" class="row" style="flex-wrap:nowrap"><div class="field" style="flex:1"><input id="helpQ" placeholder="Ex. pourquoi mon pic baisse après un repas ?" value="${esc(S.helpQ||"")}" maxlength="300"></div><button class="btn" type="submit">Demander</button></form>
  ${S.err?`<div class="banner">${esc(S.err)}</div>`:""}
  ${A?`<div class="card hans">${A.answer?`<span class="label" style="color:var(--accent)">Réponse${A.ai?" (assistant)":""}</span><p style="margin:6px 0 0;white-space:pre-line">${esc(A.answer)}</p>`:A.found.length?"":`<p class="muted" style="margin:0">Pas de réponse toute prête. Essayez d'autres mots, ou écrivez-nous depuis la page <a href="/confidentialite" target="_blank">Confidentialité</a>.</p>`}
   ${(!A.answer&&A.found.length)?A.found.map(f=>`<details class="hq" open><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join(""):""}</div>`:""}</section>
  <section><h2>Questions fréquentes</h2>${H.items.map(f=>`<details class="hq"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</section>
  <section>${back}</section>`;
}

/* ---------- mot de passe oublié ---------- */
function viewForgot(){
  return `<div class="hero"><h1>Mot de passe oublié</h1><p class="muted">Entrez l'adresse de votre compte : nous vous envoyons un lien pour choisir un nouveau mot de passe (valable 1 heure).</p></div>
  <section>${S.forgotSent?`<div class="card"><b>E-mail envoyé</b><p class="muted" style="margin:6px 0 0">Si un compte existe avec cette adresse, le lien arrive dans quelques instants. Pensez à regarder dans les indésirables.</p></div>`:
  `<form id="forgotForm" class="field" style="gap:10px" novalidate><div class="field"><span class="label">E-mail</span><input id="fgEmail" type="email" autocomplete="email" value="${esc(S.fEmail||"")}"></div>
  ${S.err?`<div class="banner">${esc(S.err)}</div>`:""}<button class="btn" type="submit">Recevoir le lien</button></form>`}
  <button class="btn ghost small" id="toLogin">Retour à la connexion</button></section>`;
}
function viewReset(){
  return `<div class="hero"><h1>Nouveau mot de passe</h1></div>
  <section><form id="resetForm" class="field" style="gap:10px" novalidate><div class="field"><span class="label">Nouveau mot de passe (8 caractères minimum)</span><input id="rsPass" type="password" autocomplete="new-password"></div>
  ${S.err?`<div class="banner">${esc(S.err)}</div>`:""}<button class="btn" type="submit">Enregistrer et me connecter</button></form>
  <button class="btn ghost small" id="toLogin">Retour à la connexion</button></section>`;
}

/* ---------- écran TV (télécommande) et récapitulatif partageable ---------- */
function viewShare(me){
  const T=S.tv;
  return `<section><h2>Partager la soirée</h2>
  <div class="card" style="display:flex;flex-direction:column;gap:10px">
   <div class="row" style="justify-content:space-between"><div><b>Écran TV</b><div class="muted" style="font-size:13px">Les avatars, les courbes et les titres en grand, pour toute la salle.</div></div>${T?"":`<button class="btn small" id="tvOn">Écran TV</button>`}</div>
   ${T?`<div class="tvbox"><span class="muted" style="font-size:13px">Sur la TV, ouvrez <b>${esc(location.host)}/tv</b> et tapez :</span><b class="code">${esc(T.tv)}</b>
   <span class="label">Télécommande</span><div class="seg" id="tvSeg">${[["auto","Auto"],["potes","Avatars"],["courbes","Courbes"],["fil","Fil"]].map(([v,l])=>`<button data-tv="${v}" aria-pressed="${T.view===v}">${l}</button>`).join("")}</div></div>`:""}
  </div>
  <div class="card" style="display:flex;flex-direction:column;gap:10px">
   <div class="row" style="justify-content:space-between"><div><b>Récap à partager</b><div class="muted" style="font-size:13px">Une page publique avec les courbes, les avatars et les titres de la soirée.</div></div><button class="btn small" id="recapOn">${S.recap?"Partager le lien":"Créer le lien"}</button></div>
   <label class="toggle"><span>Apparaître dans le récap (pseudo seulement)</span><input type="checkbox" id="recapOk" ${me&&me.recapOk?"checked":""}></label>
   ${S.recap?`<div class="row" style="justify-content:space-between"><a href="${esc(S.recap)}" target="_blank" rel="noopener" class="muted" style="font-size:13px;word-break:break-all">${esc(location.host+S.recap)}</a><button class="link danger" id="recapDel">Supprimer le lien</button></div>`:""}
  </div></section>`;
}


/* ---------- accueil hors soirée : Moi (verres partout), Sessions, Agenda, Groupes, Soirées ---------- */
const H_MS=3600e3;
const curMonth=()=>new Date().toLocaleDateString("sv-SE").slice(0,7);
const dShort=t=>new Date(t).toLocaleDateString(I18N.lang==="fr"?"fr-FR":I18N.lang,{weekday:"short",day:"numeric",month:"short"});
const dLong=t=>new Date(t).toLocaleDateString(I18N.lang==="fr"?"fr-FR":I18N.lang,{weekday:"long",day:"numeric",month:"long"});
const stdF=v=>(Math.round(v*10)/10).toString().replace(".",",");
let liveTimer=null;
const hubStale=t=>!S["_h_"+t];
function hubDirty(...tabs){ tabs.forEach(t=>{S["_h_"+t]=0}) }
async function loadLive(){ S.live=await api("GET","/api/me/live"); S._h_moi=Date.now(); S.place={place:S.live.me.place,places:S.live.me.places||[]} }
async function loadCal(m){ S.cal=await api("GET","/api/me/calendar?month="+(m||S.calMonth||curMonth())); S.calMonth=S.cal.month; S._h_agenda=Date.now() }
async function loadGroup(){ S.group=await api("GET",`/api/groups/${S.gid}`+(S.gEnd?`?end=${S.gEnd}`:"")) }
async function loadHub(t){
  if(t==="moi"){ await Promise.all([loadLive(),loadMeals(),S.cal?null:loadCal()]); }
  if(t==="sessions"||t==="soirees"){ S.sessions=(await api("GET","/api/me/sessions")).sessions; S._h_sessions=Date.now() }
  if(t==="agenda") await loadCal();
  if(t==="groupes"){ S.groups=(await api("GET","/api/groups")).groups; if(S.gid) await loadGroup(); S._h_groupes=Date.now() }
  if(t==="soirees"){ S.parties=(await api("GET","/api/parties")).parties; S._h_soirees=Date.now() }
  S["_h_"+t]=Date.now();   // jamais de rechargement en boucle
}
function ensureHub(){
  const t=S.htab=S.htab||"moi"; if(!hubStale(t)||S.hubBusy) return;
  S.hubBusy=true; loadHub(t).catch(e=>{ S.err=e.message; S["_h_"+t]=Date.now() }).finally(()=>{ S.hubBusy=false; if(S.screen==="home") render() });
}
function openHub(tab){
  clearToasts(); S.err=""; S.screen="home"; if(tab){ S.htab=tab; hubDirty(tab) } S.htab=S.htab||"moi"; render();
  clearInterval(liveTimer); liveTimer=setInterval(()=>{ if(S.screen==="home"&&S.htab==="moi"&&!demo&&document.visibilityState==="visible")
    loadLive().then(()=>{ if(!(document.activeElement&&/INPUT|SELECT/.test(document.activeElement.tagName))) render() }).catch(()=>{}) },60000);
}
const loading=()=>`<section>${loader("Chargement…")}</section>`;
function viewHub(now){
  ensureHub();
  const t=S.htab; let h=S.err?`<div class="banner" style="margin-top:14px">${esc(S.err)}</div>`:"";
  if(t==="moi") h+=viewSolo(now);

  if(t==="agenda") h+=viewAgenda();
  if(t==="groupes") h+=S.gid?viewGroup(now):viewGroups();
  if(t==="soirees") h+=viewNights(now);
  return h;
}

/* Moi : la session en cours, où que l'on boive */
function viewSolo(now){
  if(!S.live) return loading();
  const p={...S.live.me,color:COLORS[0]}, pa=S.live.party;
  my={pseudo:p.pseudo,cap:p.cap,sam:p.sam,mealsOk:p.mealsOk,drinks:p.drinks};
  return `<div class="hero" style="padding-bottom:0"><h1>Salut ${esc(S.user.pseudo)} !</h1></div>
  ${pa?`<section><div class="card pnow"><div><span class="label" style="color:var(--accent)">Soirée en cours</span><b>${esc(pa.name||"Soirée "+pa.code)} · ${esc(pa.code)}</b><span class="muted" style="font-size:13px">Vos verres comptent aussi dans cette soirée.</span></div><button class="btn small" data-open="${esc(pa.code)}">Ouvrir</button></div></section>`:""}
  ${viewMe(p,now)}
  ${p.sim.pts.length>1?viewChart([p],now,{title:"Ma session en cours",t0:p.sessionStart-10*MIN,note:"La session a commencé à votre premier verre d'alcool ; elle se terminera quand votre taux sera revenu à 0."}):""}`;
}

/* Sessions : du premier verre au retour à 0 */
function sparkS(s){
  const pts=s.pts||[]; if(pts.length<2) return "";
  const W=84,Hh=30,t0=pts[0][0],t1=pts[pts.length-1][0],m=Math.max(0.3,...pts.map(x=>x[1]));
  const d=pts.map((x,i)=>(i?"L":"M")+((x[0]-t0)/Math.max(1,t1-t0)*W).toFixed(1)+" "+(Hh-2-x[1]/m*(Hh-4)).toFixed(1)).join("");
  return `<svg class="sspark" viewBox="0 0 ${W} ${Hh}" aria-hidden="true"><path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/></svg>`;
}
function viewSessions(now){
  if(!S.sessions) return loading();
  if(S.sesOpen){ const s=S.sessions.find(x=>x.id===S.sesOpen); if(s) return viewSession(s,now) }
  return `<section><h2>Mes sessions</h2><p class="muted" style="font-size:13px;margin:0">Une session commence au premier verre d'alcool et se termine quand le taux revient à 0. 60 derniers jours.</p>
  ${S.sessions.length?`<div class="slist">${S.sessions.map(s=>`<button class="scard${s.ongoing?" on":""}" data-ses="${s.id}">
    <div class="sd"><b>${esc(dShort(s.start))}</b><span>${hm(s.start)} → ${s.ongoing?"en cours":hm(s.end)}</span>${s.party?`<span class="pchip">${esc(s.partyName||"Soirée "+s.party)}</span>`:""}</div>
    ${sparkS(s)}<div class="sv"><b>${fmt(s.peak)}</b><span>pic · ${stdF(s.std)} v.</span></div></button>`).join("")}</div>`
  :`<p class="muted">Aucune session pour l'instant. Elles apparaîtront ici dès votre premier verre d'alcool.</p>`}</section>`;
}
function viewSession(s,now){
  const p={id:S.me,pseudo:S.user.pseudo,color:COLORS[0],sim:{pts:s.pts,cur:s.cur,zeroT:s.end}};
  const dr=(s.drinks||[]).slice().sort((a,b)=>b.t-a.t);
  return `<section><button class="link" id="sesBack">‹ Mes soirées</button><h2>${esc(dLong(s.start))}</h2>
  ${s.party?`<div class="row" style="justify-content:space-between"><span class="pchip">Soirée ${esc(s.party)}${s.partyName?" · "+esc(s.partyName):""}</span><button class="btn ghost small" data-open="${esc(s.party)}">Voir la soirée</button></div>`:`<span class="pchip solo" style="align-self:flex-start">Solo</span>`}
  ${s.place?`<span class="pplace big" data-noi18n>${PIN}${esc(s.place)}</span>`:""}
  <div class="stats">
   <div><span>Début</span><b>${hm(s.start)}</b></div><div><span>${s.ongoing?"Retour à 0 prévu":"Retour à 0"}</span><b>${hm(s.end)}</b></div>
   <div><span>Pic</span><b>${fmt(s.peak)}</b>${s.peakT?`<small>à ${hm(s.peakT)}</small>`:""}</div><div><span>Verres standard</span><b>${stdF(s.std)}</b></div>
   <div><span>Verres d'alcool</span><b>${s.n}</b></div><div><span>Verres d'eau</span><b>${s.water}</b></div></div></section>
  ${viewChart([p],now,{title:"Courbe de la session",t0:s.start-10*MIN,t1:s.end+10*MIN,note:s.ongoing?"Trait plein : jusqu'à maintenant. Pointillés : redescente prévue si vous ne buvez plus.":"Du premier verre au retour à 0."})}
  <section><h2>Verres de la session</h2><div class="list">${dr.map(d=>`<div class="item"><span class="t">${hm(d.t)}</span><div class="grow"><b>${esc(d.l)}</b> <span class="muted">${d.ml/10} cl · ${String(d.abv).replace(".",",")} %</span></div></div>`).join("")}</div></section>`;
}

/* Agenda : verres standard par jour, vert 1-2, orange 3-5, rouge 6+ */
const dayCls=std=>{ if(!std) return ""; const r=Math.round(std); return r>=6?"red":r>=3?"orange":"green" };
/* bouton ⚠ à côté de l'avatar quand l'agenda signale une conso élevée ; le message s'ouvre au clic */
function alertBtn(){
  const A=!demo&&S.cal&&S.cal.alerts; if(!A||!A.length) return "";
  const red=A.some(a=>a.level==="red");
  return `<button class="alertbtn ${red?"red":"orange"}${S.alertOpen?" on":""}" id="alertBtn" aria-expanded="${!!S.alertOpen}" aria-label="Un œil sur votre conso : voir le message"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 21h20L12 3z"/><path d="M12 10v5M12 18v.01"/></svg></button>`;
}
function alertsCard(compact){
  const C=S.cal; if(!C) return "";
  if(!C.alerts.length) return compact?"":`<div class="card okc"><b>Dans les repères</b><span class="muted" style="font-size:13px">${C.week?`${stdF(C.week)} verre${C.week>=2?"s":""} standard ces 7 derniers jours (repère : 10 au plus, 2 par jour, et des jours sans alcool).`:"Aucun verre d'alcool ces 7 derniers jours."}</span></div>`;
  const red=C.alerts.some(a=>a.level==="red");
  return `<section><div class="card alc ${red?"red":"orange"}"><b>${red?"Prenez soin de vous":"Un œil sur votre conso"}</b>
  <ul>${C.alerts.map(a=>`<li>${esc(a.text)}</li>`).join("")}</ul>
  <span class="muted" style="font-size:13px">Envie d'en parler, sans jugement ? Alcool info service : <b>0 980 980 930</b> (7 j/7, 8 h-2 h, anonyme et non surtaxé) · <a href="https://www.alcool-info-service.fr" target="_blank" rel="noopener">alcool-info-service.fr</a></span>
  ${compact?`<div class="row" style="justify-content:space-between"><button class="link" data-htab-go="agenda">Voir mon agenda</button><button class="link" id="alertClose">Fermer</button></div>`:""}</div></section>`;
}
function viewAgenda(){
  const C=S.cal; if(!C) return loading();
  const [y,m]=C.month.split("-").map(Number), first=new Date(y,m-1,1), off=(first.getDay()+6)%7, start=new Date(y,m-1,1-off);
  const today=new Date().toLocaleDateString("sv-SE"); let rows="", tot=0, on=0, heavy=0, off0=0;
  for(let w=0;w<6;w++){
    let cells="", ws=0;
    for(let i=0;i<7;i++){
      const d=new Date(start.getFullYear(),start.getMonth(),start.getDate()+w*7+i), k=d.toLocaleDateString("sv-SE"), v=C.days[k], inM=d.getMonth()===m-1;
      const std=v?v.std:0; ws+=std;
      if(inM){ tot+=std; if(std) on++; if(Math.round(std)>=6) heavy++; if(!std&&k<=today) off0++ }
      cells+=`<button class="cday ${dayCls(std)}${inM?"":" out"}${k===today?" today":""}${S.calDay===k?" sel":""}" data-day="${k}" aria-label="${esc(dLong(d))} : ${stdF(std)} verres standard"><span>${d.getDate()}</span>${std?`<i>${Math.round(std)||"<1"}</i>`:""}</button>`;
    }
    if(w>=4&&new Date(start.getFullYear(),start.getMonth(),start.getDate()+w*7).getMonth()!==m-1) break;
    rows+=`<div class="cweek">${cells}<span class="cwt${ws>10?" over":""}">${ws?stdF(ws):""}</span></div>`;
  }
  const sel=S.calDay&&C.days[S.calDay];
  const title=first.toLocaleDateString(I18N.lang==="fr"?"fr-FR":I18N.lang,{month:"long",year:"numeric"});
  return `<section><div class="row" style="justify-content:space-between"><button class="btn ghost small" data-cal="-1" aria-label="Mois précédent">‹</button><h2 style="margin:0;text-transform:capitalize">${esc(title)}</h2><button class="btn ghost small" data-cal="1" aria-label="Mois suivant" ${C.month>=curMonth()?"disabled":""}>›</button></div>
  <div class="cal"><div class="cweek head">${["L","M","M","J","V","S","D"].map(x=>`<span>${x}</span>`).join("")}<span class="cwt">Sem.</span></div>${rows}</div>
  <div class="clegend"><span><i class="green"></i>1-2</span><span><i class="orange"></i>3-5</span><span><i class="red"></i>6 et +</span><span class="muted">verres standard par jour</span></div>
  ${S.calDay?`<div class="card">${sel?`<b>${esc(dLong(S.calDay+"T12:00"))}</b><span>${stdF(sel.std)} verre${sel.std>=2?"s":""} standard · ${sel.n} verre${sel.n>1?"s":""} d'alcool</span><button class="link" data-htab-go="soirees" style="align-self:flex-start">Voir mes soirées</button>`:`<b>${esc(dLong(S.calDay+"T12:00"))}</b><span class="muted">Jour sans alcool.</span>`}</div>`:""}
  <div class="stats"><div><span>Ce mois-ci</span><b>${stdF(tot)}</b><small>verres standard</small></div><div><span>Jours avec alcool</span><b>${on}</b></div><div><span>Jours sans alcool</span><b>${off0}</b></div><div><span>Jours à 6 et +</span><b>${heavy}</b></div></div>
  ${alertsCard(false)}
  <p class="muted" style="font-size:12px;margin:0">Repères de Santé publique France : 10 verres standard par semaine au plus, 2 par jour au plus, et des jours sans alcool. Un verre standard = 10 g d'alcool pur (un demi de bière, un verre de vin, un shot). Semaine au-delà de 10 : chiffre en orange.</p></section>`;
}

/* Groupes de potes : les courbes de tout le monde, par créneaux de 48 h */
function viewGroups(){
  if(!S.groups) return loading();
  return `<section><h2>Mes groupes de potes</h2><p class="muted" style="font-size:13px;margin:0">Les membres d'un groupe voient les courbes de tout le monde, quel que soit l'endroit où chacun boit, par créneaux de 48 h. Quitter le groupe arrête le partage.</p>
  ${S.groups.length?`<div class="slist">${S.groups.map(g=>`<button class="scard" data-grp="${g.id}"><div class="sd"><b>${esc(g.name)}</b><span>${g.n} membre${g.n>1?"s":""}</span></div><span class="muted">›</span></button>`).join("")}</div>`:`<p class="muted">Aucun groupe pour l'instant.</p>`}
  <div class="row"><div class="field" style="flex:1;min-width:150px"><span class="label">Nouveau groupe</span><input id="gName" maxlength="40" placeholder="Les potes du jeudi"></div><button class="btn" id="gCreate" style="align-self:flex-end">Créer</button></div>
  <div class="row"><div class="field" style="flex:1;min-width:150px"><span class="label">Rejoindre avec un code</span><input id="gCode" maxlength="6" autocapitalize="characters" placeholder="ABC123" style="text-transform:uppercase;letter-spacing:.15em"></div><button class="btn ghost" id="gJoin" style="align-self:flex-end">Rejoindre</button></div></section>`;
}
function viewGroup(now){
  const G=S.group; if(!G||G.id!==S.gid) return loading();
  const list=G.members.map((m,i)=>({...m,color:COLORS[i%COLORS.length]})), latest=!S.gEnd;
  const lab=`${dShort(G.start)} ${hm(G.start)} → ${dShort(G.end)} ${hm(G.end)}`;
  const sorted=list.slice().sort((a,b)=>b.sim.cur-a.sim.cur||b.std-a.std);
  return `<section style="padding-bottom:0"><button class="link" id="gBack">‹ Mes groupes</button><h2>${esc(G.name)}</h2></section>
  ${viewChart(list,now,{title:"Frise des taux",height:Math.min(440,Math.max(300,Math.round(innerHeight*0.45))),t0:G.start,t1:G.end,legend:p=>esc(p.pseudo),note:"Chaque membre, où qu'il boive. Trait plein : jusqu'à maintenant ; pointillés : redescente prévue."})}
  <section style="padding-top:0"><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><button class="btn ghost small nowrap" id="gPrev">‹ 48 h</button><span class="muted" style="font-size:13px;text-align:center">${esc(lab)}</span><button class="btn ghost small nowrap" id="gNext" ${latest?"disabled":""}>48 h ›</button></div></section>
  <section><h2>Les membres${latest?" en ce moment":""}</h2>
  <div class="gmem">${sorted.map(m=>{ const [lab2,col]=stateOf(m.sim.cur,+m.cap||0.8);
    return `<div class="gm"><span class="gbar" style="background:${m.color}"></span>${avx({...m,drinks:[]},52,lab2,"g"+m.id)}
    <div class="gx"><b data-noi18n>${esc(m.pseudo)}</b>${m.title?`<span class="ltitle ${m.title.kind}">${esc(m.title.title)}</span>`:""}${m.place?`<span class="pplace" data-noi18n>${PIN}${esc(m.place)}</span>`:""}<span class="muted" style="font-size:12px">${stdF(m.std)} verre${m.std>=2?"s":""} standard sur 48 h · ${m.water} eau</span></div>
    <div class="gv">${latest?`<b style="color:${col}">${fmt(m.sim.cur)}<small>g/L</small></b><span style="color:${col}">${lab2}</span>`:`<b>${fmt(m.sim.peak)}<small>g/L</small></b><span class="muted">pic</span>`}</div></div>` }).join("")}</div></section>
  <section><div class="card"><span class="label">Inviter dans le groupe</span><div class="row" style="justify-content:space-between;margin-top:6px"><b class="code" style="font-family:var(--display);font-size:26px;letter-spacing:.15em">${esc(G.code)}</b><button class="btn ghost small" id="gShare">Partager le lien</button></div></div>
  ${S.gLeave?`<div class="card"><b>Quitter ce groupe ?</b><span class="muted" style="font-size:13px">Les autres ne verront plus vos courbes.</span><div class="row"><button class="btn small" id="gLeaveYes">Oui, quitter</button><button class="btn ghost small" id="gLeaveNo">Annuler</button></div></div>`:`<button class="link danger" id="gLeave" style="align-self:flex-start">Quitter le groupe</button>`}</section>`;
}

/* Soirées : une seule page pour les sessions (du premier verre au retour à 0) et les soirées à code (horaires prévus).
   En haut : soirées en cours ou à venir, créer, rejoindre. Dessous : l'historique par date, filtrable. */
function viewNights(now){
  if(!S.parties||!S.sessions) return loading();
  if(S.sesOpen){ const s=S.sessions.find(x=>x.id===S.sesOpen); if(s) return viewSession(s,now) }
  const cur=S.parties.filter(p=>p.endsAt>now-6*H_MS), f=S.nf||"tout";
  const mine=new Set(S.sessions.map(s=>s.party).filter(Boolean));
  const items=[...S.sessions.map(s=>({t:s.start,s})),...S.parties.filter(p=>p.endsAt<=now-6*H_MS&&!mine.has(p.code)).map(p=>({t:p.startsAt,p}))]
    .filter(x=>f==="tout"||(f==="solo"?x.s&&!x.s.party:(x.p||x.s.party))).sort((a,b)=>b.t-a.t);
  const pRow=p=>`<button class="scard" data-open="${esc(p.code)}"><div class="sd"><b>${esc(p.name||"Soirée "+p.code)}</b><span>${esc(dShort(p.startsAt))} ${hm(p.startsAt)} → ${p.endsAt-p.startsAt>20*H_MS?esc(dShort(p.endsAt))+" ":""}${hm(p.endsAt)}</span><span class="pchip">Soirée ${esc(p.code)} · ${p.n} joueur${p.n>1?"s":""}</span></div><div class="sv"><b>${now<p.startsAt?"à venir":now<=p.endsAt?"en cours":"terminée"}</b><span>${now<=p.endsAt?"ouvrir":"pas de verre noté"}</span></div></button>`;
  const sRow=s=>`<button class="scard${s.ongoing?" on":""}" data-ses="${s.id}"><div class="sd"><b>${esc(dShort(s.start))}</b><span>${hm(s.start)} → ${s.ongoing?"en cours":hm(s.end)}</span>${s.party?`<span class="pchip">Soirée ${esc(s.party)}${s.partyName?" · "+esc(s.partyName):""}</span>`:`<span class="pchip solo">Solo</span>`}${s.place?`<span class="pplace" data-noi18n>${PIN}${esc(s.place)}</span>`:""}</div>${sparkS(s)}<div class="sv"><b>${fmt(s.peak)}</b><span>pic · ${stdF(s.std)} v.</span></div></button>`;
  const st=S.pStart||defaultStart(), en=S.pEnd||st+8*H_MS;
  return `<section><h2>Soirées</h2>${cur.length?`<div class="slist">${cur.map(pRow).join("")}</div>`:""}
  <div class="row"><button class="btn${S.pForm?" ghost":""}" id="pFormBtn" style="flex:1">${S.pForm?"Fermer":"Créer une soirée"}</button></div>
  ${S.pForm?`<div class="card" style="display:flex;flex-direction:column;gap:10px"><p class="muted" style="font-size:13px;margin:0">Un code de 4 lettres à partager ; la courbe de la soirée va du début à la fin prévus.</p>
   <div class="field"><span class="label">Nom (facultatif)</span><input id="pName" maxlength="40" placeholder="Anniversaire de Léa" value="${esc(S.pName||"")}"></div>
   <div class="row"><div class="field" style="flex:1;min-width:150px"><span class="label">Début</span><input id="pStart" type="datetime-local" value="${dtLocal(st)}"></div><div class="field" style="flex:1;min-width:150px"><span class="label">Fin</span><input id="pEnd" type="datetime-local" value="${dtLocal(en)}"></div></div>
   <button class="btn" id="create">Créer la soirée</button></div>`:""}
  <div class="row"><div class="field" style="flex:1;min-width:120px"><span class="label">Rejoindre avec un code</span><input id="joinCode" maxlength="4" autocapitalize="characters" placeholder="ABCD" style="text-transform:uppercase;letter-spacing:.2em"></div><button class="btn ghost" id="join" style="align-self:flex-end">Rejoindre</button></div></section>
  <section><h2>Historique</h2><p class="muted" style="font-size:13px;margin:0">Une session va de votre premier verre d'alcool jusqu'au retour à 0 ; une soirée à code a des horaires prévus et plusieurs joueurs. 60 derniers jours.</p>
  <div class="seg" id="nightF">${[["tout","Tout"],["solo","Solo"],["code","Soirées à code"]].map(([v,l])=>`<button data-nf="${v}" aria-pressed="${f===v}">${l}</button>`).join("")}</div>
  ${items.length?`<div class="slist">${items.map(x=>x.s?sRow(x.s):pRow(x.p)).join("")}</div>`:`<p class="muted">Rien pour l'instant. Votre premier verre d'alcool ouvrira une session.</p>`}
  <div class="row"><button class="btn ghost" id="friendsBtn2" style="flex:1">Mes amis</button><button class="btn ghost" id="demoBtn3" style="flex:1">Voir la démo</button></div></section>`;
}
/* Soirées à code : début et fin prévus */
const dtLocal=t=>{ const d=new Date(t-new Date(t).getTimezoneOffset()*60000); return d.toISOString().slice(0,16) };
function defaultStart(){ const d=new Date(); if(d.getHours()<20){ d.setHours(20,0,0,0); return +d } d.setMinutes(Math.ceil(d.getMinutes()/15)*15,0,0); return +d }
function viewParties(now){
  if(!S.parties) return loading();
  const cur=S.parties.filter(p=>p.endsAt>now-6*H_MS), past=S.parties.filter(p=>p.endsAt<=now-6*H_MS);
  const row=p=>`<button class="scard" data-open="${esc(p.code)}"><div class="sd"><b>${esc(p.name||"Soirée "+p.code)}</b><span>${esc(dShort(p.startsAt))} ${hm(p.startsAt)} → ${p.endsAt-p.startsAt>20*H_MS?esc(dShort(p.endsAt))+" ":""}${hm(p.endsAt)}</span></div><div class="sv"><b>${esc(p.code)}</b><span>${now<p.startsAt?"à venir":now<=p.endsAt?"en cours":"terminée"} · ${p.n} joueur${p.n>1?"s":""}</span></div></button>`;
  const st=S.pStart||defaultStart(), en=S.pEnd||st+8*H_MS;
  return `<section><h2>Mes soirées</h2>${cur.length?`<div class="slist">${cur.map(row).join("")}</div>`:`<p class="muted" style="margin:0">Aucune soirée en cours ou à venir.</p>`}</section>
  <section><h2>Créer une soirée</h2><p class="muted" style="font-size:13px;margin:0">Un code de 4 lettres à partager ; la courbe de la soirée va du début à la fin prévus.</p>
  <div class="field"><span class="label">Nom (facultatif)</span><input id="pName" maxlength="40" placeholder="Anniversaire de Léa" value="${esc(S.pName||"")}"></div>
  <div class="row"><div class="field" style="flex:1;min-width:150px"><span class="label">Début</span><input id="pStart" type="datetime-local" value="${dtLocal(st)}"></div><div class="field" style="flex:1;min-width:150px"><span class="label">Fin</span><input id="pEnd" type="datetime-local" value="${dtLocal(en)}"></div></div>
  <button class="btn" id="create">Créer la soirée</button></section>
  <section><div class="row"><div class="field" style="flex:1;min-width:120px"><span class="label">Rejoindre avec un code</span><input id="joinCode" maxlength="4" autocapitalize="characters" placeholder="ABCD" style="text-transform:uppercase;letter-spacing:.2em"></div><button class="btn ghost" id="join" style="align-self:flex-end">Rejoindre</button></div>
  <div class="row"><button class="btn ghost" id="friendsBtn2" style="flex:1">Mes amis</button><button class="btn ghost" id="demoBtn3" style="flex:1">Voir la démo</button></div></section>
  ${past.length?`<section><h2>Soirées passées</h2><div class="slist">${past.map(row).join("")}</div></section>`:""}`;
}
function bindHub(){
  const on=(id,f)=>{const el=$("#"+id); if(el) el.onclick=f};
  document.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>enterParty(b.dataset.open));
  document.querySelectorAll("[data-htab-go]").forEach(b=>b.onclick=()=>{ openHub(b.dataset.htabGo); window.scrollTo(0,0) });
  document.querySelectorAll("[data-ses]").forEach(b=>b.onclick=()=>{ S.sesOpen=+b.dataset.ses; render(); window.scrollTo(0,0) });
  on("sesBack",()=>{ S.sesOpen=null; render() });
  document.querySelectorAll("[data-nf]").forEach(b=>b.onclick=()=>{ S.nf=b.dataset.nf; render() });
  on("pFormBtn",()=>{ S.pForm=!S.pForm; render() });
  on("alertBtn",()=>{ S.alertOpen=!S.alertOpen; render() }); on("alertClose",()=>{ S.alertOpen=false; render() });
  document.querySelectorAll("[data-cal]").forEach(b=>b.onclick=()=>run(async()=>{ const [y,m]=S.calMonth.split("-").map(Number), d=new Date(y,m-1+(+b.dataset.cal),1); S.calDay=null; await loadCal(d.toLocaleDateString("sv-SE").slice(0,7)); render() }));
  document.querySelectorAll("[data-day]").forEach(b=>b.onclick=()=>{ S.calDay=S.calDay===b.dataset.day?null:b.dataset.day; render() });
  document.querySelectorAll("[data-grp]").forEach(b=>b.onclick=()=>run(async()=>{ S.gid=+b.dataset.grp; S.gEnd=null; S.gLeave=false; render(); await loadGroup(); render(); window.scrollTo(0,0) }));
  on("gBack",()=>{ S.gid=null; S.group=null; hubDirty("groupes"); render() });
  on("gPrev",()=>run(async()=>{ S.gEnd=(S.group.end)-48*H_MS; await loadGroup(); render() }));
  on("gNext",()=>run(async()=>{ const e=S.group.end+48*H_MS; S.gEnd=e>=Date.now()+5*H_MS?null:e; await loadGroup(); render() }));
  on("gCreate",()=>run(async()=>{ const n=$("#gName").value.trim(); if(!n) throw new Error("Donnez un nom au groupe."); const r=await api("POST","/api/groups",{name:n}); S.gid=r.id; S.gEnd=null; await loadHub("groupes"); render(); snack("Groupe créé","Partagez son code pour inviter vos potes.") }));
  on("gJoin",()=>run(async()=>{ const c=$("#gCode").value.trim().toUpperCase(); if(!/^[A-Z2-9]{6}$/.test(c)) throw new Error("Le code de groupe fait 6 caractères."); const r=await api("POST","/api/groups/join",{code:c}); S.gid=r.id; S.gEnd=null; await loadHub("groupes"); render(); snack("Groupe rejoint") }));
  on("gShare",async()=>{ const url=`${location.origin}/?groupe=${S.group.code}`, txt=`Rejoins mon groupe « ${S.group.name} » sur Alamb'hic : ${url}`;
    try{ if(navigator.share){ await navigator.share({title:"Alamb'hic",text:txt}); return } await navigator.clipboard.writeText(txt); snack("Lien copié","Collez-le dans votre conversation.") }catch(e){ snack("Lien du groupe",url) } });
  on("gLeave",()=>{ S.gLeave=true; render() }); on("gLeaveNo",()=>{ S.gLeave=false; render() });
  on("gLeaveYes",()=>run(async()=>{ await api("DELETE",`/api/groups/${S.gid}/me`); S.gid=null; S.group=null; S.gLeave=false; await loadHub("groupes"); render(); snack("Vous avez quitté le groupe") }));
  const ps=$("#pStart"), pe=$("#pEnd"), pn=$("#pName");
  if(ps) ps.onchange=()=>{ const v=+new Date(ps.value); if(v){ const d=(S.pEnd||+new Date(pe.value))-(S.pStart||v); S.pStart=v; S.pEnd=v+(d>0?d:8*H_MS); render() } };
  if(pe) pe.onchange=()=>{ const v=+new Date(pe.value); if(v){ S.pEnd=v; S.pStart=S.pStart||+new Date(ps.value) } };
  if(pn) pn.oninput=()=>{ S.pName=pn.value };
}

/* ---------- rendu ---------- */
const i18nAll=()=>{ I18N.apply($("#app")); I18N.apply(document.querySelector("header")); I18N.apply($("#nav")); I18N.apply($("#demoBar")) };
function render(){
  const app=$("#app"), inParty=demo||(S.screen==="party"&&S.code);
  const ready=!!S.user&&profileReady(S.user), hub=!demo&&ready&&S.screen==="home";
  $("#nav").hidden=!(inParty||hub); $("#navParty").hidden=!inParty; $("#navHub").hidden=!hub; $("#codeChip").hidden=!inParty; $("#demoHdr").hidden=demo||(ready&&!!S.code);
  if(hub){
    document.querySelectorAll("#navHub button").forEach(b=>b.setAttribute("aria-current",b.dataset.htab===S.htab));
    $("#profBtn").hidden=false; $("#friendsBtn").hidden=false; stopFriendsPoll();
    app.innerHTML=viewHub(NOW())+`<p class="note">Taux estimé par la formule de Widmark (eau corporelle de Watson). L'écart avec un éthylotest peut dépasser 0,2 g/L. Ce n'est jamais une autorisation de conduire : après avoir bu, on ne prend pas le volant.</p>`;
    bindOut(); bindMain(); bindHub(); bindCharts(); i18nAll(); return;
  }
  $("#profBtn").hidden=demo||!ready||S.screen==="profile";
  $("#friendsBtn").hidden=demo||!ready||S.screen==="friends";
  if(S.screen!=="friends") stopFriendsPoll();
  if(!inParty||(S.screen==="profile"||S.screen==="docs"||S.screen==="friends"||S.screen==="help")&&!demo){
    if(S.screen==="boot") app.innerHTML=`<section>${loader("Chargement…")}</section>`;
    else if(S.screen==="auth") app.innerHTML=viewAuth();
    else if(S.screen==="profile") app.innerHTML=viewProfile();
    else if(S.screen==="docs") app.innerHTML=viewDocs();
    else if(S.screen==="friends") app.innerHTML=viewFriends();
    else if(S.screen==="help") app.innerHTML=viewHelp();
    else if(S.screen==="forgot") app.innerHTML=viewForgot();
    else if(S.screen==="reset") app.innerHTML=viewReset();
    else app.innerHTML=viewHome();
    bindOut(); if(S.screen==="auth") mountGoogle(); i18nAll(); return;
  }
  $("#codeChip").textContent=demo?"Démo":S.code;
  const {now,list,log}=compute();
  notify(list,log);
  const meP=list.find(p=>p.id===S.me);
  my=meP?{pseudo:meP.pseudo,cap:meP.cap,sam:meP.sam,mealsOk:meP.mealsOk,drinks:meP.drinks}:{pseudo:S.user?.pseudo,cap:S.user?.cap||0.8,drinks:[]};
  document.querySelectorAll("#navParty button").forEach(b=>b.setAttribute("aria-current",b.dataset.tab===S.tab));
  if(S.tab==="fil") feedUnread=0;
  $("#feedN").hidden=!feedUnread; $("#feedN").textContent=feedUnread;
  let h=S.err?`<div class="banner" style="margin-top:14px">${esc(S.err)}</div>`:"";
  if(!demo&&!S.snap) h+=`<section>${loader("Chargement de la soirée…")}</section>`;
  else{
    noAdd=false;
    if(S.tab==="moi"&&!demo&&S.snap){ const sa=S.snap.startsAt, ea=S.snap.endsAt;
      if(now<sa-H_MS){ noAdd=true; h+=`<section><div class="card"><b>La soirée commence ${esc(dLong(sa))} à ${hm(sa)}</b><span class="muted" style="font-size:13px">D'ici là, vos verres se notent depuis l'accueil (onglet Moi) et ne comptent pas dans la soirée.</span></div></section>` }
      else if(now>ea){ noAdd=true; h+=`<section><div class="card"><b>Soirée terminée ${esc(dLong(ea))} à ${hm(ea)}</b><span class="muted" style="font-size:13px">Vos verres se notent maintenant depuis l'accueil (onglet Moi).</span><button class="btn ghost small" data-htab-go="moi" style="align-self:flex-start">Aller à l'accueil</button></div></section>` } }
    if(S.tab==="moi") h+= meP?viewMe(meP,now):"";
    if(S.tab==="courbes") h+=viewChart(list,now,demo?{}:{t0:S.snap.startsAt,t1:S.snap.endsAt,title:S.snap.name?"Courbes · "+S.snap.name:"Courbes de la soirée"});
    if(S.tab==="classement") h+=viewRank(list,now);
    if(S.tab==="fil") h+=viewFeed(list,log);
    if(S.tab==="moi"&&!demo) h+=viewShare(meP);
    if(S.tab==="moi"&&!demo) h+=`<section><div class="card"><span class="label">${S.snap.name?esc(S.snap.name)+" · ":""}${esc(dShort(S.snap.startsAt))} ${hm(S.snap.startsAt)} → ${hm(S.snap.endsAt)}</span><span class="label" style="margin-top:6px">Code de la soirée</span><div class="row" style="justify-content:space-between;margin-top:6px"><b style="font-family:var(--display);font-size:30px;letter-spacing:.15em">${esc(S.code)}</b><button class="btn ghost small" id="copyCode">Copier l'invitation</button></div><p class="muted" style="font-size:13px;margin:8px 0 0">Vos amis ouvrent Alamb'hic et entrent ce code.</p></div></section>`;
  }
  h+=`<p class="note">Taux estimé par la formule de Widmark (eau corporelle de Watson). L'écart avec un éthylotest peut dépasser 0,2 g/L. Ce n'est jamais une autorisation de conduire : après avoir bu, on ne prend pas le volant.</p>`;
  app.innerHTML=h; bindMain(); bindHub(); bindCharts(); i18nAll();
}
function viewFeed(list,log){
  const all=list.flatMap(p=>p.ev).concat(log||[]).sort((a,b)=>b.t-a.t);
  return `<section><h2>Fil de la soirée</h2>${all.length?all.map(e=>`<div class="ev ${e.kind}"><span class="t">${hm(e.t)}</span><div><b>${esc(e.title)}</b><span class="muted" style="font-size:13px">${esc(e.text)}</span></div></div>`).join(""):`<p class="muted">Les titres et alertes de chacun s'affichent ici et en notification sur tous les téléphones de la soirée.</p>`}</section>`;
}

/* ---------- actions ---------- */
async function run(fn){ S.err=""; try{ await fn() }catch(e){ if(e.status===401){S.user=null;S.screen="auth"} S.err=e.message; render() } }
function readProfile(){const v=id=>$("#"+id).value.trim();return{pseudo:v("pseudo"),sex:v("sex"),age:+v("age"),height:+v("height"),weight:+v("weight"),cap:+v("cap")}}
async function loadWeek(){ try{ S.week=await api("GET","/api/me/week") }catch(e){} }
function bindOut(){
  const on=(id,f)=>{const el=$("#"+id); if(el) el.onclick=f};
  on("mLogin",()=>{S.authMode="login";S.err="";render()}); on("mReg",()=>{S.authMode="register";S.err="";render()});
  const f=$("#authForm"); if(f){ f.oninput=()=>{S.fEmail=$("#email").value;S.fConsent=!!$("#consent")?.checked}; f.onchange=f.oninput }
  if(f) f.onsubmit=e=>{e.preventDefault(); S.fEmail=$("#email").value; S.fConsent=!!$("#consent")?.checked; const pw=$("#pass").value;
    if(S.authMode==="register"&&!S.fConsent){ flash("Case à cocher","Cochez la case d'acceptation pour créer votre compte."); $("#consent").focus(); return }
    run(async()=>{
    await api("POST",S.authMode==="register"?"/api/auth/register":"/api/auth/login",{email:S.fEmail,password:pw}); await afterLogin() })};
  on("demoBtn",startDemo);
  on("saveProf",()=>run(async()=>{ S.fProf=readProfile(); const r=await api("PUT","/api/me",S.fProf); S.user=r.user; S.fProf=null; await loadWeek(); S.screen=S.code?"party":"home"; render(); if(S.code) refresh() }));
  on("back",()=>{S.err="";S.fProf=null;S.screen=S.code?"party":"home";render()});
  /* aide, mot de passe oublié, langue, badges, notifications */
  on("helpBtn",openHelp); on("helpBtn2",openHelp);
  on("helpBack",()=>{S.err="";S.helpAns=null;S.screen=S.prevScreen&&S.prevScreen!=="help"?S.prevScreen:(S.user?(S.code?"party":"home"):"auth");render()});
  const hf=$("#helpForm"); if(hf) hf.onsubmit=e=>{e.preventDefault(); const v=$("#helpQ").value.trim(); if(!v) return; S.helpQ=v;
    run(async()=>{ S.helpAns={answer:null,found:[],wait:1}; S.helpAns=await api("POST","/api/help/ask",{q:v,lang:I18N.lang}); render() })};
  on("forgotBtn",()=>{S.err="";S.forgotSent=false;S.screen="forgot";render()});
  on("toLogin",()=>{S.err="";S.screen="auth";S.authMode="login";history.replaceState(null,"","/");render()});
  const fg=$("#forgotForm"); if(fg) fg.onsubmit=e=>{e.preventDefault(); S.fEmail=$("#fgEmail").value.trim(); run(async()=>{ await api("POST","/api/auth/forgot",{email:S.fEmail}); S.forgotSent=true; render() })};
  const rs=$("#resetForm"); if(rs) rs.onsubmit=e=>{e.preventDefault(); const pw=$("#rsPass").value; run(async()=>{ await api("POST","/api/auth/reset",{token:S.resetTok,password:pw}); S.resetTok=null; history.replaceState(null,"","/"); flash("Mot de passe changé","Vous êtes connecté."); await afterLogin() })};
  document.querySelectorAll("[data-lang]").forEach(b=>b.onclick=()=>{ I18N.set(b.dataset.lang); render() });
  const lsel=$("#langSel"); if(lsel) lsel.onchange=()=>{ I18N.set(lsel.value); api("PUT","/api/me/lang",{lang:lsel.value}).catch(()=>{}); render() };
  on("pushOn",()=>run(async()=>{ await enablePush(); await loadNotifs(); render(); snack("Notifications activées","Vous les recevrez même appli fermée.") }));
  on("pushOff",()=>run(async()=>{ await disablePush(); await loadNotifs(); render(); snack("Notifications coupées sur cet appareil") }));
  on("pushTest",()=>run(async()=>{ const r=await api("POST","/api/push/test"); snack(r.sent?"Notification de test envoyée":"Aucun appareil joignable",r.sent?"Elle doit apparaître dans quelques secondes.":"Réactivez les notifications.",{err:!r.sent}) }));
  const xs=$("#exprSel"); if(xs) xs.onchange=async()=>{ const old=S.notifs.expr; try{ await api("PUT","/api/me/notifs",{prefs:{expr:xs.value}}); S.notifs.expr=xs.value; snack("Réglage enregistré") }catch(e){ xs.value=old; snack("Réglage non enregistré",e.message,{err:1}) } };
  document.querySelectorAll("[data-nc]").forEach(c=>c.onchange=async()=>{ try{ await api("PUT","/api/me/notifs",{prefs:{[c.dataset.nc]:c.checked}}); S.notifs.prefs[c.dataset.nc]=c.checked; snack("Réglage enregistré") }catch(e){ c.checked=!c.checked; snack("Réglage non enregistré",e.message,{err:1}) } });
  on("openDocs",openDocs); on("friendsBtn2",openFriends); on("demoBtn2",startDemo); on("demoBtn3",startDemo); bindFriends();
  on("logout",()=>run(async()=>{ await api("POST","/api/auth/logout"); closeWs(); Object.assign(S,{user:null,code:null,snap:null,screen:"auth"}); render() }));
  on("leave",()=>run(async()=>{ await api("POST",`/api/parties/${S.code}/leave`); closeWs(); S.code=null; S.snap=null; S.screen="home"; render() }));
  on("delAcc",()=>{$("#delConfirm").hidden=false}); on("delNo",()=>{$("#delConfirm").hidden=true});
  on("delYes",()=>run(async()=>{ await api("DELETE","/api/me"); closeWs(); Object.assign(S,{user:null,code:null,snap:null,screen:"auth"}); render(); flash("Compte supprimé","Toutes vos données ont été effacées.") }));
  on("create",()=>run(async()=>{ const ps=$("#pStart"), pe=$("#pEnd"), st=ps?+new Date(ps.value):Date.now(), en=pe?+new Date(pe.value):st+10*3600e3;
    if(!st||!en) throw new Error("Indiquez le début et la fin de la soirée."); if(en<=st) throw new Error("La fin doit être après le début.");
    const r=await api("POST","/api/parties",{name:($("#pName")?.value||"").trim(),startsAt:st,endsAt:en}); S.pName="";S.pStart=S.pEnd=null; hubDirty("soirees"); enterParty(r.code) }));
  on("join",()=>run(async()=>{ const c=$("#joinCode").value.trim().toUpperCase(); if(!/^[A-Z]{4}$/.test(c)) throw new Error("Le code de soirée fait 4 lettres."); const r=await api("POST",`/api/parties/${c}/join`); enterParty(r.code) }));
}
/* Ajout d'un verre : état « envoi » immédiat, coche verte quand c'est enregistré, puis bandeau avec Annuler. */
const pend={};
function setPend(k,v,ms){ if(v) pend[k]=v; else delete pend[k]; render(); if(ms) setTimeout(()=>{ if(pend[k]===v){ delete pend[k]; render() } },ms) }
async function addDrink(d,key,rect,noPop){
  key=key??d.l; if(pend[key]==="sending") return;
  if(!noPop&&needMealPop(d)){ S.mealPop={d,key,rect,kind:guessKind(),t:""}; render(); return }
  const a=ago, when=NOW()-a*MIN;
  if(demo){ const p=demoPlayers[S.me]; p.drinks=[...p.drinks,{id:when,t:when,l:d.l,ml:d.ml,abv:d.abv,...(d.water?{water:1}:{})}]; ago=0;
    buzz(25); setPend(key,"ok",1300); if(!d.water) flyDrop(rect); snack("Verre enregistré",`${d.l} · ${hm(when)}`,{undo:()=>{p.drinks=p.drinks.filter(x=>x.id!==when);render();snack("Verre retiré")}}); return }
  setPend(key,"sending");
  try{
    const r=await api("POST","/api/me/drinks",{label:d.l,ml:d.ml,abv:d.abv,agoMin:a}); hubDirty("soirees","agenda");
    ago=0; buzz(25); setPend(key,"ok",1300); if(!d.water) flyDrop(rect);
    snack("Verre enregistré",`${d.l} · ${hm(r.t||when)}`,{undo:async()=>{ try{ await api("DELETE",`/api/me/drinks/${r.id}?undo=1`); snack("Verre retiré"); refresh() }catch(e){ snack("Impossible d'annuler",e.message,{err:1}) } }});
    refresh();
  }catch(e){ setPend(key,null); snack("Verre non enregistré",e.message,{err:1}); buzz([40,60,40]) }
}
function bindMain(){
  document.querySelectorAll("[data-p]").forEach(b=>b.onclick=()=>addDrink(PRESETS[+b.dataset.p],"p"+b.dataset.p,b.getBoundingClientRect()));
  document.querySelectorAll("#ago button").forEach(b=>b.onclick=()=>{ago=+b.dataset.v;render()});
  bindMeals(); bindPlace(); bindMealPop(); animateGauge(); rememberStates();
  document.querySelectorAll("[data-tk]").forEach(e=>{const [id,k]=e.dataset.tk.split("|");trendPrev[id]=k});
  document.querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>{S.rankMode=b.dataset.rm;render()});
  const ca=$("#cadd"); if(ca) ca.onclick=()=>{const ml=parseFloat($("#cml").value.replace(",","."))*10, abv=parseFloat($("#cabv").value.replace(",","."));if(!(ml>0&&ml<=1000&&abv>=0&&abv<=80)){flash("Verre incomplet","Indiquez un volume en cl et un degré entre 0 et 80 %.");return}addDrink({l:abv?"Verre perso":"Sans alcool",ml,abv,water:abv?0:1},"perso")};
  document.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{ const id=+b.dataset.del;
    if(demo){const p=demoPlayers[S.me];p.drinks=p.drinks.filter(d=>d.id!==id);render();snack("Verre supprimé");return}
    b.disabled=true; b.closest(".item")?.classList.add("leaving");
    api("DELETE",`/api/me/drinks/${id}`).then(()=>{ hubDirty("soirees","agenda"); snack("Verre supprimé",S.screen==="party"?"visible dans le fil de la soirée":""); refresh() })
      .catch(e=>{ b.disabled=false; b.closest(".item")?.classList.remove("leaving"); snack("Suppression impossible",e.message,{err:1}) }) });
  /* écran TV et récap */
  const tvo=$("#tvOn"); if(tvo) tvo.onclick=()=>run(async()=>{ S.tv=await api("POST",`/api/parties/${S.code}/tv`); render() });
  document.querySelectorAll("[data-tv]").forEach(b=>b.onclick=async()=>{ try{ const r=await api("PUT",`/api/parties/${S.code}/tv`,{view:b.dataset.tv}); S.tv.view=r.view; render() }catch(e){ snack("Télécommande",e.message,{err:1}) } });
  const ro=$("#recapOn"); if(ro) ro.onclick=()=>run(async()=>{ const r=await api("POST",`/api/parties/${S.code}/recap`); S.recap=r.url; render();
    const url=location.origin+r.url, txt=`Le récap de notre soirée Alamb'hic : ${url}`;
    try{ if(navigator.share){ await navigator.share({title:"Alamb'hic",text:txt}); return } await navigator.clipboard.writeText(url); snack("Lien du récap copié","Collez-le dans votre groupe.") }catch(e){ snack("Lien du récap",url) } });
  const rk=$("#recapOk"); if(rk) rk.onchange=async()=>{ try{ await api("PUT",`/api/parties/${S.code}/recap-ok`,{ok:rk.checked}); snack(rk.checked?"Vous apparaîtrez dans le récap":"Vous n'apparaîtrez pas dans le récap") }catch(e){ rk.checked=!rk.checked; snack("Réglage non enregistré",e.message,{err:1}) } };
  const rd=$("#recapDel"); if(rd) rd.onclick=()=>run(async()=>{ await api("DELETE",`/api/parties/${S.code}/recap`); S.recap=null; render(); snack("Lien du récap supprimé","Il ne s'ouvre plus.") });
  const sm=$("#samT"); if(sm) sm.onchange=()=>run(async()=>{ await api("PUT",`/api/parties/${S.code}/me`,{sam:sm.checked}); await refresh() });
  const cc=$("#copyCode"); if(cc) cc.onclick=async()=>{ const txt=`Rejoins ma soirée Alamb'hic avec le code ${S.code} : ${location.origin}`;
    try{ if(navigator.share){await navigator.share({title:"Alamb'hic",text:txt});return} await navigator.clipboard.writeText(txt); flash("Invitation copiée","Collez-la dans votre groupe.") }catch(e){ flash("Code de la soirée",txt) } };
}

/* ---------- soirée en direct ---------- */
async function refresh(){ if(demo) return; if(S.screen==="home"){ try{ await loadLive() }catch(e){ S.err=e.message } render(); return } if(!S.code) return; try{ S.snap=await api("GET",`/api/parties/${S.code}`); render() }catch(e){ if(e.status===403){S.code=null;S.snap=null;S.screen="home";closeWs()} S.err=e.message; render() } }
function enterParty(code){
  S.code=code; S.snap=null; S.screen="party"; S.tab="moi"; feedUnread=0; S.tv=null; S.recap=null;
  seen=new Set(ls.get("yd_seen_"+code,[])); bootT=Date.now();
  render(); loadMeals().then(refresh); openWs(); if(!S.cal) loadCal().then(()=>{ if(S.screen==="party") render() }).catch(()=>{});
}
function closeWs(){ if(S.ws){ S.ws.onclose=null; S.ws.close(); S.ws=null } }
function openWs(){
  closeWs(); if(!S.code) return;
  const ws=new WebSocket(`${location.protocol==="https:"?"wss":"ws"}://${location.host}/ws?code=${S.code}`);
  S.ws=ws;
  ws.onopen=()=>{S.wsTry=0};
  ws.onmessage=e=>{ try{ const m=JSON.parse(e.data); if(m.type==="party"&&!demo){ S.snap=m.data; if(document.activeElement&&/INPUT|SELECT/.test(document.activeElement.tagName)) return; render() } }catch(_){} };
  ws.onclose=()=>{ S.ws=null; if(!S.code) return; const d=Math.min(30000,1000*2**S.wsTry++); setTimeout(()=>{ if(S.code&&!S.ws){ refresh(); openWs() } },d) };
}
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible"&&S.code&&!demo){ refresh(); if(!S.ws) openWs() } });

/* ---------- Google ---------- */
function mountGoogle(){
  const el=$("#gbtn"); if(!el||!S.cfg.googleClientId) return;
  const go=()=>{ try{ google.accounts.id.initialize({client_id:S.cfg.googleClientId,callback:r=>run(async()=>{await api("POST","/api/auth/google",{credential:r.credential});await afterLogin()})});
    google.accounts.id.renderButton(el,{theme:"filled_blue",size:"large",text:"continue_with",locale:I18N.lang,shape:"pill",logo_alignment:"left",width:Math.min(320,el.clientWidth||320)}) }catch(e){} };
  if(window.google?.accounts) return go();
  if(!document.getElementById("gsi")){ const s=document.createElement("script"); s.id="gsi"; s.src="https://accounts.google.com/gsi/client"; s.async=true; s.onload=go; document.head.appendChild(s) }
}

/* ---------- démarrage ---------- */
async function afterLogin(){
  const r=await api("GET","/api/me"); S.user=r.user; S.me=r.user.id; S.err="";
  if(r.user.lang&&r.user.lang!==I18N.lang) I18N.set(r.user.lang); else if(!r.user.lang) api("PUT","/api/me/lang",{lang:I18N.lang}).catch(()=>{});
  if(!profileReady(S.user)){ S.screen="profile"; render(); return }
  loadWeek().then(()=>{ if(S.screen==="home") render() }); loadBadges(); loadPlace().then(()=>render());
  const c=await api("GET","/api/parties/current");
  if(S.pendingGroup){ try{ const g=await api("POST","/api/groups/join",{code:S.pendingGroup}); S.gid=g.id; S.pendingGroup=null; ls.set("yd_grp",""); openHub("groupes"); snack("Groupe rejoint","Vous voyez maintenant les courbes de ses membres."); return }catch(e){ S.pendingGroup=null; ls.set("yd_grp",""); snack("Groupe",e.message,{err:1}) } }
  if(c.code) enterParty(c.code); else openHub("moi");
  if(ls.get("yd_ami","")){ openFriends(); snack("Invitation d'un ami","Touchez « Ajouter » pour l'ajouter") }
}

/* ---------- démo ---------- */

const DEMO=self.DEMO_DATA;
let demoSaved=null;
function startDemo(){
  demoSaved={me:S.me,tab:S.tab}; demo=true;
  const d=new Date(); d.setHours(19,0,0,0); demoStart=d.getTime(); demoT=demoStart; demoSeen=new Set();
  demoPlayers={}; DEMO.forEach(x=>{demoPlayers[x.id]={id:x.id,pseudo:x.pseudo,sex:x.sex,age:x.age,height:x.height,weight:x.weight,cap:x.cap,sam:!!x.sam,mealsOk:true,joined:demoStart,meals:(x.meals||[]).map(([m,k])=>({t:demoStart+m*MIN,kind:k})),
    drinks:x.d.map(([m,i])=>{const P=PRESETS[i];const t=demoStart+m*MIN;return{id:t,t,l:P.l,ml:P.ml,abv:P.abv,...(P.water?{water:1}:{})}})}});
  S.me="demo-lea"; S.tab="moi"; feedUnread=0;
  $("#demoRange").value=0; $("#demoBar").hidden=false; document.body.classList.add("isdemo"); setDemo(0);
  if(!ls.get("yd_tour",0)) setTimeout(()=>tour(0),500);
}
/* Visite guidée : 5 bulles par-dessus la démo, au premier lancement puis avec le bouton « Visite ». */
const TOUR=[
  [".merow","Votre avatar, la jauge alambic et votre taux estimé : ils évoluent en direct à chaque verre et à chaque repas."],
  [".drinks","Touchez une boisson pour l'enregistrer. L'eau compte aussi : trois verres d'eau débloquent le Chameau."],
  ["#demoRange","Faites avancer la soirée avec ce curseur, ou touchez « Lecture » : les titres tombent et les avatars changent."],
  ["nav button[data-tab=classement]","Courbes : tout le groupe sur un même graphique. Potes : taux en direct et tendance façon bourse."],
  ["nav button[data-tab=fil]","Le fil garde tous les titres et les alertes de la soirée. Amusez-vous bien, et on ne conduit pas après avoir bu !"]];
let tourI=-1;
function tour(i){
  document.querySelectorAll(".tour-hole,.tour-tip").forEach(e=>e.remove());
  if(i<0||i>=TOUR.length){ tourI=-1; ls.set("yd_tour",1); return }
  tourI=i; stopPlay(); clearToasts(); if(S.tab!=="moi"&&i<2){S.tab="moi";render()}
  const [sel,txt]=TOUR[i], el=document.querySelector(sel); if(!el) return tour(i+1);
  el.scrollIntoView({block:"center",behavior:REDUCE?"auto":"smooth"});
  setTimeout(()=>{ if(tourI!==i) return; const r=el.getBoundingClientRect(), pad=6;
    const h=document.createElement("div"); h.className="tour-hole"; Object.assign(h.style,{left:r.left-pad+"px",top:r.top-pad+"px",width:r.width+pad*2+"px",height:r.height+pad*2+"px"});
    const t=document.createElement("div"); t.className="tour-tip"; t.setAttribute("role","dialog");
    t.innerHTML=`<span class="step">Visite ${i+1} / ${TOUR.length}</span><p style="margin:0">${esc(txt)}</p><div class="row"><button class="link" id="tourSkip">Passer</button><button class="btn small" id="tourNext">${i===TOUR.length-1?"Terminer":"Suivant"}</button></div>`;
    document.body.append(h,t); I18N.apply(t);
    const below=r.bottom+170<innerHeight; t.style.top=below?(r.bottom+pad+10)+"px":"auto"; t.style.bottom=below?"auto":(innerHeight-r.top+pad+10)+"px";
    t.querySelector("#tourNext").onclick=()=>tour(i+1); t.querySelector("#tourSkip").onclick=()=>tour(-1); t.querySelector("#tourNext").focus();
  },REDUCE?0:350);
}
addEventListener("resize",()=>{ if(tourI>=0) tour(tourI) });
function clearToasts(){ TQ.length=0; clearTimeout(tTimer); tShown=null; $("#toasts").innerHTML="" }
function setDemo(min){ if(!demoTimer) clearToasts(); demoT=demoStart+min*MIN; $("#demoClock").textContent=hm(demoT); render() }
function stopPlay(){ if(demoTimer){clearInterval(demoTimer);demoTimer=null} $("#demoPlay").textContent=I18N.t("Lecture") }
$("#demoHdr").onclick=()=>{ if(!demo) startDemo() };
$("#demoRange").oninput=e=>{stopPlay();setDemo(+e.target.value)};
$("#demoPlay").onclick=()=>{ if(demoTimer){stopPlay();return}
  const r=$("#demoRange"); if(+r.value>=+r.max) r.value=0;
  $("#demoPlay").textContent=I18N.t("Pause");
  demoTimer=setInterval(()=>{ const v=Math.min(+r.max,+r.value+5); r.value=v; setDemo(v); if(v>=+r.max) stopPlay() },450) };
$("#demoTour").onclick=()=>tour(0);
$("#demoQuit").onclick=()=>{ tour(-1); stopPlay(); demo=false; $("#demoBar").hidden=true; document.body.classList.remove("isdemo");
  S.me=demoSaved.me; S.tab=demoSaved.tab; feedUnread=0; clearToasts(); hideSnack(); render() };

document.querySelectorAll("#navParty button").forEach(b=>b.onclick=()=>{S.tab=b.dataset.tab;render();window.scrollTo(0,0)});
document.querySelectorAll("#navHub button").forEach(b=>b.onclick=()=>{ if(S.htab===b.dataset.htab){ S.sesOpen=null; S.gid=null } openHub(b.dataset.htab); window.scrollTo(0,0) });
$("#codeChip").onclick=()=>{ if(demo) return; openHub("soirees") };
function openDocs(){S.err="";S.screen="docs";render();api("GET","/api/docs").then(d=>{S.docs=d;render()}).catch(e=>{S.err=e.message;S.screen=S.code?"party":"home";render()})}
$("#friendsBtn").onclick=openFriends;
$("#profBtn").onclick=()=>{S.err="";S.screen="profile";Promise.all([loadWeek(),loadBadges(),loadNotifs()]).then(render);render()};
setInterval(()=>{ if(document.activeElement&&/INPUT|SELECT/.test(document.activeElement.tagName)) return; if(S.screen==="party"||demo) render() },30000);
if("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(()=>{});

try{ const g=new URLSearchParams(location.search).get("groupe"); if(g&&/^[A-Za-z2-9]{6}$/.test(g)){ ls.set("yd_grp",g.toUpperCase()); history.replaceState(null,"","/") } S.pendingGroup=ls.get("yd_grp","")||null }catch(e){}
try{ const rt=new URLSearchParams(location.search).get("reset"); if(rt){ S.resetTok=rt.slice(0,80) } }catch(e){}
try{ const a=new URLSearchParams(location.search).get("ami"); if(a){ ls.set("yd_ami",a.toUpperCase().slice(0,6)); history.replaceState(null,"","/") } }catch(e){}
(async function init(){
  render();
  try{ S.cfg=await api("GET","/api/config") }catch(e){}
  if(S.resetTok){ S.screen="reset"; render(); return }
  try{ await afterLogin() }catch(e){ S.screen="auth"; S.err=e.status===401?"":e.message; render() }
  try{ if(new URLSearchParams(location.search).get("amis")&&S.user){ history.replaceState(null,"","/"); openFriends() } }catch(e){}
})();
