import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StatusSwitch from '../StatusSwitch'

describe('StatusSwitch', () => {
  it('uses color and thumb position while preserving switch semantics', async () => {
    const user = userEvent.setup()
    const onToggle = jest.fn()
    const { rerender } = render(
      <StatusSwitch checked label="Device push notifications" onToggle={onToggle} />,
    )

    const control = screen.getByRole('switch', { name: 'Device push notifications' })
    expect(control).toHaveAttribute('aria-checked', 'true')
    expect(control).toHaveClass('bg-(--color-primary)')
    expect(control).toHaveClass('!min-h-6', 'h-6', 'w-11', '!rounded-full')
    expect(control.firstElementChild).toHaveClass('h-[1.125rem]', 'w-[1.125rem]', 'translate-x-5')
    expect(screen.queryByText('ON')).not.toBeInTheDocument()

    await user.click(control)
    expect(onToggle).toHaveBeenCalledTimes(1)

    rerender(<StatusSwitch checked={false} label="Device push notifications" onToggle={onToggle} />)
    expect(screen.getByRole('switch', { name: 'Device push notifications' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('switch', { name: 'Device push notifications' })).toHaveClass('bg-(--color-surface-elevated)')
    expect(screen.getByRole('switch', { name: 'Device push notifications' }).firstElementChild).toHaveClass('translate-x-0')
    expect(screen.queryByText('OFF')).not.toBeInTheDocument()
  })
})
