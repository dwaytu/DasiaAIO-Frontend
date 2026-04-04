export interface EmergencyContact {
  label: string
  phone: string
  role: string
}

export const EMERGENCY_CONTACTS: EmergencyContact[] = [
  { label: 'Operations Desk', phone: '+63 912 345 6789', role: 'operations' },
  { label: 'Site Supervisor', phone: '+63 901 234 5678', role: 'supervisor' },
  { label: 'HR / Compliance', phone: '+63 955 321 4567', role: 'hr' },
]

export function phoneToTelHref(phone: string): string {
  return `tel:${phone.replace(/\s/g, '')}`
}
