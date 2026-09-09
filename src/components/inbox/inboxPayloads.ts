export function extractArrayPayload<T>(payload: unknown, keys: string[] = []): T[] {
  if (Array.isArray(payload)) {
    return payload as T[]
  }

  if (!payload || typeof payload !== 'object') {
    return []
  }

  const record = payload as Record<string, unknown>
  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) {
      return value as T[]
    }
  }

  return []
}

export async function fetchArrayPayload<T>(
  url: string,
  headers: HeadersInit,
  keys: string[] = [],
  signal?: AbortSignal,
): Promise<T[]> {
  try {
    const response = await fetch(url, { headers, signal })
    if (!response.ok) return []
    const payload: unknown = await response.json()
    return extractArrayPayload<T>(payload, keys)
  } catch {
    return []
  }
}

export async function fetchObjectPayload<T>(
  url: string,
  headers: HeadersInit,
  signal?: AbortSignal,
): Promise<T | null> {
  try {
    const response = await fetch(url, { headers, signal })
    if (!response.ok) return null
    const payload: unknown = await response.json()
    if (payload !== null && typeof payload === 'object' && !Array.isArray(payload)) {
      return payload as T
    }
    return null
  } catch {
    return null
  }
}
