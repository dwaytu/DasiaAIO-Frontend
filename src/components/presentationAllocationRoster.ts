import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'

interface RosterUser {
  id: string
  role: string
  full_name: string
  guard_code?: string | null
  license_number?: string | null
  license_expiry_date?: string | null
}

export async function loadLicensedPresentationGuards(signal?: AbortSignal) {
  const guards = new Map<string, { id: string; fullName: string; guardCode?: string | null; expiresAt: number }>()
  const now = Date.now()
  let fetched = 0
  for (let page = 1; ; page += 1) {
    const data = await fetchJsonOrThrow<{ users: RosterUser[]; total: number }>(
      `${API_BASE_URL}/api/users?page=${page}&page_size=200`,
      { method: 'GET', headers: getAuthHeaders(), signal },
      'Unable to load guard license records',
    )
    for (const user of data.users) {
      const expiresAt = Date.parse(user.license_expiry_date ?? '')
      if (user.role?.trim().toLowerCase() === 'guard' && user.license_number?.trim() && expiresAt > now) {
        guards.set(user.id, { id: user.id, fullName: user.full_name, guardCode: user.guard_code, expiresAt })
      }
    }
    fetched += data.users.length
    if (fetched >= data.total || data.users.length === 0) break
  }
  return [...guards.values()].sort((a, b) => a.fullName.localeCompare(b.fullName))
}
