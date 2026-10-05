// Notifications push (Web Push). Les clés VAPID sont générées une fois et gardées dans la base.
const { store, persist } = require('./store');

let webpush = null;
try {
  webpush = require('web-push');
} catch {
  console.warn('web-push non installé : notifications désactivées.');
}

function init() {
  if (!webpush) return;
  if (!store.db.vapid) {
    store.db.vapid = webpush.generateVAPIDKeys();
    persist();
  }
  webpush.setVapidDetails(process.env.PUSH_CONTACT || 'mailto:admin@example.com', store.db.vapid.publicKey, store.db.vapid.privateKey);
}

function publicKey() {
  return webpush && store.db.vapid ? store.db.vapid.publicKey : null;
}

function subscribe(g, userId, sub) {
  if (!sub || typeof sub.endpoint !== 'string' || !sub.keys) return false;
  // Un même téléphone ne doit recevoir que les notifs de la personne connectée dessus.
  for (const [uid, l] of Object.entries(g.pushSubs)) if (uid !== userId) g.pushSubs[uid] = l.filter((s) => s.endpoint !== sub.endpoint);
  const list = (g.pushSubs[userId] ||= []);
  const existing = list.find((s) => s.endpoint === sub.endpoint);
  if (existing) existing.keys = sub.keys;
  else list.push({ endpoint: sub.endpoint, keys: sub.keys });
  persist();
  return true;
}

function unsubscribe(g, userId, endpoint) {
  const list = g.pushSubs[userId];
  if (!list) return;
  g.pushSubs[userId] = list.filter((s) => s.endpoint !== endpoint);
  persist();
}

// Envoie à tous les appareils d'une personne. Renvoie le résultat par appareil (utile pour le test).
function sendTo(g, userId, payload) {
  if (!webpush) return Promise.resolve([{ ok: false, error: 'web-push non installé sur le serveur' }]);
  const body = JSON.stringify(payload);
  return Promise.all(
    (g.pushSubs[userId] || []).map((sub) => {
      const service = new URL(sub.endpoint).hostname;
      return webpush
        .sendNotification(sub, body, { TTL: 24 * 3600, urgency: 'high' })
        .then((r) => ({ service, ok: true, status: r.statusCode }))
        .catch((e) => {
          if (e.statusCode === 404 || e.statusCode === 410) unsubscribe(g, userId, sub.endpoint);
          console.error(`Push échoué (${service}) :`, e.statusCode || '', e.body || e.message);
          return { service, ok: false, status: e.statusCode || null, error: String(e.body || e.message).slice(0, 200) };
        });
    })
  );
}

// Préférences de notifications par personne (tout activé par défaut).
const KINDS = ['polls', 'votes', 'chat'];
function prefs(user) {
  return { polls: true, votes: true, chat: true, ...(user.notif || {}) };
}

// Envoie une notification d'un type donné à tout le groupe, sauf : l'auteur, ceux qui ont coupé
// ce type de notif, et ceux qui ont l'app ouverte (ils voient l'info en direct).
function notify(g, kind, payload, exceptUserId = null) {
  const live = require('./live');
  return Promise.all(
    Object.values(g.users)
      .filter((u) => u.id !== exceptUserId && !u.disabled && g.pushSubs[u.id]?.length && prefs(u)[kind] && !live.online(g.id, u.id))
      .map((u) => {
        // payload peut dépendre de la personne (fonction) ; null = pas de notif pour elle.
        const p = typeof payload === 'function' ? payload(u) : payload;
        return p ? sendTo(g, u.id, p) : null;
      })
  ).catch(() => {});
}

module.exports = { init, publicKey, subscribe, unsubscribe, sendTo, notify, prefs, KINDS };
