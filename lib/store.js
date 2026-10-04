// Stockage : un seul objet JSON, dans un fichier ou dans PostgreSQL (si DATABASE_URL).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'db.json');
const DATABASE_URL = process.env.DATABASE_URL;
const VERSION = 3;

function fileStorage() {
  return {
    label: DATA_FILE,
    async load() {
      try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      } catch (e) {
        if (e.code === 'ENOENT') return null;
        throw e;
      }
    },
    async save(data) {
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
      const tmp = DATA_FILE + '.tmp';
      fs.writeFileSync(tmp, data);
      fs.renameSync(tmp, DATA_FILE);
    },
  };
}

let pool = null;
function pgPool() {
  if (!pool && DATABASE_URL) {
    const { Pool } = require('pg');
    const local = /localhost|127\.0\.0\.1/.test(DATABASE_URL);
    pool = new Pool({ connectionString: DATABASE_URL, ssl: local ? false : { rejectUnauthorized: false } });
  }
  return pool;
}

function pgStorage() {
  const pool = pgPool();
  return {
    label: 'PostgreSQL',
    async load() {
      await pool.query('CREATE TABLE IF NOT EXISTS quidenous_store (id int PRIMARY KEY, data text NOT NULL)');
      const r = await pool.query('SELECT data FROM quidenous_store WHERE id = 1');
      return r.rows[0] ? JSON.parse(r.rows[0].data) : null;
    },
    async save(data) {
      await pool.query(
        'INSERT INTO quidenous_store (id, data) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data',
        [data]
      );
    },
  };
}

const storage = DATABASE_URL ? pgStorage() : fileStorage();

const DEFAULT_SETTINGS = { intervalHours: 3, startHour: 10, endHour: 23, timezone: 'Europe/Paris', pollHours: 24 };

function empty() {
  return { version: VERSION, vapid: null, groups: {}, sessions: {} };
}

const store = { db: empty(), label: storage.label };

// Code de groupe : 6 caractères faciles à lire (pas de 0/O, 1/I/L).
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function newCode() {
  for (;;) {
    let code = '';
    for (const b of crypto.randomBytes(6)) code += CODE_CHARS[b % CODE_CHARS.length];
    if (!Object.values(store.db.groups).some((g) => g.code === code)) return code;
  }
}

function newGroup(name) {
  return {
    id: crypto.randomBytes(8).toString('hex'),
    name,
    code: newCode(),
    createdAt: Date.now(),
    settings: { ...DEFAULT_SETTINGS },
    players: {},
    users: {},
    sets: {},
    questions: {},
    polls: {},
    pushSubs: {},
    lastAutoSlot: 0,
  };
}

// v2 (un seul groupe implicite) → v3 (plusieurs groupes avec code).
function migrateV2(data) {
  const db = empty();
  db.vapid = data.push && data.push.vapid;
  store.db = db;
  const g = newGroup('Mon groupe');
  Object.assign(g, {
    settings: { ...DEFAULT_SETTINGS, ...data.settings },
    players: data.players || {},
    users: data.users || {},
    sets: data.sets || {},
    questions: data.questions || {},
    polls: data.polls || {},
    pushSubs: (data.push && data.push.subs) || {},
    lastAutoSlot: data.lastAutoSlot || 0,
  });
  for (const q of Object.values(g.questions)) if (q.removed === true) q.removed = 'admin';
  db.groups[g.id] = g;
  for (const [token, s] of Object.entries(data.sessions || {})) db.sessions[token] = { ...s, groupId: g.id };
  console.log(`Données existantes migrées dans le groupe « ${g.name} » — code : ${g.code}`);
  return db;
}

async function load() {
  const data = await storage.load();
  if (!data) return;
  if (data.version === VERSION) {
    store.db = { ...empty(), ...data };
    for (const g of Object.values(store.db.groups)) g.settings = { ...DEFAULT_SETTINGS, ...g.settings };
  } else if (data.version === 2) {
    store.db = migrateV2(data);
    persist();
  } else {
    console.log('Ancien format de données détecté : on repart de zéro.');
  }
}

// Sauvegardes regroupées : au plus une écriture par seconde, une seule à la fois.
let saveChain = Promise.resolve();
let saveTimer = null;
function writeNow() {
  saveChain = saveChain.then(async () => {
    try {
      await storage.save(JSON.stringify(store.db));
    } catch (e) {
      console.error('Échec de la sauvegarde :', e);
    }
  });
  return saveChain;
}

function persist() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    writeNow();
  }, 1000);
}

// À l'arrêt (redéploiement), on écrit ce qui reste en attente.
function flush() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
    return writeNow();
  }
  return saveChain;
}

module.exports = { store, load, persist, flush, newGroup, newCode, pgPool, DATA_FILE };
