import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MeritScoreDashboard from '../MeritScoreDashboard'
import { fetchJsonOrThrow } from '../../utils/api'

jest.mock('../../config', () => ({
  API_BASE_URL: 'http://localhost:5000',
}))

jest.mock('../layout/OperationalShell', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('../../config/navigation', () => ({
  getSidebarNav: jest.fn(() => []),
}))

jest.mock('../../utils/api', () => ({
  fetchJsonOrThrow: jest.fn(),
  getAuthHeaders: jest.fn(() => ({ Authorization: 'Bearer test-token' })),
}))

const user = { id: 'admin-1', username: 'admin', email: 'admin@example.test', role: 'admin' as const }

const rankings = [
  { rank: 1, guardId: 'guard-1', guardName: 'Guard One', overallScore: 91.5, meritRank: 'Gold', onTimePercentage: 96, clientRating: 90, evaluationCount: 2, scoreBasis: 'weighted_merit' },
  { rank: 0, guardId: 'guard-2', guardName: 'Guard Two', overallScore: 100, meritRank: 'Excellent', onTimePercentage: 100, clientRating: 0, evaluationCount: 0, scoreBasis: 'attendance_punctuality' },
]

const scorecard = {
  guardId: 'guard-1',
  guardName: 'Guard One',
  overallScore: 91.5,
  scoreBasis: 'weighted_merit',
  rank: 'Gold',
  attendanceScore: 95,
  punctualityScore: 90,
  clientRating: 90,
  stats: { totalShifts: 24, onTimeCount: 23, lateCount: 1, noShowCount: 0, evaluations: 2, averageRating: 4.5 },
}

const evaluations = [
  { id: 'eval-1', guardId: 'guard-1', rating: 4, comment: 'Reliable', evaluatorName: 'Supervisor One', createdAt: '2026-09-01T08:00:00.000Z' },
  { id: 'eval-2', guardId: 'guard-1', rating: 5, comment: 'Excellent', evaluatorName: 'Capstone presentation evaluation', evaluatorRole: 'presentation scenario', createdAt: '2026-09-10T08:00:00.000Z' },
]

type TestRanking = Omit<(typeof rankings)[number], 'scoreBasis'> & { scoreBasis?: string; attendancePercentage?: number }

function mockMeritFetch({ rankingStatus = 200, rankingItems = rankings }: { rankingStatus?: number; rankingItems?: TestRanking[] } = {}) {
  return jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    if (url.endsWith('/api/merit/rankings/all')) {
      return { ok: rankingStatus === 200, json: async () => ({ rankings: rankingItems }) } as Response
    }
    if (url.endsWith('/api/merit/guard-1')) {
      return { ok: true, json: async () => scorecard } as Response
    }
    if (url.endsWith('/api/merit/evaluations/guard-1')) {
      return { ok: true, json: async () => ({ evaluations }) } as Response
    }
    throw new Error(`Unexpected request: ${url}`)
  })
}

describe('MeritScoreDashboard', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
  })

  it('summarizes evaluation coverage before the ranking register', async () => {
    mockMeritFetch({ rankingItems: [rankings[0], { ...rankings[1], attendancePercentage: 92 }] })

    render(<MeritScoreDashboard user={user} onLogout={jest.fn()} />)

    expect(await screen.findByRole('heading', { name: 'Guard evaluations' })).toBeInTheDocument()
    expect(screen.getByText('Eligible guards').parentElement).toHaveTextContent('2')
    expect(screen.getByText('Evaluated').parentElement).toHaveTextContent('1')
    expect(screen.getByText('Awaiting evaluation').parentElement).toHaveTextContent('1')
    expect(screen.getByText('No evaluations')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Attendance' })).toBeInTheDocument()
    const attendanceRow = screen.getByRole('row', { name: /Guard Two/ })
    expect(within(attendanceRow).getByText('Needs evaluation')).toBeInTheDocument()
    expect(within(attendanceRow).getByText('92%')).toBeInTheDocument()
    expect(within(attendanceRow).getByText('100%')).toBeInTheDocument()
    expect(within(attendanceRow).queryByText('100.0')).not.toBeInTheDocument()
    expect(within(attendanceRow).getByText('Unranked')).toBeInTheDocument()
    expect(screen.queryByText(/Capstone snapshot/i)).not.toBeInTheDocument()
  })

  it('opens and pages recorded lateness for the selected guard, then restores focus', async () => {
    const interactions = userEvent.setup()
    mockMeritFetch()
    const loadHistory = jest.mocked(fetchJsonOrThrow)
    loadHistory.mockResolvedValueOnce({
      total: 2, pageSize: 1,
      items: [{
        id: 'late-1', kind: 'punctuality', status: 'late', site: 'Fixture Post', minutes_late: 15,
        occurred_at: '2026-09-01T08:00:00.000Z', check_in_time: null, check_out_time: null,
        rating: null, comment: null, evaluator_name: null,
      }],
    }).mockResolvedValueOnce({
      total: 2, pageSize: 1,
      items: [{
        id: 'late-2', kind: 'punctuality', status: 'late', site: 'Second Post', minutes_late: 8,
        occurred_at: '2026-08-31T08:00:00.000Z', check_in_time: null, check_out_time: null,
        rating: null, comment: null, evaluator_name: null,
      }],
    })
    render(<MeritScoreDashboard user={user} onLogout={jest.fn()} />)

    await interactions.click(await screen.findByRole('button', { name: 'View details for Guard One' }))
    const card = await screen.findByRole('button', { name: 'View late history' })
    await interactions.click(card)
    const dialog = screen.getByRole('dialog', { name: 'Late check-ins' })
    expect(await within(dialog).findByText('15 min late')).toBeInTheDocument()
    expect(loadHistory).toHaveBeenCalledWith(
      expect.stringContaining('/api/merit/history/guard-1?category=late&page=1'),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
      expect.any(String),
    )

    await interactions.click(within(dialog).getByRole('button', { name: 'Next' }))
    expect(await within(dialog).findByText('8 min late')).toBeInTheDocument()
    await interactions.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(card).toHaveFocus()
  })

  it('opens a scorecard with drivers, trend, and evaluation controls', async () => {
    const interactions = userEvent.setup()
    mockMeritFetch()

    render(<MeritScoreDashboard user={user} onLogout={jest.fn()} />)

    await interactions.click(await screen.findByRole('button', { name: 'View details for Guard One' }))

    expect(await screen.findByRole('heading', { name: 'Guard One' })).toBeInTheDocument()
    expect(screen.getByText('Overall score').parentElement).toHaveTextContent('91.5')
    expect(screen.getByText('30% attendance · 35% punctuality · 35% evaluator rating')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Performance activity' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Score trend from/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add evaluation' })).toBeInTheDocument()
    expect(await screen.findByText('Evaluator not identified')).toBeInTheDocument()
    expect(screen.getByText('Supervisor One')).toBeInTheDocument()

    await interactions.click(screen.getByRole('button', { name: 'Back to rankings' }))
    expect(screen.getByRole('heading', { name: 'Guard evaluations' })).toBeInTheDocument()
  })

  it('lets a supervisor add an evaluation from history and keeps the earlier review', async () => {
    const interactions = userEvent.setup()
    mockMeritFetch()
    const previousReview = {
      id: 'review-1', kind: 'evaluation', status: null, site: 'Fixture Post', minutes_late: null,
      occurred_at: '2026-09-01T08:00:00.000Z', check_in_time: null, check_out_time: null,
      rating: 4, comment: 'Previous review', evaluator_name: 'Supervisor One',
    }
    let items = [previousReview]
    const request = jest.mocked(fetchJsonOrThrow)
    request.mockImplementation(async (input, init) => {
      const url = String(input)
      if (url.includes('/api/merit/history/guard-1?category=evaluations&page=1')) {
        return { total: items.length, pageSize: 20, items }
      }
      if (url.endsWith('/api/merit/evaluations/submit') && init?.method === 'POST') {
        const { rating, comment } = JSON.parse(String(init.body))
        items = [{ ...previousReview, id: 'review-2', rating, comment }, ...items]
        return {}
      }
      if (url.endsWith('/api/merit/calculate') && init?.method === 'POST') return {}
      throw new Error(`Unexpected request: ${url}`)
    })

    render(<MeritScoreDashboard user={{ ...user, role: 'supervisor' }} onLogout={jest.fn()} />)

    await interactions.click(await screen.findByRole('button', { name: 'View details for Guard One' }))
    const card = await screen.findByRole('button', { name: 'View evaluations history' })
    await interactions.click(card)
    const dialog = within(screen.getByRole('dialog', { name: 'Evaluation history' }))
    expect(await dialog.findByText('Previous review')).toBeInTheDocument()
    await interactions.click(dialog.getByRole('button', { name: 'Add evaluation' }))
    const rating = dialog.getByLabelText(/Rating/)
    expect(rating).toHaveFocus()
    await interactions.selectOptions(rating, '3')
    await interactions.type(dialog.getByLabelText(/Comments/), 'New supervisor review')
    await interactions.click(dialog.getByRole('button', { name: 'Submit evaluation' }))

    expect(request).toHaveBeenCalledWith(
      expect.stringContaining('/api/merit/evaluations/submit'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ guardId: 'guard-1', rating: 3, comment: 'New supervisor review' }),
      }),
      expect.any(String),
    )
    expect(await dialog.findByText('New supervisor review')).toBeInTheDocument()
    expect(dialog.getByText('Previous review')).toBeInTheDocument()
    expect(dialog.getByText('2 recorded entries')).toBeInTheDocument()
    expect(dialog.getByText(/Evaluation saved/)).toBeInTheDocument()
    await interactions.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(card).toHaveFocus()
  })

  it('searches by guard name or ID and keeps the ranking page valid after the result set changes', async () => {
    const interactions = userEvent.setup()
    const rankingItems = Array.from({ length: 13 }, (_, index) => ({
      rank: index + 1,
      guardId: `guard-${index + 1}`,
      guardName: `Guard ${index + 1}`,
      overallScore: 90 - index,
      meritRank: 'Gold',
      onTimePercentage: 95,
      clientRating: 90,
      evaluationCount: 1,
    }))
    mockMeritFetch({ rankingItems })

    render(<MeritScoreDashboard user={user} onLogout={jest.fn()} />)

    await screen.findByRole('heading', { name: 'Guard evaluations' })
    expect(screen.queryByText('Guard 13')).not.toBeInTheDocument()
    await interactions.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Guard 13')).toBeInTheDocument()

    await interactions.type(screen.getByLabelText('Find a guard'), 'guard-1')
    expect(await screen.findByText('Guard 1')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('page 1 of 1')
  })

  it('shows a retry action when rankings cannot be loaded', async () => {
    const fetchMock = mockMeritFetch({ rankingStatus: 500 })
    const interactions = userEvent.setup()

    render(<MeritScoreDashboard user={user} onLogout={jest.fn()} />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/Unable to load merit rankings\. Check your connection and try again\./)
    await interactions.click(screen.getByRole('button', { name: 'Retry' }))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
