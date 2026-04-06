import { API_BASE_URL } from '../config'
import { getApiErrorMessage } from './api'

export type SwapRequestsFeedState = 'ready' | 'unavailable' | 'stale'

export interface SwapRequestsFeedResult {
  feedState: SwapRequestsFeedState
  swapRequests: unknown[]
}

let swapRequestsFeedUnsupported = false

export function __resetSwapRequestsFeedSupportForTests(): void {
  swapRequestsFeedUnsupported = false
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export async function fetchSwapRequestsFeed(headers: HeadersInit): Promise<SwapRequestsFeedResult> {
  if (swapRequestsFeedUnsupported) {
    return {
      feedState: 'unavailable',
      swapRequests: [],
    }
  }

  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}/api/shifts/swap-requests`, { headers })
  } catch {
    return {
      feedState: 'unavailable',
      swapRequests: [],
    }
  }

  if (response.status === 404 || response.status === 501) {
    swapRequestsFeedUnsupported = true
    return {
      feedState: 'unavailable',
      swapRequests: [],
    }
  }

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, 'Unable to load shift swap requests.'))
  }

  const body = await parseJsonSafe(response)

  if (Array.isArray(body)) {
    return {
      feedState: 'ready',
      swapRequests: body,
    }
  }

  if (body && typeof body === 'object' && 'swapRequests' in body) {
    const swapRequests = (body as { swapRequests?: unknown }).swapRequests

    if (Array.isArray(swapRequests)) {
      return {
        feedState: 'ready',
        swapRequests,
      }
    }
  }

  return {
    feedState: 'stale',
    swapRequests: [],
  }
}