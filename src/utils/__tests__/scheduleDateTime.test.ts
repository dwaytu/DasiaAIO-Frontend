import {
  localScheduleToUtc,
  toLocalDateInputValue,
  toLocalTimeInputValue,
} from '../scheduleDateTime'

describe('schedule date/time helpers', () => {
  it('converts local date and time inputs to RFC3339 UTC instants', () => {
    const result = localScheduleToUtc('2026-08-19', '08:30', '17:15')

    expect(result).toEqual({
      startTime: new Date('2026-08-19T08:30').toISOString(),
      endTime: new Date('2026-08-19T17:15').toISOString(),
    })
  })

  it('rolls an earlier end time into the next local day for overnight shifts', () => {
    const result = localScheduleToUtc('2026-08-19', '22:00', '06:00')
    const expectedEnd = new Date('2026-08-19T06:00')
    expectedEnd.setDate(expectedEnd.getDate() + 1)

    expect(result.startTime).toBe(new Date('2026-08-19T22:00').toISOString())
    expect(result.endTime).toBe(expectedEnd.toISOString())
    expect(new Date(result.endTime).getTime()).toBeGreaterThan(new Date(result.startTime).getTime())
  })

  it('treats equal start and end inputs as a 24-hour overnight shift', () => {
    const result = localScheduleToUtc('2026-08-19', '08:00', '08:00')

    expect(new Date(result.endTime).getTime() - new Date(result.startTime).getTime()).toBe(24 * 60 * 60 * 1000)
  })

  it('formats stored instants for local date and time inputs', () => {
    const localInstant = new Date(2026, 7, 19, 23, 5).toISOString()

    expect(toLocalDateInputValue(localInstant)).toBe('2026-08-19')
    expect(toLocalTimeInputValue(localInstant)).toBe('23:05')
  })

  it('returns empty input values for invalid stored instants', () => {
    expect(toLocalDateInputValue('not-a-date')).toBe('')
    expect(toLocalTimeInputValue('not-a-date')).toBe('')
  })
})
