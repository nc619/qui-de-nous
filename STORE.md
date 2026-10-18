# Publishing on the App Store and Google Play

The mobile app lives in [`mobile/`](mobile): the same interface as the website, packaged with
[Capacitor](https://capacitorjs.com), plus native notifications (Firebase), haptics, the share sheet, the
Android back button and invite links that open the app. It talks to the Render server. The website keeps working
exactly as before.

**Already done in the repo:** native projects, signing setup, push + invite-link capabilities, iPhone-only build
(no iPad screenshots needed), the Android upload key (in `data/`, never committed), cloud builds
([`.github/workflows/mobile.yml`](.github/workflows/mobile.yml)), the demo group script, privacy / terms / support
pages, and the store screenshots + graphics in `store-assets/` (not committed, regenerate on request).

**Your part, in order** (✅ = done):

- ✅ Apple Developer and Google Play accounts
- ✅ 0. Name: **Whomst**, app ID **com.whomst.app**
- [ ] 1. Firebase (notifications) — 10 min
- [ ] 2. Render variables — 5 min
- [ ] 3. Apple: app ID, App Store Connect record, API key — 15 min
- [ ] 4. First iPhone build → TestFlight (Mac or cloud) — 20 min
- [ ] 5. Google Play: app, first upload, closed test — 30 min, then 14 days of testing
- [ ] 6. Store listings (texts, screenshots, questionnaires) — 45 min
- [ ] 7. Submit for review

---

## 0. Name and app ID

`mobile/app.config.json` holds everything: `appId`, `appName` (the name under the icon), `version` and the server.
`node mobile/configure.js` (run automatically by every `npm run …` in `mobile/`) writes them into both native
projects. **The app ID can never change after the first upload; the name can change with any update.**

## 1. Firebase (notifications)

1. [console.firebase.google.com](https://console.firebase.google.com) → *Add project* (Google Analytics: off).
2. *Add app* → **Android**, package name = the app ID → download `google-services.json`.
3. *Add app* → **iOS**, bundle ID = the app ID → download `GoogleService-Info.plist`.
4. Apple → [Keys](https://developer.apple.com/account/resources/authkeys/list) → **+** → name "Push", tick **Apple
   Push Notifications service (APNs)** → Continue → Register → **Download** the `.p8` (only possible once; keep it).
   Note the **Key ID**. Your **Team ID** is at the top right of developer.apple.com (10 characters).
5. Firebase → ⚙ Project settings → **Cloud Messaging** → *Apple app configuration* → APNs Authentication Key →
   Upload the `.p8` with its Key ID and your Team ID.
6. Firebase → ⚙ Project settings → **Service accounts** → *Generate new private key* → a JSON file downloads.

Put the two config files here (they're git-ignored; the cloud build gets them from secrets instead):
`mobile/android/app/google-services.json` and `mobile/ios/App/App/GoogleService-Info.plist`.

## 2. Render environment variables

Render → your service → **Environment**:

| Variable | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | the whole service-account JSON from step 1.6 |
| `CONTACT_EMAIL` | the address shown on the privacy / support pages and in the stores |
| `APP_NAME` | the store name (privacy / terms / support pages) |
| `OWNER_USERNAME` | your username in the app (you receive bug reports and moderation reports) |
| `APPLE_APP_ID` | `TEAMID.appId`, e.g. `AB12CD34EF.com.whomst.app` (invite links open the iPhone app) |
| `ANDROID_PACKAGE` | the app ID |
| `ANDROID_SHA256` | Play Console → your app → Test and release → **App integrity** → *App signing key certificate* → SHA-256 (after step 5.2) |

Check: [/privacy](https://qui-de-nous-bpbr.onrender.com/privacy), [/terms](https://qui-de-nous-bpbr.onrender.com/terms),
[/support](https://qui-de-nous-bpbr.onrender.com/support) (+ `/en/…`), later
[/.well-known/apple-app-site-association](https://qui-de-nous-bpbr.onrender.com/.well-known/apple-app-site-association)
and [/.well-known/assetlinks.json](https://qui-de-nous-bpbr.onrender.com/.well-known/assetlinks.json).

Make sure the service is on a paid plan (Starter): on the free plan the server sleeps, so no notifications and no
scheduled questions.

## 3. Apple: app ID, App Store Connect record, API key

1. [Identifiers](https://developer.apple.com/account/resources/identifiers/list) → **+** → *App IDs* → *App* →
   Description = the name, Bundle ID **Explicit** = the app ID → tick **Push Notifications** and **Associated
   Domains** → Continue → Register.
2. [App Store Connect](https://appstoreconnect.apple.com) → *Apps* → **+** → *New App*: platform iOS, name = the
   store name (must be unique on the App Store), primary language French (or English), bundle ID = the one above,
   SKU = anything (e.g. `whomst`), access: full.
3. Only for cloud builds: App Store Connect → *Users and Access* → **Integrations** → *App Store Connect API* →
   *Team Keys* → **+** → name "CI", access **Admin** → Generate → download the `.p8` (once!), note the **Key ID**
   and the **Issuer ID** (top of the page).

## 4. First iPhone build → TestFlight

**Option A — your Mac** (first time, recommended: you see any signing problem directly):

```bash
git pull
cd mobile && npm install && npm run ios:release
```

`ios:release` = new build number + opens Xcode. In Xcode: select the **App** target → *Signing & Capabilities* →
Team = you (leave *Automatically manage signing* on; Push and Associated Domains are already declared). Plug in
your iPhone and ▶ Run to try it (notifications only work on a real device). Then **Product → Archive →
Distribute App → App Store Connect → Upload**. It appears in App Store Connect → TestFlight after ~10–20 min.

**Option B — cloud, from Windows:** GitHub → repo → *Settings* → *Secrets and variables* → *Actions* → add the
secrets below, then *Actions* → **App mobile** → *Run workflow*. iOS goes straight to TestFlight.

| Secret | Value |
|---|---|
| `GOOGLE_SERVICE_INFO_PLIST` | contents of `GoogleService-Info.plist` |
| `GOOGLE_SERVICES_JSON` | contents of `google-services.json` |
| `APPLE_TEAM_ID` | your Team ID |
| `APPSTORE_API_KEY_ID` / `APPSTORE_API_ISSUER_ID` | from step 3.3 |
| `APPSTORE_API_KEY_P8` | contents of the API `.p8` from step 3.3 (open it in Notepad) |
| `ANDROID_KEYSTORE_BASE64` | contents of `data/android-upload-key.base64.txt` |
| `ANDROID_KEYSTORE_PASSWORD` | the password in `data/android-upload-key.txt` |
| `PLAY_SERVICE_ACCOUNT_JSON` | optional, later: Google Cloud service account with access in Play Console → *Users and permissions*. Then Android builds go to the internal test track by themselves. |

TestFlight: add yourself and friends as **internal testers** (App Store Connect users, instant) or create an
external group with a public link (needs a short beta review the first time).

## 5. Google Play

**The upload key** was generated for you: `data/android-upload-key.p12` + `data/android-upload-key.txt`
(password). **Copy both somewhere safe now** (password manager / cloud drive): without them you can't publish
updates (Google can reset it, but it takes days). On this PC, `mobile/android/keystore.properties` points to it, so
Android Studio builds are signed automatically.

1. [Play Console](https://play.google.com/console) → **Create app**: name, default language, *App*, *Free*, accept the
   declarations.
2. Get a signed `.aab`: either *Actions* → **App mobile** → platform `android` → download `android-aab` at the
   bottom of the run page; or on a PC with [Android Studio](https://developer.android.com/studio):
   `cd mobile && npm install && npm run android:release`, then *Build → Generate App Bundles or APKs → Generate
   Bundles* (`mobile/android/app/build/outputs/bundle/release/app-release.aab`).
3. Play Console → *Test and release* → **Testing → Closed testing** → create a track → *Create release* → accept
   **Play App Signing** → upload the `.aab` → release notes → Save → review → *Start rollout*.
   Testers: an email list with at least **12** Gmail addresses (your friends), and send them the opt-in link.
   They must stay opted in for **14 days**; then *Dashboard* → **Apply for production**.
4. After the first upload: copy the *App signing key* SHA-256 into `ANDROID_SHA256` on Render (step 2).

## 6. Store listings

**Store name** (30 chars max, must be unique; *Whomst: Unfollow Tracker* already exists on the App Store, so plain
"Whomst" may be refused): English **Whomst: Who's Most Likely To**, French **Whomst : Qui de nous ?**. The name under
the icon stays "Whomst" either way.

Everything to paste is below (texts) and in `store-assets/` (images).

| Field | Value |
|---|---|
| Privacy policy URL | `https://qui-de-nous-bpbr.onrender.com/privacy` (English listing: `/en/privacy`) |
| Support URL (Apple) | `https://qui-de-nous-bpbr.onrender.com/support` (`/en/support`) |
| Marketing URL (Apple, optional) | `https://qui-de-nous-bpbr.onrender.com` |
| Category | Apple: *Games → Trivia* (secondary *Social Networking*); Google: *Game → Trivia* |
| Price | Free, no in-app purchases, no ads |
| iPhone screenshots | `store-assets/screenshots/{fr,en}/ios/*.png` (1320×2868 = the 6.9" size; Apple scales it for the others) |
| Android screenshots | `store-assets/screenshots/{fr,en}/android/*.png` (1080×1920) |
| Play icon / feature graphic | `store-assets/icon-512.png`, `store-assets/feature-graphic-{fr,en}.png` |
| Copyright (Apple) | `2026 <your name>` |

**Apple age rating** (App Information → Age Rating), answer honestly: *Profanity or crude humor*: Frequent ·
*Mature or suggestive themes*: Frequent · *Sexual content or nudity*: Infrequent (text only, in the optional 18+
sets) · *Alcohol, tobacco, or drug use or references*: Frequent · *Violence*: none/infrequent cartoon ·
*User-generated content*: Yes · *Messaging and chat*: Yes · everything else: None / No. Expect **18+** (or 17+).

**Google content rating** (IARC questionnaire, category *Game*): user interaction / chat = yes, sharing user
content = yes, crude humor = yes, sexual references in text = yes, references to alcohol/drugs = yes, no gambling,
no violence beyond cartoon. **Target audience**: 18+ only (keeps you out of the Families policy). **Ads**: no.
**Data safety**: see "Privacy answers" below (data encrypted in transit, users can delete their account in the app:
deletion URL = `https://qui-de-nous-bpbr.onrender.com/support`).

## 7. Submit for review

1. Create the reviewers' demo group (run it from your PC, again the day before each submission):
   `node scripts/demo-group.js https://qui-de-nous-bpbr.onrender.com` → it prints a code → put it in the review notes
   below (replace **XXXXXX**). It creates a "Demo" group with 7 fake members who vote and chat; the name **Kim** is
   left free for the reviewer.
2. Apple: App Store Connect → your app → *iOS App 1.0* → pick the TestFlight build → paste texts + notes → *Add for
   Review*. Google: after the 14 days, production release with the same `.aab` or a newer one.

## 8. Every update afterwards

- **Server / interface change**: `git push` updates the website at once. The apps only change when you publish a new
  app version (the interface is bundled inside). For anything visible, ship new builds:
  raise `version` in `mobile/app.config.json` (e.g. `1.0.1`), then Mac: `npm run ios:release` → Archive, or cloud:
  *Run workflow*. Build numbers are automatic (minutes since 2026, always increasing).
- **Patch notes**: add an entry at the top of `lib/changelog.js` → everyone gets one notification.

## 9. What the stores ask (already handled in the app)

| Requirement | Where |
|---|---|
| Report content and users (Apple 1.2, Google UGC policy) | hold a message → 🚩 Report; Stats → someone's profile → Report / Block |
| Block users | same places; blocked people's messages are hidden, no notifications from them |
| Act on reports within 24 h | reports reach you (push + "Bug? Feedback?" list): delete the message or ban the account in one tap |
| Delete account in the app (Apple 5.1.1(v), Google) | Home → My account → Delete my account |
| Privacy policy, terms, support | `/privacy`, `/terms`, `/support` (+ `/en/…`); privacy + terms linked on the welcome screen and in Me |
| Age | 18+ (Apple) / Mature 17+ (Google), because of the optional 18+ sets; admins can switch them off |
| Works without an account / login | yes: no sign-up at all |

### App Review notes (paste into App Store Connect → App Review Information)

> No login needed. Tap "Join a group", enter the code **XXXXXX** and pick the name **Kim** (a demo group with questions, votes and
> chat history). Or tap "Create a group" to start one. Long-press a chat message to react or
> report it; Stats → tap a person → Report / Block. Account deletion: Home (← arrow) → My account →
> Delete my account.


### Privacy answers (App Store "App Privacy" and Google "Data safety")

- **Collected, linked to the user, not used for tracking, not shared with third parties for their own use:**
  user ID, name / profile photo (user content), photos and messages (user content), votes and ratings
  (app activity / product interaction), optional questionnaire answers (other user content), device push
  token (device ID), crash/bug reports the user sends (diagnostics).
- **Not collected:** location, contacts, browsing history, financial info, advertising ID, health.
- Data is encrypted in transit (HTTPS). Users can request deletion (in-app).

---

## Store listing texts

Category: **Games → Trivia** (or *Entertainment*). Screenshots:
iPhone 6.9" (1320×2868) and Android phone, 4–6 each: the vote card, the results bars, the chat, the stats
radar, the monthly recap, the streaks.

### Français

**Sous-titre (30 car.)** : Qui de vous est le plus… ?

**Texte promotionnel** : Une question sur ta bande, plusieurs fois par jour. Tout le monde vote. Verdicts sans pitié.

**Description**

> Qui finirait la soirée au commissariat ? Qui ghosterait le plus ? Qui deviendra millionnaire ?
>
> Whomst pose ces questions à ton groupe de potes, plusieurs fois par jour. Chacun vote pour quelqu’un du groupe… et les résultats tombent dès que tu as voté.
>
> • Plus de 600 questions, des soirées aux scénarios absurdes, avec des sets 18+ (désactivables)
> • Écris tes propres questions et lance-les au groupe
> • Un chat pour le groupe et une discussion par question (fermée tant que tu n’as pas voté)
> • Tes stats de personnalité : radar Chaos, Hot, Cerveau, Gênance… titres, affinités, jumeau de vote
> • Séries 🔥 : vote chaque jour, et tout le groupe garde sa série
> • Un récap chaque mois, façon Wrapped
> • Notifications pour les nouvelles questions, les votes et les messages
> • Plusieurs groupes avec un seul compte, sans inscription
>
> C’est pour rire entre potes : signalement et blocage intégrés, l’admin du groupe garde la main.

**Mots-clés (100 car.)** : potes,amis,sondage,vote,qui de nous,soirée,questions,groupe,quiz,jeu

### English

**Subtitle (30 chars)**: Who's most likely to…?

**Promotional text**: A question about your crew, a few times a day. Everyone votes. No mercy.

**Description**

> Who'd end the night at the police station? Who ghosts the most? Who'll be a millionaire first?
>
> Whomst asks your group of friends these questions a few times a day. Everyone votes for someone in the group… and the results show up as soon as you've voted.
>
> • 600+ questions, from wild nights to absurd scenarios, plus 18+ sets (can be switched off)
> • Write your own questions and drop them on the group
> • A group chat, plus a chat for every question (locked until you've voted)
> • Your personality stats: Chaos, Hot, Brain, Cringe radar… titles, connections, vote twin
> • Streaks 🔥: vote every day and keep the whole group's streak alive
> • A Wrapped-style recap every month
> • Notifications for new questions, votes and messages
> • Several groups, one account, no sign-up
>
> It's all fun between friends: built-in reporting and blocking, and the group admin stays in control.

**Keywords (100 chars)**: friends,poll,vote,most likely to,party,questions,group,quiz,game,who of us
