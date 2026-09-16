import { FC, FormEvent, useState } from 'react'
import type { CreateIncidentPayload, Incident } from '../../hooks/useIncidents'

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

const IncidentReportForm: FC<IncidentReportFormProps> = ({ onSubmit, onCancel }) => {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [priority, setPriority] = useState<Incident['priority']>('medium')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess] = useState(false)
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
      className="space-y-4 rounded border border-(--color-border) bg-(--color-surface) p-4"
    >
      <h3 className="font-mono text-sm font-semibold uppercase tracking-wider text-(--color-text)">
        Report Incident
      </h3>

      {/* Title */}
      <div className="space-y-1">
        <label
          htmlFor="incident-title"
          className="block font-mono text-xs font-medium text-(--color-text)"
        >
          Title <span aria-hidden="true" className="text-danger-text">*</span>
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
          className="w-full rounded border border-(--color-border) bg-(--color-bg) px-3 py-2 font-mono text-xs text-(--color-text) placeholder-[color:var(--color-muted-text)] focus:border-(--color-focus-ring) focus:outline-none focus:ring-1 focus:ring-(--color-focus-ring)"
        />
        {titleError && (
          <p id="incident-title-error" role="alert" className="font-mono text-xs text-danger-text">
            {titleError}
          </p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label
          htmlFor="incident-description"
          className="block font-mono text-xs font-medium text-(--color-text)"
        >
          Description <span aria-hidden="true" className="text-danger-text">*</span>
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
          className="w-full resize-y rounded border border-(--color-border) bg-(--color-bg) px-3 py-2 font-mono text-xs text-(--color-text) placeholder-[color:var(--color-muted-text)] focus:border-(--color-focus-ring) focus:outline-none focus:ring-1 focus:ring-(--color-focus-ring)"
        />
        {descError && (
          <p id="incident-description-error" role="alert" className="font-mono text-xs text-danger-text">
            {descError}
          </p>
        )}
      </div>

      {/* Location */}
      <div className="space-y-1">
        <label
          htmlFor="incident-location"
          className="block font-mono text-xs font-medium text-(--color-text)"
        >
          Location <span aria-hidden="true" className="text-danger-text">*</span>
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
          className="w-full rounded border border-(--color-border) bg-(--color-bg) px-3 py-2 font-mono text-xs text-(--color-text) placeholder-[color:var(--color-muted-text)] focus:border-(--color-focus-ring) focus:outline-none focus:ring-1 focus:ring-(--color-focus-ring)"
        />
        {locationError && (
          <p id="incident-location-error" role="alert" className="font-mono text-xs text-danger-text">
            {locationError}
          </p>
        )}
      </div>

      {/* Priority */}
      <div className="space-y-1">
        <label
          htmlFor="incident-priority"
          className="block font-mono text-xs font-medium text-(--color-text)"
        >
          Priority
        </label>
        <select
          id="incident-priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value as Incident['priority'])}
          className="w-full rounded border border-(--color-border) bg-(--color-bg) px-3 py-2 font-mono text-xs text-(--color-text) focus:border-(--color-focus-ring) focus:outline-none focus:ring-1 focus:ring-(--color-focus-ring)"
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
        <p role="alert" className="font-mono text-xs text-danger-text">
          {submitError}
        </p>
      )}

      {/* Success message */}
      {success && (
        <p role="status" className="font-mono text-xs text-success-text">
          Incident reported successfully.
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="soc-btn soc-btn-danger font-mono text-xs"
        >
          {submitting ? 'Submitting…' : 'Submit Report'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="soc-btn soc-btn-neutral font-mono text-xs"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

export default IncidentReportForm
