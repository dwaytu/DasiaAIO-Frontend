import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { useUI } from '../../hooks/useUI'
import type { Toast } from '../../context/UIContext'

const ICON: Record<Toast['type'], typeof Info> = {
  error: AlertCircle,
  warning: AlertTriangle,
  success: CheckCircle2,
  info: Info,
}

const BG: Record<Toast['type'], string> = {
  error: 'bg-danger-bg',
  warning: 'bg-warning-bg',
  success: 'bg-success-bg',
  info: 'bg-info-bg',
}

const BORDER: Record<Toast['type'], string> = {
  error: 'border-danger-border',
  warning: 'border-warning-border',
  success: 'border-success-border',
  info: 'border-info-border',
}

const ICON_COLOR: Record<Toast['type'], string> = {
  error: 'text-danger-text',
  warning: 'text-warning-text',
  success: 'text-success-text',
  info: 'text-info-text',
}

const MAX_VISIBLE = 5

export default function ToastContainer() {
  const { toasts, removeToast } = useUI()
  const visible: Toast[] = toasts.slice(-MAX_VISIBLE)

  if (visible.length === 0) return null

  return (
    <div
      className="pointer-events-none fixed bottom-20 right-2 z-[80] flex flex-col-reverse gap-2 sm:bottom-4 sm:right-4"
      aria-label="Notifications"
    >
      {visible.map((toast) => {
        const isAssertive = toast.type === 'error' || toast.type === 'warning'
        const Icon = ICON[toast.type]

        return (
          <div
            key={toast.id}
            role={isAssertive ? 'alert' : 'status'}
            aria-live={isAssertive ? 'assertive' : 'polite'}
            className={`pointer-events-auto flex min-w-[280px] max-w-[400px] items-start gap-3 rounded border px-4 py-3 text-text-primary shadow-lg ${BG[toast.type]} ${BORDER[toast.type]}`}
          >
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${ICON_COLOR[toast.type]}`} aria-hidden="true" />

            <p className="flex-1 text-sm leading-snug">{toast.message}</p>

            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss notification"
              className="-mr-1 flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded text-text-secondary hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--color-focus-ring)"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
