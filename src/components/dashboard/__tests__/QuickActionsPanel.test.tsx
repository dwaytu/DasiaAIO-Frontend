import { render, screen } from '@testing-library/react'
import QuickActionsPanel from '../QuickActionsPanel'

describe('QuickActionsPanel', () => {
  it('keeps command labels readable and exposes a matching accessible name', () => {
    render(
      <QuickActionsPanel
        actions={[{ label: 'Allocate Firearm', onClick: jest.fn(), tone: 'blue' }]}
      />,
    )

    const action = screen.getByRole('button', { name: 'Allocate Firearm' })
    expect(action).toHaveAttribute('title', 'Allocate Firearm')
    expect(action).toHaveClass('text-sm')
    expect(action).not.toHaveClass('uppercase')
  })
})
