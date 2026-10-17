import { renderHook, act } from '@testing-library/react'
import { fetchJsonOrThrow } from '../../utils/api'
import { useAuditLogs } from '../useAuditLogs'

jest.mock('../../config', () => ({
  API_BASE_URL: 'http://localhost:5000',
}))

jest.mock('../../utils/api', () => ({
  fetchJsonOrThrow: jest.fn(),
  getAuthHeaders: jest.fn(() => ({})),
}))

const mockedFetchJsonOrThrow = fetchJsonOrThrow as jest.MockedFunction<typeof fetchJsonOrThrow>

describe('useAuditLogs', () => {
  beforeEach(() => {
    mockedFetchJsonOrThrow.mockResolvedValue({
      items: [],
      meta: { total: 0, page: 1, page_size: 25, has_more: false },
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('sends actor, source, and related-record filters to the audit API', async () => {
    const { result } = renderHook(() => useAuditLogs())

    await act(async () => {
      await result.current.fetchLogs({
        actorRole: 'guard',
        entityId: 'attendance-123',
        source: 'capstone_seed',
      })
    })

    const requestUrl = String(mockedFetchJsonOrThrow.mock.calls[0][0])
    expect(requestUrl).toContain('actor_role=guard')
    expect(requestUrl).toContain('entity_id=attendance-123')
    expect(requestUrl).toContain('source=capstone_seed')
  })
})
