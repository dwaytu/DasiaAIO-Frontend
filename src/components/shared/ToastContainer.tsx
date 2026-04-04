import { useUI } from '../../hooks/useUI'
import type { Toast } from '../../context/UIContext'

const ICON: Record<Toast['type'], string> = {
  error: '✕',
  warning: '!',
  success: '✓',
  info: 'i',
}

const BG: Record<Toast['type'], string> = {
  error: 'bg-red-900/90',
  warning: 'bg-yellow-900/90',
  success: 'bg-green-900/90',
  info: 'bg-surface/90',
}

const BORDER: Record<Toast['type'], string> = {
  error: 'border-red-500/50',
  warning: 'border-yellow-500/50',
  success: 'border-green-500/50',
  info: 'border-border',
}

const ICON_COLOR: Record<Toast['type'], string> = {
  error: 'text-red-400',
  warning: 'text-yellow-400',
  success: 'text-green-400',
  info: 'text-blue-400',
}

const MAX_VISIBLE = 5

export default function ToastContainer() {
  const { toasts, removeToast } = useUI()

  const visible: Toast[] = toasts.slice(-MAX_VISIBLE)

  if (visible.length === 0) return null

  return (
    <div
      // bottom-20 to clear mobile nav bar (z-[75]); sm+ anchors to bottom-4
      className="fixed bottom-20 right-2 z-[80] flex flex-col-reverse gap-2 pointer-events-none sm:bottom-4 sm:right-4"
      aria-label="Notifications"
    >
      {visible.map((toast) => {
        const isAssertive = toast.type === 'error' || toast.type === 'warning'
        return (
          <div
            key={toast.id}
            role={isAssertive ? 'alert' : 'status'}
            aria-live={isAssertive ? 'assertive' : 'polite'}
            className={[
              'pointer-events-auto',
              'border rounded-lg px-4 py-3 flex items-start gap-3 shadow-lg backdrop-blur-sm',
              'min-w-[280px] max-w-[400px]',
              'transition-opacity duration-200 opacity-100',
              'text-text-primary',
              BG[toast.type],
              BORDER[toast.type],
            ].join(' ')}
          >
            <span
              className={`mt-0.5 shrink-0 font-bold text-sm leading-none ${ICON_COLOR[toast.type]}`}
              aria-hidden="true"
            >
              {ICON[toast.type]}
            </span>

            <p className="flex-1 text-sm leading-snug">{toast.message}</p>

            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss notification"
              className="shrink-0 -mr-1 rounded p-0.5 text-text-primary/70 hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
              </svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}
