// Service worker : notifications push + installation sur l'écran d'accueil.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data && event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Qui de nous ? 🤔', {
      body: data.body || 'Nouvelle question !',
      tag: data.tag,
      renotify: !!data.tag, // une notif qui remplace la précédente (même discussion) sonne quand même
      timestamp: Date.now(),
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          c.postMessage({ type: 'open', url }); // l'app ouvre la bonne discussion sans recharger
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// Nécessaire pour que l'app soit "installable" ; on ne met rien en cache.
self.addEventListener('fetch', () => {});
