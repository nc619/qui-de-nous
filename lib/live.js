// Temps réel : connexions Server-Sent Events par groupe (messages, "en train d'écrire", lu, rafraîchissements).
const conns = new Map(); // groupId -> Set<{ res, userId }>

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

// L'app n'est connectée que lorsqu'elle est ouverte et visible (le client se déconnecte en arrière-plan).
function online(groupId, userId) {
  const set = conns.get(groupId);
  if (!set) return false;
  for (const c of set) if (c.userId === userId) return true;
  return false;
}

// Ping régulier pour que les proxys ne coupent pas les connexions inactives.
setInterval(() => {
  for (const set of conns.values()) for (const c of set) c.res.write(': ping\n\n');
}, 25000).unref();

module.exports = { connect, emit, online };
