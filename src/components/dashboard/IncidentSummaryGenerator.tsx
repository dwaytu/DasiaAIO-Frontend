import { FC, useEffect, useMemo, useRef, useState } from 'react'
import { API_BASE_URL } from '../../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../../utils/api'
import type { Incident } from '../../hooks/useIncidents'

interface IncidentSummaryGeneratorProps {
  incidents: Incident[]
}

interface SummaryResult {
  riskLevel: string
  confidence: number
  explanation: string
  suggestedActions: string[]
  summary: string
  keyPhrases: string[]
}

const IncidentSummaryGenerator: FC<IncidentSummaryGeneratorProps> = ({ incidents }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [riskLevel, setRiskLevel] = useState('')
  const [confidence, setConfidence] = useState(0)
  const [explanation, setExplanation] = useState('')
  const [suggestedActions, setSuggestedActions] = useState<string[]>([])
  const [summary, setSummary] = useState('')
  const [keyPhrases, setKeyPhrases] = useState<string[]>([])
  const [copiedAction, setCopiedAction] = useState<string | null>(null)
  const [clipboardError, setClipboardError] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const resetCopyTimeoutRef = useRef<number | null>(null)

  const candidateIncident = useMemo(
    () => incidents.find((item) => item.status !== 'resolved') || incidents[0],
    [incidents],
  )

  const runSummary = async () => {
    if (!candidateIncident) return

    try {
      setLoading(true)
      setError('')
      setClipboardError('')
      setCopyStatus('')
      setCopiedAction(null)

      const data = await fetchJsonOrThrow<SummaryResult>(
        `${API_BASE_URL}/api/ai/summarize-incident`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ description: candidateIncident.description }),
        },
        'Failed to generate incident summary',
      )

      setSummary(data?.summary || '')
      setKeyPhrases(Array.isArray(data?.keyPhrases) ? data.keyPhrases : [])
      setRiskLevel((data?.riskLevel || '').toLowerCase())
      setConfidence(typeof data?.confidence === 'number' ? data.confidence : 0)
      setExplanation(data?.explanation || '')
      setSuggestedActions(Array.isArray(data?.suggestedActions) ? data.suggestedActions : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate incident summary')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    return () => {
      if (resetCopyTimeoutRef.current !== null) {
        window.clearTimeout(resetCopyTimeoutRef.current)
      }
    }
  }, [])

  const scheduleCopyFeedbackReset = () => {
    if (resetCopyTimeoutRef.current !== null) {
      window.clearTimeout(resetCopyTimeoutRef.current)
    }

    resetCopyTimeoutRef.current = window.setTimeout(() => {
      setCopiedAction(null)
      setCopyStatus('')
    }, 2200)
  }

  const buildReportSnippet = () => {
    const lines = [
      `Incident: ${candidateIncident?.title || 'Untitled incident'}`,
      `Risk level: ${riskLevel || 'unknown'}`,
      `Confidence: ${Math.round(confidence * 100)}%`,
      `Summary: ${summary}`,
    ]

    if (explanation) {
      lines.push(`Explanation: ${explanation}`)
    }

    if (keyPhrases.length > 0) {
      lines.push(`Key phrases: ${keyPhrases.join(', ')}`)
    }

    return lines.join('\n')
  }

  const handleRecommendedAction = async (action: string) => {
    if (!summary) return

    try {
      setClipboardError('')

      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API is unavailable')
      }

      const normalizedAction = action.toLowerCase()
      const shouldCopyReportSnippet = normalizedAction.includes('report') || normalizedAction.includes('include')
      const copyText = shouldCopyReportSnippet ? buildReportSnippet() : summary

      await navigator.clipboard.writeText(copyText)
      setCopiedAction(action)
      setCopyStatus('Copied to clipboard.')
      scheduleCopyFeedbackReset()
    } catch {
      setClipboardError('Unable to copy. Please copy the summary manually.')
    }
  }

  return (
    <section className="command-panel rounded border border-[color:var(--color-border)] bg-[color:var(--color-surface)]" aria-label="Incident summary generator">
      <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-text-primary">Incident Summary Generator</p>
          <p className="font-mono text-[11px] text-text-secondary">AI-assisted brief — review before including in official reports</p>
        </div>
      </div>

      <div className="space-y-3 px-4 py-3">
        {candidateIncident ? (
          <>
            <p className="truncate font-mono text-xs text-text-primary">{candidateIncident.title}</p>
            <button
              type="button"
              onClick={runSummary}
              disabled={loading}
              className="soc-btn-primary min-h-11 rounded px-3 py-2 font-mono text-xs font-semibold uppercase tracking-wide disabled:opacity-60"
            >
              {loading ? 'Summarizing...' : 'Generate Summary'}
            </button>
          </>
        ) : (
          <p className="font-mono text-xs text-text-secondary">No incidents available for summarization.</p>
        )}

        {summary && (
          <div className="rounded border border-border-subtle bg-surface-elevated px-3 py-2">
            <p className="font-mono text-[11px] text-text-primary">{summary}</p>
            <p className="mt-1 font-mono text-[11px] text-text-secondary">Risk level: {riskLevel || 'unknown'}</p>
            <p className="mt-1 font-mono text-[11px] text-text-secondary">Confidence: {Math.round(confidence * 100)}%</p>
            <p className="mt-1 font-mono text-[11px] text-text-secondary">Explanation: {explanation || 'No explanation returned.'}</p>
            {suggestedActions.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">Recommended Actions:</p>
                <div className="flex flex-wrap gap-1">
                  {suggestedActions.slice(0, 3).map((action, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => void handleRecommendedAction(action)}
                      className="rounded border border-info-border bg-info-bg px-2 py-1 font-mono text-[11px] text-info-text transition-colors hover:bg-info-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-focus-ring)]"
                      title={action}
                    >
                      {copiedAction === action
                        ? 'Copied \u2713'
                        : action.length > 40
                          ? action.slice(0, 40) + '\u2026'
                          : action}
                    </button>
                  ))}
                </div>
                {copyStatus && (
                  <p aria-live="polite" className="font-mono text-[11px] text-success-text">
                    {copyStatus}
                  </p>
                )}
                {clipboardError && (
                  <p role="alert" className="font-mono text-[11px] text-danger-text">
                    {clipboardError}
                  </p>
                )}
              </div>
            )}
            {keyPhrases.length > 0 && (
              <p className="mt-1 font-mono text-[11px] text-text-secondary">
                Key: {keyPhrases.slice(0, 4).join(', ')}
              </p>
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

export default IncidentSummaryGenerator