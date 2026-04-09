import { FC, useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, Loader2, MessageSquareText, RefreshCcw, Star, Users } from 'lucide-react'
import { API_BASE_URL } from '../../config'
import { getApiErrorMessage, getAuthToken } from '../../utils/api'
import { sanitizeErrorMessage } from '../../utils/sanitize'
import { getSidebarNav } from '../../config/navigation'
import type { User } from '../../context/AuthContext'
import OperationalShell from '../layout/OperationalShell'
import EmptyState from '../shared/EmptyState'

type FeedbackRecord = {
  id: string
  user_id: string
  user_name: string
  user_role: string
  rating: number
  comments: string
  created_at: string
}

type FeedbackDashboardProps = {
  user: User
  onLogout: () => void
  onViewChange?: (view: string) => void
  activeView?: string
}

const STAR_VALUES = [1, 2, 3, 4, 5] as const

function formatDateTime(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown date'
  }

  return parsed.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function normalizeRoleLabel(value: string): string {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'superadmin') return 'Superadmin'
  if (normalized === 'supervisor') return 'Supervisor'
  if (normalized === 'admin') return 'Admin'
  if (normalized === 'guard') return 'Guard'
  return value || 'Unknown'
}

function roleBadgeTone(role: string): string {
  const normalized = role.trim().toLowerCase()

  if (normalized === 'superadmin') {
    return 'border-info-border bg-info-bg text-info-text'
  }

  if (normalized === 'admin') {
    return 'border-success-border bg-success-bg text-success-text'
  }

  if (normalized === 'supervisor') {
    return 'border-warning-border bg-warning-bg text-warning-text'
  }

  return 'border-border-subtle bg-surface-elevated text-text-secondary'
}

function RatingStars({ rating }: { rating: number }) {
  const safeRating = Math.max(0, Math.min(5, Math.round(rating)))

  return (
    <div className="inline-flex items-center gap-1" aria-label={`${safeRating} out of 5 stars`}>
      {STAR_VALUES.map((value) => (
        <Star
          key={value}
          className={`h-4 w-4 ${value <= safeRating ? 'fill-warning-text text-warning-text' : 'text-text-tertiary'}`}
          aria-hidden="true"
        />
      ))}
      <span className="ml-1 text-xs font-semibold text-text-secondary">{safeRating}/5</span>
    </div>
  )
}

const FeedbackDashboard: FC<FeedbackDashboardProps> = ({ user, onLogout, onViewChange, activeView }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [records, setRecords] = useState<FeedbackRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const currentView = activeView || 'feedback-dashboard'
  const navItems = useMemo(() => getSidebarNav(user.role, { homeView: 'dashboard' }), [user.role])

  const loadFeedback = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError('')

    try {
      const token = getAuthToken().trim()
      if (!token) {
        throw new Error('Session expired. Please log in again.')
      }

      const response = await fetch(`${API_BASE_URL}/api/feedback`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal,
      })

      if (!response.ok) {
        const message = await getApiErrorMessage(response, 'Unable to load feedback records.')
        throw new Error(message)
      }

      const payload = await response.json()
      const parsedRecords = Array.isArray(payload) ? payload : []
      setRecords(parsedRecords)
    } catch (fetchError) {
      if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
        return
      }

      setError(sanitizeErrorMessage(fetchError instanceof Error ? fetchError.message : 'Unable to load feedback records.'))
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadFeedback(controller.signal)

    return () => {
      controller.abort()
    }
  }, [loadFeedback])

  const totalSubmissions = records.length
  const averageRating = useMemo(() => {
    if (records.length === 0) {
      return 0
    }

    const total = records.reduce((sum, record) => {
      const safeRating = Number.isFinite(record.rating) ? Math.max(1, Math.min(5, record.rating)) : 0
      return sum + safeRating
    }, 0)

    return total / records.length
  }, [records])

  return (
    <OperationalShell
      user={user}
      title="FEEDBACK DASHBOARD"
      navItems={navItems}
      activeView={currentView}
      onNavigate={(view) => onViewChange?.(view)}
      onLogout={onLogout}
      mobileMenuOpen={mobileMenuOpen}
      onMenuOpen={() => setMobileMenuOpen(true)}
      onMenuClose={() => setMobileMenuOpen(false)}
      onLogoClick={() => onViewChange?.('dashboard')}
    >
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <header className="command-panel">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-full border border-border-subtle bg-surface-elevated p-2 text-text-secondary" aria-hidden="true">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h1 className="soc-section-title">Feedback Intelligence</h1>
                <p className="text-sm text-text-secondary">Monitor rating trends and comments submitted by field and command personnel.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                void loadFeedback()
              }}
              className="soc-btn inline-flex min-h-11 items-center gap-2 px-4 py-2"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2" aria-label="Feedback summary">
          <article className="rounded border border-border-subtle bg-surface-elevated p-4">
            <div className="flex items-center gap-2 text-text-secondary">
              <Star className="h-4 w-4" aria-hidden="true" />
              <p className="text-xs font-semibold uppercase tracking-wide">Average Rating</p>
            </div>
            <p className="mt-2 text-3xl font-bold text-text-primary">{averageRating.toFixed(1)}</p>
            <p className="text-xs text-text-secondary">Across all feedback submissions</p>
          </article>

          <article className="rounded border border-border-subtle bg-surface-elevated p-4">
            <div className="flex items-center gap-2 text-text-secondary">
              <Users className="h-4 w-4" aria-hidden="true" />
              <p className="text-xs font-semibold uppercase tracking-wide">Total Submissions</p>
            </div>
            <p className="mt-2 text-3xl font-bold text-text-primary">{totalSubmissions}</p>
            <p className="text-xs text-text-secondary">Collected responses</p>
          </article>
        </section>

        {loading ? (
          <section className="command-panel" aria-live="polite">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading feedback records...
            </div>
          </section>
        ) : null}

        {!loading && error ? (
          <section className="command-panel space-y-3" role="alert">
            <p className="rounded border border-danger-border bg-danger-bg p-3 text-sm text-danger-text">{error}</p>
            <div>
              <button
                type="button"
                onClick={() => {
                  void loadFeedback()
                }}
                className="soc-btn min-h-11 px-4 py-2"
              >
                Retry
              </button>
            </div>
          </section>
        ) : null}

        {!loading && !error && records.length === 0 ? (
          <section className="command-panel">
            <EmptyState
              icon={MessageSquareText}
              title="No feedback submissions yet"
              subtitle="Feedback entries will appear here after users submit ratings."
            />
          </section>
        ) : null}

        {!loading && !error && records.length > 0 ? (
          <section className="command-panel overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead className="bg-surface-elevated">
                  <tr>
                    <th className="border-b border-border px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">User</th>
                    <th className="border-b border-border px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Role</th>
                    <th className="border-b border-border px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Rating</th>
                    <th className="border-b border-border px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Comments</th>
                    <th className="border-b border-border px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="border-b border-border-subtle align-top last:border-b-0">
                      <td className="px-4 py-3 text-sm text-text-primary">{record.user_name || 'Unknown user'}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${roleBadgeTone(record.user_role)}`}>
                          {normalizeRoleLabel(record.user_role)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-primary">
                        <RatingStars rating={record.rating} />
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {record.comments?.trim() ? (
                          <p className="max-w-xl whitespace-pre-wrap">{record.comments.trim()}</p>
                        ) : (
                          <p className="italic text-text-tertiary">No comment provided.</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">{formatDateTime(record.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </section>
    </OperationalShell>
  )
}

export default FeedbackDashboard
