import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../config'
import { getSidebarNav } from '../config/navigation'
import type { User } from '../context/AuthContext'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'
import SupportTickets from './guards/SupportTickets'
import OperationalShell from './layout/OperationalShell'
import SearchableSelect from './shared/SearchableSelect'

interface GuardTicketOwner {
  id: string
  username: string
  full_name?: string
  guard_code?: string | null
}

interface Props {
  user: User
  onLogout: () => void
  onViewChange: (view: string) => void
}

export default function ElevatedSupportPage({ user, onLogout, onViewChange }: Props) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [guardId, setGuardId] = useState('')
  const [guards, setGuards] = useState<GuardTicketOwner[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    void fetchJsonOrThrow<GuardTicketOwner[]>(`${API_BASE_URL}/api/guards`, {
      headers: getAuthHeaders(),
      signal: controller.signal,
    }, 'Unable to load the guard roster.').then((result) => {
      if (!controller.signal.aborted) setGuards(result)
    }).catch(() => {
      if (!controller.signal.aborted) setError('Unable to load the guard roster. Refresh the page to try again.')
    })
    return () => controller.abort()
  }, [])

  return (
    <OperationalShell
      user={user}
      title="Support Tickets"
      navItems={getSidebarNav(user.role)}
      activeView="support"
      onNavigate={onViewChange}
      onLogout={onLogout}
      mobileMenuOpen={mobileMenuOpen}
      onMenuOpen={() => setMobileMenuOpen(true)}
      onMenuClose={() => setMobileMenuOpen(false)}
      onLogoClick={() => onViewChange('dashboard')}
    >
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <div className="max-w-lg space-y-2">
          <SearchableSelect
            id="ticket-owner"
            label="View tickets for"
            placeholder="Search by guard name or ID"
            helperText="Search for a guard to view their tickets."
            emptyMessage="No accounts available."
            noResultsMessage={() => 'No matching guards.'}
            value={guardId || user.id}
            onChange={(id) => setGuardId(id === user.id ? '' : id)}
            options={[
              { id: user.id, value: user.id, label: 'My tickets' },
              ...guards.map((guard) => ({
                id: guard.id,
                value: guard.id,
                label: guard.full_name || guard.username,
                searchValues: [guard.guard_code, guard.username],
              })),
            ]}
          />
          {error ? <p className="text-sm text-danger-text" role="alert">{error}</p> : null}
        </div>
        <SupportTickets key={guardId || user.id} userId={guardId || user.id} canCreate={!guardId} />
      </div>
    </OperationalShell>
  )
}
