/* Point de contrôle du tableau de bord (GET /api/monitor) — module commun Airmony / AnagramX / Alamb'hic / Hermaion.
   - Protégé par la clé MONITOR_KEY (en-tête X-Monitor-Key) ; sans cette variable, la route répond 401 (désactivée).
   - CORS limité aux adresses de MONITOR_ORIGIN (séparées par des virgules), ex. https://controle.airmonylive.com
   - Fonctionne avec un serveur Node simple (http) comme avec Express : traiter(req, res) renvoie true si la requête est prise.
   - Les indicateurs propres à l'appli (collecter) sont mis en cache 20 s pour ne pas charger la base à chaque actualisation.
   - (28/11) Réponse compressée en gzip si le demandeur l'accepte ; « interesses » : { total, detail, history[30] }.
   Réponse : { app, version, commit, uptime_s, db, db_ms, db_size_mb, db_conn, memory_mb, lag_ms, online_now, today, history[14],
               metrics[], checks[], security{level, items[]}, live?, highlight?, ai_cost_usd?, time } */
"use strict";
const crypto = require("crypto");
const zlib = require("zlib");

let lag = 0;
{ let t = Date.now(); setInterval(() => { const n = Date.now(); lag = Math.max(0, n - t - 1000); t = n; }, 1000).unref(); }

/* ---------- (28/11) Veille de sécurité, commune aux 4 applis ----------
   Les applis signalent les évènements sensibles : veille.noter("connexion_echec"), veille.noter("admin_connexion", { ip }), …
   On garde 24 h d'horodatages par type (en mémoire : remis à zéro à chaque redémarrage). La réponse /api/monitor contient
   « security » : { level: "ok"|"warn"|"bad", items: [{ label, value, level, hint }] }, lu par le centre de contrôle.
   Seuils par heure ci-dessous ; une appli peut ajouter ses propres éléments (opts.securite). */
const SEUILS = {   // type : [libellé, alerte (warn) par heure, alarme (bad) par heure]
  connexion_echec: ["Échecs de connexion", 30, 150],
  connexion_bloquee: ["Connexions bloquées (trop d'essais)", 3, 20],
  inscription: ["Inscriptions", 25, 100],
  erreur_serveur: ["Erreurs serveur (500)", 10, 50],
  requete_bloquee: ["Requêtes bloquées (anti-abus)", 60, 300],
  acces_refuse: ["Accès admin refusés", 5, 25],
};
const veille = (() => {
  const ev = new Map(), ipsAdmin = new Map();   // type -> [t…] ; ip -> dernière connexion admin
  const noter = (type, info) => {
    const t = Date.now(), a = ev.get(type) || []; a.push(t); while (a.length && t - a[0] > 864e5) a.shift(); if (a.length > 20000) a.splice(0, a.length - 20000); ev.set(type, a);
    if (type === "admin_connexion" && info && info.ip) { const ip = String(info.ip).slice(0, 64); const neuve = !ipsAdmin.has(ip); ipsAdmin.set(ip, { t, neuve: neuve && ipsAdmin.size > 0, pays: info.pays || "" }); }
  };
  const compte = (type, ms) => { const a = ev.get(type) || [], t = Date.now(); let n = 0; for (let i = a.length - 1; i >= 0 && t - a[i] <= ms; i--) n++; return n; };
  function rapport(extra) {
    const items = [];
    for (const [type, [label, w, b]] of Object.entries(SEUILS)) {
      const h = compte(type, 3600e3), j = compte(type, 864e5);
      if (!h && !j) continue;
      items.push({ label, value: h, hint: j + " sur 24 h", level: h >= b ? "bad" : h >= w ? "warn" : "ok" });
    }
    const admins = [...ipsAdmin.entries()].filter(([, x]) => Date.now() - x.t < 864e5);
    if (admins.length) { const neuves = admins.filter(([, x]) => x.neuve); items.push({ label: "Connexions administrateur (24 h)", value: admins.length, hint: neuves.length ? "dont " + neuves.length + " depuis une adresse jamais vue" + (neuves[0][1].pays ? " (" + neuves[0][1].pays + ")" : "") : "adresses déjà connues", level: neuves.length ? "warn" : "ok" }); }
    for (const x of extra || []) if (x && x.label) items.push(x);
    const level = items.some((x) => x.level === "bad") ? "bad" : items.some((x) => x.level === "warn") ? "warn" : "ok";
    return { level, items: items.sort((a, b) => ({ bad: 0, warn: 1, ok: 2 }[a.level] - { bad: 0, warn: 1, ok: 2 }[b.level])) };
  }
  /* observation automatique des réponses (applis Express ou http) : appeler veille.observer(req, res) au début de chaque requête.
     Connexion refusée (401) ou bloquée (429), inscription réussie, erreurs 500, requêtes bloquées, accès admin refusés. */
  const CHEMINS = { connexion: /^\/api\/(auth\/)?(connexion|login)(\/code)?\/?$/, inscription: /^\/api\/(auth\/)?(inscription|register)\/?$/, admin: /^\/api\/admin(\/|$)/ };
  function observer(req, res, chemins) {
    const C = Object.assign({}, CHEMINS, chemins || {}), p = String(req.url || "").split("?")[0], post = req.method === "POST";
    res.on("finish", () => {
      const st = res.statusCode;
      if (post && C.connexion.test(p) && st === 401) noter("connexion_echec");
      else if (post && C.connexion.test(p) && st === 429) noter("connexion_bloquee");
      else if (st === 429) noter("requete_bloquee");
      if (post && C.inscription.test(p) && st >= 200 && st < 300) noter("inscription");
      if (st >= 500) noter("erreur_serveur");
      if (C.admin.test(p) && (st === 401 || st === 403)) noter("acces_refuse");
    });
  }
  const express = (chemins) => (req, res, next) => { try { observer(req, res, chemins); } catch (e) { /* jamais bloquant */ } next(); };
  return { noter, compte, rapport, observer, express, SEUILS };
})();

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
    // (28/11) réponse compressée (gzip) quand le demandeur l'accepte : environ 4 fois moins de bande passante
    const envoyer = (code, obj) => {
      let corps = Buffer.from(JSON.stringify(obj));
      const h = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Vary": "Accept-Encoding, Origin" };
      if (corps.length > 600 && /\bgzip\b/.test(String(req.headers["accept-encoding"] || ""))) { corps = zlib.gzipSync(corps); h["Content-Encoding"] = "gzip"; }
      h["Content-Length"] = corps.length; res.writeHead(code, h); res.end(corps);
    };
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return true; }
    const cle = process.env.MONITOR_KEY;
    if (!cle || !egal(req.headers["x-monitor-key"] || "", cle)) { envoyer(401, { erreur: "clé invalide" }); return true; }
    try {
      const [base, d] = await Promise.all([infosBase(), donneesAppli()]);
      const secApp = Array.isArray(d.security_items) ? d.security_items : [];
      if (base.db_conn != null && base.db_conn > 40) secApp.push({ label: "Connexions à la base", value: base.db_conn, hint: "inhabituel au-delà de 40", level: "warn" });
      if (process.uptime() < 600) secApp.push({ label: "Serveur redémarré", value: Math.round(process.uptime() / 60) + " min", hint: "mise en ligne ou plantage récent ; compteurs remis à zéro", level: "ok" });
      const security = veille.rapport(secApp);
      const memoire = Math.round(process.memoryUsage().rss / 1048576);
      const checks = [
        { label: "Base de données", ok: base.db === "ok" || base.db === "off", time: base.db === "ok" ? `${base.db_ms} ms` : base.db },
        { label: "Mémoire serveur", ok: memoire < Number(process.env.MONITOR_RAM_ALERTE_MO || 430), time: `${memoire} Mo` },
        { label: "Réactivité serveur", ok: lag < 250, time: `${lag} ms` },
        ...(d.checks || []),
      ];
      const sortie = Object.assign({
        app: opts.nom, version: opts.version || null, commit: String(process.env.RENDER_GIT_COMMIT || "").slice(0, 7) || null,
        uptime_s: Math.round(process.uptime()), memory_mb: memoire, lag_ms: lag,
        online_now: 0, today: 0, history: [], metrics: [],
      }, base, d, { checks, security, time: new Date().toISOString() });
      delete sortie.security_items; envoyer(200, sortie);
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

module.exports = { creer, sur, quatorzeJours, veille };
