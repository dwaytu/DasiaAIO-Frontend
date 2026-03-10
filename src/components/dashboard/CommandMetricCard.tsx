import { FC, ReactNode, useEffect, useMemo, useRef, useState } from 'react'

interface CommandMetricCardProps {
  label: string
  value: number | string
  tone?: 'neutral' | 'info' | 'warning' | 'danger' | 'success'
  hint?: string
  icon?: ReactNode
}

const toneStyles: Record<NonNullable<CommandMetricCardProps['tone']>, string> = {
  neutral: 'status-bar-info',
  info: 'status-bar-info border-info-border bg-info-bg text-info-text',
  warning: 'status-bar-warning border-warning-border bg-warning-bg text-warning-text',
  danger: 'critical-glow border-danger-border bg-danger-bg text-danger-text',
  success: 'status-bar-success border-success-border bg-success-bg text-success-text',
}

function toNumber(value: number | string): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value)
  return null
}

const CommandMetricCard: FC<CommandMetricCardProps> = ({ label, value, tone = 'neutral', hint, icon }) => {
  const numericTarget = useMemo(() => toNumber(value), [value])
  const [animatedValue, setAnimatedValue] = useState<number | null>(numericTarget)
  const animationFrame = useRef<number | null>(null)

  useEffect(() => {
    if (numericTarget === null) {
      setAnimatedValue(null)
      return
    }

    const start = performance.now()
    const initial = animatedValue ?? numericTarget
    const delta = numericTarget - initial
    const duration = 360

    if (delta === 0) {
      setAnimatedValue(numericTarget)
      return
    }

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setAnimatedValue(initial + delta * eased)
      if (progress < 1) {
        animationFrame.current = window.requestAnimationFrame(tick)
      }
    }

    animationFrame.current = window.requestAnimationFrame(tick)

    return () => {
      if (animationFrame.current !== null) {
        window.cancelAnimationFrame(animationFrame.current)
      }
    }
  }, [numericTarget])

  const display = numericTarget === null ? value : Math.round(animatedValue ?? numericTarget)

  return (
    <article className={`bento-card relative overflow-hidden border ${toneStyles[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">{label}</p>
          <p key={`${label}-${String(value)}`} className="mt-2 text-3xl font-black leading-none text-text-primary animate-fade-in">{display}</p>
        </div>
        {icon && <div className="shrink-0 rounded-md border border-border-subtle bg-surface-elevated p-2 text-current">{icon}</div>}
      </div>
      {hint && <p className="mt-2 text-xs font-medium uppercase tracking-wide text-text-secondary">{hint}</p>}
    </article>
  )
}

export default CommandMetricCard
