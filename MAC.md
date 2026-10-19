# Whomst on the Mac: build and publish the apps

Everything is already set up on Apple, Google, Firebase and Render. What's left: build the iPhone app and the
Android app, upload them, and run the Google Play closed test. All from the Mac.

## 0. The private folder (do this first)

The folder **`whomst-private`** (copied from the old PC) holds files that are **not on GitHub** on purpose. Keep it
in a safe place (iCloud Drive / Google Drive / USB key) and never share it:

| File | What it is | Where it goes on the Mac |
|---|---|---|
| `android-upload-key.p12` + `android-upload-key.txt` | Android signing key + its password. **Lose them = no more Android updates.** | stays in `whomst-private` |
| `android-upload-key.base64.txt` | same key as text (for the cloud build) | stays in `whomst-private` |
| `google-services.json` | Firebase config, Android | `qui-de-nous/mobile/android/app/` |
| `GoogleService-Info.plist` | Firebase config, iPhone | `qui-de-nous/mobile/ios/App/App/` |
| `AuthKey_6ZFYN8GGUY.p8` | Apple push key (already uploaded to Firebase) | stays in `whomst-private` (backup) |
| `demo-group.json` | logins of the App Review demo group (code **JNMN2R**) | `qui-de-nous/data/` |
| `export.json` | database backup | stays in `whomst-private` |

If you ever lose the two Firebase files, download them again: Firebase console → ⚙ Project settings → Your apps.

## 1. Install the tools (once)

1. **Xcode**: Mac App Store. Open it once and accept the extra components.
2. **Node.js LTS**: [nodejs.org](https://nodejs.org) → macOS installer.
3. **Git**: open Terminal and type `git --version`. If macOS offers to install the developer tools, accept.
4. Get the project:
   ```bash
   cd ~ && git clone https://github.com/nc619/qui-de-nous.git
   ```
5. Put the Firebase files and `demo-group.json` in place (see the table above), then:
   ```bash
   cd ~/qui-de-nous/mobile && npm install
   ```

## 2. iPhone app → TestFlight → App Store review

```bash
cd ~/qui-de-nous/mobile && npm run ios:release
```

This prepares the app with a new build number and opens Xcode. Then:

1. Xcode → **Settings → Accounts → +** → Apple ID → sign in.
2. Left panel: click **App** (blue icon) → target **App** → **Signing & Capabilities** →
   Team = **Nicolas Calvo Peiro**, "Automatically manage signing" ticked. (Push Notifications and Associated Domains
   are already there.)
3. Try it on your iPhone (recommended): plug it in, choose it at the top, press ▶. The first time, on the iPhone:
   Settings → Privacy & Security → **Developer Mode** → on. Check: join a group, vote, notifications.
4. Top bar: choose **Any iOS Device (arm64)** → **Product → Archive** → in the window that opens:
   **Distribute App → App Store Connect → Upload** → Next until done.
5. Wait ~15 min (email "has completed processing").
   [App Store Connect](https://appstoreconnect.apple.com) → Whomst → **iOS App 1.0** → section **Build** → **+** →
   pick the build → **Save** → **Add for Review** → **Submit to App Review**.
   If asked about encryption: **None of the algorithms mentioned above** / No (already declared in the app).
6. Apple answers in 1–3 days by email. The version is set to be released automatically once approved.

Before submitting, refresh the demo group so reviewers see live questions:
```bash
cd ~/qui-de-nous && node scripts/demo-group.js https://qui-de-nous-bpbr.onrender.com
```

**TestFlight for friends (optional):** App Store Connect → TestFlight → External testing → + group → add the build →
enable the **public link** → share it. (Needs a short beta review the first time.)

## 3. Android app (.aab) → Google Play closed test

Pick **one** way.

### A. Cloud build (nothing to install)

1. GitHub → [nc619/qui-de-nous](https://github.com/nc619/qui-de-nous) → **Settings → Secrets and variables →
   Actions → New repository secret**, three times:

   **Don't copy them from TextEdit** (it silently turns `--` into "—" and adds curly quotes). Copy each one with
   Terminal instead: run the command, then paste (⌘V) into GitHub's "Secret" box. Replace the folder path if
   `whomst-private` is somewhere else.

   | Name | Terminal command that copies the value |
   |---|---|
   | `ANDROID_KEYSTORE_BASE64` | `pbcopy < ~/whomst-private/android-upload-key.base64.txt` |
   | `ANDROID_KEYSTORE_PASSWORD` | `sed -n 's/^password (store and key): //p' ~/whomst-private/android-upload-key.txt \| tr -d '\n' \| pbcopy` |
   | `GOOGLE_SERVICES_JSON` | `pbcopy < ~/whomst-private/google-services.json` |

   To fix a wrong secret: open it in GitHub → **Update secret** → paste again.

2. **Actions → App mobile → Run workflow** → platform **android** → Run.
3. When it's green (~10 min): open the run → bottom → **Artifacts → android-aab** → download → unzip →
   `app-release.aab`. If it's red, copy the error and ask Claude.

### B. Android Studio on the Mac

1. Install [Android Studio](https://developer.android.com/studio) and open it once (it downloads the Android SDK).
2. Create `~/qui-de-nous/mobile/android/keystore.properties` (TextEdit → Format → Make Plain Text) with:
   ```
   storeFile=/Users/YOUR_MAC_NAME/whomst-private/android-upload-key.p12
   storePassword=THE_PASSWORD_FROM_android-upload-key.txt
   keyAlias=upload
   keyPassword=THE_SAME_PASSWORD
   ```
   (Adjust the path to wherever `whomst-private` is. This file is ignored by git.)
3. ```bash
   cd ~/qui-de-nous/mobile && npm run android:release
   ```
   Android Studio opens → wait for "Gradle sync" to finish → **Build → Generate App Bundles or APKs → Generate
   Bundles**. The file is `mobile/android/app/build/outputs/bundle/release/app-release.aab`.

### Upload to Google Play

1. [Play Console](https://play.google.com/console) → Whomst → **Test and release → Testing → Closed testing** →
   **Create track** (or use "Closed testing - Alpha") → **Create release**.
2. If asked, accept **Play App Signing** (Google keeps the final key; ours is the upload key).
3. Upload `app-release.aab` → release name e.g. `1.0.0` → release notes:
   `First test version of Whomst.` → **Next → Save → Send for review / Start rollout**.
4. **Testers** tab → **Create email list** → at least **12 Gmail addresses** (friends) → Save → copy the
   **opt-in link** and send it to them. They must tap "Become a tester" and install from the Play Store.
5. After the first upload: Play Console → **Test and release → App integrity → Play app signing** (or search
   "App signing") → copy the **SHA-256** of the *App signing key certificate* → Render → Environment →
   `ANDROID_SHA256` = that value. (Makes invite links open the Android app.)
6. **14 days later**, with 12 testers still opted in: Dashboard → **Apply for production** → answer the questions →
   then create a production release with the same (or a newer) `.aab`.

## 4. Every update afterwards

1. Change the code with Claude, then `git push` → the website updates at once.
2. For the apps: raise `version` in `mobile/app.config.json` (e.g. `1.0.1`), then:
   - iPhone: `npm run ios:release` → Archive → Upload → new version in App Store Connect → Submit.
   - Android: cloud build (Run workflow) or Android Studio → new release in Play Console with the new `.aab`.
3. Build numbers are automatic.
4. Patch notes for users: add an entry at the top of `lib/changelog.js` (everyone gets one notification).

## Useful links

- Website / server: https://qui-de-nous-bpbr.onrender.com (Render service `qui-de-nous`, plan 0.5c-512mb)
- Privacy / terms / support: `/en/privacy`, `/en/terms`, `/en/support`
- Demo group for reviewers: code **JNMN2R**, name **Kim**
- Full background (Firebase, store answers, listing texts): [STORE.md](STORE.md)
