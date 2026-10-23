import { render, screen } from '@testing-library/react'
import type { User } from '../../context/AuthContext'
import NotificationPanel from '../NotificationPanel'

jest.mock('../../config', () => ({ API_BASE_URL: 'https://example.test' }))
jest.mock('../../utils/api', () => ({
  getAuthHeaders: () => ({ Authorization: 'Bearer token' }),
  fetchJsonOrThrow: jest.fn(async () => ({
    unreadCount: 2,
    currentUnreadCount: 1,
    notifications: [{
      id: 'current-1',
      title: 'New check-in requires review',
      message: 'Review the current check-in exception.',
      type: 'missing_check_in',
      read: false,
      createdAt: new Date().toISOString(),
    }, {
      id: 'historical-1',
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
  it('shows only current notifications in the quick inbox while keeping history out of the attention view', async () => {
    render(<NotificationPanel user={user} isOpen onToggle={jest.fn()} onClose={jest.fn()} onViewAll={jest.fn()} />)

    expect(await screen.findByRole('button', { name: /open quick inbox \(1 current unread notifications\)/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '1 current unread' })).toBeInTheDocument()
    expect(screen.getByText('New check-in requires review')).toBeInTheDocument()
    expect(screen.queryByText('Guard license expired')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /mark all notifications as read/i })).not.toBeInTheDocument()
  })
})
