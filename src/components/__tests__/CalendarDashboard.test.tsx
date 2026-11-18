import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CalendarDashboard, { formatShiftTimeRange, getOverlappingShiftIds, isOvernightShift, type ShiftEvent } from '../CalendarDashboard'

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
    expect(await screen.findByRole('button', { name: /15.*Previous/ })).toBeInTheDocument()
  })

  it('puts attention first and shows only three selected-date events per page', async () => {
    const now = new Date()
    const shifts = [
      ['First completed', 'completed', 6],
      ['Attention needed', 'cancelled', 18],
      ['Second completed', 'completed', 7],
      ['Third completed', 'completed', 8],
    ].map(([site, status, hour], index) => ({
      id: `agenda-${index}`,
      client_site: site,
      status,
      start_time: new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(hour)).toISOString(),
      end_time: new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(hour) + 1).toISOString(),
    }))
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => ({
      ok: true,
      json: async () => String(input).includes('/api/guard-replacement/shifts')
        ? { total: shifts.length, shifts }
        : [],
    }) as Response)
    const user = userEvent.setup()
    render(<CalendarDashboard user={adminUser} onLogout={jest.fn()} />)

    const pager = within(await screen.findByRole('navigation', { name: 'Selected date agenda pages' }))
    const agenda = within((await pager.findByText('Page 1 of 2')).closest('[role="region"]') as HTMLElement)
    expect(agenda.getAllByRole('button').slice(0, 3).map((button) => button.textContent)).toEqual([
      expect.stringContaining('Attention needed'),
      expect.stringContaining('First completed'),
      expect.stringContaining('Second completed'),
    ])
    expect(agenda.queryByText('Third completed')).not.toBeInTheDocument()
    await user.click(pager.getByRole('button', { name: 'Next' }))
    expect(agenda.getByText('Third completed')).toBeInTheDocument()
    await user.click(pager.getByRole('button', { name: 'Previous' }))
    expect(agenda.getByText('Attention needed')).toBeInTheDocument()
    await user.click(pager.getByRole('button', { name: 'Next' }))
    await user.selectOptions(agenda.getByLabelText('Event status'), 'attention')
    expect(pager.getByText('Page 1 of 1')).toBeInTheDocument()
    expect(agenda.getByText('Attention needed')).toBeInTheDocument()
    await user.selectOptions(agenda.getByLabelText('Event status'), 'scheduled')
    expect(agenda.getByText('No matching events')).toBeInTheDocument()
  })

  it('uses local schedule dates for same-day, overnight, and invalid shifts', () => {
    const sameDay: Pick<ShiftEvent, 'startTime' | 'endTime'> = {
      startTime: '2026-10-27T10:00:00+08:00',
      endTime: '2026-10-27T18:00:00+08:00',
    }
    const overnight: Pick<ShiftEvent, 'startTime' | 'endTime'> = {
      startTime: '2026-10-27T22:00:00+08:00',
      endTime: '2026-10-28T06:00:00+08:00',
    }
    const invalid: Pick<ShiftEvent, 'startTime' | 'endTime'> = {
      startTime: 'not-a-time',
      endTime: 'also-not-a-time',
    }

    expect(isOvernightShift(sameDay)).toBe(false)
    expect(isOvernightShift(overnight)).toBe(true)
    expect(isOvernightShift(invalid)).toBe(false)
    expect(formatShiftTimeRange(overnight)).toContain('October')
    expect(formatShiftTimeRange(invalid)).toBe('Schedule time unavailable')
  })

  it('identifies only genuinely overlapping assignments for the same guard, including across a year boundary', () => {
    const shifts: ShiftEvent[] = [
      { id: 'year-end', type: 'shift', title: 'Year end', date: '2026-12-31', startTime: '2026-12-31T22:00:00+08:00', endTime: '2027-01-01T06:00:00+08:00', clientSite: 'Site A', guardId: 'guard-1', status: 'scheduled' },
      { id: 'overlap', type: 'shift', title: 'Overlap', date: '2027-01-01', startTime: '2027-01-01T05:00:00+08:00', endTime: '2027-01-01T10:00:00+08:00', clientSite: 'Site B', guardId: 'guard-1', status: 'scheduled' },
      { id: 'different-guard', type: 'shift', title: 'Other', date: '2027-01-01', startTime: '2027-01-01T05:00:00+08:00', endTime: '2027-01-01T10:00:00+08:00', clientSite: 'Site C', guardId: 'guard-2', status: 'scheduled' },
      { id: 'touching', type: 'shift', title: 'Touching', date: '2027-01-01', startTime: '2027-01-01T10:00:00+08:00', endTime: '2027-01-01T12:00:00+08:00', clientSite: 'Site A', guardId: 'guard-1', status: 'scheduled' },
    ]

    expect([...getOverlappingShiftIds(shifts)].sort()).toEqual(['overlap', 'year-end'])
  })

  it('switches to the grouped list without refetching and lets an operator return to a shift', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/api/guard-replacement/shifts')) {
        return {
          ok: true,
          json: async () => ({
            total: 1,
            page: 1,
            pageSize: 200,
            shifts: [{
              id: 'night-shift',
              start_time: '2026-10-27T22:00:00+08:00',
              end_time: '2026-10-28T06:00:00+08:00',
              client_site: 'North Gate',
              status: 'scheduled',
            }],
          }),
        } as Response
      }
      return { ok: true, json: async () => [] } as Response
    })
    const user = userEvent.setup()
    render(<CalendarDashboard user={adminUser} onLogout={jest.fn()} />)

    await user.click(await screen.findByRole('button', { name: 'List' }))
    expect(await screen.findByRole('region', { name: 'Schedule list' })).toHaveTextContent('North Gate')
    expect(screen.getByText('Overnight shift')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'View shift' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('North Gate')
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })
})
