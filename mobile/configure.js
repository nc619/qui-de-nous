// Applique app.config.json (nom, identifiant, version) aux projets natifs iOS et Android, sans les régénérer.
// Lancé par build.js (donc par npm run sync / ios / android). Avec --bump : nouveau numéro de build (obligatoire à
// chaque envoi sur les stores ; c'est le nombre de minutes depuis 2026, donc toujours plus grand, sur le Mac comme
// dans le cloud). BUILD_NUMBER=… force un numéro précis.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const IOS = path.join(ROOT, 'ios', 'App');
const ANDROID = path.join(ROOT, 'android', 'app');
const PLIST_REF = 'A1D0C0DE0000000000000001';
const PLIST_BUILD = 'A1D0C0DE0000000000000002';

const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const androidStr = (s) => xmlEsc(s).replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/^\?/, '\\?');

function edit(file, fn) {
  if (!fs.existsSync(file)) return;
  const before = fs.readFileSync(file, 'utf8');
  const after = fn(before);
  if (after !== before) fs.writeFileSync(file, after);
}

function configure({ bump = false } = {}) {
  const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.config.json'), 'utf8'));
  const { appId, appName } = app;
  const version = app.version || '1.0.0';
  const host = new URL(app.server).host;
  let build = Number(process.env.BUILD_NUMBER) || 0;
  if (!build && bump) build = Math.floor((Date.now() - Date.UTC(2026, 0, 1)) / 60000);

  // ---------- Android ----------
  edit(path.join(ANDROID, 'build.gradle'), (s) => {
    s = s.replace(/applicationId "[^"]*"/, `applicationId "${appId}"`).replace(/versionName "[^"]*"/, `versionName "${version}"`);
    if (build) s = s.replace(/versionCode \d+/, `versionCode ${build}`);
    return s;
  });
  edit(path.join(ANDROID, 'src', 'main', 'res', 'values', 'strings.xml'), (s) => s
    .replace(/(<string name="app_name">)[^<]*/, `$1${androidStr(appName)}`)
    .replace(/(<string name="title_activity_main">)[^<]*/, `$1${androidStr(appName)}`)
    .replace(/(<string name="package_name">)[^<]*/, `$1${appId}`)
    .replace(/(<string name="custom_url_scheme">)[^<]*/, `$1${appId}`));
  edit(path.join(ANDROID, 'src', 'main', 'AndroidManifest.xml'), (s) => s.replace(/(android:scheme="https" android:host=")[^"]*/, `$1${host}`));

  // ---------- iOS ----------
  edit(path.join(IOS, 'App', 'Info.plist'), (s) => s.replace(/(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]*/, `$1${xmlEsc(appName)}`));
  // Notifications + liens d'invitation : capacités déclarées ici, activées automatiquement par Xcode à la signature.
  fs.writeFileSync(path.join(IOS, 'App', 'App.entitlements'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>aps-environment</key>
	<string>development</string>
	<key>com.apple.developer.associated-domains</key>
	<array>
		<string>applinks:${host}</string>
	</array>
</dict>
</plist>
`);
  const hasPlist = fs.existsSync(path.join(IOS, 'App', 'GoogleService-Info.plist'));
  edit(path.join(IOS, 'App.xcodeproj', 'project.pbxproj'), (s) => {
    s = s.replace(/PRODUCT_BUNDLE_IDENTIFIER = [^;]*;/g, `PRODUCT_BUNDLE_IDENTIFIER = ${appId};`)
      .replace(/MARKETING_VERSION = [^;]*;/g, `MARKETING_VERSION = ${version};`)
      // iPhone seulement : sinon l'App Store exige aussi des captures d'écran iPad.
      .replace(/TARGETED_DEVICE_FAMILY = "[^"]*";/g, 'TARGETED_DEVICE_FAMILY = 1;')
      .replace(/TARGETED_DEVICE_FAMILY = [0-9,]+;/g, 'TARGETED_DEVICE_FAMILY = 1;');
    if (build) s = s.replace(/CURRENT_PROJECT_VERSION = [^;]*;/g, `CURRENT_PROJECT_VERSION = ${build};`);
    if (!s.includes('CODE_SIGN_ENTITLEMENTS')) s = s.replace(/(\t+)CODE_SIGN_STYLE = Automatic;/g, '$1CODE_SIGN_ENTITLEMENTS = App/App.entitlements;\n$1CODE_SIGN_STYLE = Automatic;');
    // Fichier Firebase (GoogleService-Info.plist) : ajouté au projet dès qu'il est posé dans ios/App/App.
    if (hasPlist && !s.includes(PLIST_REF)) {
      s = s.replace('/* End PBXBuildFile section */', `\t\t${PLIST_BUILD} /* GoogleService-Info.plist in Resources */ = {isa = PBXBuildFile; fileRef = ${PLIST_REF} /* GoogleService-Info.plist */; };\n/* End PBXBuildFile section */`)
        .replace('/* End PBXFileReference section */', `\t\t${PLIST_REF} /* GoogleService-Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = "GoogleService-Info.plist"; sourceTree = "<group>"; };\n/* End PBXFileReference section */`)
        .replace(/(\/\* Info\.plist \*\/,\n)/, `$1\t\t\t\t${PLIST_REF} /* GoogleService-Info.plist */,\n`)
        .replace(/(\/\* Resources \*\/ = \{\s*isa = PBXResourcesBuildPhase;\s*buildActionMask = \d+;\s*files = \(\n)/, `$1\t\t\t\t${PLIST_BUILD} /* GoogleService-Info.plist in Resources */,\n`);
    }
    return s;
  });

  const missing = [];
  if (!fs.existsSync(path.join(ANDROID, 'google-services.json'))) missing.push('android/app/google-services.json');
  if (!hasPlist) missing.push('ios/App/App/GoogleService-Info.plist');
  console.log(`Projets natifs : ${appName} (${appId}) v${version}${build ? ` build ${build}` : ''}`);
  if (missing.length) console.log(`  (pas encore de fichier Firebase : ${missing.join(', ')} → notifications désactivées dans ce build)`);
  return { appId, appName, version, build };
}

module.exports = configure;
if (require.main === module) configure({ bump: process.argv.includes('--bump') });
