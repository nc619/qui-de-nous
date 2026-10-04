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
  const list = (g.pushSubs[userId] ||= []);
  if (!list.some((s) => s.endpoint === sub.endpoint)) list.push({ endpoint: sub.endpoint, keys: sub.keys });
  persist();
  return true;
}

function unsubscribe(g, userId, endpoint) {
  const list = g.pushSubs[userId];
  if (!list) return;
  g.pushSubs[userId] = list.filter((s) => s.endpoint !== endpoint);
  persist();
}

function sendTo(g, userId, payload) {
  if (!webpush) return Promise.resolve();
  const body = JSON.stringify(payload);
  return Promise.all(
    (g.pushSubs[userId] || []).map((sub) =>
      webpush.sendNotification(sub, body, { TTL: 6 * 3600 }).catch((e) => {
        if (e.statusCode === 404 || e.statusCode === 410) unsubscribe(g, userId, sub.endpoint);
        else console.error('Push échoué :', e.statusCode || e.message);
      })
    )
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
      .map((u) => sendTo(g, u.id, payload))
  ).catch(() => {});
}

module.exports = { init, publicKey, subscribe, unsubscribe, sendTo, notify, prefs, KINDS };
