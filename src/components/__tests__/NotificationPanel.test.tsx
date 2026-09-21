import { render, screen } from '@testing-library/react'
import type { User } from '../../context/AuthContext'
import NotificationPanel from '../NotificationPanel'

jest.mock('../../config', () => ({ API_BASE_URL: 'https://example.test' }))
jest.mock('../../utils/api', () => ({
  getAuthHeaders: () => ({ Authorization: 'Bearer token' }),
  fetchJsonOrThrow: jest.fn(async () => ({
    unreadCount: 1,
    notifications: [{
      id: 'license-1',
      title: 'Guard license expired',
      message: 'License expired Apr 27, 2026.',
      type: 'guard_compliance',
      read: false,
      createdAt: '2026-09-21T11:55:00Z',
    }],
  })),
}))
jest.mock('../inbox/roleInboxSummary', () => ({
  fetchRoleInboxSummary: jest.fn(async () => ({
    items: [{
      id: 'summary-license-1',
      priority: 'urgent',
      category: 'notification',
      title: 'Guard license expired',
      description: 'License expired Apr 27, 2026.',
      timestamp: '2026-09-21T11:55:00Z',
    }],
    actionableCount: 1,
    notice: '',
    hasError: false,
  })),
}))

const user: User = {
  id: 'admin-1',
  email: 'admin@example.test',
  username: 'admin',
  role: 'admin',
  fullName: 'Admin User',
}

describe('NotificationPanel', () => {
  it('uses the persisted unread count and does not duplicate summary notifications', async () => {
    render(<NotificationPanel user={user} isOpen onToggle={jest.fn()} onClose={jest.fn()} onViewAll={jest.fn()} />)

    expect(await screen.findByRole('button', { name: /open quick inbox \(1 unread notifications\)/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '1 unread' })).toBeInTheDocument()
    expect(screen.getAllByText('Guard license expired')).toHaveLength(1)
  })
})
