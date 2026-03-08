import { fetchJsonOrThrow, getApiErrorMessage, parseResponseBody } from '../utils/api'

function mockResponse(body: string, ok = true): Response {
  return {
    ok,
    text: async () => body,
  } as Response
}

describe('api utils', () => {
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
    const previousFetch = (globalThis as any).fetch
    ;(globalThis as any).fetch = jest.fn().mockResolvedValue(
      mockResponse(JSON.stringify({ id: '123' }), true),
    )

    await expect(fetchJsonOrThrow<{ id: string }>('https://example.com', undefined, 'fallback')).resolves.toEqual({ id: '123' })

    ;(globalThis as any).fetch = previousFetch
  })

  it('fetchJsonOrThrow throws API error details on non-OK responses', async () => {
    const previousFetch = (globalThis as any).fetch
    ;(globalThis as any).fetch = jest.fn().mockResolvedValue(
      mockResponse(JSON.stringify({ error: 'bad request' }), false),
    )

    await expect(fetchJsonOrThrow('https://example.com', undefined, 'fallback')).rejects.toThrow('bad request')

    ;(globalThis as any).fetch = previousFetch
  })
})
