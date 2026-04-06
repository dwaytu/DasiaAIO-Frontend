import { CARTO_DARK_TILE_URL, CARTO_LIGHT_TILE_URL, getOperationalMapTileUrl } from '../mapTileUrls'

describe('getOperationalMapTileUrl', () => {
  it('uses dark_all tiles for dark theme', () => {
    expect(getOperationalMapTileUrl('dark')).toBe(CARTO_DARK_TILE_URL)
    expect(CARTO_DARK_TILE_URL).toContain('/dark_all/')
  })

  it('uses rastertiles voyager for light theme', () => {
    expect(getOperationalMapTileUrl('light')).toBe(CARTO_LIGHT_TILE_URL)
    expect(CARTO_LIGHT_TILE_URL).toContain('/rastertiles/voyager/')
  })
})
