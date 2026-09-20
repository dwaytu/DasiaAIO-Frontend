import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CreateGuardAccountModal from '../CreateGuardAccountModal'
import { fetchJsonOrThrow } from '../../../utils/api'

jest.mock('../../../config', () => ({ API_BASE_URL: 'http://localhost:5000' }))
jest.mock('../../../utils/api', () => ({
  fetchJsonOrThrow: jest.fn(),
  getAuthHeaders: jest.fn(() => ({ Authorization: 'Bearer test-token' })),
}))

const fetchMock = fetchJsonOrThrow as jest.MockedFunction<typeof fetchJsonOrThrow>

describe('CreateGuardAccountModal', () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue({ guardCode: 'G-0181', requiresApproval: false })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('shows the server-assigned Guard ID after creating a guard account', async () => {
    const user = userEvent.setup()
    const onCreated = jest.fn()

    render(
      <CreateGuardAccountModal
        isOpen
        onClose={jest.fn()}
        viewerRole="admin"
        onCreated={onCreated}
      />,
    )

    await user.type(screen.getByLabelText('Full Name'), 'Juan Dela Cruz')
    const username = screen.getByLabelText('Username')
    const email = screen.getByLabelText('Email')
    await user.clear(username)
    await user.type(username, 'juan_guard')
    await user.clear(email)
    await user.type(email, 'juan@example.test')
    await user.type(screen.getByLabelText('Password'), 'SecurePass123!')
    await user.type(screen.getByLabelText('Phone Number'), '09171234567')
    await user.type(screen.getByLabelText('License Number'), 'LIC-001')
    fireEvent.change(screen.getByLabelText('License Expiry Date'), { target: { value: '2027-01-01' } })

    await user.click(screen.getByRole('button', { name: 'Create Guard Account' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(screen.getByText('Guard account created successfully.')).toBeInTheDocument()
    expect(screen.getByText('Guard ID: G-0181')).toBeInTheDocument()
    expect(onCreated).toHaveBeenCalledWith({
      guardCode: 'G-0181',
      fullName: 'Juan Dela Cruz',
      requiresApproval: false,
    })
  })
})
