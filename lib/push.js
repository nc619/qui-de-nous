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

async function sendAll(g, payload, exceptUserId = null) {
  if (!webpush) return;
  const body = JSON.stringify(payload);
  const jobs = [];
  for (const [userId, list] of Object.entries(g.pushSubs)) {
    if (userId === exceptUserId) continue;
    for (const sub of list) {
      jobs.push(
        webpush.sendNotification(sub, body, { TTL: 6 * 3600 }).catch((e) => {
          if (e.statusCode === 404 || e.statusCode === 410) unsubscribe(g, userId, sub.endpoint);
          else console.error('Push échoué :', e.statusCode || e.message);
        })
      );
    }
  }
  await Promise.all(jobs);
}

module.exports = { init, publicKey, subscribe, unsubscribe, sendAll };
