import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User } from '../context/AuthContext'
import NotificationPanel from '../components/NotificationPanel'
import FirearmInventory from '../components/FirearmInventory'
import { ThemeProvider } from '../context/ThemeProvider'
import { fetchRoleInboxSummary } from '../components/inbox/roleInboxSummary'

jest.mock('../config', () => ({
  API_BASE_URL: 'https://example.test',
  detectRuntimePlatform: () => 'web',
}))

jest.mock('../utils/logger', () => ({
  logError: jest.fn(),
}))

jest.mock('../utils/api', () => ({
  getAuthHeaders: (extraHeaders: Record<string, string> = {}) => ({
    Authorization: 'Bearer token',
    ...extraHeaders,
  }),
}))

jest.mock('../components/inbox/roleInboxSummary', () => ({
  fetchRoleInboxSummary: jest.fn(),
}))

const mockFetchRoleInboxSummary = fetchRoleInboxSummary as jest.MockedFunction<typeof fetchRoleInboxSummary>

const baseUser: User = {
  id: 'admin-1',
  email: 'admin@example.test',
  username: 'admin',
  role: 'admin',
  fullName: 'Admin User',
}

function renderWithTheme(element: React.ReactElement) {
  return render(<ThemeProvider>{element}</ThemeProvider>)
}

describe('shell header refactor regressions', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'fetch', {
      writable: true,
      value: jest.fn(),
    })
  })

  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.setItem('sentinel-theme', 'dark')
    ;(globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    })
  })

  it('does not crash the quick inbox when header user context is temporarily unavailable', async () => {
    expect(() => {
      render(
        <NotificationPanel
          user={undefined as unknown as User}
          isOpen
          onToggle={jest.fn()}
          onClose={jest.fn()}
          onViewAll={jest.fn()}
        />,
      )
    }).not.toThrow()

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /quick inbox/i })).toBeInTheDocument()
    })

    expect(screen.getByText(/no urgent inbox items right now/i)).toBeInTheDocument()
  })

  it('sanitizes malformed quick inbox items before rendering them', async () => {
    mockFetchRoleInboxSummary.mockResolvedValue({
      items: [
        undefined as never,
        {
          id: '',
          priority: 'urgent',
          category: 'notification',
          title: '',
          description: '',
          timestamp: '',
        } as never,
        {
          id: 'notif-1',
          priority: 'high',
          category: 'notification',
          title: 'Relief update',
          description: 'Relief guard confirmed.',
          timestamp: new Date().toISOString(),
        } as never,
      ],
      actionableCount: 3,
      notice: '',
      hasError: false,
    })

    render(
      <NotificationPanel
        user={baseUser}
        isOpen
        onToggle={jest.fn()}
        onClose={jest.fn()}
        onViewAll={jest.fn()}
      />,
    )

    expect(await screen.findByRole('dialog', { name: /quick inbox/i })).toBeInTheDocument()
    expect(await screen.findByText('Relief update')).toBeInTheDocument()
    expect(await screen.findByText('Inbox Update')).toBeInTheDocument()
  })

  it('wires inbox header actions through direct firearm inventory header usage', async () => {
    const user = userEvent.setup()
    const onViewChange = jest.fn()

    mockFetchRoleInboxSummary.mockResolvedValue({
      items: [
        {
          id: 'notif-1',
          priority: 'high',
          category: 'notification',
          title: 'Pending guard approval',
          description: 'Replacement request awaiting review.',
          timestamp: new Date().toISOString(),
        },
      ],
      actionableCount: 1,
      notice: '',
      hasError: false,
    })

    renderWithTheme(
      <FirearmInventory
        user={baseUser}
        onLogout={jest.fn()}
        onViewChange={onViewChange}
        activeView="firearms"
      />,
    )

    await user.click(await screen.findByRole('button', { name: /open quick inbox/i }))
    await user.click(await screen.findByRole('button', { name: /view full inbox/i }))

    expect(onViewChange).toHaveBeenCalledWith('inbox')
  })
})