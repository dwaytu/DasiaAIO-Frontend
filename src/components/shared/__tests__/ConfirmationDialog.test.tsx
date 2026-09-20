import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ConfirmationDialog from '../ConfirmationDialog'

describe('ConfirmationDialog', () => {
  it('does not invoke the action when cancelled', () => {
    const onConfirm = jest.fn()
    const onClose = jest.fn()

    render(
      <ConfirmationDialog
        open
        onClose={onClose}
        onConfirm={onConfirm}
        title="Remove resource?"
        description="The selected resource will be removed."
        confirmLabel="Remove"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onConfirm).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('confirms the action once and closes the dialog', async () => {
    let resolveConfirmation: (() => void) | undefined
    const onConfirm = jest.fn(() => new Promise<void>((resolve) => {
      resolveConfirmation = resolve
    }))
    const onClose = jest.fn()

    render(
      <ConfirmationDialog
        open
        onClose={onClose}
        onConfirm={onConfirm}
        title="Remove resource?"
        description="The selected resource will be removed."
        confirmLabel="Remove"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirming...' }))

    expect(screen.getByRole('button', { name: 'Confirming...' })).toBeDisabled()
    expect(onConfirm).toHaveBeenCalledTimes(1)
    resolveConfirmation?.()

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })
})
