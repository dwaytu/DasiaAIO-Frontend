import { FC, useState } from 'react'
import type { DemoFirearmAllocation } from '../../utils/demoFirearmAllocations'
import DashboardCard from './ui/DashboardCard'
import SectionHeader from './ui/SectionHeader'
import StatCard from './ui/StatCard'

interface AllocationItem {
  id: string
  firearmId: string
  firearmModel: string
  firearmCaliber: string
  firearmSerialNumber: string
  allocationDate: string
  status: string
}

interface PermitItem {
  id: string
  permitType: string
  issuedDate: string
  expiryDate: string
  status: string
}

interface GuardResourcesTabProps {
  firearmItems: AllocationItem[]
  permitItems: PermitItem[]
  demoAllocations?: DemoFirearmAllocation[]
}

const SavedGuardResources: FC<Omit<GuardResourcesTabProps, 'demoAllocations'>> = ({ firearmItems, permitItems }) => {
  const activePermits = permitItems.filter((item) => item.status.toLowerCase() === 'active').length
  const expiringSoonCount = permitItems.filter((item) => {
    const expiry = new Date(item.expiryDate).getTime()
    if (Number.isNaN(expiry)) return false
    const daysUntilExpiry = (expiry - Date.now()) / (1000 * 60 * 60 * 24)
    return daysUntilExpiry >= 0 && daysUntilExpiry <= 30
  }).length
  const hasNoResources = firearmItems.length === 0 && permitItems.length === 0

  if (hasNoResources) {
    return (
      <section className="guard-section-frame" aria-label="Guard resources workspace">
        <SectionHeader
          title="Resource Snapshot"
          subtitle="Review allocation and permit readiness before opening full records."
        />
        <div className="rounded border border-border-subtle bg-surface-elevated p-6 text-center">
          <p className="text-sm font-semibold text-text-secondary">No resources allocated to this shift yet.</p>
          <p className="mt-1 text-xs text-text-tertiary">Contact your supervisor for firearm assignments or permit processing.</p>
        </div>
      </section>
    )
  }
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
          hint={firearmItems.length > 0 ? 'Assigned for current duty cycle' : 'No allocation recorded'}
          tone="guard"
        />
        <StatCard
          label="Active Permits"
          value={activePermits}
          hint={permitItems.length > 0 ? `${permitItems.length} total permits` : 'No permits on file'}
          tone="mission"
        />
        {expiringSoonCount > 0 ? (
          <StatCard
            label="Expiring Soon"
            value={expiringSoonCount}
            hint="Within 30 days — action required"
            tone="maintenance"
          />
        ) : (
          <StatCard
            label="Permit Status"
            value="All Clear"
            hint="No permits expiring within 30 days"
            tone="guard"
          />
        )}
      </div>

      <DashboardCard title="Your Resources">
        <ul className="space-y-2">
          {firearmItems.map((item) => (
            <li key={`firearm-${item.id}`} className="rounded border border-border-subtle bg-surface-elevated p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary">
                    {item.firearmModel} ({item.firearmCaliber})
                  </p>
                  <p className="text-xs text-text-secondary">Serial: {item.firearmSerialNumber}</p>
                  <p className="text-xs text-text-tertiary">
                    Allocated: {new Date(item.allocationDate).toLocaleDateString()}
                  </p>
                </div>
                <span className="rounded-full bg-danger-bg text-danger-text border border-danger-border px-2 py-0.5 text-[10px] font-bold uppercase">
                  Firearm
                </span>
              </div>
            </li>
          ))}
          {permitItems.map((item) => (
            <li key={`permit-${item.id}`} className="rounded border border-border-subtle bg-surface-elevated p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary">{item.permitType}</p>
                  <p className="text-xs text-text-secondary">
                    Issued: {new Date(item.issuedDate).toLocaleDateString()} · Expires: {new Date(item.expiryDate).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-text-tertiary">Status: {item.status}</p>
                </div>
                <span className="rounded-full bg-info-bg text-info-text border border-info-border px-2 py-0.5 text-[10px] font-bold uppercase">
                  Permit
                </span>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 rounded border border-border-subtle bg-surface px-3 py-2 text-xs text-text-tertiary">
          Contact your supervisor for allocation changes or permit renewals.
        </p>
      </DashboardCard>
    </section>
  )
}

const GuardResourcesTab: FC<GuardResourcesTabProps> = ({ firearmItems, permitItems, demoAllocations = [] }) => {
  const [view, setView] = useState<'saved' | 'demo'>(() => demoAllocations.length ? 'demo' : 'saved')

  if (!demoAllocations.length) {
    return <SavedGuardResources firearmItems={firearmItems} permitItems={permitItems} />
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Resource views">
        <button type="button" aria-pressed={view === 'saved'} className={`soc-btn ${view === 'saved' ? 'soc-btn-primary' : 'soc-btn-neutral'}`} onClick={() => setView('saved')}>
          Saved records
        </button>
        <button type="button" aria-pressed={view === 'demo'} className={`soc-btn ${view === 'demo' ? 'soc-btn-primary' : 'soc-btn-neutral'}`} onClick={() => setView('demo')}>
          Allocations
        </button>
      </div>
      {view === 'saved' ? (
        <SavedGuardResources firearmItems={firearmItems} permitItems={permitItems} />
      ) : (
        <ul className="space-y-2" aria-label="Demo allocations">
          {demoAllocations.map((row) => (
            <li key={row.id} className="flex flex-wrap items-start justify-between gap-2 rounded border border-border-subtle bg-surface-elevated p-3">
              <p className="break-words text-sm font-semibold text-text-primary">
                {[row.firearmSerialNumber, row.firearmModel].filter(Boolean).join(' - ')}
              </p>
              <span className={`soc-chip ${row.status === 'active' ? 'status-info' : 'status-success'}`}>
                {row.status === 'active' ? 'Active' : 'Returned'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default GuardResourcesTab
