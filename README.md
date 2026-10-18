# Qui de nous ? 🤔

Sondages « Qui est le plus susceptible de… » entre potes. Votes anonymes, stats de personnalité et titres.

## Lancer en local

Il faut [Node.js](https://nodejs.org) 18 ou plus.

```bash
npm install
npm start
```

Puis ouvrir http://localhost:3000.

## Variables d'environnement

| Variable       | Rôle                                                                 | Défaut          |
|----------------|----------------------------------------------------------------------|-----------------|
| `DATABASE_URL` | URL PostgreSQL (ex. Neon) pour garder les données sur un hébergeur   | *(aucune)*      |
| `DATA_FILE`    | Fichier JSON utilisé si pas de `DATABASE_URL`                        | `data/db.json`  |
| `PORT`         | Port HTTP                                                            | `3000`          |
| `PUSH_CONTACT` | Contact envoyé aux services de notifications (`mailto:…`)            | `mailto:admin@example.com` |
| `GIPHY_API_KEY`| Clé Giphy pour chercher des GIFs dans le chat                        | *(GIFs désactivés)* |
| `TENOR_API_KEY`| Alternative à Giphy (utilisée si pas de clé Giphy)                   | *(aucune)*      |
| `FIREBASE_SERVICE_ACCOUNT` | JSON du compte de service Firebase : notifications de l'app mobile (voir [STORE.md](STORE.md)) | *(notifs app désactivées)* |
| `CONTACT_EMAIL` | Adresse de contact (pages confidentialité / conditions) | *(PUSH_CONTACT)* |
| `APP_NAME` | Nom de l'app sur les pages légales | `Qui de nous ?` |
| `APPLE_APP_ID`, `ANDROID_PACKAGE`, `ANDROID_SHA256` | Liens d'invitation qui ouvrent l'app installée | *(aucun)* |
| `OWNER_USERNAME`| Identifiant du développeur : reçoit les bugs / avis envoyés depuis l'app (notif + liste dans « Un bug ? Un avis ? ») | *(aucun)* |

Sans `DATABASE_URL`, tout est enregistré dans `data/db.json`. Avec, PostgreSQL : une ligne par compte, session, groupe, question et sondage (tables `qdn_*`) ; seules les lignes modifiées sont réécrites. L'ancienne table `quidenous_store` (tout en un) est migrée automatiquement au premier démarrage et gardée telle quelle comme sauvegarde.

## App mobile (App Store, Google Play)

Dans [`mobile/`](mobile) (Capacitor) : même interface, notifications natives, bouton retour Android, liens d'invitation qui ouvrent l'app. Tout le guide de publication : [STORE.md](STORE.md). Pages exigées par les stores : `/privacy`, `/terms`, `/support` (+ `/en/…`). Builds iOS/Android dans le cloud : GitHub Actions → « App mobile ». Groupe de démo pour la relecture : `node scripts/demo-group.js <serveur>`. Dans l'app : signaler un message ou une personne, bloquer, quitter un groupe, supprimer son compte, sets 18+ désactivables par l'admin.

## Fonctionnement

- **Comptes** : chacun a **un compte**, créé tout seul au premier lancement (rien à inventer). En rejoignant un groupe, on reçoit un identifiant par défaut (premier mot du pseudo + 4 chiffres, ex. `nico_4821`, modifiable). Le **PIN est optionnel** : il sert à se connecter sur un autre téléphone (identifiant + PIN). On peut être dans **plusieurs groupes**. L'app s'ouvre sur l'accueil (« Tes groupes », avec ce qu'il reste à voter et les messages non lus) ; la flèche ← en haut d'un groupe y ramène. Dans chaque groupe, on a son propre pseudo, sa photo et sa couleur.
- **Groupes** : n'importe qui peut créer un groupe (accueil → « Créer un groupe ») et en devient l'admin. Chaque groupe a un code à 6 caractères (ex. `K7QM2P`) et un lien d'invitation `…/?code=K7QM2P`. L'admin peut renommer le groupe ou générer un nouveau code.
- **Les potes** : l'admin ajoute les noms de ses potes (Moi → Admin). On peut voter pour quelqu'un même s'il n'a pas encore rejoint.
- **Rejoindre** : avec un lien d'invitation, on arrive directement sur « Qui es-tu ? » → on choisit son nom → c'est parti (2 taps). Sinon accueil → « Rejoindre un groupe » → code.
- **Compte perdu** (nouveau téléphone, app supprimée, pas de PIN) : on rejoint avec le code et on choisit son nom dans « Ton nom est déjà pris ? ». Ça crée une demande : pour un membre, **un admin** valide ; pour un admin, **2 autres membres** (ou l'autre membre s'ils ne sont que 2). Tous reçoivent une notif et une fenêtre dans l'app ; la personne concernée peut refuser si ce n'est pas elle. Une fois validé, tout suit (votes, messages, photo, rôle d'admin). Les demandes expirent après 7 jours. La 🗑️ à côté d'un nom pris le détache de son compte (le nom redevient libre, les votes restent).
- **Comptes d'avant les comptes multi-groupes** : rien ne casse. Chaque ancienne connexion est devenue un compte (même PIN, on reste connecté) avec un identifiant par défaut. On peut toujours se connecter « à l'ancienne » (code du groupe + pseudo + PIN), et rattacher ses autres groupes depuis l'accueil (« J'ai un autre groupe avec un compte d'avant la mise à jour »).
- **Drops** : une question tombe automatiquement toutes les 4 h (10h–23h ; réglable par l'admin de chaque groupe, **4 h minimum**), tirée au hasard dans un set au hasard (les sets mieux notés par le groupe tombent un peu plus souvent). Les heures sont réglées dans le fuseau de l'admin et affichées dans le fuseau de chacun. La plage peut passer minuit (ex. 22 h → 6 h) : la fin va de « début + 1 h » à « début − 1 h » le lendemain (= 24 h/24). Chacun peut aussi en lancer en plus (➕) : **1 par jour** par défaut, réglable par l'admin (0 à 10). Une question n'est jamais posée deux fois dans un groupe.
- **Questionnaire (Quiz)** : option de l'admin, désactivée par défaut. Un onglet Quiz apparaît : chacun répond (facultatif, anonyme) à quelques questions (genre, âge, études/travail, couple, logement, alcool, sorties, jeux vidéo, sport, permis, enfants). Les questions étiquetées dans `questions.md` (`#couple`, `#alcool`…) tombent moins souvent si peu de gens du groupe sont concernés (×0,2 au minimum, jamais zéro) et un peu plus si tout le monde l'est (×1,2).
- **Séries 🔥** : un jour compte si on vote au moins une fois (les jours sans question ne cassent rien) ; série du groupe quand tout le monde a voté. Rappel le soir (2 h avant la fin de la plage) si une série d'au moins 3 jours va s'arrêter.
- **Récap du mois** : Stats → Groupe (le mois en cours et les précédents), façon « Wrapped » : star du mois, unanimités, question préférée, chat, mentions spéciales, et tes chiffres à toi. Notification le 1er du mois.
- **Nouveautés & avis** : liens discrets en bas de Moi et de l'accueil. Les nouveautés sont dans [`lib/changelog.js`](lib/changelog.js) : ajouter une entrée en haut (nouvel id) → une notification par personne, dans sa langue, une minute après la mise en ligne. Les bugs / avis sont gardés dans la base (500 derniers) et visibles par `OWNER_USERNAME`.
- **Vote** : 24 h pour voter (une nouvelle durée s'applique aussi aux questions en cours), résultats visibles dès qu'on a voté ; ensuite le sondage part dans les **Archives**, avec sa discussion. Si on hésite : **½ vote** (bouton « ½ J'hésite » ou appui long sur un nom) pour une ou deux personnes. Unanimité (7/7) et « personne d'accord » sont signalés discrètement et comptent dans les stats.
- **Notes** : chacun peut noter une question (1 à 5 ★) sous les résultats. Les notes sont gardées sur la question (Admin → « Copier les notes » pour les donner à une IA qui écrira les prochaines) et alimentent Stats → Groupe.
- **Sets** : les sets intégrés viennent de [`questions.md`](questions.md) (dont 3 spicy 18+), plus ceux créés par chaque groupe. Les questions pas encore jouées restent secrètes.
- **Stats** : onglets Profil (radar, titres, moments mémorables), Affinités (fan n°1, jumeau de vote, même réputation, mouton/rebelle…, toi comparé à chacun) et Groupe (questions préférées, flops, unanimités…). 7 stats (🔥 Chaos, 💋 Hot, 💖 Cœur, 🧠 Cerveau, 🤡 Gênance, 🐍 Toxique, 🍷 Excès). Chaque question a des poids ; pour chaque sondage terminé, on regarde si la personne a reçu plus ou moins que sa part « normale » des votes, multiplié par le poids, en moyenne sur tous les sondages (avec un a priori pour que les premiers sondages ne fassent pas tout bouger). 50 = moyenne du groupe. Une unanimité compte 1,5 fois.
- **Questions du groupe** : elles n'ont pas de poids au départ. Admin → « Copier les questions à noter », les donner à Claude, puis coller sa réponse dans « Importer les scores ».
- **Chat** : un chat général par groupe + une discussion par sondage en cours (aperçu des 2 derniers messages sur la carte). Temps réel (Server-Sent Events) : « X écrit… », accusés de lecture, GIFs, photos, réactions (appui long, double tap = ❤️), réponses (glisser un message vers la droite), tags `@Prénom`, suppression de ses messages (l'admin peut tout supprimer). Les messages sont stockés à part (`data/chat.jsonl` ou table `quidenous_chat`), les photos aussi (`data/images/` ou table `quidenous_images`, réduites à 1280 px avant l'envoi).
- **Couleurs** : 16 couleurs, une par personne ; chacun choisit parmi les libres dans Moi.
- **Notifications** : bouton dans Moi (+ réglage à part pour les tags et réponses). Il faut https (ou localhost) ; sur iPhone, ajouter d'abord le site à l'écran d'accueil. Les notifs déjà vues (message lu, question votée) disparaissent du téléphone à l'ouverture de l'app.
- **Anglais** : l'app est aussi en anglais (interface, questions intégrées, notifications). Lien en anglais : `…/en/` (ex. `…/en/?code=K7QM2P`) ; l'app installée depuis ce lien s'ouvre en anglais. Chacun peut changer de langue dans Moi (ou sur l'écran de connexion).

## Analyser les stats

```bash
DATABASE_URL="postgresql://…" node tools/export-db.js   # copie locale sans secrets → data/export.json
node tools/stats-report.js                               # → data/stats-report.html
```

Le rapport montre la stabilité des stats (ancienne méthode, lissée, nouvelle), ce que chaque question a donné, combien chaque stat a été alimentée, les notes, la participation et les questions lancées à la main.

## Modifier les questions intégrées

Tout est dans [`questions.md`](questions.md) (le mode d'emploi est en haut du fichier). Au redémarrage, chaque groupe est synchronisé : nouvelles questions ajoutées, poids mis à jour, questions supprimées retirées (sauf si elles ont déjà été jouées, elles restent dans l'historique).
