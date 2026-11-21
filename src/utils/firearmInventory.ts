import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow } from './api'

interface Firearm {
  id: string
  serialNumber: string
  model: string
  status: string
}

interface FirearmPage {
  total?: number
  firearms?: Firearm[]
}

export async function loadFirearmInventory(headers: HeadersInit, signal?: AbortSignal): Promise<Firearm[]> {
  const firearms: Firearm[] = []

  for (let page = 1; ; page += 1) {
    const params = new URLSearchParams({ page: String(page), page_size: '200' })
    const response = await fetchJsonOrThrow<Firearm[] | FirearmPage>(
      `${API_BASE_URL}/api/firearms?${params}`,
      { headers, signal },
      'Unable to load firearm inventory',
    )
    const batch = Array.isArray(response) ? response : response.firearms ?? []
    firearms.push(...batch)
    if (Array.isArray(response) || response.total === undefined || firearms.length >= response.total) return firearms
    if (batch.length === 0) throw new Error('Firearm inventory changed while loading. Refresh and try again.')
  }
}
