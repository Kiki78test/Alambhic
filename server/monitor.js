/* Point de contrôle du tableau de bord (GET /api/monitor) — module commun Airmony / AnagramX / Alamb'hic / Hermaion.
   - Protégé par la clé MONITOR_KEY (en-tête X-Monitor-Key) ; sans cette variable, la route répond 401 (désactivée).
   - CORS limité aux adresses de MONITOR_ORIGIN (séparées par des virgules), ex. https://controle.airmonylive.com
   - Fonctionne avec un serveur Node simple (http) comme avec Express : traiter(req, res) renvoie true si la requête est prise.
   - Les indicateurs propres à l'appli (collecter) sont mis en cache 20 s pour ne pas charger la base à chaque actualisation.
   Réponse : { app, version, commit, uptime_s, db, db_ms, db_size_mb, db_conn, memory_mb, lag_ms, online_now, today, history[14],
               metrics[], checks[], live?, highlight?, ai_cost_usd?, time } */
"use strict";
const crypto = require("crypto");

let lag = 0;
{ let t = Date.now(); setInterval(() => { const n = Date.now(); lag = Math.max(0, n - t - 1000); t = n; }, 1000).unref(); }

const egal = (a, b) => { const h = x => crypto.createHash("sha256").update(String(x)).digest(); return crypto.timingSafeEqual(h(a), h(b)); };
const sur = async (f, def = null) => { try { return await f(); } catch (e) { return def; } };
const avecDelai = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("délai dépassé")), ms))]);

/** opts : { nom, version, sql?(texte, params) -> {rows}, collecter?() -> objet partiel, cacheMs? } */
function creer(opts) {
  let cache = null, cacheAt = 0, enCours = null;
  const sql = opts.sql || null;

  async function infosBase() {
    if (!sql) return { db: "off" };
    const t = Date.now();
    const ok = await sur(async () => { await avecDelai(sql("select 1"), 4000); return true; }, false);
    if (!ok) return { db: "erreur", db_ms: Date.now() - t };
    const db_ms = Date.now() - t;
    const r = await sur(async () => (await sql(`select pg_database_size(current_database())::bigint taille,
      (select count(*)::int from pg_stat_activity where datname = current_database()) conn`)).rows[0], {});
    return { db: "ok", db_ms, db_size_mb: r.taille != null ? Math.round(Number(r.taille) / 1048576) : null, db_conn: r.conn ?? null };
  }

  async function donneesAppli() {
    if (!opts.collecter) return {};
    if (cache && Date.now() - cacheAt < (opts.cacheMs || 20000)) return cache;
    if (!enCours) enCours = avecDelai(Promise.resolve().then(opts.collecter), 8000)
      .then(d => { cache = d || {}; cacheAt = Date.now(); return cache; })
      .catch(e => { console.error("[monitor]", e.message); return Object.assign({}, cache || {}, { metrics: [{ label: "Indicateurs", value: "erreur", hint: String(e.message).slice(0, 60), level: "bad" }] }); })
      .finally(() => { enCours = null; });
    return enCours;
  }

  return async function traiter(req, res) {
    const chemin = String(req.url || "").split("?")[0];
    if (chemin !== "/api/monitor") return false;
    const origines = String(process.env.MONITOR_ORIGIN || "").split(",").map(s => s.trim()).filter(Boolean);
    const o = req.headers.origin;
    if (o && (origines.includes("*") || origines.includes(o))) {
      res.setHeader("Access-Control-Allow-Origin", o); res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "X-Monitor-Key"); res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Max-Age", "600");
    }
    const envoyer = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); };
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return true; }
    const cle = process.env.MONITOR_KEY;
    if (!cle || !egal(req.headers["x-monitor-key"] || "", cle)) { envoyer(401, { erreur: "clé invalide" }); return true; }
    try {
      const [base, d] = await Promise.all([infosBase(), donneesAppli()]);
      const memoire = Math.round(process.memoryUsage().rss / 1048576);
      const checks = [
        { label: "Base de données", ok: base.db === "ok" || base.db === "off", time: base.db === "ok" ? `${base.db_ms} ms` : base.db },
        { label: "Mémoire serveur", ok: memoire < Number(process.env.MONITOR_RAM_ALERTE_MO || 430), time: `${memoire} Mo` },
        { label: "Réactivité serveur", ok: lag < 250, time: `${lag} ms` },
        ...(d.checks || []),
      ];
      envoyer(200, Object.assign({
        app: opts.nom, version: opts.version || null, commit: String(process.env.RENDER_GIT_COMMIT || "").slice(0, 7) || null,
        uptime_s: Math.round(process.uptime()), memory_mb: memoire, lag_ms: lag,
        online_now: 0, today: 0, history: [], metrics: [],
      }, base, d, { checks, time: new Date().toISOString() }));
    } catch (e) {
      envoyer(500, { erreur: String(e.message || e).slice(0, 120) });
    }
    return true;
  };
}

/** historique sur 14 jours à partir de lignes {date:'AAAA-MM-JJ', users:n} (jours manquants = 0, aujourd'hui en dernier) */
function quatorzeJours(lignes, aujourdhui) {
  const m = new Map((lignes || []).map(r => [String(r.date).slice(0, 10), Number(r.users) || 0]));
  const base = aujourdhui ? new Date(aujourdhui + "T12:00:00Z") : new Date();
  const out = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(base); d.setUTCDate(d.getUTCDate() - i); const k = d.toISOString().slice(0, 10); out.push({ date: k, users: m.get(k) || 0 }); }
  return out;
}

module.exports = { creer, sur, quatorzeJours };
