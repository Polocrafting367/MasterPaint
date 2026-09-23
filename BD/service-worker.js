const CACHE_NAME = 'pointeuse-v1.2.18';
const ASSETS_TO_CACHE = [
    'index.html',
    'script.js',
    'style.css',
    'ico.css',
    'fa-solid-900.woff2',
    'logo.png',
    'manifest.json',
    'white.png',
    'stop-icon.png'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});

self.addEventListener('message', (event) => {
    if (event.data.type === 'START_TIMER_NOTIF') {
        const options = {
            body: `Chrono en cours : ${event.data.profileName}`,
            icon: 'logo.png',
            badge: 'white.png',
            tag: 'timer-notif',
            ongoing: true,
            sticky: true,
            requireInteraction: true,
            vibrate: [100],
            data: { url: self.location.origin },
            actions: [
                { action: 'stop-action', title: 'Arrêter le chrono', icon: 'stop-icon.png' }
            ]
        };

        // Utilise self.registration pour être sûr d'avoir accès aux notifs
        event.waitUntil(
            self.registration.showNotification('Pointeuse Mobile', options)
        );
    }

    if (event.data.type === 'STOP_TIMER_NOTIF') {
        self.registration.getNotifications({ tag: 'timer-notif' }).then(notifications => {
            notifications.forEach(notification => notification.close());
        });
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const action = event.action; // 'stop-action' ou vide (clic sur le corps)

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // 1. Chercher si l'app est déjà ouverte
            for (const client of clientList) {
                if (client.url.includes(self.location.origin)) {

                    // Si clic sur le bouton STOP
                    if (action === 'stop-action') {
                        client.postMessage({ type: 'FORCE_STOP_TIMER' });
                    }
                    // Si clic sur le corps de la notification
                    else {
                        client.postMessage({ type: 'NAV_TO_CHRONO' });
                    }

                    if ('focus' in client) return client.focus();
                }
            }

        })
    );
});