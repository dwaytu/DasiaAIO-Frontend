import { ReactNode, useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'

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

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

const SentinelModal = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  size = 'md',
}: SentinelModalProps) => {
  const titleId = useId()
  const subtitleId = useId()
  const panelRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const previousActiveElementRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return

    previousActiveElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeButtonRef.current?.focus()

    const getFocusableElements = () => {
      if (!panelRef.current) return []
      return Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => !element.hasAttribute('aria-hidden'),
      )
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab') return

      const focusableElements = getFocusableElements()
      if (focusableElements.length === 0) {
        event.preventDefault()
        panelRef.current?.focus()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (previousActiveElementRef.current?.isConnected) {
        previousActiveElementRef.current.focus()
      }
    }
  }, [open])

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
        ref={panelRef}
        tabIndex={-1}
        className={`soc-modal-panel soc-modal-surface mx-4 flex w-full max-h-[85vh] flex-col ${SIZE_CLASS[size]} rounded-lg border border-border shadow-2xl ring-1 ring-border/50`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface/50 px-6 py-5">
          <div>
            <h2 id={titleId} className="text-xl font-bold text-text-primary">{title}</h2>
            {subtitle && <p id={subtitleId} className="mt-1 text-sm text-text-secondary">{subtitle}</p>}
          </div>
          <button
            type="button"
            ref={closeButtonRef}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-ring)"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

export default SentinelModal
