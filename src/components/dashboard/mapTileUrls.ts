// OpenStreetMap's standard tile endpoint does not require an application key.
// Dark mode is applied to the tile pane in index.css so both themes use the same
// keyless source without depending on a provider-specific dark-map API.
export const OPEN_STREET_MAP_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

export function getOperationalMapTileUrl(_theme: 'dark' | 'light'): string {
  return OPEN_STREET_MAP_TILE_URL
}
