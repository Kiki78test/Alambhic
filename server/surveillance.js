"use strict";
/* Alamb'hic — indicateurs du tableau de bord de contrôle (GET /api/monitor, clé MONITOR_KEY).
   Activité : une ligne par compte et par jour (table activite), mise à jour au plus une fois par minute à chaque appel
   authentifié. Aucune donnée personnelle de plus que l'identifiant du compte, lignes gardées 13 mois. */
const { q } = require("./db");
const { creer, quatorzeJours } = require("./monitor");

const dernier = new Map();   // uid -> horodatage de la dernière écriture
let pret = null;
function migrate() {
  if (!pret) pret = q(`CREATE TABLE IF NOT EXISTS activite (
      jour DATE NOT NULL DEFAULT current_date, uid UUID NOT NULL, derniere TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (jour, uid))`)
    .then(() => q("DELETE FROM activite WHERE jour < current_date - 400"))
    .catch(e => { pret = null; throw e; });
  return pret;
}
function vu(uid) {
  if (!uid) return;
  const t = Date.now();
  if (t - (dernier.get(uid) || 0) < 60000) return;
  dernier.set(uid, t);
  if (dernier.size > 5000) for (const [k, v] of dernier) if (t - v > 600000) dernier.delete(k);
  migrate().then(() => q(`INSERT INTO activite (jour, uid) VALUES (current_date, $1)
      ON CONFLICT (jour, uid) DO UPDATE SET derniere = now()`, [uid])).catch(() => {});
}

let etatDirect = () => ({ soirees: 0, sockets: 0 });
const n = async (t, p) => Number((await q(t, p)).rows[0]?.n || 0);

async function collecter() {
  await migrate();
  const direct = etatDirect();
  const [enLigne, auj, hist, soirees, consos, suppr, trophees, amis, comptes, nouveaux] = await Promise.all([
    n("SELECT count(*)::int n FROM activite WHERE jour >= current_date - 1 AND derniere > now() - interval '5 minutes'"),
    n("SELECT count(*)::int n FROM activite WHERE jour = current_date"),
    q("SELECT to_char(jour, 'YYYY-MM-DD') date, count(*)::int users FROM activite WHERE jour > current_date - 14 GROUP BY jour").then(r => r.rows),
    q(`SELECT count(DISTINCT p.code)::int n, count(m.user_id)::int membres FROM parties p JOIN party_members m ON m.party_code = p.code AND m.left_at IS NULL
       WHERE p.last_activity > now() - interval '6 hours'`).then(r => r.rows[0]),
    n("SELECT count(*)::int n FROM drinks WHERE created_at >= current_date AND deleted_at IS NULL AND NOT water"),
    n("SELECT count(*)::int n FROM drinks WHERE deleted_at >= current_date"),
    n("SELECT count(*)::int n FROM trophies WHERE t >= current_date"),
    n("SELECT count(*)::int n FROM friendships WHERE status <> 'accepted'"),
    n("SELECT count(*)::int n FROM users"),
    n("SELECT count(*)::int n FROM users WHERE created_at >= current_date"),
  ]);
  const aujourdhui = (await q("SELECT to_char(current_date, 'YYYY-MM-DD') d")).rows[0].d;
  const partSuppr = consos + suppr ? Math.round(suppr / (consos + suppr) * 100) : 0;
  return {
    version: require("../package.json").version,
    online_now: enLigne, today: auj, history: quatorzeJours(hist, aujourdhui),
    metrics: [
      { label: "Soirées actives", value: soirees.n, hint: `${soirees.membres} participant(s) · ${direct.sockets} en direct` },
      { label: "Consos déclarées", value: consos, hint: "aujourd'hui (hors eau)" },
      { label: "Consos supprimées", value: suppr, hint: `${partSuppr} % des saisies du jour`, level: partSuppr > 30 ? "warn" : undefined },
      { label: "Trophées débloqués", value: trophees, hint: "aujourd'hui" },
      { label: "Demandes d'amis en attente", value: amis },
      { label: "Comptes", value: comptes, hint: `+${nouveaux} aujourd'hui`, level: nouveaux ? "good" : undefined },
    ],
    checks: [{ label: "Saisies supprimées", ok: partSuppr <= 30, time: `${partSuppr} %` }],
  };
}

const traiter = creer({ nom: "alambhic", sql: (t, p) => q(t, p), collecter });
module.exports = { traiter, vu, migrate, brancherDirect: f => { etatDirect = f; } };
