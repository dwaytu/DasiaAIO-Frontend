import type { User } from '../../../context/AuthContext'
import { requestActions } from '../requestWorkflow'
import type { OperationalRequest, OperationalRequestStatus } from '../types'

const guard: User = { id: 'guard-1', email: 'guard@example.com', username: 'guard', role: 'guard' }
const supervisor: User = { id: 'supervisor-1', email: 'supervisor@example.com', username: 'supervisor', role: 'supervisor' }
const admin: User = { id: 'admin-1', email: 'admin@example.com', username: 'admin', role: 'admin' }

function request(status: OperationalRequestStatus, requesterId = guard.id): OperationalRequest {
  return {
    id: 'request-1',
    requestType: 'service',
    status,
    requesterId,
    requesterName: 'Test Guard',
    subject: 'Service request',
    reason: 'Operational need',
    priority: 'normal',
    createdAt: '2026-09-09T00:00:00Z',
    updatedAt: '2026-09-09T00:00:00Z',
  }
}

describe('operational request action controls', () => {
  it('lets a guard cancel only their own editable request', () => {
    expect(requestActions(request('pending'), guard)).toEqual(['cancel'])
    expect(requestActions(request('needs_correction'), guard)).toEqual(['cancel'])
    expect(requestActions(request('pending', 'guard-2'), guard)).toEqual([])
  })

  it('lets supervisors review pending requests but not fulfill them', () => {
    expect(requestActions(request('pending'), supervisor)).toEqual([
      'approve',
      'return-for-correction',
      'reject',
    ])
    expect(requestActions(request('approved'), supervisor)).toEqual([])
  })

  it('lets administrators fulfill approved requests', () => {
    expect(requestActions(request('approved'), admin)).toEqual(['start', 'complete', 'cancel'])
    expect(requestActions(request('in_progress'), admin)).toEqual(['complete', 'cancel'])
  })

  it('prevents elevated requesters from reviewing their own request', () => {
    expect(requestActions(request('pending', admin.id), admin)).toEqual(['cancel'])
  })
})
