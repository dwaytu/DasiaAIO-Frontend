import { FC, FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Loader2, MessageSquareText, Send, Star } from 'lucide-react'
import { API_BASE_URL } from '../../config'
import { getApiErrorMessage, getAuthToken } from '../../utils/api'
import { sanitizeErrorMessage } from '../../utils/sanitize'
import { getSidebarNav } from '../../config/navigation'
import type { User } from '../../context/AuthContext'
import OperationalShell from '../layout/OperationalShell'

const MAX_COMMENTS_LENGTH = 500
const STAR_VALUES = [1, 2, 3, 4, 5] as const

type FeedbackStatusResponse = {
  has_submitted?: boolean
}

type FeedbackFormProps = {
  user: User
  onLogout: () => void
  onViewChange?: (view: string) => void
  activeView?: string
}

function getRatingLabel(value: number): string {
  if (value === 1) return '1 star'
  return `${value} stars`
}

const FeedbackForm: FC<FeedbackFormProps> = ({ user, onLogout, onViewChange, activeView }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [comments, setComments] = useState('')
  const [statusLoading, setStatusLoading] = useState(true)
  const [statusError, setStatusError] = useState('')
  const [formError, setFormError] = useState('')
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [submittedFromCurrentForm, setSubmittedFromCurrentForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const currentView = activeView || 'feedback'
  const homeView = user.role === 'guard' ? 'overview' : 'dashboard'
  const navItems = useMemo(() => {
    if (user.role === 'guard') {
      return []
    }

    return getSidebarNav(user.role, { homeView: 'dashboard' })
  }, [user.role])

  const remainingCharacters = MAX_COMMENTS_LENGTH - comments.length

  const checkSubmissionStatus = useCallback(async (signal: AbortSignal) => {
    setStatusLoading(true)
    setStatusError('')

    try {
      const token = getAuthToken().trim()
      if (!token) {
        throw new Error('Session expired. Please log in again.')
      }

      const response = await fetch(`${API_BASE_URL}/api/feedback/status`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal,
      })

      if (!response.ok) {
        const message = await getApiErrorMessage(response, 'Unable to verify feedback status.')
        throw new Error(message)
      }

      const payload = (await response.json()) as FeedbackStatusResponse
      const submitted = payload.has_submitted === true
      setHasSubmitted(submitted)
      setSubmittedFromCurrentForm(false)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      setStatusError(sanitizeErrorMessage(error instanceof Error ? error.message : 'Unable to verify feedback status.'))
    } finally {
      setStatusLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void checkSubmissionStatus(controller.signal)

    return () => {
      controller.abort()
    }
  }, [checkSubmissionStatus])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (rating < 1 || rating > 5) {
      setFormError('Select a rating before submitting feedback.')
      return
    }

    setFormError('')
    setSubmitting(true)

    try {
      const token = getAuthToken().trim()
      if (!token) {
        throw new Error('Session expired. Please log in again.')
      }

      const response = await fetch(`${API_BASE_URL}/api/feedback`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating,
          comments: comments.trim(),
        }),
      })

      if (response.status === 409) {
        setHasSubmitted(true)
        setSubmittedFromCurrentForm(false)
        return
      }

      if (!response.ok) {
        const message = await getApiErrorMessage(response, 'Unable to submit feedback right now.')
        throw new Error(message)
      }

      setHasSubmitted(true)
      setSubmittedFromCurrentForm(true)
    } catch (error) {
      setFormError(sanitizeErrorMessage(error instanceof Error ? error.message : 'Unable to submit feedback right now.'))
    } finally {
      setSubmitting(false)
    }
  }

  const renderSubmittedState = () => {
    const message = submittedFromCurrentForm
      ? 'Thank you for your feedback. Your response has been recorded.'
      : 'Your account already submitted feedback. Thank you for helping improve SENTINEL.'

    return (
      <section className="command-panel max-w-3xl" aria-live="polite">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full border border-success-border bg-success-bg p-2 text-success-text" aria-hidden="true">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <h2 className="soc-section-title">Feedback Received</h2>
            <p className="text-sm text-text-secondary">{message}</p>
            {submittedFromCurrentForm ? (
              <p className="text-sm text-text-secondary">You selected: {getRatingLabel(rating)}.</p>
            ) : null}
          </div>
        </div>
      </section>
    )
  }

  const canSubmit = rating >= 1 && rating <= 5 && !submitting && !statusLoading && !hasSubmitted

  return (
    <OperationalShell
      user={user}
      title="FEEDBACK"
      navItems={navItems}
      activeView={currentView}
      onNavigate={(view) => onViewChange?.(view)}
      onLogout={onLogout}
      mobileMenuOpen={mobileMenuOpen}
      onMenuOpen={() => setMobileMenuOpen(true)}
      onMenuClose={() => setMobileMenuOpen(false)}
      onLogoClick={() => onViewChange?.(homeView)}
    >
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <header className="command-panel">
          <div className="flex items-start gap-3">
            <div className="rounded-full border border-border-subtle bg-surface-elevated p-2 text-text-secondary" aria-hidden="true">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h1 className="soc-section-title">System Feedback</h1>
              <p className="text-sm text-text-secondary">
                Share your rating and optional comments to help improve the SENTINEL operational experience.
              </p>
            </div>
          </div>
        </header>

        {statusLoading ? (
          <section className="command-panel" aria-live="polite">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Checking whether feedback was already submitted...
            </div>
          </section>
        ) : null}

        {statusError ? (
          <section className="rounded border border-warning-border bg-warning-bg p-3 text-sm text-warning-text" role="alert">
            {statusError}
          </section>
        ) : null}

        {hasSubmitted ? (
          renderSubmittedState()
        ) : !statusLoading ? (
          <section className="command-panel">
            <form className="space-y-5" onSubmit={handleSubmit} noValidate>
              <fieldset className="space-y-3">
                <legend id="feedback-rating-label" className="text-sm font-semibold text-text-primary">
                  Rating
                </legend>
                <p id="feedback-rating-help" className="text-sm text-text-secondary">
                  Select a score from 1 to 5 stars.
                </p>

                <div
                  className="flex flex-wrap gap-2"
                  role="radiogroup"
                  aria-labelledby="feedback-rating-label"
                  aria-describedby="feedback-rating-help"
                >
                  {STAR_VALUES.map((value) => (
                    <label key={value} className="cursor-pointer">
                      <input
                        type="radio"
                        name="feedback-rating"
                        value={value}
                        checked={rating === value}
                        onChange={() => {
                          setRating(value)
                          setFormError('')
                        }}
                        className="peer sr-only"
                        aria-label={getRatingLabel(value)}
                      />
                      <span
                        className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-focus peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface ${
                          value <= rating
                            ? 'border-warning-border bg-warning-bg text-warning-text'
                            : 'border-border-subtle bg-surface-elevated text-text-tertiary'
                        }`}
                      >
                        <Star className={`h-5 w-5 ${value <= rating ? 'fill-current' : ''}`} aria-hidden="true" />
                      </span>
                    </label>
                  ))}
                </div>

                <p className="text-xs text-text-secondary" aria-live="polite">
                  {rating > 0 ? `Selected: ${getRatingLabel(rating)}.` : 'No rating selected yet.'}
                </p>
              </fieldset>

              <div className="space-y-2">
                <label htmlFor="feedback-comments" className="text-sm font-semibold text-text-primary">
                  Comments (optional)
                </label>
                <textarea
                  id="feedback-comments"
                  value={comments}
                  onChange={(event) => setComments(event.target.value.slice(0, MAX_COMMENTS_LENGTH))}
                  maxLength={MAX_COMMENTS_LENGTH}
                  rows={5}
                  className="min-h-[8rem] w-full rounded border border-border-subtle bg-surface p-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus"
                  placeholder="Share details about what worked well and what can be improved."
                  aria-describedby="feedback-comments-help feedback-comments-count"
                />
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
                  <p id="feedback-comments-help">Maximum 500 characters.</p>
                  <p id="feedback-comments-count" aria-live="polite">
                    {remainingCharacters} characters remaining
                  </p>
                </div>
              </div>

              {formError ? (
                <p className="rounded border border-danger-border bg-danger-bg p-3 text-sm text-danger-text" role="alert">
                  {formError}
                </p>
              ) : null}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="soc-btn inline-flex min-h-11 items-center gap-2 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" aria-hidden="true" />
                      Submit Feedback
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        ) : null}
      </section>
    </OperationalShell>
  )
}

export default FeedbackForm
