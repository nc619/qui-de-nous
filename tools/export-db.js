// Copie locale des données du serveur (pour l'analyse des stats / des notes de questions).
// Usage :  DATABASE_URL="postgresql://…" node tools/export-db.js      (ou sans DATABASE_URL : data/db.json)
// Écrit data/export.json (data/ n'est pas dans git). Les secrets sont retirés : PIN, sessions, clés, abonnements
// aux notifications, texte des messages du chat (on ne garde que qui a écrit quoi et quand).
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'data', 'export.json');

async function main() {
  let db;
  let chat = [];
  if (process.env.DATABASE_URL) {
    const { Pool } = require('pg');
    const local = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: local ? false : { rejectUnauthorized: false } });
    db = JSON.parse((await pool.query('SELECT data FROM quidenous_store WHERE id = 1')).rows[0].data);
    const r = await pool.query('SELECT group_id, data FROM quidenous_chat ORDER BY group_id, seq').catch(() => ({ rows: [] }));
    chat = r.rows.map((row) => ({ groupId: row.group_id, ...JSON.parse(row.data) }));
    await pool.end();
  } else {
    const file = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'db.json');
    db = JSON.parse(fs.readFileSync(file, 'utf8'));
    const cf = path.join(path.dirname(file), 'chat.jsonl');
    if (fs.existsSync(cf)) chat = fs.readFileSync(cf, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  }
  // Dernière version de chaque message (le fichier JSONL contient les modifications à la suite).
  const msgs = new Map();
  for (const m of chat) msgs.set(m.groupId + ':' + m.seq, m);

  delete db.sessions;
  delete db.vapid;
  for (const a of Object.values(db.accounts || {})) {
    delete a.salt;
    delete a.pinHash;
    delete a.recovery;
  }
  for (const g of Object.values(db.groups || {})) {
    delete g.pushSubs;
    for (const u of Object.values(g.users || {})) {
      delete u.salt;
      delete u.pinHash;
    }
  }
  db.chatMeta = [...msgs.values()].map((m) => ({
    groupId: m.groupId, seq: m.seq, channel: m.channel, userId: m.userId, kind: m.kind, at: m.at, deleted: !!m.deleted,
    len: m.text ? m.text.length : 0, reactions: Object.keys(m.reactions || {}).length, replyTo: m.replyTo || null,
  }));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(db));
  const groups = Object.values(db.groups || {});
  console.log(`OK → ${OUT}`);
  for (const g of groups) console.log(`  ${g.name} : ${Object.keys(g.players).length} personnes, ${Object.keys(g.polls).length} sondages`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
