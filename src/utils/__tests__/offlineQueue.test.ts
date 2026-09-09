import { areOfflineActionsEquivalent } from '../offlineQueue'

describe('offline action identity', () => {
  it('treats equivalent JSON bodies as duplicates regardless of object key order', () => {
    expect(
      areOfflineActionsEquivalent(
        { url: '/api/incidents', method: 'POST', body: { priority: 'high', title: 'A' } },
        { url: '/api/incidents', method: 'post', body: { title: 'A', priority: 'high' } },
      ),
    ).toBe(true)
  })

  it('keeps distinct actions sent to the same endpoint', () => {
    expect(
      areOfflineActionsEquivalent(
        { url: '/api/incidents', method: 'POST', body: { title: 'First' } },
        { url: '/api/incidents', method: 'POST', body: { title: 'Second' } },
      ),
    ).toBe(false)
  })

  it('does not merge actions with different methods or URLs', () => {
    expect(
      areOfflineActionsEquivalent(
        { url: '/api/incidents', method: 'POST', body: { title: 'Same' } },
        { url: '/api/incidents/1', method: 'POST', body: { title: 'Same' } },
      ),
    ).toBe(false)
  })
})
