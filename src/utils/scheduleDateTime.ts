export interface UtcScheduleRange {
  startTime: string
  endTime: string
}

function parseLocalDateTime(dateValue: string, timeValue: string, label: string): Date {
  const dateTime = new Date(`${dateValue}T${timeValue}`)

  if (Number.isNaN(dateTime.getTime())) {
    throw new Error(`${label} date and time are invalid.`)
  }

  return dateTime
}

export function localScheduleToUtc(
  dateValue: string,
  startTimeValue: string,
  endTimeValue: string,
): UtcScheduleRange {
  const start = parseLocalDateTime(dateValue, startTimeValue, 'Start')
  const end = parseLocalDateTime(dateValue, endTimeValue, 'End')

  if (end.getTime() <= start.getTime()) {
    end.setDate(end.getDate() + 1)
  }

  return {
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  }
}

function parseInstant(value: string): Date | null {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function padInputPart(value: number): string {
  return String(value).padStart(2, '0')
}

export function toLocalDateInputValue(value: string): string {
  const date = parseInstant(value)
  if (!date) return ''

  return [
    date.getFullYear(),
    padInputPart(date.getMonth() + 1),
    padInputPart(date.getDate()),
  ].join('-')
}

export function toLocalTimeInputValue(value: string): string {
  const date = parseInstant(value)
  if (!date) return ''

  return `${padInputPart(date.getHours())}:${padInputPart(date.getMinutes())}`
}
