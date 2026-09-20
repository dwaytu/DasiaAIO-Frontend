import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminDashboard from '../AdminDashboard'
import { fetchJsonOrThrow } from '../../utils/api'

jest.mock('../../config', () => ({ API_BASE_URL: 'http://localhost:5000' }))

jest.mock('../layout/OperationalShell', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('../dashboard/CommandCenterDashboard', () => ({ __esModule: true, default: () => null }))
jest.mock('../dashboard/ui/LiveFreshnessPill', () => ({ __esModule: true, default: () => null }))
jest.mock('../dashboard/ui/DashboardLoadingState', () => ({ TableLoadingState: () => null }))
jest.mock('../BugReportButton', () => ({ __esModule: true, default: () => null }))
jest.mock('../EditUserModal', () => ({ __esModule: true, default: () => null }))
jest.mock('../EditScheduleModal', () => ({ __esModule: true, default: () => null }))
jest.mock('../admin/CreateGuardAccountModal', () => ({ __esModule: true, default: () => null }))

jest.mock('../../config/navigation', () => ({ getSidebarNav: jest.fn(() => []) }))
jest.mock('../../utils/api', () => ({
  fetchJsonOrThrow: jest.fn(),
  getAuthHeaders: jest.fn(() => ({ Authorization: 'Bearer test-token' })),
}))

const fetchMock = fetchJsonOrThrow as jest.MockedFunction<typeof fetchJsonOrThrow>

const pendingApproval = {
  id: 'guard-pending-1',
  email: 'guard@example.test',
  username: 'guard.pending',
  full_name: 'Guard Pending',
  role: 'guard',
  verified: true,
  approval_status: 'pending',
  created_at: '2026-09-20T08:00:00.000Z',
}

describe('AdminDashboard rejection dialog', () => {
  beforeEach(() => {
    fetchMock.mockImplementation(async (input) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
      if (url.includes('/pending-approvals')) return { users: [pendingApproval] }
      if (url.includes('/api/users')) return { users: [] }
      return {}
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('opens the in-app rejection dialog from an approval and submits the existing reason payload', async () => {
    const user = userEvent.setup()

    render(
      <AdminDashboard
        user={{ id: 'admin-1', email: 'admin@example.test', username: 'admin', role: 'admin' }}
        onLogout={jest.fn()}
        activeView="approvals"
      />,
    )

    await user.click((await screen.findAllByRole('button', { name: 'Reject' }))[0])

    expect(screen.getByRole('dialog')).toHaveTextContent('Reject guard account "Guard Pending"?')
    await user.type(screen.getByLabelText(/Reason for rejection/i), 'Missing required documents')
    await user.click(screen.getByRole('button', { name: 'Reject request' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/users/guard-pending-1/approval'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ action: 'reject', reason: 'Missing required documents' }),
      }),
      'Failed to reject account',
    ))
  })
})
