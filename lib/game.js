// Logique du jeu, toujours dans le contexte d'un groupe `g` : sets, questions, drops, vues.
const crypto = require('crypto');
const { persist } = require('./store');
const { parseWeights, tally } = require('./stats');
const { latestSlot } = require('./schedule');
const { loadSeed } = require('./seed');
const push = require('./push');

const HOUR = 3600 * 1000;
const COLORS = ['#ff5e7e', '#ff9f43', '#feca57', '#1dd1a1', '#48dbfb', '#5f27cd', '#ff6bcb', '#54a0ff', '#10ac84', '#ee5253', '#a55eea', '#f368e0'];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const newId = () => crypto.randomBytes(8).toString('hex');

// Forme normalisée pour détecter les doublons (accents, ponctuation, casse, écriture inclusive ignorés).
function norm(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[·.]e\b/g, 'e')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function cleanText(text, min, max, what) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length < min || t.length > max) throw new HttpError(400, `${what} doit faire entre ${min} et ${max} caractères`);
  return t;
}

function cleanQuestion(text) {
  let q = cleanText(text, 8, 200, 'La question');
  q = q.replace(/\s*\?$/, ' ?');
  if (!/[?!.…]$/.test(q)) q += ' ?';
  return q;
}

function findDuplicate(g, text) {
  const n = norm(text);
  return Object.values(g.questions).find((q) => !q.removed && q.norm === n);
}

// ---------- Seed : questions.md ----------

let seed = loadSeed();
const seedId = (text) => 'q_' + crypto.createHash('sha1').update(norm(text)).digest('hex').slice(0, 12);

// Synchronise un groupe avec questions.md : ajoute les nouvelles questions, met à jour les poids,
// retire celles qui ont disparu du fichier (sauf si déjà jouées).
function mergeSeed(g) {
  const inSeed = new Set();
  const seedSets = new Set();
  let added = 0;
  seed.forEach((s, order) => {
    seedSets.add(s.id);
    const existing = g.sets[s.id];
    g.sets[s.id] = {
      ...(existing || { createdAt: 0, authorId: null }),
      id: s.id, name: s.name, emoji: s.emoji, description: s.description, spicy: !!s.spicy, builtin: true, order,
    };
    for (const [text, weights] of s.questions) {
      const id = seedId(text);
      inSeed.add(id);
      const q = g.questions[id];
      if (q) {
        if (q.builtin) {
          Object.assign(q, { text, setId: s.id, weights: parseWeights(weights) });
          if (q.removed === 'seed') delete q.removed;
        }
        continue;
      }
      if (findDuplicate(g, text)) continue;
      g.questions[id] = { id, setId: s.id, text, norm: norm(text), weights: parseWeights(weights), builtin: true, authorId: null, createdAt: Date.now(), usedAt: null };
      added++;
    }
  });
  for (const q of Object.values(g.questions)) {
    if (q.builtin && !inSeed.has(q.id) && !q.usedAt && !q.removed) q.removed = 'seed';
  }
  for (const s of Object.values(g.sets)) {
    if (!s.builtin || seedSets.has(s.id)) continue;
    const qs = Object.values(g.questions).filter((q) => q.setId === s.id);
    if (qs.some((q) => q.usedAt)) continue; // garde l'historique
    for (const q of qs) delete g.questions[q.id];
    delete g.sets[s.id];
  }
  return added;
}

function reloadSeed(groups) {
  seed = loadSeed();
  let added = 0;
  for (const g of groups) added += mergeSeed(g);
  persist();
  return { sets: seed.length, questions: seed.reduce((n, s) => n + s.questions.length, 0), added };
}

// ---------- Questions et sondages ----------

function addQuestion(g, setId, text, authorId) {
  const set = g.sets[setId];
  if (!set) throw new HttpError(404, 'Set introuvable');
  const clean = cleanQuestion(text);
  const dup = findDuplicate(g, clean);
  if (dup) throw new HttpError(409, dup.usedAt ? 'Cette question a déjà été posée !' : 'Cette question existe déjà dans un set 😉');
  const q = { id: newId(), setId, text: clean, norm: norm(clean), weights: null, builtin: false, authorId, createdAt: Date.now(), usedAt: null };
  g.questions[q.id] = q;
  persist();
  return q;
}

function unused(g, setId) {
  return Object.values(g.questions).filter((q) => !q.usedAt && !q.removed && (!setId || q.setId === setId) && g.sets[q.setId]);
}

// Set au hasard (parmi ceux qui ont encore des questions), puis question au hasard dans ce set.
function pickQuestion(g, setId) {
  const pool = unused(g, setId);
  if (!pool.length) return null;
  const sets = [...new Set(pool.map((q) => q.setId))];
  const chosen = sets[Math.floor(Math.random() * sets.length)];
  const inSet = pool.filter((q) => q.setId === chosen);
  return inSet[Math.floor(Math.random() * inSet.length)];
}

function createPoll(g, question, startsAt, source, droppedBy) {
  question.usedAt = startsAt;
  const poll = {
    id: newId(), questionId: question.id, setId: question.setId, text: question.text,
    startsAt, endsAt: startsAt + g.settings.pollHours * HOUR, source, droppedBy, votes: {},
  };
  g.polls[poll.id] = poll;
  persist();

  const set = g.sets[question.setId];
  const by = droppedBy && g.players[g.users[droppedBy]?.playerId];
  push.sendAll(g, {
    title: `${set ? set.emoji + ' ' + set.name : 'Qui de nous ?'}${by ? ' · par ' + by.name : ''}`,
    body: question.text,
    tag: poll.id,
    url: '/',
  }, droppedBy).catch(() => {});
  return poll;
}

// Drop automatique : appelé chaque minute et à chaque requête (rattrapage après une mise en veille).
function tick(g, now = Date.now()) {
  if (!Object.keys(g.users).length) return null;
  const slot = latestSlot(now, g.settings);
  if (!slot || slot <= g.lastAutoSlot) return null;
  g.lastAutoSlot = slot;
  persist();
  if (now - slot >= g.settings.pollHours * HOUR) return null;
  const q = pickQuestion(g);
  return q ? createPoll(g, q, slot, 'auto', null) : null;
}

// ---------- Vues ----------

function pollView(g, p, me, now) {
  const ended = p.endsAt <= now;
  const myVote = p.votes[me.id] || null;
  const voterIds = Object.keys(p.votes).map((uid) => g.users[uid]?.playerId).filter(Boolean);
  return {
    id: p.id,
    text: p.text,
    setId: p.setId,
    startsAt: p.startsAt,
    endsAt: p.endsAt,
    ended,
    source: p.source,
    droppedBy: p.droppedBy ? g.users[p.droppedBy]?.playerId || null : null,
    mine: p.droppedBy === me.id,
    voterIds,
    myVote,
    results: ended || myVote ? tally(p) : null,
  };
}

function setView(g, s, me) {
  const qs = Object.values(g.questions).filter((q) => q.setId === s.id && !q.removed);
  const played = qs.filter((q) => q.usedAt).length;
  return {
    id: s.id, name: s.name, emoji: s.emoji, description: s.description, spicy: s.spicy, builtin: s.builtin,
    author: s.authorId ? g.users[s.authorId]?.playerId || null : null,
    mine: s.authorId === me.id,
    total: qs.length, played, remaining: qs.length - played,
  };
}

module.exports = {
  HttpError, newId, norm, cleanText, cleanQuestion, COLORS, HOUR,
  mergeSeed, reloadSeed, addQuestion, pickQuestion, unused, createPoll, tick, pollView, setView,
};
