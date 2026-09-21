import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FeedbackForm from '../FeedbackForm'

jest.mock('../../layout/OperationalShell', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

jest.mock('../../../config', () => ({ API_BASE_URL: 'http://localhost:5000' }))
jest.mock('../../../config/navigation', () => ({ getSidebarNav: () => [] }))
jest.mock('../../../utils/api', () => ({
  getAuthToken: () => 'test-token',
  getApiErrorMessage: jest.fn(),
}))
jest.mock('../../../utils/sanitize', () => ({ sanitizeErrorMessage: (message: string) => message }))

const feedbackUser = {
  id: 'supervisor-1',
  email: 'supervisor@example.com',
  username: 'supervisor',
  role: 'supervisor' as const,
  full_name: 'Supervisor One',
}

describe('FeedbackForm rating', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ has_submitted: false }),
    })
  })

  it('shows a filled rating state and a numeric score after selection', async () => {
    const user = userEvent.setup()
    render(<FeedbackForm user={feedbackUser} onLogout={jest.fn()} />)

    await waitFor(() => expect(screen.getByRole('radio', { name: 'Rate 4 out of 5' })).toBeInTheDocument())
    await user.click(screen.getByRole('radio', { name: 'Rate 4 out of 5' }))

    expect(screen.getByRole('radio', { name: 'Rate 4 out of 5' })).toBeChecked()
    expect(screen.getByText('4/5')).toBeInTheDocument()
    expect(screen.getByText('Selected: 4 stars (4/5).')).toBeInTheDocument()
  })
})
