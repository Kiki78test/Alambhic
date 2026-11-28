"use strict";
const { Pool } = require("pg");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL manquant : impossible de démarrer.");
  process.exit(1);
}
const ssl = process.env.PGSSL === "1" || /render\.com|sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined;
const pool = new Pool({ connectionString: url, ssl, max: 10 });

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE,
  pass_hash   TEXT,
  google_sub  TEXT UNIQUE,
  pseudo      TEXT,
  sex         CHAR(1),
  age         SMALLINT,
  height      SMALLINT,
  weight      SMALLINT,
  cap         REAL NOT NULL DEFAULT 0.8,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS parties (
  code        CHAR(4) PRIMARY KEY,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS party_members (
  party_code  CHAR(4) REFERENCES parties(code) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at     TIMESTAMPTZ,
  sam         BOOLEAN NOT NULL DEFAULT false,
  fed         BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (party_code, user_id)
);
CREATE TABLE IF NOT EXISTS drinks (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  party_code  CHAR(4) REFERENCES parties(code) ON DELETE SET NULL,
  t           TIMESTAMPTZ NOT NULL,
  label       TEXT NOT NULL,
  ml          REAL NOT NULL,
  abv         REAL NOT NULL,
  fed         BOOLEAN NOT NULL DEFAULT false,
  water       BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS drinks_party ON drinks(party_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS drinks_user_t ON drinks(user_id, t);
CREATE TABLE IF NOT EXISTS trophies (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  party_code  CHAR(4) NOT NULL,
  key         TEXT NOT NULL,
  kind        TEXT NOT NULL,
  title       TEXT NOT NULL,
  t           TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, party_code, key)
);
`;

async function migrate() {
  // La base peut mettre un moment à accepter les connexions au premier déploiement.
  for (let i = 1; ; i++) {
    try { await pool.query("SELECT 1"); break; }
    catch (e) {
      console.error(`Base injoignable (essai ${i}) : ${e.message}`);
      if (i >= 10) throw e;
      await new Promise(r => setTimeout(r, 3000 * i));
    }
  }
  await pool.query(SCHEMA); // gen_random_uuid() est natif depuis PostgreSQL 13
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false");
  await pool.query("ALTER TABLE party_members ADD COLUMN IF NOT EXISTS meals_ok BOOLEAN NOT NULL DEFAULT false");
  await pool.query(`CREATE TABLE IF NOT EXISTS meals (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    t TIMESTAMPTZ NOT NULL,
    kind TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await pool.query("CREATE INDEX IF NOT EXISTS meals_user_t ON meals(user_id, t)");
  /* 23/11 : notifications push, réglages, mot de passe oublié, écran TV, récapitulatif public, langue */
  await pool.query(`CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS push_subs (
    endpoint TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sub JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS notif_prefs JSONB NOT NULL DEFAULT '{}'::jsonb");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS lang TEXT");
  await pool.query(`CREATE TABLE IF NOT EXISTS resets (
    token_hash TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exp TIMESTAMPTZ NOT NULL,
    used BOOLEAN NOT NULL DEFAULT false)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS tv_links (
    tv CHAR(6) PRIMARY KEY,
    party_code CHAR(4) NOT NULL REFERENCES parties(code) ON DELETE CASCADE,
    view TEXT NOT NULL DEFAULT 'auto',
    exp TIMESTAMPTZ NOT NULL)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS recaps (
    token TEXT PRIMARY KEY,
    party_code CHAR(4) NOT NULL REFERENCES parties(code) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await pool.query("ALTER TABLE party_members ADD COLUMN IF NOT EXISTS recap_ok BOOLEAN NOT NULL DEFAULT false");
  /* 24/11 : soirées datées (début et fin prévus), verres hors soirée, groupes de potes, repas du jour validés hors soirée */
  await pool.query("ALTER TABLE parties ADD COLUMN IF NOT EXISTS name TEXT");
  await pool.query("ALTER TABLE parties ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ");
  await pool.query("ALTER TABLE parties ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ");
  await pool.query("UPDATE parties SET starts_at=created_at, ends_at=created_at + interval '12 hours' WHERE starts_at IS NULL");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS meals_day DATE");
  /* lieu des cuvées : sur chaque verre, lieu en cours et lieux favoris du joueur */
  await pool.query("ALTER TABLE drinks ADD COLUMN IF NOT EXISTS place TEXT");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS places JSONB NOT NULL DEFAULT '[]'::jsonb");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS cur_place TEXT");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS cur_place_t TIMESTAMPTZ");
  /* apparence de l'avatar : personnage (h/f), teinte de peau, couleur de cheveux */
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS look JSONB NOT NULL DEFAULT '{}'::jsonb");
  await pool.query("CREATE INDEX IF NOT EXISTS drinks_user_t ON drinks(user_id, t)");
  await pool.query(`CREATE TABLE IF NOT EXISTS groups (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    code CHAR(6) UNIQUE NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS group_members (
    group_id BIGINT REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, user_id))`);
}

module.exports = { pool, migrate, q: (text, params) => pool.query(text, params) };
