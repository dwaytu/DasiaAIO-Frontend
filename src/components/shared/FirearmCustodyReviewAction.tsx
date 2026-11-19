import { useEffect, useRef, useState, type FormEvent } from 'react'
import { API_BASE_URL } from '../../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../../utils/api'
import { can } from '../../utils/permissions'
import SentinelModal from './SentinelModal'

interface ReviewableFirearm {
  id: string
  serialNumber: string
  updatedAt?: string
  custodyReviewApprovedAt?: string | null
}

export interface FirearmCustodyReviewResult {
  approvedAt: string
  returnedToStock: boolean
}

export function applyFirearmCustodyReview<T extends ReviewableFirearm & {
  status: string
  activeCustody?: boolean
  custodyReview?: boolean
}>(items: T[], firearm: ReviewableFirearm, result: FirearmCustodyReviewResult, reviewingOnly: boolean): T[] {
  return items.flatMap((item) => {
    if (item.id !== firearm.id || item.updatedAt !== firearm.updatedAt) return [item]
    if (!result.returnedToStock) return [{ ...item, custodyReviewApprovedAt: result.approvedAt }]
    if (reviewingOnly) return []
    return [{ ...item, status: 'available', activeCustody: false, custodyReview: false, custodyReviewApprovedAt: null }]
  })
}

interface Props {
  firearm: ReviewableFirearm
  viewerRole: unknown
  onApproved: (result: FirearmCustodyReviewResult) => void
}

const FirearmCustodyReviewAction = ({ firearm, viewerRole, onApproved }: Props) => {
  const [open, setOpen] = useState(false)
  const [reference, setReference] = useState('')
  const [confirmedInStock, setConfirmedInStock] = useState(false)
  const [stockConfirmationUnavailable, setStockConfirmationUnavailable] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const approvalStatus = useRef<HTMLParagraphElement>(null)
  const { id, serialNumber, updatedAt, custodyReviewApprovedAt } = firearm
  const alreadyApproved = Boolean(custodyReviewApprovedAt)
  const canConfirm = can(viewerRole, 'manage_firearms') && Boolean(updatedAt) && custodyReviewApprovedAt !== undefined

  useEffect(() => {
    if (stockConfirmationUnavailable) approvalStatus.current?.focus()
  }, [stockConfirmationUnavailable])

  const approve = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!updatedAt || !reference.trim() || !confirmedInStock || pending) return

    setPending(true)
    setError('')
    try {
      const result = await fetchJsonOrThrow<{ approvedAt: string; returnedToStock?: boolean }>(
        `${API_BASE_URL}/api/firearms/${encodeURIComponent(id)}/custody-review/approve`,
        {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ inventoryUpdatedAt: updatedAt, sourceReference: reference.trim(), confirmInStock: true }),
        },
        'Unable to approve custody review',
      )
      const returnedToStock = result.returnedToStock === true
      setOpen(false)
      setStockConfirmationUnavailable(!returnedToStock)
      onApproved({ approvedAt: result.approvedAt, returnedToStock })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to approve custody review')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      {custodyReviewApprovedAt ? (
        <p className="self-center text-xs font-medium text-success-text">
          Review approved on {new Date(custodyReviewApprovedAt).toLocaleDateString()}
        </p>
      ) : null}
      {stockConfirmationUnavailable ? (
        <p ref={approvalStatus} tabIndex={-1} role="status" className="self-center text-xs font-medium text-warning-text">
          Review recorded. Stock confirmation is unavailable.
        </p>
      ) : null}
      {canConfirm ? (
        <button
          type="button"
          className="soc-btn soc-btn-neutral min-h-11"
          aria-label={`${alreadyApproved ? 'Confirm in stock' : 'Approve custody review'} for serial ${serialNumber}`}
          onClick={() => {
            setReference('')
            setConfirmedInStock(false)
            setStockConfirmationUnavailable(false)
            setError('')
            setOpen(true)
          }}
        >
          {alreadyApproved ? 'Confirm in stock' : 'Approve'}
        </button>
      ) : null}
      <SentinelModal
        open={open}
        onClose={() => setOpen(false)}
        title={alreadyApproved ? 'Confirm firearm in stock' : 'Approve custody review'}
        subtitle={`Serial ${serialNumber}`}
        dismissible={!pending}
      >
        <form onSubmit={approve} className="space-y-4">
          <p className="text-sm text-text-secondary">
            Check the supporting return record against this serial number and confirm the firearm is physically back in stock. This changes its inventory status to Available.
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
          <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-text-primary">
            <input
              type="checkbox"
              className="h-4 w-4 shrink-0 accent-primary"
              checked={confirmedInStock}
              disabled={pending}
              onChange={(event) => setConfirmedInStock(event.target.checked)}
            />
            I confirmed this firearm is physically back in stock
          </label>
          {error ? <p role="alert" className="text-sm text-danger-text">{error}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="soc-btn soc-btn-neutral min-h-11" disabled={pending} onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="soc-btn-primary min-h-11" disabled={pending || !reference.trim() || !confirmedInStock}>
              {pending ? 'Saving…' : alreadyApproved ? 'Confirm and mark available' : 'Approve and mark available'}
            </button>
          </div>
        </form>
      </SentinelModal>
    </>
  )
}

export default FirearmCustodyReviewAction
