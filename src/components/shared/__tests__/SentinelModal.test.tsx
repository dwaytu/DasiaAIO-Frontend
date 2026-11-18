import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SentinelModal from '../SentinelModal'

function ModalHarness() {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open modal</button>
      <SentinelModal open={open} onClose={() => setOpen(false)} title="Review item" subtitle="Check the request before continuing.">
        <input aria-label="A/C number" value={value} onChange={(event) => setValue(event.target.value)} />
        <button type="button">Confirm action</button>
      </SentinelModal>
    </>
  )
}

describe('SentinelModal', () => {
  it('closes only the topmost modal on Escape and restores focus to its trigger', async () => {
    const user = userEvent.setup()
    function NestedHarness() {
      const [outer, setOuter] = useState(true)
      const [inner, setInner] = useState(false)
      return <>
        <SentinelModal open={outer} onClose={() => setOuter(false)} title="Details">
          <button onClick={() => setInner(true)}>Remove</button>
        </SentinelModal>
        <SentinelModal open={inner} onClose={() => setInner(false)} title="Confirm removal">
          <button>Confirm</button>
        </SentinelModal>
      </>
    }
    render(<NestedHarness />)
    const trigger = screen.getByRole('button', { name: 'Remove' })
    await user.click(trigger)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Confirm removal' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Details' })).toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
  it('renders its backdrop outside the invoking layout stacking context', async () => {
    const user = userEvent.setup()
    const { container } = render(<div style={{ transform: 'translateY(0)', overflow: 'hidden' }}><ModalHarness /></div>)
    await user.click(screen.getByRole('button', { name: 'Open modal' }))
    const dialog = screen.getByRole('dialog', { name: 'Review item' })
    expect(container).not.toContainElement(dialog)
    expect(dialog.parentElement?.parentElement).toBe(document.body)
  })
  it('moves focus into the dialog, traps tab focus, and restores the trigger focus', async () => {
    const user = userEvent.setup()
    render(<ModalHarness />)

    const trigger = screen.getByRole('button', { name: 'Open modal' })
    await user.click(trigger)

    const closeButton = screen.getByRole('button', { name: 'Close dialog' })
    expect(closeButton).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('textbox', { name: 'A/C number' })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Confirm action' })).toHaveFocus()

    await user.tab()
    expect(closeButton).toHaveFocus()

    fireEvent.click(closeButton)
    expect(trigger).toHaveFocus()
  })

  it('keeps focus in a controlled input when the modal content rerenders', async () => {
    const user = userEvent.setup()
    render(<ModalHarness />)

    await user.click(screen.getByRole('button', { name: 'Open modal' }))
    const input = screen.getByRole('textbox', { name: 'A/C number' })

    await user.click(input)
    await user.type(input, '123')

    expect(input).toHaveValue('123')
    expect(input).toHaveFocus()
  })

  it('focuses the first action and keeps focus inside a non-dismissible prompt', async () => {
    const user = userEvent.setup()
    render(
      <SentinelModal open onClose={jest.fn()} title="Terms of Agreement" dismissible={false}>
        <button type="button">Decline</button>
        <button type="button">Agree and Continue</button>
      </SentinelModal>,
    )

    const decline = screen.getByRole('button', { name: 'Decline' })
    expect(decline).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Close dialog' })).not.toBeInTheDocument()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Agree and Continue' })).toHaveFocus()

    await user.tab()
    expect(decline).toHaveFocus()
  })
})
