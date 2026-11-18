import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotificationSettingsSection from '../NotificationSettingsSection'
import { playTacticalSosChime, setEmergencyAudioBeaconEnabled } from '../../../utils/tacticalAudio'

jest.mock('../../../utils/pushNotifications', () => ({
  registerServiceWorker: jest.fn(), requestPushPermission: jest.fn(), subscribeToPush: jest.fn(), unsubscribeFromPush: jest.fn(),
}))
jest.mock('../../../utils/tacticalAudio', () => ({
  isEmergencyAudioBeaconEnabled: jest.fn(() => true),
  setEmergencyAudioBeaconEnabled: jest.fn(),
  playTacticalSosChime: jest.fn(() => ({ completed: Promise.resolve(true), stop: jest.fn() })),
}))

describe('NotificationSettingsSection emergency audio beacon', () => {
  it('keeps emergency audio device-local and tests the same tactical chime', async () => {
    const user = userEvent.setup()
    render(<NotificationSettingsSection userId="admin-1" />)

    expect(screen.getByText(/This preference is stored on this device only/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Test Alert Chime' }))
    expect(playTacticalSosChime).toHaveBeenCalled()

    await user.click(screen.getByRole('switch', { name: 'Emergency Audio Beacon' }))
    expect(setEmergencyAudioBeaconEnabled).toHaveBeenCalledWith(false)
  })
})
