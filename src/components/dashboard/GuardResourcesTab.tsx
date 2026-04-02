import { FC } from 'react'
import DashboardCard from './ui/DashboardCard'
import SectionHeader from './ui/SectionHeader'
import StatCard from './ui/StatCard'

interface AllocationItem {
  id: string
  firearm_id: string
  firearm_model: string
  firearm_caliber: string
  firearm_serial_number: string
  allocation_date: string
  status: string
}

interface PermitItem {
  id: string
  permit_type: string
  issued_date: string
  expiry_date: string
  status: string
}

interface GuardResourcesTabProps {
  firearmItems: AllocationItem[]
  permitItems: PermitItem[]
}

const GuardResourcesTab: FC<GuardResourcesTabProps> = ({ firearmItems, permitItems }) => {
  const activePermits = permitItems.filter((item) => item.status.toLowerCase() === 'active').length
  const expiringSoonCount = permitItems.filter((item) => {
    const expiry = new Date(item.expiry_date).getTime()
    if (Number.isNaN(expiry)) return false
    const daysUntilExpiry = (expiry - Date.now()) / (1000 * 60 * 60 * 24)
    return daysUntilExpiry >= 0 && daysUntilExpiry <= 30
  }).length

  return (
    <section className="guard-section-frame" aria-label="Guard resources workspace">
      <SectionHeader
        title="Resource Snapshot"
        subtitle="Review allocation and permit readiness before opening full records."
      />

      <div className="guard-kpi-row md:grid-cols-3">
        <StatCard
          label="Allocated Firearms"
          value={firearmItems.length}
          hint={firearmItems.length > 0 ? 'Assigned and logged for current duty cycle' : 'No firearm allocation recorded'}
          tone="guard"
        />
        <StatCard
          label="Active Permits"
          value={activePermits}
          hint={permitItems.length > 0 ? `${permitItems.length} permits in profile` : 'No permits on file'}
          tone="mission"
        />
        <StatCard
          label="Expiring Soon"
          value={expiringSoonCount}
          hint="Permits expiring within 30 days"
          tone={expiringSoonCount > 0 ? 'maintenance' : 'analytics'}
        />
      </div>

      <DashboardCard title="Assigned Firearms">
        {firearmItems.length === 0 ? (
          <p className="soc-empty-state">
            No firearms are currently allocated to you.
          </p>
        ) : (
          <ul className="space-y-2">
            {firearmItems.map((item) => (
              <li key={item.id} className="rounded-lg border border-border-subtle bg-surface-elevated p-3">
                <p className="text-sm font-semibold text-text-primary">
                  {item.firearm_model} ({item.firearm_caliber})
                </p>
                <p className="text-xs text-text-secondary">Serial: {item.firearm_serial_number}</p>
                <p className="text-xs text-text-secondary">
                  Allocated: {new Date(item.allocation_date).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>

      <DashboardCard title="Permit Records">
        {permitItems.length === 0 ? (
          <p className="soc-empty-state">
            No permits on file. Contact your supervisor if a permit should be assigned.
          </p>
        ) : (
          <ul className="space-y-2">
            {permitItems.map((item) => (
              <li key={item.id} className="rounded-lg border border-border-subtle bg-surface-elevated p-3">
                <p className="text-sm font-semibold text-text-primary">{item.permit_type}</p>
                <p className="text-xs text-text-secondary">
                  Issued: {new Date(item.issued_date).toLocaleDateString()}
                </p>
                <p className="text-xs text-text-secondary">
                  Expires: {new Date(item.expiry_date).toLocaleDateString()}
                </p>
                <p className="text-xs text-text-secondary">Status: {item.status}</p>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>
    </section>
  )
}

export default GuardResourcesTab
