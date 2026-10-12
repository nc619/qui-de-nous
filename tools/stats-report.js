// Rapport d'analyse des stats (fichier HTML local, rien n'est envoyé nulle part).
// Usage :  node tools/stats-report.js [fichier]      (par défaut data/export.json, sinon data/db.json)
// Écrit data/stats-report.html : stabilité des stats (ancienne / nouvelle méthode), points donnés par chaque
// question, couverture des stats, notes, participation, questions lancées à la main.
const fs = require('fs');
const path = require('path');
const { scoreDetail, toValue, PRIOR, STATS, KEYS, tally, winners, ballot, consensus } = require('../lib/stats');

const DATA = path.join(__dirname, '..', 'data');
const input = process.argv[2] || [path.join(DATA, 'export.json'), path.join(DATA, 'db.json')].find((f) => fs.existsSync(f));
if (!input) {
  console.error('Aucune donnée : lance d’abord tools/export-db.js (ou donne un fichier).');
  process.exit(1);
}
const raw = JSON.parse(fs.readFileSync(input, 'utf8'));
const groups = raw.groups ? Object.values(raw.groups) : [{ name: 'Groupe', settings: raw.settings || {}, ...raw }];
const OUT = path.join(DATA, 'stats-report.html');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r1 = (x) => Math.round(x * 10) / 10;
const DAY = 86400000;
const dayStr = (t, tz) => new Date(t).toLocaleDateString('fr-CA', { timeZone: tz || 'Europe/Paris' });

// Les 3 méthodes à un instant donné : ancienne (part × poids, / max du groupe), nouvelle (écart à la part normale,
// moyenne avec a priori, 50 = moyenne), et ancienne lissée (EMA, calculée ensuite jour par jour).
function valuesAt(g, t) {
  const { acc, den } = scoreDetail(g, t);
  const old = {};
  const neu = {};
  for (const k of KEYS) {
    const max = Math.max(0, ...Object.values(acc).map((a) => a.legacy[k] || 0));
    for (const [id, a] of Object.entries(acc)) {
      (old[id] ||= {})[k] = max > 0 ? Math.round(Math.max(0, (a.legacy[k] || 0) / max) * 100) : 0;
      (neu[id] ||= {})[k] = toValue((a.num[k] || 0) / ((den[k] || 0) + PRIOR));
    }
  }
  return { old, neu };
}

function series(g) {
  const ended = Object.values(g.polls).filter((p) => Object.keys(p.votes).length).sort((a, b) => a.endsAt - b.endsAt);
  if (!ended.length) return null;
  const tz = g.settings && g.settings.timezone;
  const now = Date.now();
  const start = ended[0].endsAt;
  const days = [];
  for (let t = start; t <= now + DAY; t += DAY) {
    const d = dayStr(Math.min(t, now), tz);
    if (!days.length || days[days.length - 1].d !== d) days.push({ d, t: Math.min(t, now) });
  }
  const pts = days.map(({ d, t }) => ({ d, ...valuesAt(g, t) }));
  // EMA de l'ancienne méthode (α = 0,35 par jour)
  const ema = {};
  for (const p of pts) {
    p.ema = {};
    for (const [id, vals] of Object.entries(p.old)) {
      p.ema[id] = {};
      for (const k of KEYS) {
        const prev = ema[id + k];
        const v = prev == null ? vals[k] : prev + 0.35 * (vals[k] - prev);
        ema[id + k] = v;
        p.ema[id][k] = Math.round(v);
      }
    }
  }
  return pts;
}

// Instabilité : variation moyenne d'un jour à l'autre (points sur 100), par méthode et par stat.
function jitter(pts, players) {
  const out = {};
  for (const m of ['old', 'ema', 'neu']) {
    out[m] = {};
    for (const k of KEYS) {
      let s = 0;
      let n = 0;
      for (let i = 1; i < pts.length; i++) {
        for (const id of players) {
          s += Math.abs(pts[i][m][id][k] - pts[i - 1][m][id][k]);
          n++;
        }
      }
      out[m][k] = n ? r1(s / n) : 0;
    }
  }
  return out;
}

// Petite courbe SVG (2 séries : ancienne / nouvelle) avec une bulle native au survol de chaque point.
function spark(pts, id, k, w = 150, h = 54) {
  const x = (i) => (pts.length < 2 ? w / 2 : 4 + (i * (w - 8)) / (pts.length - 1));
  const y = (v) => h - 4 - (v / 100) * (h - 8);
  const line = (m, cls) => `<polyline class="${cls}" points="${pts.map((p, i) => `${x(i).toFixed(1)},${y(p[m][id][k]).toFixed(1)}`).join(' ')}"/>`;
  const dots = pts.map((p, i) => `<rect class="hit" x="${(x(i) - 5).toFixed(1)}" y="0" width="10" height="${h}"><title>${p.d}\nancienne ${p.old[id][k]} · lissée ${p.ema[id][k]} · nouvelle ${p.neu[id][k]}</title></rect>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" class="spark"><line class="mid" x1="0" x2="${w}" y1="${y(50)}" y2="${y(50)}"/>${line('old', 's-old')}${line('ema', 's-ema')}${line('neu', 's-new')}${dots}</svg>`;
}

function groupReport(g) {
  const tz = g.settings && g.settings.timezone;
  const players = Object.values(g.players).sort((a, b) => a.createdAt - b.createdAt);
  const name = (id) => (id === 'nobody' ? 'Personne' : (g.players[id] || { name: '?' }).name);
  const color = (id) => (g.players[id] || {}).color || '#999';
  const pidOf = (uid) => g.users[uid] && g.users[uid].playerId;
  const polls = Object.values(g.polls).filter((p) => p.endsAt <= Date.now() && Object.keys(p.votes).length).sort((a, b) => b.endsAt - a.endsAt);
  const members = Object.values(g.users || {}).filter((u) => !u.disabled).length;
  const pts = series(g);
  const active = players.filter((p) => polls.some((x) => tally(x)[p.id])).map((p) => p.id);
  let html = `<section class="group"><h2>${esc(g.name)}</h2>
    <p class="muted">${players.length} personnes (${players.filter((p) => p.userId).length} ont rejoint) · ${Object.keys(g.polls).length} sondages, ${polls.length} terminés avec des votes · réglages : une question toutes les ${g.settings.intervalHours} h, ${g.settings.startHour} h → ${g.settings.endHour} h</p>`;

  // --- 1. Stabilité ---
  if (pts && pts.length) {
    const j = jitter(pts, active);
    const avg = (m) => r1(KEYS.reduce((a, k) => a + j[m][k], 0) / KEYS.length);
    html += `<h3>1. Stabilité des stats</h3>
      <p>Variation moyenne d’un jour à l’autre (sur 100) : plus c’est bas, moins ça saute. <b>Ancienne</b> = part des votes × poids, divisée par le premier du groupe (en service jusqu’ici). <b>Lissée</b> = ancienne + moyenne mobile exponentielle (α 0,35/jour). <b>Nouvelle</b> = écart à la part « normale », moyenne avec un a priori (${PRIOR}), 50 = moyenne du groupe (en service à partir de cette version).</p>
      <table class="num"><tr><th>Méthode</th>${STATS.map((s) => `<th>${s.emoji} ${esc(s.label)}</th>`).join('')}<th>Moyenne</th></tr>
      ${[['old', 'Ancienne'], ['ema', 'Lissée (EMA)'], ['neu', 'Nouvelle']].map(([m, l]) => `<tr><td><span class="key k-${m}"></span>${l}</td>${KEYS.map((k) => `<td>${j[m][k]}</td>`).join('')}<td><b>${avg(m)}</b></td></tr>`).join('')}</table>
      <p class="legend"><span class="key k-old"></span>ancienne <span class="key k-ema"></span>lissée <span class="key k-new"></span>nouvelle · ligne pointillée = 50 · survole un point pour les valeurs du jour</p>
      ${STATS.map((s) => `<h4>${s.emoji} ${esc(s.label)}</h4><div class="grid">${active.map((id) => `<div class="cell"><div class="who"><i style="background:${esc(color(id))}"></i>${esc(name(id))}</div>${spark(pts, id, s.key)}<div class="muted small">aujourd’hui : ${pts.at(-1).old[id][s.key]} → <b>${pts.at(-1).neu[id][s.key]}</b></div></div>`).join('')}</div>`).join('')}`;
  }

  // --- 2. Points par question ---
  html += `<h3>2. Ce que chaque question a donné</h3>
    <p>Pour chaque sondage terminé : les poids de la question, la répartition des votes, et qui a « gagné » le plus de points par stat (part des votes × poids). Barre = votes, une couleur par personne.</p>
    <table class="q"><tr><th>Date</th><th>Question</th><th>Poids</th><th>Votes</th><th>Répartition</th><th>Points (meilleur)</th><th>Note</th></tr>
    ${polls.map((p) => {
      const q = g.questions[p.questionId] || {};
      const counts = tally(p);
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const cons = consensus(p, members);
      const notes = Object.values(q.ratings || {});
      const pointsCell = q.weights ? Object.entries(q.weights).map(([k, w]) => {
        const best = sorted[0];
        const s = STATS.find((x) => x.key === k);
        return `<span class="chip">${s ? s.emoji : k} ${w > 0 ? '+' : ''}${w} → ${esc(name(best[0]))} ${r1((best[1] / total) * w * (cons && cons.kind === 'unanimous' ? 1.5 : 1))}</span>`;
      }).join(' ') : '<span class="muted">pas de poids</span>';
      return `<tr><td class="small">${dayStr(p.startsAt, tz)}</td><td>${esc(p.text)}${q.builtin ? '' : ' <span class="tag">perso</span>'}${cons ? ` <span class="tag">${cons.kind === 'unanimous' ? '👑 unanimité' : '🌪️ zéro consensus'}</span>` : ''}</td>
        <td class="small">${q.weights ? Object.entries(q.weights).map(([k, w]) => `${k}:${w}`).join(' ') : '—'}</td>
        <td class="num">${Object.keys(p.votes).length}</td>
        <td><div class="bar">${sorted.map(([id, c]) => `<span style="flex:${c};background:${esc(color(id))}" title="${esc(name(id))} : ${c}"></span>`).join('')}</div><div class="small muted">${sorted.slice(0, 3).map(([id, c]) => `${esc(name(id))} ${c}`).join(' · ')}</div></td>
        <td>${pointsCell}</td><td class="num">${notes.length ? `${r1(notes.reduce((a, b) => a + b, 0) / notes.length)} (${notes.length})` : '—'}</td></tr>`;
    }).join('')}</table>`;

  // --- 3. Couverture des stats ---
  const cover = Object.fromEntries(KEYS.map((k) => [k, { n: 0, pos: 0, neg: 0, sum: 0 }]));
  for (const p of polls) {
    const w = (g.questions[p.questionId] || {}).weights;
    if (!w) continue;
    for (const [k, v] of Object.entries(w)) {
      if (!cover[k]) continue;
      cover[k].n++;
      cover[k].sum += Math.abs(v);
      if (v > 0) cover[k].pos++;
      else cover[k].neg++;
    }
  }
  const maxSum = Math.max(1, ...Object.values(cover).map((c) => c.sum));
  html += `<h3>3. Combien chaque stat a été « nourrie »</h3>
    <p>Une stat avec peu de questions bouge beaucoup à chaque nouvelle question. Somme des poids (valeur absolue) sur les sondages terminés.</p>
    <table class="num"><tr><th>Stat</th><th>Questions</th><th>+ / −</th><th>Somme des poids</th><th></th></tr>
    ${STATS.map((s) => `<tr><td>${s.emoji} ${esc(s.label)}</td><td>${cover[s.key].n}</td><td>${cover[s.key].pos} / ${cover[s.key].neg}</td><td>${cover[s.key].sum}</td><td class="wide"><div class="hbar"><span style="width:${((cover[s.key].sum / maxSum) * 100).toFixed(1)}%"></span></div></td></tr>`).join('')}</table>`;

  // --- 4. Notes ---
  const bySet = {};
  const rated = [];
  for (const q of Object.values(g.questions)) {
    const notes = Object.values(q.ratings || {});
    if (!notes.length) continue;
    const avg = notes.reduce((a, b) => a + b, 0) / notes.length;
    rated.push({ q, avg, n: notes.length });
    (bySet[q.setId] ||= []).push(...notes);
  }
  rated.sort((a, b) => b.avg - a.avg || b.n - a.n);
  const setRows = Object.entries(bySet).map(([id, l]) => ({ id, name: (g.sets[id] || {}).name || id, avg: l.reduce((a, b) => a + b, 0) / l.length, n: l.length })).sort((a, b) => b.avg - a.avg);
  html += `<h3>4. Notes des questions (${rated.reduce((a, r) => a + r.n, 0)} notes)</h3>
    <div class="two"><div><h4>Par set</h4><table class="num"><tr><th>Set</th><th>Moyenne</th><th>Notes</th><th></th></tr>${setRows.map((s) => `<tr><td>${esc(s.name)}</td><td>${r1(s.avg)}</td><td>${s.n}</td><td class="wide"><div class="hbar"><span style="width:${(s.avg / 5) * 100}%"></span></div></td></tr>`).join('')}</table></div>
    <div><h4>Les mieux et les moins bien notées</h4><table><tr><th>Question</th><th>Note</th></tr>${[...rated.slice(0, 10), ...(rated.length > 20 ? rated.slice(-10) : [])].map((r) => `<tr><td>${esc(r.q.text)}</td><td class="num">${r1(r.avg)} (${r.n})</td></tr>`).join('')}</table></div></div>`;

  // --- 5. Participation ---
  const part = players.map((p) => {
    const uid = p.userId;
    let voted = 0;
    let half = 0;
    let self = 0;
    let nobody = 0;
    const delays = [];
    for (const poll of polls) {
      const v = uid && poll.votes[uid];
      if (!v) continue;
      voted++;
      if (Array.isArray(v)) half++;
      for (const [t, w] of ballot(v)) {
        if (t === p.id) self += w;
        if (t === 'nobody') nobody++;
      }
      if (poll.votedAt && poll.votedAt[uid]) delays.push((poll.votedAt[uid] - poll.startsAt) / 60000);
    }
    const wins = polls.filter((x) => winners(tally(x)).includes(p.id)).length;
    const got = polls.reduce((a, x) => a + (tally(x)[p.id] || 0), 0);
    delays.sort((a, b) => a - b);
    return { p, voted, half, self, nobody, wins, got, delay: delays.length ? Math.round(delays[Math.floor(delays.length / 2)]) : null };
  });
  html += `<h3>5. Participation</h3><table class="num"><tr><th>Personne</th><th>A rejoint</th><th>A voté</th><th>Demi-votes</th><th>Pour soi</th><th>« Personne »</th><th>Votes reçus</th><th>En tête</th><th>Délai médian (min)</th></tr>
    ${part.map((r) => `<tr><td><i class="dot" style="background:${esc(r.p.color)}"></i>${esc(r.p.name)}</td><td>${r.p.userId ? 'oui' : '<b>non</b>'}</td><td>${r.voted}/${polls.length}</td><td>${r.half}</td><td>${r1(r.self)}</td><td>${r.nobody}</td><td>${r1(r.got)}</td><td>${r.wins}</td><td>${r.delay ?? '—'}</td></tr>`).join('')}</table>`;

  // --- 6. Questions lancées à la main ---
  const manual = Object.values(g.polls).filter((p) => p.source === 'manual').sort((a, b) => b.startsAt - a.startsAt);
  html += `<h3>6. Questions lancées à la main (${manual.length})</h3>
    <p>Pour vérifier « ma question n’est pas celle que j’ai écrite » : une question <b>surprise</b> lancée par quelqu’un qui voulait écrire la sienne aurait l’air d’une erreur. Avant cette version, le bouton « Question surprise » était juste au-dessus de la case à écrire.</p>
    <table><tr><th>Date</th><th>Par</th><th>Type</th><th>Question</th></tr>${manual.map((p) => {
      const q = g.questions[p.questionId] || {};
      const own = !q.builtin && q.authorId === p.droppedBy;
      return `<tr><td class="small">${new Date(p.startsAt).toLocaleString('fr-FR', { timeZone: tz })}</td><td>${esc(name(pidOf(p.droppedBy)))}</td><td>${own ? 'écrite' : q.builtin ? 'surprise' : 'écrite par ' + esc(name(pidOf(q.authorId)))}</td><td>${esc(p.text)}${q.text && q.text !== p.text ? ` <span class="tag">≠ texte actuel : ${esc(q.text)}</span>` : ''}</td></tr>`;
    }).join('')}</table>`;

  return html + '</section>';
}

const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Stats — Qui de nous ?</title>
<style>
:root { --bg:#fcfcfb; --card:#fff; --text:#0b0b0b; --muted:#52514e; --line:#e6e4df; --s1:#2a78d6; --s2:#eb6834; --s3:#1baf7a; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root { --bg:#1a1a19; --card:#232322; --text:#fff; --muted:#c3c2b7; --line:#3a3936; --s1:#3987e5; --s2:#d95926; --s3:#199e70; color-scheme: dark; } }
body { font: 14px/1.45 system-ui, -apple-system, Segoe UI, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 16px; }
main { max-width: 1200px; margin: 0 auto; }
h1 { margin: 0 0 4px; } h2 { margin: 32px 0 4px; border-top: 2px solid var(--line); padding-top: 18px; } h3 { margin: 26px 0 6px; } h4 { margin: 14px 0 6px; }
.muted { color: var(--muted); } .small { font-size: 12px; }
table { border-collapse: collapse; width: 100%; margin: 6px 0 12px; background: var(--card); }
th, td { border-bottom: 1px solid var(--line); padding: 6px 8px; text-align: left; vertical-align: top; }
th { font-weight: 600; color: var(--muted); font-size: 12px; }
table.num td, td.num { font-variant-numeric: tabular-nums; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px; }
.cell { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 6px 8px; }
.who { font-weight: 600; font-size: 12px; display: flex; align-items: center; gap: 6px; }
.who i, .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 4px; }
.spark { width: 100%; height: 54px; display: block; }
.spark polyline { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.s-old { stroke: var(--s2); } .s-ema { stroke: var(--s3); stroke-dasharray: 3 3; } .s-new { stroke: var(--s1); }
.spark .mid { stroke: var(--line); stroke-dasharray: 2 3; }
.spark .hit { fill: transparent; } .spark .hit:hover { fill: rgba(127,127,127,0.12); }
.key { display: inline-block; width: 16px; height: 3px; border-radius: 2px; vertical-align: middle; margin: 0 6px 0 10px; }
.k-old { background: var(--s2); } .k-ema { background: var(--s3); } .k-new, .k-neu { background: var(--s1); }
.legend { font-size: 12px; color: var(--muted); }
.bar { display: flex; height: 12px; gap: 2px; min-width: 140px; } .bar span { border-radius: 2px; }
.hbar { height: 8px; background: var(--line); border-radius: 4px; overflow: hidden; min-width: 120px; } .hbar span { display: block; height: 100%; background: var(--s1); border-radius: 4px; }
td.wide { width: 30%; }
.chip { display: inline-block; border: 1px solid var(--line); border-radius: 999px; padding: 1px 8px; font-size: 12px; margin: 1px 0; }
.tag { font-size: 11px; color: var(--muted); border: 1px solid var(--line); border-radius: 4px; padding: 0 4px; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; } @media (max-width: 800px) { .two { grid-template-columns: 1fr; } }
</style></head><body><main>
<h1>Stats — Qui de nous ?</h1>
<p class="muted">Données : ${esc(path.basename(input))} · généré le ${new Date().toLocaleString('fr-FR')}</p>
${groups.filter((g) => g.polls && Object.keys(g.polls).length).sort((a, b) => Object.keys(b.polls).length - Object.keys(a.polls).length).map(groupReport).join('')}
</main></body></html>`;

fs.mkdirSync(DATA, { recursive: true });
fs.writeFileSync(OUT, page);
console.log('OK → ' + OUT);
