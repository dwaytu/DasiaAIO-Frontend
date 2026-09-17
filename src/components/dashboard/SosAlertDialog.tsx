import { AlertTriangle, Check, CheckCircle2, MapPin, X } from 'lucide-react'
import { FC, useEffect, useRef, useState } from 'react'
import type { Incident } from '../../hooks/useIncidents'

interface SosAlertDialogProps {
  incident: Incident
  onUpdateStatus: (incidentId: string, status: 'investigating' | 'resolved') => Promise<void>
  onDismiss: () => void
}

const SosAlertDialog: FC<SosAlertDialogProps> = ({ incident, onUpdateStatus, onDismiss }) => {
  const dismissButtonRef = useRef<HTMLButtonElement>(null)
  const [processing, setProcessing] = useState<'acknowledge' | 'resolve' | ''>('')
  const [error, setError] = useState('')

  useEffect(() => {
    dismissButtonRef.current?.focus()
  }, [incident.id])

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
      className="fixed inset-0 z-(--z-overlay) flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in"
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
        className="soc-modal-surface w-full max-w-xl overflow-hidden rounded-md border-2 border-danger-border bg-surface-elevated shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-danger-border bg-danger-bg px-5 py-4">
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

        <div className="space-y-4 px-5 py-5">
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

          <div className="flex flex-wrap justify-end gap-2 border-t border-border-subtle pt-4">
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
        </div>
      </section>
    </div>
  )
}

export default SosAlertDialog
