export type MapPickMode = 'idle' | 'add' | 'edit'

export function shouldShowClientSiteDraftMarker(isElevatedUser: boolean, mapPickMode: MapPickMode): boolean {
  return isElevatedUser && mapPickMode !== 'idle'
}

export function hasCurrentUserTrackingPosition(position: [number, number] | null): position is [number, number] {
  if (!position) return false

  const [latitude, longitude] = position
  return Number.isFinite(latitude) && Number.isFinite(longitude)
}

export function isCurrentUserTrackingPoint(
  currentUserId: string,
  pointEntityId?: string,
  pointUserId?: string,
): boolean {
  const normalizedCurrentUserId = currentUserId.trim().toLowerCase()
  if (!normalizedCurrentUserId) return false

  const entityId = pointEntityId?.trim().toLowerCase() || ''
  const userId = pointUserId?.trim().toLowerCase() || ''

  return entityId === normalizedCurrentUserId || userId === normalizedCurrentUserId
}
