import { FC, useEffect, useId, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import type { MetricReading } from '../../../hooks/useMetricHistory'

interface TrendHistory {
  readings: MetricReading[]
  formatValue: (value: number) => string
  explanation: string
}

interface MetricStatCardProps {
  label: string
  value: string
  tone?: 'guard' | 'vehicle' | 'mission' | 'maintenance' | 'analytics' | 'default'
  hint?: string
  trend?: 'up' | 'down' | 'flat'
  history?: TrendHistory
  meter?: {
    value: number
    max: number
    label?: string
  }
}

const toneClass = {
  default: 'status-bar-info',
  guard: 'status-bar-info tone-guard-surface',
  vehicle: 'status-bar-warning tone-vehicle-surface',
  mission: 'status-bar-info tone-mission-surface',
  maintenance: 'status-bar-critical tone-maintenance-surface',
  analytics: 'status-bar-info tone-analytics-surface',
}

const trendIndicator = {
  up: { symbol: '▲', className: 'text-sm text-success' },
  down: { symbol: '▼', className: 'text-sm text-danger' },
  flat: { symbol: '─', className: 'text-sm text-text-tertiary' },
}

const meterToneClass = {
  default: 'bg-info-border',
  guard: 'bg-success-border',
  vehicle: 'bg-warning-border',
  mission: 'bg-info-border',
  maintenance: 'bg-danger-border',
  analytics: 'bg-info-border',
}

const sparklineToneClass = {
  default: 'text-info',
  guard: 'text-success',
  vehicle: 'text-warning',
  mission: 'text-info',
  maintenance: 'text-danger',
  analytics: 'text-info',
}

const readingTime = new Intl.DateTimeFormat(undefined, {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit',
})

function TrendHistoryDetails({ label, history, color }: { label: string; history: TrendHistory; color: string }) {
  const descriptionId = useId()
  const detailsRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const { readings, formatValue, explanation } = history
  const lastIndex = readings.length - 1
  const activeIndex = selectedIndex ?? lastIndex
  const reading = readings[activeIndex]
  const values = readings.map(({ value }) => value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const points = lastIndex > 0 ? values.map((value, index) => ({
    x: (index / lastIndex) * 100,
    y: max === min ? 14 : 24 - ((value - min) / (max - min)) * 20,
  })) : []
  const sparkline = points.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const activePoint = points[activeIndex]

  useEffect(() => {
    if (!isOpen) return

    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !detailsRef.current?.contains(event.target)) setIsOpen(false)
    }

    document.addEventListener('keydown', dismissOnEscape)
    document.addEventListener('pointerdown', dismissOutside)
    return () => {
      document.removeEventListener('keydown', dismissOnEscape)
      document.removeEventListener('pointerdown', dismissOutside)
    }
  }, [isOpen])

  return (
    <div
      ref={detailsRef}
      className="relative ml-auto shrink-0"
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') {
          setSelectedIndex(null)
          setIsOpen(true)
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse' && !event.currentTarget.querySelector(':focus-visible')) setIsOpen(false)
      }}
    >
      <button
        type="button"
        className="flex min-h-11 min-w-11 items-center justify-center rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        aria-label={`${label} readings`}
        aria-describedby={descriptionId}
        onFocus={(event) => {
          if (event.currentTarget.matches(':focus-visible')) {
            setSelectedIndex(null)
            setIsOpen(true)
          }
        }}
        onBlur={() => setIsOpen(false)}
        onClick={() => {
          setSelectedIndex(null)
          setIsOpen(true)
        }}
        onKeyDown={(event) => {
          if (lastIndex < 1 || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
          event.preventDefault()
          const nextIndex = activeIndex + (event.key === 'ArrowLeft' ? -1 : 1)
          setSelectedIndex(Math.max(0, Math.min(lastIndex, nextIndex)))
          setIsOpen(true)
        }}
      >
        {lastIndex > 0 ? (
          <svg
            viewBox="0 0 100 28"
            className={`h-7 w-24 overflow-visible ${color}`}
            aria-hidden="true"
            onPointerMove={(event) => {
              if (event.pointerType !== 'mouse') return
              const bounds = event.currentTarget.getBoundingClientRect()
              const ratio = (event.clientX - bounds.left) / bounds.width
              setSelectedIndex(Math.max(0, Math.min(lastIndex, Math.round(ratio * lastIndex))))
            }}
          >
            <rect width="100" height="28" fill="transparent" />
            <polygon points={`0,28 ${sparkline} 100,28`} className="fill-current opacity-15" />
            <polyline points={sparkline} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {isOpen && activePoint && <circle cx={activePoint.x} cy={activePoint.y} r="3" fill="currentColor" />}
          </svg>
        ) : <Info className="size-4 text-text-secondary" aria-hidden="true" />}
      </button>
      <div id={descriptionId} role="tooltip" hidden={!isOpen} className="absolute right-0 top-full z-20 w-56 pt-1">
        <div className="space-y-1 rounded-md border border-border bg-surface-elevated p-3 text-left text-xs leading-relaxed shadow-lg">
          {reading ? (
            <div aria-live="polite">
              <p className="font-semibold text-text-primary">{formatValue(reading.value)}</p>
              <time className="text-text-secondary" dateTime={new Date(reading.checkedAt).toISOString()}>{readingTime.format(reading.checkedAt)}</time>
            </div>
          ) : <p className="font-semibold text-text-primary">Waiting for the first reading.</p>}
          <p className="text-text-secondary">{explanation}</p>
          <p className="text-text-secondary">Up to seven readings in this tab.</p>
        </div>
      </div>
    </div>
  )
}

const MetricStatCard: FC<MetricStatCardProps> = ({ label, value, tone = 'default', hint, trend, history, meter }) => {
  const meterRatio = meter && meter.max > 0
    ? Math.max(0, Math.min(100, (meter.value / meter.max) * 100))
    : 0

  return (
    <article className={`soc-dashboard-card ${toneClass[tone]}`}>
      <p className="soc-label">{label}</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
        <div className="flex items-end gap-2">
          <p className="text-[1.45rem] font-black leading-none text-text-primary">{value}</p>
          {trend ? (
            <span className={`${trendIndicator[trend].className}`} aria-label={`Trend ${trend}`}>
              {trendIndicator[trend].symbol}
            </span>
          ) : null}
        </div>
        {history ? (
          <TrendHistoryDetails label={label} history={history} color={sparklineToneClass[tone]} />
        ) : null}
      </div>
      {hint ? <p className="mt-2 text-[12px] text-text-secondary">{hint}</p> : null}
      {meter ? (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div
              className={`h-full rounded-full transition-[width] duration-300 ${meterToneClass[tone]}`}
              style={{ width: `${meterRatio}%` }}
              role="progressbar"
              aria-valuenow={Math.round(meterRatio)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${label} ratio ${Math.round(meterRatio)} percent`}
            />
          </div>
          {meter.label ? <p className="mt-2 text-[11px] text-text-tertiary">{meter.label}</p> : null}
        </div>
      ) : null}
    </article>
  )
}

export default MetricStatCard
