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
  success: 'bg-success-bg border-success-border text-success-text',
  error: 'bg-danger-bg border-danger-border text-danger-text',
  warning: 'bg-warning-bg border-warning-border text-warning-text',
  info: 'bg-info-bg border-info-border text-info-text',
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
    <div className={`${TYPE_STYLES[notification.type]} mb-3 flex max-w-md items-start justify-between rounded border-l-4 p-4 shadow-lg animate-slide-in-right`} role="status">
      <div className="flex flex-1 items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="flex-1">
          <h4 className="mb-1 text-sm font-bold">{notification.title}</h4>
          <p className="text-xs opacity-90">{notification.message}</p>
          <p className="mt-1 text-xs opacity-70">{notification.timestamp.toLocaleTimeString()}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(notification.id)}
        className="soc-btn-neutral ml-2 min-h-11 min-w-11 p-2"
        aria-label={`Dismiss notification: ${notification.title}`}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
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
      className="fixed left-4 right-4 top-4 z-[80] w-auto max-w-md md:left-auto md:top-[calc(5.5rem+env(safe-area-inset-top,0px))]"
      style={{
        right: 'calc(1rem + env(safe-area-inset-right, 0px))',
        left: 'calc(1rem + env(safe-area-inset-left, 0px))',
      }}
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
