"use strict";
/* Alamb'hic — la consommation appartient au joueur : un verre se note partout (seul, en soirée à code, entre potes).
   Trois façons de la regarder :
   - les SESSIONS : du premier verre d'alcool jusqu'au retour à 0 g/L (découpage automatique) ;
   - les SOIRÉES à code : début et fin prévus à l'avance (server/parties.js) ;
   - les GROUPES de potes : les courbes de tous les membres par créneaux de 48 h.
   Chaque verre garde le LIEU choisi (sélecteur avec favoris), repris par la session, les groupes et les notifications.
   Plus l'AGENDA : verres standard par jour, en couleur (vert 1-2, orange 3-5, rouge 6+), et alertes bienveillantes. */
const YD = require("../public/engine.js");
const { q } = require("./db");
const { requireUser } = require("./auth");
const crypto = require("crypto");

const MIN = 60000, H = 3600e3;
const STD = d => d.ml * d.abv / 100 * 0.789 / 10;   // verre standard français : 10 g d'alcool pur
const G_ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const parisDay = t => new Date(t).toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });   // AAAA-MM-JJ
let hooks = { drinkAdded: () => {}, activeParty: async () => null };

const profileOf = u => ({ id: u.id, pseudo: u.pseudo, sex: u.sex, age: u.age, height: u.height, weight: u.weight, cap: u.cap });
const mapDrink = d => ({ id: +d.id, t: +d.t, l: d.label, ml: d.ml, abv: d.abv, fed: d.fed, party: d.party_code || null, ...(d.water ? { water: 1 } : {}), ...(d.place ? { place: d.place } : {}) });
/* lieu d'une liste de verres : le dernier lieu noté */
const placeOf = list => { for (let i = list.length - 1; i >= 0; i--) if (list[i].place) return list[i].place; return null; };
/* vu par les autres : « Chez moi » devient « Chez lui » / « Chez elle » */
const placeForOthers = (p, sex) => p && /^chez moi$/i.test(p.trim()) ? (String(sex).toUpperCase() === "F" ? "Chez elle" : "Chez lui") : p;
const PLACE_TTL = 10 * 3600e3;   // le lieu choisi vaut pour les verres des 10 h qui suivent
const cleanPlace = v => String(v || "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
async function drinksOf(uids, from, to) {
  const { rows } = await q(`SELECT id, user_id, party_code, t, label, ml, abv, fed, water, place FROM drinks
    WHERE user_id = ANY($1) AND deleted_at IS NULL AND t >= to_timestamp($2/1000.0) AND t <= to_timestamp($3/1000.0) ORDER BY t`, [uids, from, to]);
  return rows;
}
async function mealsOf(uids, from, to) {
  const { rows } = await q(`SELECT user_id, t, kind FROM meals WHERE user_id = ANY($1) AND t >= to_timestamp($2/1000.0) AND t <= to_timestamp($3/1000.0)`, [uids, from, to]);
  return rows;
}
/* courbe réduite (un point toutes les 5 min, plus les extrémités) */
const thin = (pts, from, to) => pts.filter((x, i) => (i % 5 === 0 || i === pts.length - 1) && x[0] >= from - MIN && x[0] <= to + MIN).map(([t, b]) => [t, Math.round(b * 1000) / 1000]);

/* Découpe en sessions : un nouveau verre d'alcool bu après le retour à 0 ouvre une nouvelle session. */
function splitSessions(p, drinks, meals) {
  const alc = drinks.filter(d => d.abv > 0).sort((a, b) => a.t - b.t), out = [];
  let cur = [], zero = 0;
  const zeroOf = list => { const s = YD.simulate({ ...p, drinks: list, meals }, list[list.length - 1].t); return s.zeroT || list[list.length - 1].t + 12 * H; };
  for (const d of alc) {
    if (cur.length && d.t >= zero) { out.push(cur); cur = []; }
    cur.push(d); zero = zeroOf(cur);
  }
  if (cur.length) out.push(cur);
  return out;
}
function sessionView(p, list, allDrinks, meals, now, withPts) {
  const start = list[0].t;
  const probe = YD.simulate({ ...p, drinks: list, meals }, Math.min(now, list[list.length - 1].t));
  const end = probe.zeroT || list[list.length - 1].t + 12 * H;
  const ongoing = end > now;
  const inWin = allDrinks.filter(d => d.t >= start - 30 * MIN && d.t <= end);
  const sim = YD.simulate({ ...p, drinks: list, meals }, ongoing ? now : end);
  const parties = {};
  list.forEach(d => { if (d.party) parties[d.party] = (parties[d.party] || 0) + 1; });
  const party = Object.keys(parties).sort((a, b) => parties[b] - parties[a])[0] || null;
  return { id: start, start, end, ongoing, peak: Math.round(sim.peak * 1000) / 1000, peakT: sim.peakT, cur: ongoing ? sim.cur : 0,
    std: Math.round(list.reduce((s, d) => s + STD(d), 0) * 10) / 10, n: list.length, water: inWin.filter(d => d.water).length, party, place: placeOf(inWin),
    ...(withPts ? { pts: thin(sim.pts, start, end), drinks: inWin } : {}) };
}

async function userRow(uid) { const { rows } = await q("SELECT id, pseudo, sex, age, height, weight, cap, meals_day::text AS meals_day, places, cur_place, cur_place_t FROM users WHERE id=$1", [uid]); return rows[0]; }
/* lieu en cours : celui choisi il y a moins de 10 h */
const curPlace = (u, now = Date.now()) => u.cur_place && u.cur_place_t && now - +u.cur_place_t < PLACE_TTL ? u.cur_place : null;

/* état en direct « solo » : la session en cours (ou rien si on est à 0) */
async function live(uid, now = Date.now()) {
  const u = await userRow(uid), p = profileOf(u);
  const dr = (await drinksOf([uid], now - 36 * H, now)).map(mapDrink);
  const meals = (await mealsOf([uid], now - 48 * H, now)).map(m => ({ t: +m.t, kind: m.kind }));
  const ses = splitSessions(p, dr, meals);
  let last = ses[ses.length - 1], view = last ? sessionView(p, last, dr, meals, now, true) : null;
  const curDrinks = view && view.ongoing ? view.drinks : dr.filter(d => d.water && d.t > now - 6 * H);
  const pl = { ...p, drinks: view && view.ongoing ? last : [], meals, joined: view && view.ongoing ? view.start : now };
  const { sim, ev, score } = YD.scoreSummary(pl, now);
  const party = await hooks.activeParty(uid);
  const mealsOk = u.meals_day === parisDay(now) || meals.some(m => m.t > now - 16 * H) || (party && party.meals_ok);
  return { now, party, me: { id: uid, pseudo: u.pseudo, cap: u.cap, sam: !!(party && party.sam), mealsOk: !!mealsOk, drinks: curDrinks,
    sim: { pts: view && view.ongoing ? view.pts : [], cur: sim.cur, prev: sim.prev, peak: sim.peak, peakT: sim.peakT, zeroT: sim.zeroT, grams: sim.grams },
    ev: view && view.ongoing ? ev : [], score, sessionStart: view && view.ongoing ? view.start : null,
    place: (view && view.ongoing && view.place) || curPlace(u, now), places: u.places || [] } };
}

/* ajout d'un verre (seul ou en soirée) : mêmes règles anti-triche partout */
async function addDrink(uid, b) {
  const ml = +b.ml, abv = +b.abv, ago = Math.round(+b.agoMin || 0), water = abv === 0;
  const label = String(b.label || (water ? "Eau" : "Verre perso")).slice(0, 30);
  if (!(ml >= 10 && ml <= 1000)) throw Object.assign(new Error("Indiquez un volume entre 1 et 100 cl."), { status: 400 });
  if (!(abv >= 0 && abv <= 80)) throw Object.assign(new Error("Indiquez un degré entre 0 et 80 %."), { status: 400 });
  if (!(ago >= 0 && ago <= 180)) throw Object.assign(new Error("Un verre peut être noté jusqu'à 3 h après coup."), { status: 400 });
  const party = await hooks.activeParty(uid);
  if (party && party.sam && !water) throw Object.assign(new Error("Vous êtes Sam ce soir : seulement des boissons sans alcool."), { status: 400 });
  if (!water) {
    const l = await live(uid);
    if (!l.me.mealsOk && !l.me.drinks.some(d => d.abv > 0)) throw Object.assign(new Error("Avant votre premier verre, indiquez vos repas du jour (ou « rien mangé »)."), { status: 400 });
    const { rows: recent } = await q(`SELECT count(*)::int AS n FROM drinks WHERE user_id=$1 AND abv>0 AND deleted_at IS NULL AND created_at > now() - interval '10 minutes'`, [uid]);
    if (recent[0].n >= 6) throw Object.assign(new Error("Six verres d'alcool en dix minutes : ce rythme n'est pas crédible. Patientez un peu."), { status: 429 });
  }
  const place = curPlace(await userRow(uid));
  const { rows } = await q(`INSERT INTO drinks(user_id, party_code, t, label, ml, abv, fed, water, place) VALUES($1,$2, now() - make_interval(mins => $3), $4,$5,$6,false,$7,$8) RETURNING id, t`,
    [uid, party ? party.code : null, ago, label, ml, abv, water, place]);
  if (party) await q("UPDATE parties SET last_activity=now() WHERE code=$1", [party.code]);
  hooks.drinkAdded(uid, party && party.code);
  return { ok: true, id: +rows[0].id, t: +rows[0].t, party: party ? party.code : null };
}
async function delDrink(uid, id, undo) {
  if (undo) {
    const { rows } = await q(`DELETE FROM drinks WHERE id=$1 AND user_id=$2 AND created_at > now() - interval '60 seconds' RETURNING party_code`, [id, uid]);
    if (rows[0]) { hooks.drinkAdded(uid, rows[0].party_code); return; }
  }
  const { rows } = await q(`UPDATE drinks SET deleted_at=now() WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL AND created_at > now() - interval '3 hours' RETURNING party_code`, [id, uid]);
  if (!rows[0]) throw Object.assign(new Error("Ce verre ne peut plus être supprimé (plus de 3 h)."), { status: 400 });
  hooks.drinkAdded(uid, rows[0].party_code);
}

/* choisir le lieu : vaut pour la session en cours (verres déjà notés compris) et les verres des 10 h qui suivent */
async function setPlace(uid, b) {
  const place = cleanPlace(b.place), u = await userRow(uid);
  let favs = Array.isArray(u.places) ? u.places.slice() : [];
  if (Array.isArray(b.favs)) favs = b.favs.map(cleanPlace).filter(Boolean);
  if (place && b.fav) favs = [place, ...favs.filter(f => f.toLowerCase() !== place.toLowerCase())];
  favs = [...new Map(favs.map(f => [f.toLowerCase(), f])).values()].slice(0, 12);
  if ("place" in b) {
    await q("UPDATE users SET cur_place=$2, cur_place_t=now(), places=$3::jsonb WHERE id=$1", [uid, place || null, JSON.stringify(favs)]);
    const l = await live(uid);
    if (l.me.sessionStart) await q("UPDATE drinks SET place=$3 WHERE user_id=$1 AND deleted_at IS NULL AND t >= to_timestamp($2/1000.0) - interval '30 minutes'", [uid, l.me.sessionStart, place || null]);
  } else await q("UPDATE users SET places=$2::jsonb WHERE id=$1", [uid, JSON.stringify(favs)]);
  const n = await userRow(uid);
  return { place: curPlace(n), places: n.places || [] };
}

/* agenda : verres standard par jour (heure de Paris) ; alertes bienveillantes */
async function calendar(uid, month) {
  const [y, m] = month.split("-").map(Number);
  const from = Date.UTC(y, m - 1, 1) - 8 * 24 * H, to = Date.UTC(y, m, 1) + 8 * 24 * H;
  const { rows } = await q(`SELECT to_char(t AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD') AS day, sum(ml*abv/100*0.789)/10 AS std, count(*)::int AS n
    FROM drinks WHERE user_id=$1 AND deleted_at IS NULL AND abv>0 AND t >= to_timestamp($2/1000.0) AND t < to_timestamp($3/1000.0) GROUP BY 1 ORDER BY 1`, [uid, from, to]);
  const days = {}; rows.forEach(r => { days[r.day] = { std: Math.round(r.std * 10) / 10, n: r.n }; });
  /* 30 derniers jours pour les alertes */
  const { rows: last } = await q(`SELECT to_char(t AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD') AS day, sum(ml*abv/100*0.789)/10 AS std
    FROM drinks WHERE user_id=$1 AND deleted_at IS NULL AND abv>0 AND t > now() - interval '30 days' GROUP BY 1`, [uid]);
  const today = parisDay(Date.now()), d7 = parisDay(Date.now() - 6 * 24 * H);
  const week = last.filter(r => r.day >= d7 && r.day <= today).reduce((s, r) => s + +r.std, 0);
  const heavy = last.filter(r => Math.round(r.std) >= 6).length, daysOn7 = last.filter(r => r.day >= d7).length;
  const alerts = [];
  if (week > 10) alerts.push({ level: "orange", text: `${Math.round(week)} verres standard sur les 7 derniers jours : c'est au-dessus du repère de 10 par semaine.` });
  if (heavy) alerts.push({ level: "red", text: `${heavy} jour${heavy > 1 ? "s" : ""} à 6 verres ou plus ce dernier mois. Boire beaucoup en une occasion est le plus risqué.` });
  if (daysOn7 >= 6) alerts.push({ level: "orange", text: "De l'alcool presque tous les jours cette semaine. Des jours sans alcool font du bien." });
  return { month, days, week: Math.round(week * 10) / 10, alerts };
}

/* ---------- groupes de potes ---------- */
async function groupMember(gid, uid) { const { rows } = await q("SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2", [gid, uid]); return !!rows[0]; }
async function groupView(gid, end) {
  const { rows: g } = await q("SELECT id, name, code, created_by FROM groups WHERE id=$1", [gid]);
  const { rows: mem } = await q(`SELECT u.id, u.pseudo, u.sex, u.age, u.height, u.weight, u.cap, gm.joined_at FROM group_members gm JOIN users u ON u.id=gm.user_id
    WHERE gm.group_id=$1 ORDER BY gm.joined_at`, [gid]);
  const now = Date.now(), start = end - 48 * H, ids = mem.map(m => m.id);
  const dr = (await drinksOf(ids, start - 18 * H, Math.min(end, now))).map(d => ({ ...mapDrink(d), uid: d.user_id }));
  const ml = (await mealsOf(ids, start - 30 * H, Math.min(end, now))).map(m => ({ uid: m.user_id, t: +m.t, kind: m.kind }));
  const members = mem.map(m => {
    const p = profileOf(m), drinks = dr.filter(d => d.uid === m.id), meals = ml.filter(x => x.uid === m.id);
    const sim = YD.simulate({ ...p, drinks, meals }, Math.min(now, end));
    const win = drinks.filter(d => d.t >= start && d.abv > 0);
    /* titre actuel : le dernier titre gagné sur le créneau (pas les simples infos) */
    /* … de la dernière session seulement (sinon un « Retour sur Terre » d'hier masquerait la session en cours) */
    const ses = splitSessions(p, drinks.filter(d => d.t <= end), meals), last = ses[ses.length - 1] || [];
    const lastD = last.length ? drinks.filter(d => d.t >= last[0].t - 30 * MIN && d.t <= end) : [];
    const tNow = Math.min(now, end), simL = YD.simulate({ ...p, drinks: lastD, meals }, tNow);
    const ev = lastD.length ? YD.events({ ...p, drinks: lastD, meals, joined: last[0].t }, simL, tNow).filter(e => e.kind !== "info" && e.t >= start && e.t <= end).sort((a, b) => b.t - a.t) : [];
    return { id: m.id, pseudo: m.pseudo, cap: m.cap, sim: { pts: thin(sim.pts, start, end), cur: end >= now ? sim.cur : 0, prev: sim.prev, peak: sim.peak, peakT: sim.peakT, zeroT: sim.zeroT },
      title: ev[0] ? { title: ev[0].title, kind: ev[0].kind, t: ev[0].t } : null, place: end >= now && simL.cur > 0 ? placeForOthers(placeOf(lastD), m.sex) : null,
      std: Math.round(win.reduce((s, d) => s + STD(d), 0) * 10) / 10, n: win.length, water: drinks.filter(d => d.water && d.t >= start).length };
  });
  return { id: +g[0].id, name: g[0].name, code: g[0].code, start, end, now, members };
}

function routes(app, h) {
  hooks = { ...hooks, ...h };
  app.get("/api/me/live", requireUser, async (req, res) => res.json(await live(req.user.id)));
  app.get("/api/me/place", requireUser, async (req, res) => { const u = await userRow(req.user.id); res.json({ place: curPlace(u), places: u.places || [] }); });
  app.put("/api/me/place", requireUser, async (req, res) => {
    try { const r = await setPlace(req.user.id, req.body || {}); hooks.drinkAdded(req.user.id, null); res.json(r); } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/me/drinks", requireUser, async (req, res) => {
    try { res.json(await addDrink(req.user.id, req.body || {})); } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });
  app.delete("/api/me/drinks/:id", requireUser, async (req, res) => {
    try { await delDrink(req.user.id, +req.params.id, req.query.undo === "1"); res.json({ ok: true }); } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });
  app.put("/api/me/meals-ok", requireUser, async (req, res) => {
    await q("UPDATE users SET meals_day=$2::date WHERE id=$1", [req.user.id, parisDay(Date.now())]);
    await q("UPDATE party_members SET meals_ok=true WHERE user_id=$1 AND left_at IS NULL", [req.user.id]);
    hooks.drinkAdded(req.user.id, null);
    res.json({ ok: true });
  });
  app.get("/api/me/sessions", requireUser, async (req, res) => {
    const days = Math.min(120, Math.max(7, +req.query.days || 60)), now = Date.now();
    const u = await userRow(req.user.id), p = profileOf(u);
    const dr = (await drinksOf([req.user.id], now - days * 24 * H, now)).map(mapDrink);
    const meals = (await mealsOf([req.user.id], now - (days + 2) * 24 * H, now)).map(m => ({ t: +m.t, kind: m.kind }));
    const ses = splitSessions(p, dr, meals).map(l => sessionView(p, l, dr, meals, now, true)).reverse();
    const codes = [...new Set(ses.map(s => s.party).filter(Boolean))];
    const names = codes.length ? (await q("SELECT code, name FROM parties WHERE code = ANY($1)", [codes])).rows : [];
    ses.forEach(s => { if (s.party) s.partyName = (names.find(n => n.code === s.party) || {}).name || null; });
    res.json({ sessions: ses, now });
  });
  app.get("/api/me/calendar", requireUser, async (req, res) => {
    const m = /^\d{4}-\d{2}$/.test(req.query.month || "") ? req.query.month : parisDay(Date.now()).slice(0, 7);
    res.json(await calendar(req.user.id, m));
  });

  /* groupes */
  app.get("/api/groups", requireUser, async (req, res) => {
    const { rows } = await q(`SELECT g.id, g.name, g.code, (SELECT count(*)::int FROM group_members x WHERE x.group_id=g.id) AS n
      FROM groups g JOIN group_members gm ON gm.group_id=g.id WHERE gm.user_id=$1 ORDER BY g.created_at DESC`, [req.user.id]);
    res.json({ groups: rows.map(r => ({ ...r, id: +r.id })) });
  });
  app.post("/api/groups", requireUser, async (req, res) => {
    const name = String(req.body.name || "").trim().slice(0, 40);
    if (!name) return res.status(400).json({ error: "Donnez un nom au groupe." });
    const { rows: c } = await q("SELECT count(*)::int AS n FROM group_members WHERE user_id=$1", [req.user.id]);
    if (c[0].n >= 20) return res.status(400).json({ error: "20 groupes au plus." });
    for (let i = 0; i < 20; i++) {
      const code = Array.from({ length: 6 }, () => G_ALPHA[crypto.randomInt(G_ALPHA.length)]).join("");
      const r = await q("INSERT INTO groups(name, code, created_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id", [name, code, req.user.id]);
      if (r.rows[0]) { await q("INSERT INTO group_members(group_id, user_id) VALUES($1,$2)", [r.rows[0].id, req.user.id]); return res.json({ id: +r.rows[0].id, code }); }
    }
    res.status(503).json({ error: "Groupe impossible à créer. Réessayez." });
  });
  app.post("/api/groups/join", requireUser, async (req, res) => {
    const code = String(req.body.code || "").trim().toUpperCase();
    if (!/^[A-Z2-9]{6}$/.test(code)) return res.status(400).json({ error: "Le code de groupe fait 6 caractères." });
    const { rows } = await q("SELECT id FROM groups WHERE code=$1", [code]);
    if (!rows[0]) return res.status(404).json({ error: "Aucun groupe avec ce code." });
    const { rows: n } = await q("SELECT count(*)::int AS n FROM group_members WHERE group_id=$1", [rows[0].id]);
    if (n[0].n >= 30) return res.status(400).json({ error: "Ce groupe est complet (30 membres)." });
    await q("INSERT INTO group_members(group_id, user_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [rows[0].id, req.user.id]);
    res.json({ id: +rows[0].id });
  });
  app.get("/api/groups/:id", requireUser, async (req, res) => {
    const gid = +req.params.id;
    if (!(await groupMember(gid, req.user.id))) return res.status(403).json({ error: "Vous ne faites pas partie de ce groupe." });
    const now = Date.now(), top = Math.ceil((now + 6 * H) / H) * H, end = Math.min(Math.round((+req.query.end || top) / H) * H, top);   // créneau aligné sur l'heure
    res.json(await groupView(gid, end));
  });
  app.delete("/api/groups/:id/me", requireUser, async (req, res) => {
    const gid = +req.params.id;
    await q("DELETE FROM group_members WHERE group_id=$1 AND user_id=$2", [gid, req.user.id]);
    await q("DELETE FROM groups g WHERE id=$1 AND NOT EXISTS (SELECT 1 FROM group_members WHERE group_id=g.id)", [gid]);
    res.json({ ok: true });
  });
}

module.exports = { routes, live, splitSessions, addDrink, delDrink, calendar, STD, parisDay, placeOf, placeForOthers };
