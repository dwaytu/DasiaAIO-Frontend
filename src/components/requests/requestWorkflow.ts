import type { User } from '../../context/AuthContext'
import { normalizeRole } from '../../types/auth'
import type { RequestAction } from './requestApi'
import type { OperationalRequest } from './types'

export function requestActions(request: OperationalRequest, user: User): RequestAction[] {
  const role = normalizeRole(user.role)
  const own = request.requesterId === user.id
  const canReview = role === 'admin' || role === 'superadmin'
  const canFulfill = role === 'admin' || role === 'superadmin'

  if (request.status === 'pending') {
    const actions: RequestAction[] = []
    if (canReview && !own) actions.push('approve', 'return-for-correction', 'reject')
    if (own) actions.push('cancel')
    return actions
  }
  if (request.status === 'needs_correction' && own) return ['cancel']
  if (request.status === 'approved' && canFulfill) return ['start', 'complete', 'cancel']
  if (request.status === 'in_progress' && canFulfill) return ['complete', 'cancel']
  return []
}
