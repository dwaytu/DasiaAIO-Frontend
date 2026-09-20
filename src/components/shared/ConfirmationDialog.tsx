import { type ReactNode, useRef, useState } from 'react'
import SentinelModal from './SentinelModal'

interface ConfirmationDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  description: ReactNode
  confirmLabel: string
  confirmingLabel?: string
  tone?: 'danger' | 'primary'
}

const ConfirmationDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  confirmingLabel = 'Confirming...',
  tone = 'danger',
}: ConfirmationDialogProps) => {
  const [confirming, setConfirming] = useState(false)
  const confirmingRef = useRef(false)

  const handleConfirm = async () => {
    if (confirmingRef.current) return

    confirmingRef.current = true
    setConfirming(true)
    try {
      await onConfirm()
      onClose()
    } finally {
      confirmingRef.current = false
      setConfirming(false)
    }
  }

  return (
    <SentinelModal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={typeof description === 'string' ? description : undefined}
      size="sm"
      dismissible={!confirming}
    >
      {typeof description === 'string' ? null : (
        <div className="text-sm leading-6 text-text-secondary">{description}</div>
      )}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          disabled={confirming}
          className="soc-btn soc-btn-neutral min-h-11 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={confirming}
          className={`${tone === 'danger' ? 'soc-btn-danger' : 'soc-btn-primary'} min-h-11 disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {confirming ? confirmingLabel : confirmLabel}
        </button>
      </div>
    </SentinelModal>
  )
}

export default ConfirmationDialog
