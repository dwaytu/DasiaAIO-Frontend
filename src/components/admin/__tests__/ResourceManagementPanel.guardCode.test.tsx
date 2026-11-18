import { render, screen, within } from '@testing-library/react'
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

  it('gives supervisors guard details without exposing account deletion', async () => {
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
    expect(screen.getAllByRole('button', { name: /View details for/i })).toHaveLength(users.length)
    await userEvent.setup().click(screen.getByRole('button', { name: /View details for BANDIGAN/i }))
    expect(screen.getByRole('button', { name: 'Edit details' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove guard' })).not.toBeInTheDocument()
  })

  it('keeps guard actions in the details dialog and restores focus after Escape', async () => {
    const user = userEvent.setup()
    const onDeleteUser = jest.fn()
    render(
      <ResourceManagementPanel
        users={users}
        onDeleteUser={onDeleteUser}
        canManageGuardAccounts
        canDeleteGuardAccounts
        isSupervisorViewer={false}
      />,
    )

    const trigger = screen.getByRole('button', { name: /View details for BANDIGAN/i })
    expect(screen.queryByRole('button', { name: 'Remove guard' })).not.toBeInTheDocument()
    await user.click(trigger)
    const detailDialog = screen.getByRole('dialog', { name: /Guard details: BANDIGAN/i })
    expect(detailDialog).toBeInTheDocument()
    expect(within(detailDialog).getByText('G-0042')).toBeInTheDocument()
    expect(within(detailDialog).getByText('warren@example.com')).toBeInTheDocument()
    expect(within(detailDialog).getByRole('button', { name: 'Edit details' })).toBeInTheDocument()
    expect(within(detailDialog).getByRole('button', { name: 'Reset password' })).toBeInTheDocument()
    expect(within(detailDialog).getByRole('button', { name: 'Remove guard' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: /Guard details/i })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(onDeleteUser).not.toHaveBeenCalled()
  })

  it('requires an explicit confirmation before removing a guard', async () => {
    const user = userEvent.setup()
    const onDeleteUser = jest.fn()
    render(
      <ResourceManagementPanel
        users={users}
        onDeleteUser={onDeleteUser}
        canManageGuardAccounts
        canDeleteGuardAccounts
        isSupervisorViewer={false}
      />,
    )

    await user.click(screen.getByRole('button', { name: /View details for BANDIGAN/i }))
    await user.click(screen.getByRole('button', { name: 'Remove guard' }))
    const confirmation = screen.getByRole('dialog', { name: 'Remove guard account?' })
    expect(confirmation).toHaveTextContent('Guard ID G-0042')
    await user.click(within(confirmation).getByRole('button', { name: 'Cancel' }))
    expect(onDeleteUser).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Remove guard' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Remove guard' }))
    const secondConfirmation = screen.getByRole('dialog', { name: 'Remove guard account?' })
    await user.click(within(secondConfirmation).getByRole('button', { name: 'Remove guard' }))
    expect(onDeleteUser).toHaveBeenCalledTimes(1)
    expect(onDeleteUser).toHaveBeenCalledWith('guard-1', 'warren@example.com')
  })
})
