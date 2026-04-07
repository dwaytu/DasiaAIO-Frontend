import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, FileSearch, Filter, Search } from 'lucide-react'
import type { User } from '../context/AuthContext'
import OperationalShell from './layout/OperationalShell'
import { getSidebarNav } from '../config/navigation'
import EmptyState from './shared/EmptyState'
import { AuditLogFilters, useAuditLogs } from '../hooks/useAuditLogs'
import { AuditAnomalyRecord, useAuditIntelligence, UserActivityResponse } from '../hooks/useAuditIntelligence'

interface AuditDashboardProps {
  user: User
  onLogout: () => void
  onViewChange: (view: string) => void
  activeView: string
}

const DEFAULT_FILTERS: AuditLogFilters = {
  page: 1,
  pageSize: 25,
}

const statusTone: Record<string, string> = {
  success: 'bg-success-bg text-success-text ring-1 ring-success-border',
  failed: 'bg-danger-bg text-danger-text ring-1 ring-danger-border',
}

const severityTone: Record<string, string> = {
  high: 'bg-danger-bg text-danger-text ring-1 ring-danger-border',
  medium: 'bg-warning-bg text-warning-text ring-1 ring-warning-border',
  low: 'bg-info-bg text-info-text ring-1 ring-info-border',
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

const inferSeverity = (log: { result: string; action_key: string }): 'high' | 'medium' | 'low' => {
  if (log.result === 'failed') return 'high'
  if (log.action_key.includes('delete') || log.action_key.includes('remove')) return 'medium'
  return 'low'
}

export default function AuditDashboard({ user, onLogout, onViewChange, activeView }: AuditDashboardProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [filters, setFilters] = useState<AuditLogFilters>({ ...DEFAULT_FILTERS })
  const [searchDraft, setSearchDraft] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [windowHours, setWindowHours] = useState<number>(24)
  const [selectedActorId, setSelectedActorId] = useState<string>('')
  const [userActivity, setUserActivity] = useState<UserActivityResponse | null>(null)
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)

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

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.status) count++
    if (filters.resourceType) count++
    if (dateFrom) count++
    if (dateTo) count++
    if (windowHours !== 24) count++
    return count
  }, [filters.status, filters.resourceType, dateFrom, dateTo, windowHours])

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

  const currentPage = meta?.page ?? 1

  const homeView = 'dashboard'
  const navItems = getSidebarNav(user.role, { homeView })

  return (
    <OperationalShell
      user={user}
      title="AUDIT"
      navItems={navItems}
      activeView={activeView}
      onNavigate={onViewChange}
      onLogout={onLogout}
      mobileMenuOpen={mobileMenuOpen}
      onMenuOpen={() => setMobileMenuOpen(true)}
      onMenuClose={() => setMobileMenuOpen(false)}
      onLogoClick={() => onViewChange(homeView)}
    >
    <section className="flex-1 p-4 md:p-8 overflow-y-auto w-full animate-fade-in motion-reduce:animate-none space-y-4" aria-labelledby="audit-intel-title">

      {/* Hero: Summary Stats */}
      <section className="command-panel" aria-label="Audit intelligence summary">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
          <div>
            <h2 id="audit-intel-title" className="soc-section-title">Audit Intelligence</h2>
            <p className="text-sm text-text-secondary max-w-3xl mt-1">
              Track every system decision with anomaly detection, timeline replay, and operational story reconstruction.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fetchLogs(filters).catch(() => undefined)}
              className="rounded border border-border bg-surface px-3 py-2 text-xs font-semibold text-text-primary hover:bg-surface-hover"
            >
              Refresh Logs
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="rounded border border-border-subtle bg-background px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-hover"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded border border-info-border bg-info-bg px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Total Events</p>
            <p className="text-2xl font-black text-text-primary">{summary.totalEvents}</p>
          </div>
          <div className="rounded border border-danger-border bg-danger-bg px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Failed Actions</p>
            <p className="text-2xl font-black text-text-primary">{summary.failedCount}</p>
          </div>
          <div className="rounded border border-warning-border bg-warning-bg px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Anomalies</p>
            <p className="text-2xl font-black text-text-primary">{summary.anomalyCount}</p>
          </div>
          <div className="rounded border border-success-border bg-success-bg px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Active Actors</p>
            <p className="text-2xl font-black text-text-primary">{summary.uniqueActors}</p>
          </div>
        </div>
      </section>

      {/* Search Bar */}
      <form onSubmit={applySearch} className="w-full" aria-label="Audit search">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-tertiary" aria-hidden="true" />
          <input
            id="audit-search"
            type="search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Search actions, resources, actors, IPs..."
            className="w-full rounded border border-border-subtle bg-surface pl-12 pr-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:ring-1 focus:ring-accent"
            aria-label="Search audit logs"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-accent px-4 py-1.5 text-xs font-semibold text-white hover:bg-accent/80"
          >
            Search
          </button>
        </div>
      </form>

      {/* Collapsible Filter Panel */}
      <div className="rounded border border-border-subtle bg-surface">
        <button
          type="button"
          onClick={() => setFiltersExpanded((prev) => !prev)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-text-primary hover:bg-surface-hover rounded"
          aria-expanded={filtersExpanded}
          aria-controls="audit-filter-panel"
        >
          <span className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ''}
          </span>
          {filtersExpanded
            ? <ChevronDown className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
            : <ChevronRight className="h-4 w-4 text-text-tertiary" aria-hidden="true" />}
        </button>

        {filtersExpanded && (
          <div id="audit-filter-panel" className="border-t border-border-subtle px-4 pb-4 pt-3">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5" role="group" aria-label="Audit filters">
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
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => updateFilters({ search: searchDraft.trim() || undefined, from: dateFrom || undefined, to: dateTo || undefined })}
                className="rounded bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent/80"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {(error || intelligenceError) ? (
        <div role="alert" className="rounded border border-danger-border bg-danger-bg/40 px-4 py-3 text-sm text-danger-text">
          {error || intelligenceError}
        </div>
      ) : null}

      {/* Main Content: Timeline + Sidebar */}
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">

        {/* Left: Log Timeline */}
        <div className="table-glass rounded p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="soc-section-title">Realtime Timeline</h3>
            <span className="text-xs text-text-tertiary">
              Page {currentPage} of {totalPages}
              {meta ? ` · ${meta.total} entries` : ''}
            </span>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block max-h-[480px] overflow-auto">
            <table className="w-full min-w-[820px] text-xs">
              <thead className="thead-glass sticky top-0 z-10">
                <tr className="border-b border-border-subtle text-text-tertiary">
                  <th className="px-2 py-2 text-left" scope="col">Timestamp</th>
                  <th className="px-2 py-2 text-left" scope="col">Actor</th>
                  <th className="px-2 py-2 text-left" scope="col">Action</th>
                  <th className="px-2 py-2 text-left" scope="col">Resource</th>
                  <th className="px-2 py-2 text-left" scope="col">Severity</th>
                  <th className="px-2 py-2 text-left" scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState icon={FileSearch} title="No audit entries found" subtitle="Audit trail will build as system events occur" />
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const isExpanded = expandedRowId === log.id
                    const severity = inferSeverity(log)
                    return (
                      <tr key={log.id} className="group" role="row">
                        <td colSpan={6} className="p-0">
                          <button
                            type="button"
                            className="grid w-full grid-cols-[1fr_1fr_1fr_1fr_0.7fr_0.7fr] border-b border-border-subtle/70 text-left hover:bg-surface-hover/40 cursor-pointer"
                            onClick={() => setExpandedRowId(isExpanded ? null : log.id)}
                            aria-expanded={isExpanded}
                            aria-controls={`audit-detail-${log.id}`}
                          >
                            <span className="px-2 py-2 text-text-primary">{formatDateTime(log.created_at)}</span>
                            <span className="px-2 py-2 text-text-primary">
                              <span className="font-semibold">{log.actor_name || log.actor_email || 'System'}</span>
                              <span className="block text-text-tertiary">{log.actor_role || 'automated'}</span>
                            </span>
                            <span className="px-2 py-2 text-text-primary">
                              <span className="rounded border border-border-subtle bg-background px-2 py-0.5 font-mono">{log.action_key}</span>
                            </span>
                            <span className="px-2 py-2 text-text-primary">
                              <span className="capitalize">{log.entity_type}</span>
                              <span className="block text-text-tertiary">{log.entity_id || '—'}</span>
                            </span>
                            <span className="px-2 py-2">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${severityTone[severity]}`}>
                                {severity}
                              </span>
                            </span>
                            <span className="px-2 py-2">
                              <span className={`inline-flex rounded-full px-2 py-0.5 font-semibold uppercase ${statusTone[log.result] || 'bg-zinc-500/15 text-zinc-300 ring-1 ring-zinc-500/30'}`}>
                                {log.result}
                              </span>
                            </span>
                          </button>

                          {isExpanded && (
                            <div
                              id={`audit-detail-${log.id}`}
                              className="border-b border-border-subtle bg-surface-elevated px-4 py-3 animate-fade-in motion-reduce:animate-none"
                            >
                              <div className="grid gap-3 md:grid-cols-3 text-xs">
                                <div>
                                  <p className="text-text-tertiary font-semibold uppercase tracking-wide">Action Key</p>
                                  <p className="text-text-primary font-mono mt-0.5">{log.action_key}</p>
                                </div>
                                <div>
                                  <p className="text-text-tertiary font-semibold uppercase tracking-wide">Entity</p>
                                  <p className="text-text-primary mt-0.5">{log.entity_type} — {log.entity_id || 'n/a'}</p>
                                </div>
                                <div>
                                  <p className="text-text-tertiary font-semibold uppercase tracking-wide">Result</p>
                                  <p className="text-text-primary mt-0.5">{log.result}</p>
                                </div>
                                <div>
                                  <p className="text-text-tertiary font-semibold uppercase tracking-wide">Source IP</p>
                                  <p className="text-text-primary mt-0.5">{log.source_ip || 'n/a'}</p>
                                </div>
                                <div>
                                  <p className="text-text-tertiary font-semibold uppercase tracking-wide">User Agent</p>
                                  <p className="text-text-primary mt-0.5 break-all">{log.user_agent || 'unknown client'}</p>
                                </div>
                                <div>
                                  <p className="text-text-tertiary font-semibold uppercase tracking-wide">Reason</p>
                                  <p className="text-text-primary mt-0.5">{log.reason || '—'}</p>
                                </div>
                                <div>
                                  <p className="text-text-tertiary font-semibold uppercase tracking-wide">Actor ID</p>
                                  <p className="text-text-primary mt-0.5 font-mono">{log.actor_user_id || 'n/a'}</p>
                                </div>
                                <div>
                                  <p className="text-text-tertiary font-semibold uppercase tracking-wide">Actor Email</p>
                                  <p className="text-text-primary mt-0.5">{log.actor_email || 'n/a'}</p>
                                </div>
                                <div>
                                  <button
                                    type="button"
                                    className="mt-3 rounded-md border border-border-subtle bg-background px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-hover"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedActorId(log.actor_user_id || '')
                                    }}
                                  >
                                    Inspect Actor Activity
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-2">
            {logs.length === 0 && !loading ? (
              <EmptyState icon={FileSearch} title="No audit entries found" subtitle="Audit trail will build as system events occur" />
            ) : (
              logs.map((log) => {
                const isExpanded = expandedRowId === log.id
                const severity = inferSeverity(log)
                return (
                  <article
                    key={log.id}
                    className="rounded border border-border-subtle bg-surface-elevated p-3"
                  >
                    <button
                      type="button"
                      className="flex w-full items-start justify-between text-left"
                      onClick={() => setExpandedRowId(isExpanded ? null : log.id)}
                      aria-expanded={isExpanded}
                      aria-controls={`audit-card-detail-${log.id}`}
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-text-primary truncate">
                          {log.action_key}
                        </h4>
                        <p className="text-xs text-text-secondary mt-0.5">
                          {log.actor_name || log.actor_email || 'System'} · {formatDateTime(log.created_at)}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${severityTone[severity]}`}>
                            {severity}
                          </span>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${statusTone[log.result] || 'bg-zinc-500/15 text-zinc-300 ring-1 ring-zinc-500/30'}`}>
                            {log.result}
                          </span>
                          <span className="text-[11px] text-text-tertiary capitalize">{log.entity_type}</span>
                        </div>
                      </div>
                      {isExpanded
                        ? <ChevronDown className="ml-2 h-4 w-4 flex-shrink-0 text-text-tertiary" aria-hidden="true" />
                        : <ChevronRight className="ml-2 h-4 w-4 flex-shrink-0 text-text-tertiary" aria-hidden="true" />}
                    </button>

                    {isExpanded && (
                      <div id={`audit-card-detail-${log.id}`} className="mt-3 border-t border-border-subtle pt-3 space-y-2 text-xs animate-fade-in motion-reduce:animate-none">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-text-tertiary font-semibold uppercase tracking-wide">Entity ID</p>
                            <p className="text-text-primary mt-0.5">{log.entity_id || 'n/a'}</p>
                          </div>
                          <div>
                            <p className="text-text-tertiary font-semibold uppercase tracking-wide">Source IP</p>
                            <p className="text-text-primary mt-0.5">{log.source_ip || 'n/a'}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-text-tertiary font-semibold uppercase tracking-wide">User Agent</p>
                            <p className="text-text-primary mt-0.5 break-all">{truncate(log.user_agent || 'unknown', 80)}</p>
                          </div>
                          {log.reason && (
                            <div className="col-span-2">
                              <p className="text-text-tertiary font-semibold uppercase tracking-wide">Reason</p>
                              <p className="text-text-primary mt-0.5">{log.reason}</p>
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="rounded-md border border-border-subtle bg-background px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-hover"
                          onClick={() => setSelectedActorId(log.actor_user_id || '')}
                        >
                          Inspect Actor Activity
                        </button>
                      </div>
                    )}
                  </article>
                )
              })
            )}
          </div>

          {/* Pagination */}
          <nav className="flex items-center justify-between pt-2" aria-label="Audit log pagination">
            <button
              type="button"
              onClick={() => updateFilters({ page: Math.max(1, (filters.page || 1) - 1) })}
              disabled={(filters.page || 1) <= 1 || loading}
              className="rounded-md border border-border-subtle bg-background px-3 py-1.5 text-xs font-semibold text-text-secondary disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-xs text-text-secondary">
              Page <span className="font-bold text-text-primary">{currentPage}</span> of <span className="font-bold text-text-primary">{totalPages}</span>
            </span>
            <button
              type="button"
              onClick={() => updateFilters({ page: (filters.page || 1) + 1 })}
              disabled={!meta?.hasMore || loading}
              className="rounded-md border border-border-subtle bg-background px-3 py-1.5 text-xs font-semibold text-text-secondary disabled:opacity-50"
            >
              Next
            </button>
          </nav>
        </div>

        {/* Right: Sidebar */}
        <div className="space-y-4">
          <section className="rounded border border-border-subtle bg-surface-elevated p-4">
            <h3 className="soc-section-title">Anomaly Signals</h3>
            <ul className="mt-3 space-y-2 text-xs">
              {anomalies.length === 0 ? (
                <li className="text-text-tertiary">No anomalies detected in selected window.</li>
              ) : (
                anomalies.slice(0, 8).map((anomaly, index) => (
                  <li key={`${anomaly.type}-${index}`} className="rounded border border-border-subtle bg-background px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${severityTone[anomaly.severity] || severityTone.medium}`}>
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

          <section className="rounded border border-border-subtle bg-surface-elevated p-4">
            <h3 className="soc-section-title">Activity Heatmap (Hour of Day)</h3>
            <div className="mt-3 grid grid-cols-6 gap-1">
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
                    <div className="text-[11px] font-semibold text-white">{hour.toString().padStart(2, '0')}</div>
                    <div className="text-[11px] text-white/90">{count}</div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="rounded border border-border-subtle bg-surface-elevated p-4">
            <h3 className="soc-section-title">Operational Story View</h3>
            <ol className="mt-3 space-y-1 text-xs text-text-secondary">
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

      {/* Loading Indicator */}
      {(loading || intelligenceLoading) ? (
        <p className="text-xs text-text-tertiary" role="status" aria-live="polite">Refreshing intelligence streams...</p>
      ) : null}
    </section>
    </OperationalShell>
  )
}
