import {
  canManageTrackingSites,
  hasTrackingEndpointAccess,
} from '../types/auth'

describe('tracking access policy', () => {
  it('allows tracking endpoint access for all operational roles', () => {
    expect(hasTrackingEndpointAccess('superadmin')).toBe(true)
    expect(hasTrackingEndpointAccess('admin')).toBe(true)
    expect(hasTrackingEndpointAccess('supervisor')).toBe(true)
    expect(hasTrackingEndpointAccess('guard')).toBe(true)
  })

  it('normalizes legacy tracking roles and rejects malformed values', () => {
    expect(hasTrackingEndpointAccess('user')).toBe(true)
    expect(hasTrackingEndpointAccess('unknown-role')).toBe(false)
    expect(hasTrackingEndpointAccess('')).toBe(false)
    expect(hasTrackingEndpointAccess(null)).toBe(false)
  })

  it('limits client-site management controls to elevated roles', () => {
    expect(canManageTrackingSites('superadmin')).toBe(true)
    expect(canManageTrackingSites('admin')).toBe(true)
    expect(canManageTrackingSites('supervisor')).toBe(true)
    expect(canManageTrackingSites('guard')).toBe(false)
  })
})
