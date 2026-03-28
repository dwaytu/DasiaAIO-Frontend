import { FormEvent, useEffect, useMemo, useState } from 'react'
import { AuditLogFilters, useAuditLogs } from '../hooks/useAuditLogs'
import { AuditAnomalyRecord, useAuditIntelligence, UserActivityResponse } from '../hooks/useAuditIntelligence'

const DEFAULT_FILTERS: AuditLogFilters = {
  page: 1,
  pageSize: 25,
}

const statusTone: Record<string, string> = {
  success: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30',
  failed: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30',
}

const severityTone: Record<string, string> = {
  high: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30',
  medium: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30',
  low: 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30',
}

const formatDateTime = (value?: string) => {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

const truncate = (value: string, max = 120) => {
  if (value.length <= max) return value
  return `${value.slice(0, max)}...`
}

export default function AuditDashboard() {
  const [filters, setFilters] = useState<AuditLogFilters>({ ...DEFAULT_FILTERS })
  const [searchDraft, setSearchDraft] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [windowHours, setWindowHours] = useState<number>(24)
  const [selectedActorId, setSelectedActorId] = useState<string>('')
  const [userActivity, setUserActivity] = useState<UserActivityResponse | null>(null)

  const { logs, meta, loading, error, fetchLogs } = useAuditLogs()
  const {
    loading: intelligenceLoading,
    error: intelligenceError,
    fetchAnomalies,
    fetchUserActivity,
  } = useAuditIntelligence()

  const [anomalies, setAnomalies] = useState<AuditAnomalyRecord[]>([])

  useEffect(() => {
    fetchLogs(filters).catch(() => undefined)
  }, [fetchLogs, filters])

  useEffect(() => {
    let disposed = false

    const loadAnomalies = async () => {
      try {
        const response = await fetchAnomalies(windowHours)
        if (!disposed) {
          setAnomalies(Array.isArray(response.anomalies) ? response.anomalies : [])
        }
      } catch {
        if (!disposed) {
          setAnomalies([])
        }
      }
    }

    void loadAnomalies()
    const intervalId = window.setInterval(() => {
      void loadAnomalies()
    }, 45000)

    return () => {
      disposed = true
      window.clearInterval(intervalId)
    }
  }, [fetchAnomalies, windowHours])

  useEffect(() => {
    if (!selectedActorId) {
      setUserActivity(null)
      return
    }

    let disposed = false

    const loadActivity = async () => {
      try {
        const response = await fetchUserActivity(selectedActorId, 72, 500)
        if (!disposed) {
          setUserActivity(response)
        }
      } catch {
        if (!disposed) {
          setUserActivity(null)
        }
      }
    }

    void loadActivity()

    return () => {
      disposed = true
    }
  }, [fetchUserActivity, selectedActorId])

  const summary = useMemo(() => {
    const failedCount = logs.filter((log) => log.result === 'failed').length
    const uniqueActors = new Set(logs.map((log) => log.actor_user_id).filter(Boolean)).size

    return {
      totalEvents: meta?.total ?? logs.length,
      failedCount,
      anomalyCount: anomalies.length,
      uniqueActors,
    }
  }, [anomalies.length, logs, meta?.total])

  const heatmapCells = useMemo(() => {
    const buckets = new Array(24).fill(0)

    if (userActivity?.heatmap?.length) {
      for (const cell of userActivity.heatmap) {
        if (cell.hour >= 0 && cell.hour <= 23) {
          buckets[cell.hour] = cell.count
        }
      }
      return buckets
    }

    for (const log of logs) {
      const date = new Date(log.created_at)
      if (!Number.isNaN(date.getTime())) {
        buckets[date.getHours()] += 1
      }
    }

    return buckets
  }, [logs, userActivity?.heatmap])

  const timeline = useMemo(() => {
    if (userActivity?.timeline?.length) {
      return userActivity.timeline.slice(-20).reverse()
    }

    return logs
      .slice(0, 20)
      .map((log) => ({
        id: log.id,
        actionType: log.action_key,
        resourceType: log.entity_type,
        resourceId: log.entity_id || undefined,
        status: log.result,
        reason: log.reason || undefined,
        timestamp: log.created_at,
      }))
  }, [logs, userActivity?.timeline])

  const operationalStory = useMemo(() => {
    return timeline.slice(0, 8).map((entry, index) => {
      const resource = entry.resourceId ? `${entry.resourceType} ${entry.resourceId}` : entry.resourceType
      const reason = entry.reason ? ` ${entry.reason}` : ''
      return `${index + 1}. ${formatDateTime(entry.timestamp)} - ${entry.actionType} on ${resource} (${entry.status}).${reason}`
    })
  }, [timeline])

  const updateFilters = (partial: Partial<AuditLogFilters>) => {
    setFilters((previous) => ({
      ...previous,
      ...partial,
      page: partial.page ?? 1,
    }))
  }

  const applySearch = (event: FormEvent) => {
    event.preventDefault()
    updateFilters({ search: searchDraft.trim() || undefined, from: dateFrom || undefined, to: dateTo || undefined })
  }

  const resetFilters = () => {
    setSearchDraft('')
    setDateFrom('')
    setDateTo('')
    setFilters({ ...DEFAULT_FILTERS })
    setSelectedActorId('')
    setUserActivity(null)
  }

  const totalPages = useMemo(() => {
    if (!meta || meta.pageSize === 0) return 1
    return Math.max(1, Math.ceil(meta.total / meta.pageSize))
  }, [meta])

  return (
    <section className="flex-1 p-4 md:p-8 overflow-y-auto w-full animate-fade-in" aria-labelledby="audit-intel-title">
      <div className="table-glass rounded-2xl p-6 md:p-8 flex flex-col gap-5">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs text-text-tertiary uppercase tracking-wider">Forensic Command Stream</p>
            <h2 id="audit-intel-title" className="text-2xl font-bold text-text-primary">Military-Grade Audit Trail Visualization</h2>
            <p className="text-sm text-text-secondary max-w-3xl mt-1">
              Track every system decision with anomaly detection, timeline replay, heatmap intensity, and operational story reconstruction.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fetchLogs(filters).catch(() => undefined)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-text-primary hover:bg-surface-hover"
            >
              Refresh Logs
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-lg border border-border-subtle bg-background px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-hover"
            >
              Reset
            </button>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="rounded-md border border-info-border bg-info-bg px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Total Events</p>
            <p className="text-xl font-black text-text-primary">{summary.totalEvents}</p>
          </div>
          <div className="rounded-md border border-danger-border bg-danger-bg px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Failed Actions</p>
            <p className="text-xl font-black text-text-primary">{summary.failedCount}</p>
          </div>
          <div className="rounded-md border border-warning-border bg-warning-bg px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Anomalies</p>
            <p className="text-xl font-black text-text-primary">{summary.anomalyCount}</p>
          </div>
          <div className="rounded-md border border-success-border bg-success-bg px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Active Actors</p>
            <p className="text-xl font-black text-text-primary">{summary.uniqueActors}</p>
          </div>
        </div>

        <form onSubmit={applySearch} className="grid gap-3 md:grid-cols-2 lg:grid-cols-6" aria-label="Audit intelligence filters">
          <label htmlFor="audit-search" className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Search
            <input
              id="audit-search"
              type="search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Action, resource, actor"
              className="rounded-md border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary"
            />
          </label>

          <label htmlFor="audit-status" className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Status
            <select
              id="audit-status"
              value={filters.status || 'all'}
              onChange={(event) => updateFilters({ status: event.target.value === 'all' ? undefined : event.target.value })}
              className="rounded-md border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary"
            >
              <option value="all">All</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
          </label>

          <label htmlFor="audit-resource" className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Resource
            <input
              id="audit-resource"
              type="text"
              value={filters.resourceType || ''}
              onChange={(event) => updateFilters({ resourceType: event.target.value || undefined })}
              placeholder="users, tracking, firearms"
              className="rounded-md border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary"
            />
          </label>

          <label htmlFor="audit-date-from" className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">
            From
            <input
              id="audit-date-from"
              type="datetime-local"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="rounded-md border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary"
            />
          </label>

          <label htmlFor="audit-date-to" className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">
            To
            <input
              id="audit-date-to"
              type="datetime-local"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="rounded-md border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary"
            />
          </label>

          <label htmlFor="audit-window" className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Anomaly Window
            <select
              id="audit-window"
              value={windowHours}
              onChange={(event) => setWindowHours(Number(event.target.value))}
              className="rounded-md border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary"
            >
              <option value={12}>Last 12h</option>
              <option value={24}>Last 24h</option>
              <option value={48}>Last 48h</option>
              <option value={72}>Last 72h</option>
            </select>
          </label>
        </form>

        {(error || intelligenceError) ? (
          <div role="alert" className="rounded-lg border border-danger-border bg-danger-bg/40 px-4 py-3 text-sm text-danger-text">
            {error || intelligenceError}
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <div className="rounded-lg border border-border-subtle bg-surface-elevated p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wide text-text-primary">Realtime Timeline</h3>
              <span className="text-xs text-text-tertiary">Page {meta?.page ?? 1} / {totalPages}</span>
            </div>

            <div className="max-h-[420px] overflow-auto">
              <table className="w-full min-w-[820px] text-xs">
                <thead>
                  <tr className="border-b border-border-subtle text-text-tertiary">
                    <th className="px-2 py-2 text-left">Timestamp</th>
                    <th className="px-2 py-2 text-left">Actor</th>
                    <th className="px-2 py-2 text-left">Action</th>
                    <th className="px-2 py-2 text-left">Resource</th>
                    <th className="px-2 py-2 text-left">Status</th>
                    <th className="px-2 py-2 text-left">Origin</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={6} className="px-2 py-8 text-center text-text-secondary">No audit records for selected filters.</td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="border-b border-border-subtle/70 hover:bg-surface-hover/40">
                        <td className="px-2 py-2 text-text-primary">{formatDateTime(log.created_at)}</td>
                        <td className="px-2 py-2 text-text-primary">
                          <button
                            type="button"
                            className="text-left hover:text-info-text"
                            onClick={() => setSelectedActorId(log.actor_user_id || '')}
                          >
                            <div className="font-semibold">{log.actor_name || log.actor_email || 'System'}</div>
                            <div className="text-text-tertiary">{log.actor_role || 'automated'}</div>
                          </button>
                        </td>
                        <td className="px-2 py-2 text-text-primary">
                          <span className="rounded border border-border-subtle bg-background px-2 py-0.5 font-mono">{log.action_key}</span>
                        </td>
                        <td className="px-2 py-2 text-text-primary">
                          <div className="capitalize">{log.entity_type}</div>
                          <div className="text-text-tertiary">{log.entity_id || '—'}</div>
                        </td>
                        <td className="px-2 py-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 font-semibold uppercase ${statusTone[log.result] || 'bg-zinc-500/15 text-zinc-300 ring-1 ring-zinc-500/30'}`}>
                            {log.result}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-text-primary">
                          <div>{log.source_ip || 'n/a'}</div>
                          <div className="text-text-tertiary">{truncate(log.user_agent || 'unknown client', 40)}</div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => updateFilters({ page: Math.max(1, (filters.page || 1) - 1) })}
                disabled={(filters.page || 1) <= 1 || loading}
                className="rounded-md border border-border-subtle bg-background px-2 py-1 text-[11px] font-semibold text-text-secondary disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => updateFilters({ page: (filters.page || 1) + 1 })}
                disabled={!meta?.hasMore || loading}
                className="rounded-md border border-border-subtle bg-background px-2 py-1 text-[11px] font-semibold text-text-secondary disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <section className="rounded-lg border border-border-subtle bg-surface-elevated p-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-text-primary">Anomaly Signals</h3>
              <ul className="mt-2 space-y-1 text-xs">
                {anomalies.length === 0 ? (
                  <li className="text-text-tertiary">No anomalies detected in selected window.</li>
                ) : (
                  anomalies.slice(0, 8).map((anomaly, index) => (
                    <li key={`${anomaly.type}-${index}`} className="rounded-md border border-border-subtle bg-background px-2 py-1">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${severityTone[anomaly.severity] || severityTone.medium}`}>
                          {anomaly.severity}
                        </span>
                        <span className="font-semibold text-text-primary">{anomaly.type.replace(/_/g, ' ')}</span>
                      </div>
                      <p className="mt-1 text-text-secondary">
                        {anomaly.actorName ? `${anomaly.actorName} ` : ''}
                        {anomaly.sourceIp ? `(${anomaly.sourceIp}) ` : ''}
                        {anomaly.failedCount ? `${anomaly.failedCount} failed attempts` : ''}
                        {anomaly.eventTotal ? `${anomaly.eventTotal} events` : ''}
                        {anomaly.bucket ? ` @ ${formatDateTime(anomaly.bucket)}` : ''}
                      </p>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section className="rounded-lg border border-border-subtle bg-surface-elevated p-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-text-primary">Activity Heatmap (Hour of Day)</h3>
              <div className="mt-2 grid grid-cols-6 gap-1">
                {heatmapCells.map((count, hour) => {
                  const max = Math.max(...heatmapCells, 1)
                  const intensity = Math.max(0.15, count / max)
                  return (
                    <div
                      key={hour}
                      className="rounded border border-border-subtle px-1 py-1 text-center"
                      style={{ backgroundColor: `rgba(37, 99, 235, ${intensity.toFixed(2)})` }}
                      title={`${hour}:00 - ${count} events`}
                    >
                      <div className="text-[10px] font-semibold text-white">{hour.toString().padStart(2, '0')}</div>
                      <div className="text-[10px] text-white/90">{count}</div>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="rounded-lg border border-border-subtle bg-surface-elevated p-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-text-primary">Operational Story View</h3>
              <ol className="mt-2 space-y-1 text-xs text-text-secondary">
                {operationalStory.length === 0 ? (
                  <li>No story events available.</li>
                ) : (
                  operationalStory.map((storyLine) => (
                    <li key={storyLine} className="rounded-md border border-border-subtle bg-background px-2 py-1">{storyLine}</li>
                  ))
                )}
              </ol>
            </section>
          </div>
        </div>

        {(loading || intelligenceLoading) ? (
          <p className="text-xs text-text-tertiary" role="status" aria-live="polite">Refreshing intelligence streams...</p>
        ) : null}
      </div>
    </section>
  )
}
