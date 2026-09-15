import { buildPerformanceCsv, resolveUnavailable, type PerformanceCsvRow } from '../../utils/analyticsPresentation'

describe('Phase 5 analytics presentation', () => {
  it('uses the reported unavailable count and safely derives a legacy fallback', () => {
    expect(resolveUnavailable(10, 4, 6)).toBe(6)
    expect(resolveUnavailable(10, 4)).toBe(6)
    expect(resolveUnavailable(2, 4)).toBe(0)
  })

  it('exports every guard performance metric as valid CSV', () => {
    const guards: PerformanceCsvRow[] = [{
        guardName: 'Dela Cruz, Juan',
        totalShifts: 5,
        attendedShifts: 4,
        attendanceRate: 80,
        lateCheckIns: 1,
        completedShifts: 4,
        noShows: 1,
        incidentReportsSubmitted: 2,
        averageClientRating: 4.5,
        evaluationCount: 2,
        meritScore: 87,
        replacementFrequency: 1,
      }]

    const csv = buildPerformanceCsv(guards)

    expect(csv).toContain('"Dela Cruz, Juan"')
    expect(csv).toContain('"Attendance Rate"')
    expect(csv).toContain('"Average Client Rating"')
    expect(csv).toContain('"Replacement Frequency"')
    expect(csv.split('\r\n')).toHaveLength(2)
  })
})
