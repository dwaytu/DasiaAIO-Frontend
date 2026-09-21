import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResourceManagementPanel from '../ResourceManagementPanel'

let viewerRole = 'superadmin'

jest.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'viewer-1', role: viewerRole } }),
}))

jest.mock('../../../config', () => ({
  API_BASE_URL: 'http://localhost:5000',
}))

jest.mock('../../../hooks/useOperationalMapData', () => ({
  useOperationalMapData: jest.fn(),
}))

const users = [
  {
    id: 'guard-1',
    role: 'guard',
    full_name: 'BANDIGAN, WARREN CLIFFORD',
    username: 'warren.bandigan',
    email: 'warren@example.com',
    phone_number: '09170000001',
    license_number: 'LIC-0042',
    guard_code: 'G-0042',
  },
  {
    id: 'guard-2',
    role: 'guard',
    full_name: 'CARILLO, MARJON NMN',
    username: 'marjon.carillo',
    email: 'marjon@example.com',
    phone_number: '09170000002',
    license_number: 'LIC-0043',
    guard_code: null,
  },
]

describe('ResourceManagementPanel guard IDs', () => {
  beforeEach(() => {
    viewerRole = 'superadmin'
  })

  it('displays an assigned Guard ID and only uses the fallback when it is unavailable', () => {
    render(
      <ResourceManagementPanel
        users={users}
        onDeleteUser={jest.fn()}
        canManageGuardAccounts
        canDeleteGuardAccounts
        isSupervisorViewer={false}
      />,
    )

    expect(screen.getByText('Guard ID: G-0042')).toBeInTheDocument()
    expect(screen.getByText('Guard ID pending assignment')).toBeInTheDocument()
  })

  it('searches the guard roster by Guard ID and name', async () => {
    const user = userEvent.setup()
    render(
      <ResourceManagementPanel
        users={users}
        onDeleteUser={jest.fn()}
        canManageGuardAccounts
        canDeleteGuardAccounts
        isSupervisorViewer={false}
      />,
    )

    const search = screen.getByRole('searchbox', { name: 'Search guard roster' })
    await user.type(search, 'g-0042')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(screen.getByText('BANDIGAN, WARREN CLIFFORD')).toBeInTheDocument()
    expect(screen.queryByText('CARILLO, MARJON NMN')).not.toBeInTheDocument()

    await user.clear(search)
    await user.type(search, 'warren')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(screen.getByText('BANDIGAN, WARREN CLIFFORD')).toBeInTheDocument()
  })

  it('gives supervisors guard management without exposing account deletion', () => {
    viewerRole = 'supervisor'

    render(
      <ResourceManagementPanel
        users={users}
        onDeleteUser={jest.fn()}
        canManageGuardAccounts
        canDeleteGuardAccounts={false}
        isSupervisorViewer
      />,
    )

    expect(screen.getByText(/Limited management access:/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(users.length)
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  })
})
