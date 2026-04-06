import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OperationalShell from '../components/layout/OperationalShell'
import type { User } from '../context/AuthContext'

jest.mock('../components/Sidebar', () => ({
  __esModule: true,
  default: () => <aside data-testid="sidebar" />,
}))

jest.mock('../components/shared/Header', () => ({
  __esModule: true,
  default: () => <header data-testid="header" />,
}))

describe('OperationalShell mobile Alerts navigation', () => {
  it('routes the Alerts primary tab through inbox key', async () => {
    const user = userEvent.setup()
    const onNavigate = jest.fn()

    const elevatedUser: User = {
      id: 'admin-1',
      email: 'admin@example.test',
      username: 'admin',
      role: 'admin',
      fullName: 'Admin One',
    }

    render(
      <OperationalShell
        user={elevatedUser}
        title="Dashboard"
        navItems={[]}
        activeView="dashboard"
        onNavigate={onNavigate}
        onLogout={jest.fn()}
        mobileMenuOpen={false}
        onMenuOpen={jest.fn()}
        onMenuClose={jest.fn()}
        onLogoClick={jest.fn()}
      >
        <div>Shell Content</div>
      </OperationalShell>,
    )

    await user.click(screen.getByRole('button', { name: 'Alerts' }))

    expect(onNavigate).toHaveBeenCalledWith('inbox')
  })
})
