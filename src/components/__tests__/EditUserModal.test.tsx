import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditUserModal from '../EditUserModal'

const account = {
  id: 'guard-1',
  email: 'guard@example.test',
  username: 'fixture_guard',
  role: 'guard',
  full_name: 'DELA CRUZ, JUAN CARLOS P.',
}

describe('Edit User names', () => {
  it('prefills a surname-first name and saves an updated name in the same format', async () => {
    const operator = userEvent.setup()
    const save = jest.fn().mockResolvedValue(undefined)
    render(<EditUserModal user={account} viewerRole="admin" onSave={save} onClose={jest.fn()} />)

    expect(screen.getByLabelText('First Name')).toHaveValue('JUAN CARLOS')
    expect(screen.getByLabelText('Last Name')).toHaveValue('DELA CRUZ')
    const middle = screen.getByLabelText('Middle Initial (optional)')
    expect(middle).toHaveValue('P')
    await operator.clear(middle)
    await operator.type(middle, 'r.')
    await operator.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
      fullName: 'DELA CRUZ, JUAN CARLOS R.',
    })))
  })

  it('preserves an unsplit saved name when updating another field', async () => {
    const operator = userEvent.setup()
    const save = jest.fn().mockResolvedValue(undefined)
    render(<EditUserModal user={{ ...account, full_name: 'LEGACY NAME' }} viewerRole="admin" onSave={save} onClose={jest.fn()} />)

    expect(screen.getByText(/Saved name: LEGACY NAME/)).toBeInTheDocument()
    expect(screen.getByLabelText('First Name')).toHaveValue('')
    expect(screen.getByLabelText('Last Name')).toHaveValue('')
    await operator.type(screen.getByLabelText('Phone Number'), '09170000000')
    await operator.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(save.mock.calls[0][0]).toHaveProperty('phoneNumber', '09170000000')
    expect(save.mock.calls[0][0]).not.toHaveProperty('fullName')
  })

  it('requires both name parts when replacing a legacy name', async () => {
    const operator = userEvent.setup()
    const save = jest.fn().mockResolvedValue(undefined)
    render(<EditUserModal user={{ ...account, full_name: 'LEGACY NAME' }} viewerRole="admin" onSave={save} onClose={jest.fn()} />)

    const submit = screen.getByRole('button', { name: 'Save Changes' })
    await operator.type(screen.getByLabelText('First Name'), 'Juan')
    await operator.click(submit)
    expect(screen.getByRole('alert')).toHaveTextContent('Enter both the first name and last name')
    expect(save).not.toHaveBeenCalled()

    await operator.type(screen.getByLabelText('Last Name'), 'Dela Cruz')
    await operator.click(submit)
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ fullName: 'Dela Cruz, Juan' })))
  })
})
