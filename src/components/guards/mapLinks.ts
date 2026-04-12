const TAGUM_CENTER: [number, number] = [7.4478, 125.8078]

interface MapCoordinates {
  latitude: number
  longitude: number
}

function buildMapBbox(latitude: number, longitude: number): string {
  const delta = 0.008
  const left = (longitude - delta).toFixed(6)
  const right = (longitude + delta).toFixed(6)
  const bottom = (latitude - delta).toFixed(6)
  const top = (latitude + delta).toFixed(6)
  return `${left}%2C${bottom}%2C${right}%2C${top}`
}

export function buildGuardMapLinks(location: MapCoordinates | null): {
  mapEmbedUrl: string
  mapExternalUrl: string
} {
  const latitude = location?.latitude ?? TAGUM_CENTER[0]
  const longitude = location?.longitude ?? TAGUM_CENTER[1]

  const mapEmbedBase = `https://www.openstreetmap.org/export/embed.html?bbox=${buildMapBbox(latitude, longitude)}&layer=mapnik`
  const mapEmbedUrl = location
    ? `${mapEmbedBase}&marker=${latitude.toFixed(6)}%2C${longitude.toFixed(6)}`
    : mapEmbedBase

  const mapExternalUrl = location
    ? `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`
    : `https://www.openstreetmap.org/#map=14/${latitude}/${longitude}`

  return {
    mapEmbedUrl,
    mapExternalUrl,
  }
}
