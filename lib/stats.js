// Stats de personnalité : chaque question a des poids, chaque sondage terminé distribue ces poids
// aux joueurs selon la part de votes reçus.

// Ordre = ordre des axes du radar (Cœur face à Toxique).
const STATS = [
  { key: 'chaos', emoji: '🔥', label: 'Chaos', title: 'Agent du Chaos', en: { label: 'Chaos', title: 'Agent of Chaos' } },
  { key: 'hot', emoji: '💋', label: 'Hot', title: 'Bombe Atomique', en: { label: 'Hot', title: 'Total Smokeshow' } },
  { key: 'coeur', emoji: '💖', label: 'Cœur', title: 'Meilleur Pote', low: { emoji: '🪨', title: 'Cœur de Pierre', en: 'Heart of Stone' }, en: { label: 'Heart', title: 'Best Mate' } },
  { key: 'cerveau', emoji: '🧠', label: 'Cerveau', title: 'Le Cerveau', low: { emoji: '🫠', title: 'Neurone Solitaire', en: 'Lonely Brain Cell' }, en: { label: 'Brain', title: 'The Brain' } },
  { key: 'genance', emoji: '🤡', label: 'Gênance', title: 'Monarque de la Gênance', en: { label: 'Cringe', title: 'Cringe Royalty' } },
  { key: 'toxique', emoji: '🐍', label: 'Toxique', title: 'Serpent Officiel', en: { label: 'Toxic', title: 'Certified Snake' } },
  { key: 'exces', emoji: '🍷', label: 'Excès', title: 'Foie en Danger', low: { emoji: '🥤', title: 'Capitaine de Soirée', en: 'Designated Driver' }, en: { label: 'Excess', title: 'Liver in Danger' } },
];
const KEYS = STATS.map((s) => s.key);

// Les titres ne sont attribués qu'une fois 5 sondages terminés dans le groupe (avant, c'est du bruit).
const MIN_TITLE_POLLS = 5;

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

// Un vote : "playerId" (vote entier) ou ["a", "b"] / ["a"] (demi-votes, ½ chacun, quand on hésite).
function ballot(v) {
  if (Array.isArray(v)) return v.map((t) => [t, 0.5]);
  return v ? [[v, 1]] : [];
}
const isHalf = (v) => Array.isArray(v);

function tally(poll) {
  const counts = {};
  for (const v of Object.values(poll.votes)) for (const [t, w] of ballot(v)) counts[t] = (counts[t] || 0) + w;
  return counts;
}

// Consensus d'un sondage : « unanimous » si tout le groupe a voté pour la même personne (7/7, votes entiers),
// « split » si personne n'est d'accord (au moins 4 votes, tous pour des personnes différentes).
function consensus(poll, members) {
  const votes = Object.values(poll.votes);
  const n = votes.length;
  if (n < 3 || votes.some(isHalf)) return null;
  const targets = new Set(votes);
  if (targets.size === 1 && n >= Math.max(3, poll.members || members || 0)) return { kind: 'unanimous', target: votes[0], n };
  if (n >= 4 && targets.size === n) return { kind: 'split', n };
  return null;
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
    players[id] = { raw: Object.fromEntries(KEYS.map((k) => [k, 0])), value: {}, wins: [], unanimous: [], polls: 0 };
  }

  const members = Object.values(db.users || {}).filter((u) => !u.disabled).length;
  let ended = 0;
  for (const poll of Object.values(db.polls)) {
    if (poll.endsAt > now) continue;
    const counts = tally(poll);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (!total) continue;
    ended++;
    const q = db.questions[poll.questionId];
    const weights = q && q.weights;
    const cons = consensus(poll, members);
    // Unanimité : tout le monde d'accord sur toi → les stats de la question comptent 1,5 fois.
    const bonus = cons && cons.kind === 'unanimous' ? 1.5 : 1;
    for (const [pid, c] of Object.entries(counts)) {
      const p = players[pid];
      if (!p) continue;
      p.polls++;
      if (weights) for (const [k, w] of Object.entries(weights)) p.raw[k] += (c / total) * w * bonus;
    }
    const win = { id: poll.id, text: poll.text, textEn: (q && q.textEn) || null, setId: poll.setId, endsAt: poll.endsAt };
    for (const pid of winners(counts)) if (players[pid]) players[pid].wins.push(win);
    if (cons && cons.kind === 'unanimous' && players[cons.target]) players[cons.target].unanimous.push(win);
  }

  // Normalisation 0–100 par rapport au max du groupe ; titres pour les extrêmes.
  const titles = [];
  const active = Object.entries(players).filter(([, p]) => p.polls > 0);
  const eligible = ended >= MIN_TITLE_POLLS ? active : [];
  for (const s of STATS) {
    const max = Math.max(0, ...active.map(([, p]) => p.raw[s.key]));
    for (const p of Object.values(players)) {
      p.value[s.key] = max > 0 ? Math.round(Math.max(0, p.raw[s.key] / max) * 100) : 0;
    }
    // Titre "du haut" : le meilleur du groupe, s'il a assez joué.
    const top = Math.max(0, ...eligible.map(([, p]) => p.raw[s.key]));
    if (top > 0) {
      for (const [id, p] of eligible) if (p.raw[s.key] >= top - 1e-9) titles.push({ playerId: id, stat: s.key, emoji: s.emoji, title: s.title, titleEn: s.en.title });
    }
    // Titre "du bas" : seulement s'il y a un seul dernier, net.
    if (s.low && eligible.length >= 3 && top > 0) {
      const min = Math.min(...eligible.map(([, p]) => p.raw[s.key]));
      const last = eligible.filter(([, p]) => p.raw[s.key] <= min + 1e-9);
      if (last.length === 1 && min < top) titles.push({ playerId: last[0][0], stat: s.key, emoji: s.low.emoji, title: s.low.title, titleEn: s.low.en, low: true });
    }
  }

  for (const p of Object.values(players)) {
    for (const k of KEYS) p.raw[k] = Math.round(p.raw[k] * 100) / 100;
    p.wins.sort((a, b) => b.endsAt - a.endsAt);
    p.unanimous.sort((a, b) => b.endsAt - a.endsAt);
  }
  return { players, titles, ended, titlesAt: MIN_TITLE_POLLS };
}


// Affinités entre les joueurs (sondages terminés seulement : ce sont ceux dont les votes sont visibles par tous).
// pairs[a][b] : given = votes de a pour b, common = sondages où a et b ont voté tous les deux,
// agree = à quel point ils ont voté pareil (somme sur ces sondages), co = sondages où ils ont reçu des votes tous les deux,
// sim = ressemblance de leurs « réputations » (cosinus entre leurs parts de votes reçues, sondage par sondage).
function computeAffinity(db, now) {
  const ids = Object.keys(db.players);
  const players = Object.fromEntries(ids.map((id) => [id, { voted: 0, toWinner: 0, self: 0, received: 0 }]));
  const pairs = Object.fromEntries(ids.map((a) => [a, Object.fromEntries(ids.filter((b) => b !== a).map((b) => [b, { given: 0, agree: 0, common: 0, co: 0, sim: null }]))]));
  const shares = Object.fromEntries(ids.map((id) => [id, []])); // [index du sondage, part des votes]
  let n = 0;
  for (const poll of Object.values(db.polls)) {
    if (poll.endsAt > now) continue;
    const counts = tally(poll);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (!total) continue;
    const top = new Set(winners(counts));
    const ballots = Object.entries(poll.votes)
      .map(([uid, v]) => [db.users[uid] && db.users[uid].playerId, new Map(ballot(v))])
      .filter(([pid]) => players[pid]);
    for (const [pid, b] of ballots) {
      const p = players[pid];
      p.voted++;
      for (const [t, w] of b) {
        if (top.has(t)) p.toWinner += w;
        if (t === pid) p.self += w;
        if (pairs[pid][t]) pairs[pid][t].given += w;
      }
    }
    for (let i = 0; i < ballots.length; i++) {
      for (let j = i + 1; j < ballots.length; j++) {
        const [a, ba] = ballots[i];
        const [b, bb] = ballots[j];
        if (a === b) continue;
        let same = 0;
        for (const [t, w] of ba) same += Math.min(w, bb.get(t) || 0);
        for (const [x, y] of [[a, b], [b, a]]) {
          pairs[x][y].common++;
          pairs[x][y].agree += same;
        }
      }
    }
    const got = Object.keys(counts).filter((id) => players[id]);
    for (const id of got) {
      players[id].received += counts[id];
      shares[id].push([n, counts[id] / total]);
      for (const other of got) if (other !== id) pairs[id][other].co++;
    }
    n++;
  }
  // Réputation : il faut au moins 3 sondages où l'un ou l'autre a reçu des votes.
  const norm = Object.fromEntries(ids.map((id) => [id, Math.sqrt(shares[id].reduce((a, [, x]) => a + x * x, 0))]));
  for (const a of ids) {
    const ma = new Map(shares[a]);
    for (const b of ids) {
      if (a >= b || !norm[a] || !norm[b]) continue;
      const seen = new Set([...shares[a], ...shares[b]].map(([i]) => i));
      if (seen.size < 3) continue;
      let dot = 0;
      for (const [i, x] of shares[b]) dot += x * (ma.get(i) || 0);
      const sim = Math.round((dot / (norm[a] * norm[b])) * 100);
      pairs[a][b].sim = sim;
      pairs[b][a].sim = sim;
    }
  }
  const r = (x) => Math.round(x * 10) / 10;
  for (const p of Object.values(players)) for (const k of ['toWinner', 'self', 'received']) p[k] = r(p[k]);
  for (const row of Object.values(pairs)) for (const c of Object.values(row)) { c.given = r(c.given); c.agree = r(c.agree); }
  return { polls: n, players, pairs };
}

// Stats du groupe : notes des questions (1 à 5), moments mémorables (unanimité / personne d'accord), chiffres en vrac.
function computeGroup(db, now) {
  const members = Object.values(db.users || {}).filter((u) => !u.disabled).length;
  const pid = (uid) => db.users[uid] && db.users[uid].playerId;
  const avg = (l) => Math.round((l.reduce((a, b) => a + b, 0) / l.length) * 10) / 10;
  const rated = [];
  const bySet = {};
  const raters = {};
  for (const q of Object.values(db.questions)) {
    const notes = Object.entries(q.ratings || {});
    if (!notes.length) continue;
    const vals = notes.map(([, n]) => n);
    rated.push({ id: q.id, text: q.text, textEn: q.textEn || null, setId: q.setId, avg: avg(vals), n: vals.length });
    (bySet[q.setId] ||= []).push(...vals);
    for (const [uid, n] of notes) {
      const p = pid(uid);
      if (p) (raters[p] ||= []).push(n);
    }
  }
  const ranked = rated.filter((q) => q.n >= 2);
  const top = [...ranked].sort((a, b) => b.avg - a.avg || b.n - a.n).slice(0, 5);
  const flop = [...ranked].sort((a, b) => a.avg - b.avg || b.n - a.n).filter((q) => !top.includes(q)).slice(0, 5);
  const sets = Object.entries(bySet).filter(([, l]) => l.length >= 3).map(([setId, l]) => ({ setId, avg: avg(l), n: l.length })).sort((a, b) => b.avg - a.avg);
  const raterList = Object.entries(raters).map(([playerId, l]) => ({ playerId, avg: avg(l), n: l.length })).filter((r) => r.n >= 3);

  const unanimous = [];
  const split = [];
  let ended = 0;
  let votes = 0;
  let halves = 0;
  let nobody = 0;
  for (const poll of Object.values(db.polls)) {
    if (poll.endsAt > now) continue;
    const vs = Object.values(poll.votes);
    if (!vs.length) continue;
    ended++;
    votes += vs.length;
    halves += vs.filter(isHalf).length;
    nobody += vs.filter((v) => ballot(v).some(([t]) => t === 'nobody')).length;
    const c = consensus(poll, members);
    const q = db.questions[poll.questionId];
    const item = { id: poll.id, text: poll.text, textEn: (q && q.textEn) || null, setId: poll.setId, endsAt: poll.endsAt, n: c && c.n };
    if (c && c.kind === 'unanimous') unanimous.push({ ...item, target: c.target });
    else if (c && c.kind === 'split') split.push(item);
  }
  unanimous.sort((a, b) => b.endsAt - a.endsAt);
  split.sort((a, b) => b.endsAt - a.endsAt);
  return {
    ratings: { count: rated.reduce((n, q) => n + q.n, 0), questions: rated.length, top, flop, sets, raters: raterList },
    unanimous: unanimous.slice(0, 30),
    split: split.slice(0, 30),
    counts: { ended, votes, halves, nobody, unanimous: unanimous.length, split: split.length },
  };
}

module.exports = { computeAffinity, computeGroup, STATS, KEYS, MIN_TITLE_POLLS, parseWeights, ballot, isHalf, tally, winners, consensus, computeStats };
