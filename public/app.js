// "Qui de nous ?" — client.
(() => {
  const EMOJIS = ['😎', '🤪', '😈', '🥳', '🤠', '👽', '🐸', '🦄', '🐼', '🦊', '🐙', '🍕', '🔥', '⚡', '🌈', '👑', '🤡', '😇', '🥶', '🐒', '🦖', '🍑', '🌚', '💀', '🐐', '🦁', '🍆', '🫠', '🧠', '💅', '🍷', '🐍'];
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
  let animating = false; // animation de vote en cours
  let pendingRender = false;
  let flashId = null; // ligne à faire briller après l'animation

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
    if (s < 60) return 'à l’instant';
    const m = Math.floor(s / 60);
    if (m < 60) return `il y a ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `il y a ${h} h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `il y a ${d} j`;
    return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  function left(t) {
    const m = Math.max(0, Math.round((t - now()) / 60000));
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    return h < 48 ? `${h} h ${String(m % 60).padStart(2, '0')}` : `${Math.floor(h / 24)} j`;
  }

  function clock(t) {
    const opts = { hour: '2-digit', minute: '2-digit', timeZone: state.settings.timezone };
    const d = new Date(t);
    const sameDay = d.toLocaleDateString('fr-FR', { timeZone: state.settings.timezone }) === new Date(now()).toLocaleDateString('fr-FR', { timeZone: state.settings.timezone });
    return (sameDay ? '' : 'demain ') + d.toLocaleTimeString('fr-FR', opts).replace(':', 'h');
  }

  const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

  function player(id) {
    return state.players.find((p) => p.id === id) || { id, name: '???', emoji: '👻', color: '#999999' };
  }
  function setOf(id) {
    return state.sets.find((s) => s.id === id) || { id, name: 'Set supprimé', emoji: '🗑️', spicy: false };
  }
  const me = () => player(state.me.playerId);

  function avatar(p, size = '') {
    return `<span class="avatar ${size}" style="background:${esc(p.color)}33" title="${esc(p.name)}">${esc(p.emoji)}</span>`;
  }

  function setBadge(s) {
    return `<span class="set-badge ${s.spicy ? 'spicy' : ''}">${esc(s.emoji)} ${esc(s.name)}${s.spicy ? ' · 18+' : ''}</span>`;
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
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new Error('Pas de connexion au serveur 📡');
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && token && !url.startsWith('login')) {
      logoutLocal();
      throw new Error('Session expirée, reconnecte-toi');
    }
    if (!res.ok) throw new Error(data.error || 'Oups, erreur');
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
    let emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    let roster = null; // { group, players } une fois le code validé
    let picked = null;

    const codeField = (hint) => `
      <label for="code">Code du groupe</label>
      <input class="input code-input" id="code" required autocapitalize="characters" autocomplete="off" maxlength="12" placeholder="${hint}" value="${esc(load('code') || '')}">`;

    const draw = () => {
      let fields = '';
      if (mode === 'create') {
        fields = `
          <div class="info">👑 Tu seras l’admin : tu ajouteras ensuite les noms de tes potes, et tu auras un code à leur envoyer.</div>
          <label for="groupName">Nom du groupe</label>
          <input class="input" id="groupName" required maxlength="40" placeholder="Ex : Les Bouffons">
          <label for="name">Ton pseudo</label>
          <input class="input" id="name" required maxlength="24" placeholder="Ton petit nom">
          ${pinField()}
          <label>Ton emoji</label>${emojiGrid(EMOJIS, emoji)}`;
      } else if (mode === 'login') {
        fields = `
          ${codeField('Ex : K7QM2P')}
          <label for="name">Pseudo</label>
          <input class="input" id="name" required maxlength="24" placeholder="Ton pseudo dans le groupe" value="${esc(load('lastName') || '')}">
          ${pinField()}`;
      } else if (!roster) {
        fields = codeField('Demande-le à tes potes');
      } else {
        fields = `
          <div class="info">Groupe <b>${esc(roster.group.name)}</b> · <button type="button" class="link" id="otherCode">changer de code</button></div>
          <label>Qui es-tu ?</label>
          ${roster.players.length ? `<div class="pick-grid">${roster.players.map((p) => `
            <button type="button" class="choice ${picked && picked.id === p.id ? 'picked' : ''}" data-pick="${p.id}">${avatar(p)}<span>${esc(p.name)}</span></button>`).join('')}</div>`
            : '<div class="info">Tout le monde a déjà rejoint. Demande à l’admin de t’ajouter.</div>'}
          ${picked ? `
            <label for="name">Ton pseudo (tu peux le changer)</label>
            <input class="input" id="name" required maxlength="24" value="${esc(picked.name)}">
            ${pinField()}
            <label>Ton emoji</label>${emojiGrid(EMOJIS, emoji)}` : ''}`;
      }
      const label = mode === 'create' ? 'Créer le groupe' : mode === 'login' ? 'Entrer' : roster ? 'C’est parti' : 'Continuer →';
      const hideBtn = mode === 'join' && roster && !picked;

      $app.innerHTML = `
        <div class="auth">
          <form class="auth-box" id="authForm" autocomplete="off">
            <span class="logo-emoji">🤔</span>
            <h1 class="logo">Qui de nous ?</h1>
            <p class="tagline">Une question toutes les 3 h. Tout le monde vote. Verdicts sans pitié.</p>
            <div class="seg seg-3">
              <button type="button" data-mode="join" class="${mode === 'join' ? 'on' : ''}">Rejoindre</button>
              <button type="button" data-mode="login" class="${mode === 'login' ? 'on' : ''}">Connexion</button>
              <button type="button" data-mode="create" class="${mode === 'create' ? 'on' : ''}">Créer</button>
            </div>
            ${fields}
            ${hideBtn ? '' : `<button class="btn btn-main btn-block" type="submit">${label}</button>`}
            <p class="error" id="authErr">${esc(err)}</p>
          </form>
        </div>`;

      $app.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => { mode = b.dataset.mode; roster = null; picked = null; err = ''; draw(); }));
      $app.querySelectorAll('[data-pick]').forEach((b) => (b.onclick = () => { picked = roster.players.find((p) => p.id === b.dataset.pick); draw(); }));
      const other = document.getElementById('otherCode');
      if (other) other.onclick = () => { roster = null; picked = null; draw(); };
      bindEmojiGrid($app, (e) => (emoji = e));

      const form = document.getElementById('authForm');
      form.onsubmit = async (e) => {
        e.preventDefault();
        const btn = form.querySelector('[type=submit]');
        if (btn) btn.disabled = true;
        const val = (id) => (document.getElementById(id) || {}).value || '';
        try {
          let data;
          if (mode === 'create') {
            data = await api('POST', 'groups', { groupName: val('groupName'), name: val('name'), pin: val('pin'), emoji });
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
            data = await api('POST', 'join', { code: roster.group.code, playerId: picked.id, name: val('name'), pin: val('pin'), emoji });
            save('lastName', val('name'));
          }
          token = data.token;
          save('token', token);
          save('joined', '1');
          if (mode === 'create') { tab = 'me'; save('tab', tab); }
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

  // ---------- Invitation ----------

  function inviteLink() {
    return `${location.origin}/?code=${state.group.code}`;
  }

  function showInvite(justCreated) {
    const text = `Rejoins « ${state.group.name} » sur Qui de nous ?\nCode : ${state.group.code}\n${inviteLink()}`;
    openSheet(`
      <div class="sheet-head"><h2>${justCreated ? 'Groupe créé' : 'Inviter des potes'}</h2><button class="x" data-close>✕</button></div>
      <p class="muted" style="margin:0 0 6px">Envoie ce code (ou le lien) à tes potes pour qu’ils rejoignent <b>${esc(state.group.name)}</b>.</p>
      <div class="big-code">${esc(state.group.code)}</div>
      <div class="row">
        <button class="btn btn-main" id="shareBtn">${navigator.share ? 'Partager' : 'Copier le lien'}</button>
        <button class="btn btn-soft" id="copyCode">Copier le code</button>
      </div>
      ${justCreated ? '<div class="info" style="margin-top:14px">👉 Ajoute d’abord les noms de tes potes dans <b>Admin → Les potes</b> : ils choisiront leur nom en rejoignant.</div>' : ''}`, (root) => {
      const copy = async (t, msg) => {
        try {
          await navigator.clipboard.writeText(t);
          toast(msg);
        } catch {
          prompt('Copie ça :', t);
        }
      };
      root.querySelector('#copyCode').onclick = () => copy(state.group.code, 'Code copié');
      root.querySelector('#shareBtn').onclick = async () => {
        if (navigator.share) {
          try { await navigator.share({ title: 'Qui de nous ?', text }); } catch { /* annulé */ }
        } else copy(text, 'Invitation copiée');
      };
    });
  }

  function pinField() {
    return `
      <label for="pin">PIN secret (4 à 6 chiffres)</label>
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
    } catch { /* on réessaiera */ }
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
      ['me', 'me', 'Moi', 0],
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
    document.title = n + unread ? `(${n + unread}) Qui de nous ?` : 'Qui de nous ?';
    if (navigator.setAppBadge) navigator.setAppBadge(n + unread).catch(() => {});
  }

  // ---------- Thème clair / sombre ----------

  const isDark = () => document.documentElement.dataset.theme === 'dark';

  function paintThemeBtn() {
    const b = document.getElementById('themeBtn');
    if (!b) return;
    b.classList.toggle('on', isDark());
    b.setAttribute('aria-checked', String(isDark()));
    b.setAttribute('aria-label', isDark() ? 'Passer en mode clair' : 'Passer en mode sombre');
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
    renderNav();
    renderView();
    window.scrollTo({ top: 0 });
  }

  function renderView() {
    const view = document.getElementById('view');
    if (!view) return;
    // Pendant l'animation d'un vote, on ne redessine pas l'écran (on le fera juste après).
    if (animating) { pendingRender = true; return; }
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

    let body;
    if (voting) {
      body = `<div class="vote-list">${state.players
        .map((u) => `
          <button class="vote-opt ${p.myVote === u.id ? 'picked' : ''}" data-vote="${p.id}" data-target="${u.id}">
            ${avatar(u, 'sm')}<span>${esc(u.id === state.me.playerId ? u.name + ' (moi)' : u.name)}</span>
          </button>`)
        .join('')}</div>
        ${editing === p.id ? '<button class="link-btn" data-cancel>Annuler</button>' : ''}`;
    } else {
      // Résultats : pour chaque personne votée, le nombre de votes et QUI a voté pour elle.
      const counts = Object.entries(p.results || {}).sort((a, b) => b[1] - a[1]);
      const max = counts.length ? counts[0][1] : 0;
      const votersFor = (id) => (p.ballots || []).filter((b) => b.target === id).map((b) => player(b.voter));
      body = counts.length
        ? `<div class="results">${counts
            .map(([id, c]) => {
              const u = player(id);
              const pct = total ? Math.round((c / total) * 100) : 0;
              const voters = votersFor(id);
              return `
                <div class="result ${p.myVote === id ? 'mine' : ''} ${c === max ? 'winner' : ''}">
                  <span class="bar" style="width:${pct}%;background:${esc(u.color)}"></span>
                  <div class="result-main">
                    ${avatar(u, 'sm')}
                    <span class="name">${esc(u.name)}</span>
                    <span class="votes">${c}</span>
                  </div>
                  ${voters.length ? `<div class="result-voters">par ${voters.map((v) => esc(v.id === state.me.playerId ? 'toi' : v.name)).join(', ')}</div>` : ''}
                </div>`;
            })
            .join('')}</div>`
        : '<p class="muted small" style="margin:0">Personne n’a voté.</p>';
    }

    const status = p.ended ? 'Terminé' : `encore ${left(p.endsAt)}`;
    const author = p.custom && p.authorId ? player(p.authorId) : null;
    const picked = opts.justVoted && p.myVote ? player(p.myVote) : null;
    return `
      <article class="card poll ${voting && !p.myVote ? 'todo' : ''} ${p.custom ? 'custom' : ''} ${opts.justVoted ? 'just-voted' : ''}" data-poll="${p.id}">
        ${p.custom ? `<div class="custom-tag">${icon('pen')}<span>Question de <b>${author ? esc(author.name) : 'quelqu’un du groupe'}</b></span></div>` : ''}
        ${picked ? `<div class="voted-banner">${icon('check')}<span>Tu as voté <b>${esc(picked.id === state.me.playerId ? 'pour toi' : picked.name)}</b></span></div>` : ''}
        <div class="poll-head" ${opts.collapsible ? `data-toggle="${p.id}" role="button" aria-expanded="true"` : ''}>
          <div class="poll-top">
            <span class="poll-set ${s.spicy ? 'spicy' : ''}">${esc(s.name)}${s.spicy ? ' · 18+' : ''}</span>
            <span class="poll-time">${status}${opts.collapsible ? `<span class="fold">${icon('down')}</span>` : ''}</span>
          </div>
          <h2 class="question">${esc(p.text)}</h2>
        </div>
        ${body}
        <div class="poll-foot">
          <span>${total}/${state.players.length} ${total > 1 ? 'ont voté' : 'a voté'}${author && by && author.id === by.id ? '' : ` · ${by ? 'lancée par ' + esc(by.name) : 'question du jour'}`}</span>
          <span class="foot-actions">
            ${comments ? '' : `<button class="more-btn" data-chat="${p.id}" aria-label="Commenter">${icon('comment')}</button>`}
            ${hasMenu ? `<button class="more-btn" data-more="${p.id}" aria-label="Options">${icon('more')}</button>` : ''}
          </span>
        </div>
        ${pollChatPreview(p)}
      </article>`;
  }

  // Ligne compacte (sondage déjà voté ou archivé) : un tap la déplie pour voir qui a voté pour qui.
  function pollRow(p) {
    const counts = Object.entries(p.results || {}).sort((a, b) => b[1] - a[1]);
    const max = counts.length ? counts[0][1] : 0;
    const leaders = counts.filter(([, c]) => c === max).map(([id]) => player(id));
    const author = p.custom && p.authorId ? player(p.authorId) : null;
    const c = p.chat || { count: 0, unread: 0 };
    let lead;
    if (!leaders.length) lead = 'Personne n’a voté';
    else if (leaders.length === 1) lead = `<b>${esc(leaders[0].name)}</b>${p.ended ? '' : ' en tête'}`;
    else lead = `<b>${leaders.map((u) => esc(u.name)).join(', ')}</b> ex æquo`;
    const meta = [
      lead,
      `${p.voterIds.length}/${state.players.length}`,
      p.ended ? ago(p.endsAt) : `encore ${left(p.endsAt)}`,
    ];
    return `
      <button class="prow ${p.custom ? 'custom' : ''} ${flashId === p.id ? 'flash' : ''}" data-toggle="${p.id}" aria-expanded="false">
        <span class="prow-av">${leaders.length ? avatar(leaders[0], 'sm') : '<span class="avatar sm empty-av">?</span>'}</span>
        <span class="prow-body">
          <span class="prow-q">${esc(p.text)}</span>
          <span class="prow-meta">${author ? `<span class="prow-by">${icon('pen')}${esc(author.name)}</span>` : ''}${meta.join(' · ')}</span>
        </span>
        ${c.count ? `<span class="prow-chat ${c.unread ? 'new' : ''}">${icon('comment')}${c.unread || c.count}</span>` : ''}
      </button>`;
  }

  // Sondage déjà voté / archivé : ligne compacte, ou carte complète si dépliée.
  function pollItem(p) {
    return openPolls.has(p.id) || editing === p.id ? pollCard(p, { collapsible: true }) : pollRow(p);
  }

  function pollChatPreview(p) {
    const c = p.chat || { count: 0, unread: 0, last: [] };
    if (!c.count) return '';
    const lines = c.last.map((m) => {
      const u = player(m.playerId);
      const who = m.playerId === state.me.playerId ? 'Toi' : esc(u.name);
      return `<span class="pc-msg"><b>${who}</b> ${m.deleted ? '<i>supprimé</i>' : m.kind === 'gif' ? 'GIF' : esc(m.text)}</span>`;
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
      <p class="muted" style="margin:0 0 12px">${esc(p.text)}</p>
      <div class="menu-list">
        ${!p.ended && p.myVote ? '<button class="menu-item" id="mEdit">Changer mon vote</button>' : ''}
        ${canDelete ? '<button class="menu-item danger" id="mDel">Supprimer le sondage</button>' : ''}
      </div>`, (root) => {
      const ed = root.querySelector('#mEdit');
      if (ed) ed.onclick = () => { closeSheet(); editing = id; renderView(); };
      action(root.querySelector('#mDel'), async () => {
        if (!confirm('Supprimer ce sondage pour tout le monde ?')) return;
        await api('DELETE', `polls/${id}`);
        closeSheet();
        state.live = state.live.filter((x) => x.id !== id);
        state.archive = state.archive.filter((x) => x.id !== id);
        if (archiveExtra) archiveExtra.items = archiveExtra.items.filter((x) => x.id !== id);
        toast('Sondage supprimé');
        renderMain();
      });
    });
  }

  function bindPollCards(view, list) {
    view.querySelectorAll('[data-vote]').forEach((b) => (b.onclick = () => castVote(b)));
    view.querySelectorAll('[data-toggle]').forEach((b) => (b.onclick = () => {
      const id = b.dataset.toggle;
      if (openPolls.has(id)) openPolls.delete(id);
      else openPolls.add(id);
      if (editing === id) editing = null;
      renderView();
    }));
    view.querySelectorAll('[data-chat]').forEach((b) => (b.onclick = () => openChat(b.dataset.chat)));
    view.querySelectorAll('[data-more]').forEach((b) => (b.onclick = () => openPollMenu(b.dataset.more)));
    view.querySelectorAll('[data-cancel]').forEach((b) => (b.onclick = () => { editing = null; renderView(); }));
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Vote animé : 1) le choix s'illumine, 2) la carte montre les résultats et ton vote quelques secondes,
  // 3) elle se replie en douceur et rejoint « Déjà voté », où sa ligne brille un instant.
  async function castVote(b) {
    if (animating) return;
    const id = b.dataset.vote;
    const card = b.closest('.poll');
    const firstVote = !(findPoll(id) || {}).myVote;
    animating = true;
    card.querySelectorAll('[data-vote]').forEach((x) => (x.disabled = true));
    card.classList.add('voting');
    b.classList.add('chosen');
    try {
      const [{ poll }] = await Promise.all([api('POST', `polls/${id}/vote`, { playerId: b.dataset.target }), wait(calm() ? 0 : 500)]);
      replacePoll(poll);
      editing = null;
      const tmp = document.createElement('div');
      tmp.innerHTML = pollCard(poll, { justVoted: true, collapsible: !firstVote });
      const fresh = tmp.firstElementChild;
      const bars = [...fresh.querySelectorAll('.result .bar')];
      const widths = bars.map((x) => x.style.width);
      bars.forEach((x) => (x.style.width = '0'));
      card.replaceWith(fresh);
      bindPollCards(fresh);
      requestAnimationFrame(() => requestAnimationFrame(() => bars.forEach((x, i) => (x.style.width = widths[i]))));
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
        <button type="button" data-live="live" class="${liveMode === 'live' ? 'on' : ''}">En cours${state.live.length ? ` · ${state.live.length}` : ''}</button>
        <button type="button" data-live="archive" class="${liveMode === 'archive' ? 'on' : ''}">Archives</button>
      </div>`;
  }

  function bindLiveSwitch(view) {
    view.querySelectorAll('[data-live]').forEach((b) => (b.onclick = () => {
      liveMode = b.dataset.live;
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
          Rien à voter pour l’instant…<br>Lance une question avec le bouton + si tu t’ennuies.
        </div>` : ''}
      ${todo.length ? `<div class="section-title">À toi de voter <span class="count">${todo.length}</span></div>${todo.map((p) => pollCard(p)).join('')}` : ''}
      ${!todo.length && done.length ? '<p class="all-done">Tu as voté partout.</p>' : ''}
      ${done.length ? `<div class="section-title">Déjà voté <span class="count">${done.length}</span></div><div class="prow-list">${done.map(pollItem).join('')}</div>` : ''}
      <button class="fab" id="fab" aria-label="Lancer une question">${icon('plus')}</button>`;

    bindPollCards(view);
    bindLiveSwitch(view);
    bindInstallBanner();
    document.getElementById('fab').onclick = () => openDropSheet();
    const meter = document.getElementById('dropMeter');
    if (meter) meter.onclick = openDropInfo;
  }

  // Compte à rebours vers la prochaine question auto : un petit anneau qui se remplit.
  function dropMeter() {
    if (!state.nextDrop) return '';
    const end = state.nextDrop;
    const start = state.prevDrop && state.prevDrop < end ? state.prevDrop : end - state.settings.intervalHours * 3600e3;
    const frac = Math.min(1, Math.max(0, (now() - start) / (end - start)));
    const C = 2 * Math.PI * 8;
    return `
      <button class="drop-meter" id="dropMeter" aria-label="Prochaine question dans ${left(end)}">
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="8" class="dm-track"/>
          <circle cx="10" cy="10" r="8" class="dm-fill" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${(C * (1 - frac)).toFixed(2)}"/>
        </svg>
        <span>${left(end).replace(' h ', 'h')}</span>
      </button>`;
  }

  function openDropInfo() {
    const total = state.sets.reduce((n, s) => n + s.total, 0) || 1;
    const pct = Math.round((state.remainingQuestions / total) * 100);
    openSheet(`
      <div class="sheet-head"><h2>Prochaine question</h2><button class="x" data-close>✕</button></div>
      <p class="drop-info-big">${clock(state.nextDrop)} <span class="muted">· dans ${left(state.nextDrop)}</span></p>
      <p class="muted small">Une question tombe toutes les ${String(state.settings.intervalHours).replace('.', ',')} h, de ${state.settings.startHour} h à ${state.settings.endHour} h.</p>
      <div class="reserve">
        <div class="reserve-label"><span>Questions en réserve</span><b>${state.remainingQuestions} / ${total}</b></div>
        <div class="reserve-bar"><span style="width:${pct}%"></span></div>
      </div>`, () => {});
  }

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
    toast('App installée');
    if (state && tab === 'live') renderView();
  });

  function installBanner() {
    if (isStandalone() || load('installHidden')) return '';
    if (!installPrompt && !isIOS) return '';
    return `
      <div class="install-banner">
        
        <div class="ib-text"><b>Installe l’app</b><span>Une icône sur ton écran d’accueil${isIOS ? ' et les notifs' : ''}.</span></div>
        <button class="btn btn-main btn-small" id="installBtn">Installer</button>
        <button class="x" id="installHide" aria-label="Masquer">✕</button>
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
        <div class="sheet-head"><h2>Installer sur iPhone</h2><button class="x" data-close>✕</button></div>
        <ol class="steps">
          <li>Ouvre ce site dans <b>Safari</b>.</li>
          <li>Touche le bouton <b>Partager</b> <span class="share-ico">⎋</span> (le carré avec une flèche, en bas de l’écran).</li>
          <li>Choisis <b>Sur l’écran d’accueil</b>, puis <b>Ajouter</b>.</li>
          <li>Ouvre l’app depuis la nouvelle icône, puis va dans <b>Moi → Activer les notifs</b>.</li>
        </ol>
        <p class="muted small">Les notifs sur iPhone demandent iOS 16.4 ou plus récent.</p>
        <button class="btn btn-main btn-block" data-close>Compris</button>`, () => {});
    };
  }

  // ---------- Feuille "Lancer une question" ----------

  function closeSheet() {
    $sheet.hidden = true;
    $sheet.innerHTML = '';
    document.body.classList.remove('noscroll');
  }

  function openSheet(html, bind) {
    $sheet.innerHTML = `<div class="sheet-bg" data-close></div><div class="sheet">${html}</div>`;
    $sheet.hidden = false;
    document.body.classList.add('noscroll');
    $sheet.querySelectorAll('[data-close]').forEach((el) => (el.onclick = closeSheet));
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
        <div class="sheet-head"><h2>Lancer une question</h2><button class="x" data-close>✕</button></div>
        <p class="drops-left ${none ? 'empty' : ''}">${none
          ? `Tu as utilisé tes ${state.me.dropsPerDay} questions du jour. Ça repart à minuit.`
          : `Il te reste <b>${leftToday}</b> question${leftToday > 1 ? 's' : ''} sur ${state.me.dropsPerDay} aujourd’hui. Elle part tout de suite pour 24 h.`}</p>
        <label>Set</label>
        <div class="set-chips">
          <button class="chip ${!setId ? 'on' : ''}" data-set="">N’importe lequel</button>
          ${sets.map((x) => `<button class="chip ${setId === x.id ? 'on' : ''} ${x.spicy ? 'spicy' : ''}" data-set="${x.id}">${esc(x.name)}</button>`).join('')}
        </div>
        <button class="btn btn-main btn-block" id="dropRandom" ${none || (s && !s.remaining) ? 'disabled' : ''}>Question surprise${s ? ` (${s.remaining} dispo)` : ''}</button>
        <div class="or">ou écris la tienne</div>
        <textarea class="input" id="ownQ" maxlength="200" placeholder="${s ? 'Qui serait le plus susceptible de…' : 'Choisis d’abord un set'}" ${s && !none ? '' : 'disabled'}></textarea>
        <p class="muted small" style="margin:6px 0 0">Elle apparaîtra avec ton nom, comme question perso.</p>
        <button class="btn btn-soft btn-block" id="dropOwn" ${s && !none ? '' : 'disabled'}>Lancer ma question</button>`, (root) => {
        root.querySelectorAll('[data-set]').forEach((b) => (b.onclick = () => { setId = b.dataset.set; draw(); }));
        action(root.querySelector('#dropRandom'), () => drop({ setId: setId || undefined }));
        action(root.querySelector('#dropOwn'), () => {
          const text = root.querySelector('#ownQ').value.trim();
          if (text.length < 8) throw new Error('Écris une vraie question');
          return drop({ setId, text });
        });
      });
    };
    draw();
  }

  async function drop(body) {
    const { poll, dropsLeft } = await api('POST', 'drop', body);
    replacePoll(poll);
    state.me.dropsLeft = dropsLeft;
    closeSheet();
    toast(`Question lancée · encore ${dropsLeft} aujourd’hui`);
    tab = 'live';
    save('tab', tab);
    await refresh();
  }

  // ---------- Archives ----------

  function renderArchive(view) {
    const data = archiveExtra || { items: state.archive, hasMore: state.archiveHasMore };
    view.innerHTML = `
      ${liveSwitch()}
      <div class="filter-row">
        <select class="input" id="archSet">
          <option value="">Tous les sets</option>
          ${state.sets.map((s) => `<option value="${s.id}" ${archiveSet === s.id ? 'selected' : ''}>${esc(s.emoji)} ${esc(s.name)}</option>`).join('')}
        </select>
      </div>
      ${data.items.length ? `<div class="prow-list">${data.items.map(pollItem).join('')}</div>` : `<div class="card empty">Rien dans les archives pour l’instant.<br>Les questions y arrivent après leurs 24 h de vote.</div>`}
      ${data.hasMore ? '<button class="btn btn-soft btn-block" id="more">Voir plus</button>' : ''}`;

    bindPollCards(view);
    bindLiveSwitch(view);
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
        <span class="set-name">${esc(s.name)}</span>
        <span class="set-count">${s.played} jouée${s.played > 1 ? 's' : ''} · ${s.remaining} secrète${s.remaining > 1 ? 's' : ''}</span>
        ${s.builtin ? '' : `<span class="set-tag">par ${esc(s.author ? player(s.author).name : '?')}</span>`}
      </button>`).join('')}</div>`;

    view.innerHTML = `
      <button class="btn btn-main btn-block" id="newSet" style="margin-top:0">＋ Créer un set</button>
      <div class="section-title">Les sets <span class="count">${classic.length}</span></div>
      ${grid(classic)}
      ${spicy.length ? `<div class="section-title">Spicy · 18+ <span class="count">${spicy.length}</span></div>${grid(spicy)}` : ''}`;

    view.querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => { openSet = b.dataset.open; setDetail = null; renderView(); window.scrollTo({ top: 0 }); }));
    document.getElementById('newSet').onclick = () => openSetForm();
  }

  function openSetForm(existing) {
    let emoji = existing ? existing.emoji : '✨';
    openSheet(`
      <div class="sheet-head"><h2>${existing ? 'Modifier le set' : 'Nouveau set'}</h2><button class="x" data-close>✕</button></div>
      <label for="setName">Nom</label>
      <input class="input" id="setName" maxlength="40" placeholder="Ex : Les vacances à Lisbonne" value="${esc(existing ? existing.name : '')}">
      <label for="setDesc">Description</label>
      <input class="input" id="setDesc" maxlength="120" placeholder="De quoi ça parle ?" value="${esc(existing ? existing.description : '')}">
      <label>Emoji</label>${emojiGrid(SET_EMOJIS, emoji)}
      <label class="toggle"><input type="checkbox" id="setSpicy" ${existing && existing.spicy ? 'checked' : ''}> <span>Set spicy (18+)</span></label>
      <button class="btn btn-main btn-block" id="saveSet">${existing ? 'Enregistrer' : 'Créer le set'}</button>`, (root) => {
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
        toast(existing ? 'Set modifié' : 'Set créé. Ajoute des questions.');
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
      view.innerHTML = `<div class="card empty">Chargement…</div>`;
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
      <button class="back" id="back">← Tous les sets</button>
      <div class="card set-hero ${s.spicy ? 'spicy' : ''}">
        <span class="set-emoji big">${esc(s.emoji)}</span>
        <h2 class="question" style="margin:4px 0">${esc(s.name)}${s.spicy ? ' <span class="set-badge spicy">18+</span>' : ''}</h2>
        ${s.description ? `<p class="muted" style="margin:0">${esc(s.description)}</p>` : ''}
        <p class="set-count" style="margin:10px 0 0">${s.played} jouée${s.played > 1 ? 's' : ''} · ${s.remaining} encore secrète${s.remaining > 1 ? 's' : ''}</p>
        <div class="row">
          <button class="btn btn-main" id="dropHere" ${s.remaining ? '' : 'disabled'}>Lancer une question</button>
          ${canEdit ? '<button class="btn btn-soft" id="editSet">Modifier</button>' : ''}
        </div>
      </div>

      <div class="card">
        <label for="newQ" style="margin-top:0">Ajouter des questions</label>
        <textarea class="input" id="newQ" placeholder="Une question par ligne.&#10;Qui est le plus susceptible de…"></textarea>
        <p class="muted small">Elles restent secrètes jusqu’à ce qu’elles tombent. Pas de doublons : on vérifie !</p>
        <button class="btn btn-soft btn-block" id="addQ" style="margin-top:10px">Ajouter au set</button>
      </div>

      ${d.mine.length ? `
        <div class="section-title">Tes questions en attente <span class="count">${d.mine.length}</span></div>
        <div class="card qlist">${d.mine.map((q) => `
          <div class="qrow"><span>${esc(q.text)}</span><button class="btn btn-small btn-danger" data-delq="${q.id}" aria-label="Supprimer">${icon('trash')}</button></div>`).join('')}
        </div>` : ''}

      <div class="section-title">Déjà jouées <span class="count">${d.played.length}</span></div>
      ${d.played.length ? `<div class="card qlist">${d.played.map((q) => `<div class="qrow"><span>${esc(q.text)}</span><span class="muted small">${ago(q.usedAt)}</span></div>`).join('')}</div>`
        : '<div class="card empty" style="padding:18px">Aucune question jouée pour l’instant.</div>'}
      ${canEdit && !s.played ? '<button class="btn btn-danger btn-block" id="delSet">Supprimer ce set</button>' : ''}`;

    document.getElementById('back').onclick = () => { openSet = null; renderView(); };
    document.getElementById('dropHere').onclick = () => openDropSheet(s.id);
    if (canEdit) document.getElementById('editSet').onclick = () => openSetForm(s);
    action(document.getElementById('addQ'), async () => {
      const text = document.getElementById('newQ').value;
      const r = await api('POST', `sets/${s.id}/questions`, { text });
      toast(r.added.length ? `${plural(r.added.length, 'question')} ajoutée${r.added.length > 1 ? 's' : ''}` : 'Rien ajouté');
      if (r.errors.length) alert('Pas ajoutées :\n\n' + r.errors.join('\n'));
      setDetail = null;
      await refresh();
    });
    view.querySelectorAll('[data-delq]').forEach((b) => action(b, async () => {
      if (!confirm('Supprimer cette question ?')) return;
      await api('DELETE', `questions/${b.dataset.delq}`);
      setDetail = null;
      await refresh();
    }));
    action(document.getElementById('delSet'), async () => {
      if (!confirm(`Supprimer le set « ${s.name} » et ses questions ?`)) return;
      await api('DELETE', `sets/${s.id}`);
      openSet = null;
      toast('Set supprimé');
      await refresh();
    });
  }

  // ---------- Stats ----------

  function renderStats(view) {
    const defs = state.statDefs;
    const st = state.stats;
    const pid = statsPlayer && state.players.some((p) => p.id === statsPlayer) ? statsPlayer : state.me.playerId;
    const p = player(pid);
    const ps = st.players[pid] || { value: {}, wins: [], polls: 0 };
    const active = Object.values(st.players).filter((x) => x.polls > 0);
    const avg = Object.fromEntries(defs.map((d) => [d.key, active.length ? active.reduce((a, x) => a + x.value[d.key], 0) / active.length : 0]));
    const myTitles = st.titles.filter((t) => t.playerId === pid);
    const anyData = active.length > 0;

    const ranking = (d) => {
      const rows = state.players
        .map((u) => ({ u, v: (st.players[u.id] || { value: {} }).value[d.key] || 0 }))
        .sort((a, b) => b.v - a.v)
        .filter((r) => r.v > 0)
        .slice(0, 5);
      return `
        <div class="card rank-card">
          <div class="rank-head"><span class="rank-emoji">${d.emoji}</span><b>${d.label}</b><span class="muted small" style="margin-left:auto">${esc(d.title)}</span></div>
          ${rows.length ? rows.map((r, i) => `
            <div class="rank-row">
              <span class="rank-pos">${i === 0 ? '👑' : i + 1}</span>
              ${avatar(r.u, 'sm')}
              <span class="name">${esc(r.u.name)}</span>
              <span class="rank-bar"><span style="width:${r.v}%;background:${esc(r.u.color)}"></span></span>
              <span class="rank-val">${r.v}</span>
            </div>`).join('') : '<div class="muted small">Pas encore de données</div>'}
        </div>`;
    };

    view.innerHTML = `
      <div class="player-strip">
        ${state.players.map((u) => `<button class="strip-item ${u.id === pid ? 'on' : ''}" data-player="${u.id}">${avatar(u)}<span>${esc(u.name)}</span></button>`).join('')}
      </div>
      <div class="card radar-card">
        <div class="radar-title">${avatar(p)}<div><b>${esc(p.name)}</b>${ps.polls ? `<div class="muted small">A reçu des votes dans ${plural(ps.polls, 'sondage')} terminé${ps.polls > 1 ? 's' : ''}</div>` : ''}</div></div>
        ${anyData ? window.radarSvg(defs, ps.value, p.color, active.length > 1 ? avg : null) : '<div class="empty">Les stats arrivent quand les premiers sondages se terminent.</div>'}
        ${anyData && active.length > 1 ? '<div class="legend"><span class="dash"></span> moyenne du groupe</div>' : ''}
        ${myTitles.length ? `<div class="title-chips">${myTitles.map((t) => `<span class="title-chip ${t.low ? 'low' : ''}">${t.emoji} ${esc(t.title)}</span>`).join('')}</div>` : ''}
        ${anyData && st.ended < st.titlesAt ? `<p class="muted small" style="margin:10px 0 0">Les titres se débloquent après ${st.titlesAt} sondages terminés (encore ${st.titlesAt - st.ended}).</p>` : ''}
      </div>
      ${ps.wins.length ? `
        <div class="section-title">Élu pour… <span class="count">${ps.wins.length}</span></div>
        <div class="card qlist">${ps.wins.slice(0, 15).map((w) => `<div class="qrow"><span>${esc(w.text)}</span><span class="muted small">${esc(setOf(w.setId).emoji)}</span></div>`).join('')}</div>` : ''}
      ${st.titles.length ? `
        <div class="section-title">Les titres du groupe</div>
        <div class="card titles-board">${st.titles.map((t) => `
          <div class="title-row">${avatar(player(t.playerId), 'sm')}<span class="name">${esc(player(t.playerId).name)}</span><span class="title-chip ${t.low ? 'low' : ''}">${t.emoji} ${esc(t.title)}</span></div>`).join('')}
        </div>` : ''}
      ${anyData ? `<div class="section-title">Classements</div>${defs.map(ranking).join('')}` : ''}`;

    view.querySelectorAll('[data-player]').forEach((b) => (b.onclick = () => { statsPlayer = b.dataset.player; renderView(); }));
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
          <span class="avatar lg" style="background:${esc(m.color)}33">${esc(m.emoji)}</span>
          <div class="profile-text"><b>${esc(m.name)}</b><span class="muted small">${state.me.isAdmin ? 'Admin du groupe' : 'Membre du groupe'}</span></div>
        </div>
        <label for="myName">Pseudo</label>
        <div class="inline-form">
          <input class="input" id="myName" maxlength="24" value="${esc(m.name)}">
          <button class="btn btn-soft" id="saveName">OK</button>
        </div>
        <details class="emoji-pick">
          <summary>Changer d’emoji</summary>
          ${emojiGrid(EMOJIS, m.emoji)}
        </details>
      </div>

      <div class="card">
        <div class="card-title">Groupe</div>
        <div class="group-code-row">
          <span>${esc(state.group.name)}</span>
          <span class="code-pill">${esc(state.group.code)}</span>
        </div>
        <button class="btn btn-main btn-block" id="inviteBtn" style="margin-top:14px">Inviter des potes</button>
      </div>

      <div class="card">
        <div class="card-title">Notifications</div>
        <p class="muted small" id="pushStatus" style="margin:0 0 12px">…</p>
        ${iOS && !standalone ? '<div class="info" style="margin-bottom:12px">Sur iPhone : touche <b>Partager</b> puis <b>Sur l’écran d’accueil</b>, et ouvre l’app depuis la nouvelle icône pour pouvoir activer les notifications.</div>' : ''}
        <div class="row" style="margin-top:0">
          <button class="btn btn-main" id="pushBtn" ${pushOk ? '' : 'disabled'}>Activer les notifications</button>
          <button class="btn btn-soft" id="pushTest" hidden>Tester</button>
        </div>
        <p class="push-out muted small" id="pushOut"></p>
        <div class="notif-prefs">
          ${[['polls', 'Nouvelles questions'], ['votes', 'Quand quelqu’un vote'], ['chat', 'Messages']].map(([k, label]) => `
            <label class="switch-row"><span>${label}</span><input type="checkbox" class="switch" data-notif="${k}" ${state.me.notif[k] ? 'checked' : ''}></label>`).join('')}
        </div>
      </div>

      ${state.me.isAdmin ? adminHtml() : ''}

      <button class="btn btn-soft btn-block" id="logout">Se déconnecter</button>`;

    action(document.getElementById('saveName'), async () => {
      await api('PATCH', 'me', { name: document.getElementById('myName').value });
      document.activeElement.blur();
      toast('Pseudo changé');
      await refresh();
    });
    bindEmojiGrid(document.getElementById('profileCard'), async (emoji) => {
      try {
        await api('PATCH', 'me', { emoji });
        toast('Emoji changé');
        await refresh();
      } catch (e) { toast(e.message); }
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

  function adminHtml() {
    const s = state.settings;
    return `
      <div class="section-title">Admin</div>

      <div class="card">
        <div class="card-title">Nom du groupe</div>
        <div class="inline-form">
          <input class="input" id="groupName" maxlength="40" value="${esc(state.group.name)}">
          <button class="btn btn-soft" id="saveGroup">OK</button>
        </div>
        <p class="muted small" style="margin:10px 0 0">Le code a fuité ? Génère-en un nouveau : l’ancien ne marchera plus (ceux qui ont déjà rejoint restent connectés).</p>
        <button class="btn btn-soft btn-block" id="newCode" style="margin-top:10px">Générer un nouveau code</button>
      </div>

      <div class="card">
        <div class="card-title">Les potes <span class="muted small">· ${state.players.length}</span></div>
        <p class="muted small">Ajoute tout le monde ici, même ceux qui n’ont pas encore rejoint : on peut déjà voter pour eux.</p>
        <div class="roster">${state.players.map((p) => `
          <div class="roster-row">
            ${avatar(p, 'sm')}
            <span class="name">${esc(p.name)}</span>
            <span class="status ${p.claimed ? 'on' : ''}">${p.claimed ? 'a rejoint' : 'en attente'}</span>
            <button class="icon-btn" data-rename="${p.id}" title="Renommer" aria-label="Renommer">${icon('edit')}</button>
            ${p.claimed && p.id !== state.me.playerId ? `<button class="icon-btn" data-reset="${p.id}" title="Réinitialiser le compte (PIN oublié)" aria-label="Réinitialiser">${icon('key')}</button>` : ''}
            ${!p.claimed ? `<button class="icon-btn" data-remove="${p.id}" title="Retirer" aria-label="Retirer">${icon('trash')}</button>` : ''}
          </div>`).join('')}
        </div>
        <textarea class="input" id="rosterAdd" placeholder="Un nom par ligne&#10;Alex&#10;John&#10;Carlos" style="margin-top:12px;min-height:80px"></textarea>
        <button class="btn btn-main btn-block" id="rosterBtn" style="margin-top:10px">Ajouter</button>
      </div>

      <div class="card">
        <div class="card-title">Planning des questions</div>
        <div class="settings-grid">
          <label>Toutes les (heures)<input class="input" id="sInterval" type="number" step="0.25" min="0.02" max="24" value="${s.intervalHours}"></label>
          <label>Durée du vote (heures)<input class="input" id="sPoll" type="number" step="1" min="0.02" max="168" value="${s.pollHours}"></label>
          <label>À partir de (h)<input class="input" id="sStart" type="number" min="0" max="23" value="${s.startHour}"></label>
          <label>Jusqu’à (h)<input class="input" id="sEnd" type="number" min="0" max="23" value="${s.endHour}"></label>
        </div>
        <label>Fuseau horaire<input class="input" id="sTz" value="${esc(s.timezone)}"></label>
        <p class="muted small">Prochaine question auto : <b>${state.nextDrop ? clock(state.nextDrop) : '—'}</b> · ${plural(state.remainingQuestions, 'question')} en réserve</p>
        <div class="row">
          <button class="btn btn-main" id="saveSettings">Enregistrer</button>
          <button class="btn btn-soft" id="forceDrop">Lancer maintenant</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Questions à noter</div>
        <p class="muted small">Les questions créées par le groupe n’ont pas encore de stats. Copie-les, donne-les à Claude, puis colle sa réponse ici.</p>
        <button class="btn btn-soft btn-block" id="exportQ">Copier les questions à noter</button>
        <textarea class="input" id="scoresIn" placeholder='Réponse de Claude : {"id": {"chaos": 2, "hot": 1}, …}' style="margin-top:12px;min-height:80px"></textarea>
        <button class="btn btn-main btn-block" id="importQ" style="margin-top:10px">Importer les scores</button>
      </div>`;
  }

  function bindAdmin(view) {
    action(document.getElementById('saveGroup'), async () => {
      await api('PATCH', 'admin/group', { name: document.getElementById('groupName').value });
      document.activeElement.blur();
      toast('Groupe renommé');
      await refresh();
    });
    action(document.getElementById('newCode'), async () => {
      if (!confirm('Générer un nouveau code ? L’ancien ne marchera plus.')) return;
      const { group } = await api('POST', 'admin/group/code');
      save('code', group.code);
      toast('Nouveau code : ' + group.code);
      await refresh();
    });
    action(document.getElementById('rosterBtn'), async () => {
      const r = await api('POST', 'admin/players', { names: document.getElementById('rosterAdd').value });
      toast(r.added.length ? `${plural(r.added.length, 'pote')} ajouté${r.added.length > 1 ? 's' : ''}` : 'Personne d’ajouté');
      if (r.errors.length) alert(r.errors.join('\n'));
      await refresh();
    });
    view.querySelectorAll('[data-rename]').forEach((b) => action(b, async () => {
      const p = player(b.dataset.rename);
      const name = prompt('Nouveau nom pour ' + p.name, p.name);
      if (!name || name === p.name) return;
      await api('PATCH', `admin/players/${p.id}`, { name });
      await refresh();
    }));
    view.querySelectorAll('[data-reset]').forEach((b) => action(b, async () => {
      const p = player(b.dataset.reset);
      if (!confirm(`Réinitialiser le compte de ${p.name} ? Iel devra rejoindre à nouveau avec un nouveau PIN (ses votes sont gardés).`)) return;
      await api('POST', `admin/players/${p.id}/reset`);
      toast('Compte réinitialisé');
      await refresh();
    }));
    view.querySelectorAll('[data-remove]').forEach((b) => action(b, async () => {
      const p = player(b.dataset.remove);
      if (!confirm(`Retirer ${p.name} du groupe ?`)) return;
      await api('DELETE', `admin/players/${p.id}`);
      await refresh();
    }));
    action(document.getElementById('saveSettings'), async () => {
      const v = (id) => document.getElementById(id).value;
      await api('PATCH', 'admin/settings', { intervalHours: v('sInterval'), pollHours: v('sPoll'), startHour: v('sStart'), endHour: v('sEnd'), timezone: v('sTz') });
      toast('Planning enregistré ⏰');
      document.activeElement.blur();
      await refresh();
    });
    action(document.getElementById('forceDrop'), async () => {
      const { poll } = await api('POST', 'admin/drop-auto');
      replacePoll(poll);
      toast('Question lancée');
      go('live');
      await refresh();
    });
    action(document.getElementById('exportQ'), async () => {
      const { questions } = await api('GET', 'admin/unscored');
      if (!questions.length) return toast('Rien à noter, tout est à jour');
      const text = 'Questions « Qui de nous ? » à noter (stats : chaos, hot, coeur, cerveau, genance, toxique, exces ; 1 à 3 stats par question, valeurs -2 à 3). Réponds en JSON {"id": {"stat": valeur}}.\n\n' + JSON.stringify(questions, null, 1);
      try {
        await navigator.clipboard.writeText(text);
        toast(`${plural(questions.length, 'question')} copiée${questions.length > 1 ? 's' : ''}`);
      } catch {
        document.getElementById('scoresIn').value = text;
        toast('Copie impossible : le texte est dans la case, copie-le à la main');
      }
    });
    action(document.getElementById('importQ'), async () => {
      const raw = document.getElementById('scoresIn').value.trim();
      const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
      let scores;
      try { scores = JSON.parse(json); } catch { throw new Error('JSON invalide'); }
      const r = await api('POST', 'admin/scores', { scores });
      toast(`${plural(r.updated, 'question')} notée${r.updated > 1 ? 's' : ''}`);
      if (r.errors.length) alert(r.errors.join('\n'));
      document.getElementById('scoresIn').value = '';
      await refresh();
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
      if (c && !c.messages.some((m) => m.id === d.id)) c.messages.push(d);
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
    } else if (type === 'del') {
      const m = c && c.messages.find((x) => x.id === d.id);
      if (m) {
        m.deleted = true;
        delete m.text;
        delete m.gif;
        if (chatOpen === d.channel) renderChatMessages();
      }
      scheduleRefresh();
    }
  }

  // ---------- Chat : liste des discussions ----------

  function lastLine(t) {
    const m = t.last[0];
    if (!m) return '<i>Aucun message : lance la discussion !</i>';
    const who = m.playerId === state.me.playerId ? 'Toi' : esc(player(m.playerId).name);
    return `${who} : ${m.deleted ? '<i>message supprimé</i>' : m.kind === 'gif' ? 'GIF' : esc(m.text)}`;
  }

  function renderChatList(view) {
    const [general, ...others] = state.chat.threads;
    const row = (t, title, icon) => `
      <button class="thread ${t.unread ? 'unread' : ''}" data-thread="${t.channel}">
        <span class="thread-icon">${icon}</span>
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
      const text = m.deleted ? '<i>message supprimé</i>' : m.kind === 'gif' ? 'GIF' : esc(m.text);
      return `
        <div class="mini-msg ${mine ? 'mine' : ''}">
          ${mine ? '' : avatar(u, 'xs')}
          <div class="mini-body">${mine ? '' : `<span class="mini-name">${esc(u.name)}</span>`}<span class="mini-bubble">${text}</span></div>
        </div>`;
    }).join('');

    view.innerHTML = `
      <button class="card group-chat" data-thread="general">
        <div class="gc-head">
          <span class="gc-title">👥 Chat du groupe</span>
          ${general.unread ? `<span class="thread-badge">${general.unread}</span>` : general.last.length ? `<span class="small muted">${ago(general.last[general.last.length - 1].at)}</span>` : ''}
        </div>
        <div class="gc-msgs">${mini || '<p class="muted small" style="margin:8px 0">Aucun message pour l’instant. Dis bonjour !</p>'}</div>
        <div class="gc-input">Écrire un message…</div>
      </button>
      <div class="section-title">Discussions des sondages</div>
      ${others.length
        ? `<div class="card threads">${others.map((t) => row(t, esc(t.text), esc(setOf(t.setId).emoji))).join('')}</div>`
        : '<div class="card empty" style="padding:18px">Les discussions sur les questions apparaîtront ici.<br>Commente un sondage depuis l’onglet Live.</div>'}`;
    view.querySelectorAll('[data-thread]').forEach((b) => (b.onclick = () => openChat(b.dataset.thread)));
  }

  // ---------- Chat : fenêtre de discussion ----------

  const $chat = document.getElementById('chatOverlay');
  let gifTimer = null;
  let lastTypingSent = 0;
  let readTimer = null;

  const tz = () => state.settings.timezone;
  const dayKey = (t) => new Date(t).toLocaleDateString('fr-FR', { timeZone: tz() });
  const hhmm = (t) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: tz() });
  function dayLabel(t) {
    if (dayKey(t) === dayKey(now())) return 'Aujourd’hui';
    if (dayKey(t) === dayKey(now() - 86400000)) return 'Hier';
    return new Date(t).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz() });
  }

  function findPoll(id) {
    return [...state.live, ...state.archive, ...((archiveExtra && archiveExtra.items) || [])].find((p) => p.id === id);
  }

  function openChat(channel) {
    if (chatOpen) closeChat(true);
    chatOpen = channel;
    const gifLabel = state.chat.gifs === 'tenor' ? 'Rechercher sur Tenor' : 'Rechercher un GIF…';
    $chat.innerHTML = `
      <div class="chat-head">
        <button class="chat-back" id="chatBack" aria-label="Retour">${icon('back')}</button>
        <div class="chat-title" id="chatTitle"></div>
      </div>
      <div class="chat-list" id="chatList"><div class="chat-empty">Chargement…</div></div>
      <div class="chat-typing" id="chatTyping"></div>
      <div class="gif-panel" id="gifPanel" hidden>
        <input class="input" id="gifSearch" placeholder="${gifLabel}" autocomplete="off" enterkeyhint="search">
        <div class="gif-grid" id="gifGrid"></div>
        ${state.chat.gifs === 'giphy' ? '<div class="gif-credit">Powered by GIPHY</div>' : ''}
      </div>
      <form class="chat-input" id="chatForm">
        <button type="button" class="gif-btn" id="gifBtn">GIF</button>
        <textarea id="chatText" rows="1" maxlength="1000" placeholder="Message…" enterkeyhint="send"></textarea>
        <button type="submit" class="send-btn" aria-label="Envoyer">${icon('send')}</button>
      </form>`;
    $chat.hidden = false;
    document.body.classList.add('noscroll');
    history.pushState({ chat: channel }, '');
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
      if (text.value.trim() && Date.now() - lastTypingSent > 2500) {
        lastTypingSent = Date.now();
        api('POST', `chat/${channel}/typing`).catch(() => {});
      }
    };
    text.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !window.matchMedia('(pointer: coarse)').matches) {
        e.preventDefault();
        form.requestSubmit();
      }
    };
    text.onfocus = () => {
      toggleGif(false);
      setTimeout(() => scrollChatBottom(), 300);
    };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const value = text.value.trim();
      if (!value) return;
      text.value = '';
      grow();
      lastTypingSent = 0;
      try {
        await sendChat({ text: value });
      } catch (err) {
        text.value = value;
        grow();
        toast(err.message);
      }
    };
    document.getElementById('gifBtn').onclick = () => toggleGif();
    document.getElementById('gifSearch').oninput = (e) => {
      clearTimeout(gifTimer);
      gifTimer = setTimeout(() => searchGifs(e.target.value), 400);
    };
    loadChat(channel);
  }

  function closeChat(silent) {
    if (!chatOpen) return;
    chatOpen = null;
    $chat.hidden = true;
    $chat.innerHTML = '';
    document.body.classList.remove('noscroll');
    if (!silent && history.state && history.state.chat) history.back();
    if (state) {
      renderNav();
      renderView();
    }
  }

  window.addEventListener('popstate', () => {
    if (chatOpen) closeChat(true);
  });

  // Sur mobile, le clavier réduit la zone visible : la fenêtre de chat suit.
  function fitChat() {
    if (!chatOpen || !window.visualViewport) return;
    $chat.style.height = window.visualViewport.height + 'px';
    $chat.style.top = window.visualViewport.offsetTop + 'px';
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', fitChat);
    window.visualViewport.addEventListener('scroll', fitChat);
  }

  function renderChatHeader() {
    const el = document.getElementById('chatTitle');
    if (!el) return;
    if (chatOpen === 'general') {
      el.innerHTML = `<b>Chat du groupe</b><span>${esc(state.group.name)} · ${plural(state.players.filter((p) => p.claimed).length, 'membre')}</span>`;
      return;
    }
    const p = findPoll(chatOpen);
    const t = state.chat.threads.find((x) => x.channel === chatOpen);
    const s = setOf((p || t || {}).setId);
    const status = p ? (p.ended ? 'terminé' : 'encore ' + left(p.endsAt)) : '';
    el.innerHTML = `<b class="clamp2">${esc((p || t || { text: 'Discussion' }).text)}</b><span>${esc(s.emoji)} ${esc(s.name)}${status ? ' · ' + status : ''}</span>`;
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
      chats.set(channel, { messages: r.messages, reads: r.reads, hasMore: r.hasMore, loaded: true });
      if (chatOpen === channel) {
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

  function renderChatMessages(forceBottom) {
    const list = document.getElementById('chatList');
    const c = chats.get(chatOpen);
    if (!list || !c) return;
    const atBottom = forceBottom || list.scrollHeight - list.scrollTop - list.clientHeight < 120;
    const myPid = state.me.playerId;

    // Accusés de lecture : chaque personne apparaît sous le dernier message qu'elle a lu.
    const readAt = new Map();
    for (const [pid, seq] of Object.entries(c.reads)) {
      if (pid === myPid) continue;
      let target = null;
      for (const m of c.messages) {
        if (m.id <= seq) target = m;
        else break;
      }
      if (!target || target.playerId === pid) continue;
      if (!readAt.has(target.id)) readAt.set(target.id, []);
      readAt.get(target.id).push(pid);
    }

    let html = c.hasMore ? '<button class="chat-older" id="chatOlder">Messages précédents</button>' : '';
    if (!c.messages.length) {
      html += `<div class="chat-empty">${chatOpen === 'general' ? 'Aucun message pour l’instant. Dis bonjour !' : 'Personne n’a encore commenté. Lance le débat !'}</div>`;
    }
    c.messages.forEach((m, i) => {
      const prev = c.messages[i - 1];
      const next = c.messages[i + 1];
      const mine = m.playerId === myPid;
      const u = player(m.playerId);
      const newDay = !prev || dayKey(prev.at) !== dayKey(m.at);
      if (newDay) html += `<div class="chat-day">${dayLabel(m.at)}</div>`;
      const first = newDay || prev.playerId !== m.playerId || m.at - prev.at > 5 * 60000;
      const last = !next || next.playerId !== m.playerId || next.at - m.at > 5 * 60000 || dayKey(next.at) !== dayKey(m.at);
      const content = m.deleted
        ? '<i>Message supprimé</i>'
        : m.kind === 'gif'
          ? `<img src="${esc(m.gif.url)}" width="${m.gif.w}" height="${m.gif.h}" alt="GIF" loading="lazy">`
          : esc(m.text);
      const canDelete = !m.deleted && (mine || state.me.isAdmin);
      html += `
        <div class="msg ${mine ? 'mine' : ''} ${first ? 'first' : ''} ${last ? 'last' : ''}">
          ${mine ? '' : last ? avatar(u, 'sm') : '<span class="avatar-space"></span>'}
          <div class="msg-body">
            ${!mine && first ? `<div class="msg-name">${esc(u.name)}</div>` : ''}
            <div class="bubble ${m.kind === 'gif' && !m.deleted ? 'gif' : ''} ${m.deleted ? 'deleted' : ''}" ${canDelete ? `data-delmsg="${m.id}"` : ''}>${content}</div>
            ${last ? `<div class="msg-time">${hhmm(m.at)}</div>` : ''}
          </div>
        </div>`;
      const readers = readAt.get(m.id);
      if (readers) html += `<div class="read-row ${mine ? 'mine' : ''}" title="Vu par ${esc(readers.map((pid) => player(pid).name).join(', '))}">${readers.map((pid) => avatar(player(pid), 'xs')).join('')}</div>`;
    });
    list.innerHTML = html;

    list.querySelectorAll('img').forEach((img) => (img.onload = () => { if (atBottom) scrollChatBottom(); }));
    list.querySelectorAll('[data-delmsg]').forEach((b) => {
      b.onclick = async () => {
        if (!confirm('Supprimer ce message ?')) return;
        try {
          await api('DELETE', `chat/${chatOpen}/messages/${b.dataset.delmsg}`);
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

  function renderTyping() {
    const el = document.getElementById('chatTyping');
    if (!el) return;
    const t = typing.get(chatOpen);
    const who = t ? [...t].filter(([, exp]) => exp > Date.now()).map(([pid]) => player(pid).name) : [];
    el.innerHTML = who.length
      ? `<span class="dots"><i></i><i></i><i></i></span>${esc(who.length === 1 ? `${who[0]} écrit…` : who.length === 2 ? `${who[0]} et ${who[1]} écrivent…` : 'Plusieurs personnes écrivent…')}`
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
    }, 300);
  }

  async function sendChat(body) {
    const channel = chatOpen;
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
    if (!state.chat.gifs) {
      document.getElementById('gifGrid').innerHTML = '<p class="muted small gif-msg">Les GIFs ne sont pas encore activés sur le serveur (il manque une clé GIPHY).</p>';
      return;
    }
    document.getElementById('chatText').blur();
    searchGifs(document.getElementById('gifSearch').value);
  }

  async function searchGifs(q) {
    const grid = document.getElementById('gifGrid');
    if (!grid) return;
    grid.innerHTML = '<p class="muted small gif-msg">Chargement…</p>';
    try {
      const { results } = await api('GET', 'gifs?q=' + encodeURIComponent(q.trim()));
      if (!document.getElementById('gifGrid')) return;
      grid.innerHTML = results.length
        ? results.map((r, i) => `<button type="button" class="gif-item" data-gif="${i}"><img src="${esc(r.preview)}" alt="GIF" loading="lazy"></button>`).join('')
        : '<p class="muted small gif-msg">Aucun GIF trouvé 🤷</p>';
      grid.querySelectorAll('[data-gif]').forEach((b) => {
        action(b, async () => {
          const r = results[Number(b.dataset.gif)];
          await sendChat({ gif: { url: r.url, w: r.w, h: r.h } });
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
    if (!reg || !state.vapidKey) throw new Error('Ce navigateur ne gère pas les notifications');
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
        ? 'Sur iPhone, installe d’abord l’app sur l’écran d’accueil (Partager → Sur l’écran d’accueil) et ouvre-la depuis l’icône.'
        : 'Les notifications ne sont pas disponibles sur ce navigateur.';
      btn.disabled = true;
      return;
    }
    const sub = await swReg.pushManager.getSubscription();
    const perm = Notification.permission;
    const on = !!sub && perm === 'granted' && !load('pushOff');
    status.textContent = on
      ? 'Activées sur cet appareil.'
      : perm === 'denied'
        ? 'Bloquées. Autorise les notifications pour cette app dans les réglages du téléphone, puis reviens ici.'
        : 'Désactivées sur cet appareil.';
    btn.textContent = on ? 'Désactiver' : 'Activer les notifications';
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
          toast('Notifications désactivées');
        } else {
          // iPhone : la demande d'autorisation doit partir directement du clic, sans attente avant.
          const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
          if (p !== 'granted') throw new Error('Autorisation refusée');
          save('pushOff', null);
          await subscribePush();
          toast('Notifications activées');
        }
      } catch (e) {
        toast(e.message);
      }
      setupPushButton(pushOk);
    };

    testBtn.onclick = async () => {
      testBtn.disabled = true;
      out.textContent = 'Envoi…';
      try {
        await subscribePush();
        const r = await api('POST', 'push/test');
        out.textContent = !r.devices
          ? 'Aucun appareil enregistré.'
          : r.results.map((x) => (x.ok ? `Envoyé (${x.service}) : la notification doit arriver dans quelques secondes.` : `Échec (${x.service}) : ${x.status || ''} ${x.error || ''}`)).join('\n');
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
  if (inviteCode || pendingChat) history.replaceState(null, '', '/');
  if (token) {
    inviteCode = null;
    $app.innerHTML = '<div class="auth"><span class="logo-emoji">🤔</span></div>';
    refresh().then(() => { if (!state && token) renderAuth('login', 'Impossible de charger. Réessaie.'); });
  } else {
    renderAuth(inviteCode ? 'join' : null);
  }
})();
