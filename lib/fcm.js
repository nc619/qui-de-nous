// Notifications de l'app mobile (iOS et Android) via Firebase Cloud Messaging (API HTTP v1), sans dépendance.
// Configuration : variable FIREBASE_SERVICE_ACCOUNT = le contenu du fichier JSON du « compte de service »
// (console Firebase → Paramètres du projet → Comptes de service → Générer une nouvelle clé privée).
// Sur iPhone, Firebase passe par Apple (APNs) : la clé APNs (.p8) se dépose une fois dans la console Firebase.
const crypto = require('crypto');

let account = null;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (e) {
  console.error('FIREBASE_SERVICE_ACCOUNT illisible :', e.message);
}
const enabled = () => !!(account && account.private_key && account.client_email && account.project_id);

const b64 = (x) => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url');

// Jeton d'accès Google (valable 1 h, gardé 55 min).
let cached = null;
async function accessToken() {
  if (cached && cached.exp > Date.now()) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'RS256', typ: 'JWT' });
  const claim = b64({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const sig = crypto.createSign('RSA-SHA256').update(`${head}.${claim}`).sign(account.private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${head}.${claim}.${sig}`,
  });
  const data = await r.json();
  if (!data.access_token) throw new Error('Firebase : pas de jeton (' + (data.error_description || data.error || r.status) + ')');
  cached = { token: data.access_token, exp: Date.now() + 55 * 60 * 1000 };
  return cached.token;
}

// Envoie une notification à un téléphone. payload : { title, body, tag, url, badge }.
// Renvoie { ok, status, gone } — gone = le jeton n'existe plus (app désinstallée) : à oublier.
async function send(token, payload) {
  if (!enabled()) return { ok: false, error: 'Firebase non configuré (FIREBASE_SERVICE_ACCOUNT)' };
  const data = { url: String(payload.url || '/'), tag: String(payload.tag || '') };
  const message = {
    token,
    notification: { title: payload.title || '', body: payload.body || '' },
    data,
    android: {
      priority: 'high',
      notification: { tag: payload.tag || undefined, notification_count: typeof payload.badge === 'number' ? payload.badge : undefined },
    },
    apns: {
      headers: { 'apns-priority': '10', ...(payload.tag ? { 'apns-collapse-id': String(payload.tag).slice(0, 64) } : {}) },
      payload: { aps: { sound: 'default', ...(typeof payload.badge === 'number' ? { badge: payload.badge } : {}), 'thread-id': payload.tag ? String(payload.tag).split('-')[0] : undefined } },
    },
  };
  try {
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + (await accessToken()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (r.ok) return { ok: true, status: r.status };
    const err = await r.json().catch(() => ({}));
    const code = (err.error && err.error.details && err.error.details.map((d) => d.errorCode).find(Boolean)) || (err.error && err.error.status);
    return { ok: false, status: r.status, error: code || 'erreur', gone: r.status === 404 || code === 'UNREGISTERED' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { enabled, send };
