// Nouveautés de l'app (les plus récentes d'abord). À chaque mise en ligne d'une nouvelle version (nouvel
// identifiant en tête de liste), tout le monde reçoit une notification une seule fois, dans sa langue.
// Pour une nouvelle version : ajouter une entrée EN HAUT, avec un id jamais utilisé (la date suffit).
const RELEASES = [
  {
    id: '2026-10-12',
    date: '2026-10-12',
    title: { fr: 'Séries, récap du mois et plus besoin de compte', en: 'Streaks, monthly recap and no more sign-up' },
    fr: [
      '🔥 Séries : chaque jour où tu votes compte, et le groupe a sa propre série quand tout le monde vote. Un rappel le soir si ta série va s’arrêter.',
      '🎁 Récap du mois façon Wrapped (Stats → Groupe) : la star du mois, les unanimités, la question préférée, tes affinités…',
      '👋 Plus d’inscription : on ouvre le lien, on choisit son nom, c’est parti. Un PIN reste possible pour changer de téléphone.',
      '🔑 Compte perdu ? Rejoins avec le code et choisis ton nom : le groupe confirme que c’est bien toi.',
      '🧩 Option Quiz (pour l’admin) : quelques questions anonymes pour que les questions collent mieux au groupe.',
      '👆 Glisse à gauche / à droite pour changer d’onglet.',
      '🕐 Les heures s’affichent dans ton fuseau horaire.',
      '⚙️ L’admin choisit combien de questions en plus chacun peut lancer par jour (1 par défaut), et pas plus d’une question auto toutes les 4 h.',
      '🛠️ Corrigé : le bouton retour qui fermait l’app sur certains Android, le chat qui sautait en bas en remontant, les discussions pas à jour, l’écran qui clignotait à l’ouverture, ta question perso effacée en changeant de set. Mode sombre plus lisible.',
      '✨ Ce petit coin Nouveautés, et un bouton pour signaler un bug ou donner ton avis.',
    ],
    en: [
      '🔥 Streaks: every day you vote counts, and the group has its own streak when everyone votes. An evening reminder if yours is about to end.',
      '🎁 Wrapped-style monthly recap (Stats → Group): star of the month, unanimous votes, favourite question, your connections…',
      '👋 No more sign-up: open the link, pick your name, done. You can still add a PIN to switch phones.',
      '🔑 Lost your account? Join with the code and pick your name: the group confirms it’s really you.',
      '🧩 Quiz option (for admins): a few anonymous questions so the questions fit your group better.',
      '👆 Swipe left / right to switch tabs.',
      '🕐 Times now show in your own time zone.',
      '⚙️ Admins choose how many extra questions everyone can launch per day (1 by default), and auto questions are at most one every 4 hours.',
      '🛠️ Fixed: the back button closing the app on some Androids, the chat jumping to the bottom while scrolling up, chats not up to date, the screen flashing on launch, your own question being wiped when switching sets. Clearer dark mode.',
      '✨ This little What’s new corner, and a button to report a bug or share feedback.',
    ],
  },
  {
    id: '2026-10-06',
    date: '2026-10-06',
    title: { fr: 'Un compte, plusieurs groupes', en: 'One account, several groups' },
    fr: [
      '👥 Un seul compte pour tous tes groupes, avec un écran d’accueil pour passer de l’un à l’autre.',
      '🙂 Un pseudo, une photo et une couleur différents dans chaque groupe.',
      '🔔 Les notifications de tous tes groupes, et un tap ouvre le bon.',
      '🔄 Actualiser garde le groupe, l’onglet et la discussion ouverts.',
    ],
    en: [
      '👥 One account for all your groups, with a home screen to switch between them.',
      '🙂 A different name, photo and colour in each group.',
      '🔔 Notifications from all your groups, and a tap opens the right one.',
      '🔄 Refreshing keeps your group, tab and open chat.',
    ],
  },
  {
    id: '2026-10-05b',
    date: '2026-10-05',
    title: { fr: 'Version anglaise et demi-votes', en: 'English version and half votes' },
    fr: [
      '🇬🇧 L’app existe en anglais (Moi → Langue).',
      '½ Demi-votes : tu hésites entre deux ? Un demi-vote chacun.',
      '👑 Unanimités et « personne n’est d’accord » mis en avant.',
      '⭐ Note les questions avec des étoiles : les préférées du groupe dans Stats.',
      '📊 Nouvelles stats : Affinités (jumeau de vote, fan n°1…) et Groupe.',
      '💬 Chat : répondre en glissant, taguer avec @, envoyer des photos, double tap pour ❤️.',
    ],
    en: [
      '🇬🇧 The app is now in English too (Me → Language).',
      '½ Half votes: torn between two? Half a vote each.',
      '👑 Unanimous votes and “nobody agrees” moments stand out.',
      '⭐ Rate questions with stars: the group’s favourites show up in Stats.',
      '📊 New stats: Duos (vote twin, biggest fan…) and Group.',
      '💬 Chat: swipe to reply, tag with @, send photos, double tap to ❤️.',
    ],
  },
  {
    id: '2026-10-05',
    date: '2026-10-05',
    title: { fr: 'Nouveau look', en: 'New look' },
    fr: [
      '🎨 Résultats en barres façon AskUs, couleurs par personne, interface plus compacte.',
      '📸 Photos de profil (avec recadrage) et animaux par défaut.',
      '😂 Réactions avec n’importe quel emoji (appui long sur un message).',
      '🔒 La discussion d’une question reste fermée tant que tu n’as pas voté.',
      '↩️ Le bouton retour du téléphone revient en arrière dans l’app au lieu de la fermer.',
    ],
    en: [
      '🎨 AskUs-style result bars, a colour for each person, a more compact layout.',
      '📸 Profile photos (with cropping) and default animals.',
      '😂 React with any emoji (hold a message).',
      '🔒 A question’s chat stays locked until you’ve voted.',
      '↩️ The phone’s back button goes back in the app instead of closing it.',
    ],
  },
  {
    id: '2026-10-04',
    date: '2026-10-04',
    title: { fr: 'Lancement 🎉', en: 'Launch 🎉' },
    fr: [
      '🤔 Une question « Qui de nous… » plusieurs fois par jour, tout le monde vote.',
      '💬 Un chat pour le groupe et un pour chaque question.',
      '📊 Stats de personnalité (radar, titres) et notifications.',
    ],
    en: [
      '🤔 A “Which of us…” question a few times a day, everyone votes.',
      '💬 A group chat, plus one for each question.',
      '📊 Personality stats (radar, titles) and notifications.',
    ],
  },
];

const latest = () => RELEASES[0];

module.exports = { RELEASES, latest };
