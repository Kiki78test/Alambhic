"use strict";
const { WebSocketServer } = require("ws");
const YD = require("../public/engine.js");
const { q } = require("./db");
const { requireUser, userIdFromReq } = require("./auth");
const push = require("./push");
const crypto = require("crypto");

const MIN = 60000;
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_RE = /^[A-Z]{4}$/;

/* ---------- instantané d'une soirée (calcul côté serveur) ---------- */
/* opt.recap : récapitulatif public, seulement les joueurs qui l'ont accepté (même partis), sans trace des suppressions */
async function snapshot(code, opt = {}) {
  const now = Date.now();
  const { rows: mem } = await q(`
    SELECT u.id, u.pseudo, u.sex, u.age, u.height, u.weight, u.cap, m.sam, m.fed, m.meals_ok, m.joined_at, m.recap_ok
    FROM party_members m JOIN users u ON u.id = m.user_id
    WHERE m.party_code=$1 AND ${opt.recap ? "m.recap_ok" : "m.left_at IS NULL"} ORDER BY m.joined_at`, [code]);
  const { rows: dr } = await q(`
    SELECT id, user_id, t, label, ml, abv, fed, water, deleted_at FROM drinks
    WHERE party_code=$1 ORDER BY t`, [code]);
  const { rows: ml } = await q(`
    SELECT me.user_id, me.t, me.kind FROM meals me JOIN party_members m ON m.user_id = me.user_id
    WHERE m.party_code=$1 AND ${opt.recap ? "m.recap_ok" : "m.left_at IS NULL"} AND me.t > now() - interval '30 hours'`, [code]);
  const log = [];
  const members = mem.map(m => {
    const drinks = dr.filter(d => d.user_id === m.id && !d.deleted_at)
      .map(d => ({ id: +d.id, t: +d.t, l: d.label, ml: d.ml, abv: d.abv, fed: d.fed, ...(d.water ? { water: 1 } : {}) }));
    if (!opt.recap) dr.filter(d => d.user_id === m.id && d.deleted_at)
      .forEach(d => log.push({ key: "del:" + d.id, pid: m.id, kind: "info", t: +d.deleted_at, title: "Verre supprimé",
        text: `${m.pseudo} a supprimé un verre (${d.label}, noté à ${new Date(+d.t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })}).` }));
    const meals = ml.filter(x => x.user_id === m.id).map(x => ({ t: +x.t, kind: x.kind }));
    const p = { id: m.id, pseudo: m.pseudo, sex: m.sex, age: m.age, height: m.height, weight: m.weight, cap: m.cap, sam: m.sam, joined: +m.joined_at, drinks, meals };
    const { sim, ev, score } = YD.scoreSummary(p, now);
    const pts = sim.pts.filter((x, i) => i % 5 === 0 || Math.abs(x[0] - now) < MIN || i === sim.pts.length - 1)
      .map(([t, b]) => [t, Math.round(b * 1000) / 1000]);
    return { id: m.id, pseudo: m.pseudo, cap: m.cap, sam: m.sam, fed: m.fed, mealsOk: m.meals_ok, recapOk: m.recap_ok, sex: m.sex, joined: p.joined, drinks,
      sim: { pts, cur: sim.cur, prev: sim.prev, peak: sim.peak, peakT: sim.peakT, zeroT: sim.zeroT, grams: sim.grams }, ev, score };
  });
  if (opt.recap) return { now, members: members.map(({ id, recapOk, ...m }, i) => ({ id: "j" + i, ...m, ev: m.ev.map(e => ({ ...e, pid: "j" + i, key: "j" + i + ":" + e.key.split(":")[1] })) })) };
  persistTrophies(code, members).catch(e => console.error("trophées", e.message));
  return { code, now, members, log };
}

/* chaque titre est gardé une fois ; un titre nouveau part en notification push (autres joueurs, amis) */
async function persistTrophies(code, members) {
  const fresh = [];
  for (const m of members) for (const e of m.ev) {
    const r = await q(`INSERT INTO trophies(user_id, party_code, key, kind, title, t) VALUES($1,$2,$3,$4,$5,to_timestamp($6/1000.0))
             ON CONFLICT DO NOTHING RETURNING key`, [m.id, code, e.key.split(":")[1], e.kind, e.title, e.t]);
    if (r.rows[0]) fresh.push(e);
  }
  if (fresh.length) push.partyEvents(code, fresh, members).catch(e => console.error("push", e.message));
}

/* ---------- temps réel ---------- */
const rooms = new Map(); // code -> Set(ws)
const tvRooms = new Map(); // code -> Set(ws) des écrans TV
async function broadcast(code) {
  const set = rooms.get(code), tvs = tvRooms.get(code);
  if ((!set || !set.size) && (!tvs || !tvs.size)) return;
  const data = await snapshot(code);
  const msg = JSON.stringify({ type: "party", data });
  for (const ws of set || []) if (ws.readyState === 1) ws.send(msg);
  if (tvs && tvs.size) {
    const tv = JSON.stringify({ type: "party", data: tvData(data) });
    for (const ws of tvs) if (ws.readyState === 1) ws.send(tv);
  }
}
/* écran TV : pas de verres supprimés ni d'identifiants de compte */
const tvData = d => ({ code: d.code, now: d.now, members: d.members.map((m, i) => ({ ...m, id: "t" + i, ev: m.ev.map(e => ({ ...e, pid: "t" + i, key: "t" + i + ":" + e.key.split(":")[1] })) })) });
function tvSend(code, obj) { const s = tvRooms.get(code); if (s) for (const ws of s) if (ws.readyState === 1) ws.send(JSON.stringify(obj)); }
setInterval(() => { for (const code of new Set([...rooms.keys(), ...tvRooms.keys()])) broadcast(code).catch(e => console.error("diffusion", e.message)); }, MIN);

function attachWs(server) {
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", async (req, socket, head) => {
    try {
      const url = new URL(req.url, "http://x");
      if (url.pathname !== "/ws") return socket.destroy();
      const tvc = String(url.searchParams.get("tv") || "").toUpperCase();
      if (tvc) {   // écran TV : code à 6 caractères, valable 12 h
        const { rows: t } = await q("SELECT party_code, view FROM tv_links WHERE tv=$1 AND exp > now()", [tvc]);
        if (!t[0]) return socket.destroy();
        const pc = t[0].party_code;
        return wss.handleUpgrade(req, socket, head, ws => {
          if (!tvRooms.has(pc)) tvRooms.set(pc, new Set());
          tvRooms.get(pc).add(ws); ws.isAlive = true;
          ws.on("pong", () => { ws.isAlive = true; });
          ws.on("close", () => { const s = tvRooms.get(pc); if (s) { s.delete(ws); if (!s.size) tvRooms.delete(pc); } });
          ws.send(JSON.stringify({ type: "view", view: t[0].view }));
          snapshot(pc).then(d => ws.send(JSON.stringify({ type: "party", data: tvData(d) }))).catch(() => {});
        });
      }
      const code = String(url.searchParams.get("code") || "").toUpperCase();
      const uid = userIdFromReq(req);
      if (!uid || !CODE_RE.test(code)) return socket.destroy();
      const { rows } = await q("SELECT 1 FROM party_members WHERE party_code=$1 AND user_id=$2 AND left_at IS NULL", [code, uid]);
      if (!rows[0]) return socket.destroy();
      wss.handleUpgrade(req, socket, head, ws => {
        if (!rooms.has(code)) rooms.set(code, new Set());
        rooms.get(code).add(ws);
        ws.isAlive = true;
        ws.on("pong", () => { ws.isAlive = true; });
        ws.on("close", () => { const s = rooms.get(code); if (s) { s.delete(ws); if (!s.size) rooms.delete(code); } });
        snapshot(code).then(d => ws.send(JSON.stringify({ type: "party", data: d }))).catch(() => {});
      });
    } catch (e) { socket.destroy(); }
  });
  setInterval(() => wss.clients.forEach(ws => { if (!ws.isAlive) return ws.terminate(); ws.isAlive = false; ws.ping(); }), 30000);
}

async function rebroadcastFor(uid) {
  const { rows } = await q("SELECT party_code FROM party_members WHERE user_id=$1 AND left_at IS NULL", [uid]);
  rows.forEach(r => broadcast(r.party_code).catch(() => {}));
}

/* ---------- routes ---------- */
async function member(req, res) {
  const code = String(req.params.code || "").toUpperCase();
  if (!CODE_RE.test(code)) { res.status(400).json({ error: "Le code de soirée fait 4 lettres." }); return null; }
  const { rows } = await q("SELECT sam, fed, meals_ok FROM party_members WHERE party_code=$1 AND user_id=$2 AND left_at IS NULL", [code, req.user.id]);
  if (!rows[0]) { res.status(403).json({ error: "Vous ne faites pas partie de cette soirée." }); return null; }
  return { code, ...rows[0] };
}
const profileReady = u => u.pseudo && u.age >= 18 && u.height && u.weight;

async function joinParty(uid, code) {
  await q(`UPDATE party_members SET left_at=now() WHERE user_id=$1 AND left_at IS NULL AND party_code<>$2`, [uid, code]);
  await q(`INSERT INTO party_members(party_code, user_id) VALUES($1,$2)
           ON CONFLICT (party_code, user_id) DO UPDATE SET left_at=NULL`, [code, uid]);
  await q("UPDATE parties SET last_activity=now() WHERE code=$1", [code]);
}

function routes(app) {
  app.get("/api/parties/current", requireUser, async (req, res) => {
    const { rows } = await q(`SELECT party_code FROM party_members WHERE user_id=$1 AND left_at IS NULL ORDER BY joined_at DESC LIMIT 1`, [req.user.id]);
    res.json({ code: rows[0] ? rows[0].party_code : null });
  });

  app.post("/api/parties", requireUser, async (req, res) => {
    if (!profileReady(req.user)) return res.status(400).json({ error: "Complétez d'abord votre profil." });
    for (let i = 0; i < 20; i++) {
      const code = Array.from({ length: 4 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join("");
      const r = await q("INSERT INTO parties(code, created_by) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING code", [code, req.user.id]);
      if (r.rows[0]) { await joinParty(req.user.id, code); return res.json({ code }); }
    }
    res.status(503).json({ error: "Impossible de créer une soirée pour le moment. Réessayez." });
  });

  app.post("/api/parties/:code/join", requireUser, async (req, res) => {
    if (!profileReady(req.user)) return res.status(400).json({ error: "Complétez d'abord votre profil." });
    const code = String(req.params.code || "").toUpperCase();
    if (!CODE_RE.test(code)) return res.status(400).json({ error: "Le code de soirée fait 4 lettres." });
    const { rows } = await q("SELECT code FROM parties WHERE code=$1", [code]);
    if (!rows[0]) return res.status(404).json({ error: "Aucune soirée avec ce code. Vérifiez les 4 lettres." });
    await joinParty(req.user.id, code);
    res.json({ code });
    broadcast(code).catch(() => {});
  });

  app.post("/api/parties/:code/leave", requireUser, async (req, res) => {
    const m = await member(req, res); if (!m) return;
    await q("UPDATE party_members SET left_at=now() WHERE party_code=$1 AND user_id=$2", [m.code, req.user.id]);
    res.json({ ok: true });
    broadcast(m.code).catch(() => {});
  });

  app.get("/api/parties/:code", requireUser, async (req, res) => {
    const m = await member(req, res); if (!m) return;
    res.json(await snapshot(m.code));
  });

  app.put("/api/parties/:code/me", requireUser, async (req, res) => {
    const m = await member(req, res); if (!m) return;
    if (req.body.mealsOk) await q("UPDATE party_members SET meals_ok=true WHERE party_code=$1 AND user_id=$2", [m.code, req.user.id]);
    const sam = req.body.sam === undefined ? m.sam : !!req.body.sam;
    const fed = req.body.fed === undefined ? m.fed : !!req.body.fed;
    if (sam && !m.sam) {
      const { rows } = await q("SELECT 1 FROM drinks WHERE party_code=$1 AND user_id=$2 AND abv>0 AND deleted_at IS NULL LIMIT 1", [m.code, req.user.id]);
      if (rows[0]) return res.status(400).json({ error: "Vous avez déjà bu de l'alcool ce soir : impossible d'être Sam." });
    }
    await q("UPDATE party_members SET sam=$3, fed=$4 WHERE party_code=$1 AND user_id=$2", [m.code, req.user.id, sam, fed]);
    res.json({ ok: true });
    broadcast(m.code).catch(() => {});
  });

  app.post("/api/parties/:code/drinks", requireUser, async (req, res) => {
    const m = await member(req, res); if (!m) return;
    const b = req.body || {};
    const ml = +b.ml, abv = +b.abv, ago = Math.round(+b.agoMin || 0);
    const water = abv === 0;
    const label = String(b.label || (water ? "Eau" : "Verre perso")).slice(0, 30);
    if (!(ml >= 10 && ml <= 1000)) return res.status(400).json({ error: "Indiquez un volume entre 1 et 100 cl." });
    if (!(abv >= 0 && abv <= 80)) return res.status(400).json({ error: "Indiquez un degré entre 0 et 80 %." });
    if (!(ago >= 0 && ago <= 180)) return res.status(400).json({ error: "Un verre peut être noté jusqu'à 3 h après coup." });
    if (m.sam && !water) return res.status(400).json({ error: "Vous êtes Sam ce soir : seulement des boissons sans alcool." });
    if (!m.meals_ok && !water) {
      const { rows: had } = await q("SELECT 1 FROM drinks WHERE party_code=$1 AND user_id=$2 AND abv>0 AND deleted_at IS NULL LIMIT 1", [m.code, req.user.id]);
      if (!had[0]) return res.status(400).json({ error: "Avant votre premier verre, indiquez vos repas du jour (ou « rien mangé »)." });
    }
    const { rows: recent } = await q(`SELECT count(*)::int AS n FROM drinks WHERE user_id=$1 AND abv>0 AND deleted_at IS NULL
                                       AND created_at > now() - interval '10 minutes'`, [req.user.id]);
    if (!water && recent[0].n >= 6) return res.status(429).json({ error: "Six verres d'alcool en dix minutes : ce rythme n'est pas crédible. Patientez un peu." });
    const fed = b.fed === undefined ? m.fed : !!b.fed;
    const { rows: ins } = await q(`INSERT INTO drinks(user_id, party_code, t, label, ml, abv, fed, water) VALUES($1,$2, now() - make_interval(mins => $3), $4,$5,$6,$7,$8) RETURNING id, t`,
      [req.user.id, m.code, ago, label, ml, abv, fed, water]);
    await q("UPDATE parties SET last_activity=now() WHERE code=$1", [m.code]);
    res.json({ ok: true, id: +ins[0].id, t: +ins[0].t });
    broadcast(m.code).catch(() => {});
  });

  app.delete("/api/parties/:code/drinks/:id", requireUser, async (req, res) => {
    const m = await member(req, res); if (!m) return;
    // Annulation dans la minute (bouton « Annuler ») : effacement sans trace dans le fil.
    if (req.query.undo === "1") {
      const { rows: u } = await q(`DELETE FROM drinks WHERE id=$1 AND user_id=$2 AND party_code=$3 AND created_at > now() - interval '60 seconds' RETURNING id`,
        [+req.params.id, req.user.id, m.code]);
      if (u[0]) { res.json({ ok: true }); broadcast(m.code).catch(() => {}); return; }
    }
    const { rows } = await q(`UPDATE drinks SET deleted_at=now() WHERE id=$1 AND user_id=$2 AND party_code=$3 AND deleted_at IS NULL
                              AND created_at > now() - interval '3 hours' RETURNING id`, [+req.params.id, req.user.id, m.code]);
    if (!rows[0]) return res.status(400).json({ error: "Ce verre ne peut plus être supprimé (plus de 3 h)." });
    res.json({ ok: true });
    broadcast(m.code).catch(() => {});
  });

  /* Écran TV : un joueur crée un code TV (6 caractères, 12 h) ; la TV ouvre /tv et le saisit ; le téléphone choisit la vue */
  const TV_ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789", VIEWS = ["auto", "potes", "courbes", "fil"];
  app.post("/api/parties/:code/tv", requireUser, async (req, res) => {
    const m = await member(req, res); if (!m) return;
    const { rows: ex } = await q("SELECT tv, view FROM tv_links WHERE party_code=$1 AND exp > now() + interval '1 hour' ORDER BY exp DESC LIMIT 1", [m.code]);
    if (ex[0]) return res.json({ tv: ex[0].tv, view: ex[0].view });
    for (let i = 0; i < 20; i++) {
      const tv = Array.from({ length: 6 }, () => TV_ALPHA[crypto.randomInt(TV_ALPHA.length)]).join("");
      const r = await q("INSERT INTO tv_links(tv, party_code, exp) VALUES($1,$2, now() + interval '12 hours') ON CONFLICT DO NOTHING RETURNING tv", [tv, m.code]);
      if (r.rows[0]) return res.json({ tv, view: "auto" });
    }
    res.status(503).json({ error: "Code TV impossible à créer. Réessayez." });
  });
  app.put("/api/parties/:code/tv", requireUser, async (req, res) => {
    const m = await member(req, res); if (!m) return;
    const view = VIEWS.includes(req.body.view) ? req.body.view : "auto";
    await q("UPDATE tv_links SET view=$2 WHERE party_code=$1 AND exp > now()", [m.code, view]);
    tvSend(m.code, { type: "view", view });
    res.json({ ok: true, view });
  });
  app.get("/api/tv/:tv", async (req, res) => {
    const tv = String(req.params.tv || "").toUpperCase();
    if (!/^[A-Z2-9]{6}$/.test(tv)) return res.status(400).json({ error: "Le code TV fait 6 caractères." });
    const { rows } = await q("SELECT party_code, view FROM tv_links WHERE tv=$1 AND exp > now()", [tv]);
    if (!rows[0]) return res.status(404).json({ error: "Code TV inconnu ou expiré. Demandez-en un nouveau sur un téléphone de la soirée." });
    res.json({ view: rows[0].view, data: tvData(await snapshot(rows[0].party_code)) });
  });

  /* Récapitulatif public de la soirée : lien partageable ; seuls les joueurs qui ont coché « apparaître » y figurent (pseudo seulement) */
  app.put("/api/parties/:code/recap-ok", requireUser, async (req, res) => {
    const m = await member(req, res); if (!m) return;
    await q("UPDATE party_members SET recap_ok=$3 WHERE party_code=$1 AND user_id=$2", [m.code, req.user.id, !!req.body.ok]);
    res.json({ ok: true }); broadcast(m.code).catch(() => {});
  });
  app.post("/api/parties/:code/recap", requireUser, async (req, res) => {
    const m = await member(req, res); if (!m) return;
    await q("UPDATE party_members SET recap_ok=true WHERE party_code=$1 AND user_id=$2", [m.code, req.user.id]);
    const { rows: ex } = await q("SELECT token FROM recaps WHERE party_code=$1 LIMIT 1", [m.code]);
    const token = ex[0] ? ex[0].token : crypto.randomBytes(9).toString("base64url");
    if (!ex[0]) await q("INSERT INTO recaps(token, party_code, created_by) VALUES($1,$2,$3)", [token, m.code, req.user.id]);
    res.json({ token, url: "/r/" + token }); broadcast(m.code).catch(() => {});
  });
  app.delete("/api/parties/:code/recap", requireUser, async (req, res) => {
    const m = await member(req, res); if (!m) return;
    await q("DELETE FROM recaps WHERE party_code=$1", [m.code]);
    res.json({ ok: true });
  });
  app.get("/api/recap/:token", async (req, res) => {
    const { rows } = await q("SELECT r.party_code, p.created_at FROM recaps r JOIN parties p ON p.code=r.party_code WHERE r.token=$1", [String(req.params.token || "").slice(0, 40)]);
    if (!rows[0]) return res.status(404).json({ error: "Ce récapitulatif n'existe plus." });
    const d = await snapshot(rows[0].party_code, { recap: true });
    res.json({ date: +rows[0].created_at, ...d });
  });

  /* Repas (servent au calcul de l'absorption) */
  const KINDS = ["snack", "light", "full", "big"];
  app.get("/api/me/meals", requireUser, async (req, res) => {
    const { rows } = await q("SELECT id, t, kind FROM meals WHERE user_id=$1 AND t > now() - interval '24 hours' ORDER BY t", [req.user.id]);
    res.json({ meals: rows.map(r => ({ id: +r.id, t: +r.t, kind: r.kind })) });
  });
  app.post("/api/me/meals", requireUser, async (req, res) => {
    const kind = String(req.body.kind || "");
    const t = +req.body.t, now = Date.now();
    if (!KINDS.includes(kind)) return res.status(400).json({ error: "Choisissez le type de repas." });
    if (!(t > now - 24 * 3600e3 && t < now + 15 * 60e3)) return res.status(400).json({ error: "L'heure du repas doit être dans les dernières 24 h." });
    const { rows: n } = await q("SELECT count(*)::int AS n FROM meals WHERE user_id=$1 AND t > now() - interval '24 hours'", [req.user.id]);
    if (n[0].n >= 8) return res.status(400).json({ error: "Huit repas en 24 h au plus." });
    await q("INSERT INTO meals(user_id, t, kind) VALUES($1, to_timestamp($2/1000.0), $3)", [req.user.id, t, kind]);
    await q("UPDATE party_members SET meals_ok=true WHERE user_id=$1 AND left_at IS NULL", [req.user.id]);
    res.json({ ok: true });
    rebroadcastFor(req.user.id);
  });
  app.delete("/api/me/meals/:id", requireUser, async (req, res) => {
    await q("DELETE FROM meals WHERE id=$1 AND user_id=$2", [+req.params.id, req.user.id]);
    res.json({ ok: true });
    rebroadcastFor(req.user.id);
  });

  /* Suivi des 7 derniers jours (verres standard de 10 g d'alcool pur) */
  app.get("/api/me/week", requireUser, async (req, res) => {
    const { rows } = await q(`
      SELECT to_char(t AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD') AS day, sum(ml*abv/100*0.789)/10 AS std
      FROM drinks WHERE user_id=$1 AND deleted_at IS NULL AND abv>0 AND t > now() - interval '7 days'
      GROUP BY 1 ORDER BY 1`, [req.user.id]);
    res.json({ days: rows.map(r => ({ day: r.day, std: Math.round(r.std * 10) / 10 })) });
  });
}

// état en direct pour le tableau de bord de contrôle
const etatDirect = () => ({ soirees: rooms.size, sockets: [...rooms.values()].reduce((t, s) => t + s.size, 0) });
module.exports = { routes, attachWs, etatDirect };
