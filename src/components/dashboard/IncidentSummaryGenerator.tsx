import { FC, useMemo, useState } from 'react'
import { API_BASE_URL } from '../../config'
import { fetchJsonOrThrow } from '../../utils/api'
import type { Incident } from '../../hooks/useIncidents'

interface IncidentSummaryGeneratorProps {
  incidents: Incident[]
}

interface SummaryResult {
  summary: string
  keyPhrases: string[]
}

const IncidentSummaryGenerator: FC<IncidentSummaryGeneratorProps> = ({ incidents }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState('')
  const [keyPhrases, setKeyPhrases] = useState<string[]>([])

  const candidateIncident = useMemo(
    () => incidents.find((item) => item.status !== 'resolved') || incidents[0],
    [incidents],
  )

  const runSummary = async () => {
    if (!candidateIncident) return

    try {
      setLoading(true)
      setError('')
      const token = localStorage.getItem('token')

      const data = await fetchJsonOrThrow<SummaryResult>(
        `${API_BASE_URL}/api/ai/summarize-incident`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ description: candidateIncident.description }),
        },
        'Failed to generate incident summary',
      )

      setSummary(data?.summary || '')
      setKeyPhrases(Array.isArray(data?.keyPhrases) ? data.keyPhrases : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate incident summary')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="command-panel rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)]" aria-label="Incident summary generator">
      <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text)]">Incident Summary Generator</p>
          <p className="font-mono text-[10px] text-[color:var(--color-muted-text)]">AI brief for shift handoff and operator reports</p>
        </div>
      </div>

      <div className="space-y-3 px-4 py-3">
        {candidateIncident ? (
          <>
            <p className="truncate font-mono text-xs text-[color:var(--color-text)]">{candidateIncident.title}</p>
            <button
              type="button"
              onClick={runSummary}
              disabled={loading}
              className="rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-wide text-cyan-200 disabled:opacity-60"
            >
              {loading ? 'Summarizing...' : 'Generate Summary'}
            </button>
          </>
        ) : (
          <p className="font-mono text-xs text-[color:var(--color-muted-text)]">No incidents available for summarization.</p>
        )}

        {summary && (
          <div className="rounded-md border border-[color:var(--color-border)]/60 bg-[color:var(--color-bg)]/30 px-3 py-2">
            <p className="font-mono text-[11px] text-[color:var(--color-text)]">{summary}</p>
            {keyPhrases.length > 0 && (
              <p className="mt-1 font-mono text-[10px] text-[color:var(--color-muted-text)]">
                Key: {keyPhrases.slice(0, 4).join(', ')}
              </p>
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

export default IncidentSummaryGenerator