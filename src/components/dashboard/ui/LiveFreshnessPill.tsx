import { FC, useEffect, useMemo, useState } from 'react'

interface LiveFreshnessPillProps {
  updatedAt?: number | null
  label?: string
  staleAfterMs?: number
  offlineAfterMs?: number
  className?: string
}

type FreshnessState = 'live' | 'stale' | 'offline'

const toneClass: Record<FreshnessState, string> = {
  live: 'border-success-border bg-success-bg text-success-text',
  stale: 'border-warning-border bg-warning-bg text-warning-text',
  offline: 'border-danger-border bg-danger-bg text-danger-text',
}

const stateLabel: Record<FreshnessState, string> = {
  live: 'Live',
  stale: 'Delayed',
  offline: 'Offline',
}

function toRelativeAgeLabel(ms: number): string {
  const safeMs = Math.max(ms, 0)
  const seconds = Math.round(safeMs / 1000)

  if (seconds < 60) {
    return `${seconds}s ago`
  }

  const minutes = Math.round(seconds / 60)
  if (minutes < 60) {
    return `${minutes}m ago`
  }

  const hours = Math.round(minutes / 60)
  return `${hours}h ago`
}

const LiveFreshnessPill: FC<LiveFreshnessPillProps> = ({
  updatedAt,
  label = 'Data stream',
  staleAfterMs = 45 * 1000,
  offlineAfterMs = 3 * 60 * 1000,
  className = '',
}) => {
  const [now, setNow] = useState<number>(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const { status, ageLabel } = useMemo(() => {
    if (!updatedAt) {
      return { status: 'offline' as FreshnessState, ageLabel: 'Awaiting sync' }
    }

    const ageMs = now - updatedAt

    if (ageMs <= staleAfterMs) {
      return { status: 'live' as FreshnessState, ageLabel: toRelativeAgeLabel(ageMs) }
    }

    if (ageMs <= offlineAfterMs) {
      return { status: 'stale' as FreshnessState, ageLabel: toRelativeAgeLabel(ageMs) }
    }

    return { status: 'offline' as FreshnessState, ageLabel: toRelativeAgeLabel(ageMs) }
  }, [now, offlineAfterMs, staleAfterMs, updatedAt])

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClass[status]} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-label={`${label} ${stateLabel[status]} ${ageLabel}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${status === 'live' ? 'animate-pulse' : ''}`} aria-hidden="true" />
      <span>{label}</span>
      <span className="opacity-90">{stateLabel[status]}</span>
      <span className="opacity-80">{ageLabel}</span>
    </span>
  )
}

export default LiveFreshnessPill
