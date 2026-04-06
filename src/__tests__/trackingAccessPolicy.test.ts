import {
  canManageTrackingSites,
  hasTrackingEndpointAccess,
} from '../types/auth'

describe('tracking access policy', () => {
  it('allows tracking endpoint access for supervisor and guard roles', () => {
    expect(hasTrackingEndpointAccess('supervisor')).toBe(true)
    expect(hasTrackingEndpointAccess('guard')).toBe(true)
  })

  it('denies tracking endpoint access for admin and superadmin roles', () => {
    expect(hasTrackingEndpointAccess('admin')).toBe(false)
    expect(hasTrackingEndpointAccess('superadmin')).toBe(false)
  })

  it('limits client-site management controls to supervisors', () => {
    expect(canManageTrackingSites('supervisor')).toBe(true)
    expect(canManageTrackingSites('guard')).toBe(false)
    expect(canManageTrackingSites('admin')).toBe(false)
    expect(canManageTrackingSites('superadmin')).toBe(false)
  })
})
