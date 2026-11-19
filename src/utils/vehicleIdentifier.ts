export function formatVehicleIdentifier(fleetNumber?: string | null, plateNumber?: string | null): string {
  const fleet = fleetNumber?.trim()
  const plate = plateNumber?.trim()
  if (!plate || plate.toLowerCase() === 'not provided' || plate === fleet) return fleet || ''
  return fleet ? `${fleet} - ${plate}` : plate
}
