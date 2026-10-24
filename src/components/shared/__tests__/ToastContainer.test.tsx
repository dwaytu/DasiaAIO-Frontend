import { fireEvent, render, screen } from '@testing-library/react'
import ToastContainer from '../ToastContainer'
import { useUI } from '../../../hooks/useUI'

jest.mock('../../../hooks/useUI', () => ({
  useUI: jest.fn(),
}))

const useUIMock = useUI as jest.MockedFunction<typeof useUI>

describe('ToastContainer', () => {
  it('uses the non-blocking feedback lane and shows the newest three messages', () => {
    useUIMock.mockReturnValue({
      toasts: [
        { id: 'one', type: 'info', message: 'First update' },
        { id: 'two', type: 'success', message: 'Second update' },
        { id: 'three', type: 'warning', message: 'Third update' },
        { id: 'four', type: 'error', message: 'Fourth update' },
      ],
      removeToast: jest.fn(),
    } as unknown as ReturnType<typeof useUI>)

    render(<ToastContainer />)

    const region = screen.getByLabelText('Notifications')
    expect(region.className).toContain('bottom-[calc(5rem+env(safe-area-inset-bottom,0px))]')
    expect(region.className).toContain('md:bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))]')
    expect(region.className).not.toContain('md:top-')
    expect(screen.queryByText('First update')).not.toBeInTheDocument()
    expect(screen.getByText('Fourth update')).toBeInTheDocument()
    expect(screen.getByText('Fourth update').parentElement).toHaveClass('animate-notification-enter')
  })

  it('keeps the dismiss control usable', () => {
    const removeToast = jest.fn()
    useUIMock.mockReturnValue({
      toasts: [{ id: 'schedule-created', type: 'success', message: 'Schedule created successfully' }],
      removeToast,
    } as unknown as ReturnType<typeof useUI>)

    render(<ToastContainer />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))

    expect(removeToast).toHaveBeenCalledWith('schedule-created')
  })
})
