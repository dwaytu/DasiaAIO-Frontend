import { API_BASE_URL } from '../config'
import { sanitizeErrorMessage } from './sanitize'

let authExpiryNotified = false
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])
const TOKEN_STORAGE_KEY = 'token'
const REFRESH_TOKEN_STORAGE_KEY = 'refreshToken'
const PUBLIC_API_PATHS = new Set([
  '/api/login',
  '/api/register',
  '/api/verify',
  '/api/resend-code',
  '/api/forgot-password',
  '/api/verify-reset-code',
  '/api/reset-password',
  '/api/refresh',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/verify',
  '/api/auth/resend-code',
  '/api/auth/forgot-password',
  '/api/auth/verify-reset-code',
  '/api/auth/reset-password',
  '/api/auth/refresh',
  '/api/health',
  '/api/health/system',
])

let refreshInFlight: Promise<string | null> | null = null
let refreshTokenCache = readLocalStorage(REFRESH_TOKEN_STORAGE_KEY)

type SecureStoragePlugin = {
  set: (options: { key: string; value: string }) => Promise<void>
  get: (options: { key: string }) => Promise<{ value?: string | null }>
  remove: (options: { key: string }) => Promise<void>
}

type CapacitorWindow = Window & {
  Capacitor?: {
    isNativePlatform?: () => boolean
    Plugins?: {
      SecureStoragePlugin?: SecureStoragePlugin
    }
  }
}

type JwtPayload = {
  exp?: number
}

function readLocalStorage(key: string): string {
  try {
    return localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

function writeLocalStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Ignore persistence failures in restricted environments.
  }
}

function removeLocalStorage(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Ignore persistence failures in restricted environments.
  }
}

function isCapacitorRuntime(): boolean {
  if (typeof window === 'undefined') return false
  const runtimeWindow = window as CapacitorWindow
  return runtimeWindow.Capacitor?.isNativePlatform?.() === true
}

function getSecureStoragePlugin(): SecureStoragePlugin | null {
  if (!isCapacitorRuntime() || typeof window === 'undefined') return null
  const runtimeWindow = window as CapacitorWindow
  return runtimeWindow.Capacitor?.Plugins?.SecureStoragePlugin || null
}

async function persistRefreshTokenSecurely(refreshToken: string): Promise<void> {
  const secureStorage = getSecureStoragePlugin()
  if (!secureStorage) {
    writeLocalStorage(REFRESH_TOKEN_STORAGE_KEY, refreshToken)
    return
  }

  await secureStorage.set({ key: REFRESH_TOKEN_STORAGE_KEY, value: refreshToken })
  removeLocalStorage(REFRESH_TOKEN_STORAGE_KEY)
}

async function removeRefreshTokenSecurely(): Promise<void> {
  const secureStorage = getSecureStoragePlugin()
  if (!secureStorage) {
    removeLocalStorage(REFRESH_TOKEN_STORAGE_KEY)
    return
  }

  await secureStorage.remove({ key: REFRESH_TOKEN_STORAGE_KEY })
  removeLocalStorage(REFRESH_TOKEN_STORAGE_KEY)
}

async function loadSecureRefreshToken(): Promise<string> {
  const secureStorage = getSecureStoragePlugin()
  if (!secureStorage) {
    return readLocalStorage(REFRESH_TOKEN_STORAGE_KEY)
  }

  try {
    const result = await secureStorage.get({ key: REFRESH_TOKEN_STORAGE_KEY })
    return (result?.value || '').trim()
  } catch {
    return ''
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const IDEMPOTENCY_HEADER = 'Idempotency-Key'

function notifyAuthExpired(message: string): void {
  if (authExpiryNotified) return
  authExpiryNotified = true

  try {
    window.dispatchEvent(new CustomEvent('auth:token-expired', { detail: { message } }))
  } catch {
    // Ignore environments without window support.
  }
}

function isAuthExpired(response: Response, message: string): boolean {
  const normalized = message.toLowerCase()
  const tokenExpiredMessage =
    normalized.includes('invalidtoken') ||
    normalized.includes('invalid or expired token') ||
    normalized.includes('expired token') ||
    normalized.includes('expiredsignature') ||
    normalized.includes('jwt')

  if (response.status === 401) return true
  if (response.status === 403) return tokenExpiredMessage
  return tokenExpiredMessage
}

function hasAuthorizationHeader(headers: HeadersInit | undefined): boolean {
  if (!headers) return false

  if (headers instanceof Headers) {
    return headers.has('Authorization')
  }

  if (Array.isArray(headers)) {
    return headers.some(([key]) => key.toLowerCase() === 'authorization')
  }

  return Object.keys(headers).some((key) => key.toLowerCase() === 'authorization')
}

function withAuthorizationHeader(init: RequestInit | undefined, token: string): RequestInit {
  const nextInit: RequestInit = { ...(init || {}) }
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${token}`)
  nextInit.headers = headers
  return nextInit
}

function requestUrlString(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function isRefreshEndpoint(url: string): boolean {
  return url.includes('/api/refresh') || url.includes('/api/auth/refresh')
}

function decodeBase64UrlSegment(segment: string): string | null {
  if (!segment) return null

  try {
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/')
    const padding = (4 - (normalized.length % 4)) % 4
    const base64 = normalized.padEnd(normalized.length + padding, '=')
    return atob(base64)
  } catch {
    return null
  }
}

function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split('.')
  if (parts.length < 2) return null

  const payload = decodeBase64UrlSegment(parts[1])
  if (!payload) return null

  try {
    return JSON.parse(payload) as JwtPayload
  } catch {
    return null
  }
}

function isProtectedApiEndpoint(url: string): boolean {
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
    const path = parsed.pathname.toLowerCase()

    if (!path.startsWith('/api/')) {
      return false
    }

    return !PUBLIC_API_PATHS.has(path)
  } catch {
    const normalized = url.toLowerCase()
    return normalized.includes('/api/') && !Array.from(PUBLIC_API_PATHS).some((path) => normalized.includes(path))
  }
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit | undefined, timeoutMs: number): Promise<Response> {
  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), timeoutMs)

  try {
    return await fetch(input, {
      ...init,
      signal: init?.signal ?? abortController.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken().trim()
  if (!refreshToken) return null

  if (refreshInFlight) {
    return refreshInFlight
  }

  refreshInFlight = (async () => {
    const refreshEndpoints = [`${API_BASE_URL}/api/refresh`, `${API_BASE_URL}/api/auth/refresh`]

    for (const endpoint of refreshEndpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        })

        if (!response.ok) {
          continue
        }

        const data = await parseResponseBody(response)
        if (typeof data?.token === 'string' && data.token.trim() !== '') {
          storeAuthSession(data.token, data.refreshToken)

          authExpiryNotified = false
          return data.token
        }
      } catch {
        continue
      }
    }

    return null
  })()

  try {
    return await refreshInFlight
  } finally {
    refreshInFlight = null
  }
}

export async function parseResponseBody(response: Response): Promise<any> {
  const raw = await response.text()
  if (!raw) return {}

  try {
    return JSON.parse(raw)
  } catch {
    const trimmed = raw.trim()
    return {
      message: trimmed || 'Received a non-JSON response from the server.',
      error: trimmed || 'non_json_response',
      raw,
    }
  }
}

export async function getApiErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  const body = await parseResponseBody(response)
  const raw = body.error || body.message || fallback
  return sanitizeErrorMessage(raw)
}

export async function fetchJsonOrThrow<T>(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  fallbackError: string,
  timeoutMs = 15000,
): Promise<T> {
  let requestInit = init
  const inputUrl = requestUrlString(input)

  if (isProtectedApiEndpoint(inputUrl) && !hasAuthorizationHeader(requestInit?.headers)) {
    const token = getAuthToken().trim()
    if (!token) {
      notifyAuthExpired('Missing authentication token.')
      throw new Error('Session expired. Please log in again.')
    }

    requestInit = withAuthorizationHeader(requestInit, token)
  }

  const headers = new Headers(requestInit?.headers)
  requestInit = {
    ...(requestInit || {}),
    headers,
  }

  const method = (requestInit?.method || 'GET').toUpperCase()
  const idempotentMutation =
    (method === 'PUT' || method === 'DELETE') &&
    headers.has(IDEMPOTENCY_HEADER)
  const retryableByMethod =
    method === 'GET' ||
    method === 'HEAD' ||
    method === 'OPTIONS' ||
    idempotentMutation
  const maxAttempts = retryableByMethod ? 2 : 1

  let response: Response | null = null
  let lastNetworkError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const abortController = new AbortController()
    const timeout = setTimeout(() => abortController.abort(), timeoutMs)

    try {
      response = await fetch(input, {
        ...requestInit,
        signal: requestInit?.signal ?? abortController.signal,
      })
      lastNetworkError = null
    } catch (error) {
      // If the caller's signal caused the abort, re-throw so callers can distinguish cancellation from timeout.
      if (requestInit?.signal?.aborted && error instanceof DOMException && error.name === 'AbortError') {
        throw error
      }
      if (error instanceof DOMException && error.name === 'AbortError') {
        lastNetworkError = new Error(`Request timed out after ${timeoutMs}ms`)
      } else {
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false
        lastNetworkError = new Error(offline ? 'You appear to be offline. Reconnect and try again.' : fallbackError)
      }
    } finally {
      clearTimeout(timeout)
    }

    if (response?.ok) {
      break
    }

    const shouldRetry =
      attempt < maxAttempts &&
      retryableByMethod &&
      (lastNetworkError !== null || (response !== null && RETRYABLE_STATUS.has(response.status)))

    if (shouldRetry) {
      const backoffMs = 400 * 2 ** (attempt - 1)
      await wait(backoffMs)
      continue
    }

    if (lastNetworkError) {
      throw lastNetworkError
    }
  }

  if (!response) {
    throw new Error(lastNetworkError?.message || fallbackError)
  }

  if (!response.ok) {
    const message = await getApiErrorMessage(response, fallbackError)

    if (isAuthExpired(response, message)) {
      const isCandidateForRefresh =
        !isRefreshEndpoint(inputUrl) &&
        hasAuthorizationHeader(requestInit?.headers) &&
        getRefreshToken().trim().length > 0

      if (isCandidateForRefresh) {
        const refreshedToken = await refreshAccessToken()

        if (refreshedToken) {
          const retryResponse = await fetchWithTimeout(
            input,
            withAuthorizationHeader(requestInit, refreshedToken),
            timeoutMs,
          )

          if (retryResponse.ok) {
            return parseResponseBody(retryResponse) as Promise<T>
          }

          const retryMessage = await getApiErrorMessage(retryResponse, fallbackError)
          if (!isAuthExpired(retryResponse, retryMessage)) {
            throw new Error(retryMessage)
          }
        }
      }

      notifyAuthExpired(message)
      throw new Error('Session expired. Please log in again.')
    }

    throw new Error(message)
  }

  return parseResponseBody(response) as Promise<T>
}

export function getAuthToken(): string {
  return readLocalStorage(TOKEN_STORAGE_KEY)
}

export function isAuthTokenExpired(token: string, clockSkewSeconds = 30): boolean {
  const trimmedToken = token.trim()
  if (!trimmedToken) return true

  const payload = decodeJwtPayload(trimmedToken)
  if (!payload || typeof payload.exp !== 'number') {
    return false
  }

  const expiresAtMs = payload.exp * 1000
  const skewMs = Math.max(0, clockSkewSeconds) * 1000
  return Date.now() >= expiresAtMs - skewMs
}

export function getRefreshToken(): string {
  if (refreshTokenCache) {
    return refreshTokenCache
  }

  const localFallback = readLocalStorage(REFRESH_TOKEN_STORAGE_KEY)
  if (localFallback) {
    refreshTokenCache = localFallback
  }

  return refreshTokenCache
}

export async function hydrateAuthSession(): Promise<void> {
  const secureRefreshToken = await loadSecureRefreshToken()
  refreshTokenCache = secureRefreshToken
}

export async function refreshAuthSessionIfNeeded(): Promise<boolean> {
  const token = getAuthToken().trim()
  if (!token) return false

  if (!isAuthTokenExpired(token)) {
    return true
  }

  const refreshedToken = await refreshAccessToken()
  return typeof refreshedToken === 'string' && refreshedToken.trim() !== ''
}

export function storeAuthSession(token: string, refreshToken?: string): void {
  writeLocalStorage(TOKEN_STORAGE_KEY, token)
  if (refreshToken && refreshToken.trim() !== '') {
    refreshTokenCache = refreshToken.trim()
    void persistRefreshTokenSecurely(refreshTokenCache).catch(() => {
      writeLocalStorage(REFRESH_TOKEN_STORAGE_KEY, refreshTokenCache)
    })
  }
}

export function clearAuthSession(): void {
  removeLocalStorage(TOKEN_STORAGE_KEY)
  refreshTokenCache = ''
  void removeRefreshTokenSecurely().catch(() => {
    removeLocalStorage(REFRESH_TOKEN_STORAGE_KEY)
  })
}

export function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken()
  if (!token) {
    return { ...extraHeaders }
  }

  return {
    Authorization: `Bearer ${token}`,
    ...extraHeaders,
  }
}
