import { FC } from 'react'
import type { GuardReliability } from '../../hooks/useGuardReliability'

interface TopReliableGuardsPanelProps {
  guards: GuardReliability[]
  loading?: boolean
  error?: string
  lastUpdated?: string
}

const rankColors = ['bg-amber-500/20 text-amber-200', 'bg-slate-500/20 text-slate-200', 'bg-orange-500/20 text-orange-200']

const TopReliableGuardsPanel: FC<TopReliableGuardsPanelProps> = ({ guards, loading = false, error = '', lastUpdated }) => {
  return (
    <section
      className="command-panel rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
      aria-label="Top reliable guards"
    >
      <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[color:var(--color-text)]">Top Reliability</p>
          <p className="font-mono text-[10px] text-[color:var(--color-muted-text)]">Weighted attendance · mission · compliance</p>
        </div>
        {lastUpdated && <span className="font-mono text-[10px] text-[color:var(--color-muted-text)]">{lastUpdated}</span>}
      </div>

      <div className="px-4 py-3">
        {loading && (
          <p className="text-center font-mono text-xs text-[color:var(--color-muted-text)]">Calculating reliability...</p>
        )}

        {!loading && error && (
          <p role="alert" className="text-center font-mono text-xs text-red-400">
            {error}
          </p>
        )}

        {!loading && !error && guards.length === 0 && (
          <p className="text-center font-mono text-xs text-[color:var(--color-muted-text)]">No reliability data available.</p>
        )}

        {!loading && !error && guards.length > 0 && (
          <ol className="space-y-2" role="list">
            {guards.slice(0, 5).map((guard, index) => (
              <li
                key={guard.guardId}
                className="flex items-center justify-between rounded-lg border border-[color:var(--color-border)]/60 bg-[color:var(--color-bg)]/40 px-3 py-2 shadow-inner shadow-black/20"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--color-border)] font-mono text-sm font-bold ${rankColors[index] ?? 'text-[color:var(--color-text)]'}`}
                  >
                    {guard.rank}
                  </span>
                  <div>
                    <p className="font-mono text-sm text-[color:var(--color-text)]">{guard.guardName}</p>
                    <p className="font-mono text-[10px] text-[color:var(--color-muted-text)]">
                      Attend {guard.attendanceScore.toFixed(1)} • Mission {guard.missionPerformance.toFixed(1)} • Permits {guard.permitCompliance.toFixed(1)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono text-lg font-bold text-[color:var(--color-text)]">{Math.round(guard.reliabilityScore)}</p>
                  <p className="font-mono text-[10px] text-[color:var(--color-muted-text)]">Reliability</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}

export default TopReliableGuardsPanel
