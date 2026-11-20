import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow, getAuthHeaders } from './api'

export function isTripInProgress(status: string | null | undefined): status is 'in_progress' | 'in_transit' | 'active' {
  return status === 'in_progress' || status === 'in_transit' || status === 'active'
}

export function saveTripStatus(tripId: string, status: 'in_progress' | 'completed', expectedStatus: string) {
  return fetchJsonOrThrow(`${API_BASE_URL}/api/trip-management/${encodeURIComponent(tripId)}/status`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ status, expected_status: expectedStatus }),
  }, 'Failed to update trip status')
}
