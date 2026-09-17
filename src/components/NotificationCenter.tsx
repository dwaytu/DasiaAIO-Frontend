import { FC, useEffect } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'

export interface Notification {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message: string
  timestamp: Date
}

interface NotificationProps {
  notification: Notification
  onDismiss: (id: string) => void
}

const TYPE_STYLES: Record<Notification['type'], string> = {
  success: 'border-success-border',
  error: 'border-danger-border',
  warning: 'border-warning-border',
  info: 'border-info-border',
}

const TYPE_ICON_STYLES: Record<Notification['type'], string> = {
  success: 'bg-success-bg text-success-text',
  error: 'bg-danger-bg text-danger-text',
  warning: 'bg-warning-bg text-warning-text',
  info: 'bg-info-bg text-info-text',
}

const TYPE_ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
} as const

const NotificationItem: FC<NotificationProps> = ({ notification, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(notification.id), 5000)
    return () => clearTimeout(timer)
  }, [notification.id, onDismiss])

  const Icon = TYPE_ICONS[notification.type]

  return (
    <div
      className={`pointer-events-auto relative mb-3 flex w-full items-start gap-3 overflow-hidden rounded border border-l-4 bg-surface-elevated p-4 shadow-2xl animate-slide-in-right ${TYPE_STYLES[notification.type]}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${TYPE_ICON_STYLES[notification.type]}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="mb-1 break-words text-sm font-bold text-text-primary">{notification.title}</h4>
          <p className="break-words text-sm leading-5 text-text-secondary">{notification.message}</p>
          <p className="mt-1 text-xs text-text-tertiary">{notification.timestamp.toLocaleTimeString()}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(notification.id)}
        className="soc-btn soc-btn-neutral soc-btn-icon ml-2 min-h-11 min-w-11 shrink-0 p-0"
        aria-label={`Dismiss notification: ${notification.title}`}
        title="Dismiss notification"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
      <span className="toast-progress pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-info" aria-hidden="true" />
    </div>
  )
}

interface NotificationCenterProps {
  notifications: Notification[]
  onDismiss: (id: string) => void
}

const NotificationCenter: FC<NotificationCenterProps> = ({ notifications, onDismiss }) => {
  if (notifications.length === 0) return null

  return (
    <div
      className="pointer-events-none fixed left-[calc(1rem+env(safe-area-inset-left,0px))] right-[calc(1rem+env(safe-area-inset-right,0px))] top-[calc(1rem+env(safe-area-inset-top,0px))] z-(--z-toast) w-auto md:left-auto md:right-[calc(1rem+env(safe-area-inset-right,0px))] md:top-[calc(5.5rem+env(safe-area-inset-top,0px))] md:w-[min(28rem,calc(100vw-2rem))]"
      aria-label="Notifications"
    >
      {notifications.map((notification) => (
        <NotificationItem key={notification.id} notification={notification} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

export default NotificationCenter

export const createNotification = (
  type: Notification['type'],
  title: string,
  message: string,
): Notification => ({
  id: `notification-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
  type,
  title,
  message,
  timestamp: new Date(),
})
