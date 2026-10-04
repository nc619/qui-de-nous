// Graphique radar (hexagone) en SVG, sans librairie.
// stats: [{ key, emoji, label }], values: { key: 0..100 }, compare: valeurs de comparaison (pointillés) ou null
window.radarSvg = function radarSvg(stats, values, color, compare) {
  const size = 300;
  const c = size / 2;
  const r = 100;
  const n = stats.length;
  const pt = (i, v) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [c + Math.cos(a) * r * v, c + Math.sin(a) * r * v];
  };
  const poly = (vals) => stats.map((s, i) => pt(i, Math.max(0.04, (vals[s.key] || 0) / 100)).map((x) => x.toFixed(1)).join(',')).join(' ');

  let out = `<svg class="radar" viewBox="0 0 ${size} ${size}" role="img" aria-label="Stats">`;
  for (const ring of [0.25, 0.5, 0.75, 1]) {
    out += `<polygon class="radar-ring" points="${stats.map((s, i) => pt(i, ring).join(',')).join(' ')}"/>`;
  }
  stats.forEach((s, i) => {
    const [x, y] = pt(i, 1);
    out += `<line class="radar-axis" x1="${c}" y1="${c}" x2="${x}" y2="${y}"/>`;
  });
  if (compare) out += `<polygon class="radar-compare" points="${poly(compare)}"/>`;
  out += `<polygon class="radar-shape" points="${poly(values)}" style="fill:${color}55;stroke:${color}"/>`;
  stats.forEach((s, i) => {
    const [x, y] = pt(i, Math.max(0.04, (values[s.key] || 0) / 100));
    out += `<circle cx="${x}" cy="${y}" r="4" style="fill:${color}"/>`;
  });
  stats.forEach((s, i) => {
    const [x, y] = pt(i, 1.28);
    out += `<text class="radar-emoji" x="${x}" y="${y - 6}" text-anchor="middle">${s.emoji}</text>`;
    out += `<text class="radar-label" x="${x}" y="${y + 12}" text-anchor="middle">${s.label} ${values[s.key] || 0}</text>`;
  });
  return out + '</svg>';
};
