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
        <div className="mt-2 flex flex-wrap gap-2 max-[359px]:pr-20">
          {EMERGENCY_CONTACTS.map((contact) => (
            <a
              key={contact.phone}
              href={phoneToTelHref(contact.phone)}
              aria-label={`Call ${contact.label} at ${contact.phone}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-primary max-[359px]:w-full max-[359px]:min-w-0 max-[359px]:flex-wrap"
            >
              <Phone className="h-4 w-4 text-text-secondary" aria-hidden="true" />
              <span className="font-semibold">{contact.label}</span>
              <span className="text-text-secondary">{contact.phone}</span>
            </a>
          ))}
        </div>
      ) : null}
    </nav>
  )
}

export default EmergencyContactsBar
