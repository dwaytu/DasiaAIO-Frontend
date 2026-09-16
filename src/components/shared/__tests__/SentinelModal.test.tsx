import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SentinelModal from '../SentinelModal'

function ModalHarness() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open modal</button>
      <SentinelModal open={open} onClose={() => setOpen(false)} title="Review item" subtitle="Check the request before continuing.">
        <button type="button">Confirm action</button>
      </SentinelModal>
    </>
  )
}

describe('SentinelModal', () => {
  it('moves focus into the dialog, traps tab focus, and restores the trigger focus', async () => {
    const user = userEvent.setup()
    render(<ModalHarness />)

    const trigger = screen.getByRole('button', { name: 'Open modal' })
    await user.click(trigger)

    const closeButton = screen.getByRole('button', { name: 'Close dialog' })
    expect(closeButton).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Confirm action' })).toHaveFocus()

    await user.tab()
    expect(closeButton).toHaveFocus()

    fireEvent.click(closeButton)
    expect(trigger).toHaveFocus()
  })
})
