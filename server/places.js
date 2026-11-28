"use strict";
/* Alamb'hic — « Autour de moi » : bars, restaurants, cafés… proches de la position du joueur, d'après OpenStreetMap (Overpass, gratuit, sans clé).
   La position ne sert qu'à cette recherche : elle n'est jamais enregistrée, et c'est le serveur qui interroge OpenStreetMap
   (l'adresse IP du joueur ne lui est pas transmise). Résultats gardés 10 min par zone d'environ 100 m pour ménager le service. */
const { requireUser } = require("./auth");

const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const KINDS = { bar: "Bar", pub: "Pub", restaurant: "Restaurant", cafe: "Café", nightclub: "Boîte de nuit", biergarten: "Brasserie", fast_food: "Restauration rapide" };
const cache = new Map(), hits = new Map();
const MIN = 60000;

const dist = (a, b, c, d) => {   // mètres, formule de haversine
  const R = 6371e3, r = Math.PI / 180, x = (c - a) * r, y = (d - b) * r;
  const h = Math.sin(x / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(y / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

async function overpass(lat, lon, radius) {
  const query = `[out:json][timeout:8];nwr["amenity"~"^(${Object.keys(KINDS).join("|")})$"]["name"](around:${radius},${lat},${lon});out center 60;`;
  let last;
  for (const url of ENDPOINTS) {
    try {
      const r = await fetch(url, { method: "POST", body: "data=" + encodeURIComponent(query), signal: AbortSignal.timeout(9000),
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Alambhic/1.0 (+https://alambhic.onrender.com)" } });
      if (!r.ok) { last = new Error("OpenStreetMap " + r.status); continue; }
      return (await r.json()).elements || [];
    } catch (e) { last = e; }
  }
  throw last || new Error("OpenStreetMap injoignable");
}

async function near(lat, lon) {
  const key = lat.toFixed(3) + "," + lon.toFixed(3), c = cache.get(key);
  let els = c && Date.now() - c.t < 10 * MIN ? c.els : null;
  if (!els) {
    els = await overpass(lat, lon, 250);
    if (els.length < 3) els = await overpass(lat, lon, 600);
    cache.set(key, { t: Date.now(), els });
    if (cache.size > 2000) cache.delete(cache.keys().next().value);
  }
  const seen = new Set();
  return els.map(e => {
    const la = e.lat ?? (e.center && e.center.lat), lo = e.lon ?? (e.center && e.center.lon);
    return { name: String(e.tags.name).slice(0, 40), kind: KINDS[e.tags.amenity] || "", d: la == null ? 9999 : Math.round(dist(lat, lon, la, lo)) };
  }).sort((a, b) => a.d - b.d).filter(p => { const k = p.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 8);
}

function routes(app) {
  app.get("/api/places/near", requireUser, async (req, res) => {
    const lat = +req.query.lat, lon = +req.query.lon;
    if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180) || (lat === 0 && lon === 0)) return res.status(400).json({ error: "Position invalide." });
    const k = req.user.id, h = (hits.get(k) || []).filter(t => Date.now() - t < 10 * MIN);
    if (h.length >= 20) return res.status(429).json({ error: "Trop de recherches. Choisissez un favori ou tapez le lieu." });
    h.push(Date.now()); hits.set(k, h);
    try { res.json({ places: await near(lat, lon) }); }
    catch (e) { console.error("[lieux]", e.message); res.status(502).json({ error: "Recherche des lieux indisponible pour l'instant. Tapez le lieu ou choisissez un favori." }); }
  });
}

module.exports = { routes, near };
