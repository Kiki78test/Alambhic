"use strict";
/* Alamb'hic — badges à paliers (bronze, argent, or) calculés sur tout l'historique du joueur.
   Ils récompensent la régularité et la modération, jamais l'excès. Nouveau palier : drapeau « new » et notification push. */
const { q } = require("./db");
const push = require("./push");

const BADGES = [
  { key: "habitue", title: "L'Habitué", desc: "Soirées jouées", steps: [3, 10, 25],
    sql: "SELECT count(*)::int AS n FROM party_members WHERE user_id=$1" },
  { key: "chameau", title: "Le Chameau d'or", desc: "Verres d'eau notés", steps: [10, 25, 50],
    sql: "SELECT count(*)::int AS n FROM drinks WHERE user_id=$1 AND water AND deleted_at IS NULL" },
  { key: "sam", title: "Sam fidèle", desc: "Soirées en Sam", steps: [1, 3, 5],
    sql: "SELECT count(*)::int AS n FROM party_members WHERE user_id=$1 AND sam" },
  { key: "sanshonte", title: "Sans fausse note", desc: "Soirées terminées sans titre de honte", steps: [2, 5, 10],
    sql: `SELECT count(*)::int AS n FROM party_members m WHERE m.user_id=$1 AND m.joined_at < now() - interval '12 hours'
          AND EXISTS (SELECT 1 FROM drinks d WHERE d.user_id=m.user_id AND d.party_code=m.party_code AND d.deleted_at IS NULL)
          AND NOT EXISTS (SELECT 1 FROM trophies t WHERE t.user_id=m.user_id AND t.party_code=m.party_code AND t.kind='shame')` },
  { key: "atterrissage", title: "Pilote de ligne", desc: "Atterrissages en douceur", steps: [2, 5, 10],
    sql: "SELECT count(*)::int AS n FROM trophies WHERE user_id=$1 AND key='land'" },
  { key: "potes", title: "Bande de potes", desc: "Amis dans votre liste", steps: [2, 5, 10],
    sql: "SELECT count(*)::int AS n FROM friendships WHERE (a=$1 OR b=$1) AND status='accepted'" },
];
const TIERS = ["", "Bronze", "Argent", "Or"];

async function migrate() {
  await q("ALTER TABLE users ADD COLUMN IF NOT EXISTS badge_tiers JSONB NOT NULL DEFAULT '{}'::jsonb");
}

async function compute(uid) {
  const out = [];
  for (const b of BADGES) {
    const n = (await q(b.sql, [uid]).catch(() => ({ rows: [{ n: 0 }] }))).rows[0].n;
    const tier = b.steps.filter(s => n >= s).length;
    out.push({ key: b.key, title: b.title, desc: b.desc, count: n, tier, tierName: TIERS[tier], next: b.steps[tier] || null, steps: b.steps });
  }
  return out;
}

async function forUser(uid) {
  const list = await compute(uid);
  const { rows } = await q("SELECT badge_tiers FROM users WHERE id=$1", [uid]);
  const old = (rows[0] && rows[0].badge_tiers) || {}, first = !Object.keys(old).length;
  const up = {};
  for (const b of list) {
    if (b.tier > (old[b.key] || 0)) { up[b.key] = b.tier; if (!first) { b.new = true; push.send(uid, "badges", { title: `Badge ${b.tierName} : ${b.title}`, body: `${b.desc} : ${b.count}.`, url: "/" }); } }
  }
  if (Object.keys(up).length) await q("UPDATE users SET badge_tiers = badge_tiers || $2::jsonb WHERE id=$1", [uid, JSON.stringify(up)]);
  return list;
}

function routes(app, { requireUser }) {
  app.get("/api/me/badges", requireUser, async (req, res) => res.json({ badges: await forUser(req.user.id) }));
}

module.exports = { routes, migrate, forUser, BADGES };
