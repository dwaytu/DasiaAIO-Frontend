import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow } from './api'
import { sanitizeErrorMessage } from './sanitize'

const TRACKING_CONSENT_REQUIRED_CODE = 'tracking_consent_required'

type RawTrackingConsentResponse = {
  legalConsentAccepted?: boolean
  locationTrackingConsent?: boolean
  locationTrackingConsentGrantedAt?: string | null
  locationTrackingConsentRevokedAt?: string | null
  locationTrackingConsentUpdatedAt?: string | null
  grantedAt?: string | null
  revokedAt?: string | null
  updatedAt?: string | null
}

export interface TrackingConsentResponse {
  legalConsentAccepted: boolean
  locationTrackingConsent: boolean
  locationTrackingConsentGrantedAt: string | null
  locationTrackingConsentRevokedAt: string | null
  locationTrackingConsentUpdatedAt: string | null
}

export type TrackingConsentRequiredResponse = {
  code?: string
  error?: string
  message?: string
  status?: number
  legalConsentAccepted?: boolean
  locationTrackingConsent?: boolean
}

function normalizeTrackingConsentResponse(raw: RawTrackingConsentResponse): TrackingConsentResponse {
  return {
    legalConsentAccepted: raw.legalConsentAccepted === true,
    locationTrackingConsent: raw.locationTrackingConsent === true,
    locationTrackingConsentGrantedAt: raw.locationTrackingConsentGrantedAt ?? raw.grantedAt ?? null,
    locationTrackingConsentRevokedAt: raw.locationTrackingConsentRevokedAt ?? raw.revokedAt ?? null,
    locationTrackingConsentUpdatedAt: raw.locationTrackingConsentUpdatedAt ?? raw.updatedAt ?? null,
  }
}

async function loadTrackingConsent(method: 'GET' | 'POST', path: string, fallback: string): Promise<TrackingConsentResponse> {
  const payload = await fetchJsonOrThrow<RawTrackingConsentResponse>(
    `${API_BASE_URL}${path}`,
    {
      method,
      headers: { Accept: 'application/json' },
    },
    fallback,
  )

  return normalizeTrackingConsentResponse(payload)
}

export async function fetchTrackingConsentStatus(): Promise<TrackingConsentResponse> {
  return loadTrackingConsent('GET', '/api/tracking/consent', 'Failed to load tracking consent status')
}

export async function grantTrackingConsent(): Promise<TrackingConsentResponse> {
  return loadTrackingConsent('POST', '/api/tracking/consent/grant', 'Failed to grant location tracking consent')
}

export async function revokeTrackingConsent(): Promise<TrackingConsentResponse> {
  return loadTrackingConsent('POST', '/api/tracking/consent/revoke', 'Failed to revoke location tracking consent')
}

export function isTrackingConsentRequiredResponse(
  status: number,
  payload: unknown,
): payload is TrackingConsentRequiredResponse {
  if (status !== 403 || !payload || typeof payload !== 'object') return false

  const code = (payload as TrackingConsentRequiredResponse).code
  return typeof code === 'string' && code.trim().toLowerCase() === TRACKING_CONSENT_REQUIRED_CODE
}

export function getTrackingConsentErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') {
    return sanitizeErrorMessage(fallback)
  }

  const candidate = payload as TrackingConsentRequiredResponse
  const rawMessage = candidate.error || candidate.message || fallback
  return sanitizeErrorMessage(rawMessage)
}
