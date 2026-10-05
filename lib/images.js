// Photos envoyées dans le chat : JPEG redimensionnés par le navigateur avant l'envoi.
// Stockées à part (table PostgreSQL ou dossier data/images) et lues à la demande, avec un petit cache en mémoire.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pgPool, DATA_FILE } = require('./store');

const DIR = path.join(path.dirname(DATA_FILE), 'images');
const MAX_BYTES = 900 * 1024;
const MIMES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const CACHE_BYTES = 40 * 1024 * 1024;
const cache = new Map(); // id -> { mime, buf } (les plus récents à la fin)
let cached = 0;

function remember(id, img) {
  if (cache.has(id)) {
    cached -= cache.get(id).buf.length;
    cache.delete(id);
  }
  cache.set(id, img);
  cached += img.buf.length;
  while (cached > CACHE_BYTES && cache.size > 1) {
    const [old, v] = cache.entries().next().value;
    cache.delete(old);
    cached -= v.buf.length;
  }
}

let ready = null;
function init() {
  const pool = pgPool();
  if (!pool) return Promise.resolve();
  ready ||= pool.query('CREATE TABLE IF NOT EXISTS quidenous_images (id text PRIMARY KEY, group_id text NOT NULL, mime text NOT NULL, data bytea NOT NULL, created_at bigint NOT NULL)');
  return ready;
}

// dataUrl : « data:image/jpeg;base64,... ». Renvoie l'identifiant (aléatoire : sert aussi de clé d'accès).
async function put(groupId, dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length || buf.length > MAX_BYTES) return null;
  const mime = m[1];
  const id = crypto.randomBytes(16).toString('hex');
  const pool = pgPool();
  if (pool) {
    await init();
    await pool.query('INSERT INTO quidenous_images (id, group_id, mime, data, created_at) VALUES ($1, $2, $3, $4, $5)', [id, groupId, mime, buf, Date.now()]);
  } else {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(path.join(DIR, `${id}.${MIMES[mime]}`), buf);
  }
  remember(id, { mime, buf });
  return id;
}

async function get(id) {
  if (!/^[0-9a-f]{32}$/.test(String(id))) return null;
  if (cache.has(id)) {
    const img = cache.get(id);
    remember(id, img);
    return img;
  }
  const pool = pgPool();
  let img = null;
  if (pool) {
    await init();
    const r = await pool.query('SELECT mime, data FROM quidenous_images WHERE id = $1', [id]);
    if (r.rows[0]) img = { mime: r.rows[0].mime, buf: r.rows[0].data };
  } else {
    for (const [mime, ext] of Object.entries(MIMES)) {
      const f = path.join(DIR, `${id}.${ext}`);
      if (fs.existsSync(f)) img = { mime, buf: fs.readFileSync(f) };
    }
  }
  if (img) remember(id, img);
  return img;
}

async function remove(id) {
  if (!/^[0-9a-f]{32}$/.test(String(id))) return;
  if (cache.has(id)) {
    cached -= cache.get(id).buf.length;
    cache.delete(id);
  }
  const pool = pgPool();
  if (pool) {
    await init();
    await pool.query('DELETE FROM quidenous_images WHERE id = $1', [id]);
  } else for (const ext of Object.values(MIMES)) fs.rmSync(path.join(DIR, `${id}.${ext}`), { force: true });
}

module.exports = { init, put, get, remove };
