// Temps réel : connexions Server-Sent Events par groupe (messages, "en train d'écrire", lu, rafraîchissements)
// + présence : qui a l'app ouverte À L'ÉCRAN en ce moment (sert à ne pas envoyer de notif inutile).
const conns = new Map(); // groupId -> Set<{ res, userId }>
const seen = new Map(); // "groupId:userId" -> dernier signal "app visible" (ms)
const PRESENCE_TTL = 45 * 1000;

function connect(groupId, userId, req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(': ok\n\n');
  if (!conns.has(groupId)) conns.set(groupId, new Set());
  const c = { res, userId };
  conns.get(groupId).add(c);
  req.on('close', () => conns.get(groupId)?.delete(c));
}

function emit(groupId, type, data, exceptUserId = null) {
  const set = conns.get(groupId);
  if (!set) return;
  const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of set) if (c.userId !== exceptUserId) c.res.write(payload);
}

// Le client envoie un signal toutes les ~20 s tant que l'app est à l'écran, et "visible: false" quand il la quitte.
// On ne se fie pas à la connexion temps réel : sur mobile elle peut rester "ouverte" côté serveur
// alors que l'app est en arrière-plan, ce qui bloquait les notifications.
function presence(groupId, userId, visible) {
  const key = `${groupId}:${userId}`;
  if (visible) seen.set(key, Date.now());
  else seen.delete(key);
}

function online(groupId, userId) {
  const t = seen.get(`${groupId}:${userId}`);
  return !!t && Date.now() - t < PRESENCE_TTL;
}

// Ping régulier pour que les proxys ne coupent pas les connexions inactives.
setInterval(() => {
  for (const set of conns.values()) for (const c of set) c.res.write(': ping\n\n');
}, 25000).unref();

module.exports = { connect, emit, presence, online };
