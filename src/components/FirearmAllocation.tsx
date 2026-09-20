import { useState, useEffect, FC } from 'react'
import { CheckCircle2, ClipboardCheck, PackageCheck, Plus, ShieldCheck, Users, X } from 'lucide-react'
import { API_BASE_URL } from '../config'
import { logError } from '../utils/logger'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'
import OperationalShell from './layout/OperationalShell'
import { getSidebarNav } from '../config/navigation'
import OperationalPageHeader from './shared/OperationalPageHeader'
import OperationalSummaryBand from './shared/OperationalSummaryBand'
import SentinelModal from './shared/SentinelModal'

interface Allocation {
  id: string
  guardId: string
  firearmId: string
  allocationDate: string
  status: string
  guardName?: string
  firearmSerialNumber?: string
  firearmModel?: string
  [key: string]: any
}

interface Guard {
  id: string
  full_name: string
}

interface Firearm {
  id: string
  serialNumber: string
  model: string
  status?: string
}

const getGuardLabel = (allocation: Allocation, guards: Guard[]) => {
  const guard = guards.find((item) => item.id === allocation.guardId)
  return guard?.full_name || allocation.guardName || 'Unknown guard'
}

const getFirearmLabel = (allocation: Allocation, firearms: Firearm[]) => {
  const firearm = firearms.find((item) => item.id === allocation.firearmId)
  const inventoryLabel = [firearm?.serialNumber, firearm?.model].filter(Boolean).join(' - ')
  return inventoryLabel || [allocation.firearmSerialNumber, allocation.firearmModel].filter(Boolean).join(' - ') || 'Unknown firearm'
}

interface Props {
  user: any
  onLogout: () => void
  onViewChange?: (view: string) => void
  activeView?: string
}

const FirearmAllocation: FC<Props> = ({ user, onLogout, onViewChange, activeView }) => {
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [guards, setGuards] = useState<Guard[]>([])
  const [firearms, setFirearms] = useState<Firearm[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false)
  const [showAllocateForm, setShowAllocateForm] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [returningId, setReturningId] = useState<string | null>(null)
  const [returnCandidate, setReturnCandidate] = useState<Allocation | null>(null)
  const [newAllocation, setNewAllocation] = useState({
    guardId: '',
    firearmId: '',
  })
  const currentView = activeView || 'allocation'
  const activeAllocations = allocations.filter((allocation) => allocation.status?.toLowerCase() === 'active').length
  const returnedAllocations = allocations.filter((allocation) => allocation.status?.toLowerCase() === 'returned').length
  const availableFirearms = firearms.filter((firearm) => firearm.status?.toLowerCase() === 'available').length

  useEffect(() => {
    const controller = new AbortController()
    void initializeData(controller.signal)

    return () => controller.abort()
  }, [])

  const initializeData = async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      await Promise.all([
        fetchAllocations(signal),
        fetchGuards(signal),
        fetchFirearms(signal)
      ])
    } catch (err) {
      logError('Error initializing data:', err)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  const fetchAllocations = async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/firearm-allocations`, {
        headers: getAuthHeaders(),
        signal,
      })
      if (!response.ok) {
        throw new Error('Failed to fetch allocations')
      }
      const data = await response.json()
      setAllocations(data.allocations || [])
      setError('')
    } catch (err) {
      if (signal?.aborted) return
      setError(err instanceof Error ? err.message : 'Failed to fetch allocations')
      logError('Error fetching allocations:', err)
    }
  }

  const fetchGuards = async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users`, {
        headers: getAuthHeaders(),
        signal,
      })
      if (!response.ok) {
        throw new Error('Failed to fetch guards')
      }
      const data = await response.json()
      // Handle both array and object responses
      const guardsList = Array.isArray(data) ? data : (data.users || data || [])
      setGuards(guardsList.filter((u: any) => u.role === 'guard'))
      setError('')
    } catch (err) {
      if (signal?.aborted) return
      setError(err instanceof Error ? err.message : 'Failed to fetch guards')
      logError('Error fetching guards:', err)
    }
  }

  const fetchFirearms = async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/firearms`, {
        headers: getAuthHeaders(),
        signal,
      })
      if (!response.ok) {
        throw new Error('Failed to fetch firearms')
      }
      const data = await response.json()
      // Handle both array and object responses
      const firearmsList = Array.isArray(data) ? data : (data.firearms || data || [])
      setFirearms(firearmsList)
      setError('')
    } catch (err) {
      if (signal?.aborted) return
      setError(err instanceof Error ? err.message : 'Failed to fetch firearms')
      logError('Error fetching firearms:', err)
    }
  }

  const allocateFirearm = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/firearm-allocation/issue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          guardId: newAllocation.guardId,
          firearmId: newAllocation.firearmId,
        }),
      })
      if (!response.ok) throw new Error('Failed to allocate firearm')
      setSuccess('Firearm allocated successfully!')
      setNewAllocation({ guardId: '', firearmId: '' })
      setShowAllocateForm(false)
      fetchAllocations()
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to allocate firearm')
    } finally {
      setLoading(false)
    }
  }

  const confirmReturnFirearm = async () => {
    if (!returnCandidate) return
    const allocationId = returnCandidate.id

    setReturningId(allocationId)
    setError('')
    setSuccess('')
    try {
      await fetchJsonOrThrow(
        `${API_BASE_URL}/api/firearm-allocation/return`,
        {
          method: 'POST',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ allocationId }),
        },
        'Failed to return firearm',
      )
      setSuccess('Firearm returned successfully and is now available.')
      await fetchAllocations()
      await fetchFirearms()
      setReturnCandidate(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to return firearm')
      setReturnCandidate(null)
    } finally {
      setReturningId(null)
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-success-bg text-success-text ring-1 ring-success-border'
      case 'returned': return 'soc-status-neutral'
      case 'pending': return 'bg-warning-bg text-warning-text ring-1 ring-warning-border'
      default: return 'soc-status-neutral'
    }
  }

  return (
    <OperationalShell
      user={user}
      title="ALLOCATION"
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
          <div className="flex-1 flex items-center justify-center text-center">
            <div className="text-info-text text-lg font-medium">Loading allocations...</div>
          </div>
        ) : (
          <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full animate-fade-in">
            <section className="soc-surface mb-5 p-4 md:p-5">
              <OperationalPageHeader
                eyebrow="Asset custody"
                title="Firearm allocations"
                description="Issue available firearms to eligible guards. Active custody means firearms currently issued; return records close when the firearm is received."
                icon={ShieldCheck}
                status={(
                  <span className={`soc-chip ${activeAllocations > 0 ? 'status-info' : 'status-success'}`}>
                    {activeAllocations > 0 ? `${activeAllocations} firearms currently issued` : 'No firearms currently issued'}
                  </span>
                )}
                actions={(
                <button
                  onClick={() => setShowAllocateForm(!showAllocateForm)}
                  className={showAllocateForm ? 'soc-btn soc-btn-neutral inline-flex min-h-10 items-center gap-2 px-3' : 'soc-btn-primary inline-flex min-h-10 items-center gap-2 px-3'}
                >
                  {showAllocateForm ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                  {showAllocateForm ? 'Close form' : 'Allocate firearm'}
                </button>
                )}
              />

              {error && <div role="alert" className="mt-4 p-4 bg-danger-bg border border-danger-border rounded text-danger-text">{error}</div>}
              {success && <div role="status" className="mt-4 p-4 bg-success-bg border border-success-border rounded text-success-text">{success}</div>}
            </section>

            <div className="mb-5">
              <OperationalSummaryBand
                items={[
                  { label: 'Allocation records', value: allocations.length, detail: 'History of firearm issues and returns', tone: 'neutral', icon: ClipboardCheck },
                  { label: 'Active custody', value: activeAllocations, detail: activeAllocations > 0 ? 'Firearms currently issued' : 'No firearms currently issued', tone: activeAllocations > 0 ? 'info' : 'success', icon: ShieldCheck },
                  { label: 'Returned', value: returnedAllocations, detail: 'Returned and available again', tone: 'success', icon: CheckCircle2 },
                  { label: 'Eligible guards', value: guards.length, detail: `${availableFirearms} firearms available`, tone: availableFirearms > 0 ? 'success' : 'warning', icon: Users },
                ]}
              />
            </div>

              {showAllocateForm && (
                <form onSubmit={allocateFirearm} className="soc-surface mb-5 p-4 md:p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <Plus className="h-5 w-5 text-info-text" aria-hidden="true" />
                    <div>
                      <h3 className="text-lg font-bold text-text-primary">Create allocation</h3>
                      <p className="text-sm text-text-secondary">Select one guard and one available firearm.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-semibold text-text-primary mb-2">Guard</label>
                      <select
                        value={newAllocation.guardId}
                        onChange={(e) => setNewAllocation({ ...newAllocation, guardId: e.target.value })}
                        className="soc-form-control w-full"
                        required
                      >
                        <option value="">Select a guard</option>
                        {guards.map((g) => (
                          <option key={g.id} value={g.id}>{g.full_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-text-primary mb-2">Firearm</label>
                      <select
                        value={newAllocation.firearmId}
                        onChange={(e) => setNewAllocation({ ...newAllocation, firearmId: e.target.value })}
                        className="soc-form-control w-full"
                        required
                      >
                        <option value="">Select a firearm</option>
                        {firearms.filter((firearm) => !firearm.status || firearm.status.toLowerCase() === 'available').map((f) => (
                          <option key={f.id} value={f.id}>{f.serialNumber} - {f.model}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="soc-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? 'Allocating...' : 'Allocate Firearm'}
                  </button>
                </form>
              )}

            <section className="table-glass rounded p-4 md:p-6">
              <div className="mb-4 flex items-center gap-3 border-b border-border-subtle pb-4">
                <PackageCheck className="h-5 w-5 text-info-text" aria-hidden="true" />
                <div>
                  <h3 className="text-lg font-bold text-text-primary">Allocation register</h3>
                  <p className="text-sm text-text-secondary">History of firearm issuance and returns: {allocations.length} custody record{allocations.length === 1 ? '' : 's'}.</p>
                </div>
              </div>
              {allocations.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="thead-glass">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Guard</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Firearm</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Allocation Date</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-right font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocations.map((a) => (
                        <tr key={a.id} className="border-b border-border hover:bg-surface-hover">
                          <td className="px-4 py-3 text-text-primary">{getGuardLabel(a, guards)}</td>
                          <td className="px-4 py-3 text-text-primary">{getFirearmLabel(a, firearms)}</td>
                          <td className="px-4 py-3 text-text-primary">{new Date(a.allocationDate).toLocaleDateString()}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadgeColor(a.status)}`}>
                                {a.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {a.status?.toLowerCase() === 'active' ? (
                                <button
                                  type="button"
                                  onClick={() => setReturnCandidate(a)}
                                  disabled={returningId === a.id}
                                  className="soc-btn inline-flex min-h-10 items-center gap-2 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                                  title="Return firearm"
                                >
                                  <CheckCircle2 size={15} aria-hidden="true" />
                                  {returningId === a.id ? 'Returning...' : 'Return'}
                                </button>
                              ) : (
                                <span className="text-xs text-text-tertiary">No action</span>
                              )}
                            </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-sm font-semibold text-text-primary">No firearm allocations recorded</p>
                  <p className="mt-1 text-sm text-text-secondary">Use Allocate Firearm to issue an available firearm to an eligible guard.</p>
                </div>
              )}
            </section>
          </div>
        )}
        <SentinelModal
          open={Boolean(returnCandidate)}
          onClose={() => setReturnCandidate(null)}
          title="Return firearm?"
          subtitle={returnCandidate ? `This will mark ${getFirearmLabel(returnCandidate, firearms)} as available and close the active custody record for ${getGuardLabel(returnCandidate, guards)}. Historical issuance records will remain available.` : undefined}
          dismissible={!returningId}
          size="sm"
        >
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setReturnCandidate(null)} disabled={Boolean(returningId)} className="soc-btn soc-btn-neutral min-h-11 disabled:opacity-50">
              Cancel
            </button>
            <button type="button" onClick={() => void confirmReturnFirearm()} disabled={Boolean(returningId)} className="soc-btn soc-btn-danger min-h-11 disabled:opacity-50">
              {returningId ? 'Returning firearm...' : 'Return firearm'}
            </button>
          </div>
        </SentinelModal>
    </OperationalShell>
  )
}

export default FirearmAllocation
