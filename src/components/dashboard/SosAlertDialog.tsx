import { AlertTriangle, Check, CheckCircle2, MapPin, X } from 'lucide-react'
import { FC, useEffect, useRef, useState } from 'react'
import type { Incident } from '../../hooks/useIncidents'
import { isEmergencyAudioBeaconEnabled, playTacticalSosChime } from '../../utils/tacticalAudio'

// Do not replay an alarm for an incident an operator is merely revisiting.
// One minute covers normal polling and rendering delay while keeping the alert
// tied to a newly opened, unacknowledged SOS.
const SOS_CHIME_FRESHNESS_MS = 60_000

interface SosAlertDialogProps {
  incident: Incident
  onUpdateStatus: (incidentId: string, status: 'investigating' | 'resolved') => Promise<void>
  onDismiss: () => void
  onFocusMap?: (latitude: number, longitude: number) => void
}

const SosAlertDialog: FC<SosAlertDialogProps> = ({ incident, onUpdateStatus, onDismiss, onFocusMap }) => {
  const dismissButtonRef = useRef<HTMLButtonElement>(null)
  const [processing, setProcessing] = useState<'acknowledge' | 'resolve' | ''>('')
  const [error, setError] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const canFocusMap = Number.isFinite(incident.latitude) && Number.isFinite(incident.longitude)
  const responseTime = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:${String(elapsedSeconds % 60).padStart(2, '0')}`

  useEffect(() => {
    dismissButtonRef.current?.focus()
  }, [incident.id])

  useEffect(() => {
    const incidentTime = Date.parse(incident.created_at)
    const updateElapsed = () => {
      const elapsed = Number.isFinite(incidentTime)
        ? Math.max(0, Math.floor((Date.now() - incidentTime) / 1000))
        : 0
      setElapsedSeconds(elapsed)
    }
    updateElapsed()
    const timer = window.setInterval(updateElapsed, 1000)
    return () => window.clearInterval(timer)
  }, [incident.created_at])

  useEffect(() => {
    if (incident.status !== 'open' || !isEmergencyAudioBeaconEnabled()) return

    const openedAt = Date.parse(incident.created_at)
    if (!Number.isFinite(openedAt) || Date.now() - openedAt > SOS_CHIME_FRESHNESS_MS) return

    const playback = playTacticalSosChime()
    return () => playback.stop()
  }, [incident.id, incident.status])

  const handleFocusMap = () => {
    if (!canFocusMap) return
    const latitude = incident.latitude as number
    const longitude = incident.longitude as number
    window.dispatchEvent(new CustomEvent('sentinel:focus-map', { detail: { latitude, longitude } }))
    onFocusMap?.(latitude, longitude)
  }

  const handleStatusUpdate = async (status: 'investigating' | 'resolved') => {
    setProcessing(status === 'investigating' ? 'acknowledge' : 'resolve')
    setError('')

    try {
      await onUpdateStatus(incident.id, status)
      onDismiss()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update the SOS incident.')
    } finally {
      setProcessing('')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/75 p-4 pt-6 backdrop-blur-sm animate-fade-in sm:items-center"
      role="presentation"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !processing) onDismiss()
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sos-alert-title"
        aria-describedby="sos-alert-description"
        className="soc-modal-surface flex max-h-[calc(100dvh-10rem)] w-full max-w-xl flex-col overflow-hidden rounded-md border-2 border-danger-border bg-surface-elevated shadow-2xl sm:max-h-[calc(100dvh-3rem)]"
      >
        <header className="shrink-0 flex flex-wrap items-start gap-3 border-b border-danger-border bg-danger-bg px-5 py-4 sm:flex-nowrap sm:gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-danger text-white animate-pulse" aria-hidden="true">
              <AlertTriangle className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-danger-text">Immediate attention required</p>
              <h2 id="sos-alert-title" className="mt-1 text-xl font-black uppercase tracking-wide text-text-primary">
                SOS emergency alert
              </h2>
            </div>
          </div>
          <span className="ml-auto rounded-full border border-danger-border bg-surface px-2.5 py-1 text-xs font-bold tabular-nums text-danger-text">Response Time: {responseTime}</span>
          <button
            ref={dismissButtonRef}
            type="button"
            onClick={onDismiss}
            disabled={Boolean(processing)}
            className="soc-btn soc-btn-neutral soc-btn-icon min-h-11 min-w-11 shrink-0 p-0"
            aria-label="Dismiss SOS popup"
            title="Dismiss popup"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <p id="sos-alert-description" className="text-base font-semibold text-text-primary">
            {incident.description || 'A guard has triggered an emergency panic alert.'}
          </p>

          <dl className="grid gap-3 rounded border border-border bg-background p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-text-tertiary">Reported by</dt>
              <dd className="mt-1 font-semibold text-text-primary">{incident.reported_by_name || incident.reported_by || 'Guard account'}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-text-tertiary">Time received</dt>
              <dd className="mt-1 font-semibold text-text-primary">{new Date(incident.created_at).toLocaleString()}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-text-tertiary">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> Location
              </dt>
              <dd className="mt-1 break-words font-semibold text-text-primary">
                {incident.site_name || 'Site not identified'}
                {incident.location ? ` - ${incident.location}` : ''}
              </dd>
            </div>
          </dl>

          {error ? (
            <p role="alert" className="rounded border border-danger-border bg-danger-bg p-3 text-sm font-semibold text-danger-text">
              {error}
            </p>
          ) : null}

        </div>
        <div className="shrink-0 flex flex-wrap justify-end gap-2 border-t border-border-subtle bg-surface-elevated px-5 py-4">
          {canFocusMap ? <button type="button" onClick={handleFocusMap} className="soc-btn soc-btn-secondary min-h-11 px-4"><MapPin className="h-4 w-4" aria-hidden="true" /> Focus on Map</button> : null}
          {incident.contact_number ? <a href={`tel:${incident.contact_number}`} className="soc-btn soc-btn-secondary inline-flex min-h-11 items-center px-4">Call Guard</a> : null}
          <button
            type="button"
            onClick={() => void handleStatusUpdate('investigating')}
            disabled={Boolean(processing)}
            className="soc-btn soc-btn-warning min-h-11 px-4"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            {processing === 'acknowledge' ? 'Acknowledging...' : 'Acknowledge'}
          </button>
          <button
            type="button"
            onClick={() => void handleStatusUpdate('resolved')}
            disabled={Boolean(processing)}
            className="soc-btn soc-btn-danger min-h-11 px-4"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {processing === 'resolve' ? 'Resolving...' : 'Resolve SOS'}
          </button>
        </div>
      </section>
    </div>
  )
}

export default SosAlertDialog
