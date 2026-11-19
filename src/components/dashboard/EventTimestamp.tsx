interface EventTimestampProps {
  timestamp?: string
  label?: string
  showSeconds?: boolean
}

const dateAndTimeOptions: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}

const dateAndTime = new Intl.DateTimeFormat('en-US', dateAndTimeOptions)
const dateAndTimeWithSeconds = new Intl.DateTimeFormat('en-US', { ...dateAndTimeOptions, second: '2-digit' })

export default function EventTimestamp({ timestamp, label, showSeconds }: EventTimestampProps) {
  if (!timestamp) return null
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return null

  const formatter = showSeconds ? dateAndTimeWithSeconds : dateAndTime

  return (
    <time dateTime={date.toISOString()} className="ml-auto whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide opacity-90">
      {label && `${label} `}{formatter.format(date)}
    </time>
  )
}
