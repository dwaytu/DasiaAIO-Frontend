import { FC, useState } from 'react'
import { EMERGENCY_CONTACTS, phoneToTelHref } from '../../constants/emergencyContacts'

const EmergencyContactsBar: FC = () => {
  const [expanded, setExpanded] = useState(true)

  return (
    <nav aria-label="Emergency contacts" className="border-t border-border bg-surface-elevated px-4 py-2">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between text-xs font-semibold text-text-secondary"
      >
        <span>📞 Emergency Contacts</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-2 flex flex-wrap gap-2">
          {EMERGENCY_CONTACTS.map((contact) => (
            <a
              key={contact.phone}
              href={phoneToTelHref(contact.phone)}
              aria-label={`Call ${contact.label} at ${contact.phone}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-primary"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
                className="h-4 w-4 text-text-secondary"
              >
                <path fillRule="evenodd" d="M2 3.5A1.5 1.5 0 013.5 2h1.148a1.5 1.5 0 011.465 1.175l.716 3.223a1.5 1.5 0 01-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 006.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 011.767-1.052l3.223.716A1.5 1.5 0 0118 15.352V16.5a1.5 1.5 0 01-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A13.022 13.022 0 012.43 8.326 13.019 13.019 0 012 5V3.5z" clipRule="evenodd" />
              </svg>
              <span className="font-semibold">{contact.label}</span>
              <span className="text-text-secondary">{contact.phone}</span>
            </a>
          ))}
        </div>
      )}
    </nav>
  )
}

export default EmergencyContactsBar
