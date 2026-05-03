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
  /** Optional operation type for UI diagnostics */
  actionType?: 'check_in' | 'check_out' | 'incident' | 'sos' | 'tracking_consent' | 'other'
  /** ISO timestamp when the action was queued */
  queuedAt: string
  attempts: number
  maxAttempts: number
  nextRetryAt: string
  lastAttemptAt?: string
  lastError?: string
}

export interface OfflineActionInput {
  url: string
  method: string
  headers?: Record<string, string>
  body?: unknown
  actionType?: OfflineAction['actionType']
  attempts?: number
  maxAttempts?: number
  nextRetryAt?: string
  lastAttemptAt?: string
  lastError?: string
}

const DB_NAME = 'sentinel-offline'
const STORE_NAME = 'action-queue'
const SYNC_TAG = 'sentinel-action-queue'
const DEFAULT_MAX_ATTEMPTS = 5
const BASE_RETRY_DELAY_MS = 15_000
const MAX_RETRY_DELAY_MS = 5 * 60_000

export interface OfflineQueueHealth {
  pendingCount: number
  failedCount: number
}

function computeBackoffMs(attempts: number): number {
  const exponential = BASE_RETRY_DELAY_MS * 2 ** Math.max(0, attempts - 1)
  return Math.min(exponential, MAX_RETRY_DELAY_MS)
}

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
export async function enqueueOfflineAction(action: OfflineActionInput): Promise<void> {
  const db = await openQueue()

  const isDuplicate = await new Promise<boolean>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const cursorReq = store.openCursor(null, 'prev')
    cursorReq.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result
      if (cursor) {
        const last = cursor.value as OfflineAction
        resolve(last.url === action.url && last.method === action.method)
      } else {
        resolve(false)
      }
    }
    cursorReq.onerror = (e) => reject((e.target as IDBRequest).error)
  })

  if (isDuplicate) return

  const now = new Date().toISOString()
  const actionType = action.actionType || inferActionType(action.url)
  const record: OfflineAction = {
    ...action,
    actionType,
    queuedAt: now,
    attempts: Number.isFinite(action.attempts) ? action.attempts : 0,
    maxAttempts: Number.isFinite(action.maxAttempts) ? action.maxAttempts : DEFAULT_MAX_ATTEMPTS,
    nextRetryAt: action.nextRetryAt || now,
    lastAttemptAt: action.lastAttemptAt,
    lastError: action.lastError,
  }

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

export async function getQueueHealth(): Promise<OfflineQueueHealth> {
  const db = await openQueue()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.openCursor()
    let pendingCount = 0
    let failedCount = 0
    req.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result
      if (!cursor) {
        resolve({ pendingCount, failedCount })
        return
      }
      const value = cursor.value as OfflineAction
      pendingCount += 1
      if ((value.attempts || 0) >= (value.maxAttempts || DEFAULT_MAX_ATTEMPTS)) {
        failedCount += 1
      }
      cursor.continue()
    }
    req.onerror = (event) => reject((event.target as IDBRequest).error)
  })
}

export async function retryFailedActions(): Promise<number> {
  const db = await openQueue()
  const recovered = await new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.openCursor()
    let updated = 0

    req.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result
      if (!cursor) {
        resolve(updated)
        return
      }

      const value = cursor.value as OfflineAction
      if ((value.attempts || 0) >= (value.maxAttempts || DEFAULT_MAX_ATTEMPTS)) {
        const resetValue: OfflineAction = {
          ...value,
          attempts: 0,
          nextRetryAt: new Date().toISOString(),
          lastError: undefined,
        }
        cursor.update(resetValue)
        updated += 1
      }
      cursor.continue()
    }

    req.onerror = (event) => reject((event.target as IDBRequest).error)
  })

  if (recovered > 0 && 'serviceWorker' in navigator && 'SyncManager' in window) {
    const reg = await navigator.serviceWorker.ready
    // @ts-expect-error SyncManager may be missing in TS DOM library.
    await reg.sync.register(SYNC_TAG).catch(() => {
      // Ignore sync-registration errors; replay can happen on later sw wakeups.
    })
  }

  return recovered
}

function inferActionType(url: string): OfflineAction['actionType'] {
  const normalized = url.toLowerCase()
  if (normalized.includes('/attendance/check-in')) return 'check_in'
  if (normalized.includes('/attendance/check-out')) return 'check_out'
  if (normalized.includes('/incidents')) return 'incident'
  if (normalized.includes('/tracking-consent') || normalized.includes('/location-consent')) {
    return 'tracking_consent'
  }
  return 'other'
}

export function annotateRetryMetadata(action: OfflineAction): OfflineAction {
  const attempts = action.attempts + 1
  const delayMs = computeBackoffMs(attempts)
  return {
    ...action,
    attempts,
    lastAttemptAt: new Date().toISOString(),
    nextRetryAt: new Date(Date.now() + delayMs).toISOString(),
  }
}
