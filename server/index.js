"use strict";
const http = require("http");
const path = require("path");
const express = require("express");
const { migrate } = require("./db");
const auth = require("./auth");
const parties = require("./parties");

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(require("./monitor").veille.express());   // (28/11) veille de sécurité du centre de contrôle : connexions refusées, inscriptions, erreurs, accès admin refusés
app.use(express.json({ limit: "32kb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

app.get("/healthz", (req, res) => res.send("ok"));

// Tableau de bord de contrôle (GET /api/monitor, protégé par la clé MONITOR_KEY)
const surveillance = require("./surveillance");
app.use((req, res, next) => { surveillance.traiter(req, res).then(pris => { if (!pris) next(); }, next); });

// Les erreurs des routes async remontent ici (Express 5).
auth.routes(app);
parties.routes(app);
require("./legal").routes(app);
const friends = require("./friends");
friends.routes(app);
const badges = require("./badges");
require("./push").routes(app, auth);
badges.routes(app, auth);
require("./help").routes(app);
const expr = require("./expr");
require("./conso").routes(app, { activeParty: parties.activeParty,
  drinkAdded: (uid, code) => { if (code) parties.broadcast(code).catch(() => {}); parties.rebroadcastFor(uid).catch(() => {}); expr.check(uid); } });

/* Documentation (réservée aux administrateurs) : docs/index.json + PDF */
const DOCS = path.join(__dirname, "..", "docs");
app.get("/api/docs", auth.requireUser, auth.requireAdmin, (req, res) => res.sendFile(path.join(DOCS, "index.json")));
app.use("/docs", auth.requireUser, auth.requireAdmin, express.static(DOCS, { index: false, setHeaders: r => r.setHeader("Cache-Control", "private, no-cache") }));
app.use("/api", (req, res) => res.status(404).json({ error: "Route inconnue." }));

app.use(express.static(path.join(__dirname, "..", "public"), {
  setHeaders(res, p) {
    if (/\.(html|webmanifest)$|sw\.js$/.test(p)) res.setHeader("Cache-Control", "no-cache");
  }
}));
// écran TV et récapitulatif public : pages à part
app.get(["/tv", "/tv/"], (req, res) => res.sendFile(path.join(__dirname, "..", "public", "tv.html")));
app.get(/^\/r\/[\w-]{6,40}$/, (req, res) => res.sendFile(path.join(__dirname, "..", "public", "recap.html")));
app.get(/^\/(?!api|ws).*/, (req, res) => res.sendFile(path.join(__dirname, "..", "public", "index.html")));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Erreur du serveur. Réessayez dans un instant." });
});

const PORT = process.env.PORT || 3000;
// Le port s'ouvre tout de suite ; la base est préparée en parallèle.
const server = http.createServer(app);
parties.attachWs(server);
surveillance.brancherDirect(parties.etatDirect);
server.listen(PORT, () => console.log(`Alamb'hic en écoute sur le port ${PORT}`));
migrate().then(() => friends.migrate()).then(() => badges.migrate()).then(() => console.log("Base prête."))
  .catch(e => { console.error("Base impossible à préparer :", e.message); process.exit(1); });
