import { render, screen } from '@testing-library/react'
import QuickActionsPanel from '../QuickActionsPanel'

describe('QuickActionsPanel', () => {
  it('keeps command labels readable and exposes a matching accessible name', () => {
    render(
      <QuickActionsPanel
        actions={[{ label: 'Allocate Firearm', onClick: jest.fn(), tone: 'resource' }]}
      />,
    )

    const action = screen.getByRole('button', { name: 'Allocate Firearm' })
    expect(action).toHaveAttribute('title', 'Allocate Firearm')
    expect(action).toHaveClass('text-sm')
    expect(action).not.toHaveClass('uppercase')
    expect(action).toHaveAttribute('data-tone', 'resource')
  })

  it('uses the semantic primary fallback and preserves disabled controls', () => {
    render(<QuickActionsPanel actions={[{ label: 'Assign Shift', onClick: jest.fn(), disabled: true }]} />)
    const action = screen.getByRole('button', { name: 'Assign Shift' })
    expect(action).toHaveAttribute('data-tone', 'primary')
    expect(action).toBeDisabled()
    expect(action).toHaveClass('border-accent-border')
  })
})
