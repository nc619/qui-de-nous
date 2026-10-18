// Pages légales servies par le serveur : /privacy, /terms (français) et /en/privacy, /en/terms (anglais).
// Exigées par l'App Store et Google Play. Variables : APP_NAME (nom affiché), CONTACT_EMAIL (adresse de contact).
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const UPDATED = '2026-10-12';

function page(lang, title, body) {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
:root { color-scheme: light dark; --bg: #fdf4ff; --text: #2d1b4e; --muted: #6f5f8f; --card: #fff; }
@media (prefers-color-scheme: dark) { :root { --bg: #0b0614; --text: #fbf8ff; --muted: #c4b6e0; --card: #241a3a; } }
body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.55 system-ui, -apple-system, 'Segoe UI', sans-serif; padding: 24px 16px 48px; }
main { max-width: 720px; margin: 0 auto; background: var(--card); border-radius: 18px; padding: 24px 22px; }
h1 { margin-top: 0; font-size: 1.6rem; } h2 { font-size: 1.15rem; margin-top: 28px; }
.muted { color: var(--muted); font-size: 0.9rem; } a { color: #7b2ff7; } li { margin: 4px 0; }
</style></head><body><main>${body}</main></body></html>`;
}

function privacy(lang) {
  const app = esc(process.env.APP_NAME || 'Whomst');
  const mail = esc(process.env.CONTACT_EMAIL || (process.env.PUSH_CONTACT || '').replace(/^mailto:/, '') || 'contact');
  if (lang === 'en') {
    return page('en', `Privacy policy · ${app}`, `
<h1>Privacy policy</h1><p class="muted">${app} · last updated ${UPDATED}</p>
<p>${app} is a game for groups of friends: questions drop a few times a day and everyone in the group votes for one of the others. This page explains what we store and why. Short version: only what the game needs, never sold, never used for ads.</p>
<h2>What we store</h2><ul>
<li><b>Your account</b>: a random identifier, a username (generated automatically, you can change it) and, only if you set one, a PIN (stored hashed, never in clear).</li>
<li><b>In each group</b>: the name, colour and profile photo you choose, your votes, your ratings of questions, the messages, GIFs and photos you send in the chat, and your reactions.</li>
<li><b>Optional questionnaire</b> (only if the group admin turns it on): your answers (e.g. age range, studies or work). They are never shown individually, only as an anonymous group summary from 3 answers on, and only used to pick questions that suit the group.</li>
<li><b>Notifications</b>: if you allow them, a technical token for your device (Apple, Google or your browser’s push service).</li>
<li><b>Bug reports and feedback</b> you send, with your phone model (from the browser user agent) to help fix bugs.</li>
<li>Your language and app settings. We don’t collect your location, contacts or advertising identifiers, and there are no ads or trackers.</li></ul>
<h2>Who sees what</h2><p>Only the members of a group see that group’s content. Votes become visible to the group once you’ve voted or the question is over. Nothing is public.</p>
<h2>Service providers</h2><ul>
<li>Hosting: Render (servers in Frankfurt, EU) and Neon (PostgreSQL database).</li>
<li>Notifications: Apple Push Notification service, Google Firebase Cloud Messaging, or your browser’s push service. They only receive the notification text and your device token.</li>
<li>GIF search: when you search for a GIF, your search words are sent to Giphy (or Tenor).</li></ul>
<h2>How long we keep it</h2><p>As long as your account exists. You can delete your account at any time in the app (Home → My account → Delete my account): your account, sessions, profile photos, questionnaire answers and notification tokens are deleted right away. Messages and votes you already sent stay in the group’s history, shown under your name in that group, like messages in any group chat; delete individual messages before deleting your account if you want them gone.</p>
<h2>Age</h2><p>${app} is meant for people aged 17 and over (some optional question sets are for adults only).</p>
<h2>Your rights</h2><p>You can ask us to access, correct or delete your data, or ask any question, at <a href="mailto:${mail}">${mail}</a>. You can also lodge a complaint with your data protection authority.</p>`);
  }
  return page('fr', `Politique de confidentialité · ${app}`, `
<h1>Politique de confidentialité</h1><p class="muted">${app} · mise à jour le ${UPDATED}</p>
<p>${app} est un jeu entre potes : plusieurs fois par jour, une question tombe et chacun vote pour quelqu’un du groupe. Cette page explique ce qu’on garde et pourquoi. En bref : seulement ce qu’il faut pour jouer, jamais vendu, jamais utilisé pour de la pub.</p>
<h2>Ce qu’on garde</h2><ul>
<li><b>Ton compte</b> : un identifiant aléatoire, un nom d’utilisateur (créé automatiquement, modifiable) et, seulement si tu en mets un, un PIN (gardé chiffré, jamais en clair).</li>
<li><b>Dans chaque groupe</b> : le pseudo, la couleur et la photo de profil que tu choisis, tes votes, tes notes des questions, les messages, GIFs et photos que tu envoies dans le chat, et tes réactions.</li>
<li><b>Questionnaire facultatif</b> (seulement si l’admin du groupe l’active) : tes réponses (ex. tranche d’âge, études ou travail). Elles ne sont jamais montrées une par une, seulement en résumé anonyme du groupe à partir de 3 réponses, et servent uniquement à choisir des questions qui collent au groupe.</li>
<li><b>Notifications</b> : si tu les autorises, un identifiant technique de ton téléphone (service d’Apple, de Google ou de ton navigateur).</li>
<li><b>Les bugs et avis</b> que tu envoies, avec le modèle de ton téléphone (lu dans le navigateur) pour aider à corriger.</li>
<li>Ta langue et tes réglages. On ne collecte ni ta position, ni tes contacts, ni d’identifiant publicitaire, et il n’y a ni pub ni traceur.</li></ul>
<h2>Qui voit quoi</h2><p>Seuls les membres d’un groupe voient ce qui s’y passe. Les votes deviennent visibles pour le groupe une fois que tu as voté ou que la question est finie. Rien n’est public.</p>
<h2>Prestataires</h2><ul>
<li>Hébergement : Render (serveurs à Francfort, UE) et Neon (base de données PostgreSQL).</li>
<li>Notifications : Apple Push Notification service, Google Firebase Cloud Messaging, ou le service de ton navigateur. Ils ne reçoivent que le texte de la notification et l’identifiant de ton téléphone.</li>
<li>Recherche de GIFs : quand tu cherches un GIF, les mots cherchés sont envoyés à Giphy (ou Tenor).</li></ul>
<h2>Combien de temps</h2><p>Tant que ton compte existe. Tu peux le supprimer à tout moment dans l’app (Accueil → Mon compte → Supprimer mon compte) : ton compte, tes sessions, tes photos de profil, tes réponses au questionnaire et tes identifiants de notification sont effacés tout de suite. Les messages et votes déjà envoyés restent dans l’historique du groupe, sous ton nom dans ce groupe, comme dans n’importe quel groupe de discussion ; supprime d’abord les messages que tu veux voir disparaître.</p>
<h2>Âge</h2><p>${app} s’adresse aux personnes de 17 ans et plus (certains sets de questions, facultatifs, sont réservés aux adultes).</p>
<h2>Tes droits</h2><p>Tu peux demander à consulter, corriger ou supprimer tes données, ou poser une question, à <a href="mailto:${mail}">${mail}</a>. Tu peux aussi saisir la CNIL.</p>`);
}

function terms(lang) {
  const app = esc(process.env.APP_NAME || 'Whomst');
  const mail = esc(process.env.CONTACT_EMAIL || (process.env.PUSH_CONTACT || '').replace(/^mailto:/, '') || 'contact');
  if (lang === 'en') {
    return page('en', `Terms · ${app}`, `
<h1>Terms of use</h1><p class="muted">${app} · last updated ${UPDATED}</p>
<p>${app} is a game to play with people you know. By using it, you agree to these rules.</p>
<h2>Play nice</h2><ul>
<li>It’s all for fun between friends: roasting is part of the game, harassment isn’t. No threats, hate, bullying, sexual content involving anyone without their consent, or content involving minors.</li>
<li>Don’t post other people’s private information or photos without their permission.</li>
<li>You must be 17 or older. Adult question sets (18+) are optional and can be turned off by the group admin.</li></ul>
<h2>Reporting and blocking</h2><p>You can report any message or person (hold a message → Report, or from the person’s profile) and block someone so you no longer see their messages. Reports reach us and we act on them within 24 hours: removing content, and banning users who break these rules.</p>
<h2>Your content</h2><p>You keep the rights to what you post. You let us store and show it to the members of your group, only to run the game. Group admins and authors can delete messages; you can delete your account at any time.</p>
<h2>The service</h2><p>The app is provided as is, free of charge. We may change or stop features. Contact: <a href="mailto:${mail}">${mail}</a>.</p>`);
  }
  return page('fr', `Conditions d’utilisation · ${app}`, `
<h1>Conditions d’utilisation</h1><p class="muted">${app} · mise à jour le ${UPDATED}</p>
<p>${app} est un jeu à faire avec des gens que tu connais. En l’utilisant, tu acceptes ces règles.</p>
<h2>Le bon esprit</h2><ul>
<li>C’est pour rire entre potes : se chambrer fait partie du jeu, harceler non. Pas de menaces, de haine, de harcèlement, de contenu sexuel visant quelqu’un sans son accord, ni de contenu impliquant des mineurs.</li>
<li>Ne publie pas les infos privées ou les photos de quelqu’un sans son accord.</li>
<li>Il faut avoir 17 ans ou plus. Les sets de questions pour adultes (18+) sont facultatifs et l’admin du groupe peut les désactiver.</li></ul>
<h2>Signaler et bloquer</h2><p>Tu peux signaler un message ou une personne (appui long sur un message → Signaler, ou depuis le profil de la personne) et bloquer quelqu’un pour ne plus voir ses messages. Les signalements nous arrivent et on agit sous 24 h : suppression du contenu, et exclusion des personnes qui ne respectent pas ces règles.</p>
<h2>Ton contenu</h2><p>Ce que tu publies reste à toi. Tu nous autorises à le garder et à le montrer aux membres de ton groupe, uniquement pour faire tourner le jeu. L’admin du groupe et les auteurs peuvent supprimer des messages ; tu peux supprimer ton compte à tout moment.</p>
<h2>Le service</h2><p>L’app est fournie telle quelle, gratuitement. On peut faire évoluer ou arrêter des fonctions. Contact : <a href="mailto:${mail}">${mail}</a>.</p>`);
}

// Page d'aide (« Support URL » demandée par l'App Store).
function support(lang) {
  const app = esc(process.env.APP_NAME || 'Whomst');
  const mail = esc(process.env.CONTACT_EMAIL || (process.env.PUSH_CONTACT || '').replace(/^mailto:/, '') || 'contact');
  const base = lang === 'en' ? '/en' : '';
  if (lang === 'en') {
    return page('en', `Help · ${app}`, `
<h1>Help</h1><p class="muted">${app}</p>
<h2>Contact</h2><p>Email <a href="mailto:${mail}">${mail}</a>, or in the app: Me → “Bug? Feedback?”. We usually answer within 48 hours.</p>
<h2>How do I join my friends?</h2><p>Ask someone in the group for the invite link or the 6-letter code, then tap “Join a group” and pick your name.</p>
<h2>Report or block someone</h2><p>Hold a message → 🚩 Report. Or Stats → tap the person → Report / Block. Reports are reviewed within 24 hours.</p>
<h2>Switch phones</h2><p>Home → My account → add a username and a PIN, then log in with them on the new phone. Lost access? Join with the group code and pick your name: the group confirms it’s you.</p>
<h2>Leave a group or delete your account</h2><p>Leave: Me → bottom of the page. Delete everything: Home → My account → Delete my account.</p>
<h2>Notifications don’t arrive</h2><p>Check that notifications are allowed for the app in your phone’s settings, then Me → Notifications.</p>
<p class="muted"><a href="${base}/privacy">Privacy policy</a> · <a href="${base}/terms">Terms of use</a></p>`);
  }
  return page('fr', `Aide · ${app}`, `
<h1>Aide</h1><p class="muted">${app}</p>
<h2>Contact</h2><p>Écris à <a href="mailto:${mail}">${mail}</a>, ou dans l’app : Moi → « Un bug ? Un avis ? ». On répond en général sous 48 h.</p>
<h2>Comment rejoindre mes potes ?</h2><p>Demande à quelqu’un du groupe le lien d’invitation ou le code à 6 lettres, puis « Rejoindre un groupe » et choisis ton nom.</p>
<h2>Signaler ou bloquer quelqu’un</h2><p>Appui long sur un message → 🚩 Signaler. Ou Stats → touche la personne → Signaler / Bloquer. Les signalements sont traités sous 24 h.</p>
<h2>Changer de téléphone</h2><p>Accueil → Mon compte → ajoute un identifiant et un PIN, puis connecte-toi avec sur le nouveau téléphone. Plus d’accès ? Rejoins avec le code du groupe et choisis ton nom : le groupe confirme que c’est toi.</p>
<h2>Quitter un groupe ou supprimer son compte</h2><p>Quitter : Moi → tout en bas. Tout supprimer : Accueil → Mon compte → Supprimer mon compte.</p>
<h2>Je ne reçois pas les notifications</h2><p>Vérifie que les notifications sont autorisées pour l’app dans les réglages du téléphone, puis Moi → Notifications.</p>
<p class="muted"><a href="${base}/privacy">Confidentialité</a> · <a href="${base}/terms">Conditions d’utilisation</a></p>`);
}

module.exports = { privacy, terms, support };
