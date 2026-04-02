// Service worker: push notifications + offline caching + action queue
// Registered from src/utils/pushNotifications.ts

const CACHE_NAME = 'sentinel-v1';
const STATIC_ASSETS = ['/', '/index.html', '/logo/sentinel-192.png', '/logo/sentinel-96.png'];

// IndexedDB helpers for offline action queue
const DB_NAME = 'sentinel-offline';
const STORE_NAME = 'action-queue';

function openQueue() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function enqueueAction(action) {
  const db = await openQueue();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add(action);
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function dequeueAll() {
  const db = await openQueue();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.openCursor();
    const items = [];
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        items.push({ id: cursor.key, ...cursor.value });
        cursor.delete();
        cursor.continue();
      } else {
        resolve(items);
      }
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

async function requeue(item) {
  const { id: _id, ...rest } = item;
  await enqueueAction(rest);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// Cache-first for static assets; network-first (passthrough) for API requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    }),
  );
});

// Background sync: replay queued offline actions when connectivity returns
self.addEventListener('sync', (event) => {
  if (event.tag === 'sentinel-action-queue') {
    event.waitUntil(replayQueue());
  }
});

async function replayQueue() {
  const items = await dequeueAll();
  const results = await Promise.allSettled(
    items.map((item) =>
      fetch(item.url, {
        method: item.method,
        headers: { 'Content-Type': 'application/json', ...item.headers },
        body: item.body !== undefined ? JSON.stringify(item.body) : undefined,
      }).then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }),
    ),
  );
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'rejected') {
      await requeue(items[i]);
    }
  }
}

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'SENTINEL', body: event.data.text() };
  }

  const title = payload.title ?? 'SENTINEL Notification';
  const options = {
    body: payload.body ?? '',
    icon: '/logo/sentinel-192.png',
    badge: '/logo/sentinel-96.png',
    tag: payload.tag ?? 'sentinel-notification',
    data: { url: payload.url ?? '/' },
    requireInteraction: Boolean(payload.requireInteraction),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});
