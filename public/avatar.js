/* Alamb'hic — avatar articulé qui évolue avec le taux estimé (10 stades, portrait dans un cercle).
   Le dessin est un petit pantin : buste, cou souple, tête, paupières, pupilles, sourcils, cravate, mèches, bras, main et verre.
   Une seule boucle d'animation (avLoop) calcule la pose de tous les avatars à partir de l'horloge : respiration, clignements,
   regard, balancement (la tête, la cravate et les mèches suivent avec retard), hoquet, fou rire, vertige, sommeil, et la gorgée
   (le verre monte à la bouche, s'incline, le liquide reste à l'horizontale, la tête part en arrière).
   La pose ne dépend que de l'heure et de l'état : un écran redessiné ne fait donc jamais sauter l'animation.
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

/* ---------- réglages par stade ---------- */
const AV_EY=57;                                                  // hauteur des yeux
const AV_TILT=[0,0,-1.5,-3,-5,4,-6,-7,7,0];                      // inclinaison de base du buste (degrés)
const AV_HR=[0,0,-1,2,3,-5,4,5,-6,21];                           // inclinaison de base de la tête
const AV_TIE=[0,0,0,4,6,14,18,24,32,38];                         // cravate qui se défait
/* paupières au repos : [gauche, droite, chute du coin externe] ; null = yeux rieurs (5, 6) ou endormis (9) */
const AV_LIDS=[[.04,.04,0],[.06,.06,0],[.3,.3,.5],[.34,.46,.9],[.36,.64,1.8],null,null,[.62,.4,2.2],[.5,.7,1.6],null];
const AV_BROW=[[-2.6,-2.6],[-2.2,-2.2],[0,0],[.6,-1],[1.6,-1.2],[-2.4,-2.4],[-2.2,-2.2],[1.4,-1.8],[1.2,-2],[1,-1.4]];   // [extérieur, intérieur]
const AV_BUB=[[92,50,3.2],[98,36,2],[24,60,2.6],[28,44,1.6],[95,66,1.6]];
/* verres, en coordonnées de la main (origine = centre de la prise) :
   hr = hauteur du buvant au-dessus de la prise, hw = demi-largeur du buvant, a = inclinaison pendant la gorgée,
   top / bot = niveau du liquide plein / fond, fw = demi-largeur des doigts, stem = tenu par le pied, g0 = position de repos */
const AV_GL={
  beer:{hr:24,hw:8.2,a:-34,top:-20.4,bot:4,fw:7.7,g0:[91,93.5]},
  water:{hr:17,hw:7,a:-38,top:-12.5,bot:3,fw:7.3,g0:[91,92]},
  shot:{hr:13,hw:4.9,a:-58,top:-10.2,bot:-2.5,fw:6.2,g0:[91,90]},
  wine:{hr:25,hw:6.6,a:-34,top:-16,bot:-8,fw:5.8,stem:1,g0:[91,93]},
  champ:{hr:28,hw:3.7,a:-40,top:-24.6,bot:-9,fw:5.8,stem:1,g0:[91,94]},
  cocktail:{hr:19,hw:9.8,a:-30,top:-16.8,bot:-9,fw:5.8,stem:1,g0:[90.5,91]},
};
const avE=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;                 // accélère puis ralentit
const avBack=x=>{const c=1.70158;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2)};   // dépasse puis revient
const avF=v=>Math.round(v*100)/100;
function avSeed(key){ let h=7; for(const ch of String(key)) h=(h*31+ch.charCodeAt(0))%9973; return h/9973 }
/* paupière : bord (trait) et peau au-dessus ; L = 0 ouverte … 1 fermée ; sl = chute du coin externe */
function avLidD(x,side,L,sl){
  const cy=AV_EY-5.2+L*9.1, co=cy+sl*(1-L*.6), ci=cy-sl*.3, cL=avF(side<0?co:ci), cR=avF(side<0?ci:co);
  return [`M${x-5.8} ${AV_EY}C${x-4.2} ${AV_EY-5.7} ${x+4.2} ${AV_EY-5.7} ${x+5.8} ${AV_EY}C${x+4.2} ${cR} ${x-4.2} ${cL} ${x-5.8} ${AV_EY}Z`,
          `M${x-5.8} ${AV_EY}C${x-4.2} ${cL} ${x+4.2} ${cR} ${x+5.8} ${AV_EY}`];
}

/* ---------- pose : tout ce qui bouge, calculé pour l'instant t (secondes) ; t = null → pose de repos (dessin fixe) ---------- */
function avCalc(P,t,ev){
  const st=P.st, bb=Math.min(1.5,P.b), sd=P.seed, live=t!=null, T=live?t+sd*9.7:0, G=AV_GL[P.k];
  const sin=Math.sin, cos=Math.cos, PI=Math.PI, TAU=2*PI;
  const H=(i,j)=>{const x=sin((i+sd*31.7)*127.1+j*311.7)*43758.5453;return x-Math.floor(x)};   // hasard reproductible
  /* respiration (les rythmes dépendent du stade, pas du taux exact : aucune saute quand le taux est rafraîchi) */
  const bp=st===9?5.4:3.8-st*.05, br=live?(1-cos(TAU*T/bp))/2:0, brL=live?(1-cos(TAU*(T-.3)/bp))/2:0;
  /* balancement : deux ondes mêlées, plus ample et plus lent quand le taux monte */
  const A=live?bb*3.4+.25:0, w=TAU/(3.4+st*.12), sway=u=>A*(.72*sin(w*u)+.28*sin(1.73*w*u+1.3));
  const sw=sway(T), swL=sway(T-.32), swV=sw-sway(T-.25);
  let by=-.35*br, hr=AV_HR[st]-.45*swL, hx=0, hy=-.9*brL, mS=1, brow=0, eyes=0, mouth=0;
  let lx=0, ly=0, cross=0, blL=0, blR=0, hicT=-1, hic=0, tuft=-2.4*swV;
  if(live){
    /* regard : de petits coups d'œil, puis retour vers l'écran ; yeux qui flottent quand ça tourne */
    if(st>=7){ lx=1.25*sin(.83*T); ly=.45*sin(1.31*T+1); cross=.5+.5*sin(.47*T) }
    else{ const LS=2.9, i=Math.floor(T/LS), u=T-i*LS, tg=j=>H(j,1)<.55?[0,0]:[(H(j,2)-.5)*2.6,(H(j,3)-.5)], a0=tg(i-1), a1=tg(i), e=avE(cl(u/.18));
      lx=a0[0]+(a1[0]-a0[0])*e; ly=a0[1]+(a1[1]-a0[1])*e }
    hr+=lx*.8; hx+=lx*.3;
    /* clignements irréguliers, parfois doubles ; plus lents quand le taux monte, décalés d'un œil à l'autre quand ça tourne */
    if(AV_LIDS[st]){ const BS=3.6-st*.05, i=Math.floor(T/BS), u=T-i*BS-(.4+H(i,4)*(BS-1.3)), bd=st>=4?.36:.19, cv=x=>x<=0||x>=1?0:Math.pow(sin(PI*x),.6);
      blL=Math.max(cv(u/bd),H(i,5)>.72?cv((u-bd-.1)/bd):0); blR=st>=7?cv((u-.13)/bd):blL }
    /* hoquet (stades 4 à 8) : sursaut de la tête et des épaules, qui s'amortit */
    if(st>=4&&st<=8){ const HS=6.6-(st-4)*.5, i=Math.floor(T/HS), u=T-i*HS-(1+H(i,6)*(HS-2.2)); if(u>0&&u<.9){ hicT=u; hic=Math.exp(-6*u)*sin(24*u) } }
    hy-=2.6*hic; by-=1.1*hic; brow-=1.4*Math.abs(hic); tuft+=7*hic;
    /* fou rire (stades 5 et 6) : épaules qui sautent par saccades */
    if(st===5||st===6){ const LS=4.3, i=Math.floor(T/LS), u=T-i*LS; if(u<1.8){ const env=sin(PI*u/1.8), bn=Math.abs(sin(TAU*2.9*u))*env; by-=1.3*bn; hy-=.9*bn; hr+=2.2*env*(st===5?1:-1); mS=1+.12*bn } }
    /* vertige (stades 7 et 8) : la tête décrit un petit cercle */
    if(st===7||st===8){ hx+=1.3*cos(1.05*T); hy+=.7*sin(1.05*T); hr+=2.6*sin(1.05*T+1) }
    if(st===9) hr+=1.4*br;
  }
  /* gorgée : élan, montée à la bouche, deux gorgées, descente, petit remous ; arrivée d'un nouveau verre par le bas */
  let s=0, tip=0, dip=0, wob=0, hb=0, gulp=0, enter=0;
  if(live&&G&&ev){
    if(ev.glAt!=null){ const te=t-ev.glAt; if(te>=0&&te<.7) enter=1-avBack(te/.7) }
    if(ev.sipAt!=null){ const ts=t-ev.sipAt; if(ts>=0&&ts<3.4){
      if(ts<.22) dip=sin(PI*ts/.22);
      else if(ts<.8) s=avE((ts-.22)/.58);
      else if(ts<1.65){ s=1; const u=(ts-.8)/.85; tip=avE(cl(u*1.5)); gulp=sin(TAU*2.4*u)*sin(PI*u) }
      else if(ts<2.15){ s=1-avE((ts-1.65)/.5); tip=s }
      else wob=Math.exp(-4.5*(ts-2.15))*sin(14*(ts-2.15));
      hb=avE(cl((s-.45)/.55));
      if(s>.6) mouth=1; else if(st<5&&ts>1.9&&ts<2.85){ eyes=1; mouth=2 }
    } }
  }
  hy+=-2*hb-.45*gulp*hb; hr+=2.6*hb; brow-=1.2*hb;
  /* on touche l'avatar : petit saut, clin d'œil, et il lève son verre */
  let toast=0;
  if(live&&ev&&ev.pokeAt!=null){ const tp=t-ev.pokeAt; if(tp>=0&&tp<1.3){ const j=Math.exp(-4*tp)*sin(13*tp), wk=tp<.8?Math.pow(sin(PI*tp/.8),.5):0;
    by-=2.4*j; hy-=1.3*Math.exp(-4*Math.max(0,tp-.06))*sin(13*Math.max(0,tp-.06)); tuft+=9*j; brow-=1.5*wk; toast=tp<1.1?sin(PI*tp/1.1):0;
    if(st!==9){ blR=Math.max(blR,wk); hr-=3*wk; if(st<5&&!mouth&&wk>.2) mouth=2 } } }
  const th=AV_TILT[st]+sw, hrR=hr*PI/180, ch=cos(hrR), sh=sin(hrR);
  const hT=(x,y)=>[60+(x-60)*ch-(y-82)*sh+hx, 82+(x-60)*sh+(y-82)*ch+hy];        // point de la tête → repère du buste
  /* cou souple : de la base (col) jusque sous la mâchoire, où que soit la tête */
  const [ax,ay]=hT(60,77.5), ndx=ax-60, ndy=ay-99, nl=Math.hypot(ndx,ndy)||1, ux=ndx/nl, uy=ndy/nl, nx=-uy*8.7, ny=ux*8.7;
  const R={
    body:`translate(0 ${avF(by)}) rotate(${avF(th)} 60 126)`,
    torso:`translate(60 126) scale(${avF(1+.008*br)} ${avF(1+.014*br)}) translate(-60 -126)`,
    head:`translate(${avF(hx)} ${avF(hy)}) rotate(${avF(hr)} 60 82)`,
    neck:`M60 99L${avF(ax)} ${avF(ay)}`,
    nclip:`M${avF(60+nx)} ${avF(99+ny)}L${avF(ax+nx+ux*6)} ${avF(ay+ny+uy*6)}L${avF(ax-nx+ux*6)} ${avF(ay-ny+uy*6)}L${avF(60-nx)} ${avF(99-ny)}Z`,
    tie:avF(AV_TIE[st]-.7*swL-3.2*swV+5*hic),
    tuft:avF(tuft),
    pl:`translate(${avF(lx+cross*.7)} ${avF(ly)})`, pr:`translate(${avF(lx-cross*.7)} ${avF(ly-(st>=7?.3*cross:0))})`,
    brow:`translate(0 ${avF(brow)})`, eyes, mouth,
    mS:`translate(60 75) scale(1 ${avF(mS)}) translate(-60 -75)`,
    lid:null, hand:"", sl:"", liq:"", fx:{}
  };
  const LD=AV_LIDS[st];
  if(LD){ const cL=Math.max(blL,hb), cR=Math.max(blR,hb); R.lid=[avLidD(50,-1,LD[0]+(1-LD[0])*cL,LD[2]),avLidD(70,1,LD[1]+(1-LD[1])*cR,LD[2])] }
  if(G){
    /* la main : au repos elle garde le verre presque droit malgré le balancement ; pendant la gorgée, le buvant reste collé aux lèvres */
    const aR=-.55*th+3*dip+4*wob+7*toast, aS=G.a-13*tip, a=aR+(aS-aR)*s, ar=a*PI/180, aSr=aS*PI/180;
    const [mx,my]=hT(60.6,76.8), rx=mx+.5*G.hw*cos(aSr), ry=my+.5*G.hw*sin(aSr);          // centre du buvant : la bouche est au quart du bord
    const g0x=G.g0[0], g0y=G.g0[1]-.5*br+1.3*dip+46*enter-7*toast, g1x=rx-G.hr*sin(aSr), g1y=ry+G.hr*cos(aSr), arc=sin(PI*s);
    const gx=g0x+(g1x-g0x)*s+1.5*arc, gy=g0y+(g1y-g0y)*s-2.5*arc;
    const wx=gx-10*sin(ar), wy=gy+10*cos(ar), sx=89-8*s, sy=132, cx=(gx-23*sin(ar))*.7+(sx+wx)*.15, cy=(gy+23*cos(ar))*.7+(sy+wy)*.15;
    R.hand=`translate(${avF(gx)} ${avF(gy)}) rotate(${avF(a)})`;
    R.sl=`M${avF(sx)} ${sy}Q${avF(cx)} ${avF(cy)} ${avF(wx)} ${avF(wy)}`;
    R.liq=`rotate(${avF(-(th+a)+1.8*swV+6*wob+9*hic)} 0 ${avF(G.bot+(G.top-G.bot)*P.lvl)})`;
  }
  /* effets autour de la tête */
  const fx=R.fx;
  if(st>=4&&st<=8) fx.bub=AV_BUB.slice(0,st>=6?5:st>=5?4:3).map(([x,y],i)=>{ if(!live) return [x,y,.75]; const ph=(T/(4.2+i*.8)+H(i+40,7))%1; return [avF(x+1.6*sin(T*1.1+i*2)),avF(y+5-12*ph),avF(.8*sin(PI*ph))] });
  if(st===3) fx.spark=[0,1,2].map(i=>live?avF(.55+.45*sin(T*5+i*2.1)):1);
  if(st===7) fx.spin=live?avF((T*150)%360):0;
  if(st===7||st===8){ const ph=live?(T/2.9)%1:.2; fx.sweat=[avF(7*ph),avF(ph<.8?1:1-(ph-.8)/.2)] }
  if(st===8) fx.star=[0,1,2,3].map(i=>{ const f=TAU*i/4+(live?1.5*T:.7), z=(sin(f)+1)/2; return [avF(60+24*cos(f)),avF(23+5.5*sin(f)),avF(.7+.35*z),avF(.5+.5*z)] });
  if(st===9){ fx.zz=[0,1,2].map(i=>{ const ph=live?(T/3.4+i/3)%1:[.25,.55,.85][i]; return [avF(83+13*ph+1.5*sin(ph*9)),avF(45-22*ph),avF(.5+.9*ph),avF(sin(PI*ph))] });
    fx.drool=avF(live?.75+.55*br:1); fx.tw=[0,1,2].map(i=>live?avF(.6+.4*sin(T*2.2+i*2)):1); fx.kw=live?avF(.9*sin(T*1.5)):0 }
  if(st>=4&&st<=8) fx.hic=hicT>=0&&hicT<.5?[avF(.5+hicT*2.6),avF(1-hicT/.5)]:[.5,0];
  return R;
}

/* ---------- verres et main (coordonnées de la main) ---------- */
function avGlass(k,n,P,R){
  const G=AV_GL[k]; if(!G) return "";
  const yL=avF(G.bot+(G.top-G.bot)*P.lvl), GS=`stroke="#e6f1ff" stroke-opacity=".92" stroke-width=".9" stroke-linejoin="round"`, gf=`url(#gl${n})`;
  const SH={  // contour, intérieur
    beer:["M-8.2 -24H8.2L6 5.6Q5.9 6.8 4.7 6.8H-4.7Q-5.9 6.8 -6 5.6Z","M-7.5 -24H7.5L5.4 5.4H-5.4Z"],
    water:["M-7 -17H7L5.9 5.6Q5.8 6.8 4.6 6.8H-4.6Q-5.8 6.8 -5.9 5.6Z","M-6.3 -17H6.3L5.3 4.8H-5.3Z"],
    shot:["M-4.9 -13H4.9L3.9 1Q3.8 2 2.9 2H-2.9Q-3.8 2 -3.9 1Z","M-4.3 -13H4.3L3.5 -.8H-3.5Z"],
    wine:["M-6.6 -25H6.6C8.8 -19 7.6 -9.4 1 -6.4H-1C-7.6 -9.4 -8.8 -19 -6.6 -25Z","M-6 -25H6C8.1 -19 7 -9.8 .8 -7H-.8C-7 -9.8 -8.1 -19 -6 -25Z"],
    champ:["M-3.7 -28H3.7C4.7 -20 3.4 -10.4 .9 -6.4H-.9C-3.4 -10.4 -4.7 -20 -3.7 -28Z","M-3.1 -28H3.1C4 -20 2.9 -10.8 .6 -7.4H-.6C-2.9 -10.8 -4 -20 -3.1 -28Z"],
    cocktail:["M-9.8 -19H9.8L.9 -6.4H-.9Z","M-8.9 -18.6H8.9L.5 -7H-.5Z"]}[k];
  const COL={beer:["#ffd45e","#d47e18","#fff3c4"],water:["#a5ddff","#3f97f5","#d8f1ff"],shot:["#f8b24c","#a9550d","#ffd98a"],wine:["#b82c47","#5c0e1f","#d85a70"],champ:["#ffe997","#e3ac32","#fff6c9"],cocktail:["#ff9cc6","#d83a78","#ffc6de"]}[k];
  const ms=Math.round(typeof performance!=="undefined"?performance.now():0);
  const bu=pts=>pts.map(([x,y,r],i)=>`<circle cx="${x}" cy="${yL+y}" r="${r}" fill="${COL[2]}" class="av-bu" style="animation-delay:-${(ms+i*570)%2200}ms"/>`).join("");
  const stem=G.stem?`<path d="M0 -6.6V8.2" stroke="#e6f1ff" stroke-opacity=".92" stroke-width="1.7" stroke-linecap="round"/><ellipse cx="0" cy="8.7" rx="5.6" ry="1.35" fill="${gf}" ${GS}/>`:"";
  let liquid=`<rect x="-34" y="${yL}" width="68" height="64" fill="url(#lq${n})"/>`;
  if(k==="beer") liquid+=`<rect x="-34" y="${avF(yL-3.7)}" width="68" height="4" fill="#fffaf0"/><path d="M-34 ${avF(yL+.3)}h68" stroke="#f1dfb6" stroke-width=".6"/>${bu([[-3,22,.7],[1.5,19,.6],[4,23,.75],[-1,24,.5]])}`;
  else liquid+=`<path d="M-34 ${yL}h68" stroke="${COL[2]}" stroke-width="1.1"/>`;
  if(k==="champ") liquid+=bu([[-1,13,.45],[1,11,.4],[0,15,.4]]);
  if(k==="water") liquid+=`<rect x="-4.6" y="${avF(yL-1.6)}" width="4.8" height="4.8" rx="1.1" fill="#fff" opacity=".5" transform="rotate(-12 -2.2 ${yL+.8})"/><rect x=".6" y="${avF(yL-.6)}" width="4.4" height="4.4" rx="1.1" fill="#fff" opacity=".38" transform="rotate(14 2.8 ${yL+1.6})"/>`;
  let extra="";
  if(k==="beer"&&P.lvl>.82) extra=`<path d="M-8.7 -23.4c-2-3.6 1-6.6 4.2-5.6c.6-3.2 5.4-4 7.2-1.2c2.8-2 6.8 0 5.8 3.6c1.8 1.4 1 3.6-1 3.4z" fill="#fffaf0" stroke="#e7d9bf" stroke-width=".6"/><path d="M-5.6 -27.4q1.8-1.2 3.6-.4M1 -29q2-.6 3.4.6" fill="none" stroke="#fff" stroke-width=".9" stroke-linecap="round"/><path d="M-8.2 -23.6q-1.5 3.2.1 5.6q1.5-1.9.7-5.6z" fill="#fffaf0" stroke="#e7d9bf" stroke-width=".5"/>`;
  if(k==="cocktail") extra=`<path d="M2.2 -25.6l4.6 8.6" stroke="#8a5a2a" stroke-width="1" stroke-linecap="round"/><circle cx="6" cy="-18.6" r="2.5" fill="#e23b4b" stroke="#9e1d2b" stroke-width=".6"/><circle cx="5.2" cy="-19.4" r=".7" fill="#fff" opacity=".75"/><path d="M-10.4 -18.2a4 4 0 0 1 7.6-1.4" fill="#ffe36a" stroke="#d9b21f" stroke-width=".8"/>`;
  const HI={beer:[-5.5,-21,1],water:[-4.9,-14.5,2],shot:[-3,-11.6,-7.4],wine:[-4.5,-22.8,-13],champ:[-1.9,-25.6,-15]}[k];
  const hi=HI?`<path d="M${HI[0]} ${HI[1]}V${HI[2]}" stroke="#fff" stroke-opacity=".5" stroke-width="1.2" stroke-linecap="round"/>`:"";
  return `${stem}<path d="${SH[0]}" fill="${gf}"/><g clip-path="url(#gi${n})"><g class="av-liq" transform="${R.liq}">${liquid}</g></g><path d="${SH[0]}" fill="none" ${GS}/>${hi}${extra}`;
}
/* défs propres au verre : découpe intérieure, couleur du liquide */
function avGlassDefs(k,n,P){
  const G=AV_GL[k]; if(!G) return "";
  const IN={beer:"M-7.5 -24H7.5L5.4 5.4H-5.4Z",water:"M-6.3 -17H6.3L5.3 4.8H-5.3Z",shot:"M-4.3 -13H4.3L3.5 -.8H-3.5Z",wine:"M-6 -25H6C8.1 -19 7 -9.8 .8 -7H-.8C-7 -9.8 -8.1 -19 -6 -25Z",champ:"M-3.1 -28H3.1C4 -20 2.9 -10.8 .6 -7.4H-.6C-2.9 -10.8 -4 -20 -3.1 -28Z",cocktail:"M-8.9 -18.6H8.9L.5 -7H-.5Z"}[k];
  const COL={beer:["#ffd45e","#d47e18"],water:["#a5ddff","#3f97f5"],shot:["#f8b24c","#a9550d"],wine:["#b82c47","#5c0e1f"],champ:["#ffe997","#e3ac32"],cocktail:["#ff9cc6","#d83a78"]}[k];
  const yL=avF(G.bot+(G.top-G.bot)*P.lvl), op=k==="water"?' stop-opacity=".7"':"";
  return `<clipPath id="gi${n}"><path d="${IN}"/></clipPath><linearGradient id="lq${n}" gradientUnits="userSpaceOnUse" x1="0" y1="${yL}" x2="0" y2="${yL+24}"><stop offset="0" stop-color="${COL[0]}"${op}/><stop offset="1" stop-color="${COL[1]}"${op}/></linearGradient>
  <linearGradient id="gl${n}" x1="0" x2="1"><stop offset="0" stop-color="#e6f2ff" stop-opacity=".34"/><stop offset=".45" stop-color="#e6f2ff" stop-opacity=".08"/><stop offset="1" stop-color="#e6f2ff" stop-opacity=".24"/></linearGradient>`;
}
/* la main : dos et poignet derrière le verre, quatre doigts devant ; le pouce se devine à travers le verre */
function avHand(k,n,P,R,SK,SKD,INK){
  const G=AV_GL[k], fw=G.fw, F=[[-5.6,3,-fw+.3,fw-.2],[-2.8,3,-fw-.2,fw],[0,3,-fw+.1,fw-.1],[2.8,2.9,-fw+.9,fw-.7]];
  const back=`<rect x="-4.9" y="3" width="9.8" height="6.4" fill="${SK}" stroke="${INK}" stroke-width="1"/>
   <rect x="-6.1" y="7.2" width="12.2" height="3.9" rx="1.3" fill="#f7f3ee" stroke="${INK}" stroke-width="1"/><circle cx="3.6" cy="9.1" r=".6" fill="#b9b1a6"/>
   <rect x="${avF(-fw+1.2)}" y="-5.9" width="${avF(2*fw-1.2)}" height="12.2" rx="4" fill="${SK}" stroke="${INK}" stroke-width="1"/>
   ${G.stem?"":`<rect x="${avF(-fw+.2)}" y="-7.3" width="9" height="3.5" rx="1.75" fill="${SK}" stroke="${INK}" stroke-width=".9"/>`}`;
  const sil=`<rect x="${avF(-fw-.5)}" y="-6" width="${avF(2*fw+.6)}" height="12.1" rx="3" fill="${INK}"/>`;
  const fingers=sil+F.map(([y,h,x0,x1])=>`<rect x="${avF(x0)}" y="${y}" width="${avF(x1-x0)}" height="${h}" rx="1.5" fill="${SK}" stroke="#a9623f" stroke-width=".7"/><path d="M${avF(x0+1.8)} ${avF(y+h-.8)}H${avF(x1-2.4)}" stroke="${SKD}" stroke-width=".7" stroke-linecap="round" opacity=".7"/><path d="M${avF(x1-2.6)} ${avF(y+.9)}h1.2" stroke="#fbd9bc" stroke-width=".8" stroke-linecap="round"/>`).join("")
   +(G.stem?`<rect x="-5.6" y="-8" width="8.4" height="3.4" rx="1.7" fill="${SK}" stroke="${INK}" stroke-width=".9" transform="rotate(-8 -1.4 -6.3)"/>`:"");
  return `<g class="av-hand" transform="${R.hand}">${back}${avGlass(k,n,P,R)}${fingers}</g>`;
}
const AV_CSS=`<style>.av-bu{animation:avbu 2.2s linear infinite}@keyframes avbu{0%{transform:translateY(0);opacity:0}20%{opacity:1}100%{transform:translateY(-15px);opacity:0}}
@media (prefers-reduced-motion:reduce){.av-bu{animation:none}}</style>`;

/* ---------- le dessin ---------- */
function avatar(p,size,key){
  const n=++AVN, s=p.sim||{cur:0,prev:0,peak:0}, b=Math.max(0,+s.cur||0), c=p.color||"#2f8cff", st=avStage(b);
  const ko=st>=9, down=s.peak>=0.3&&b<s.prev-0.004, now=NOW(), dr=(p.drinks||[]).filter(d=>d.t<=now), last=dr.slice().sort((x,y)=>y.t-x.t)[0];
  const fresh=!!last&&now-last.t<25*MIN, k=ko?"":((fresh?drinkKind(last):(down?"water":""))||"");
  key=String(key||p.id||"a");
  const P={st,b,k,seed:avF(avSeed(key)),lvl:avF(fresh?1-.7*cl((now-last.t)/(25*MIN)):.75)}, R=avCalc(P,null), fx=R.fx;
  const INK="#2b1810", SK="#f3c39e", SKD="#df9f78", SKL="#fbd9bc", LIDC="#ecb590", HAIR="#4b2b18", HAIRL="#7a4a2a", ring=AV_RING[st], EY=AV_EY;
  const happy=st===5||st===6, sleep=st===9;
  const blush=cl((b-0.15)/0.6), nose=cl((b-0.3)/0.6)*0.8, flush=cl((b-0.9)/0.7)*0.26;
  /* yeux */
  const almond=x=>`M${x-5.8} ${EY}C${x-4.2} ${EY-5.2} ${x+4.2} ${EY-5.2} ${x+5.8} ${EY}C${x+4.2} ${EY+3.9} ${x-4.2} ${EY+3.9} ${x-5.8} ${EY}Z`;
  const arc=x=>`<path d="M${x-5.4} ${EY+1}Q${x} ${EY-5.4} ${x+5.4} ${EY+1}" fill="none" stroke="${INK}" stroke-width="2.3" stroke-linecap="round"/>`;
  const shut=x=>`<path d="M${x-5.4} ${EY-.6}Q${x} ${EY+4.2} ${x+5.4} ${EY-.6}" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/><path d="M${x-3} ${EY+2.6}l-.6 1.6M${x} ${EY+3.2}v1.7M${x+3} ${EY+2.6}l.6 1.6" stroke="${INK}" stroke-width="1" stroke-linecap="round"/>`;
  const eye=(x,side)=>{ const i=side<0?0:1, sf=side<0?"l":"r", px=st>=7?side*-0.9:0, [lf,le]=R.lid[i];
    return `<path d="${almond(x)}" fill="#fffdf8"/>
    <g clip-path="url(#ec${sf}${n})"><path d="${almond(x)}" fill="#ff7a6a" opacity="${(cl((b-0.6)/0.8)*0.35).toFixed(2)}"/>
     <g class="av-p${sf}" transform="${side<0?R.pl:R.pr}"><circle cx="${x+px}" cy="${EY+.2}" r="3.7" fill="url(#ir${n})"/><circle cx="${x+px}" cy="${EY+.2}" r="1.8" fill="#170b05"/>
     <circle cx="${x+px+1.3}" cy="${EY-1.2}" r="1.15" fill="#fff"/><circle cx="${x+px-1.2}" cy="${EY+1.5}" r=".55" fill="#fff" opacity=".8"/></g></g>
    <path d="M${x-4.4} ${EY+2.7}C${x-2} ${EY+4.1} ${x+2} ${EY+4.1} ${x+4.4} ${EY+2.7}" fill="none" stroke="${INK}" stroke-width=".8" opacity=".45"/>
    <path class="av-lf${sf}" d="${lf}" fill="${LIDC}"/><path class="av-le${sf}" d="${le}" fill="none" stroke="${INK}" stroke-width="1.9" stroke-linecap="round"/>
    ${st>=4?`<path d="M${x-4} ${EY+5.4}q4 ${(1.3+b).toFixed(1)} 8 0" fill="none" stroke="#9a5a6a" stroke-opacity="${cl((b-0.4)/1).toFixed(2)}" stroke-width="1"/>`:""}` };
  const eyesM=happy?arc(50)+arc(70):sleep?shut(50)+shut(70):`<g class="av-eo">${eye(50,-1)}${eye(70,1)}</g><g class="av-eh" opacity="0">${arc(50)}${arc(70)}</g>`;
  /* sourcils pleins */
  const [bo,bi]=AV_BROW[st], br=(x0,x1,yo,yi)=>{ const mx=(x0+x1)/2, my=Math.min(yo,yi)-2.4;
    return `<path d="M${x0} ${yo+.6}Q${mx} ${my} ${x1} ${yi-.4}Q${x1+(x1>x0?.8:-.8)} ${yi+1.4} ${x1-(x1>x0?.4:-.4)} ${yi+2.2}Q${mx} ${my+2.8} ${x0} ${yo+1.6}Z" fill="${HAIR}" stroke="${HAIR}" stroke-width=".6" stroke-linejoin="round"/>` };
  const brows=`<g class="av-brw" transform="${R.brow}">${br(43.5,55,48+bo,48+bi)}${br(76.5,65,48+bo,48+bi)}</g>`;
  /* bouches */
  const open=(d,teeth,tongue,id="")=>`<clipPath id="mc${id}${n}"><path d="${d}"/></clipPath><path d="${d}" fill="#4a1414"/>
    <g clip-path="url(#mc${id}${n})">${teeth?`<rect x="44" y="${teeth}" width="32" height="3.6" fill="#fff"/>`:""}${tongue?`<ellipse cx="${tongue[0]}" cy="${tongue[1]}" rx="6.2" ry="4" fill="#e66a68"/><ellipse cx="${tongue[0]-1.5}" cy="${tongue[1]-1}" rx="2.4" ry="1.1" fill="#f59a92" opacity=".7"/>`:""}</g>
    <path d="${d}" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`;
  const line=d=>`<path d="${d}" fill="none" stroke="${INK}" stroke-width="1.9" stroke-linecap="round"/>`;
  const tongueOut=(x,y,r)=>`<path d="M${x-4.5} ${y}q0 ${r} 4.5 ${r}q4.5 0 4.5-${r}z" fill="#ef7a73" stroke="${INK}" stroke-width="1.2"/><path d="M${x} ${y+1}v${r-3}" stroke="#c4534e" stroke-width="1"/>`;
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
  const mouthM=`<g class="av-mo" transform="${R.mS}">${MOUTH[st]()}</g>`+(k?`<g class="av-ms" opacity="0"><path d="M55.4 74.8q1.2 1.9 3.6 2.1" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/></g>
    <g class="av-ma" opacity="0">${open("M51.4 71.6Q60 82 68.6 71.6Q60 73.6 51.4 71.6Z",71.1,[60,80.6],"a")}</g>`:"");
  /* cheveux : mèche souple avec reflet ; épis qui bougent, de plus en plus en bataille */
  const tf=(d,x,y)=>`<g class="av-tf" data-o="${x} ${y}" transform="rotate(${R.tuft} ${x} ${y})"><path d="${d}" fill="${HAIR}" stroke="${INK}" stroke-width="1.15" stroke-linejoin="round"/></g>`;
  const hair=`${tf("M52.4 21.6c.2-3.6 2.2-6.4 5.4-7.6c-.8 2.2-.6 4.2.4 6.2c1.2-3 3.8-5 7.2-5.4c-1.6 1.8-2.2 3.8-1.8 6.4z",58.6,21.4)}
   ${st>=4?tf("M67 21.4c1.6-4.4 5.4-6.6 9.4-6.6c-2.6 1.9-4 4.6-4.4 8z",69.6,22)+tf("M39 40.6c-3.8-1-6.4-3.6-7.2-7.4c2.6 1.8 5.2 2.4 8.2 2.2z",39,38):""}
   ${st>=7?tf("M82.4 40.6c3.8-.4 6.6-2.8 7.8-6.4c-2.6 1.5-5.3 1.9-8.2 1.3z",82.4,38.4)+tf("M46.4 22.4c-3.8-2.2-5.6-6-5-9.8c1.5 3 4 4.8 7.2 5.8z",47,21.6):""}
   <path d="M36.4 55C33.2 39 39.6 22.6 55.6 19.2C64.4 17.4 74.6 19.4 80.4 25.6C86.4 32 87.2 44 84 55C82.8 47.4 80.4 42.4 77 39.4C76.2 43 73.6 45.2 70.4 45.8C71.8 42.8 71.4 39.8 69.8 37.2C64 42.4 55 44.4 45.8 43.4C47.8 41.8 49.4 39.8 50 37.6C45 40.4 40.8 46.4 36.4 55Z" fill="${HAIR}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>
   <path d="M44.6 30.4C50 23.6 62 21.4 71.4 24.6C64.4 24.2 55.6 25.8 49.4 31.6C47.8 33.2 45.8 33 44.6 30.4Z" fill="${HAIRL}"/>
   <path d="M73.6 27.4c3.4 1.6 5.6 4.4 6.4 7.6" fill="none" stroke="${HAIRL}" stroke-width="1.6" stroke-linecap="round"/>
   <path d="M50 37.6c3-4.6 8.6-8.4 15-9.6M58.6 41.6c4.4-1.8 8.4-4.6 11.2-8.6M41 46c1.6-5 4.4-9 8-11.4" fill="none" stroke="#2f190c" stroke-width="1" stroke-linecap="round" opacity=".7"/>`;
  const stubble=st>=3?`<path d="M45 72Q47 84 60 86Q73 84 75 72Q72 80 60 81Q48 80 45 72Z" fill="#6b4a36" opacity="${(0.1+cl((b-0.35)/1.2)*0.16).toFixed(2)}"/>`:"";
  const FACE="M38.6 52C38.6 36.4 47.2 26.4 60 26.4C72.8 26.4 81.4 36.4 81.4 52C81.4 62.6 79 70.6 74.2 77C70 82.4 65.2 85.8 60 85.8C54.8 85.8 50 82.4 45.8 77C41 70.6 38.6 62.6 38.6 52Z";
  const ear=(x,sd)=>`<path d="M${x} 51.6c${sd*-4.8}-2.2 ${sd*-8.2} 1 ${sd*-7.6} 6.2c${sd*.5} 4.4 ${sd*3.6} 7.4 ${sd*7.8} 6.6Z" fill="${SK}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/><path d="M${x+sd*-2} 54.6c${sd*-2.6} .4 ${sd*-3.2} 3.6 ${sd*-.6} 5.6" fill="none" stroke="${SKD}" stroke-width="1.3" stroke-linecap="round"/>`;
  const star=r=>`M0 ${-r}L${r*.3} ${-r*.3}L${r} 0L${r*.3} ${r*.3}L0 ${r}L${-r*.3} ${r*.3}L${-r} 0L${-r*.3} ${-r*.3}Z`;
  const head=`
   ${ear(40,1)}${ear(80,-1)}
   <path d="${FACE}" fill="${SK}"/>
   <g clip-path="url(#fc${n})">
    <path d="M71 28C82 36 85 58 77.4 74C72.6 82.4 66.4 86 60 86C68.6 81 74.4 70 75.2 56C75.8 45 74.4 35.6 71 28Z" fill="${SKD}" opacity=".55"/>
    <path d="M36 50C40 44 45 46.4 46 43.4C55 44.8 64 42.8 70 38C71.4 40.6 71.8 43 70.6 46C74 45.4 76.4 43.2 77.4 40C80.4 42.6 82.6 47 84 52L84 40L36 40Z" fill="${SKD}" opacity=".5" transform="translate(0 3)"/>
    <path d="${FACE}" fill="#ff5a4a" opacity="${flush.toFixed(2)}"/>
   </g>
   <path d="${FACE}" fill="none" stroke="${INK}" stroke-width="1.4"/>
   ${stubble}
   <ellipse cx="45" cy="66.6" rx="6.4" ry="4" fill="url(#bl${n})" opacity="${(0.25+blush*0.75).toFixed(2)}"/><ellipse cx="75" cy="66.6" rx="6.4" ry="4" fill="url(#bl${n})" opacity="${(0.25+blush*0.75).toFixed(2)}"/>
   ${hair}${brows}${eyesM}
   <path d="M61.4 60.4c1.8 2.6 2.4 5 1.4 6.6" fill="none" stroke="${SKD}" stroke-width="1.4" stroke-linecap="round"/>
   <ellipse cx="60.2" cy="67.2" rx="3.4" ry="1.3" fill="${SKD}" opacity=".75"/><ellipse cx="59.4" cy="64.8" rx="1.3" ry=".8" fill="${SKL}" opacity=".9"/>
   <ellipse cx="60.6" cy="65.8" rx="3.4" ry="2.5" fill="#e8584e" opacity="${nose.toFixed(2)}"/>
   ${mouthM}
   ${sleep?`<g class="av-fd" transform="translate(66 78) scale(1 ${fx.drool})"><path d="M0 0q1.6 6 .4 11q-.6 3 1.4 3.6q2.2-.6 1.2-3.6q-1.4-5-2.2-11z" fill="#bfe6ff" stroke="#6ab8e6" stroke-width=".8"/></g><path d="M44 61q-1.6 4 0 6q1.8-1.6 0-6z" fill="#bfe6ff" stroke="#6ab8e6" stroke-width=".6"/>`:""}
   ${fx.sweat?`<path class="av-fsw" d="M82 38q-3.4 5-.2 7.6q3.4-1.6.2-7.6z" fill="#bfe6ff" stroke="#6ab8e6" stroke-width=".7" transform="translate(0 ${fx.sweat[0]})" opacity="${fx.sweat[1]}"/>`:""}
   ${fx.hic?`<g class="av-fh" transform="translate(38 74) scale(${fx.hic[0]})" opacity="${fx.hic[1]}"><path d="M-2 -3l-3-4M-4.4 0h-4.6M-2 3l-3 4" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></g>`:""}
   ${fx.star?`<ellipse cx="60" cy="23" rx="24" ry="5.5" fill="none" stroke="#ffcf4a" stroke-width="1.4" opacity=".8"/>${fx.star.map(([x,y,sc,op],i)=>`<g class="av-fs" transform="translate(${x} ${y}) scale(${sc})" opacity="${op}"><path d="${star([4,3.2,4.4,3][i])}" fill="#ffcf4a" stroke="#c98f12" stroke-width=".6"/></g>`).join("")}`:""}`;
  /* buste : cou souple, chemise à la couleur du joueur, col, cravate qui se défait */
  const open1=st>=3, tieY=open1?103.5:99, V=open1?105:98.6;
  const SH=`M13 132V124C14.4 106 27 97.4 46 93.4L60 ${V}L74 93.4C93 97.4 105.6 106 107 124V132Z`;
  const neck=`<path class="av-nk" d="${R.neck}" fill="none" stroke="${INK}" stroke-width="20" stroke-linecap="round"/><path class="av-nk" d="${R.neck}" fill="none" stroke="${SK}" stroke-width="17.4" stroke-linecap="round"/>
   <g clip-path="url(#nc${n})"><g class="av-hs" transform="${R.head}"><ellipse cx="60" cy="86" rx="14" ry="6.2" fill="${SKD}" opacity=".85"/></g></g>`;
  const torso=`<g class="av-to" transform="${R.torso}">
   <path d="${SH}" fill="${c}"/>
   <path d="M74 93.4C93 97.4 105.6 106 107 124V132H86V124C87.4 112 83 100.6 74 93.4Z" fill="#000" opacity=".2"/>
   <path d="M46 93.4C33 96 24 101.6 19.4 109C26 103.6 35 99.6 47.4 97.6Z" fill="#fff" opacity=".18"/>
   <path d="M33 128C33 118 32 110 30 106M88 128C88 118 89.6 110 91.6 106" fill="none" stroke="#000" stroke-opacity=".2" stroke-width="1.2" stroke-linecap="round"/>
   <path d="${SH}" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
   ${open1?`<path d="M53 92L60 105L67 92Q60 96 53 92Z" fill="${SKD}" opacity=".9"/>`:""}
   <path d="M46 93.4L60 ${V}L54.4 ${V+2.4}L43.4 96.4Z" fill="#f7f3ee" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round" transform="rotate(${st>=5?-8:0} 46 93.4)"/>
   <path d="M74 93.4L60 ${V}L65.6 ${V+2.4}L76.6 96.4Z" fill="#e6e0d8" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>
   <g class="av-tie" data-o="60 ${tieY}" transform="rotate(${R.tie} 60 ${tieY})"><path d="M57.2 ${tieY}h5.6l-1 3.8h-3.6z" fill="#1d2a45" stroke="${INK}" stroke-width="1"/><path d="M58.2 ${tieY+3.8}h3.6l2.6 17.6l-4.4 4.8l-4.4-4.8z" fill="#22304d" stroke="${INK}" stroke-width="1"/><path d="M60 ${tieY+3.8}l4.4 17.6l-4.4 4.8z" fill="#000" opacity=".22"/><path d="M58.6 ${tieY+9}l4-2M58.4 ${tieY+15}l4.6-2.4" stroke="rgba(255,255,255,.2)" stroke-width="1.1"/></g>
   ${st>=5?`<path d="M27 111q5 2.4 9 .6M40 116q3.4 1.4 6 .2" fill="none" stroke="rgba(0,0,0,.22)" stroke-width="1.3" stroke-linecap="round"/>`:""}
   ${st>=6?`<circle cx="77" cy="113" r="3.2" fill="#8c1d32" opacity=".55"/><circle cx="81" cy="117" r="1.5" fill="#8c1d32" opacity=".5"/>`:""}</g>`;
  /* bras : manche souple de l'épaule au poignet, puis la main et le verre */
  const arm=k?`<path class="av-sl" d="${R.sl}" fill="none" stroke="${INK}" stroke-width="12.6" stroke-linecap="round"/><path class="av-sl" d="${R.sl}" fill="none" stroke="${c}" stroke-width="10" stroke-linecap="round"/>
   <path class="av-sl" d="${R.sl}" fill="none" stroke="#000" stroke-opacity=".17" stroke-width="3.4" stroke-linecap="round" transform="translate(2.9 0)"/>${avHand(k,n,P,R,SK,SKD,INK)}`:"";
  const person=`<g class="av-bd" transform="${R.body}">${neck}${torso}<g class="av-hd" transform="${R.head}">${head}</g>${arm}
   ${fx.zz?fx.zz.map(([x,y,sc,op])=>`<g class="av-fz" transform="translate(${x} ${y}) scale(${sc})" opacity="${op}"><path d="M-2.4 -2.6h4.8l-4.8 5.2h4.8" fill="none" stroke="#dfe9f7" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></g>`).join(""):""}</g>`;
  /* effets hors du personnage */
  let out="";
  if(fx.spark) out+=[["M86 30l4-6",0],["M90 35l6-3",1],["M89 25l1-6",2]].map(([d,i])=>`<path class="av-fk" d="${d}" stroke="#ffcf4a" stroke-width="2.2" stroke-linecap="round" opacity="${fx.spark[i]}"/>`).join("");
  if(fx.bub) out+=fx.bub.map(([x,y,op],i)=>`<circle class="av-fb" r="${AV_BUB[i][2]}" fill="none" stroke="#dfe9f7" stroke-width="1.3" transform="translate(${x} ${y})" opacity="${op}"/>`).join("");
  if(fx.spin!=null) out+=`<g class="av-fsp" transform="rotate(${fx.spin} 89.4 24.6)"><path d="M93 26a4.5 4.5 0 1 1 -4.5-4.5a3 3 0 1 1 -3 3a1.5 1.5 0 1 1 1.5 1.5" fill="none" stroke="#dfe9f7" stroke-width="1.5" stroke-linecap="round"/></g>`;
  if(fx.tw) out+=[[30,32,3.6],[91,24,4.4],[100,52,2.6]].map(([x,y,r],i)=>`<g class="av-ft" transform="translate(${x} ${y})" opacity="${fx.tw[i]}"><path d="${star(r)}" fill="#ffcf4a" stroke="#c98f12" stroke-width=".6"/></g>`).join("");
  const kwP={st,b,k:"water",seed:0,lvl:.8};
  const koWater=ko?`<g class="av-kw" transform="translate(33 99)"><circle cx="0" cy="-5" r="15" fill="url(#kg${n})"/><g transform="scale(.95)">${avGlass("water",n,kwP,{liq:`rotate(0 0 ${AV_GL.water.bot+(AV_GL.water.top-AV_GL.water.bot)*.8})`})}</g></g>`:"";
  const keys=b>=0.5&&!ko?`<g transform="translate(-2 -2)"><circle cx="11" cy="11" r="10.5" fill="#18140f" stroke="#ff5a4e" stroke-width="1.8"/><circle cx="7.6" cy="11" r="3" fill="none" stroke="#f7f1ea" stroke-width="1.6"/><path d="M10.6 11h6.4M15 11v2.8M12.8 11v2" stroke="#f7f1ea" stroke-width="1.6"/><path d="M4 18L18 4" stroke="#ff5a4e" stroke-width="2"/></g>`:"";
  const lab=ko?"avatar KO":st>=7?"avatar très éméché":st>=5?"avatar éméché":st>=2?"avatar pompette":"avatar en forme";
  const gk=k||(ko?"water":"");
  return `<svg class="avr" data-st="${st}" data-b="${b.toFixed(3)}" data-k="${k}" data-key="${key.replace(/[^\w-]/g,"_")}" data-seed="${P.seed}" data-lvl="${P.lvl}" data-nd="${dr.length}" viewBox="0 0 120 120" width="${size}" height="${size}" role="img" aria-label="${lab}" style="flex:none;overflow:visible">${AV_CSS}
  <defs><radialGradient id="ir${n}" cx="50%" cy="35%" r="65%"><stop offset="0" stop-color="#a8743e"/><stop offset=".6" stop-color="#6a4022"/><stop offset="1" stop-color="#3a2210"/></radialGradient>
  <clipPath id="fc${n}"><path d="${FACE}"/></clipPath><clipPath id="nc${n}"><path class="av-ncp" d="${R.nclip}"/></clipPath>
  <radialGradient id="bl${n}"><stop offset="0" stop-color="#ff5f5f" stop-opacity=".7"/><stop offset="1" stop-color="#ff4d4d" stop-opacity="0"/></radialGradient>
  <radialGradient id="bg${n}" cx="50%" cy="40%" r="65%"><stop offset="0" stop-color="#1d3354"/><stop offset="1" stop-color="#0c1728"/></radialGradient>
  <radialGradient id="ha${n}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${ring}" stop-opacity=".2"/><stop offset="1" stop-color="${ring}" stop-opacity="0"/></radialGradient>
  ${ko?`<radialGradient id="kg${n}"><stop offset="0" stop-color="#8fd0ff" stop-opacity=".32"/><stop offset="1" stop-color="#8fd0ff" stop-opacity="0"/></radialGradient>`:""}
  ${avGlassDefs(gk,n,gk===k?P:kwP)}
  <clipPath id="cc${n}"><circle cx="60" cy="60" r="55"/></clipPath>
  <clipPath id="ecl${n}"><path d="${almond(50)}"/></clipPath><clipPath id="ecr${n}"><path d="${almond(70)}"/></clipPath></defs>
  <circle cx="60" cy="60" r="55" fill="url(#bg${n})"/><circle cx="60" cy="66" r="50" fill="url(#ha${n})"/>
  <g clip-path="url(#cc${n})">${person}${out}${koWater}</g>
  <circle cx="60" cy="60" r="56" fill="none" stroke="${ring}" stroke-width="3.6"/>
  ${keys}</svg>`;
}

/* ---------- animation : une boucle pour tous les avatars de la page ---------- */
const AV_EVT={};      // par avatar : dernier verre tenu, nombre de verres, heure de la gorgée et de l'arrivée du verre
const AV_RED=(()=>{try{return matchMedia("(prefers-reduced-motion: reduce)").matches}catch(e){return false}})();
function avSet(el,a,v){ if(el&&el["_"+a]!==v){ el["_"+a]=v; el.setAttribute(a,v) } }
function avRig(svg,t){
  const d=svg.dataset, P={st:+d.st,b:+d.b,k:d.k||"",seed:+d.seed,lvl:+d.lvl,key:d.key}, q=c=>svg.querySelector("."+c), qa=c=>[...svg.querySelectorAll("."+c)], nd=+d.nd, e=AV_EVT[P.key];
  /* un verre de plus → gorgée ; un autre type de verre → il arrive par le bas, puis gorgée */
  if(!e) AV_EVT[P.key]={k:P.k,nd};
  else{ if(P.k&&e.k!==P.k) e.glAt=t; if(nd>e.nd&&P.k) e.sipAt=t+(e.glAt===t?.5:0); e.k=P.k; e.nd=nd }
  return svg._rig={P,svg,n:0,vis:true,slow:(+svg.getAttribute("width")||99)<64,
    bd:q("av-bd"),to:q("av-to"),hd:q("av-hd"),hs:q("av-hs"),nk:qa("av-nk"),ncp:q("av-ncp"),tie:q("av-tie"),tf:qa("av-tf"),
    pl:q("av-pl"),pr:q("av-pr"),lfl:q("av-lfl"),lel:q("av-lel"),lfr:q("av-lfr"),ler:q("av-ler"),eo:q("av-eo"),eh:q("av-eh"),brw:q("av-brw"),
    mo:q("av-mo"),ms:q("av-ms"),ma:q("av-ma"),sl:qa("av-sl"),hand:q("av-hand"),liq:q("av-liq"),
    fb:qa("av-fb"),fk:qa("av-fk"),fsp:q("av-fsp"),fsw:q("av-fsw"),fs:qa("av-fs"),fz:qa("av-fz"),fd:q("av-fd"),ft:qa("av-ft"),fh:q("av-fh"),kw:q("av-kw")};
}
function avApply(r,R){
  const S=avSet, fx=R.fx;
  S(r.bd,"transform",R.body); S(r.to,"transform",R.torso); S(r.hd,"transform",R.head); S(r.hs,"transform",R.head);
  r.nk.forEach(e=>S(e,"d",R.neck)); S(r.ncp,"d",R.nclip);
  if(r.tie) S(r.tie,"transform",`rotate(${R.tie} ${r.tie.dataset.o})`);
  r.tf.forEach((e,i)=>S(e,"transform",`rotate(${avF(R.tuft*(i%2?-.8:1))} ${e.dataset.o})`));
  if(R.lid){ S(r.pl,"transform",R.pl); S(r.pr,"transform",R.pr); S(r.lfl,"d",R.lid[0][0]); S(r.lel,"d",R.lid[0][1]); S(r.lfr,"d",R.lid[1][0]); S(r.ler,"d",R.lid[1][1]);
    S(r.eo,"opacity",R.eyes?0:1); S(r.eh,"opacity",R.eyes?1:0) }
  S(r.brw,"transform",R.brow); S(r.mo,"transform",R.mS);
  if(r.ms){ S(r.mo,"opacity",R.mouth?0:1); S(r.ms,"opacity",R.mouth===1?1:0); S(r.ma,"opacity",R.mouth===2?1:0) }
  if(r.hand){ r.sl.forEach(e=>S(e,"d",R.sl)); S(r.hand,"transform",R.hand); S(r.liq,"transform",R.liq) }
  if(fx.bub) r.fb.forEach((e,i)=>{ const v=fx.bub[i]; if(v){ S(e,"transform",`translate(${v[0]} ${v[1]})`); S(e,"opacity",v[2]) } });
  if(fx.spark) r.fk.forEach((e,i)=>S(e,"opacity",fx.spark[i]));
  if(fx.spin!=null) S(r.fsp,"transform",`rotate(${fx.spin} 89.4 24.6)`);
  if(fx.sweat&&r.fsw){ S(r.fsw,"transform",`translate(0 ${fx.sweat[0]})`); S(r.fsw,"opacity",fx.sweat[1]) }
  if(fx.star) r.fs.forEach((e,i)=>{ const v=fx.star[i]; S(e,"transform",`translate(${v[0]} ${v[1]}) scale(${v[2]})`); S(e,"opacity",v[3]) });
  if(fx.zz){ r.fz.forEach((e,i)=>{ const v=fx.zz[i]; S(e,"transform",`translate(${v[0]} ${v[1]}) scale(${v[2]})`); S(e,"opacity",v[3]) });
    S(r.fd,"transform",`translate(66 78) scale(1 ${fx.drool})`); r.ft.forEach((e,i)=>S(e,"opacity",fx.tw[i])); S(r.kw,"transform",`translate(33 ${avF(99+fx.kw)})`) }
  if(fx.hic&&r.fh){ S(r.fh,"transform",`translate(38 74) scale(${fx.hic[0]})`); S(r.fh,"opacity",fx.hic[1]) }
}
/* pose tous les avatars de la page pour l'instant t (secondes) */
function avFrame(t){
  const list=document.getElementsByClassName("avr"), vh=innerHeight;
  for(let i=0;i<list.length;i++){ const svg=list[i], r=svg._rig||avRig(svg,t);
    if(++r.n%20===1){ const b=svg.getBoundingClientRect(); r.vis=b.bottom>0&&b.top<vh&&b.width>0 }   // hors de l'écran : au repos
    if(!r.vis||(r.slow&&r.n%2)) continue;                                                              // petits avatars : une image sur deux
    avApply(r,avCalc(r.P,t,AV_EVT[r.P.key])) }
}
function avPoke(key){ (AV_EVT[key]=AV_EVT[key]||{}).pokeAt=performance.now()/1000 }
function avLoop(ms){ if(!self.AV_MANUAL) avFrame(ms/1000); requestAnimationFrame(avLoop) }
if(typeof requestAnimationFrame==="function"&&typeof document!=="undefined"&&!AV_RED) requestAnimationFrame(avLoop);

/* ---------- jauge : alambic en verre et cuivre (indicatif, sans graduation) ----------
   Ballon en verre qui se remplit de potion (surface en vagues, bulles), chapiteau de cuivre riveté, col de cygne,
   serpentin et fiole qui reçoit les gouttes ; brûleur dont la flamme grandit avec le taux.
   v : 0 à 1 ; from : niveau de départ pour l'animation ; down : le taux redescend ; pour : un verre vient d'être versé. */
let ALN=0;
function alambic(v,from,down,pour){
  const n=++ALN; v=cl(v); from=from==null?v:cl(from);
  const off=x=>((1-x)*54).toFixed(1), hot=v>0.55, nb=v>0.02?Math.round(3+v*6):0;
  const ms=Math.round(typeof performance!=="undefined"?performance.now():0), ph=(dur,off=0)=>`animation-delay:-${(ms+off)%dur}ms`;   // horloge commune : les boucles reprennent où elles en étaient quand l'écran est redessiné
  const bub=[...Array(nb)].map((_,i)=>`<circle cx="${34+(i*11)%40}" cy="104" r="${(.9+(i%3)*.6).toFixed(1)}" class="alb" style="${ph(2000+(i%3)*600,i*430)};animation-duration:${(2+(i%3)*0.6).toFixed(1)}s"/>`).join("");
  const wave=(y,a)=>{ let d=`M-10 ${y}`; for(let x=-10;x<130;x+=20) d+=`q5 ${-a} 10 0t10 0`; return d+`V130H-10Z` };
  const rivet=(x,y)=>`<circle cx="${x}" cy="${y}" r=".9" fill="#ffd9b0"/><circle cx="${x+.25}" cy="${y+.25}" r=".5" fill="#6b3112"/>`;
  const fl=.35+v*.65;
  return `<svg viewBox="0 0 120 120" role="img" aria-label="Jauge indicative du taux" class="alsvg${down?" aldown":""}${pour?" alpour":""}">
  <defs>
   <radialGradient id="ag${n}" cx="36%" cy="32%" r="72%"><stop offset="0" stop-color="#d6ecff" stop-opacity=".2"/><stop offset=".7" stop-color="#5a8fc4" stop-opacity=".08"/><stop offset="1" stop-color="#a9d6ff" stop-opacity=".32"/></radialGradient>
   <linearGradient id="aq${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fdcff"/><stop offset=".35" stop-color="#3d97ff"/><stop offset="1" stop-color="#123f9a"/></linearGradient>
   <linearGradient id="ac${n}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6e3313"/><stop offset=".3" stop-color="#d98a4c"/><stop offset=".5" stop-color="#ffd9b0"/><stop offset=".72" stop-color="#c06a32"/><stop offset="1" stop-color="#5e2a0f"/></linearGradient>
   <radialGradient id="ad${n}" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#ffe0bd"/><stop offset=".35" stop-color="#e09a5e"/><stop offset=".8" stop-color="#9c4d20"/><stop offset="1" stop-color="#6b3112"/></radialGradient>
   <radialGradient id="aw${n}" cx="45%" cy="68%" r="55%"><stop offset="0" stop-color="#2f8cff" stop-opacity="${(0.1+v*0.5).toFixed(2)}"/><stop offset="1" stop-color="#2f8cff" stop-opacity="0"/></radialGradient>
   <radialGradient id="af${n}" cx="50%" cy="100%" r="80%"><stop offset="0" stop-color="#fff2a8"/><stop offset=".45" stop-color="#ff9a2a"/><stop offset="1" stop-color="#ff4d2a" stop-opacity="0"/></radialGradient>
   <clipPath id="ak${n}"><circle cx="50" cy="80" r="25.4"/><rect x="43.6" y="44" width="12.8" height="20"/></clipPath>
   <clipPath id="av${n}"><path d="M99 98h11v11q0 3-3 3h-5q-3 0-3-3z"/></clipPath>
  </defs>
  <ellipse cx="54" cy="82" rx="50" ry="36" fill="url(#aw${n})"/>
  <path d="M30 112h40l-3 6H33z" fill="url(#ac${n})" stroke="#4a210b" stroke-width=".8"/>
  <path d="M33 108h34" stroke="#4a210b" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>
  <!-- potion -->
  <g clip-path="url(#ak${n})">
   <g class="alq" style="transform:translateY(${off(from)}px)" data-to="${off(v)}">
    <g class="alsl"><g class="alwv" style="${ph(3200)}"><path d="${wave(52,2.4)}" fill="url(#aq${n})"/></g>
    <g class="alwv2" opacity=".45" style="${ph(4600)}"><path d="${wave(52.6,1.8)}" fill="#bfe8ff"/></g></g>
    <rect x="-10" y="56" width="140" height="80" fill="url(#aq${n})" opacity=".85"/>
    <ellipse cx="50" cy="52.8" rx="9" ry="1.6" fill="#e6f6ff" opacity=".0" class="alrip"/>
   </g>${bub}
  </g>
  <!-- ballon en verre -->
  <path d="M43.6 44V57.6A25.4 25.4 0 1 0 56.4 57.6V44" fill="url(#ag${n})" stroke="#cfe6ff" stroke-opacity=".85" stroke-width="1.5"/>
  <path d="M45.6 46V58.6A23.4 23.4 0 1 0 54.4 58.6V46" fill="none" stroke="#cfe6ff" stroke-opacity=".18" stroke-width="1"/>
  <path d="M31.4 72q3-11 12.6-13.6" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M30.2 79.4q0 2 .4 3.6" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M66 96q4-4 5.4-9.6" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M45.2 47v8" stroke="#fff" stroke-opacity=".6" stroke-width="1.3" stroke-linecap="round"/>
  <!-- brûleur et flamme -->
  ${v>0.03?`<g class="alfl" style="opacity:${fl.toFixed(2)};${ph(1800)}"><path d="M40 112q3-${(7+v*9).toFixed(0)} 6-13q3 ${(6+v*6).toFixed(0)} 4 13q3-${(9+v*9).toFixed(0)} 6-15q3 ${(8+v*6).toFixed(0)} 6 15z" fill="url(#af${n})"/><path d="M45 112q2-6 4-8q2 5 3 8z" fill="#fffbe0" opacity=".8" class="alfl2"/></g>`:""}
  <path d="M30 112h40l-3 6H33z" fill="url(#ac${n})" stroke="#4a210b" stroke-width=".8"/>
  <!-- collier et chapiteau de cuivre -->
  <rect x="41.6" y="42" width="16.8" height="5" rx="2" fill="url(#ac${n})" stroke="#4a210b" stroke-width=".8"/>
  ${rivet(44.4,44.5)}${rivet(50,44.5)}${rivet(55.6,44.5)}
  <path d="M42.6 42q-1-9 7.4-15q8.4 6 7.4 15z" fill="url(#ad${n})" stroke="#4a210b" stroke-width=".9"/>
  <path d="M46 37.6q1-5 4-7.4" fill="none" stroke="#fff3e0" stroke-opacity=".75" stroke-width="1.3" stroke-linecap="round"/>
  <path d="M48.6 27.4q1.4-3 1.4-5q0 2 1.4 5" fill="url(#ac${n})" stroke="#4a210b" stroke-width=".7"/>
  <circle cx="50" cy="21.4" r="1.6" fill="url(#ad${n})" stroke="#4a210b" stroke-width=".6"/>
  <!-- col de cygne et serpentin -->
  <path d="M55.6 33q12-10 28-6q12 3.4 17 14.6" fill="none" stroke="#4a210b" stroke-width="5.4" stroke-linecap="round"/>
  <path d="M55.6 33q12-10 28-6q12 3.4 17 14.6" fill="none" stroke="url(#ac${n})" stroke-width="3.8" stroke-linecap="round"/>
  <path d="M60 30.4q10-6.4 22-4.4" fill="none" stroke="#ffe3c4" stroke-opacity=".7" stroke-width="1" stroke-linecap="round"/>
  <rect x="94" y="44" width="15" height="40" rx="5" fill="#9fd0ff" fill-opacity=".08" stroke="#cfe6ff" stroke-opacity=".55" stroke-width="1"/>
  ${[50,58,66,74].map(y=>`<path d="M96.4 ${y}q5 3.4 10.2 0q-5-3.4-10.2 0" fill="none" stroke="#4a210b" stroke-width="3"/><path d="M96.4 ${y}q5 3.4 10.2 0" fill="none" stroke="url(#ac${n})" stroke-width="1.8"/>`).join("")}
  <path d="M100.6 41.6V47M104.4 80v8.4" stroke="#4a210b" stroke-width="3" stroke-linecap="round"/><path d="M100.6 41.6V47M104.4 80v8.4" stroke="url(#ac${n})" stroke-width="1.6" stroke-linecap="round"/>
  <!-- fiole qui reçoit les gouttes -->
  <g clip-path="url(#av${n})"><rect x="98" y="${(110-v*10).toFixed(1)}" width="13" height="14" fill="url(#aq${n})" opacity=".85"/></g>
  <path d="M99 98h11v11q0 3-3 3h-5q-3 0-3-3z" fill="url(#ag${n})" stroke="#cfe6ff" stroke-opacity=".8" stroke-width="1"/>
  ${v>0.1?`<circle cx="104.4" cy="91" r="${(1.1+v*1).toFixed(1)}" fill="#8fd0ff" class="aldr" style="${ph(1800)}"/>`:""}
  ${hot?`<g fill="none" stroke="#dfe9f7" stroke-linecap="round" stroke-opacity=".5" stroke-width="1.5" class="alst" style="${ph(2600)}"><path d="M50 18q-4-5 0-9q4-4 0-8"/><path d="M58 20q4-4 0-8"/></g>`:""}
  <circle cx="50" cy="30" r="2.6" fill="#8fd0ff" class="alpd"/>
  </svg>`;
}
