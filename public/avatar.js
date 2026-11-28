/* Alamb'hic — avatar qui évolue avec le taux estimé (10 stades, style « portrait dans un cercle »).
   Dépend de NOW() et MIN (app.js ou page de test). */
"use strict";
let AVN=0;
const cl=(v,a=0,z=1)=>Math.max(a,Math.min(z,v));
/* seuils des stades 1 à 9 (g/L) ; stade 9 = KO (≥ 1,5) */
const AV_T=[0.05,0.2,0.35,0.5,0.65,0.8,1.0,1.2,1.5];
const AV_RING=["#3fbf8a","#8fc63a","#cfd03c","#f2b233","#f28a2a","#f2662a","#ee4436","#e83a52","#e5386b","#e0306f"];
/* noms des stades, identiques pour tous les joueurs (indépendants du plafond perso) */
const AV_NAMES=["En forme","Premier verre","Détendu","Pompette","Éméché","Fou rire","Hilare","Ça tourne","Les étoiles","KO"];
function avStage(b){ let s=0; for(const t of AV_T) if(b>=t) s++; return s }
function drinkKind(d){
  if(!d) return null; if(d.water) return "water";
  const l=d.l||""; if(/Bi|Pinte|Cidre/.test(l)) return "beer"; if(/Champ/.test(l)) return "champ"; if(/Vin/.test(l)) return "wine";
  if(/Shot/.test(l)) return "shot"; if(/Cocktail/.test(l)) return "cocktail"; return d.abv>=20?"shot":"wine";
}
function heldGlass(k){
  const G={
   beer:'<path d="M96 62h15l-1.5 23h-12z" fill="#e9a33a" stroke="#3a2216" stroke-width="1"/><path d="M96 62h15l-.4 5h-14.2z" fill="#fff6dd"/><circle cx="99" cy="61.5" r="2.6" fill="#fff6dd"/><circle cx="104" cy="60.8" r="3" fill="#fff6dd"/><circle cx="108.5" cy="61.6" r="2.4" fill="#fff6dd"/><path d="M111 67q5 1 4 7q-.5 4-4.6 4" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1.6"/><path d="M98.5 70v12" stroke="rgba(255,255,255,.35)" stroke-width="1.4"/>',
   wine:'<path d="M96.5 60h14q.3 13-7 13.6q-7.3-.6-7-13.6z" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.7)" stroke-width=".9"/><path d="M97 66h13q-.8 7-6.5 7.4q-5.7-.4-6.5-7.4z" fill="#8c1d32"/><path d="M103.5 73.6v10M99 84h9" stroke="rgba(255,255,255,.75)" stroke-width="1.2" stroke-linecap="round"/>',
   champ:'<path d="M100 58h7l-.6 15h-5.8z" fill="#f4d47c" stroke="rgba(255,255,255,.7)" stroke-width=".9"/><circle cx="102.5" cy="66" r=".7" fill="#fff"/><circle cx="104.4" cy="62" r=".6" fill="#fff"/><path d="M103.5 73v11M99.5 84h8" stroke="rgba(255,255,255,.75)" stroke-width="1.2" stroke-linecap="round"/>',
   shot:'<path d="M98 72h11l-1.2 12h-8.6z" fill="rgba(255,255,255,.2)" stroke="rgba(255,255,255,.7)" stroke-width=".9"/><path d="M98.6 76h9.8l-.8 7.6h-8.2z" fill="#d68a2e"/>',
   cocktail:'<path d="M95 60h17l-8.5 11z" fill="#ef6fa6" stroke="rgba(255,255,255,.7)" stroke-width=".9"/><circle cx="109" cy="59" r="3" fill="#ffd34d"/><path d="M103.5 71v13M99.5 84h8" stroke="rgba(255,255,255,.75)" stroke-width="1.2" stroke-linecap="round"/><path d="M98 54l7 9" stroke="#5bc88a" stroke-width="1.2"/>',
   water:'<path d="M97 62h13l-1.4 22h-10.2z" fill="rgba(140,200,255,.22)" stroke="#8fd0ff" stroke-width="1"/><path d="M97.6 68h11.8l-1 15.6h-9.8z" fill="#5ab0ff" opacity=".65"/><path d="M99.5 70v11" stroke="rgba(255,255,255,.5)" stroke-width="1.2"/>'};
  return G[k]||"";
}
const AV_CSS=`<style>.av-p{transform-box:view-box;transform-origin:60px 116px;animation:avsw 3.4s ease-in-out infinite}
@keyframes avsw{0%,100%{rotate:calc(var(--sw,0deg) * -1)}50%{rotate:var(--sw,0deg)}}
.av-fl{animation:avfl 2.8s ease-in-out infinite}.av-fl2{animation:avfl 3.6s ease-in-out -1.2s infinite}
@keyframes avfl{50%{transform:translateY(-3px)}}
.av-wb{transform-box:view-box;transform-origin:60px 28px;animation:avwb 2.4s ease-in-out infinite}
@keyframes avwb{0%,100%{rotate:-7deg}50%{rotate:7deg}}
.av-sp{transform-box:fill-box;transform-origin:center;animation:avsp 3s linear infinite}@keyframes avsp{to{rotate:360deg}}
@media (prefers-reduced-motion:reduce){.av-p,.av-fl,.av-fl2,.av-wb,.av-sp{animation:none}}</style>`;

function avatar(p,size){
  const n=++AVN, s=p.sim||{cur:0,prev:0,peak:0}, b=s.cur, c=p.color||"#2f8cff", st=avStage(b);
  const ko=st>=9, down=s.peak>=0.3&&b<s.prev-0.004;
  const now=NOW(), last=(p.drinks||[]).filter(d=>d.t<=now).sort((x,y)=>y.t-x.t)[0];
  const k=ko?null:(last&&now-last.t<25*MIN?drinkKind(last):(down?"water":null));
  const INK="#2b1810", SK="#f3c39e", SKD="#df9f78", SKL="#fbd9bc", HAIR="#4b2b18", HAIRL="#7a4a2a", ring=AV_RING[st];
  /* ---- paramètres par stade ---- */
  const LID=[.08,.1,.38,.55,.62,0,0,.62,.84,1][st], SLANT=[0,0,0,.6,2,0,0,2.4,1.8,0][st];
  const happy=st===5||st===6, sleep=st===9;
  const BROW=[[-2.6,-2.6],[-2.2,-2.2],[0,0],[.6,-1],[1.6,-1.2],[-2.4,-2.4],[-2.2,-2.2],[1.4,-1.8],[1.2,-2],[1,-1.4]][st]; /* [extérieur, intérieur] */
  const tilt=[0,0,-2,-4,-6,5,-7,-9,9,0][st];
  const blush=cl((b-0.15)/0.6), nose=cl((b-0.3)/0.6)*0.8, flush=cl((b-0.9)/0.7)*0.26;
  const EY=57;
  const almond=x=>`M${x-5.8} ${EY}C${x-4.2} ${EY-5.2} ${x+4.2} ${EY-5.2} ${x+5.8} ${EY}C${x+4.2} ${EY+3.9} ${x-4.2} ${EY+3.9} ${x-5.8} ${EY}Z`;
  const eye=(x,side)=>{
    if(happy) return `<path d="M${x-5.4} ${EY+1}Q${x} ${EY-5.4} ${x+5.4} ${EY+1}" fill="none" stroke="${INK}" stroke-width="2.3" stroke-linecap="round"/>`;
    if(sleep) return `<path d="M${x-5.4} ${EY-.6}Q${x} ${EY+4.2} ${x+5.4} ${EY-.6}" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/><path d="M${x-3} ${EY+2.6}l-.6 1.6M${x} ${EY+3.2}v1.7M${x+3} ${EY+2.6}l.6 1.6" stroke="${INK}" stroke-width="1" stroke-linecap="round"/>`;
    const ly=EY-5+LID*9.6, out=x+side*6.2, inn=x-side*6.2, px=st>=7?side*-0.9:0;
    return `<path d="${almond(x)}" fill="#fffdf8"/>
    <g clip-path="url(#ec${side<0?"l":"r"}${n})">
     <path d="${almond(x)}" fill="#ff7a6a" opacity="${(cl((b-0.6)/0.8)*0.35).toFixed(2)}"/>
     <circle cx="${x+px}" cy="${EY+.2}" r="3.7" fill="url(#ir${n})"/><circle cx="${x+px}" cy="${EY+.2}" r="1.8" fill="#170b05"/>
     <circle cx="${x+px+1.3}" cy="${EY-1.2}" r="1.15" fill="#fff"/><circle cx="${x+px-1.2}" cy="${EY+1.5}" r=".55" fill="#fff" opacity=".8"/>
     <path d="M${x-7} ${EY-7}H${x+7}L${out} ${(ly+SLANT).toFixed(1)}Q${x} ${(ly+1.4).toFixed(1)} ${inn} ${(ly-SLANT*0.3).toFixed(1)}Z" fill="${SK}"/>
     <path d="M${inn} ${(ly-SLANT*0.3).toFixed(1)}Q${x} ${(ly+1.4).toFixed(1)} ${out} ${(ly+SLANT).toFixed(1)}" fill="none" stroke="${INK}" stroke-width="1.5" opacity="${LID>0.15?1:0}"/>
    </g>
    <path d="M${x-5.8} ${EY}C${x-4.2} ${EY-5.2} ${x+4.2} ${EY-5.2} ${x+5.8} ${EY}" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M${x-4.4} ${EY+2.7}C${x-2} ${EY+4.1} ${x+2} ${EY+4.1} ${x+4.4} ${EY+2.7}" fill="none" stroke="${INK}" stroke-width=".8" opacity=".45"/>
    ${st>=4?`<path d="M${x-4} ${EY+5.2}q4 ${(1.3+b).toFixed(1)} 8 0" fill="none" stroke="#9a5a6a" stroke-opacity="${cl((b-0.4)/1).toFixed(2)}" stroke-width="1"/>`:""}`;
  };
  const [bo,bi]=BROW, br=(x0,x1,yo,yi)=>{ const mx=(x0+x1)/2, my=Math.min(yo,yi)-2.4;
    return `<path d="M${x0} ${yo+.6}Q${mx} ${my} ${x1} ${yi-.4}Q${x1+(x1>x0?.8:-.8)} ${yi+1.4} ${x1-(x1>x0?.4:-.4)} ${yi+2.2}Q${mx} ${my+2.8} ${x0} ${yo+1.6}Z" fill="${HAIR}" stroke="${HAIR}" stroke-width=".6" stroke-linejoin="round"/>` };
  const brows=br(43.5,55,48+bo,48+bi)+br(76.5,65,48+bo,48+bi);
  /* bouches : forme ouverte (avec dents et langue découpées dedans) ou trait */
  const open=(d,teeth,tongue)=>`<clipPath id="mc${n}"><path d="${d}"/></clipPath><path d="${d}" fill="#4a1414"/>
    <g clip-path="url(#mc${n})">${teeth?`<rect x="44" y="${teeth}" width="32" height="3.6" fill="#fff"/>`:""}${tongue?`<ellipse cx="${tongue[0]}" cy="${tongue[1]}" rx="6.2" ry="4" fill="#e66a68"/><ellipse cx="${tongue[0]-1.5}" cy="${tongue[1]-1}" rx="2.4" ry="1.1" fill="#f59a92" opacity=".7"/>`:""}</g>
    <path d="${d}" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`;
  const line=d=>`<path d="${d}" fill="none" stroke="${INK}" stroke-width="1.9" stroke-linecap="round"/>`;
  const tongueOut=(x,y,r)=>`<path d="M${x-4.5} ${y}q0 ${r} 4.5 ${r}q4.5 0 4.5-${r}z" fill="#ef7a73" stroke="${INK}" stroke-width="1.2"/><path d="M${x} ${y+1}v${r-3}" stroke="#c4534e" stroke-width="1"/>`;
  const drool=sleep?`<path d="M66 78q1.6 6 .4 11q-.6 3 1.4 3.6q2.2-.6 1.2-3.6q-1.4-5-2.2-11" fill="#bfe6ff" stroke="#6ab8e6" stroke-width=".8" class="av-fl"/>`:"";
  const MOUTH=[
    ()=>open("M49.5 71Q60 83.5 70.5 71Q60 73.2 49.5 71Z",70.4,[60,81]),
    ()=>open("M51 71.4Q60 81 69 71.4Q60 73.2 51 71.4Z",70.9,[60,80]),
    ()=>line("M52 72Q60 77.4 68 72"),
    ()=>line("M52 74Q59 76.6 68.6 71.2"),
    ()=>open("M51.5 76.2Q55.5 70.8 60 72Q64.5 70.8 68.5 76.2Q60 78.4 51.5 76.2Z",71.2,[60,78]),
    ()=>open("M49 70.4Q60 83 71 70.4Q60 73 49 70.4Z",70,[60,80])+tongueOut(55.5,77.8,6.6),
    ()=>open("M48.6 70Q60 84.6 71.4 70Q60 72.8 48.6 70Z",69.4,[60,81.6]),
    ()=>open("M53 77Q60 71 67 77Q60 78.6 53 77Z",0,[60,79]),
    ()=>open("M51 72Q60 67.4 69 72Q66.8 83.6 60 83.6Q53.2 83.6 51 72Z",70.6,[60,82.6])+tongueOut(60,80.4,8),
    ()=>open("M54.4 76Q60 72.4 65.6 76Q64.4 80.6 60 80.6Q55.6 80.6 54.4 76Z",0,[60,79.6]),
  ];
  const mouth=MOUTH[st]();
  /* cheveux : mèche souple avec reflet, de plus en plus en bataille */
  const hair=`<path d="M36.4 55C33.2 39 39.6 22.6 55.6 19.2C64.4 17.4 74.6 19.4 80.4 25.6C86.4 32 87.2 44 84 55C82.8 47.4 80.4 42.4 77 39.4C76.2 43 73.6 45.2 70.4 45.8C71.8 42.8 71.4 39.8 69.8 37.2C64 42.4 55 44.4 45.8 43.4C47.8 41.8 49.4 39.8 50 37.6C45 40.4 40.8 46.4 36.4 55Z" fill="${HAIR}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>
   <path d="M52.4 21.2c.2-3.4 2.2-6 5.4-7.2c-.8 2.2-.6 4.2.4 6.2c1.2-3 3.8-5 7.2-5.4c-1.6 1.8-2.2 3.8-1.8 6" fill="${HAIR}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>
   <path d="M44.6 30.4C50 23.6 62 21.4 71.4 24.6C64.4 24.2 55.6 25.8 49.4 31.6C47.8 33.2 45.8 33 44.6 30.4Z" fill="${HAIRL}"/>
   <path d="M73.6 27.4c3.4 1.6 5.6 4.4 6.4 7.6" fill="none" stroke="${HAIRL}" stroke-width="1.6" stroke-linecap="round"/>
   <path d="M50 37.6c3-4.6 8.6-8.4 15-9.6M58.6 41.6c4.4-1.8 8.4-4.6 11.2-8.6M41 46c1.6-5 4.4-9 8-11.4" fill="none" stroke="#2f190c" stroke-width="1" stroke-linecap="round" opacity=".7"/>
   ${st>=4?`<path d="M57 19.4c-1.6-4.6.4-8.4 4.4-10c-1 3.2-.4 6 1.4 9M68 20.6c1.6-4 5-6 8.6-6c-2.4 1.8-3.8 4.4-4.2 7.6M38.4 40c-3.4-1-5.8-3.4-6.6-6.8c2.4 1.6 4.8 2.2 7.6 2" fill="${HAIR}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>`:""}
   ${st>=7?`<path d="M82.6 40c3.6-.4 6.2-2.6 7.4-6c-2.4 1.4-5 1.8-7.8 1.2M45.4 21.4c-3.6-2.2-5.2-5.8-4.6-9.4c1.4 2.8 3.8 4.6 6.8 5.6" fill="${HAIR}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>`:""}`;
  const stubble=st>=3?`<path d="M45 72Q47 84 60 86Q73 84 75 72Q72 80 60 81Q48 80 45 72Z" fill="#6b4a36" opacity="${(0.1+cl((b-0.35)/1.2)*0.16).toFixed(2)}"/>`:"";
  const FACE="M38.6 52C38.6 36.4 47.2 26.4 60 26.4C72.8 26.4 81.4 36.4 81.4 52C81.4 62.6 79 70.6 74.2 77C70 82.4 65.2 85.8 60 85.8C54.8 85.8 50 82.4 45.8 77C41 70.6 38.6 62.6 38.6 52Z";
  const ear=(x,sd)=>`<path d="M${x} 51.6c${sd*-4.8}-2.2 ${sd*-8.2} 1 ${sd*-7.6} 6.2c${sd*.5} 4.4 ${sd*3.6} 7.4 ${sd*7.8} 6.6Z" fill="${SK}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/><path d="M${x+sd*-2} 54.6c${sd*-2.6} .4 ${sd*-3.2} 3.6 ${sd*-.6} 5.6" fill="none" stroke="${SKD}" stroke-width="1.3" stroke-linecap="round"/>`;
  const head=`
   ${ear(40,1)}${ear(80,-1)}
   <path d="${FACE}" fill="${SK}"/>
   <g clip-path="url(#fc${n})">
    <path d="M71 28C82 36 85 58 77.4 74C72.6 82.4 66.4 86 60 86C68.6 81 74.4 70 75.2 56C75.8 45 74.4 35.6 71 28Z" fill="${SKD}" opacity=".55"/>
    <path d="M36 50C40 44 45 46.4 46 43.4C55 44.8 64 42.8 70 38C71.4 40.6 71.8 43 70.6 46C74 45.4 76.4 43.2 77.4 40C80.4 42.6 82.6 47 84 52L84 40L36 40Z" fill="${SKD}" opacity=".5" transform="translate(0 3)"/>
    <ellipse cx="50" cy="44" rx="7" ry="3" fill="${SKL}" opacity=".0"/>
    <path d="${FACE}" fill="#ff5a4a" opacity="${flush.toFixed(2)}"/>
   </g>
   <path d="${FACE}" fill="none" stroke="${INK}" stroke-width="1.4"/>
   ${stubble}
   <ellipse cx="45" cy="66.6" rx="6.4" ry="4" fill="url(#bl${n})" opacity="${(0.25+blush*0.75).toFixed(2)}"/><ellipse cx="75" cy="66.6" rx="6.4" ry="4" fill="url(#bl${n})" opacity="${(0.25+blush*0.75).toFixed(2)}"/>
   ${hair}${brows}${eye(50,-1)}${eye(70,1)}
   <path d="M61.4 60.4c1.8 2.6 2.4 5 1.4 6.6" fill="none" stroke="${SKD}" stroke-width="1.4" stroke-linecap="round"/>
   <ellipse cx="60.2" cy="67.2" rx="3.4" ry="1.3" fill="${SKD}" opacity=".75"/><ellipse cx="59.4" cy="64.8" rx="1.3" ry=".8" fill="${SKL}" opacity=".9"/>
   <ellipse cx="60.6" cy="65.8" rx="3.4" ry="2.5" fill="#e8584e" opacity="${nose.toFixed(2)}"/>
   ${mouth}${drool}
   ${st>=7&&!sleep?`<path d="M82 40q-3.4 5-.2 7.6q3.4-1.6.2-7.6z" fill="#bfe6ff" stroke="#6ab8e6" stroke-width=".7"/>`:""}
   ${sleep?`<path d="M44 61q-1.6 4 0 6q1.8-1.6 0-6z" fill="#bfe6ff" stroke="#6ab8e6" stroke-width=".6"/>`:""}`;
  /* tenue : chemise couleur du joueur avec ombre et col, cravate qui se défait au fil des stades */
  const open1=st>=3, tieRot=[0,0,0,4,6,14,18,24,32,38][st], tieY=open1?103.5:99, V=open1?105:98.6;
  const SH=`M13 124C14.4 106 27 97.4 46 93.4L60 ${V}L74 93.4C93 97.4 105.6 106 107 124Z`;
  const torso=`
   <path d="M50.6 78L50.4 94Q60 100 69.6 94L69.4 78Z" fill="${SK}" stroke="${INK}" stroke-width="1.3"/>
   <path d="M50.6 80Q60 90 69.4 80L69.5 88Q60 94 50.5 88Z" fill="${SKD}" opacity=".8"/>
   <path d="${SH}" fill="${c}"/>
   <path d="M74 93.4C93 97.4 105.6 106 107 124H86C87.4 112 83 100.6 74 93.4Z" fill="#000" opacity=".2"/>
   <path d="M46 93.4C33 96 24 101.6 19.4 109C26 103.6 35 99.6 47.4 97.6Z" fill="#fff" opacity=".18"/>
   <path d="M33 124C33 116 32 110 30 106M88 124C88 116 89.6 110 91.6 106" fill="none" stroke="#000" stroke-opacity=".2" stroke-width="1.2" stroke-linecap="round"/>
   <path d="${SH}" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
   ${open1?`<path d="M53 92L60 105L67 92Q60 96 53 92Z" fill="${SKD}"/>`:""}
   <path d="M46 93.4L60 ${V}L54.4 ${V+2.4}L43.4 96.4Z" fill="#f7f3ee" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round" transform="rotate(${st>=5?-8:0} 46 93.4)"/>
   <path d="M74 93.4L60 ${V}L65.6 ${V+2.4}L76.6 96.4Z" fill="#e6e0d8" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>
   <g transform="rotate(${tieRot} 60 ${tieY})"><path d="M57.2 ${tieY}h5.6l-1 3.8h-3.6z" fill="#1d2a45" stroke="${INK}" stroke-width="1"/><path d="M58.2 ${tieY+3.8}h3.6l2.6 17.6l-4.4 4.8l-4.4-4.8z" fill="#22304d" stroke="${INK}" stroke-width="1"/><path d="M60 ${tieY+3.8}l4.4 17.6l-4.4 4.8z" fill="#000" opacity=".22"/><path d="M58.6 ${tieY+9}l4-2M58.4 ${tieY+15}l4.6-2.4" stroke="rgba(255,255,255,.2)" stroke-width="1.1"/></g>
   ${st>=5?`<path d="M28 110q6 3 10 1M84 111q6-1 9 2" fill="none" stroke="rgba(0,0,0,.3)" stroke-width="1.5" stroke-linecap="round"/>`:""}
   ${st>=6?`<circle cx="77" cy="113" r="3.2" fill="#8c1d32" opacity=".55"/><circle cx="81" cy="117" r="1.5" fill="#8c1d32" opacity=".5"/>`:""}`;
  /* bras levé : manche, poignet, main qui entoure le verre (doigts devant, pouce sur le côté) */
  const arm=k?`<path d="M86.5 126Q89.6 110 92.6 99" fill="none" stroke="${INK}" stroke-width="12.4" stroke-linecap="round"/><path d="M86.5 126Q89.6 110 92.6 99" fill="none" stroke="${c}" stroke-width="9.8" stroke-linecap="round"/>
   <path d="M90.6 112Q91.4 106 92.8 101" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="3" stroke-linecap="round"/>
   <path d="M87.4 99.4q5.2 2.2 10.4 0" fill="none" stroke="${INK}" stroke-width="1.1" opacity=".6"/>
   <g transform="translate(-10 6)">${heldGlass(k)}</g>
   <path d="M88.4 86.6h10.4q2.6 0 2.6 2.6v4.8q0 3.4-3.4 3.4h-7.2q-3.4 0-3.4-3.4v-4.6q0-2.8 1-2.8z" fill="${SK}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>
   <path d="M90 89.4h10.2M90 92.4h10.2" stroke="${SKD}" stroke-width="1" stroke-linecap="round"/>
   <path d="M88.4 86.6q-3.4.4-3.4 3.4q0 2.4 2.6 3" fill="${SK}" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/>
   <path d="M98 95.6q2.6-.6 3-3" fill="none" stroke="${SKD}" stroke-width="1"/>`:"";
  const headRot=sleep?22:0;
  const person=`<g class="av-p"><g transform="rotate(${tilt} 60 116)">${torso}<g transform="rotate(${headRot} 60 86)">${head}</g>${arm}</g></g>`;
  /* effets autour de la tête */
  const bub=(x,y,r,cls)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#dfe9f7" stroke-opacity=".75" stroke-width="1.3" class="${cls}"/>`;
  const star=(x,y,r)=>`<path d="M${x} ${y-r}L${x+r*.3} ${y-r*.3}L${x+r} ${y}L${x+r*.3} ${y+r*.3}L${x} ${y+r}L${x-r*.3} ${y+r*.3}L${x-r} ${y}L${x-r*.3} ${y-r*.3}Z" fill="#ffcf4a" stroke="#c98f12" stroke-width=".6"/>`;
  let fx="";
  if(st===3) fx=`<path d="M86 30l4-6M90 35l6-3M89 25l1-6" stroke="#ffcf4a" stroke-width="2.2" stroke-linecap="round"/>`;
  if(st>=4&&st<=8) fx+=`<g class="av-fl">${bub(91,44,3.2)}${bub(97,33,2)}${st>=5?bub(24,58,2.6):""}</g><g class="av-fl2">${bub(27,44,1.6)}${st>=6?bub(94,62,1.6)+bub(21,70,1.2):""}</g>`;
  if(st===7) fx+=`<path class="av-sp" d="M93 26a4.5 4.5 0 1 1 -4.5-4.5a3 3 0 1 1 -3 3a1.5 1.5 0 1 1 1.5 1.5" fill="none" stroke="#dfe9f7" stroke-width="1.5" stroke-linecap="round"/>`;
  if(st===8) fx+=`<g class="av-wb"><ellipse cx="60" cy="26" rx="25" ry="6" fill="none" stroke="#ffcf4a" stroke-width="1.6"/>${star(36,25,4)}${star(56,20.4,3.2)}${star(80,23,4.4)}${star(70,31.6,3)}</g>`;
  if(st===9) fx+=`<g class="av-fl">${star(30,32,3.6)}${star(90,26,4.4)}</g><g class="av-fl2">${star(82,40,2.6)}${bub(25,56,1.8)}</g><text x="97" y="46" font-family="sans-serif" font-weight="800" font-size="9" fill="#dfe9f7" opacity=".8">z</text><text x="103" y="37" font-family="sans-serif" font-weight="800" font-size="7" fill="#dfe9f7" opacity=".6">z</text>`;
  const keys=b>=0.5&&!ko?`<g transform="translate(-2 -2)"><circle cx="11" cy="11" r="10.5" fill="#18140f" stroke="#ff5a4e" stroke-width="1.8"/><circle cx="7.6" cy="11" r="3" fill="none" stroke="#f7f1ea" stroke-width="1.6"/><path d="M10.6 11h6.4M15 11v2.8M12.8 11v2" stroke="#f7f1ea" stroke-width="1.6"/><path d="M4 18L18 4" stroke="#ff5a4e" stroke-width="2"/></g>`:"";
  const koWater=ko?`<g transform="translate(-62 22) scale(.85)">${heldGlass("water")}</g>`:"";
  const lab=ko?"avatar KO":st>=7?"avatar très éméché":st>=5?"avatar éméché":st>=2?"avatar pompette":"avatar en forme";
  return `<svg viewBox="0 0 120 120" width="${size}" height="${size}" role="img" aria-label="${lab}" style="flex:none;overflow:visible">${AV_CSS}
  <defs><radialGradient id="ir${n}" cx="50%" cy="35%" r="65%"><stop offset="0" stop-color="#a8743e"/><stop offset=".6" stop-color="#6a4022"/><stop offset="1" stop-color="#3a2210"/></radialGradient>
  <clipPath id="fc${n}"><path d="M38.6 52C38.6 36.4 47.2 26.4 60 26.4C72.8 26.4 81.4 36.4 81.4 52C81.4 62.6 79 70.6 74.2 77C70 82.4 65.2 85.8 60 85.8C54.8 85.8 50 82.4 45.8 77C41 70.6 38.6 62.6 38.6 52Z"/></clipPath>
  <radialGradient id="bl${n}"><stop offset="0" stop-color="#ff5f5f" stop-opacity=".7"/><stop offset="1" stop-color="#ff4d4d" stop-opacity="0"/></radialGradient>
  <linearGradient id="hr${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a4126"/><stop offset="1" stop-color="#3c2414"/></linearGradient>
  <linearGradient id="sh${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></linearGradient>
  <radialGradient id="bg${n}" cx="50%" cy="40%" r="65%"><stop offset="0" stop-color="#1d3354"/><stop offset="1" stop-color="#0c1728"/></radialGradient>
  <clipPath id="cc${n}"><circle cx="60" cy="60" r="55"/></clipPath>
  <clipPath id="ecl${n}"><path d="M44.2 57C45.8 51.8 54.2 51.8 55.8 57C54.2 60.9 45.8 60.9 44.2 57Z"/></clipPath><clipPath id="ecr${n}"><path d="M64.2 57C65.8 51.8 74.2 51.8 75.8 57C74.2 60.9 65.8 60.9 64.2 57Z"/></clipPath></defs>
  <circle cx="60" cy="60" r="55" fill="url(#bg${n})"/>
  <g clip-path="url(#cc${n})">${person}${fx}${koWater}</g>
  <circle cx="60" cy="60" r="56" fill="none" stroke="${ring}" stroke-width="3.6"/>
  ${keys}</svg>`;
}

/* ---------- jauge : alambic en verre et cuivre qui se remplit de potion (indicatif, sans graduation) ----------
   v : 0 à 1 ; from : niveau de départ pour l'animation ; down : le taux redescend. */
let ALN=0;
function alambic(v,from,down){
  const n=++ALN; v=cl(v); from=from==null?v:cl(from);
  const off=x=>((1-x)*56).toFixed(1), hot=v>0.55, nb=v>0.02?Math.round(2+v*5):0;
  const bub=[...Array(nb)].map((_,i)=>`<circle cx="${36+(i*13)%40}" cy="106" r="${(1+(i%3)*.7).toFixed(1)}" class="alb" style="animation-delay:-${(i*0.47).toFixed(2)}s;animation-duration:${(2.2+(i%3)*0.6).toFixed(1)}s"/>`).join("");
  return `<svg viewBox="0 0 120 120" role="img" aria-label="Jauge indicative du taux"${down?' class="aldown"':""}>
  <defs>
   <radialGradient id="ag${n}" cx="38%" cy="35%" r="70%"><stop offset="0" stop-color="#bfe2ff" stop-opacity=".22"/><stop offset=".7" stop-color="#5a8fc4" stop-opacity=".12"/><stop offset="1" stop-color="#9fd0ff" stop-opacity=".35"/></radialGradient>
   <linearGradient id="aq${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd0ff"/><stop offset=".45" stop-color="#2f8cff"/><stop offset="1" stop-color="#1449a8"/></linearGradient>
   <linearGradient id="ac${n}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a3a17"/><stop offset=".35" stop-color="#e59a5c"/><stop offset=".55" stop-color="#ffd2a3"/><stop offset=".75" stop-color="#c86e34"/><stop offset="1" stop-color="#6b3112"/></linearGradient>
   <radialGradient id="aw${n}" cx="50%" cy="70%" r="55%"><stop offset="0" stop-color="#2f8cff" stop-opacity="${(0.12+v*0.5).toFixed(2)}"/><stop offset="1" stop-color="#2f8cff" stop-opacity="0"/></radialGradient>
   <radialGradient id="af${n}" cx="50%" cy="100%" r="80%"><stop offset="0" stop-color="#ffe17a"/><stop offset=".5" stop-color="#ff8a2a"/><stop offset="1" stop-color="#ff4d2a" stop-opacity="0"/></radialGradient>
   <clipPath id="ak${n}"><circle cx="56" cy="80" r="28"/></clipPath>
  </defs>
  <ellipse cx="56" cy="82" rx="46" ry="38" fill="url(#aw${n})"/>
  ${v>0.03?`<path class="alfl" d="M44 116q4-${(6+v*8).toFixed(0)} 6-12q3 ${(5+v*6).toFixed(0)} 6 12q4-${(8+v*9).toFixed(0)} 6-14q3 ${(7+v*6).toFixed(0)} 6 14z" fill="url(#af${n})" opacity="${(0.45+v*0.55).toFixed(2)}"/>`:""}
  <rect x="30" y="108" width="52" height="5" rx="2.5" fill="url(#ac${n})"/>
  <g clip-path="url(#ak${n})"><g class="alq" style="transform:translateY(${off(from)}px)" data-to="${off(v)}">
   <rect x="20" y="52" width="72" height="70" fill="url(#aq${n})"/><ellipse cx="56" cy="52" rx="30" ry="3" fill="#bfe6ff" opacity=".75"/></g>${bub}</g>
  <circle cx="56" cy="80" r="28" fill="url(#ag${n})" stroke="#bfe2ff" stroke-opacity=".8" stroke-width="1.6"/>
  <path d="M38 68q4-12 16-15" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M74 96q4-4 5-9" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M47 53V40h18v13" fill="url(#ac${n})" stroke="#4a210b" stroke-width="1"/>
  <path d="M43 40q13-16 26 0z" fill="url(#ac${n})" stroke="#4a210b" stroke-width="1"/>
  <rect x="44" y="49" width="24" height="4" rx="2" fill="url(#ac${n})" stroke="#4a210b" stroke-width=".8"/>
  <path d="M56 27q0-6 8-8q22-4 32 10q4 7 4 20" fill="none" stroke="#4a210b" stroke-width="6.4" stroke-linecap="round"/>
  <path d="M56 27q0-6 8-8q22-4 32 10q4 7 4 20" fill="none" stroke="url(#ac${n})" stroke-width="4.6" stroke-linecap="round"/>
  <path d="M60 21q18-5 30 6" fill="none" stroke="#ffe3c4" stroke-opacity=".7" stroke-width="1.2" stroke-linecap="round"/>
  ${v>0.15?`<circle cx="100" cy="56" r="${(1.6+v*1.4).toFixed(1)}" fill="#8fd0ff" class="aldr"/>`:""}
  ${hot?`<g fill="none" stroke="#dfe9f7" stroke-linecap="round" stroke-opacity=".55" stroke-width="1.6" class="alst"><path d="M50 22q-4-5 0-9q4-4 0-9"/><path d="M62 18q4-4 0-8"/></g>`:""}
  </svg>`;
}
