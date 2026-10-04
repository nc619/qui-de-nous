// Calcul des créneaux de drop automatique dans le fuseau du groupe (sans dépendance).

const formatters = new Map();
function formatter(tz) {
  if (!formatters.has(tz)) {
    formatters.set(tz, new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }));
  }
  return formatters.get(tz);
}

function zonedParts(ts, tz) {
  const p = {};
  for (const { type, value } of formatter(tz).formatToParts(new Date(ts))) p[type] = Number(value);
  return p; // { year, month, day, hour, minute, second }
}

// Décalage (ms) du fuseau par rapport à UTC à l'instant ts.
function offset(ts, tz) {
  const p = zonedParts(ts, tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ts / 1000) * 1000;
}

// Heure locale (dans tz) → timestamp UTC.
function zonedToUtc(year, month, day, minutes, tz) {
  const guess = Date.UTC(year, month - 1, day, 0, minutes);
  const first = guess - offset(guess, tz);
  return guess - offset(first, tz);
}

function isValidTimezone(tz) {
  try {
    formatter(tz);
    return true;
  } catch {
    return false;
  }
}

// Créneaux d'une journée locale : startHour, startHour + intervalle, … jusqu'à endHour inclus.
function slotsForDay(year, month, day, s) {
  const step = Math.max(1, Math.round(s.intervalHours * 60));
  const out = [];
  for (let m = s.startHour * 60; m <= s.endHour * 60; m += step) out.push(zonedToUtc(year, month, day, m, s.timezone));
  return out;
}

function dayShift(ts, tz, days) {
  const p = zonedParts(ts, tz);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
}

function latestSlot(now, s) {
  let best = 0;
  for (const shift of [-1, 0]) {
    for (const t of slotsForDay(...dayShift(now, s.timezone, shift), s)) if (t <= now && t > best) best = t;
  }
  return best;
}

function nextSlot(now, s) {
  let best = Infinity;
  for (const shift of [0, 1]) {
    for (const t of slotsForDay(...dayShift(now, s.timezone, shift), s)) if (t > now && t < best) best = t;
  }
  return best === Infinity ? null : best;
}

module.exports = { latestSlot, nextSlot, isValidTimezone, zonedParts };
