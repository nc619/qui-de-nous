// Groupe de démo pour la relecture App Store / Google Play (le relecteur le rejoint avec son code).
//   node scripts/demo-group.js https://qui-de-nous-bpbr.onrender.com
// 1re fois : crée le groupe et 7 faux membres (tokens gardés dans data/demo-group.json, jamais publié).
// Chaque lancement : fait tomber 2 questions, les faux membres votent et discutent un peu.
// À relancer la veille de chaque envoi en relecture, pour que le groupe ait des questions en cours.
const fs = require('fs');
const path = require('path');

const SERVER = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const FILE = path.join(__dirname, '..', 'data', 'demo-group.json');
const NAMES = ['Alex', 'Sam', 'Jordan', 'Robin', 'Charlie', 'Morgan', 'Eden', 'Kim'];
const LINES = [
  ['Évidemment 😂', 'Obviously 😂'],
  ['Je savais que ce serait lui', 'Knew it'],
  ['Vous êtes durs…', 'You guys are harsh…'],
  ['100% d’accord', '100% agree'],
  ['Je retire rien 💅', 'I stand by it 💅'],
  ['Qui vient ce week-end ?', 'Who’s around this weekend?'],
];

const call = async (method, url, body, token, group) => {
  const r = await fetch(`${SERVER}/api/${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(group ? { 'X-Group': group } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${url} → ${r.status} ${j.error || ''}`);
  return j;
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];

(async () => {
  let demo = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : null;
  if (demo && demo.server !== SERVER) throw new Error(`data/demo-group.json est pour ${demo.server}`);
  if (!demo) {
    const admin = await call('POST', 'accounts', { lang: 'en' });
    const g = await call('POST', 'groups', { groupName: 'Demo', name: NAMES[0], timezone: 'Europe/Paris' }, admin.token);
    await call('POST', 'admin/players', { names: NAMES.slice(1).join('\n') }, admin.token, g.groupId);
    const st = await call('GET', 'state', null, admin.token, g.groupId);
    const tokens = [admin.token];
    // Le dernier nom reste libre : c'est celui que le relecteur choisira (ou il en tape un nouveau).
    for (const n of NAMES.slice(1, -1)) {
      const a = await call('POST', 'accounts', { lang: 'en' });
      await call('POST', 'groups/join', { code: g.code, playerId: st.players.find((p) => p.name === n).id }, a.token);
      tokens.push(a.token);
    }
    demo = { server: SERVER, groupId: g.groupId, code: g.code, tokens };
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(demo, null, 2));
    console.log('Groupe de démo créé.');
  }
  const { groupId: G, tokens } = demo;
  for (let i = 0; i < 2; i++) await call('POST', 'admin/drop-auto', {}, tokens[0], G).catch((e) => console.log('drop :', e.message));
  for (const t of tokens) {
    const st = await call('GET', 'state', null, t, G);
    const others = st.players.map((p) => p.id);
    for (const poll of st.live || st.polls || []) {
      if (poll.myVote || Math.random() < 0.15) continue;
      await call('POST', `polls/${poll.id}/vote`, { playerId: pick(others) }, t, G).catch(() => {});
    }
  }
  const st = await call('GET', 'state', null, tokens[0], G);
  const live = (st.live || st.polls || [])[0];
  for (let i = 0; i < 3; i++) {
    const [fr, en] = pick(LINES);
    const ch = live && i < 2 ? live.id : 'general';
    await call('POST', `chat/${ch}`, { text: Math.random() < 0.5 ? en : fr }, pick(tokens), G).catch(() => {});
  }
  console.log(`Code du groupe de démo : ${demo.code}  (à mettre dans les notes pour la relecture)`);
})().catch((e) => { console.error(e.message); process.exit(1); });
