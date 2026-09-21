import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotificationTriage } from '../NotificationTriage'
import type { InboxItem } from '../ActionInbox'

jest.mock('../../../config', () => ({ API_BASE_URL: 'https://example.test' }))
jest.mock('../../../utils/api', () => ({
  getAuthHeaders: () => ({ Authorization: 'Bearer token' }),
  fetchJsonOrThrow: jest.fn(async () => ({})),
}))

const action = jest.fn()
const items: InboxItem[] = [
  {
    id: 'notification-license-1',
    notificationId: 'license-1',
    priority: 'urgent',
    category: 'compliance',
    title: 'Guard license expired: Sam Guard (LIC-77)',
    description: 'Sam Guard\'s license (LIC-77) requires compliance attention. Expiry date: 2026-04-27.',
    timestamp: '2026-09-21T11:55:00Z',
    isRead: false,
    actionLabel: 'Open compliance',
    onAction: action,
  },
  {
    id: 'incident-1',
    priority: 'high',
    category: 'incident',
    title: 'North gate incident',
    description: 'Reported at North Gate.',
    timestamp: '2026-09-21T10:00:00Z',
    actionLabel: 'Open map',
    onAction: action,
  },
]

describe('NotificationTriage', () => {
  beforeEach(() => action.mockReset())

  it('filters items, exposes compliance details, and uses the existing contextual action', async () => {
    const user = userEvent.setup()
    render(<NotificationTriage items={items} emptyMessage="No notifications require attention." />)

    await user.click(screen.getByRole('button', { name: 'Compliance' }))

    expect(screen.getAllByText('Guard license expired: Sam Guard (LIC-77)')).toHaveLength(2)
    expect(screen.getByText('Expired Apr 27, 2026')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open compliance' }))
    expect(action).toHaveBeenCalledTimes(1)
  })

  it('marks a persisted notification as read exactly once', async () => {
    const user = userEvent.setup()
    render(<NotificationTriage items={items} emptyMessage="No notifications require attention." />)

    await user.click(screen.getByRole('button', { name: 'Mark as read' }))

    const { fetchJsonOrThrow } = jest.requireMock('../../../utils/api') as { fetchJsonOrThrow: jest.Mock }
    expect(fetchJsonOrThrow).toHaveBeenCalledTimes(1)
    expect(fetchJsonOrThrow.mock.calls[0][0]).toContain('/api/notifications/license-1/read')
    expect(await screen.findByRole('button', { name: 'Mark as unread' })).toBeInTheDocument()
  })
})
