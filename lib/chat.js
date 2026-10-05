// Messages du chat : gardés en mémoire, sauvegardés en ajout seul (fichier JSONL ou table PostgreSQL).
// Chaque groupe a des canaux : "general" et un canal par sondage (id du sondage).
const fs = require('fs');
const path = require('path');
const { pgPool, DATA_FILE } = require('./store');

const CHAT_FILE = path.join(path.dirname(DATA_FILE), 'chat.jsonl');
const groups = new Map(); // groupId -> { seq, channels: Map<channel, msg[]>, bySeq: Map<seq, msg> }

function bucket(groupId) {
  if (!groups.has(groupId)) groups.set(groupId, { seq: 0, channels: new Map(), bySeq: new Map() });
  return groups.get(groupId);
}

function index(groupId, msg) {
  const b = bucket(groupId);
  const existing = b.bySeq.get(msg.seq);
  if (existing) {
    // Nouvelle version du message (suppression, réactions) : elle remplace entièrement l'ancienne.
    for (const k of Object.keys(existing)) if (!(k in msg)) delete existing[k];
    return Object.assign(existing, msg);
  }
  if (!b.channels.has(msg.channel)) b.channels.set(msg.channel, []);
  b.channels.get(msg.channel).push(msg);
  b.bySeq.set(msg.seq, msg);
  b.seq = Math.max(b.seq, msg.seq);
  return msg;
}

// ---------- Stockage ----------

let writeChain = Promise.resolve();
function save(groupId, msg) {
  const pool = pgPool();
  const row = JSON.stringify(msg);
  writeChain = writeChain.then(async () => {
    try {
      if (pool) {
        await pool.query(
          'INSERT INTO quidenous_chat (group_id, seq, data) VALUES ($1, $2, $3) ON CONFLICT (group_id, seq) DO UPDATE SET data = EXCLUDED.data',
          [groupId, msg.seq, row]
        );
      } else {
        fs.mkdirSync(path.dirname(CHAT_FILE), { recursive: true });
        fs.appendFileSync(CHAT_FILE, JSON.stringify({ groupId, ...msg }) + '\n');
      }
    } catch (e) {
      console.error('Échec de la sauvegarde du chat :', e);
    }
  });
}

async function load() {
  const pool = pgPool();
  if (pool) {
    await pool.query('CREATE TABLE IF NOT EXISTS quidenous_chat (group_id text NOT NULL, seq int NOT NULL, data text NOT NULL, PRIMARY KEY (group_id, seq))');
    const r = await pool.query('SELECT group_id, data FROM quidenous_chat ORDER BY group_id, seq');
    for (const row of r.rows) index(row.group_id, JSON.parse(row.data));
    return r.rows.length;
  }
  if (!fs.existsSync(CHAT_FILE)) return 0;
  let n = 0;
  for (const line of fs.readFileSync(CHAT_FILE, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const { groupId, ...msg } = JSON.parse(line);
      index(groupId, msg);
      n++;
    } catch { /* ligne abîmée : on ignore */ }
  }
  for (const b of groups.values()) for (const list of b.channels.values()) list.sort((a, c) => a.seq - c.seq);
  return n;
}

// ---------- API ----------

function add(groupId, msg) {
  const b = bucket(groupId);
  const full = { ...msg, seq: b.seq + 1, at: Date.now() };
  index(groupId, full);
  save(groupId, full);
  return full;
}

function remove(groupId, seq) {
  const msg = bucket(groupId).bySeq.get(seq);
  if (!msg) return null;
  msg.deleted = true;
  delete msg.text;
  delete msg.gif;
  delete msg.image;
  delete msg.mentions;
  save(groupId, msg);
  return msg;
}

function react(groupId, seq, userId, emoji) {
  const msg = bucket(groupId).bySeq.get(seq);
  if (!msg) return null;
  msg.reactions ||= {};
  if (emoji) msg.reactions[userId] = emoji;
  else delete msg.reactions[userId];
  save(groupId, msg);
  return msg;
}

function get(groupId, seq) {
  return bucket(groupId).bySeq.get(seq) || null;
}

function list(groupId, channel) {
  return bucket(groupId).channels.get(channel) || [];
}

function channels(groupId) {
  return [...bucket(groupId).channels.keys()];
}

module.exports = { load, add, remove, react, get, list, channels };
