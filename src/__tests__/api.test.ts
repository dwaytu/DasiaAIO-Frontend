jest.mock('../config', () => ({
  API_BASE_URL: 'https://backend-production-0c47.up.railway.app',
}))

import {
  fetchJsonOrThrow,
  fetchWithTimeout,
  getApiErrorMessage,
  parseResponseBody,
} from '../utils/api'

function mockResponse(body: string, ok = true): Response {
  return {
    ok,
    text: async () => body,
  } as Response
}

function abortAwareFetch(): typeof fetch {
  return jest.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal
      const rejectForAbort = () => {
        reject(signal?.reason ?? new DOMException('The operation was aborted.', 'AbortError'))
      }

      if (signal?.aborted) {
        rejectForAbort()
      } else {
        signal?.addEventListener('abort', rejectForAbort, { once: true })
      }
    })
  }) as unknown as typeof fetch
}

describe('api utils', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('parseResponseBody parses JSON responses', async () => {
    const response = mockResponse(JSON.stringify({ ok: true }))

    await expect(parseResponseBody(response)).resolves.toEqual({ ok: true })
  })

  it('parseResponseBody provides fallback for non-JSON responses', async () => {
    const response = mockResponse('service unavailable')
    await expect(parseResponseBody(response)).resolves.toMatchObject({
      message: 'service unavailable',
      error: 'service unavailable',
    })
  })

  it('getApiErrorMessage returns fallback when response has no message', async () => {
    const response = mockResponse('{}', false)

    await expect(getApiErrorMessage(response, 'default error')).resolves.toBe('default error')
  })

  it('fetchJsonOrThrow returns parsed body for successful requests', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      mockResponse(JSON.stringify({ id: '123' }), true),
    ) as unknown as typeof fetch

    await expect(fetchJsonOrThrow<{ id: string }>('https://example.com', undefined, 'fallback')).resolves.toEqual({ id: '123' })
  })

  it('fetchJsonOrThrow throws API error details on non-OK responses', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      mockResponse(JSON.stringify({ error: 'bad request' }), false),
    ) as unknown as typeof fetch

    await expect(fetchJsonOrThrow('https://example.com', undefined, 'fallback')).rejects.toThrow('bad request')
  })

  it('fetchWithTimeout preserves caller cancellation and clears its timeout', async () => {
    jest.useFakeTimers()
    globalThis.fetch = abortAwareFetch()
    const callerController = new AbortController()
    const removeListenerSpy = jest.spyOn(callerController.signal, 'removeEventListener')

    const request = fetchWithTimeout(
      'https://example.com',
      { signal: callerController.signal },
      1_000,
    )
    callerController.abort()

    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    expect(jest.getTimerCount()).toBe(0)
    expect(removeListenerSpy).toHaveBeenCalledWith('abort', expect.any(Function))
  })

  it('fetchWithTimeout distinguishes its deadline from caller cancellation', async () => {
    jest.useFakeTimers()
    globalThis.fetch = abortAwareFetch()
    const callerController = new AbortController()

    const request = fetchWithTimeout(
      'https://example.com',
      { signal: callerController.signal },
      100,
    )
    const rejection = expect(request).rejects.toMatchObject({
      name: 'TimeoutError',
      message: 'Request timed out after 100ms',
    })

    await jest.advanceTimersByTimeAsync(100)
    await rejection

    expect(callerController.signal.aborted).toBe(false)
    expect(jest.getTimerCount()).toBe(0)
  })

  it('fetchJsonOrThrow forwards caller aborts without retrying', async () => {
    jest.useFakeTimers()
    const fetchMock = abortAwareFetch()
    globalThis.fetch = fetchMock
    const callerController = new AbortController()

    const request = fetchJsonOrThrow(
      'https://example.com',
      { signal: callerController.signal },
      'fallback',
      1_000,
    )
    callerController.abort()

    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(jest.getTimerCount()).toBe(0)
  })

  it('fetchJsonOrThrow still enforces a timeout when a caller signal exists', async () => {
    jest.useFakeTimers()
    globalThis.fetch = abortAwareFetch()
    const callerController = new AbortController()

    const request = fetchJsonOrThrow(
      'https://example.com',
      { method: 'POST', signal: callerController.signal },
      'fallback',
      100,
    )
    const rejection = expect(request).rejects.toMatchObject({
      name: 'TimeoutError',
      message: 'Request timed out after 100ms',
    })

    await jest.advanceTimersByTimeAsync(100)
    await rejection

    expect(callerController.signal.aborted).toBe(false)
    expect(jest.getTimerCount()).toBe(0)
  })
})
