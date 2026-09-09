import {
  deriveCheckedInAttendance,
  findActiveAttendanceForShift,
  shiftsOverlappingLocalDay,
} from '../attendanceUtils'

function localIso(year: number, monthIndex: number, day: number, hour: number, minute = 0): string {
  return new Date(year, monthIndex, day, hour, minute).toISOString()
}

describe('guard attendance helpers', () => {
  it('includes overnight shifts that overlap the local day', () => {
    const shifts = [
      {
        id: 'previous-overnight',
        start_time: localIso(2026, 7, 18, 22),
        end_time: localIso(2026, 7, 19, 6),
      },
      {
        id: 'today',
        start_time: localIso(2026, 7, 19, 8),
        end_time: localIso(2026, 7, 19, 17),
      },
      {
        id: 'tomorrow',
        start_time: localIso(2026, 7, 20, 8),
        end_time: localIso(2026, 7, 20, 17),
      },
    ]

    const result = shiftsOverlappingLocalDay(shifts, new Date(2026, 7, 19, 12))

    expect(result.map((shift) => shift.id)).toEqual(['previous-overnight', 'today'])
  })

  it('derives checked-in state and times only from active attendance', () => {
    const activeCheckIn = localIso(2026, 7, 19, 8, 5)
    const result = deriveCheckedInAttendance([
      {
        id: 'attendance-active',
        shift_id: 'shift-active',
        check_in_time: activeCheckIn,
        status: 'checked_in',
      },
      {
        id: 'attendance-complete',
        shift_id: 'shift-complete',
        check_in_time: localIso(2026, 7, 19, 7, 55),
        check_out_time: localIso(2026, 7, 19, 17),
        status: 'checked_out',
      },
    ])

    expect(result.checkInStatus).toEqual({ 'shift-active': 'checked_in' })
    expect(result.checkInTimes['shift-active'].toISOString()).toBe(activeCheckIn)
    expect(result.checkInTimes['shift-complete']).toBeUndefined()
  })

  it('selects active attendance only for the requested shift', () => {
    const attendance = [
      {
        id: 'attendance-other',
        shift_id: 'shift-other',
        check_in_time: localIso(2026, 7, 19, 9),
        status: 'checked_in',
      },
      {
        id: 'attendance-requested',
        shift_id: 'shift-requested',
        check_in_time: localIso(2026, 7, 19, 8),
        status: 'checked_in',
      },
    ]

    expect(findActiveAttendanceForShift(attendance, 'shift-requested')?.id).toBe('attendance-requested')
    expect(findActiveAttendanceForShift(attendance, 'missing')).toBeUndefined()
  })
})
