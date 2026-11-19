export function withoutSampleCheckpoints<T extends { status?: string | null }>(points: T[]): T[] {
  return points.filter((point) => point.status?.trim().toLowerCase() !== 'presentation_checkpoint')
}
