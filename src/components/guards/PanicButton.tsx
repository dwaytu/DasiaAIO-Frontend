import { FC, useState, useCallback, useEffect, useRef } from 'react'
import { API_BASE_URL, detectRuntimePlatform } from '../../config'
import { fetchJsonOrThrow, getAuthToken, isOfflineRequestError } from '../../utils/api'
import { enqueueOfflineAction } from '../../utils/offlineQueue'
import { resolveLocationWithFallback } from '../../utils/location'

interface PanicButtonProps {
  userId: string
  userDisplayName?: string
  siteName?: string
}

type ButtonState = 'idle' | 'sending' | 'sent' | 'queued' | 'failed'

const PanicButton: FC<PanicButtonProps> = ({ userId, userDisplayName, siteName }) => {
  const [state, setState] = useState<ButtonState>('idle')
  const [failureMessage, setFailureMessage] = useState('')
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    }
  }, [])

  const handlePanic = useCallback(async () => {
    if (state === 'sending') return

    setState('sending')
    setFailureMessage('')

    try {
      navigator.vibrate?.([200, 100, 200])
    } catch {
      // vibration API unsupported — ignore
    }

    let location = 'Location unavailable'
    try {
      const platform = detectRuntimePlatform()
      const resolvedLocation = await resolveLocationWithFallback(platform)
      const coordinates = `${resolvedLocation.latitude.toFixed(6)}, ${resolvedLocation.longitude.toFixed(6)}`
      location = resolvedLocation.source === 'ip' ? `${coordinates} (approximate)` : coordinates
    } catch {
      // GPS unavailable or timed out — proceed without location
    }

    const payload = {
      title: '\u{1F6A8} SOS EMERGENCY',
      description: `Emergency panic alert triggered by ${userDisplayName || userId}`,
      location,
      siteName: siteName?.trim() || undefined,
      priority: 'critical',
    }

    const token = getAuthToken()
    try {
      await fetchJsonOrThrow(
        `${API_BASE_URL}/api/incidents`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        },
        'Unable to send SOS alert',
      )
      setState('sent')
    } catch (error) {
      if (isOfflineRequestError(error)) {
        try {
          await enqueueOfflineAction({
            url: `${API_BASE_URL}/api/incidents`,
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            body: payload,
            actionType: 'sos',
          })
          setState('queued')
        } catch {
          setFailureMessage('SOS could not be sent or saved offline. Try again now.')
          setState('failed')
        }
      } else {
        setFailureMessage(error instanceof Error ? error.message : 'Unable to send SOS alert.')
        setState('failed')
      }
    }

    if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    resetTimerRef.current = setTimeout(() => {
      setState('idle')
      setFailureMessage('')
      resetTimerRef.current = null
    }, 5000)
  }, [siteName, state, userDisplayName, userId])

  return (
    <div className="fixed bottom-32 right-4 z-(--z-toast) flex flex-col items-center gap-1">
      <span
        className="absolute inset-0 m-auto h-16 w-16 animate-ping rounded-full bg-danger opacity-30"
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={() => void handlePanic()}
        disabled={state === 'sending'}
        aria-label="Emergency SOS — tap to send distress signal"
        className="soc-btn soc-btn-emergency relative h-16 w-16 min-h-16 min-w-16 rounded-full p-0 text-lg font-black shadow-lg transition-transform active:scale-95"
      >
        {state === 'idle' && 'SOS'}
        {state === 'sending' && (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
        )}
        {(state === 'sent' || state === 'queued') && '\u2713'}
        {state === 'failed' && '!'}
      </button>
      {state === 'sent' && (
        <div
          role="status"
          aria-live="assertive"
          className="soc-status-success mt-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs shadow"
        >
          SOS Sent ✓
        </div>
      )}
      {state === 'queued' && (
        <div
          role="status"
          aria-live="assertive"
          className="mt-1 whitespace-nowrap rounded-md bg-warning-bg px-2 py-0.5 text-xs font-bold text-warning-text shadow"
        >
          SOS queued offline
        </div>
      )}
      {state === 'failed' && (
        <div
          role="alert"
          className="mt-1 max-w-64 rounded-md bg-danger-bg px-2 py-1 text-center text-xs font-bold text-danger-text shadow"
        >
          {failureMessage}
        </div>
      )}
    </div>
  )
}

export default PanicButton
