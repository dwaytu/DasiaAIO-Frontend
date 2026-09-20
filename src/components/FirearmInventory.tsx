import { useState, useEffect, FC } from 'react'
import { Shield, Wrench, CircleCheck, RadioTower } from 'lucide-react'
import { API_BASE_URL } from '../config'
import { logError } from '../utils/logger'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'
import OperationalShell from './layout/OperationalShell'
import EmptyState from './shared/EmptyState'
import LoadingSkeleton from './shared/LoadingSkeleton'
import { getSidebarNav } from '../config/navigation'
import OperationalPageHeader from './shared/OperationalPageHeader'
import OperationalSummaryBand from './shared/OperationalSummaryBand'

interface Firearm {
  id: string
  serialNumber: string
  model: string
  caliber: string
  status: string
  licenseExpiryDate?: string | null
  lastMaintenance?: string
  [key: string]: any
}

interface Props {
  user: any
  onLogout: () => void
  onViewChange?: (view: string) => void
  activeView?: string
}

const FirearmInventory: FC<Props> = ({ user, onLogout, onViewChange, activeView }) => {
  const [firearms, setFirearms] = useState<Firearm[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [readWarning, setReadWarning] = useState<string>('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false)
  const currentView = activeView || 'firearms'

  useEffect(() => {
    const controller = new AbortController()
    void fetchFirearms(controller.signal)
    return () => controller.abort()
  }, [])

  const fetchFirearms = async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      const data = await fetchJsonOrThrow<any>(`${API_BASE_URL}/api/firearms`, {
        headers: getAuthHeaders(),
        signal,
      }, 'Unable to load firearm inventory')
      if (signal?.aborted) return
      // Backend returns array directly, not wrapped in object
      const firearmsList = Array.isArray(data) ? data : (data.firearms || [])
      setFirearms(firearmsList)
      setReadWarning('')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (signal?.aborted) return
      logError('Error fetching firearms:', err)
      setReadWarning('Firearm inventory is temporarily unavailable. Reads are degraded; write actions remain server-protected.')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'available': return 'bg-success-bg text-success-text ring-1 ring-success-border'
      case 'deployed': return 'bg-info-bg text-info-text ring-1 ring-info-border'
      case 'maintenance': return 'bg-warning-bg text-warning-text ring-1 ring-warning-border'
      case 'lost': return 'bg-danger-bg text-danger-text ring-1 ring-danger-border'
      default: return 'soc-status-neutral'
    }
  }

  const availableCount = firearms.filter((firearm) => firearm.status?.toLowerCase() === 'available').length
  const deployedCount = firearms.filter((firearm) => ['deployed', 'issued', 'allocated'].includes(firearm.status?.toLowerCase())).length
  const maintenanceCount = firearms.filter((firearm) => firearm.status?.toLowerCase() === 'maintenance').length

  return (
    <OperationalShell
      user={user}
      title="FIREARMS"
      navItems={getSidebarNav(user.role)}
      activeView={currentView}
      onNavigate={(view) => onViewChange?.(view)}
      onLogout={onLogout}
      mobileMenuOpen={mobileMenuOpen}
      onMenuOpen={() => setMobileMenuOpen(true)}
      onMenuClose={() => setMobileMenuOpen(false)}
      onLogoClick={() => onViewChange?.('dashboard')}
    >
        {loading ? (
          <div className="flex-1 p-4 md:p-8">
            <LoadingSkeleton variant="table" />
          </div>
        ) : (
          <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full animate-fade-in">
            
            <section className="soc-surface p-4 md:p-5">
              <OperationalPageHeader
                eyebrow="Resource register"
                title="Firearm Inventory"
                description="Check current availability and equipment status before assigning or servicing a firearm."
                icon={Shield}
                status={<span className="soc-status-neutral">{firearms.length} registered firearm{firearms.length === 1 ? '' : 's'}</span>}
              />

              {readWarning ? (
                <div className="mt-4 rounded border border-warning-border bg-warning-bg p-3 text-sm text-warning-text" role="status">
                  {readWarning}
                </div>
              ) : null}

              <div className="mt-4">
                <OperationalSummaryBand
                  items={[
                    { label: 'Registered', value: firearms.length, detail: 'In this inventory', tone: 'info', icon: Shield },
                    { label: 'Available', value: availableCount, detail: 'Ready to assign', tone: 'success', icon: CircleCheck },
                    { label: 'Deployed', value: deployedCount, detail: 'Currently in service', tone: 'info', icon: RadioTower },
                    { label: 'Maintenance', value: maintenanceCount, detail: 'Unavailable for assignment', tone: maintenanceCount > 0 ? 'warning' : 'neutral', icon: Wrench },
                  ]}
                />
              </div>

              {firearms.length > 0 ? (
                <div className="mt-5 overflow-x-auto" aria-label="Firearm inventory register">
                  <table className="w-full min-w-[760px] border-collapse">
                    <caption className="sr-only">Registered firearms and their current operational status.</caption>
                    <thead className="thead-glass">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Serial Number</th>
                        <th scope="col" className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Model</th>
                        <th scope="col" className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Caliber</th>
                        <th scope="col" className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">License Expiry</th>
                        <th scope="col" className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Status</th>
                        <th scope="col" className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Last Maintenance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {firearms.map((f) => (
                        <tr key={f.id} className="border-b border-border hover:bg-surface-hover">
                          <td className="px-4 py-3 text-text-primary">{f.serialNumber}</td>
                          <td className="px-4 py-3 text-text-primary">{f.model}</td>
                          <td className="px-4 py-3 text-text-primary">{f.caliber}</td>
                          <td className="px-4 py-3 text-text-primary">{f.licenseExpiryDate ? new Date(f.licenseExpiryDate).toLocaleDateString() : 'N/A'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadgeColor(f.status)}`}>
                              {f.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-text-primary">{f.lastMaintenance ? new Date(f.lastMaintenance).toLocaleDateString() : 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-5">
                  <EmptyState icon={Shield} title="No firearms registered" subtitle="Use the Management panel to register firearms" />
                </div>
              )}
            </section>
          </div>
        )}
    </OperationalShell>
  )
}

export default FirearmInventory

