export interface AttendanceRecordLike {
  id: string
  shift_id: string
  check_in_time: string
  check_out_time?: string
  status: string
}

export interface ShiftIntervalLike {
  start_time: string
  end_time: string
}

export interface CheckedInAttendanceState {
  checkInStatus: Record<string, 'checked_in'>
  checkInTimes: Record<string, Date>
}

function isActiveAttendance(record: AttendanceRecordLike): boolean {
  return record.status.toLowerCase() === 'checked_in' && !record.check_out_time
}

export function findActiveAttendanceForShift<T extends AttendanceRecordLike>(
  attendance: T[],
  shiftId: string,
): T | undefined {
  return attendance.find((record) => record.shift_id === shiftId && isActiveAttendance(record))
}

export function deriveCheckedInAttendance(attendance: AttendanceRecordLike[]): CheckedInAttendanceState {
  const checkInStatus: Record<string, 'checked_in'> = {}
  const checkInTimes: Record<string, Date> = {}

  attendance.forEach((record) => {
    if (!isActiveAttendance(record) || checkInStatus[record.shift_id]) return

    checkInStatus[record.shift_id] = 'checked_in'

    const checkInTime = new Date(record.check_in_time)
    if (!Number.isNaN(checkInTime.getTime())) {
      checkInTimes[record.shift_id] = checkInTime
    }
  })

  return { checkInStatus, checkInTimes }
}

export function shiftsOverlappingLocalDay<T extends ShiftIntervalLike>(
  shifts: T[],
  referenceDate = new Date(),
): T[] {
  const dayStart = new Date(referenceDate)
  dayStart.setHours(0, 0, 0, 0)

  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  return shifts
    .filter((shift) => {
      const shiftStart = new Date(shift.start_time).getTime()
      const shiftEnd = new Date(shift.end_time).getTime()

      return (
        !Number.isNaN(shiftStart) &&
        !Number.isNaN(shiftEnd) &&
        shiftStart < dayEnd.getTime() &&
        shiftEnd > dayStart.getTime()
      )
    })
    .sort((left, right) => new Date(left.start_time).getTime() - new Date(right.start_time).getTime())
}
