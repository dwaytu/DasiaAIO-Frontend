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

jest.mock('../../utils/permissions', () => ({
  can: jest.fn(() => true),
}))

const user = { id: 'admin-1', username: 'admin', email: 'admin@example.test', role: 'admin' as const }

const rankings = [
  { rank: 1, guardId: 'guard-1', guardName: 'Guard One', overallScore: 91.5, meritRank: 'Gold', onTimePercentage: 96, clientRating: 90, evaluationCount: 2 },
  { rank: 2, guardId: 'guard-2', guardName: 'Guard Two', overallScore: 100, meritRank: 'Excellent', onTimePercentage: 100, clientRating: 0, evaluationCount: 0 },
]

const scorecard = {
  guardId: 'guard-1',
  guardName: 'Guard One',
  overallScore: 91.5,
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

function mockMeritFetch({ rankingStatus = 200, rankingItems = rankings }: { rankingStatus?: number; rankingItems?: typeof rankings } = {}) {
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
    mockMeritFetch()

    render(<MeritScoreDashboard user={user} onLogout={jest.fn()} />)

    expect(await screen.findByRole('heading', { name: 'Guard evaluations' })).toBeInTheDocument()
    expect(screen.getByText('Eligible guards').parentElement).toHaveTextContent('2')
    expect(screen.getByText('Evaluated').parentElement).toHaveTextContent('1')
    expect(screen.getByText('Awaiting evaluation').parentElement).toHaveTextContent('1')
    expect(screen.getByText('No evaluations')).toBeInTheDocument()
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
    expect(screen.getByRole('heading', { name: 'Performance activity' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Score trend from/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add evaluation' })).toBeInTheDocument()
    expect(await screen.findByText('Evaluator not identified')).toBeInTheDocument()
    expect(screen.getByText('Supervisor One')).toBeInTheDocument()

    await interactions.click(screen.getByRole('button', { name: 'Back to rankings' }))
    expect(screen.getByRole('heading', { name: 'Guard evaluations' })).toBeInTheDocument()
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
