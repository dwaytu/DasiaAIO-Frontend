import { useState, type FormEvent } from 'react'
import { API_BASE_URL } from '../../config'
import type { OpsShift } from '../../hooks/useOpsShifts'
import { useReplacementSuggestions, type ReplacementSuggestion } from '../../hooks/useReplacementSuggestions'
import { fetchJsonOrThrow, getAuthHeaders } from '../../utils/api'
import SentinelModal from '../shared/SentinelModal'

interface Props {
  shifts: OpsShift[]
  loading: boolean
  error: string
  canAssign: boolean
  onAssigned: () => Promise<void>
}

const manilaTime = new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })
const guardName = (shift: OpsShift) => shift.guard_name || shift.guard_username || 'Unknown guard'
const shiftTime = (date?: string) => date && Number.isFinite(Date.parse(date)) ? manilaTime.format(new Date(date)) : 'Time unavailable'

const ReplacementSuggestionPanel = ({ shifts, loading, error, canAssign, onAssigned }: Props) => {
  const coverageUnavailable = shifts.some((item) => typeof item.replacement_eligible !== 'boolean')
  const eligibleShifts = shifts.filter((shift) => shift.replacement_eligible)
  const [selectedId, setSelectedId] = useState('')
  const shift = eligibleShifts.find((item) => item.id === selectedId) ?? eligibleShifts[0]
  const suggestions = useReplacementSuggestions(error || coverageUnavailable ? undefined : shift?.replacement_site_id, shift?.id, shift?.updated_at)
  const [selection, setSelection] = useState<{ shift: OpsShift; guard: ReplacementSuggestion } | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirmationError, setConfirmationError] = useState('')
  const [success, setSuccess] = useState('')

  const confirmReplacement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selection || !confirmed || submitting || !canAssign) return
    const { shift: target, guard } = selection
    if (error || coverageUnavailable || !target.updated_at || !eligibleShifts.some((item) => item.id === target.id && item.updated_at === target.updated_at)) {
      setConfirmationError('The shift changed. Close this dialog and select it again.')
      return
    }
    setSubmitting(true)
    setConfirmationError('')
    try {
      await fetchJsonOrThrow(`${API_BASE_URL}/api/guard-replacement/confirm-replacement`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          shiftId: target.id,
          originalGuardId: target.guard_id,
          replacementGuardId: guard.guardId,
          shiftUpdatedAt: target.updated_at,
          confirmedAvailable: true,
        }),
      }, 'Could not assign the replacement guard')
      setSuccess(`Replacement assigned to ${guard.guardName} at ${target.client_site}.`)
      setSelection(null)
      await onAssigned()
    } catch (err) {
      setConfirmationError(err instanceof Error ? err.message : 'Could not assign the replacement guard')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section id="smart-guard-replacement" tabIndex={-1} className="command-panel rounded border border-border bg-surface" aria-label="Smart guard replacement suggestions">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-text-primary">Smart Guard Replacement</h3>
          <p className="mt-1 text-xs text-text-secondary">Unarmed coverage</p>
        </div>
        {suggestions.lastUpdated && <span className="font-mono text-xs text-text-secondary">{suggestions.lastUpdated}</span>}
      </div>
      <div className="space-y-3 px-4 py-3">
        {success && <p role="status" className="text-sm text-success-text">{success}</p>}
        {loading && <p className="text-sm text-text-secondary">Loading shifts…</p>}
        {error && <p role="alert" className="text-sm text-danger-text">{error}</p>}
        {!loading && !error && coverageUnavailable && <p role="status" className="text-sm text-warning-text">Replacement coverage status is unavailable.</p>}
        {!loading && !error && !coverageUnavailable && !shift && <p className="text-sm text-text-secondary">No shifts currently need replacement coverage.</p>}
        {!loading && !error && !coverageUnavailable && shift && (
          <>
            <div>
              <label className="soc-form-label" htmlFor="replacement-shift">Shift needing coverage</label>
              <select id="replacement-shift" className="soc-form-control min-h-11 w-full" value={shift.id} onChange={(event) => setSelectedId(event.target.value)}>
                {eligibleShifts.map((item) => (
                  <option key={item.id} value={item.id}>{guardName(item)} · {item.replacement_site_id ? item.client_site : 'Unassigned site'} · {shiftTime(item.start_time)}</option>
                ))}
              </select>
            </div>
            {!shift.replacement_site_id && <p className="text-sm text-warning-text">Set an active client site for this shift in Schedule to find replacements.</p>}
            {suggestions.loading && <p className="text-sm text-text-secondary">Loading replacement candidates…</p>}
            {suggestions.error && <p role="alert" className="text-sm text-danger-text">{suggestions.error}</p>}
            {shift.replacement_site_id && !suggestions.loading && !suggestions.error && suggestions.suggestions.length === 0 && (
              <p className="text-sm text-text-secondary">No available replacement candidates for this shift.</p>
            )}
            {suggestions.suggestions.length > 0 && (
              <ol className="space-y-2">
                {suggestions.suggestions.map((guard, index) => (
                  <li key={guard.guardId} className="rounded border border-border bg-surface-elevated p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{guard.guardName}</p>
                        <p className="mt-1 text-xs text-text-secondary">Reliability {guard.reliabilityScore.toFixed(1)} · {guard.distanceKnown ? `${guard.distanceKm.toFixed(2)} km away` : 'Distance unavailable'}</p>
                      </div>
                      <span className="text-xs text-text-secondary">Rank {index + 1}</span>
                    </div>
                    {guard.availability && canAssign && (
                      <button type="button" aria-label={`Choose replacement: ${guard.guardName}`} className="soc-btn soc-btn-neutral mt-3 min-h-11" disabled={submitting} onClick={() => {
                        setSelection({ shift, guard })
                        setConfirmed(false)
                        setConfirmationError('')
                        setSuccess('')
                      }}>Choose replacement</button>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>

      <SentinelModal open={Boolean(selection)} title="Confirm replacement" dismissible={!submitting} onClose={() => setSelection(null)}>
        {selection && (
          <form onSubmit={confirmReplacement} className="space-y-4">
            <p className="text-sm text-text-primary">Assign <strong>{selection.guard.guardName}</strong> to cover the remainder of <strong>{guardName(selection.shift)}</strong>’s shift at <strong>{selection.shift.client_site}</strong>, ending at {shiftTime(selection.shift.end_time)}.</p>
            <label className="flex min-h-11 items-center gap-3 text-sm text-text-primary">
              <input type="checkbox" checked={confirmed} disabled={submitting} onChange={(event) => setConfirmed(event.target.checked)} className="h-4 w-4 shrink-0 accent-primary" />
              I confirmed by phone that this guard is available for unarmed coverage.
            </label>
            {confirmationError && <p role="alert" className="text-sm text-danger-text">{confirmationError}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="soc-btn soc-btn-neutral min-h-11" disabled={submitting} onClick={() => setSelection(null)}>Cancel</button>
              <button type="submit" className="soc-btn-primary min-h-11 disabled:opacity-60" disabled={!confirmed || submitting}>{submitting ? 'Assigning…' : 'Confirm replacement'}</button>
            </div>
          </form>
        )}
      </SentinelModal>
    </section>
  )
}

export default ReplacementSuggestionPanel
