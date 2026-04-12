import {
  hasCurrentUserTrackingPosition,
  isCurrentUserTrackingPoint,
  shouldShowClientSiteDraftMarker,
} from '../operationalMapTruthfulness'

describe('operationalMapTruthfulness', () => {
  describe('shouldShowClientSiteDraftMarker', () => {
    it('shows draft marker only for elevated users in add/edit pick mode', () => {
      expect(shouldShowClientSiteDraftMarker(true, 'idle')).toBe(false)
      expect(shouldShowClientSiteDraftMarker(true, 'add')).toBe(true)
      expect(shouldShowClientSiteDraftMarker(true, 'edit')).toBe(true)
      expect(shouldShowClientSiteDraftMarker(false, 'add')).toBe(false)
      expect(shouldShowClientSiteDraftMarker(false, 'edit')).toBe(false)
    })
  })

  describe('isCurrentUserTrackingPoint', () => {
    it('matches by entityId when entity id maps to logged-in user', () => {
      expect(isCurrentUserTrackingPoint('guard-1', 'guard-1', undefined)).toBe(true)
    })

    it('matches by userId when tracking entity id differs from logged-in user id', () => {
      expect(isCurrentUserTrackingPoint('guard-1', 'tracking-entity-77', 'guard-1')).toBe(true)
    })

    it('returns false when neither entityId nor userId matches', () => {
      expect(isCurrentUserTrackingPoint('guard-1', 'tracking-entity-77', 'other-user')).toBe(false)
    })
  })

  describe('hasCurrentUserTrackingPosition', () => {
    it('returns true only when latitude and longitude are finite numbers', () => {
      expect(hasCurrentUserTrackingPosition([7.4478, 125.8078])).toBe(true)
    })

    it('returns false when current user position is missing', () => {
      expect(hasCurrentUserTrackingPosition(null)).toBe(false)
    })

    it('returns false when either coordinate is not finite', () => {
      expect(hasCurrentUserTrackingPosition([Number.NaN, 125.8078])).toBe(false)
      expect(hasCurrentUserTrackingPosition([7.4478, Number.POSITIVE_INFINITY])).toBe(false)
    })
  })
})
