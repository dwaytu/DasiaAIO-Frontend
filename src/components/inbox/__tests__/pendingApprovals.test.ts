import { parsePendingApprovalsPayload } from '../pendingApprovals'

describe('parsePendingApprovalsPayload', () => {
  it('parses a legacy array payload', () => {
    const payload = [
      {
        id: 'approval-1',
        guard_name: 'Alex Guard',
        role: 'guard',
        reason: 'Shift replacement',
        requested_at: '2026-04-06T08:00:00.000Z',
      },
    ]

    const result = parsePendingApprovalsPayload(payload)

    expect(result).toEqual([
      {
        id: 'approval-1',
        guard_name: 'Alex Guard',
        role: 'guard',
        reason: 'Shift replacement',
        description: undefined,
        requested_at: '2026-04-06T08:00:00.000Z',
        created_at: undefined,
        status: undefined,
      },
    ])
  })

  it('parses the users envelope payload from /api/users/pending-approvals', () => {
    const payload = {
      total: 1,
      users: [
        {
          id: 'user-1',
          full_name: 'Jamie Analyst',
          role: 'supervisor',
          approval_status: 'pending',
          created_at: '2026-04-06T09:30:00.000Z',
        },
      ],
    }

    const result = parsePendingApprovalsPayload(payload)

    expect(result).toEqual([
      {
        id: 'user-1',
        guard_name: 'Jamie Analyst',
        role: 'supervisor',
        reason: undefined,
        description: undefined,
        requested_at: '2026-04-06T09:30:00.000Z',
        created_at: '2026-04-06T09:30:00.000Z',
        status: 'pending',
      },
    ])
  })

  it('returns an empty array for unsupported payload shapes', () => {
    expect(parsePendingApprovalsPayload({})).toEqual([])
    expect(parsePendingApprovalsPayload(null)).toEqual([])
  })
})
