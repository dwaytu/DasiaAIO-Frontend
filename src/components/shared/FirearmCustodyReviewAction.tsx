import { useEffect, useRef, useState, type FormEvent } from 'react'
import { API_BASE_URL } from '../../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../../utils/api'
import { can } from '../../utils/permissions'
import SentinelModal from './SentinelModal'

interface Props {
  firearm: {
    id: string
    serialNumber: string
    updatedAt?: string
    custodyReviewApprovedAt?: string | null
  }
  viewerRole: unknown
  onApproved: (approvedAt: string) => void
}

const FirearmCustodyReviewAction = ({ firearm, viewerRole, onApproved }: Props) => {
  const [open, setOpen] = useState(false)
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const approvalStatus = useRef<HTMLParagraphElement>(null)
  const focusApproval = useRef(false)
  const { id, serialNumber, updatedAt, custodyReviewApprovedAt } = firearm

  useEffect(() => {
    if (custodyReviewApprovedAt && focusApproval.current) {
      approvalStatus.current?.focus()
      focusApproval.current = false
    }
  }, [custodyReviewApprovedAt])

  const approve = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!updatedAt || !reference.trim() || pending) return

    setPending(true)
    setError('')
    try {
      const { approvedAt } = await fetchJsonOrThrow<{ approvedAt: string }>(
        `${API_BASE_URL}/api/firearms/${encodeURIComponent(id)}/custody-review/approve`,
        {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ inventoryUpdatedAt: updatedAt, sourceReference: reference.trim() }),
        },
        'Unable to approve custody review',
      )
      focusApproval.current = true
      setOpen(false)
      onApproved(approvedAt)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to approve custody review')
    } finally {
      setPending(false)
    }
  }

  if (custodyReviewApprovedAt) {
    return (
      <p ref={approvalStatus} tabIndex={-1} className="self-center text-xs font-medium text-success-text">
        Review approved on {new Date(custodyReviewApprovedAt).toLocaleDateString()}
      </p>
    )
  }
  if (!can(viewerRole, 'manage_firearms') || !updatedAt || custodyReviewApprovedAt !== null) return null

  return (
    <>
      <button
        type="button"
        className="soc-btn soc-btn-neutral min-h-11"
        aria-label={`Approve custody review for serial ${serialNumber}`}
        onClick={() => {
          setReference('')
          setError('')
          setOpen(true)
        }}
      >
        Approve
      </button>
      <SentinelModal
        open={open}
        onClose={() => setOpen(false)}
        title="Approve custody review"
        subtitle={`Serial ${serialNumber}`}
        dismissible={!pending}
      >
        <form onSubmit={approve} className="space-y-4">
          <p className="text-sm text-text-secondary">
            By approving, you confirm that you checked the supporting issue or return log against this serial number. The firearm stays under custody review until the inventory and register agree.
          </p>
          <label className="block text-sm font-medium text-text-primary">
            Source document reference
            <input
              className="soc-form-control mt-2 w-full"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              required
              maxLength={200}
              readOnly={pending}
            />
          </label>
          {error ? <p role="alert" className="text-sm text-danger-text">{error}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="soc-btn soc-btn-neutral min-h-11" disabled={pending} onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="soc-btn-primary min-h-11" disabled={pending || !reference.trim()}>{pending ? 'Approving…' : 'Approve review'}</button>
          </div>
        </form>
      </SentinelModal>
    </>
  )
}

export default FirearmCustodyReviewAction
