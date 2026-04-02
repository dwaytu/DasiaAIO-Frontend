/**
 * Push notification utilities.
 *
 * Usage:
 *   import { registerServiceWorker, requestPushPermission, subscribeToPush } from './pushNotifications'
 *
 *   await registerServiceWorker()
 *   const granted = await requestPushPermission()
 *   if (granted) await subscribeToPush(userId)
 */

const SW_PATH = '/sw.js'

/** VAPID public key — set VITE_VAPID_PUBLIC_KEY in .env */
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const buffer = new ArrayBuffer(rawData.length)
  const outputArray = new Uint8Array(buffer)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    const registration = await navigator.serviceWorker.register(SW_PATH, { scope: '/' })
    return registration
  } catch (err) {
    console.error('[push] Service worker registration failed:', err)
    return null
  }
}

export async function requestPushPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

/**
 * Subscribes the user to Web Push using the VAPID public key and registers
 * the subscription with the backend so it can fan-out push messages.
 *
 * A backend route POST /api/notifications/push-subscribe is expected to
 * accept `{ userId, subscription }`.
 */
export async function subscribeToPush(userId: string): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[push] VITE_VAPID_PUBLIC_KEY is not set — push subscription skipped')
    return false
  }

  const registration = await registerServiceWorker()
  if (!registration) return false

  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
    })

    const { getAuthToken } = await import('./api')
    const { API_BASE_URL } = await import('../config')

    const response = await fetch(`${API_BASE_URL}/api/notifications/push-subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify({ userId, subscription }),
    })

    if (!response.ok) {
      console.error('[push] Backend subscription registration failed:', response.status)
      return false
    }

    return true
  } catch (err) {
    console.error('[push] Push subscription failed:', err)
    return false
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.getRegistration(SW_PATH)
  if (!registration) return
  const subscription = await registration.pushManager.getSubscription()
  if (subscription) {
    await subscription.unsubscribe()
  }
}
