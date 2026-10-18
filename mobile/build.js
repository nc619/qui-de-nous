// Prépare l'interface pour l'app mobile : copie ../public dans www/ et écrit config.js avec l'adresse du serveur.
// Le site web n'est pas touché. Usage : node build.js (fait aussi par npm run sync / android / ios).
const fs = require('fs');
const path = require('path');
const app = require('./app.config.json');
const configure = require('./configure');

const SRC = path.join(__dirname, '..', 'public');
const OUT = path.join(__dirname, 'www');
const SKIP = new Set(['sw.js', 'manifest.webmanifest', 'manifest.en.webmanifest', 'manifest.es.webmanifest', 'config.js']);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(SRC)) {
  if (SKIP.has(f)) continue;
  fs.cpSync(path.join(SRC, f), path.join(OUT, f), { recursive: true });
}
const server = (process.env.QDN_SERVER || app.server).replace(/\/$/, '');
fs.writeFileSync(path.join(OUT, 'config.js'), `// Généré par mobile/build.js\nwindow.QDN_CONFIG = ${JSON.stringify({ api: server, publicUrl: server, native: true })};\n`);
// Pas de manifeste ni de service worker dans l'app ; polices Google gardées (chargées par le réseau).
let html = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
html = html.replace(/\s*<link rel="manifest"[^>]*>/, '');
fs.writeFileSync(path.join(OUT, 'index.html'), html);
console.log(`www/ prêt (serveur : ${server})`);
configure({ bump: process.argv.includes('--bump') });
