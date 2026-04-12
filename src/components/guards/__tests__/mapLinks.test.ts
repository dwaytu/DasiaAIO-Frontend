import { buildGuardMapLinks } from '../mapLinks'

describe('buildGuardMapLinks', () => {
  it('does not include a marker when no live location is available', () => {
    const links = buildGuardMapLinks(null)

    expect(links.mapEmbedUrl).not.toContain('&marker=')
    expect(links.mapExternalUrl).not.toContain('?mlat=')
    expect(links.mapExternalUrl).toContain('#map=14/')
  })

  it('includes marker coordinates when live location is available', () => {
    const links = buildGuardMapLinks({
      latitude: 7.4478,
      longitude: 125.8078,
    })

    expect(links.mapEmbedUrl).toContain('&marker=7.447800%2C125.807800')
    expect(links.mapExternalUrl).toContain('?mlat=7.4478&mlon=125.8078#map=16/7.4478/125.8078')
  })
})
