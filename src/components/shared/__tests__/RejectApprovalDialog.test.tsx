import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RejectApprovalDialog from '../RejectApprovalDialog'

const approval = {
  id: 'guard-1',
  fullName: 'Juan Dela Cruz',
  username: 'juan.guard',
  email: 'juan@example.test',
}

describe('RejectApprovalDialog', () => {
  it('opens with guard-account context and cancels without submitting', async () => {
    const onSubmit = jest.fn()
    const onClose = jest.fn()
    const user = userEvent.setup()

    render(<RejectApprovalDialog approval={approval} submitting={false} onClose={onClose} onSubmit={onSubmit} />)

    expect(screen.getByRole('dialog')).toHaveTextContent('Reject guard account "Juan Dela Cruz"?')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not submit an empty or whitespace-only reason', async () => {
    const onSubmit = jest.fn()
    const user = userEvent.setup()

    render(<RejectApprovalDialog approval={approval} submitting={false} onClose={jest.fn()} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/Reason for rejection/i), '   ')
    await user.click(screen.getByRole('button', { name: 'Reject request' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a reason for rejection.')
    expect(screen.getByLabelText(/Reason for rejection/i)).toHaveFocus()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits a trimmed reason once and closes after a successful rejection', async () => {
    const onSubmit = jest.fn().mockResolvedValue(true)
    const onClose = jest.fn()
    const user = userEvent.setup()

    render(<RejectApprovalDialog approval={approval} submitting={false} onClose={onClose} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/Reason for rejection/i), ' Missing required documents ')
    await user.click(screen.getByRole('button', { name: 'Reject request' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('Missing required documents'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('prevents duplicate submissions while rejection is processing', async () => {
    let resolveSubmission: ((succeeded: boolean) => void) | undefined
    const onSubmit = jest.fn(() => new Promise<boolean>((resolve) => {
      resolveSubmission = resolve
    }))
    const onClose = jest.fn()
    const user = userEvent.setup()

    render(<RejectApprovalDialog approval={approval} submitting={false} onClose={onClose} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/Reason for rejection/i), 'Incomplete verification')
    await user.click(screen.getByRole('button', { name: 'Reject request' }))
    fireEvent.click(screen.getByRole('button', { name: 'Rejecting...' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Rejecting...' })).toBeDisabled()
    resolveSubmission?.(true)
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('keeps the dialog and entered reason when rejection fails', async () => {
    const onSubmit = jest.fn().mockResolvedValue(false)
    const user = userEvent.setup()

    render(<RejectApprovalDialog approval={approval} submitting={false} onClose={jest.fn()} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/Reason for rejection/i), 'License details could not be verified')
    await user.click(screen.getByRole('button', { name: 'Reject request' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reject this guard account. Try again.')
    expect(screen.getByLabelText(/Reason for rejection/i)).toHaveValue('License details could not be verified')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
