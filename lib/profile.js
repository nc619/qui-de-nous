// Questionnaire de profil (option du groupe, activée par l'admin) : quelques questions générales sur chacun
// (âge, études/travail, couple…). Les réponses ne sont jamais montrées une par une : elles servent seulement
// à tirer plus souvent les questions qui collent au groupe, et moins souvent celles qui ne lui parlent pas
// (jamais à zéro : il reste toujours de la variété). Les questions de questions.md portent des étiquettes
// (#alcool, #couple…) ; une question sans étiquette a toujours le même poids.

// [clé, français, anglais, espagnol] — l'anglais (et l'espagnol) sont omis quand c'est le même texte.
const ITEMS = [
  { key: 'gender', fr: 'Tu es…', en: 'You are…', es: 'Eres…', options: [['m', 'Un homme', 'A man', 'Un hombre'], ['f', 'Une femme', 'A woman', 'Una mujer'], ['x', 'Autre', 'Other', 'Otro']] },
  { key: 'age', fr: 'Ton âge', en: 'Your age', es: 'Tu edad', options: [['a1', '18–21'], ['a2', '22–25'], ['a3', '26–30'], ['a4', '31–40'], ['a5', '41 et +', '41+', '41 o más']] },
  { key: 'occupation', fr: 'En ce moment, tu…', en: 'Right now, you…', es: 'Ahora mismo…', options: [['study', 'Étudies', 'Study', 'Estudias'], ['work', 'Travailles', 'Work', 'Trabajas'], ['both', 'Les deux', 'Both', 'Las dos cosas'], ['other', 'Ni l’un ni l’autre', 'Neither', 'Ninguna de las dos']] },
  { key: 'couple', fr: 'Côté cœur', en: 'Love life', es: 'En el amor', options: [['single', 'Célibataire', 'Single', 'Sin pareja'], ['couple', 'En couple', 'Taken', 'En pareja'], ['complicated', 'C’est compliqué', 'It’s complicated', 'Es complicado']] },
  { key: 'living', fr: 'Tu vis…', en: 'You live…', es: 'Vives…', options: [['parents', 'Chez tes parents', 'With your parents', 'Con tus padres'], ['shared', 'En coloc', 'In a flatshare', 'En piso compartido'], ['alone', 'Seul·e', 'On your own', 'Por tu cuenta'], ['partner', 'Avec ta moitié', 'With your partner', 'Con tu pareja']] },
  { key: 'drink', fr: 'L’alcool', en: 'Drinking', es: 'El alcohol', options: [['never', 'Jamais', 'Never', 'Nunca'], ['some', 'De temps en temps', 'Now and then', 'De vez en cuando'], ['often', 'Volontiers', 'Happily', 'Sin problema']] },
  { key: 'party', fr: 'Sortir faire la fête', en: 'Going out', es: 'Salir de fiesta', options: [['rarely', 'Rarement', 'Rarely', 'Poco'], ['some', 'Parfois', 'Sometimes', 'A veces'], ['often', 'Souvent', 'Often', 'Mucho']] },
  { key: 'gaming', fr: 'Les jeux vidéo', en: 'Video games', es: 'Los videojuegos', options: [['no', 'Pas trop', 'Not really', 'No mucho'], ['some', 'Un peu', 'A bit', 'Un poco'], ['lot', 'À fond', 'Big time', 'A tope']] },
  { key: 'sport', fr: 'Le sport', en: 'Sport', es: 'El deporte', options: [['no', 'Pas trop', 'Not really', 'No mucho'], ['some', 'Un peu', 'A bit', 'Un poco'], ['lot', 'À fond', 'Big time', 'A tope']] },
  { key: 'drive', fr: 'Tu conduis ?', en: 'Do you drive?', es: '¿Conduces?', options: [['yes', 'Oui', 'Yes', 'Sí'], ['no', 'Non', 'No', 'No']] },
  { key: 'kids', fr: 'Tu as des enfants ?', en: 'Got kids?', es: '¿Tienes hijos?', options: [['no', 'Non', 'No', 'No'], ['yes', 'Oui', 'Yes', 'Sí']] },
];
const BY_KEY = Object.fromEntries(ITEMS.map((i) => [i.key, i]));

// Étiquette → qui est concerné. Une question #couple parle de copains/copines : moins souvent si presque
// tout le monde est célibataire.
const TAGS = {
  alcool: ['drink', ['some', 'often']],
  soiree: ['party', ['some', 'often']],
  couple: ['couple', ['couple', 'complicated']],
  celib: ['couple', ['single', 'complicated']],
  etudes: ['occupation', ['study', 'both']],
  travail: ['occupation', ['work', 'both']],
  gaming: ['gaming', ['some', 'lot']],
  sport: ['sport', ['some', 'lot']],
  voiture: ['drive', ['yes']],
  coloc: ['living', ['shared']],
  parents: ['living', ['parents']],
  enfants: ['kids', ['yes']],
  homme: ['gender', ['m']],
  femme: ['gender', ['f']],
  jeune: ['age', ['a1', 'a2']],
  adulte: ['age', ['a3', 'a4', 'a5']],
  mixte: null, // groupe mixte (des hommes ET des femmes)
};

// Réponses nettoyées : seulement des clés et options connues (une réponse absente = « je préfère ne pas dire »).
function clean(input) {
  const out = {};
  for (const [k, v] of Object.entries(input || {})) {
    const item = BY_KEY[k];
    if (item && item.options.some(([o]) => o === v)) out[k] = v;
  }
  return out;
}

// Membres qui comptent : ceux qui ont rejoint le groupe.
const members = (g) => Object.values(g.users).filter((u) => !u.disabled && u.playerId);

// Part du groupe concernée par une étiquette (0 à 1), ou null si personne n'a répondu à la question liée.
// Ceux qui n'ont pas répondu comptent pour moitié (on ne sait pas).
function share(g, tag) {
  const list = members(g);
  if (!list.length) return null;
  const answers = list.map((u) => ((g.profiles || {})[u.id] || {}).answers || {});
  if (tag === 'mixte') {
    const known = answers.map((a) => a.gender).filter(Boolean);
    if (known.length < 2) return null;
    const m = known.filter((x) => x === 'm').length / known.length;
    const f = known.filter((x) => x === 'f').length / known.length;
    return Math.min(1, 3 * Math.min(m, f)); // un tiers de filles (ou de garçons) suffit pour être « mixte »
  }
  const rule = TAGS[tag];
  if (!rule) return null;
  const [item, yes] = rule;
  const known = answers.filter((a) => a[item]);
  if (!known.length) return null;
  const hits = known.filter((a) => yes.includes(a[item])).length;
  return (hits + 0.5 * (list.length - known.length)) / list.length;
}

// Poids d'une question (1 = normal) : de 0,2 (personne n'est concerné) à 1,2 (tout le monde l'est).
// Calculé une fois par tirage : renvoie une fonction question → poids.
function relevance(g) {
  if (!g.settings.profiles) return () => 1;
  const cache = new Map();
  const factor = (tag) => {
    if (!cache.has(tag)) {
      const s = share(g, tag);
      cache.set(tag, s == null ? 1 : 0.2 + s);
    }
    return cache.get(tag);
  };
  return (q) => (q.tags || []).reduce((w, t) => w * factor(t), 1);
}

// Résumé anonyme du groupe (affiché dans l'onglet) : pour chaque question, combien ont choisi chaque option.
// Rien n'est montré tant que moins de 3 personnes ont répondu (sinon on devinerait qui a dit quoi).
function summary(g) {
  const list = members(g);
  const answers = list.map((u) => ((g.profiles || {})[u.id] || {}).answers || {});
  const answered = answers.filter((a) => Object.keys(a).length).length;
  const items = {};
  if (answered >= 3) {
    for (const item of ITEMS) {
      const counts = {};
      for (const a of answers) if (a[item.key]) counts[a[item.key]] = (counts[a[item.key]] || 0) + 1;
      items[item.key] = counts;
    }
  }
  return { members: list.length, answered, items };
}

// Effet sur le tirage (part du groupe concernée par chaque étiquette), montré seulement à partir de 3 réponses.
function effects(g) {
  if (!g.settings.profiles || summary(g).answered < 3) return {};
  const out = {};
  for (const tag of Object.keys(TAGS)) {
    const s = share(g, tag);
    if (s != null) out[tag] = Math.round(s * 100) / 100;
  }
  return out;
}

// Pour l'app : les questions dans les deux langues.
function items() {
  return ITEMS.map((i) => ({ key: i.key, fr: i.fr, en: i.en, es: i.es, options: i.options.map(([k, fr, en, es]) => ({ key: k, fr, en: en || fr, es: es || en || fr })) }));
}

module.exports = { ITEMS, TAGS, clean, relevance, summary, share, items, effects };
