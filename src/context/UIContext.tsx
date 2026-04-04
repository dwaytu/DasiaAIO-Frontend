import { createContext, useState, useEffect, useCallback, ReactNode } from 'react'
import {
  API_BASE_URL,
  APP_VERSION,
  APP_WHATS_NEW,
  LATEST_RELEASE_API_URL,
  RELEASE_DOWNLOAD_URL,
  detectRuntimePlatform,
  RuntimePlatform,
} from '../config'

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

export interface Toast {
  id: string
  type: 'error' | 'warning' | 'success' | 'info'
  message: string
  duration?: number // ms, default 5000
}

// ---------------------------------------------------------------------------
// Internal types (mirrors App.tsx)
// ---------------------------------------------------------------------------

export type ReleasePrompt = {
  tag: string
  url: string
  changelog?: string
  platform: RuntimePlatform
}

type SystemVersionResponse = {
  latestVersion?: string
  changelog?: string
  downloadLinks?: {
    web?: string
    desktop?: string
    mobile?: string
  }
}

export type WhatsNewPrompt = {
  version: string
  notes: string
}

// ---------------------------------------------------------------------------
// Context value interface
// ---------------------------------------------------------------------------

export interface UIContextValue {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  releasePrompt: ReleasePrompt | null
  whatsNewPrompt: WhatsNewPrompt | null
  isNetworkOnline: boolean
  isBackendReachable: boolean
  checkForUpdates: (ignoreDismissedTag?: boolean) => Promise<void>
  dismissReleasePrompt: () => void
  dismissWhatsNewPrompt: () => void
  downloadUpdate: () => Promise<void>
}

export const UIContext = createContext<UIContextValue | null>(null)

// ---------------------------------------------------------------------------
// Helper functions (identical to App.tsx)
// ---------------------------------------------------------------------------

const UPDATE_DISMISS_KEY_PREFIX = 'dasi.update.dismissed.'
const WHATS_NEW_SEEN_KEY_PREFIX = 'dasi.whatsnew.seen.'

function resolveDownloadUrl(platform: RuntimePlatform, payload: SystemVersionResponse): string {
  if (platform === 'tauri') {
    return payload.downloadLinks?.desktop || payload.downloadLinks?.web || RELEASE_DOWNLOAD_URL
  }
  if (platform === 'capacitor') {
    return payload.downloadLinks?.mobile || payload.downloadLinks?.web || RELEASE_DOWNLOAD_URL
  }
  return payload.downloadLinks?.web || RELEASE_DOWNLOAD_URL
}

function parseSemverVersion(value: string): [number, number, number] | null {
  const normalized = value.trim().replace(/^v/i, '')
  const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function normalizeVersionTag(value: string): string {
  return value.trim().replace(/^v/i, '')
}

function getWhatsNewSeenKey(version: string): string {
  return `${WHATS_NEW_SEEN_KEY_PREFIX}${normalizeVersionTag(version)}`
}

function isReleaseNewer(latestTag: string, currentVersion: string): boolean {
  const latest = parseSemverVersion(latestTag)
  const current = parseSemverVersion(currentVersion)
  if (!latest || !current) return false
  if (latest[0] !== current[0]) return latest[0] > current[0]
  if (latest[1] !== current[1]) return latest[1] > current[1]
  return latest[2] > current[2]
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface UIProviderProps {
  children: ReactNode
}

export function UIProvider({ children }: UIProviderProps) {
  const runtimePlatform = detectRuntimePlatform()

  const [toasts, setToasts] = useState<Toast[]>([])
  const [releasePrompt, setReleasePrompt] = useState<ReleasePrompt | null>(null)
  const [whatsNewPrompt, setWhatsNewPrompt] = useState<WhatsNewPrompt | null>(null)
  const [isNetworkOnline, setIsNetworkOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [isBackendReachable, setIsBackendReachable] = useState(true)

  // ---------------------------------------------------------------------------
  // Toast management
  // ---------------------------------------------------------------------------

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const newToast: Toast = { ...toast, id }
    setToasts((prev) => [...prev, newToast])

    const duration = toast.duration ?? 5000
    if (duration > 0) {
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, duration)
    }
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // ---------------------------------------------------------------------------
  // Network online / offline listeners
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handleOnline = () => setIsNetworkOnline(true)
    const handleOffline = () => {
      setIsNetworkOnline(false)
      setIsBackendReachable(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Backend reachability probe (every 30 s)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isNetworkOnline) {
      setIsBackendReachable(false)
      return
    }

    let disposed = false

    const probeBackend = async () => {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 5000)

      try {
        const response = await fetch(`${API_BASE_URL}/api/health`, {
          method: 'GET',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        })

        if (!disposed) {
          setIsBackendReachable(response.ok)
        }
      } catch {
        if (!disposed) {
          setIsBackendReachable(false)
        }
      } finally {
        window.clearTimeout(timeout)
      }
    }

    void probeBackend()
    const interval = window.setInterval(() => {
      void probeBackend()
    }, 30000)

    return () => {
      disposed = true
      window.clearInterval(interval)
    }
  }, [isNetworkOnline])

  // ---------------------------------------------------------------------------
  // Update check
  // ---------------------------------------------------------------------------

  const checkForUpdates = useCallback(
    async (ignoreDismissedTag = false) => {
      try {
        const systemResponse = await fetch(`${API_BASE_URL}/api/system/version`, {
          headers: { Accept: 'application/json' },
        })

        if (systemResponse.ok) {
          const payload = (await systemResponse.json()) as SystemVersionResponse
          const latestTag = (payload.latestVersion || '').trim()
          if (!latestTag || !isReleaseNewer(latestTag, APP_VERSION)) return

          const dismissedKey = `${UPDATE_DISMISS_KEY_PREFIX}${latestTag}`
          if (!ignoreDismissedTag && localStorage.getItem(dismissedKey) === 'true') return

          setReleasePrompt({
            tag: latestTag,
            url: resolveDownloadUrl(runtimePlatform, payload),
            changelog: payload.changelog,
            platform: runtimePlatform,
          })
          return
        }

        const response = await fetch(LATEST_RELEASE_API_URL, {
          headers: { Accept: 'application/vnd.github+json' },
        })

        if (!response.ok) return

        const data = (await response.json()) as { tag_name?: string; html_url?: string }
        const latestTag = (data.tag_name || '').trim()
        if (!latestTag || !isReleaseNewer(latestTag, APP_VERSION)) return

        const dismissedKey = `${UPDATE_DISMISS_KEY_PREFIX}${latestTag}`
        if (!ignoreDismissedTag && localStorage.getItem(dismissedKey) === 'true') return

        setReleasePrompt({
          tag: latestTag,
          url: data.html_url || RELEASE_DOWNLOAD_URL,
          platform: runtimePlatform,
        })
      } catch {
        // Ignore transient release-check failures.
      }
    },
    [runtimePlatform],
  )

  useEffect(() => {
    if (import.meta.env.DEV) return

    let isCancelled = false

    void checkForUpdates()
    const interval = window.setInterval(() => {
      if (!isCancelled) {
        void checkForUpdates()
      }
    }, 1000 * 60 * 60 * 6)

    return () => {
      isCancelled = true
      window.clearInterval(interval)
    }
  }, [checkForUpdates])

  // ---------------------------------------------------------------------------
  // What's New prompt
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (import.meta.env.DEV) return

    const currentVersion = normalizeVersionTag(APP_VERSION)
    const hasSemverVersion = Boolean(parseSemverVersion(currentVersion))
    const notes = APP_WHATS_NEW.trim()

    if (!hasSemverVersion || !notes) return

    const seenKey = getWhatsNewSeenKey(currentVersion)
    if (localStorage.getItem(seenKey) === 'true') return

    setWhatsNewPrompt({ version: currentVersion, notes })
  }, [])

  // ---------------------------------------------------------------------------
  // Release / What's New dismiss handlers
  // ---------------------------------------------------------------------------

  const dismissReleasePrompt = useCallback(() => {
    if (!releasePrompt) return
    localStorage.setItem(`${UPDATE_DISMISS_KEY_PREFIX}${releasePrompt.tag}`, 'true')
    setReleasePrompt(null)
  }, [releasePrompt])

  const dismissWhatsNewPrompt = useCallback(() => {
    if (!whatsNewPrompt) return
    localStorage.setItem(getWhatsNewSeenKey(whatsNewPrompt.version), 'true')
    setWhatsNewPrompt(null)
  }, [whatsNewPrompt])

  const downloadUpdate = useCallback(async () => {
    if (!releasePrompt) return

    if (releasePrompt.platform === 'tauri') {
      try {
        const updater = await import('@tauri-apps/plugin-updater')
        const process = await import('@tauri-apps/plugin-process')
        const update = await updater.check()

        if (update) {
          await update.downloadAndInstall((event) => {
            if (event.event === 'Finished') {
              addToast({ type: 'info', message: 'Update downloaded. Restarting now...' })
            }
          })
          await process.relaunch()
          return
        }
      } catch {
        // Fall back to release URL if Tauri updater is unavailable.
      }
    }

    window.open(releasePrompt.url, '_blank', 'noopener,noreferrer')
    dismissReleasePrompt()
  }, [releasePrompt, dismissReleasePrompt])

  // ---------------------------------------------------------------------------
  // Context value
  // ---------------------------------------------------------------------------

  const value: UIContextValue = {
    toasts,
    addToast,
    removeToast,
    releasePrompt,
    whatsNewPrompt,
    isNetworkOnline,
    isBackendReachable,
    checkForUpdates,
    dismissReleasePrompt,
    dismissWhatsNewPrompt,
    downloadUpdate,
  }

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>
}
