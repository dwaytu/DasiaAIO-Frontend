export interface PendingApprovalRecord {
  id: string
  guard_name?: string
  role?: string
  reason?: string
  description?: string
  requested_at?: string
  created_at?: string
  status?: string
}

type PendingApprovalsEnvelope = {
  users?: unknown[]
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return undefined
}

function normalizePendingApproval(entry: unknown): PendingApprovalRecord | null {
  if (!entry || typeof entry !== 'object') return null

  const raw = entry as Record<string, unknown>
  const id = asString(raw.id)
  if (!id) return null

  const createdAt = asString(raw.created_at)

  return {
    id,
    guard_name: asString(raw.guard_name) ?? asString(raw.full_name) ?? asString(raw.username),
    role: asString(raw.role),
    reason: asString(raw.reason),
    description: asString(raw.description),
    requested_at: asString(raw.requested_at) ?? createdAt,
    created_at: createdAt,
    status: asString(raw.status) ?? asString(raw.approval_status),
  }
}

export function parsePendingApprovalsPayload(payload: unknown): PendingApprovalRecord[] {
  const candidates = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as PendingApprovalsEnvelope).users)
      ? (payload as PendingApprovalsEnvelope).users ?? []
      : []

  const normalized: PendingApprovalRecord[] = []
  for (const candidate of candidates) {
    const parsed = normalizePendingApproval(candidate)
    if (parsed) {
      normalized.push(parsed)
    }
  }

  return normalized
}