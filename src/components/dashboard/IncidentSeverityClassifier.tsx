import { FC, useMemo, useState } from 'react'
import { API_BASE_URL } from '../../config'
import { useOperationalEvent } from '../../context/OperationalEventContext'
import { fetchJsonOrThrow, getAuthHeaders } from '../../utils/api'
import type { Incident } from '../../hooks/useIncidents'
import { getOperatorFacingIncidentDescription } from '../../utils/incidentPresentation'

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
  critical: 'border-danger-border bg-danger-bg text-danger-text',
  high: 'border-warning-border bg-warning-bg text-warning-text',
  medium: 'border-warning-border bg-warning-bg text-warning-text',
  low: 'border-success-border bg-success-bg text-success-text',
}

const IncidentSeverityClassifier: FC<IncidentSeverityClassifierProps> = ({ incidents }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ClassifyResult | null>(null)
  const { selectEvent } = useOperationalEvent()

  const candidateIncident = useMemo(
    () => incidents.find((item) => item.status !== 'resolved') || incidents[0],
    [incidents],
  )

  const incidentDescription = useMemo(
    () => (candidateIncident ? getOperatorFacingIncidentDescription(candidateIncident) : ''),
    [candidateIncident],
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
            description: incidentDescription || candidateIncident.description,
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
  const tone = severityTone[severity] || 'border-border-subtle bg-surface-elevated text-text-primary'

  const focusIncident = () => {
    if (!candidateIncident) return
    selectEvent({
      id: candidateIncident.id,
      type: 'incident',
      title: candidateIncident.title,
      detail: incidentDescription || candidateIncident.location,
    })
  }

  return (
    <section className="command-panel rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)]" aria-label="Incident severity classifier">
      <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-text-primary">Incident Severity Classifier</p>
          <p className="font-mono text-[11px] text-text-secondary">Heuristic severity estimation — results are advisory, not authoritative</p>
        </div>
      </div>

      <div className="space-y-3 px-4 py-3">
        {candidateIncident ? (
          <>
            <p className="truncate font-mono text-xs text-text-primary">{candidateIncident.title}</p>
            <button
              type="button"
              onClick={runClassification}
              disabled={loading}
              className="soc-btn-primary min-h-11 rounded-md px-3 py-2 font-mono text-xs font-semibold uppercase tracking-wide disabled:opacity-60"
            >
              {loading ? 'Classifying...' : 'Run Classifier'}
            </button>
          </>
        ) : (
          <p className="font-mono text-xs text-text-secondary">No incidents available for classification.</p>
        )}

        {result && (
          <div className="space-y-1 rounded-md border border-border-subtle bg-surface-elevated px-3 py-2">
            <p className={`inline-flex rounded-full border px-2 py-0.5 font-mono text-[11px] uppercase ${tone}`}>
              Severity: {severity}
            </p>
            <p className="font-mono text-[11px] text-text-secondary">Risk level: {riskLevel || 'unknown'}</p>
            <p className="font-mono text-[11px] text-text-secondary">Confidence: {Math.round((result.confidence || 0) * 100)}%</p>
            <p className="font-mono text-[11px] text-text-secondary">Explanation: {result.explanation || 'No explanation returned.'}</p>
            {Array.isArray(result.suggestedActions) && result.suggestedActions.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">Recommended Actions:</p>
                <ul className="space-y-1 text-[11px] text-text-secondary">
                  {result.suggestedActions.slice(0, 3).map((action, i) => (
                    <li key={i} className="rounded-md border border-border-subtle bg-background px-2 py-1">
                      {action}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={focusIncident}
                    className="soc-btn min-h-11 px-3 py-2 font-mono text-[11px]"
                  >
                    Focus Incident
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="font-mono text-xs text-danger-text">
            {error}
          </p>
        )}
      </div>
    </section>
  )
}

export default IncidentSeverityClassifier
