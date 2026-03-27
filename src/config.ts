/**
 * API Configuration
 * For production on Railway, add `?api_host=https://backend-service:port` to the frontend URL
 * Or set VITE_API_BASE_URL environment variable
 */

const trimTrailingSlash = (url: string) => url.replace(/\/+$/, '')
const DEFAULT_PRODUCTION_API_URL = 'https://backend-production-0c47.up.railway.app'

type RuntimePlatform = 'web' | 'capacitor' | 'tauri'

const detectRuntimePlatform = (): RuntimePlatform => {
  if (typeof window === 'undefined') return 'web'

  const runtimeWindow = window as typeof window & {
    Capacitor?: { isNativePlatform?: () => boolean }
    __TAURI__?: unknown
    __TAURI_INTERNALS__?: unknown
  }

  if (runtimeWindow.Capacitor?.isNativePlatform?.()) return 'capacitor'
  if (runtimeWindow.__TAURI__ || runtimeWindow.__TAURI_INTERNALS__) return 'tauri'
  return 'web'
}

const getEnvApiUrl = (): string | null => {
  const apiUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL
  if (!apiUrl || typeof apiUrl !== 'string') return null
  return trimTrailingSlash(apiUrl)
}

const getPlatformEnvApiUrl = (platform: RuntimePlatform): string | null => {
  const envMap: Record<RuntimePlatform, string | undefined> = {
    web: import.meta.env.VITE_API_BASE_URL_WEB,
    tauri: import.meta.env.VITE_API_BASE_URL_DESKTOP,
    capacitor: import.meta.env.VITE_API_BASE_URL_MOBILE,
  }

  const candidate = envMap[platform]
  if (!candidate || typeof candidate !== 'string') return null
  return trimTrailingSlash(candidate)
}

function getDefaultAPIURL(): string {
  const platform = detectRuntimePlatform()

  const platformEnvApiUrl = getPlatformEnvApiUrl(platform)
  if (platformEnvApiUrl) {
    return platformEnvApiUrl
  }

  // Build-time: mode-specific .env values are baked by Vite
  const envApiUrl = getEnvApiUrl()
  if (envApiUrl) {
    return envApiUrl
  }

  if (typeof window !== 'undefined') {
    // Allow runtime override via query param (e.g. for testing)
    const apiHostParam = new URLSearchParams(window.location.search).get('api_host')
    if (apiHostParam) return trimTrailingSlash(apiHostParam)

    const { hostname, protocol } = window.location

    const runtimeOverride = (window as typeof window & { __SENTINEL_API_BASE_URL__?: string }).__SENTINEL_API_BASE_URL__
    if (runtimeOverride) {
      return trimTrailingSlash(runtimeOverride)
    }

    if (platform === 'capacitor') {
      // Android emulator cannot reach host loopback directly.
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        if (import.meta.env.DEV) {
          return 'http://10.0.2.2:5000'
        }
        return DEFAULT_PRODUCTION_API_URL
      }
      if (import.meta.env.DEV) {
        return `${protocol}//${hostname}:5000`
      }
      return DEFAULT_PRODUCTION_API_URL
    }

    // Local development
    if (hostname === 'localhost' || hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') || hostname.startsWith('10.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) {
      return `${protocol}//${hostname}:5000`
    }

    // Railway production — hardcoded fallback in case build arg was missing
    if (hostname.includes('.up.railway.app')) {
      return DEFAULT_PRODUCTION_API_URL
    }
  }

  return 'http://127.0.0.1:5000'
}

export const API_BASE_URL = getDefaultAPIURL()

export const APP_VERSION = (import.meta.env.VITE_APP_VERSION || 'dev').toString().trim()
export const LATEST_RELEASE_API_URL = (
  import.meta.env.VITE_LATEST_RELEASE_API_URL ||
  'https://api.github.com/repos/Cloudyrowdyyy/Capstone-Main/releases/latest'
).toString().trim()
export const RELEASE_DOWNLOAD_URL = (
  import.meta.env.VITE_RELEASE_DOWNLOAD_URL ||
  'https://github.com/Cloudyrowdyyy/Capstone-Main/releases/latest'
).toString().trim()
