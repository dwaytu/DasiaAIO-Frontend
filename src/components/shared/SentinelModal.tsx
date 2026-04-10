import { ReactNode, useEffect, useId } from 'react'

type SentinelModalSize = 'sm' | 'md' | 'lg'

interface SentinelModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  size?: SentinelModalSize
}

const SIZE_CLASS: Record<SentinelModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

const SentinelModal = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  size = 'md',
}: SentinelModalProps) => {
  const titleId = useId()

  useEffect(() => {
    if (!open) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) return

    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousBodyOverflow
    }
  }, [open])

  if (!open) {
    return null
  }

  return (
    <div className="soc-modal-backdrop" onClick={onClose}>
      <div
        className={`soc-modal-panel mx-4 flex w-full max-h-[85vh] flex-col ${SIZE_CLASS[size]} rounded-lg border border-border bg-surface-elevated shadow-2xl ring-1 ring-border/50`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-border bg-surface/50 px-6 py-5">
          <div>
            <h2 id={titleId} className="text-xl font-bold text-text-primary">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-2xl text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus-ring)]"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

export default SentinelModal