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

Sans `DATABASE_URL`, tout est enregistré dans `data/db.json`.

## Fonctionnement

- **Comptes** : chacun a **un compte** (identifiant unique + PIN de 4 à 6 chiffres) et peut être dans **plusieurs groupes**. L'app s'ouvre sur l'accueil (« Tes groupes », avec ce qu'il reste à voter et les messages non lus) ; la flèche ← en haut d'un groupe y ramène. Dans chaque groupe, on a son propre pseudo, sa photo et sa couleur.
- **Groupes** : n'importe qui peut créer un groupe (accueil → « Créer un groupe ») et en devient l'admin. Chaque groupe a un code à 6 caractères (ex. `K7QM2P`) et un lien d'invitation `…/?code=K7QM2P`. L'admin peut renommer le groupe ou générer un nouveau code.
- **Les potes** : l'admin ajoute les noms de ses potes (Moi → Admin). On peut voter pour quelqu'un même s'il n'a pas encore rejoint.
- **Rejoindre** : accueil → « Rejoindre un groupe » → code → on choisit son nom dans la liste (on peut le renommer, ajouter une photo). Avec un lien d'invitation, on crée son compte puis on rejoint directement.
- **PIN oublié** : un admin d'un des groupes de la personne génère un **code de récupération** (🔑 à côté du nom, valable 48 h, une fois) ; sur l'écran de connexion → « PIN oublié ? » → identifiant + code + nouveau PIN. La 🗑️ à côté d'un nom pris le détache de son compte (le nom redevient libre, les votes restent).
- **Comptes d'avant les comptes multi-groupes** : rien ne casse. Chaque ancienne connexion est devenue un compte (même PIN, on reste connecté) ; l'app demande juste de choisir un identifiant une fois. On peut toujours se connecter « à l'ancienne » (code du groupe + pseudo + PIN), et rattacher ses autres groupes depuis l'accueil (« J'ai un autre groupe avec un compte d'avant la mise à jour »).
- **Drops** : une question tombe automatiquement toutes les 3 h (10h–23h, heure de Paris ; réglable par l'admin de chaque groupe), tirée au hasard dans un set au hasard. La plage peut passer minuit (ex. 22 h → 6 h) : la fin va de « début + 1 h » à « début − 1 h » le lendemain (= 24 h/24). Chacun peut aussi en lancer une à tout moment (➕). Une question n'est jamais posée deux fois dans un groupe.
- **Vote** : 24 h pour voter (une nouvelle durée s'applique aussi aux questions en cours), résultats visibles dès qu'on a voté ; ensuite le sondage part dans les **Archives**, avec sa discussion. Si on hésite : **½ vote** (bouton « ½ J'hésite » ou appui long sur un nom) pour une ou deux personnes. Unanimité (7/7) et « personne d'accord » sont signalés discrètement et comptent dans les stats.
- **Notes** : chacun peut noter une question (1 à 5 ★) sous les résultats. Les notes sont gardées sur la question (Admin → « Copier les notes » pour les donner à une IA qui écrira les prochaines) et alimentent Stats → Groupe.
- **Sets** : les sets intégrés viennent de [`questions.md`](questions.md) (dont 3 spicy 18+), plus ceux créés par chaque groupe. Les questions pas encore jouées restent secrètes.
- **Stats** : onglets Profil (radar, titres, moments mémorables), Affinités (fan n°1, jumeau de vote, même réputation, mouton/rebelle…, toi comparé à chacun) et Groupe (questions préférées, flops, unanimités…). 7 stats (🔥 Chaos, 💋 Hot, 💖 Cœur, 🧠 Cerveau, 🤡 Gênance, 🐍 Toxique, 🍷 Excès). Chaque question a des poids ; chaque sondage terminé les distribue selon la part de votes reçus → radar, classements et titres (une unanimité compte 1,5 fois).
- **Questions du groupe** : elles n'ont pas de poids au départ. Admin → « Copier les questions à noter », les donner à Claude, puis coller sa réponse dans « Importer les scores ».
- **Chat** : un chat général par groupe + une discussion par sondage en cours (aperçu des 2 derniers messages sur la carte). Temps réel (Server-Sent Events) : « X écrit… », accusés de lecture, GIFs, photos, réactions (appui long, double tap = ❤️), réponses (glisser un message vers la droite), tags `@Prénom`, suppression de ses messages (l'admin peut tout supprimer). Les messages sont stockés à part (`data/chat.jsonl` ou table `quidenous_chat`), les photos aussi (`data/images/` ou table `quidenous_images`, réduites à 1280 px avant l'envoi).
- **Couleurs** : 16 couleurs, une par personne ; chacun choisit parmi les libres dans Moi.
- **Notifications** : bouton dans Moi (+ réglage à part pour les tags et réponses). Il faut https (ou localhost) ; sur iPhone, ajouter d'abord le site à l'écran d'accueil. Les notifs déjà vues (message lu, question votée) disparaissent du téléphone à l'ouverture de l'app.
- **Anglais** : l'app est aussi en anglais (interface, questions intégrées, notifications). Lien en anglais : `…/en/` (ex. `…/en/?code=K7QM2P`) ; l'app installée depuis ce lien s'ouvre en anglais. Chacun peut changer de langue dans Moi (ou sur l'écran de connexion).

## Modifier les questions intégrées

Tout est dans [`questions.md`](questions.md) (le mode d'emploi est en haut du fichier). Au redémarrage, chaque groupe est synchronisé : nouvelles questions ajoutées, poids mis à jour, questions supprimées retirées (sauf si elles ont déjà été jouées, elles restent dans l'historique).
