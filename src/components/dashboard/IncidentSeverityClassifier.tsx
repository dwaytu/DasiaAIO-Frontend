import { FC, useMemo, useState } from 'react'
import { API_BASE_URL } from '../../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../../utils/api'
import type { Incident } from '../../hooks/useIncidents'

interface IncidentSeverityClassifierProps {
  incidents: Incident[]
}

interface ClassifyResult {
  riskLevel: string
  severity: string
  confidence: number
  explanation: string
  suggestedActions: string[]
}

const severityTone: Record<string, string> = {
  critical: 'border-red-500/40 bg-red-500/10 text-red-200',
  high: 'border-orange-400/40 bg-orange-500/10 text-orange-200',
  medium: 'border-amber-400/40 bg-amber-500/10 text-amber-200',
  low: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
}

const IncidentSeverityClassifier: FC<IncidentSeverityClassifierProps> = ({ incidents }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ClassifyResult | null>(null)

  const candidateIncident = useMemo(
    () => incidents.find((item) => item.status !== 'resolved') || incidents[0],
    [incidents],
  )

  const runClassification = async () => {
    if (!candidateIncident) return

    try {
      setLoading(true)
      setError('')

      const data = await fetchJsonOrThrow<ClassifyResult>(
        `${API_BASE_URL}/api/ai/classify-incident`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: candidateIncident.title,
            description: candidateIncident.description,
          }),
        },
        'Failed to classify incident severity',
      )

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to classify incident severity')
    } finally {
      setLoading(false)
    }
  }

  const severity = (result?.severity || '').toLowerCase()
  const riskLevel = (result?.riskLevel || severity || '').toLowerCase()
  const tone = severityTone[severity] || 'border-[color:var(--color-border)] text-[color:var(--color-text)]'

  return (
    <section className="command-panel rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)]" aria-label="Incident severity classifier">
      <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text)]">Incident Severity Classifier</p>
          <p className="font-mono text-[11px] text-[color:var(--color-muted-text)]">AI severity estimation for active incident flow</p>
        </div>
      </div>

      <div className="space-y-3 px-4 py-3">
        {candidateIncident ? (
          <>
            <p className="truncate font-mono text-xs text-[color:var(--color-text)]">{candidateIncident.title}</p>
            <button
              type="button"
              onClick={runClassification}
              disabled={loading}
              className="min-h-11 rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 font-mono text-xs font-semibold uppercase tracking-wide text-cyan-200 disabled:opacity-60"
            >
              {loading ? 'Classifying...' : 'Run Classifier'}
            </button>
          </>
        ) : (
          <p className="font-mono text-xs text-[color:var(--color-muted-text)]">No incidents available for classification.</p>
        )}

        {result && (
          <div className="space-y-1 rounded-md border border-[color:var(--color-border)]/60 bg-[color:var(--color-bg)]/30 px-3 py-2">
            <p className={`inline-flex rounded-full border px-2 py-0.5 font-mono text-[11px] uppercase ${tone}`}>
              Severity: {severity}
            </p>
            <p className="font-mono text-[11px] text-[color:var(--color-muted-text)]">Risk level: {riskLevel || 'unknown'}</p>
            <p className="font-mono text-[11px] text-[color:var(--color-muted-text)]">Confidence: {Math.round((result.confidence || 0) * 100)}%</p>
            <p className="font-mono text-[11px] text-[color:var(--color-muted-text)]">Explanation: {result.explanation || 'No explanation returned.'}</p>
            {Array.isArray(result.suggestedActions) && result.suggestedActions.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-muted-text)]">Recommended Actions:</p>
                <div className="flex flex-wrap gap-1">
                  {result.suggestedActions.slice(0, 3).map((action, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => alert(`Action: ${action}`)}
                      className="rounded border border-cyan-400/40 bg-cyan-500/10 px-2 py-1 font-mono text-[11px] text-cyan-200 transition-colors hover:bg-cyan-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
                      title={action}
                    >
                      {action.length > 40 ? action.slice(0, 40) + '\u2026' : action}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="font-mono text-xs text-red-400">
            {error}
          </p>
        )}
      </div>
    </section>
  )
}

export default IncidentSeverityClassifier