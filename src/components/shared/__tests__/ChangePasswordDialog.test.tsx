import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChangePasswordDialog from '../ChangePasswordDialog'

jest.mock('../../../config', () => ({ API_BASE_URL: 'http://localhost:5000' }))

describe('ChangePasswordDialog', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token')
    global.fetch = jest.fn()
  })

  afterEach(() => jest.restoreAllMocks())

  it('validates required values before sending a request', async () => {
    const user = userEvent.setup()
    render(<ChangePasswordDialog userId="user-1" open onClose={jest.fn()} onSuccess={jest.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Change Password' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Enter your current password.')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('submits the existing password-change payload once and closes on success', async () => {
    const user = userEvent.setup()
    const onClose = jest.fn()
    const onSuccess = jest.fn()
    ;(global.fetch as jest.Mock).mockResolvedValue(new Response(JSON.stringify({ message: 'Password changed successfully' }), { status: 200 }))
    render(<ChangePasswordDialog userId="user-1" open onClose={onClose} onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText('Current password'), 'OldPassword!123')
    await user.type(screen.getByLabelText('New password'), 'NewPassword!123')
    await user.type(screen.getByLabelText('Confirm new password'), 'NewPassword!123')
    await user.click(screen.getByRole('button', { name: 'Change Password' }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/users/user-1/password/change'), expect.objectContaining({ method: 'POST', body: JSON.stringify({ currentPassword: 'OldPassword!123', newPassword: 'NewPassword!123' }) }))
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
