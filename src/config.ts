const trimTrailingSlash = (url: string) => url.replace(/\/+$/, '')
const DEFAULT_PRODUCTION_API_BASE_URL = 'https://backend-production-0c47.up.railway.app'

function isTruthyEnvFlag(value: unknown): boolean {
  const normalized = String(value ?? '').trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

function isLocalQaApiOverride(parsed: URL): boolean {
  if (!import.meta.env.PROD || !isTruthyEnvFlag(import.meta.env.VITE_ALLOW_INSECURE_LOCAL_API)) {
    return false
  }

  const normalizedHost = parsed.hostname.trim().toLowerCase()
  return normalizedHost === 'localhost' || normalizedHost === '127.0.0.1' || normalizedHost === '0.0.0.0'
}

function isDisallowedProductionHost(hostname: string): boolean {
  const normalizedHost = hostname.trim().toLowerCase()

  if (
    normalizedHost === 'localhost' ||
    normalizedHost === '127.0.0.1' ||
    normalizedHost === '0.0.0.0' ||
    normalizedHost === '10.0.2.2'
  ) {
    return true
  }

  if (normalizedHost.startsWith('10.')) return true
  if (normalizedHost.startsWith('192.168.')) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(normalizedHost)) return true

  return false
}

export type RuntimePlatform = 'web' | 'capacitor' | 'tauri'

export const detectRuntimePlatform = (): RuntimePlatform => {
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

function validateApiBaseUrl(rawValue: string): string {
  const trimmed = rawValue.trim()
  if (!trimmed) {
    throw new Error('VITE_API_BASE_URL is configured but empty.')
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error('VITE_API_BASE_URL must be a fully-qualified URL (for example: https://api.example.com).')
  }

  const localQaOverride = isLocalQaApiOverride(parsed)

  if (import.meta.env.PROD && parsed.protocol !== 'https:' && !localQaOverride) {
    throw new Error('Production builds require VITE_API_BASE_URL to use HTTPS.')
  }

  if (import.meta.env.PROD && isDisallowedProductionHost(parsed.hostname) && !localQaOverride) {
    throw new Error('Production builds do not allow VITE_API_BASE_URL to point to localhost or private network addresses.')
  }

  return trimTrailingSlash(parsed.toString())
}

function resolveApiBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL
  if (typeof configuredUrl === 'string' && configuredUrl.trim()) {
    return validateApiBaseUrl(configuredUrl)
  }

  if (import.meta.env.PROD) {
    // Keep production clients bootable even when host build args are misconfigured.
    return validateApiBaseUrl(DEFAULT_PRODUCTION_API_BASE_URL)
  }

  throw new Error('Missing required VITE_API_BASE_URL. Configure it in your environment file before starting the app.')
}

export const API_BASE_URL = resolveApiBaseUrl()

export const APP_VERSION = (import.meta.env.VITE_APP_VERSION || 'dev').toString().trim()
export const APP_WHATS_NEW = (import.meta.env.VITE_WHATS_NEW || '').toString().trim()
export const LATEST_RELEASE_API_URL = (
  import.meta.env.VITE_LATEST_RELEASE_API_URL ||
  'https://api.github.com/repos/dwaytu/Capstone-Main/releases/latest'
).toString().trim()
export const RELEASE_DOWNLOAD_URL = (
  import.meta.env.VITE_RELEASE_DOWNLOAD_URL ||
  'https://github.com/dwaytu/Capstone-Main/releases/latest'
).toString().trim()
