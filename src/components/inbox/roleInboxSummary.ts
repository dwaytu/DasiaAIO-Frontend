import { API_BASE_URL } from '../../config'
import { normalizeRole } from '../../types/auth'
import { fetchJsonOrThrow, getAuthHeaders } from '../../utils/api'
import { fetchSwapRequestsFeed } from '../../utils/swapRequests'
import type { InboxItem } from './ActionInbox'
import { parsePendingApprovalsPayload, type PendingApprovalRecord } from './pendingApprovals'

type QuickInboxSummary = {
  items: InboxItem[]
  actionableCount: number
  notice: string
  hasError: boolean
}

type GuardShift = {
  id: string
  title?: string
  client_site?: string
  start_time: string
}

type NotificationRecord = {
  id: string
  type?: string
  title?: string
  message?: string
  created_at?: string
  createdAt?: string
  is_read?: boolean
  read?: boolean
}

type SwapRequest = {
  id: string
  status: string
  created_at: string
}

type PendingApproval = PendingApprovalRecord

type Incident = {
  id: string
  title?: string
  type?: string
  description?: string
  status?: string
  location?: string
  created_at?: string
  reported_at?: string
}

type Shift = {
  id: string
  guard_id?: string | null
  start_time?: string
  end_time?: string
  created_at?: string
}

type FirearmItem = {
  id: string
  status?: string
  serial_number?: string
  model?: string
  updated_at?: string
  created_at?: string
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function isWithin24Hours(iso: string): boolean {
  const now = Date.now()
  const shiftTime = new Date(iso).getTime()
  return shiftTime > now && shiftTime - now <= 24 * 60 * 60 * 1000
}

function extractNotifications(payload: unknown): NotificationRecord[] {
  if (Array.isArray(payload)) {
    return payload as NotificationRecord[]
  }

  if (payload && typeof payload === 'object' && Array.isArray((payload as { notifications?: unknown[] }).notifications)) {
    return (payload as { notifications: NotificationRecord[] }).notifications
  }

  return []
}

async function safeFetch<T>(url: string, headers: HeadersInit): Promise<T[]> {
  try {
    const response = await fetch(url, { headers })
    if (!response.ok) return []
    const data: unknown = await response.json()
    return Array.isArray(data) ? (data as T[]) : []
  } catch {
    return []
  }
}

async function safeFetchPendingApprovals(url: string, headers: HeadersInit): Promise<PendingApproval[]> {
  try {
    const response = await fetch(url, { headers })
    if (!response.ok) return []
    const data: unknown = await response.json()
    return parsePendingApprovalsPayload(data)
  } catch {
    return []
  }
}

function mapNotificationsToItems(notifications: NotificationRecord[]): InboxItem[] {
  return notifications
    .filter((notification) => !(notification.is_read ?? notification.read ?? false))
    .map((notification) => ({
      id: `notification-${notification.id}`,
      priority: notification.type === 'shift' ? ('high' as const) : ('normal' as const),
      category: 'notification' as const,
      title: notification.title ?? 'Notification',
      description: notification.message ?? '',
      timestamp: notification.created_at ?? notification.createdAt ?? new Date().toISOString(),
      isRead: false,
    }))
}

async function fetchGuardSummary(userId: string): Promise<QuickInboxSummary> {
  const headers = getAuthHeaders()

  const [shiftsResult, notificationsResult, swapFeedResult] = await Promise.allSettled([
    fetchJsonOrThrow(`${API_BASE_URL}/api/guard-replacement/guard/${encodeURIComponent(userId)}/shifts`, { headers }, 'Unable to load guard shifts.'),
    fetchJsonOrThrow(`${API_BASE_URL}/api/users/${encodeURIComponent(userId)}/notifications`, { headers }, 'Unable to load notifications.'),
    fetchSwapRequestsFeed(headers),
  ])

  const shifts = shiftsResult.status === 'fulfilled' && Array.isArray((shiftsResult.value as { shifts?: unknown[] }).shifts)
    ? ((shiftsResult.value as { shifts: GuardShift[] }).shifts)
    : []
  const notifications = notificationsResult.status === 'fulfilled' ? extractNotifications(notificationsResult.value) : []
  const swapFeed = swapFeedResult.status === 'fulfilled' ? swapFeedResult.value : null
  const swaps = (swapFeed?.swapRequests ?? []) as SwapRequest[]

  const notice = swapFeed?.feedState === 'unavailable'
    ? 'Shift swap updates are temporarily unavailable. Inbox is showing other mission activity only.'
    : swapFeed?.feedState === 'stale'
      ? 'Shift swap updates may be out of date right now. Inbox is showing other mission activity only.'
      : ''

  const items: InboxItem[] = [
    ...shifts
      .filter((shift) => isWithin24Hours(shift.start_time))
      .map((shift) => ({
        id: `shift-${shift.id}`,
        priority: 'urgent' as const,
        category: 'mission' as const,
        title: 'Upcoming Shift',
        description: `${shift.title ?? shift.client_site ?? 'Shift'} — ${formatDateTime(shift.start_time)}`,
        timestamp: shift.start_time,
        isRead: false,
      })),
    ...swaps
      .filter((swap: SwapRequest) => swap.status === 'pending')
      .map((swap: SwapRequest) => ({
        id: `swap-${swap.id}`,
        priority: 'high' as const,
        category: 'shift' as const,
        title: 'Swap Request',
        description: 'A shift swap request requires review.',
        timestamp: swap.created_at,
        isRead: false,
      })),
    ...mapNotificationsToItems(notifications),
  ]

  const successCount = [
    shiftsResult.status === 'fulfilled',
    notificationsResult.status === 'fulfilled',
    swapFeed?.feedState === 'ready',
  ].filter(Boolean).length

  return {
    items,
    actionableCount: items.length,
    notice,
    hasError: successCount === 0,
  }
}

async function fetchSupervisorSummary(userId: string): Promise<QuickInboxSummary> {
  const headers = getAuthHeaders({ 'Content-Type': 'application/json' })
  const [approvals, incidents, shifts, notifications] = await Promise.all([
    safeFetchPendingApprovals(`${API_BASE_URL}/api/users/pending-approvals`, headers),
    safeFetch<Incident>(`${API_BASE_URL}/api/incidents`, headers),
    safeFetch<Shift>(`${API_BASE_URL}/api/guard-replacement/shifts`, headers),
    safeFetch<NotificationRecord>(`${API_BASE_URL}/api/users/${encodeURIComponent(userId)}/notifications`, headers),
  ])

  const items: InboxItem[] = [
    ...approvals.map((approval) => ({
      id: `approval-${approval.id}`,
      priority: 'urgent' as const,
      category: 'approval' as const,
      title: 'Guard Replacement Needed',
      description: approval.guard_name ?? approval.role ?? 'Replacement requested',
      timestamp: approval.created_at ?? approval.requested_at ?? new Date().toISOString(),
      isRead: false,
    })),
    ...incidents
      .filter((incident) => incident.status !== 'closed')
      .map((incident) => ({
        id: `incident-${incident.id}`,
        priority: 'high' as const,
        category: 'incident' as const,
        title: incident.title ?? incident.type ?? 'Incident',
        description: incident.location ?? 'No location specified',
        timestamp: incident.created_at ?? incident.reported_at ?? new Date().toISOString(),
        isRead: false,
      })),
    ...shifts
      .filter((shift) => !shift.guard_id)
      .map((shift) => ({
        id: `shift-${shift.id}`,
        priority: 'high' as const,
        category: 'shift' as const,
        title: 'Unassigned Shift',
        description: shift.start_time && shift.end_time ? `${shift.start_time} – ${shift.end_time}` : 'Time unspecified',
        timestamp: shift.created_at ?? new Date().toISOString(),
        isRead: false,
      })),
    ...mapNotificationsToItems(notifications),
  ]

  return { items, actionableCount: items.length, notice: '', hasError: false }
}

async function fetchAdminSummary(userId: string): Promise<QuickInboxSummary> {
  const headers = getAuthHeaders({ 'Content-Type': 'application/json' })
  const [approvals, firearmsPrimary, notifications] = await Promise.all([
    safeFetchPendingApprovals(`${API_BASE_URL}/api/users/pending-approvals`, headers),
    safeFetch<FirearmItem>(`${API_BASE_URL}/api/firearm-allocations`, headers),
    safeFetch<NotificationRecord>(`${API_BASE_URL}/api/users/${encodeURIComponent(userId)}/notifications`, headers),
  ])
  const firearms = firearmsPrimary.length > 0 ? firearmsPrimary : await safeFetch<FirearmItem>(`${API_BASE_URL}/api/firearms`, headers)

  const items: InboxItem[] = [
    ...approvals.map((approval) => ({
      id: `approval-${approval.id}`,
      priority: 'urgent' as const,
      category: 'approval' as const,
      title: 'Pending Guard Approval',
      description: approval.guard_name
        ? `${approval.guard_name} — ${approval.reason ?? 'Replacement requested'}`
        : approval.reason ?? 'Guard replacement requires approval',
      timestamp: approval.requested_at ?? approval.created_at ?? new Date().toISOString(),
      isRead: false,
    })),
    ...firearms
      .filter((firearm) => {
        const status = (firearm.status ?? '').toLowerCase()
        return status === '' || ['pending', 'unassigned', 'returned', 'lost', 'maintenance'].includes(status)
      })
      .map((firearm) => ({
        id: `firearm-${firearm.id}`,
        priority: 'high' as const,
        category: 'firearm' as const,
        title: 'Firearm Status Review',
        description: firearm.model
          ? `${firearm.model} (S/N: ${firearm.serial_number ?? 'N/A'}) — status: ${firearm.status ?? 'unknown'}`
          : `Firearm S/N ${firearm.serial_number ?? firearm.id} — status: ${firearm.status ?? 'unknown'}`,
        timestamp: firearm.updated_at ?? firearm.created_at ?? new Date().toISOString(),
        isRead: false,
      })),
    ...mapNotificationsToItems(notifications),
  ]

  return { items, actionableCount: items.length, notice: '', hasError: false }
}

async function fetchSuperadminSummary(userId: string): Promise<QuickInboxSummary> {
  const headers = getAuthHeaders({ 'Content-Type': 'application/json' })
  const [notifications, approvals, incidents] = await Promise.all([
    safeFetch<NotificationRecord>(`${API_BASE_URL}/api/users/${encodeURIComponent(userId)}/notifications`, headers),
    safeFetchPendingApprovals(`${API_BASE_URL}/api/users/pending-approvals`, headers),
    safeFetch<Incident>(`${API_BASE_URL}/api/incidents`, headers),
  ])

  const items: InboxItem[] = [
    ...incidents
      .filter((incident) => incident.status !== 'closed' && incident.status !== 'resolved')
      .map((incident) => ({
        id: `incident-${incident.id}`,
        priority: 'urgent' as const,
        category: 'compliance' as const,
        title: 'Critical Incident Requires Review',
        description: incident.description ?? incident.title ?? `Incident #${incident.id}`,
        timestamp: incident.created_at ?? new Date().toISOString(),
        isRead: false,
      })),
    ...approvals.map((approval) => ({
      id: `approval-${approval.id}`,
      priority: 'high' as const,
      category: 'approval' as const,
      title: 'Pending System Approval',
      description: approval.description ?? `Approval request #${approval.id}`,
      timestamp: approval.created_at ?? new Date().toISOString(),
      isRead: false,
    })),
    ...mapNotificationsToItems(notifications),
  ]

  return { items, actionableCount: items.length, notice: '', hasError: false }
}

export async function fetchRoleInboxSummary(userId: string, roleInput: unknown): Promise<QuickInboxSummary> {
  const role = normalizeRole(roleInput)

  if (role == null) {
    return {
      items: [],
      actionableCount: 0,
      notice: 'Inbox summary is unavailable for the current role.',
      hasError: true,
    }
  }

  if (role === 'guard') return fetchGuardSummary(userId)
  if (role === 'supervisor') return fetchSupervisorSummary(userId)
  if (role === 'admin') return fetchAdminSummary(userId)
  return fetchSuperadminSummary(userId)
}