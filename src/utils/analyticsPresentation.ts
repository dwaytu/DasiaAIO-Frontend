export interface PerformanceCsvRow {
  guardName: string
  totalShifts: number
  attendedShifts: number
  attendanceRate: number
  lateCheckIns: number
  completedShifts: number
  noShows: number
  incidentReportsSubmitted: number
  averageClientRating: number
  evaluationCount: number
  meritScore: number
  replacementFrequency: number
}

export function resolveUnavailable(total: number, available: number, reported?: number): number {
  if (typeof reported === 'number' && Number.isFinite(reported)) {
    return Math.max(0, reported)
  }
  return Math.max(0, total - available)
}

function escapeCsv(value: string | number): string {
  const normalized = String(value).replace(/"/g, '""')
  return `"${normalized}"`
}

export function buildPerformanceCsv(guards: PerformanceCsvRow[]): string {
  const rows = [
    ['Guard', 'Attendance Rate', 'Attended Shifts', 'Total Shifts', 'Late Check-ins', 'Completed Shifts', 'No-shows', 'Incident Reports', 'Average Client Rating', 'Evaluation Count', 'Merit Score', 'Replacement Frequency'],
    ...guards.map((guard) => [
      guard.guardName,
      guard.attendanceRate,
      guard.attendedShifts,
      guard.totalShifts,
      guard.lateCheckIns,
      guard.completedShifts,
      guard.noShows,
      guard.incidentReportsSubmitted,
      guard.averageClientRating,
      guard.evaluationCount,
      guard.meritScore,
      guard.replacementFrequency,
    ]),
  ]

  return rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n')
}
