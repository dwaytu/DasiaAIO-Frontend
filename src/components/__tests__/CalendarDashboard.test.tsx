import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CalendarDashboard from '../CalendarDashboard'

jest.mock('../../config', () => ({
  API_BASE_URL: 'http://localhost:5000',
}))

jest.mock('../layout/OperationalShell', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

jest.mock('../SecurityBentoGrid', () => ({
  __esModule: true,
  default: () => <div />,
}))

jest.mock('../BentoGrid', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BentoCard: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}))

jest.mock('../dashboard/ui/Timeline', () => ({
  __esModule: true,
  default: () => <div />,
}))

jest.mock('../dashboard/ui/LiveFreshnessPill', () => ({
  __esModule: true,
  default: () => <div />,
}))

jest.mock('../../config/navigation', () => ({
  getSidebarNav: jest.fn(() => []),
}))

jest.mock('../../utils/api', () => ({
  getAuthHeaders: jest.fn(() => ({ Authorization: 'Bearer test-token' })),
  parseResponseBody: jest.fn((response: Response) => response.json()),
}))

jest.mock('../../utils/logger', () => ({
  logError: jest.fn(),
}))

const adminUser = {
  id: 'admin-1',
  username: 'admin',
  email: 'admin@example.test',
  role: 'admin' as const,
}

function toIso(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month, day, 8)).toISOString()
}

describe('CalendarDashboard', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('loads every shift page so schedules remain visible when navigating to an earlier month', async () => {
    const now = new Date()
    const previousMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1
    const previousYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
    const firstPageShifts = Array.from({ length: 200 }, (_, index) => ({
      id: `current-${index}`,
      start_time: toIso(now.getFullYear(), now.getMonth(), (index % 27) + 1),
      end_time: toIso(now.getFullYear(), now.getMonth(), (index % 27) + 1),
      client_site: `Current ${index}`,
      status: index % 3 === 0 ? 'completed' : index % 3 === 1 ? 'in_progress' : 'scheduled',
    }))
    const earlierShift = {
      id: 'previous-month-shift',
      start_time: toIso(previousYear, previousMonth, 15),
      end_time: toIso(previousYear, previousMonth, 15),
      client_site: 'Previous',
      status: 'completed',
    }

    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/api/guard-replacement/shifts')) {
        const page = new URL(url).searchParams.get('page')
        return {
          ok: true,
          json: async () => page === '1'
            ? { total: 201, page: 1, pageSize: 200, shifts: firstPageShifts }
            : { total: 201, page: 2, pageSize: 200, shifts: [earlierShift] },
        } as Response
      }

      return { ok: true, json: async () => [] } as Response
    })
    const interactions = userEvent.setup()

    render(<CalendarDashboard user={adminUser} onLogout={jest.fn()} />)

    await screen.findByRole('button', { name: 'Previous month' })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('page=2&pageSize=200'),
      expect.objectContaining({ signal: expect.anything() }),
    )

    await interactions.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(await screen.findByText('Previous')).toBeInTheDocument()
  })
})
