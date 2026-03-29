import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, CheckCheck } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { logError } from '../utils/logger';
import { getAuthToken } from '../utils/api';

interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  relatedShiftId?: string;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

interface NotificationPanelProps {
  userId: string;
}

async function parseResponseBody(response: Response): Promise<any> {
  const raw = await response.text();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    return { error: raw };
  }
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ userId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [panelError, setPanelError] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/api/users/${userId}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
        setPanelError('');
      }
    } catch (error) {
      logError('Failed to fetch notifications:', error);
      setPanelError('Failed to load notifications. Try again.');
    }
  };

  // Fetch unread count
  const fetchUnreadCount = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/api/users/${userId}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      logError('Failed to fetch unread count:', error);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setNotifications(prev =>
          prev.map(notif =>
            notif.id === notificationId ? { ...notif, read: true } : notif
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      logError('Failed to mark notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/api/users/${userId}/notifications/mark-all-read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      logError('Failed to mark all as read:', error);
    }
  };

  // Accept replacement request
  const acceptReplacement = async (notificationId: string, shiftId: string) => {
    try {
      setLoading(true);
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/api/guard-replacement/accept-replacement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          guardId: userId,
          shiftId: shiftId,
          notificationId: notificationId,
        }),
      });

      if (response.ok) {
        setPanelError('');
        await fetchNotifications();
      } else {
        const error = await parseResponseBody(response);
        setPanelError(error.error || 'Failed to accept replacement');
      }
    } catch (error) {
      logError('Failed to accept replacement:', error);
      setPanelError('Failed to accept replacement');
    } finally {
      setLoading(false);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId: string) => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
        fetchUnreadCount();
      }
    } catch (error) {
      logError('Failed to delete notification:', error);
    }
  };

  // Toggle panel
  const togglePanel = () => {
    setPanelError('');
    setIsOpen(!isOpen);
    if (!isOpen) {
      fetchNotifications();
    }
  };

  // Close panel with outside click/tap or Escape key
  useEffect(() => {
    const handlePointerDownOutside = (event: MouseEvent | PointerEvent | TouchEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handlePointerDownOutside);
      document.addEventListener('touchstart', handlePointerDownOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside);
      document.removeEventListener('touchstart', handlePointerDownOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

   if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Notification Bell Button */}
      <button
        type="button"
        onClick={togglePanel}
        className="relative min-h-11 min-w-11 rounded-lg p-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)]"
        style={{ color: 'var(--text-secondary)' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = ''; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'; }}
        aria-label={unreadCount > 0 ? `Open notifications (${unreadCount} unread)` : 'Open notifications'}
        aria-expanded={isOpen}
        aria-controls="notification-panel"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div id="notification-panel" className="absolute right-0 mt-2 z-50 flex max-h-[min(600px,calc(100vh-6rem))] w-80 max-w-[calc(100vw-1rem)] flex-col rounded-xl shadow-2xl sm:w-96" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }} role="dialog" aria-label="Notifications panel">
          {/* Header */}
          <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="flex min-h-11 items-center gap-1 rounded px-2 py-1 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)]"
                  style={{ color: '#60A5FA' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(59,130,246,0.1)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = ''; }}
                  aria-label="Mark all notifications as read"
                >
                  <CheckCheck className="w-4 h-4" />
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="min-h-11 min-w-11 rounded p-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)]"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = ''; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'; }}
                aria-label="Close notifications panel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {panelError ? (
            <p className="border-b border-border-subtle px-4 py-2 text-xs text-danger-text" role="alert">{panelError}</p>
          ) : null}

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="p-8 text-center" style={{ color: 'var(--text-secondary)' }}>
                <Bell className="w-12 h-12 mx-auto mb-3" style={{ color: '#2A2D45' }} />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              <div>
                {notifications.map((notification, idx) => (
                  <div
                    key={notification.id}
                    className="p-4 transition-colors cursor-default"
                    style={{
                      background: !notification.read ? 'rgba(59,130,246,0.07)' : '',
                      borderBottom: idx < notifications.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = !notification.read ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = !notification.read ? 'rgba(59,130,246,0.07)' : ''; }}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-semibold text-sm flex-1" style={{ color: 'var(--text-primary)' }}>
                        {notification.title}
                      </h4>
                      {!notification.read && (
                        <span className="w-2 h-2 rounded-full ml-2 mt-1 flex-shrink-0" style={{ background: '#3B82F6' }}></span>
                      )}
                    </div>
                    <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>{notification.message}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: '#64748B' }}>
                        {formatTime(notification.createdAt)}
                      </span>
                      <div className="flex gap-2">
                        {notification.type === 'replacement_request' && notification.relatedShiftId && (
                          <button
                            type="button"
                            onClick={() => acceptReplacement(notification.id, notification.relatedShiftId!)}
                            disabled={loading}
                            className="min-h-11 rounded px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50"
                            style={{ background: 'rgba(34,197,94,0.2)', color: '#4ADE80', border: '1px solid rgba(34,197,94,0.3)' }}
                            aria-label={`Accept replacement request: ${notification.title}`}
                          >
                            Accept
                          </button>
                        )}
                        {!notification.read && (
                          <button
                            type="button"
                            onClick={() => markAsRead(notification.id)}
                            className="min-h-11 min-w-11 rounded px-2 py-1 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)]"
                            style={{ background: 'rgba(59,130,246,0.2)', color: '#60A5FA', border: '1px solid rgba(59,130,246,0.3)' }}
                            aria-label={`Mark notification as read: ${notification.title}`}
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteNotification(notification.id)}
                          className="min-h-11 min-w-11 rounded px-2 py-1 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)]"
                          style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                          aria-label={`Delete notification: ${notification.title}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;
