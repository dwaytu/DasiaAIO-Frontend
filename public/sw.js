// Service worker: push notifications + offline caching + action queue
// Registered from src/utils/pushNotifications.ts

const CACHE_NAME = 'sentinel-v2';
const STATIC_ASSETS = ['/logo/sentinel-192.png', '/logo/sentinel-96.png'];

// IndexedDB helpers for offline action queue
const DB_NAME = 'sentinel-offline';
const STORE_NAME = 'action-queue';
const DEFAULT_MAX_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 15000;
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;

function computeBackoffMs(attempts) {
  const exponential = BASE_RETRY_DELAY_MS * 2 ** Math.max(0, attempts - 1);
  return Math.min(exponential, MAX_RETRY_DELAY_MS);
}

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

async function getDueActions() {
  const db = await openQueue();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.openCursor();
    const items = [];
    const now = Date.now();
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        const value = cursor.value || {};
        const attempts = Number.isFinite(value.attempts) ? value.attempts : 0;
        const maxAttempts = Number.isFinite(value.maxAttempts) ? value.maxAttempts : DEFAULT_MAX_ATTEMPTS;
        const retryAt = value.nextRetryAt ? new Date(value.nextRetryAt).getTime() : 0;
        const isDue = !Number.isFinite(retryAt) || retryAt <= now;
        if (attempts < maxAttempts && isDue) {
          items.push({ id: cursor.key, ...value });
        }
        cursor.continue();
      } else {
        resolve(items);
      }
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

async function removeActionById(id) {
  const db = await openQueue();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

async function markActionFailure(item, errorMessage) {
  const db = await openQueue();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(item.id);
    req.onsuccess = () => {
      const current = req.result;
      if (!current) {
        resolve();
        return;
      }
      const attempts = (Number.isFinite(current.attempts) ? current.attempts : 0) + 1;
      const maxAttempts = Number.isFinite(current.maxAttempts) ? current.maxAttempts : DEFAULT_MAX_ATTEMPTS;
      const delayMs = computeBackoffMs(attempts);
      const nextRetryAt = new Date(Date.now() + delayMs).toISOString();
      const nextRecord = {
        ...current,
        attempts,
        maxAttempts,
        lastAttemptAt: new Date().toISOString(),
        nextRetryAt,
        lastError: errorMessage || 'Replay failed',
      };
      store.put(nextRecord);
      resolve();
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
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

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok && response.type !== 'opaque') {
    const clone = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
  }
  return response;
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok && response.type !== 'opaque') {
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;

    const fallback = await caches.match('/');
    if (fallback) return fallback;

    throw error;
  }
}

function isAssetRequest(url, request) {
  return (
    url.pathname.startsWith('/assets/') ||
    request.destination === 'script' ||
    request.destination === 'worker' ||
    request.destination === 'style'
  );
}

// Navigation requests must be network-first to prevent stale HTML from referencing old chunk hashes.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // For hashed JS/CSS assets, prefer network and fallback to cache (prevents stale bundles after deploy).
  if (isAssetRequest(url, request)) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        return Response.error();
      }),
    );
    return;
  }

  event.respondWith(
    cacheFirst(request).catch(async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      return Response.error();
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
  const items = await getDueActions();
  for (const item of items) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: { 'Content-Type': 'application/json', ...item.headers },
        body: item.body !== undefined ? JSON.stringify(item.body) : undefined,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      await removeActionById(item.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await markActionFailure(item, message);
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
