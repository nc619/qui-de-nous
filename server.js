// "Qui de nous ?" — sondages entre potes.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { store, load, persist, flush, newGroup, newCode } = require('./lib/store');
const { latestSlot, nextSlot, isValidTimezone, zonedParts } = require('./lib/schedule');
const { STATS, parseWeights, computeStats, computeAffinity, computeGroup, ballot, tally } = require('./lib/stats');
const push = require('./lib/push');
const game = require('./lib/game');
const chat = require('./lib/chat');
const photos = require('./lib/photos');
const live = require('./lib/live');
const gifs = require('./lib/gifs');
const images = require('./lib/images');
const i18n = require('./lib/i18n');
const { HttpError, newId, cleanText, COLORS, OLD_COLORS } = game;

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const ARCHIVE_PAGE = 30;

// Segments d'URL fixes ; tout autre segment est un identifiant (":id").
const WORDS = new Set([
  'health', 'groups', 'roster', 'join', 'login', 'logout', 'state', 'archive', 'me', 'polls', 'vote', 'drop',
  'sets', 'questions', 'push', 'subscribe', 'unsubscribe', 'admin', 'players', 'reset', 'settings', 'drop-auto',
  'unscored', 'scores', 'group', 'code', 'chat', 'read', 'typing', 'events', 'gifs', 'messages', 'presence', 'test', 'react', 'photos', 'photo',
  'images', 'image', 'rate', 'ratings',
]);

// Petit raccourci pour les textes envoyés aux gens (notifications) : français ou anglais selon leur réglage.
const tr = (lang, fr, en) => (lang === 'en' ? en : fr);

// Questions en plus lancées à la main (bouton +) : 3 par personne et par jour, remise à zéro à minuit
// dans le fuseau du groupe (Paris par défaut).
const DAILY_DROPS = 3;
const dayKey = (t, tz) => {
  const p = zonedParts(t, tz);
  return `${p.year}-${p.month}-${p.day}`;
};
function dropsLeft(g, userId, now) {
  const today = dayKey(now, g.settings.timezone);
  const used = ((g.dropLog || {})[userId] || []).filter((t) => dayKey(t, g.settings.timezone) === today).length;
  return Math.max(0, DAILY_DROPS - used);
}
function logDrop(g, userId, now) {
  g.dropLog ||= {};
  const today = dayKey(now, g.settings.timezone);
  g.dropLog[userId] = (g.dropLog[userId] || []).filter((t) => dayKey(t, g.settings.timezone) === today).concat(now);
}

// ---------- Utilitaires HTTP ----------

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function readBody(req, limit = 200000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new HttpError(413, 'Requête trop grosse'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'JSON invalide'));
      }
    });
    req.on('error', reject);
  });
}

// ---------- Groupes & comptes ----------

function groupByCode(code) {
  const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const g = c && Object.values(store.db.groups).find((x) => x.code === c);
  if (!g) throw new HttpError(404, 'Aucun groupe avec ce code 🤔');
  return g;
}

function hashPin(pin, salt) {
  return crypto.scryptSync(String(pin), salt, 32).toString('hex');
}

function checkPin(pin, user) {
  if (!user.pinHash) return false;
  const a = Buffer.from(hashPin(pin, user.salt), 'hex');
  const b = Buffer.from(user.pinHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function validPin(pin) {
  const p = String(pin || '');
  if (!/^\d{4,6}$/.test(p)) throw new HttpError(400, 'Le PIN doit contenir 4 à 6 chiffres');
  return p;
}

function cleanName(g, name, exceptId) {
  const n = cleanText(name, 2, 24, 'Le pseudo', 'The name');
  const taken = Object.values(g.players).find((p) => p.id !== exceptId && p.name.toLowerCase() === n.toLowerCase());
  if (taken) throw new HttpError(409, `« ${n} » est déjà pris`, `“${n}” is already taken`);
  return n;
}

function cleanEmoji(e) {
  return String(e || '😎').slice(0, 8);
}

function addPlayer(g, name) {
  const player = { id: newId(), name: cleanName(g, name), emoji: '🙂', color: game.freeColor(g), userId: null, createdAt: Date.now() };
  g.players[player.id] = player;
  return player;
}

function newUser(g, player, pin, isAdmin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const user = { id: newId(), playerId: player.id, salt, pinHash: hashPin(pin, salt), isAdmin, createdAt: Date.now() };
  g.users[user.id] = user;
  player.userId = user.id;
  return user;
}

function newSession(g, user) {
  const token = crypto.randomBytes(24).toString('hex');
  store.db.sessions[token] = { groupId: g.id, userId: user.id, createdAt: Date.now() };
  persist();
  return token;
}

// Limite simple des tentatives ratées (anti-devinette de code / PIN).
const failures = new Map();
function guarded(ip, fn) {
  const f = failures.get(ip);
  if (f && f.count >= 15 && Date.now() - f.since < 10 * 60 * 1000) throw new HttpError(429, 'Trop de tentatives. Réessaie dans quelques minutes.');
  try {
    return fn();
  } catch (e) {
    if ([401, 403, 404].includes(e.status)) {
      if (!f || Date.now() - f.since > 10 * 60 * 1000) failures.set(ip, { count: 1, since: Date.now() });
      else f.count++;
    }
    throw e;
  }
}

// Pas plus de 5 groupes créés par heure et par IP.
const creations = new Map();
function checkCreationRate(ip) {
  const now = Date.now();
  const list = (creations.get(ip) || []).filter((t) => now - t < 3600 * 1000);
  if (list.length >= 5) throw new HttpError(429, 'Trop de groupes créés, réessaie plus tard.');
  list.push(now);
  creations.set(ip, list);
}

// Couleur : celle choisie par la personne (unique dans le groupe). Animal par défaut : selon sa place dans la liste.
function publicPlayer(p, g) {
  const i = Math.max(0, game.byAge(g).indexOf(p));
  return {
    id: p.id, name: p.name, claimed: !!p.userId,
    color: p.color || COLORS[i % OLD_COLORS],
    animal: (i + Math.floor(i / OLD_COLORS) * 5) % 12,
    photo: p.photo || null,
  };
}

// ---------- Chat ----------

function checkChannel(g, channel) {
  if (channel === 'general' || g.polls[channel]) return channel;
  throw new HttpError(404, 'Discussion introuvable');
}

// Aperçu du message auquel on répond (affiché au-dessus de la réponse).
function replyView(g, m) {
  if (!m.replyTo) return undefined;
  const o = chat.get(g.id, m.replyTo);
  if (!o || o.channel !== m.channel) return undefined;
  return {
    id: o.seq,
    playerId: g.users[o.userId]?.playerId || null,
    kind: o.kind,
    text: o.deleted ? null : o.kind === 'text' ? short(o.text, 120) : null,
    deleted: !!o.deleted,
  };
}

function msgView(g, m) {
  return {
    id: m.seq,
    channel: m.channel,
    playerId: g.users[m.userId]?.playerId || null,
    kind: m.kind,
    text: m.text,
    gif: m.gif,
    image: m.image,
    reply: m.deleted ? undefined : replyView(g, m),
    mentions: m.deleted || !m.mentions ? undefined : m.mentions.map((uid) => g.users[uid]?.playerId).filter(Boolean),
    at: m.at,
    deleted: !!m.deleted,
    // Réactions : { playerId: emoji }
    reactions: m.deleted ? {} : Object.fromEntries(Object.entries(m.reactions || {}).map(([uid, e]) => [g.users[uid]?.playerId, e]).filter(([pid]) => pid)),
  };
}

// Réaction : un seul emoji (n'importe lequel, y compris avec couleur de peau, drapeaux, combinaisons).
const isReaction = (e) => e.length <= 24 && /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Modifier}|\p{Emoji_Component}|\u200d|\ufe0f|\u20e3)+$/u.test(e) && /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(e);

function readsOf(g, channel) {
  const out = {};
  for (const [userId, seq] of Object.entries((g.chatReads || {})[channel] || {})) {
    const pid = g.users[userId]?.playerId;
    if (pid) out[pid] = seq;
  }
  return out;
}

// La discussion d'une question en cours reste fermée tant qu'on n'a pas voté
// (on ne voit pas les messages, on ne peut pas écrire) : personne n'est influencé avant de voter.
function chatLocked(g, channel, userId) {
  if (channel === 'general') return false;
  const poll = g.polls[channel];
  return !!poll && poll.endsAt > Date.now() && !poll.votes[userId];
}

function checkUnlocked(g, channel, me) {
  if (chatLocked(g, channel, me.id)) throw new HttpError(403, 'Vote d’abord pour voir et écrire dans la discussion');
}

function chatSummary(g, me, channel, lastN) {
  const list = chat.list(g.id, channel).filter((m) => !m.deleted);
  const lastAt = list.length ? list[list.length - 1].at : 0;
  if (chatLocked(g, channel, me.id)) return { count: list.length, unread: 0, last: [], lastAt, locked: true };
  const read = ((g.chatReads || {})[channel] || {})[me.id] || 0;
  return {
    count: list.length,
    unread: list.filter((m) => m.seq > read && m.userId !== me.id).length,
    last: list.slice(-lastN).map((m) => msgView(g, m)),
    lastAt,
  };
}

// Vue d'un sondage + aperçu de sa discussion.
function pv(g, p, me, now) {
  return { ...game.pollView(g, p, me, now), chat: chatSummary(g, me, p.id, 2) };
}

// Liste des discussions : le chat général, puis les sondages EN COURS qui ont des messages (les plus récents d'abord).
// Quand un sondage se termine, sa discussion quitte l'onglet Chat : on la retrouve dans les Archives, sur le sondage.
function chatThreads(g, me, now = Date.now()) {
  const threads = [{ channel: 'general', ...chatSummary(g, me, 'general', 4) }];
  const polls = chat.channels(g.id)
    .filter((c) => c !== 'general' && g.polls[c] && g.polls[c].endsAt > now)
    .map((c) => ({ channel: c, text: g.polls[c].text, textEn: g.questions[g.polls[c].questionId]?.textEn || null, setId: g.polls[c].setId, ...chatSummary(g, me, c, 1) }))
    .filter((t) => t.count)
    .sort((a, b) => b.lastAt - a.lastAt)
    .slice(0, 40);
  return threads.concat(polls);
}

function markRead(g, channel, userId, seq) {
  g.chatReads ||= {};
  const reads = (g.chatReads[channel] ||= {});
  if ((reads[userId] || 0) >= seq) return false;
  reads[userId] = seq;
  persist();
  return true;
}

function short(s, n) {
  const a = Array.from(String(s || ''));
  return a.length > n ? a.slice(0, n - 1).join('') + '…' : a.join('');
}

const pollText = (g, poll, lang) => (lang === 'en' && g.questions[poll.questionId]?.textEn) || poll.text;

// Tags « @Prénom » dans un message → identifiants des comptes tagués (les noms peuvent contenir des espaces :
// on essaie les plus longs d'abord). Même règle côté client pour surligner.
function findMentions(g, text) {
  const low = String(text).toLowerCase();
  const found = new Set();
  const players = Object.values(g.players).filter((p) => p.userId).sort((a, b) => b.name.length - a.name.length);
  const taken = [];
  for (const p of players) {
    const needle = '@' + p.name.toLowerCase();
    let i = low.indexOf(needle);
    while (i >= 0) {
      const end = i + needle.length;
      const after = low.slice(end, end + 1);
      if (!/[\p{L}\p{N}_]/u.test(after) && !taken.some(([a, b]) => i < b && end > a)) {
        found.add(p.userId);
        taken.push([i, end]);
      }
      i = low.indexOf(needle, end);
    }
  }
  return [...found];
}

// Notification de message : « Alex · Chat du groupe » / « Alex · <question> ».
// Les personnes taguées (ou à qui on répond) reçoivent une notif « mention » à la place (réglage à part).
function notifyChat(g, me, channel, msg) {
  const author = g.players[me.playerId];
  const special = new Set(msg.mentions || []);
  const replied = msg.replyTo && chat.get(g.id, msg.replyTo);
  if (replied && replied.userId !== me.id) special.add(replied.userId);
  const what = (u) => {
    const lang = u.lang;
    if (chatLocked(g, channel, u.id)) return tr(lang, 'Nouveau message · vote pour le voir', 'New message · vote to see it');
    if (msg.kind === 'gif') return tr(lang, 'A envoyé un GIF', 'Sent a GIF');
    if (msg.kind === 'image') return tr(lang, 'A envoyé une photo', 'Sent a photo');
    return short(msg.text, 160);
  };
  const where = (u) => (channel === 'general' ? tr(u.lang, 'Chat du groupe', 'Group chat') : short(pollText(g, g.polls[channel], u.lang), 60));
  const wantsMention = (u) => special.has(u.id) && push.prefs(u).mentions;
  push.notify(g, 'chat', (u) => (wantsMention(u) ? null : {
    title: `${author.name} · ${where(u)}`,
    body: what(u),
    tag: 'chat-' + channel,
    url: `/?chat=${channel}`,
  }), me.id);
  push.notify(g, 'mentions', (u) => (!special.has(u.id) ? null : {
    title: (msg.mentions || []).includes(u.id)
      ? tr(u.lang, `${author.name} t’a tagué·e · ${where(u)}`, `${author.name} tagged you · ${where(u)}`)
      : tr(u.lang, `${author.name} t’a répondu · ${where(u)}`, `${author.name} replied to you · ${where(u)}`),
    body: what(u),
    tag: 'mention-' + channel,
    url: `/?chat=${channel}`,
  }), me.id);
}

// Notification de vote (premier vote seulement, sans dire pour qui).
function notifyVote(g, me, poll) {
  const author = g.players[me.playerId];
  const voters = Object.keys(poll.votes).length;
  const total = Object.keys(g.players).length;
  push.notify(g, 'votes', (u) => ({
    title: tr(u.lang, `${author.name} a voté`, `${author.name} voted`),
    body: `${short(pollText(g, poll, u.lang), 120)} · ${tr(u.lang, `${voters}/${total} ${voters > 1 ? 'ont' : 'a'} voté`, `${voters}/${total} voted`)}`,
    tag: 'votes-' + poll.id,
    url: '/',
  }), me.id);
}

// Pastille de l'app pour une personne : questions pas encore votées + messages non lus.
push.setBadgeCounter((g, u) => {
  const now = Date.now();
  const todo = Object.values(g.polls).filter((p) => p.endsAt > now && !p.votes[u.id]).length;
  const unread = chatThreads(g, u, now).reduce((n, t) => n + t.unread, 0);
  return todo + unread;
});

// Anti-spam : 15 messages par tranche de 10 secondes.
const sendTimes = new Map();
function checkSendRate(userId) {
  const now = Date.now();
  const list = (sendTimes.get(userId) || []).filter((t) => now - t < 10000);
  if (list.length >= 15) throw new HttpError(429, 'Doucement 😅');
  list.push(now);
  sendTimes.set(userId, list);
}

// ---------- Vues ----------

function archiveList(g, me, now, before, setId) {
  const list = Object.values(g.polls)
    .filter((p) => p.endsAt <= now && (!before || p.endsAt < before) && (!setId || p.setId === setId))
    .sort((a, b) => b.endsAt - a.endsAt);
  return { items: list.slice(0, ARCHIVE_PAGE).map((p) => pv(g, p, me, now)), hasMore: list.length > ARCHIVE_PAGE };
}

function stateFor(g, me, now) {
  const livePolls = Object.values(g.polls).filter((p) => p.endsAt > now).sort((a, b) => b.startsAt - a.startsAt);
  const archive = archiveList(g, me, now);
  const threads = chatThreads(g, me, now);
  return {
    now,
    group: { name: g.name, code: g.code },
    me: { userId: me.id, playerId: me.playerId, isAdmin: !!me.isAdmin, notif: push.prefs(me), dropsLeft: dropsLeft(g, me.id, now), dropsPerDay: DAILY_DROPS, lang: me.lang || null },
    colors: COLORS,
    players: Object.values(g.players).sort((a, b) => a.createdAt - b.createdAt).map((p) => publicPlayer(p, g)),
    sets: Object.values(g.sets)
      .sort((a, b) => (a.spicy - b.spicy) || (b.builtin - a.builtin) || ((a.order ?? 0) - (b.order ?? 0)) || a.createdAt - b.createdAt)
      .map((s) => game.setView(g, s, me)),
    live: livePolls.map((p) => pv(g, p, me, now)),
    archive: archive.items,
    archiveHasMore: archive.hasMore,
    chat: { threads, unread: threads.reduce((n, t) => n + t.unread, 0), gifs: gifs.provider() },
    statDefs: STATS,
    stats: computeStats(g, now),
    affinity: computeAffinity(g, now),
    groupStats: computeGroup(g, now),
    settings: g.settings,
    nextDrop: nextSlot(now, g.settings),
    prevDrop: latestSlot(now, g.settings) || null,
    remainingQuestions: game.unused(g).length,
    vapidKey: push.publicKey(),
  };
}

// ---------- API ----------

async function api(req, res, url) {
  const db = store.db;
  const now = Date.now();

  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const method = req.method;
  const parts = url.pathname.split('/').filter(Boolean).slice(1); // sans "api"
  const route = method + ' /' + parts.map((p) => (WORDS.has(p) ? p : ':id')).join('/');
  const ids = parts.filter((p) => !WORDS.has(p));
  const id = ids[0];
  // Grosse limite seulement pour l'envoi d'une photo dans le chat.
  const big = method === 'POST' && route === 'POST /chat/:id';
  const body = ['POST', 'PATCH', 'PUT'].includes(method) ? await readBody(req, big ? 1500000 : 200000) : {};
  const ok = (obj = { ok: true }) => send(res, 200, obj);

  // --- Routes publiques ---
  switch (route) {
    case 'GET /health':
      return ok({ ok: true });

    // Photo envoyée dans un chat (publique elle aussi : l'identifiant, aléatoire et long, sert de clé).
    case 'GET /images/:id': {
      const img = await images.get(id);
      if (!img) {
        res.writeHead(404, { 'Cache-Control': 'no-store' });
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': img.mime, 'Cache-Control': 'public, max-age=31536000, immutable' });
      return res.end(img.buf);
    }

    // Photo de profil (publique : l'identifiant est aléatoire ; « ?v= » change à chaque nouvelle photo).
    case 'GET /photos/:id': {
      const ph = photos.get(id);
      if (!ph) {
        res.writeHead(404, { 'Cache-Control': 'no-store' });
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': ph.mime, 'Cache-Control': 'public, max-age=31536000, immutable' });
      return res.end(ph.buf);
    }

    case 'POST /groups':
      return guarded(ip, () => {
        const name = cleanText(body.groupName, 2, 40, 'Le nom du groupe', 'The group name');
        const pin = validPin(body.pin);
        checkCreationRate(ip);
        const g = newGroup(name);
        const player = addPlayer(g, body.name);
        player.emoji = cleanEmoji(body.emoji);
        const user = newUser(g, player, pin, true);
        if (body.lang) user.lang = i18n.lang(body.lang);
        g.colorsV2 = true;
        game.mergeSeed(g);
        // Pas de drop immédiat à la création : le premier arrive au prochain créneau.
        g.lastAutoSlot = latestSlot(now, g.settings);
        db.groups[g.id] = g;
        ok({ token: newSession(g, user), code: g.code });
      });

    case 'POST /roster':
      return guarded(ip, () => {
        const g = groupByCode(body.code);
        const players = Object.values(g.players).filter((p) => !p.userId).sort((a, b) => a.createdAt - b.createdAt).map((p) => publicPlayer(p, g));
        ok({ group: { name: g.name, code: g.code }, players });
      });

    case 'POST /join':
      return guarded(ip, () => {
        const g = groupByCode(body.code);
        const player = g.players[body.playerId];
        if (!player) throw new HttpError(400, 'Choisis ton nom dans la liste');
        if (player.userId) throw new HttpError(409, 'Quelqu’un a déjà pris ce nom');
        const pin = validPin(body.pin);
        if (body.name && body.name.trim() !== player.name) player.name = cleanName(g, body.name, player.id);
        player.emoji = cleanEmoji(body.emoji);
        // Si l'admin a réinitialisé ce compte, on reprend le même utilisateur (garde ses votes).
        let user = Object.values(g.users).find((u) => u.playerId === player.id);
        if (user) {
          user.salt = crypto.randomBytes(16).toString('hex');
          user.pinHash = hashPin(pin, user.salt);
          user.disabled = false;
          player.userId = user.id;
        } else user = newUser(g, player, pin, false);
        if (body.lang) user.lang = i18n.lang(body.lang);
        ok({ token: newSession(g, user) });
      });

    case 'POST /login':
      return guarded(ip, () => {
        const g = groupByCode(body.code);
        const name = String(body.name || '').trim().toLowerCase();
        const player = Object.values(g.players).find((p) => p.name.toLowerCase() === name);
        const user = player && player.userId && g.users[player.userId];
        if (!user || user.disabled || !checkPin(String(body.pin || ''), user)) throw new HttpError(401, 'Pseudo ou PIN incorrect');
        ok({ token: newSession(g, user) });
      });
  }

  // --- Routes connectées ---
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const session = db.sessions[token];
  const g = session && db.groups[session.groupId];
  const me = g && g.users[session.userId];
  if (!me || me.disabled) throw new HttpError(401, 'Non connecté');
  game.tick(g, now);
  const myPlayer = g.players[me.playerId];
  const requireAdmin = () => {
    if (!me.isAdmin) throw new HttpError(403, 'Réservé à l’admin');
  };

  switch (route) {
    case 'POST /logout':
      delete db.sessions[token];
      persist();
      return ok();

    case 'GET /state':
      return ok(stateFor(g, me, now));

    case 'GET /events':
      return live.connect(g.id, me.id, req, res);

    // --- Chat ---
    case 'GET /chat/:id': {
      const channel = checkChannel(g, id);
      // Infos du sondage (pour l'en-tête, même s'il est loin dans les archives).
      const p = g.polls[channel];
      const poll = p && { id: p.id, text: p.text, textEn: g.questions[p.questionId]?.textEn || null, setId: p.setId, endsAt: p.endsAt, ended: p.endsAt <= now };
      if (chatLocked(g, channel, me.id)) {
        return ok({ channel, poll, locked: true, messages: [], hasMore: false, reads: {}, count: chat.list(g.id, channel).filter((m) => !m.deleted).length });
      }
      const all = chat.list(g.id, channel);
      const before = Number(url.searchParams.get('before')) || Infinity;
      const older = all.filter((m) => m.seq < before);
      const page = older.slice(-50);
      return ok({ channel, poll, messages: page.map((m) => msgView(g, m)), hasMore: older.length > page.length, reads: readsOf(g, channel) });
    }

    case 'POST /chat/:id': {
      const channel = checkChannel(g, id);
      checkUnlocked(g, channel, me);
      checkSendRate(me.id);
      let msg;
      if (body.gif) {
        const gif = gifs.cleanGif(body.gif);
        if (!gif) throw new HttpError(400, 'GIF invalide');
        msg = { channel, userId: me.id, kind: 'gif', gif };
      } else if (body.image) {
        // Photo : déjà redimensionnée par le téléphone (JPEG). On garde ses dimensions pour réserver la place.
        const w = Math.max(1, Math.min(4000, Math.round(Number(body.image.w) || 0)));
        const h = Math.max(1, Math.min(4000, Math.round(Number(body.image.h) || 0)));
        const imgId = await images.put(g.id, body.image.data);
        if (!imgId) throw new HttpError(400, 'Image invalide ou trop lourde');
        msg = { channel, userId: me.id, kind: 'image', image: { id: imgId, w, h } };
      } else {
        const text = String(body.text || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
        if (!text) throw new HttpError(400, 'Message vide');
        if (text.length > 1000) throw new HttpError(400, 'Message trop long (1000 caractères max)');
        msg = { channel, userId: me.id, kind: 'text', text };
        const mentions = findMentions(g, text);
        if (mentions.length) msg.mentions = mentions;
      }
      // Réponse à un message (glisser le message vers la droite).
      if (body.replyTo != null) {
        const o = chat.get(g.id, Number(body.replyTo));
        if (!o || o.channel !== channel || o.deleted) throw new HttpError(400, 'Le message auquel tu réponds n’existe plus');
        msg.replyTo = o.seq;
      }
      const saved = chat.add(g.id, msg);
      markRead(g, channel, me.id, saved.seq);
      const view = msgView(g, saved);
      live.emit(g.id, 'msg', (uid) => (chatLocked(g, channel, uid) ? { channel, id: view.id, locked: true } : view));
      live.emit(g.id, 'read', (uid) => (chatLocked(g, channel, uid) ? null : { channel, playerId: me.playerId, seq: saved.seq }));
      notifyChat(g, me, channel, saved);
      return ok({ message: view });
    }

    case 'POST /chat/:id/read': {
      const channel = checkChannel(g, id);
      if (chatLocked(g, channel, me.id)) return ok();
      const last = chat.list(g.id, channel).at(-1);
      const seq = Math.min(Number(body.seq) || 0, last ? last.seq : 0);
      if (seq && markRead(g, channel, me.id, seq)) live.emit(g.id, 'read', { channel, playerId: me.playerId, seq }, me.id);
      return ok();
    }

    case 'POST /chat/:id/typing':
      checkChannel(g, id);
      checkUnlocked(g, id, me);
      live.emit(g.id, 'typing', (uid) => (chatLocked(g, id, uid) ? null : { channel: id, playerId: me.playerId }), me.id);
      return ok();

    case 'DELETE /chat/:id/messages/:id': {
      const channel = checkChannel(g, id);
      const m = chat.get(g.id, Number(ids[1]));
      if (!m || m.channel !== channel || m.deleted) throw new HttpError(404, 'Message introuvable');
      if (m.userId !== me.id && !me.isAdmin) throw new HttpError(403, 'Ce n’est pas ton message');
      const imgId = m.image && m.image.id;
      chat.remove(g.id, m.seq);
      if (imgId) images.remove(imgId).catch((e) => console.error('Suppression de photo :', e.message));
      live.emit(g.id, 'del', { channel, id: m.seq });
      return ok();
    }

    // Réagir à un message (une réaction par personne ; la même une 2e fois = on l'enlève).
    case 'POST /chat/:id/messages/:id/react': {
      const channel = checkChannel(g, id);
      checkUnlocked(g, channel, me);
      const m = chat.get(g.id, Number(ids[1]));
      if (!m || m.channel !== channel || m.deleted) throw new HttpError(404, 'Message introuvable');
      const emoji = body.emoji == null ? null : String(body.emoji);
      if (emoji && !isReaction(emoji)) throw new HttpError(400, 'Réaction invalide : un seul emoji');
      const saved = chat.react(g.id, m.seq, me.id, emoji && (m.reactions || {})[me.id] !== emoji ? emoji : null);
      const view = msgView(g, saved);
      live.emit(g.id, 'react', (uid) => (chatLocked(g, channel, uid) ? null : { channel, id: m.seq, reactions: view.reactions }));
      return ok({ message: view });
    }

    case 'GET /gifs':
      return ok({ results: await gifs.search(url.searchParams.get('q')) });

    case 'GET /archive':
      return ok(archiveList(g, me, now, Number(url.searchParams.get('before')) || 0, url.searchParams.get('set') || null));

    case 'POST /me/photo': {
      const v = await photos.put(myPlayer.id, body.data);
      if (!v) throw new HttpError(400, 'Photo invalide ou trop lourde');
      myPlayer.photo = v;
      persist();
      live.emit(g.id, 'refresh', {});
      return ok({ photo: v });
    }

    case 'DELETE /me/photo':
      await photos.remove(myPlayer.id);
      delete myPlayer.photo;
      persist();
      live.emit(g.id, 'refresh', {});
      return ok();

    case 'PATCH /me':
      if (body.name != null) myPlayer.name = cleanName(g, body.name, myPlayer.id);
      if (body.emoji) myPlayer.emoji = cleanEmoji(body.emoji);
      if (body.lang != null) me.lang = i18n.lang(body.lang);
      // Couleur : une des 16, pas déjà prise par quelqu'un d'autre.
      if (body.color != null) {
        const c = String(body.color).toLowerCase();
        if (!COLORS.includes(c)) throw new HttpError(400, 'Couleur inconnue');
        if (Object.values(g.players).some((p) => p.id !== myPlayer.id && p.color === c)) throw new HttpError(409, 'Cette couleur est déjà prise');
        myPlayer.color = c;
        live.emit(g.id, 'refresh', {});
      }
      if (body.notif && typeof body.notif === 'object') {
        me.notif = push.prefs(me);
        for (const k of push.KINDS) if (k in body.notif) me.notif[k] = !!body.notif[k];
      }
      persist();
      return ok({ player: publicPlayer(myPlayer, g), notif: push.prefs(me) });

    // --- Sondages ---
    case 'POST /polls/:id/vote': {
      const poll = g.polls[id];
      if (!poll) throw new HttpError(404, 'Sondage introuvable');
      if (poll.endsAt <= now) throw new HttpError(400, 'Trop tard, ce sondage est terminé ⏰');
      // Vote entier : { playerId } ; demi-votes quand on hésite : { half: [a, b] } (½ chacun) ou { half: [a] } (½ seul).
      const half = Array.isArray(body.half) ? [...new Set(body.half.map(String))] : null;
      if (half && (half.length < 1 || half.length > 2)) throw new HttpError(400, 'Vote invalide');
      const targets = half || [String(body.playerId)];
      for (const t of targets) {
        if (t === 'nobody') {
          if (!game.allowsNobody(g, poll.text)) throw new HttpError(400, 'On ne peut pas répondre « Personne » à cette question');
        } else if (!g.players[t]) throw new HttpError(400, 'Personne inconnue');
      }
      const firstVote = !poll.votes[me.id];
      poll.votes[me.id] = half || targets[0];
      poll.members = Math.max(poll.members || 0, Object.values(g.users).filter((u) => !u.disabled).length);
      persist();
      live.emit(g.id, 'refresh', {}, me.id);
      if (firstVote) notifyVote(g, me, poll);
      return ok({ poll: pv(g, poll, me, now) });
    }

    // Noter la question (1 à 5 étoiles ; la même note une 2e fois = on l'enlève). Gardé sur la question :
    // sert aux stats du groupe et peut être exporté pour aider à écrire les prochaines questions.
    case 'POST /polls/:id/rate': {
      const poll = g.polls[id];
      if (!poll) throw new HttpError(404, 'Sondage introuvable');
      const q = g.questions[poll.questionId];
      if (!q) throw new HttpError(404, 'Question introuvable');
      const n = body.rating == null ? null : Number(body.rating);
      if (n != null && !(Number.isInteger(n) && n >= 1 && n <= 5)) throw new HttpError(400, 'Note invalide (1 à 5)');
      q.ratings ||= {};
      if (n == null || q.ratings[me.id] === n) delete q.ratings[me.id];
      else q.ratings[me.id] = n;
      q.ratedAt = now;
      persist();
      live.emit(g.id, 'refresh', {}, me.id);
      return ok({ poll: pv(g, poll, me, now) });
    }

    case 'DELETE /polls/:id': {
      const poll = g.polls[id];
      if (!poll) throw new HttpError(404, 'Sondage introuvable');
      if (!me.isAdmin && poll.droppedBy !== me.id) throw new HttpError(403, 'Seul l’admin ou la personne qui l’a lancé peut le supprimer');
      delete g.polls[id];
      persist();
      live.emit(g.id, 'refresh', {}, me.id);
      return ok();
    }

    case 'POST /drop': {
      if (body.setId && !g.sets[body.setId]) throw new HttpError(404, 'Set introuvable');
      if (!dropsLeft(g, me.id, now)) throw new HttpError(429, `Tu as déjà lancé ${DAILY_DROPS} questions aujourd’hui. Ça repart à minuit !`, `You already launched ${DAILY_DROPS} questions today. Resets at midnight!`);
      let q;
      if (body.text) {
        if (!body.setId) throw new HttpError(400, 'Choisis un set pour ta question');
        q = game.addQuestion(g, body.setId, body.text, me.id);
      } else {
        q = game.pickQuestion(g, body.setId || null);
        if (!q) throw new HttpError(400, 'Plus aucune question dispo ici 😢 Ajoutes-en !');
      }
      logDrop(g, me.id, now);
      return ok({ poll: pv(g, game.createPoll(g, q, now, 'manual', me.id), me, now), dropsLeft: dropsLeft(g, me.id, now) });
    }

    // --- Sets & questions ---
    case 'GET /sets/:id': {
      const set = g.sets[id];
      if (!set) throw new HttpError(404, 'Set introuvable');
      const qs = Object.values(g.questions).filter((q) => q.setId === id && !q.removed);
      return ok({
        set: game.setView(g, set, me),
        played: qs.filter((q) => q.usedAt).sort((a, b) => b.usedAt - a.usedAt).map((q) => ({ id: q.id, text: q.text, textEn: q.textEn || null, usedAt: q.usedAt })),
        mine: qs.filter((q) => !q.usedAt && q.authorId === me.id).map((q) => ({ id: q.id, text: q.text })),
      });
    }

    case 'POST /sets': {
      const name = cleanText(body.name, 2, 40, 'Le nom du set', 'The set name');
      if (Object.values(g.sets).some((s) => s.name.toLowerCase() === name.toLowerCase())) throw new HttpError(409, 'Un set porte déjà ce nom');
      const set = {
        id: 'c_' + newId(),
        name,
        emoji: cleanEmoji(body.emoji || '✨'),
        description: String(body.description || '').trim().slice(0, 120),
        spicy: !!body.spicy,
        builtin: false,
        authorId: me.id,
        createdAt: now,
      };
      g.sets[set.id] = set;
      persist();
      return ok({ set: game.setView(g, set, me) });
    }

    case 'PATCH /sets/:id': {
      const set = g.sets[id];
      if (!set) throw new HttpError(404, 'Set introuvable');
      if (set.builtin || (!me.isAdmin && set.authorId !== me.id)) throw new HttpError(403, 'Tu ne peux pas modifier ce set');
      if (body.name != null) set.name = cleanText(body.name, 2, 40, 'Le nom du set', 'The set name');
      if (body.emoji) set.emoji = cleanEmoji(body.emoji);
      if (body.description != null) set.description = String(body.description).trim().slice(0, 120);
      if (body.spicy != null) set.spicy = !!body.spicy;
      persist();
      return ok({ set: game.setView(g, set, me) });
    }

    case 'DELETE /sets/:id': {
      const set = g.sets[id];
      if (!set) throw new HttpError(404, 'Set introuvable');
      if (set.builtin || (!me.isAdmin && set.authorId !== me.id)) throw new HttpError(403, 'Tu ne peux pas supprimer ce set');
      if (Object.values(g.questions).some((q) => q.setId === id && q.usedAt)) throw new HttpError(400, 'Des questions de ce set ont déjà été jouées : il reste pour l’historique');
      for (const q of Object.values(g.questions)) if (q.setId === id) delete g.questions[q.id];
      delete g.sets[id];
      persist();
      return ok();
    }

    case 'POST /sets/:id/questions': {
      const lines = String(body.text || '').split('\n').map((l) => l.trim()).filter(Boolean);
      if (!lines.length) throw new HttpError(400, 'Écris une question');
      const added = [];
      const errors = [];
      for (const line of lines.slice(0, 50)) {
        try {
          added.push(game.addQuestion(g, id, line, me.id).text);
        } catch (e) {
          if (!(e instanceof HttpError) || lines.length === 1) throw e;
          errors.push(`${line} → ${e.message}`);
        }
      }
      return ok({ added, errors });
    }

    case 'DELETE /questions/:id': {
      const q = g.questions[id];
      if (!q || q.removed) throw new HttpError(404, 'Question introuvable');
      if (!me.isAdmin && q.authorId !== me.id) throw new HttpError(403, 'Ce n’est pas ta question');
      if (q.usedAt) throw new HttpError(400, 'Déjà jouée : elle reste dans l’historique');
      if (q.builtin) q.removed = 'admin'; // sinon questions.md la remettrait au redémarrage
      else delete g.questions[id];
      persist();
      return ok();
    }

    // --- Notifications ---
    case 'POST /push/subscribe':
      if (!push.subscribe(g, me.id, body.subscription)) throw new HttpError(400, 'Abonnement invalide');
      return ok();

    case 'POST /push/unsubscribe':
      push.unsubscribe(g, me.id, body.endpoint);
      return ok();

    // Envoie tout de suite une notif de test à soi-même et renvoie le résultat par appareil.
    case 'POST /push/test': {
      const devices = (g.pushSubs[me.id] || []).length;
      if (!devices) return ok({ devices: 0, results: [] });
      const results = await push.sendTo(g, me.id, { title: tr(me.lang, 'Test réussi', 'Test worked'), body: tr(me.lang, 'Les notifications marchent sur cet appareil.', 'Notifications work on this device.'), tag: 'test', url: '/' });
      return ok({ devices, results });
    }

    case 'POST /presence':
      live.presence(g.id, me.id, body.visible !== false);
      return ok();

    // --- Admin ---
    case 'PATCH /admin/group':
      requireAdmin();
      g.name = cleanText(body.name, 2, 40, 'Le nom du groupe', 'The group name');
      persist();
      return ok({ group: { name: g.name, code: g.code } });

    case 'POST /admin/group/code':
      requireAdmin();
      g.code = newCode();
      persist();
      return ok({ group: { name: g.name, code: g.code } });

    case 'POST /admin/players': {
      requireAdmin();
      const names = String(body.names || '').split(/[\n,]/).map((n) => n.trim()).filter(Boolean);
      if (!names.length) throw new HttpError(400, 'Ajoute au moins un nom');
      const added = [];
      const errors = [];
      for (const n of names.slice(0, 50)) {
        try {
          added.push(addPlayer(g, n).name);
        } catch (e) {
          errors.push(e.message);
        }
      }
      persist();
      return ok({ added, errors });
    }

    case 'PATCH /admin/players/:id': {
      requireAdmin();
      const player = g.players[id];
      if (!player) throw new HttpError(404, 'Personne introuvable');
      if (body.name != null) player.name = cleanName(g, body.name, player.id);
      if (body.emoji) player.emoji = cleanEmoji(body.emoji);
      persist();
      return ok({ player: publicPlayer(player, g) });
    }

    case 'POST /admin/players/:id/reset': {
      requireAdmin();
      const player = g.players[id];
      if (!player || !player.userId) throw new HttpError(404, 'Ce nom n’a pas de compte');
      const user = g.users[player.userId];
      if (user.isAdmin) throw new HttpError(400, 'Impossible de réinitialiser l’admin');
      user.disabled = true;
      user.pinHash = null;
      for (const [t, s] of Object.entries(db.sessions)) if (s.userId === user.id) delete db.sessions[t];
      delete g.pushSubs[user.id];
      player.userId = null;
      persist();
      return ok();
    }

    case 'DELETE /admin/players/:id': {
      requireAdmin();
      const player = g.players[id];
      if (!player) throw new HttpError(404, 'Personne introuvable');
      if (player.userId) throw new HttpError(400, 'Cette personne a un compte : réinitialise-le d’abord');
      if (Object.values(g.polls).some((p) => Object.values(p.votes).some((v) => ballot(v).some(([t]) => t === id)))) throw new HttpError(400, 'Cette personne a déjà reçu des votes, on la garde');
      delete g.players[id];
      persist();
      return ok();
    }

    case 'PATCH /admin/settings': {
      requireAdmin();
      const s = { ...g.settings };
      const num = (v, min, max, label, labelEn) => {
        const n = Number(v);
        if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, `${label} doit être entre ${min} et ${max}`, `${labelEn} has to be between ${min} and ${max}`);
        return n;
      };
      if (body.intervalHours != null) s.intervalHours = num(body.intervalHours, 0.02, 24, 'L’intervalle', 'The interval');
      if (body.startHour != null) s.startHour = Math.round(num(body.startHour, 0, 23, 'L’heure de début', 'The start hour'));
      if (body.endHour != null) s.endHour = Math.round(num(body.endHour, 0, 23, 'L’heure de fin', 'The end hour'));
      if (body.pollHours != null) s.pollHours = num(body.pollHours, 0.02, 168, 'La durée de vote', 'The voting time');
      if (body.timezone != null) {
        if (!isValidTimezone(body.timezone)) throw new HttpError(400, 'Fuseau horaire inconnu');
        s.timezone = body.timezone;
      }
      if (body.allowNobody != null) s.allowNobody = !!body.allowNobody;
      // La fin peut être de « début + 1 h » à « début − 1 h » (le lendemain) : la plage peut passer minuit.
      if (s.endHour === s.startHour) throw new HttpError(400, 'L’heure de fin ne peut pas être l’heure de début');
      const scheduleChanged = ['intervalHours', 'startHour', 'endHour', 'timezone'].some((k) => s[k] !== g.settings[k]);
      g.settings = s;
      // Durée de vote : appliquée aussi aux sondages en cours.
      game.applyPollHours(g, now);
      // Nouveau planning : pas de question qui tombe d'un coup pour un créneau déjà passé.
      if (scheduleChanged) g.lastAutoSlot = Math.max(g.lastAutoSlot || 0, latestSlot(now, s));
      persist();
      live.emit(g.id, 'refresh', {}, me.id);
      return ok({ settings: s, nextDrop: nextSlot(now, s) });
    }

    case 'POST /admin/drop-auto': {
      requireAdmin();
      const q = game.pickQuestion(g);
      if (!q) throw new HttpError(400, 'Plus aucune question dispo');
      return ok({ poll: pv(g, game.createPoll(g, q, now, 'auto', null), me, now) });
    }

    case 'GET /admin/unscored': {
      requireAdmin();
      const list = Object.values(g.questions)
        .filter((q) => !q.weights && !q.removed)
        .map((q) => ({ id: q.id, set: g.sets[q.setId]?.name || '?', text: q.text }));
      return ok({ questions: list });
    }

    // Toutes les notes des questions (pour les donner à une IA qui écrira les prochaines questions).
    case 'GET /admin/ratings': {
      requireAdmin();
      const list = Object.values(g.questions)
        .filter((q) => q.ratings && Object.keys(q.ratings).length)
        .map((q) => {
          const notes = Object.values(q.ratings);
          const poll = Object.values(g.polls).find((p) => p.questionId === q.id);
          const counts = poll ? tally(poll) : {};
          return {
            id: q.id,
            set: g.sets[q.setId]?.name || '?',
            text: q.text,
            textEn: q.textEn || null,
            custom: !q.builtin,
            weights: q.weights || null,
            ratings: notes,
            avg: Math.round((notes.reduce((a, b) => a + b, 0) / notes.length) * 100) / 100,
            votes: Object.values(counts).reduce((a, b) => a + b, 0),
            spread: Object.keys(counts).length,
          };
        })
        .sort((a, b) => b.avg - a.avg);
      return ok({ group: g.name, exportedAt: now, scale: '1 (nulle) à 5 (excellente)', questions: list });
    }

    case 'POST /admin/scores': {
      requireAdmin();
      const scores = body.scores && typeof body.scores === 'object' ? body.scores : {};
      let updated = 0;
      const errors = [];
      for (const [qid, w] of Object.entries(scores)) {
        const q = g.questions[qid];
        const weights = parseWeights(w);
        if (!q) errors.push(`${qid} : question introuvable`);
        else if (!weights) errors.push(`${qid} : poids invalides`);
        else {
          q.weights = weights;
          updated++;
        }
      }
      persist();
      return ok({ updated, errors });
    }
  }

  throw new HttpError(404, 'Route inconnue');
}

// ---------- Fichiers statiques ----------

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

// Version anglaise : même page, servie depuis /en (c'est l'adresse à partager / installer pour l'avoir en anglais).
// La page est marquée en anglais et pointe vers un manifeste qui rouvre l'app installée sur /en.
let indexEn = null;
function serveIndexEn(res) {
  if (!indexEn) {
    indexEn = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8')
      .replace('<html lang="fr">', '<html lang="en" data-lang="en">')
      .replace('/manifest.webmanifest', '/manifest.en.webmanifest')
      .replace('<title>Qui de nous ?</title>', '<title>Which of us?</title>')
      .replace('content="Qui de nous"', 'content="Which of us"');
  }
  res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-cache' });
  res.end(indexEn);
}

function serveStatic(res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/en' || rel.startsWith('/en/')) return serveIndexEn(res);
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    return res.end();
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      // Application monopage : on renvoie l'accueil.
      return fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, html) => {
        res.writeHead(e2 ? 404 : 200, { 'Content-Type': TYPES['.html'] });
        res.end(e2 ? 'Introuvable' : html);
      });
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

// ---------- Démarrage ----------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    try {
      await api(req, res, url);
    } catch (e) {
      if (!(e instanceof HttpError)) console.error(e);
      // Le client envoie sa langue (en-tête X-Lang) : erreurs en anglais si l'app est en anglais.
      const lang = req.headers['x-lang'];
      if (!res.headersSent) send(res, e.status || 500, { error: i18n.errorText(e instanceof HttpError ? e : new HttpError(500, 'Erreur serveur'), lang) });
    }
  } else {
    serveStatic(res, url);
  }
});

load()
  .then(async () => {
    const groups = Object.values(store.db.groups);
    // Couleurs enregistrées sur chaque personne (avant, elles dépendaient de la place dans la liste).
    if (groups.map((g) => game.ensureColors(g)).some(Boolean)) persist();
    const r = game.reloadSeed(groups);
    const messages = await chat.load();
    await photos.load();
    await images.init();
    push.init();
    setInterval(() => {
      for (const g of Object.values(store.db.groups)) game.tick(g);
    }, 60 * 1000);
    server.listen(PORT, () => {
      console.log(`Qui de nous ? → http://localhost:${PORT}`);
      console.log(`questions.md : ${r.sets} sets, ${r.questions} questions${r.added ? ` (${r.added} nouvelles ajoutées aux groupes)` : ''}`);
      console.log(`Groupes : ${groups.length ? groups.map((g) => `${g.name} [${g.code}]`).join(', ') : 'aucun'}`);
      console.log(`Chat : ${messages} messages · GIFs : ${gifs.enabled() ? 'activés' : 'désactivés (pas de GIPHY_API_KEY / TENOR_API_KEY)'}`);
      console.log(`Stockage : ${store.label}`);
    });
  })
  .catch((e) => {
    console.error('Impossible de charger les données :', e);
    process.exit(1);
  });

// Render envoie SIGTERM avant chaque redéploiement : on sauvegarde avant de partir.
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, async () => {
    await flush();
    process.exit(0);
  });
}
