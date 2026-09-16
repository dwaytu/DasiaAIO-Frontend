import { resolveIncidentSiteName } from '../incidentSite'

describe('resolveIncidentSiteName', () => {
  it('prefers the persisted site name', () => {
    expect(resolveIncidentSiteName({
      location: '7.26, 125.63',
      site_name: 'DSIA - Tagum',
    })).toBe('DSIA - Tagum')
  })

  it('resolves legacy coordinate-only incidents from the reporter shift', () => {
    expect(resolveIncidentSiteName(
      {
        location: '7.26, 125.63',
        reported_by: 'guard-1',
        created_at: '2026-09-10T00:10:00.000Z',
      },
      [{
        guard_id: 'guard-1',
        client_site: 'DSIA - Tagum',
        start_time: '2026-09-10T00:00:00.000Z',
        end_time: '2026-09-10T08:00:00.000Z',
      }],
    )).toBe('DSIA - Tagum')
  })

  it('never exposes unresolved coordinates in the operational label', () => {
    expect(resolveIncidentSiteName({ location: '7.26, 125.63' })).toBe('Unassigned site')
  })

  it('keeps an existing human-readable location', () => {
    expect(resolveIncidentSiteName({ location: 'North Gate' })).toBe('North Gate')
  })
})
