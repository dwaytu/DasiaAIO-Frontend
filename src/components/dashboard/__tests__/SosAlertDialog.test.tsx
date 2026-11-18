import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SosAlertDialog from '../SosAlertDialog'
import type { Incident } from '../../../hooks/useIncidents'

const incident: Incident = {
  id: 'incident-1',
  title: 'SOS EMERGENCY',
  description: 'Emergency panic alert triggered by Guard One',
  location: '7.123456, 125.654321',
  site_name: 'DSIA - Tagum',
  reported_by: 'guard-1',
  reported_by_name: 'Guard One',
  status: 'open',
  priority: 'critical',
  created_at: '2026-09-17T02:45:00.000Z',
  updated_at: '2026-09-17T02:45:00.000Z',
}

describe('SosAlertDialog', () => {
  it('shows the emergency context and acknowledges the incident', async () => {
    const user = userEvent.setup()
    const onUpdateStatus = jest.fn().mockResolvedValue(undefined)
    const onDismiss = jest.fn()

    render(
      <SosAlertDialog
        incident={incident}
        onUpdateStatus={onUpdateStatus}
        onDismiss={onDismiss}
      />,
    )

    expect(screen.getByRole('alertdialog', { name: /sos emergency alert/i })).toBeInTheDocument()
    expect(screen.getByText('Guard One')).toBeInTheDocument()
    expect(screen.getByText(/DSIA - Tagum/)).toBeInTheDocument()
    expect(screen.getByText(/7\.123456, 125\.654321/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Acknowledge' }))

    await waitFor(() => {
      expect(onUpdateStatus).toHaveBeenCalledWith('incident-1', 'investigating')
      expect(onDismiss).toHaveBeenCalledTimes(1)
    })
  })

  it('resolves the SOS and allows dismissal without changing its status', async () => {
    const user = userEvent.setup()
    const onUpdateStatus = jest.fn().mockResolvedValue(undefined)
    const onDismiss = jest.fn()

    render(
      <SosAlertDialog
        incident={incident}
        onUpdateStatus={onUpdateStatus}
        onDismiss={onDismiss}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Resolve SOS' }))

    await waitFor(() => {
      expect(onUpdateStatus).toHaveBeenCalledWith('incident-1', 'resolved')
    })

    await user.click(screen.getByRole('button', { name: 'Dismiss SOS popup' }))
    expect(onDismiss).toHaveBeenCalledTimes(2)
  })

  it('keeps emergency actions inside a bounded, scrollable dialog on narrow screens', () => {
    render(
      <SosAlertDialog
        incident={incident}
        onUpdateStatus={jest.fn().mockResolvedValue(undefined)}
        onDismiss={jest.fn()}
      />,
    )

    const dialog = screen.getByRole('alertdialog', { name: /sos emergency alert/i })
    expect(dialog).toHaveClass('max-h-[calc(100dvh-10rem)]', 'sm:max-h-[calc(100dvh-3rem)]', 'flex', 'flex-col')
    expect(screen.getByRole('button', { name: 'Acknowledge' }).parentElement).toHaveClass('shrink-0')
  })

  it('shows live response latency and tactical contact actions when verified data exists', async () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-09-17T02:46:24.000Z'))
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    const onFocusMap = jest.fn()
    const mapFocusListener = jest.fn()
    window.addEventListener('sentinel:focus-map', mapFocusListener)

    try {
      render(
        <SosAlertDialog
          incident={{ ...incident, latitude: 7.123456, longitude: 125.654321, contact_number: '+639171234567' }}
          onUpdateStatus={jest.fn().mockResolvedValue(undefined)}
          onDismiss={jest.fn()}
          onFocusMap={onFocusMap}
        />,
      )

      expect(screen.getByText('Response Time: 01:24')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Call Guard' })).toHaveAttribute('href', 'tel:+639171234567')

      await user.click(screen.getByRole('button', { name: 'Focus on Map' }))

      expect(onFocusMap).toHaveBeenCalledWith(7.123456, 125.654321)
      expect(mapFocusListener).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener('sentinel:focus-map', mapFocusListener)
      jest.useRealTimers()
    }
  })

  it('plays a two-tone native chime only for a recently opened SOS', () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-09-17T02:46:00.000Z'))
    const oscillator = () => ({
      frequency: { value: 0 },
      connect: jest.fn().mockReturnThis(),
      start: jest.fn(),
      stop: jest.fn(),
    })
    const oscillators = [oscillator(), oscillator()]
    const createOscillator = jest.fn()
      .mockReturnValueOnce(oscillators[0])
      .mockReturnValueOnce(oscillators[1])
    const gain = {
      gain: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() },
      connect: jest.fn().mockReturnThis(),
    }
    const audioContext = {
      currentTime: 10,
      destination: {},
      createOscillator,
      createGain: jest.fn(() => gain),
      close: jest.fn().mockResolvedValue(undefined),
    }
    const AudioContextMock = jest.fn(() => audioContext)
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: AudioContextMock })

    try {
      const { rerender, unmount } = render(
        <SosAlertDialog
          incident={{ ...incident, created_at: '2026-09-17T02:45:50.000Z' }}
          onUpdateStatus={jest.fn().mockResolvedValue(undefined)}
          onDismiss={jest.fn()}
        />,
      )

      expect(createOscillator).toHaveBeenCalledTimes(2)
      expect(oscillators.map((tone) => tone.frequency.value)).toEqual([520, 660])

      rerender(
        <SosAlertDialog
          incident={{ ...incident, id: 'incident-old', created_at: '2026-09-17T02:44:00.000Z' }}
          onUpdateStatus={jest.fn().mockResolvedValue(undefined)}
          onDismiss={jest.fn()}
        />,
      )

      expect(createOscillator).toHaveBeenCalledTimes(2)
      unmount()
      expect(audioContext.close).toHaveBeenCalled()
    } finally {
      Object.defineProperty(window, 'AudioContext', { configurable: true, value: undefined })
      jest.useRealTimers()
    }
  })

  it('does not create a chime when this device disables its emergency audio beacon', () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-09-17T02:46:00.000Z'))
    const AudioContextMock = jest.fn()
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: AudioContextMock })
    localStorage.setItem('sentinel_audio_beacon_enabled', 'false')

    try {
      render(<SosAlertDialog incident={{ ...incident, created_at: '2026-09-17T02:45:50.000Z' }} onUpdateStatus={jest.fn()} onDismiss={jest.fn()} />)
      expect(AudioContextMock).not.toHaveBeenCalled()
    } finally {
      localStorage.removeItem('sentinel_audio_beacon_enabled')
      Object.defineProperty(window, 'AudioContext', { configurable: true, value: undefined })
      jest.useRealTimers()
    }
  })
})
