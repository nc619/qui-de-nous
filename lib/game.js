// Logique du jeu, toujours dans le contexte d'un groupe `g` : sets, questions, drops, vues.
const crypto = require('crypto');
const { persist } = require('./store');
const { parseWeights, tally, ballot, isHalf, consensus } = require('./stats');
const { latestSlot } = require('./schedule');
const { loadSeed } = require('./seed');
const push = require('./push');
const live = require('./live');

const HOUR = 3600 * 1000;
// 16 couleurs bien distinctes (les 12 d'origine + 4) : une par personne, chacun peut choisir parmi les libres.
const COLORS = [
  '#7b2ff7', '#ff7a00', '#00a8e8', '#ff2e88', '#12b76a', '#ffbe0b', '#3a5bff', '#e5383b', '#00b8a9', '#c21fd6', '#8ac926', '#5a189a',
  '#8b5a2b', '#1d3557', '#64748b', '#ff9ebb',
];
const OLD_COLORS = 12; // avant : couleur = place dans la liste modulo 12 (on garde ça pour les animaux par défaut)

// message : en français ; en : la même chose en anglais (affichée si la personne a l'app en anglais).
class HttpError extends Error {
  constructor(status, message, en) {
    super(message);
    this.status = status;
    this.en = en || null;
  }
}

const byAge = (g) => Object.values(g.players).sort((a, b) => a.createdAt - b.createdAt);

// Couleurs enregistrées sur chaque personne. Première fois : chacun garde celle qu'il avait (sa place dans la liste),
// et s'il y a des doublons (plus de 12 personnes), on donne une des nouvelles couleurs libres.
function ensureColors(g) {
  if (g.colorsV2) return false;
  const taken = new Set();
  byAge(g).forEach((p, i) => {
    let c = COLORS[i % OLD_COLORS];
    if (taken.has(c)) c = COLORS.find((x) => !taken.has(x)) || c;
    p.color = c;
    taken.add(c);
  });
  g.colorsV2 = true;
  return true;
}

function freeColor(g) {
  const taken = new Set(Object.values(g.players).map((p) => p.color));
  return COLORS.find((c) => !taken.has(c)) || COLORS[Object.keys(g.players).length % COLORS.length];
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

function cleanText(text, min, max, what, whatEn) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length < min || t.length > max) throw new HttpError(400, `${what} doit faire entre ${min} et ${max} caractères`, `${whatEn || what} has to be between ${min} and ${max} characters`);
  return t;
}

function cleanQuestion(text) {
  let q = cleanText(text, 8, 200, 'La question', 'The question');
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
      id: s.id, name: s.name, emoji: s.emoji, description: s.description, nameEn: s.nameEn || null, descriptionEn: s.descriptionEn || null, spicy: !!s.spicy, builtin: true, order,
    };
    for (const [text, weights, en] of s.questions) {
      const id = seedId(text);
      inSeed.add(id);
      const q = g.questions[id];
      if (q) {
        if (q.builtin) {
          Object.assign(q, { text, textEn: en || null, setId: s.id, weights: parseWeights(weights) });
          if (q.removed === 'seed') delete q.removed;
        }
        continue;
      }
      if (findDuplicate(g, text)) continue;
      g.questions[id] = { id, setId: s.id, text, textEn: en || null, norm: norm(text), weights: parseWeights(weights), builtin: true, authorId: null, createdAt: Date.now(), usedAt: null };
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
  if (!set) throw new HttpError(404, 'Set introuvable', 'Set not found');
  const clean = cleanQuestion(text);
  const dup = findDuplicate(g, clean);
  if (dup) throw new HttpError(409, dup.usedAt ? 'Cette question a déjà été posée !' : 'Cette question existe déjà dans un set 😉', dup.usedAt ? 'That question was already asked!' : 'That question is already in a set 😉');
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
    members: Object.values(g.users).filter((u) => !u.disabled).length, // pour savoir si « tout le monde » a voté
  };
  g.polls[poll.id] = poll;
  persist();
  live.emit(g.id, 'refresh', {});

  const set = g.sets[question.setId];
  const by = droppedBy && g.players[g.users[droppedBy]?.playerId];
  const author = !question.builtin && question.authorId && g.players[g.users[question.authorId]?.playerId];
  push.notify(g, 'polls', (u) => (u.lang === 'en' ? {
    title: author ? `${author.name}'s own question` : `New question${by ? ' from ' + by.name : ''}`,
    body: `${set ? (set.nameEn || set.name) + ' · ' : ''}${question.textEn || question.text}`,
    tag: 'poll-' + poll.id,
    url: '/',
  } : {
    title: author ? `Question perso de ${author.name}` : `Nouvelle question${by ? ' de ' + by.name : ''}`,
    body: `${set ? set.name + ' · ' : ''}${question.text}`,
    tag: 'poll-' + poll.id,
    url: '/',
  }), droppedBy);
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

// La durée de vote a changé : les sondages encore en cours suivent la nouvelle durée
// (ceux qui dépassent déjà la nouvelle durée se terminent tout de suite et partent dans les archives).
function applyPollHours(g, now = Date.now()) {
  let changed = 0;
  for (const p of Object.values(g.polls)) {
    if (p.endsAt <= now) continue;
    p.endsAt = p.startsAt + g.settings.pollHours * HOUR;
    changed++;
  }
  return changed;
}

// Questions au conditionnel (« Qui ferait… ») : on peut répondre « Personne » si l'admin l'a activé.
// Pas pour les superlatifs (« le plus », « le premier »…) : là, il y a forcément quelqu'un.
function isConditional(text) {
  const words = String(text).split(/\s+/).slice(1, 5).map((w) => w.replace(/^.*['’]/, '').toLowerCase());
  if (!words.some((w) => /rait$/.test(w))) return false;
  return !/(^|\s)(le|la|les|du|des) (plus|moins|pires?|meilleure?s?|premier|première|dernier|dernière)(\s|$)/i.test(text);
}
const allowsNobody = (g, text) => !!g.settings.allowNobody && isConditional(text);

// ---------- Vues ----------

function pollView(g, p, me, now) {
  const ended = p.endsAt <= now;
  const myVote = p.votes[me.id] || null;
  const voterIds = Object.keys(p.votes).map((uid) => g.users[uid]?.playerId).filter(Boolean);
  const reveal = ended || !!myVote;
  const q = g.questions[p.questionId];
  const members = Object.values(g.users).filter((u) => !u.disabled).length;
  const ratings = (q && q.ratings) || {};
  const notes = Object.values(ratings);
  return {
    textEn: (q && q.textEn) || null,
    // Tout le monde d'accord / personne d'accord (visible une fois les résultats visibles).
    consensus: reveal ? consensus(p, members) : null,
    // Note de la question (1 à 5) : la mienne + la moyenne du groupe.
    rating: { mine: ratings[me.id] || null, avg: notes.length ? Math.round((notes.reduce((a, b) => a + b, 0) / notes.length) * 10) / 10 : null, n: notes.length },
    // Question écrite par quelqu'un du groupe (et pas une question intégrée) → on affiche son auteur.
    custom: !!q && !q.builtin,
    authorId: q && !q.builtin && q.authorId ? g.users[q.authorId]?.playerId || null : null,
    // Qui a voté pour qui (visible une fois qu'on a voté, ou quand le sondage est terminé).
    ballots: reveal
      ? Object.entries(p.votes).flatMap(([uid, v]) => ballot(v).map(([target, w]) => ({ voter: g.users[uid]?.playerId || null, target, half: w < 1 }))).filter((b) => b.voter)
      : null,
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
    nobody: allowsNobody(g, p.text) || Object.values(p.votes).some((v) => ballot(v).some(([t]) => t === 'nobody')),
    results: reveal ? tally(p) : null,
  };
}

function setView(g, s, me) {
  const qs = Object.values(g.questions).filter((q) => q.setId === s.id && !q.removed);
  const played = qs.filter((q) => q.usedAt).length;
  return {
    id: s.id, name: s.name, emoji: s.emoji, description: s.description, nameEn: s.nameEn || null, descriptionEn: s.descriptionEn || null, spicy: s.spicy, builtin: s.builtin,
    author: s.authorId ? g.users[s.authorId]?.playerId || null : null,
    mine: s.authorId === me.id,
    total: qs.length, played, remaining: qs.length - played,
  };
}

module.exports = {
  HttpError, newId, norm, cleanText, cleanQuestion, COLORS, OLD_COLORS, HOUR, byAge, ensureColors, freeColor, applyPollHours, isHalf,
  mergeSeed, reloadSeed, isConditional, allowsNobody, addQuestion, pickQuestion, unused, createPoll, tick, pollView, setView,
};
