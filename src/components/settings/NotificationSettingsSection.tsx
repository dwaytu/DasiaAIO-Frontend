import { FC, useEffect, useState } from 'react'
import {
  registerServiceWorker,
  requestPushPermission,
  subscribeToPush,
  unsubscribeFromPush,
} from '../../utils/pushNotifications'
import StatusSwitch from './StatusSwitch'
import {
  isEmergencyAudioBeaconEnabled,
  playTacticalSosChime,
  setEmergencyAudioBeaconEnabled,
} from '../../utils/tacticalAudio'

type NotificationSettingsSectionProps = {
  userId: string
}

export const NotificationSettingsSection: FC<NotificationSettingsSectionProps> = ({ userId }) => {
  const [available, setAvailable] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [audioBeaconEnabled, setAudioBeaconEnabled] = useState(isEmergencyAudioBeaconEnabled)
  const [testingAudio, setTestingAudio] = useState(false)

  useEffect(() => {
    let cancelled = false
    const loadSubscription = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return
      try {
        await registerServiceWorker()
        const registration = await navigator.serviceWorker.getRegistration('/sw.js')
        if (cancelled || !registration) return
        const subscription = await registration.pushManager.getSubscription()
        if (!cancelled) {
          setAvailable(true)
          setEnabled(subscription !== null)
        }
      } catch {
        if (!cancelled) setAvailable(false)
      }
    }
    void loadSubscription()
    return () => { cancelled = true }
  }, [])

  const togglePush = async () => {
    if (saving || !available) return
    setSaving(true)
    setMessage('')
    try {
      if (enabled) {
        await unsubscribeFromPush()
        setEnabled(false)
        setMessage('Device push notifications are off.')
        return
      }
      const granted = await requestPushPermission()
      if (!granted) {
        setMessage('Notification permission was not granted on this device.')
        return
      }
      const subscribed = await subscribeToPush(userId)
      if (!subscribed) {
        setMessage('Unable to enable device push notifications right now.')
        return
      }
      setEnabled(true)
      setMessage('Device push notifications are on.')
    } catch {
      setMessage('Unable to update device push notifications right now.')
    } finally {
      setSaving(false)
    }
  }

  const toggleAudioBeacon = () => {
    const next = !audioBeaconEnabled
    setEmergencyAudioBeaconEnabled(next)
    setAudioBeaconEnabled(next)
    setMessage(next ? 'Emergency audio beacon is on for this device.' : 'Emergency audio beacon is off for this device.')
  }

  const testAudioBeacon = async () => {
    if (!audioBeaconEnabled || testingAudio) return
    setTestingAudio(true)
    setMessage('')
    const played = await playTacticalSosChime().completed
    setMessage(played ? 'Test alert chime played on this device.' : 'This browser blocked or does not support the test alert chime.')
    setTestingAudio(false)
  }

  return (
    <section className="command-panel soc-panel-pad" aria-labelledby="notifications-settings-title">
      <h2 id="notifications-settings-title" className="text-xl font-bold text-text-primary md:text-2xl">
        Notifications
      </h2>
      <p className="mt-2 text-sm text-text-secondary">
        Choose whether this device can receive SENTINEL push alerts.
      </p>
      <div className="mt-4 flex items-center justify-between gap-4 rounded border border-border bg-surface p-4">
        <div className="min-w-0">
          <p className="font-semibold text-text-primary">Device push notifications</p>
          <p className="mt-1 text-sm leading-5 text-text-secondary">
            {available
              ? 'Receive supported operational alerts on this device when permission is granted.'
              : 'Push notifications are not available in this browser or device environment.'}
          </p>
        </div>
        <StatusSwitch
          checked={enabled}
          disabled={!available || saving}
          label="Device push notifications"
          onToggle={() => void togglePush()}
        />
      </div>
      <div className="mt-3 flex flex-col gap-3 rounded border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-text-primary">Emergency Audio Beacon</p>
          <p className="mt-1 text-sm leading-5 text-text-secondary">Play a subtle synthetic chime when this device receives a new critical SOS alert. This preference is stored on this device only.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => void testAudioBeacon()} disabled={!audioBeaconEnabled || testingAudio} className="soc-btn soc-btn-secondary min-h-11 px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50">
            {testingAudio ? 'Testing...' : 'Test Alert Chime'}
          </button>
          <StatusSwitch checked={audioBeaconEnabled} label="Emergency Audio Beacon" onToggle={toggleAudioBeacon} />
        </div>
      </div>
      {message ? <p className="mt-3 text-sm text-text-secondary" role="status">{message}</p> : null}
    </section>
  )
}

export default NotificationSettingsSection
