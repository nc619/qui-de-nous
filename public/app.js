// "Qui de nous ?" — client.
(() => {
  const SET_EMOJIS = ['✨', '🎉', '💀', '🔮', '🤡', '💔', '🧟', '🧠', '🤫', '📱', '🏆', '🚔', '✈️', '🌶️', '🔥', '😈', '🍻', '🏖️', '🎮', '⚽', '🎓', '💼', '🎤', '🍕'];

  const $app = document.getElementById('app');
  const $sheet = document.getElementById('sheet');
  const $toast = document.getElementById('toast');

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
  const openPolls = new Set(); // sondages déjà votés / archivés dépliés par l'utilisateur
  const openVoters = new Set(); // barres de résultats dont on a déroulé la liste des votants ("sondage:personne")
  let animating = false; // animation de vote en cours
  let pendingRender = false;
  let flashId = null;
  let doneFolded = load('doneFolded') === '1'; // section « Déjà voté » repliée
  let statsMode = load('statsMode') || 'me'; // onglet Stats : 'me' (profil), 'duo' (affinités), 'group'
  let halfPick = null; // { pollId, picks: [playerId] } : demi-vote en cours (« j'hésite »)

  // ---------- Langue (français / anglais) ----------
  // Par défaut : la langue du lien d'où on vient (/en → anglais, sinon français). On peut changer dans Moi.
  // Le choix est gardé sur l'appareil ; ouvrir un lien /en repasse en anglais tant qu'on n'a pas choisi soi-même.
  const fromEn = /^\/en(\/|$)/.test(location.pathname) || document.documentElement.dataset.lang === 'en';
  let LANG = load('lang') || (fromEn ? 'en' : 'fr');
  if (fromEn && !load('langPicked')) LANG = 'en';
  if (LANG !== 'en') LANG = 'fr';
  save('lang', LANG);
  const BASE = fromEn ? '/en/' : '/';
  let L = LANG === 'en';
  let LOC = L ? 'en-GB' : 'fr-FR';
  const T = (fr, en) => (L ? en : fr);
  function applyLang() {
    L = LANG === 'en';
    LOC = L ? 'en-GB' : 'fr-FR';
    document.documentElement.lang = LANG;
  }
  applyLang();
  function setLang(lang) {
    LANG = lang === 'en' ? 'en' : 'fr';
    save('lang', LANG);
    save('langPicked', '1');
    applyLang();
  }
  // Textes qui existent dans les deux langues (questions intégrées, sets, stats).
  const qText = (x) => (x && (L && x.textEn ? x.textEn : x.text)) || '';
  const setName = (x) => (L && x.nameEn) || x.name;
  const setDesc = (x) => (L && x.descriptionEn) || x.description;
  const statLabel = (d) => (L && d.en ? d.en.label : d.label);
  const statTitle = (d) => (L && d.en ? d.en.title : d.title);
  const titleText = (t) => (L && t.titleEn) || t.title;
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
    if (s < 60) return T('à l’instant', 'just now');
    const m = Math.floor(s / 60);
    if (m < 60) return T(`il y a ${m} min`, `${m} min ago`);
    const h = Math.floor(m / 60);
    if (h < 24) return T(`il y a ${h} h`, `${h}h ago`);
    const d = Math.floor(h / 24);
    if (d < 7) return T(`il y a ${d} j`, `${d}d ago`);
    return new Date(t).toLocaleDateString(LOC, { day: 'numeric', month: 'short' });
  }

  function left(t) {
    const m = Math.max(0, Math.round((t - now()) / 60000));
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    return h < 48 ? `${h} h ${String(m % 60).padStart(2, '0')}` : T(`${Math.floor(h / 24)} j`, `${Math.floor(h / 24)} days`);
  }

  function clock(t) {
    const opts = { hour: '2-digit', minute: '2-digit', timeZone: state.settings.timezone };
    const d = new Date(t);
    const sameDay = d.toLocaleDateString('fr-FR', { timeZone: state.settings.timezone }) === new Date(now()).toLocaleDateString('fr-FR', { timeZone: state.settings.timezone });
    const time = d.toLocaleTimeString(LOC, opts);
    return (sameDay ? '' : T('demain ', 'tomorrow ')) + (L ? time : time.replace(':', 'h'));
  }

  // « 3 sondages » / « 3 polls » (pluriel anglais irrégulier : donner la forme en 3e argument).
  const plural = (n, word, many) => `${n} ${n > 1 || (L && n === 0) ? many || word + 's' : word}`;

  const NOBODY = { id: 'nobody', name: 'Personne', emoji: '∅', color: '#8a7aa8' };
  function player(id) {
    if (id === 'nobody') return { ...NOBODY, name: T('Personne', 'Nobody') };
    return state.players.find((p) => p.id === id) || { id, name: '???', emoji: '👻', color: '#999999' };
  }
  function setOf(id) {
    return state.sets.find((s) => s.id === id) || { id, name: T('Set supprimé', 'Deleted set'), emoji: '🗑️', spicy: false };
  }
  // Un vote : "id" (entier) ou ["a", "b"] (demi-votes).
  const votedFor = (v, id) => (Array.isArray(v) ? v.includes(id) : v === id);
  const me = () => player(state.me.playerId);

  // Avatar : la photo de la personne, sinon son animal par défaut, toujours sur sa couleur.
  function avatar(p, size = '') {
    if (p.id === 'nobody') return `<span class="avatar ${size} nobody-av" title="${T('Personne', 'Nobody')}">∅</span>`;
    const inner = p.photo
      ? `<img src="/api/photos/${esc(p.id)}?v=${esc(p.photo)}" alt="" loading="lazy" decoding="async">`
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
          toast(T('Image illisible', 'Can’t read that image'));
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
        <div class="sheet-head"><h2>${T('Ta photo', 'Your photo')}</h2><button class="x" data-close>✕</button></div>
        <p class="muted small crop-hint">${T('Pince ou utilise le curseur pour zoomer, glisse pour placer.', 'Pinch or use the slider to zoom, drag to move it.')}</p>
        <div class="crop-box" id="cropBox" style="width:${V}px;height:${V}px">
          <img id="cropImg" src="${img.src}" alt="" draggable="false">
          <div class="crop-ring"></div>
        </div>
        <div class="crop-zoom">
          <span>−</span>
          <input type="range" id="cropZoom" min="1" max="${MAX}" step="0.01" value="1" aria-label="Zoom">
          <span>+</span>
        </div>
        <button class="btn btn-main btn-block" id="cropOk">${T('Valider', 'Done')}</button>`, (root) => {
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
      res = await fetch('/api/' + url, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Lang': LANG, ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new Error(T('Pas de connexion au serveur 📡', 'Can’t reach the server 📡'));
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && token && !url.startsWith('login')) {
      logoutLocal();
      throw new Error(T('Session expirée, reconnecte-toi', 'Session expired, log in again'));
    }
    if (!res.ok) throw new Error(data.error || (res.status === 413 ? T('Trop lourd 😬', 'Too big 😬') : T('Oups, erreur', 'Oops, something broke')));
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

  // ---------- Connexion ----------

  // mode : 'join' (code → choisir son nom), 'create' (nouveau groupe), 'login' (code + pseudo + PIN)
  function renderAuth(mode, err = '') {
    stopPolling();
    closeSheet();
    mode = mode || (load('joined') ? 'login' : 'join');
    let photoData = null; // photo choisie avant de rejoindre (envoyée une fois connecté)
    let roster = null; // { group, players } une fois le code validé
    let picked = null;

    const codeField = (hint) => `
      <label for="code">${T('Code du groupe', 'Group code')}</label>
      <input class="input code-input" id="code" required autocapitalize="characters" autocomplete="off" maxlength="12" placeholder="${hint}" value="${esc(load('code') || '')}">`;

    const photoField = (p) => `
      <label>${T('Ta photo', 'Your photo')} <span class="muted">${T('(optionnel)', '(optional)')}</span></label>
      <button type="button" class="photo-pick" id="authPhoto">
        ${photoData ? `<span class="avatar lg has-photo" style="--pc:${esc(p.color)}"><img src="${photoData}" alt=""></span>` : avatar({ ...p, photo: null }, 'lg')}
        <span>${photoData ? T('Changer la photo', 'Change photo') : T('Choisir une photo', 'Pick a photo')}<small class="muted">${T('Sinon, tu gardes cet animal', 'Otherwise you keep this animal')}</small></span>
      </button>`;

    const draw = () => {
      let fields = '';
      if (mode === 'create') {
        fields = `
          <div class="info">${T('👑 Tu seras l’admin : tu ajouteras ensuite les noms de tes potes, et tu auras un code à leur envoyer.', '👑 You’ll be the admin: next you add your mates’ names, and you get a code to send them.')}</div>
          <label for="groupName">${T('Nom du groupe', 'Group name')}</label>
          <input class="input" id="groupName" required maxlength="40" placeholder="${T('Ex : Les Bouffons', 'Ex: The Clowns')}">
          <label for="name">${T('Ton pseudo', 'Your name')}</label>
          <input class="input" id="name" required maxlength="24" placeholder="${T('Ton petit nom', 'What your mates call you')}">
          ${pinField()}
          ${photoField({ id: 'me', color: '#e63946', animal: 0, name: '' })}`;
      } else if (mode === 'login') {
        fields = `
          ${codeField('Ex : K7QM2P')}
          <label for="name">${T('Pseudo', 'Name')}</label>
          <input class="input" id="name" required maxlength="24" placeholder="${T('Ton pseudo dans le groupe', 'Your name in the group')}" value="${esc(load('lastName') || '')}">
          ${pinField()}`;
      } else if (!roster) {
        fields = codeField(T('Demande-le à tes potes', 'Ask your mates for it'));
      } else {
        fields = `
          <div class="info">${T('Groupe', 'Group')} <b>${esc(roster.group.name)}</b> · <button type="button" class="link" id="otherCode">${T('changer de code', 'use another code')}</button></div>
          <label>${T('Qui es-tu ?', 'Who are you?')}</label>
          ${roster.players.length ? `<div class="pick-grid">${roster.players.map((p) => `
            <button type="button" class="choice ${picked && picked.id === p.id ? 'picked' : ''}" data-pick="${p.id}">${avatar(p)}<span>${esc(p.name)}</span></button>`).join('')}</div>`
            : `<div class="info">${T('Tout le monde a déjà rejoint. Demande à l’admin de t’ajouter.', 'Everyone already joined. Ask the admin to add you.')}</div>`}
          ${picked ? `
            <label for="name">${T('Ton pseudo (tu peux le changer)', 'Your name (you can change it)')}</label>
            <input class="input" id="name" required maxlength="24" value="${esc(picked.name)}">
            ${pinField()}
            ${photoField(picked)}` : ''}`;
      }
      const label = mode === 'create' ? T('Créer le groupe', 'Create the group') : mode === 'login' ? T('Entrer', 'Log in') : roster ? T('C’est parti', 'Let’s go') : T('Continuer →', 'Continue →');
      const hideBtn = mode === 'join' && roster && !picked;

      $app.innerHTML = `
        <div class="auth">
          <form class="auth-box" id="authForm" autocomplete="off">
            ${langSwitch('auth-lang')}
            <span class="logo-emoji">🤔</span>
            <h1 class="logo">${T('Qui de nous ?', 'Which of us?')}</h1>
            <p class="tagline">${T('Une question toutes les 3 h. Tout le monde vote. Verdicts sans pitié.', 'A question every 3 hours. Everyone votes. No mercy.')}</p>
            <div class="seg seg-3">
              <button type="button" data-mode="join" class="${mode === 'join' ? 'on' : ''}">${T('Rejoindre', 'Join')}</button>
              <button type="button" data-mode="login" class="${mode === 'login' ? 'on' : ''}">${T('Connexion', 'Log in')}</button>
              <button type="button" data-mode="create" class="${mode === 'create' ? 'on' : ''}">${T('Créer', 'Create')}</button>
            </div>
            ${fields}
            ${hideBtn ? '' : `<button class="btn btn-main btn-block" type="submit">${label}</button>`}
            <p class="error" id="authErr">${esc(err)}</p>
          </form>
        </div>`;

      $app.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => { mode = b.dataset.mode; roster = null; picked = null; err = ''; draw(); }));
      bindLangSwitch($app, draw);
      $app.querySelectorAll('[data-pick]').forEach((b) => (b.onclick = () => { picked = roster.players.find((p) => p.id === b.dataset.pick); draw(); }));
      const other = document.getElementById('otherCode');
      if (other) other.onclick = () => { roster = null; picked = null; draw(); };
      const ph = document.getElementById('authPhoto');
      if (ph) ph.onclick = async () => { const d = await pickPhoto(); if (d) { photoData = d; draw(); } };

      const form = document.getElementById('authForm');
      form.onsubmit = async (e) => {
        e.preventDefault();
        const btn = form.querySelector('[type=submit]');
        if (btn) btn.disabled = true;
        const val = (id) => (document.getElementById(id) || {}).value || '';
        try {
          let data;
          if (mode === 'create') {
            data = await api('POST', 'groups', { groupName: val('groupName'), name: val('name'), pin: val('pin'), lang: LANG });
            save('code', data.code);
            save('lastName', val('name'));
          } else if (mode === 'login') {
            data = await api('POST', 'login', { code: val('code'), name: val('name'), pin: val('pin') });
            save('code', val('code').toUpperCase().trim());
            save('lastName', val('name'));
          } else if (!roster) {
            roster = await api('POST', 'roster', { code: val('code') });
            save('code', roster.group.code);
            err = '';
            return draw();
          } else {
            data = await api('POST', 'join', { code: roster.group.code, playerId: picked.id, name: val('name'), pin: val('pin'), lang: LANG });
            save('lastName', val('name'));
          }
          token = data.token;
          save('token', token);
          save('joined', '1');
          if (mode === 'create') { tab = 'me'; save('tab', tab); }
          if (photoData) await api('POST', 'me/photo', { data: photoData }).catch((e2) => toast(e2.message));
          await refresh();
          confetti();
          if (mode === 'create') showInvite(true);
        } catch (ex) {
          err = ex.message;
          const box = document.getElementById('authErr');
          if (box) box.textContent = ex.message;
          if (btn) btn.disabled = false;
        }
      };
    };
    draw();
    // Lien d'invitation (?code=XXXX) : on passe directement au choix du nom.
    if (mode === 'join' && inviteCode) {
      inviteCode = null;
      document.getElementById('authForm').requestSubmit();
    }
  }

  // Petit interrupteur FR / EN (écran de connexion et Moi).
  function langSwitch(cls = '') {
    return `<div class="lang-switch ${cls}" role="group" aria-label="Langue / Language">
      <button type="button" data-lang="fr" class="${LANG === 'fr' ? 'on' : ''}">FR</button>
      <button type="button" data-lang="en" class="${LANG === 'en' ? 'on' : ''}">EN</button>
    </div>`;
  }
  function bindLangSwitch(root, redraw) {
    root.querySelectorAll('[data-lang]').forEach((b) => (b.onclick = () => {
      if (b.dataset.lang === LANG) return;
      setLang(b.dataset.lang);
      if (token && state) api('PATCH', 'me', { lang: LANG }).then(() => { state.me.lang = LANG; }).catch(() => {});
      redraw();
    }));
  }

  // ---------- Invitation ----------

  function inviteLink() {
    return `${location.origin}${L ? '/en/' : '/'}?code=${state.group.code}`;
  }

  function showInvite(justCreated) {
    const text = T(`Rejoins « ${state.group.name} » sur Qui de nous ?\nCode : ${state.group.code}\n${inviteLink()}`, `Join “${state.group.name}” on Which of us?\nCode: ${state.group.code}\n${inviteLink()}`);
    openSheet(`
      <div class="sheet-head"><h2>${justCreated ? T('Groupe créé', 'Group created') : T('Inviter des potes', 'Invite your mates')}</h2><button class="x" data-close>✕</button></div>
      <p class="muted" style="margin:0 0 6px">${T(`Envoie ce code (ou le lien) à tes potes pour qu’ils rejoignent <b>${esc(state.group.name)}</b>.`, `Send this code (or the link) to your mates so they can join <b>${esc(state.group.name)}</b>.`)}</p>
      <div class="big-code">${esc(state.group.code)}</div>
      <div class="row">
        <button class="btn btn-main" id="shareBtn">${navigator.share ? T('Partager', 'Share') : T('Copier le lien', 'Copy link')}</button>
        <button class="btn btn-soft" id="copyCode">${T('Copier le code', 'Copy code')}</button>
      </div>
      <button class="link-btn" id="otherLang">${T('Des potes anglophones ? Copier le lien en anglais', 'Mates who speak French? Copy the French link')}</button>
      ${justCreated ? `<div class="info" style="margin-top:14px">${T('👉 Ajoute d’abord les noms de tes potes dans <b>Admin → Les potes</b> : ils choisiront leur nom en rejoignant.', '👉 First add your mates’ names in <b>Admin → Your mates</b>: they’ll pick their name when joining.')}</div>` : ''}`, (root) => {
      const copy = async (t, msg) => {
        try {
          await navigator.clipboard.writeText(t);
          toast(msg);
        } catch {
          prompt(T('Copie ça :', 'Copy this:'), t);
        }
      };
      root.querySelector('#copyCode').onclick = () => copy(state.group.code, T('Code copié', 'Code copied'));
      root.querySelector('#otherLang').onclick = () => copy(`${location.origin}${L ? '/' : '/en/'}?code=${state.group.code}`, T('Lien en anglais copié', 'French link copied'));
      root.querySelector('#shareBtn').onclick = async () => {
        if (navigator.share) {
          try { await navigator.share({ title: T('Qui de nous ?', 'Which of us?'), text }); } catch { /* annulé */ }
        } else copy(text, T('Invitation copiée', 'Invite copied'));
      };
    });
  }

  function pinField() {
    return `
      <label for="pin">${T('PIN secret (4 à 6 chiffres)', 'Secret PIN (4 to 6 digits)')}</label>
      <input class="input" id="pin" required inputmode="numeric" pattern="\\d{4,6}" maxlength="6" type="password" placeholder="••••">`;
  }

  function logoutLocal() {
    stopPresence();
    token = null;
    state = null;
    stopLive();
    closeChat(true);
    chats.clear();
    save('token', null);
    renderAuth('login');
  }

  // ---------- Données ----------

  async function refresh() {
    try {
      const t0 = Date.now();
      const next = await api('GET', 'state');
      skew = next.now - Math.round((t0 + Date.now()) / 2);
      state = next;
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
      const next = await api('GET', 'state');
      const changed = JSON.stringify({ ...next, now: 0 }) !== JSON.stringify({ ...state, now: 0 });
      state = next;
      if (busy() || !changed) renderNav();
      else renderMain();
      if (chatOpen) renderChatHeader();
      clearNotifs();
    } catch { /* on réessaiera */ }
  }

  // ---------- Notifications déjà vues ----------
  // Les notifications restent dans le centre de notifs du téléphone même quand on a lu le message
  // ou voté : on retire celles qui ne servent plus (message lu, question votée ou terminée).
  async function clearNotifs() {
    try {
      const reg = swReg || (await swReady);
      if (!reg || !reg.getNotifications || !state) return;
      const list = await reg.getNotifications();
      for (const n of list) {
        const tag = n.tag || '';
        const m = /^(chat|mention|poll|votes)-(.+)$/.exec(tag);
        if (!m) continue;
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
          <h1 id="groupTitle"></h1>
          <button class="theme-btn" id="themeBtn" role="switch"></button>
          <button class="me-chip" id="meChip"></button>
        </header>
        <main id="view"></main>
        <nav class="nav"><div class="nav-inner" id="nav"></div></nav>`;
      document.getElementById('meChip').onclick = () => go('me');
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
      ['me', 'me', T('Moi', 'Me'), 0],
    ];
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
    const name = T('Qui de nous ?', 'Which of us?');
    document.title = n + unread ? `(${n + unread}) ${name}` : name;
    if (navigator.setAppBadge) navigator.setAppBadge(n + unread).catch(() => {});
  }

  // ---------- Thème clair / sombre ----------

  const isDark = () => document.documentElement.dataset.theme === 'dark';

  function paintThemeBtn() {
    const b = document.getElementById('themeBtn');
    if (!b) return;
    b.classList.toggle('on', isDark());
    b.setAttribute('aria-checked', String(isDark()));
    b.setAttribute('aria-label', isDark() ? T('Passer en mode clair', 'Switch to light mode') : T('Passer en mode sombre', 'Switch to dark mode'));
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
    ({ live: renderLive, chat: renderChatList, sets: renderSets, stats: renderStats, me: renderMe }[tab] || renderLive)(view);
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
    const me_ = (u) => (u.id === state.me.playerId ? T('Toi', 'You') : u.name);

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
            ${u.id === 'nobody' ? '<span class="avatar sm nobody-av">∅</span>' : avatar(u, 'sm')}<span>${esc(u.id === state.me.playerId ? u.name + T(' (moi)', ' (me)') : u.name)}</span>
            ${inHalf ? '<i class="half-mark">½</i>' : ''}
          </button>`;
      };
      body = `<div class="vote-list">${state.players.map((u) => opt(u)).join('')}${p.nobody ? opt(player('nobody'), 'nobody') : ''}</div>
        <div class="half-row ${half ? 'on' : ''}">
          ${half
            ? `<span class="half-hint">${half.length ? T('Une 2e personne ? Ou valide ton ½ seul', 'A 2nd person? Or send just your ½') : T('Choisis 1 ou 2 personnes : ½ vote chacune', 'Pick 1 or 2 people: ½ vote each')}</span>
               ${half.length ? `<button class="half-send" data-halfsend="${p.id}">${T('Valider ½', 'Send ½')}</button>` : ''}
               <button class="half-cancel" data-halfcancel="${p.id}">${T('Annuler', 'Cancel')}</button>`
            : `<button class="half-toggle" data-half="${p.id}" title="${T('Pas sûr·e ? Partage ton vote en deux', 'Not sure? Split your vote in two')}">½ ${T('J’hésite', 'Not sure')}</button>`}
          ${editing === p.id && !half ? `<button class="link-btn" data-cancel>${T('Annuler', 'Cancel')}</button>` : ''}
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
        : `<p class="muted small" style="margin:0">${T('Personne n’a voté.', 'Nobody voted.')}</p>`;
      body += consensusLine(p) + rateRow(p);
    }

    const status = p.ended ? `<span class="poll-ended">${T('Terminé', 'Over')}</span>` : timeLeft(p);
    const author = p.custom && p.authorId ? player(p.authorId) : null;
    const picked = opts.justVoted && p.myVote ? (Array.isArray(p.myVote) ? p.myVote.map(player) : [player(p.myVote)]) : null;
    const pickedNames = picked && picked.map((u) => (u.id === state.me.playerId ? T('pour toi', 'for yourself') : u.name));
    return `
      <article class="card poll ${voting && !p.myVote ? 'todo' : ''} ${p.custom ? 'custom' : ''} ${opts.justVoted ? 'just-voted' : ''} ${voting && halfPick && halfPick.pollId === p.id ? 'halfmode' : ''}" data-poll="${p.id}">
        ${p.custom ? `<div class="custom-tag">${icon('pen')}<span>${T('Question de', 'Question by')} <b>${author ? esc(author.name) : T('quelqu’un du groupe', 'someone in the group')}</b></span></div>` : ''}
        ${picked ? `<div class="voted-banner">${icon('check')}<span>${Array.isArray(p.myVote)
          ? T(`Tu as voté ½ <b>${pickedNames.map(esc).join('</b> et ½ <b>')}</b>`, `You voted ½ <b>${pickedNames.map(esc).join('</b> and ½ <b>')}</b>`)
          : T(`Tu as voté <b>${esc(pickedNames[0])}</b>`, `You voted <b>${esc(pickedNames[0])}</b>`)}</span></div>` : ''}
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
            ${by && !(author && author.id === by.id) ? `<span class="by">· ${T('par', 'by')} ${esc(by.name)}</span>` : ''}
          </span>
          <span class="foot-actions">
            ${comments || (p.chat && p.chat.locked) ? '' : `<button class="more-btn" data-chat="${p.id}" aria-label="${T('Commenter', 'Comment')}">${icon('comment')}</button>`}
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
      return `<div class="cons-line">👑 ${T(`Unanimité ${c.n}/${c.n} pour <b>${esc(u.id === state.me.playerId ? 'toi' : u.name)}</b>`, `Unanimous ${c.n}/${c.n} for <b>${esc(u.id === state.me.playerId ? 'you' : u.name)}</b>`)}</div>`;
    }
    return `<div class="cons-line split">🌪️ ${T('Personne n’est d’accord', 'Nobody agrees')}</div>`;
  }

  // Note de la question (étoiles) : discrète, sous les résultats. Gardée pour les stats et les futures questions.
  function rateRow(p) {
    if (!p.rating || (!p.myVote && !p.ended)) return '';
    const r = p.rating;
    return `
      <div class="rate-row">
        <span class="rate-label">${r.mine ? T('Ta note', 'Your rating') : T('Note la question', 'Rate this question')}</span>
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
        <span class="mr-name">${esc(Array.from(u.id === state.me.playerId ? T('Toi', 'You') : u.name).slice(0, 8).join(''))}</span>
        <span class="mini-track"><span class="mini-fill" style="width:${((max / total) * 100).toFixed(1)}%"></span></span>
        <span class="mr-n">${num(max)}</span>
      </span>`).join('') + (leaders.length > 2 ? `<span class="tie-more">+${leaders.length - 2} ${T('ex æquo', 'tied')}</span>` : '');
    return `
      <button class="prow ${p.custom ? 'custom' : ''} ${flashId === p.id ? 'flash' : ''}" data-toggle="${p.id}" aria-expanded="false">
        <span class="prow-top">
          <span class="prow-q">${author ? `<span class="prow-pen" title="${T('Question de', 'Question by')} ${esc(author.name)}">${icon('pen')}</span>` : ''}${esc(qText(p))}</span>
          ${c.count ? `<span class="prow-chat ${c.unread ? 'new' : ''}">${icon('comment')}${c.unread || c.count}</span>` : ''}
        </span>
        <span class="prow-res ${leaders.length > 1 ? 'tie' : ''}">
          <span class="mini-bars">${bars || `<span class="muted small">${T('Aucun vote', 'No votes')}</span>`}</span>
          <span class="prow-side">${cons ? `<span class="cons-dot ${cons.kind}" title="${cons.kind === 'unanimous' ? T('Unanimité', 'Unanimous') : T('Personne d’accord', 'Nobody agrees')}">${cons.kind === 'unanimous' ? '👑' : '🌪️'}</span>` : ''}${p.ended ? '' : timeLeft(p)}<span class="vote-count">${p.voterIds.length}/${members()}</span></span>
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
    return `<span class="tleft ${frac < 0.15 ? 'soon' : ''}" title="${T('Encore', 'Still')} ${left(p.endsAt)}">
      <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" class="tl-track"/><circle cx="8" cy="8" r="6" class="tl-fill" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${(C * (1 - frac)).toFixed(2)}"/></svg>${label}</span>`;
  }

  // Sondage déjà voté / archivé : ligne compacte, ou carte complète si dépliée.
  function pollItem(p) {
    return openPolls.has(p.id) || editing === p.id ? pollCard(p, { collapsible: true }) : pollRow(p);
  }

  // Aperçu d'un message en une ligne (« GIF », « Photo », ou le texte).
  function msgSnippet(m) {
    if (m.deleted) return `<i>${T('supprimé', 'deleted')}</i>`;
    if (m.kind === 'gif') return 'GIF';
    if (m.kind === 'image') return `📷 ${T('Photo', 'Photo')}`;
    return esc(m.text);
  }

  function pollChatPreview(p) {
    const c = p.chat || { count: 0, unread: 0, last: [] };
    if (c.locked) {
      return c.count
        ? `<div class="poll-chat locked"><span class="pc-ico">${icon('lock')}</span><span class="pc-body muted">${plural(c.count, T('commentaire', 'comment'))} · ${T('vote pour les voir', 'vote to see them')}</span></div>`
        : '';
    }
    if (!c.count) return '';
    const lines = c.last.map((m) => {
      const u = player(m.playerId);
      const who = m.playerId === state.me.playerId ? T('Toi', 'You') : esc(u.name);
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
      <div class="sheet-head"><h2>Options</h2><button class="x" data-close>✕</button></div>
      <p class="muted" style="margin:0 0 12px">${esc(qText(p))}</p>
      <div class="menu-list">
        ${!p.ended && p.myVote ? `<button class="menu-item" id="mEdit">${T('Changer mon vote', 'Change my vote')}</button>` : ''}
        ${canDelete ? `<button class="menu-item danger" id="mDel">${T('Supprimer le sondage', 'Delete the poll')}</button>` : ''}
      </div>`, (root) => {
      const ed = root.querySelector('#mEdit');
      if (ed) ed.onclick = () => { closeSheet(); editing = id; halfPick = null; renderView(); };
      action(root.querySelector('#mDel'), async () => {
        if (!confirm(T('Supprimer ce sondage pour tout le monde ?', 'Delete this poll for everyone?'))) return;
        await api('DELETE', `polls/${id}`);
        closeSheet();
        state.live = state.live.filter((x) => x.id !== id);
        state.archive = state.archive.filter((x) => x.id !== id);
        if (archiveExtra) archiveExtra.items = archiveExtra.items.filter((x) => x.id !== id);
        toast(T('Sondage supprimé', 'Poll deleted'));
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
        if (navigator.vibrate) navigator.vibrate(12);
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

  // ---------- Live ----------

  function liveSwitch() {
    return `
      <div class="seg live-seg">
        <button type="button" data-live="live" class="${liveMode === 'live' ? 'on' : ''}">${T('En cours', 'Live')}</button>
        <button type="button" data-live="archive" class="${liveMode === 'archive' ? 'on' : ''}">${T('Archives', 'Archive')}</button>
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
      ${installBanner()}
      <div class="live-head">${liveSwitch()}${dropMeter()}</div>
      ${!state.live.length ? `
        <div class="card empty">
          ${T('Rien à voter pour l’instant…<br>Lance une question avec le bouton + si tu t’ennuies.', 'Nothing to vote on right now…<br>Launch a question with the + button if you’re bored.')}
        </div>` : ''}
      ${todo.length ? `<div class="section-title">${T('À toi de voter', 'Your turn to vote')} <span class="count">${todo.length}</span></div>${todo.map((p) => pollCard(p)).join('')}` : ''}
      ${!todo.length && done.length ? `<p class="all-done">${T('Tu as voté partout.', 'You voted on everything.')}</p>` : ''}
      ${done.length ? `<button class="section-title fold-title ${doneFolded ? 'folded' : ''}" id="doneToggle" aria-expanded="${!doneFolded}">${T('Déjà voté', 'Already voted')} <span class="count">${done.length}</span>${icon('down')}</button>${doneFolded ? '' : `<div class="prow-list">${done.map(pollItem).join('')}</div>`}` : ''}
      <button class="fab" id="fab" aria-label="${T('Lancer une question', 'Launch a question')}">${icon('plus')}</button>`;

    bindPollCards(view);
    bindLiveSwitch(view);
    bindInstallBanner();
    document.getElementById('fab').onclick = () => openDropSheet();
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
      <button class="drop-meter" id="dropMeter" aria-label="${T('Prochaine question dans', 'Next question in')} ${left(end)}">
        <span class="dm-row"><span class="dm-label">${T('Prochaine question', 'Next question')}</span><b>${left(end).replace(' h ', 'h')}</b></span>
        <span class="dm-bar"><span style="width:${(frac * 100).toFixed(1)}%"></span></span>
      </button>`;
  }

  function openDropInfo() {
    const total = state.sets.reduce((n, s) => n + s.total, 0) || 1;
    const pct = Math.round((state.remainingQuestions / total) * 100);
    openSheet(`
      <div class="sheet-head"><h2>${T('Prochaine question', 'Next question')}</h2><button class="x" data-close>✕</button></div>
      <p class="drop-info-big">${clock(state.nextDrop)} <span class="muted">· ${T('dans', 'in')} ${left(state.nextDrop)}</span></p>
      <p class="muted small">${scheduleText(state.settings)}</p>
      <div class="reserve">
        <div class="reserve-label"><span>${T('Questions en réserve', 'Questions left')}</span><b>${state.remainingQuestions} / ${total}</b></div>
        <div class="reserve-bar"><span style="width:${pct}%"></span></div>
      </div>`, () => {});
  }

  // « Une question toutes les 3 h, de 10 h à 23 h » (la plage peut finir le lendemain).
  function scheduleText(st) {
    const every = L ? String(st.intervalHours) : String(st.intervalHours).replace('.', ',');
    const wraps = st.endHour < st.startHour;
    const allDay = (st.endHour + 1) % 24 === st.startHour && st.intervalHours <= 1;
    const freq = Number(st.intervalHours) === 1 ? T('Une question toutes les heures', 'A question every hour') : T(`Une question toutes les ${every} h`, `A question every ${every}h`);
    if (allDay) return T(`${freq}, jour et nuit.`, `${freq}, day and night.`);
    return T(`${freq}, de ${st.startHour} h à ${st.endHour} h${wraps ? ' (le lendemain)' : ''}.`,
      `${freq}, from ${hourLabel(st.startHour)} to ${hourLabel(st.endHour)}${wraps ? ' (next day)' : ''}.`);
  }
  const hourLabel = (h) => (L ? `${h}:00` : `${h} h`);

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
    toast(T('App installée', 'App installed'));
    if (state && tab === 'live') renderView();
  });

  function installBanner() {
    if (isStandalone() || load('installHidden')) return '';
    if (!installPrompt && !isIOS) return '';
    return `
      <div class="install-banner">
        
        <div class="ib-text"><b>${T('Installe l’app', 'Install the app')}</b><span>${T(`Une icône sur ton écran d’accueil${isIOS ? ' et les notifs' : ''}.`, `An icon on your home screen${isIOS ? ' and notifications' : ''}.`)}</span></div>
        <button class="btn btn-main btn-small" id="installBtn">${T('Installer', 'Install')}</button>
        <button class="x" id="installHide" aria-label="${T('Masquer', 'Hide')}">✕</button>
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
        <div class="sheet-head"><h2>${T('Installer sur iPhone', 'Install on iPhone')}</h2><button class="x" data-close>✕</button></div>
        <ol class="steps">${T(`
          <li>Ouvre ce site dans <b>Safari</b>.</li>
          <li>Touche le bouton <b>Partager</b> <span class="share-ico">⎋</span> (le carré avec une flèche, en bas de l’écran).</li>
          <li>Choisis <b>Sur l’écran d’accueil</b>, puis <b>Ajouter</b>.</li>
          <li>Ouvre l’app depuis la nouvelle icône, puis va dans <b>Moi → Activer les notifs</b>.</li>`, `
          <li>Open this site in <b>Safari</b>.</li>
          <li>Tap the <b>Share</b> button <span class="share-ico">⎋</span> (the square with an arrow, at the bottom of the screen).</li>
          <li>Pick <b>Add to Home Screen</b>, then <b>Add</b>.</li>
          <li>Open the app from the new icon, then go to <b>Me → Turn on notifications</b>.</li>`)}
        </ol>
        <p class="muted small">${T('Les notifs sur iPhone demandent iOS 16.4 ou plus récent.', 'Notifications on iPhone need iOS 16.4 or newer.')}</p>
        <button class="btn btn-main btn-block" data-close>${T('Compris', 'Got it')}</button>`, () => {});
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

  function openDropSheet(presetSet = '') {
    let setId = presetSet;
    const sets = state.sets;
    const draw = () => {
      const s = setId ? setOf(setId) : null;
      const leftToday = state.me.dropsLeft;
      const none = leftToday <= 0;
      openSheet(`
        <div class="sheet-head"><h2>${T('Lancer une question', 'Launch a question')}</h2><button class="x" data-close>✕</button></div>
        <p class="drops-left ${none ? 'empty' : ''}">${none
          ? T(`Tu as utilisé tes ${state.me.dropsPerDay} questions du jour. Ça repart à minuit.`, `You used your ${state.me.dropsPerDay} questions for today. Resets at midnight.`)
          : T(`Il te reste <b>${leftToday}</b> question${leftToday > 1 ? 's' : ''} sur ${state.me.dropsPerDay} aujourd’hui. Elle part tout de suite pour ${pollDuration()}.`, `You’ve got <b>${leftToday}</b> question${leftToday > 1 ? 's' : ''} out of ${state.me.dropsPerDay} left today. It goes out right away for ${pollDuration()}.`)}</p>
        <label>Set</label>
        <div class="set-chips">
          <button class="chip ${!setId ? 'on' : ''}" data-set="">${T('N’importe lequel', 'Any')}</button>
          ${sets.map((x) => `<button class="chip ${setId === x.id ? 'on' : ''} ${x.spicy ? 'spicy' : ''}" data-set="${x.id}">${esc(setName(x))}</button>`).join('')}
        </div>
        <button class="btn btn-main btn-block" id="dropRandom" ${none || (s && !s.remaining) ? 'disabled' : ''}>${T('Question surprise', 'Surprise question')}${s ? ` (${s.remaining} ${T('dispo', 'left')})` : ''}</button>
        <div class="or">${T('ou écris la tienne', 'or write your own')}</div>
        <textarea class="input" id="ownQ" maxlength="200" placeholder="${s ? T('Qui serait le plus susceptible de…', 'Who would be most likely to…') : T('Choisis d’abord un set', 'Pick a set first')}" ${s && !none ? '' : 'disabled'}></textarea>
        <p class="muted small" style="margin:6px 0 0">${T('Elle apparaîtra avec ton nom, comme question perso.', 'It’ll show up with your name, as your own question.')}</p>
        <button class="btn btn-soft btn-block" id="dropOwn" ${s && !none ? '' : 'disabled'}>${T('Lancer ma question', 'Launch my question')}</button>`, (root) => {
        root.querySelectorAll('[data-set]').forEach((b) => (b.onclick = () => { setId = b.dataset.set; draw(); }));
        action(root.querySelector('#dropRandom'), () => drop({ setId: setId || undefined }));
        action(root.querySelector('#dropOwn'), () => {
          const text = root.querySelector('#ownQ').value.trim();
          if (text.length < 8) throw new Error(T('Écris une vraie question', 'Write a real question'));
          return drop({ setId, text });
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
    toast(T(`Question lancée · encore ${dropsLeft} aujourd’hui`, `Question launched · ${dropsLeft} left today`));
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
          <option value="">${T('Tous les sets', 'All sets')}</option>
          ${state.sets.map((s) => `<option value="${s.id}" ${archiveSet === s.id ? 'selected' : ''}>${esc(s.emoji)} ${esc(setName(s))}</option>`).join('')}
        </select>
      </div>
      ${data.items.length ? `<div class="prow-list">${data.items.map(pollItem).join('')}</div>` : `<div class="card empty">${T(`Rien dans les archives pour l’instant.<br>Les questions y arrivent après leurs ${pollDuration()} de vote.`, `Nothing in the archive yet.<br>Questions land here after their ${pollDuration()} of voting.`)}</div>`}
      ${data.hasMore ? `<button class="btn btn-soft btn-block" id="more">${T('Voir plus', 'Show more')}</button>` : ''}`;

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
        <span class="set-count">${T(`${s.played} jouée${s.played > 1 ? 's' : ''} · ${s.remaining} secrète${s.remaining > 1 ? 's' : ''}`, `${s.played} played · ${s.remaining} secret`)}</span>
        ${s.builtin ? '' : `<span class="set-tag">${T('par', 'by')} ${esc(s.author ? player(s.author).name : '?')}</span>`}
      </button>`).join('')}</div>`;

    view.innerHTML = `
      <button class="btn btn-main btn-block" id="newSet" style="margin-top:0">＋ ${T('Créer un set', 'Create a set')}</button>
      <div class="section-title">${T('Les sets', 'Sets')} <span class="count">${classic.length}</span></div>
      ${grid(classic)}
      ${spicy.length ? `<div class="section-title">Spicy · 18+ <span class="count">${spicy.length}</span></div>${grid(spicy)}` : ''}`;

    view.querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => { openSet = b.dataset.open; setDetail = null; renderView(); window.scrollTo({ top: 0 }); }));
    document.getElementById('newSet').onclick = () => openSetForm();
  }

  function openSetForm(existing) {
    let emoji = existing ? existing.emoji : '✨';
    openSheet(`
      <div class="sheet-head"><h2>${existing ? T('Modifier le set', 'Edit the set') : T('Nouveau set', 'New set')}</h2><button class="x" data-close>✕</button></div>
      <label for="setName">${T('Nom', 'Name')}</label>
      <input class="input" id="setName" maxlength="40" placeholder="${T('Ex : Les vacances à Lisbonne', 'Ex: That trip to Lisbon')}" value="${esc(existing ? existing.name : '')}">
      <label for="setDesc">Description</label>
      <input class="input" id="setDesc" maxlength="120" placeholder="${T('De quoi ça parle ?', 'What’s it about?')}" value="${esc(existing ? existing.description : '')}">
      <label>Emoji</label>${emojiGrid(SET_EMOJIS, emoji)}
      <label class="toggle"><input type="checkbox" id="setSpicy" ${existing && existing.spicy ? 'checked' : ''}> <span>${T('Set spicy (18+)', 'Spicy set (18+)')}</span></label>
      <button class="btn btn-main btn-block" id="saveSet">${existing ? T('Enregistrer', 'Save') : T('Créer le set', 'Create the set')}</button>`, (root) => {
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
        toast(existing ? T('Set modifié', 'Set updated') : T('Set créé. Ajoute des questions.', 'Set created. Add some questions.'));
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
      view.innerHTML = `<div class="card empty">${T('Chargement…', 'Loading…')}</div>`;
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
      <button class="back" id="back">← ${T('Tous les sets', 'All sets')}</button>
      <div class="card set-hero ${s.spicy ? 'spicy' : ''}">
        <span class="set-emoji big">${esc(s.emoji)}</span>
        <h2 class="question" style="margin:4px 0">${esc(setName(s))}${s.spicy ? ' <span class="set-badge spicy">18+</span>' : ''}</h2>
        ${setDesc(s) ? `<p class="muted" style="margin:0">${esc(setDesc(s))}</p>` : ''}
        <p class="set-count" style="margin:10px 0 0">${T(`${s.played} jouée${s.played > 1 ? 's' : ''} · ${s.remaining} encore secrète${s.remaining > 1 ? 's' : ''}`, `${s.played} played · ${s.remaining} still secret`)}</p>
        <div class="row">
          <button class="btn btn-main" id="dropHere" ${s.remaining ? '' : 'disabled'}>${T('Lancer une question', 'Launch a question')}</button>
          ${canEdit ? `<button class="btn btn-soft" id="editSet">${T('Modifier', 'Edit')}</button>` : ''}
        </div>
      </div>

      <div class="card">
        <label for="newQ" style="margin-top:0">${T('Ajouter des questions', 'Add questions')}</label>
        <textarea class="input" id="newQ" placeholder="${T('Une question par ligne.&#10;Qui est le plus susceptible de…', 'One question per line.&#10;Who’s most likely to…')}"></textarea>
        <p class="muted small">${T('Elles restent secrètes jusqu’à ce qu’elles tombent. Pas de doublons : on vérifie !', 'They stay secret until they drop. No duplicates, we check!')}</p>
        <button class="btn btn-soft btn-block" id="addQ" style="margin-top:10px">${T('Ajouter au set', 'Add to the set')}</button>
      </div>

      ${d.mine.length ? `
        <div class="section-title">${T('Tes questions en attente', 'Your questions waiting')} <span class="count">${d.mine.length}</span></div>
        <div class="card qlist">${d.mine.map((q) => `
          <div class="qrow"><span>${esc(q.text)}</span><button class="btn btn-small btn-danger" data-delq="${q.id}" aria-label="${T('Supprimer', 'Delete')}">${icon('trash')}</button></div>`).join('')}
        </div>` : ''}

      <div class="section-title">${T('Déjà jouées', 'Already played')} <span class="count">${d.played.length}</span></div>
      ${d.played.length ? `<div class="card qlist">${d.played.map((q) => `<div class="qrow"><span>${esc(qText(q))}</span><span class="muted small">${ago(q.usedAt)}</span></div>`).join('')}</div>`
        : `<div class="card empty" style="padding:18px">${T('Aucune question jouée pour l’instant.', 'No questions played yet.')}</div>`}
      ${canEdit && !s.played ? `<button class="btn btn-danger btn-block" id="delSet">${T('Supprimer ce set', 'Delete this set')}</button>` : ''}`;

    document.getElementById('back').onclick = () => { openSet = null; renderView(); };
    document.getElementById('dropHere').onclick = () => openDropSheet(s.id);
    if (canEdit) document.getElementById('editSet').onclick = () => openSetForm(s);
    action(document.getElementById('addQ'), async () => {
      const text = document.getElementById('newQ').value;
      const r = await api('POST', `sets/${s.id}/questions`, { text });
      toast(r.added.length ? T(`${plural(r.added.length, 'question')} ajoutée${r.added.length > 1 ? 's' : ''}`, `${plural(r.added.length, 'question')} added`) : T('Rien ajouté', 'Nothing added'));
      if (r.errors.length) alert(T('Pas ajoutées :', 'Not added:') + '\n\n' + r.errors.join('\n'));
      setDetail = null;
      await refresh();
    });
    view.querySelectorAll('[data-delq]').forEach((b) => action(b, async () => {
      if (!confirm(T('Supprimer cette question ?', 'Delete this question?'))) return;
      await api('DELETE', `questions/${b.dataset.delq}`);
      setDetail = null;
      await refresh();
    }));
    action(document.getElementById('delSet'), async () => {
      if (!confirm(T(`Supprimer le set « ${s.name} » et ses questions ?`, `Delete the set “${s.name}” and its questions?`))) return;
      await api('DELETE', `sets/${s.id}`);
      openSet = null;
      toast(T('Set supprimé', 'Set deleted'));
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
        <button type="button" data-smode="me" class="${statsMode === 'me' ? 'on' : ''}">${T('Profil', 'Profile')}</button>
        <button type="button" data-smode="duo" class="${statsMode === 'duo' ? 'on' : ''}">${T('Affinités', 'Duos')}</button>
        <button type="button" data-smode="group" class="${statsMode === 'group' ? 'on' : ''}">${T('Groupe', 'Group')}</button>
      </div>
      ${strip}
      ${statsMode === 'duo' ? statsDuo(pid) : statsMode === 'group' ? statsGroup() : statsProfile(pid)}`;
    view.querySelectorAll('[data-player]').forEach((b) => (b.onclick = () => { statsPlayer = b.dataset.player; renderView(); }));
    view.querySelectorAll('[data-smode]').forEach((b) => (b.onclick = () => { statsMode = b.dataset.smode; save('statsMode', statsMode); renderView(); }));
    view.querySelectorAll('[data-goto]').forEach((b) => (b.onclick = () => { statsPlayer = b.dataset.goto; renderView(); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
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
        .filter((r) => r.v > 0)
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
            </div>`).join('') : `<div class="muted small">${T('Pas encore de données', 'No data yet')}</div>`}
        </div>`;
    };

    return `
      <div class="card radar-card">
        <div class="radar-title">${avatar(p)}<div><b>${esc(p.name)}</b>${ps.polls ? `<div class="muted small">${T(`A reçu des votes dans ${plural(ps.polls, 'sondage')} terminé${ps.polls > 1 ? 's' : ''}`, `Got votes in ${plural(ps.polls, 'finished poll')}`)}</div>` : ''}</div></div>
        ${anyData ? window.radarSvg(radarDefs, ps.value, p.color, active.length > 1 ? avg : null) : `<div class="empty">${T('Les stats arrivent quand les premiers sondages se terminent.', 'Stats show up once the first polls are over.')}</div>`}
        ${anyData && active.length > 1 ? `<div class="legend"><span class="dash"></span> ${T('moyenne du groupe', 'group average')}</div>` : ''}
        ${myTitles.length || unan.length ? `<div class="title-chips">${myTitles.map((t) => `<span class="title-chip ${t.low ? 'low' : ''}">${t.emoji} ${esc(titleText(t))}</span>`).join('')}${unan.length ? `<span class="title-chip moment" title="${T('Tout le monde a voté pour', 'Everyone voted for')} ${esc(p.name)}">👑 ${T('Unanimité', 'Unanimous')} ×${unan.length}</span>` : ''}</div>` : ''}
        ${anyData && st.ended < st.titlesAt ? `<p class="muted small" style="margin:10px 0 0">${T(`Les titres se débloquent après ${st.titlesAt} sondages terminés (encore ${st.titlesAt - st.ended}).`, `Titles unlock after ${st.titlesAt} finished polls (${st.titlesAt - st.ended} to go).`)}</p>` : ''}
      </div>
      ${ps.wins.length ? `
        <div class="section-title">${T('Élu pour…', 'Voted most…')} <span class="count">${ps.wins.length}</span></div>
        <div class="card qlist">${ps.wins.slice(0, 15).map((w) => `<div class="qrow"><span>${esc(qText(w))}</span><span class="muted small">${unan.some((u) => u.id === w.id) ? '👑' : esc(setOf(w.setId).emoji)}</span></div>`).join('')}</div>` : ''}
      ${unan.length ? `
        <div class="section-title">${T('Moments mémorables', 'Memorable moments')} <span class="count">${unan.length}</span></div>
        <div class="card qlist moments">${unan.slice(0, 10).map((w) => `<div class="qrow"><span>👑 ${esc(qText(w))}</span><span class="muted small">${T('tout le monde', 'everyone')}</span></div>`).join('')}</div>` : ''}
      ${st.titles.length ? `
        <div class="section-title">${T('Les titres du groupe', 'Group titles')}</div>
        <div class="card titles-board">${st.titles.map((t) => `
          <div class="title-row">${avatar(player(t.playerId), 'sm')}<span class="name">${esc(player(t.playerId).name)}</span><span class="title-chip ${t.low ? 'low' : ''}">${t.emoji} ${esc(titleText(t))}</span></div>`).join('')}
        </div>` : ''}
      ${anyData ? `<div class="section-title">${T('Classements', 'Rankings')}</div>${defs.map(ranking).join('')}` : ''}`;
  }

  // Affinités : qui vote comme toi, qui vote pour toi, qui a la même réputation que toi…
  function statsDuo(pid) {
    const aff = state.affinity;
    const p = player(pid);
    const you = pid === state.me.playerId;
    const others = state.players.filter((u) => u.id !== pid && aff.pairs[pid] && aff.pairs[pid][u.id]);
    const row = aff.pairs[pid] || {};
    if (aff.polls < 3 || !others.length) {
      return `<div class="card empty">${T('Les affinités arrivent après quelques sondages terminés (au moins 3).', 'Duos show up after a few finished polls (at least 3).')}${aff.polls ? `<br><span class="muted small">${T(`Encore ${3 - aff.polls}.`, `${3 - aff.polls} to go.`)}</span>` : ''}</div>`;
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
    const fan = best(others, (u) => aff.pairs[u.id][pid].given, 0);
    const target = best(others, (u) => row[u.id].given, 0);
    const twin = best(others, agreeOf);
    const opposite = best(others, (u) => (agreeOf(u) == null ? null : 100 - agreeOf(u)));
    const rep = best(others, (u) => row[u.id].sim);
    const antiRep = best(others, (u) => (row[u.id].sim == null ? null : 100 - row[u.id].sim));
    const duo = best(others, (u) => row[u.id].co, 0);
    const oneWay = best(others, (u) => {
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
        ? tile('💞', T('Amour réciproque', 'Mutual crush'), fan, (h) => T(`${votes(h.v)} pour ${you ? 'toi' : name}, ${votes(target.v)} dans l’autre sens`, `${votes(h.v)} for ${you ? 'you' : name}, ${votes(target.v)} the other way`))
        : tile('💘', T('Fan n°1', 'Biggest fan'), fan, (h) => T(`${you ? 't’a donné' : `a donné à ${name}`} ${votes(h.v)}`, `gave ${you ? 'you' : name} ${votes(h.v)}`)),
      mutual ? '' : tile('🎯', T('Cible préférée', 'Favourite target'), target, (h) => T(`${you ? 'tu lui as donné' : `${name} lui a donné`} ${votes(h.v)}`, `${you ? 'you gave them' : name + ' gave them'} ${votes(h.v)}`)),
      tile('👯', T('Jumeau de vote', 'Vote twin'), twin, (h) => T(`même vote ${h.v} % du temps`, `same vote ${h.v}% of the time`)),
      tile('🙃', T('Opposé de vote', 'Vote opposite'), opposite && (!twin || opposite.u.id !== twin.u.id) ? opposite : null, (h) => T(`même vote ${100 - h.v} % du temps seulement`, `same vote only ${100 - h.v}% of the time`)),
      tile('🪞', T('Même réputation', 'Same reputation'), rep, (h) => T(`votés sur les mêmes questions (${h.v} %)`, `voted on the same questions (${h.v}%)`)),
      tile('🌗', T('Tout l’inverse', 'Total opposite'), antiRep && (!rep || antiRep.u.id !== rep.u.id) ? antiRep : null, (h) => T(`jamais votés pour les mêmes trucs (${100 - h.v} %)`, `never voted for the same stuff (${100 - h.v}%)`)),
      tile('🤝', T('Duo inséparable', 'Inseparable duo'), duo, (h) => T(`dans les résultats ensemble ${plural(h.v, 'fois', 'fois')}`, `in the results together ${h.v} time${h.v > 1 ? 's' : ''}`)),
      tile('💔', T('Sens unique', 'One-sided'), oneWay, (h) => T(`${you ? 'tu votes' : name + ' vote'} pour ${esc(h.u.name)} (${votes(h.v)}), jamais l’inverse`, `${you ? 'you vote' : name + ' votes'} for ${esc(h.u.name)} (${votes(h.v)}), never the other way`)),
    ].join('');

    let flockLine = '';
    if (flock != null && flockAvg != null) {
      const kind = flock >= flockAvg + 10 ? ['🐑', T('Mouton', 'Sheep')] : flock <= flockAvg - 10 ? ['🦄', T('Rebelle', 'Rebel')] : ['⚖️', T('Dans la moyenne', 'Middle of the road')];
      flockLine = `
        <div class="card flock">
          <span class="duo-emoji">${kind[0]}</span>
          <div><b>${kind[1]}</b><div class="muted small">${T(`${you ? 'Tu votes' : name + ' vote'} comme la majorité ${flock} % du temps (groupe : ${flockAvg} %)`, `${you ? 'You vote' : name + ' votes'} with the majority ${flock}% of the time (group: ${flockAvg}%)`)}${me_.self ? ' · ' + T(`${votes(me_.self)} pour ${you ? 'toi-même' : 'soi'} 🪞`, `${votes(me_.self)} for ${you ? 'yourself' : 'themselves'} 🪞`) : ''}</div></div>
        </div>`;
    }

    // Toi et chacun : à quel point vous votez pareil, et les votes dans les deux sens.
    const rows = others
      .map((u) => ({ u, agree: agreeOf(u), sim: row[u.id].sim, out: row[u.id].given, back: aff.pairs[u.id][pid].given }))
      .sort((a, b) => (b.agree ?? -1) - (a.agree ?? -1));
    const table = `
      <div class="section-title">${you ? T('Toi et chacun', 'You and everyone') : T(`${name} et chacun`, `${name} and everyone`)}</div>
      <div class="card duo-table">
        <div class="dt-head"><span></span><span>${T('Votent pareil', 'Vote alike')}</span><span>${T('Votés pareil', 'Voted alike')}</span><span title="${T('votes donnés → / ← reçus', 'votes given → / ← received')}">→ ←</span></div>
        ${rows.map((r) => `
          <button class="dt-row" data-goto="${r.u.id}" style="--pc:${esc(r.u.color)}">
            <span class="dt-who">${avatar(r.u, 'xs')}<span>${esc(r.u.name)}</span></span>
            <span class="dt-bar">${r.agree == null ? '<i class="muted">–</i>' : `<span class="dt-track"><span style="width:${r.agree}%"></span></span><b>${r.agree}%</b>`}</span>
            <span class="dt-bar">${r.sim == null ? '<i class="muted">–</i>' : `<span class="dt-track sim"><span style="width:${r.sim}%"></span></span><b>${r.sim}%</b>`}</span>
            <span class="dt-io">${num(r.out)}·${num(r.back)}</span>
          </button>`).join('')}
        <p class="muted small dt-help">${T('« Votent pareil » : vous avez voté pour la même personne. « Votés pareil » : on vote pour vous deux sur les mêmes questions.', '“Vote alike”: you voted for the same person. “Voted alike”: people vote for you both on the same questions.')}</p>
      </div>`;

    return `
      <div class="duo-intro muted small">${T(`D’après ${plural(aff.polls, 'sondage terminé', 'sondages terminés')}.`, `Based on ${plural(aff.polls, 'finished poll')}.`)}</div>
      <div class="duo-grid">${tiles}</div>
      ${flockLine}
      ${table}`;
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
      [c.ended, T('sondages terminés', 'polls done')],
      [c.votes, T('votes', 'votes')],
      [c.halves, T('demi-votes', 'half votes')],
      [c.unanimous, T('unanimités', 'unanimous')],
      [c.split, T('zéro consensus', 'zero consensus')],
    ];
    const raters = [...r.raters].sort((a, b) => b.avg - a.avg);
    const generous = raters[0];
    const harsh = raters.length > 1 ? raters[raters.length - 1] : null;
    return `
      <div class="num-tiles">${tiles.map(([n, l]) => `<div class="num-tile"><b>${n}</b><span>${l}</span></div>`).join('')}</div>

      <div class="section-title">${T('Les questions préférées', 'Favourite questions')} ${r.questions ? `<span class="count">${r.count} ${T('notes', 'ratings')}</span>` : ''}</div>
      ${r.top.length ? `<div class="card qlist">${qList(r.top)}</div>` : `<div class="card empty" style="padding:18px">${T('Notez les questions (les étoiles sous les résultats) : les préférées du groupe apparaîtront ici.', 'Rate the questions (the stars under the results): the group’s favourites will show up here.')}</div>`}
      ${r.flop.length ? `<div class="section-title">${T('Les flops', 'The flops')}</div><div class="card qlist">${qList(r.flop)}</div>` : ''}
      ${r.sets.length ? `
        <div class="section-title">${T('Sets les mieux notés', 'Best rated sets')}</div>
        <div class="card qlist">${r.sets.map((x) => `<div class="qrow"><span>${esc(setOf(x.setId).emoji)} ${esc(setName(setOf(x.setId)))}</span><span class="q-rate">${stars(x.avg)}<small>${avgTxt(x.avg)} · ${x.n}</small></span></div>`).join('')}</div>` : ''}
      ${generous && harsh ? `
        <div class="duo-grid">
          <div class="duo-tile static" style="--pc:${esc(player(generous.playerId).color)}"><span class="duo-head"><span class="duo-emoji">😇</span><span class="duo-title">${T('Le plus généreux', 'Most generous')}</span></span><span class="duo-who">${avatar(player(generous.playerId), 'sm')}<b class="pname">${esc(player(generous.playerId).name)}</b></span><span class="duo-line">${T('note en moyenne', 'rates')} ${avgTxt(generous.avg)}/5</span></div>
          <div class="duo-tile static" style="--pc:${esc(player(harsh.playerId).color)}"><span class="duo-head"><span class="duo-emoji">🧐</span><span class="duo-title">${T('Le plus dur', 'Toughest critic')}</span></span><span class="duo-who">${avatar(player(harsh.playerId), 'sm')}<b class="pname">${esc(player(harsh.playerId).name)}</b></span><span class="duo-line">${T('note en moyenne', 'rates')} ${avgTxt(harsh.avg)}/5</span></div>
        </div>` : ''}
      ${gs.unanimous.length || gs.split.length ? `<div class="section-title">${T('Moments mémorables', 'Memorable moments')}</div>` : ''}
      ${gs.unanimous.length ? `<div class="card qlist moments">${gs.unanimous.map((u) => `
        <div class="qrow"><span>${esc(qText(u))}</span><span class="moment-who">👑 ${avatar(player(u.target), 'xs')}<small>${u.n}/${u.n}</small></span></div>`).join('')}</div>` : ''}
      ${gs.split.length ? `<div class="card qlist moments">${gs.split.map((u) => `
        <div class="qrow"><span>${esc(qText(u))}</span><span class="moment-who">🌪️<small>${T(`${u.n} avis`, `${u.n} answers`)}</small></span></div>`).join('')}</div>` : ''}`;
  }

  // ---------- Moi & admin ----------

  function renderMe(view) {
    const m = me();
    const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const pushOk = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && state.vapidKey;

    view.innerHTML = `
      <div class="card" id="profileCard">
        <div class="profile-row">
          <button class="photo-btn" id="photoBtn" aria-label="${T('Changer ma photo', 'Change my photo')}">${avatar(m, 'lg')}<span class="photo-edit">${icon('edit')}</span></button>
          <div class="profile-text">
            <b>${esc(m.name)}</b>
            <span class="muted small">${state.me.isAdmin ? T('Admin du groupe', 'Group admin') : T('Membre du groupe', 'Group member')}</span>
            <span class="photo-links">
              <button class="link-btn" id="photoBtn2">${m.photo ? T('Changer la photo', 'Change photo') : T('Ajouter une photo', 'Add a photo')}</button>
              ${m.photo ? `<button class="link-btn muted" id="photoDel">${T('Retirer', 'Remove')}</button>` : ''}
            </span>
          </div>
        </div>
        <label for="myName">${T('Pseudo', 'Name')}</label>
        <div class="inline-form">
          <input class="input" id="myName" maxlength="24" value="${esc(m.name)}">
          <button class="btn btn-soft" id="saveName">OK</button>
        </div>
        <label>${T('Ta couleur', 'Your color')}</label>
        ${colorPicker(m)}
      </div>

      <div class="card">
        <div class="card-title lang-title"><span>${T('Langue', 'Language')}</span>${langSwitch()}</div>
        <p class="muted small" style="margin:0">${T('Les questions intégrées, les menus et tes notifications passent dans cette langue.', 'Built-in questions, menus and your notifications switch to this language.')}</p>
      </div>

      <div class="card">
        <div class="card-title">${T('Groupe', 'Group')}</div>
        <div class="group-code-row">
          <span>${esc(state.group.name)}</span>
          <span class="code-pill">${esc(state.group.code)}</span>
        </div>
        <button class="btn btn-main btn-block" id="inviteBtn" style="margin-top:14px">${T('Inviter des potes', 'Invite your mates')}</button>
      </div>

      <div class="card">
        <div class="card-title">Notifications</div>
        <p class="muted small" id="pushStatus" style="margin:0 0 12px">…</p>
        ${iOS && !standalone ? `<div class="info" style="margin-bottom:12px">${T('Sur iPhone : touche <b>Partager</b> puis <b>Sur l’écran d’accueil</b>, et ouvre l’app depuis la nouvelle icône pour pouvoir activer les notifications.', 'On iPhone: tap <b>Share</b> then <b>Add to Home Screen</b>, and open the app from the new icon to be able to turn on notifications.')}</div>` : ''}
        <div class="row" style="margin-top:0">
          <button class="btn btn-main" id="pushBtn" ${pushOk ? '' : 'disabled'}>${T('Activer les notifications', 'Turn on notifications')}</button>
          <button class="btn btn-soft" id="pushTest" hidden>${T('Tester', 'Test')}</button>
        </div>
        <p class="push-out muted small" id="pushOut"></p>
        <div class="notif-prefs">
          ${[
            ['polls', T('Nouvelles questions', 'New questions')],
            ['votes', T('Quand quelqu’un vote', 'When someone votes')],
            ['chat', T('Messages', 'Messages')],
            ['mentions', T('Quand on te tague ou te répond', 'When someone tags you or replies to you'), T('Même si les messages sont coupés', 'Even if messages are off')],
          ].map(([k, label, sub]) => `
            <label class="switch-row"><span>${label}${sub ? `<small class="muted">${sub}</small>` : ''}</span><input type="checkbox" class="switch" data-notif="${k}" ${state.me.notif[k] ? 'checked' : ''}></label>`).join('')}
        </div>
      </div>

      ${state.me.isAdmin ? adminHtml() : ''}

      <button class="btn btn-soft btn-block" id="logout">${T('Se déconnecter', 'Log out')}</button>`;

    bindLangSwitch(view, () => renderMain());
    view.querySelectorAll('[data-color]').forEach((b) => action(b, async () => {
      if (b.classList.contains('on')) return;
      await api('PATCH', 'me', { color: b.dataset.color });
      toast(T('Couleur changée', 'Color changed'));
      await refresh();
    }));
    action(document.getElementById('saveName'), async () => {
      await api('PATCH', 'me', { name: document.getElementById('myName').value });
      document.activeElement.blur();
      toast(T('Pseudo changé', 'Name changed'));
      await refresh();
    });
    const changePhoto = async () => {
      const data = await pickPhoto();
      if (!data) return;
      try {
        await api('POST', 'me/photo', { data });
        toast(T('Photo mise à jour', 'Photo updated'));
        await refresh();
      } catch (e) { toast(e.message); }
    };
    document.getElementById('photoBtn').onclick = changePhoto;
    document.getElementById('photoBtn2').onclick = changePhoto;
    action(document.getElementById('photoDel'), async () => {
      await api('DELETE', 'me/photo');
      toast(T('Photo retirée', 'Photo removed'));
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
      return `<button type="button" class="swatch ${c === m.color ? 'on' : ''} ${o ? 'taken' : ''}" style="--pc:${c}" ${o ? 'disabled' : `data-color="${c}"`} aria-label="${o ? T('Prise par', 'Taken by') + ' ' + esc(o.name) : c}" title="${o ? esc(o.name) : ''}">${o ? avatar(o, 'xs') : c === m.color ? icon('check') : ''}</button>`;
    }).join('')}</div>`;
  }

  function adminHtml() {
    const s = state.settings;
    // Fin : de « début + 1 h » à « début − 1 h » (le lendemain). Les deux heures sont incluses.
    const endOptions = (start, end) => Array.from({ length: 23 }, (_, i) => (start + 1 + i) % 24)
      .map((h) => `<option value="${h}" ${h === end ? 'selected' : ''}>${hourLabel(h)}${h < start ? T(' (lendemain)', ' (next day)') : ''}</option>`).join('');
    return `
      <div class="section-title">Admin</div>

      <div class="card">
        <div class="card-title">${T('Nom du groupe', 'Group name')}</div>
        <div class="inline-form">
          <input class="input" id="groupName" maxlength="40" value="${esc(state.group.name)}">
          <button class="btn btn-soft" id="saveGroup">OK</button>
        </div>
        <p class="muted small" style="margin:10px 0 0">${T('Le code a fuité ? Génère-en un nouveau : l’ancien ne marchera plus (ceux qui ont déjà rejoint restent connectés).', 'Code leaked? Make a new one: the old one stops working (people who already joined stay logged in).')}</p>
        <button class="btn btn-soft btn-block" id="newCode" style="margin-top:10px">${T('Générer un nouveau code', 'Make a new code')}</button>
      </div>

      <div class="card">
        <div class="card-title">${T('Les potes', 'Your mates')} <span class="muted small">· ${state.players.length}</span></div>
        <p class="muted small">${T('Ajoute tout le monde ici, même ceux qui n’ont pas encore rejoint : on peut déjà voter pour eux.', 'Add everyone here, even people who haven’t joined yet: you can already vote for them.')}</p>
        <div class="roster">${state.players.map((p) => `
          <div class="roster-row">
            ${avatar(p, 'sm')}
            <span class="name">${esc(p.name)}</span>
            <span class="status ${p.claimed ? 'on' : ''}">${p.claimed ? T('a rejoint', 'joined') : T('en attente', 'waiting')}</span>
            <button class="icon-btn" data-rename="${p.id}" title="${T('Renommer', 'Rename')}" aria-label="${T('Renommer', 'Rename')}">${icon('edit')}</button>
            ${p.claimed && p.id !== state.me.playerId ? `<button class="icon-btn" data-reset="${p.id}" title="${T('Réinitialiser le compte (PIN oublié)', 'Reset the account (forgot PIN)')}" aria-label="${T('Réinitialiser', 'Reset')}">${icon('key')}</button>` : ''}
            ${!p.claimed ? `<button class="icon-btn" data-remove="${p.id}" title="${T('Retirer', 'Remove')}" aria-label="${T('Retirer', 'Remove')}">${icon('trash')}</button>` : ''}
          </div>`).join('')}
        </div>
        <textarea class="input" id="rosterAdd" placeholder="${T('Un nom par ligne&#10;Alex&#10;John&#10;Carlos', 'One name per line&#10;Alex&#10;John&#10;Carlos')}" style="margin-top:12px;min-height:80px"></textarea>
        <button class="btn btn-main btn-block" id="rosterBtn" style="margin-top:10px">${T('Ajouter', 'Add')}</button>
      </div>

      <div class="card">
        <div class="card-title">${T('Planning des questions', 'Question schedule')}</div>
        <div class="settings-grid">
          <label>${T('Toutes les (heures)', 'Every (hours)')}<input class="input" id="sInterval" type="number" inputmode="decimal" step="0.25" min="0.02" max="24" value="${s.intervalHours}"></label>
          <label>${T('Durée du vote (heures)', 'Voting time (hours)')}<input class="input" id="sPoll" type="number" inputmode="decimal" step="1" min="0.02" max="168" value="${s.pollHours}"></label>
          <label>${T('À partir de', 'From')}<select class="input" id="sStart">${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === s.startHour ? 'selected' : ''}>${hourLabel(h)}</option>`).join('')}</select></label>
          <label>${T('Jusqu’à (inclus)', 'Until (included)')}<select class="input" id="sEnd">${endOptions(s.startHour, s.endHour)}</select></label>
        </div>
        <p class="muted small" id="sWindow" style="margin:8px 0 0">${scheduleText(s)}</p>
        <label>${T('Fuseau horaire', 'Time zone')}<input class="input" id="sTz" value="${esc(s.timezone)}"></label>
        <p class="muted small">${T('Prochaine question auto', 'Next auto question')} : <b>${state.nextDrop ? clock(state.nextDrop) : '—'}</b> · ${plural(state.remainingQuestions, 'question')} ${T('en réserve', 'left')}</p>
        <p class="muted small" style="margin-top:0">${T('Une nouvelle durée de vote s’applique aussi aux questions en cours.', 'A new voting time also applies to the questions already running.')}</p>
        <div class="row">
          <button class="btn btn-main" id="saveSettings">${T('Enregistrer', 'Save')}</button>
          <button class="btn btn-soft" id="forceDrop">${T('Lancer maintenant', 'Launch now')}</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">${T('Options de vote', 'Voting options')}</div>
        <label class="switch-row"><span>${T('Réponse « Personne »', '“Nobody” answer')}<small class="muted">${T('Sur les questions au conditionnel (« Qui ferait… »), on peut voter pour personne.', 'On “Who would…” questions, people can vote for nobody.')}</small></span><input type="checkbox" class="switch" id="allowNobody" ${s.allowNobody ? 'checked' : ''}></label>
      </div>

      <div class="card">
        <div class="card-title">${T('Questions à noter', 'Questions to score')}</div>
        <p class="muted small">${T('Les questions créées par le groupe n’ont pas encore de stats. Copie-les, donne-les à Claude, puis colle sa réponse ici.', 'Questions written by the group don’t have stats yet. Copy them, give them to Claude, then paste its answer here.')}</p>
        <button class="btn btn-soft btn-block" id="exportQ">${T('Copier les questions à noter', 'Copy the questions to score')}</button>
        <textarea class="input" id="scoresIn" placeholder='${T('Réponse de Claude', 'Claude’s answer')} : {"id": {"chaos": 2, "hot": 1}, …}' style="margin-top:12px;min-height:80px"></textarea>
        <button class="btn btn-main btn-block" id="importQ" style="margin-top:10px">${T('Importer les scores', 'Import the scores')}</button>
      </div>

      <div class="card">
        <div class="card-title">${T('Notes des questions', 'Question ratings')}</div>
        <p class="muted small">${T(`${plural(state.groupStats.ratings.count, 'note')} données par le groupe. Copie-les pour une IA : elle saura quel genre de questions vous aimez pour en écrire de nouvelles.`, `${plural(state.groupStats.ratings.count, 'rating')} from the group. Copy them for an AI: it’ll know what kind of questions you like and can write new ones.`)}</p>
        <button class="btn btn-soft btn-block" id="exportRatings" ${state.groupStats.ratings.count ? '' : 'disabled'}>${T('Copier les notes (JSON)', 'Copy the ratings (JSON)')}</button>
      </div>`;
  }

  function bindAdmin(view) {
    action(document.getElementById('saveGroup'), async () => {
      await api('PATCH', 'admin/group', { name: document.getElementById('groupName').value });
      document.activeElement.blur();
      toast(T('Groupe renommé', 'Group renamed'));
      await refresh();
    });
    action(document.getElementById('newCode'), async () => {
      if (!confirm(T('Générer un nouveau code ? L’ancien ne marchera plus.', 'Make a new code? The old one will stop working.'))) return;
      const { group } = await api('POST', 'admin/group/code');
      save('code', group.code);
      toast(T('Nouveau code : ', 'New code: ') + group.code);
      await refresh();
    });
    action(document.getElementById('rosterBtn'), async () => {
      const r = await api('POST', 'admin/players', { names: document.getElementById('rosterAdd').value });
      toast(r.added.length ? T(`${plural(r.added.length, 'pote')} ajouté${r.added.length > 1 ? 's' : ''}`, `${plural(r.added.length, 'mate')} added`) : T('Personne d’ajouté', 'Nobody added'));
      if (r.errors.length) alert(r.errors.join('\n'));
      await refresh();
    });
    view.querySelectorAll('[data-rename]').forEach((b) => action(b, async () => {
      const p = player(b.dataset.rename);
      const name = prompt(T('Nouveau nom pour ', 'New name for ') + p.name, p.name);
      if (!name || name === p.name) return;
      await api('PATCH', `admin/players/${p.id}`, { name });
      await refresh();
    }));
    view.querySelectorAll('[data-reset]').forEach((b) => action(b, async () => {
      const p = player(b.dataset.reset);
      if (!confirm(T(`Réinitialiser le compte de ${p.name} ? Iel devra rejoindre à nouveau avec un nouveau PIN (ses votes sont gardés).`, `Reset ${p.name}’s account? They’ll have to join again with a new PIN (their votes are kept).`))) return;
      await api('POST', `admin/players/${p.id}/reset`);
      toast(T('Compte réinitialisé', 'Account reset'));
      await refresh();
    }));
    view.querySelectorAll('[data-remove]').forEach((b) => action(b, async () => {
      const p = player(b.dataset.remove);
      if (!confirm(T(`Retirer ${p.name} du groupe ?`, `Remove ${p.name} from the group?`))) return;
      await api('DELETE', `admin/players/${p.id}`);
      await refresh();
    }));
    action(document.getElementById('saveSettings'), async () => {
      const v = (id) => document.getElementById(id).value;
      await api('PATCH', 'admin/settings', { intervalHours: v('sInterval'), pollHours: v('sPoll'), startHour: v('sStart'), endHour: v('sEnd'), timezone: v('sTz') });
      toast(T('Planning enregistré ⏰', 'Schedule saved ⏰'));
      document.activeElement.blur();
      await refresh();
    });
    document.getElementById('allowNobody').onchange = async (e) => {
      try {
        await api('PATCH', 'admin/settings', { allowNobody: e.target.checked });
        toast(e.target.checked ? T('Réponse « Personne » activée', '“Nobody” answer on') : T('Réponse « Personne » désactivée', '“Nobody” answer off'));
        await refresh();
      } catch (err) {
        e.target.checked = !e.target.checked;
        toast(err.message);
      }
    };
    action(document.getElementById('forceDrop'), async () => {
      const { poll } = await api('POST', 'admin/drop-auto');
      replacePoll(poll);
      toast(T('Question lancée', 'Question launched'));
      go('live');
      await refresh();
    });
    action(document.getElementById('exportQ'), async () => {
      const { questions } = await api('GET', 'admin/unscored');
      if (!questions.length) return toast(T('Rien à noter, tout est à jour', 'Nothing to score, all up to date'));
      const text = T('Questions « Qui de nous ? » à noter (stats : chaos, hot, coeur, cerveau, genance, toxique, exces ; 1 à 3 stats par question, valeurs -2 à 3). Réponds en JSON {"id": {"stat": valeur}}.', '“Which of us?” questions to score (stats: chaos, hot, coeur, cerveau, genance, toxique, exces; 1 to 3 stats per question, values -2 to 3). Answer in JSON {"id": {"stat": value}}.') + '\n\n' + JSON.stringify(questions, null, 1);
      try {
        await navigator.clipboard.writeText(text);
        toast(T(`${plural(questions.length, 'question')} copiée${questions.length > 1 ? 's' : ''}`, `${plural(questions.length, 'question')} copied`));
      } catch {
        document.getElementById('scoresIn').value = text;
        toast(T('Copie impossible : le texte est dans la case, copie-le à la main', 'Couldn’t copy: the text is in the box, copy it by hand'));
      }
    });
    action(document.getElementById('importQ'), async () => {
      const raw = document.getElementById('scoresIn').value.trim();
      const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
      let scores;
      try { scores = JSON.parse(json); } catch { throw new Error(T('JSON invalide', 'Invalid JSON')); }
      const r = await api('POST', 'admin/scores', { scores });
      toast(T(`${plural(r.updated, 'question')} notée${r.updated > 1 ? 's' : ''}`, `${plural(r.updated, 'question')} scored`));
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
        .map((h) => `<option value="${h}" ${h === end ? 'selected' : ''}>${hourLabel(h)}${h < start ? T(' (lendemain)', ' (next day)') : ''}</option>`).join('');
      document.getElementById('sWindow').textContent = scheduleText({ ...state.settings, intervalHours: Number(document.getElementById('sInterval').value) || state.settings.intervalHours, startHour: start, endHour: end });
    };
    sStart.onchange = sync;
    sEnd.onchange = sync;
    document.getElementById('sInterval').oninput = sync;
    action(document.getElementById('exportRatings'), async () => {
      const data = await api('GET', 'admin/ratings');
      const text = T('Notes des questions « Qui de nous ? » (1 = nulle, 5 = excellente), à utiliser pour écrire de nouvelles questions dans le même esprit que les mieux notées.', 'Ratings of the “Which of us?” questions (1 = bad, 5 = great), to use for writing new questions in the same spirit as the best rated ones.') + '\n\n' + JSON.stringify(data, null, 1);
      try {
        await navigator.clipboard.writeText(text);
        toast(T('Notes copiées', 'Ratings copied'));
      } catch {
        document.getElementById('scoresIn').value = text;
        toast(T('Copie impossible : le texte est dans la case « Questions à noter »', 'Couldn’t copy: the text is in the “Questions to score” box'));
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
        const res = await fetch('/api/events', { headers: { Authorization: 'Bearer ' + token }, signal: ctrl.signal });
        if (!res.ok || !res.body) throw new Error('live');
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
        if (chatOpen === d.channel) renderChatMessages();
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
    if (t.locked) return `<span class="locked-line">${icon('lock')}${T('Vote pour voir les messages', 'Vote to see the messages')}</span>`;
    const m = t.last[0];
    if (!m) return `<i>${T('Aucun message : lance la discussion !', 'No messages yet: get it going!')}</i>`;
    const who = m.playerId === state.me.playerId ? T('Toi', 'You') : esc(player(m.playerId).name);
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
      const text = m.deleted ? `<i>${T('message supprimé', 'message deleted')}</i>` : m.kind === 'text' ? mentionHtml(m) : msgSnippet(m);
      return `
        <div class="mini-msg ${mine ? 'mine' : ''}">
          ${mine ? '' : avatar(u, 'xs')}
          <div class="mini-body">${mine ? '' : `<span class="mini-name pname" style="--pc:${esc(u.color)}">${esc(u.name)}</span>`}<span class="mini-bubble">${text}</span></div>
        </div>`;
    }).join('');

    view.innerHTML = `
      <button class="card group-chat" data-thread="general">
        <div class="gc-head">
          <span class="gc-title">👥 ${T('Chat du groupe', 'Group chat')}</span>
          ${general.unread ? `<span class="thread-badge">${general.unread}</span>` : general.last.length ? `<span class="small muted">${ago(general.last[general.last.length - 1].at)}</span>` : ''}
        </div>
        <div class="gc-msgs">${mini || `<p class="muted small" style="margin:8px 0">${T('Aucun message pour l’instant. Dis bonjour !', 'No messages yet. Say hi!')}</p>`}</div>
        <div class="gc-input">${T('Écrire un message…', 'Write a message…')}</div>
      </button>
      <div class="section-title">${T('Discussions des questions en cours', 'Chats on live questions')}</div>
      ${others.length
        ? `<div class="card threads">${others.map((t) => row(t, esc(qText(t)), esc(setOf(t.setId).emoji))).join('')}</div>`
        : `<div class="card empty" style="padding:18px">${T('Les discussions des questions en cours apparaîtront ici.<br>Une fois la question terminée, sa discussion reste dans les Archives.', 'Chats on the live questions show up here.<br>Once a question is over, its chat stays in the Archive.')}</div>`}`;
    view.querySelectorAll('[data-thread]').forEach((b) => (b.onclick = () => openChat(b.dataset.thread)));
  }

  // ---------- Chat : fenêtre de discussion ----------

  const $chat = document.getElementById('chatOverlay');
  let gifTimer = null;
  let lastTypingSent = 0;
  let readTimer = null;
  let replyTo = null; // message auquel on répond (glissé vers la droite)
  let pendingImages = []; // photos en cours d'envoi : { tmp, url, w, h }

  const tz = () => state.settings.timezone;
  const dayKey = (t) => new Date(t).toLocaleDateString('fr-FR', { timeZone: tz() });
  const hhmm = (t) => new Date(t).toLocaleTimeString(LOC, { hour: '2-digit', minute: '2-digit', timeZone: tz() });
  function dayLabel(t) {
    if (dayKey(t) === dayKey(now())) return T('Aujourd’hui', 'Today');
    if (dayKey(t) === dayKey(now() - 86400000)) return T('Hier', 'Yesterday');
    return new Date(t).toLocaleDateString(LOC, { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz() });
  }

  function findPoll(id) {
    return [...state.live, ...state.archive, ...((archiveExtra && archiveExtra.items) || [])].find((p) => p.id === id);
  }

  function openChat(channel) {
    if (chatOpen) closeChat(true);
    chatOpen = channel;
    selMsg = null;
    replyTo = null;
    pendingImages = [];
    const gifLabel = state.chat.gifs === 'tenor' ? T('Rechercher sur Tenor', 'Search Tenor') : T('Rechercher un GIF…', 'Search for a GIF…');
    $chat.innerHTML = `
      <div class="chat-head">
        <button class="chat-back" id="chatBack" aria-label="${T('Retour', 'Back')}">${icon('back')}</button>
        <div class="chat-title" id="chatTitle"></div>
      </div>
      <div class="chat-list" id="chatList"><div class="chat-empty">${T('Chargement…', 'Loading…')}</div></div>
      <div class="chat-typing" id="chatTyping"></div>
      <div class="gif-panel" id="gifPanel" hidden>
        <input class="input" id="gifSearch" placeholder="${gifLabel}" autocomplete="off" enterkeyhint="search">
        <div class="gif-grid" id="gifGrid"></div>
        ${state.chat.gifs === 'giphy' ? '<div class="gif-credit">Powered by GIPHY</div>' : ''}
      </div>
      <div class="mention-box" id="mentionBox" hidden></div>
      <div class="reply-bar" id="replyBar" hidden></div>
      <form class="chat-input" id="chatForm">
        <button type="button" class="att-btn" id="photoSend" aria-label="${T('Envoyer une photo', 'Send a photo')}">${icon('image')}</button>
        <button type="button" class="gif-btn" id="gifBtn">GIF</button>
        <textarea id="chatText" rows="1" maxlength="1000" placeholder="${T('Message…', 'Message…')}" enterkeyhint="send"></textarea>
        <button type="submit" class="send-btn" aria-label="${T('Envoyer', 'Send')}">${icon('send')}</button>
      </form>`;
    $chat.hidden = false;
    document.body.classList.add('noscroll');
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
  const atRoot = () => !chatOpen && !viewerOpen() && $sheet.hidden && tab === 'live' && liveMode === 'live' && !openSet && !openPolls.size && !halfPick;

  function syncGuard() {
    if (!state) return;
    const guarded = !!(history.state && history.state.guard);
    if (!atRoot() && !guarded) history.pushState({ guard: true }, '');
    else if (atRoot() && guarded && !popIgnore) {
      popIgnore = true;
      history.back();
    }
  }

  // Ferme la couche du dessus. Renvoie false s'il n'y avait rien à fermer.
  function goBack() {
    if (!state) return false;
    // Dans l'ordre d'affichage : la photo en grand et les fenêtres passent au-dessus du chat.
    if (viewerOpen()) closeViewer();
    else if (!$sheet.hidden) closeSheet();
    else if (chatOpen) closeChat(true);
    else if (halfPick) { halfPick = null; renderView(); }
    else if (openSet) { openSet = null; renderView(); }
    else if (openPolls.size || editing) { openPolls.clear(); editing = null; renderView(); }
    else if (tab === 'live' && liveMode === 'archive') { liveMode = 'live'; save('liveMode', liveMode); renderView(); window.scrollTo({ top: 0 }); }
    else if (tab !== 'live') go('live');
    else return false;
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
  if (isIOS && isStandalone()) {
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
  function fitChat() {
    if (!chatOpen) return;
    const vv = window.visualViewport;
    if (!vv) return;
    $chat.style.height = vv.height + 'px';
    $chat.style.top = vv.offsetTop + 'px';
    const kb = window.innerHeight - vv.height > 120;
    $chat.classList.toggle('kb-open', kb);
    if (kb && document.activeElement && document.activeElement.id === 'chatText') {
      const list = document.getElementById('chatList');
      if (list && list.scrollHeight - list.scrollTop - list.clientHeight < 160) scrollChatBottom();
    }
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', fitChat);
    window.visualViewport.addEventListener('scroll', fitChat);
  }

  function renderChatHeader() {
    const el = document.getElementById('chatTitle');
    if (!el) return;
    if (chatOpen === 'general') {
      el.innerHTML = `<b>${T('Chat du groupe', 'Group chat')}</b><span>${esc(state.group.name)} · ${plural(state.players.filter((p) => p.claimed).length, T('membre', 'member'))}</span>`;
      return;
    }
    const c = chats.get(chatOpen);
    const p = findPoll(chatOpen) || (c && c.poll);
    const t = state.chat.threads.find((x) => x.channel === chatOpen);
    const s = setOf((p || t || {}).setId);
    const ended = p && (p.ended || p.endsAt <= now());
    const status = p ? (ended ? T('terminé', 'over') : T('encore ', '') + left(p.endsAt) + T('', ' left')) : '';
    el.innerHTML = `<b class="clamp2">${esc(qText(p || t) || T('Discussion', 'Chat'))}</b><span>${esc(s.emoji)} ${esc(setName(s))}${status ? ' · ' + status : ''}</span>`;
  }

  async function loadChat(channel, force) {
    const c = chats.get(channel);
    if (c && c.loaded && !force) {
      renderChatMessages(true);
      markReadSoon();
      return;
    }
    try {
      const r = await api('GET', `chat/${channel}`);
      chats.set(channel, { messages: r.messages, reads: r.reads, hasMore: r.hasMore, loaded: true, locked: !!r.locked, count: r.count || 0, poll: r.poll || null });
      if (chatOpen === channel) {
        renderChatHeader();
        renderChatMessages(true);
        markReadSoon();
      }
    } catch (e) {
      toast(e.message);
    }
  }

  function scrollChatBottom() {
    const list = document.getElementById('chatList');
    if (list) list.scrollTop = list.scrollHeight;
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
    const and = T(' et ', ' and ');
    return names.length <= max ? names.join(', ').replace(/, ([^,]*)$/, `${and}$1`) : `${names.slice(0, max).join(', ')}${and}${names.length - max} ${T('autres', 'others')}`;
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
          ? reacts.map((r) => `<span class="md-react"><span class="md-emoji">${r.emoji}</span><span class="md-names">${r.players.map((pid) => `<b class="pname" style="--pc:${esc(player(pid).color)}">${esc(pid === state.me.playerId ? T('Toi', 'You') : player(pid).name)}</b>`).join(', ')}</span></span>`).join('')
          : `<span class="muted">${T('Double tape pour ❤️ · reste appuyé pour réagir · glisse à droite pour répondre', 'Double tap to ❤️ · hold to react · swipe right to reply')}</span>`}</div>
        <div class="md-foot">
          <span class="muted">${hhmm(m.at)}</span>
          <span class="md-actions">
            <button class="md-reply" data-replymsg="${m.id}">${icon('reply')}${T('Répondre', 'Reply')}</button>
            ${mine || state.me.isAdmin ? `<button class="md-del" data-delmsg="${m.id}">${icon('trash')}${T('Supprimer', 'Delete')}</button>` : ''}
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
    if (navigator.vibrate) navigator.vibrate(10);
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
      <div class="sheet-head"><h2>${T('Réagir', 'React')}</h2><button class="x" data-close>✕</button></div>
      <p class="react-preview"><b class="pname" style="--pc:${esc(player(m.playerId).color)}">${esc(player(m.playerId).name)}</b> ${preview}</p>
      <div class="react-quick">${REACTIONS.map((e) => `<button data-pick="${e}" class="${mine === e ? 'on' : ''}">${e}</button>`).join('')}</div>
      <div class="react-type">
        <input class="input" id="emojiInput" placeholder="${T('Ou tape n’importe quel emoji…', 'Or type any emoji…')}" autocomplete="off" enterkeyhint="done">
      </div>
      <div class="emoji-all">${EMOJI_GRID.map((e) => `<button data-pick="${e}" class="${mine === e ? 'on' : ''}">${e}</button>`).join('')}</div>
      <div class="react-actions">
        <button class="link-btn" id="pickReply">${icon('reply')} ${T('Répondre', 'Reply')}</button>
        ${mine ? `<button class="link-btn" data-pick="${esc(mine)}">${T('Retirer ma réaction', 'Remove my reaction')} ${mine}</button>` : ''}
      </div>`, (root) => {
      const pick = (e) => { closeSheet(); reactTo(m.id, e); };
      root.querySelectorAll('[data-pick]').forEach((b) => (b.onclick = () => pick(b.dataset.pick)));
      root.querySelector('#pickReply').onclick = () => { closeSheet(); setReply(m); };
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
        if (navigator.vibrate) navigator.vibrate(12);
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
      if (s.dx >= 60 && !s.buzzed) { s.buzzed = true; if (navigator.vibrate) navigator.vibrate(8); }
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
      <span class="rb-body" style="--pc:${esc(u.color)}"><b class="pname">${T('Répondre à', 'Replying to')} ${esc(u.id === state.me.playerId ? T('toi', 'yourself') : u.name)}</b><span>${msgSnippet(replyTo)}</span></span>
      <button type="button" class="x" id="replyCancel" aria-label="${T('Annuler', 'Cancel')}">✕</button>`;
    document.getElementById('replyCancel').onclick = () => setReply(null);
    const text = document.getElementById('chatText');
    if (text && !text.disabled) text.focus();
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
        reject(new Error(T('Image illisible', 'Can’t read that image')));
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
      <div class="viewer-top"><span>${avatar(u, 'xs')} ${esc(u.name)} · ${hhmm(m.at)}</span><button class="x" aria-label="${T('Fermer', 'Close')}">✕</button></div>
      <img src="/api/images/${esc(m.image.id)}" alt="">`;
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
    const what = r.deleted ? `<i>${T('message supprimé', 'message deleted')}</i>` : r.kind === 'gif' ? 'GIF' : r.kind === 'image' ? `📷 ${T('Photo', 'Photo')}` : esc(r.text);
    return `<span class="reply-quote" data-jump="${r.id}" style="--pc:${esc(u.color)}"><b class="pname">${esc(u.id === state.me.playerId ? T('Toi', 'You') : u.name)}</b><span>${what}</span></span>`;
  }

  function renderChatMessages(forceBottom) {
    const list = document.getElementById('chatList');
    const c = chats.get(chatOpen);
    if (!list || !c) return;
    const atBottom = forceBottom || list.scrollHeight - list.scrollTop - list.clientHeight < 120;
    const myPid = state.me.playerId;
    lockChatInput(!!c.locked);
    if (c.locked) {
      list.innerHTML = `
        <div class="chat-locked">
          <span class="cl-ico">${icon('lock')}</span>
          <b>${T('Vote d’abord', 'Vote first')}</b>
          <p class="muted">${c.count ? T(`${plural(c.count, 'message')} t’attend${c.count > 1 ? 'ent' : ''} ici. `, `${plural(c.count, 'message')} waiting here. `) : ''}${T('Pour que personne ne soit influencé, la discussion s’ouvre une fois que tu as voté.', 'So nobody gets influenced, the chat opens once you’ve voted.')}</p>
          <button class="btn btn-main" id="goVote">${T('Aller voter', 'Go vote')}</button>
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

    let html = c.hasMore ? `<button class="chat-older" id="chatOlder">${T('Messages précédents', 'Older messages')}</button>` : '';
    if (!c.messages.length && !pendingImages.length) {
      html += `<div class="chat-empty">${chatOpen === 'general' ? T('Aucun message pour l’instant. Dis bonjour !', 'No messages yet. Say hi!') : T('Personne n’a encore commenté. Lance le débat !', 'Nobody commented yet. Start the debate!')}</div>`;
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
      const media = !m.deleted && (m.kind === 'gif' || m.kind === 'image');
      const content = m.deleted
        ? `<i>${T('Message supprimé', 'Message deleted')}</i>`
        : m.kind === 'gif'
          ? `<img src="${esc(m.gif.url)}" width="${m.gif.w}" height="${m.gif.h}" alt="GIF" loading="lazy">`
          : m.kind === 'image'
            ? `<img src="/api/images/${esc(m.image.id)}" width="${m.image.w}" height="${m.image.h}" alt="${T('Photo', 'Photo')}" loading="lazy" decoding="async">`
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
    // Accusé de lecture, en clair, sous le dernier message seulement (le détail : en touchant un message).
    const lastMsg = c.messages[c.messages.length - 1];
    if (lastMsg && selMsg !== lastMsg.id && !pendingImages.length) {
      const { seen, unseen } = seenBy(c, lastMsg);
      const mineLast = lastMsg.playerId === myPid;
      let label = '';
      if (seen.length && !unseen.length) label = T('Vu par tout le monde', 'Seen by everyone');
      else if (seen.length) label = `${T('Vu par', 'Seen by')} ${namesList(seen)}`;
      else if (mineLast) label = T('Envoyé', 'Sent');
      if (label) html += `<div class="seen-line ${mineLast ? 'mine' : ''}">${icon('check')}<span>${label}</span></div>`;
    }
    list.innerHTML = html;

    list.querySelectorAll('img').forEach((img) => (img.onload = () => { if (atBottom) scrollChatBottom(); }));
    list.querySelectorAll('[data-msg]').forEach((b) => bindMessagePress(b, Number(b.dataset.msg)));
    list.querySelectorAll('[data-row]').forEach((r) => { if (r.querySelector('.swipe-hint')) bindSwipeReply(r, Number(r.dataset.row)); });
    list.querySelectorAll('[data-jump]').forEach((q) => (q.onclick = (e) => {
      e.stopPropagation();
      const el = document.getElementById('msg-' + q.dataset.jump);
      if (!el) return toast(T('Message trop ancien : remonte la discussion', 'Message is too old: scroll up the chat'));
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
        if (!confirm(T('Supprimer ce message pour tout le monde ?', 'Delete this message for everyone?'))) return;
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

  function lockChatInput(locked) {
    const form = document.getElementById('chatForm');
    if (!form) return;
    form.classList.toggle('locked', locked);
    form.querySelectorAll('textarea, button').forEach((el) => (el.disabled = locked));
    const t = document.getElementById('chatText');
    if (t) t.placeholder = locked ? T('Vote d’abord pour écrire…', 'Vote first to write…') : T('Message…', 'Message…');
  }

  function renderTyping() {
    const el = document.getElementById('chatTyping');
    if (!el) return;
    const t = typing.get(chatOpen);
    const who = t ? [...t].filter(([, exp]) => exp > Date.now()).map(([pid]) => player(pid).name) : [];
    el.innerHTML = who.length
      ? `<span class="dots"><i></i><i></i><i></i></span>${esc(who.length === 1
        ? T(`${who[0]} écrit…`, `${who[0]} is typing…`)
        : who.length === 2 ? T(`${who[0]} et ${who[1]} écrivent…`, `${who[0]} and ${who[1]} are typing…`) : T('Plusieurs personnes écrivent…', 'Several people are typing…'))}`
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
      document.getElementById('gifGrid').innerHTML = `<p class="muted small gif-msg">${T('Les GIFs ne sont pas encore activés sur le serveur (il manque une clé GIPHY).', 'GIFs aren’t turned on on the server yet (missing GIPHY key).')}</p>`;
      return;
    }
    document.getElementById('chatText').blur();
    searchGifs(document.getElementById('gifSearch').value);
  }

  async function searchGifs(q) {
    const grid = document.getElementById('gifGrid');
    if (!grid) return;
    grid.innerHTML = `<p class="muted small gif-msg">${T('Chargement…', 'Loading…')}</p>`;
    try {
      const { results } = await api('GET', 'gifs?q=' + encodeURIComponent(q.trim()));
      if (!document.getElementById('gifGrid')) return;
      grid.innerHTML = results.length
        ? results.map((r, i) => `<button type="button" class="gif-item" data-gif="${i}"><img src="${esc(r.preview)}" alt="GIF" loading="lazy"></button>`).join('')
        : `<p class="muted small gif-msg">${T('Aucun GIF trouvé 🤷', 'No GIFs found 🤷')}</p>`;
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
      const ch = e.data && e.data.type === 'open' && new URL(e.data.url, location.origin).searchParams.get('chat');
      if (ch && state) openChat(ch);
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
      const b = b64ToBytes(state.vapidKey);
      return a.length === b.length && a.every((x, i) => x === b[i]);
    } catch {
      return true;
    }
  }

  // (Ré)abonne cet appareil et le déclare au serveur.
  async function subscribePush() {
    const reg = swReg || (await swReady);
    if (!reg || !state.vapidKey) throw new Error(T('Ce navigateur ne gère pas les notifications', 'This browser doesn’t support notifications'));
    let sub = await reg.pushManager.getSubscription();
    if (sub && !sameKey(sub)) {
      await sub.unsubscribe().catch(() => {});
      sub = null;
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(state.vapidKey) });
    await api('POST', 'push/subscribe', { subscription: sub.toJSON() });
    return sub;
  }

  // À chaque ouverture : si les notifs sont autorisées, on resynchronise l'abonnement avec le serveur
  // (un abonnement peut expirer ou changer sans prévenir, surtout sur iPhone).
  let pushSynced = false;
  async function syncPush() {
    if (pushSynced) return;
    pushSynced = true;
    try {
      if (!state.vapidKey || !('Notification' in window) || Notification.permission !== 'granted' || load('pushOff')) return;
      await subscribePush();
    } catch (e) {
      console.warn('Synchro des notifs :', e);
    }
  }

  async function setupPushButton(pushOk) {
    const btn = document.getElementById('pushBtn');
    const status = document.getElementById('pushStatus');
    const testBtn = document.getElementById('pushTest');
    const out = document.getElementById('pushOut');
    if (pushOk && !swReg) swReg = await swReady;
    if (!document.body.contains(btn)) return;
    if (!pushOk || !swReg) {
      const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      status.textContent = iOS
        ? T('Sur iPhone, installe d’abord l’app sur l’écran d’accueil (Partager → Sur l’écran d’accueil) et ouvre-la depuis l’icône.', 'On iPhone, first install the app on your home screen (Share → Add to Home Screen) and open it from the icon.')
        : T('Les notifications ne sont pas disponibles sur ce navigateur.', 'Notifications aren’t available in this browser.');
      btn.disabled = true;
      return;
    }
    const sub = await swReg.pushManager.getSubscription();
    const perm = Notification.permission;
    const on = !!sub && perm === 'granted' && !load('pushOff');
    status.textContent = on
      ? T('Activées sur cet appareil.', 'On for this device.')
      : perm === 'denied'
        ? T('Bloquées. Autorise les notifications pour cette app dans les réglages du téléphone, puis reviens ici.', 'Blocked. Allow notifications for this app in your phone settings, then come back here.')
        : T('Désactivées sur cet appareil.', 'Off on this device.');
    btn.textContent = on ? T('Désactiver', 'Turn off') : T('Activer les notifications', 'Turn on notifications');
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
          toast(T('Notifications désactivées', 'Notifications off'));
        } else {
          // iPhone : la demande d'autorisation doit partir directement du clic, sans attente avant.
          const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
          if (p !== 'granted') throw new Error(T('Autorisation refusée', 'Permission denied'));
          save('pushOff', null);
          await subscribePush();
          toast(T('Notifications activées', 'Notifications on'));
        }
      } catch (e) {
        toast(e.message);
      }
      setupPushButton(pushOk);
    };

    testBtn.onclick = async () => {
      testBtn.disabled = true;
      out.textContent = T('Envoi…', 'Sending…');
      try {
        await subscribePush();
        const r = await api('POST', 'push/test');
        out.textContent = !r.devices
          ? T('Aucun appareil enregistré.', 'No device registered.')
          : r.results.map((x) => (x.ok ? T(`Envoyé (${x.service}) : la notification doit arriver dans quelques secondes.`, `Sent (${x.service}): the notification should arrive in a few seconds.`) : `${T('Échec', 'Failed')} (${x.service}) : ${x.status || ''} ${x.error || ''}`)).join('\n');
      } catch (e) {
        out.textContent = e.message;
      }
      testBtn.disabled = false;
    };
  }

  // ---------- Présence : "j'ai l'app à l'écran" (évite les notifs pendant qu'on regarde) ----------

  let presenceTimer = null;
  function sendPresence(visible) {
    if (!token) return;
    fetch('/api/presence', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
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

  const swReady = 'serviceWorker' in navigator
    ? navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((r) => (swReg = r)).catch(() => null)
    : Promise.resolve(null);

  // ---------- Démarrage ----------

  if (inviteCode) save('code', inviteCode.toUpperCase());
  if (inviteCode || pendingChat) history.replaceState(null, '', BASE);
  if (token) {
    inviteCode = null;
    $app.innerHTML = '<div class="auth"><span class="logo-emoji">🤔</span></div>';
    refresh().then(() => { if (!state && token) renderAuth('login', T('Impossible de charger. Réessaie.', 'Couldn’t load. Try again.')); });
  } else {
    renderAuth(inviteCode ? 'join' : null);
  }
})();
