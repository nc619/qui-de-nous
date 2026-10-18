// "Whomst" — client.
(() => {
  const SET_EMOJIS = ['✨', '🎉', '💀', '🔮', '🤡', '💔', '🧟', '🧠', '🤫', '📱', '🏆', '🚔', '✈️', '🌶️', '🔥', '😈', '🍻', '🏖️', '🎮', '⚽', '🎓', '💼', '🎤', '🍕'];

  const $app = document.getElementById('app');
  const $sheet = document.getElementById('sheet');
  const $toast = document.getElementById('toast');

  // App mobile (Capacitor) : l'interface est dans l'app, le serveur est à distance (config.js, écrit au build).
  // Sur le site web : tout est sur le même serveur (API = '').
  const CFG = window.QDN_CONFIG || {};
  const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const PLATFORM = NATIVE ? window.Capacitor.getPlatform() : 'web';
  const Plugins = (NATIVE && window.Capacitor.Plugins) || {};
  const API = CFG.api || '';
  const PUBLIC_URL = CFG.publicUrl || location.origin; // adresse des liens d'invitation et des pages légales
  // Petite vibration (retour haptique natif dans l'app, vibreur sur Android web).
  function buzz(ms = 10) {
    if (NATIVE && Plugins.Haptics) Plugins.Haptics.impact({ style: ms > 11 ? 'MEDIUM' : 'LIGHT' }).catch(() => {});
    else if (navigator.vibrate) navigator.vibrate(ms);
  }

  let token = load('token');
  let state = null;
  let skew = 0; // décalage horloge serveur - client
  let tab = load('tab') || 'live';
  let editing = null; // sondage dont on change le vote
  let openSet = null; // set ouvert dans l'onglet Sets
  let setDetail = null;
  let statsPlayer = null;
  let archiveSet = '';
  let archiveExtra = null; // { items, hasMore } quand on filtre / charge plus
  let liveMode = load('liveMode') === 'archive' ? 'archive' : 'live';
  if (tab === 'archive') { tab = 'live'; liveMode = 'archive'; }
  const chats = new Map(); // canal -> { messages, reads, hasMore, loaded }
  const typing = new Map(); // canal -> Map(playerId -> expire)
  let chatOpen = null; // canal affiché dans la fenêtre de chat
  let pendingChat = new URLSearchParams(location.search).get('chat');
  let pollTimer = null;
  let swReg = null;
  let inviteCode = new URLSearchParams(location.search).get('code');
  let pendingGroup = new URLSearchParams(location.search).get('g'); // groupe à ouvrir (lien d'une notification)
  let pendingRecap = new URLSearchParams(location.search).get('recap'); // récap du mois à ouvrir (notification)
  let pendingNews = new URLSearchParams(location.search).has('news'); // nouveautés (notification de nouvelle version)
  let pendingQuiz = new URLSearchParams(location.search).has('quiz'); // l'admin demande de remplir le questionnaire
  let pendingFeedback = new URLSearchParams(location.search).has('feedback'); // avis reçu (développeur)
  // Fuseau horaire de ce téléphone : toutes les heures sont affichées dans l'heure locale de chacun.
  const myTz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris'; } catch { return 'Europe/Paris'; } })();
  // Pas de lien : on revient là où on était (actualisation, app rouverte, page rechargée par le téléphone).
  // Le groupe n'est oublié que quand on revient soi-même à l'accueil.
  let restoring = !pendingGroup && !!load('group');
  if (restoring) pendingGroup = load('group');
  let account = null; // accueil : { account, groups, vapidKey }
  let groupId = null; // groupe ouvert (null = accueil)
  const openPolls = new Set(); // sondages déjà votés / archivés dépliés par l'utilisateur
  const openVoters = new Set(); // barres de résultats dont on a déroulé la liste des votants ("sondage:personne")
  let animating = false; // animation de vote en cours
  let pendingRender = false;
  let flashId = null;
  let doneFolded = load('doneFolded') === '1'; // section « Déjà voté » repliée
  let statsMode = load('statsMode') || 'me'; // onglet Stats : 'me' (profil), 'duo' (affinités), 'group'
  let halfPick = null; // { pollId, picks: [playerId] } : demi-vote en cours (« j'hésite »)

  // ---------- Langue (français / anglais / espagnol) ----------
  // Par défaut : la langue du lien d'où on vient (/en → anglais, /es → espagnol, sinon français). On peut changer
  // dans Moi. Le choix est gardé sur l'appareil ; ouvrir un lien /en ou /es y repasse tant qu'on n'a pas choisi soi-même.
  const LANGS = ['fr', 'en', 'es'];
  const pathLang = (/^\/(en|es)(\/|$)/.exec(location.pathname) || [])[1] || (['en', 'es'].includes(document.documentElement.dataset.lang) ? document.documentElement.dataset.lang : null);
  // App mobile : la langue du téléphone (français, espagnol, sinon anglais).
  const phoneLang = NATIVE ? (/^fr/i.test(navigator.language || '') ? 'fr' : /^es/i.test(navigator.language || '') ? 'es' : 'en') : null;
  let LANG = load('lang') || pathLang || phoneLang || 'fr';
  if (pathLang && !load('langPicked')) LANG = pathLang;
  if (!LANGS.includes(LANG)) LANG = 'fr';
  save('lang', LANG);
  const BASE = pathLang ? `/${pathLang}/` : '/';
  const LOCALES = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES' };
  let L = LANG === 'en'; // anglais (pluriels et nombres à l'anglaise)
  let ES = LANG === 'es';
  let LOC = LOCALES[LANG];
  // Texte dans la langue de l'app : T('français', 'english', 'español').
  const T = (fr, en, es) => (LANG === 'en' ? en : LANG === 'es' ? (es ?? en) : fr);
  function applyLang() {
    L = LANG === 'en';
    ES = LANG === 'es';
    LOC = LOCALES[LANG];
    document.documentElement.lang = LANG;
  }
  applyLang();
  function setLang(lang) {
    LANG = LANGS.includes(lang) ? lang : 'fr';
    save('lang', LANG);
    save('langPicked', '1');
    applyLang();
  }
  const langLink = (lang) => (lang === 'fr' ? '/' : `/${lang}/`);
  // Textes qui existent dans plusieurs langues (questions intégrées, sets, stats) : repli sur le français.
  const pick = (x, fr, en, es) => (x ? (L && x[en]) || (ES && (x[es] || x[en])) || x[fr] : '');
  const qText = (x) => pick(x, 'text', 'textEn', 'textEs') || '';
  const setName = (x) => pick(x, 'name', 'nameEn', 'nameEs');
  const setDesc = (x) => pick(x, 'description', 'descriptionEn', 'descriptionEs');
  const statLabel = (d) => (L && d.en ? d.en.label : ES && d.es ? d.es.label : d.label);
  const statTitle = (d) => (L && d.en ? d.en.title : ES && d.es ? d.es.title : d.title);
  const titleText = (t) => pick(t, 'title', 'titleEn', 'titleEs');
  // Nombre de votes (avec les demi-votes) : 2,5 → « 2½ ».
  const num = (n) => (Number.isInteger(n) ? String(n) : `${Math.floor(n) || ''}½`);

  // ---------- Utilitaires ----------

  function load(k) {
    try { return localStorage.getItem('qdn_' + k); } catch { return null; }
  }
  function save(k, v) {
    try {
      if (v == null) localStorage.removeItem('qdn_' + k);
      else localStorage.setItem('qdn_' + k, v);
    } catch { /* stockage indisponible */ }
  }

  const now = () => Date.now() + skew;

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Icônes au trait (prennent la couleur du texte) : plus sobres que des emojis.
  const ICONS = {
    live: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z"/>',
    sets: '<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/>',
    stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    me: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    comment: '<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z"/>',
    send: '<path d="M4 12 20 4l-6 16-3-7-7-1z"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    pen: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    reply: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    quiz: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  };
  function icon(name, cls = '') {
    return `<svg class="ico-svg ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  }

  function toast(msg) {
    $toast.textContent = msg;
    $toast.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => $toast.classList.remove('show'), 2600);
  }

  function confetti() {
    const bits = ['🎉', '✨', '💜', '🔥', '⭐', '🎊'];
    for (let i = 0; i < 18; i++) {
      const el = document.createElement('div');
      el.className = 'confetti';
      el.textContent = bits[i % bits.length];
      el.style.left = Math.random() * 100 + 'vw';
      el.style.animationDuration = 1.4 + Math.random() * 1.2 + 's';
      el.style.animationDelay = Math.random() * 0.3 + 's';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3000);
    }
  }

  function ago(t) {
    const s = Math.floor((now() - t) / 1000);
    if (s < 60) return T('à l’instant', 'just now', 'ahora mismo');
    const m = Math.floor(s / 60);
    if (m < 60) return T(`il y a ${m} min`, `${m} min ago`, `hace ${m} min`);
    const h = Math.floor(m / 60);
    if (h < 24) return T(`il y a ${h} h`, `${h}h ago`, `hace ${h} h`);
    const d = Math.floor(h / 24);
    if (d < 7) return T(`il y a ${d} j`, `${d}d ago`, `hace ${d} d`);
    return new Date(t).toLocaleDateString(LOC, { day: 'numeric', month: 'short' });
  }

  function left(t) {
    const m = Math.max(0, Math.round((t - now()) / 60000));
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    return h < 48 ? `${h} h ${String(m % 60).padStart(2, '0')}` : T(`${Math.floor(h / 24)} j`, `${Math.floor(h / 24)} days`, `${Math.floor(h / 24)} días`);
  }

  // Heures : toujours dans le fuseau de ce téléphone. La plage horaire du groupe est réglée dans le fuseau du
  // groupe : on la convertit (23 h à Paris = 22 h à Londres).
  function zParts(t, tz) {
    const p = {};
    for (const { type, value } of new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(t))) p[type] = Number(value);
    return p;
  }
  // Heure h (0–23) du fuseau tz, aujourd'hui → heure de ce téléphone (avec les minutes pour les décalages d'une demi-heure).
  function hourToLocal(h, tz) {
    if (!tz || tz === myTz) return h;
    try {
      const p = zParts(now(), tz);
      const off = (t) => { const q = zParts(t, tz); return Date.UTC(q.year, q.month - 1, q.day, q.hour, q.minute) - Math.floor(t / 60000) * 60000; };
      const guess = Date.UTC(p.year, p.month - 1, p.day, h, 0);
      const l = zParts(guess - off(guess - off(guess)), myTz);
      return l.hour + l.minute / 60;
    } catch { return h; }
  }

  function clock(t) {
    const opts = { hour: '2-digit', minute: '2-digit', timeZone: myTz };
    const d = new Date(t);
    const sameDay = d.toLocaleDateString('fr-FR', { timeZone: myTz }) === new Date(now()).toLocaleDateString('fr-FR', { timeZone: myTz });
    const time = d.toLocaleTimeString(LOC, opts);
    return (sameDay ? '' : T('demain ', 'tomorrow ', 'mañana ')) + (LANG === 'fr' ? time.replace(':', 'h') : time);
  }

  // « 3 sondages » / « 3 polls » (pluriel anglais irrégulier : donner la forme en 3e argument).
  const plural = (n, word, many) => `${n} ${n > 1 || (LANG !== 'fr' && n === 0) ? many || word + 's' : word}`;

  const NOBODY = { id: 'nobody', name: 'Personne', emoji: '∅', color: '#8a7aa8' };
  function player(id) {
    if (id === 'nobody') return { ...NOBODY, name: T('Personne', 'Nobody', 'Nadie') };
    return state.players.find((p) => p.id === id) || { id, name: '???', emoji: '👻', color: '#999999' };
  }
  function setOf(id) {
    return state.sets.find((s) => s.id === id) || { id, name: T('Set supprimé', 'Deleted set', 'Set eliminado'), emoji: '🗑️', spicy: false };
  }
  // Un vote : "id" (entier) ou ["a", "b"] (demi-votes).
  const votedFor = (v, id) => (Array.isArray(v) ? v.includes(id) : v === id);
  const me = () => player(state.me.playerId);

  // Avatar : la photo de la personne, sinon son animal par défaut, toujours sur sa couleur.
  function avatar(p, size = '') {
    if (p.id === 'nobody') return `<span class="avatar ${size} nobody-av" title="${T('Personne', 'Nobody', 'Nadie')}">∅</span>`;
    const inner = p.photo
      ? `<img src="${API}/api/photos/${esc(p.id)}?v=${esc(p.photo)}" alt="" loading="lazy" decoding="async">`
      : `<svg viewBox="0 0 64 64" aria-hidden="true"><use href="#an-${Number(p.animal) || 0}"/></svg>`;
    return `<span class="avatar ${size} ${p.photo ? 'has-photo' : ''}" style="--pc:${esc(p.color)}" title="${esc(p.name)}">${inner}</span>`;
  }

  // Photo choisie sur le téléphone → écran de recadrage (zoom + déplacement) → carré 256 px (JPEG).
  function pickPhoto() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file) return resolve(null);
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => cropPhoto(img).then((data) => { URL.revokeObjectURL(url); resolve(data); });
        img.onerror = () => {
          URL.revokeObjectURL(url);
          toast(T('Image illisible', 'Can’t read that image', 'No se puede leer la imagen'));
          resolve(null);
        };
        img.src = url;
      };
      input.click();
    });
  }

  // Recadrage : pincer / molette / curseur pour zoomer, glisser pour placer la photo dans le cercle.
  function cropPhoto(img) {
    return new Promise((resolve) => {
      const W = img.naturalWidth;
      const H = img.naturalHeight;
      const V = Math.min(300, window.innerWidth - 72); // taille de la zone de recadrage
      const base = V / Math.min(W, H); // échelle où la photo couvre juste le cercle
      const MAX = 5;
      let zoom = 1;
      let x = (V - W * base) / 2; // position du coin haut-gauche de la photo dans la zone
      let y = (V - H * base) / 2;
      let done = false;
      const finish = (v) => { if (!done) { done = true; resolve(v); } };

      openSheet(`
        <div class="sheet-head"><h2>${T('Ta photo', 'Your photo', 'Tu foto')}</h2><button class="x" data-close>✕</button></div>
        <p class="muted small crop-hint">${T('Pince ou utilise le curseur pour zoomer, glisse pour placer.', 'Pinch or use the slider to zoom, drag to move it.', 'Pellizca o usa la barra para hacer zoom, arrastra para colocarla.')}</p>
        <div class="crop-box" id="cropBox" style="width:${V}px;height:${V}px">
          <img id="cropImg" src="${img.src}" alt="" draggable="false">
          <div class="crop-ring"></div>
        </div>
        <div class="crop-zoom">
          <span>−</span>
          <input type="range" id="cropZoom" min="1" max="${MAX}" step="0.01" value="1" aria-label="Zoom">
          <span>+</span>
        </div>
        <button class="btn btn-main btn-block" id="cropOk">${T('Valider', 'Done', 'Listo')}</button>`, (root) => {
        const box = root.querySelector('#cropBox');
        const el = root.querySelector('#cropImg');
        const slider = root.querySelector('#cropZoom');

        const clamp = () => {
          const s = base * zoom;
          x = Math.min(0, Math.max(V - W * s, x));
          y = Math.min(0, Math.max(V - H * s, y));
        };
        const paint = () => {
          clamp();
          el.style.transform = `translate(${x}px, ${y}px) scale(${base * zoom})`;
          slider.value = zoom;
        };
        // Zoom en gardant fixe le point (px, py) de la zone (le centre, ou le milieu des deux doigts).
        const zoomTo = (z, px = V / 2, py = V / 2) => {
          z = Math.min(MAX, Math.max(1, z));
          const s0 = base * zoom;
          const s1 = base * z;
          x = px - ((px - x) / s0) * s1;
          y = py - ((py - y) / s0) * s1;
          zoom = z;
          paint();
        };

        const pts = new Map();
        let last = null; // { x, y, dist } du geste en cours
        const local = (e) => { const r = box.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
        const gesture = () => {
          const p = [...pts.values()];
          if (p.length === 1) return { x: p[0][0], y: p[0][1], dist: 0 };
          return { x: (p[0][0] + p[1][0]) / 2, y: (p[0][1] + p[1][1]) / 2, dist: Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]) };
        };
        box.addEventListener('pointerdown', (e) => {
          try { box.setPointerCapture(e.pointerId); } catch { /* pas grave : on suit quand même le doigt */ }
          pts.set(e.pointerId, local(e));
          last = gesture();
        });
        box.addEventListener('pointermove', (e) => {
          if (!pts.has(e.pointerId)) return;
          pts.set(e.pointerId, local(e));
          const g = gesture();
          if (last && pts.size >= 2 && last.dist && g.dist) zoomTo(zoom * (g.dist / last.dist), g.x, g.y);
          if (last) { x += g.x - last.x; y += g.y - last.y; paint(); }
          last = g;
        });
        const up = (e) => { pts.delete(e.pointerId); last = pts.size ? gesture() : null; };
        box.addEventListener('pointerup', up);
        box.addEventListener('pointercancel', up);
        box.addEventListener('wheel', (e) => {
          e.preventDefault();
          const [px, py] = local(e);
          zoomTo(zoom * Math.exp(-e.deltaY * 0.0015), px, py);
        }, { passive: false });
        slider.oninput = () => zoomTo(Number(slider.value));

        root.querySelector('#cropOk').onclick = () => {
          const s = base * zoom;
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 256;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, 256, 256);
          ctx.drawImage(img, -x / s, -y / s, V / s, V / s, 0, 0, 256, 256);
          finish(canvas.toDataURL('image/jpeg', 0.85));
          closeSheet();
        };
        // Fermée sans valider (✕, fond, bouton retour) → pas de nouvelle photo.
        const obs = new MutationObserver(() => { if ($sheet.hidden || !$sheet.contains(box)) { obs.disconnect(); finish(null); } });
        obs.observe($sheet, { attributes: true, childList: true });
        paint();
      });
    });
  }

  function setBadge(s) {
    return `<span class="set-badge ${s.spicy ? 'spicy' : ''}">${esc(s.emoji)} ${esc(setName(s))}${s.spicy ? ' · 18+' : ''}</span>`;
  }

  function emojiGrid(list, selected) {
    return `<div class="emoji-grid">${list.map((e) => `<button type="button" data-emoji="${e}" class="${e === selected ? 'on' : ''}">${e}</button>`).join('')}</div>`;
  }

  function bindEmojiGrid(root, onPick) {
    root.querySelectorAll('[data-emoji]').forEach((b) => {
      b.onclick = () => {
        root.querySelectorAll('[data-emoji]').forEach((x) => x.classList.toggle('on', x === b));
        onPick(b.dataset.emoji);
      };
    });
  }

  async function api(method, url, body) {
    let res;
    try {
      res = await fetch(API + '/api/' + url, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Lang': LANG, ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(groupId ? { 'X-Group': groupId } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new Error(T('Pas de connexion au serveur 📡', 'Can’t reach the server 📡', 'Sin conexión con el servidor 📡'));
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && token && !/^(login|accounts|account\/recover|account\/link)/.test(url) && !(url === 'account' && method === 'PATCH')) {
      logoutLocal();
      throw new Error(T('Session expirée, reconnecte-toi', 'Session expired, log in again', 'Sesión caducada, vuelve a entrar'));
    }
    if (res.status === 403 && data.code === 'no-group' && groupId) {
      leaveGroup();
      throw new Error(data.error);
    }
    if (!res.ok) throw new Error(data.error || (res.status === 413 ? T('Trop lourd 😬', 'Too big 😬', 'Pesa demasiado 😬') : T('Oups, erreur', 'Oops, something broke', 'Ups, algo ha fallado')));
    return data;
  }

  // Petit helper : bouton qui appelle une action async, désactivé pendant l'appel.
  function action(el, fn) {
    if (!el) return;
    el.onclick = async (e) => {
      e.preventDefault();
      if (el.disabled) return;
      el.disabled = true;
      try {
        await fn(e);
      } catch (err) {
        toast(err.message);
      } finally {
        el.disabled = false;
      }
    };
  }

  // ---------- Compte ----------
  // Un compte par personne, créé tout seul au premier lancement : rien à inventer (ni identifiant, ni PIN).
  // En rejoignant un groupe, on reçoit un identifiant par défaut (« nico_4821 », modifiable). Le PIN est optionnel :
  // il sert à se connecter sur un autre téléphone. Compte perdu : on rejoint le groupe avec son code et on choisit
  // son nom (déjà pris) → l'admin (ou, pour l'admin, les autres membres) valide que c'est bien nous.

  // Mémoire locale : le dernier état connu (accueil, groupes) est affiché tout de suite au lancement,
  // puis mis à jour dès que le serveur répond. Plus d'écran d'attente à chaque ouverture.
  const CACHE_V = 2;
  let stale = false; // ce qui est affiché vient de la mémoire locale (pas encore rafraîchi)
  function cacheGet(k) {
    try {
      const x = JSON.parse(load('c_' + k) || 'null');
      return x && x.v === CACHE_V ? x.d : null;
    } catch { return null; }
  }
  function cachePut(k, d) {
    try {
      const s = JSON.stringify({ v: CACHE_V, d });
      if (s.length < 1500000) save('c_' + k, s);
    } catch { /* plein ou indisponible : tant pis */ }
  }
  function cacheClear(keep) {
    try {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith('qdn_c_') && !(keep && keep(k.slice(6)))) localStorage.removeItem(k);
      }
    } catch { /* rien */ }
  }

  // Écran d'attente (rare grâce à la mémoire locale) : fond normal, logo qui n'apparaît qu'après un instant.
  const splash = () => '<div class="splash"><span class="splash-logo">🤔</span></div>';

  // Pas encore de compte sur ce téléphone.
  function renderWelcome(err = '') {
    stopPolling();
    stopLobbyPolling();
    closeSheet();
    $app.innerHTML = `
      <div class="auth">
        <div class="auth-box welcome">
          ${langSwitch('auth-lang')}
          <span class="logo-emoji">🤔</span>
          <h1 class="logo">Whomst</h1>
          <p class="tagline">${T('Des questions sur ta bande, plusieurs fois par jour. Tout le monde vote. Verdicts sans pitié.', 'Questions about your crew, a few times a day. Everyone votes. No mercy.', 'Preguntas sobre tu peña, varias veces al día. Vota todo el mundo. Veredictos sin piedad.')}</p>
          <button class="btn btn-main btn-block" id="wJoin">${T('Rejoindre un groupe', 'Join a group', 'Unirme a un grupo')}</button>
          <button class="btn btn-soft btn-block" id="wCreate">${T('Créer un groupe', 'Create a group', 'Crear un grupo')}</button>
          <button class="link-btn welcome-login" id="wLogin">${T('J’ai déjà un compte', 'I already have an account', 'Ya tengo cuenta')}</button>
          <p class="legal-line">${T(`En continuant, tu acceptes les <a href="${PUBLIC_URL}/terms" target="_blank" rel="noopener">conditions</a> et la <a href="${PUBLIC_URL}/privacy" target="_blank" rel="noopener">politique de confidentialité</a>. 17 ans et +.`, `By continuing, you accept the <a href="${PUBLIC_URL}/en/terms" target="_blank" rel="noopener">terms</a> and the <a href="${PUBLIC_URL}/en/privacy" target="_blank" rel="noopener">privacy policy</a>. Ages 17+.`, `Al continuar, aceptas las <a href="${PUBLIC_URL}/es/terms" target="_blank" rel="noopener">condiciones</a> y la <a href="${PUBLIC_URL}/es/privacy" target="_blank" rel="noopener">política de privacidad</a> (en inglés). Mayores de 17 años.`)}</p>
          <p class="error" id="authErr">${esc(err)}</p>
        </div>
      </div>`;
    bindLangSwitch($app, () => renderWelcome());
    const go = (then) => async (e) => {
      const b = e.currentTarget;
      b.disabled = true;
      try {
        await ensureAccount();
        renderLobby();
        then();
      } catch (ex) {
        document.getElementById('authErr').textContent = ex.message;
        b.disabled = false;
      }
    };
    document.getElementById('wJoin').onclick = go(() => openJoinSheet());
    document.getElementById('wCreate').onclick = go(() => openCreateSheet());
    document.getElementById('wLogin').onclick = () => renderAuth('login');
  }

  // Compte créé en silence (premier vrai geste : rejoindre / créer un groupe, ou lien d'invitation).
  async function ensureAccount() {
    if (token) return;
    const data = await api('POST', 'accounts', { lang: LANG });
    token = data.token;
    save('token', token);
    save('joined', '1');
    if (!(await loadAccount())) throw new Error(T('Impossible de créer ton compte. Réessaie.', 'Couldn’t create your account. Try again.', 'No se ha podido crear tu cuenta. Inténtalo otra vez.'));
  }

  // Connexion sur un autre téléphone : identifiant + PIN. 'legacy' : compte d'avant (code du groupe + pseudo + PIN).
  function renderAuth(mode = 'login', err = '') {
    removeFab();
    stopPolling();
    stopLobbyPolling();
    closeSheet();
    const draw = () => {
      const fields = mode === 'login' ? `
          <label for="username">${T('Identifiant', 'Username', 'Usuario')}</label>
          <input class="input" id="username" required maxlength="20" autocapitalize="none" autocomplete="username" spellcheck="false" placeholder="${T('Ex : nico_4821', 'e.g. nico_4821', 'Ej.: nico_4821')}" value="${esc(load('username') || '')}">
          ${pinField(T('PIN', 'PIN', 'PIN'))}` : `
          <div class="info">${T('Tu avais un compte avant la mise à jour ? Connecte-toi comme avant : code du groupe, pseudo et PIN.', 'Had an account before the update? Log in like before: group code, name and PIN.', '¿Tenías cuenta antes de la actualización? Entra como antes: código del grupo, nombre y PIN.')}</div>
          <label for="code">${T('Code du groupe', 'Group code', 'Código del grupo')}</label>
          <input class="input code-input" id="code" required autocapitalize="characters" autocomplete="off" maxlength="12" placeholder="Ex : K7QM2P" value="${esc(load('code') || '')}">
          <label for="name">${T('Pseudo dans ce groupe', 'Your name in that group', 'Tu nombre en ese grupo')}</label>
          <input class="input" id="name" required maxlength="24" value="${esc(load('lastName') || '')}">
          ${pinField(T('PIN', 'PIN', 'PIN'))}`;
      $app.innerHTML = `
        <div class="auth">
          <form class="auth-box" id="authForm" autocomplete="on">
            ${langSwitch('auth-lang')}
            <button type="button" class="back" id="authBack">← ${T('Retour', 'Back', 'Volver')}</button>
            <h1 class="logo auth-title">${mode === 'login' ? T('Connexion', 'Log in', 'Entrar') : T('Ancien compte', 'Older account', 'Cuenta antigua')}</h1>
            ${mode === 'login' ? `<p class="tagline">${T('Ton identifiant est dans Mes groupes → Mon compte, sur ton autre téléphone (avec le PIN que tu y as mis).', 'Your username is in My groups → My account, on your other phone (with the PIN you set there).', 'Tu usuario está en Mis grupos → Mi cuenta, en tu otro móvil (con el PIN que pusiste ahí).')}</p>` : ''}
            ${fields}
            <button class="btn btn-main btn-block" type="submit">${T('Entrer', 'Log in', 'Entrar')}</button>
            <p class="error" id="authErr">${esc(err)}</p>
            ${mode === 'login' ? `
              <div class="auth-links">
                <p class="muted small auth-help">${T('Pas de PIN, ou oublié ? Rejoins ton groupe avec son code et choisis ton nom : le groupe confirmera que c’est toi.', 'No PIN, or forgot it? Join your group with its code and pick your name: the group will confirm it’s you.', '¿No tienes PIN o se te ha olvidado? Únete a tu grupo con su código y elige tu nombre: el grupo confirmará que eres tú.')}</p>
                <button type="button" class="link-btn" data-mode="legacy">${T('Compte d’avant la mise à jour (code + pseudo + PIN)', 'Account from before the update (code + name + PIN)', 'Cuenta de antes de la actualización (código + nombre + PIN)')}</button>
              </div>` : ''}
          </form>
        </div>`;
      document.getElementById('authBack').onclick = () => {
        if (mode === 'legacy') { mode = 'login'; err = ''; return draw(); }
        if (token) startAccount();
        else renderWelcome();
      };
      $app.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => { mode = b.dataset.mode; err = ''; draw(); }));
      bindLangSwitch($app, draw);
      const form = document.getElementById('authForm');
      form.onsubmit = async (e) => {
        e.preventDefault();
        const btn = form.querySelector('[type=submit]');
        btn.disabled = true;
        const val = (id) => (document.getElementById(id) || {}).value || '';
        try {
          let data;
          if (mode === 'login') data = await api('POST', 'login', { username: val('username'), pin: val('pin') });
          else {
            data = await api('POST', 'login', { code: val('code'), name: val('name'), pin: val('pin') });
            save('code', val('code').toUpperCase().trim());
            save('lastName', val('name'));
          }
          if (val('username')) save('username', val('username').trim());
          token = data.token;
          save('token', token);
          save('joined', '1');
          cacheClear();
          account = null;
          await startAccount();
        } catch (ex) {
          err = ex.message;
          const box = document.getElementById('authErr');
          if (box) box.textContent = ex.message;
          btn.disabled = false;
        }
      };
    };
    draw();
  }

  // ---------- Accueil : la liste de mes groupes ----------

  let lobbyTimer = null;
  const vapid = () => (state && state.vapidKey) || (account && account.vapidKey) || null;

  async function loadAccount() {
    try {
      const t0 = Date.now();
      const a = await api('GET', 'account');
      skew = a.now - Math.round((t0 + Date.now()) / 2);
      account = a;
      cachePut('account', a);
      // Plus de cache pour les groupes qu'on a quittés.
      const ids = new Set(a.groups.map((x) => 'st_' + x.id));
      cacheClear((k) => k === 'account' || ids.has(k));
      if (a.account.username) save('username', a.account.username);
      // Langue de l'app gardée aussi sur le serveur : les notifications arrivent dans la bonne langue.
      if (a.account.lang !== LANG) api('PATCH', 'account', { lang: LANG }).then((x) => { account = x; }).catch(() => {});
      return true;
    } catch (e) {
      if (token && !stale) toast(e.message);
      return false;
    }
  }

  // Groupe affiché tout de suite depuis la mémoire locale (même onglet qu'avant), le temps que le serveur réponde.
  function paintGroupFromCache(id, st) {
    groupId = id;
    state = st;
    stale = true;
    tab = ['live', 'chat', 'sets', 'stats', 'quiz', 'me'].includes(load('tab')) ? load('tab') : 'live';
    liveMode = load('liveMode') === 'archive' ? 'archive' : 'live';
    const open = lastChat();
    if (open && !pendingChat) pendingChat = open;
    renderMain();
  }

  // Au démarrage (ou après connexion) : groupe à rouvrir (actualisation, notification), invitation, ou accueil.
  async function startAccount() {
    let painted = !!(state || document.getElementById('lobby'));
    if (!painted && !account) {
      const acc = cacheGet('account');
      if (acc) {
        account = acc;
        const st = pendingGroup && acc.groups.some((x) => x.id === pendingGroup) ? cacheGet('st_' + pendingGroup) : null;
        if (st && !inviteCode) { paintGroupFromCache(pendingGroup, st); painted = true; }
        else if (!pendingGroup && !inviteCode) { renderLobby(); painted = true; }
      }
    }
    if (!painted) $app.innerHTML = splash();
    if (!(await loadAccount())) {
      if (!token) return;
      if (painted) { if (state) startPolling(); return; } // hors ligne : on garde ce qui est affiché
      renderAuth('login', T('Impossible de charger. Vérifie ta connexion et réessaie.', 'Couldn’t load. Check your connection and try again.', 'No se ha podido cargar. Revisa tu conexión y prueba otra vez.'));
      return;
    }
    syncPush();
    const wanted = pendingGroup && account.groups.find((x) => x.id === pendingGroup);
    const restore = restoring && !inviteCode;
    pendingGroup = null;
    restoring = false;
    if (wanted && !(inviteCode && restore)) return enterGroup(wanted.id, { restore: restore || (state && groupId === wanted.id) });
    if (!wanted) save('group', null); // plus dans ce groupe
    renderLobby();
    if (inviteCode) {
      const c = inviteCode;
      inviteCode = null;
      const already = account.groups.find((x) => x.code === c.toUpperCase());
      if (already) enterGroup(already.id);
      else openJoinSheet(c);
    }
    if (pendingRecap) openRecapFromLink();
  }

  function startLobbyPolling() {
    if (lobbyTimer) return;
    // Plus souvent quand une demande de récupération attend une réponse.
    const every = account && account.pending && account.pending.some((p) => p.status === 'open') ? 8000 : 30000;
    lobbyTimer = setInterval(async () => {
      if (document.hidden || state || !token || !document.getElementById('lobby')) return;
      const before = JSON.stringify(account && account.groups.map((x) => x.id));
      if (await loadAccount()) {
        if (!state && document.getElementById('lobby') && $sheet.hidden) {
          stopLobbyPolling();
          renderLobby();
          const now_ = JSON.stringify(account.groups.map((x) => x.id));
          if (before !== now_ && account.groups.length > JSON.parse(before || '[]').length) {
            toast(T('C’est validé, te revoilà dans le groupe 🎉', 'Approved, you’re back in the group 🎉', '¡Listo, ya estás de vuelta en el grupo! 🎉'));
            syncPush(true);
          }
        }
      }
    }, every);
  }
  function stopLobbyPolling() {
    clearInterval(lobbyTimer);
    lobbyTimer = null;
  }

  // Éléments fixes posés hors de #view (bouton +, flèches des sous-onglets de Stats) : #view bouge pendant un
  // glissement et les emporterait. Chaque écran recrée les siens.
  const removeFab = () => document.querySelectorAll('body > .fab, body > .edge-nav').forEach((x) => x.remove());

  function renderLobby() {
    removeFab();
    stopLive();
    stopPolling();
    stopLobbyPolling();
    state = null;
    groupId = null;
    stale = false;
    if (!account) return;
    startLobbyPolling();
    const groups = account.groups;
    const total = groups.reduce((n, g) => n + g.todo + g.unread + (g.claims || 0), 0);
    document.title = total ? `(${total}) Whomst` : 'Whomst';
    if (navigator.setAppBadge) navigator.setAppBadge(total).catch(() => {});
    setNativeBadge(total);
    const acc = account.account;

    const card = (g) => {
      const st = g.streak || {};
      return `
      <button class="group-card ${g.todo || g.unread || g.claims ? 'busy' : ''}" data-group="${g.id}">
        ${g.me ? avatar(g.me) : '<span class="avatar"></span>'}
        <span class="gc-main">
          <span class="gc-name">${esc(g.name)}</span>
          <span class="gc-meta">${T('toi : ', 'you: ', 'tú: ')}<b>${esc(g.me ? g.me.name : '?')}</b> · ${plural(g.members, T('membre', 'member', 'miembro'))}${g.isAdmin ? ' · admin' : ''}</span>
        </span>
        <span class="gc-badges">
          ${st.group >= 2 ? `<span class="gb streak ${st.groupToday ? 'on' : ''}" title="${T('Série du groupe', 'Group streak', 'Racha del grupo')}">🔥${st.group}</span>` : ''}
          ${g.claims ? `<span class="gb claim" title="${T('Demande à valider', 'Request to approve', 'Solicitud pendiente')}">${icon('key')}${g.claims}</span>` : ''}
          ${g.todo ? `<span class="gb vote" title="${T('À voter', 'To vote', 'Por votar')}">${icon('live')}${g.todo}</span>` : ''}
          ${g.unread ? `<span class="gb chat" title="${T('Messages non lus', 'Unread messages', 'Mensajes sin leer')}">${icon('chat')}${g.unread}</span>` : ''}
        </span>
      </button>`;
    };
    const pending = (account.pending || []).map((p) => `
      <div class="card pending-card ${p.status}">
        ${p.player ? avatar(p.player) : '<span class="avatar"></span>'}
        <div class="pc-main">
          <b>${esc(p.name)} · ${esc(p.group)}</b>
          <span class="muted small">${p.status === 'denied'
            ? T('Demande refusée. Si c’est une erreur, parles-en au groupe et redemande.', 'Request denied. If that’s a mistake, talk to the group and ask again.', 'Solicitud rechazada. Si es un error, díselo al grupo y vuelve a pedirlo.')
            : p.voters === 'admins'
              ? T('En attente : l’admin doit confirmer que c’est toi.', 'Waiting: the admin has to confirm it’s you.', 'En espera: el admin tiene que confirmar que eres tú.')
              : T(`En attente : ${p.needed} membre${p.needed > 1 ? 's' : ''} doivent confirmer que c’est toi (${p.approvals}/${p.needed}).`, `Waiting: ${p.needed} member${p.needed > 1 ? 's' : ''} need to confirm it’s you (${p.approvals}/${p.needed}).`, `En espera: ${p.needed} miembro${p.needed > 1 ? 's' : ''} tienen que confirmar que eres tú (${p.approvals}/${p.needed}).`)}</span>
        </div>
        <button class="link-btn" data-cancelclaim="${p.id}">${p.status === 'denied' ? 'OK' : T('Annuler', 'Cancel', 'Cancelar')}</button>
      </div>`).join('');

    $app.innerHTML = `
      <header class="top">
        <h1>Whomst</h1>
        <button class="theme-btn" id="themeBtn" role="switch"></button>
      </header>
      <main id="lobby" class="lobby">
        ${pending ? `<div class="section-title">${T('Demandes envoyées', 'Requests sent', 'Solicitudes enviadas')}</div>${pending}` : ''}
        <div class="section-title">${T('Tes groupes', 'Your groups', 'Tus grupos')} <span class="count">${groups.length}</span></div>
        ${groups.length ? `<div class="group-list">${groups.map(card).join('')}</div>` : `
          <div class="card empty">${T('Tu n’es dans aucun groupe pour l’instant.<br>Rejoins celui de tes potes avec leur code, ou crée le tien.', 'You’re not in any group yet.<br>Join your friends’ group with their code, or create your own.', 'Todavía no estás en ningún grupo.<br>Únete al de tus colegas con su código o crea el tuyo.')}</div>`}
        <div class="row lobby-actions">
          <button class="btn btn-main" id="joinBtn">${T('Rejoindre un groupe', 'Join a group', 'Unirme a un grupo')}</button>
          <button class="btn btn-soft" id="createBtn">${T('Créer un groupe', 'Create a group', 'Crear un grupo')}</button>
        </div>

        ${aboutLinks()}
        <div class="card account-card">
          <div class="card-title">${T('Mon compte', 'My account', 'Mi cuenta')}</div>
          <div class="acc-row"><span class="muted">${T('Identifiant', 'Username', 'Usuario')}</span><span class="acc-val"><b>${esc(acc.username || '—')}</b>${acc.username ? `<button class="icon-btn" id="userBtn" aria-label="${T('Modifier', 'Edit', 'Editar')}">${icon('edit')}</button>` : ''}</span></div>
          <div class="acc-row"><span class="muted">PIN</span><span class="acc-val">${acc.hasPin ? '••••' : `<span class="muted">${T('aucun', 'none', 'ninguno')}</span>`}</span></div>
          ${acc.hasPin ? '' : `<p class="field-hint">${T('Ajoute un PIN pour pouvoir te connecter sur un autre téléphone (avec ton identifiant).', 'Add a PIN so you can log in on another phone (with your username).', 'Añade un PIN para poder entrar desde otro móvil (con tu usuario).')}</p>`}
          <div class="acc-row"><span class="muted">${T('Langue', 'Language', 'Idioma')}</span>${langSwitch()}</div>
          <div class="row">
            <button class="btn btn-soft" id="pinBtn">${acc.hasPin ? T('Changer de PIN', 'Change PIN', 'Cambiar PIN') : T('Ajouter un PIN', 'Add a PIN', 'Añadir un PIN')}</button>
            <button class="btn btn-soft" id="logoutBtn">${T('Se déconnecter', 'Log out', 'Cerrar sesión')}</button>
          </div>
          <button class="link-btn lobby-link" id="linkBtn">${T('J’ai un autre groupe avec un compte d’avant la mise à jour', 'I have another group with an account from before the update', 'Tengo otro grupo con una cuenta de antes de la actualización')}</button>
          <button class="link-btn lobby-link danger-link" id="deleteAcc">${T('Supprimer mon compte', 'Delete my account', 'Borrar mi cuenta')}</button>
        </div>
      </main>`;

    document.getElementById('themeBtn').onclick = () => setTheme(isDark() ? 'light' : 'dark');
    paintThemeBtn();
    $app.querySelectorAll('[data-group]').forEach((b) => (b.onclick = () => enterGroup(b.dataset.group)));
    $app.querySelectorAll('[data-cancelclaim]').forEach((b) => action(b, async () => {
      const p = account.pending.find((x) => x.id === b.dataset.cancelclaim);
      if (p && p.status === 'open' && !confirm(T('Annuler ta demande ?', 'Cancel your request?', '¿Cancelar tu solicitud?'))) return;
      account = await api('POST', `claims/${b.dataset.cancelclaim}/cancel`);
      renderLobby();
    }));
    document.getElementById('joinBtn').onclick = () => openJoinSheet();
    document.getElementById('createBtn').onclick = () => openCreateSheet();
    document.getElementById('linkBtn').onclick = () => openLinkSheet();
    document.getElementById('pinBtn').onclick = () => openPinSheet();
    const ub = document.getElementById('userBtn');
    if (ub) ub.onclick = () => openUsernameSheet();
    document.getElementById('deleteAcc').onclick = () => openDeleteAccount();
    bindLangSwitch($app, renderLobby);
    bindAbout($app);
    if ($sheet.hidden) openPendingAbout();
    action(document.getElementById('logoutBtn'), async () => {
      if (!acc.hasPin && groups.length && !confirm(T('Tu n’as pas de PIN : pour revenir, il faudra redemander ton nom à chaque groupe (et attendre qu’on valide). Ajoute plutôt un PIN avant. Te déconnecter quand même ?', 'You have no PIN: to come back, you’d have to ask each group for your name again (and wait for approval). Better add a PIN first. Log out anyway?', 'No tienes PIN: para volver, tendrás que pedir tu nombre otra vez en cada grupo (y esperar a que te acepten). Mejor añade un PIN antes. ¿Cerrar sesión de todas formas?'))) return;
      try { await api('POST', 'logout'); } catch { /* déjà déconnecté */ }
      logoutLocal();
    });
  }

  // Ouvrir un groupe : affiché tout de suite (mémoire locale, sinon squelette), puis rafraîchi.
  // On repart de l'onglet Live, sauf quand on y revient après une actualisation (opts.restore).
  async function enterGroup(id, opts = {}) {
    stopLobbyPolling();
    const warm = !!opts.restore && !!state && groupId === id; // déjà à l'écran (mémoire locale)
    if (!warm) {
      stopLive();
      stopPolling();
      closeChat(true);
      state = null;
      groupId = id;
      chats.clear();
      typing.clear();
      openPolls.clear();
      openVoters.clear();
      editing = null;
      openSet = null;
      setDetail = null;
      statsPlayer = null;
      archiveSet = '';
      archiveExtra = null;
      halfPick = null;
      if (opts.restore) {
        tab = ['live', 'chat', 'sets', 'stats', 'quiz', 'me'].includes(load('tab')) ? load('tab') : 'live';
        liveMode = load('liveMode') === 'archive' ? 'archive' : 'live';
        const open = lastChat();
        if (open && !pendingChat) pendingChat = open;
      } else {
        tab = 'live';
        liveMode = 'live';
        save('tab', tab);
        save('liveMode', liveMode);
        save('chat', null);
      }
      pushSynced = false;
      const cached = cacheGet('st_' + id);
      if (cached) {
        state = cached;
        stale = true;
        renderMain();
      } else renderSkeleton(id);
    }
    save('group', id);
    await refresh();
    if (!state && groupId === id) leaveGroup(); // groupe introuvable : retour à l'accueil
    else syncGuard();
  }

  // En attendant le serveur (premier passage dans ce groupe) : la même mise en page, vide.
  function renderSkeleton(id) {
    const g = account && account.groups.find((x) => x.id === id);
    $app.innerHTML = `
      <header class="top">
        <button class="lobby-btn" aria-hidden="true">${icon('back')}</button>
        <h1>${esc(g ? g.name : '')}</h1>
      </header>
      <main class="skeleton"><div class="sk sk-seg"></div><div class="sk sk-card"></div><div class="sk sk-row"></div><div class="sk sk-row"></div></main>`;
  }

  // Retour à l'accueil (bouton ← en haut, ou retour depuis l'onglet Live).
  function leaveGroup() {
    if (chatOpen) closeChat(true);
    stopLive();
    stopPolling();
    stopPresence();
    const wasGuarded = !!(history.state && history.state.guard);
    state = null;
    groupId = null;
    save('group', null); // revenu à l'accueil exprès : au prochain lancement, on reste sur l'accueil
    save('chat', null);
    if (!$sheet.hidden) closeSheet();
    if (wasGuarded) {
      popIgnore = true;
      history.back();
    }
    if (account) renderLobby();
    loadAccount().then((ok) => { if (ok && !state && token) renderLobby(); });
  }

  // Rejoindre un groupe : code → choisir son nom dans la liste → (pseudo, photo) → c'est parti.
  // Nom déjà pris (compte perdu) : demande de récupération, validée par le groupe.
  function openJoinSheet(code = '') {
    let roster = null;
    let picked = null;
    let claim = null;
    let photoData = null;
    let name = '';
    const draw = () => {
      const taken = roster ? roster.taken || [] : [];
      const claimWho = (p) => {
        if (!p.isAdmin) return T('l’admin du groupe doit', 'the group admin has to', 'el admin del grupo tiene que');
        return taken.length - 1 >= 2 ? T('2 membres du groupe doivent', '2 members of the group have to', '2 miembros del grupo tienen que') : T('l’autre membre du groupe doit', 'the other member of the group has to', 'el otro miembro del grupo tiene que');
      };
      openSheet(`
        <div class="sheet-head"><h2>${T('Rejoindre un groupe', 'Join a group', 'Unirme a un grupo')}</h2><button class="x" data-close>✕</button></div>
        ${!roster ? `
          <label for="jcode">${T('Code du groupe', 'Group code', 'Código del grupo')}</label>
          <input class="input code-input" id="jcode" autocapitalize="characters" autocomplete="off" maxlength="12" placeholder="${T('Demande-le à tes potes', 'Ask your friends for it', 'Pídeselo a tus colegas')}" value="${esc(code)}">
          <button class="btn btn-main btn-block" id="jNext">${T('Continuer →', 'Continue →', 'Continuar →')}</button>` : `
          <div class="info">${T('Groupe', 'Group', 'Grupo')} <b>${esc(roster.group.name)}</b> · <button type="button" class="link" id="jOther">${T('changer de code', 'use another code', 'usar otro código')}</button></div>
          <label>${T('Qui es-tu ?', 'Who are you?', '¿Quién eres?')}</label>
          ${roster.players.length ? `<div class="pick-grid">${roster.players.map((p) => `
            <button type="button" class="choice ${picked && picked.id === p.id ? 'picked' : ''}" data-pick="${p.id}">${avatar(p)}<span>${esc(p.name)}</span></button>`).join('')}</div>`
            : `<div class="info">${T('Tous les noms sont déjà pris. Demande à l’admin d’ajouter le tien.', 'All names are taken. Ask the admin to add yours.', 'Ya están todos los nombres cogidos. Pídele al admin que añada el tuyo.')}</div>`}
          ${picked ? `
            <label for="jname">${T('Ton pseudo dans ce groupe (tu peux le changer)', 'Your name in this group (you can change it)', 'Tu nombre en este grupo (puedes cambiarlo)')}</label>
            <input class="input" id="jname" maxlength="24" value="${esc(name || picked.name)}">
            <label>${T('Ta photo dans ce groupe', 'Your photo in this group', 'Tu foto en este grupo')} <span class="muted">${T('(optionnel)', '(optional)', '(opcional)')}</span></label>
            <button type="button" class="photo-pick" id="jPhoto">
              ${photoData ? `<span class="avatar lg has-photo" style="--pc:${esc(picked.color)}"><img src="${photoData}" alt=""></span>` : avatar({ ...picked, photo: null }, 'lg')}
              <span>${photoData ? T('Changer la photo', 'Change photo', 'Cambiar la foto') : T('Choisir une photo', 'Pick a photo', 'Elegir una foto')}<small class="muted">${T('Sinon, tu gardes cet animal', 'Or just keep this animal', 'Si no, te quedas con este animal')}</small></span>
            </button>
            <button class="btn btn-main btn-block" id="jGo">${T('C’est parti', 'Let’s go', '¡Vamos!')}</button>` : ''}
          ${taken.length ? `
            <details class="taken-box" ${claim ? 'open' : ''}>
              <summary>${T('Ton nom est déjà pris ? (compte perdu)', 'Your name is already taken? (lost account)', '¿Tu nombre ya está cogido? (cuenta perdida)')}</summary>
              <div class="pick-grid">${taken.map((p) => `
                <button type="button" class="choice ${claim && claim.id === p.id ? 'picked' : ''}" data-claim="${p.id}">${avatar(p)}<span>${esc(p.name)}</span></button>`).join('')}</div>
              ${claim ? `
                <div class="info">${T(`Tu es <b>${esc(claim.name)}</b> et tu as perdu ton compte (nouveau téléphone, app supprimée…) ? On envoie une demande : ${claimWho(claim)} confirmer que c’est bien toi. Tu retrouveras tout : votes, messages, photo.`, `You’re <b>${esc(claim.name)}</b> and lost your account (new phone, app deleted…)? We’ll send a request: ${claimWho(claim)} confirm it’s really you. You’ll get everything back: votes, messages, photo.`, `¿Eres <b>${esc(claim.name)}</b> y has perdido tu cuenta (móvil nuevo, app borrada…)? Mandamos una solicitud y ${claimWho(claim)} confirmar que eres tú. Lo recuperas todo: votos, mensajes, foto.`)}</div>
                <button class="btn btn-main btn-block" id="jClaim">${T('Demander à récupérer ce nom', 'Ask to get this name back', 'Recuperar este nombre')}</button>` : ''}
            </details>` : ''}`}`, (root) => {
        const next = root.querySelector('#jNext');
        if (next) {
          const input = root.querySelector('#jcode');
          input.onkeydown = (e) => { if (e.key === 'Enter') next.click(); };
          action(next, async () => {
            await ensureAccount();
            roster = await api('POST', 'roster', { code: input.value });
            code = roster.group.code;
            const mine = account && account.groups.find((x) => x.code === code);
            if (mine) { closeSheet(); return enterGroup(mine.id); }
            if (roster.players.length === 1 && !(roster.taken || []).length) picked = roster.players[0];
            draw();
          });
          if (!code) setTimeout(() => input.focus(), 50);
        }
        const keepName = () => { const n = root.querySelector('#jname'); if (n) name = n.value; };
        const other = root.querySelector('#jOther');
        if (other) other.onclick = () => { roster = null; picked = null; claim = null; draw(); };
        root.querySelectorAll('[data-pick]').forEach((b) => (b.onclick = () => { picked = roster.players.find((p) => p.id === b.dataset.pick); claim = null; name = ''; draw(); }));
        root.querySelectorAll('[data-claim]').forEach((b) => (b.onclick = () => { claim = taken.find((p) => p.id === b.dataset.claim); picked = null; draw(); }));
        const ph = root.querySelector('#jPhoto');
        if (ph) ph.onclick = async () => { keepName(); const d = await pickPhoto(); if (d) photoData = d; draw(); };
        action(root.querySelector('#jGo'), async () => {
          const r = await api('POST', 'groups/join', { code, playerId: picked.id, name: root.querySelector('#jname').value });
          closeSheet();
          await loadAccount();
          await enterGroup(r.groupId);
          if (photoData && state) await api('POST', 'me/photo', { data: photoData }).then(refresh).catch((e2) => toast(e2.message));
          syncPush(true);
          confetti();
        });
        action(root.querySelector('#jClaim'), async () => {
          await api('POST', 'groups/claim', { code, playerId: claim.id });
          closeSheet();
          await loadAccount();
          renderLobby();
          toast(T('Demande envoyée 👍 On te fait entrer dès que c’est validé.', 'Request sent 👍 You’ll be let in as soon as it’s approved.', 'Solicitud enviada 👍 Entrarás en cuanto la aprueben.'));
        });
      });
    };
    draw();
    if (code) setTimeout(() => document.getElementById('jNext')?.click(), 0);
  }

  // Créer un groupe : on en devient l'admin. Le fuseau horaire du groupe = celui de ce téléphone.
  function openCreateSheet() {
    let photoData = null;
    let groupName = '';
    let name = '';
    const draw = () => openSheet(`
      <div class="sheet-head"><h2>${T('Créer un groupe', 'Create a group', 'Crear un grupo')}</h2><button class="x" data-close>✕</button></div>
      <div class="info">${T('👑 Tu seras l’admin : tu ajouteras ensuite les noms de tes potes, et tu auras un code à leur envoyer.', '👑 You’ll be the admin. Next, you’ll add your friends’ names and get a code to send them.', '👑 Serás el admin: luego añadirás los nombres de tus colegas y tendrás un código para pasárselo.')}</div>
      <label for="cgroup">${T('Nom du groupe', 'Group name', 'Nombre del grupo')}</label>
      <input class="input" id="cgroup" maxlength="40" placeholder="${T('Ex : Les Bouffons', 'e.g. The Clowns', 'Ej.: Los Payasos')}" value="${esc(groupName)}">
      <label for="cname">${T('Ton pseudo dans ce groupe', 'Your name in this group', 'Tu nombre en este grupo')}</label>
      <input class="input" id="cname" maxlength="24" placeholder="${T('Ex : Nico', 'e.g. Nico', 'Ej.: Nico')}" value="${esc(name)}">
      <label>${T('Ta photo dans ce groupe', 'Your photo in this group', 'Tu foto en este grupo')} <span class="muted">${T('(optionnel)', '(optional)', '(opcional)')}</span></label>
      <button type="button" class="photo-pick" id="cPhoto">
        ${photoData ? `<span class="avatar lg has-photo" style="--pc:#7b2ff7"><img src="${photoData}" alt=""></span>` : avatar({ id: 'me', color: '#7b2ff7', animal: 0, name: '' }, 'lg')}
        <span>${photoData ? T('Changer la photo', 'Change photo', 'Cambiar la foto') : T('Choisir une photo', 'Pick a photo', 'Elegir una foto')}<small class="muted">${T('Sinon, tu auras un animal', 'Or you’ll get an animal', 'Si no, te tocará un animal')}</small></span>
      </button>
      <button class="btn btn-main btn-block" id="cGo">${T('Créer le groupe', 'Create the group', 'Crear el grupo')}</button>`, (root) => {
      const keep = () => { groupName = root.querySelector('#cgroup').value; name = root.querySelector('#cname').value; };
      root.querySelector('#cPhoto').onclick = async () => { keep(); const d = await pickPhoto(); if (d) photoData = d; draw(); };
      action(root.querySelector('#cGo'), async () => {
        keep();
        if (name.trim().length < 2) throw new Error(T('Choisis ton pseudo dans ce groupe', 'Pick your name in this group', 'Elige tu nombre en este grupo'));
        await ensureAccount();
        const r = await api('POST', 'groups', { groupName, name, timezone: myTz });
        closeSheet();
        await loadAccount();
        await enterGroup(r.groupId);
        if (!state) return;
        if (photoData) await api('POST', 'me/photo', { data: photoData }).catch((e2) => toast(e2.message));
        tab = 'me';
        save('tab', tab);
        await refresh();
        syncPush(true);
        confetti();
        showInvite(true);
      });
    });
    draw();
  }

  // Rattacher un groupe où on avait un compte d'avant la mise à jour (code + pseudo + PIN de ce groupe).
  function openLinkSheet() {
    openSheet(`
      <div class="sheet-head"><h2>${T('Rattacher un groupe', 'Add a group', 'Vincular un grupo')}</h2><button class="x" data-close>✕</button></div>
      <p class="muted small" style="margin:0 0 10px">${T('Avant, il fallait un compte par groupe. Entre le code de l’autre groupe, ton pseudo et ton PIN de là-bas : il rejoint ce compte, avec tes votes et tes messages.', 'Before, you needed one account per group. Enter the other group’s code, your name and your PIN there: it moves into this account, with your votes and messages.', 'Antes hacía falta una cuenta por grupo. Pon el código del otro grupo, tu nombre y tu PIN de allí: se añade a esta cuenta, con tus votos y tus mensajes.')}</p>
      <label for="lcode">${T('Code du groupe', 'Group code', 'Código del grupo')}</label>
      <input class="input code-input" id="lcode" autocapitalize="characters" autocomplete="off" maxlength="12">
      <label for="lname">${T('Ton pseudo dans ce groupe', 'Your name in that group', 'Tu nombre en ese grupo')}</label>
      <input class="input" id="lname" maxlength="24">
      ${pinField(T('Ton PIN dans ce groupe', 'Your PIN in that group', 'Tu PIN en ese grupo'), 'lpin')}
      <button class="btn btn-main btn-block" id="lGo">${T('Rattacher', 'Add it', 'Vincular')}</button>`, (root) => {
      action(root.querySelector('#lGo'), async () => {
        const r = await api('POST', 'account/link', { code: root.querySelector('#lcode').value, name: root.querySelector('#lname').value, pin: root.querySelector('#lpin').value });
        closeSheet();
        toast(T('Groupe rattaché à ton compte 👍', 'Group added to your account 👍', 'Grupo vinculado a tu cuenta 👍'));
        await loadAccount();
        syncPush(true);
        enterGroup(r.groupId);
      });
    });
  }

  // PIN : optionnel. Sans PIN encore : pas besoin de l'ancien.
  function openPinSheet() {
    const has = account.account.hasPin;
    openSheet(`
      <div class="sheet-head"><h2>${has ? T('Changer de PIN', 'Change PIN', 'Cambiar PIN') : T('Ajouter un PIN', 'Add a PIN', 'Añadir un PIN')}</h2><button class="x" data-close>✕</button></div>
      ${has ? '' : `<p class="muted small" style="margin:0 0 6px">${T(`Pour te connecter sur un autre téléphone : ton identifiant <b>${esc(account.account.username || '')}</b> + ce PIN.`, `To log in on another phone: your username <b>${esc(account.account.username || '')}</b> + this PIN.`, `Para entrar desde otro móvil: tu usuario <b>${esc(account.account.username || '')}</b> + este PIN.`)}</p>`}
      ${has ? pinField(T('PIN actuel', 'Current PIN', 'PIN actual'), 'oldPin') : ''}
      ${pinField(T('Nouveau PIN (4 à 6 chiffres)', 'New PIN (4 to 6 digits)', 'PIN nuevo (de 4 a 6 cifras)'), 'newPin')}
      <button class="btn btn-main btn-block" id="pGo">${T('Enregistrer', 'Save', 'Guardar')}</button>`, (root) => {
      action(root.querySelector('#pGo'), async () => {
        account = await api('PATCH', 'account', { oldPin: has ? root.querySelector('#oldPin').value : undefined, pin: root.querySelector('#newPin').value });
        cachePut('account', account);
        closeSheet();
        toast(has ? T('PIN changé 👍', 'PIN changed 👍', 'PIN cambiado 👍') : T('PIN ajouté 👍', 'PIN added 👍', 'PIN añadido 👍'));
        if (!state) renderLobby();
      });
    });
  }

  // Supprimer son compte : tous ses groupes sont quittés, photos et sessions effacées. Deux étapes pour éviter l'accident.
  function openDeleteAccount() {
    openSheet(`
      <div class="sheet-head"><h2>${T('Supprimer mon compte', 'Delete my account')}</h2><button class="x" data-close>✕</button></div>
      <p>${T('Tu quittes tous tes groupes et ton compte est effacé : identifiant, PIN, photos de profil, réponses au quiz, notifications. <b>C’est définitif.</b>', 'You leave all your groups and your account is erased: username, PIN, profile photos, quiz answers, notifications. <b>This can’t be undone.</b>')}</p>
      <p class="muted small">${T('Tes votes et les messages déjà envoyés restent dans l’historique des groupes. Supprime d’abord les messages que tu veux voir disparaître.', 'Your votes and messages already sent stay in the groups’ history. Delete any messages you want gone first.')}</p>
      <label for="delConfirm">${T('Écris SUPPRIMER pour confirmer', 'Type DELETE to confirm')}</label>
      <input class="input" id="delConfirm" autocapitalize="characters" autocomplete="off">
      <button class="btn btn-danger btn-block" id="delGo">${T('Supprimer définitivement', 'Delete for good')}</button>`, (root) => {
      action(root.querySelector('#delGo'), async () => {
        if (root.querySelector('#delConfirm').value.trim().toUpperCase() !== T('SUPPRIMER', 'DELETE')) throw new Error(T('Écris SUPPRIMER pour confirmer', 'Type DELETE to confirm'));
        await api('POST', 'account/delete', { confirm: true });
        closeSheet();
        logoutLocal();
        toast(T('Compte supprimé', 'Account deleted'));
      });
    });
  }

  function openUsernameSheet() {
    openSheet(`
      <div class="sheet-head"><h2>${T('Ton identifiant', 'Your username', 'Tu usuario')}</h2><button class="x" data-close>✕</button></div>
      <p class="muted small" style="margin:0 0 6px">${T('Il sert seulement à te connecter sur un autre téléphone (avec ton PIN). Dans les groupes, on voit ton pseudo.', 'It’s only used to log in on another phone (with your PIN). In groups, people see your name.', 'Solo sirve para entrar desde otro móvil (con tu PIN). En los grupos se ve tu nombre.')}</p>
      <input class="input" id="uName" maxlength="20" autocapitalize="none" spellcheck="false" value="${esc(account.account.username || '')}">
      <p class="field-hint">${T('3 à 20 caractères : lettres, chiffres, . _ -', '3 to 20 characters: letters, numbers, . _ -', 'De 3 a 20 caracteres: letras, números, . _ -')}</p>
      <button class="btn btn-main btn-block" id="uGo">${T('Enregistrer', 'Save', 'Guardar')}</button>`, (root) => {
      action(root.querySelector('#uGo'), async () => {
        account = await api('PATCH', 'account', { username: root.querySelector('#uName').value.trim() });
        cachePut('account', account);
        save('username', account.account.username);
        closeSheet();
        toast(T('Identifiant changé 👍', 'Username changed 👍', 'Usuario cambiado 👍'));
        if (!state) renderLobby();
      });
    });
  }

  // Petit interrupteur FR / EN / ES (écran de connexion, accueil et Moi).
  function langSwitch(cls = '') {
    return `<div class="lang-switch ${cls}" role="group" aria-label="Langue / Language / Idioma">
      ${LANGS.map((l) => `<button type="button" data-lang="${l}" class="${LANG === l ? 'on' : ''}">${l.toUpperCase()}</button>`).join('')}
    </div>`;
  }
  function bindLangSwitch(root, redraw) {
    root.querySelectorAll('[data-lang]').forEach((b) => (b.onclick = () => {
      if (b.dataset.lang === LANG) return;
      setLang(b.dataset.lang);
      if (token) api('PATCH', 'account', { lang: LANG }).then((a) => { account = a; if (state) state.me.lang = LANG; }).catch(() => {});
      redraw();
    }));
  }

  // ---------- Invitation ----------

  function inviteLink() {
    return `${PUBLIC_URL}${langLink(LANG)}?code=${state.group.code}`;
  }

  function showInvite(justCreated) {
    const text = T(`Rejoins « ${state.group.name} » sur Whomst\nCode : ${state.group.code}\n${inviteLink()}`, `Join “${state.group.name}” on Whomst\nCode: ${state.group.code}\n${inviteLink()}`, `Únete a «${state.group.name}» en Whomst\nCódigo: ${state.group.code}\n${inviteLink()}`);
    openSheet(`
      <div class="sheet-head"><h2>${justCreated ? T('Groupe créé', 'Group created', 'Grupo creado') : T('Inviter des potes', 'Invite your mates', 'Invitar a colegas')}</h2><button class="x" data-close>✕</button></div>
      <p class="muted" style="margin:0 0 6px">${T(`Envoie ce code (ou le lien) à tes potes pour qu’ils rejoignent <b>${esc(state.group.name)}</b>.`, `Send this code (or the link) to your mates so they can join <b>${esc(state.group.name)}</b>.`, `Mándales este código (o el enlace) a tus colegas para que se unan a <b>${esc(state.group.name)}</b>.`)}</p>
      <div class="big-code">${esc(state.group.code)}</div>
      <div class="row">
        <button class="btn btn-main" id="shareBtn">${navigator.share || (NATIVE && Plugins.Share) ? T('Partager', 'Share', 'Compartir') : T('Copier le lien', 'Copy link', 'Copiar enlace')}</button>
        <button class="btn btn-soft" id="copyCode">${T('Copier le code', 'Copy code', 'Copiar código')}</button>
      </div>
      <p class="other-langs muted small">${T('Le lien dans une autre langue :', 'The link in another language:', 'El enlace en otro idioma:')} ${LANGS.filter((l) => l !== LANG).map((l) => `<button class="link-btn" data-langlink="${l}">${{ fr: 'Français', en: 'English', es: 'Español' }[l]}</button>`).join(' · ')}</p>
      ${justCreated ? `<div class="info" style="margin-top:14px">${T('👉 Ajoute d’abord les noms de tes potes dans <b>Admin → Les potes</b> : ils choisiront leur nom en rejoignant.', '👉 First add your mates’ names in <b>Admin → Your mates</b>: they’ll pick their name when joining.', '👉 Primero añade los nombres de tus colegas en <b>Admin → Los colegas</b>: elegirán su nombre al unirse.')}</div>` : ''}`, (root) => {
      const copy = async (t, msg) => {
        try {
          await navigator.clipboard.writeText(t);
          toast(msg);
        } catch {
          prompt(T('Copie ça :', 'Copy this:', 'Copia esto:'), t);
        }
      };
      root.querySelector('#copyCode').onclick = () => copy(state.group.code, T('Code copié', 'Code copied', 'Código copiado'));
      root.querySelectorAll('[data-langlink]').forEach((b) => (b.onclick = () => copy(`${PUBLIC_URL}${langLink(b.dataset.langlink)}?code=${state.group.code}`, T('Lien copié', 'Link copied', 'Enlace copiado'))));
      root.querySelector('#shareBtn').onclick = async () => {
        if (NATIVE && Plugins.Share) {
          try { await Plugins.Share.share({ title: 'Whomst', text }); } catch { /* annulé */ }
        } else if (navigator.share) {
          try { await navigator.share({ title: 'Whomst', text }); } catch { /* annulé */ }
        } else copy(text, T('Invitation copiée', 'Invite copied', 'Invitación copiada'));
      };
    });
  }

  function pinField(label = T('PIN secret (4 à 6 chiffres)', 'Secret PIN (4 to 6 digits)', 'PIN secreto (de 4 a 6 cifras)'), id = 'pin') {
    return `
      <label for="${id}">${label}</label>
      <input class="input" id="${id}" required inputmode="numeric" pattern="\\d{4,6}" maxlength="6" type="password" placeholder="••••" autocomplete="current-password">`;
  }

  function logoutLocal() {
    stopPresence();
    stopLobbyPolling();
    token = null;
    state = null;
    account = null;
    groupId = null;
    save('group', null);
    stopLive();
    closeChat(true);
    chats.clear();
    save('token', null);
    cacheClear();
    renderWelcome();
  }

  // ---------- Données ----------

  async function refresh() {
    try {
      const t0 = Date.now();
      const gid = groupId;
      const next = await api('GET', 'state');
      if (gid !== groupId) return; // on a changé de groupe entre-temps
      skew = next.now - Math.round((t0 + Date.now()) / 2);
      state = next;
      stale = false;
      cachePut('st_' + gid, next);
      renderMain();
      startPolling();
      startLive();
      startPresence();
      syncPush();
      clearNotifs();
      // Langue de l'app gardée aussi sur le serveur : les notifications arrivent dans la bonne langue.
      if (state.me.lang !== LANG) api('PATCH', 'me', { lang: LANG }).then(() => { state.me.lang = LANG; }).catch(() => {});
      if (pendingChat) {
        const ch = pendingChat;
        pendingChat = null;
        if (ch === 'general' || state.live.some((p) => p.id === ch) || state.archive.some((p) => p.id === ch)) openChat(ch);
      }
      if (pendingRecap) openRecapFromLink();
      if ($sheet.hidden) openPendingAbout();
      checkClaims();
      quizPrompt();
    } catch (e) {
      if (token) toast(e.message);
    }
  }

  function busy() {
    const a = document.activeElement;
    return !$sheet.hidden || (a && ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName));
  }

  async function softRefresh() {
    if (!token) return;
    try {
      const gid = groupId;
      const next = await api('GET', 'state');
      if (gid !== groupId || !state) return;
      const changed = JSON.stringify({ ...next, now: 0 }) !== JSON.stringify({ ...state, now: 0 });
      state = next;
      stale = false;
      if (changed) cachePut('st_' + gid, next);
      if (busy() || !changed) renderNav();
      else renderMain();
      if (chatOpen) renderChatHeader();
      clearNotifs();
      checkClaims();
    } catch { /* on réessaiera */ }
  }

  // ---------- Notifications déjà vues ----------
  // Les notifications restent dans le centre de notifs du téléphone même quand on a lu le message
  // ou voté : on retire celles qui ne servent plus (message lu, question votée ou terminée).
  async function clearNotifs() {
    try {
      if (NATIVE) return clearNativeNotifs();
      const reg = swReg || (await swReady);
      if (!reg || !reg.getNotifications || !state) return;
      const list = await reg.getNotifications();
      for (const n of list) {
        const tag = n.tag || '';
        const m = /^(chat|mention|poll|votes)-(.+?)(?:@(\w+))?$/.exec(tag);
        if (!m || (m[3] && m[3] !== groupId)) continue;
        const [, kind, id] = m;
        let seen = false;
        if (kind === 'chat' || kind === 'mention') {
          const t = state.chat.threads.find((x) => x.channel === id);
          const p = findPoll(id);
          const unread = t ? t.unread : p && p.chat ? p.chat.unread : 0;
          seen = chatOpen === id || !unread;
        } else {
          const p = state.live.find((x) => x.id === id);
          seen = !p || !!p.myVote; // votée, terminée ou supprimée
        }
        if (seen) n.close();
      }
    } catch { /* pas grave */ }
  }

  // Les événements temps réel déclenchent un rafraîchissement groupé de l'état.
  let softTimer = null;
  function scheduleRefresh() {
    clearTimeout(softTimer);
    softTimer = setTimeout(softRefresh, 500);
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(() => {
      if (!document.hidden) softRefresh();
    }, 30000);
  }

  function stopPolling() {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopLive();
      stopPresence();
    } else if (token && state) {
      startPresence();
      refresh();
      if (chatOpen) loadChat(chatOpen, true);
    } else if (token && account && document.getElementById('lobby')) {
      loadAccount().then((ok) => { if (ok && !state && document.getElementById('lobby') && $sheet.hidden) renderLobby(); });
    }
  });

  // ---------- Squelette ----------

  function todoCount() {
    return state.live.filter((p) => !p.myVote).length;
  }

  function renderMain() {
    if (!document.getElementById('view')) {
      $app.innerHTML = `
        <header class="top">
          <button class="lobby-btn" id="lobbyBtn" aria-label="${T('Mes groupes', 'My groups', 'Mis grupos')}">${icon('back')}</button>
          <h1 id="groupTitle"></h1>
          <button class="streak-chip" id="streakChip" aria-label="${T('Séries', 'Streaks', 'Rachas')}"></button>
          <button class="theme-btn" id="themeBtn" role="switch"></button>
          <button class="me-chip" id="meChip"></button>
        </header>
        <main id="view"></main>
        <nav class="nav"><div class="nav-inner" id="nav"></div></nav>`;
      document.getElementById('meChip').onclick = () => go('me');
      document.getElementById('lobbyBtn').onclick = () => leaveGroup();
      document.getElementById('streakChip').onclick = () => openStreakSheet();
      document.getElementById('themeBtn').onclick = () => setTheme(isDark() ? 'light' : 'dark');
      paintThemeBtn();
    }
    const m = me();
    document.getElementById('groupTitle').textContent = state.group.name;
    const chip = document.getElementById('meChip');
    chip.innerHTML = avatar(m);
    chip.setAttribute('aria-label', m.name);
    chip.title = m.name;
    renderNav();
    renderView();
  }

  function renderNav() {
    const n = todoCount();
    const unread = state.chat.unread;
    const items = [
      ['live', 'live', 'Live', n],
      ['chat', 'chat', 'Chat', unread],
      ['sets', 'sets', 'Sets', 0],
      ['stats', 'stats', 'Stats', 0],
      ...(state.settings.profiles ? [['quiz', 'quiz', 'Quiz', state.me.quizDone ? 0 : '!']] : []),
      ['me', 'me', T('Moi', 'Me', 'Yo'), 0],
    ];
    const chip = document.getElementById('streakChip');
    if (chip && state.streaks) {
      chip.innerHTML = streakChip();
      chip.classList.toggle('pending', myStreak().today === false);
    }
    const nav = document.getElementById('nav');
    if (!nav) return;
    nav.innerHTML = items
      .map(([id, ico, label, badge]) => `
        <button data-tab="${id}" class="${tab === id ? 'on' : ''}">
          <span class="ico">${icon(ico)}</span>${label}
          ${badge ? `<span class="badge">${badge}</span>` : ''}
        </button>`)
      .join('');
    nav.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => go(b.dataset.tab)));
    const name = 'Whomst';
    document.title = n + unread ? `(${n + unread}) ${name}` : name;
    if (navigator.setAppBadge) navigator.setAppBadge(n + unread).catch(() => {});
    setNativeBadge(n + unread);
  }

  // ---------- Thème clair / sombre ----------

  const isDark = () => document.documentElement.dataset.theme === 'dark';

  function paintThemeBtn() {
    const b = document.getElementById('themeBtn');
    if (!b) return;
    b.classList.toggle('on', isDark());
    b.setAttribute('aria-checked', String(isDark()));
    b.setAttribute('aria-label', isDark() ? T('Passer en mode clair', 'Switch to light mode', 'Pasar a modo claro') : T('Passer en mode sombre', 'Switch to dark mode', 'Pasar a modo oscuro'));
    b.innerHTML = '<span class="theme-knob">' + icon(isDark() ? 'moon' : 'sun') + '</span>';
  }

  function setTheme(theme) {
    if (theme === 'dark') document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
    save('theme', theme === 'dark' ? 'dark' : null);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#0e0719' : '#7b2ff7';
    paintThemeBtn();
  }

  function go(t) {
    if (t === 'sets' && tab === 'sets') openSet = null;
    tab = t;
    save('tab', t);
    editing = null;
    openPolls.clear();
    renderNav();
    renderView();
    window.scrollTo({ top: 0 });
  }

  function renderView() {
    const view = document.getElementById('view');
    if (!view) return;
    // Pendant l'animation d'un vote, on ne redessine pas l'écran (on le fera juste après).
    if (animating) { pendingRender = true; return; }
    syncGuard();
    removeFab(); // le bouton + (hors de #view) ne reste que sur Live → En cours, qui le recrée
    if (tab === 'quiz' && !state.settings.profiles) tab = 'live';
    ({ live: renderLive, chat: renderChatList, sets: renderSets, stats: renderStats, quiz: renderQuiz, me: renderMe }[tab] || renderLive)(view);
  }

  // ---------- Cartes de sondage ----------

  // Carte de sondage : 1) set + temps restant, 2) la question, 3) les choix ou résultats,
  // 4) une seule ligne d'infos (+ menu ⋯), 5) l'aperçu de la discussion.
  // opts.collapsible : carte dépliée depuis une ligne compacte (on peut la replier).
  // opts.justVoted : affichée juste après un vote, pendant l'animation.
  function pollCard(p, opts = {}) {
    const s = setOf(p.setId);
    const voting = !p.ended && (!p.myVote || editing === p.id);
    const total = p.voterIds.length;
    const by = p.droppedBy ? player(p.droppedBy) : null;
    const hasMenu = (!p.ended && p.myVote) || state.me.isAdmin || p.mine;
    const comments = (p.chat && p.chat.count) || 0;
    const me_ = (u) => (u.id === state.me.playerId ? T('Toi', 'You', 'Tú') : u.name);

    let body;
    if (voting) {
      // Demi-vote (« j'hésite ») : on choisit 1 ou 2 personnes, ½ vote chacune. Ça ne gêne pas le vote normal :
      // un simple tap vote comme avant ; le mode ½ s'active avec le petit bouton ou un appui long sur un nom.
      const half = halfPick && halfPick.pollId === p.id ? halfPick.picks : null;
      const opt = (u, extra = '') => {
        const inHalf = half && half.includes(u.id);
        const picked = !half && p.myVote && votedFor(p.myVote, u.id);
        return `
          <button class="vote-opt ${extra} ${picked ? 'picked' : ''} ${inHalf ? 'half-on' : ''}" data-vote="${p.id}" data-target="${u.id}">
            ${u.id === 'nobody' ? '<span class="avatar sm nobody-av">∅</span>' : avatar(u, 'sm')}<span>${esc(u.id === state.me.playerId ? u.name + T(' (moi)', ' (me)', ' (yo)') : u.name)}</span>
            ${inHalf ? '<i class="half-mark">½</i>' : ''}
          </button>`;
      };
      body = `<div class="vote-list">${state.players.map((u) => opt(u)).join('')}${p.nobody ? opt(player('nobody'), 'nobody') : ''}</div>
        <div class="half-row ${half ? 'on' : ''}">
          ${half
            ? `<span class="half-hint">${half.length ? T('Une 2e personne ? Ou valide ton ½ seul', 'A 2nd person? Or send just your ½', '¿Otra persona? O vota solo tu ½') : T('Choisis 1 ou 2 personnes : ½ vote chacune', 'Pick 1 or 2 people: ½ vote each', 'Elige 1 o 2 personas: ½ voto a cada una')}</span>
               ${half.length ? `<button class="half-send" data-halfsend="${p.id}">${T('Valider ½', 'Send ½', 'Votar ½')}</button>` : ''}
               <button class="half-cancel" data-halfcancel="${p.id}">${T('Annuler', 'Cancel', 'Cancelar')}</button>`
            : `<button class="half-toggle" data-half="${p.id}" title="${T('Pas sûr·e ? Partage ton vote en deux', 'Not sure? Split your vote in two', '¿No lo tienes claro? Reparte tu voto entre dos')}">½ ${T('J’hésite', 'Not sure', 'Dudo')}</button>`}
          ${editing === p.id && !half ? `<button class="link-btn" data-cancel>${T('Annuler', 'Cancel', 'Cancelar')}</button>` : ''}
        </div>`;
    } else {
      // Résultats façon AskUs : la plus grande barre prend toute la largeur, les autres sont à l'échelle.
      // Au bout de chaque barre, les photos de ceux qui ont voté ; un tap sur la barre déroule leurs noms.
      const counts = Object.entries(p.results || {}).sort((a, b) => b[1] - a[1]);
      const max = counts.length ? counts[0][1] : 0;
      body = counts.length
        ? `<div class="results">${counts
            .map(([id, c]) => {
              const u = player(id);
              const voters = votersFor(p, id);
              const key = `${p.id}:${id}`;
              const open = openVoters.has(key);
              return `
                <div class="result ${p.myVote && votedFor(p.myVote, id) ? 'mine' : ''} ${c === max ? 'winner' : ''}" style="--pc:${esc(u.color)}">
                  <button class="r-row" data-voters="${esc(key)}" aria-expanded="${open}">
                    ${avatar(u, 'sm')}
                    <span class="r-track">
                      <span class="r-fill" style="width:${((c / max) * 100).toFixed(1)}%">
                        <span class="r-name">${esc(me_(u))}</span>
                        ${voterStack(voters, 4)}
                      </span>
                    </span>
                    <span class="r-count">${num(c)}</span>
                  </button>
                  ${open ? `<div class="r-list">${voters.map((v) => `<span class="who">${avatar(v, 'xs')}${esc(me_(v))}${v.half ? ' <i class="half-tag">½</i>' : ''}</span>`).join('')}</div>` : ''}
                </div>`;
            })
            .join('')}</div>`
        : `<p class="muted small" style="margin:0">${T('Personne n’a voté.', 'Nobody voted.', 'Nadie ha votado.')}</p>`;
      body += consensusLine(p) + rateRow(p);
    }

    const status = p.ended ? `<span class="poll-ended">${T('Terminé', 'Over', 'Terminada')}</span>` : timeLeft(p);
    const author = p.custom && p.authorId ? player(p.authorId) : null;
    const picked = opts.justVoted && p.myVote ? (Array.isArray(p.myVote) ? p.myVote.map(player) : [player(p.myVote)]) : null;
    const pickedNames = picked && picked.map((u) => (u.id === state.me.playerId ? T('pour toi', 'for yourself', 'para ti') : u.name));
    return `
      <article class="card poll ${voting && !p.myVote ? 'todo' : ''} ${p.custom ? 'custom' : ''} ${opts.justVoted ? 'just-voted' : ''} ${voting && halfPick && halfPick.pollId === p.id ? 'halfmode' : ''}" data-poll="${p.id}">
        ${p.custom ? `<div class="custom-tag">${icon('pen')}<span>${T('Question de', 'Question by', 'Pregunta de')} <b>${author ? esc(author.name) : T('quelqu’un du groupe', 'someone in the group', 'alguien del grupo')}</b></span></div>` : ''}
        ${picked ? `<div class="voted-banner">${icon('check')}<span>${Array.isArray(p.myVote)
          ? T(`Tu as voté ½ <b>${pickedNames.map(esc).join('</b> et ½ <b>')}</b>`, `You voted ½ <b>${pickedNames.map(esc).join('</b> and ½ <b>')}</b>`, `Has votado ½ a <b>${pickedNames.map(esc).join('</b> y ½ a <b>')}</b>`)
          : T(`Tu as voté <b>${esc(pickedNames[0])}</b>`, `You voted <b>${esc(pickedNames[0])}</b>`, `Has votado a <b>${esc(pickedNames[0])}</b>`)}</span></div>` : ''}
        <div class="poll-head" ${opts.collapsible ? `data-toggle="${p.id}" role="button" aria-expanded="true"` : ''}>
          <div class="poll-top">
            <span class="poll-set ${s.spicy ? 'spicy' : ''}">${esc(setName(s))}${s.spicy ? ' · 18+' : ''}</span>
            <span class="poll-time">${status}${opts.collapsible ? `<span class="fold">${icon('down')}</span>` : ''}</span>
          </div>
          <h2 class="question">${esc(qText(p))}</h2>
        </div>
        ${body}
        <div class="poll-foot">
          <span class="foot-info">
            ${voterStack(p.voterIds.map(player), 5)}<span class="vote-count">${total}/${members()}</span>
            ${by && !(author && author.id === by.id) ? `<span class="by">· ${T('par', 'by', 'por')} ${esc(by.name)}</span>` : ''}
          </span>
          <span class="foot-actions">
            ${comments || (p.chat && p.chat.locked) ? '' : `<button class="more-btn" data-chat="${p.id}" aria-label="${T('Commenter', 'Comment', 'Comentar')}">${icon('comment')}</button>`}
            ${hasMenu ? `<button class="more-btn" data-more="${p.id}" aria-label="Options">${icon('more')}</button>` : ''}
          </span>
        </div>
        ${pollChatPreview(p)}
      </article>`;
  }

  // Tout le monde d'accord (7/7 sur la même personne) ou personne d'accord : une petite ligne, sans en faire trop.
  function consensusLine(p) {
    const c = p.consensus;
    if (!c) return '';
    if (c.kind === 'unanimous') {
      const u = player(c.target);
      return `<div class="cons-line">👑 ${T(`Unanimité ${c.n}/${c.n} pour <b>${esc(u.id === state.me.playerId ? 'toi' : u.name)}</b>`, `Unanimous ${c.n}/${c.n} for <b>${esc(u.id === state.me.playerId ? 'you' : u.name)}</b>`, `Unanimidad ${c.n}/${c.n} para <b>${esc(u.id === state.me.playerId ? 'ti' : u.name)}</b>`)}</div>`;
    }
    return `<div class="cons-line split">🌪️ ${T('Personne n’est d’accord', 'Nobody agrees', 'Nadie se pone de acuerdo')}</div>`;
  }

  // Note de la question (étoiles) : discrète, sous les résultats. Gardée pour les stats et les futures questions.
  function rateRow(p) {
    if (!p.rating || (!p.myVote && !p.ended)) return '';
    const r = p.rating;
    return `
      <div class="rate-row">
        <span class="rate-label">${r.mine ? T('Ta note', 'Your rating', 'Tu nota') : T('Note la question', 'Rate this question', 'Puntúa la pregunta')}</span>
        <span class="stars">${[1, 2, 3, 4, 5].map((n) => `<button class="star ${r.mine && n <= r.mine ? 'on' : ''}" data-rate="${p.id}" data-n="${n}" aria-label="${n}/5">★</button>`).join('')}</span>
        ${r.n ? `<span class="rate-avg">${String(r.avg).replace('.', L ? '.' : ',')} · ${r.n}</span>` : ''}
      </div>`;
  }

  // Ligne compacte (sondage déjà voté ou archivé) : un tap la déplie pour voir qui a voté pour qui.
  function pollRow(p) {
    const counts = Object.entries(p.results || {}).sort((a, b) => b[1] - a[1]);
    const max = counts.length ? counts[0][1] : 0;
    const leaders = counts.filter(([, c]) => c === max).map(([id]) => player(id));
    const author = p.custom && p.authorId ? player(p.authorId) : null;
    const c = p.chat || { count: 0, unread: 0 };
    const total = counts.reduce((n, [, x]) => n + x, 0);
    const cons = p.consensus;
    // Sous la question : une barre pour le gagnant (deux si égalité), longueur = sa part des votes,
    // avec au bout les photos de ceux qui ont voté pour lui. Le reste se voit en dépliant.
    const bars = leaders.slice(0, 2).map((u) => `
      <span class="mini-res" style="--pc:${esc(u.color)}">
        ${avatar(u, 'xs')}
        <span class="mr-name">${esc(Array.from(u.id === state.me.playerId ? T('Toi', 'You', 'Tú') : u.name).slice(0, 8).join(''))}</span>
        <span class="mini-track"><span class="mini-fill" style="width:${((max / total) * 100).toFixed(1)}%"></span></span>
        <span class="mr-n">${num(max)}</span>
      </span>`).join('') + (leaders.length > 2 ? `<span class="tie-more">+${leaders.length - 2} ${T('ex æquo', 'tied', 'empatados')}</span>` : '');
    return `
      <button class="prow ${p.custom ? 'custom' : ''} ${flashId === p.id ? 'flash' : ''}" data-toggle="${p.id}" aria-expanded="false">
        <span class="prow-top">
          <span class="prow-q">${author ? `<span class="prow-pen" title="${T('Question de', 'Question by', 'Pregunta de')} ${esc(author.name)}">${icon('pen')}</span>` : ''}${esc(qText(p))}</span>
          ${c.count ? `<span class="prow-chat ${c.unread ? 'new' : ''}">${icon('comment')}${c.unread || c.count}</span>` : ''}
        </span>
        <span class="prow-res ${leaders.length > 1 ? 'tie' : ''}">
          <span class="mini-bars">${bars || `<span class="muted small">${T('Aucun vote', 'No votes', 'Sin votos')}</span>`}</span>
          <span class="prow-side">${cons ? `<span class="cons-dot ${cons.kind}" title="${cons.kind === 'unanimous' ? T('Unanimité', 'Unanimous', 'Unanimidad') : T('Personne d’accord', 'Nobody agrees', 'Nadie de acuerdo')}">${cons.kind === 'unanimous' ? '👑' : '🌪️'}</span>` : ''}${p.ended ? '' : timeLeft(p)}<span class="vote-count">${p.voterIds.length}/${members()}</span></span>
        </span>
      </button>`;
  }

  // Membres qui ont rejoint (les noms ajoutés par l'admin mais pas encore réclamés ne comptent pas).
  const members = () => state.players.filter((u) => u.claimed).length || state.players.length;

  function votersFor(p, id) {
    return (p.ballots || []).filter((b) => b.target === id).map((b) => ({ ...player(b.voter), half: !!b.half }));
  }

  // Petites photos empilées (+N s'il y en a trop). Les demi-votes sont un peu transparents.
  function voterStack(list, max) {
    if (!list.length) return '';
    const extra = list.length - max;
    return `<span class="stack">${list.slice(0, extra > 0 ? max - 1 : max).map((u) => avatar(u, u.half ? 'xs half' : 'xs')).join('')}${extra > 0 ? `<span class="avatar xs more">+${extra + 1}</span>` : ''}</span>`;
  }

  // Temps restant : une petite horloge qui se vide, et « 5h » / « 40 min ».
  function timeLeft(p) {
    const ms = Math.max(0, p.endsAt - now());
    const frac = Math.min(1, ms / Math.max(1, p.endsAt - p.startsAt));
    const C = 2 * Math.PI * 6;
    const m = Math.round(ms / 60000);
    const label = m >= 60 ? `${Math.floor(m / 60)}h` : `${m} min`;
    return `<span class="tleft ${frac < 0.15 ? 'soon' : ''}" title="${T('Encore', 'Still', 'Quedan')} ${left(p.endsAt)}">
      <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" class="tl-track"/><circle cx="8" cy="8" r="6" class="tl-fill" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${(C * (1 - frac)).toFixed(2)}"/></svg>${label}</span>`;
  }

  // Sondage déjà voté / archivé : ligne compacte, ou carte complète si dépliée.
  function pollItem(p) {
    return openPolls.has(p.id) || editing === p.id ? pollCard(p, { collapsible: true }) : pollRow(p);
  }

  // Aperçu d'un message en une ligne (« GIF », « Photo », ou le texte).
  // Personnes bloquées (dans ce groupe) : leurs messages sont masqués.
  const isBlocked = (pid) => !!(state && state.me.blocked && state.me.blocked.includes(pid) && pid !== state.me.playerId);

  function msgSnippet(m) {
    if (m.deleted) return `<i>${T('supprimé', 'deleted', 'borrado')}</i>`;
    if (isBlocked(m.playerId)) return `<i>${T('message masqué', 'hidden message', 'mensaje oculto')}</i>`;
    if (m.kind === 'gif') return 'GIF';
    if (m.kind === 'image') return `📷 ${T('Photo', 'Photo', 'Foto')}`;
    return esc(m.text);
  }

  function pollChatPreview(p) {
    const c = p.chat || { count: 0, unread: 0, last: [] };
    if (c.locked) {
      return c.count
        ? `<div class="poll-chat locked"><span class="pc-ico">${icon('lock')}</span><span class="pc-body muted">${plural(c.count, T('commentaire', 'comment', 'comentario'))} · ${T('vote pour les voir', 'vote to see them', 'vota para verlos')}</span></div>`
        : '';
    }
    if (!c.count) return '';
    const lines = c.last.map((m) => {
      const u = player(m.playerId);
      const who = m.playerId === state.me.playerId ? T('Toi', 'You', 'Tú') : esc(u.name);
      return `<span class="pc-msg"><b class="pname" style="--pc:${esc(u.color)}">${who}</b> ${msgSnippet(m)}</span>`;
    }).join('');
    return `
      <button class="poll-chat" data-chat="${p.id}">
        <span class="pc-ico">${icon('comment')}</span>
        <span class="pc-body">${lines}</span>
        <span class="pc-count ${c.unread ? 'new' : ''}">${c.unread || c.count}</span>
      </button>`;
  }

  function openPollMenu(id) {
    const p = findPoll(id);
    if (!p) return;
    const canDelete = state.me.isAdmin || p.mine;
    openSheet(`
      <div class="sheet-head"><h2>${T('Options', 'Options', 'Opciones')}</h2><button class="x" data-close>✕</button></div>
      <p class="muted" style="margin:0 0 12px">${esc(qText(p))}</p>
      <div class="menu-list">
        ${!p.ended && p.myVote ? `<button class="menu-item" id="mEdit">${T('Changer mon vote', 'Change my vote', 'Cambiar mi voto')}</button>` : ''}
        ${canDelete ? `<button class="menu-item danger" id="mDel">${T('Supprimer le sondage', 'Delete the poll', 'Borrar la pregunta')}</button>` : ''}
      </div>`, (root) => {
      const ed = root.querySelector('#mEdit');
      if (ed) ed.onclick = () => { closeSheet(); editing = id; halfPick = null; renderView(); };
      action(root.querySelector('#mDel'), async () => {
        if (!confirm(T('Supprimer ce sondage pour tout le monde ?', 'Delete this poll for everyone?', '¿Borrar esta pregunta para todo el mundo?'))) return;
        await api('DELETE', `polls/${id}`);
        closeSheet();
        state.live = state.live.filter((x) => x.id !== id);
        state.archive = state.archive.filter((x) => x.id !== id);
        if (archiveExtra) archiveExtra.items = archiveExtra.items.filter((x) => x.id !== id);
        toast(T('Sondage supprimé', 'Poll deleted', 'Pregunta borrada'));
        renderMain();
      });
    });
  }

  // Remplace un sondage partout où il est affiché (en cours, archives).
  function updatePoll(poll) {
    for (const list of [state.live, state.archive, (archiveExtra && archiveExtra.items) || []]) {
      const i = list.findIndex((x) => x.id === poll.id);
      if (i >= 0) list[i] = poll;
    }
  }

  function bindPollCards(view) {
    view.querySelectorAll('[data-vote]').forEach((b) => bindVoteOption(b));
    view.querySelectorAll('[data-toggle]').forEach((b) => (b.onclick = () => {
      const id = b.dataset.toggle;
      if (openPolls.has(id)) openPolls.delete(id);
      else openPolls.add(id);
      if (editing === id) editing = null;
      renderView();
    }));
    view.querySelectorAll('[data-voters]').forEach((b) => (b.onclick = () => {
      const k = b.dataset.voters;
      if (openVoters.has(k)) openVoters.delete(k);
      else openVoters.add(k);
      renderView();
    }));
    view.querySelectorAll('[data-chat]').forEach((b) => (b.onclick = () => openChat(b.dataset.chat)));
    view.querySelectorAll('[data-more]').forEach((b) => (b.onclick = () => openPollMenu(b.dataset.more)));
    view.querySelectorAll('[data-cancel]').forEach((b) => (b.onclick = () => { editing = null; halfPick = null; renderView(); }));
    view.querySelectorAll('[data-half]').forEach((b) => (b.onclick = () => { halfPick = { pollId: b.dataset.half, picks: [] }; renderView(); }));
    view.querySelectorAll('[data-halfcancel]').forEach((b) => (b.onclick = () => { halfPick = null; renderView(); }));
    view.querySelectorAll('[data-halfsend]').forEach((b) => (b.onclick = () => sendHalf(b.closest('.poll'))));
    view.querySelectorAll('[data-rate]').forEach((b) => action(b, async () => {
      const p = findPoll(b.dataset.rate);
      const n = Number(b.dataset.n);
      const { poll } = await api('POST', `polls/${b.dataset.rate}/rate`, { rating: p && p.rating && p.rating.mine === n ? null : n });
      updatePoll(poll);
      renderView();
    }));
  }

  // Après un appui long, le doigt qui se lève envoie quand même un « click » (Android surtout) : il tomberait
  // sur ce qui vient de s'ouvrir (fond de la fenêtre de réactions, bouton redessiné…). On l'avale.
  // Seulement le click qui suit immédiatement le lever du doigt (iPhone n'en envoie souvent pas : on ne doit
  // pas manger le tap suivant).
  function swallowNextClick() {
    let t = null;
    const stop = (e) => { e.stopPropagation(); e.preventDefault(); done(); };
    const lifted = () => { clearTimeout(t); t = setTimeout(done, 120); };
    const done = () => {
      clearTimeout(t);
      document.removeEventListener('click', stop, true);
      document.removeEventListener('pointerup', lifted, true);
      document.removeEventListener('touchend', lifted, true);
    };
    t = setTimeout(done, 5000);
    document.addEventListener('click', stop, true);
    document.addEventListener('pointerup', lifted, true);
    document.addEventListener('touchend', lifted, true);
  }

  // Un choix de vote : tap = vote entier (ou, en mode ½, ajoute/retire la personne) ; appui long = mode ½.
  function bindVoteOption(b) {
    let timer = null;
    let long = false;
    let start = null;
    const cancel = () => { clearTimeout(timer); timer = null; };
    b.addEventListener('pointerdown', (e) => {
      long = false;
      start = [e.clientX, e.clientY];
      cancel();
      if (halfPick && halfPick.pollId === b.dataset.vote) return;
      timer = setTimeout(() => {
        timer = null;
        long = true;
        buzz(12);
        swallowNextClick();
        halfPick = { pollId: b.dataset.vote, picks: [b.dataset.target] };
        renderView();
      }, 480);
    });
    b.addEventListener('pointermove', (e) => {
      if (timer && start && Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 10) cancel();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => b.addEventListener(t, cancel));
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    b.onclick = () => {
      if (long) { long = false; return; }
      const id = b.dataset.vote;
      if (halfPick && halfPick.pollId === id) {
        const t = b.dataset.target;
        const picks = halfPick.picks.includes(t) ? halfPick.picks.filter((x) => x !== t) : halfPick.picks.concat(t);
        halfPick.picks = picks;
        if (picks.length >= 2) return sendHalf(b.closest('.poll'));
        return renderView();
      }
      castVote(b.closest('.poll'), id, { playerId: b.dataset.target }, [b]);
    };
  }

  function sendHalf(card) {
    if (!halfPick || !card) return;
    const { pollId, picks } = halfPick;
    const els = picks.map((t) => card.querySelector(`[data-target="${t}"]`)).filter(Boolean);
    halfPick = null;
    castVote(card, pollId, { half: picks }, els);
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Vote animé : 1) le choix s'illumine, 2) la carte montre les résultats et ton vote quelques secondes,
  // 3) elle se replie en douceur et rejoint « Déjà voté », où sa ligne brille un instant.
  async function castVote(card, id, body, chosen) {
    if (animating || !card) return;
    if (stale) return toast(T('Un instant, mise à jour…', 'One sec, updating…', 'Un momento, actualizando…'));
    const firstVote = !(findPoll(id) || {}).myVote;
    animating = true;
    card.querySelectorAll('[data-vote], .half-row button').forEach((x) => (x.disabled = true));
    card.classList.add('voting');
    chosen.forEach((b) => b.classList.add('chosen'));
    try {
      const [{ poll }] = await Promise.all([api('POST', `polls/${id}/vote`, body), wait(calm() ? 0 : 500)]);
      replacePoll(poll);
      editing = null;
      chats.delete(id);
      const tmp = document.createElement('div');
      tmp.innerHTML = pollCard(poll, { justVoted: true, collapsible: !firstVote });
      const fresh = tmp.firstElementChild;
      const bars = [...fresh.querySelectorAll('.r-fill')];
      const widths = bars.map((x) => x.style.width);
      bars.forEach((x) => (x.style.width = '0'));
      card.replaceWith(fresh);
      bindPollCards(fresh);
      requestAnimationFrame(() => requestAnimationFrame(() => bars.forEach((x, i) => (x.style.width = widths[i]))));
      clearNotifs();
      if (firstVote) {
        await wait(calm() ? 900 : 2400);
        fresh.style.height = fresh.offsetHeight + 'px';
        fresh.offsetHeight; // force le calcul avant la transition
        fresh.classList.add('leaving');
        fresh.style.height = '0px';
        await wait(calm() ? 0 : 450);
        flashId = id;
      } else {
        openPolls.add(id);
        await wait(calm() ? 0 : 1200);
      }
    } catch (e) {
      toast(e.message);
      refresh();
    }
    animating = false;
    pendingRender = false;
    renderMain();
    flashId = null;
  }

  function replacePoll(poll) {
    const i = state.live.findIndex((p) => p.id === poll.id);
    if (i >= 0) state.live[i] = poll;
    else state.live.unshift(poll);
  }

  // ---------- Demandes de récupération (compte perdu) ----------
  // Ceux qui peuvent valider (l'admin, ou les membres pour un admin) et la personne concernée voient une fenêtre
  // une fois, puis un bandeau en haut de Live tant que la demande est ouverte.
  const seenClaims = new Set();
  const claimsForMe = () => (state && state.claims ? state.claims : []).filter((c) => c.aboutMe || (c.canApprove && !c.approvals.includes(state.me.playerId)));

  function claimBanner() {
    return claimsForMe().map((c) => {
      const p = player(c.playerId);
      return `<button class="claim-banner ${c.aboutMe ? 'warn' : ''}" data-claimopen="${c.id}">${avatar(p, 'sm')}<span>${c.aboutMe
        ? T('Quelqu’un demande à récupérer <b>ton</b> nom', 'Someone is asking for <b>your</b> name', 'Alguien pide recuperar <b>tu</b> nombre')
        : T(`<b>${esc(p.name)}</b> a perdu son compte et demande à revenir`, `<b>${esc(p.name)}</b> lost their account and wants back in`, `<b>${esc(p.name)}</b> ha perdido su cuenta y pide volver`)}</span>${icon('key')}</button>`;
    }).join('');
  }

  function checkClaims() {
    if (!state || !$sheet.hidden || animating || chatOpen || stale) return;
    const c = claimsForMe().find((x) => !seenClaims.has(x.id));
    if (c) openClaimSheet(c.id);
  }

  function openClaimSheet(id) {
    const c = (state.claims || []).find((x) => x.id === id);
    if (!c) return;
    seenClaims.add(id);
    const p = player(c.playerId);
    const by = c.approvals.map(player);
    const canOk = c.canApprove && !c.approvals.includes(state.me.playerId);
    openSheet(`
      <div class="sheet-head"><h2>${c.aboutMe ? T('⚠️ On demande ton nom', '⚠️ Someone wants your name', '⚠️ Alguien pide tu nombre') : T('🔑 Compte perdu', '🔑 Lost account', '🔑 Cuenta perdida')}</h2><button class="x" data-close>✕</button></div>
      <div class="claim-who">${avatar(p, 'lg')}<b>${esc(p.name)}</b></div>
      <p class="muted">${c.aboutMe
        ? T('Quelqu’un dit être toi et avoir perdu son compte. Si ce n’est pas toi, refuse : la demande s’arrête là.', 'Someone says they’re you and lost their account. If it isn’t you, deny it: the request stops there.', 'Alguien dice ser tú y haber perdido la cuenta. Si no eres tú, recházala y ahí se acaba.')
        : T(`Quelqu’un dit être <b>${esc(p.name)}</b> et avoir perdu son compte (nouveau téléphone, app supprimée…). Valide seulement si tu es sûr·e que c’est bien lui/elle : demande-lui en vrai !`, `Someone says they’re <b>${esc(p.name)}</b> and lost their account (new phone, app deleted…). Only approve if you’re sure it’s really them: ask them in real life!`, `Alguien dice ser <b>${esc(p.name)}</b> y haber perdido su cuenta (móvil nuevo, app borrada…). Valida solo si tienes claro que es quien dice: ¡pregúntale en persona!`)}</p>
      ${c.needed > 1 ? `<p class="small muted">${T(`Il faut ${c.needed} validations`, `It needs ${c.needed} approvals`, `Hacen falta ${c.needed} confirmaciones`)} : ${c.approvals.length}/${c.needed}${by.length ? ' · ' + by.map((u) => esc(u.name)).join(', ') : ''}</p>` : ''}
      <div class="row">
        <button class="btn btn-soft" id="clDeny">${c.aboutMe ? T('Pas moi : refuser', 'Not me: deny', 'No soy yo: rechazar') : T('Refuser', 'Deny', 'Rechazar')}</button>
        ${canOk ? `<button class="btn btn-main" id="clOk">${T('C’est bien lui/elle', 'It’s really them', 'Sí, es quien dice')}</button>` : `<button class="btn btn-main" data-close>${T('Plus tard', 'Later', 'Luego')}</button>`}
      </div>`, (root) => {
      action(root.querySelector('#clDeny'), async () => {
        await api('POST', `claims/${id}/deny`);
        closeSheet();
        toast(T('Demande refusée', 'Request denied', 'Solicitud rechazada'));
        await refresh();
      });
      action(root.querySelector('#clOk'), async () => {
        const r = await api('POST', `claims/${id}/approve`);
        closeSheet();
        toast(r.status === 'done' ? T(`C’est fait : ${p.name} est de retour 🎉`, `Done: ${p.name} is back 🎉`, `Listo: ${p.name} ha vuelto 🎉`) : T('Validé 👍 Il manque encore une validation.', 'Approved 👍 One more approval needed.', 'Confirmado 👍 Falta una confirmación más.'));
        await refresh();
      });
    });
  }

  // ---------- Live ----------

  function liveSwitch() {
    return `
      <div class="seg live-seg">
        <button type="button" data-live="live" class="${liveMode === 'live' ? 'on' : ''}">${T('En cours', 'Live', 'En curso')}</button>
        <button type="button" data-live="archive" class="${liveMode === 'archive' ? 'on' : ''}">${T('Archives', 'Archive', 'Archivo')}</button>
      </div>`;
  }

  function bindLiveSwitch(view) {
    view.querySelectorAll('[data-live]').forEach((b) => (b.onclick = () => {
      liveMode = b.dataset.live;
      openPolls.clear();
      save('liveMode', liveMode);
      renderView();
      window.scrollTo({ top: 0 });
    }));
  }

  function renderLive(view) {
    if (liveMode === 'archive') return renderArchive(view);
    const todo = state.live.filter((p) => !p.myVote);
    const done = state.live.filter((p) => p.myVote);

    view.innerHTML = `
      ${claimBanner()}
      ${recapBanner()}
      ${installBanner()}
      <div class="live-head">${liveSwitch()}${dropMeter()}</div>
      ${!state.live.length ? `
        <div class="card empty">
          ${T('Rien à voter pour l’instant…<br>Lance une question avec le bouton + si tu t’ennuies.', 'Nothing to vote on right now…<br>Launch a question with the + button if you’re bored.', 'Nada que votar por ahora…<br>Lanza una pregunta con el botón + si te aburres.')}
        </div>` : ''}
      ${todo.length ? `<div class="section-title">${T('À toi de voter', 'Your turn to vote', 'Te toca votar')} <span class="count">${todo.length}</span></div>${todo.map((p) => pollCard(p)).join('')}` : ''}
      ${!todo.length && done.length ? `<p class="all-done">${T('Tu as voté partout.', 'You voted on everything.', 'Ya has votado en todas.')}</p>` : ''}
      ${done.length ? `<button class="section-title fold-title ${doneFolded ? 'folded' : ''}" id="doneToggle" aria-expanded="${!doneFolded}">${T('Déjà voté', 'Already voted', 'Ya votadas')} <span class="count">${done.length}</span>${icon('down')}</button>${doneFolded ? '' : `<div class="prow-list">${done.map(pollItem).join('')}</div>`}` : ''}
      <button class="fab" id="fab" aria-label="${T('Lancer une question', 'Launch a question', 'Lanzar una pregunta')}">${icon('plus')}</button>`;

    bindPollCards(view);
    bindLiveSwitch(view);
    bindInstallBanner();
    view.querySelectorAll('[data-claimopen]').forEach((b) => (b.onclick = () => openClaimSheet(b.dataset.claimopen)));
    view.querySelectorAll('[data-recap]').forEach((b) => (b.onclick = () => openRecap(b.dataset.recap)));
    // Le bouton + vit hors de #view : pendant un glissement, #view bouge (transform) et l'emporterait avec lui.
    const fab = document.getElementById('fab');
    document.querySelectorAll('body > .fab').forEach((x) => x !== fab && x.remove());
    document.body.appendChild(fab);
    fab.onclick = () => openDropSheet();
    const dt = document.getElementById('doneToggle');
    if (dt) dt.onclick = () => { doneFolded = !doneFolded; save('doneFolded', doneFolded ? '1' : null); renderView(); };
    const meter = document.getElementById('dropMeter');
    if (meter) meter.onclick = openDropInfo;
    fitVoteCards();
  }

  // Cartes à voter : même place à l'écran quelle que soit la taille du groupe (~90 % avec la barre du haut
  // et celle du bas). Petit groupe → une colonne de grands boutons ; grand groupe → 2 ou 3 colonnes plus serrées.
  function fitVoteCards() {
    const cards = [...document.querySelectorAll('.poll.todo')];
    if (!cards.length) return;
    const nav = document.querySelector('.nav');
    const navH = nav ? nav.offsetHeight : 0;
    const first = cards[0];
    first.classList.remove('fit');
    first.style.minHeight = '';
    const top = first.getBoundingClientRect().top + window.scrollY;
    // Le premier écran : de la carte jusqu'à 90 % de la hauteur, moins la barre du bas.
    const avail = Math.max(360, window.innerHeight * 0.9 - Math.min(top, 170) - navH);
    const GAP = 7;
    for (const card of cards) {
      const list = card.querySelector('.vote-list');
      if (!list) continue;
      card.classList.remove('fit');
      card.style.minHeight = '';
      const n = list.children.length;
      const fixed = card.offsetHeight - list.offsetHeight;
      const room = avail - fixed;
      let pick = null;
      // 2 colonnes en priorité (plus joli) ; 3 seulement pour les très grands groupes qui ne tiennent pas en 2.
      for (const [cols, min, max] of [[1, 46, 78], [2, 32, 64], [3, 32, 50]]) {
        if (cols === 1 && n > 5) continue;
        if (cols === 2 && n > 16) {
          const rows2 = Math.ceil(n / 2);
          if ((room - GAP * (rows2 - 1)) / rows2 < min) continue;
        }
        const rows = Math.ceil(n / cols);
        const h = (room - GAP * (rows - 1)) / rows;
        if (h >= min || cols === 3 || (cols === 2 && n <= 16)) {
          pick = { cols, h: Math.max(min, Math.min(max, h)) };
          break;
        }
      }
      const h = pick.h;
      card.style.setProperty('--cols', pick.cols);
      card.style.setProperty('--opt-h', `${Math.round(h)}px`);
      card.style.setProperty('--opt-av', `${Math.round(Math.min(46, Math.max(22, h * 0.62)))}px`);
      card.style.setProperty('--opt-fs', `${Math.min(17.5, Math.max(13, 10 + h * 0.11)).toFixed(1)}px`);
      card.style.setProperty('--gap', `${GAP}px`);
      card.style.minHeight = `${Math.round(avail)}px`;
      card.classList.add('fit');
    }
  }
  let fitTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(() => { if (state && tab === 'live' && liveMode === 'live') fitVoteCards(); }, 150);
  });

  // Compte à rebours vers la prochaine question auto : un petit anneau qui se remplit.
  function dropMeter() {
    if (!state.nextDrop) return '';
    const end = state.nextDrop;
    const start = state.prevDrop && state.prevDrop < end ? state.prevDrop : end - state.settings.intervalHours * 3600e3;
    const frac = Math.min(1, Math.max(0, (now() - start) / (end - start)));
    return `
      <button class="drop-meter" id="dropMeter" aria-label="${T('Prochaine question dans', 'Next question in', 'Próxima pregunta en')} ${left(end)}">
        <span class="dm-row"><span class="dm-label">${T('Prochaine question', 'Next question', 'Próxima pregunta')}</span><b>${left(end).replace(' h ', 'h')}</b></span>
        <span class="dm-bar"><span style="width:${(frac * 100).toFixed(1)}%"></span></span>
      </button>`;
  }

  function openDropInfo() {
    const total = state.sets.reduce((n, s) => n + s.total, 0) || 1;
    const pct = Math.round((state.remainingQuestions / total) * 100);
    openSheet(`
      <div class="sheet-head"><h2>${T('Prochaine question', 'Next question', 'Próxima pregunta')}</h2><button class="x" data-close>✕</button></div>
      <p class="drop-info-big">${clock(state.nextDrop)} <span class="muted">· ${T('dans', 'in', 'en')} ${left(state.nextDrop)}</span></p>
      <p class="muted small">${scheduleText(state.settings)}</p>
      <div class="reserve">
        <div class="reserve-label"><span>${T('Questions en réserve', 'Questions left', 'Preguntas en reserva')}</span><b>${state.remainingQuestions} / ${total}</b></div>
        <div class="reserve-bar"><span style="width:${pct}%"></span></div>
      </div>`, () => {});
  }

  // « Une question toutes les 3 h, de 10 h à 23 h » (la plage peut finir le lendemain).
  function scheduleText(st) {
    const every = L ? String(st.intervalHours) : String(st.intervalHours).replace('.', ',');
    st = { ...st, startHour: hourToLocal(st.startHour, st.timezone), endHour: hourToLocal(st.endHour, st.timezone) };
    const wraps = st.endHour < st.startHour;
    const allDay = (st.endHour + 1) % 24 === st.startHour && st.intervalHours <= 1;
    const freq = Number(st.intervalHours) === 1 ? T('Une question toutes les heures', 'A question every hour', 'Una pregunta cada hora') : T(`Une question toutes les ${every} h`, `A question every ${every}h`, `Una pregunta cada ${every} h`);
    if (allDay) return T(`${freq}, jour et nuit.`, `${freq}, day and night.`, `${freq}, día y noche.`);
    return T(`${freq}, de ${st.startHour} h à ${st.endHour} h${wraps ? ' (le lendemain)' : ''}.`,
      `${freq}, from ${hourLabel(st.startHour)} to ${hourLabel(st.endHour)}${wraps ? ' (next day)' : ''}.`, `${freq}, de ${hourLabel(st.startHour)} a ${hourLabel(st.endHour)}${wraps ? ' (del día siguiente)' : ''}.`);
  }
  const hourLabel = (h) => {
    const hh = Math.floor(h);
    const mm = String(Math.round((h % 1) * 60)).padStart(2, '0');
    return LANG === 'fr' ? `${hh} h${mm === '00' ? '' : mm}` : `${hh}:${mm}`;
  };

  // L'anneau avance tout seul, sans redessiner l'écran.
  setInterval(() => {
    const m = document.getElementById('dropMeter');
    if (!m || !state || animating) return;
    m.outerHTML = dropMeter();
    const fresh = document.getElementById('dropMeter');
    if (fresh) fresh.onclick = openDropInfo;
  }, 30000);

  // ---------- Installation sur l'écran d'accueil ----------

  let installPrompt = null; // événement Android/Chrome pour installer en un clic
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    if (state && tab === 'live') renderView();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    toast(T('App installée', 'App installed', 'App instalada'));
    if (state && tab === 'live') renderView();
  });

  function installBanner() {
    if (NATIVE || isStandalone() || load('installHidden')) return '';
    if (!installPrompt && !isIOS) return '';
    return `
      <div class="install-banner">
        
        <div class="ib-text"><b>${T('Installe l’app', 'Install the app', 'Instala la app')}</b><span>${T(`Une icône sur ton écran d’accueil${isIOS ? ' et les notifs' : ''}.`, `An icon on your home screen${isIOS ? ' and notifications' : ''}.`, `Un icono en tu pantalla de inicio${isIOS ? ' y las notis' : ''}.`)}</span></div>
        <button class="btn btn-main btn-small" id="installBtn">${T('Installer', 'Install', 'Instalar')}</button>
        <button class="x" id="installHide" aria-label="${T('Masquer', 'Hide', 'Ocultar')}">✕</button>
      </div>`;
  }

  function bindInstallBanner() {
    const btn = document.getElementById('installBtn');
    if (!btn) return;
    document.getElementById('installHide').onclick = () => {
      save('installHidden', '1');
      renderView();
    };
    btn.onclick = async () => {
      if (installPrompt) {
        installPrompt.prompt();
        await installPrompt.userChoice.catch(() => null);
        installPrompt = null;
        renderView();
        return;
      }
      openSheet(`
        <div class="sheet-head"><h2>${T('Installer sur iPhone', 'Install on iPhone', 'Instalar en iPhone')}</h2><button class="x" data-close>✕</button></div>
        <ol class="steps">${T(`
          <li>Ouvre ce site dans <b>Safari</b>.</li>
          <li>Touche le bouton <b>Partager</b> <span class="share-ico">⎋</span> (le carré avec une flèche, en bas de l’écran).</li>
          <li>Choisis <b>Sur l’écran d’accueil</b>, puis <b>Ajouter</b>.</li>
          <li>Ouvre l’app depuis la nouvelle icône, puis va dans <b>Moi → Activer les notifs</b>.</li>`, `
          <li>Open this site in <b>Safari</b>.</li>
          <li>Tap the <b>Share</b> button <span class="share-ico">⎋</span> (the square with an arrow, at the bottom of the screen).</li>
          <li>Pick <b>Add to Home Screen</b>, then <b>Add</b>.</li>
          <li>Open the app from the new icon, then go to <b>Me → Turn on notifications</b>.</li>`, `
          <li>Abre esta web en <b>Safari</b>.</li>
          <li>Toca el botón <b>Compartir</b> <span class="share-ico">⎋</span> (el cuadrado con la flecha, abajo del todo).</li>
          <li>Elige <b>Añadir a pantalla de inicio</b> y luego <b>Añadir</b>.</li>
          <li>Abre la app desde el nuevo icono y ve a <b>Yo → Activar notificaciones</b>.</li>`)}
        </ol>
        <p class="muted small">${T('Les notifs sur iPhone demandent iOS 16.4 ou plus récent.', 'Notifications on iPhone need iOS 16.4 or newer.', 'Para las notis en iPhone hace falta iOS 16.4 o superior.')}</p>
        <button class="btn btn-main btn-block" data-close>${T('Compris', 'Got it', 'Vale')}</button>`, () => {});
    };
  }

  // ---------- Feuille "Lancer une question" ----------

  function closeSheet() {
    $sheet.hidden = true;
    $sheet.innerHTML = '';
    document.body.classList.remove('noscroll');
    syncGuard();
  }

  function openSheet(html, bind) {
    $sheet.innerHTML = `<div class="sheet-bg" data-close></div><div class="sheet">${html}</div>`;
    $sheet.hidden = false;
    document.body.classList.add('noscroll');
    $sheet.querySelectorAll('[data-close]').forEach((el) => (el.onclick = closeSheet));
    syncGuard();
    bind($sheet);
  }

  // Un seul bouton : avec du texte → « Lancer ma question », sans texte → « Question surprise ».
  // Le brouillon reste (changement de set, fermeture de la fenêtre) jusqu'à ce que la question parte.
  function openDropSheet(presetSet = '') {
    let setId = presetSet;
    let draft = load('dropDraft') || '';
    const sets = state.sets;
    const draw = () => {
      const s = setId ? setOf(setId) : null;
      const leftToday = state.me.dropsLeft;
      const none = leftToday <= 0;
      const off = state.me.dropsPerDay <= 0;
      const reset = state.settings.timezone === myTz ? T('à minuit', 'at midnight', 'a medianoche') : T(`à ${clock(state.me.dropsResetAt)}`, `at ${clock(state.me.dropsResetAt)}`, `a las ${clock(state.me.dropsResetAt)}`);
      openSheet(`
        <div class="sheet-head"><h2>${T('Lancer une question', 'Launch a question', 'Lanzar una pregunta')}</h2><button class="x" data-close>✕</button></div>
        <p class="drops-left ${none ? 'empty' : ''}">${off
          ? T('L’admin a désactivé les questions en plus dans ce groupe.', 'The admin turned off extra questions in this group.', 'El admin ha desactivado las preguntas extra en este grupo.')
          : none
            ? T(`Tu as utilisé ${state.me.dropsPerDay > 1 ? `tes ${state.me.dropsPerDay} questions` : 'ta question'} en plus du jour. Ça repart ${reset}.`, `You used your extra question${state.me.dropsPerDay > 1 ? 's' : ''} for today. Resets ${reset}.`, `Ya has usado ${state.me.dropsPerDay > 1 ? 'tus preguntas extra' : 'tu pregunta extra'} de hoy. Se recarga ${reset}.`)
            : T(`Il te reste <b>${leftToday}</b> question${leftToday > 1 ? 's' : ''} en plus aujourd’hui (sur ${state.me.dropsPerDay}). Elle part tout de suite, pour ${pollDuration()}.`, `You’ve got <b>${leftToday}</b> extra question${leftToday > 1 ? 's' : ''} left today (out of ${state.me.dropsPerDay}). It goes out right away, for ${pollDuration()}.`, `Hoy aún tienes <b>${leftToday}</b> pregunta${leftToday > 1 ? 's' : ''} extra (de ${state.me.dropsPerDay}). Sale al momento y dura ${pollDuration()}.`)}</p>
        <label>Set</label>
        <div class="set-chips">
          <button class="chip ${!setId ? 'on' : ''}" data-set="">${T('N’importe lequel', 'Any', 'Cualquiera')}</button>
          ${sets.map((x) => `<button class="chip ${setId === x.id ? 'on' : ''} ${x.spicy ? 'spicy' : ''}" data-set="${x.id}">${esc(setName(x))}</button>`).join('')}
        </div>
        <label for="ownQ">${T('Ta question', 'Your question', 'Tu pregunta')} <span class="muted">${T('(sinon : une question surprise du set)', '(or leave empty for a surprise question)', '(si no, una pregunta sorpresa del set)')}</span></label>
        <textarea class="input" id="ownQ" maxlength="200" placeholder="${T('Qui serait le plus susceptible de…', 'Who would be most likely to…', '¿Quién sería más capaz de…')}" ${none ? 'disabled' : ''}>${esc(draft)}</textarea>
        <p class="muted small own-hint" id="ownHint" ${draft.trim() ? '' : 'hidden'}>${T('Elle apparaîtra avec ton nom, comme question perso.', 'It’ll show up with your name, as your own question.', 'Saldrá con tu nombre, como pregunta tuya.')}</p>
        <button class="btn btn-main btn-block" id="dropGo" ${none ? 'disabled' : ''}></button>`, (root) => {
        const area = root.querySelector('#ownQ');
        const go = root.querySelector('#dropGo');
        const label = () => {
          const own = draft.trim().length > 0;
          go.textContent = own ? T('Lancer ma question', 'Launch my question', 'Lanzar mi pregunta') : `${T('Question surprise', 'Surprise question', 'Pregunta sorpresa')}${s ? ` · ${s.remaining} ${T('dispo', 'left', 'libres')}` : ''}`;
          go.disabled = none || (!own && s && !s.remaining);
          root.querySelector('#ownHint').hidden = !own;
        };
        label();
        area.oninput = () => {
          draft = area.value;
          save('dropDraft', draft || null);
          label();
        };
        root.querySelectorAll('[data-set]').forEach((b) => (b.onclick = () => { draft = area.value; setId = b.dataset.set; draw(); }));
        action(go, async () => {
          const text = draft.trim();
          if (!text) return drop({ setId: setId || undefined });
          if (text.length < 8) throw new Error(T('Écris une vraie question', 'Write a real question', 'Escribe una pregunta de verdad'));
          if (!setId) {
            root.querySelector('.set-chips').classList.add('shake');
            setTimeout(() => root.querySelector('.set-chips')?.classList.remove('shake'), 600);
            throw new Error(T('Choisis le set de ta question', 'Pick a set for your question', 'Elige el set de tu pregunta'));
          }
          await drop({ setId, text });
          save('dropDraft', null);
        });
      });
    };
    draw();
  }

  // Durée de vote réglée par l'admin (« 24 h », « 1 h 30 »).
  function pollDuration() {
    const h = state.settings.pollHours;
    const m = Math.round((h % 1) * 60);
    return `${Math.floor(h) ? Math.floor(h) + ' h' : ''}${m ? ' ' + m + ' min' : ''}`.trim();
  }

  async function drop(body) {
    const { poll, dropsLeft } = await api('POST', 'drop', body);
    replacePoll(poll);
    state.me.dropsLeft = dropsLeft;
    closeSheet();
    toast(poll.custom ? T('Ta question est lancée 🚀', 'Your question is live 🚀', '¡Pregunta lanzada! 🚀') : T(`Question lancée · encore ${dropsLeft} aujourd’hui`, `Question launched · ${dropsLeft} left today`, `Pregunta lanzada · te quedan ${dropsLeft} hoy`));
    tab = 'live';
    save('tab', tab);
    await refresh();
  }

  // ---------- Archives ----------

  function renderArchive(view) {
    const data = archiveExtra || { items: state.archive, hasMore: state.archiveHasMore };
    view.innerHTML = `
      <div class="live-head">${liveSwitch()}${dropMeter()}</div>
      <div class="filter-row">
        <select class="input" id="archSet">
          <option value="">${T('Tous les sets', 'All sets', 'Todos los sets')}</option>
          ${state.sets.map((s) => `<option value="${s.id}" ${archiveSet === s.id ? 'selected' : ''}>${esc(s.emoji)} ${esc(setName(s))}</option>`).join('')}
        </select>
      </div>
      ${data.items.length ? `<div class="prow-list">${data.items.map(pollItem).join('')}</div>` : `<div class="card empty">${T(`Rien dans les archives pour l’instant.<br>Les questions y arrivent après leurs ${pollDuration()} de vote.`, `Nothing in the archive yet.<br>Questions land here after their ${pollDuration()} of voting.`, `El archivo está vacío por ahora.<br>Las preguntas llegan aquí después de sus ${pollDuration()} de votación.`)}</div>`}
      ${data.hasMore ? `<button class="btn btn-soft btn-block" id="more">${T('Voir plus', 'Show more', 'Ver más')}</button>` : ''}`;

    bindPollCards(view);
    bindLiveSwitch(view);
    const meter = document.getElementById('dropMeter');
    if (meter) meter.onclick = openDropInfo;
    document.getElementById('archSet').onchange = async (e) => {
      archiveSet = e.target.value;
      try {
        archiveExtra = archiveSet ? await api('GET', 'archive?set=' + encodeURIComponent(archiveSet)) : null;
      } catch (err) { toast(err.message); }
      e.target.blur();
      renderView();
    };
    action(document.getElementById('more'), async () => {
      const last = data.items[data.items.length - 1];
      const page = await api('GET', `archive?before=${last.endsAt}${archiveSet ? '&set=' + encodeURIComponent(archiveSet) : ''}`);
      archiveExtra = { items: [...data.items, ...page.items], hasMore: page.hasMore };
      renderView();
    });
  }

  // ---------- Sets ----------

  function renderSets(view) {
    if (openSet) return renderSetDetail(view);
    const classic = state.sets.filter((s) => !s.spicy);
    const spicy = state.sets.filter((s) => s.spicy);
    const grid = (list) => `<div class="set-grid">${list.map((s) => `
      <button class="set-card ${s.spicy ? 'spicy' : ''}" data-open="${s.id}">
        <span class="set-emoji">${esc(s.emoji)}</span>
        <span class="set-name">${esc(setName(s))}</span>
        <span class="set-count">${T(`${s.played} jouée${s.played > 1 ? 's' : ''} · ${s.remaining} secrète${s.remaining > 1 ? 's' : ''}`, `${s.played} played · ${s.remaining} secret`, `Jugadas: ${s.played} · Secretas: ${s.remaining}`)}</span>
        ${s.builtin ? '' : `<span class="set-tag">${T('par', 'by', 'por')} ${esc(s.author ? player(s.author).name : '?')}</span>`}
      </button>`).join('')}</div>`;

    view.innerHTML = `
      <button class="btn btn-main btn-block" id="newSet" style="margin-top:0">＋ ${T('Créer un set', 'Create a set', 'Crear un set')}</button>
      <div class="section-title">${T('Les sets', 'Sets', 'Los sets')} <span class="count">${classic.length}</span></div>
      ${grid(classic)}
      ${spicy.length ? `<div class="section-title">Spicy · 18+ <span class="count">${spicy.length}</span></div>${grid(spicy)}` : ''}`;

    view.querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => { openSet = b.dataset.open; setDetail = null; renderView(); window.scrollTo({ top: 0 }); }));
    document.getElementById('newSet').onclick = () => openSetForm();
  }

  function openSetForm(existing) {
    let emoji = existing ? existing.emoji : '✨';
    openSheet(`
      <div class="sheet-head"><h2>${existing ? T('Modifier le set', 'Edit the set', 'Editar set') : T('Nouveau set', 'New set', 'Nuevo set')}</h2><button class="x" data-close>✕</button></div>
      <label for="setName">${T('Nom', 'Name', 'Nombre')}</label>
      <input class="input" id="setName" maxlength="40" placeholder="${T('Ex : Les vacances à Lisbonne', 'Ex: That trip to Lisbon', 'Ej.: Vacaciones en Lisboa')}" value="${esc(existing ? existing.name : '')}">
      <label for="setDesc">${T('Description', 'Description', 'Descripción')}</label>
      <input class="input" id="setDesc" maxlength="120" placeholder="${T('De quoi ça parle ?', 'What’s it about?', '¿De qué va?')}" value="${esc(existing ? existing.description : '')}">
      <label>Emoji</label>${emojiGrid(SET_EMOJIS, emoji)}
      <label class="toggle"><input type="checkbox" id="setSpicy" ${existing && existing.spicy ? 'checked' : ''}> <span>${T('Set spicy (18+)', 'Spicy set (18+)', 'Set picante (18+)')}</span></label>
      <button class="btn btn-main btn-block" id="saveSet">${existing ? T('Enregistrer', 'Save', 'Guardar') : T('Créer le set', 'Create the set', 'Crear el set')}</button>`, (root) => {
      bindEmojiGrid(root, (e) => (emoji = e));
      action(root.querySelector('#saveSet'), async () => {
        const body = {
          name: root.querySelector('#setName').value,
          description: root.querySelector('#setDesc').value,
          emoji,
          spicy: root.querySelector('#setSpicy').checked,
        };
        const { set } = existing ? await api('PATCH', `sets/${existing.id}`, body) : await api('POST', 'sets', body);
        closeSheet();
        toast(existing ? T('Set modifié', 'Set updated', 'Set editado') : T('Set créé. Ajoute des questions.', 'Set created. Add some questions.', 'Set creado. Añade preguntas.'));
        openSet = set.id;
        setDetail = null;
        await refresh();
      });
    });
  }

  async function renderSetDetail(view) {
    const s = state.sets.find((x) => x.id === openSet);
    if (!s) { openSet = null; return renderSets(view); }
    if (!setDetail || setDetail.set.id !== s.id) {
      view.innerHTML = `<div class="card empty">${T('Chargement…', 'Loading…', 'Cargando…')}</div>`;
      try {
        setDetail = await api('GET', `sets/${s.id}`);
      } catch (e) {
        toast(e.message);
        openSet = null;
        return renderSets(view);
      }
      if (tab !== 'sets' || openSet !== s.id) return;
    }
    const d = setDetail;
    const canEdit = !s.builtin && (s.mine || state.me.isAdmin);

    view.innerHTML = `
      <button class="back" id="back">← ${T('Tous les sets', 'All sets', 'Todos los sets')}</button>
      <div class="card set-hero ${s.spicy ? 'spicy' : ''}">
        <span class="set-emoji big">${esc(s.emoji)}</span>
        <h2 class="question" style="margin:4px 0">${esc(setName(s))}${s.spicy ? ' <span class="set-badge spicy">18+</span>' : ''}</h2>
        ${setDesc(s) ? `<p class="muted" style="margin:0">${esc(setDesc(s))}</p>` : ''}
        <p class="set-count" style="margin:10px 0 0">${T(`${s.played} jouée${s.played > 1 ? 's' : ''} · ${s.remaining} encore secrète${s.remaining > 1 ? 's' : ''}`, `${s.played} played · ${s.remaining} still secret`, `Jugadas: ${s.played} · Aún secretas: ${s.remaining}`)}</p>
        <div class="row">
          <button class="btn btn-main" id="dropHere" ${s.remaining ? '' : 'disabled'}>${T('Lancer une question', 'Launch a question', 'Lanzar una pregunta')}</button>
          ${canEdit ? `<button class="btn btn-soft" id="editSet">${T('Modifier', 'Edit', 'Editar')}</button>` : ''}
        </div>
      </div>

      <div class="card">
        <label for="newQ" style="margin-top:0">${T('Ajouter des questions', 'Add questions', 'Añadir preguntas')}</label>
        <textarea class="input" id="newQ" placeholder="${T('Une question par ligne.&#10;Qui est le plus susceptible de…', 'One question per line.&#10;Who’s most likely to…', 'Una pregunta por línea.&#10;¿Quién es más capaz de…')}"></textarea>
        <p class="muted small">${T('Elles restent secrètes et tombent plus tard, au hasard. Pour en poser une tout de suite : « Lancer » à côté de la question, ou le bouton + dans Live. Pas de doublons : on vérifie !', 'They stay secret and drop later, at random. To ask one right now: “Launch” next to it, or the + button in Live. No duplicates, we check!', 'Siguen en secreto y salen más tarde, al azar. Para lanzar una ya: «Lanzar» al lado de la pregunta, o el botón + en Live. Nada de repetidas: ¡lo comprobamos!')}</p>
        <button class="btn btn-soft btn-block" id="addQ" style="margin-top:10px">${T('Ajouter au set', 'Add to the set', 'Añadir al set')}</button>
      </div>

      ${d.mine.length ? `
        <div class="section-title">${T('Tes questions en attente', 'Your questions waiting', 'Tus preguntas pendientes')} <span class="count">${d.mine.length}</span></div>
        <div class="card qlist">${d.mine.map((q) => `
          <div class="qrow"><span>${esc(q.text)}</span><span class="qrow-acts"><button class="btn btn-small btn-main" data-launchq="${q.id}">${T('Lancer', 'Launch', 'Lanzar')}</button><button class="btn btn-small btn-danger" data-delq="${q.id}" aria-label="${T('Supprimer', 'Delete', 'Borrar')}">${icon('trash')}</button></span></div>`).join('')}
        </div>` : ''}

      <div class="section-title">${T('Déjà jouées', 'Already played', 'Ya jugadas')} <span class="count">${d.played.length}</span></div>
      ${d.played.length ? `<div class="card qlist">${d.played.map((q) => `<div class="qrow"><span>${esc(qText(q))}</span><span class="muted small">${ago(q.usedAt)}</span></div>`).join('')}</div>`
        : `<div class="card empty" style="padding:18px">${T('Aucune question jouée pour l’instant.', 'No questions played yet.', 'Todavía no se ha jugado ninguna pregunta.')}</div>`}
      ${canEdit && !s.played ? `<button class="btn btn-danger btn-block" id="delSet">${T('Supprimer ce set', 'Delete this set', 'Borrar este set')}</button>` : ''}`;

    document.getElementById('back').onclick = () => { openSet = null; renderView(); };
    document.getElementById('dropHere').onclick = () => openDropSheet(s.id);
    if (canEdit) document.getElementById('editSet').onclick = () => openSetForm(s);
    action(document.getElementById('addQ'), async () => {
      const text = document.getElementById('newQ').value;
      const r = await api('POST', `sets/${s.id}/questions`, { text });
      toast(r.added.length ? T(`${plural(r.added.length, 'question')} ajoutée${r.added.length > 1 ? 's' : ''}`, `${plural(r.added.length, 'question')} added`, `Añadido: ${plural(r.added.length, 'pregunta')}`) : T('Rien ajouté', 'Nothing added', 'No se ha añadido nada'));
      if (r.errors.length) alert(T('Pas ajoutées :', 'Not added:', 'No se han añadido:') + '\n\n' + r.errors.join('\n'));
      setDetail = null;
      await refresh();
    });
    // Lancer une de ses questions en attente tout de suite (sinon elle tombe plus tard, au hasard).
    view.querySelectorAll('[data-launchq]').forEach((b) => action(b, async () => {
      if (state.me.dropsLeft <= 0) throw new Error(T('Plus de question en plus aujourd’hui. Elle tombera plus tard au hasard.', 'No extra questions left today. It’ll drop later at random.'));
      setDetail = null;
      await drop({ questionId: b.dataset.launchq });
    }));
    view.querySelectorAll('[data-delq]').forEach((b) => action(b, async () => {
      if (!confirm(T('Supprimer cette question ?', 'Delete this question?', '¿Borrar esta pregunta?'))) return;
      await api('DELETE', `questions/${b.dataset.delq}`);
      setDetail = null;
      await refresh();
    }));
    action(document.getElementById('delSet'), async () => {
      if (!confirm(T(`Supprimer le set « ${s.name} » et ses questions ?`, `Delete the set “${s.name}” and its questions?`, `¿Borrar el set «${s.name}» y sus preguntas?`))) return;
      await api('DELETE', `sets/${s.id}`);
      openSet = null;
      toast(T('Set supprimé', 'Set deleted', 'Set borrado'));
      await refresh();
    });
  }

  // ---------- Stats ----------
  // Trois onglets : Profil (radar, titres, moments), Affinités (toi comparé aux autres), Groupe (notes, unanimités…).

  function renderStats(view) {
    const pid = statsPlayer && state.players.some((p) => p.id === statsPlayer) ? statsPlayer : state.me.playerId;
    const strip = statsMode === 'group' ? '' : `
      <div class="player-strip">
        ${state.players.map((u) => `<button class="strip-item ${u.id === pid ? 'on' : ''}" data-player="${u.id}">${avatar(u)}<span>${esc(u.name)}</span></button>`).join('')}
      </div>`;
    view.innerHTML = `
      <div class="seg seg-3 stats-seg">
        <button type="button" data-smode="me" class="${statsMode === 'me' ? 'on' : ''}">${T('Profil', 'Profile', 'Perfil')}</button>
        <button type="button" data-smode="duo" class="${statsMode === 'duo' ? 'on' : ''}">${T('Affinités', 'Duos', 'Afinidades')}</button>
        <button type="button" data-smode="group" class="${statsMode === 'group' ? 'on' : ''}">${T('Groupe', 'Group', 'Grupo')}</button>
      </div>
      ${strip}
      ${statsMode === 'duo' ? statsDuo(pid) : statsMode === 'group' ? statsGroup() : statsProfile(pid)}`;
    view.querySelectorAll('[data-player]').forEach((b) => (b.onclick = () => { statsPlayer = b.dataset.player; renderView(); }));
    view.querySelectorAll('[data-smode]').forEach((b) => (b.onclick = () => setStatsMode(b.dataset.smode)));
    statsArrows();
    view.querySelectorAll('[data-goto]').forEach((b) => (b.onclick = () => { statsPlayer = b.dataset.goto; renderView(); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
    view.querySelectorAll('[data-recap]').forEach((b) => (b.onclick = () => openRecap(b.dataset.recap)));
    view.querySelectorAll('[data-recapsall]').forEach((b) => (b.onclick = () => { recapsAll = !recapsAll; renderView(); }));
    const sc = document.getElementById('streakCard');
    if (sc) sc.onclick = () => openStreakSheet();
    view.querySelectorAll('[data-reportp]').forEach((b) => (b.onclick = () => openReportSheet({ playerId: b.dataset.reportp })));
    view.querySelectorAll('[data-blockp]').forEach((b) => action(b, async () => {
      const pid = b.dataset.blockp;
      const block = !isBlocked(pid);
      if (block && !confirm(T(`Bloquer ${player(pid).name} ? Tu ne verras plus ses messages (tu peux débloquer quand tu veux).`, `Block ${player(pid).name}? You won’t see their messages (you can unblock anytime).`))) return;
      await setBlocked(pid, block);
      toast(block ? T('Bloqué', 'Blocked') : T('Débloqué', 'Unblocked'));
    }));
  }

  // Sous-onglets de Stats (Profil, Affinités, Groupe) : pas de glissement entre eux (le glissement passe aux onglets
  // voisins), mais deux flèches sur les bords de l'écran, en plus des boutons en haut.
  const STATS_MODES = ['me', 'duo', 'group'];
  function setStatsMode(m) {
    if (!STATS_MODES.includes(m) || m === statsMode) return;
    statsMode = m;
    save('statsMode', m);
    renderView();
    window.scrollTo({ top: 0 });
  }
  function statsArrows() {
    const i = Math.max(0, STATS_MODES.indexOf(statsMode));
    const label = { me: T('Profil', 'Profile', 'Perfil'), duo: T('Affinités', 'Duos', 'Afinidades'), group: T('Groupe', 'Group', 'Grupo') };
    for (const [dir, to] of [['prev', STATS_MODES[i - 1]], ['next', STATS_MODES[i + 1]]]) {
      if (!to) continue;
      const b = document.createElement('button');
      b.className = `edge-nav ${dir}`;
      b.setAttribute('aria-label', label[to]);
      b.title = label[to];
      b.innerHTML = `${icon('down')}<span>${esc(label[to])}</span>`;
      b.onclick = () => setStatsMode(to);
      document.body.appendChild(b);
    }
  }

  function statsProfile(pid) {
    const defs = state.statDefs;
    const st = state.stats;
    const p = player(pid);
    const ps = st.players[pid] || { value: {}, wins: [], unanimous: [], polls: 0 };
    const unan = ps.unanimous || [];
    const active = Object.values(st.players).filter((x) => x.polls > 0);
    const avg = Object.fromEntries(defs.map((d) => [d.key, active.length ? active.reduce((a, x) => a + x.value[d.key], 0) / active.length : 0]));
    const myTitles = st.titles.filter((t) => t.playerId === pid);
    const anyData = active.length > 0;
    const radarDefs = defs.map((d) => ({ ...d, label: statLabel(d) }));

    const ranking = (d) => {
      const rows = state.players
        .map((u) => ({ u, v: (st.players[u.id] || { value: {} }).value[d.key] || 0 }))
        .sort((a, b) => b.v - a.v)
        .filter((r) => (st.players[r.u.id] || {}).polls > 0)
        .slice(0, 5);
      return `
        <div class="card rank-card">
          <div class="rank-head"><span class="rank-emoji">${d.emoji}</span><b>${esc(statLabel(d))}</b><span class="muted small" style="margin-left:auto">${esc(statTitle(d))}</span></div>
          ${rows.length ? rows.map((r, i) => `
            <div class="rank-row">
              <span class="rank-pos">${i === 0 ? '👑' : i + 1}</span>
              ${avatar(r.u, 'sm')}
              <span class="name">${esc(r.u.name)}</span>
              <span class="rank-bar"><span style="width:${r.v}%;background:${esc(r.u.color)}"></span></span>
              <span class="rank-val">${r.v}</span>
            </div>`).join('') : `<div class="muted small">${T('Pas encore de données', 'No data yet', 'Aún no hay datos')}</div>`}
        </div>`;
    };

    return `
      <div class="card radar-card">
        <div class="radar-title">${avatar(p)}<div><b>${esc(p.name)}</b>${ps.polls ? `<div class="muted small">${T(`A reçu des votes dans ${plural(ps.polls, 'sondage')} terminé${ps.polls > 1 ? 's' : ''}`, `Got votes in ${plural(ps.polls, 'finished poll')}`, `Ha recibido votos en ${plural(ps.polls, 'pregunta')} (de las ya terminadas)`)}</div>` : ''}</div></div>
        ${anyData ? window.radarSvg(radarDefs, ps.value, p.color, active.length > 1 ? avg : null) : `<div class="empty">${T('Les stats arrivent quand les premiers sondages se terminent.', 'Stats show up once the first polls are over.', 'Las stats salen cuando terminen las primeras preguntas.')}</div>`}
        ${anyData && active.length > 1 ? `<div class="legend"><span class="dash"></span> ${T('moyenne du groupe', 'group average', 'media del grupo')}</div>` : ''}
        ${myTitles.length || unan.length ? `<div class="title-chips">${myTitles.map((t) => `<span class="title-chip ${t.low ? 'low' : ''}">${t.emoji} ${esc(titleText(t))}</span>`).join('')}${unan.length ? `<span class="title-chip moment" title="${T('Tout le monde a voté pour', 'Everyone voted for', 'Todo el mundo ha votado a')} ${esc(p.name)}">👑 ${T('Unanimité', 'Unanimous', 'Unanimidad')} ×${unan.length}</span>` : ''}</div>` : ''}
        ${anyData && st.ended < st.titlesAt ? `<p class="muted small" style="margin:10px 0 0">${T(`Les titres se débloquent après ${st.titlesAt} sondages terminés (encore ${st.titlesAt - st.ended}).`, `Titles unlock after ${st.titlesAt} finished polls (${st.titlesAt - st.ended} to go).`, `Los títulos se desbloquean tras ${st.titlesAt} preguntas terminadas (faltan ${st.titlesAt - st.ended}).`)}</p>` : ''}
      </div>
      ${ps.wins.length ? `
        <div class="section-title">${T('Élu pour…', 'Voted most…', 'Elegido para…')} <span class="count">${ps.wins.length}</span></div>
        <div class="card qlist">${ps.wins.slice(0, 15).map((w) => `<div class="qrow"><span>${esc(qText(w))}</span><span class="muted small">${unan.some((u) => u.id === w.id) ? '👑' : esc(setOf(w.setId).emoji)}</span></div>`).join('')}</div>` : ''}
      ${unan.length ? `
        <div class="section-title">${T('Moments mémorables', 'Memorable moments', 'Momentazos')} <span class="count">${unan.length}</span></div>
        <div class="card qlist moments">${unan.slice(0, 10).map((w) => `<div class="qrow"><span>👑 ${esc(qText(w))}</span><span class="muted small">${T('tout le monde', 'everyone', 'todo el mundo')}</span></div>`).join('')}</div>` : ''}
      ${st.titles.length ? `
        <div class="section-title">${T('Les titres du groupe', 'Group titles', 'Los títulos del grupo')}</div>
        <div class="card titles-board">${st.titles.map((t) => `
          <div class="title-row">${avatar(player(t.playerId), 'sm')}<span class="name">${esc(player(t.playerId).name)}</span><span class="title-chip ${t.low ? 'low' : ''}">${t.emoji} ${esc(titleText(t))}</span></div>`).join('')}
        </div>` : ''}
      ${anyData ? `<div class="section-title">${T('Classements', 'Rankings', 'Rankings')}</div>${defs.map(ranking).join('')}` : ''}
      ${pid !== state.me.playerId && p.claimed ? `<div class="about-links"><button class="link-btn" data-reportp="${esc(pid)}">🚩 ${T('Signaler', 'Report', 'Denunciar')}</button><button class="link-btn" data-blockp="${esc(pid)}">🚫 ${isBlocked(pid) ? T('Débloquer', 'Unblock', 'Desbloquear') : T('Bloquer', 'Block', 'Bloquear')}</button></div>` : ''}`;
  }

  // Affinités : qui vote comme toi, qui vote pour toi, qui a la même réputation que toi…
  function statsDuo(pid) {
    const aff = state.affinity;
    const p = player(pid);
    const you = pid === state.me.playerId;
    const others = state.players.filter((u) => u.id !== pid && aff.pairs[pid] && aff.pairs[pid][u.id]);
    const row = aff.pairs[pid] || {};
    if (aff.polls < 3 || !others.length) {
      return `<div class="card empty">${T('Les affinités arrivent après quelques sondages terminés (au moins 3).', 'Duos show up after a few finished polls (at least 3).', 'Las afinidades salen tras unas cuantas preguntas terminadas (mínimo 3).')}${aff.polls ? `<br><span class="muted small">${T(`Encore ${3 - aff.polls}.`, `${3 - aff.polls} to go.`, `Faltan ${3 - aff.polls}.`)}</span>` : ''}</div>`;
    }
    const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
    const agreeOf = (u) => (row[u.id].common >= 3 ? pct(row[u.id].agree, row[u.id].common) : null);
    const best = (list, score, min = -Infinity) => {
      let top = null;
      for (const u of list) {
        const v = score(u);
        if (v == null || v <= min) continue;
        if (!top || v > top.v) top = { u, v };
      }
      return top;
    };
    // Ceux qui votent : pas les noms jamais réclamés (ils n'ont jamais pu voter) ni ceux qui n'ont presque pas voté.
    const voters = others.filter((u) => u.claimed && (aff.players[u.id] || {}).voted >= 3);
    const fan = best(voters, (u) => aff.pairs[u.id][pid].given, 0);
    const target = best(others, (u) => row[u.id].given, 0);
    const twin = best(voters, agreeOf);
    const opposite = best(voters, (u) => (agreeOf(u) == null ? null : 100 - agreeOf(u)));
    const rep = best(others, (u) => row[u.id].sim);
    const antiRep = best(others, (u) => (row[u.id].sim == null ? null : 100 - row[u.id].sim));
    const duo = best(others, (u) => row[u.id].co, 0);
    const oneWay = best(voters, (u) => {
      const out = row[u.id].given;
      const back = aff.pairs[u.id][pid].given;
      return out >= 2 && back === 0 ? out : null;
    });
    const me_ = aff.players[pid] || { voted: 0, toWinner: 0, self: 0 };
    const all = Object.values(aff.players).filter((x) => x.voted >= 3);
    const flock = me_.voted >= 3 ? pct(me_.toWinner, me_.voted) : null;
    const flockAvg = all.length ? Math.round(all.reduce((a, x) => a + pct(x.toWinner, x.voted), 0) / all.length) : null;
    const name = esc(p.name);

    const tile = (emoji, title, hit, line) => (hit ? `
      <button class="duo-tile" data-goto="${hit.u.id}" style="--pc:${esc(hit.u.color)}">
        <span class="duo-head"><span class="duo-emoji">${emoji}</span><span class="duo-title">${title}</span></span>
        <span class="duo-who">${avatar(hit.u, 'sm')}<b class="pname">${esc(hit.u.name)}</b></span>
        <span class="duo-line">${line(hit)}</span>
      </button>` : '');
    const votes = (n) => (L ? `${num(n)} vote${n > 1 ? 's' : ''}` : `${num(n)} vote${n > 1 ? 's' : ''}`);
    // Fan n°1 = cible préférée : c'est réciproque, une seule tuile.
    const mutual = fan && target && fan.u.id === target.u.id;
    const tiles = [
      mutual
        ? tile('💞', T('Amour réciproque', 'Mutual crush', 'Amor correspondido'), fan, (h) => T(`${votes(h.v)} pour ${you ? 'toi' : name}, ${votes(target.v)} dans l’autre sens`, `${votes(h.v)} for ${you ? 'you' : name}, ${votes(target.v)} the other way`, `${votes(h.v)} para ${you ? 'ti' : name}, ${votes(target.v)} al revés`))
        : tile('💘', T('Fan n°1', 'Biggest fan', 'Fan n.º 1'), fan, (h) => T(`${you ? 't’a donné' : `a donné à ${name}`} ${votes(h.v)}`, `gave ${you ? 'you' : name} ${votes(h.v)}`, `${votes(h.v)} para ${you ? 'ti' : name}`)),
      mutual ? '' : tile('🎯', T('Cible préférée', 'Favourite target', 'Víctima favorita'), target, (h) => T(`${you ? 'tu lui as donné' : `${name} lui a donné`} ${votes(h.v)}`, `${you ? 'you gave them' : name + ' gave them'} ${votes(h.v)}`, `${you ? 'le has dado' : name + ' le ha dado'} ${votes(h.v)}`)),
      tile('👯', T('Jumeau de vote', 'Vote twin', 'Gemelo de voto'), twin, (h) => T(`même vote ${h.v} % du temps`, `same vote ${h.v}% of the time`, `mismo voto el ${h.v} % de las veces`)),
      tile('🙃', T('Opposé de vote', 'Vote opposite', 'Polo opuesto'), opposite && (!twin || opposite.u.id !== twin.u.id) ? opposite : null, (h) => T(`même vote ${100 - h.v} % du temps seulement`, `same vote only ${100 - h.v}% of the time`, `mismo voto solo el ${100 - h.v} % de las veces`)),
      tile('🪞', T('Même réputation', 'Same reputation', 'Misma fama'), rep, (h) => T(`votés sur les mêmes questions (${h.v} %)`, `voted on the same questions (${h.v}%)`, `les votan en las mismas preguntas (${h.v} %)`)),
      tile('🌗', T('Tout l’inverse', 'Total opposite', 'Todo lo contrario'), antiRep && (!rep || antiRep.u.id !== rep.u.id) ? antiRep : null, (h) => T(`jamais votés pour les mêmes trucs (${100 - h.v} %)`, `never voted for the same stuff (${100 - h.v}%)`, `nunca les votan por lo mismo (${100 - h.v} %)`)),
      tile('🤝', T('Duo inséparable', 'Inseparable duo', 'Dúo inseparable'), duo, (h) => T(`dans les résultats ensemble ${plural(h.v, 'fois', 'fois')}`, `in the results together ${h.v} time${h.v > 1 ? 's' : ''}`, `juntos en los resultados ${h.v} ${h.v > 1 ? 'veces' : 'vez'}`)),
      tile('💔', T('Sens unique', 'One-sided', 'No correspondido'), oneWay, (h) => T(`${you ? 'tu votes' : name + ' vote'} pour ${esc(h.u.name)} (${votes(h.v)}), jamais l’inverse`, `${you ? 'you vote' : name + ' votes'} for ${esc(h.u.name)} (${votes(h.v)}), never the other way`, `${you ? 'tú votas' : name + ' vota'} a ${esc(h.u.name)} (${votes(h.v)}), nunca al revés`)),
    ].join('');

    let flockLine = '';
    if (flock != null && flockAvg != null) {
      const kind = flock >= flockAvg + 10 ? ['🐑', T('Mouton', 'Sheep', 'Borrego')] : flock <= flockAvg - 10 ? ['🦄', T('Rebelle', 'Rebel', 'Rebelde')] : ['⚖️', T('Dans la moyenne', 'Middle of the road', 'En la media')];
      flockLine = `
        <div class="card flock">
          <span class="duo-emoji">${kind[0]}</span>
          <div><b>${kind[1]}</b><div class="muted small">${T(`${you ? 'Tu votes' : name + ' vote'} comme la majorité ${flock} % du temps (groupe : ${flockAvg} %)`, `${you ? 'You vote' : name + ' votes'} with the majority ${flock}% of the time (group: ${flockAvg}%)`, `${you ? 'Votas' : name + ' vota'} como la mayoría el ${flock} % de las veces (grupo: ${flockAvg} %)`)}${me_.self ? ' · ' + T(`${votes(me_.self)} pour ${you ? 'toi-même' : 'soi'} 🪞`, `${votes(me_.self)} for ${you ? 'yourself' : 'themselves'} 🪞`, `${votes(me_.self)} ${you ? 'para ti' : 'para sí'} 🪞`) : ''}</div></div>
        </div>`;
    }

    // Toi et chacun : à quel point vous votez pareil, et les votes dans les deux sens.
    const rows = others
      .map((u) => ({ u, agree: agreeOf(u), sim: row[u.id].sim, out: row[u.id].given, back: voters.includes(u) || (u.claimed && aff.pairs[u.id][pid].given) ? aff.pairs[u.id][pid].given : null }))
      .sort((a, b) => (b.agree ?? -1) - (a.agree ?? -1));
    const table = `
      <div class="section-title">${you ? T('Toi et chacun', 'You and everyone', 'Tú con cada uno') : T(`${name} et chacun`, `${name} and everyone`, `${name} con cada uno`)}</div>
      <div class="card duo-table">
        <div class="dt-head"><span></span><span>${T('Votent pareil', 'Vote alike', 'Votan igual')}</span><span>${T('Votés pareil', 'Voted alike', 'Les votan igual')}</span><span title="${T('votes donnés → / ← reçus', 'votes given → / ← received', 'votos dados → / ← recibidos')}">→ ←</span></div>
        ${rows.map((r) => `
          <button class="dt-row" data-goto="${r.u.id}" style="--pc:${esc(r.u.color)}">
            <span class="dt-who">${avatar(r.u, 'xs')}<span>${esc(r.u.name)}</span></span>
            <span class="dt-bar">${r.agree == null ? '<i class="muted">–</i>' : `<span class="dt-track"><span style="width:${r.agree}%"></span></span><b>${r.agree}%</b>`}</span>
            <span class="dt-bar">${r.sim == null ? '<i class="muted">–</i>' : `<span class="dt-track sim"><span style="width:${r.sim}%"></span></span><b>${r.sim}%</b>`}</span>
            <span class="dt-io">${num(r.out)}·${r.back == null ? '–' : num(r.back)}</span>
          </button>`).join('')}
        <p class="muted small dt-help">${T('« Votent pareil » : vous avez voté pour la même personne. « Votés pareil » : on vote pour vous deux sur les mêmes questions.', '“Vote alike”: you voted for the same person. “Voted alike”: people vote for you both on the same questions.', '«Votan igual»: habéis votado a la misma persona. «Les votan igual»: os votan a los dos en las mismas preguntas.')}</p>
      </div>`;

    return `
      <div class="duo-intro muted small">${T(`D’après ${plural(aff.polls, 'sondage terminé', 'sondages terminés')}.`, `Based on ${plural(aff.polls, 'finished poll')}.`, `Según ${plural(aff.polls, 'pregunta')} ya terminadas.`)}</div>
      <div class="duo-grid">${tiles}</div>
      ${flockLine}
      ${table}`;
  }

  function streakSection() {
    const st = state.streaks;
    if (!st) return '';
    const rows = state.players.filter((u) => u.claimed && st.players[u.id]).map((u) => ({ u, ...st.players[u.id] }))
      .sort((a, b) => b.current - a.current || b.best - a.best).slice(0, 6);
    return `
      <button class="card streak-card" id="streakCard">
        <span class="sk-top"><span>🔥 <b>${st.group.current}</b> ${T(`jour${st.group.current > 1 ? 's' : ''} d’affilée où tout le monde a voté`, `day${st.group.current === 1 ? '' : 's'} in a row where everyone voted`, `${st.group.current === 1 ? 'día seguido' : 'días seguidos'} con votos de todo el mundo`)}</span><small class="muted">${T('record', 'best', 'récord')} ${st.group.best}</small></span>
        <span class="streak-mini">${rows.map((r) => `<span class="${r.today === false ? 'off' : ''}">${avatar(r.u, 'xs')}${r.current}</span>`).join('')}</span>
      </button>`;
  }

  // Stats du groupe : notes des questions, moments mémorables, chiffres en vrac.
  function statsGroup() {
    const gs = state.groupStats;
    const c = gs.counts;
    const r = gs.ratings;
    const stars = (avg) => `<span class="mini-stars" style="--v:${(avg / 5) * 100}%">★★★★★</span>`;
    const avgTxt = (a) => (L ? String(a) : String(a).replace('.', ','));
    const qList = (list) => list.map((q) => `
      <div class="qrow"><span>${esc(qText(q))}</span><span class="q-rate">${stars(q.avg)}<small>${avgTxt(q.avg)} · ${q.n}</small></span></div>`).join('');
    const tiles = [
      [c.ended, T('sondages terminés', 'polls done', 'preguntas terminadas')],
      [c.votes, T('votes', 'votes', 'votos')],
      [c.halves, T('demi-votes', 'half votes', 'medios votos')],
      [c.unanimous, T('unanimités', 'unanimous', 'unanimidades')],
      [c.split, T('zéro consensus', 'zero consensus', 'cero consenso')],
    ];
    const raters = [...r.raters].sort((a, b) => b.avg - a.avg);
    const generous = raters[0];
    const harsh = raters.length > 1 ? raters[raters.length - 1] : null;
    return `
      ${(state.recaps || []).length ? `<div class="section-title">🎁 ${T('Les récaps du mois', 'Monthly recaps', 'Resúmenes del mes')}</div>` : ''}
      ${recapCards()}
      <div class="num-tiles">${tiles.map(([n, l]) => `<div class="num-tile"><b>${n}</b><span>${l}</span></div>`).join('')}</div>
      ${streakSection()}

      <div class="section-title">${T('Les questions préférées', 'Favourite questions', 'Las preguntas favoritas')} ${r.questions ? `<span class="count">${r.count} ${T('notes', 'ratings', 'notas')}</span>` : ''}</div>
      ${r.top.length ? `<div class="card qlist">${qList(r.top)}</div>` : `<div class="card empty" style="padding:18px">${T('Notez les questions (les étoiles sous les résultats) : les préférées du groupe apparaîtront ici.', 'Rate the questions (the stars under the results): the group’s favourites will show up here.', 'Puntuad las preguntas (las estrellitas debajo de los resultados): aquí saldrán las favoritas del grupo.')}</div>`}
      ${r.flop.length ? `<div class="section-title">${T('Les flops', 'The flops', 'Las peores')}</div><div class="card qlist">${qList(r.flop)}</div>` : ''}
      ${r.sets.length ? `
        <div class="section-title">${T('Sets les mieux notés', 'Best rated sets', 'Sets mejor valorados')}</div>
        <div class="card qlist">${r.sets.map((x) => `<div class="qrow"><span>${esc(setOf(x.setId).emoji)} ${esc(setName(setOf(x.setId)))}</span><span class="q-rate">${stars(x.avg)}<small>${avgTxt(x.avg)} · ${x.n}</small></span></div>`).join('')}</div>` : ''}
      ${generous && harsh ? `
        <div class="duo-grid">
          <div class="duo-tile static" style="--pc:${esc(player(generous.playerId).color)}"><span class="duo-head"><span class="duo-emoji">😇</span><span class="duo-title">${T('Le plus généreux', 'Most generous', 'El más generoso')}</span></span><span class="duo-who">${avatar(player(generous.playerId), 'sm')}<b class="pname">${esc(player(generous.playerId).name)}</b></span><span class="duo-line">${T('note en moyenne', 'rates', 'pone de media')} ${avgTxt(generous.avg)}/5</span></div>
          <div class="duo-tile static" style="--pc:${esc(player(harsh.playerId).color)}"><span class="duo-head"><span class="duo-emoji">🧐</span><span class="duo-title">${T('Le plus dur', 'Toughest critic', 'El más duro')}</span></span><span class="duo-who">${avatar(player(harsh.playerId), 'sm')}<b class="pname">${esc(player(harsh.playerId).name)}</b></span><span class="duo-line">${T('note en moyenne', 'rates', 'pone de media')} ${avgTxt(harsh.avg)}/5</span></div>
        </div>` : ''}
      ${gs.unanimous.length || gs.split.length ? `<div class="section-title">${T('Moments mémorables', 'Memorable moments', 'Momentazos')}</div>` : ''}
      ${gs.unanimous.length ? `<div class="card qlist moments">${gs.unanimous.map((u) => `
        <div class="qrow"><span>${esc(qText(u))}</span><span class="moment-who">👑 ${avatar(player(u.target), 'xs')}<small>${u.n}/${u.n}</small></span></div>`).join('')}</div>` : ''}
      ${gs.split.length ? `<div class="card qlist moments">${gs.split.map((u) => `
        <div class="qrow"><span>${esc(qText(u))}</span><span class="moment-who">🌪️<small>${T(`${u.n} avis`, `${u.n} answers`, `${u.n} respuestas`)}</small></span></div>`).join('')}</div>` : ''}`;
  }

  // ---------- Séries (🔥) ----------
  // Un jour compte si on vote au moins une fois ; pour le groupe, si tout le monde a voté. Les jours sans question
  // ne cassent rien, et aujourd'hui n'est jamais raté avant minuit.
  function myStreak() {
    const s = state.streaks && state.streaks.players[state.me.playerId];
    return s || { current: 0, best: 0, today: null };
  }

  function streakChip() {
    const s = myStreak();
    const pending = s.today === false; // pas encore voté aujourd'hui
    return `<span class="sc-fire ${pending ? 'off' : ''}">🔥</span><b>${s.current}</b>`;
  }

  function openStreakSheet() {
    const st = state.streaks;
    const s = myStreak();
    const g = st.group;
    const rows = state.players
      .filter((u) => u.claimed && st.players[u.id])
      .map((u) => ({ u, ...st.players[u.id] }))
      .sort((a, b) => b.current - a.current || b.best - a.best);
    openSheet(`
      <div class="sheet-head"><h2>${T('Séries', 'Streaks', 'Rachas')} 🔥</h2><button class="x" data-close>✕</button></div>
      <div class="streak-duo">
        <div class="streak-big ${s.today === false ? 'pending' : ''}">
          <span class="sb-n">🔥 ${s.current}</span>
          <span class="sb-l">${T('ta série', 'your streak', 'tu racha')}</span>
          <span class="sb-s">${s.today === false ? T('vote aujourd’hui pour la garder', 'vote today to keep it', 'vota hoy para no perderla') : s.today ? T('✓ fait aujourd’hui', '✓ done today', '✓ hecho hoy') : ''}${s.best ? ` · ${T('record', 'best', 'récord')} ${s.best}` : ''}</span>
        </div>
        <div class="streak-big group ${g.today === false ? 'pending' : ''}">
          <span class="sb-n">🔥 ${g.current}</span>
          <span class="sb-l">${T('série du groupe', 'group streak', 'racha del grupo')}</span>
          <span class="sb-s">${g.today === false && g.missing.length ? T('il manque : ', 'waiting for: ', 'faltan: ') + g.missing.map((id) => esc(player(id).name)).join(', ') : g.today ? T('✓ tout le monde a voté', '✓ everyone voted', '✓ todo el mundo ha votado') : ''}${g.best ? ` · ${T('record', 'best', 'récord')} ${g.best}` : ''}</span>
        </div>
      </div>
      <p class="muted small">${T('Un jour compte si tu votes au moins une fois. Pour le groupe, il faut que tout le monde vote. Les jours sans question ne cassent rien.', 'A day counts if you vote at least once. For the group, everyone has to vote. Days without questions don’t break anything.', 'Un día cuenta si votas al menos una vez. Para el grupo, tiene que votar todo el mundo. Los días sin preguntas no rompen la racha.')}</p>
      <div class="card qlist streak-list">${rows.map((r) => `
        <div class="qrow">${avatar(r.u, 'sm')}<span class="name">${esc(r.u.name)}</span><span class="st-cur ${r.today === false ? 'off' : ''}">🔥 ${r.current}</span><span class="muted small st-best">${T('record', 'best', 'récord')} ${r.best}</span></div>`).join('')}
      </div>`, () => {});
  }

  // ---------- Quiz : l'admin demande à tout le monde de répondre ----------
  // Une fenêtre (une seule fois par demande) chez ceux qui n'ont pas encore répondu, ou en ouvrant la notif.
  function quizPrompt() {
    if (!state || !state.settings.profiles || state.me.quizDone) { pendingQuiz = false; return; }
    const askedAt = state.quiz && state.quiz.askedAt;
    const key = 'quizAskSeen_' + groupId;
    const fromNotif = pendingQuiz;
    pendingQuiz = false;
    if (fromNotif) return go('quiz');
    if (!askedAt || state.quiz.askedBy === state.me.playerId || Number(load(key) || 0) >= askedAt || !$sheet.hidden || chatOpen || storyOpen()) return;
    save(key, String(askedAt));
    openSheet(`
      <div class="quiz-ask">
        <div class="qa-emoji">🧩</div>
        <h2>${T('Petit questionnaire', 'Quick questionnaire', 'Un cuestionario rapidito')}</h2>
        <p class="muted">${T('L’admin aimerait que tout le monde réponde à quelques questions. Ça prend une minute, c’est anonyme, et les questions colleront mieux au groupe.', 'The admin would like everyone to answer a few questions. It takes a minute, it’s anonymous, and the questions will fit the group better.', 'Al admin le gustaría que todo el mundo respondiera unas preguntas. Es un minuto, es anónimo y las preguntas encajarán mejor con el grupo.')}</p>
        <button class="btn btn-main btn-block" id="qaGo">${T('C’est parti', 'Let’s go', 'Vamos')}</button>
        <button class="link-btn" data-close>${T('Plus tard', 'Later', 'Luego')}</button>
      </div>`, (root) => {
      root.querySelector('#qaGo').onclick = () => { closeSheet(); go('quiz'); };
    });
  }

  // Carte admin : réponses reçues + bouton pour relancer tout le monde.
  function quizAdminCard() {
    const q = state.quiz || { answered: 0, members: 0, askedAt: null };
    const all = q.members && q.answered >= q.members;
    return `
      <div class="quiz-admin">
        <div class="qa-row"><span>${T('Réponses', 'Answers', 'Respuestas')}</span><b>${q.answered}/${q.members}</b></div>
        <div class="qa-bar"><span style="width:${q.members ? Math.round((q.answered / q.members) * 100) : 0}%"></span></div>
        ${q.askedAt ? `<p class="muted small" style="margin:6px 0 0">${T('Dernière demande', 'Last asked', 'Última petición')} : ${ago(q.askedAt)}</p>` : ''}
        <button class="btn btn-soft btn-block" data-quizremind ${all ? 'disabled' : ''} style="margin-top:10px">📣 ${all ? T('Tout le monde a répondu 🎉', 'Everyone answered 🎉', 'Ya ha respondido todo el mundo 🎉') : T('Demander à tout le monde de répondre', 'Ask everyone to answer', 'Pedir a todo el mundo que responda')}</button>
      </div>`;
  }
  function bindQuizAdmin(root) {
    root.querySelectorAll('[data-quizremind]').forEach((b) => action(b, async () => {
      const r = await api('POST', 'admin/quiz/remind');
      state.quiz = r.quiz;
      toast(r.sent
        ? T(`Demande envoyée à ${plural(r.sent, 'personne')}`, `Sent to ${plural(r.sent, 'person', 'people')}`, `Enviado a ${plural(r.sent, 'persona')}`)
        : T('Demande envoyée', 'Request sent', 'Petición enviada'));
      renderView();
    }));
  }

  // ---------- Quiz : questionnaire de profil (si l'admin l'a activé) ----------
  let quizData = null; // { items, mine, summary, effects }
  // Thèmes des questions (étiquettes de questions.md), tels qu'affichés dans le résumé du questionnaire :
  // on parle des QUESTIONS, pas des gens (« questions spécial mecs », pas « les mecs »).
  const TAG_LABELS = {
    alcool: ['alcool', 'drinking', 'alcohol'],
    soiree: ['soirées', 'nights out', 'fiesta'],
    couple: ['couple', 'relationships', 'pareja'],
    celib: ['vie de célib', 'single life', 'vida de soltero'],
    etudes: ['études', 'studying', 'estudios'],
    travail: ['boulot', 'work', 'curro'],
    gaming: ['jeux vidéo', 'gaming', 'videojuegos'],
    sport: ['sport', 'sport', 'deporte'],
    voiture: ['conduite', 'driving', 'conducir'],
    coloc: ['coloc', 'flatshares', 'piso compartido'],
    parents: ['vivre chez ses parents', 'living with your parents', 'vivir con tus padres'],
    enfants: ['enfants', 'kids', 'hijos'],
    homme: ['questions spécial mecs', 'questions just for guys', 'preguntas solo para chicos'],
    femme: ['questions spécial filles', 'questions just for girls', 'preguntas solo para chicas'],
    jeune: ['questions 18-25 ans', 'questions for 18-25s', 'preguntas para 18-25 años'],
    adulte: ['questions 26 ans et +', 'questions for over-25s', 'preguntas para mayores de 25'],
    mixte: ['questions de groupe mixte', 'questions for mixed groups', 'preguntas para grupos mixtos'],
  };

  async function renderQuiz(view) {
    if (!state.settings.profiles) { tab = 'live'; return renderView(); }
    if (!quizData || quizData.group !== groupId) {
      view.innerHTML = `<div class="card empty">${T('Chargement…', 'Loading…', 'Cargando…')}</div>`;
      try {
        quizData = { ...(await api('GET', 'quiz')), group: groupId };
      } catch (e) {
        view.innerHTML = `<div class="card empty">${esc(e.message)}</div>`;
        return;
      }
      if (tab !== 'quiz') return;
    }
    const q = quizData;
    const lab = (x) => (L ? x.en : ES ? x.es || x.en : x.fr);
    const sum = q.summary;
    const more = Object.entries(q.effects || {}).filter(([, v]) => v >= 0.8).map(([t]) => TAG_LABELS[t] && TAG_LABELS[t][L ? 1 : ES ? 2 : 0]).filter(Boolean);
    const less = Object.entries(q.effects || {}).filter(([, v]) => v <= 0.4).map(([t]) => TAG_LABELS[t] && TAG_LABELS[t][L ? 1 : ES ? 2 : 0]).filter(Boolean);
    view.innerHTML = `
      <div class="card quiz-intro">
        <div class="card-title">${T('Qui êtes-vous ?', 'Who are you lot?', '¿Quiénes sois?')}</div>
        <p class="muted small">${T('Quelques questions sur toi, pour que les questions du jeu collent mieux au groupe (et qu’on évite celles qui ne vous parlent pas). <b>Personne ne voit tes réponses</b> : seulement le résumé du groupe, à partir de 3 réponses. Tout est facultatif, et tu peux changer quand tu veux.', 'A few questions about you, so the game’s questions fit the group better (and the ones that don’t speak to you show up less). <b>Nobody sees your answers</b>: only the group summary, from 3 answers on. Everything is optional, and you can change it anytime.', 'Unas cuantas preguntas sobre ti para que las del juego peguen más con el grupo (y salgan menos las que no van con vosotros). <b>Nadie ve tus respuestas</b>: solo el resumen del grupo, a partir de 3 respuestas. Todo es opcional y puedes cambiarlo cuando quieras.')}</p>
      </div>
      ${q.items.map((item) => `
        <div class="card quiz-item">
          <div class="qi-label">${esc(lab(item))}</div>
          <div class="qi-opts">${item.options.map((o) => `<button class="chip ${q.mine[item.key] === o.key ? 'on' : ''}" data-qk="${item.key}" data-qv="${o.key}">${esc(lab(o))}</button>`).join('')}</div>
          ${sum.items[item.key] ? quizBar(item, sum.items[item.key], lab) : ''}
        </div>`).join('')}
      <div class="card">
        <div class="card-title">${T('Le groupe', 'The group', 'El grupo')} <span class="muted small">· ${T(`${sum.answered}/${sum.members} ont répondu`, `${sum.answered}/${sum.members} answered`, `${sum.answered}/${sum.members} han respondido`)}</span></div>
        ${sum.answered < 3 ? `<p class="muted small" style="margin:0">${T('Le résumé du groupe apparaît à partir de 3 réponses (pour que personne ne soit reconnu).', 'The group summary shows up from 3 answers (so nobody can be recognised).', 'El resumen del grupo sale a partir de 3 respuestas (para que no se sepa quién es quién).')}</p>` : ''}
        ${more.length ? `<p class="small" style="margin:6px 0 0">⬆️ ${T('Questions qui tomberont plus souvent : ', 'Questions coming up more often: ', 'Preguntas que saldrán más: ')}${more.map(esc).join(', ')}</p>` : ''}
        ${less.length ? `<p class="small" style="margin:6px 0 0">⬇️ ${T('Questions qui tomberont moins souvent : ', 'Questions coming up less often: ', 'Preguntas que saldrán menos: ')}${less.map(esc).join(', ')}</p>` : ''}
        ${!more.length && !less.length ? `<p class="muted small" style="margin:6px 0 0">${T('Pas encore assez de réponses pour changer les questions.', 'Not enough answers yet to change the questions.', 'Aún no hay suficientes respuestas para cambiar las preguntas.')}</p>` : ''}
        ${state.me.isAdmin ? quizAdminCard() : ''}
      </div>`;
    bindQuizAdmin(view);
    view.querySelectorAll('[data-qk]').forEach((b) => (b.onclick = async () => {
      const k = b.dataset.qk;
      const v = b.dataset.qv;
      const mine = { ...q.mine };
      if (mine[k] === v) delete mine[k]; // un 2e tap = « je préfère ne pas dire »
      else mine[k] = v;
      q.mine = mine;
      view.querySelectorAll(`[data-qk="${k}"]`).forEach((x) => x.classList.toggle('on', mine[k] === x.dataset.qv));
      try {
        const r = await api('PUT', 'quiz', { answers: mine });
        Object.assign(q, r);
        state.me.quizDone = Object.keys(r.mine).length > 0;
        renderNav();
        clearTimeout(renderQuiz.t);
        renderQuiz.t = setTimeout(() => { if (tab === 'quiz') { const y = window.scrollY; renderView(); window.scrollTo({ top: y }); } }, 900);
      } catch (e) { toast(e.message); }
    }));
  }

  function quizBar(item, counts, lab) {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (!total) return '';
    const colors = ['#7b2ff7', '#ff2e88', '#ff7a00', '#00a8e8', '#12b76a'];
    return `<div class="qi-bar">${item.options.map((o, i) => (counts[o.key] ? `<span style="flex:${counts[o.key]};background:${colors[i % colors.length]}" title="${esc(lab(o))}"></span>` : '')).join('')}</div>
      <div class="qi-legend">${item.options.filter((o) => counts[o.key]).map((o) => `<span><i style="background:${colors[item.options.indexOf(o) % colors.length]}"></i>${esc(lab(o))} ${Math.round((counts[o.key] / total) * 100)}%</span>`).join('')}</div>`;
  }

  // ---------- Récap du mois (façon « Wrapped ») ----------
  const monthName = (m) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString(LOC, { month: 'long', timeZone: 'UTC' });
  const monthTitle = (m, partial) => (partial ? T(`${monthName(m)} (en cours)`, `${monthName(m)} (so far)`, `${monthName(m)} (en curso)`) : monthName(m));

  // Récaps déjà ouverts sur cet appareil (par groupe) : les autres ont une pastille « nouveau ».
  function seenRecaps() {
    try { return new Set(JSON.parse(load('recapsSeen_' + groupId) || '[]')); } catch { return new Set(); }
  }
  function markRecapSeen(month) {
    const seen = seenRecaps();
    seen.add(month);
    save('recapsSeen_' + groupId, JSON.stringify([...seen].slice(-36)));
    save('recapSeen_' + groupId, month);
  }
  let recapsAll = false; // « voir les récaps plus anciens » déplié

  // Tous les récaps du groupe (chaque mois avec des questions terminées), le plus récent en premier.
  function recapCards() {
    const all = state.recaps || [];
    if (!all.length) return '';
    const seen = seenRecaps();
    const list = recapsAll ? all : all.slice(0, 4);
    return `<div class="recap-list">${list.map((r, i) => `
      <button class="recap-card ${i === 0 ? 'first' : ''} ${!r.partial && !seen.has(r.month) ? 'unseen' : ''}" data-recap="${r.month}">
        <span class="rc-emoji">${r.partial ? '📅' : '🎁'}</span>
        <span class="rc-text"><b>${T('Récap de ', 'Recap: ', 'Resumen de ')}${esc(monthTitle(r.month, r.partial))}</b><small>${r.partial ? T('Le mois jusqu’ici', 'The month so far', 'El mes hasta ahora') : T('Ton mois et celui du groupe', 'Your month and the group’s', 'Tu mes y el del grupo')}</small></span>
        ${!r.partial && !seen.has(r.month) ? `<span class="rc-new">${T('nouveau', 'new', 'nuevo')}</span>` : ''}
        ${icon('down', 'rc-go')}
      </button>`).join('')}
      ${all.length > 4 ? `<button class="link-btn recap-more" data-recapsall>${recapsAll ? T('Moins', 'Show less', 'Ver menos') : T(`Voir les récaps plus anciens (${all.length - 4})`, `See older recaps (${all.length - 4})`, `Ver resúmenes anteriores (${all.length - 4})`)}</button>` : ''}</div>`;
  }

  // Bandeau dans Live la première semaine du mois : le récap du mois dernier est prêt.
  function recapBanner() {
    const last = (state.recaps || []).find((r) => !r.partial);
    if (!last || seenRecaps().has(last.month) || load('recapSeen_' + groupId) === last.month) return '';
    const d = new Date(now());
    const prev = new Date(d.getFullYear(), d.getMonth() - 1, 15);
    const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    if (last.month !== prevKey || d.getDate() > 10) return '';
    return `<button class="recap-banner" data-recap="${last.month}">🎁 <span>${T(`Ton récap de <b>${esc(monthName(last.month))}</b> est prêt`, `Your <b>${esc(monthName(last.month))}</b> recap is ready`, `Tu resumen de <b>${esc(monthName(last.month))}</b> ya está listo`)}</span>${icon('down', 'rc-go')}</button>`;
  }

  function openRecapFromLink() {
    if (!state || !pendingRecap) return;
    const m = pendingRecap;
    pendingRecap = null;
    openRecap(m);
  }

  const storyOpen = () => !!document.getElementById('story');
  let storyStop = null; // arrête la lecture en cours (minuteur, écouteurs)
  function closeStory() {
    if (storyStop) storyStop();
    const s = document.getElementById('story');
    if (s) {
      s.classList.add('closing');
      setTimeout(() => s.remove(), calm() ? 0 : 220);
    }
    document.body.classList.remove('noscroll');
    if (state && tab === 'stats') renderView(); // la pastille « nouveau » du récap vu disparaît
  }

  // Récap façon Spotify Wrapped : plein écran, les slides défilent toutes seules (barres qui se remplissent),
  // tap à droite / à gauche pour avancer / reculer, appui long = pause, glisser vers le bas = fermer.
  // Chaque slide arrive en plusieurs temps (éléments décalés, chiffres qui défilent, confettis sur les moments forts),
  // et la star du mois se devine avant d'être révélée.
  async function openRecap(month) {
    let r;
    try {
      r = await api('GET', 'recap?month=' + encodeURIComponent(month));
    } catch (e) {
      return toast(e.message);
    }
    markRecapSeen(month);
    const slides = recapSlides(r);
    if (!slides.length) return toast(T('Pas assez de questions ce mois-là pour un récap.', 'Not enough questions that month for a recap.', 'Ese mes no hubo suficientes preguntas para hacer un resumen.'));
    if (storyOpen()) { storyStop && storyStop(); document.getElementById('story').remove(); }
    const el = document.createElement('div');
    el.id = 'story';
    el.className = 'story';
    el.innerHTML = `
      <div class="story-blobs" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="story-bars">${slides.map(() => '<span><i></i></span>').join('')}</div>
      <div class="story-top"><span>${esc(state.group.name)} · ${esc(monthTitle(r.month, r.partial))}</span><button class="x" id="storyX" aria-label="${T('Fermer', 'Close', 'Cerrar')}">✕</button></div>
      <div class="story-stage"></div>
      <div class="story-hint"></div>`;
    document.body.appendChild(el);
    document.body.classList.add('noscroll');
    const stage = el.querySelector('.story-stage');
    const bars = [...el.querySelectorAll('.story-bars i')];
    const hint = el.querySelector('.story-hint');
    let i = 0;
    let t0 = 0; // début de la slide (temps écoulé déjà compté)
    let elapsed = 0;
    let paused = false;
    let waiting = false; // slide « devine » : on attend la réponse
    let raf = null;
    let alive = true;
    const dur = () => slides[i].dur || 6500;

    const finish = () => (history.state && history.state.guard ? history.back() : closeStory());
    const go = (to) => {
      if (to < 0) to = 0;
      if (to >= slides.length) return finish();
      i = to;
      show();
    };

    // Compte jusqu'au chiffre final (« 0 → 42 »).
    const countUp = (root) => {
      root.querySelectorAll('[data-count]').forEach((n) => {
        const end = Number(n.dataset.count);
        const suffix = n.dataset.suffix || '';
        if (calm() || !Number.isFinite(end)) return;
        const start = performance.now();
        const D = 1100;
        const step = (t) => {
          if (!alive) return;
          const k = Math.min(1, (t - start) / D);
          const e = 1 - Math.pow(1 - k, 3);
          n.textContent = Math.round(end * e) + suffix;
          if (k < 1) requestAnimationFrame(step);
        };
        n.textContent = '0' + suffix;
        requestAnimationFrame(step);
      });
    };

    const show = () => {
      const s = slides[i];
      el.style.setProperty('--sg', s.bg);
      el.classList.toggle('dark-text', !!s.darkText);
      bars.forEach((b, j) => (b.style.transform = `scaleX(${j < i ? 1 : 0})`));
      elapsed = 0;
      t0 = performance.now();
      waiting = !!s.guess;
      stage.innerHTML = `<div class="story-slide">${s.guess ? guessHtml(s.guess) : s.html}</div>`;
      const slide = stage.firstElementChild;
      [...slide.children].forEach((c, k) => { c.classList.add('st-anim'); c.style.setProperty('--i', k); });
      if (s.guess) bindGuess(slide, s);
      else afterReveal(slide, s);
      hint.textContent = s.guess
        ? T('Devine ! Touche une photo', 'Guess! Tap a photo', '¡Adivina! Toca una foto')
        : i < slides.length - 1 ? T('Touche pour continuer · reste appuyé pour pause', 'Tap to continue · hold to pause', 'Toca para seguir · mantén para pausar') : '';
      if (navigator.vibrate && i) navigator.vibrate(8);
    };

    const afterReveal = (slide, s) => {
      countUp(slide);
      if (s.confetti && !calm()) setTimeout(() => alive && confetti(), 350);
      slide.querySelectorAll('[data-share]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); shareRecap(r); }));
      slide.querySelectorAll('[data-replay]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); go(0); }));
    };

    // « Qui a été la star du mois ? » : on choisit une photo, puis la vraie réponse s'affiche.
    const guessHtml = (g) => `
      <div class="st-emoji">🤔</div>
      <h2>${esc(g.question)}</h2>
      <div class="guess-grid">${g.options.map((id) => `<button class="guess-opt" data-guess="${esc(id)}">${avatar(player(id), 'lg')}<span>${esc(id === state.me.playerId ? T('Toi', 'You', 'Tú') : player(id).name)}</span></button>`).join('')}</div>`;
    const bindGuess = (slide, s) => {
      slide.querySelectorAll('[data-guess]').forEach((b) => (b.onclick = (e) => {
        e.stopPropagation();
        if (!waiting) return;
        waiting = false;
        const right = b.dataset.guess === s.guess.answer;
        slide.querySelectorAll('[data-guess]').forEach((x) => x.classList.add(x.dataset.guess === s.guess.answer ? 'right' : x === b ? 'wrong' : 'dim'));
        if (navigator.vibrate) navigator.vibrate(right ? [10, 40, 10] : 30);
        setTimeout(() => {
          if (!alive || slides[i] !== s) return;
          stage.innerHTML = `<div class="story-slide reveal"><p class="st-verdict ${right ? 'ok' : ''}">${right ? T('Bien vu ! 🎯', 'Spot on! 🎯', '¡Bien visto! 🎯') : T('Raté 😅', 'Nope 😅', 'Casi 😅')}</p>${s.html}</div>`;
          const slide2 = stage.firstElementChild;
          [...slide2.children].forEach((c, k) => { c.classList.add('st-anim'); c.style.setProperty('--i', k); });
          afterReveal(slide2, { ...s, confetti: true });
          t0 = performance.now();
          elapsed = 0;
          hint.textContent = T('Touche pour continuer', 'Tap to continue', 'Toca para seguir');
        }, calm() ? 0 : 700);
      }));
    };

    // Avance automatique : la barre de la slide en cours se remplit.
    const tick = (t) => {
      if (!alive) return;
      if (!paused && !waiting && !document.hidden) {
        const k = Math.min(1, (elapsed + (t - t0)) / dur());
        if (bars[i]) bars[i].style.transform = `scaleX(${k})`;
        if (k >= 1) {
          if (i < slides.length - 1) go(i + 1);
          else { elapsed = dur(); t0 = t; } // dernière slide : on reste dessus
        }
      } else t0 = t - 0; // le temps en pause ne compte pas
      raf = requestAnimationFrame(tick);
    };
    const pause = (on) => {
      if (on === paused) return;
      if (on) elapsed += performance.now() - t0;
      else t0 = performance.now();
      paused = on;
      el.classList.toggle('paused', on);
    };

    // Gestes : tap gauche/droite, appui long = pause, glisser vers le bas = fermer.
    let down = null;
    let holdTimer = null;
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      down = { x: e.clientX, y: e.clientY, held: false };
      holdTimer = setTimeout(() => { if (down) { down.held = true; pause(true); } }, 220);
    });
    el.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dy = e.clientY - down.y;
      if (dy > 0) el.style.transform = `translateY(${Math.min(dy, 200) * 0.6}px) scale(${1 - Math.min(dy, 200) / 2000})`;
    });
    const up = (e) => {
      clearTimeout(holdTimer);
      if (!down) return;
      const d = down;
      down = null;
      el.style.transform = '';
      const dy = e.clientY - d.y;
      if (d.held) return pause(false);
      if (dy > 90) return finish();
      if (Math.abs(e.clientX - d.x) > 30 || Math.abs(dy) > 30) return;
      if (waiting) return;
      if (e.clientX < window.innerWidth * 0.3) go(i - 1);
      else go(i + 1);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', () => { clearTimeout(holdTimer); if (down && down.held) pause(false); down = null; el.style.transform = ''; });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.querySelector('#storyX').onclick = (e) => { e.stopPropagation(); finish(); };
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); if (!waiting) go(i + 1); }
      else if (e.key === 'ArrowLeft') go(i - 1);
    };
    document.addEventListener('keydown', onKey);
    storyStop = () => {
      alive = false;
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      storyStop = null;
    };

    show();
    raf = requestAnimationFrame((t) => { t0 = t; tick(t); });
    syncGuard();
  }

  // Partager son récap : un petit texte (le téléphone propose WhatsApp, Insta, etc.).
  async function shareRecap(r) {
    const G = r.group;
    const M = r.me;
    const star = G.mvp.length ? player(G.mvp[0][0]).name : null;
    const lines = [
      `🎁 ${T('Récap', 'Recap', 'Resumen')} ${monthName(r.month)} · ${state.group.name}`,
      `🗳️ ${G.polls} ${T('questions', 'questions', 'preguntas')} · ${G.participation}% ${T('de participation', 'turnout', 'de participación')}`,
      star ? `👑 ${T('Star du mois', 'Star of the month', 'Estrella del mes')} : ${star}` : '',
      G.unanimousCount ? `🤝 ${G.unanimousCount} ${T('unanimités', 'unanimous votes', 'unanimidades')}` : '',
      M.voted ? `🫵 ${T('Moi', 'Me', 'Yo')} : ${M.wins} ${T('fois en tête', 'times on top', 'veces en cabeza')} · 🔥 ${M.streak}` : '',
      `${PUBLIC_URL}${langLink(LANG)}`,
    ].filter(Boolean).join('\n');
    try {
      if (NATIVE && Plugins.Share) await Plugins.Share.share({ text: lines });
      else if (navigator.share) await navigator.share({ text: lines });
      else {
        await navigator.clipboard.writeText(lines);
        toast(T('Copié, colle-le dans le groupe', 'Copied, paste it in the group', 'Copiado, pégalo en el grupo'));
      }
    } catch { /* annulé */ }
  }

  function recapSlides(r) {
    const G = r.group;
    const M = r.me;
    const p = (id) => player(id);
    const big = (u) => `<div class="st-av">${avatar(u, 'xl')}</div>`;
    const name = (u) => esc(u.id === state.me.playerId ? T('Toi', 'You', 'Tú') : u.name);
    const q = (x) => `<p class="st-q">« ${esc(qText(x))} »</p>`;
    const statDef = M.topStat && state.statDefs.find((d) => d.key === M.topStat);
    const out = [];
    const add = (bg, html, extra = {}) => out.push({ bg, html, ...extra });
    if (!G.polls) return out;
    add('linear-gradient(160deg,#7b2ff7,#f107a3)', `
      <div class="st-emoji">🎁</div>
      <h2>${T('Ton mois dans', 'Your month in', 'Tu mes en')}<br><b>${esc(state.group.name)}</b></h2>
      <p class="st-big" data-count="${G.polls}">${G.polls}</p><p>${T('questions', 'questions', 'preguntas')} · ${G.votes} ${T('votes', 'votes', 'votos')}</p>
      ${r.partial ? `<p class="st-small">${T('Le mois n’est pas fini : tout peut encore changer.', 'The month isn’t over: anything can still change.', 'El mes aún no ha acabado: todo puede cambiar.')}</p>` : ''}`);
    add('linear-gradient(160deg,#ff7a00,#f107a3)', `
      <div class="st-emoji">🗳️</div>
      <h2>${T('Participation', 'Turnout', 'Participación')}</h2>
      <p class="st-big" data-count="${G.participation}" data-suffix="%">${G.participation}%</p>
      <p>${T('des votes possibles ont été faits', 'of possible votes were cast', 'de todos los votos posibles')}</p>
      ${G.streak >= 2 ? `<p class="st-pill">🔥 ${T(`${G.streak} jours d’affilée où tout le monde a voté`, `${G.streak} days in a row where everyone voted`, `${G.streak} días seguidos con todo el mundo votando`)}</p>` : ''}`);
    if (G.mvp.length) {
      const [id, n] = G.mvp[0];
      // Devinette : la star + jusqu'à 3 autres membres, dans le désordre.
      const others = state.players.filter((u) => u.claimed && u.id !== id).map((u) => u.id).sort(() => Math.random() - 0.5).slice(0, 3);
      const guess = others.length >= 2 ? { answer: id, options: [id, ...others].sort(() => Math.random() - 0.5), question: T('Qui a été la star du mois ?', 'Who was the star of the month?', '¿Quién ha sido la estrella del mes?') } : null;
      add('linear-gradient(160deg,#3a5bff,#7b2ff7)', `
        <div class="st-emoji">👑</div>
        <h2>${T('La star du mois', 'Star of the month', 'La estrella del mes')}</h2>
        ${big(p(id))}
        <p class="st-name">${name(p(id))}</p>
        <p>${T(`en tête sur ${n} question${n > 1 ? 's' : ''}`, `top of ${n} question${n > 1 ? 's' : ''}`, `primero en ${n} pregunta${n > 1 ? 's' : ''}`)}</p>
        ${G.mvp.length > 1 ? `<p class="st-small">${G.mvp.slice(1).map(([x, c]) => `${name(p(x))} (${c})`).join(' · ')}</p>` : ''}`, { guess, confetti: true });
    }
    if (G.unanimousCount) {
      add('linear-gradient(160deg,#ffbe0b,#ff7a00)', `
        <div class="st-emoji">🤝</div>
        <h2>${T(`${G.unanimousCount} unanimité${G.unanimousCount > 1 ? 's' : ''}`, `${G.unanimousCount} unanimous vote${G.unanimousCount > 1 ? 's' : ''}`, `${G.unanimousCount} unanimidad${G.unanimousCount > 1 ? 'es' : ''}`)}</h2>
        <div class="st-list">${G.unanimous.slice(0, 3).map((u) => `<div class="st-li">${avatar(p(u.target), 'sm')}<span>${esc(qText(u))}</span></div>`).join('')}</div>
        ${G.split ? `<p class="st-small">🌪️ ${T(`Et ${G.split} fois, personne n’était d’accord.`, `And ${G.split} times, nobody agreed.`, `Y ${G.split} veces nadie estuvo de acuerdo.`)}</p>` : ''}`, { confetti: true, dur: 8000 });
    }
    if (G.bestQuestion) {
      add('linear-gradient(160deg,#12b76a,#00a8e8)', `
        <div class="st-emoji">⭐</div>
        <h2>${T('La question préférée', 'Favourite question', 'La pregunta favorita')}</h2>
        ${q(G.bestQuestion)}
        <p>${String(G.bestQuestion.avg).replace('.', L ? '.' : ',')}/5 · ${G.bestQuestion.n} ${T('notes', 'ratings', 'notas')}</p>
        ${G.worstQuestion && G.worstQuestion.avg < G.bestQuestion.avg ? `<p class="st-small">${T('Le flop', 'The flop', 'La peor')} : « ${esc(qText(G.worstQuestion))} » (${String(G.worstQuestion.avg).replace('.', L ? '.' : ',')}/5)</p>` : ''}`);
    }
    if (G.messages) {
      const top = G.topChatter[0];
      add('linear-gradient(160deg,#00b8a9,#3a5bff)', `
        <div class="st-emoji">💬</div>
        <h2>${G.messages} ${T('messages', 'messages', 'mensajes')}</h2>
        ${top ? `${big(p(top[0]))}<p class="st-name">${name(p(top[0]))}</p><p>${T(`le/la plus bavard·e : ${top[1]} messages`, `the chattiest: ${top[1]} messages`, `quien más habla: ${top[1]} mensajes`)}</p>` : ''}
        ${G.bestMsg ? `<div class="st-msg"><b>${esc(p(G.bestMsg.playerId).name)}</b> ${G.bestMsg.text ? esc(G.bestMsg.text) : G.bestMsg.kind === 'gif' ? 'GIF' : '📷'}<span>${G.bestMsg.emojis.join('')} ${G.bestMsg.reactions}</span></div><p class="st-small">${T('le message le plus réagi', 'the most reacted message', 'el mensaje con más reacciones')}</p>` : ''}`);
    }
    const fun = [];
    if (G.nightOwl) fun.push(`<div class="st-li">${avatar(p(G.nightOwl[0]), 'sm')}<span>🦉 <b>${name(p(G.nightOwl[0]))}</b> · ${T('le plus actif entre minuit et 5 h', 'most active between midnight and 5am', 'el más activo entre medianoche y las 5')}</span></div>`);
    if (G.fastest) fun.push(`<div class="st-li">${avatar(p(G.fastest[0]), 'sm')}<span>⚡ <b>${name(p(G.fastest[0]))}</b> · ${T(`vote en ${durTxt(G.fastest[1])} en moyenne`, `votes within ${durTxt(G.fastest[1])} on average`, `vota en ${durTxt(G.fastest[1])} de media`)}</span></div>`);
    if (G.slowest) fun.push(`<div class="st-li">${avatar(p(G.slowest[0]), 'sm')}<span>🐢 <b>${name(p(G.slowest[0]))}</b> · ${T(`prend son temps : ${durTxt(G.slowest[1])}`, `takes their time: ${durTxt(G.slowest[1])}`, `se lo toma con calma: ${durTxt(G.slowest[1])}`)}</span></div>`);
    if (G.bestCustom) fun.push(`<div class="st-li">${avatar(p(G.bestCustom.author), 'sm')}<span>✍️ ${T('Meilleure question perso', 'Best own question', 'Mejor pregunta propia')} : « ${esc(qText(G.bestCustom))} »</span></div>`);
    if (fun.length) add('linear-gradient(160deg,#5a189a,#c21fd6)', `<div class="st-emoji">🏅</div><h2>${T('Mentions spéciales', 'Special mentions', 'Menciones especiales')}</h2><div class="st-list">${fun.join('')}</div>`, { dur: 8500 });
    // --- Toi ---
    if (M.voted) {
      add('linear-gradient(160deg,#f107a3,#ff7a00)', `
        <div class="st-emoji">🫵</div>
        <h2>${T('Et toi ?', 'And you?', '¿Y tú?')}</h2>
        <p class="st-big" data-count="${M.wins}">${M.wins}</p>
        <p>${T(`question${M.wins > 1 ? 's' : ''} où tu étais en tête`, `question${M.wins === 1 ? '' : 's'} where you came top`, `pregunta${M.wins === 1 ? '' : 's'} donde ibas primero`)}${M.winRank ? T(` · ${M.winRank}e du groupe`, ` · #${M.winRank} in the group`, ` · ${M.winRank}.º del grupo`) : ''}</p>
        ${M.winList.length ? `<div class="st-list">${M.winList.slice(0, 4).map((w) => `<div class="st-li"><span>« ${esc(qText(w))} »</span></div>`).join('')}</div>` : ''}
        ${M.unanimous.length ? `<p class="st-pill">👑 ${T(`${M.unanimous.length} unanimité${M.unanimous.length > 1 ? 's' : ''} sur toi`, `${M.unanimous.length} unanimous vote${M.unanimous.length > 1 ? 's' : ''} on you`, `${M.unanimous.length} unanimidad${M.unanimous.length > 1 ? 'es' : ''} con tu nombre`)}</p>` : ''}`);
      const duo = [];
      if (M.fan) duo.push(`<div class="st-li">${avatar(p(M.fan[0]), 'sm')}<span>💘 <b>${name(p(M.fan[0]))}</b> · ${T(`ton plus grand fan (${num(M.fan[1])} votes pour toi)`, `your biggest fan (${num(M.fan[1])} votes for you)`, `tu fan n.º 1 (${num(M.fan[1])} votos para ti)`)}</span></div>`);
      if (M.target) duo.push(`<div class="st-li">${avatar(p(M.target[0]), 'sm')}<span>🎯 <b>${name(p(M.target[0]))}</b> · ${T(`ta cible préférée (${num(M.target[1])} votes)`, `your favourite target (${num(M.target[1])} votes)`, `tu víctima favorita (${num(M.target[1])} votos)`)}</span></div>`);
      if (M.twin) duo.push(`<div class="st-li">${avatar(p(M.twin[0]), 'sm')}<span>👯 <b>${name(p(M.twin[0]))}</b> · ${T(`même vote que toi ${M.twin[1]} % du temps`, `same vote as you ${M.twin[1]}% of the time`, `mismo voto que tú el ${M.twin[1]} % de las veces`)}</span></div>`);
      if (M.selfVotes) duo.push(`<div class="st-li"><span>🪞 ${T(`${num(M.selfVotes)} vote${M.selfVotes > 1 ? 's' : ''} pour toi-même`, `${num(M.selfVotes)} vote${M.selfVotes > 1 ? 's' : ''} for yourself`, `${num(M.selfVotes)} autovoto${M.selfVotes > 1 ? 's' : ''}`)}</span></div>`);
      if (duo.length) add('linear-gradient(160deg,#ff2e88,#7b2ff7)', `<div class="st-emoji">💞</div><h2>${T('Tes affinités du mois', 'Your month’s connections', 'Tus afinidades del mes')}</h2><div class="st-list">${duo.join('')}</div>`, { dur: 8500 });
      add('linear-gradient(160deg,#1d3557,#3a5bff)', `
        <div class="st-emoji">${statDef ? statDef.emoji : '✨'}</div>
        <h2>${T('Ton mois en un mot', 'Your month in a word', 'Tu mes en una palabra')}</h2>
        <p class="st-big st-word">${statDef ? esc(statLabel(statDef)) : '—'}</p>
        <div class="st-facts">
          <span><b>${M.voted}/${G.polls}</b>${T('votes', 'votes', 'votos')}</span>
          <span><b>🔥 ${M.streak}</b>${T('meilleure série', 'best streak', 'mejor racha')}</span>
          <span><b>${M.messages}</b>${T('messages', 'messages', 'mensajes')}</span>
          <span><b>${M.reactions}</b>${T('réactions reçues', 'reactions got', 'reacciones recibidas')}</span>
        </div>
        ${M.speed != null ? `<p class="st-small">${T(`Tu votes en ${durTxt(M.speed)} en moyenne`, `You vote within ${durTxt(M.speed)} on average`, `Votas en ${durTxt(M.speed)} de media`)}</p>` : ''}`);
    }
    add('linear-gradient(160deg,#7b2ff7,#00a8e8)', `<div class="st-emoji">👋</div><h2>${r.partial ? T('Rendez-vous à la fin du mois', 'See you at the end of the month', 'Nos vemos a final de mes') : T('Au mois prochain !', 'See you next month!', '¡Hasta el mes que viene!')}</h2><p>${T('Fais une capture pour la partager au groupe 📸', 'Take a screenshot to share it with the group 📸', 'Haz una captura para compartirla con el grupo 📸')}</p>
      <div class="st-actions"><button class="st-btn" data-share>${T('Partager', 'Share', 'Compartir')} 📤</button><button class="st-btn ghost" data-replay>${T('Revoir', 'Replay', 'Volver a ver')} ↺</button></div>`, { dur: 60000 });
    return out;
  }

  // 95 → « 1 h 35 », 12 → « 12 min ».
  function durTxt(min) {
    const m = Math.round(min);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    return h < 48 ? `${h} h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') : ''}` : T(`${Math.round(h / 24)} j`, `${Math.round(h / 24)} days`, `${Math.round(h / 24)} d`);
  }

  // ---------- Glisser pour changer d'onglet ----------
  // Sur l'écran principal, glisser à gauche / à droite passe à la page voisine : En cours ↔ Archives, puis les
  // onglets du menu. Les sous-onglets de Stats ne se glissent pas (flèches sur les bords à la place).
  function pages() {
    const list = [['live', 'live'], ['live', 'archive'], ['chat'], ['sets'], ['stats']]; // Stats : sous-onglets par les flèches
    if (state.settings.profiles) list.push(['quiz']);
    list.push(['me']);
    return list;
  }
  function pageIndex() {
    const sub = tab === 'live' ? liveMode : undefined;
    return pages().findIndex(([t, m]) => t === tab && (m === undefined || m === sub));
  }
  function goPage(i) {
    const [t, m] = pages()[i];
    if (t === 'live') { liveMode = m; save('liveMode', m); }
    if (t === 'sets') openSet = null;
    if (t === tab) { openPolls.clear(); renderView(); window.scrollTo({ top: 0 }); } else go(t);
  }

  (function setupSwipe() {
    let s = null;
    const blocked = (el) => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        if (n.matches && n.matches('input, textarea, select, [data-noswipe], .crop-box')) return true;
        if (n.scrollWidth > n.clientWidth + 4) {
          const ox = getComputedStyle(n).overflowX;
          if (ox === 'auto' || ox === 'scroll') return true;
        }
      }
      return false;
    };
    document.addEventListener('touchstart', (e) => {
      s = null;
      const view = document.getElementById('view');
      if (!state || !view || e.touches.length !== 1 || !view.contains(e.target) || !$sheet.hidden || chatOpen || storyOpen() || viewerOpen() || animating) return;
      const t = e.touches[0];
      if (t.clientX < 24 || t.clientX > window.innerWidth - 12 || blocked(e.target)) return;
      s = { x: t.clientX, y: t.clientY, t: Date.now(), dir: null, dx: 0, view };
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      if (!s) return;
      if (e.touches.length !== 1) { s = null; return; } // pincer pour zoomer : pas un glissement
      const t = e.touches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (!s.dir) {
        // On décide sur l'ensemble du geste, pas sur les premiers pixels : un pouce part rarement bien à
        // l'horizontale. Même si le navigateur a déjà commencé à faire défiler la page (geste un peu vertical
        // au début), on continue à suivre le doigt au lieu d'abandonner.
        if (Math.abs(dy) > 45 && Math.abs(dy) > Math.abs(dx) * 0.9) { s = null; return; }
        if (Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          s.dir = 'x';
          s.i = pageIndex();
          s.view.style.transition = 'none';
        } else return;
      }
      if (e.cancelable) e.preventDefault(); // bloque le défilement vertical pendant le glissement
      s.dx = dx;
      const can = s.i >= 0 && (dx < 0 ? s.i < pages().length - 1 : s.i > 0);
      const move = can ? dx : dx * 0.25;
      s.view.style.transform = `translateX(${move}px)`;
      s.view.style.opacity = String(1 - Math.min(0.35, Math.abs(move) / window.innerWidth));
    }, { passive: false });
    const end = () => {
      if (!s || s.dir !== 'x') { s = null; return; }
      const { view, dx, i } = s;
      const v = Math.abs(dx) / Math.max(1, Date.now() - s.t);
      s = null;
      const dir = dx < 0 ? 1 : -1;
      const target = i + dir;
      const commit = i >= 0 && target >= 0 && target < pages().length && (Math.abs(dx) > window.innerWidth * 0.22 || (v > 0.45 && Math.abs(dx) > 40));
      view.style.transition = 'transform 0.16s ease-out, opacity 0.16s ease-out';
      if (!commit) {
        view.style.transform = '';
        view.style.opacity = '';
        return;
      }
      view.style.transform = `translateX(${-dir * window.innerWidth * 0.5}px)`;
      view.style.opacity = '0';
      setTimeout(() => {
        view.style.transition = 'none';
        view.style.transform = `translateX(${dir * window.innerWidth * 0.3}px)`;
        goPage(target);
        const fresh = document.getElementById('view');
        if (!fresh) return;
        fresh.style.transition = 'none';
        fresh.style.transform = `translateX(${dir * window.innerWidth * 0.3}px)`;
        fresh.style.opacity = '0';
        fresh.offsetHeight; // force le calcul avant l'animation
        fresh.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out';
        fresh.style.transform = '';
        fresh.style.opacity = '';
      }, 150);
    };
    document.addEventListener('touchend', end);
    document.addEventListener('touchcancel', end);
  })();

  // ---------- Nouveautés & avis ----------
  // Deux boutons en haut de Moi (et au-dessus de « Mon compte » sur l'accueil). Une pastille rose quand il y a du nouveau.
  let releases = null;
  const latestNews = () => (state && state.latestNews) || (account && account.latestNews) || null;
  const newsUnseen = () => !!latestNews() && load('newsSeen') !== latestNews();

  function aboutLinks() {
    return `
      <div class="about-links">
        <button class="link-btn" data-news>✨ ${T('Nouveautés', 'What’s new', 'Novedades')}${newsUnseen() ? '<span class="dot-new"></span>' : ''}</button>
        <button class="link-btn" data-feedback>💬 ${T('Un bug ? Un avis ?', 'Bug? Feedback?', '¿Un bug? ¿Algo que decir?')}</button>
      </div>
      <div class="about-links legal-links"><a href="${PUBLIC_URL}${LANG === 'fr' ? '' : '/en'}/privacy" target="_blank" rel="noopener">${T('Confidentialité', 'Privacy', 'Privacidad')}</a><a href="${PUBLIC_URL}${LANG === 'fr' ? '' : '/en'}/terms" target="_blank" rel="noopener">${T('Conditions', 'Terms', 'Condiciones')}</a><a href="${PUBLIC_URL}${LANG === 'fr' ? '' : '/en'}/support" target="_blank" rel="noopener">${T('Aide', 'Help', 'Ayuda')}</a></div>`;
  }
  function bindAbout(root) {
    root.querySelectorAll('[data-news]').forEach((b) => (b.onclick = () => openNews()));
    root.querySelectorAll('[data-feedback]').forEach((b) => (b.onclick = () => openFeedback()));
  }

  async function openNews() {
    if (!releases) {
      try {
        releases = (await api('GET', 'changelog')).releases;
      } catch (e) { return toast(e.message); }
    }
    const seen = load('newsSeen');
    const seenIdx = releases.findIndex((r) => r.id === seen);
    save('newsSeen', releases[0] && releases[0].id);
    document.querySelectorAll('[data-news] .dot-new').forEach((d) => d.remove());
    const fmt = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString(LOC, { day: 'numeric', month: 'long', timeZone: 'UTC' });
    openSheet(`
      <div class="sheet-head"><h2>✨ ${T('Nouveautés', 'What’s new', 'Novedades')}</h2><button class="x" data-close>✕</button></div>
      ${releases.map((r, i) => `
        <div class="patch ${seenIdx < 0 ? (i === 0 ? 'new' : '') : i < seenIdx ? 'new' : ''}">
          <div class="patch-head"><b>${esc(r.title[LANG] || r.title.en)}</b><span class="muted small">${fmt(r.date)}</span></div>
          <ul>${(r[LANG] || r.en).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
        </div>`).join('')}
      <button class="btn btn-soft btn-block" id="newsFb" style="margin-top:12px">💬 ${T('Un bug ? Une idée ? Dis-le nous', 'A bug? An idea? Tell us', '¿Un bug? ¿Una idea? Cuéntanos')}</button>`, (root) => {
      root.querySelector('#newsFb').onclick = () => openFeedback();
    });
  }

  function openFeedback(showReceived) {
    let kind = load('fbKind') || 'bug';
    let text = load('fbDraft') || '';
    const owner = !!(account && account.account && account.account.owner);
    const draw = () => openSheet(`
      <div class="sheet-head"><h2>💬 ${T('Un bug ? Un avis ?', 'Bug? Feedback?', '¿Un bug? ¿Algo que decir?')}</h2><button class="x" data-close>✕</button></div>
      <p class="muted small" style="margin:0 0 10px">${T('Ça part directement au développeur. Dis ce que tu faisais, ce qui s’est passé, et sur quel téléphone si c’est un bug.', 'It goes straight to the developer. Say what you were doing, what happened, and which phone if it’s a bug.', 'Le llega directo al desarrollador. Cuenta qué estabas haciendo, qué ha pasado y con qué móvil, si es un bug.')}</p>
      <div class="fb-kinds">
        ${[['bug', T('🐞 Bug', '🐞 Bug', '🐞 Bug')], ['idea', T('💡 Idée', '💡 Idea', '💡 Idea')], ['other', T('💬 Autre', '💬 Other', '💬 Otro')]].map(([k, l]) => `<button class="chip ${kind === k ? 'on' : ''}" data-kind="${k}">${l}</button>`).join('')}
      </div>
      <textarea class="input" id="fbText" maxlength="2000" placeholder="${kind === 'bug' ? T('Ex : quand je touche…, l’app…', 'e.g. when I tap…, the app…', 'Ej.: cuando toco…, la app…') : T('Ton idée, ton avis…', 'Your idea, your thoughts…', 'Tu idea, tu opinión…')}">${esc(text)}</textarea>
      <button class="btn btn-main btn-block" id="fbGo">${T('Envoyer', 'Send', 'Enviar')}</button>
      ${owner ? `<button class="btn btn-soft btn-block" id="fbList" style="margin-top:10px">${T('Voir les avis reçus', 'See feedback received', 'Ver opiniones recibidas')}</button><div id="fbItems"></div>` : ''}`, (root) => {
      const area = root.querySelector('#fbText');
      area.oninput = () => { text = area.value; save('fbDraft', text || null); };
      root.querySelectorAll('[data-kind]').forEach((b) => (b.onclick = () => { text = area.value; kind = b.dataset.kind; save('fbKind', kind); draw(); }));
      action(root.querySelector('#fbGo'), async () => {
        await api('POST', 'feedback', { kind, text: area.value, groupId: groupId || undefined });
        save('fbDraft', null);
        closeSheet();
        toast(T('Merci ! C’est envoyé 🙏', 'Thanks! Sent 🙏', '¡Gracias! Enviado 🙏'));
      });
      const showList = async () => {
        const { items } = await api('GET', 'feedback');
        const box = root.querySelector('#fbItems');
        if (!box) return;
        box.innerHTML = items.length ? `<div class="card qlist fb-list" style="margin-top:12px">${items.map((x) => `
          <div class="qrow ${x.done ? 'fb-done' : ''}"><b>${{ bug: '🐞', idea: '💡', other: '💬', report: '🚩' }[x.kind] || '💬'} ${esc(x.name || x.username || '?')}${x.group ? ` · ${esc(x.group)}` : ''}</b><span style="white-space:pre-wrap">${esc(x.text)}</span>${x.report && x.report.message && x.report.message.image ? `<a href="${API}${esc(x.report.message.image)}" target="_blank" rel="noopener">photo</a>` : ''}<span class="muted small">${ago(x.at)} · ${esc(x.version || '')} · ${esc((x.ua.match(/\(([^)]*)\)/) || [])[1] || '')}</span>
            <span class="fb-acts">${x.report && x.report.message ? `<button class="link-btn" data-fbdel="${esc(x.id)}">${T('Supprimer le message', 'Delete message')}</button>` : ''}${x.report && x.report.playerId ? `<button class="link-btn danger-link" data-fbban="${esc(x.id)}">${T('Bannir', 'Ban')}</button>` : ''}${x.done ? '' : `<button class="link-btn" data-fbok="${esc(x.id)}">${T('Traité ✓', 'Done ✓')}</button>`}</span></div>`).join('')}</div>` : `<p class="muted small">${T('Rien pour l’instant.', 'Nothing yet.', 'Nada por ahora.')}</p>`;
      };
      const lb = root.querySelector('#fbList');
      if (lb) action(lb, showList);
      if (showReceived && owner) showList().catch((e) => toast(e.message));
      root.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-fbdel], [data-fbban], [data-fbok]');
        if (!b) return;
        const { items } = await api('GET', 'feedback');
        const x = items.find((i) => i.id === (b.dataset.fbdel || b.dataset.fbban || b.dataset.fbok));
        if (!x) return;
        try {
          if (b.dataset.fbdel) await api('POST', 'owner/delete', { groupId: x.report.groupId, seq: x.report.message.seq });
          if (b.dataset.fbban) {
            if (!confirm(T('Bannir cette personne ? Son compte est supprimé et elle quitte tous ses groupes.', 'Ban this person? Their account is deleted and they leave all their groups.'))) return;
            await api('POST', 'owner/ban', { groupId: x.report.groupId, playerId: x.report.playerId });
          }
          await api('POST', `feedback/${x.id}/done`);
          toast(T('Fait', 'Done'));
          showList();
        } catch (err) { toast(err.message); }
      });
    });
    draw();
  }

  // Liens des notifications : ?news=1 (nouvelle version), ?feedback=1 (avis reçu, pour le développeur).
  function openPendingAbout() {
    if (pendingNews) { pendingNews = false; openNews(); }
    else if (pendingFeedback) { pendingFeedback = false; openFeedback(true); }
  }

  // ---------- Moi & admin ----------

  function renderMe(view) {
    const m = me();
    const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const pushOk = NATIVE ? !!Plugins.FirebaseMessaging : 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && vapid();

    view.innerHTML = `
      ${aboutLinks()}
      <div class="card" id="profileCard">
        <div class="profile-row">
          <button class="photo-btn" id="photoBtn" aria-label="${T('Changer ma photo', 'Change my photo', 'Cambiar mi foto')}">${avatar(m, 'lg')}<span class="photo-edit">${icon('edit')}</span></button>
          <div class="profile-text">
            <b>${esc(m.name)}</b>
            <span class="muted small">${state.me.isAdmin ? T('Admin du groupe', 'Group admin', 'Admin del grupo') : T('Membre du groupe', 'Group member', 'Miembro del grupo')}</span>
            <span class="photo-links">
              <button class="link-btn" id="photoBtn2">${m.photo ? T('Changer la photo', 'Change photo', 'Cambiar la foto') : T('Ajouter une photo', 'Add a photo', 'Añadir una foto')}</button>
              ${m.photo ? `<button class="link-btn muted" id="photoDel">${T('Retirer', 'Remove', 'Quitar')}</button>` : ''}
            </span>
          </div>
        </div>
        <label for="myName">${T('Pseudo', 'Name', 'Nombre')}</label>
        <div class="inline-form">
          <input class="input" id="myName" maxlength="24" value="${esc(m.name)}">
          <button class="btn btn-soft" id="saveName">OK</button>
        </div>
        <label>${T('Ta couleur', 'Your color', 'Tu color')}</label>
        ${colorPicker(m)}
      </div>

      <div class="card">
        <div class="card-title lang-title"><span>${T('Langue', 'Language', 'Idioma')}</span>${langSwitch()}</div>
        <p class="muted small" style="margin:0">${T('Les questions intégrées, les menus et tes notifications passent dans cette langue.', 'Built-in questions, menus and your notifications switch to this language.', 'Las preguntas de la app, los menús y tus notificaciones pasan a este idioma.')}</p>
      </div>

      <div class="card">
        <div class="card-title">${T('Groupe', 'Group', 'Grupo')}</div>
        <div class="group-code-row">
          <span>${esc(state.group.name)}</span>
          <span class="code-pill">${esc(state.group.code)}</span>
        </div>
        <button class="btn btn-main btn-block" id="inviteBtn" style="margin-top:14px">${T('Inviter des potes', 'Invite your mates', 'Invitar a colegas')}</button>
      </div>

      <div class="card">
        <div class="card-title">${T('Notifications', 'Notifications', 'Notificaciones')}</div>
        <p class="muted small" id="pushStatus" style="margin:0 0 12px">…</p>
        ${iOS && !standalone && !NATIVE ? `<div class="info" style="margin-bottom:12px">${T('Sur iPhone : touche <b>Partager</b> puis <b>Sur l’écran d’accueil</b>, et ouvre l’app depuis la nouvelle icône pour pouvoir activer les notifications.', 'On iPhone: tap <b>Share</b> then <b>Add to Home Screen</b>, and open the app from the new icon to be able to turn on notifications.', 'En iPhone: toca <b>Compartir</b> y luego <b>Añadir a pantalla de inicio</b>, y abre la app desde el icono nuevo para poder activar las notificaciones.')}</div>` : ''}
        <div class="row" style="margin-top:0">
          <button class="btn btn-main" id="pushBtn" ${pushOk ? '' : 'disabled'}>${T('Activer les notifications', 'Turn on notifications', 'Activar notificaciones')}</button>
          <button class="btn btn-soft" id="pushTest" hidden>${T('Tester', 'Test', 'Probar')}</button>
        </div>
        <p class="push-out muted small" id="pushOut"></p>
        <div class="notif-prefs">
          ${[
            ['polls', T('Nouvelles questions', 'New questions', 'Preguntas nuevas')],
            ['votes', T('Quand quelqu’un vote', 'When someone votes', 'Cuando alguien vota')],
            ['chat', T('Messages', 'Messages', 'Mensajes')],
            ['mentions', T('Quand on te tague ou te répond', 'When someone tags you or replies to you', 'Cuando te etiquetan o te responden'), T('Même si les messages sont coupés', 'Even if messages are off', 'Aunque tengas los mensajes desactivados')],
            ['streaks', T('Rappel de série 🔥', 'Streak reminder 🔥', 'Recordatorio de racha 🔥'), T('Le soir, si ta série va s’arrêter', 'In the evening, if your streak is about to end', 'Por la noche, si vas a perder la racha')],
            ['news', T('Nouveautés de l’app', 'App updates', 'Novedades de la app'), T('Une fois par nouvelle version', 'Once per new version', 'Una vez por cada versión nueva')],
          ].map(([k, label, sub]) => `
            <label class="switch-row"><span>${label}${sub ? `<small class="muted">${sub}</small>` : ''}</span><input type="checkbox" class="switch" data-notif="${k}" ${state.me.notif[k] ? 'checked' : ''}></label>`).join('')}
        </div>
      </div>

      ${state.me.isAdmin ? adminHtml() : ''}

      <button class="btn btn-soft btn-block" id="logout">${T('Se déconnecter', 'Log out', 'Cerrar sesión')}</button>
      <button class="link-btn danger-link leave-link" id="leaveGroup">${T('Quitter ce groupe', 'Leave this group', 'Salir de este grupo')}</button>`;

    bindLangSwitch(view, () => renderMain());
    view.querySelectorAll('[data-color]').forEach((b) => action(b, async () => {
      if (b.classList.contains('on')) return;
      await api('PATCH', 'me', { color: b.dataset.color });
      toast(T('Couleur changée', 'Color changed', 'Color cambiado'));
      await refresh();
    }));
    action(document.getElementById('saveName'), async () => {
      await api('PATCH', 'me', { name: document.getElementById('myName').value });
      document.activeElement.blur();
      toast(T('Pseudo changé', 'Name changed', 'Nombre cambiado'));
      await refresh();
    });
    const changePhoto = async () => {
      const data = await pickPhoto();
      if (!data) return;
      try {
        await api('POST', 'me/photo', { data });
        toast(T('Photo mise à jour', 'Photo updated', 'Foto actualizada'));
        await refresh();
      } catch (e) { toast(e.message); }
    };
    document.getElementById('photoBtn').onclick = changePhoto;
    document.getElementById('photoBtn2').onclick = changePhoto;
    action(document.getElementById('photoDel'), async () => {
      await api('DELETE', 'me/photo');
      toast(T('Photo retirée', 'Photo removed', 'Foto quitada'));
      await refresh();
    });
    setupPushButton(pushOk);
    view.querySelectorAll('[data-notif]').forEach((el) => {
      el.onchange = async () => {
        try {
          const { notif } = await api('PATCH', 'me', { notif: { [el.dataset.notif]: el.checked } });
          state.me.notif = notif;
        } catch (e) {
          el.checked = !el.checked;
          toast(e.message);
        }
      };
    });
    document.getElementById('inviteBtn').onclick = () => showInvite(false);
    bindAbout(view);
    action(document.getElementById('leaveGroup'), async () => {
      const others = state.players.filter((p) => p.claimed && p.id !== state.me.playerId).length;
      const msg = T(`Quitter « ${state.group.name} » ? Ton nom redevient libre (tes votes et messages restent).${state.me.isAdmin && others ? ' Le rôle d’admin passe au membre le plus ancien.' : ''}`, `Leave “${state.group.name}”? Your name becomes free again (your votes and messages stay).${state.me.isAdmin && others ? ' The admin role goes to the longest-standing member.' : ''}`);
      if (!confirm(msg)) return;
      await api('POST', 'me/leave');
      cacheClear((k) => k !== 'st_' + groupId);
      toast(T('Tu as quitté le groupe', 'You left the group'));
      leaveGroup();
    });
    action(document.getElementById('logout'), async () => {
      try { await api('POST', 'logout'); } catch { /* déjà déconnecté */ }
      stopPolling();
      logoutLocal();
    });
    if (state.me.isAdmin) bindAdmin(view);
  }

  // 16 couleurs : celles déjà prises par d'autres sont grisées (avec la photo de la personne).
  function colorPicker(m) {
    const owner = (c) => state.players.find((p) => p.color === c && p.id !== m.id);
    return `<div class="color-grid">${state.colors.map((c) => {
      const o = owner(c);
      return `<button type="button" class="swatch ${c === m.color ? 'on' : ''} ${o ? 'taken' : ''}" style="--pc:${c}" ${o ? 'disabled' : `data-color="${c}"`} aria-label="${o ? T('Prise par', 'Taken by', 'Pillado por') + ' ' + esc(o.name) : c}" title="${o ? esc(o.name) : ''}">${o ? avatar(o, 'xs') : c === m.color ? icon('check') : ''}</button>`;
    }).join('')}</div>`;
  }

  function adminHtml() {
    // Planning affiché (et enregistré) dans le fuseau de ce téléphone ; chacun le voit ensuite dans le sien.
    const s = { ...state.settings, startHour: Math.round(hourToLocal(state.settings.startHour, state.settings.timezone)) % 24, endHour: Math.round(hourToLocal(state.settings.endHour, state.settings.timezone)) % 24, timezone: myTz };
    // Fin : de « début + 1 h » à « début − 1 h » (le lendemain). Les deux heures sont incluses.
    const endOptions = (start, end) => Array.from({ length: 23 }, (_, i) => (start + 1 + i) % 24)
      .map((h) => `<option value="${h}" ${h === end ? 'selected' : ''}>${hourLabel(h)}${h < start ? T(' (lendemain)', ' (next day)', ' (día siguiente)') : ''}</option>`).join('');
    return `
      <div class="section-title">Admin</div>

      <div class="card">
        <div class="card-title">${T('Nom du groupe', 'Group name', 'Nombre del grupo')}</div>
        <div class="inline-form">
          <input class="input" id="groupName" maxlength="40" value="${esc(state.group.name)}">
          <button class="btn btn-soft" id="saveGroup">OK</button>
        </div>
        <p class="muted small" style="margin:10px 0 0">${T('Le code a fuité ? Génère-en un nouveau : l’ancien ne marchera plus (ceux qui ont déjà rejoint restent connectés).', 'Code leaked? Make a new one: the old one stops working (people who already joined stay logged in).', '¿Se ha filtrado el código? Genera uno nuevo: el antiguo dejará de funcionar (quien ya se haya unido sigue conectado).')}</p>
        <button class="btn btn-soft btn-block" id="newCode" style="margin-top:10px">${T('Générer un nouveau code', 'Make a new code', 'Generar un código nuevo')}</button>
      </div>

      <div class="card">
        <div class="card-title">${T('Les potes', 'Your mates', 'Los colegas')} <span class="muted small">· ${state.players.length}</span></div>
        <p class="muted small">${T('Ajoute tout le monde ici, même ceux qui n’ont pas encore rejoint : on peut déjà voter pour eux.', 'Add everyone here, even people who haven’t joined yet: you can already vote for them.', 'Añade aquí a todo el mundo, aunque aún no se hayan unido: ya se les puede votar.')}</p>
        <div class="roster">${state.players.map((p) => `
          <div class="roster-row">
            ${avatar(p, 'sm')}
            <span class="name">${esc(p.name)}</span>
            <span class="status ${p.claimed ? 'on' : ''}">${p.claimed ? T('a rejoint', 'joined', 'se ha unido') : T('en attente', 'waiting', 'pendiente')}</span>
            <button class="icon-btn" data-rename="${p.id}" title="${T('Renommer', 'Rename', 'Renombrar')}" aria-label="${T('Renommer', 'Rename', 'Renombrar')}">${icon('edit')}</button>
            ${p.claimed && p.id !== state.me.playerId ? `<button class="icon-btn" data-reset="${p.id}" title="${T('Détacher ce nom de son compte', 'Unlink this name from its account', 'Desvincular este nombre de su cuenta')}" aria-label="${T('Détacher', 'Unlink', 'Desvincular')}">${icon('trash')}</button>` : ''}
            ${!p.claimed ? `<button class="icon-btn" data-remove="${p.id}" title="${T('Retirer', 'Remove', 'Quitar')}" aria-label="${T('Retirer', 'Remove', 'Quitar')}">${icon('trash')}</button>` : ''}
          </div>`).join('')}
        </div>
        <textarea class="input" id="rosterAdd" placeholder="${T('Un nom par ligne&#10;Alex&#10;John&#10;Carlos', 'One name per line&#10;Alex&#10;John&#10;Carlos', 'Un nombre por línea&#10;Alex&#10;John&#10;Carlos')}" style="margin-top:12px;min-height:80px"></textarea>
        <button class="btn btn-main btn-block" id="rosterBtn" style="margin-top:10px">${T('Ajouter', 'Add', 'Añadir')}</button>
      </div>

      <div class="card">
        <div class="card-title">${T('Planning des questions', 'Question schedule', 'Horario de las preguntas')}</div>
        <div class="settings-grid">
          <label>${T('Toutes les (heures, 4 min.)', 'Every (hours, min. 4)', 'Cada (horas, mín. 4)')}<input class="input" id="sInterval" type="number" inputmode="decimal" step="0.5" min="4" max="24" value="${s.intervalHours}"></label>
          <label>${T('Durée du vote (heures)', 'Voting time (hours)', 'Duración del voto (horas)')}<input class="input" id="sPoll" type="number" inputmode="decimal" step="1" min="0.02" max="168" value="${s.pollHours}"></label>
          <label>${T('À partir de', 'From', 'Desde')}<select class="input" id="sStart">${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === s.startHour ? 'selected' : ''}>${hourLabel(h)}</option>`).join('')}</select></label>
          <label>${T('Jusqu’à (inclus)', 'Until (included)', 'Hasta (incluida)')}<select class="input" id="sEnd">${endOptions(s.startHour, s.endHour)}</select></label>
        </div>
        <p class="muted small" id="sWindow" style="margin:8px 0 0">${scheduleText(s)}</p>
        <p class="muted small tz-note">${T(`Heures de ton fuseau (${esc(myTz)}). Chacun les voit dans son propre fuseau.`, `Hours in your time zone (${esc(myTz)}). Everyone sees them in their own time zone.`, `Horas en tu zona horaria (${esc(myTz)}). Cada uno las ve en la suya.`)}${state.settings.timezone !== myTz ? T(` Le groupe était réglé sur ${esc(state.settings.timezone)} : en enregistrant, il passe sur le tien (mêmes horaires).`, ` The group was set to ${esc(state.settings.timezone)}: saving switches it to yours (same times).`, ` El grupo estaba en ${esc(state.settings.timezone)}: al guardar, se cambia a la tuya (mismos horarios).`) : ''}</p>
        <p class="muted small">${T('Prochaine question auto', 'Next auto question', 'Próxima pregunta auto')} : <b>${state.nextDrop ? clock(state.nextDrop) : '—'}</b> · ${plural(state.remainingQuestions, T('question', 'question', 'pregunta'))} ${T('en réserve', 'left', 'en reserva')}</p>
        <p class="muted small" style="margin-top:0">${T('Une nouvelle durée de vote s’applique aussi aux questions en cours.', 'A new voting time also applies to the questions already running.', 'Si cambias la duración, también afecta a las preguntas en curso.')}</p>
        <div class="row">
          <button class="btn btn-main" id="saveSettings">${T('Enregistrer', 'Save', 'Guardar')}</button>
          <button class="btn btn-soft" id="forceDrop">${T('Lancer maintenant', 'Launch now', 'Lanzar ahora')}</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">${T('Options du groupe', 'Group options', 'Opciones del grupo')}</div>
        <label class="switch-row"><span>${T('Questions en plus par jour', 'Extra questions per day', 'Preguntas extra al día')}<small class="muted">${T('Combien chacun peut en lancer avec le bouton +, en plus du planning.', 'How many each person can launch with the + button, on top of the schedule.', 'Cuántas puede lanzar cada uno con el botón +, además del horario.')}</small></span>
          <span class="stepper"><button type="button" data-step="-1" aria-label="−">−</button><b id="dropsN">${s.dropsPerDay ?? 1}</b><button type="button" data-step="1" aria-label="+">+</button></span></label>
        <label class="switch-row"><span>${T('Sets 18+', '18+ sets', 'Sets +18')}<small class="muted">${T('Questions spicy (sexe, tromperie…). Désactivées : elles ne tombent plus et les sets sont cachés.', 'Spicy questions (sex, cheating…). Off: they stop dropping and the sets are hidden.', 'Preguntas picantes (sexo, cuernos…). Desactivadas: dejan de salir y los sets se ocultan.')}</small></span><input type="checkbox" class="switch" id="spicyOn" ${s.spicy !== false ? 'checked' : ''}></label>
        <label class="switch-row"><span>${T('Réponse « Personne »', '“Nobody” answer', 'Respuesta «Nadie»')}<small class="muted">${T('Sur les questions au conditionnel (« Qui ferait… »), on peut voter pour personne.', 'On “Who would…” questions, people can vote for nobody.', 'En las preguntas en condicional («¿Quién haría…?»), se puede votar por nadie.')}</small></span><input type="checkbox" class="switch" id="allowNobody" ${s.allowNobody ? 'checked' : ''}></label>
      </div>

      <div class="card">
        <div class="card-title">🧩 ${T('Questionnaire', 'Questionnaire', 'Cuestionario')}</div>
        <label class="switch-row"><span>${T('Questionnaire de profil', 'Profile questionnaire', 'Cuestionario de perfil')}<small class="muted">${T('Un onglet Quiz en plus : chacun répond à quelques questions (âge, études ou boulot, couple…), et les questions qui vous collent tombent plus souvent. Réponses anonymes.', 'An extra Quiz tab: everyone answers a few questions (age, studies or work, relationship…), and the questions that fit you come up more often. Answers stay anonymous.', 'Una pestaña Quiz extra: cada uno responde a unas cuantas preguntas (edad, estudios o curro, pareja…), y las preguntas que van con vosotros salen más a menudo. Respuestas anónimas.')}</small></span><input type="checkbox" class="switch" id="profilesOn" ${s.profiles ? 'checked' : ''}></label>
        ${s.profiles ? quizAdminCard() : ''}
      </div>

      <div class="card">
        <div class="card-title">${T('Questions à noter', 'Questions to score', 'Preguntas por puntuar')}</div>
        <p class="muted small">${T('Les questions créées par le groupe n’ont pas encore de stats. Copie-les, donne-les à Claude, puis colle sa réponse ici.', 'Questions written by the group don’t have stats yet. Copy them, give them to Claude, then paste its answer here.', 'Las preguntas creadas por el grupo aún no tienen stats. Cópialas, pásaselas a Claude y luego pega aquí su respuesta.')}</p>
        <button class="btn btn-soft btn-block" id="exportQ">${T('Copier les questions à noter', 'Copy the questions to score', 'Copiar las preguntas por puntuar')}</button>
        <textarea class="input" id="scoresIn" placeholder='${T('Réponse de Claude', 'Claude’s answer', 'Respuesta de Claude')} : {"id": {"chaos": 2, "hot": 1}, …}' style="margin-top:12px;min-height:80px"></textarea>
        <button class="btn btn-main btn-block" id="importQ" style="margin-top:10px">${T('Importer les scores', 'Import the scores', 'Importar las puntuaciones')}</button>
      </div>

      <div class="card">
        <div class="card-title">${T('Notes des questions', 'Question ratings', 'Notas de las preguntas')}</div>
        <p class="muted small">${T(`${plural(state.groupStats.ratings.count, 'note')} données par le groupe. Copie-les pour une IA : elle saura quel genre de questions vous aimez pour en écrire de nouvelles.`, `${plural(state.groupStats.ratings.count, 'rating')} from the group. Copy them for an AI: it’ll know what kind of questions you like and can write new ones.`, `${plural(state.groupStats.ratings.count, 'nota')} del grupo. Cópialas para una IA: sabrá qué tipo de preguntas os gustan y podrá escribir otras nuevas.`)}</p>
        <button class="btn btn-soft btn-block" id="exportRatings" ${state.groupStats.ratings.count ? '' : 'disabled'}>${T('Copier les notes (JSON)', 'Copy the ratings (JSON)', 'Copiar las notas (JSON)')}</button>
      </div>`;
  }

  function bindAdmin(view) {
    action(document.getElementById('saveGroup'), async () => {
      await api('PATCH', 'admin/group', { name: document.getElementById('groupName').value });
      document.activeElement.blur();
      toast(T('Groupe renommé', 'Group renamed', 'Grupo renombrado'));
      await refresh();
    });
    action(document.getElementById('newCode'), async () => {
      if (!confirm(T('Générer un nouveau code ? L’ancien ne marchera plus.', 'Make a new code? The old one will stop working.', '¿Generar un código nuevo? El antiguo dejará de funcionar.'))) return;
      const { group } = await api('POST', 'admin/group/code');
      save('code', group.code);
      toast(T('Nouveau code : ', 'New code: ', 'Código nuevo: ') + group.code);
      await refresh();
    });
    action(document.getElementById('rosterBtn'), async () => {
      const r = await api('POST', 'admin/players', { names: document.getElementById('rosterAdd').value });
      toast(r.added.length ? T(`${plural(r.added.length, 'pote')} ajouté${r.added.length > 1 ? 's' : ''}`, `${plural(r.added.length, 'mate')} added`, `¡${plural(r.added.length, 'colega')} dentro!`) : T('Personne d’ajouté', 'Nobody added', 'No se ha añadido a nadie'));
      if (r.errors.length) alert(r.errors.join('\n'));
      await refresh();
    });
    view.querySelectorAll('[data-rename]').forEach((b) => action(b, async () => {
      const p = player(b.dataset.rename);
      const name = prompt(T('Nouveau nom pour ', 'New name for ', 'Nuevo nombre para ') + p.name, p.name);
      if (!name || name === p.name) return;
      await api('PATCH', `admin/players/${p.id}`, { name });
      await refresh();
    }));
    view.querySelectorAll('[data-reset]').forEach((b) => action(b, async () => {
      const p = player(b.dataset.reset);
      if (!confirm(T(`Détacher « ${p.name} » de son compte ? Ce nom redevient libre dans le groupe (ses votes restent) : quelqu’un pourra le reprendre en rejoignant. Pour un PIN oublié, utilise plutôt la clé 🔑.`, `Unlink “${p.name}” from their account? The name becomes free in the group again (their votes stay) and someone can take it when joining. For a forgotten PIN, use the 🔑 key instead.`, `¿Desvincular «${p.name}» de su cuenta? El nombre vuelve a quedar libre en el grupo (sus votos se quedan): alguien podrá pillarlo al unirse. Si es por un PIN olvidado, mejor usa la llave 🔑.`))) return;
      await api('POST', `admin/players/${p.id}/reset`);
      toast(T('Nom détaché', 'Name unlinked', 'Nombre desvinculado'));
      await refresh();
    }));
    view.querySelectorAll('[data-recover]').forEach((b) => action(b, async () => {
      const p = player(b.dataset.recover);
      if (!confirm(T(`Créer un code de récupération pour ${p.name} ? Avec ce code et son identifiant, iel pourra choisir un nouveau PIN (valable 48 h).`, `Make a recovery code for ${p.name}? With it and their username, they can pick a new PIN (valid for 48 h).`, `¿Crear un código de recuperación para ${p.name}? Con este código y su usuario, podrá elegir un PIN nuevo (vale 48 h).`))) return;
      const r = await api('POST', `admin/players/${p.id}/recovery`);
      openSheet(`
        <div class="sheet-head"><h2>${T('Code de récupération', 'Recovery code', 'Código de recuperación')}</h2><button class="x" data-close>✕</button></div>
        <p class="muted" style="margin:0 0 6px">${T(`Donne ce code à <b>${esc(p.name)}</b>. Sur l’écran de connexion : « PIN oublié ? », son identifiant${r.username ? ` (<b>${esc(r.username)}</b>)` : ''}, ce code, puis un nouveau PIN. Il marche une fois, pendant 48 h.`, `Give this code to <b>${esc(p.name)}</b>. On the login screen: “Forgot your PIN?”, their username${r.username ? ` (<b>${esc(r.username)}</b>)` : ''}, this code, then a new PIN. It works once, for 48 h.`, `Dale este código a <b>${esc(p.name)}</b>. En la pantalla de inicio de sesión: «¿PIN olvidado?», su usuario${r.username ? ` (<b>${esc(r.username)}</b>)` : ''}, este código y luego un PIN nuevo. Funciona una sola vez, durante 48 h.`)}</p>
        <div class="big-code">${esc(r.code)}</div>
        <button class="btn btn-soft btn-block" id="copyRec">${T('Copier le code', 'Copy code', 'Copiar el código')}</button>`, (root) => {
        root.querySelector('#copyRec').onclick = () => navigator.clipboard.writeText(r.code).then(() => toast(T('Code copié', 'Code copied', 'Código copiado'))).catch(() => prompt(T('Copie ça :', 'Copy this:', 'Copia esto:'), r.code));
      });
    }));
    view.querySelectorAll('[data-remove]').forEach((b) => action(b, async () => {
      const p = player(b.dataset.remove);
      if (!confirm(T(`Retirer ${p.name} du groupe ?`, `Remove ${p.name} from the group?`, `¿Quitar a ${p.name} del grupo?`))) return;
      await api('DELETE', `admin/players/${p.id}`);
      await refresh();
    }));
    action(document.getElementById('saveSettings'), async () => {
      const v = (id) => document.getElementById(id).value;
      await api('PATCH', 'admin/settings', { intervalHours: v('sInterval'), pollHours: v('sPoll'), startHour: v('sStart'), endHour: v('sEnd'), timezone: myTz });
      toast(T('Planning enregistré ⏰', 'Schedule saved ⏰', 'Horario guardado ⏰'));
      document.activeElement.blur();
      await refresh();
    });
    document.getElementById('spicyOn').onchange = async (e) => {
      try {
        await api('PATCH', 'admin/settings', { spicy: e.target.checked });
        toast(e.target.checked ? T('Sets 18+ activés', '18+ sets on') : T('Sets 18+ désactivés', '18+ sets off'));
        await refresh();
      } catch (err) {
        e.target.checked = !e.target.checked;
        toast(err.message);
      }
    };
    document.getElementById('allowNobody').onchange = async (e) => {
      try {
        await api('PATCH', 'admin/settings', { allowNobody: e.target.checked });
        toast(e.target.checked ? T('Réponse « Personne » activée', '“Nobody” answer on', 'Respuesta «Nadie» activada') : T('Réponse « Personne » désactivée', '“Nobody” answer off', 'Respuesta «Nadie» desactivada'));
        await refresh();
      } catch (err) {
        e.target.checked = !e.target.checked;
        toast(err.message);
      }
    };
    bindQuizAdmin(view);
    document.getElementById('profilesOn').onchange = async (e) => {
      try {
        await api('PATCH', 'admin/settings', { profiles: e.target.checked });
        toast(e.target.checked ? T('Questionnaire activé : un onglet Quiz apparaît pour tout le monde', 'Questionnaire on: a Quiz tab shows up for everyone', 'Cuestionario activado: aparece una pestaña Quiz para todo el mundo') : T('Questionnaire désactivé', 'Questionnaire off', 'Cuestionario desactivado'));
        await refresh();
      } catch (err) {
        e.target.checked = !e.target.checked;
        toast(err.message);
      }
    };
    view.querySelectorAll('[data-step]').forEach((b) => action(b, async () => {
      const n = Math.max(0, Math.min(10, (state.settings.dropsPerDay ?? 1) + Number(b.dataset.step)));
      if (n === (state.settings.dropsPerDay ?? 1)) return;
      await api('PATCH', 'admin/settings', { dropsPerDay: n });
      state.settings.dropsPerDay = n;
      document.getElementById('dropsN').textContent = n;
      toast(T(`${n} question${n > 1 ? 's' : ''} en plus par jour`, `${n} extra question${n > 1 ? 's' : ''} a day`, `${n} pregunta${n > 1 ? 's' : ''} extra al día`));
      softRefresh();
    }));
    action(document.getElementById('forceDrop'), async () => {
      const { poll } = await api('POST', 'admin/drop-auto');
      replacePoll(poll);
      toast(T('Question lancée', 'Question launched', 'Pregunta lanzada'));
      go('live');
      await refresh();
    });
    action(document.getElementById('exportQ'), async () => {
      const { questions } = await api('GET', 'admin/unscored');
      if (!questions.length) return toast(T('Rien à noter, tout est à jour', 'Nothing to score, all up to date', 'Nada que puntuar, todo al día'));
      const text = T('Questions « Whomst » à noter (stats : chaos, hot, coeur, cerveau, genance, toxique, exces ; 1 à 3 stats par question, valeurs -2 à 3). Réponds en JSON {"id": {"stat": valeur}}.', '“Whomst” questions to score (stats: chaos, hot, coeur, cerveau, genance, toxique, exces; 1 to 3 stats per question, values -2 to 3). Answer in JSON {"id": {"stat": value}}.', 'Preguntas de «Whomst» para puntuar (stats: chaos, hot, coeur, cerveau, genance, toxique, exces; de 1 a 3 stats por pregunta, valores de -2 a 3). Responde en JSON {\"id\": {\"stat\": valor}}.') + '\n\n' + JSON.stringify(questions, null, 1);
      try {
        await navigator.clipboard.writeText(text);
        toast(T(`${plural(questions.length, 'question')} copiée${questions.length > 1 ? 's' : ''}`, `${plural(questions.length, 'question')} copied`, `${plural(questions.length, 'pregunta')} en el portapapeles`));
      } catch {
        document.getElementById('scoresIn').value = text;
        toast(T('Copie impossible : le texte est dans la case, copie-le à la main', 'Couldn’t copy: the text is in the box, copy it by hand', 'No se ha podido copiar: el texto está en la casilla, cópialo a mano'));
      }
    });
    action(document.getElementById('importQ'), async () => {
      const raw = document.getElementById('scoresIn').value.trim();
      const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
      let scores;
      try { scores = JSON.parse(json); } catch { throw new Error(T('JSON invalide', 'Invalid JSON', 'JSON no válido')); }
      const r = await api('POST', 'admin/scores', { scores });
      toast(T(`${plural(r.updated, 'question')} notée${r.updated > 1 ? 's' : ''}`, `${plural(r.updated, 'question')} scored`, `${plural(r.updated, 'pregunta')} con nota`));
      if (r.errors.length) alert(r.errors.join('\n'));
      document.getElementById('scoresIn').value = '';
      await refresh();
    });
    // Planning : la liste « jusqu'à » suit l'heure de début (début + 1 h … début − 1 h le lendemain).
    const sStart = document.getElementById('sStart');
    const sEnd = document.getElementById('sEnd');
    const sync = () => {
      const start = Number(sStart.value);
      let end = Number(sEnd.value);
      if (end === start) end = (start + 1) % 24;
      sEnd.innerHTML = Array.from({ length: 23 }, (_, i) => (start + 1 + i) % 24)
        .map((h) => `<option value="${h}" ${h === end ? 'selected' : ''}>${hourLabel(h)}${h < start ? T(' (lendemain)', ' (next day)', ' (día siguiente)') : ''}</option>`).join('');
      document.getElementById('sWindow').textContent = scheduleText({ ...state.settings, timezone: myTz, intervalHours: Number(document.getElementById('sInterval').value) || state.settings.intervalHours, startHour: start, endHour: end });
    };
    sStart.onchange = sync;
    sEnd.onchange = sync;
    document.getElementById('sInterval').oninput = sync;
    action(document.getElementById('exportRatings'), async () => {
      const data = await api('GET', 'admin/ratings');
      const text = T('Notes des questions « Whomst » (1 = nulle, 5 = excellente), à utiliser pour écrire de nouvelles questions dans le même esprit que les mieux notées.', 'Ratings of the “Whomst” questions (1 = bad, 5 = great), to use for writing new questions in the same spirit as the best rated ones.', 'Notas de las preguntas de «Whomst» (1 = malísima, 5 = buenísima), para escribir preguntas nuevas con el mismo rollo que las mejor valoradas.') + '\n\n' + JSON.stringify(data, null, 1);
      try {
        await navigator.clipboard.writeText(text);
        toast(T('Notes copiées', 'Ratings copied', 'Notas copiadas'));
      } catch {
        document.getElementById('scoresIn').value = text;
        toast(T('Copie impossible : le texte est dans la case « Questions à noter »', 'Couldn’t copy: the text is in the “Questions to score” box', 'No se ha podido copiar: el texto está en la casilla «Preguntas por puntuar»'));
      }
    });
  }

  // ---------- Temps réel ----------

  let liveCtrl = null;
  let liveRetry = null;

  function startLive() {
    if (liveCtrl || !token || document.hidden) return;
    const ctrl = new AbortController();
    liveCtrl = ctrl;
    (async () => {
      try {
        const res = await fetch(API + '/api/events', { headers: { Authorization: 'Bearer ' + token, 'X-Group': groupId || '' }, signal: ctrl.signal });
        if (!res.ok || !res.body) throw new Error('live');
        for (const k of [...chats.keys()]) if (k !== chatOpen) chats.delete(k);
        if (chatOpen) loadChat(chatOpen, true); // rattrape ce qui a pu être manqué
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const chunk = buf.slice(0, i);
            buf = buf.slice(i + 2);
            const type = (chunk.match(/^event: (.*)$/m) || [])[1];
            const data = (chunk.match(/^data: (.*)$/m) || [])[1];
            if (type && data) {
              try { onLive(type, JSON.parse(data)); } catch (e) { console.error(e); }
            }
          }
        }
      } catch { /* connexion coupée */ }
      if (liveCtrl === ctrl) {
        liveCtrl = null;
        if (!ctrl.signal.aborted && token && !document.hidden) {
          clearTimeout(liveRetry);
          liveRetry = setTimeout(startLive, 3000);
        }
      }
    })();
  }

  function stopLive() {
    clearTimeout(liveRetry);
    if (liveCtrl) {
      liveCtrl.abort();
      liveCtrl = null;
    }
  }

  function onLive(type, d) {
    if (type === 'refresh') return scheduleRefresh();
    const c = chats.get(d.channel);
    if (type === 'msg') {
      if (d.locked) {
        if (c && c.locked) {
          c.count = (c.count || 0) + 1;
          if (chatOpen === d.channel) renderChatMessages();
        }
        return scheduleRefresh();
      }
      if (c && !c.locked && !c.messages.some((m) => m.id === d.id)) c.messages.push(d);
      typing.get(d.channel)?.delete(d.playerId);
      if (chatOpen === d.channel) {
        renderChatMessages();
        renderTyping();
        markReadSoon();
      }
      scheduleRefresh();
    } else if (type === 'typing') {
      if (!typing.has(d.channel)) typing.set(d.channel, new Map());
      typing.get(d.channel).set(d.playerId, Date.now() + 4500);
      if (chatOpen === d.channel) renderTyping();
      setTimeout(() => { if (chatOpen === d.channel) renderTyping(); }, 4600);
    } else if (type === 'read') {
      if (c) {
        c.reads[d.playerId] = Math.max(c.reads[d.playerId] || 0, d.seq);
        if (chatOpen === d.channel) updateSeenLine();
      }
    } else if (type === 'react') {
      const m = c && c.messages.find((x) => x.id === d.id);
      if (m) {
        m.reactions = d.reactions;
        if (chatOpen === d.channel) renderChatMessages();
      }
    } else if (type === 'del') {
      const m = c && c.messages.find((x) => x.id === d.id);
      if (m) {
        m.deleted = true;
        delete m.text;
        delete m.gif;
        delete m.image;
        delete m.reply;
        delete m.mentions;
        if (chatOpen === d.channel) renderChatMessages();
      }
      scheduleRefresh();
    }
  }

  // ---------- Chat : liste des discussions ----------

  function lastLine(t) {
    if (t.locked) return `<span class="locked-line">${icon('lock')}${T('Vote pour voir les messages', 'Vote to see the messages', 'Vota para ver los mensajes')}</span>`;
    const m = t.last[0];
    if (!m) return `<i>${T('Aucun message : lance la discussion !', 'No messages yet: get it going!', 'Aún no hay mensajes: ¡rompe el hielo!')}</i>`;
    const who = m.playerId === state.me.playerId ? T('Toi', 'You', 'Tú') : esc(player(m.playerId).name);
    return `${who} : ${msgSnippet(m)}`;
  }

  function renderChatList(view) {
    const [general, ...others] = state.chat.threads;
    const row = (t, title, ico) => `
      <button class="thread ${t.unread ? 'unread' : ''}" data-thread="${t.channel}">
        <span class="thread-icon">${ico}</span>
        <span class="thread-main"><span class="thread-title">${title}</span><span class="thread-last">${lastLine(t)}</span></span>
        <span class="thread-side">
          ${t.last[0] ? `<span class="small muted">${ago(t.last[0].at)}</span>` : ''}
          ${t.unread ? `<span class="thread-badge">${t.unread}</span>` : ''}
        </span>
      </button>`;
    // Le chat du groupe en grand : les 4 derniers messages, un clic pour l'ouvrir.
    const mini = general.last.map((m) => {
      const mine = m.playerId === state.me.playerId;
      const u = player(m.playerId);
      const text = m.deleted ? `<i>${T('message supprimé', 'message deleted', 'mensaje borrado')}</i>` : m.kind === 'text' && !isBlocked(m.playerId) ? mentionHtml(m) : msgSnippet(m);
      return `
        <div class="mini-msg ${mine ? 'mine' : ''}">
          ${mine ? '' : avatar(u, 'xs')}
          <div class="mini-body">${mine ? '' : `<span class="mini-name pname" style="--pc:${esc(u.color)}">${esc(u.name)}</span>`}<span class="mini-bubble">${text}</span></div>
        </div>`;
    }).join('');

    view.innerHTML = `
      <button class="card group-chat" data-thread="general">
        <div class="gc-head">
          <span class="gc-title">👥 ${T('Chat du groupe', 'Group chat', 'Chat del grupo')}</span>
          ${general.unread ? `<span class="thread-badge">${general.unread}</span>` : general.last.length ? `<span class="small muted">${ago(general.last[general.last.length - 1].at)}</span>` : ''}
        </div>
        <div class="gc-msgs">${mini || `<p class="muted small" style="margin:8px 0">${T('Aucun message pour l’instant. Dis bonjour !', 'No messages yet. Say hi!', 'Aún no hay mensajes. ¡Saluda!')}</p>`}</div>
        <div class="gc-input">${T('Écrire un message…', 'Write a message…', 'Escribe un mensaje…')}</div>
      </button>
      <div class="section-title">${T('Discussions des questions en cours', 'Chats on live questions', 'Chats de las preguntas en curso')}</div>
      ${others.length
        ? `<div class="card threads">${others.map((t) => row(t, esc(qText(t)), esc(setOf(t.setId).emoji))).join('')}</div>`
        : `<div class="card empty" style="padding:18px">${T('Les discussions des questions en cours apparaîtront ici.<br>Une fois la question terminée, sa discussion reste dans les Archives.', 'Chats on the live questions show up here.<br>Once a question is over, its chat stays in the Archive.', 'Aquí aparecerán los chats de las preguntas en curso.<br>Cuando termina una pregunta, su chat se queda en el Archivo.')}</div>`}`;
    view.querySelectorAll('[data-thread]').forEach((b) => (b.onclick = () => openChat(b.dataset.thread)));
  }

  // ---------- Chat : fenêtre de discussion ----------

  const $chat = document.getElementById('chatOverlay');
  let gifTimer = null;
  let lastTypingSent = 0;
  let readTimer = null;
  let replyTo = null; // message auquel on répond (glissé vers la droite)
  let pendingImages = []; // photos en cours d'envoi : { tmp, url, w, h }
  // Collé en bas de la discussion ? Suivi en continu (pas seulement au moment de redessiner) : une photo qui finit
  // de charger pendant qu'on remonte ne doit pas nous ramener en bas.
  let stickBottom = true;

  const tz = () => myTz;
  const dayKey = (t) => new Date(t).toLocaleDateString('fr-FR', { timeZone: tz() });
  const hhmm = (t) => new Date(t).toLocaleTimeString(LOC, { hour: '2-digit', minute: '2-digit', timeZone: tz() });
  function dayLabel(t) {
    if (dayKey(t) === dayKey(now())) return T('Aujourd’hui', 'Today', 'Hoy');
    if (dayKey(t) === dayKey(now() - 86400000)) return T('Hier', 'Yesterday', 'Ayer');
    return new Date(t).toLocaleDateString(LOC, { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz() });
  }

  function findPoll(id) {
    return [...state.live, ...state.archive, ...((archiveExtra && archiveExtra.items) || [])].find((p) => p.id === id);
  }

  // Discussion ouverte : gardée un moment pour la rouvrir après une actualisation.
  function lastChat() {
    try {
      const c = JSON.parse(load('chat') || 'null');
      return c && c.group === groupId && Date.now() - c.at < 30 * 60 * 1000 ? c.channel : null;
    } catch { return null; }
  }

  function openChat(channel) {
    if (chatOpen) closeChat(true);
    chatOpen = channel;
    save('chat', JSON.stringify({ group: groupId, channel, at: Date.now() }));
    selMsg = null;
    replyTo = null;
    pendingImages = [];
    const gifLabel = state.chat.gifs === 'tenor' ? T('Rechercher sur Tenor', 'Search Tenor', 'Buscar en Tenor') : T('Rechercher un GIF…', 'Search for a GIF…', 'Buscar un GIF…');
    $chat.innerHTML = `
      <div class="chat-head">
        <button class="chat-back" id="chatBack" aria-label="${T('Retour', 'Back', 'Volver')}">${icon('back')}</button>
        <div class="chat-title" id="chatTitle"></div>
      </div>
      <div class="chat-list" id="chatList"><div class="chat-empty">${T('Chargement…', 'Loading…', 'Cargando…')}</div></div>
      <div class="chat-typing" id="chatTyping"></div>
      <div class="gif-panel" id="gifPanel" hidden>
        <input class="input" id="gifSearch" placeholder="${gifLabel}" autocomplete="off" enterkeyhint="search">
        <div class="gif-grid" id="gifGrid"></div>
        ${state.chat.gifs === 'giphy' ? '<div class="gif-credit">Powered by GIPHY</div>' : ''}
      </div>
      <div class="mention-box" id="mentionBox" hidden></div>
      <div class="reply-bar" id="replyBar" hidden></div>
      <form class="chat-input" id="chatForm">
        <button type="button" class="att-btn" id="photoSend" aria-label="${T('Envoyer une photo', 'Send a photo', 'Enviar una foto')}">${icon('image')}</button>
        <button type="button" class="gif-btn" id="gifBtn">GIF</button>
        <textarea id="chatText" rows="1" maxlength="1000" placeholder="${T('Message…', 'Message…', 'Mensaje…')}" enterkeyhint="send"></textarea>
        <button type="submit" class="send-btn" aria-label="${T('Envoyer', 'Send', 'Enviar')}">${icon('send')}</button>
      </form>`;
    $chat.hidden = false;
    document.body.classList.add('noscroll');
    stickBottom = true;
    kbWasOpen = false;
    const listEl = document.getElementById('chatList');
    listEl.addEventListener('scroll', () => {
      stickBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 80;
    }, { passive: true });
    syncGuard();
    renderChatHeader();
    fitChat();

    document.getElementById('chatBack').onclick = () => closeChat();
    const text = document.getElementById('chatText');
    const form = document.getElementById('chatForm');
    const grow = () => {
      text.style.height = 'auto';
      text.style.height = Math.min(text.scrollHeight, 120) + 'px';
    };
    text.oninput = () => {
      grow();
      updateMentionBox();
      if (text.value.trim() && Date.now() - lastTypingSent > 2500) {
        lastTypingSent = Date.now();
        api('POST', `chat/${channel}/typing`).catch(() => {});
      }
    };
    text.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !window.matchMedia('(pointer: coarse)').matches) {
        e.preventDefault();
        const first = document.querySelector('#mentionBox:not([hidden]) [data-mention]');
        if (first) first.click();
        else form.requestSubmit();
      }
    };
    text.onclick = updateMentionBox;
    text.onfocus = () => {
      toggleGif(false);
      setTimeout(() => { fitChat(); scrollChatBottom(); }, 300);
    };
    text.onblur = () => setTimeout(fitChat, 300);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const value = text.value.trim();
      if (!value) return;
      const reply = replyTo;
      text.value = '';
      grow();
      hideMentionBox();
      setReply(null);
      lastTypingSent = 0;
      try {
        await sendChat({ text: value, replyTo: reply ? reply.id : undefined });
      } catch (err) {
        text.value = value;
        grow();
        setReply(reply);
        toast(err.message);
      }
    };
    document.getElementById('gifBtn').onclick = () => toggleGif();
    document.getElementById('photoSend').onclick = () => sendPhoto();
    document.getElementById('gifSearch').oninput = (e) => {
      clearTimeout(gifTimer);
      gifTimer = setTimeout(() => searchGifs(e.target.value), 400);
    };
    loadChat(channel);
    clearNotifs();
  }

  function closeChat(silent) {
    if (!chatOpen) return;
    chatOpen = null;
    save('chat', null);
    replyTo = null;
    $chat.hidden = true;
    $chat.innerHTML = '';
    $chat.classList.remove('kb-open');
    $chat.style.height = '';
    $chat.style.top = '';
    document.body.classList.remove('noscroll');
    if (state) {
      renderNav();
      renderView();
    }
  }

  // ---------- Retour (bouton retour Android, geste retour iPhone, flèches ← de l'app, touche Échap) ----------
  // Une entrée « garde » dans l'historique tant qu'on n'est pas sur l'écran d'accueil (Live, en cours) :
  // le retour ferme d'abord ce qui est par-dessus (photo en grand, fenêtre, chat), puis revient à l'onglet Live,
  // et seulement là il quitte l'app.
  let popIgnore = false;
  const atRoot = () => !state;

  // Chrome / Samsung Internet (Android) sautent, au retour, les entrées d'historique ajoutées avant que la
  // personne ait touché la page : app ouverte depuis une notification ou rechargée → « retour » fermait l'app.
  // On pose donc la garde seulement après un premier geste (tap, touche).
  let guardWaiting = false;
  function guardAfterGesture() {
    if (guardWaiting) return;
    guardWaiting = true;
    const evs = ['pointerup', 'touchend', 'click', 'keydown'];
    const go = () => {
      if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
      evs.forEach((t) => window.removeEventListener(t, go, true));
      guardWaiting = false;
      setTimeout(syncGuard, 0);
    };
    evs.forEach((t) => window.addEventListener(t, go, true));
  }

  function syncGuard() {
    if (!state) return;
    const guarded = !!(history.state && history.state.guard);
    if (!atRoot() && !guarded) {
      if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return guardAfterGesture();
      history.pushState({ guard: true }, '');
    } else if (atRoot() && guarded && !popIgnore) {
      popIgnore = true;
      history.back();
    }
  }

  // Ferme la couche du dessus. Renvoie false s'il n'y avait rien à fermer.
  function goBack() {
    if (!state) return false;
    // Dans l'ordre d'affichage : la photo en grand et les fenêtres passent au-dessus du chat.
    if (storyOpen()) closeStory();
    else if (viewerOpen()) closeViewer();
    else if (!$sheet.hidden) closeSheet();
    else if (chatOpen) closeChat(true);
    else if (halfPick) { halfPick = null; renderView(); }
    else if (openSet) { openSet = null; renderView(); }
    else if (openPolls.size || editing) { openPolls.clear(); editing = null; renderView(); }
    else if (tab === 'live' && liveMode === 'archive') { liveMode = 'live'; save('liveMode', liveMode); renderView(); window.scrollTo({ top: 0 }); }
    else if (tab !== 'live') go('live');
    else leaveGroup();
    return true;
  }

  window.addEventListener('popstate', () => {
    if (popIgnore) {
      popIgnore = false;
      syncGuard();
      return;
    }
    goBack();
    syncGuard();
  });

  // Clavier (ordinateur, clavier Bluetooth) : Échap, ou Retour arrière hors d'un champ de texte = retour.
  document.addEventListener('keydown', (e) => {
    if (!state || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target;
    const typing = el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
    if (e.key === 'Escape' || (e.key === 'Backspace' && !typing)) {
      if (e.key === 'Escape' && typing && el.id === 'chatText' && !document.getElementById('mentionBox')?.hidden) return hideMentionBox();
      if (atRoot()) return;
      e.preventDefault();
      if (history.state && history.state.guard) history.back(); // passe par popstate → même chemin que le bouton retour
      else { goBack(); syncGuard(); }
    }
  });

  // iPhone, app installée : pas de geste retour du système. On le refait : glisser depuis le bord gauche.
  if ((isIOS && isStandalone()) || PLATFORM === 'ios') {
    let edge = null;
    document.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      edge = e.touches.length === 1 && t.clientX < 22 && !atRoot() ? { x: t.clientX, y: t.clientY } : null;
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      if (!edge) return;
      const t = e.touches[0];
      const dx = t.clientX - edge.x;
      const dy = Math.abs(t.clientY - edge.y);
      if (dy > 40 && dy > dx) edge = null;
      else if (dx > 70) {
        edge = null;
        if (history.state && history.state.guard) history.back();
        else { goBack(); syncGuard(); }
      }
    }, { passive: true });
  }

  // Sur mobile, le clavier réduit la zone visible : la fenêtre de chat suit exactement le haut du clavier.
  // Clavier ouvert : plus de marge « barre d'accueil » en bas (sinon un trou entre la barre de saisie et le clavier),
  // et un fond sous la fenêtre (CSS) pour ne pas voir l'app derrière un clavier transparent ou plus petit.
  let kbWasOpen = false;
  function fitChat() {
    if (!chatOpen) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const h = vv.height + 'px';
    const top = vv.offsetTop + 'px';
    if ($chat.style.height !== h) $chat.style.height = h;
    if ($chat.style.top !== top) $chat.style.top = top;
    const kb = window.innerHeight - vv.height > 120;
    $chat.classList.toggle('kb-open', kb);
    if (kb && !kbWasOpen && stickBottom && document.activeElement && document.activeElement.id === 'chatText') scrollChatBottom();
    kbWasOpen = kb;
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', fitChat);
    window.visualViewport.addEventListener('scroll', fitChat);
  }

  function renderChatHeader() {
    const el = document.getElementById('chatTitle');
    if (!el) return;
    if (chatOpen === 'general') {
      el.innerHTML = `<b>${T('Chat du groupe', 'Group chat', 'Chat del grupo')}</b><span>${esc(state.group.name)} · ${plural(state.players.filter((p) => p.claimed).length, T('membre', 'member', 'miembro'))}</span>`;
      return;
    }
    const c = chats.get(chatOpen);
    const p = findPoll(chatOpen) || (c && c.poll);
    const t = state.chat.threads.find((x) => x.channel === chatOpen);
    const s = setOf((p || t || {}).setId);
    const ended = p && (p.ended || p.endsAt <= now());
    const status = p ? (ended ? T('terminé', 'over', 'terminada') : T('encore ', '', 'quedan ') + left(p.endsAt) + T('', ' left', '')) : '';
    el.innerHTML = `<b class="clamp2">${esc(qText(p || t) || T('Discussion', 'Chat', 'Chat'))}</b><span>${esc(s.emoji)} ${esc(setName(s))}${status ? ' · ' + status : ''}</span>`;
  }

  // Ce qu'on a en mémoire s'affiche tout de suite, puis on recharge toujours depuis le serveur : en arrière-plan
  // (téléphone en veille, connexion coupée), des messages ont pu arriver sans qu'on les reçoive.
  async function loadChat(channel, force) {
    const c = chats.get(channel);
    const cached = !!(c && c.loaded);
    if (cached && !force) {
      renderChatMessages(true);
      markReadSoon();
    }
    try {
      const r = await api('GET', `chat/${channel}`);
      const prev = chats.get(channel);
      // Garde les messages plus anciens déjà chargés (« Messages précédents »).
      const older = prev && prev.loaded && !r.locked && r.messages.length ? prev.messages.filter((m) => m.id < r.messages[0].id) : [];
      const next = { messages: older.concat(r.messages), reads: r.reads, hasMore: older.length ? prev.hasMore : r.hasMore, loaded: true, locked: !!r.locked, count: r.count || 0, poll: r.poll || null };
      const same = prev && prev.loaded && JSON.stringify([prev.messages, prev.reads, prev.locked]) === JSON.stringify([next.messages, next.reads, next.locked]);
      chats.set(channel, next);
      if (chatOpen === channel) {
        renderChatHeader();
        if (!same) renderChatMessages(!cached);
        markReadSoon();
      }
    } catch (e) {
      if (!cached) toast(e.message);
    }
  }

  function scrollChatBottom() {
    const list = document.getElementById('chatList');
    if (list) list.scrollTop = list.scrollHeight;
    stickBottom = true;
  }

  // ---------- Chat : réactions, « vu par », détail d'un message ----------

  const REACTIONS = ['❤️', '😂', '😮', '😢', '🔥', '👍'];
  const LIKE = '❤️';
  let selMsg = null; // message touché : on affiche les réactions, et « Répondre » / « Supprimer »

  function reactionGroups(m) {
    const by = new Map();
    for (const [pid, e] of Object.entries(m.reactions || {})) {
      if (!by.has(e)) by.set(e, []);
      by.get(e).push(pid);
    }
    return [...by].map(([emoji, players]) => ({ emoji, players })).sort((a, b) => b.players.length - a.players.length);
  }

  // Qui a vu un message : les membres (sauf l'auteur et moi) qui ont lu jusqu'à ce message.
  function seenBy(c, m) {
    const others = state.players.filter((p) => p.claimed && p.id !== m.playerId && p.id !== state.me.playerId);
    const saw = (p) => (c.reads[p.id] || 0) >= m.id || !!(m.reactions || {})[p.id]; // réagir = avoir vu
    return { seen: others.filter(saw), unseen: others.filter((p) => !saw(p)) };
  }

  function namesList(list, max = 3) {
    const names = list.map((p) => esc(p.name));
    const and = T(' et ', ' and ', ' y ');
    return names.length <= max ? names.join(', ').replace(/, ([^,]*)$/, `${and}$1`) : `${names.slice(0, max).join(', ')}${and}${names.length - max} ${T('autres', 'others', 'más')}`;
  }

  // Texte d'un message avec les « @Prénom » tagués surlignés (dans la couleur de la personne).
  function mentionHtml(m) {
    let html = esc(m.text);
    const ids = m.mentions || [];
    if (!ids.length) return html;
    const people = ids.map(player).filter((p) => p.name !== '???').sort((a, b) => b.name.length - a.name.length);
    const marks = [];
    for (const p of people) {
      const needle = esc('@' + p.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      html = html.replace(new RegExp(needle + '(?![\\p{L}\\p{N}_])', 'giu'), (hit) => {
        marks.push(`<span class="mention ${p.id === state.me.playerId ? 'me' : ''}" style="--pc:${esc(p.color)}">${hit}</span>`);
        return `\u0000${marks.length - 1}\u0000`;
      });
    }
    return html.replace(/\u0000(\d+)\u0000/g, (_, i) => marks[Number(i)]);
  }

  function msgDetail(c, m) {
    const mine = m.playerId === state.me.playerId;
    const reacts = reactionGroups(m);
    return `
      <div class="msg-detail ${mine ? 'mine' : ''}">
        <div class="md-reacts">${reacts.length
          ? reacts.map((r) => `<span class="md-react"><span class="md-emoji">${r.emoji}</span><span class="md-names">${r.players.map((pid) => `<b class="pname" style="--pc:${esc(player(pid).color)}">${esc(pid === state.me.playerId ? T('Toi', 'You', 'Tú') : player(pid).name)}</b>`).join(', ')}</span></span>`).join('')
          : `<span class="muted">${T('Double tape pour ❤️ · reste appuyé pour réagir · glisse à droite pour répondre', 'Double tap to ❤️ · hold to react · swipe right to reply', 'Doble toque para ❤️ · mantén pulsado para reaccionar · desliza a la derecha para responder')}</span>`}</div>
        <div class="md-foot">
          <span class="muted">${hhmm(m.at)}</span>
          <span class="md-actions">
            <button class="md-reply" data-replymsg="${m.id}">${icon('reply')}${T('Répondre', 'Reply', 'Responder')}</button>
            ${mine || state.me.isAdmin ? `<button class="md-del" data-delmsg="${m.id}">${icon('trash')}${T('Supprimer', 'Delete', 'Borrar')}</button>` : ''}
          </span>
        </div>
      </div>`;
  }

  async function reactTo(id, emoji) {
    const channel = chatOpen;
    try {
      const { message } = await api('POST', `chat/${channel}/messages/${id}/react`, { emoji });
      const m = chats.get(channel)?.messages.find((x) => x.id === id);
      if (m) m.reactions = message.reactions;
      if (chatOpen === channel) renderChatMessages();
    } catch (e) {
      toast(e.message);
    }
  }

  // Double tap = ❤️ (comme Insta : ça like, ça n'enlève jamais). Petit cœur qui saute sur le message.
  function likeMsg(id, el) {
    const m = chats.get(chatOpen)?.messages.find((x) => x.id === id);
    if (!m || m.deleted) return;
    if (el) {
      const heart = document.createElement('span');
      heart.className = 'heart-pop';
      heart.textContent = LIKE;
      el.appendChild(heart);
      setTimeout(() => heart.remove(), 800);
    }
    buzz(10);
    if ((m.reactions || {})[state.me.playerId] === LIKE) return;
    m.reactions = { ...(m.reactions || {}), [state.me.playerId]: LIKE }; // affiché tout de suite
    setTimeout(() => { if (chatOpen) renderChatMessages(); }, 450);
    reactTo(id, LIKE);
  }

  // Appui long sur un message : choisir une réaction (raccourcis, grande grille, ou n'importe quel emoji du clavier).
  const EMOJI_GRID = (
    '😀 😃 😄 😁 😆 🥹 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🫢 🤫 🤔 🫡 🤐 🤨 😐 😑 😶 🫥 😏 😒 🙄 😬 😮‍💨 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🥵 🥶 🥴 😵 🤯 🤠 🥳 🥸 😎 🤓 🧐 😕 🫤 😟 🙁 😮 😯 😲 😳 🥺 🥲 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 ☠️ 💩 🤡 👹 👻 👽 🤖 😺 🙈 🙉 🙊 ' +
    '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❤️‍🔥 💕 💞 💓 💗 💖 💘 💝 💯 💢 💥 💫 💦 💨 🔥 ✨ ⭐ 🌟 ⚡ 🎉 🎊 🏆 🥇 👑 💎 ' +
    '👍 👎 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 👏 🙌 🫶 👐 🤲 🤝 🙏 💪 🫵 👀 👅 👄 🫦 🧠 ' +
    '🍑 🍆 🌶️ 🍕 🍔 🍟 🌮 🍿 🍩 🍪 🎂 🍻 🍺 🍷 🥂 🍾 🥃 🍸 ☕ 🧃 🚬 💊 💸 💰 🚀 🚨 ⚠️ ❌ ✅ ❓ ❗ 💤 🐐 🐍 🦄 🐸 🐒 🦖 🐷 🐶 🐱 🦊 🐻 🐼 🦁 🐧 🦉 🐰 🐨'
  ).split(' ');
  const isEmoji = (s) => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(s);
  function firstEmoji(text) {
    const parts = typeof Intl !== 'undefined' && Intl.Segmenter
      ? [...new Intl.Segmenter('fr', { granularity: 'grapheme' }).segment(text)].map((x) => x.segment)
      : Array.from(text);
    return parts.find(isEmoji) || null;
  }

  function openReactPicker(m) {
    const mine = (m.reactions || {})[state.me.playerId];
    const preview = m.kind === 'text' ? esc(m.text.length > 90 ? m.text.slice(0, 89) + '…' : m.text) : msgSnippet(m);
    openSheet(`
      <div class="sheet-head"><h2>${T('Réagir', 'React', 'Reaccionar')}</h2><button class="x" data-close>✕</button></div>
      <p class="react-preview"><b class="pname" style="--pc:${esc(player(m.playerId).color)}">${esc(player(m.playerId).name)}</b> ${preview}</p>
      <div class="react-quick">${REACTIONS.map((e) => `<button data-pick="${e}" class="${mine === e ? 'on' : ''}">${e}</button>`).join('')}</div>
      <div class="react-type">
        <input class="input" id="emojiInput" placeholder="${T('Ou tape n’importe quel emoji…', 'Or type any emoji…', 'O escribe cualquier emoji…')}" autocomplete="off" enterkeyhint="done">
      </div>
      <div class="emoji-all">${EMOJI_GRID.map((e) => `<button data-pick="${e}" class="${mine === e ? 'on' : ''}">${e}</button>`).join('')}</div>
      <div class="react-actions">
        <button class="link-btn" id="pickReply">${icon('reply')} ${T('Répondre', 'Reply', 'Responder')}</button>
        ${m.playerId !== state.me.playerId ? `<button class="link-btn muted" id="pickReport">🚩 ${T('Signaler', 'Report', 'Denunciar')}</button>` : ''}
        ${mine ? `<button class="link-btn" data-pick="${esc(mine)}">${T('Retirer ma réaction', 'Remove my reaction', 'Quitar mi reacción')} ${mine}</button>` : ''}
      </div>`, (root) => {
      const pick = (e) => { closeSheet(); reactTo(m.id, e); };
      root.querySelectorAll('[data-pick]').forEach((b) => (b.onclick = () => pick(b.dataset.pick)));
      root.querySelector('#pickReply').onclick = () => { closeSheet(); setReply(m); };
      const rep = root.querySelector('#pickReport');
      if (rep) rep.onclick = () => openReportSheet({ message: m });
      const input = root.querySelector('#emojiInput');
      input.oninput = () => {
        const e = firstEmoji(input.value);
        if (e) pick(e);
      };
    });
  }

  // Sur une bulle : tap = détail (ou photo en grand) ; double tap = ❤️ ; appui long (~0,45 s) = réagir.
  function bindMessagePress(el, id) {
    let timer = null;
    let fired = false;
    let start = null;
    let lastTap = 0;
    let single = null;
    const cancel = () => { clearTimeout(timer); timer = null; };
    el.addEventListener('pointerdown', (e) => {
      fired = false;
      start = [e.clientX, e.clientY];
      cancel();
      timer = setTimeout(() => {
        fired = true;
        timer = null;
        buzz(12);
        swallowNextClick();
        const m = chats.get(chatOpen)?.messages.find((x) => x.id === id);
        if (m && !m.deleted) openReactPicker(m);
      }, 450);
    });
    el.addEventListener('pointermove', (e) => {
      if (timer && start && Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 10) cancel();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => el.addEventListener(t, cancel));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('click', (e) => {
      if (fired) { fired = false; return; } // l'appui long a déjà ouvert les réactions
      if (el.closest('.msg')?.dataset.swiped) return; // c'était un glissement pour répondre
      const t = Date.now();
      if (t - lastTap < 320) {
        lastTap = 0;
        clearTimeout(single);
        likeMsg(id, el);
        return;
      }
      lastTap = t;
      // On attend un peu pour être sûr que ce n'est pas un double tap.
      clearTimeout(single);
      single = setTimeout(() => {
        const m = chats.get(chatOpen)?.messages.find((x) => x.id === id);
        if (m && m.kind === 'image' && !e.target.closest('.reply-quote')) return openViewer(m);
        selMsg = selMsg === id ? null : id;
        renderChatMessages();
        if (selMsg) document.querySelector('.msg-detail')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 260);
    });
  }

  // Glisser un message vers la droite (comme WhatsApp) = y répondre.
  function bindSwipeReply(row, id) {
    let s = null;
    const bubble = row.querySelector('.msg-body');
    const hint = row.querySelector('.swipe-hint');
    const reset = () => {
      if (bubble) { bubble.style.transition = 'transform 0.2s'; bubble.style.transform = ''; }
      if (hint) { hint.style.opacity = '0'; hint.style.transform = ''; }
    };
    row.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // Bord gauche réservé au geste retour (iPhone).
      if (e.clientX < 24) return;
      s = { x: e.clientX, y: e.clientY, id: e.pointerId, dir: null, dx: 0 };
      delete row.dataset.swiped;
    });
    row.addEventListener('pointermove', (e) => {
      if (!s || e.pointerId !== s.id) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (!s.dir) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { s = null; return; }
        if (dx > 12 && dx > Math.abs(dy) * 1.4) {
          s.dir = 'x';
          try { row.setPointerCapture(e.pointerId); } catch { /* tant pis */ }
        } else return;
      }
      s.dx = Math.max(0, dx);
      const move = s.dx < 70 ? s.dx : 70 + (s.dx - 70) * 0.25;
      if (bubble) { bubble.style.transition = 'none'; bubble.style.transform = `translateX(${move}px)`; }
      if (hint) {
        hint.style.opacity = String(Math.min(1, s.dx / 60));
        hint.style.transform = `scale(${s.dx >= 60 ? 1.15 : 0.7 + Math.min(1, s.dx / 60) * 0.3})`;
      }
      if (s.dx >= 60 && !s.buzzed) { s.buzzed = true; buzz(8); }
    });
    const end = (e) => {
      if (!s || (e && e.pointerId !== s.id)) return;
      const done = s.dir === 'x' && s.dx >= 60;
      if (s.dir === 'x') {
        row.dataset.swiped = '1';
        setTimeout(() => delete row.dataset.swiped, 50);
      }
      s = null;
      reset();
      if (done) {
        const m = chats.get(chatOpen)?.messages.find((x) => x.id === id);
        if (m && !m.deleted) setReply(m);
      }
    };
    row.addEventListener('pointerup', end);
    row.addEventListener('pointercancel', end);
  }

  // Barre « Répondre à … » au-dessus de la saisie.
  function setReply(m) {
    replyTo = m && !m.deleted ? m : null;
    const bar = document.getElementById('replyBar');
    if (!bar) return;
    if (!replyTo) {
      bar.hidden = true;
      bar.innerHTML = '';
      return;
    }
    const u = player(replyTo.playerId);
    bar.hidden = false;
    bar.innerHTML = `
      <span class="rb-ico">${icon('reply')}</span>
      <span class="rb-body" style="--pc:${esc(u.color)}"><b class="pname">${T('Répondre à', 'Replying to', 'Respondiendo a')} ${esc(u.id === state.me.playerId ? T('toi', 'yourself', 'ti') : u.name)}</b><span>${msgSnippet(replyTo)}</span></span>
      <button type="button" class="x" id="replyCancel" aria-label="${T('Annuler', 'Cancel', 'Cancelar')}">✕</button>`;
    document.getElementById('replyCancel').onclick = () => setReply(null);
    const text = document.getElementById('chatText');
    if (text && !text.disabled) text.focus();
  }

  // Signaler un message ou une personne, et/ou la bloquer (exigé par les stores ; arrive chez le développeur
  // et les admins du groupe).
  function openReportSheet({ message, playerId }) {
    const pid = message ? message.playerId : playerId;
    const p = player(pid);
    const reasons = [['harass', T('Harcèlement ou insultes', 'Harassment or insults')], ['private', T('Infos ou photos privées', 'Private info or photos')], ['sexual', T('Contenu sexuel non voulu', 'Unwanted sexual content')], ['other', T('Autre', 'Other')]];
    let reason = 'harass';
    const draw = () => openSheet(`
      <div class="sheet-head"><h2>🚩 ${message ? T('Signaler ce message', 'Report this message') : T(`Signaler ${esc(p.name)}`, `Report ${esc(p.name)}`)}</h2><button class="x" data-close>✕</button></div>
      ${message ? `<p class="react-preview"><b class="pname" style="--pc:${esc(p.color)}">${esc(p.name)}</b> ${message.kind === 'text' ? esc(message.text) : msgSnippet(message)}</p>` : ''}
      <div class="fb-kinds">${reasons.map(([k, l]) => `<button class="chip ${reason === k ? 'on' : ''}" data-reason="${k}">${l}</button>`).join('')}</div>
      <textarea class="input" id="repText" maxlength="500" placeholder="${T('Précisions (facultatif)', 'Details (optional)')}"></textarea>
      <label class="switch-row"><span>${T(`Bloquer ${esc(p.name)}`, `Block ${esc(p.name)}`)}<small class="muted">${T('Tu ne verras plus ses messages et tu n’auras plus ses notifs.', 'You won’t see their messages or get notified about them.')}</small></span><input type="checkbox" class="switch" id="repBlock" ${isBlocked(pid) ? 'checked' : ''}></label>
      <button class="btn btn-main btn-block" id="repGo">${T('Envoyer le signalement', 'Send report')}</button>
      <p class="muted small" style="margin:8px 0 0">${T('Les admins du groupe et l’équipe de l’app sont prévenus. On traite chaque signalement sous 24 h.', 'The group admins and the app team are notified. Every report is handled within 24 hours.')}</p>`, (root) => {
      root.querySelectorAll('[data-reason]').forEach((b) => (b.onclick = () => { const t = root.querySelector('#repText').value; reason = b.dataset.reason; draw(); root.querySelector('#repText').value = t; }));
      action(root.querySelector('#repGo'), async () => {
        const label = reasons.find(([k]) => k === reason)[1];
        const extra = root.querySelector('#repText').value.trim();
        await api('POST', 'report', message ? { channel: chatOpen, seq: message.id, reason: label + (extra ? ' : ' + extra : '') } : { playerId: pid, reason: label + (extra ? ' : ' + extra : '') });
        const block = root.querySelector('#repBlock').checked;
        if (block !== isBlocked(pid)) await setBlocked(pid, block);
        closeSheet();
        toast(T('Merci, c’est signalé 🙏', 'Thanks, it’s reported 🙏'));
      });
    });
    draw();
  }

  async function setBlocked(pid, block) {
    const r = await api('POST', 'block', { playerId: pid, block });
    state.me.blocked = r.blocked;
    if (chatOpen) renderChatMessages();
    renderView();
  }

  // ---------- Tags « @Prénom » : suggestions pendant qu'on écrit ----------

  function mentionQuery() {
    const text = document.getElementById('chatText');
    if (!text) return null;
    const before = text.value.slice(0, text.selectionStart ?? text.value.length);
    const m = /(^|\s)@([^@\n]{0,24})$/.exec(before);
    if (!m) return null;
    return { q: m[2], start: before.length - m[2].length - 1 };
  }

  function hideMentionBox() {
    const box = document.getElementById('mentionBox');
    if (box) { box.hidden = true; box.innerHTML = ''; }
  }

  function updateMentionBox() {
    const box = document.getElementById('mentionBox');
    const mq = mentionQuery();
    if (!box || !mq) return hideMentionBox();
    const q = mq.q.toLowerCase();
    const list = state.players
      .filter((p) => p.claimed && p.id !== state.me.playerId && p.name.toLowerCase().startsWith(q))
      .slice(0, 6);
    // Nom déjà complet suivi d'un espace : on ferme.
    if (!list.length || (q.endsWith(' ') && list.every((p) => p.name.length < q.length))) return hideMentionBox();
    box.hidden = false;
    box.innerHTML = list.map((p) => `<button type="button" data-mention="${p.id}" style="--pc:${esc(p.color)}">${avatar(p, 'xs')}<b class="pname">${esc(p.name)}</b></button>`).join('');
    box.querySelectorAll('[data-mention]').forEach((b) => {
      b.onpointerdown = (e) => e.preventDefault(); // garde le clavier ouvert
      b.onclick = () => {
        const text = document.getElementById('chatText');
        const cur = mentionQuery();
        if (!text || !cur) return hideMentionBox();
        const p = player(b.dataset.mention);
        const end = text.selectionStart ?? text.value.length;
        const insert = `@${p.name} `;
        text.value = text.value.slice(0, cur.start) + insert + text.value.slice(end);
        const pos = cur.start + insert.length;
        text.focus();
        text.setSelectionRange(pos, pos);
        text.dispatchEvent(new Event('input'));
        hideMentionBox();
      };
    });
  }

  // ---------- Photos dans le chat ----------

  // Photo choisie → réduite (1280 px max, JPEG) avant l'envoi : rapide et léger pour la base.
  function shrinkImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const tryAt = (max, q) => {
          const r = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
          const w = Math.max(1, Math.round(img.naturalWidth * r));
          const h = Math.max(1, Math.round(img.naturalHeight * r));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          return { data: canvas.toDataURL('image/jpeg', q), w, h };
        };
        let out = tryAt(1280, 0.8);
        if (out.data.length > 1100000) out = tryAt(1024, 0.7);
        if (out.data.length > 1100000) out = tryAt(800, 0.6);
        URL.revokeObjectURL(url);
        resolve({ ...out, preview: out.data });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(T('Image illisible', 'Can’t read that image', 'No se puede leer la imagen')));
      };
      img.src = url;
    });
  }

  function sendPhoto() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file || !chatOpen) return;
      const channel = chatOpen;
      const reply = replyTo;
      let tmp = null;
      try {
        const img = await shrinkImage(file);
        tmp = { tmp: Date.now(), url: img.preview, w: img.w, h: img.h };
        pendingImages.push(tmp);
        setReply(null);
        renderChatMessages(true);
        await sendChat({ image: { data: img.data, w: img.w, h: img.h }, replyTo: reply ? reply.id : undefined }, channel);
      } catch (e) {
        toast(e.message);
      }
      pendingImages = pendingImages.filter((x) => x !== tmp);
      if (chatOpen === channel) renderChatMessages(true);
    };
    input.click();
  }

  // Photo en grand (tap pour fermer, ou retour).
  const viewerOpen = () => !!document.getElementById('viewer');
  function openViewer(m) {
    closeViewer();
    const u = player(m.playerId);
    const v = document.createElement('div');
    v.id = 'viewer';
    v.className = 'viewer';
    v.innerHTML = `
      <div class="viewer-top"><span>${avatar(u, 'xs')} ${esc(u.name)} · ${hhmm(m.at)}</span><button class="x" aria-label="${T('Fermer', 'Close', 'Cerrar')}">✕</button></div>
      <img src="${API}/api/images/${esc(m.image.id)}" alt="">`;
    v.onclick = () => (history.state && history.state.guard ? history.back() : closeViewer());
    document.body.appendChild(v);
    syncGuard();
  }
  function closeViewer() {
    const v = document.getElementById('viewer');
    if (v) v.remove();
  }

  // Citation du message auquel on répond (au-dessus de la bulle). Un tap amène au message d'origine.
  function replyQuote(r) {
    if (!r) return '';
    const u = player(r.playerId);
    const what = r.deleted ? `<i>${T('message supprimé', 'message deleted', 'mensaje borrado')}</i>` : r.kind === 'gif' ? 'GIF' : r.kind === 'image' ? `📷 ${T('Photo', 'Photo', 'Foto')}` : esc(r.text);
    return `<span class="reply-quote" data-jump="${r.id}" style="--pc:${esc(u.color)}"><b class="pname">${esc(u.id === state.me.playerId ? T('Toi', 'You', 'Tú') : u.name)}</b><span>${what}</span></span>`;
  }

  function renderChatMessages(forceBottom) {
    const list = document.getElementById('chatList');
    const c = chats.get(chatOpen);
    if (!list || !c) return;
    const atBottom = forceBottom || stickBottom;
    const myPid = state.me.playerId;
    lockChatInput(!!c.locked);
    if (c.locked) {
      list.innerHTML = `
        <div class="chat-locked">
          <span class="cl-ico">${icon('lock')}</span>
          <b>${T('Vote d’abord', 'Vote first', 'Vota primero')}</b>
          <p class="muted">${c.count ? T(`${plural(c.count, 'message')} t’attend${c.count > 1 ? 'ent' : ''} ici. `, `${plural(c.count, 'message')} waiting here. `, `Hay ${plural(c.count, 'mensaje')} esperándote aquí. `) : ''}${T('Pour que personne ne soit influencé, la discussion s’ouvre une fois que tu as voté.', 'So nobody gets influenced, the chat opens once you’ve voted.', 'Para no condicionar a nadie, el chat se abre cuando votes.')}</p>
          <button class="btn btn-main" id="goVote">${T('Aller voter', 'Go vote', 'Ir a votar')}</button>
        </div>`;
      document.getElementById('goVote').onclick = () => {
        const id = chatOpen;
        closeChat();
        if (tab !== 'live' || liveMode !== 'live') { tab = 'live'; liveMode = 'live'; save('tab', tab); save('liveMode', liveMode); renderNav(); renderView(); }
        setTimeout(() => document.querySelector(`[data-poll="${id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
      };
      return;
    }
    if (selMsg && !c.messages.some((m) => m.id === selMsg && !m.deleted)) selMsg = null;

    let html = c.hasMore ? `<button class="chat-older" id="chatOlder">${T('Messages précédents', 'Older messages', 'Mensajes anteriores')}</button>` : '';
    if (!c.messages.length && !pendingImages.length) {
      html += `<div class="chat-empty">${chatOpen === 'general' ? T('Aucun message pour l’instant. Dis bonjour !', 'No messages yet. Say hi!', 'Aún no hay mensajes. ¡Saluda!') : T('Personne n’a encore commenté. Lance le débat !', 'Nobody commented yet. Start the debate!', 'Nadie ha comentado todavía. ¡Abre el debate!')}</div>`;
    }
    c.messages.forEach((m, i) => {
      const prev = c.messages[i - 1];
      const next = c.messages[i + 1];
      const mine = m.playerId === myPid;
      const u = player(m.playerId);
      const newDay = !prev || dayKey(prev.at) !== dayKey(m.at);
      if (newDay) html += `<div class="chat-day">${dayLabel(m.at)}</div>`;
      const first = newDay || prev.playerId !== m.playerId || m.at - prev.at > 5 * 60000 || !!m.reply;
      const last = !next || next.playerId !== m.playerId || next.at - m.at > 5 * 60000 || dayKey(next.at) !== dayKey(m.at) || !!next.reply;
      const hidden = !m.deleted && isBlocked(m.playerId);
      const media = !m.deleted && !hidden && (m.kind === 'gif' || m.kind === 'image');
      const content = m.deleted
        ? `<i>${T('Message supprimé', 'Message deleted', 'Mensaje borrado')}</i>`
        : hidden
          ? `<i>${T('Message masqué (personne bloquée)', 'Hidden message (blocked person)', 'Mensaje oculto (persona bloqueada)')}</i>`
        : m.kind === 'gif'
          ? `<img src="${esc(m.gif.url)}" width="${m.gif.w}" height="${m.gif.h}" alt="GIF" loading="lazy">`
          : m.kind === 'image'
            ? `<img src="${API}/api/images/${esc(m.image.id)}" width="${m.image.w}" height="${m.image.h}" alt="${T('Photo', 'Photo', 'Foto')}" loading="lazy" decoding="async">`
            : mentionHtml(m);
      const reacts = reactionGroups(m);
      const sel = selMsg === m.id;
      const tagged = !mine && (m.mentions || []).includes(myPid);
      html += `
        <div class="msg ${mine ? 'mine' : ''} ${first ? 'first' : ''} ${last ? 'last' : ''} ${sel ? 'sel' : ''} ${m.reply ? 'has-reply' : ''}" data-row="${m.id}" id="msg-${m.id}">
          ${m.deleted ? '' : `<span class="swipe-hint">${icon('reply')}</span>`}
          ${mine ? '' : last ? avatar(u, 'sm') : '<span class="avatar-space"></span>'}
          <div class="msg-body">
            ${!mine && first ? `<div class="msg-name pname" style="--pc:${esc(u.color)}">${esc(u.name)}</div>` : ''}
            ${m.deleted ? '' : replyQuote(m.reply)}
            <div class="bubble ${media ? m.kind === 'gif' ? 'gif' : 'gif photo' : ''} ${m.deleted ? 'deleted' : ''} ${tagged ? 'tagged' : ''}" ${m.deleted ? '' : `data-msg="${m.id}"`}>${content}</div>
            ${reacts.length ? `<button class="reacts" data-msg="${m.id}">${reacts.map((r) => `<span class="${r.players.includes(myPid) ? 'me' : ''}">${r.emoji}${r.players.length > 1 ? `<i>${r.players.length}</i>` : ''}</span>`).join('')}</button>` : ''}
            ${last && !sel ? `<div class="msg-time">${hhmm(m.at)}</div>` : ''}
          </div>
        </div>
        ${sel ? msgDetail(c, m) : ''}`;
    });
    // Photos en cours d'envoi.
    for (const p of pendingImages) {
      html += `
        <div class="msg mine first last pending">
          <div class="msg-body"><div class="bubble gif photo"><img src="${p.url}" width="${p.w}" height="${p.h}" alt=""><span class="spinner"></span></div></div>
        </div>`;
    }
    html += seenLine(c);
    list.innerHTML = html;

    list.querySelectorAll('img').forEach((img) => (img.onload = () => { if (stickBottom) scrollChatBottom(); }));
    list.querySelectorAll('[data-msg]').forEach((b) => bindMessagePress(b, Number(b.dataset.msg)));
    list.querySelectorAll('[data-row]').forEach((r) => { if (r.querySelector('.swipe-hint')) bindSwipeReply(r, Number(r.dataset.row)); });
    list.querySelectorAll('[data-jump]').forEach((q) => (q.onclick = (e) => {
      e.stopPropagation();
      const el = document.getElementById('msg-' + q.dataset.jump);
      if (!el) return toast(T('Message trop ancien : remonte la discussion', 'Message is too old: scroll up the chat', 'Mensaje muy antiguo: sube más arriba en el chat'));
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.add('flash-msg');
      setTimeout(() => el.classList.remove('flash-msg'), 1400);
    }));
    list.querySelectorAll('[data-replymsg]').forEach((b) => (b.onclick = () => {
      const m = c.messages.find((x) => x.id === Number(b.dataset.replymsg));
      selMsg = null;
      renderChatMessages();
      setReply(m);
    }));
    list.querySelectorAll('[data-delmsg]').forEach((b) => {
      b.onclick = async () => {
        if (!confirm(T('Supprimer ce message pour tout le monde ?', 'Delete this message for everyone?', '¿Borrar este mensaje para todos?'))) return;
        try {
          await api('DELETE', `chat/${chatOpen}/messages/${b.dataset.delmsg}`);
          selMsg = null;
        } catch (e) { toast(e.message); }
      };
    });
    const older = document.getElementById('chatOlder');
    if (older) {
      action(older, async () => {
        const channel = chatOpen;
        const r = await api('GET', `chat/${channel}?before=${c.messages[0].id}`);
        c.messages = r.messages.concat(c.messages);
        c.hasMore = r.hasMore;
        const prevHeight = list.scrollHeight;
        renderChatMessages();
        list.scrollTop = list.scrollHeight - prevHeight;
      });
    }
    if (atBottom) scrollChatBottom();
  }

  // Accusé de lecture, en clair, sous le dernier message seulement (le détail : en touchant un message).
  function seenLine(c) {
    const lastMsg = c.messages[c.messages.length - 1];
    if (!lastMsg || selMsg === lastMsg.id || pendingImages.length) return '';
    const { seen, unseen } = seenBy(c, lastMsg);
    const mineLast = lastMsg.playerId === state.me.playerId;
    let label = '';
    if (seen.length && !unseen.length) label = T('Vu par tout le monde', 'Seen by everyone', 'Visto por todos');
    else if (seen.length) label = `${T('Vu par', 'Seen by', 'Visto por')} ${namesList(seen)}`;
    else if (mineLast) label = T('Envoyé', 'Sent', 'Enviado');
    return label ? `<div class="seen-line ${mineLast ? 'mine' : ''}">${icon('check')}<span>${label}</span></div>` : '';
  }
  function updateSeenLine() {
    const list = document.getElementById('chatList');
    const c = chats.get(chatOpen);
    if (!list || !c || c.locked) return;
    const old = list.querySelector('.seen-line');
    const tmp = document.createElement('div');
    tmp.innerHTML = seenLine(c);
    const fresh = tmp.firstElementChild;
    if (old && fresh) old.replaceWith(fresh);
    else if (old) old.remove();
    else if (fresh) list.appendChild(fresh);
    if (stickBottom) scrollChatBottom();
  }

  function lockChatInput(locked) {
    const form = document.getElementById('chatForm');
    if (!form) return;
    form.classList.toggle('locked', locked);
    form.querySelectorAll('textarea, button').forEach((el) => (el.disabled = locked));
    const t = document.getElementById('chatText');
    if (t) t.placeholder = locked ? T('Vote d’abord pour écrire…', 'Vote first to write…', 'Vota primero para escribir…') : T('Message…', 'Message…', 'Mensaje…');
  }

  function renderTyping() {
    const el = document.getElementById('chatTyping');
    if (!el) return;
    const t = typing.get(chatOpen);
    const who = t ? [...t].filter(([, exp]) => exp > Date.now()).map(([pid]) => player(pid).name) : [];
    el.innerHTML = who.length
      ? `<span class="dots"><i></i><i></i><i></i></span>${esc(who.length === 1
        ? T(`${who[0]} écrit…`, `${who[0]} is typing…`, `${who[0]} está escribiendo…`)
        : who.length === 2 ? T(`${who[0]} et ${who[1]} écrivent…`, `${who[0]} and ${who[1]} are typing…`, `${who[0]} y ${who[1]} están escribiendo…`) : T('Plusieurs personnes écrivent…', 'Several people are typing…', 'Varias personas están escribiendo…'))}`
      : '';
  }

  function markReadSoon() {
    clearTimeout(readTimer);
    readTimer = setTimeout(() => {
      const channel = chatOpen;
      const c = chats.get(channel);
      if (!c || document.hidden || !c.messages.length) return;
      const lastId = c.messages[c.messages.length - 1].id;
      if ((c.reads[state.me.playerId] || 0) >= lastId) return;
      c.reads[state.me.playerId] = lastId;
      api('POST', `chat/${channel}/read`, { seq: lastId }).then(scheduleRefresh).catch(() => {});
      clearNotifs();
    }, 300);
  }

  async function sendChat(body, channel = chatOpen) {
    const { message } = await api('POST', `chat/${channel}`, body);
    const c = chats.get(channel);
    if (c) {
      if (!c.messages.some((m) => m.id === message.id)) c.messages.push(message);
      c.reads[state.me.playerId] = message.id;
    }
    if (chatOpen === channel) renderChatMessages(true);
  }

  function toggleGif(force) {
    const panel = document.getElementById('gifPanel');
    const btn = document.getElementById('gifBtn');
    if (!panel) return;
    const open = force === undefined ? panel.hidden : force;
    panel.hidden = !open;
    btn.classList.toggle('on', open);
    if (!open) return;
    hideMentionBox();
    if (!state.chat.gifs) {
      document.getElementById('gifGrid').innerHTML = `<p class="muted small gif-msg">${T('Les GIFs ne sont pas encore activés sur le serveur (il manque une clé GIPHY).', 'GIFs aren’t turned on on the server yet (missing GIPHY key).', 'Los GIFs aún no están activados en el servidor (falta una clave de GIPHY).')}</p>`;
      return;
    }
    document.getElementById('chatText').blur();
    searchGifs(document.getElementById('gifSearch').value);
  }

  async function searchGifs(q) {
    const grid = document.getElementById('gifGrid');
    if (!grid) return;
    grid.innerHTML = `<p class="muted small gif-msg">${T('Chargement…', 'Loading…', 'Cargando…')}</p>`;
    try {
      const { results } = await api('GET', 'gifs?q=' + encodeURIComponent(q.trim()));
      if (!document.getElementById('gifGrid')) return;
      grid.innerHTML = results.length
        ? results.map((r, i) => `<button type="button" class="gif-item" data-gif="${i}"><img src="${esc(r.preview)}" alt="GIF" loading="lazy"></button>`).join('')
        : `<p class="muted small gif-msg">${T('Aucun GIF trouvé 🤷', 'No GIFs found 🤷', 'No sale ningún GIF 🤷')}</p>`;
      grid.querySelectorAll('[data-gif]').forEach((b) => {
        action(b, async () => {
          const r = results[Number(b.dataset.gif)];
          const reply = replyTo;
          setReply(null);
          await sendChat({ gif: { url: r.url, w: r.w, h: r.h }, replyTo: reply ? reply.id : undefined });
          toggleGif(false);
        });
      });
    } catch (e) {
      grid.innerHTML = `<p class="muted small gif-msg">${esc(e.message)}</p>`;
    }
  }

  // Clic sur une notification alors que l'app est déjà ouverte.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (!e.data || e.data.type !== 'open' || !token) return;
      const u = new URL(e.data.url, location.origin);
      const ch = u.searchParams.get('chat');
      const gid = u.searchParams.get('g');
      if (u.searchParams.get('recap')) pendingRecap = u.searchParams.get('recap');
      if (u.searchParams.has('news')) pendingNews = true;
      if (u.searchParams.has('feedback')) pendingFeedback = true;
      if (u.searchParams.has('quiz')) pendingQuiz = true;
      if ((pendingNews || pendingFeedback) && (!gid || gid === groupId)) return openPendingAbout();
      if (gid && gid !== groupId) {
        pendingChat = ch;
        enterGroup(gid);
      } else if (ch && state) openChat(ch);
      else if (pendingRecap && state) openRecapFromLink();
      else if (pendingQuiz && state) quizPrompt();
    });
  }

  // ---------- Notifications push ----------

  function b64ToBytes(b64) {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }

  // L'abonnement a-t-il été créé avec la clé actuelle du serveur ? (sinon il faut le refaire)
  function sameKey(sub) {
    try {
      const k = sub.options && sub.options.applicationServerKey;
      if (!k) return true;
      const a = new Uint8Array(k);
      const b = b64ToBytes(vapid());
      return a.length === b.length && a.every((x, i) => x === b[i]);
    } catch {
      return true;
    }
  }

  // (Ré)abonne cet appareil et le déclare au serveur.
  async function subscribePush() {
    const reg = swReg || (await swReady);
    if (!reg || !vapid()) throw new Error(T('Ce navigateur ne gère pas les notifications', 'This browser doesn’t support notifications', 'Este navegador no admite notificaciones'));
    let sub = await reg.pushManager.getSubscription();
    if (sub && !sameKey(sub)) {
      await sub.unsubscribe().catch(() => {});
      sub = null;
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(vapid()) });
    await api('POST', 'push/subscribe', { subscription: sub.toJSON() });
    return sub;
  }

  // À chaque ouverture : si les notifs sont autorisées, on resynchronise l'abonnement avec le serveur
  // (un abonnement peut expirer ou changer sans prévenir, surtout sur iPhone).
  let pushSynced = false;
  async function syncPush(force) {
    if (pushSynced && !force) return;
    pushSynced = true;
    try {
      if (NATIVE) {
        if (!load('pushOff')) await nativePushRegister(false);
        return;
      }
      if (!vapid() || !('Notification' in window) || Notification.permission !== 'granted' || load('pushOff')) return;
      await subscribePush();
    } catch (e) {
      console.warn('Synchro des notifs :', e);
    }
  }

  async function setupPushButton(pushOk) {
    if (NATIVE) return setupNativePushButton();
    const btn = document.getElementById('pushBtn');
    const status = document.getElementById('pushStatus');
    const testBtn = document.getElementById('pushTest');
    const out = document.getElementById('pushOut');
    if (pushOk && !swReg) swReg = await swReady;
    if (!document.body.contains(btn)) return;
    if (!pushOk || !swReg) {
      const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      status.textContent = iOS
        ? T('Sur iPhone, installe d’abord l’app sur l’écran d’accueil (Partager → Sur l’écran d’accueil) et ouvre-la depuis l’icône.', 'On iPhone, first install the app on your home screen (Share → Add to Home Screen) and open it from the icon.', 'En iPhone, primero instala la app en la pantalla de inicio (Compartir → Añadir a pantalla de inicio) y ábrela desde el icono.')
        : T('Les notifications ne sont pas disponibles sur ce navigateur.', 'Notifications aren’t available in this browser.', 'Las notificaciones no están disponibles en este navegador.');
      btn.disabled = true;
      return;
    }
    const sub = await swReg.pushManager.getSubscription();
    const perm = Notification.permission;
    const on = !!sub && perm === 'granted' && !load('pushOff');
    status.textContent = on
      ? T('Activées sur cet appareil.', 'On for this device.', 'Activadas en este dispositivo.')
      : perm === 'denied'
        ? T('Bloquées. Autorise les notifications pour cette app dans les réglages du téléphone, puis reviens ici.', 'Blocked. Allow notifications for this app in your phone settings, then come back here.', 'Bloqueadas. Permite las notificaciones de esta app en los ajustes del móvil y luego vuelve aquí.')
        : T('Désactivées sur cet appareil.', 'Off on this device.', 'Desactivadas en este dispositivo.');
    btn.textContent = on ? T('Désactiver', 'Turn off', 'Desactivar') : T('Activer les notifications', 'Turn on notifications', 'Activar notificaciones');
    btn.className = on ? 'btn btn-soft' : 'btn btn-main';
    btn.disabled = perm === 'denied';
    testBtn.hidden = !on;

    btn.onclick = async () => {
      btn.disabled = true;
      try {
        if (on) {
          const current = await swReg.pushManager.getSubscription();
          if (current) {
            await api('POST', 'push/unsubscribe', { endpoint: current.endpoint });
            await current.unsubscribe();
          }
          save('pushOff', '1');
          toast(T('Notifications désactivées', 'Notifications off', 'Notificaciones desactivadas'));
        } else {
          // iPhone : la demande d'autorisation doit partir directement du clic, sans attente avant.
          const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
          if (p !== 'granted') throw new Error(T('Autorisation refusée', 'Permission denied', 'Permiso denegado'));
          save('pushOff', null);
          await subscribePush();
          toast(T('Notifications activées', 'Notifications on', 'Notificaciones activadas'));
        }
      } catch (e) {
        toast(e.message);
      }
      setupPushButton(pushOk);
    };

    testBtn.onclick = async () => {
      testBtn.disabled = true;
      out.textContent = T('Envoi…', 'Sending…', 'Enviando…');
      try {
        await subscribePush();
        const r = await api('POST', 'push/test');
        out.textContent = !r.devices
          ? T('Aucun appareil enregistré.', 'No device registered.', 'No hay ningún dispositivo registrado.')
          : r.results.map((x) => (x.ok ? T(`Envoyé (${x.service}) : la notification doit arriver dans quelques secondes.`, `Sent (${x.service}): the notification should arrive in a few seconds.`, `Enviado (${x.service}): la notificación debería llegar en unos segundos.`) : `${T('Échec', 'Failed', 'Error')} (${x.service}) : ${x.status || ''} ${x.error || ''}`)).join('\n');
      } catch (e) {
        out.textContent = e.message;
      }
      testBtn.disabled = false;
    };
  }

  // ---------- Présence : "j'ai l'app à l'écran" (évite les notifs pendant qu'on regarde) ----------

  let presenceTimer = null;
  function sendPresence(visible) {
    if (!token || !groupId) return;
    fetch(API + '/api/presence', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'X-Group': groupId },
      body: JSON.stringify({ visible }),
    }).catch(() => {});
  }
  function startPresence() {
    if (presenceTimer || document.hidden) return;
    sendPresence(true);
    presenceTimer = setInterval(() => { if (!document.hidden) sendPresence(true); }, 20000);
  }
  function stopPresence(notify = true) {
    clearInterval(presenceTimer);
    presenceTimer = null;
    if (notify) sendPresence(false);
  }
  window.addEventListener('pagehide', () => stopPresence());

  const swReady = !NATIVE && 'serviceWorker' in navigator
    ? navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((r) => (swReg = r)).catch(() => null)
    : Promise.resolve(null);

  // ---------- App mobile (iOS / Android, via Capacitor) ----------
  // Notifications natives (Firebase), bouton retour Android, liens d'invitation qui ouvrent l'app, pastille,
  // barre d'état. Rien de tout ça ne tourne sur le site web.
  const FM = () => Plugins.FirebaseMessaging;

  // Jeton du téléphone → serveur (pour tous les groupes du compte).
  async function nativePushRegister(ask) {
    if (!FM()) throw new Error(T('Notifications indisponibles', 'Notifications unavailable'));
    let perm = (await FM().checkPermissions()).receive;
    if (perm !== 'granted' && ask) perm = (await FM().requestPermissions()).receive;
    if (perm !== 'granted') return false;
    const { token: fcm } = await FM().getToken();
    if (!fcm) return false;
    save('fcmToken', fcm);
    await api('POST', 'push/subscribe', { subscription: { fcm, platform: PLATFORM } });
    return true;
  }

  async function setupNativePushButton() {
    const btn = document.getElementById('pushBtn');
    const status = document.getElementById('pushStatus');
    const testBtn = document.getElementById('pushTest');
    const out = document.getElementById('pushOut');
    if (!btn) return;
    let perm = 'denied';
    try { perm = FM() ? (await FM().checkPermissions()).receive : 'denied'; } catch { /* plugin absent */ }
    const on = perm === 'granted' && !load('pushOff');
    status.textContent = on
      ? T('Activées sur ce téléphone.', 'On for this phone.')
      : perm === 'denied'
        ? T('Bloquées. Autorise les notifications pour l’app dans les réglages du téléphone.', 'Blocked. Allow notifications for the app in your phone settings.')
        : T('Désactivées sur ce téléphone.', 'Off on this phone.');
    btn.textContent = on ? T('Désactiver', 'Turn off') : T('Activer les notifications', 'Turn on notifications');
    btn.className = on ? 'btn btn-soft' : 'btn btn-main';
    btn.disabled = perm === 'denied' && !on && PLATFORM === 'ios';
    testBtn.hidden = !on;
    btn.onclick = async () => {
      btn.disabled = true;
      try {
        if (on) {
          const t = load('fcmToken');
          if (t) await api('POST', 'push/unsubscribe', { endpoint: 'fcm:' + t });
          save('pushOff', '1');
          toast(T('Notifications désactivées', 'Notifications off'));
        } else {
          save('pushOff', null);
          if (!(await nativePushRegister(true))) throw new Error(T('Autorisation refusée', 'Permission denied'));
          toast(T('Notifications activées', 'Notifications on'));
        }
      } catch (e) { toast(e.message); }
      setupNativePushButton();
    };
    testBtn.onclick = async () => {
      testBtn.disabled = true;
      out.textContent = T('Envoi…', 'Sending…');
      try {
        const r = await api('POST', 'push/test');
        out.textContent = !r.devices ? T('Aucun appareil enregistré.', 'No device registered.') : r.results.map((x) => (x.ok ? T('Envoyée : elle doit arriver dans quelques secondes.', 'Sent: it should arrive in a few seconds.') : `${T('Échec', 'Failed')} : ${x.error || x.status || ''}`)).join('\n');
      } catch (e) { out.textContent = e.message; }
      testBtn.disabled = false;
    };
  }

  // Ouvre ce que désigne un lien (notification touchée, lien d'invitation) : ?g=…&chat=…, ?code=…, ?recap=…
  function openLink(href) {
    let u;
    try { u = new URL(href, PUBLIC_URL); } catch { return; }
    const code = u.searchParams.get('code');
    const ch = u.searchParams.get('chat');
    const gid = u.searchParams.get('g');
    if (u.searchParams.get('recap')) pendingRecap = u.searchParams.get('recap');
    if (u.searchParams.has('news')) pendingNews = true;
    if (u.searchParams.has('feedback')) pendingFeedback = true;
    if (code) {
      if (!token) { inviteCode = code; ensureAccount().then(startAccount).catch((e) => toast(e.message)); return; }
      const already = account && account.groups.find((x) => x.code === code.toUpperCase());
      return already ? enterGroup(already.id) : openJoinSheet(code);
    }
    if (!token) return;
    if ((pendingNews || pendingFeedback) && (!gid || gid === groupId)) return openPendingAbout();
    if (gid && gid !== groupId) {
      pendingChat = ch;
      enterGroup(gid);
    } else if (ch && state) openChat(ch);
    else if (pendingRecap && state) openRecapFromLink();
  }

  // Pastille sur l'icône : ce qu'il reste à voir (mise à jour à chaque rafraîchissement).
  function setNativeBadge(n) {
    if (NATIVE && Plugins.Badge) Plugins.Badge.set({ count: n }).catch(() => {});
  }

  if (NATIVE) {
    document.documentElement.classList.add('native', 'native-' + PLATFORM);
    const { App, StatusBar, SplashScreen } = Plugins;
    if (SplashScreen) setTimeout(() => SplashScreen.hide().catch(() => {}), 200);
    if (StatusBar) {
      StatusBar.setStyle({ style: 'DARK' }).catch(() => {}); // texte blanc sur le dégradé de l'en-tête
      if (PLATFORM === 'android') StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
    }
    if (FM()) {
      FM().addListener('notificationActionPerformed', (e) => {
        const d = (e && e.notification && e.notification.data) || {};
        if (d.url) openLink(d.url);
      });
      FM().addListener('tokenReceived', (e) => {
        if (e && e.token && token && !load('pushOff') && e.token !== load('fcmToken')) {
          save('fcmToken', e.token);
          api('POST', 'push/subscribe', { subscription: { fcm: e.token, platform: PLATFORM } }).catch(() => {});
        }
      });
    }
    if (App) {
      // Bouton retour Android : même chemin que le retour de l'app ; à l'accueil, l'app passe en arrière-plan.
      App.addListener('backButton', () => {
        if (storyOpen()) return closeStory();
        if (viewerOpen()) return closeViewer();
        if (!$sheet.hidden) return closeSheet();
        if (state) {
          if (history.state && history.state.guard) return history.back();
          if (goBack()) return syncGuard();
        }
        App.minimizeApp();
      });
      // Lien d'invitation (ou de notification) ouvert alors que l'app est installée.
      App.addListener('appUrlOpen', (e) => { if (e && e.url) openLink(e.url); });
    }
  }

  // Notifications déjà vues (message lu, question votée) : retirées du centre de notifs du téléphone.
  async function clearNativeNotifs() {
    if (!FM() || !state) return;
    const { notifications } = await FM().getDeliveredNotifications().catch(() => ({ notifications: [] }));
    const done = (notifications || []).filter((n) => {
      const tag = (n.data && n.data.tag) || n.tag || '';
      const m = /^(chat|mention|poll|votes)-(.+?)(?:@(\w+))?$/.exec(tag);
      if (!m || (m[3] && m[3] !== groupId)) return false;
      if (m[1] === 'chat' || m[1] === 'mention') {
        const t = state.chat.threads.find((x) => x.channel === m[2]);
        return chatOpen === m[2] || !(t ? t.unread : 0);
      }
      const p = state.live.find((x) => x.id === m[2]);
      return !p || !!p.myVote;
    });
    if (done.length) await FM().removeDeliveredNotifications({ notifications: done }).catch(() => {});
  }

  // ---------- Démarrage ----------

  if (inviteCode) save('code', inviteCode.toUpperCase());
  if (inviteCode || pendingChat || pendingRecap || pendingNews || pendingFeedback || pendingQuiz || (pendingGroup && !restoring)) history.replaceState(null, '', BASE);
  if (token) startAccount();
  else if (inviteCode) ensureAccount().then(startAccount).catch((e) => renderWelcome(e.message)); // lien d'invitation : direct au choix du nom
  else renderWelcome();
})();
