export interface IncidentSiteRecord {
  location?: string | null
  site_name?: string | null
  reported_by?: string | null
  created_at?: string | null
}

export interface IncidentShiftSiteRecord {
  guard_id?: string | null
  client_site?: string | null
  start_time?: string | null
  end_time?: string | null
}

const coordinateLocationPattern = /^\s*[+-]?\d+(?:\.\d+)?\s*,\s*[+-]?\d+(?:\.\d+)?(?:\s*\(approximate\))?\s*$/i

function isWithinShiftWindow(incident: IncidentSiteRecord, shift: IncidentShiftSiteRecord): boolean {
  if (!incident.created_at || !shift.start_time || !shift.end_time) return false

  const incidentTime = new Date(incident.created_at).getTime()
  const startTime = new Date(shift.start_time).getTime()
  const endTime = new Date(shift.end_time).getTime()

  return Number.isFinite(incidentTime) && Number.isFinite(startTime) && Number.isFinite(endTime)
    && incidentTime >= startTime - 15 * 60 * 1000
    && incidentTime <= endTime + 15 * 60 * 1000
}

/** Returns the human-readable site label while keeping raw coordinates out of operational summaries. */
export function resolveIncidentSiteName(
  incident: IncidentSiteRecord,
  shifts: IncidentShiftSiteRecord[] = [],
): string {
  const explicitSite = incident.site_name?.trim()
  if (explicitSite) return explicitSite

  const scheduledSite = shifts.find((shift) =>
    shift.guard_id === incident.reported_by
    && Boolean(shift.client_site?.trim())
    && isWithinShiftWindow(incident, shift),
  )?.client_site?.trim()

  if (scheduledSite) return scheduledSite

  const location = incident.location?.trim()
  if (location && !coordinateLocationPattern.test(location)) return location

  return 'Unassigned site'
}
