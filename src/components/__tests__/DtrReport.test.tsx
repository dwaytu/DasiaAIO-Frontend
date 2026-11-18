import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DtrReport, { getDtrReportingPeriod } from '../DtrReport'

jest.mock('../../config', () => ({
  API_BASE_URL: 'http://localhost:5000',
}))

jest.mock('../layout/OperationalShell', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('../../utils/api', () => ({
  fetchJsonOrThrow: jest.fn(async () => ({
    total: 1,
    page: 1,
    pageSize: 50,
    items: [{
      shiftId: 'shift-1',
      guardId: 'guard-1',
      guardName: 'Guard One',
      clientSite: 'DSIA - Tagum',
      scheduledStart: '2026-09-17T02:45:00.000Z',
      scheduledEnd: '2026-09-17T10:45:00.000Z',
      actualCheckIn: null,
      actualCheckOut: null,
      lateMinutes: 0,
      totalHours: null,
      status: 'scheduled',
    }],
  })),
  getAuthHeaders: jest.fn(() => ({ Authorization: 'Bearer test-token' })),
}))

jest.mock('../../config/navigation', () => ({
  getSidebarNav: jest.fn(() => []),
}))

describe('DtrReport printing', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('targets the DTR table when print is requested', async () => {
    const user = userEvent.setup()
    const printSpy = jest.spyOn(window, 'print').mockImplementation(() => undefined)

    render(
      <DtrReport
        user={{ id: 'admin-1', email: 'admin@example.com', username: 'admin', role: 'admin' }}
        onLogout={jest.fn()}
      />,
    )

    const table = await screen.findByRole('table')
    expect(table).toHaveClass('dtr-print-table')
    expect(document.querySelector('.dtr-print-report')).toBeInTheDocument()
    expect(document.querySelector('.dtr-print-heading')).toHaveTextContent('DAVAO SECURITY & INVESTIGATION AGENCY (DSIA)')
    expect(document.querySelector('.dtr-print-heading')).toHaveTextContent('DAILY TIME RECORD & ATTENDANCE VERIFICATION ROSTER')
    expect(document.querySelector('.dtr-print-heading')).not.toHaveTextContent('Certified Accurate')
    expect(document.querySelector('.dtr-print-signatures')).toHaveTextContent('Prepared by')
    expect(document.querySelector('.dtr-print-signatures')).toHaveTextContent('Reviewed by')
    expect(document.querySelector('.dtr-print-signatures')).toHaveTextContent('Signature / Date')
    expect(screen.getByText('guard-1')).toHaveClass('dtr-print-guard-id')

    await user.click(screen.getByRole('button', { name: 'Print Official Timesheet' }))

    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1))
  })

  it('keeps the reporting period distinct from record pagination', () => {
    expect(getDtrReportingPeriod({ from: '2026-09-01', to: '2026-09-30' }, [])).toMatch(/Sep.*2026.*to.*Sep.*2026/i)
    expect(getDtrReportingPeriod({ from: '', to: '' }, [{ scheduledStart: '2026-09-17T02:45:00.000Z' } as any])).toMatch(/Sep.*17.*2026/i)
  })
})
