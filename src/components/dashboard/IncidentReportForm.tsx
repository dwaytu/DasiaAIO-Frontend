import { FC, FormEvent, useEffect, useState } from 'react'
import type { CreateIncidentPayload, Incident } from '../../hooks/useIncidents'
import { API_BASE_URL } from '../../config'
import { fetchJsonOrThrow } from '../../utils/api'

interface IncidentReportFormProps {
  onSubmit: (payload: CreateIncidentPayload) => Promise<void>
  onCancel?: () => void
}

const PRIORITY_OPTIONS: { value: Incident['priority']; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
]

const SEVERITY_TO_PRIORITY: Record<string, Incident['priority']> = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
}

const IncidentReportForm: FC<IncidentReportFormProps> = ({ onSubmit, onCancel }) => {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [priority, setPriority] = useState<Incident['priority']>('medium')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess] = useState(false)
  const [aiSuggestedSeverity, setAiSuggestedSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | ''>('')
  const [classifying, setClassifying] = useState(false)

  // Client-side field validation state
  const [titleError, setTitleError] = useState('')
  const [descError, setDescError] = useState('')
  const [locationError, setLocationError] = useState('')

  const validate = (): boolean => {
    let valid = true
    if (!title.trim()) {
      setTitleError('Title is required.')
      valid = false
    } else {
      setTitleError('')
    }
    if (!description.trim()) {
      setDescError('Description is required.')
      valid = false
    } else {
      setDescError('')
    }
    if (!location.trim()) {
      setLocationError('Location is required.')
      valid = false
    } else {
      setLocationError('')
    }
    return valid
  }

  useEffect(() => {
    const text = `${title} ${description}`.trim()
    if (text.length < 3) {
      setAiSuggestedSeverity('')
      return
    }

    const token = localStorage.getItem('token')
    if (!token) {
      return
    }

    const timeout = window.setTimeout(async () => {
      try {
        setClassifying(true)
        const response = await fetchJsonOrThrow<{ severity: string }>(
          `${API_BASE_URL}/api/ai/classify-incident`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ title, description }),
          },
          'Failed to classify incident severity',
        )

        const severity = (response?.severity || '').toUpperCase()
        if (severity in SEVERITY_TO_PRIORITY) {
          setAiSuggestedSeverity(severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')
          setPriority(SEVERITY_TO_PRIORITY[severity])
        }
      } catch {
        // Keep manual priority fallback when classifier is unavailable.
      } finally {
        setClassifying(false)
      }
    }, 350)

    return () => window.clearTimeout(timeout)
  }, [title, description])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!validate()) {
      // Focus first invalid field
      const form = e.currentTarget
      const first = form.querySelector<HTMLElement>('[aria-invalid="true"]')
      first?.focus()
      return
    }
    setSubmitting(true)
    setSubmitError('')
    try {
      await onSubmit({ title: title.trim(), description: description.trim(), location: location.trim(), priority })
      setSuccess(true)
      setTitle('')
      setDescription('')
      setLocation('')
      setPriority('medium')
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit incident report.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label="Report Incident"
      className="space-y-4 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4"
    >
      <h3 className="font-mono text-sm font-semibold uppercase tracking-wider text-[color:var(--color-text)]">
        Report Incident
      </h3>

      {/* Title */}
      <div className="space-y-1">
        <label
          htmlFor="incident-title"
          className="block font-mono text-xs font-medium text-[color:var(--color-text)]"
        >
          Title <span aria-hidden="true" className="text-red-400">*</span>
        </label>
        <input
          id="incident-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          aria-required="true"
          aria-invalid={titleError ? 'true' : undefined}
          aria-describedby={titleError ? 'incident-title-error' : undefined}
          placeholder="Brief incident description"
          className="w-full rounded border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 font-mono text-xs text-[color:var(--color-text)] placeholder-[color:var(--color-muted-text)] focus:border-[color:var(--color-focus)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-focus)]"
        />
        {titleError && (
          <p id="incident-title-error" role="alert" className="font-mono text-xs text-red-400">
            {titleError}
          </p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label
          htmlFor="incident-description"
          className="block font-mono text-xs font-medium text-[color:var(--color-text)]"
        >
          Description <span aria-hidden="true" className="text-red-400">*</span>
        </label>
        <textarea
          id="incident-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          aria-required="true"
          aria-invalid={descError ? 'true' : undefined}
          aria-describedby={descError ? 'incident-description-error' : undefined}
          rows={3}
          placeholder="Detailed description of the incident"
          className="w-full resize-y rounded border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 font-mono text-xs text-[color:var(--color-text)] placeholder-[color:var(--color-muted-text)] focus:border-[color:var(--color-focus)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-focus)]"
        />
        {descError && (
          <p id="incident-description-error" role="alert" className="font-mono text-xs text-red-400">
            {descError}
          </p>
        )}
      </div>

      {/* Location */}
      <div className="space-y-1">
        <label
          htmlFor="incident-location"
          className="block font-mono text-xs font-medium text-[color:var(--color-text)]"
        >
          Location <span aria-hidden="true" className="text-red-400">*</span>
        </label>
        <input
          id="incident-location"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          required
          aria-required="true"
          aria-invalid={locationError ? 'true' : undefined}
          aria-describedby={locationError ? 'incident-location-error' : undefined}
          placeholder="Site or zone where incident occurred"
          className="w-full rounded border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 font-mono text-xs text-[color:var(--color-text)] placeholder-[color:var(--color-muted-text)] focus:border-[color:var(--color-focus)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-focus)]"
        />
        {locationError && (
          <p id="incident-location-error" role="alert" className="font-mono text-xs text-red-400">
            {locationError}
          </p>
        )}
      </div>

      {/* Priority */}
      <div className="space-y-1">
        <label
          htmlFor="incident-priority"
          className="block font-mono text-xs font-medium text-[color:var(--color-text)]"
        >
          Priority
        </label>
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[10px] text-[color:var(--color-muted-text)]">
            {classifying ? 'AI classifying severity...' : aiSuggestedSeverity ? `AI suggested: ${aiSuggestedSeverity}` : 'AI suggestion available as you type'}
          </p>
          {aiSuggestedSeverity && (
            <span className="rounded border border-[color:var(--color-border)] px-2 py-[2px] font-mono text-[10px] text-[color:var(--color-text)]">
              {aiSuggestedSeverity}
            </span>
          )}
        </div>
        <select
          id="incident-priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value as Incident['priority'])}
          className="w-full rounded border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 font-mono text-xs text-[color:var(--color-text)] focus:border-[color:var(--color-focus)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-focus)]"
        >
          {PRIORITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Submit error */}
      {submitError && (
        <p role="alert" className="font-mono text-xs text-red-400">
          {submitError}
        </p>
      )}

      {/* Success message */}
      {success && (
        <p role="status" className="font-mono text-xs text-green-400">
          Incident reported successfully.
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-red-600 px-4 py-1.5 font-mono text-xs font-semibold text-white hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Submitting…' : 'Submit Report'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-[color:var(--color-border)] px-4 py-1.5 font-mono text-xs text-[color:var(--color-muted-text)] hover:border-[color:var(--color-text)] hover:text-[color:var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)]"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

export default IncidentReportForm
