// Service worker : notifications push + installation sur l'écran d'accueil. (v4)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Qui de nous ?';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/badge-96.png',
    timestamp: Date.now(),
    data: { url: data.url || '/' },
  };
  if (data.tag) {
    options.tag = data.tag;
    options.renotify = true; // une notif qui remplace la précédente (même discussion) sonne quand même
  }
  // iPhone et Android exigent qu'une notification s'affiche pour chaque push reçu :
  // si les options avancées posent problème, on retombe sur une notification minimale.
  event.waitUntil(
    self.registration.showNotification(title, options).catch(() => self.registration.showNotification(title, { body: options.body }))
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
