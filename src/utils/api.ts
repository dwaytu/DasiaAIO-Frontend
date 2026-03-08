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
  return body.error || body.message || fallback
}

export async function fetchJsonOrThrow<T>(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  fallbackError: string,
  timeoutMs = 15000,
): Promise<T> {
  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetch(input, {
      ...init,
      signal: init?.signal ?? abortController.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`)
    }
    throw new Error(fallbackError)
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const message = await getApiErrorMessage(response, fallbackError)
    throw new Error(message)
  }

  return parseResponseBody(response) as Promise<T>
}
