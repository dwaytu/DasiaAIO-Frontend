export interface EmergencyContact {
  label: string
  phone: string
  role: string
}

export const EMERGENCY_CONTACTS: EmergencyContact[] = [
  { label: 'Branch Manager', phone: '+63 916 193 7142', role: 'branch-manager' },
  { label: 'Security Officer', phone: '+63 965 936 5982', role: 'security-officer' },
  { label: 'Secretary', phone: '+63 999 471 5417', role: 'secretary' },
  { label: 'Tech Support', phone: '+63 905 445 4900', role: 'tech-support' },
]

export function phoneToTelHref(phone: string): string {
  return `tel:${phone.replace(/\s/g, '')}`
}
