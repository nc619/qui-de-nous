// Configuration Capacitor (lue par `npx cap …`). Nom et identifiant : voir app.config.json.
const app = require('./app.config.json');

module.exports = {
  appId: app.appId,
  appName: app.appName,
  webDir: 'www',
  backgroundColor: '#7b2ff7',
  ios: { contentInset: 'never' },
  android: { allowMixedContent: false },
  plugins: {
    SplashScreen: { launchAutoHide: false, backgroundColor: '#7b2ff7', showSpinner: false },
    // Notification qui arrive pendant que l'app est ouverte : on la montre quand même (le serveur n'en envoie pas
    // à ceux qui regardent le groupe concerné).
    FirebaseMessaging: { presentationOptions: ['badge', 'sound', 'alert'] },
    StatusBar: { overlaysWebView: true, style: 'DARK' },
  },
  // iOS (Swift Package Manager) : évite un conflit de nom de paquet avec Firebase (doc du plugin).
  experimental: { ios: { spm: { packageOptions: { '@capacitor-firebase/messaging': { symlink: true } } } } },
};
