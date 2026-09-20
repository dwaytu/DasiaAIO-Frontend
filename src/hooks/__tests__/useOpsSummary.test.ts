import { renderHook, waitFor } from '@testing-library/react'
import { fetchJsonOrThrow } from '../../utils/api'
import { useOpsSummary } from '../useOpsSummary'

jest.mock('../useAuth', () => ({
  useAuth: () => ({ user: { role: 'admin' } }),
}))

jest.mock('../../config', () => ({
  API_BASE_URL: 'http://localhost:5000',
}))

jest.mock('../../utils/api', () => ({
  fetchJsonOrThrow: jest.fn(),
  getAuthHeaders: jest.fn(() => ({})),
}))

const mockedFetchJsonOrThrow = fetchJsonOrThrow as jest.MockedFunction<typeof fetchJsonOrThrow>

describe('useOpsSummary', () => {
  beforeEach(() => {
    mockedFetchJsonOrThrow.mockImplementation(async (url) => {
      const requestUrl = String(url)
      if (requestUrl.includes('/overdue')) {
        throw new Error('overdue source unavailable')
      }
      if (requestUrl.includes('/pending-approvals')) return { users: [] }
      if (requestUrl.endsWith('/api/guards')) return []
      return []
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('exposes degraded source state when a partial request fails', async () => {
    const { result } = renderHook(() => useOpsSummary())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.degraded).toBe(true)
    expect(result.current.degradedSources).toContain('overdue firearm returns')
    expect(result.current.error).toContain('Operational summary is incomplete')
  })
})
