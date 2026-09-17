import { useState, useEffect, FC } from 'react'
import { Award } from 'lucide-react'
import { API_BASE_URL } from '../config'
import OperationalShell from './layout/OperationalShell'
import EmptyState from './shared/EmptyState'
import LoadingSkeleton from './shared/LoadingSkeleton'
import type { User } from '../context/AuthContext'
import { getSidebarNav } from '../config/navigation'
import { logError } from '../utils/logger'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'
import { can } from '../utils/permissions'

interface Props {
  user: User
  onLogout: () => void
  onViewChange?: (view: string) => void
  activeView?: string
}

interface RankedGuard {
  rank: number
  guardId: string
  guardName: string
  overallScore: number
  meritRank: string
  onTimePercentage: number
  clientRating: number
}

interface MeritScore {
  guardId: string
  guardName: string
  overallScore: number
  rank: string
  attendanceScore: number
  punctualityScore: number
  clientRating: number
  stats: {
    totalShifts: number
    onTimeCount: number
    lateCount: number
    noShowCount: number
    evaluations: number
    averageRating: number
  }
}

interface Evaluation {
  id: string
  guardId: string
  rating: number
  comment: string
  evaluatorName: string
  evaluatorRole?: string
  createdAt: string
}

function buildScoreHistory(evals: Evaluation[]): { label: string; score: number }[] {
  const sorted = [...evals].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
  let sum = 0
  return sorted.map((e, i) => {
    sum += e.rating * 20
    return {
      label: new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      score: Math.round(sum / (i + 1)),
    }
  })
}

const RatingTrendChart: FC<{ evaluations: Evaluation[] }> = ({ evaluations }) => {
  if (evaluations.length < 2) return null
  const points = buildScoreHistory(evaluations)
  const W = 400, padX = 14, padY = 12, H = 80
  const xs = points.map((_, i) => padX + (i / (points.length - 1)) * (W - padX * 2))
  const ys = points.map(p => H - padY - (Math.min(p.score, 100) / 100) * (H - padY * 2))
  const polyline = xs.map((x, i) => `${x},${ys[i]}`).join(' ')
  const first = points[0]
  const last = points[points.length - 1]

  return (
    <section className="command-panel p-5 md:p-6">
      <h3 className="mb-3 text-lg font-bold text-text-primary">Guard Evaluation Trend</h3>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-20"
        role="img"
        aria-label={`Score trend from ${first.score} (${first.label}) to ${last.score} (${last.label})`}
      >
        {[0, 25, 50, 75, 100].map(v => {
          const y = H - padY - (v / 100) * (H - padY * 2)
          return (
            <line
              key={v}
              x1={padX}
              y1={y}
              x2={W - padX}
              y2={y}
              stroke="currentColor"
              strokeOpacity={0.1}
              strokeWidth={1}
            />
          )
        })}
        <polyline
          points={polyline}
          fill="none"
          stroke="#6366f1"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {xs.map((x, i) => (
          <circle key={i} cx={x} cy={ys[i]} r={3} fill="#6366f1" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-text-tertiary">
        <span>{first.label}: {first.score}</span>
        <span>{last.label}: {last.score}</span>
      </div>
    </section>
  )
}

const MeritScoreDashboard: FC<Props> = ({ user, onLogout, onViewChange, activeView }) => {
  const [rankings, setRankings] = useState<RankedGuard[]>([])
  const [selectedGuard, setSelectedGuard] = useState<MeritScore | null>(null)
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false)
  const [showEvaluationForm, setShowEvaluationForm] = useState<boolean>(false)
  const [evaluationStatus, setEvaluationStatus] = useState<string>('')
  const [submittingEvaluation, setSubmittingEvaluation] = useState<boolean>(false)
  const [evaluationData, setEvaluationData] = useState({
    rating: 5,
    comment: '',
  })

  const currentView = activeView || 'merit'
  const canEvaluate = can(user.role, 'manage_evaluations')

  useEffect(() => {
    const controller = new AbortController()
    void fetchRankings(controller.signal)
    return () => controller.abort()
  }, [])

  const fetchRankings = async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/api/merit/rankings/all`, {
        headers: getAuthHeaders(),
        signal,
      })
      if (response.ok) {
        const data = await response.json()
        setRankings(data.rankings || [])
        setError('')
      } else {
        setError('Failed to load merit score rankings')
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError('Error loading merit scores. Make sure backend is running.')
      logError('Error fetching rankings:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchGuardDetails = async (guardId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/merit/${guardId}`, {
        headers: getAuthHeaders()
      })
      if (response.ok) {
        const data = await response.json()
        setSelectedGuard(data)
        await fetchEvaluations(guardId)
      }
    } catch (err) {
      logError('Error fetching guard details:', err)
    }
  }

  const fetchEvaluations = async (guardId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/merit/evaluations/${guardId}`, {
        headers: getAuthHeaders()
      })
      if (response.ok) {
        const data = await response.json()
        setEvaluations(data.evaluations || [])
      }
    } catch (err) {
      logError('Error fetching evaluations:', err)
    }
  }

  const handleSubmitEvaluation = async () => {
    if (!selectedGuard) return

    try {
      setSubmittingEvaluation(true)
      setEvaluationStatus('')
      await fetchJsonOrThrow(
        `${API_BASE_URL}/api/merit/evaluations/submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            guardId: selectedGuard.guardId,
            rating: evaluationData.rating,
            comment: evaluationData.comment,
          }),
        },
        'Failed to submit evaluation',
      )

      let successMessage = 'Evaluation saved and merit score recalculated.'
      try {
        await fetchJsonOrThrow(
          `${API_BASE_URL}/api/merit/calculate`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(),
            },
            body: JSON.stringify({ guardId: selectedGuard.guardId }),
          },
          'Merit recalculation failed',
        )
      } catch (recalculationError) {
        logError('Error recalculating merit score:', recalculationError)
        successMessage = 'Evaluation saved. Merit score will update after recalculation.'
      }

      setShowEvaluationForm(false)
      setEvaluationData({ rating: 5, comment: '' })
      setEvaluationStatus(successMessage)
      await fetchGuardDetails(selectedGuard.guardId)
      await fetchRankings()
    } catch (err) {
      logError('Error submitting evaluation:', err)
      setEvaluationStatus(err instanceof Error ? err.message : 'Failed to submit evaluation')
    } finally {
      setSubmittingEvaluation(false)
    }
  }

  const getMeritRankColor = (rank: string) => {
    switch (rank) {
      case 'Gold':
        return 'soc-status-warning'
      case 'Silver':
        return 'soc-status-neutral'
      case 'Bronze':
        return 'soc-status-danger'
      default:
        return 'soc-status-info'
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-success-text'
    if (score >= 80) return 'text-info-text'
    if (score >= 70) return 'text-warning-text'
    return 'text-danger-text'
  }

  return (
    <OperationalShell
      user={user}
      title="MERIT"
      navItems={getSidebarNav(user.role)}
      activeView={currentView}
      onNavigate={(view) => onViewChange?.(view)}
      onLogout={onLogout}
      mobileMenuOpen={mobileMenuOpen}
      onMenuOpen={() => setMobileMenuOpen(true)}
      onMenuClose={() => setMobileMenuOpen(false)}
      onLogoClick={() => onViewChange?.('dashboard')}
    >
        {loading ? (
          <div className="flex-1 p-4 md:p-8">
            <LoadingSkeleton variant="table" />
          </div>
        ) : (
          <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full animate-fade-in">
            <section className="soc-surface mb-6 p-4 md:p-5">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-tertiary">Merit Intelligence</p>
              <h1 className="text-2xl font-black uppercase tracking-wide text-text-primary">Guard Merit and Evaluation Center</h1>
              <p className="mt-1 text-sm text-text-secondary">Review rankings, inspect score drivers, and record guard evaluations.</p>
            </section>

            {error && (
              <div className="mb-4 soc-alert-error">
                {error}
              </div>
            )}

            {selectedGuard ? (
              // Guard Details View
              <div className="space-y-6">
                <button
                  onClick={() => setSelectedGuard(null)}
                  className="soc-btn soc-btn-neutral"
                >
                  ← Back to Rankings
                </button>

                <section className="command-panel p-6 md:p-8">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h2 className="text-3xl font-bold text-text-primary">{selectedGuard.guardName}</h2>
                      <p className="text-text-secondary">Guard ID: {selectedGuard.guardId}</p>
                    </div>
                    <span className={`px-4 py-2 rounded-full font-bold text-lg ${getMeritRankColor(selectedGuard.rank)}`}>
                      {selectedGuard.rank}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bento-card status-bar-info">
                      <p className="text-sm opacity-90">Overall Score</p>
                      <p className={`text-4xl font-bold ${getScoreColor(selectedGuard.overallScore)}`}>
                        {selectedGuard.overallScore.toFixed(1)}
                      </p>
                    </div>

                    <div className="bento-card status-bar-success">
                      <p className="text-sm opacity-90">Attendance</p>
                      <p className="text-3xl font-bold text-text-primary">{selectedGuard.attendanceScore.toFixed(1)}</p>
                    </div>

                    <div className="bento-card status-bar-info">
                      <p className="text-sm opacity-90">Punctuality</p>
                      <p className="text-3xl font-bold text-text-primary">{selectedGuard.punctualityScore.toFixed(1)}</p>
                    </div>

                    <div className="bento-card status-bar-warning">
                      <p className="text-sm opacity-90">Evaluator Rating</p>
                      <p className="text-3xl font-bold text-text-primary">{(selectedGuard.clientRating / 20).toFixed(1)}/5 ★</p>
                    </div>
                  </div>

                  {/* Performance Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8 command-panel p-6">
                    <div>
                      <p className="text-sm text-text-secondary">Total Shifts</p>
                      <p className="text-2xl font-bold text-text-primary">{selectedGuard.stats.totalShifts}</p>
                    </div>
                    <div>
                      <p className="text-sm text-text-secondary">On Time</p>
                      <p className="text-2xl font-bold text-success-text">{selectedGuard.stats.onTimeCount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-text-secondary">Late</p>
                      <p className="text-2xl font-bold text-warning-text">{selectedGuard.stats.lateCount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-text-secondary">No Shows</p>
                      <p className="text-2xl font-bold text-danger-text">{selectedGuard.stats.noShowCount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-text-secondary">Evaluations</p>
                      <p className="text-2xl font-bold text-info-text">{selectedGuard.stats.evaluations}</p>
                    </div>
                  </div>
                </section>

                <RatingTrendChart evaluations={evaluations} />

                {/* Evaluations Section */}
                <section className="command-panel p-6 md:p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold text-text-primary">Supervisor and Admin Evaluations</h3>
                    {canEvaluate ? (
                      <button
                        onClick={() => setShowEvaluationForm(!showEvaluationForm)}
                        className="soc-btn"
                      >
                        {showEvaluationForm ? 'Cancel' : '+ Add Evaluation'}
                      </button>
                    ) : (
                      <span className="text-sm text-text-tertiary">Read-only evaluation history</span>
                    )}
                  </div>

                  {evaluationStatus ? (
                    <div className="mb-4 rounded border border-info-border bg-info-bg px-3 py-2 text-sm text-info-text" role="status">
                      {evaluationStatus}
                    </div>
                  ) : null}

                  {showEvaluationForm && canEvaluate && (
                    <div className="mb-6 p-6 command-panel">
                      <div className="space-y-4">
                        <p className="text-sm text-text-secondary">Your supervisor or administrator identity is recorded with this evaluation.</p>

                        <div>
                          <label className="block text-sm font-semibold text-text-primary mb-2">Rating (1-5 stars)</label>
                          <select
                            value={evaluationData.rating}
                            onChange={(e) => setEvaluationData({ ...evaluationData, rating: parseInt(e.target.value) })}
                            className="w-full rounded border border-border bg-surface px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-info-border"
                          >
                            <option value="1">1 ★ Poor</option>
                            <option value="2">2 ★ Fair</option>
                            <option value="3">3 ★ Good</option>
                            <option value="4">4 ★ Very Good</option>
                            <option value="5">5 ★ Excellent</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-text-primary mb-2">Comments</label>
                          <textarea
                            value={evaluationData.comment}
                            onChange={(e) => setEvaluationData({ ...evaluationData, comment: e.target.value })}
                            placeholder="Add your feedback..."
                            rows={3}
                            maxLength={2000}
                            className="w-full rounded border border-border bg-surface px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-info-border"
                          />
                        </div>

                        <button
                          onClick={handleSubmitEvaluation}
                          disabled={submittingEvaluation}
                          className="w-full soc-btn disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {submittingEvaluation ? 'Submitting...' : 'Submit Evaluation'}
                        </button>
                      </div>
                    </div>
                  )}

                  {evaluations.length > 0 ? (
                    <div className="space-y-4">
                      {evaluations.map((evaluation) => (
                        <div key={evaluation.id} className="border-l-4 border-info pl-4 py-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold text-text-primary">{evaluation.evaluatorName}</p>
                              <p className="text-xs uppercase tracking-wide text-text-tertiary">
                                {evaluation.evaluatorRole || 'authorized evaluator'}
                              </p>
                              <p className="text-sm text-text-secondary">{new Date(evaluation.createdAt).toLocaleDateString()}</p>
                            </div>
                            <span className="text-lg font-bold text-warning">{'★'.repeat(Math.ceil(evaluation.rating))}</span>
                          </div>
                          {evaluation.comment && <p className="text-text-primary mt-2">{evaluation.comment}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-text-tertiary text-center py-4 italic">No evaluations yet</p>
                  )}
                </section>
              </div>
            ) : (
              // Rankings View
              <section className="table-glass rounded p-6 md:p-8">
                <h2 className="text-2xl font-bold text-text-primary mb-6">Guard Merit Score Rankings</h2>

                {rankings.length > 0 ? (
                  <div className="overflow-auto">
                    <table className="w-full border-collapse">
                      <thead className="thead-glass">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">
                            Rank
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">
                            Guard Name
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">
                            Overall Score
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">
                            Merit Rank
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">
                            Punctuality
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">
                            Evaluator Rating
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rankings.map((guard) => (
                          <tr key={guard.guardId} className="border-b border-border hover:bg-surface-hover">
                            <td className="px-4 py-3">
                              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-info text-(--color-primary-text) font-bold">
                                {guard.rank}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-text-primary font-medium">{guard.guardName}</td>
                            <td className="px-4 py-3">
                              <span className={`font-bold text-lg ${getScoreColor(guard.overallScore)}`}>
                                {guard.overallScore.toFixed(1)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getMeritRankColor(guard.meritRank)}`}>
                                {guard.meritRank}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-border rounded-full h-2 overflow-hidden">
                                  <div
                                    className="bg-info h-full transition-all duration-300"
                                    style={{ width: `${guard.onTimePercentage}%` }}
                                  ></div>
                                </div>
                                <span className="text-sm font-medium text-text-primary min-w-12">{guard.onTimePercentage.toFixed(0)}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center text-lg font-bold text-warning">
                              {(guard.clientRating / 20).toFixed(1)} ★
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => fetchGuardDetails(guard.guardId)}
                                className="soc-btn"
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState icon={Award} title="No eligible guards available" subtitle="Approved active guards will appear here so supervisors and administrators can submit evaluations" />
                )}
              </section>
            )}
          </div>
        )}
    </OperationalShell>
  )
}

export default MeritScoreDashboard

