import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '../context/ThemeProvider'
import { GuardSettings } from '../components/settings/GuardSettings'
import { SupervisorSettings } from '../components/settings/SupervisorSettings'
import { AdminSettings } from '../components/settings/AdminSettings'
import { SuperadminSettings } from '../components/settings/SuperadminSettings'

jest.mock('../utils/pushNotifications', () => ({
  registerServiceWorker: jest.fn(),
  requestPushPermission: jest.fn(),
  subscribeToPush: jest.fn(),
  unsubscribeFromPush: jest.fn(),
}))

jest.mock('../config', () => ({ API_BASE_URL: 'http://localhost:5000' }))

const baseUser = { id: 'user-1', email: 'user@example.test', username: 'operator', fullName: 'Operator Example' }
const renderWithTheme = (element: React.ReactElement) => render(<ThemeProvider>{element}</ThemeProvider>)

describe('account settings', () => {
  beforeEach(() => localStorage.clear())

  it('shows only controls backed by current account behavior', () => {
    renderWithTheme(<GuardSettings user={{ ...baseUser, role: 'guard' }} />)

    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Device push notifications' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Change Password' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Dark mode' })).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: /email notifications/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: /approval queue alerts/i })).not.toBeInTheDocument()
  })

  it('persists the implemented display preference and exposes switch state', async () => {
    const user = userEvent.setup()
    renderWithTheme(<GuardSettings user={{ ...baseUser, role: 'guard' }} />)

    const darkMode = screen.getByRole('switch', { name: 'Dark mode' })
    expect(darkMode).toHaveAttribute('aria-checked', 'true')
    await user.click(darkMode)
    expect(darkMode).toHaveAttribute('aria-checked', 'false')
    expect(localStorage.getItem('sentinel-theme')).toBe('light')
  })

  it('keeps the real settings structure available for every role', () => {
    renderWithTheme(<><SupervisorSettings user={{ ...baseUser, role: 'supervisor' }} /><AdminSettings user={{ ...baseUser, role: 'admin' }} /><SuperadminSettings user={{ ...baseUser, role: 'superadmin' }} /></>)

    expect(screen.getByRole('heading', { name: /^supervisor settings$/i, level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^admin settings$/i, level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^superadmin settings$/i, level: 1 })).toBeInTheDocument()
    expect(screen.queryByText(/MVP|later wave|planned for/i)).not.toBeInTheDocument()
  })
})
