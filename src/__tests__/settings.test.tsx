import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '../context/ThemeProvider'
import { GuardSettings } from '../components/settings/GuardSettings'
import { SupervisorSettings } from '../components/settings/SupervisorSettings'
import { AdminSettings } from '../components/settings/AdminSettings'
import { SuperadminSettings } from '../components/settings/SuperadminSettings'

const baseUser = {
  id: 'user-1',
  email: 'user@example.test',
  username: 'operator',
  fullName: 'Operator Example',
}

function renderWithTheme(element: React.ReactElement) {
  return render(<ThemeProvider>{element}</ThemeProvider>)
}

describe('role settings MVP', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists guard notification settings under a role-scoped key', async () => {
    const user = userEvent.setup()

    renderWithTheme(<GuardSettings user={{ ...baseUser, role: 'guard' }} />)

    await user.click(screen.getByRole('switch', { name: /push notifications/i }))
    await user.click(screen.getByRole('switch', { name: /email notifications/i }))

    await waitFor(() => {
      expect(localStorage.getItem('settings.guard.notifications')).toContain('"push":true')
    })
    expect(localStorage.getItem('settings.guard.notifications')).toContain('"email":true')
  })

  it('keeps supervisor settings isolated from guard settings', async () => {
    const user = userEvent.setup()

    localStorage.setItem('settings.guard.notifications', JSON.stringify({ push: true, email: false, inApp: true }))
    renderWithTheme(<SupervisorSettings user={{ ...baseUser, role: 'supervisor' }} />)

    await user.click(screen.getByRole('switch', { name: /approval queue alerts/i }))

    expect(localStorage.getItem('settings.guard.notifications')).toBe(JSON.stringify({ push: true, email: false, inApp: true }))
    await waitFor(() => {
      expect(localStorage.getItem('settings.supervisor.supervisor')).toContain('"approvalQueue":true')
    })
  })

  it('renders admin and superadmin settings stubs for future categories', () => {
    renderWithTheme(
      <>
        <AdminSettings user={{ ...baseUser, role: 'admin' }} />
        <SuperadminSettings user={{ ...baseUser, role: 'superadmin' }} />
      </>,
    )

    expect(screen.getByRole('heading', { name: /^admin settings$/i, level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^superadmin settings$/i, level: 1 })).toBeInTheDocument()
    expect(screen.getAllByText(/additional controls are planned for a later wave/i).length).toBeGreaterThan(0)
  })
})