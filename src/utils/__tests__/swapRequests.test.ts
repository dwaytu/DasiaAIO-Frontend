import { __resetSwapRequestsFeedSupportForTests, fetchSwapRequestsFeed } from '../swapRequests'

jest.mock('../../config', () => ({
  API_BASE_URL: 'https://backend.test.local',
}))

describe('fetchSwapRequestsFeed unsupported-route handling', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    __resetSwapRequestsFeedSupportForTests()
    jest.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('marks feed unavailable and skips repeated fetches after a 404 response', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
    })) as unknown as typeof fetch

    const first = await fetchSwapRequestsFeed({})
    const second = await fetchSwapRequestsFeed({})

    expect(first).toEqual({ feedState: 'unavailable', swapRequests: [] })
    expect(second).toEqual({ feedState: 'unavailable', swapRequests: [] })
    expect((global.fetch as unknown as jest.Mock).mock.calls).toHaveLength(1)
  })

  it('returns ready when swap requests payload is valid', async () => {
    const payload = { swapRequests: [{ id: 'swap-1' }] }
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => payload,
    })) as unknown as typeof fetch

    const result = await fetchSwapRequestsFeed({})

    expect(result.feedState).toBe('ready')
    expect(result.swapRequests).toEqual(payload.swapRequests)
  })
})
