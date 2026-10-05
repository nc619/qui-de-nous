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

// Durée de la plage (en heures, 1 à 23) : de startHour à endHour inclus. Si endHour est avant startHour,
// la plage déborde sur le lendemain (ex. 22 h → 6 h). endHour = startHour - 1 : questions 24 h/24.
function windowHours(s) {
  return ((((s.endHour - s.startHour) % 24) + 24) % 24) || 24;
}

// Créneaux de la plage qui commence ce jour-là : startHour, startHour + intervalle, … jusqu'à la fin incluse
// (éventuellement le lendemain).
function slotsForDay(year, month, day, s) {
  const step = Math.max(1, Math.round(s.intervalHours * 60));
  const start = s.startHour * 60;
  const end = start + Math.min(23, windowHours(s)) * 60;
  const out = [];
  for (let m = start; m <= end; m += step) out.push(zonedToUtc(year, month, day, m, s.timezone));
  return out;
}

function dayShift(ts, tz, days) {
  const p = zonedParts(ts, tz);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
}

// La plage de la veille peut encore tourner aujourd'hui (si elle passe minuit) : on regarde veille, jour, lendemain.
function latestSlot(now, s) {
  let best = 0;
  for (const shift of [-1, 0]) {
    for (const t of slotsForDay(...dayShift(now, s.timezone, shift), s)) if (t <= now && t > best) best = t;
  }
  return best;
}

function nextSlot(now, s) {
  let best = Infinity;
  for (const shift of [-1, 0, 1]) {
    for (const t of slotsForDay(...dayShift(now, s.timezone, shift), s)) if (t > now && t < best) best = t;
  }
  return best === Infinity ? null : best;
}

module.exports = { latestSlot, nextSlot, isValidTimezone, zonedParts, windowHours };
