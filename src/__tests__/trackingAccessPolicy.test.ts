import {
  canProduceTrackingHeartbeat,
  canManageTrackingSites,
  hasTrackingEndpointAccess,
  isElevatedRole,
  normalizeRole,
} from '../types/auth'

describe('tracking access policy', () => {
  it('normalizes known and legacy roles but fails closed on malformed values', () => {
    expect(normalizeRole('superadmin')).toBe('superadmin')
    expect(normalizeRole('admin')).toBe('admin')
    expect(normalizeRole('supervisor')).toBe('supervisor')
    expect(normalizeRole('guard')).toBe('guard')
    expect(normalizeRole('user')).toBe('guard')

    expect(normalizeRole('unknown-role')).toBeNull()
    expect(normalizeRole('')).toBeNull()
    expect(normalizeRole(null)).toBeNull()
  })

  it('allows tracking endpoint access for all operational roles', () => {
    expect(hasTrackingEndpointAccess('superadmin')).toBe(true)
    expect(hasTrackingEndpointAccess('admin')).toBe(true)
    expect(hasTrackingEndpointAccess('supervisor')).toBe(true)
    expect(hasTrackingEndpointAccess('guard')).toBe(true)
  })

  it('retains legacy user tracking compatibility and rejects malformed values', () => {
    expect(hasTrackingEndpointAccess('user')).toBe(true)
    expect(hasTrackingEndpointAccess('unknown-role')).toBe(false)
    expect(hasTrackingEndpointAccess('')).toBe(false)
    expect(hasTrackingEndpointAccess(null)).toBe(false)
  })

  it('keeps elevated tracking read access while denying heartbeat producer access', () => {
    expect(hasTrackingEndpointAccess('admin')).toBe(true)
    expect(hasTrackingEndpointAccess('superadmin')).toBe(true)

    expect(canProduceTrackingHeartbeat('admin')).toBe(false)
    expect(canProduceTrackingHeartbeat('superadmin')).toBe(false)

    expect(hasTrackingEndpointAccess('unknown-role')).toBe(false)
    expect(canProduceTrackingHeartbeat('unknown-role')).toBe(false)
  })

  it('limits heartbeat producer access to guard and supervisor roles', () => {
    expect(canProduceTrackingHeartbeat('guard')).toBe(true)
    expect(canProduceTrackingHeartbeat('supervisor')).toBe(true)

    expect(canProduceTrackingHeartbeat('admin')).toBe(false)
    expect(canProduceTrackingHeartbeat('superadmin')).toBe(false)

    // Legacy sessions that still carry `user` normalize to guard.
    expect(canProduceTrackingHeartbeat('user')).toBe(true)
    expect(canProduceTrackingHeartbeat('unknown-role')).toBe(false)
    expect(canProduceTrackingHeartbeat('')).toBe(false)
    expect(canProduceTrackingHeartbeat(null)).toBe(false)
  })

  it('rejects malformed values for elevated-role checks', () => {
    expect(isElevatedRole('superadmin')).toBe(true)
    expect(isElevatedRole('admin')).toBe(true)
    expect(isElevatedRole('supervisor')).toBe(true)
    expect(isElevatedRole('guard')).toBe(false)
    expect(isElevatedRole('user')).toBe(false)
    expect(isElevatedRole('unknown-role')).toBe(false)
    expect(isElevatedRole('')).toBe(false)
    expect(isElevatedRole(null)).toBe(false)
  })

  it('limits client-site management controls to elevated roles', () => {
    expect(canManageTrackingSites('superadmin')).toBe(true)
    expect(canManageTrackingSites('admin')).toBe(true)
    expect(canManageTrackingSites('supervisor')).toBe(true)
    expect(canManageTrackingSites('guard')).toBe(false)
    expect(canManageTrackingSites('user')).toBe(false)
    expect(canManageTrackingSites('unknown-role')).toBe(false)
    expect(canManageTrackingSites('')).toBe(false)
    expect(canManageTrackingSites(null)).toBe(false)
  })
})
