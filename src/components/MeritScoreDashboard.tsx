import { useState, useEffect, FC } from 'react'
import { ArrowLeft, ArrowRight, Award, CalendarCheck2, ClipboardCheck, Clock3, Star, Trophy, Users } from 'lucide-react'
import { API_BASE_URL } from '../config'
import OperationalShell from './layout/OperationalShell'
import EmptyState from './shared/EmptyState'
import LoadingSkeleton from './shared/LoadingSkeleton'
import OperationalPageHeader from './shared/OperationalPageHeader'
import OperationalSummaryBand, { type OperationalSummaryItem } from './shared/OperationalSummaryBand'
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
    <section className="soc-surface p-5 md:p-6">
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-info-bg text-info-text">
          <Award className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <p className="soc-kicker">Evaluation history</p>
          <h3 className="text-lg font-bold text-text-primary">Score trend</h3>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-20 w-full text-info-text"
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
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {xs.map((x, i) => (
          <circle key={i} cx={x} cy={ys[i]} r={3} fill="currentColor" />
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
  const [detailError, setDetailError] = useState<string>('')
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
        setError('Unable to load merit rankings. Check your connection and try again.')
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError('Unable to load merit rankings. Check your connection and try again.')
      logError('Error fetching rankings:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchGuardDetails = async (guardId: string) => {
    try {
      setDetailError('')
      const response = await fetch(`${API_BASE_URL}/api/merit/${guardId}`, {
        headers: getAuthHeaders()
      })
      if (response.ok) {
        const data = await response.json()
        setSelectedGuard(data)
        await fetchEvaluations(guardId)
      } else {
        setDetailError('Unable to open this guard scorecard. Please try again.')
      }
    } catch (err) {
      setDetailError('Unable to open this guard scorecard. Please try again.')
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
      } else {
        setDetailError('The guard scorecard opened, but its evaluation history could not be loaded.')
      }
    } catch (err) {
      setDetailError('The guard scorecard opened, but its evaluation history could not be loaded.')
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
      setEvaluationStatus('Unable to submit the evaluation. Review the form and try again.')
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

  const getScoreTone = (score: number): OperationalSummaryItem['tone'] => {
    if (score >= 90) return 'success'
    if (score >= 80) return 'info'
    if (score >= 70) return 'warning'
    return 'danger'
  }

  const evaluatedRankings = rankings.filter((guard) => guard.meritRank.toLowerCase() !== 'not evaluated')
  const averageScore = evaluatedRankings.length > 0
    ? evaluatedRankings.reduce((total, guard) => total + guard.overallScore, 0) / evaluatedRankings.length
    : 0
  const rankingSummary: OperationalSummaryItem[] = [
    { label: 'Eligible guards', value: rankings.length, detail: 'Shown in the ranking register', tone: 'neutral', icon: Users },
    {
      label: 'Evaluated',
      value: evaluatedRankings.length,
      detail: rankings.length > 0 ? `${Math.round((evaluatedRankings.length / rankings.length) * 100)}% coverage` : 'No eligible guards yet',
      tone: 'success',
      icon: ClipboardCheck,
    },
    {
      label: 'Average score',
      value: evaluatedRankings.length > 0 ? averageScore.toFixed(1) : 'N/A',
      detail: 'Across evaluated guards',
      tone: evaluatedRankings.length > 0 ? getScoreTone(averageScore) : 'neutral',
      icon: Trophy,
    },
    {
      label: 'Awaiting evaluation',
      value: rankings.length - evaluatedRankings.length,
      detail: 'Needs supervisor or admin input',
      tone: rankings.length - evaluatedRankings.length > 0 ? 'warning' : 'success',
      icon: Clock3,
    },
  ]

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
          <LoadingSkeleton variant="table" />
        ) : (
          <div className="w-full animate-fade-in">
            <OperationalPageHeader
              eyebrow="Merit intelligence"
              title="Guard merit and evaluation"
              description="Scores combine attendance, punctuality, and submitted evaluator ratings. Higher scores reflect stronger recorded performance."
              icon={Award}
              status={<span className="soc-status-info">{rankings.length} eligible guard{rankings.length === 1 ? '' : 's'}</span>}
            />

            {error ? (
              <div className="mt-4 flex flex-col gap-3 soc-alert-error sm:flex-row sm:items-center sm:justify-between" role="alert">
                <span>{error}</span>
                <button type="button" className="soc-btn soc-btn-neutral min-h-11 w-full sm:w-auto" onClick={() => void fetchRankings()}>
                  Retry
                </button>
              </div>
            ) : null}

            {detailError ? (
              <div className="mt-4 soc-alert-warning" role="alert">{detailError}</div>
            ) : null}

            {selectedGuard ? (
              <div className="mt-6 space-y-6">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedGuard(null)
                    setDetailError('')
                  }}
                  className="soc-btn soc-btn-neutral min-h-11"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back to rankings
                </button>

                <section className="soc-surface overflow-hidden">
                  <div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-start sm:justify-between md:px-6">
                    <div className="min-w-0">
                      <p className="soc-kicker">Guard scorecard</p>
                      <h2 className="mt-1 break-words text-2xl font-black text-text-primary">{selectedGuard.guardName}</h2>
                      <p className="mt-1 text-sm text-text-secondary">Guard ID: {selectedGuard.guardId}</p>
                    </div>
                    <span className={`shrink-0 px-3 py-1.5 text-sm font-bold ${getMeritRankColor(selectedGuard.rank)}`}>
                      {selectedGuard.rank}
                    </span>
                  </div>
                  <OperationalSummaryBand
                    items={[
                      { label: 'Overall score', value: selectedGuard.overallScore.toFixed(1), detail: 'Current merit score', tone: getScoreTone(selectedGuard.overallScore), icon: Award },
                      { label: 'Attendance', value: selectedGuard.attendanceScore.toFixed(1), detail: 'Attendance contribution', tone: 'success', icon: CalendarCheck2 },
                      { label: 'Punctuality', value: selectedGuard.punctualityScore.toFixed(1), detail: 'Timekeeping contribution', tone: 'info', icon: Clock3 },
                      { label: 'Evaluator rating', value: `${(selectedGuard.clientRating / 20).toFixed(1)} / 5`, detail: 'Average submitted rating', tone: 'warning', icon: Star },
                    ]}
                  />
                </section>

                <section className="soc-surface overflow-hidden">
                  <div className="px-5 pt-5 md:px-6">
                    <p className="soc-kicker">Score drivers</p>
                    <h3 className="mt-1 text-lg font-bold text-text-primary">Performance activity</h3>
                  </div>
                  <OperationalSummaryBand
                    items={[
                      { label: 'Total shifts', value: selectedGuard.stats.totalShifts, detail: 'Recorded shifts', tone: 'neutral', icon: CalendarCheck2 },
                      { label: 'On time', value: selectedGuard.stats.onTimeCount, detail: 'On-time check-ins', tone: 'success', icon: Clock3 },
                      { label: 'Late', value: selectedGuard.stats.lateCount, detail: 'Late check-ins', tone: 'warning', icon: Clock3 },
                      { label: 'No shows', value: selectedGuard.stats.noShowCount, detail: 'Missed shifts', tone: 'danger', icon: Award },
                      { label: 'Evaluations', value: selectedGuard.stats.evaluations, detail: 'Recorded reviews', tone: 'info', icon: ClipboardCheck },
                    ]}
                  />
                </section>

                {evaluations.length >= 2 ? <RatingTrendChart evaluations={evaluations} /> : (
                  <section className="soc-surface p-5 md:p-6">
                    <p className="soc-kicker">Evaluation history</p>
                    <h3 className="mt-1 text-lg font-bold text-text-primary">Score trend</h3>
                    <p className="mt-2 text-sm text-text-secondary">
                      {evaluations.length === 0
                        ? 'No evaluations have been recorded for this guard yet.'
                        : 'One evaluation is recorded. A trend appears after the next evaluation.'}
                    </p>
                  </section>
                )}

                <section className="soc-surface p-5 md:p-6">
                  <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="soc-kicker">Recorded feedback</p>
                      <h3 className="mt-1 text-lg font-bold text-text-primary">Supervisor and admin evaluations</h3>
                    </div>
                    {canEvaluate ? (
                      <button
                        type="button"
                        onClick={() => setShowEvaluationForm((visible) => !visible)}
                        className="soc-btn min-h-11 w-full sm:w-auto"
                      >
                        {showEvaluationForm ? 'Cancel' : 'Add evaluation'}
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
                    <div className="mb-6 border border-border-subtle bg-surface p-4 md:p-5">
                      <div className="space-y-4">
                        <p className="text-sm text-text-secondary">Your supervisor or administrator identity is recorded with this evaluation.</p>

                        <div>
                          <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="merit-rating">Rating (1-5 stars)</label>
                          <select
                            id="merit-rating"
                            value={evaluationData.rating}
                            onChange={(event) => setEvaluationData({ ...evaluationData, rating: parseInt(event.target.value, 10) })}
                            className="w-full rounded border border-border bg-surface px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-info-border"
                          >
                            <option value="1">1 star - Poor</option>
                            <option value="2">2 stars - Fair</option>
                            <option value="3">3 stars - Good</option>
                            <option value="4">4 stars - Very good</option>
                            <option value="5">5 stars - Excellent</option>
                          </select>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-semibold text-text-primary" htmlFor="merit-comments">Comments <span className="font-normal text-text-tertiary">(optional)</span></label>
                          <textarea
                            id="merit-comments"
                            value={evaluationData.comment}
                            onChange={(e) => setEvaluationData({ ...evaluationData, comment: e.target.value })}
                            placeholder="Add factual feedback to support this rating"
                            rows={3}
                            maxLength={2000}
                            className="w-full rounded border border-border bg-surface px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-info-border"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={handleSubmitEvaluation}
                          disabled={submittingEvaluation}
                          className="w-full soc-btn disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {submittingEvaluation ? 'Submitting...' : 'Submit evaluation'}
                        </button>
                      </div>
                    </div>
                  )}

                  {evaluations.length > 0 ? (
                    <div className="space-y-4">
                      {evaluations.map((evaluation) => (
                        <article key={evaluation.id} className="border-l-4 border-info py-2 pl-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-semibold text-text-primary">{evaluation.evaluatorName}</p>
                              <p className="text-xs uppercase tracking-wide text-text-tertiary">
                                {evaluation.evaluatorRole || 'authorized evaluator'}
                              </p>
                              <p className="text-sm text-text-secondary">{new Date(evaluation.createdAt).toLocaleDateString()}</p>
                            </div>
                            <span className="flex items-center gap-1 text-sm font-bold text-warning-text">
                              <Star className="h-4 w-4 fill-current" aria-hidden="true" />
                              {evaluation.rating.toFixed(1)} / 5
                            </span>
                          </div>
                          {evaluation.comment && <p className="text-text-primary mt-2">{evaluation.comment}</p>}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="py-4 text-center text-text-tertiary">No evaluations have been recorded for this guard. Add an evaluation when an authorized review is available.</p>
                  )}
                </section>
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                <OperationalSummaryBand items={rankingSummary} />
                <section className="table-glass overflow-hidden">
                  <div className="border-b border-border-subtle px-5 py-5 md:px-6">
                    <p className="soc-kicker">Rankings register</p>
                    <h2 className="mt-1 text-lg font-bold text-text-primary">Guard merit score rankings</h2>
                    <p className="mt-1 text-sm text-text-secondary">Higher scores indicate stronger recorded performance. Open a scorecard to review the factors behind each score.</p>
                  </div>

                  {rankings.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-[42rem] w-full border-collapse lg:min-w-0">
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
                          <th className="hidden px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider lg:table-cell">
                            Punctuality
                          </th>
                          <th className="hidden px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider lg:table-cell">
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
                            <td className="hidden px-4 py-3 lg:table-cell">
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
                            <td className="hidden px-4 py-3 text-center text-lg font-bold text-warning-text lg:table-cell">
                              {(guard.clientRating / 20).toFixed(1)} ★
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => void fetchGuardDetails(guard.guardId)}
                                className="soc-btn min-h-11 min-w-11 px-3"
                                aria-label={`View details for ${guard.guardName}`}
                              >
                                <span className="hidden sm:inline">View details</span>
                                <ArrowRight className="h-4 w-4" aria-hidden="true" />
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
              </div>
            )}
          </div>
        )}
    </OperationalShell>
  )
}

export default MeritScoreDashboard
