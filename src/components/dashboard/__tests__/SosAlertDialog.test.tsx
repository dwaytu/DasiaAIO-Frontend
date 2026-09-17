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
})
