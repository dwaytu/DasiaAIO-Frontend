import { FC } from 'react'
import type { ReplacementSuggestion } from '../../hooks/useReplacementSuggestions'

interface ReplacementSuggestionPanelProps {
  postName?: string
  suggestions: ReplacementSuggestion[]
  loading?: boolean
  error?: string
  lastUpdated?: string
}

const availabilityClass: Record<string, string> = {
  available: 'border-success-border bg-success-bg text-success-text',
  unavailable: 'border-danger-border bg-danger-bg text-danger-text',
}

const getRecommendationReason = (item: ReplacementSuggestion): string => {
  if (!item.availability) return 'Candidate currently unavailable despite score profile.'
  if (!item.permitValid) return 'Permit check failed; candidate should not be deployed.'
  if (item.distanceKm <= 2) return 'Close proximity and strong reliability make this candidate deployable quickly.'
  return 'Balanced reliability and route distance support this replacement recommendation.'
}

const getSuggestedAction = (item: ReplacementSuggestion): string => {
  if (!item.availability) return 'Keep as reserve and continue searching for active alternatives.'
  if (!item.permitValid) return 'Request permit renewal verification before assignment.'
  return 'Contact this guard first for immediate replacement confirmation.'
}

const getRiskLevel = (item: ReplacementSuggestion): 'LOW' | 'MEDIUM' | 'HIGH' => {
  if (!item.availability || !item.permitValid) return 'HIGH'
  if (item.replacementScore < 80 || item.distanceKm > 8) return 'MEDIUM'
  return 'LOW'
}

const getConfidence = (item: ReplacementSuggestion): number => {
  const normalized = item.replacementScore > 1 ? item.replacementScore / 100 : item.replacementScore
  return Math.max(0.6, Math.min(0.97, normalized))
}

const ReplacementSuggestionPanel: FC<ReplacementSuggestionPanelProps> = ({
  postName,
  suggestions,
  loading = false,
  error = '',
  lastUpdated,
}) => {
  return (
    <section
      className="command-panel rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
      aria-label="Smart guard replacement suggestions"
    >
      <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text)]">Smart Guard Replacement</p>
          <p className="font-mono text-[11px] text-[color:var(--color-muted-text)]">
            {postName ? `Top recommendations for ${postName}` : 'Top recommendations for active post'}
          </p>
        </div>
        {lastUpdated && <span className="font-mono text-[11px] text-[color:var(--color-muted-text)]">{lastUpdated}</span>}
      </div>

      <div className="space-y-2 px-4 py-3" role="region" aria-live="polite">
        {loading && (
          <p className="text-center font-mono text-xs text-[color:var(--color-muted-text)]">Generating replacement recommendations...</p>
        )}

        {!loading && error && (
          <p role="alert" className="text-center font-mono text-xs text-danger-text">
            {error}
          </p>
        )}

        {!loading && !error && suggestions.length === 0 && (
          <p className="text-center font-mono text-xs text-[color:var(--color-muted-text)]">No replacement candidates found for this post.</p>
        )}

        {!loading && !error && suggestions.length > 0 && (
          <ol className="space-y-2" role="list">
            {suggestions.slice(0, 3).map((item, index) => {
              const badge = item.availability ? availabilityClass.available : availabilityClass.unavailable
              return (
                <li
                  key={`${item.guardId}-${item.generatedAt}-${index}`}
                  className="rounded-md border border-[color:var(--color-border)]/60 bg-[color:var(--color-bg)]/30 px-3 py-2 shadow-inner shadow-black/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm text-[color:var(--color-text)]">{item.guardName}</p>
                      <p className="font-mono text-[11px] text-[color:var(--color-muted-text)]">
                        Reliability {item.reliabilityScore.toFixed(1)} • Distance {item.distanceKm.toFixed(2)} km
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-base font-bold text-[color:var(--color-text)]">{item.replacementScore.toFixed(3)}</p>
                      <p className="font-mono text-[11px] text-[color:var(--color-muted-text)]">Replacement Score</p>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 font-mono text-[11px] ${badge}`}>
                      {item.availability ? 'Available' : 'Unavailable'}
                    </span>
                    <span className="inline-flex rounded-full border border-info-border bg-info-bg px-2 py-0.5 font-mono text-[11px] text-info-text">
                      Permit {item.permitValid ? 'Valid' : 'Invalid'}
                    </span>
                    <span className="inline-flex rounded-full border border-[color:var(--color-border)] px-2 py-0.5 font-mono text-[11px] text-[color:var(--color-muted-text)]">
                      Rank #{index + 1}
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-[11px] text-[color:var(--color-muted-text)]">Reason: {getRecommendationReason(item)}</p>
                  <p className="mt-1 font-mono text-[11px] text-[color:var(--color-muted-text)]">Risk level: {getRiskLevel(item)}</p>
                  <p className="mt-2 font-mono text-[11px] text-[color:var(--color-muted-text)]">Suggested action: {getSuggestedAction(item)}</p>
                  <p className="mt-1 font-mono text-[11px] text-[color:var(--color-muted-text)]">Confidence: {(getConfidence(item) * 100).toFixed(0)}%</p>
                  {index === 0 && item.availability && item.permitValid && (
                    <div className="mt-2 flex gap-1">
                      <button
                        type="button"
                        onClick={() => alert(`Assign ${item.guardName} as replacement`)}
                        className="rounded border border-success-border bg-success-bg px-2 py-1 font-mono text-[11px] font-semibold text-success-text transition-colors hover:bg-success-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-success)]"
                      >
                        Assign Now
                      </button>
                      <button
                        type="button"
                        onClick={() => alert(`Contact ${item.guardName} for confirmation`)}
                        className="rounded border border-info-border bg-info-bg px-2 py-1 font-mono text-[11px] text-info-text transition-colors hover:bg-info-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-info)]"
                      >
                        Contact Guard
                      </button>
                    </div>
                  )}
                  {index !== 0 && !item.availability && (
                    <div className="mt-2">
                      <span className="rounded border border-zinc-500/40 bg-zinc-500/10 px-2 py-1 font-mono text-[11px] text-zinc-400">
                        Unavailable — keep as reserve
                      </span>
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </section>
  )
}

export default ReplacementSuggestionPanel
