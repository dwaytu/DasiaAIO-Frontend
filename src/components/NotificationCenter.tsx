import { FC, useEffect } from 'react'

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

const NotificationItem: FC<NotificationProps> = ({ notification, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(notification.id)
    }, 5000) // Auto dismiss after 5 seconds

    return () => clearTimeout(timer)
  }, [notification.id, onDismiss])

  const getTypeStyles = () => {
    switch (notification.type) {
      case 'success':
        return 'bg-green-50 border-green-500 text-green-900'
      case 'error':
        return 'bg-red-50 border-red-500 text-red-900'
      case 'warning':
        return 'bg-yellow-50 border-yellow-500 text-yellow-900'
      case 'info':
      default:
        return 'bg-blue-50 border-blue-500 text-blue-900'
    }
  }

  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return '✓'
      case 'error':
        return '✕'
      case 'warning':
        return '⚠'
      case 'info':
      default:
        return 'ℹ'
    }
  }

  return (
    <div 
      className={`${getTypeStyles()} border-l-4 p-4 mb-3 rounded shadow-lg animate-slide-in-right flex items-start justify-between max-w-md`}
    >
      <div className="flex items-start gap-3 flex-1">
        <div className="text-2xl font-bold">{getIcon()}</div>
        <div className="flex-1">
          <h4 className="font-bold text-sm mb-1">{notification.title}</h4>
          <p className="text-xs opacity-90">{notification.message}</p>
          <p className="text-xs opacity-70 mt-1">
            {notification.timestamp.toLocaleTimeString()}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(notification.id)}
        className="ml-2 min-h-10 min-w-10 rounded-md text-xl font-bold opacity-60 transition-opacity hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus-ring)]"
        aria-label={`Dismiss notification: ${notification.title}`}
      >
        ×
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
    >
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  )
}

export default NotificationCenter

// Utility function to create notifications
export const createNotification = (
  type: 'success' | 'error' | 'info' | 'warning',
  title: string,
  message: string
): Notification => ({
  id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  type,
  title,
  message,
  timestamp: new Date()
})
