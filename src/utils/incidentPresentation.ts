import type { Incident } from '../hooks/useIncidents'

const UUID_LIKE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const PANIC_ALERT_PATTERN =
  /Emergency panic alert triggered by(?: guard)?(?: \(([^)]+)\)| ([^.]+))?/i

function resolveIncidentReporterName(incident: Pick<Incident, 'reported_by' | 'reported_by_name'>): string {
  const explicitName = incident.reported_by_name?.trim()
  if (explicitName) return explicitName

  const fallbackReporter = incident.reported_by?.trim()
  if (!fallbackReporter || UUID_LIKE_PATTERN.test(fallbackReporter)) {
    return 'Guard (unidentified)'
  }

  return fallbackReporter
}

export function getOperatorFacingIncidentDescription(
  incident: Pick<Incident, 'description' | 'reported_by' | 'reported_by_name'>,
): string {
  const rawDescription = incident.description?.trim()
  if (!rawDescription) {
    return ''
  }

  if (!PANIC_ALERT_PATTERN.test(rawDescription)) {
    return rawDescription
  }

  const reporterName = resolveIncidentReporterName(incident)
  return `Emergency panic alert triggered by ${reporterName}`
}

export function buildIncidentHandoffNote(
  incident: Pick<Incident, 'title' | 'location' | 'reported_by' | 'reported_by_name' | 'description'>,
  summary: string,
  riskLevel: string,
  confidence: number,
  explanation: string,
  keyPhrases: string[],
): string {
  const lines = [
    `Incident: ${incident.title || 'Untitled incident'}`,
    `Location: ${incident.location || 'Unknown location'}`,
    `Risk level: ${riskLevel || 'unknown'}`,
    `Confidence: ${Math.round(confidence * 100)}%`,
    `Summary: ${summary}`,
  ]

  const operatorFacingDescription = getOperatorFacingIncidentDescription(incident)
  if (operatorFacingDescription) {
    lines.push(`Source detail: ${operatorFacingDescription}`)
  }

  if (explanation) {
    lines.push(`Explanation: ${explanation}`)
  }

  if (keyPhrases.length > 0) {
    lines.push(`Key phrases: ${keyPhrases.join(', ')}`)
  }

  return lines.join('\n')
}
