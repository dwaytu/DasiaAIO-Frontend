import { fetchRoleInboxSummary } from '../roleInboxSummary'

jest.mock('../../../config', () => ({
  API_BASE_URL: 'https://backend.test.local',
}))

describe('fetchRoleInboxSummary admin endpoint usage', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => [],
    })) as unknown as typeof fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
    jest.clearAllMocks()
  })

  it('requests firearm allocations from /api/firearm-allocations and not /api/firearms/allocations', async () => {
    await fetchRoleInboxSummary('admin-user', 'admin')

    const requestedUrls = (global.fetch as unknown as jest.Mock).mock.calls.map((call) => String(call[0]))

    expect(requestedUrls.some((url: string) => url.includes('/api/firearm-allocations'))).toBe(true)
    expect(requestedUrls.some((url: string) => url.includes('/api/firearms/allocations'))).toBe(false)
  })
})
