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
  let pollTimer = null;
  let swReg = null;
  let inviteCode = new URLSearchParams(location.search).get('code');

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
        fields = codeField('Demande-le à tes potes 🤫');
      } else {
        fields = `
          <div class="info">Groupe <b>${esc(roster.group.name)}</b> · <button type="button" class="link" id="otherCode">changer de code</button></div>
          <label>Qui es-tu ?</label>
          ${roster.players.length ? `<div class="pick-grid">${roster.players.map((p) => `
            <button type="button" class="choice ${picked && picked.id === p.id ? 'picked' : ''}" data-pick="${p.id}">${avatar(p)}<span>${esc(p.name)}</span></button>`).join('')}</div>`
            : '<div class="info">Tout le monde a déjà rejoint 🤔 Demande à l’admin de t’ajouter.</div>'}
          ${picked ? `
            <label for="name">Ton pseudo (tu peux le changer 😏)</label>
            <input class="input" id="name" required maxlength="24" value="${esc(picked.name)}">
            ${pinField()}
            <label>Ton emoji</label>${emojiGrid(EMOJIS, emoji)}` : ''}`;
      }
      const label = mode === 'create' ? 'Créer le groupe 🚀' : mode === 'login' ? 'Entrer 🔓' : roster ? 'C’est parti 🚀' : 'Continuer →';
      const hideBtn = mode === 'join' && roster && !picked;

      $app.innerHTML = `
        <div class="auth">
          <form class="auth-box" id="authForm" autocomplete="off">
            <span class="logo-emoji">🤔</span>
            <h1 class="logo">Qui de nous ?</h1>
            <p class="tagline">Une question toutes les 3 h. Votes anonymes. Verdicts sans pitié.</p>
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
    const text = `Rejoins « ${state.group.name} » sur Qui de nous ? 🤔\nCode : ${state.group.code}\n${inviteLink()}`;
    openSheet(`
      <div class="sheet-head"><h2>${justCreated ? 'Groupe créé 🎉' : 'Inviter des potes'}</h2><button class="x" data-close>✕</button></div>
      <p class="muted" style="margin:0 0 6px">Envoie ce code (ou le lien) à tes potes pour qu’ils rejoignent <b>${esc(state.group.name)}</b>.</p>
      <div class="big-code">${esc(state.group.code)}</div>
      <div class="row">
        <button class="btn btn-main" id="shareBtn">${navigator.share ? '📤 Partager' : '📋 Copier le lien'}</button>
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
      root.querySelector('#copyCode').onclick = () => copy(state.group.code, 'Code copié 📋');
      root.querySelector('#shareBtn').onclick = async () => {
        if (navigator.share) {
          try { await navigator.share({ title: 'Qui de nous ?', text }); } catch { /* annulé */ }
        } else copy(text, 'Invitation copiée 📋');
      };
    });
  }

  function pinField() {
    return `
      <label for="pin">PIN secret (4 à 6 chiffres)</label>
      <input class="input" id="pin" required inputmode="numeric" pattern="\\d{4,6}" maxlength="6" type="password" placeholder="••••">`;
  }

  function logoutLocal() {
    token = null;
    state = null;
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
    } catch (e) {
      if (token) toast(e.message);
    }
  }

  function busy() {
    const a = document.activeElement;
    return !$sheet.hidden || (a && ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName));
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(async () => {
      if (document.hidden || !token) return;
      try {
        const next = await api('GET', 'state');
        const changed = JSON.stringify({ ...next, now: 0 }) !== JSON.stringify({ ...state, now: 0 });
        state = next;
        if (busy() || !changed) renderNav();
        else renderMain();
      } catch { /* on réessaiera */ }
    }, 15000);
  }

  function stopPolling() {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && token && state) refresh();
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
          <button class="me-chip" id="meChip"></button>
        </header>
        <main id="view"></main>
        <nav class="nav"><div class="nav-inner" id="nav"></div></nav>`;
      document.getElementById('meChip').onclick = () => go('me');
    }
    const m = me();
    document.getElementById('groupTitle').textContent = `🤔 ${state.group.name}`;
    document.getElementById('meChip').innerHTML = `${avatar(m)}<span>${esc(m.name)}</span>`;
    renderNav();
    renderView();
  }

  function renderNav() {
    const n = todoCount();
    const items = [
      ['live', '🗳️', 'Live', n],
      ['archive', '📜', 'Archives', 0],
      ['sets', '📚', 'Sets', 0],
      ['stats', '📊', 'Stats', 0],
      ['me', '🙂', 'Moi', 0],
    ];
    const nav = document.getElementById('nav');
    if (!nav) return;
    nav.innerHTML = items
      .map(([id, ico, label, badge]) => `
        <button data-tab="${id}" class="${tab === id ? 'on' : ''}">
          <span class="ico">${ico}</span>${label}
          ${badge ? `<span class="badge">${badge}</span>` : ''}
        </button>`)
      .join('');
    nav.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => go(b.dataset.tab)));
    document.title = n ? `(${n}) Qui de nous ?` : 'Qui de nous ?';
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
    ({ live: renderLive, archive: renderArchive, sets: renderSets, stats: renderStats, me: renderMe }[tab] || renderLive)(view);
  }

  // ---------- Cartes de sondage ----------

  function pollCard(p) {
    const s = setOf(p.setId);
    const voting = !p.ended && (!p.myVote || editing === p.id);
    const total = p.voterIds.length;
    const by = p.droppedBy ? player(p.droppedBy) : null;
    const canDelete = state.me.isAdmin || p.mine;

    let body;
    if (voting) {
      body = `<div class="choices">${state.players
        .map((u) => `
          <button class="choice ${p.myVote === u.id ? 'picked' : ''}" data-vote="${p.id}" data-target="${u.id}">
            ${avatar(u)}<span>${esc(u.id === state.me.playerId ? u.name + ' (moi)' : u.name)}</span>
          </button>`)
        .join('')}</div>`;
    } else {
      const counts = Object.entries(p.results || {}).sort((a, b) => b[1] - a[1]);
      const max = counts.length ? counts[0][1] : 0;
      body = counts.length
        ? `<div class="results">${counts
            .map(([id, c]) => {
              const u = player(id);
              const pct = total ? Math.round((c / total) * 100) : 0;
              return `
                <div class="result ${p.myVote === id ? 'mine' : ''}">
                  <span class="bar" style="width:${pct}%;background:${esc(u.color)}"></span>
                  ${avatar(u)}
                  <span class="name">${esc(u.name)}</span>
                  ${c === max ? '<span class="crown">👑</span>' : ''}
                  <span class="votes">${c}</span>
                  <span class="pct">${pct}%</span>
                </div>`;
            })
            .join('')}</div>`
        : `<div class="empty" style="padding:12px">Personne n’a voté 😶</div>`;
    }

    const voters = p.voterIds.slice(0, 7).map((id) => avatar(player(id))).join('');
    const actions = [];
    if (!p.ended && p.myVote && editing !== p.id) actions.push(`<button class="btn btn-soft btn-small" data-edit="${p.id}">Changer mon vote</button>`);
    if (editing === p.id) actions.push(`<button class="btn btn-soft btn-small" data-cancel>Annuler</button>`);
    if (canDelete) actions.push(`<button class="btn btn-small btn-danger" data-del="${p.id}" aria-label="Supprimer">🗑️</button>`);

    return `
      <article class="card ${voting && !p.myVote ? 'todo' : ''}">
        <div class="meta">
          ${setBadge(s)}
          <span class="pill ${p.ended ? 'closed' : ''}">${p.ended ? 'Terminé' : '⏳ ' + left(p.endsAt)}</span>
        </div>
        <h2 class="question">${esc(p.text)}</h2>
        ${body}
        <div class="foot">
          <div class="voters">
            ${total ? `<span class="stack">${voters}</span>` : ''}
            <span>${total}/${state.players.length} ${total > 1 ? 'ont voté' : 'a voté'}</span>
          </div>
          ${actions.join('')}
        </div>
        <div class="byline">${by ? `Lancée par ${esc(by.name)}` : '🎲 Drop auto'} · ${ago(p.startsAt)}</div>
      </article>`;
  }

  function bindPollCards(view, list) {
    view.querySelectorAll('[data-vote]').forEach((b) => {
      b.onclick = async () => {
        view.querySelectorAll(`[data-vote="${b.dataset.vote}"]`).forEach((x) => (x.disabled = true));
        try {
          const { poll } = await api('POST', `polls/${b.dataset.vote}/vote`, { playerId: b.dataset.target });
          replacePoll(poll);
          editing = null;
          toast('Vote enregistré 🤫');
          renderMain();
        } catch (e) {
          toast(e.message);
          refresh();
        }
      };
    });
    view.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => { editing = b.dataset.edit; renderView(); }));
    view.querySelectorAll('[data-cancel]').forEach((b) => (b.onclick = () => { editing = null; renderView(); }));
    view.querySelectorAll('[data-del]').forEach((b) => {
      action(b, async () => {
        if (!confirm('Supprimer ce sondage pour tout le monde ?')) return;
        await api('DELETE', `polls/${b.dataset.del}`);
        state.live = state.live.filter((p) => p.id !== b.dataset.del);
        state.archive = state.archive.filter((p) => p.id !== b.dataset.del);
        if (archiveExtra) archiveExtra.items = archiveExtra.items.filter((p) => p.id !== b.dataset.del);
        toast('Sondage supprimé');
        renderMain();
      });
    });
  }

  function replacePoll(poll) {
    const i = state.live.findIndex((p) => p.id === poll.id);
    if (i >= 0) state.live[i] = poll;
    else state.live.unshift(poll);
  }

  // ---------- Live ----------

  function renderLive(view) {
    const todo = state.live.filter((p) => !p.myVote);
    const done = state.live.filter((p) => p.myVote);
    const next = state.nextDrop
      ? `Prochaine question <b>${clock(state.nextDrop)}</b>`
      : 'Pas de prochain drop prévu';

    view.innerHTML = `
      ${installBanner()}
      <div class="next-drop">
        <span>⏰ ${next}</span>
        <span class="muted">${plural(state.remainingQuestions, 'question')} en réserve</span>
      </div>
      ${!state.live.length ? `
        <div class="card empty">
          <span class="big">🦗</span>
          Rien à voter pour l’instant…<br>Lance une question si tu t’ennuies !
        </div>` : ''}
      ${todo.length ? `<div class="section-title">🔥 À toi de voter <span class="count">${todo.length}</span></div>${todo.map(pollCard).join('')}` : ''}
      ${!todo.length && done.length ? `<div class="card empty" style="padding:18px"><span class="big" style="font-size:2rem">😌</span>Tu as voté partout.</div>` : ''}
      ${done.length ? `<div class="section-title">⏳ En cours <span class="count">${done.length}</span></div>${done.map(pollCard).join('')}` : ''}
      <button class="fab" id="fab" aria-label="Lancer une question">＋</button>`;

    bindPollCards(view);
    bindInstallBanner();
    document.getElementById('fab').onclick = () => openDropSheet();
  }

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
    toast('App installée 🎉');
    if (state && tab === 'live') renderView();
  });

  function installBanner() {
    if (isStandalone() || load('installHidden')) return '';
    if (!installPrompt && !isIOS) return '';
    return `
      <div class="install-banner">
        <span class="ib-icon">📲</span>
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
        <div class="sheet-head"><h2>Installer sur iPhone 📲</h2><button class="x" data-close>✕</button></div>
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
      openSheet(`
        <div class="sheet-head"><h2>Lancer une question ✨</h2><button class="x" data-close>✕</button></div>
        <p class="muted" style="margin:0 0 10px">Elle part tout de suite pour 24 h, avec une notif pour tout le monde.</p>
        <label>Dans quel set ?</label>
        <div class="set-chips">
          <button class="chip ${!setId ? 'on' : ''}" data-set="">🎲 N’importe lequel</button>
          ${sets.map((x) => `<button class="chip ${setId === x.id ? 'on' : ''} ${x.spicy ? 'spicy' : ''}" data-set="${x.id}">${esc(x.emoji)} ${esc(x.name)}</button>`).join('')}
        </div>
        <button class="btn btn-main btn-block" id="dropRandom" ${s && !s.remaining ? 'disabled' : ''}>🎲 Question surprise${s ? ` (${s.remaining} dispo)` : ''}</button>
        <div class="or">ou écris la tienne</div>
        <textarea class="input" id="ownQ" maxlength="200" placeholder="${s ? 'Qui est le plus susceptible de…' : 'Choisis d’abord un set ☝️'}" ${s ? '' : 'disabled'}></textarea>
        <button class="btn btn-soft btn-block" id="dropOwn" ${s ? '' : 'disabled'}>Lancer ma question 🚀</button>`, (root) => {
        root.querySelectorAll('[data-set]').forEach((b) => (b.onclick = () => { setId = b.dataset.set; draw(); }));
        action(root.querySelector('#dropRandom'), () => drop({ setId: setId || undefined }));
        action(root.querySelector('#dropOwn'), () => {
          const text = root.querySelector('#ownQ').value.trim();
          if (text.length < 8) throw new Error('Écris une vraie question 😅');
          return drop({ setId, text });
        });
      });
    };
    draw();
  }

  async function drop(body) {
    const { poll } = await api('POST', 'drop', body);
    replacePoll(poll);
    closeSheet();
    confetti();
    toast('Question lancée ! À toi de voter 👀');
    tab = 'live';
    save('tab', tab);
    await refresh();
  }

  // ---------- Archives ----------

  function renderArchive(view) {
    const data = archiveExtra || { items: state.archive, hasMore: state.archiveHasMore };
    view.innerHTML = `
      <div class="filter-row">
        <select class="input" id="archSet">
          <option value="">Tous les sets</option>
          ${state.sets.map((s) => `<option value="${s.id}" ${archiveSet === s.id ? 'selected' : ''}>${esc(s.emoji)} ${esc(s.name)}</option>`).join('')}
        </select>
      </div>
      ${data.items.length ? data.items.map(pollCard).join('') : `<div class="card empty"><span class="big">📜</span>Rien dans les archives pour l’instant.<br>Les questions y arrivent après leurs 24 h de vote.</div>`}
      ${data.hasMore ? '<button class="btn btn-soft btn-block" id="more">Voir plus</button>' : ''}`;

    bindPollCards(view);
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
      <div class="section-title">📚 Les sets <span class="count">${classic.length}</span></div>
      ${grid(classic)}
      ${spicy.length ? `<div class="section-title">🌶️ Spicy · 18+ <span class="count">${spicy.length}</span></div>${grid(spicy)}` : ''}`;

    view.querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => { openSet = b.dataset.open; setDetail = null; renderView(); window.scrollTo({ top: 0 }); }));
    document.getElementById('newSet').onclick = () => openSetForm();
  }

  function openSetForm(existing) {
    let emoji = existing ? existing.emoji : '✨';
    openSheet(`
      <div class="sheet-head"><h2>${existing ? 'Modifier le set' : 'Nouveau set ✨'}</h2><button class="x" data-close>✕</button></div>
      <label for="setName">Nom</label>
      <input class="input" id="setName" maxlength="40" placeholder="Ex : Les vacances à Lisbonne" value="${esc(existing ? existing.name : '')}">
      <label for="setDesc">Description</label>
      <input class="input" id="setDesc" maxlength="120" placeholder="De quoi ça parle ?" value="${esc(existing ? existing.description : '')}">
      <label>Emoji</label>${emojiGrid(SET_EMOJIS, emoji)}
      <label class="toggle"><input type="checkbox" id="setSpicy" ${existing && existing.spicy ? 'checked' : ''}> <span>🌶️ Set spicy (18+)</span></label>
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
        toast(existing ? 'Set modifié ✅' : 'Set créé ! Ajoute des questions 👇');
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
        <p class="set-count" style="margin:10px 0 0">${s.played} jouée${s.played > 1 ? 's' : ''} · 🔒 ${s.remaining} encore secrète${s.remaining > 1 ? 's' : ''}</p>
        <div class="row">
          <button class="btn btn-main" id="dropHere" ${s.remaining ? '' : 'disabled'}>🎲 Lancer</button>
          ${canEdit ? '<button class="btn btn-soft" id="editSet">✏️ Modifier</button>' : ''}
        </div>
      </div>

      <div class="card">
        <label for="newQ" style="margin-top:0">Ajouter des questions</label>
        <textarea class="input" id="newQ" placeholder="Une question par ligne.&#10;Qui est le plus susceptible de…"></textarea>
        <p class="muted small">Elles restent secrètes jusqu’à ce qu’elles tombent. Pas de doublons : on vérifie !</p>
        <button class="btn btn-soft btn-block" id="addQ" style="margin-top:10px">Ajouter au set</button>
      </div>

      ${d.mine.length ? `
        <div class="section-title">🤫 Tes questions en attente <span class="count">${d.mine.length}</span></div>
        <div class="card qlist">${d.mine.map((q) => `
          <div class="qrow"><span>${esc(q.text)}</span><button class="btn btn-small btn-danger" data-delq="${q.id}" aria-label="Supprimer">🗑️</button></div>`).join('')}
        </div>` : ''}

      <div class="section-title">✅ Déjà jouées <span class="count">${d.played.length}</span></div>
      ${d.played.length ? `<div class="card qlist">${d.played.map((q) => `<div class="qrow"><span>${esc(q.text)}</span><span class="muted small">${ago(q.usedAt)}</span></div>`).join('')}</div>`
        : '<div class="card empty" style="padding:18px">Aucune question jouée pour l’instant.</div>'}
      ${canEdit && !s.played ? '<button class="btn btn-danger btn-block" id="delSet">Supprimer ce set</button>' : ''}`;

    document.getElementById('back').onclick = () => { openSet = null; renderView(); };
    document.getElementById('dropHere').onclick = () => openDropSheet(s.id);
    if (canEdit) document.getElementById('editSet').onclick = () => openSetForm(s);
    action(document.getElementById('addQ'), async () => {
      const text = document.getElementById('newQ').value;
      const r = await api('POST', `sets/${s.id}/questions`, { text });
      toast(r.added.length ? `${plural(r.added.length, 'question')} ajoutée${r.added.length > 1 ? 's' : ''} 🤫` : 'Rien ajouté');
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
        <div class="radar-title">${avatar(p)}<div><b>${esc(p.name)}</b><div class="muted small">${plural(ps.polls, 'sondage')} où iel a reçu des votes</div></div></div>
        ${anyData ? window.radarSvg(defs, ps.value, p.color, active.length > 1 ? avg : null) : '<div class="empty">📊<br>Les stats arrivent quand les premiers sondages se terminent.</div>'}
        ${anyData && active.length > 1 ? '<div class="legend"><span class="dash"></span> moyenne du groupe</div>' : ''}
        ${myTitles.length ? `<div class="title-chips">${myTitles.map((t) => `<span class="title-chip ${t.low ? 'low' : ''}">${t.emoji} ${esc(t.title)}</span>`).join('')}</div>` : ''}
      </div>
      ${ps.wins.length ? `
        <div class="section-title">🏅 Élu·e pour… <span class="count">${ps.wins.length}</span></div>
        <div class="card qlist">${ps.wins.slice(0, 15).map((w) => `<div class="qrow"><span>${esc(w.text)}</span><span class="muted small">${esc(setOf(w.setId).emoji)}</span></div>`).join('')}</div>` : ''}
      ${st.titles.length ? `
        <div class="section-title">🏆 Les titres du groupe</div>
        <div class="card titles-board">${st.titles.map((t) => `
          <div class="title-row">${avatar(player(t.playerId), 'sm')}<span class="name">${esc(player(t.playerId).name)}</span><span class="title-chip ${t.low ? 'low' : ''}">${t.emoji} ${esc(t.title)}</span></div>`).join('')}
        </div>` : ''}
      <div class="section-title">📊 Classements</div>
      ${defs.map(ranking).join('')}`;

    view.querySelectorAll('[data-player]').forEach((b) => (b.onclick = () => { statsPlayer = b.dataset.player; renderView(); }));
  }

  // ---------- Moi & admin ----------

  function renderMe(view) {
    const m = me();
    const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const pushOk = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && state.vapidKey;

    view.innerHTML = `
      <div class="card" style="text-align:center">
        <span class="avatar xl" style="background:${esc(m.color)}33">${esc(m.emoji)}</span>
        <h2 class="question" style="margin:8px 0 0">${esc(m.name)}${state.me.isAdmin ? ' 👑' : ''}</h2>
        ${state.me.isAdmin ? '<p class="muted" style="margin:4px 0 0">Admin du groupe</p>' : ''}
      </div>

      <div class="card" id="profileCard">
        <label for="myName" style="margin-top:0">Mon pseudo</label>
        <div class="inline-form">
          <input class="input" id="myName" maxlength="24" value="${esc(m.name)}">
          <button class="btn btn-soft" id="saveName">OK</button>
        </div>
        <label>Mon emoji</label>
        ${emojiGrid(EMOJIS, m.emoji)}
      </div>

      <div class="card group-card">
        <label style="margin-top:0">👥 ${esc(state.group.name)}</label>
        <div class="group-code-row">
          <span class="muted small">Code du groupe</span>
          <span class="code-pill">${esc(state.group.code)}</span>
        </div>
        <button class="btn btn-main btn-block" id="inviteBtn" style="margin-top:12px">📤 Inviter des potes</button>
      </div>

      <div class="card">
        <label style="margin-top:0">🔔 Notifications</label>
        <p class="muted small" id="pushStatus">…</p>
        ${iOS && !standalone ? '<div class="info">Sur iPhone : touche <b>Partager</b> → <b>Sur l’écran d’accueil</b>, puis ouvre l’app depuis l’icône pour activer les notifs.</div>' : ''}
        <button class="btn btn-main btn-block" id="pushBtn" ${pushOk ? '' : 'disabled'}>Activer les notifs</button>
      </div>

      ${state.me.isAdmin ? adminHtml() : ''}

      <button class="btn btn-soft btn-block" id="logout">Se déconnecter</button>`;

    action(document.getElementById('saveName'), async () => {
      await api('PATCH', 'me', { name: document.getElementById('myName').value });
      document.activeElement.blur();
      toast('Pseudo changé ✅');
      await refresh();
    });
    bindEmojiGrid(document.getElementById('profileCard'), async (emoji) => {
      try {
        await api('PATCH', 'me', { emoji });
        toast('Nouveau look ' + emoji);
        await refresh();
      } catch (e) { toast(e.message); }
    });
    setupPushButton(pushOk);
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
      <div class="section-title">👑 Admin</div>

      <div class="card">
        <label for="groupName" style="margin-top:0">Nom du groupe</label>
        <div class="inline-form">
          <input class="input" id="groupName" maxlength="40" value="${esc(state.group.name)}">
          <button class="btn btn-soft" id="saveGroup">OK</button>
        </div>
        <p class="muted small" style="margin:10px 0 0">Le code a fuité ? Génère-en un nouveau : l’ancien ne marchera plus (ceux qui ont déjà rejoint restent connectés).</p>
        <button class="btn btn-soft btn-block" id="newCode" style="margin-top:10px">🔄 Nouveau code</button>
      </div>

      <div class="card">
        <label style="margin-top:0">👥 Les potes <span class="muted small">(${state.players.length})</span></label>
        <p class="muted small">Ajoute tout le monde ici, même ceux qui n’ont pas encore rejoint : on peut déjà voter pour eux.</p>
        <div class="roster">${state.players.map((p) => `
          <div class="roster-row">
            ${avatar(p, 'sm')}
            <span class="name">${esc(p.name)}</span>
            <span class="status ${p.claimed ? 'on' : ''}">${p.claimed ? 'a rejoint' : 'en attente'}</span>
            <button class="icon-btn" data-rename="${p.id}" title="Renommer">✏️</button>
            ${p.claimed && p.id !== state.me.playerId ? `<button class="icon-btn" data-reset="${p.id}" title="Réinitialiser le compte (PIN oublié)">🔑</button>` : ''}
            ${!p.claimed ? `<button class="icon-btn" data-remove="${p.id}" title="Retirer">🗑️</button>` : ''}
          </div>`).join('')}
        </div>
        <textarea class="input" id="rosterAdd" placeholder="Un nom par ligne&#10;Alex&#10;John&#10;Carlos" style="margin-top:12px;min-height:80px"></textarea>
        <button class="btn btn-main btn-block" id="rosterBtn" style="margin-top:10px">Ajouter</button>
      </div>

      <div class="card">
        <label style="margin-top:0">⏰ Planning des questions</label>
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
          <button class="btn btn-soft" id="forceDrop">🎲 Drop maintenant</button>
        </div>
      </div>

      <div class="card">
        <label style="margin-top:0">🧪 Questions à noter</label>
        <p class="muted small">Les questions créées par le groupe n’ont pas encore de stats. Copie-les, donne-les à Claude, puis colle sa réponse ici.</p>
        <button class="btn btn-soft btn-block" id="exportQ">📋 Copier les questions à noter</button>
        <textarea class="input" id="scoresIn" placeholder='Réponse de Claude : {"id": {"chaos": 2, "hot": 1}, …}' style="margin-top:12px;min-height:80px"></textarea>
        <button class="btn btn-main btn-block" id="importQ" style="margin-top:10px">Importer les scores</button>
      </div>`;
  }

  function bindAdmin(view) {
    action(document.getElementById('saveGroup'), async () => {
      await api('PATCH', 'admin/group', { name: document.getElementById('groupName').value });
      document.activeElement.blur();
      toast('Groupe renommé ✅');
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
      toast(r.added.length ? `${plural(r.added.length, 'pote')} ajouté${r.added.length > 1 ? 's' : ''} 🎉` : 'Personne d’ajouté');
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
      confetti();
      toast('Question lancée 🎲');
      go('live');
      await refresh();
    });
    action(document.getElementById('exportQ'), async () => {
      const { questions } = await api('GET', 'admin/unscored');
      if (!questions.length) return toast('Rien à noter, tout est à jour ✅');
      const text = 'Questions « Qui de nous ? » à noter (stats : chaos, hot, cerveau, genance, toxique, exces ; 1 à 3 stats par question, valeurs -2 à 3). Réponds en JSON {"id": {"stat": valeur}}.\n\n' + JSON.stringify(questions, null, 1);
      try {
        await navigator.clipboard.writeText(text);
        toast(`${plural(questions.length, 'question')} copiée${questions.length > 1 ? 's' : ''} 📋`);
      } catch {
        document.getElementById('scoresIn').value = text;
        toast('Copie impossible : le texte est dans la case, copie-le à la main');
      }
    });
    action(document.getElementById('importQ'), async () => {
      const raw = document.getElementById('scoresIn').value.trim();
      const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
      let scores;
      try { scores = JSON.parse(json); } catch { throw new Error('JSON invalide 🤔'); }
      const r = await api('POST', 'admin/scores', { scores });
      toast(`${plural(r.updated, 'question')} notée${r.updated > 1 ? 's' : ''} ✅`);
      if (r.errors.length) alert(r.errors.join('\n'));
      document.getElementById('scoresIn').value = '';
      await refresh();
    });
  }

  // ---------- Notifications push ----------

  function b64ToBytes(b64) {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }

  async function setupPushButton(pushOk) {
    const btn = document.getElementById('pushBtn');
    const status = document.getElementById('pushStatus');
    if (pushOk && !swReg) swReg = await swReady;
    if (!document.body.contains(btn)) return;
    if (!pushOk || !swReg) {
      status.textContent = 'Les notifs ne sont pas dispo sur ce navigateur (il faut https ou localhost).';
      return;
    }
    const sub = await swReg.pushManager.getSubscription();
    const denied = Notification.permission === 'denied';
    status.textContent = sub ? 'Activées sur cet appareil ✅' : denied ? 'Bloquées dans les réglages du navigateur 🚫' : 'Désactivées sur cet appareil.';
    btn.textContent = sub ? 'Désactiver les notifs' : 'Activer les notifs';
    btn.disabled = denied && !sub;
    action(btn, async () => {
      const current = await swReg.pushManager.getSubscription();
      if (current) {
        await api('POST', 'push/unsubscribe', { endpoint: current.endpoint });
        await current.unsubscribe();
        toast('Notifs désactivées 🔕');
      } else {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') throw new Error('Notifs refusées 🚫');
        const s = await swReg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(state.vapidKey) });
        await api('POST', 'push/subscribe', { subscription: s.toJSON() });
        toast('Notifs activées 🔔');
      }
      setupPushButton(pushOk);
    });
  }

  const swReady = 'serviceWorker' in navigator
    ? navigator.serviceWorker.register('/sw.js').then((r) => (swReg = r)).catch(() => null)
    : Promise.resolve(null);

  // ---------- Démarrage ----------

  if (inviteCode) {
    save('code', inviteCode.toUpperCase());
    history.replaceState(null, '', '/');
  }
  if (token) {
    inviteCode = null;
    $app.innerHTML = '<div class="auth"><span class="logo-emoji">🤔</span></div>';
    refresh().then(() => { if (!state && token) renderAuth('login', 'Impossible de charger. Réessaie.'); });
  } else {
    renderAuth(inviteCode ? 'join' : null);
  }
})();
