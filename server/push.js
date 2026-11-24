"use strict";
/* Alamb'hic — notifications push du navigateur (Web Push).
   Clés VAPID : variables VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY si elles existent, sinon générées une fois et gardées en base
   (table settings) : rien à configurer sur Render.
   Catégories réglables par l'utilisateur (users.notif_prefs) : alertes, titres, amis, repas, badges. Coupée = pas de push.
   Plus « expr » : expressions des potes (tout, amis, groupes ou rien), voir server/expr.js. */
const webpush = require("web-push");
const { q } = require("./db");

const CATS = {
  alertes: "Alertes copains et alertes rouges des joueurs de la soirée",
  titres: "Titres gagnés par les joueurs de la soirée",
  amis: "Titres de vos amis dans leurs propres soirées",
  repas: "Rappel « avez-vous mangé ? » à l'heure du déjeuner et du dîner",
  badges: "Nouveaux badges (bronze, argent, or)",
};
/* expressions des potes (server/expr.js) : choix du destinataire */
const EXPR = { tout: "Amis et groupes", amis: "Amis seulement", groupes: "Groupes seulement", rien: "Rien" };
let keys = null, ready = null;

async function init() {
  if (ready) return ready;
  ready = (async () => {
    let pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
    if (!pub || !priv) {
      const { rows } = await q("SELECT v FROM settings WHERE k='vapid'");
      if (rows[0]) ({ pub, priv } = JSON.parse(rows[0].v));
      else {
        const k = webpush.generateVAPIDKeys(); pub = k.publicKey; priv = k.privateKey;
        await q("INSERT INTO settings(k, v) VALUES('vapid', $1) ON CONFLICT (k) DO NOTHING", [JSON.stringify({ pub, priv })]);
        const again = await q("SELECT v FROM settings WHERE k='vapid'"); ({ pub, priv } = JSON.parse(again.rows[0].v));
      }
    }
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:" + (process.env.CONTACT_EMAIL || "contact@alambhic.app"), pub, priv);
    keys = { pub };
    return keys;
  })().catch(e => { ready = null; throw e; });
  return ready;
}
const publicKey = async () => (await init()).pub;

const prefsOf = p => Object.fromEntries(Object.keys(CATS).map(k => [k, !(p && p[k] === false)]));

/* envoie à tous les appareils d'un utilisateur ; supprime les abonnements expirés */
async function deliver(uid, tag, payload) {
  try {
    await init();
    const { rows } = await q("SELECT endpoint, sub FROM push_subs WHERE user_id=$1", [uid]);
    let n = 0;
    for (const r of rows) {
      try { await webpush.sendNotification(r.sub, JSON.stringify({ tag, ...payload }), { TTL: 3600 }); n++; }
      catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await q("DELETE FROM push_subs WHERE endpoint=$1", [r.endpoint]); }
    }
    return n;
  } catch (e) { console.error("[push]", e.message); return 0; }
}
/* idem, seulement si la catégorie n'est pas coupée */
async function send(uid, cat, payload) {
  try {
    const { rows: u } = await q("SELECT notif_prefs FROM users WHERE id=$1", [uid]);
    if (!u[0] || !prefsOf(u[0].notif_prefs)[cat]) return 0;
    return deliver(uid, cat, payload);
  } catch (e) { console.error("[push]", e.message); return 0; }
}

/* nouveaux titres d'une soirée : aux autres joueurs (titres, alertes), puis aux amis hors de la soirée (amis) */
async function partyEvents(code, newEvents, members) {
  const fresh = newEvents.filter(e => e.kind !== "info" && Date.now() - e.t < 30 * 60000);
  if (!fresh.length) return;
  const ids = members.map(m => m.id);
  for (const e of fresh) {
    const cat = e.kind === "care" ? "alertes" : "titres";
    const body = { title: e.title, body: e.text, url: "/" };
    for (const id of ids) if (id !== e.pid) send(id, cat, body);
    if (e.kind === "care") continue;   // une alerte reste entre les joueurs présents
    const { rows: fr } = await q(`SELECT CASE WHEN f.a=$1 THEN f.b ELSE f.a END AS id FROM friendships f JOIN users u ON u.id=$1
      WHERE (f.a=$1 OR f.b=$1) AND f.status='accepted' AND u.share_friends`, [e.pid]).catch(() => ({ rows: [] }));
    for (const f of fr) if (!ids.includes(f.id)) send(f.id, "amis", { title: `${e.title} · votre ami`, body: e.text, url: "/?amis=1" });
  }
}

/* rappel repas : 12 h 45 et 20 h 15 (heure de Paris), aux joueurs en soirée active sans repas noté depuis 3 h */
const sentMeal = new Set();
async function mealReminders() {
  const now = new Date(), paris = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const hm = paris.getHours() * 60 + paris.getMinutes();
  const slot = hm >= 765 && hm < 780 ? "midi" : hm >= 1215 && hm < 1230 ? "soir" : null;
  if (!slot) return;
  const day = paris.toDateString();
  const { rows } = await q(`SELECT DISTINCT m.user_id FROM party_members m JOIN parties p ON p.code=m.party_code
    WHERE m.left_at IS NULL AND p.last_activity > now() - interval '12 hours' AND NOT m.sam
      AND NOT EXISTS (SELECT 1 FROM meals me WHERE me.user_id=m.user_id AND me.t > now() - interval '3 hours')`);
  for (const r of rows) {
    const k = `${r.user_id}:${day}:${slot}`; if (sentMeal.has(k)) continue; sentMeal.add(k);
    send(r.user_id, "repas", { title: slot === "soir" ? "Avez-vous dîné ?" : "Avez-vous déjeuné ?", body: "Notez votre repas et son heure : il ralentit le passage de l'alcool.", url: "/" });
  }
  if (sentMeal.size > 20000) sentMeal.clear();
}
setInterval(() => mealReminders().catch(e => console.error("[push repas]", e.message)), 5 * 60000).unref();

function routes(app, { requireUser }) {
  app.get("/api/push/key", async (req, res) => res.json({ key: await publicKey() }));
  app.get("/api/me/notifs", requireUser, async (req, res) => {
    const { rows } = await q("SELECT notif_prefs FROM users WHERE id=$1", [req.user.id]);
    const { rows: n } = await q("SELECT count(*)::int AS n FROM push_subs WHERE user_id=$1", [req.user.id]);
    const np = rows[0] && rows[0].notif_prefs || {};
    res.json({ prefs: prefsOf(np), cats: CATS, devices: n[0].n, expr: EXPR[np.expr] ? np.expr : "tout", exprModes: EXPR });
  });
  app.put("/api/me/notifs", requireUser, async (req, res) => {
    const p = req.body && req.body.prefs || {}, clean = {};
    for (const k of Object.keys(CATS)) if (k in p) clean[k] = !!p[k];
    if (EXPR[p.expr]) clean.expr = p.expr;
    await q("UPDATE users SET notif_prefs = notif_prefs || $2::jsonb WHERE id=$1", [req.user.id, JSON.stringify(clean)]);
    res.json({ ok: true });
  });
  app.post("/api/push/subscribe", requireUser, async (req, res) => {
    const s = req.body && req.body.sub;
    if (!s || typeof s.endpoint !== "string" || !/^https:\/\//.test(s.endpoint) || !s.keys || !s.keys.p256dh || !s.keys.auth || s.endpoint.length > 1000)
      return res.status(400).json({ error: "Abonnement invalide." });
    await q(`INSERT INTO push_subs(endpoint, user_id, sub) VALUES($1,$2,$3)
      ON CONFLICT (endpoint) DO UPDATE SET user_id=EXCLUDED.user_id, sub=EXCLUDED.sub`, [s.endpoint, req.user.id, JSON.stringify({ endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } })]);
    const { rows } = await q("SELECT count(*)::int AS n FROM push_subs WHERE user_id=$1", [req.user.id]);
    if (rows[0].n > 8) await q("DELETE FROM push_subs WHERE endpoint IN (SELECT endpoint FROM push_subs WHERE user_id=$1 ORDER BY created_at LIMIT $2)", [req.user.id, rows[0].n - 8]);
    res.json({ ok: true });
  });
  app.post("/api/push/unsubscribe", requireUser, async (req, res) => {
    await q("DELETE FROM push_subs WHERE endpoint=$1 AND user_id=$2", [String(req.body && req.body.endpoint || ""), req.user.id]);
    res.json({ ok: true });
  });
  app.post("/api/push/test", requireUser, async (req, res) => {
    const { rows } = await q("SELECT endpoint, sub FROM push_subs WHERE user_id=$1", [req.user.id]);
    await init(); let n = 0;
    for (const r of rows) try { await webpush.sendNotification(r.sub, JSON.stringify({ title: "Alamb'hic", body: "Les notifications fonctionnent sur cet appareil.", url: "/" })); n++; } catch (e) {}
    res.json({ sent: n });
  });
}

module.exports = { routes, send, deliver, partyEvents, publicKey, CATS };
