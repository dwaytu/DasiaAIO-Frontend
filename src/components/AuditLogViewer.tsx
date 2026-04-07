import { FormEvent, useEffect, useMemo, useState } from 'react'
import { AuditLogFilters, useAuditLogs } from '../hooks/useAuditLogs'

const BASE_FILTERS: AuditLogFilters = {
  page: 1,
  pageSize: 25,
}

const resultOptions = [
  { value: 'all', label: 'All results' },
  { value: 'success', label: 'Success only' },
  { value: 'failed', label: 'Failed only' },
]

const entityOptions = [
  { value: 'all', label: 'All entities' },
  { value: 'users', label: 'User management' },
  { value: 'firearms', label: 'Firearms' },
  { value: 'firearm-allocation', label: 'Firearm allocation' },
  { value: 'armored-cars', label: 'Armored cars' },
  { value: 'trips', label: 'Trips' },
  { value: 'permits', label: 'Permits' },
  { value: 'missions', label: 'Missions' },
  { value: 'support-tickets', label: 'Support tickets' },
  { value: 'tracking', label: 'Tracking' },
  { value: 'notifications', label: 'Notifications' },
]

const statusChips: Record<string, string> = {
  success: 'bg-success-bg text-success-text ring-1 ring-success-border',
  failed: 'bg-danger-bg text-danger-text ring-1 ring-danger-border',
}

const formatDateTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

const truncate = (value: string, max = 100) => {
  if (value.length <= max) return value
  return `${value.slice(0, max)}…`
}

export default function AuditLogViewer() {
  const [filters, setFilters] = useState<AuditLogFilters>({ ...BASE_FILTERS })
  const [searchDraft, setSearchDraft] = useState('')
  const { logs, meta, loading, error, fetchLogs } = useAuditLogs()

  useEffect(() => {
    fetchLogs(filters).catch(() => undefined)
  }, [fetchLogs, filters])

  const totalPages = useMemo(() => {
    if (!meta || meta.pageSize === 0) return 1
    return Math.max(1, Math.ceil(meta.total / meta.pageSize))
  }, [meta])

  const showingRange = useMemo(() => {
    if (!meta) return 'Ready to load audit events'
    const start = ((meta.page - 1) * meta.pageSize) + (logs.length ? 1 : 0)
    const end = (meta.page - 1) * meta.pageSize + logs.length
    return `Showing ${start || 0}-${end} of ${meta.total}`
  }, [logs.length, meta])

  const updateFilter = (partial: Partial<AuditLogFilters>) => {
    setFilters((prev) => ({ ...prev, ...partial }))
  }

  const applySearch = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = searchDraft.trim()
    updateFilter({ page: 1, search: trimmed || undefined })
  }

  const handleReset = () => {
    setSearchDraft('')
    setFilters({ ...BASE_FILTERS })
  }

  const handleRefresh = () => {
    fetchLogs(filters).catch(() => undefined)
  }

  const handlePageChange = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && (filters.page ?? 1) <= 1) {
      return
    }
    if (direction === 'next' && !meta?.hasMore) {
      return
    }
    setFilters((prev) => {
      const currentPage = prev.page ?? 1
      const nextPage = direction === 'prev' ? Math.max(1, currentPage - 1) : currentPage + 1
      return { ...prev, page: nextPage }
    })
  }

  return (
    <section className="flex-1 p-4 md:p-8 overflow-y-auto w-full animate-fade-in" aria-labelledby="audit-log-title">
      <div className="table-glass rounded p-6 md:p-8 flex flex-col gap-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs text-text-tertiary uppercase tracking-wider">Operations Oversight</p>
            <h2 id="audit-log-title" className="text-2xl font-bold text-text-primary">System Audit Log</h2>
            <p className="text-sm text-text-secondary max-w-2xl mt-1">
              Review every privileged action sent to the SENTINEL API. Each record captures who performed the action, what resource was touched,
              whether it succeeded, and contextual metadata for forensic review.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 rounded border border-border bg-surface px-3 py-2 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-60"
            >
              <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 12a9 9 0 10-3.2 6.9" />
                <path d="M21 3v6h-6" />
              </svg>
              Refresh
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded border border-border-subtle bg-background px-3 py-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-hover"
            >
              Reset filters
            </button>
          </div>
        </header>

        <form onSubmit={applySearch} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" aria-label="Audit log filters">
          <label htmlFor="audit-search" className="flex flex-col gap-2 text-sm font-semibold text-text-primary">
            Search events
            <div className="relative">
              <span className="sr-only">Search audit log</span>
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                id="audit-search"
                name="auditSearch"
                type="search"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Search by action, entity, or actor"
                className="w-full rounded border border-border bg-background py-2 pl-10 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </label>

          <label htmlFor="audit-result" className="flex flex-col gap-2 text-sm font-semibold text-text-primary">
            Result
            <select
              id="audit-result"
              name="auditResult"
              value={filters.result ?? 'all'}
              onChange={(event) => updateFilter({ page: 1, result: event.target.value === 'all' ? undefined : event.target.value })}
              className="rounded border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {resultOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label htmlFor="audit-entity-type" className="flex flex-col gap-2 text-sm font-semibold text-text-primary">
            Entity type
            <select
              id="audit-entity-type"
              name="auditEntityType"
              value={filters.entityType ?? 'all'}
              onChange={(event) => updateFilter({ page: 1, entityType: event.target.value === 'all' ? undefined : event.target.value })}
              className="rounded border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {entityOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label htmlFor="audit-page-size" className="block text-sm font-semibold text-text-primary mb-2">Page size</label>
              <select
                id="audit-page-size"
                name="auditPageSize"
                value={filters.pageSize ?? BASE_FILTERS.pageSize}
                onChange={(event) => updateFilter({ page: 1, pageSize: Number(event.target.value) })}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>{size} per page</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="self-center rounded border border-border bg-surface px-3 py-2 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-hover"
            >
              Apply search
            </button>
          </div>
        </form>

        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-text-tertiary" aria-live="polite">{showingRange}</p>
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span>Page {meta?.page ?? 1} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handlePageChange('prev')}
                disabled={(filters.page ?? 1) <= 1 || loading}
                className="rounded border border-border-subtle bg-background px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-hover disabled:opacity-60"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => handlePageChange('next')}
                disabled={!meta?.hasMore || loading}
                className="rounded border border-border-subtle bg-background px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-hover disabled:opacity-60"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div role="alert" className="rounded border border-danger-border bg-danger-bg/40 px-4 py-3 text-sm text-danger-text">
            {error}
          </div>
        )}

        <div className="relative">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded bg-background/70 text-sm font-semibold text-text-secondary" role="status" aria-live="polite">
              Loading audit events…
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full min-w-[900px]" aria-describedby="audit-log-title">
              <thead className="thead-glass">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">Timestamp</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">Actor</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">Action</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">Entity</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">Result</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-tertiary">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {logs.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-text-secondary">No audit events found for the selected filters.</td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-surface-hover/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-text-primary whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                      <td className="px-4 py-3 text-sm text-text-primary">
                        <div className="font-semibold text-text-primary">{log.actor_name || log.actor_email || 'System'}</div>
                        <div className="text-xs text-text-tertiary">{log.actor_role ? log.actor_role : 'Automated'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-primary">
                        <span className="font-mono text-xs tracking-tight text-text-secondary bg-background border border-border-subtle px-2 py-1 rounded">
                          {log.action_key}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-primary">
                        <div className="font-medium capitalize">{log.entity_type || 'unknown'}</div>
                        <div className="text-xs text-text-tertiary">{log.entity_id || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-primary">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${statusChips[log.result] || 'bg-zinc-500/15 text-zinc-300 ring-1 ring-zinc-500/30'}`}>
                          {log.result}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-primary">
                        <p className="text-sm text-text-secondary">{log.reason || 'No additional details recorded.'}</p>
                        {log.metadata ? (
                          <code className="mt-2 block w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-md bg-background px-2 py-1 text-xs text-text-tertiary">
                            {truncate(JSON.stringify(log.metadata))}
                          </code>
                        ) : (
                          <span className="mt-2 block text-xs text-text-tertiary">No metadata</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
