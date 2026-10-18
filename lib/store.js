// Stockage. Tout vit en mémoire (store.db) ; on enregistre :
// - sans DATABASE_URL : un fichier JSON (développement en local) ;
// - avec DATABASE_URL : PostgreSQL, une ligne par compte, session, groupe, question et sondage. Seules les lignes
//   qui ont changé sont réécrites (avant : tout le contenu, plus d'1 Mo, à chaque vote).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');

// Ce qui a changé pendant une requête : le groupe concerné (voir scope / persist).
const scopeStore = new AsyncLocalStorage();

const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'db.json');
const DATABASE_URL = process.env.DATABASE_URL;
const VERSION = 4;

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
    pool = new Pool({ connectionString: DATABASE_URL, ssl: local ? false : { rejectUnauthorized: false }, max: Number(process.env.PG_POOL_MAX) || 10 });
  }
  return pool;
}

// ---------- PostgreSQL : une ligne par objet ----------
// qdn_meta (clé → valeur : version, clés VAPID, avis…), qdn_accounts, qdn_sessions,
// qdn_groups (le groupe sans ses questions ni sondages), qdn_questions, qdn_polls.
// L'ancienne table quidenous_store (tout en un) est lue une fois pour migrer, puis gardée telle quelle (sauvegarde).
const TABLES = {
  meta: 'CREATE TABLE IF NOT EXISTS qdn_meta (id text PRIMARY KEY, data text NOT NULL)',
  accounts: 'CREATE TABLE IF NOT EXISTS qdn_accounts (id text PRIMARY KEY, data text NOT NULL)',
  sessions: 'CREATE TABLE IF NOT EXISTS qdn_sessions (id text PRIMARY KEY, data text NOT NULL)',
  groups: 'CREATE TABLE IF NOT EXISTS qdn_groups (id text PRIMARY KEY, data text NOT NULL)',
  questions: 'CREATE TABLE IF NOT EXISTS qdn_questions (group_id text NOT NULL, id text NOT NULL, data text NOT NULL, PRIMARY KEY (group_id, id))',
  polls: 'CREATE TABLE IF NOT EXISTS qdn_polls (group_id text NOT NULL, id text NOT NULL, data text NOT NULL, PRIMARY KEY (group_id, id))',
};

// Les lignes d'un objet db : Map("table|groupe|id" → texte JSON). Seulement les groupes demandés (null = tous).
function rowsOf(db, groupIds) {
  const rows = new Map();
  const { groups, accounts, sessions, ...meta } = db;
  for (const [k, v] of Object.entries(meta)) if (v !== undefined) rows.set(`meta||${k}`, JSON.stringify(v));
  for (const [id, a] of Object.entries(accounts || {})) rows.set(`accounts||${id}`, JSON.stringify(a));
  for (const [id, s] of Object.entries(sessions || {})) rows.set(`sessions||${id}`, JSON.stringify(s));
  for (const [gid, g] of Object.entries(groups || {})) {
    if (groupIds && !groupIds.has(gid)) continue;
    const { questions, polls, ...core } = g;
    rows.set(`groups||${gid}`, JSON.stringify(core));
    for (const [id, q] of Object.entries(questions || {})) rows.set(`questions|${gid}|${id}`, JSON.stringify(q));
    for (const [id, p] of Object.entries(polls || {})) rows.set(`polls|${gid}|${id}`, JSON.stringify(p));
  }
  return rows;
}

function pgStorage() {
  const pool = pgPool();
  const saved = new Map(); // ce qui est en base (même format que rowsOf)
  return {
    label: 'PostgreSQL (tables)',
    async load() {
      for (const sql of Object.values(TABLES)) await pool.query(sql);
      const version = await pool.query("SELECT data FROM qdn_meta WHERE id = 'version'");
      if (!version.rows.length) {
        // Première fois : on part de l'ancienne table (tout en un), s'il y en a une.
        await pool.query('CREATE TABLE IF NOT EXISTS quidenous_store (id int PRIMARY KEY, data text NOT NULL)');
        const r = await pool.query('SELECT data FROM quidenous_store WHERE id = 1');
        if (r.rows[0]) console.log('Stockage : migration de l’ancienne table (tout en un) vers les nouvelles tables…');
        return r.rows[0] ? JSON.parse(r.rows[0].data) : null; // tout sera écrit au premier enregistrement
      }
      const db = { groups: {}, accounts: {}, sessions: {} };
      const one = async (table) => (await pool.query(`SELECT * FROM ${table}`)).rows;
      for (const r of await one('qdn_meta')) { db[r.id] = JSON.parse(r.data); saved.set(`meta||${r.id}`, r.data); }
      for (const r of await one('qdn_accounts')) { db.accounts[r.id] = JSON.parse(r.data); saved.set(`accounts||${r.id}`, r.data); }
      for (const r of await one('qdn_sessions')) { db.sessions[r.id] = JSON.parse(r.data); saved.set(`sessions||${r.id}`, r.data); }
      for (const r of await one('qdn_groups')) {
        db.groups[r.id] = { ...JSON.parse(r.data), questions: {}, polls: {} };
        saved.set(`groups||${r.id}`, r.data);
      }
      for (const t of ['questions', 'polls']) {
        for (const r of await one('qdn_' + t)) {
          const g = db.groups[r.group_id];
          if (!g) continue;
          g[t][r.id] = JSON.parse(r.data);
          saved.set(`${t}|${r.group_id}|${r.id}`, r.data);
        }
      }
      return db;
    },
    // groupIds : groupes à comparer (null = tous). Comptes, sessions et réglages généraux : toujours (c'est petit).
    async save(db, groupIds) {
      const now = rowsOf(db, groupIds);
      const inScope = (key) => {
        const [table, gid, id] = key.split('|');
        if (table === 'meta' || table === 'accounts' || table === 'sessions') return true;
        return !groupIds || groupIds.has(table === 'groups' ? id : gid);
      };
      const ups = {};
      const dels = {};
      for (const [key, text] of now) {
        if (saved.get(key) === text) continue;
        const [table, gid, id] = key.split('|');
        (ups[table] ||= []).push([gid, id, text]);
      }
      for (const key of saved.keys()) {
        if (now.has(key) || !inScope(key)) continue;
        const [table, gid, id] = key.split('|');
        (dels[table] ||= []).push([gid, id]);
      }
      // Groupe supprimé : ses questions et sondages partent avec.
      if (!Object.keys(ups).length && !Object.keys(dels).length) return 0;
      const client = await pool.connect();
      let n = 0;
      try {
        await client.query('BEGIN');
        for (const [table, list] of Object.entries(ups)) {
          const sub = table === 'questions' || table === 'polls';
          for (let i = 0; i < list.length; i += 500) {
            const chunk = list.slice(i, i + 500);
            if (sub) {
              await client.query(`INSERT INTO qdn_${table} (group_id, id, data) SELECT * FROM unnest($1::text[], $2::text[], $3::text[]) ON CONFLICT (group_id, id) DO UPDATE SET data = EXCLUDED.data`,
                [chunk.map((r) => r[0]), chunk.map((r) => r[1]), chunk.map((r) => r[2])]);
            } else {
              await client.query(`INSERT INTO qdn_${table} (id, data) SELECT * FROM unnest($1::text[], $2::text[]) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
                [chunk.map((r) => r[1]), chunk.map((r) => r[2])]);
            }
            n += chunk.length;
          }
        }
        for (const [table, list] of Object.entries(dels)) {
          if (table === 'questions' || table === 'polls') {
            await client.query(`DELETE FROM qdn_${table} t USING unnest($1::text[], $2::text[]) AS d(g, i) WHERE t.group_id = d.g AND t.id = d.i`, [list.map((r) => r[0]), list.map((r) => r[1])]);
          } else {
            await client.query(`DELETE FROM qdn_${table} WHERE id = ANY($1::text[])`, [list.map((r) => r[1])]);
          }
          n += list.length;
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
      // En base maintenant : on met à jour notre copie.
      for (const [table, list] of Object.entries(ups)) for (const [gid, id, text] of list) saved.set(`${table}|${gid}|${id}`, text);
      for (const [table, list] of Object.entries(dels)) for (const [gid, id] of list) saved.delete(`${table}|${gid}|${id}`);
      return n;
    },
  };
}

const storage = DATABASE_URL ? pgStorage() : fileStorage();

// intervalHours : au moins 4 h entre deux questions auto. dropsPerDay : questions en plus que chacun peut lancer
// par jour (bouton +). profiles : questionnaire de profil (désactivé par défaut).
const MIN_INTERVAL = Number(process.env.MIN_INTERVAL_HOURS) || 4;
const DEFAULT_SETTINGS = { intervalHours: 4, startHour: 10, endHour: 23, timezone: 'Europe/Paris', pollHours: 24, allowNobody: false, dropsPerDay: 1, profiles: false, spicy: true };

// Réglages complétés (nouveaux réglages ajoutés depuis) et ramenés dans les limites actuelles.
function fixSettings(g) {
  g.settings = { ...DEFAULT_SETTINGS, ...g.settings };
  if (g.settings.intervalHours < MIN_INTERVAL) g.settings.intervalHours = MIN_INTERVAL;
}

function empty() {
  return { version: VERSION, vapid: null, groups: {}, sessions: {}, accounts: {} };
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
  const db = { ...empty(), version: 3 };
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

// v3 (un compte par groupe : pseudo + PIN dans chaque groupe) → v4 (un compte par personne, plusieurs groupes).
// Chaque connexion existante devient un compte (même PIN) : rien ne casse, personne n'est déconnecté.
// Ces comptes n'ont pas encore d'identifiant : l'app le demandera une fois. On peut ensuite y rattacher
// ses autres groupes (connexion à l'ancienne : code du groupe + pseudo + PIN).
function migrateV3(data) {
  const db = { ...empty(), ...data, version: VERSION, accounts: {} };
  let n = 0;
  for (const g of Object.values(db.groups)) {
    for (const u of Object.values(g.users || {})) {
      if (u.disabled || !u.pinHash || u.accountId) continue;
      const id = crypto.randomBytes(8).toString('hex');
      db.accounts[id] = { id, username: null, salt: u.salt, pinHash: u.pinHash, lang: u.lang || null, createdAt: u.createdAt || Date.now() };
      u.accountId = id;
      n++;
    }
  }
  for (const [token, s] of Object.entries(db.sessions)) {
    const u = s.groupId && db.groups[s.groupId] && db.groups[s.groupId].users[s.userId];
    if (u && u.accountId) db.sessions[token] = { ...s, accountId: u.accountId };
    else delete db.sessions[token];
  }
  console.log(`Comptes : ${n} connexions existantes transformées en comptes (multi-groupes).`);
  return db;
}

async function load() {
  const data = await storage.load();
  if (!data) return;
  if (data.version === VERSION) {
    store.db = { ...empty(), ...data };
    for (const g of Object.values(store.db.groups)) fixSettings(g);
  } else if (data.version === 3 || data.version === 2) {
    store.db = migrateV3(data.version === 2 ? migrateV2(data) : data);
    for (const g of Object.values(store.db.groups)) fixSettings(g);
    persist();
  } else {
    console.log('Ancien format de données détecté : on repart de zéro.');
  }
  persist(); // n'écrit que ce qui manque en base (tout, juste après une migration)
}

// Sauvegardes regroupées : au plus une écriture par seconde, une seule à la fois.
// Groupes à revérifier : ceux touchés depuis la dernière sauvegarde (null = tous, par sécurité).
let saveChain = Promise.resolve();
let saveTimer = null;
let dirty = new Set();
let dirtyAll = true; // au démarrage (et après une migration) : tout comparer
function writeNow() {
  const groups = dirtyAll ? null : dirty;
  dirty = new Set();
  dirtyAll = false;
  saveChain = saveChain.then(async () => {
    try {
      if (storage.save.length >= 2) await storage.save(store.db, groups);
      else await storage.save(JSON.stringify(store.db));
    } catch (e) {
      console.error('Échec de la sauvegarde :', e);
      dirtyAll = true; // on retentera tout au prochain coup
      persist();
    }
  });
  return saveChain;
}

// persist() : « quelque chose a changé ». Pendant une requête liée à un groupe (voir scope), seul ce groupe
// est revérifié ; sinon tous. persist(g) : ce groupe-là en plus.
function persist(g) {
  const ctx = scopeStore.getStore();
  if (g && g.id) dirty.add(g.id);
  else if (ctx && ctx.group) dirty.add(ctx.group.id);
  else dirtyAll = true;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    writeNow();
  }, 1000);
}

// Exécute fn « dans » un groupe : les persist() sans argument ne concernent que lui.
const scope = (group, fn) => scopeStore.run({ group }, fn);
const setScopeGroup = (group) => { const ctx = scopeStore.getStore(); if (ctx) ctx.group = group; };
// Filet de sécurité : toutes les 10 minutes, on compare tout (un changement « hors groupe » oublié serait rattrapé).
setInterval(() => { dirtyAll = true; persist(); }, 10 * 60 * 1000).unref();

// À l'arrêt (redéploiement), on écrit ce qui reste en attente.
function flush() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
    return writeNow();
  }
  return saveChain;
}

module.exports = { store, load, persist, flush, scope, setScopeGroup, scopeStore, newGroup, newCode, pgPool, DATA_FILE, MIN_INTERVAL, DEFAULT_SETTINGS };
