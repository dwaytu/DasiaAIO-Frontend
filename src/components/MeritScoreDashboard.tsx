import { useState, useEffect, FC } from 'react'
import { API_BASE_URL } from '../config'
import Sidebar from './Sidebar'
import Header from './Header'
import { User } from '../App'
import { getSidebarNav } from '../config/navigation'
import { logError } from '../utils/logger'
import { getAuthHeaders } from '../utils/api'

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
      <h3 className="mb-3 text-lg font-bold text-text-primary">Client Rating Trend</h3>
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
  const [evaluationData, setEvaluationData] = useState({
    evaluatorName: '',
    rating: 5,
    comment: '',
  })

  const currentView = activeView || 'merit'
  const navItems = getSidebarNav(user.role)

  useEffect(() => {
    fetchRankings()
  }, [])

  const fetchRankings = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/api/merit/rankings/all`, {
        headers: getAuthHeaders()
      })
      if (response.ok) {
        const data = await response.json()
        setRankings(data.rankings || [])
        setError('')
      } else {
        setError('Failed to load merit score rankings')
      }
    } catch (err) {
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
      const response = await fetch(`${API_BASE_URL}/api/merit/evaluations/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          guardId: selectedGuard.guardId,
          evaluatorName: evaluationData.evaluatorName,
          evaluatorRole: 'Supervisor',
          rating: parseFloat(evaluationData.rating.toString()),
          comment: evaluationData.comment,
        }),
      })

      if (response.ok) {
        setShowEvaluationForm(false)
        setEvaluationData({ evaluatorName: '', rating: 5, comment: '' })
        await fetchGuardDetails(selectedGuard.guardId)
        alert('Evaluation submitted successfully')
      }
    } catch (err) {
      logError('Error submitting evaluation:', err)
      alert('Failed to submit evaluation')
    }
  }

  const getMeritRankColor = (rank: string) => {
    switch (rank) {
      case 'Gold':
        return 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30'
      case 'Silver':
        return 'bg-zinc-500/15 text-zinc-400 ring-1 ring-zinc-500/30'
      case 'Bronze':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30'
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600'
    if (score >= 80) return 'text-blue-600'
    if (score >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const handleNavigate = (view: string) => {
    if (onViewChange) {
      onViewChange(view)
    }
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background font-sans">
      <a href="#maincontent" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-text-primary focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--color-focus-ring)]">
        Skip to main content
      </a>
      <Sidebar
        items={navItems}
        activeView={currentView}
        onNavigate={handleNavigate}
        onLogoClick={() => onViewChange?.('dashboard')}
        onLogout={onLogout}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <main id="maincontent" tabIndex={-1} className="flex-1 flex min-w-0 min-h-0 flex-col w-full overflow-hidden">
        <Header
          title="Merit Score System"
          badgeLabel="Performance"
          onLogout={onLogout}
          onMenuClick={() => setMobileMenuOpen(true)}
          user={user}
          onNavigateToProfile={() => onViewChange?.('profile')}
        />

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-center">
            <div className="text-indigo-600 text-lg font-medium">Loading merit scores...</div>
          </div>
        ) : (
          <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full animate-fade-in">
            <section className="soc-surface mb-6 p-4 md:p-5">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-tertiary">Merit Intelligence</p>
              <h1 className="text-2xl font-black uppercase tracking-wide text-text-primary">Guard Merit and Evaluation Center</h1>
              <p className="mt-1 text-sm text-text-secondary">Review rankings, inspect score drivers, and submit structured client evaluations.</p>
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
                      <p className="text-sm opacity-90">Client Rating</p>
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
                      <p className="text-2xl font-bold text-green-600">{selectedGuard.stats.onTimeCount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-text-secondary">Late</p>
                      <p className="text-2xl font-bold text-yellow-600">{selectedGuard.stats.lateCount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-text-secondary">No Shows</p>
                      <p className="text-2xl font-bold text-red-600">{selectedGuard.stats.noShowCount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-text-secondary">Evaluations</p>
                      <p className="text-2xl font-bold text-indigo-600">{selectedGuard.stats.evaluations}</p>
                    </div>
                  </div>
                </section>

                <RatingTrendChart evaluations={evaluations} />

                {/* Evaluations Section */}
                <section className="command-panel p-6 md:p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold text-text-primary">Client Evaluations</h3>
                    <button
                      onClick={() => setShowEvaluationForm(!showEvaluationForm)}
                      className="soc-btn"
                    >
                      {showEvaluationForm ? 'Cancel' : '+ Add Evaluation'}
                    </button>
                  </div>

                  {showEvaluationForm && (
                    <div className="mb-6 p-6 command-panel">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold text-text-primary mb-2">Evaluator Name</label>
                          <input
                            type="text"
                            value={evaluationData.evaluatorName}
                            onChange={(e) => setEvaluationData({ ...evaluationData, evaluatorName: e.target.value })}
                            placeholder="Your name"
                            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-text-primary mb-2">Rating (0-5 stars)</label>
                          <select
                            value={evaluationData.rating}
                            onChange={(e) => setEvaluationData({ ...evaluationData, rating: parseInt(e.target.value) })}
                            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <button
                          onClick={handleSubmitEvaluation}
                          className="w-full soc-btn"
                        >
                          Submit Evaluation
                        </button>
                      </div>
                    </div>
                  )}

                  {evaluations.length > 0 ? (
                    <div className="space-y-4">
                      {evaluations.map((evaluation) => (
                        <div key={evaluation.id} className="border-l-4 border-indigo-500 pl-4 py-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold text-text-primary">{evaluation.evaluatorName}</p>
                                <p className="text-sm text-text-secondary">{new Date(evaluation.createdAt).toLocaleDateString()}</p>
                            </div>
                            <span className="text-lg font-bold text-yellow-500">{'★'.repeat(Math.ceil(evaluation.rating))}</span>
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
              <section className="table-glass rounded-2xl p-6 md:p-8">
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
                            Client Rating
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
                              <span className="inline-block w-8 h-8 bg-indigo-600 text-white text-center rounded-full font-bold">
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
                                    className="bg-blue-600 h-full transition-all duration-300"
                                    style={{ width: `${guard.onTimePercentage}%` }}
                                  ></div>
                                </div>
                                <span className="text-sm font-medium text-text-primary min-w-12">{guard.onTimePercentage.toFixed(0)}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center text-lg font-bold text-yellow-500">
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
                  <p className="text-center text-text-secondary py-8 italic">No merit scores available yet. Guards need to complete shifts first.</p>
                )}
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default MeritScoreDashboard

