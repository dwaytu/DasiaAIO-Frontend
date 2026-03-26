import { FC, useState } from 'react'
import { normalizeRole } from '../../types/auth'
import { useIncidents } from '../../hooks/useIncidents'
import type { Incident } from '../../hooks/useIncidents'
import IncidentReportForm from './IncidentReportForm'
import { API_BASE_URL } from '../../config'
import { fetchJsonOrThrow } from '../../utils/api'

interface IncidentSummaryPreview {
  riskLevel: string
  confidence: number
  explanation: string
  suggestedActions: string[]
  summary: string
  keyPhrases: string[]
}

const PRIORITY_BADGE: Record<
  Incident['priority'],
  { label: string; cls: string }
> = {
  critical: { label: 'CRITICAL', cls: 'bg-red-500/20 text-red-300 border border-red-500/40' },
  high:     { label: 'HIGH',     cls: 'bg-orange-400/20 text-orange-300 border border-orange-400/40' },
  medium:   { label: 'MED',      cls: 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/40' },
  low:      { label: 'LOW',      cls: 'bg-green-500/20 text-green-300 border border-green-500/40' },
}

const STATUS_BADGE: Record<Incident['status'], string> = {
  open:          'bg-red-500/15 text-red-300 border border-red-500/30',
  investigating: 'bg-yellow-400/15 text-yellow-300 border border-yellow-400/30',
  resolved:      'bg-green-500/15 text-green-300 border border-green-500/30',
}

const NEXT_STATUSES: Record<Incident['status'], Incident['status'][]> = {
  open:          ['investigating', 'resolved'],
  investigating: ['resolved'],
  resolved:      [],
}

const IncidentPanel: FC = () => {
  const { incidents, activeCount, loading, error, lastUpdated, refresh, reportIncident, updateStatus } = useIncidents()
  const [showForm, setShowForm] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState('')
  const [summaryError, setSummaryError] = useState('')
  const [summarizingId, setSummarizingId] = useState<string | null>(null)
  const [summaryByIncidentId, setSummaryByIncidentId] = useState<Record<string, IncidentSummaryPreview>>({})
  const [filter, setFilter] = useState<'all' | Incident['status']>('all')

  const userRole = normalizeRole(localStorage.getItem('role'))
  const isSupervisorPlus =
    userRole === 'superadmin' || userRole === 'admin' || userRole === 'supervisor'

  const displayed = filter === 'all'
    ? incidents
    : incidents.filter((i) => i.status === filter)

  const handleStatusChange = async (id: string, status: Incident['status']) => {
    setUpdatingId(id)
    setUpdateError('')
    try {
      await updateStatus(id, status)
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleSummaryPreview = async (incident: Incident) => {
    try {
      setSummarizingId(incident.id)
      setSummaryError('')

      const token = localStorage.getItem('token')
      const response = await fetchJsonOrThrow<IncidentSummaryPreview>(
        `${API_BASE_URL}/api/ai/summarize-incident`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ description: incident.description }),
        },
        'Failed to generate incident summary',
      )

      setSummaryByIncidentId((prev) => ({
        ...prev,
        [incident.id]: {
          riskLevel: (response.riskLevel || '').toLowerCase(),
          confidence: typeof response.confidence === 'number' ? response.confidence : 0,
          explanation: response.explanation || 'No explanation returned.',
          suggestedActions: Array.isArray(response.suggestedActions) ? response.suggestedActions : [],
          summary: response.summary || 'No summary generated.',
          keyPhrases: Array.isArray(response.keyPhrases) ? response.keyPhrases : [],
        },
      }))
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Failed to generate incident summary')
    } finally {
      setSummarizingId(null)
    }
  }

  return (
    <section
      className="space-y-4"
      aria-label="Incident Management"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <svg
            aria-hidden="true"
            className="h-5 w-5 shrink-0 text-red-400"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
          <h2 className="font-mono text-base font-semibold uppercase tracking-wider text-[color:var(--color-text)]">
            Incident Management
          </h2>
          {activeCount > 0 && (
            <span className="rounded-full bg-red-500/20 px-2 py-0.5 font-mono text-xs font-bold text-red-300">
              {activeCount} active
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-[color:var(--color-muted-text)]">
            {lastUpdated ? `Updated ${lastUpdated}` : ''}
          </span>
          <button
            type="button"
            onClick={() => refresh()}
            aria-label="Refresh incidents"
            className="rounded border border-[color:var(--color-border)] px-2 py-1 font-mono text-xs text-[color:var(--color-muted-text)] hover:border-[color:var(--color-text)] hover:text-[color:var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)]"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            aria-expanded={showForm}
            className="rounded bg-red-600 px-3 py-1 font-mono text-xs font-semibold text-white hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
          >
            {showForm ? 'Cancel' : '+ Report Incident'}
          </button>
        </div>
      </div>

      {/* Report form */}
      {showForm && (
        <IncidentReportForm
          onSubmit={reportIncident}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Filter tabs */}
      <div className="flex gap-1" role="tablist" aria-label="Filter incidents by status">
        {(['all', 'open', 'investigating', 'resolved'] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={filter === s}
            onClick={() => setFilter(s)}
            className={`rounded-t px-3 py-1 font-mono text-xs font-semibold uppercase transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)] ${
              filter === s
                ? 'bg-[color:var(--color-border)] text-[color:var(--color-text)]'
                : 'text-[color:var(--color-muted-text)] hover:text-[color:var(--color-text)]'
            }`}
          >
            {s === 'all' ? 'All' : s}
          </button>
        ))}
      </div>

      {/* Status update error */}
      {updateError && (
        <p role="alert" className="font-mono text-xs text-red-400">
          {updateError}
        </p>
      )}

      {summaryError && (
        <p role="alert" className="font-mono text-xs text-amber-300">
          {summaryError}
        </p>
      )}

      {/* Table */}
      <div
        className="overflow-x-auto rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
        role="tabpanel"
        aria-label={`Incidents — ${filter}`}
      >
        {loading && (
          <p className="px-4 py-6 text-center font-mono text-xs text-[color:var(--color-muted-text)]">
            Loading incidents…
          </p>
        )}

        {!loading && error && (
          <p className="px-4 py-6 text-center font-mono text-xs text-amber-300" role="alert">
            {error}
          </p>
        )}

        {!loading && !error && displayed.length === 0 && (
          <p className="px-4 py-6 text-center font-mono text-xs text-[color:var(--color-muted-text)]">
            No incidents found.
          </p>
        )}

        {!loading && !error && displayed.length > 0 && (
          <table className="min-w-full text-left">
            <caption className="sr-only">Incident list filtered by: {filter}</caption>
            <thead>
              <tr className="border-b border-[color:var(--color-border)]">
                <th scope="col" className="px-4 py-2 font-mono text-xs font-semibold uppercase text-[color:var(--color-muted-text)]">
                  Title
                </th>
                <th scope="col" className="px-4 py-2 font-mono text-xs font-semibold uppercase text-[color:var(--color-muted-text)]">
                  Location
                </th>
                <th scope="col" className="px-4 py-2 font-mono text-xs font-semibold uppercase text-[color:var(--color-muted-text)]">
                  Priority
                </th>
                <th scope="col" className="px-4 py-2 font-mono text-xs font-semibold uppercase text-[color:var(--color-muted-text)]">
                  Status
                </th>
                <th scope="col" className="px-4 py-2 font-mono text-xs font-semibold uppercase text-[color:var(--color-muted-text)]">
                  Reported
                </th>
                {isSupervisorPlus && (
                  <th scope="col" className="px-4 py-2 font-mono text-xs font-semibold uppercase text-[color:var(--color-muted-text)]">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {displayed.map((incident) => {
                const pb = PRIORITY_BADGE[incident.priority]
                const sb = STATUS_BADGE[incident.status]
                const nextOpts = NEXT_STATUSES[incident.status]
                return (
                  <tr
                    key={incident.id}
                    className="border-b border-[color:var(--color-border)] last:border-0 hover:bg-[color:var(--color-border)]/30"
                  >
                    <td className="max-w-[200px] truncate px-4 py-2 font-mono text-xs text-[color:var(--color-text)]">
                      <div className="space-y-1">
                        <span title={incident.title}>{incident.title}</span>
                        <div>
                          <button
                            type="button"
                            onClick={() => handleSummaryPreview(incident)}
                            disabled={summarizingId === incident.id}
                            className="rounded border border-[color:var(--color-border)] px-2 py-0.5 font-mono text-[10px] text-[color:var(--color-muted-text)] hover:border-[color:var(--color-text)] hover:text-[color:var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {summarizingId === incident.id ? 'Generating summary…' : 'Preview AI Summary'}
                          </button>
                        </div>
                        {summaryByIncidentId[incident.id] && (
                          <div className="max-w-[380px] whitespace-normal rounded border border-[color:var(--color-border)] px-2 py-1 font-mono text-[10px] text-[color:var(--color-muted-text)]">
                            <p>{summaryByIncidentId[incident.id].summary}</p>
                            <p className="mt-1">Risk level: {summaryByIncidentId[incident.id].riskLevel || 'unknown'}</p>
                            <p className="mt-1">Confidence: {Math.round(summaryByIncidentId[incident.id].confidence * 100)}%</p>
                            <p className="mt-1">Explanation: {summaryByIncidentId[incident.id].explanation}</p>
                            <p className="mt-1">
                              Suggested actions: {summaryByIncidentId[incident.id].suggestedActions.slice(0, 2).join(' | ') || 'No actions suggested.'}
                            </p>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="max-w-[160px] truncate px-4 py-2 font-mono text-xs text-[color:var(--color-muted-text)]">
                      <span title={incident.location}>{incident.location}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${pb.cls}`}>
                        {pb.label}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${sb}`}>
                        {incident.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-[color:var(--color-muted-text)]">
                      {new Date(incident.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    {isSupervisorPlus && (
                      <td className="px-4 py-2">
                        {nextOpts.length > 0 ? (
                          <div className="flex gap-1">
                            {nextOpts.map((nextStatus) => (
                              <button
                                key={nextStatus}
                                type="button"
                                disabled={updatingId === incident.id}
                                onClick={() => handleStatusChange(incident.id, nextStatus)}
                                aria-label={`Mark incident "${incident.title}" as ${nextStatus}`}
                                className="rounded border border-[color:var(--color-border)] px-2 py-0.5 font-mono text-[10px] text-[color:var(--color-muted-text)] hover:border-[color:var(--color-text)] hover:text-[color:var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {updatingId === incident.id ? '…' : nextStatus}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="font-mono text-[10px] text-[color:var(--color-muted-text)]">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}

export default IncidentPanel
