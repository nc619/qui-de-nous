// Récap du mois (façon « Wrapped ») : les chiffres du groupe et les tiens sur un mois (fuseau du groupe).
// Calculé à la demande à partir des sondages et du chat : rien de plus n'est stocké.
const chat = require('./chat');
const { tally, winners, ballot, consensus, STATS } = require('./stats');
const { dayKey, activeDays, voteDays, run } = require('./streaks');

const monthOf = (t, tz) => dayKey(t, tz).slice(0, 7);
const avg = (l) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : 0);
const r1 = (x) => Math.round(x * 10) / 10;

// Mois qui ont au moins un sondage terminé (les plus récents d'abord), et le mois en cours.
function months(g, now) {
  const tz = g.settings.timezone;
  const set = new Set();
  for (const p of Object.values(g.polls)) if (p.endsAt <= now && Object.keys(p.votes).length) set.add(monthOf(p.startsAt, tz));
  const current = monthOf(now, tz);
  return [...set].sort().reverse().map((m) => ({ month: m, partial: m === current }));
}

function top(map, n = 1) {
  return Object.entries(map).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, n);
}

function compute(g, month, me, now = Date.now()) {
  const tz = g.settings.timezone;
  const pid = (uid) => g.users[uid] && g.users[uid].playerId;
  const polls = Object.values(g.polls)
    .filter((p) => monthOf(p.startsAt, tz) === month && p.endsAt <= now && Object.keys(p.votes).length)
    .sort((a, b) => a.startsAt - b.startsAt);
  const members = Object.values(g.users).filter((u) => !u.disabled && u.playerId);
  const myPid = me.playerId;
  const q = (p) => g.questions[p.questionId] || {};
  const item = (p) => ({ id: p.id, text: p.text, textEn: q(p).textEn || null, setId: p.setId });

  // --- Votes ---
  const wins = {}; // playerId → nb de sondages gagnés
  const received = {};
  const fans = {}; // qui a voté pour moi
  const myTargets = {}; // pour qui j'ai voté
  const agree = {}; // playerId → [même vote, sondages en commun] avec moi
  const statRaw = Object.fromEntries(STATS.map((s) => [s.key, 0]));
  const unanimous = [];
  const split = [];
  const myWins = [];
  const delays = {}; // userId → minutes entre la question et le vote
  const night = {}; // userId → votes + messages entre minuit et 5 h
  let votes = 0;
  let selfVotes = 0;
  let myVotes = 0;
  for (const p of polls) {
    const counts = tally(p);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    votes += Object.keys(p.votes).length;
    const top_ = winners(counts);
    for (const w of top_) wins[w] = (wins[w] || 0) + 1;
    if (top_.includes(myPid)) myWins.push({ ...item(p), n: counts[myPid], total });
    for (const [t, c] of Object.entries(counts)) received[t] = (received[t] || 0) + c;
    const cons = consensus(p, p.members || members.length);
    if (cons && cons.kind === 'unanimous') unanimous.push({ ...item(p), target: cons.target, n: cons.n });
    if (cons && cons.kind === 'split') split.push({ ...item(p), n: cons.n });
    const weights = q(p).weights;
    if (weights && total && counts[myPid]) for (const [k, w] of Object.entries(weights)) statRaw[k] += (counts[myPid] / total) * w;
    const mine = p.votes[me.id];
    if (mine) myVotes++;
    for (const [uid, v] of Object.entries(p.votes)) {
      const voter = pid(uid);
      for (const [t, w] of ballot(v)) {
        if (t === myPid && voter && voter !== myPid) fans[voter] = (fans[voter] || 0) + w;
        if (uid === me.id && t !== 'nobody') {
          if (t === myPid) selfVotes += w;
          else myTargets[t] = (myTargets[t] || 0) + w;
        }
      }
      if (mine && uid !== me.id && voter) {
        const a = (agree[voter] ||= [0, 0]);
        const mb = new Map(ballot(mine));
        a[0] += ballot(v).reduce((s, [t, w]) => s + Math.min(w, mb.get(t) || 0), 0);
        a[1]++;
      }
      const at = p.votedAt && p.votedAt[uid];
      if (at) {
        (delays[uid] ||= []).push((at - p.startsAt) / 60000);
        if (new Date(at).toLocaleString('en-GB', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }) < 5) night[uid] = (night[uid] || 0) + 1;
      }
    }
  }

  // --- Notes ---
  const rated = polls
    .map((p) => {
      const notes = Object.values(q(p).ratings || {});
      return { ...item(p), avg: r1(avg(notes)), n: notes.length, custom: !q(p).builtin, author: q(p).authorId ? pid(q(p).authorId) : null };
    })
    .filter((x) => x.n >= 2)
    .sort((a, b) => b.avg - a.avg || b.n - a.n);
  const bySet = {};
  for (const p of polls) bySet[p.setId] = (bySet[p.setId] || 0) + 1;

  // --- Chat (chat du groupe + discussions des questions terminées) ---
  const chatCount = {};
  const reactsGot = {};
  let messages = 0;
  let bestMsg = null;
  for (const channel of chat.channels(g.id)) {
    if (channel !== 'general' && !(g.polls[channel] && g.polls[channel].endsAt <= now)) continue;
    for (const m of chat.list(g.id, channel)) {
      if (m.deleted || monthOf(m.at, tz) !== month) continue;
      messages++;
      chatCount[m.userId] = (chatCount[m.userId] || 0) + 1;
      const nr = Object.keys(m.reactions || {}).length;
      reactsGot[m.userId] = (reactsGot[m.userId] || 0) + nr;
      if (nr && (!bestMsg || nr > bestMsg.reactions)) {
        bestMsg = { playerId: pid(m.userId), kind: m.kind, text: m.kind === 'text' ? String(m.text).slice(0, 140) : null, reactions: nr, emojis: [...new Set(Object.values(m.reactions))].slice(0, 4) };
      }
      if (new Date(m.at).toLocaleString('en-GB', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }) < 5) night[m.userId] = (night[m.userId] || 0) + 1;
    }
  }
  const byPlayer = (map) => Object.fromEntries(Object.entries(map).map(([uid, v]) => [pid(uid), v]).filter(([p]) => p));

  // --- Séries sur le mois ---
  const days = activeDays(g, now).filter((d) => d.slice(0, 7) === month);
  const vd = voteDays(g);
  const myStreak = run(days, null, (d) => (vd.get(me.id) || new Set()).has(d)).best;
  const groupStreak = members.length >= 2
    ? run(days, null, (d) => {
      const here = members.filter((u) => dayKey(u.createdAt || 0, tz) <= d);
      return here.length >= 2 && here.every((u) => (vd.get(u.id) || new Set()).has(d));
    }).best
    : 0;

  // --- Vitesse de vote ---
  const speed = Object.entries(delays).filter(([, l]) => l.length >= 3).map(([uid, l]) => [pid(uid), Math.round(avg(l))]).filter(([p]) => p).sort((a, b) => a[1] - b[1]);

  // Stat du mois : celle où on a le plus « marqué » (parts de votes × poids des questions).
  const topStat = top(statRaw)[0];
  const twins = Object.entries(agree).filter(([, [, n]]) => n >= 3).map(([p, [s, n]]) => [p, Math.round((s / n) * 100)]).sort((a, b) => b[1] - a[1]);
  const rankOf = (map) => {
    const sorted = top(map, 99).map(([p]) => p);
    const i = sorted.indexOf(myPid);
    return i < 0 ? null : i + 1;
  };

  return {
    month,
    partial: monthOf(now, tz) === month,
    group: {
      polls: polls.length,
      votes,
      members: members.length,
      participation: polls.length ? Math.round((votes / (polls.length * Math.max(1, members.length))) * 100) : 0,
      mvp: top(wins, 3),
      mostVoted: top(received, 3).map(([p, v]) => [p, r1(v)]),
      unanimous: unanimous.slice(-5).reverse(),
      unanimousCount: unanimous.length,
      split: split.length,
      splitExample: split.length ? split[split.length - 1] : null,
      bestQuestion: rated[0] || null,
      worstQuestion: rated.length > 1 ? rated[rated.length - 1] : null,
      bestCustom: rated.find((x) => x.custom && x.author) || null,
      topSet: top(bySet)[0] || null,
      messages,
      topChatter: top(byPlayer(chatCount), 3),
      bestMsg,
      nightOwl: top(byPlayer(night))[0] || null,
      fastest: speed[0] || null,
      slowest: speed.length > 1 ? speed[speed.length - 1] : null,
      streak: groupStreak,
      days: days.length,
    },
    me: {
      voted: myVotes,
      wins: myWins.length,
      winList: myWins.slice(-8).reverse(),
      winRank: rankOf(wins),
      received: r1(received[myPid] || 0),
      receivedRank: rankOf(received),
      unanimous: unanimous.filter((u) => u.target === myPid),
      fan: top(fans)[0] ? [top(fans)[0][0], r1(top(fans)[0][1])] : null,
      target: top(myTargets)[0] ? [top(myTargets)[0][0], r1(top(myTargets)[0][1])] : null,
      twin: twins[0] || null,
      selfVotes: r1(selfVotes),
      topStat: topStat ? topStat[0] : null,
      streak: myStreak,
      messages: chatCount[me.id] || 0,
      reactions: reactsGot[me.id] || 0,
      speed: (speed.find(([p]) => p === myPid) || [])[1] ?? null,
    },
  };
}

module.exports = { compute, months, monthOf };
