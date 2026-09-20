import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MeritScoreDashboard from '../MeritScoreDashboard'

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
  { rank: 1, guardId: 'guard-1', guardName: 'Guard One', overallScore: 91.5, meritRank: 'Gold', onTimePercentage: 96, clientRating: 90 },
  { rank: 2, guardId: 'guard-2', guardName: 'Guard Two', overallScore: 0, meritRank: 'Not evaluated', onTimePercentage: 0, clientRating: 0 },
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
  { id: 'eval-2', guardId: 'guard-1', rating: 5, comment: 'Excellent', evaluatorName: 'Supervisor Two', createdAt: '2026-09-10T08:00:00.000Z' },
]

function mockMeritFetch({ rankingStatus = 200 }: { rankingStatus?: number } = {}) {
  return jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    if (url.endsWith('/api/merit/rankings/all')) {
      return { ok: rankingStatus === 200, json: async () => ({ rankings }) } as Response
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

    expect(await screen.findByRole('heading', { name: 'Guard merit and evaluation' })).toBeInTheDocument()
    expect(screen.getByText('Eligible guards').parentElement).toHaveTextContent('2')
    expect(screen.getByText('Evaluated').parentElement).toHaveTextContent('1')
    expect(screen.getByText('Awaiting evaluation').parentElement).toHaveTextContent('1')
    expect(screen.getByRole('heading', { name: 'Guard merit score rankings' })).toBeInTheDocument()
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

    await interactions.click(screen.getByRole('button', { name: 'Back to rankings' }))
    expect(screen.getByRole('heading', { name: 'Guard merit score rankings' })).toBeInTheDocument()
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
