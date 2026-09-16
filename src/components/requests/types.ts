export type OperationalRequestType = 'service' | 'deposit' | 'return' | 'firearm_registration'
export type OperationalRequestPriority = 'normal' | 'high' | 'urgent'
export type OperationalRequestStatus =
  | 'pending'
  | 'needs_correction'
  | 'approved'
  | 'rejected'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export interface OperationalRequest {
  id: string
  requestType: OperationalRequestType
  status: OperationalRequestStatus
  requesterId: string
  requesterName: string
  resourceType?: string | null
  resourceId?: string | null
  subject: string
  reason: string
  details?: string | null
  priority: OperationalRequestPriority
  clientSiteId?: string | null
  shiftId?: string | null
  operationalEventKey?: string | null
  reviewerId?: string | null
  reviewedAt?: string | null
  decisionReason?: string | null
  fulfilledBy?: string | null
  fulfilledAt?: string | null
  archivedBy?: string | null
  archivedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface OperationalRequestEvent {
  id: string
  requestId: string
  actorUserId?: string | null
  actorName?: string | null
  fromStatus?: string | null
  toStatus: OperationalRequestStatus
  comment?: string | null
  createdAt: string
}

export interface RequestResource {
  id: string
  resourceType: 'firearm_allocation' | 'equipment'
  label: string
  serialNumber?: string | null
  caliber?: string | null
}

export interface CreateOperationalRequestPayload {
  requestType: OperationalRequestType
  resourceType?: string
  resourceId?: string
  subject: string
  reason: string
  details?: string
  priority: OperationalRequestPriority
}

export interface OperationalRequestListResponse {
  total: number
  page: number
  pageSize: number
  items: OperationalRequest[]
}

export const REQUEST_TYPE_LABELS: Record<OperationalRequestType, string> = {
  service: 'Request for Service',
  deposit: 'Resource Deposit',
  return: 'Resource Return',
  firearm_registration: 'Firearm Registration Suggestion',
}

export const REQUEST_STATUS_LABELS: Record<OperationalRequestStatus, string> = {
  pending: 'Pending Review',
  needs_correction: 'Needs Correction',
  approved: 'Approved',
  rejected: 'Rejected',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}
