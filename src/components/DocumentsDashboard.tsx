import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { getSidebarNav } from '../config/navigation'
import { FIREARM_DOCUMENTS_URL, ROUTES } from '../router/routes'
import type { User } from '../context/AuthContext'
import { can } from '../utils/permissions'
import FirearmComplianceReport from './FirearmComplianceReport'
import GuardLicenseComplianceReport from './GuardLicenseComplianceReport'
import OperationalShell from './layout/OperationalShell'

interface Props {
  user: User
  onLogout: () => void
  onViewChange: (view: string) => void
}

export default function DocumentsDashboard({ user, onLogout, onViewChange }: Props) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [params] = useSearchParams()
  const canViewFirearms = can(user.role, 'manage_firearms')
  const showFirearms = canViewFirearms && params.get('report') === 'firearms'
  const reportLinks = [
    { href: ROUTES.DOCUMENTS, label: 'Guard Documents', active: !showFirearms },
    ...(canViewFirearms ? [{ href: FIREARM_DOCUMENTS_URL, label: 'Firearm Documents', active: showFirearms }] : []),
  ]

  return (
    <OperationalShell
      user={user}
      title="Documents"
      navItems={getSidebarNav(user.role)}
      activeView="documents"
      onNavigate={onViewChange}
      onLogout={onLogout}
      mobileMenuOpen={mobileMenuOpen}
      onMenuOpen={() => setMobileMenuOpen(true)}
      onMenuClose={() => setMobileMenuOpen(false)}
      onLogoClick={() => onViewChange('dashboard')}
    >
      <div className="mx-auto w-full max-w-[90rem] space-y-5">
        {reportLinks.length > 1 ? (
          <nav aria-label="Document reports" className="grid grid-cols-2 gap-1 rounded-lg border border-border-subtle bg-surface p-1 sm:inline-grid print:hidden">
            {reportLinks.map(({ href, label, active }) => (
              <Link
                key={href}
                to={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-11 items-center justify-center rounded-md border px-2 py-2 text-center text-sm font-semibold focus-visible:outline-2 focus-visible:outline-(--color-focus-ring) sm:px-4 ${
                  active ? 'border-info-border bg-info-bg text-info-text' : 'border-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        ) : null}
        {showFirearms ? <FirearmComplianceReport /> : <GuardLicenseComplianceReport />}
      </div>
    </OperationalShell>
  )
}
