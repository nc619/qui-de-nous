// Séries (« streaks ») : nombre de jours d'affilée où l'on a voté, par personne et pour tout le groupe.
// - Un jour compte s'il y a eu au moins une question ce jour-là (dans le fuseau du groupe). Les jours sans
//   question (réserve vide, planning en pause) ne cassent rien.
// - Perso : au moins un vote ce jour-là. Groupe : tout le monde (ceux qui avaient déjà rejoint) a voté ce jour-là.
// - Aujourd'hui n'est jamais « raté » tant que la journée n'est pas finie : la série tient jusqu'à minuit.
// Le jour d'un vote : son heure (enregistrée depuis cette version), sinon le jour où la question est tombée.
const { zonedParts } = require('./schedule');

const DAY = 24 * 3600 * 1000;

function dayKey(t, tz) {
  const p = zonedParts(t, tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

// Jours (clés triées) où au moins une question est tombée, jusqu'à aujourd'hui.
function activeDays(g, now) {
  const tz = g.settings.timezone;
  const days = new Set();
  for (const p of Object.values(g.polls)) if (p.startsAt <= now) days.add(dayKey(p.startsAt, tz));
  return [...days].sort();
}

// Jours où chaque membre a voté : Map(userId → Set(jour)).
function voteDays(g) {
  const tz = g.settings.timezone;
  const out = new Map();
  for (const p of Object.values(g.polls)) {
    for (const uid of Object.keys(p.votes)) {
      const t = (p.votedAt && p.votedAt[uid]) || p.startsAt;
      if (!out.has(uid)) out.set(uid, new Set());
      out.get(uid).add(dayKey(t, tz));
    }
  }
  return out;
}

// Série en cours et record, à partir de la liste des jours actifs et d'un test « ce jour-là est réussi ».
function run(days, today, ok) {
  let best = 0;
  let cur = 0;
  for (const d of days) {
    if (ok(d)) best = Math.max(best, ++cur);
    else if (d !== today) cur = 0;
  }
  // Série en cours : depuis la fin, aujourd'hui raté ne casse pas (la journée n'est pas finie).
  let current = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i];
    if (ok(d)) current++;
    else if (d === today) continue;
    else break;
  }
  return { current, best, today: days.includes(today) ? ok(today) : null };
}

function compute(g, now = Date.now()) {
  const tz = g.settings.timezone;
  const days = activeDays(g, now);
  const today = dayKey(now, tz);
  const votes = voteDays(g);
  const users = Object.values(g.users).filter((u) => !u.disabled && u.playerId);
  const players = {};
  for (const u of users) {
    const mine = votes.get(u.id) || new Set();
    players[u.playerId] = run(days, today, (d) => mine.has(d));
  }
  // Groupe : tous ceux qui avaient rejoint ce jour-là ont voté (au moins 2 personnes, sinon pas de série de groupe).
  const joined = users.map((u) => [u, dayKey(u.createdAt || 0, tz)]);
  const group = users.length >= 2
    ? run(days, today, (d) => {
      const here = joined.filter(([, j]) => j <= d);
      return here.length >= 2 && here.every(([u]) => (votes.get(u.id) || new Set()).has(d));
    })
    : { current: 0, best: 0, today: null };
  // Qui manque aujourd'hui pour que la série du groupe continue.
  const missing = group.today === false
    ? users.filter((u) => dayKey(u.createdAt || 0, tz) <= today && !(votes.get(u.id) || new Set()).has(today)).map((u) => u.playerId)
    : [];
  return { group: { ...group, missing }, players, today };
}

module.exports = { compute, dayKey, activeDays, voteDays, run, DAY };
