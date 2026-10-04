// Recherche de GIFs via Giphy (GIPHY_API_KEY) ou Tenor (TENOR_API_KEY). La clé reste côté serveur.
const { HttpError } = require('./game');

const GIPHY = process.env.GIPHY_API_KEY;
const TENOR = process.env.TENOR_API_KEY;
const cache = new Map(); // requête -> { at, results }
const TTL = 10 * 60 * 1000;

// Seules les images de ces domaines sont acceptées dans les messages.
const ALLOWED_HOSTS = [/(^|\.)giphy\.com$/, /(^|\.)tenor\.com$/];

function enabled() {
  return !!(GIPHY || TENOR);
}

function provider() {
  return GIPHY ? 'giphy' : TENOR ? 'tenor' : null;
}

async function giphy(q) {
  const endpoint = q ? 'search' : 'trending';
  const url = `https://api.giphy.com/v1/gifs/${endpoint}?api_key=${GIPHY}&limit=24&rating=r&lang=fr${q ? '&q=' + encodeURIComponent(q) : ''}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Giphy ' + r.status);
  const data = await r.json();
  return data.data
    .map((g) => {
      const full = g.images.fixed_width || g.images.downsized;
      const small = g.images.fixed_width_small || full;
      return full && { url: full.url, w: Number(full.width), h: Number(full.height), preview: small.url };
    })
    .filter(Boolean);
}

async function tenor(q) {
  const endpoint = q ? 'search' : 'featured';
  const url = `https://tenor.googleapis.com/v2/${endpoint}?key=${TENOR}&limit=24&locale=fr_FR&contentfilter=off&media_filter=tinygif,gif${q ? '&q=' + encodeURIComponent(q) : ''}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Tenor ' + r.status);
  const data = await r.json();
  return data.results
    .map((g) => {
      const full = g.media_formats.gif || g.media_formats.tinygif;
      const small = g.media_formats.tinygif || full;
      return full && { url: full.url, w: full.dims[0], h: full.dims[1], preview: small.url };
    })
    .filter(Boolean);
}

async function search(query) {
  if (!enabled()) throw new HttpError(503, 'Les GIFs ne sont pas encore configurés (clé API manquante).');
  const q = String(query || '').trim().slice(0, 50).toLowerCase();
  const hit = cache.get(q);
  if (hit && Date.now() - hit.at < TTL) return hit.results;
  let results;
  try {
    results = GIPHY ? await giphy(q) : await tenor(q);
  } catch (e) {
    console.error('Recherche de GIF échouée :', e.message);
    throw new HttpError(502, 'La recherche de GIFs ne répond pas, réessaie.');
  }
  cache.set(q, { at: Date.now(), results });
  if (cache.size > 300) cache.delete(cache.keys().next().value);
  return results;
}

function cleanGif(gif) {
  try {
    const u = new URL(gif.url);
    if (u.protocol !== 'https:' || !ALLOWED_HOSTS.some((re) => re.test(u.hostname))) return null;
    const w = Math.max(1, Math.min(1000, Math.round(Number(gif.w) || 200)));
    const h = Math.max(1, Math.min(1000, Math.round(Number(gif.h) || 200)));
    return { url: u.href, w, h };
  } catch {
    return null;
  }
}

module.exports = { enabled, provider, search, cleanGif };
