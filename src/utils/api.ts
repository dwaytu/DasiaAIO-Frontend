export async function parseResponseBody(response: Response): Promise<any> {
  const raw = await response.text()
  if (!raw) return {}

  try {
    return JSON.parse(raw)
  } catch {
    return { message: raw, error: raw }
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
): Promise<T> {
  const response = await fetch(input, init)
  if (!response.ok) {
    const message = await getApiErrorMessage(response, fallbackError)
    throw new Error(message)
  }

  return parseResponseBody(response) as Promise<T>
}
