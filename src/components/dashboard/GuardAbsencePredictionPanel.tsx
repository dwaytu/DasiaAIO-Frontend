import { FC } from 'react'
import type { GuardAbsencePrediction } from '../../hooks/useGuardAbsencePrediction'

interface GuardAbsencePredictionPanelProps {
  predictions: GuardAbsencePrediction[]
  loading?: boolean
  error?: string
  lastUpdated?: string
}

const riskPillClass: Record<string, string> = {
  LOW: 'border-green-500/40 bg-green-500/10 text-green-200',
  MEDIUM: 'border-amber-400/40 bg-amber-500/10 text-amber-200',
  HIGH: 'border-red-500/40 bg-red-500/10 text-red-200',
}

const riskRowClass: Record<string, string> = {
  LOW: 'border-l-2 border-green-500/60',
  MEDIUM: 'border-l-2 border-amber-400/60',
  HIGH: 'border-l-2 border-red-500/70',
}

const getRiskReason = (item: GuardAbsencePrediction): string => {
  if (item.previousAbsences >= 3) return 'Repeated recent absences are driving elevated risk.'
  if (item.lateCheckins >= 3) return 'Frequent late check-ins are trending upward.'
  if (item.recentLeaveRequests >= 2) return 'Multiple leave requests indicate availability volatility.'
  return 'Current behavior is within expected attendance thresholds.'
}

const getSuggestedAction = (item: GuardAbsencePrediction): string => {
  if (item.riskLevel === 'HIGH') return 'Prepare a backup guard assignment before shift start.'
  if (item.riskLevel === 'MEDIUM') return 'Send pre-shift confirmation and monitor check-in window.'
  return 'Maintain standard attendance monitoring.'
}

const getConfidence = (item: GuardAbsencePrediction): number => {
  const normalized = item.riskScore <= 1 ? item.riskScore : item.riskScore / 100
  return Math.max(0.55, Math.min(0.98, 0.55 + normalized * 0.4))
}

const GuardAbsencePredictionPanel: FC<GuardAbsencePredictionPanelProps> = ({
  predictions,
  loading = false,
  error = '',
  lastUpdated,
}) => {
  return (
    <section
      className="command-panel rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
      aria-label="Guard absence prediction"
    >
      <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-text)]">Guard Absence Prediction</p>
          <p className="font-mono text-[10px] text-[color:var(--color-muted-text)]">Deterministic risk scoring for upcoming shifts</p>
        </div>
        {lastUpdated && <span className="font-mono text-[10px] text-[color:var(--color-muted-text)]">{lastUpdated}</span>}
      </div>

      <div className="space-y-2 px-4 py-3" role="region" aria-live="polite">
        {loading && <p className="text-center font-mono text-xs text-[color:var(--color-muted-text)]">Calculating absence risk...</p>}

        {!loading && error && (
          <p role="alert" className="text-center font-mono text-xs text-red-400">
            {error}
          </p>
        )}

        {!loading && !error && predictions.length === 0 && (
          <p className="text-center font-mono text-xs text-[color:var(--color-muted-text)]">No upcoming guard shifts to score.</p>
        )}

        {!loading && !error && predictions.length > 0 && (
          <ul className="space-y-2" role="list">
            {predictions.slice(0, 8).map((item) => {
              const pillClass = riskPillClass[item.riskLevel] ?? riskPillClass.LOW
              const rowClass = riskRowClass[item.riskLevel] ?? riskRowClass.LOW
              return (
                <li
                  key={`${item.guardId}-${item.calculatedAt}`}
                  className={`rounded-md border border-[color:var(--color-border)]/60 bg-[color:var(--color-bg)]/30 px-3 py-2 shadow-inner shadow-black/20 ${rowClass}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm text-[color:var(--color-text)]">{item.guardName}</p>
                      <p className="font-mono text-[10px] text-[color:var(--color-muted-text)]">
                        Absences {item.previousAbsences} • Late {item.lateCheckins} • Leave {item.recentLeaveRequests}
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-[color:var(--color-muted-text)]">{getRiskReason(item)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-base font-bold text-[color:var(--color-text)]">{item.riskScore.toFixed(2)}</p>
                      <span className={`inline-flex rounded-full border px-2 py-[2px] font-mono text-[10px] font-semibold ${pillClass}`}>
                        {item.riskLevel}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 font-mono text-[10px] text-[color:var(--color-muted-text)]">Suggested action: {getSuggestedAction(item)}</p>
                  <p className="mt-1 font-mono text-[10px] text-[color:var(--color-muted-text)]">Confidence: {(getConfidence(item) * 100).toFixed(0)}%</p>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

export default GuardAbsencePredictionPanel
