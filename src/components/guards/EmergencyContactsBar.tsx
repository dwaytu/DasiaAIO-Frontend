import { FC, useState } from 'react'
import { ChevronDown, Phone } from 'lucide-react'
import { EMERGENCY_CONTACTS, phoneToTelHref } from '../../constants/emergencyContacts'

const EmergencyContactsBar: FC = () => {
  const [expanded, setExpanded] = useState(true)

  return (
    <nav aria-label="Emergency contacts" className="border-t border-border bg-surface-elevated px-4 py-2">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        className="flex min-h-11 w-full items-center justify-between text-xs font-semibold text-text-secondary"
      >
        <span className="inline-flex items-center gap-2">
          <Phone className="h-4 w-4" aria-hidden="true" />
          Emergency Contacts
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {expanded ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {EMERGENCY_CONTACTS.map((contact) => (
            <a
              key={contact.phone}
              href={phoneToTelHref(contact.phone)}
              aria-label={`Call ${contact.label} at ${contact.phone}`}
              className="inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-md border border-border bg-surface px-2 py-2 text-center text-xs font-semibold text-text-primary"
            >
              <Phone className="h-3.5 w-3.5 shrink-0 text-text-secondary" aria-hidden="true" />
              <span className="min-w-0 leading-tight">{contact.label}</span>
              <span className="sr-only">{contact.phone}</span>
            </a>
          ))}
        </div>
      ) : null}
    </nav>
  )
}

export default EmergencyContactsBar
