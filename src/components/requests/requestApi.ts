import { API_BASE_URL } from '../../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../../utils/api'
import type {
  CreateOperationalRequestPayload,
  OperationalRequest,
  OperationalRequestEvent,
  OperationalRequestListResponse,
  OperationalRequestStatus,
  OperationalRequestType,
  RequestResource,
} from './types'

interface RequestResponse {
  request: OperationalRequest
}

interface RequestDetailResponse extends RequestResponse {
  events: OperationalRequestEvent[]
}

interface ResourceResponse {
  firearmAllocations?: RequestResource[]
  equipment?: RequestResource[]
}

export interface RequestFilters {
  page?: number
  pageSize?: number
  status?: OperationalRequestStatus | 'all'
  requestType?: OperationalRequestType | 'all'
  priority?: string | 'all'
  requester?: string
  dateFrom?: string
  dateTo?: string
}

function jsonInit(method: string, body: unknown, signal?: AbortSignal): RequestInit {
  return {
    method,
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
    signal,
  }
}

export async function listOperationalRequests(
  filters: RequestFilters,
  signal?: AbortSignal,
): Promise<OperationalRequestListResponse> {
  const params = new URLSearchParams({
    page: String(filters.page ?? 1),
    pageSize: String(filters.pageSize ?? 100),
  })
  if (filters.status && filters.status !== 'all') params.set('status', filters.status)
  if (filters.requestType && filters.requestType !== 'all') {
    params.set('requestType', filters.requestType)
  }
  if (filters.priority && filters.priority !== 'all') params.set('priority', filters.priority)
  if (filters.requester?.trim()) params.set('requester', filters.requester.trim())
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  return fetchJsonOrThrow(
    `${API_BASE_URL}/api/operational-requests?${params.toString()}`,
    { headers: getAuthHeaders(), signal },
    'Unable to load operational requests.',
  )
}

export async function getOperationalRequest(
  requestId: string,
  signal?: AbortSignal,
): Promise<RequestDetailResponse> {
  return fetchJsonOrThrow(
    `${API_BASE_URL}/api/operational-requests/${encodeURIComponent(requestId)}`,
    { headers: getAuthHeaders(), signal },
    'Unable to load request details.',
  )
}

export async function getRequestResources(signal?: AbortSignal): Promise<RequestResource[]> {
  const response = await fetchJsonOrThrow<ResourceResponse>(
    `${API_BASE_URL}/api/operational-requests/resources/mine`,
    { headers: getAuthHeaders(), signal },
    'Unable to load assigned resources.',
  )
  return [...(response.firearmAllocations ?? []), ...(response.equipment ?? [])]
}

export async function createOperationalRequest(
  payload: CreateOperationalRequestPayload,
): Promise<OperationalRequest> {
  const response = await fetchJsonOrThrow<RequestResponse>(
    `${API_BASE_URL}/api/operational-requests`,
    jsonInit('POST', payload),
    'Unable to submit the request.',
  )
  return response.request
}

export type RequestAction =
  | 'approve'
  | 'reject'
  | 'return-for-correction'
  | 'cancel'
  | 'start'
  | 'complete'

export async function updateOperationalRequest(
  requestId: string,
  action: RequestAction,
  reason?: string,
): Promise<OperationalRequest> {
  const response = await fetchJsonOrThrow<RequestResponse>(
    `${API_BASE_URL}/api/operational-requests/${encodeURIComponent(requestId)}/${action}`,
    jsonInit('POST', { reason: reason?.trim() || null }),
    'Unable to update the request.',
  )
  return response.request
}

export async function resubmitOperationalRequest(
  requestId: string,
  payload: Pick<CreateOperationalRequestPayload, 'subject' | 'reason' | 'details' | 'priority'>,
): Promise<OperationalRequest> {
  const response = await fetchJsonOrThrow<RequestResponse>(
    `${API_BASE_URL}/api/operational-requests/${encodeURIComponent(requestId)}/resubmit`,
    jsonInit('POST', payload),
    'Unable to resubmit the request.',
  )
  return response.request
}
