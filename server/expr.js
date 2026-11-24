"use strict";
/* Alamb'hic — notifications « expressions » envoyées aux potes, tirées des expressions françaises de l'alcool.
   Exemples : « Max remet le facteur sur le vélo » (un verre le lendemain d'une soirée), « Max tue le ver » (avant midi),
   « Max a du vent dans les voiles » (0,8 g/L), « Max met de l'eau dans son vin » (3 verres d'eau)…
   Destinataires : les amis (liste d'amis, si le joueur partage avec eux) et les membres de ses groupes.
   Chaque destinataire choisit ce qu'il reçoit (users.notif_prefs.expr) : tout (défaut), amis, groupes ou rien.
   Garde-fous : une seule fois par session et par expression ; au plus une expression du même joueur toutes les 30 min par destinataire. */
const YD = require("../public/engine.js");
const { q } = require("./db");
const push = require("./push");
const conso = require("./conso");

const MIN = 60000, H = 3600e3;
const MODES = { tout: 1, amis: 1, groupes: 1, rien: 1 };
const sent = new Set(), lastTo = new Map();
const pick = a => a[Math.floor(Math.random() * a.length)];
const parisHour = t => +new Date(t).toLocaleString("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hour12: false }).slice(0, 2);

const LEVELS = [
  [1.2, "lvl3", "est rond comme une queue de pelle", "Un grand verre d'eau pour lui ?"],
  [0.8, "lvl2", "a du vent dans les voiles", "La soirée bat son plein."],
  [0.5, "lvl1", "a un coup dans le nez", "Pompette, mais ça va."],
];

/* qui peut recevoir les expressions de uid, et à quel titre */
async function audience(uid) {
  const tags = new Map(), add = (id, t) => { if (id === uid) return; (tags.get(id) || tags.set(id, new Set()).get(id)).add(t); };
  const { rows: fr } = await q(`SELECT CASE WHEN f.a=$1 THEN f.b ELSE f.a END AS id FROM friendships f JOIN users u ON u.id=$1
    WHERE (f.a=$1 OR f.b=$1) AND f.status='accepted' AND u.share_friends`, [uid]).catch(() => ({ rows: [] }));
  fr.forEach(r => add(r.id, "amis"));
  const { rows: gr } = await q(`SELECT DISTINCT o.user_id AS id FROM group_members m JOIN group_members o ON o.group_id=m.group_id WHERE m.user_id=$1`, [uid]);
  gr.forEach(r => add(r.id, "groupes"));
  if (!tags.size) return [];
  const { rows: pr } = await q("SELECT id, notif_prefs FROM users WHERE id = ANY($1)", [[...tags.keys()]]);
  return pr.filter(r => {
    const m = MODES[r.notif_prefs && r.notif_prefs.expr] ? r.notif_prefs.expr : "tout", t = tags.get(r.id);
    return m === "tout" || (m !== "rien" && t.has(m));
  }).map(r => r.id);
}

async function emit(uid, key, phrase, body) {
  if (sent.has(key)) return 0;
  sent.add(key); if (sent.size > 50000) sent.clear();
  const { rows } = await q("SELECT pseudo FROM users WHERE id=$1", [uid]);
  const name = (rows[0] && rows[0].pseudo) || "Un pote";
  let n = 0;
  for (const to of await audience(uid)) {
    const k = uid + ">" + to, last = lastTo.get(k) || 0;
    if (Date.now() - last < 30 * MIN) continue;
    lastTo.set(k, Date.now());
    n += await push.deliver(to, "expr", { title: `${name} ${phrase}`, body, url: "/" });
  }
  return n;
}

/* après chaque verre noté : expression de début de session, paliers de taux, verres d'eau */
async function check(uid) {
  const l = await conso.live(uid), me = l.me, now = l.now;
  if (!me.sessionStart) return;
  const base = uid + ":" + me.sessionStart, alc = me.drinks.filter(d => d.abv > 0), water = me.drinks.filter(d => d.water).length;
  if (alc.length && alc[0].t > now - 30 * MIN && !sent.has(base + ":start")) {
    const day = conso.parisDay(alc[0].t), yday = conso.parisDay(alc[0].t - 24 * H);
    const { rows } = await q(`SELECT t FROM drinks WHERE user_id=$1 AND abv>0 AND deleted_at IS NULL AND t < to_timestamp($2/1000.0) AND t > to_timestamp($2/1000.0) - interval '40 hours'`, [uid, me.sessionStart]);
    const h = parisHour(alc[0].t);
    let e;
    if (rows.some(r => conso.parisDay(+r.t) === yday) && !rows.some(r => conso.parisDay(+r.t) === day)) e = ["remet le facteur sur le vélo", "Un verre le lendemain d'une soirée."];
    else if (h >= 5 && h < 12) e = ["tue le ver", "Un premier verre avant midi."];
    else if (h >= 17 && h < 21) e = ["prend l'apéro", "Santé !"];
    else e = [pick(["lève le coude", "boit un coup", "s'humecte le gosier", "s'en jette un derrière la cravate"]), "Tchin !"];
    await emit(uid, base + ":start", ...e);
  }
  const lv = LEVELS.find(x => me.sim.cur >= x[0]);
  if (lv && !sent.has(base + ":" + lv[1])) {
    LEVELS.filter(x => x[0] < lv[0]).forEach(x => sent.add(base + ":" + x[1]));
    await emit(uid, base + ":" + lv[1], lv[2], lv[3]);
  }
  if (water >= 3 && alc.length) await emit(uid, base + ":eau", "met de l'eau dans son vin", `${water} verres d'eau pendant la session.`);
}

/* le matin (10 h, heure de Paris) : « a sûrement mal aux cheveux » après une session montée à 1 g/L ou plus */
const morningDone = new Set();
async function morning() {
  const now = Date.now(), paris = new Date(new Date(now).toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  if (paris.getHours() !== 10 || paris.getMinutes() >= 15) return;
  const day = conso.parisDay(now);
  if (morningDone.has(day)) return; morningDone.add(day);
  const { rows } = await q(`SELECT DISTINCT user_id FROM drinks WHERE abv>0 AND deleted_at IS NULL AND t > now() - interval '16 hours' AND t < now() - interval '3 hours'`);
  for (const r of rows) {
    const l = await conso.live(r.user_id).catch(() => null);
    if (!l || l.me.sessionStart) continue;   // encore en session : pas de message du matin
    const { rows: ses } = await q(`SELECT id, t, label, ml, abv, water FROM drinks WHERE user_id=$1 AND deleted_at IS NULL AND t > now() - interval '20 hours' ORDER BY t`, [r.user_id]);
    const { rows: u } = await q("SELECT sex, age, height, weight, cap FROM users WHERE id=$1", [r.user_id]);
    const dr = ses.map(d => ({ t: +d.t, ml: d.ml, abv: d.abv, ...(d.water ? { water: 1 } : {}) }));
    const peaks = conso.splitSessions(u[0], dr, []).map(s => YD.simulate({ ...u[0], drinks: s, meals: [] }, s[s.length - 1].t + 3 * H).peak);
    if (Math.max(0, ...peaks) >= 1) await emit(r.user_id, r.user_id + ":matin:" + day, "a sûrement mal aux cheveux ce matin", "Grosse soirée hier : un grand verre d'eau ?");
  }
}
setInterval(() => morning().catch(e => console.error("[expr matin]", e.message)), 5 * MIN).unref();

module.exports = { check: uid => check(uid).catch(e => console.error("[expr]", e.message)), MODES };
