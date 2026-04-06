export const CARTO_DARK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
export const CARTO_LIGHT_TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'

export function getOperationalMapTileUrl(theme: 'dark' | 'light'): string {
  return theme === 'dark' ? CARTO_DARK_TILE_URL : CARTO_LIGHT_TILE_URL
}
