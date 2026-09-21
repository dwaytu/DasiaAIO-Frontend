import { formatInboxTimestamp, getComplianceExpiryLabel } from '../inboxFormatting'

describe('inbox timestamp formatting', () => {
  const now = new Date('2026-09-21T12:00:00Z').getTime()

  it('uses readable recent and older notification timestamps', () => {
    expect(formatInboxTimestamp('2026-09-21T11:55:00Z', now)).toBe('5 min ago')
    expect(formatInboxTimestamp('2026-09-21T09:00:00Z', now)).toBe('3 hr ago')
    expect(formatInboxTimestamp('2026-09-20T12:00:00Z', now)).toBe('Yesterday')
    expect(formatInboxTimestamp('2026-05-03T12:00:00Z', now)).toMatch(/May 3, 2026/)
  })

  it('separates an expired compliance business date from notification creation time', () => {
    expect(getComplianceExpiryLabel('Guard license expired: Sam Guard', 'Sam Guard requires compliance attention. Expiry date: 2026-04-27.'))
      .toMatch(/Expired Apr 27, 2026/)
  })
})
