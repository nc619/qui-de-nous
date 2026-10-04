// "Qui de nous ?" — sondages entre potes.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { store, load, persist, flush, newGroup, newCode } = require('./lib/store');
const { latestSlot, nextSlot, isValidTimezone, zonedParts } = require('./lib/schedule');
const { STATS, parseWeights, computeStats } = require('./lib/stats');
const push = require('./lib/push');
const game = require('./lib/game');
const chat = require('./lib/chat');
const live = require('./lib/live');
const gifs = require('./lib/gifs');
const { HttpError, newId, cleanText, COLORS } = game;

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const ARCHIVE_PAGE = 30;

// Segments d'URL fixes ; tout autre segment est un identifiant (":id").
const WORDS = new Set([
  'health', 'groups', 'roster', 'join', 'login', 'logout', 'state', 'archive', 'me', 'polls', 'vote', 'drop',
  'sets', 'questions', 'push', 'subscribe', 'unsubscribe', 'admin', 'players', 'reset', 'settings', 'drop-auto',
  'unscored', 'scores', 'group', 'code', 'chat', 'read', 'typing', 'events', 'gifs', 'messages', 'presence', 'test',
]);

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

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 200000) {
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
  const n = cleanText(name, 2, 24, 'Le pseudo');
  const taken = Object.values(g.players).find((p) => p.id !== exceptId && p.name.toLowerCase() === n.toLowerCase());
  if (taken) throw new HttpError(409, `« ${n} » est déjà pris`);
  return n;
}

function cleanEmoji(e) {
  return String(e || '😎').slice(0, 8);
}

function addPlayer(g, name) {
  const player = { id: newId(), name: cleanName(g, name), emoji: '🙂', color: COLORS[Object.keys(g.players).length % COLORS.length], userId: null, createdAt: Date.now() };
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

function publicPlayer(p) {
  return { id: p.id, name: p.name, emoji: p.emoji, color: p.color, claimed: !!p.userId };
}

// ---------- Chat ----------

function checkChannel(g, channel) {
  if (channel === 'general' || g.polls[channel]) return channel;
  throw new HttpError(404, 'Discussion introuvable');
}

function msgView(g, m) {
  return {
    id: m.seq,
    channel: m.channel,
    playerId: g.users[m.userId]?.playerId || null,
    kind: m.kind,
    text: m.text,
    gif: m.gif,
    at: m.at,
    deleted: !!m.deleted,
  };
}

function readsOf(g, channel) {
  const out = {};
  for (const [userId, seq] of Object.entries((g.chatReads || {})[channel] || {})) {
    const pid = g.users[userId]?.playerId;
    if (pid) out[pid] = seq;
  }
  return out;
}

function chatSummary(g, me, channel, lastN) {
  const list = chat.list(g.id, channel).filter((m) => !m.deleted);
  const read = ((g.chatReads || {})[channel] || {})[me.id] || 0;
  return {
    count: list.length,
    unread: list.filter((m) => m.seq > read && m.userId !== me.id).length,
    last: list.slice(-lastN).map((m) => msgView(g, m)),
  };
}

// Vue d'un sondage + aperçu de sa discussion.
function pv(g, p, me, now) {
  return { ...game.pollView(g, p, me, now), chat: chatSummary(g, me, p.id, 2) };
}

// Liste des discussions : le chat général, puis les sondages qui ont des messages (les plus récents d'abord).
function chatThreads(g, me) {
  const threads = [{ channel: 'general', ...chatSummary(g, me, 'general', 4) }];
  const polls = chat.channels(g.id)
    .filter((c) => c !== 'general' && g.polls[c])
    .map((c) => ({ channel: c, text: g.polls[c].text, setId: g.polls[c].setId, ...chatSummary(g, me, c, 1) }))
    .filter((t) => t.count)
    .sort((a, b) => b.last[0].at - a.last[0].at)
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

const short = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

// Notification de message : « 💬 Alex · Chat du groupe » / « 💬 Alex · <question> ».
function notifyChat(g, me, channel, msg) {
  const author = g.players[me.playerId];
  const where = channel === 'general' ? 'Chat du groupe' : short(g.polls[channel].text, 60);
  push.notify(g, 'chat', {
    title: `${author.name} · ${where}`,
    body: msg.kind === 'gif' ? 'A envoyé un GIF' : short(msg.text, 160),
    tag: 'chat-' + channel,
    url: `/?chat=${channel}`,
  }, me.id);
}

// Notification de vote (premier vote seulement, sans dire pour qui).
function notifyVote(g, me, poll) {
  const author = g.players[me.playerId];
  const voters = Object.keys(poll.votes).length;
  push.notify(g, 'votes', {
    title: `${author.name} a voté`,
    body: `${short(poll.text, 120)} · ${voters}/${Object.keys(g.players).length} ${voters > 1 ? 'ont' : 'a'} voté`,
    tag: 'votes-' + poll.id,
    url: '/',
  }, me.id);
}

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
  const threads = chatThreads(g, me);
  return {
    now,
    group: { name: g.name, code: g.code },
    me: { userId: me.id, playerId: me.playerId, isAdmin: !!me.isAdmin, notif: push.prefs(me), dropsLeft: dropsLeft(g, me.id, now), dropsPerDay: DAILY_DROPS },
    players: Object.values(g.players).sort((a, b) => a.createdAt - b.createdAt).map(publicPlayer),
    sets: Object.values(g.sets)
      .sort((a, b) => (a.spicy - b.spicy) || (b.builtin - a.builtin) || ((a.order ?? 0) - (b.order ?? 0)) || a.createdAt - b.createdAt)
      .map((s) => game.setView(g, s, me)),
    live: livePolls.map((p) => pv(g, p, me, now)),
    archive: archive.items,
    archiveHasMore: archive.hasMore,
    chat: { threads, unread: threads.reduce((n, t) => n + t.unread, 0), gifs: gifs.provider() },
    statDefs: STATS,
    stats: computeStats(g, now),
    settings: g.settings,
    nextDrop: nextSlot(now, g.settings),
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
  const body = ['POST', 'PATCH', 'PUT'].includes(method) ? await readBody(req) : {};
  const ok = (obj = { ok: true }) => send(res, 200, obj);

  // --- Routes publiques ---
  switch (route) {
    case 'GET /health':
      return ok({ ok: true });

    case 'POST /groups':
      return guarded(ip, () => {
        const name = cleanText(body.groupName, 2, 40, 'Le nom du groupe');
        const pin = validPin(body.pin);
        checkCreationRate(ip);
        const g = newGroup(name);
        const player = addPlayer(g, body.name);
        player.emoji = cleanEmoji(body.emoji);
        const user = newUser(g, player, pin, true);
        game.mergeSeed(g);
        // Pas de drop immédiat à la création : le premier arrive au prochain créneau.
        g.lastAutoSlot = latestSlot(now, g.settings);
        db.groups[g.id] = g;
        ok({ token: newSession(g, user), code: g.code });
      });

    case 'POST /roster':
      return guarded(ip, () => {
        const g = groupByCode(body.code);
        const players = Object.values(g.players).filter((p) => !p.userId).sort((a, b) => a.createdAt - b.createdAt).map(publicPlayer);
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
      const all = chat.list(g.id, channel);
      const before = Number(url.searchParams.get('before')) || Infinity;
      const older = all.filter((m) => m.seq < before);
      const page = older.slice(-50);
      return ok({ channel, messages: page.map((m) => msgView(g, m)), hasMore: older.length > page.length, reads: readsOf(g, channel) });
    }

    case 'POST /chat/:id': {
      const channel = checkChannel(g, id);
      checkSendRate(me.id);
      let msg;
      if (body.gif) {
        const gif = gifs.cleanGif(body.gif);
        if (!gif) throw new HttpError(400, 'GIF invalide');
        msg = { channel, userId: me.id, kind: 'gif', gif };
      } else {
        const text = String(body.text || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
        if (!text) throw new HttpError(400, 'Message vide');
        if (text.length > 1000) throw new HttpError(400, 'Message trop long (1000 caractères max)');
        msg = { channel, userId: me.id, kind: 'text', text };
      }
      const saved = chat.add(g.id, msg);
      markRead(g, channel, me.id, saved.seq);
      const view = msgView(g, saved);
      live.emit(g.id, 'msg', view);
      live.emit(g.id, 'read', { channel, playerId: me.playerId, seq: saved.seq });
      notifyChat(g, me, channel, saved);
      return ok({ message: view });
    }

    case 'POST /chat/:id/read': {
      const channel = checkChannel(g, id);
      const last = chat.list(g.id, channel).at(-1);
      const seq = Math.min(Number(body.seq) || 0, last ? last.seq : 0);
      if (seq && markRead(g, channel, me.id, seq)) live.emit(g.id, 'read', { channel, playerId: me.playerId, seq }, me.id);
      return ok();
    }

    case 'POST /chat/:id/typing':
      checkChannel(g, id);
      live.emit(g.id, 'typing', { channel: id, playerId: me.playerId }, me.id);
      return ok();

    case 'DELETE /chat/:id/messages/:id': {
      const channel = checkChannel(g, id);
      const m = chat.get(g.id, Number(ids[1]));
      if (!m || m.channel !== channel || m.deleted) throw new HttpError(404, 'Message introuvable');
      if (m.userId !== me.id && !me.isAdmin) throw new HttpError(403, 'Ce n’est pas ton message');
      chat.remove(g.id, m.seq);
      live.emit(g.id, 'del', { channel, id: m.seq });
      return ok();
    }

    case 'GET /gifs':
      return ok({ results: await gifs.search(url.searchParams.get('q')) });

    case 'GET /archive':
      return ok(archiveList(g, me, now, Number(url.searchParams.get('before')) || 0, url.searchParams.get('set') || null));

    case 'PATCH /me':
      if (body.name != null) myPlayer.name = cleanName(g, body.name, myPlayer.id);
      if (body.emoji) myPlayer.emoji = cleanEmoji(body.emoji);
      if (body.notif && typeof body.notif === 'object') {
        me.notif = push.prefs(me);
        for (const k of push.KINDS) if (k in body.notif) me.notif[k] = !!body.notif[k];
      }
      persist();
      return ok({ player: publicPlayer(myPlayer), notif: push.prefs(me) });

    // --- Sondages ---
    case 'POST /polls/:id/vote': {
      const poll = g.polls[id];
      if (!poll) throw new HttpError(404, 'Sondage introuvable');
      if (poll.endsAt <= now) throw new HttpError(400, 'Trop tard, ce sondage est terminé ⏰');
      if (!g.players[body.playerId]) throw new HttpError(400, 'Personne inconnue');
      const firstVote = !poll.votes[me.id];
      poll.votes[me.id] = body.playerId;
      persist();
      live.emit(g.id, 'refresh', {}, me.id);
      if (firstVote) notifyVote(g, me, poll);
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
      if (!dropsLeft(g, me.id, now)) throw new HttpError(429, `Tu as déjà lancé ${DAILY_DROPS} questions aujourd’hui. Ça repart à minuit !`);
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
        played: qs.filter((q) => q.usedAt).sort((a, b) => b.usedAt - a.usedAt).map((q) => ({ id: q.id, text: q.text, usedAt: q.usedAt })),
        mine: qs.filter((q) => !q.usedAt && q.authorId === me.id).map((q) => ({ id: q.id, text: q.text })),
      });
    }

    case 'POST /sets': {
      const name = cleanText(body.name, 2, 40, 'Le nom du set');
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
      if (body.name != null) set.name = cleanText(body.name, 2, 40, 'Le nom du set');
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
      const results = await push.sendTo(g, me.id, { title: 'Test réussi', body: 'Les notifications marchent sur cet appareil.', tag: 'test', url: '/' });
      return ok({ devices, results });
    }

    case 'POST /presence':
      live.presence(g.id, me.id, body.visible !== false);
      return ok();

    // --- Admin ---
    case 'PATCH /admin/group':
      requireAdmin();
      g.name = cleanText(body.name, 2, 40, 'Le nom du groupe');
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
      return ok({ player: publicPlayer(player) });
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
      if (Object.values(g.polls).some((p) => Object.values(p.votes).includes(id))) throw new HttpError(400, 'Cette personne a déjà reçu des votes, on la garde');
      delete g.players[id];
      persist();
      return ok();
    }

    case 'PATCH /admin/settings': {
      requireAdmin();
      const s = { ...g.settings };
      const num = (v, min, max, label) => {
        const n = Number(v);
        if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, `${label} doit être entre ${min} et ${max}`);
        return n;
      };
      if (body.intervalHours != null) s.intervalHours = num(body.intervalHours, 0.02, 24, 'L’intervalle');
      if (body.startHour != null) s.startHour = Math.round(num(body.startHour, 0, 23, 'L’heure de début'));
      if (body.endHour != null) s.endHour = Math.round(num(body.endHour, 0, 23, 'L’heure de fin'));
      if (body.pollHours != null) s.pollHours = num(body.pollHours, 0.02, 168, 'La durée de vote');
      if (body.timezone != null) {
        if (!isValidTimezone(body.timezone)) throw new HttpError(400, 'Fuseau horaire inconnu');
        s.timezone = body.timezone;
      }
      if (s.endHour < s.startHour) throw new HttpError(400, 'L’heure de fin doit être après l’heure de début');
      g.settings = s;
      persist();
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

function serveStatic(res, url) {
  let rel = decodeURIComponent(url.pathname);
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
      if (!res.headersSent) send(res, e.status || 500, { error: e instanceof HttpError ? e.message : 'Erreur serveur' });
    }
  } else {
    serveStatic(res, url);
  }
});

load()
  .then(async () => {
    const groups = Object.values(store.db.groups);
    const r = game.reloadSeed(groups);
    const messages = await chat.load();
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
