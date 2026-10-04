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

- **Groupes** : n'importe qui peut créer un groupe (onglet « Créer ») et en devient l'admin. Chaque groupe a un code à 6 caractères (ex. `K7QM2P`) et un lien d'invitation `…/?code=K7QM2P`. L'admin peut renommer le groupe ou générer un nouveau code.
- **Les potes** : l'admin ajoute les noms de ses potes (Moi → Admin). On peut voter pour quelqu'un même s'il n'a pas encore rejoint.
- **Rejoindre** : code du groupe → on choisit son nom dans la liste → on peut le renommer → PIN (4 à 6 chiffres). Ensuite on se reconnecte avec code + pseudo + PIN. L'admin peut réinitialiser un compte (PIN oublié) avec 🔑.
- **Drops** : une question tombe automatiquement toutes les 3 h (10h–23h, heure de Paris ; réglable par l'admin de chaque groupe), tirée au hasard dans un set au hasard. Chacun peut aussi en lancer une à tout moment (➕). Une question n'est jamais posée deux fois dans un groupe.
- **Vote** : 24 h pour voter, résultats visibles dès qu'on a voté ; ensuite le sondage part dans les **Archives**. On voit **qui** a voté, jamais **pour qui**.
- **Sets** : les sets intégrés viennent de [`questions.md`](questions.md) (dont 3 spicy 18+), plus ceux créés par chaque groupe. Les questions pas encore jouées restent secrètes.
- **Stats** : 6 stats (🔥 Chaos, 💋 Hot, 🧠 Cerveau, 🤡 Gênance, 🐍 Toxique, 🍷 Excès). Chaque question a des poids ; chaque sondage terminé les distribue selon la part de votes reçus → radar, classements et titres.
- **Questions du groupe** : elles n'ont pas de poids au départ. Admin → « Copier les questions à noter », les donner à Claude, puis coller sa réponse dans « Importer les scores ».
- **Chat** : un chat général par groupe + une discussion par sondage (aperçu des 2 derniers messages sur la carte). Temps réel (Server-Sent Events) : « X écrit… », accusés de lecture (avatars sous le dernier message lu), GIFs, suppression de ses messages (l'admin peut tout supprimer). Les messages sont stockés à part (`data/chat.jsonl` ou table `quidenous_chat`).
- **Notifications** : bouton dans Moi. Il faut https (ou localhost) ; sur iPhone, ajouter d'abord le site à l'écran d'accueil.

## Modifier les questions intégrées

Tout est dans [`questions.md`](questions.md) (le mode d'emploi est en haut du fichier). Au redémarrage, chaque groupe est synchronisé : nouvelles questions ajoutées, poids mis à jour, questions supprimées retirées (sauf si elles ont déjà été jouées, elles restent dans l'historique).
