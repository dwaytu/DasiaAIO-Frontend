import { FormEvent, useEffect, useRef, useState } from 'react'
import SentinelModal from './SentinelModal'

interface ApprovalTarget {
  id: string
  fullName?: string
  username?: string
  email: string
}

interface RejectApprovalDialogProps {
  approval: ApprovalTarget | null
  submitting: boolean
  onClose: () => void
  onSubmit: (reason: string) => Promise<boolean>
}

const approvalName = (approval: ApprovalTarget) => approval.fullName || approval.username || approval.email

const RejectApprovalDialog = ({ approval, submitting, onClose, onSubmit }: RejectApprovalDialogProps) => {
  const [reason, setReason] = useState('')
  const [validationError, setValidationError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [localSubmitting, setLocalSubmitting] = useState(false)
  const wasOpen = useRef(false)
  const reasonInputRef = useRef<HTMLTextAreaElement | null>(null)
  const open = Boolean(approval)
  const isSubmitting = submitting || localSubmitting

  useEffect(() => {
    if (open && !wasOpen.current) {
      setReason('')
      setValidationError('')
      setSubmitError('')
      setLocalSubmitting(false)
    }
    wasOpen.current = open
  }, [open])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return
    const normalizedReason = reason.trim()

    if (!normalizedReason) {
      setValidationError('Enter a reason for rejection.')
      setSubmitError('')
      reasonInputRef.current?.focus()
      return
    }

    setValidationError('')
    setSubmitError('')
    setLocalSubmitting(true)
    try {
      const succeeded = await onSubmit(normalizedReason)
      if (succeeded) {
        onClose()
      } else {
        setSubmitError('Unable to reject this guard account. Try again.')
      }
    } catch {
      setSubmitError('Unable to reject this guard account. Try again.')
    } finally {
      setLocalSubmitting(false)
    }
  }

  const describedBy = [
    'rejection-reason-help',
    validationError ? 'rejection-reason-validation' : '',
    submitError ? 'rejection-submit-error' : '',
  ].filter(Boolean).join(' ')

  return (
    <SentinelModal
      open={open}
      onClose={onClose}
      title="REJECT REQUEST"
      subtitle={approval ? `Reject guard account "${approvalName(approval)}"?` : undefined}
      size="sm"
      dismissible={!isSubmitting}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="rejection-reason" className="soc-form-label">
            Reason for rejection <span className="text-danger-text">*</span>
          </label>
          <textarea
            ref={reasonInputRef}
            id="rejection-reason"
            autoFocus
            rows={4}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value)
              if (validationError) setValidationError('')
              if (submitError) setSubmitError('')
            }}
            disabled={isSubmitting}
            aria-required="true"
            aria-invalid={Boolean(validationError)}
            aria-describedby={describedBy}
            className="soc-form-control mt-2 min-h-28 w-full resize-y disabled:cursor-not-allowed disabled:opacity-60"
            placeholder="State the reason for the decision"
          />
          <p id="rejection-reason-help" className="mt-2 text-xs text-text-secondary">
            Provide a short reason so the requester understands why this request was rejected.
          </p>
          {validationError ? <p id="rejection-reason-validation" role="alert" className="mt-2 text-sm text-danger-text">{validationError}</p> : null}
          {submitError ? <p id="rejection-submit-error" role="alert" className="mt-2 text-sm text-danger-text">{submitError}</p> : null}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={isSubmitting} className="soc-btn soc-btn-neutral min-h-11 disabled:cursor-not-allowed disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} className="soc-btn soc-btn-danger min-h-11 disabled:cursor-not-allowed disabled:opacity-50">
            {isSubmitting ? 'Rejecting...' : 'Reject request'}
          </button>
        </div>
      </form>
    </SentinelModal>
  )
}

export default RejectApprovalDialog
