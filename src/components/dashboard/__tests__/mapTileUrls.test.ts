import { OPEN_STREET_MAP_TILE_URL, getOperationalMapTileUrl } from '../mapTileUrls'

describe('getOperationalMapTileUrl', () => {
  it('uses a keyless tile source for dark theme', () => {
    expect(getOperationalMapTileUrl('dark')).toBe(OPEN_STREET_MAP_TILE_URL)
  })

  it('uses a keyless tile source for light theme', () => {
    expect(getOperationalMapTileUrl('light')).toBe(OPEN_STREET_MAP_TILE_URL)
    expect(OPEN_STREET_MAP_TILE_URL).toContain('tile.openstreetmap.org')
    expect(OPEN_STREET_MAP_TILE_URL).not.toMatch(/api[_-]?key|apikey|access[_-]?token/i)
  })
})
