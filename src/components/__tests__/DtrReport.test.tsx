import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DtrReport from '../DtrReport'

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

    await user.click(screen.getByRole('button', { name: 'Print' }))

    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1))
  })
})
