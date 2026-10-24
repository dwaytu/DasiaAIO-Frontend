import { fireEvent, render, screen } from '@testing-library/react'
import NotificationCenter, { type Notification } from '../NotificationCenter'

const notification = (id: string, title: string, type: Notification['type'] = 'success'): Notification => ({
  id,
  type,
  title,
  message: `${title} message`,
  timestamp: new Date('2026-10-23T10:13:48'),
})

describe('NotificationCenter', () => {
  it('uses a bottom-safe lane instead of covering the page action area', () => {
    render(<NotificationCenter notifications={[notification('schedule-created', 'Schedule Created')]} onDismiss={jest.fn()} />)

    const region = screen.getByLabelText('Notifications')
    expect(region.className).toContain('bottom-[calc(5rem+env(safe-area-inset-bottom,0px))]')
    expect(region.className).not.toContain('top-[calc(1rem+env(safe-area-inset-top,0px))]')
    expect(region.className).toContain('md:bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))]')
    expect(region.className).not.toContain('md:top-')
  })

  it('keeps the latest three notifications and makes errors assertive', () => {
    const notifications = [
      notification('one', 'First'),
      notification('two', 'Second'),
      notification('three', 'Third'),
      notification('four', 'Fourth', 'error'),
    ]

    render(<NotificationCenter notifications={notifications} onDismiss={jest.fn()} />)

    expect(screen.queryByText('First')).not.toBeInTheDocument()
    expect(screen.getByText('Fourth')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Fourth')
  })

  it('dismisses a notification from its accessible close button', () => {
    const onDismiss = jest.fn()
    render(<NotificationCenter notifications={[notification('schedule-created', 'Schedule Created')]} onDismiss={onDismiss} />)

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification: Schedule Created' }))

    expect(onDismiss).toHaveBeenCalledWith('schedule-created')
  })
})
