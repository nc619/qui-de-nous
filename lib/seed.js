// Lecture de questions.md : les sets et questions intégrés, éditables à la main.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'questions.md');

function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'set';
}

function parseQuestions(md) {
  const sets = [];
  let cur = null;
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('## ')) {
      let header = line.slice(3).trim();
      const spicy = /[·•-]?\s*18\+\s*$/.test(header);
      header = header.replace(/[·•-]?\s*18\+\s*$/, '').trim();
      const [first, ...rest] = header.split(/\s+/);
      const hasEmoji = rest.length && !/\p{L}/u.test(first);
      cur = { id: null, emoji: hasEmoji ? first : '✨', name: hasEmoji ? rest.join(' ') : header, description: '', spicy, questions: [] };
      sets.push(cur);
      continue;
    }
    if (!cur) continue;
    const id = line.match(/^<!--\s*id:\s*([\w-]+)\s*-->$/);
    if (id) cur.id = id[1];
    else if (line.startsWith('>')) cur.description = line.slice(1).trim();
    else if (line.startsWith('- ')) {
      const m = line.slice(2).match(/^(.*?)\s*(?:`([^`]*)`)?\s*$/);
      const text = m[1].replace(/\s+/g, ' ').trim();
      if (text.length >= 5) cur.questions.push([text, m[2] || '']);
    }
  }
  const seen = new Set();
  for (const s of sets) {
    s.id = s.id || slug(s.name);
    if (seen.has(s.id)) console.warn(`questions.md : l'id de set « ${s.id} » est utilisé deux fois`);
    seen.add(s.id);
  }
  return sets;
}

function loadSeed() {
  if (!fs.existsSync(FILE)) {
    console.warn('questions.md introuvable : aucun set intégré.');
    return [];
  }
  return parseQuestions(fs.readFileSync(FILE, 'utf8'));
}

module.exports = { loadSeed, parseQuestions };
