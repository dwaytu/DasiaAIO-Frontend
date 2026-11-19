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
  return 'Ranked by availability, reliability, and distance.'
}

const getSuggestedAction = (item: ReplacementSuggestion): string => {
  if (!item.availability) return 'Keep as reserve and continue searching for active alternatives.'
  return 'Confirm availability with the guard for unarmed coverage.'
}

const getRiskLevel = (item: ReplacementSuggestion): 'LOW' | 'MEDIUM' | 'HIGH' => {
  if (!item.availability) return 'HIGH'
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
      className="command-panel rounded border border-(--color-border) bg-(--color-surface)"
      aria-label="Smart guard replacement suggestions"
    >
      <div className="flex items-center justify-between border-b border-(--color-border) px-4 py-3">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-(--color-text)">Smart Guard Replacement</p>
          <p className="font-mono text-[11px] text-(--color-muted-text)">
            {postName ? `Unarmed coverage for ${postName}` : 'Unarmed coverage recommendations'}
          </p>
        </div>
        {lastUpdated && <span className="font-mono text-[11px] text-(--color-muted-text)">{lastUpdated}</span>}
      </div>

      <div className="space-y-2 px-4 py-3" role="region" aria-live="polite">
        {loading && (
          <p className="text-center font-mono text-xs text-(--color-muted-text)">Generating replacement recommendations...</p>
        )}

        {!loading && error && (
          <p role="alert" className="text-center font-mono text-xs text-danger-text">
            {error}
          </p>
        )}

        {!loading && !error && suggestions.length === 0 && (
          <p className="text-center font-mono text-xs text-(--color-muted-text)">No replacement candidates found for this post.</p>
        )}

        {!loading && !error && suggestions.length > 0 && (
          <ol className="space-y-2" role="list">
            {suggestions.slice(0, 3).map((item, index) => {
              const badge = item.availability ? availabilityClass.available : availabilityClass.unavailable
              return (
                <li
                  key={`${item.guardId}-${item.generatedAt}-${index}`}
                  className="rounded-md border border-(--color-border)/60 bg-(--color-bg)/30 px-3 py-2 shadow-inner shadow-black/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm text-(--color-text)">{item.guardName}</p>
                      <p className="font-mono text-[11px] text-(--color-muted-text)">
                        Reliability {item.reliabilityScore.toFixed(1)} • Distance {item.distanceKm.toFixed(2)} km
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-base font-bold text-(--color-text)">{item.replacementScore.toFixed(3)}</p>
                      <p className="font-mono text-[11px] text-(--color-muted-text)">Replacement Score</p>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 font-mono text-[11px] ${badge}`}>
                      {item.availability ? 'Available' : 'Unavailable'}
                    </span>
                    <span className="inline-flex rounded-full border border-(--color-border) px-2 py-0.5 font-mono text-[11px] text-(--color-muted-text)">
                      Rank #{index + 1}
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-[11px] text-(--color-muted-text)">Reason: {getRecommendationReason(item)}</p>
                  <p className="mt-1 font-mono text-[11px] text-(--color-muted-text)">Risk level: {getRiskLevel(item)}</p>
                  <p className="mt-2 font-mono text-[11px] text-(--color-muted-text)">Suggested action: {getSuggestedAction(item)}</p>
                  <p className="mt-1 font-mono text-[11px] text-(--color-muted-text)">Confidence: {(getConfidence(item) * 100).toFixed(0)}%</p>
                  {index !== 0 && !item.availability && (
                    <div className="mt-2">
                      <span className="soc-status-neutral">
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
