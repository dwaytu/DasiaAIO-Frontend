import { extractArrayPayload } from '../inboxPayloads'

describe('extractArrayPayload', () => {
  it('keeps legacy array payloads compatible', () => {
    expect(extractArrayPayload<{ id: string }>([{ id: 'one' }], ['items'])).toEqual([{ id: 'one' }])
  })

  it('extracts arrays from backend envelope payloads', () => {
    const payload = {
      total: 1,
      incidents: [{ id: 'incident-1' }],
    }

    expect(extractArrayPayload<{ id: string }>(payload, ['incidents'])).toEqual([{ id: 'incident-1' }])
  })

  it('returns an empty array for unsupported payload shapes', () => {
    expect(extractArrayPayload<{ id: string }>({ total: 0 }, ['items'])).toEqual([])
    expect(extractArrayPayload<{ id: string }>(null, ['items'])).toEqual([])
  })
})
