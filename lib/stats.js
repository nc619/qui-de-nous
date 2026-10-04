// Stats de personnalité : chaque question a des poids, chaque sondage terminé distribue ces poids
// aux joueurs selon la part de votes reçus.

const STATS = [
  { key: 'chaos', emoji: '🔥', label: 'Chaos', title: 'Agent du Chaos' },
  { key: 'hot', emoji: '💋', label: 'Hot', title: 'Bombe Atomique' },
  { key: 'cerveau', emoji: '🧠', label: 'Cerveau', title: 'Le Cerveau', low: { emoji: '🫠', title: 'Neurone Solitaire' } },
  { key: 'genance', emoji: '🤡', label: 'Gênance', title: 'Monarque de la Gênance' },
  { key: 'toxique', emoji: '🐍', label: 'Toxique', title: 'Serpent Officiel', low: { emoji: '😇', title: 'Ange du Groupe' } },
  { key: 'exces', emoji: '🍷', label: 'Excès', title: 'Foie en Danger', low: { emoji: '🥤', title: 'Capitaine de Soirée' } },
];
const KEYS = STATS.map((s) => s.key);

// "chaos:2 exces:1" ou { chaos: 2 } → { chaos: 2, exces: 1 } (null si vide / invalide)
function parseWeights(input) {
  const pairs = typeof input === 'string'
    ? input.trim().split(/[\s,]+/).filter(Boolean).map((p) => p.split(':'))
    : Object.entries(input || {});
  const out = {};
  for (const [k, v] of pairs) {
    const n = Math.round(Number(v));
    if (!KEYS.includes(k) || !Number.isFinite(n) || n === 0) continue;
    out[k] = Math.max(-3, Math.min(3, n));
  }
  return Object.keys(out).length ? out : null;
}

function tally(poll) {
  const counts = {};
  for (const target of Object.values(poll.votes)) counts[target] = (counts[target] || 0) + 1;
  return counts;
}

function winners(counts) {
  const entries = Object.entries(counts);
  if (!entries.length) return [];
  const max = Math.max(...entries.map(([, c]) => c));
  return entries.filter(([, c]) => c === max).map(([id]) => id);
}

function computeStats(db, now) {
  const players = {};
  for (const id of Object.keys(db.players)) {
    players[id] = { raw: Object.fromEntries(KEYS.map((k) => [k, 0])), value: {}, wins: [], polls: 0 };
  }

  for (const poll of Object.values(db.polls)) {
    if (poll.endsAt > now) continue;
    const counts = tally(poll);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (!total) continue;
    const q = db.questions[poll.questionId];
    const weights = q && q.weights;
    for (const [pid, c] of Object.entries(counts)) {
      const p = players[pid];
      if (!p) continue;
      p.polls++;
      if (weights) for (const [k, w] of Object.entries(weights)) p.raw[k] += (c / total) * w;
    }
    for (const pid of winners(counts)) if (players[pid]) players[pid].wins.push({ id: poll.id, text: poll.text, setId: poll.setId, endsAt: poll.endsAt });
  }

  // Normalisation 0–100 par rapport au max du groupe ; titres pour les extrêmes.
  const titles = [];
  const active = Object.entries(players).filter(([, p]) => p.polls > 0);
  for (const s of STATS) {
    const max = Math.max(0, ...active.map(([, p]) => p.raw[s.key]));
    for (const p of Object.values(players)) {
      p.value[s.key] = max > 0 ? Math.round(Math.max(0, p.raw[s.key] / max) * 100) : 0;
    }
    if (max > 0) {
      for (const [id, p] of active) if (p.raw[s.key] >= max - 1e-9) titles.push({ playerId: id, stat: s.key, emoji: s.emoji, title: s.title });
    }
    // Titre "du bas" : seulement s'il y a un seul dernier, net.
    if (s.low && active.length >= 3 && max > 0) {
      const min = Math.min(...active.map(([, p]) => p.raw[s.key]));
      const last = active.filter(([, p]) => p.raw[s.key] <= min + 1e-9);
      if (last.length === 1 && min < max) titles.push({ playerId: last[0][0], stat: s.key, emoji: s.low.emoji, title: s.low.title, low: true });
    }
  }

  for (const p of Object.values(players)) {
    for (const k of KEYS) p.raw[k] = Math.round(p.raw[k] * 100) / 100;
    p.wins.sort((a, b) => b.endsAt - a.endsAt);
  }
  return { players, titles };
}

module.exports = { STATS, KEYS, parseWeights, tally, winners, computeStats };
