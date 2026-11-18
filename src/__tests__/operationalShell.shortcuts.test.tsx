import { fireEvent, render, screen } from '@testing-library/react'
import OperationalShell from '../components/layout/OperationalShell'
import type { User } from '../context/AuthContext'

jest.mock('../components/Sidebar', () => ({ __esModule: true, default: () => <aside /> }))
jest.mock('../components/shared/Header', () => ({ __esModule: true, default: () => <header /> }))

const user: User = { id: 'admin-1', email: 'admin@example.test', username: 'admin', fullName: 'Admin One', role: 'admin' }

const renderShell = (onNavigate = jest.fn()) => render(
  <OperationalShell
    user={user}
    title="Dashboard"
    navItems={[{ view: 'dashboard', label: 'Dashboard' }, { view: 'operations-map', label: 'Operations Map' }, { view: 'inbox', label: 'Alerts' }]}
    activeView="dashboard"
    onNavigate={onNavigate}
    onLogout={jest.fn()}
    mobileMenuOpen={false}
    onMenuOpen={jest.fn()}
    onMenuClose={jest.fn()}
    onLogoClick={jest.fn()}
  >
    <input aria-label="Notes" />
  </OperationalShell>,
)

describe('OperationalShell tactical keyboard shortcuts', () => {
  it('only navigates to a route present in the resolved navigation items', () => {
    const onNavigate = jest.fn()
    renderShell(onNavigate)

    fireEvent.keyDown(window, { key: 'g' })
    fireEvent.keyDown(window, { key: 'm' })
    expect(onNavigate).toHaveBeenCalledWith('operations-map')

    fireEvent.keyDown(window, { key: 'g' })
    fireEvent.keyDown(window, { key: 'f' })
    expect(onNavigate).toHaveBeenCalledTimes(1)
  })

  it('does not hijack typing and gives an accessible, role-aware help dialog', () => {
    const onNavigate = jest.fn()
    renderShell(onNavigate)
    const input = screen.getByRole('textbox', { name: 'Notes' })
    input.focus()
    fireEvent.keyDown(input, { key: 'g' })
    fireEvent.keyDown(input, { key: 'm' })
    expect(onNavigate).not.toHaveBeenCalled()

    input.blur()
    fireEvent.keyDown(window, { key: '?' })
    expect(screen.getByRole('dialog', { name: 'Tactical Keyboard Shortcuts' })).toBeInTheDocument()
    expect(screen.getByText('Operations Map')).toBeInTheDocument()
    expect(screen.queryByText('Firearms')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Tactical Keyboard Shortcuts' })).not.toBeInTheDocument()
  })
})
