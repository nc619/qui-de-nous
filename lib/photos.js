// Photos de profil : petites images carrées (redimensionnées par le navigateur avant l'envoi).
// Stockées à part du reste (table PostgreSQL ou dossier data/photos), et gardées en mémoire.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pgPool, DATA_FILE } = require('./store');

const DIR = path.join(path.dirname(DATA_FILE), 'photos');
const MAX_BYTES = 150 * 1024;
const MIMES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const cache = new Map(); // playerId -> { mime, buf }

async function load() {
  const pool = pgPool();
  if (pool) {
    await pool.query('CREATE TABLE IF NOT EXISTS quidenous_photos (player_id text PRIMARY KEY, mime text NOT NULL, data bytea NOT NULL)');
    const r = await pool.query('SELECT player_id, mime, data FROM quidenous_photos');
    for (const row of r.rows) cache.set(row.player_id, { mime: row.mime, buf: row.data });
    return r.rows.length;
  }
  if (!fs.existsSync(DIR)) return 0;
  for (const f of fs.readdirSync(DIR)) {
    const [id, ext] = f.split('.');
    const mime = Object.keys(MIMES).find((m) => MIMES[m] === ext);
    if (mime) cache.set(id, { mime, buf: fs.readFileSync(path.join(DIR, f)) });
  }
  return cache.size;
}

// dataUrl : « data:image/jpeg;base64,... ». Renvoie la version (pour casser le cache du navigateur).
async function put(playerId, dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length || buf.length > MAX_BYTES) return null;
  const mime = m[1];
  cache.set(playerId, { mime, buf });
  const pool = pgPool();
  if (pool) {
    await pool.query(
      'INSERT INTO quidenous_photos (player_id, mime, data) VALUES ($1, $2, $3) ON CONFLICT (player_id) DO UPDATE SET mime = EXCLUDED.mime, data = EXCLUDED.data',
      [playerId, mime, buf]
    );
  } else {
    fs.mkdirSync(DIR, { recursive: true });
    for (const ext of Object.values(MIMES)) fs.rmSync(path.join(DIR, `${playerId}.${ext}`), { force: true });
    fs.writeFileSync(path.join(DIR, `${playerId}.${MIMES[mime]}`), buf);
  }
  return crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10);
}

async function remove(playerId) {
  cache.delete(playerId);
  const pool = pgPool();
  if (pool) await pool.query('DELETE FROM quidenous_photos WHERE player_id = $1', [playerId]);
  else for (const ext of Object.values(MIMES)) fs.rmSync(path.join(DIR, `${playerId}.${ext}`), { force: true });
}

const get = (playerId) => cache.get(playerId) || null;

module.exports = { load, put, remove, get };
