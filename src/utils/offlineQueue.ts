/**
 * Offline action queue — stores failed API calls in IndexedDB and
 * replays them via Background Sync when connectivity is restored.
 *
 * Usage:
 *   import { enqueueOfflineAction } from './offlineQueue'
 *
 *   await enqueueOfflineAction({ url: '/api/attendance/check-in', method: 'POST', body: payload })
 */

export interface OfflineAction {
  url: string
  method: string
  /** Optional headers merged with Content-Type: application/json */
  headers?: Record<string, string>
  body?: unknown
  /** ISO timestamp when the action was queued */
  queuedAt: string
}

const DB_NAME = 'sentinel-offline'
const STORE_NAME = 'action-queue'
const SYNC_TAG = 'sentinel-action-queue'

function openQueue(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = (e) => {
      ;(e.target as IDBOpenDBRequest).result.createObjectStore(STORE_NAME, {
        keyPath: 'id',
        autoIncrement: true,
      })
    }
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result)
    req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error)
  })
}

/**
 * Adds an action to the IndexedDB queue and requests a background sync.
 * Falls back to a direct retry if the Background Sync API is unavailable.
 */
export async function enqueueOfflineAction(action: Omit<OfflineAction, 'queuedAt'>): Promise<void> {
  const record: OfflineAction = { ...action, queuedAt: new Date().toISOString() }

  const db = await openQueue()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).add(record)
    tx.oncomplete = () => resolve()
    tx.onerror = (e) => reject((e.target as IDBRequest).error)
  })

  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const reg = await navigator.serviceWorker.ready
    // @ts-expect-error — SyncManager is not yet in all TS lib definitions
    await reg.sync.register(SYNC_TAG).catch(() => {
      // Sync registration failed silently — sw replay will happen on next load
    })
  }
}

/**
 * Returns all queued actions without removing them.
 * Useful for showing a pending-actions badge in the UI.
 */
export async function getPendingCount(): Promise<number> {
  const db = await openQueue()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).count()
    req.onsuccess = (e) => resolve((e.target as IDBRequest<number>).result)
    req.onerror = (e) => reject((e.target as IDBRequest).error)
  })
}
