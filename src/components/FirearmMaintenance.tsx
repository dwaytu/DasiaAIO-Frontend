import { useCallback, useEffect, useMemo, useState, type FC } from 'react'
import { CheckCircle2, ClipboardCheck, Plus, RefreshCw, X } from 'lucide-react'
import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'
import OperationalShell from './layout/OperationalShell'
import { getSidebarNav } from '../config/navigation'

interface Maintenance {
  id: string
  firearmId: string
  maintenanceType: string
  description: string
  scheduledDate: string
  completionDate?: string | null
  performedBy?: string | null
  cost?: string | null
  status: string
  notes?: string | null
}

interface MaintenanceResponse {
  total: number
  maintenances: Maintenance[]
}

interface Firearm {
  id: string
  serialNumber: string
  model: string
  status: string
}

interface Props {
  user: any
  onLogout: () => void
  onViewChange?: (view: string) => void
  activeView?: string
}

interface ScheduleForm {
  firearmId: string
  maintenanceType: string
  description: string
  scheduledDate: string
  performedBy: string
  cost: string
  notes: string
}

interface CompletionForm {
  performedBy: string
  cost: string
  notes: string
}

const EMPTY_SCHEDULE: ScheduleForm = {
  firearmId: '',
  maintenanceType: '',
  description: '',
  scheduledDate: '',
  performedBy: '',
  cost: '',
  notes: '',
}

const EMPTY_COMPLETION: CompletionForm = {
  performedBy: '',
  cost: '',
  notes: '',
}

function formatDate(value?: string | null): string {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleString()
}

function getStatusBadgeColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'completed':
      return 'bg-success-bg text-success-text ring-1 ring-success-border'
    case 'pending':
      return 'bg-warning-bg text-warning-text ring-1 ring-warning-border'
    case 'in_progress':
      return 'bg-info-bg text-info-text ring-1 ring-info-border'
    default:
      return 'bg-zinc-500/15 text-zinc-400 ring-1 ring-zinc-500/30'
  }
}

const FirearmMaintenance: FC<Props> = ({ user, onLogout, onViewChange, activeView }) => {
  const [maintenances, setMaintenances] = useState<Maintenance[]>([])
  const [firearms, setFirearms] = useState<Firearm[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<'schedule' | 'complete' | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [completionTarget, setCompletionTarget] = useState<Maintenance | null>(null)
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>(EMPTY_SCHEDULE)
  const [completionForm, setCompletionForm] = useState<CompletionForm>(EMPTY_COMPLETION)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const currentView = activeView || 'maintenance'

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const headers = getAuthHeaders()
      const [maintenanceResponse, firearmResponse] = await Promise.all([
        fetchJsonOrThrow<MaintenanceResponse>(
          `${API_BASE_URL}/api/firearm-maintenance`,
          { headers, signal },
          'Unable to load firearm maintenance records',
        ),
        fetchJsonOrThrow<Firearm[] | { firearms?: Firearm[] }>(
          `${API_BASE_URL}/api/firearms`,
          { headers, signal },
          'Unable to load firearm inventory',
        ),
      ])

      if (signal?.aborted) return
      setMaintenances(maintenanceResponse.maintenances || [])
      setFirearms(Array.isArray(firearmResponse) ? firearmResponse : firearmResponse.firearms || [])
      setError('')
    } catch (err) {
      if (signal?.aborted) return
      setError(err instanceof Error ? err.message : 'Unable to load firearm maintenance records')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadData(controller.signal)
    return () => controller.abort()
  }, [loadData])

  const availableFirearms = useMemo(
    () => firearms.filter((firearm) => firearm.status.toLowerCase() === 'available'),
    [firearms],
  )

  const firearmLabel = useCallback((firearmId: string) => {
    const firearm = firearms.find((item) => item.id === firearmId)
    return firearm ? `${firearm.serialNumber} - ${firearm.model}` : firearmId
  }, [firearms])

  const defaultPerformer = String(user?.full_name || user?.fullName || user?.username || '')

  const handleSchedule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    const scheduledDate = new Date(scheduleForm.scheduledDate)
    if (Number.isNaN(scheduledDate.getTime())) {
      setError('Choose a valid scheduled date and time.')
      return
    }

    setSubmitting('schedule')
    try {
      await fetchJsonOrThrow(
        `${API_BASE_URL}/api/firearm-maintenance/schedule`,
        {
          method: 'POST',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firearmId: scheduleForm.firearmId,
            maintenanceType: scheduleForm.maintenanceType.trim(),
            description: scheduleForm.description.trim(),
            scheduledDate: scheduledDate.toISOString(),
            performedBy: scheduleForm.performedBy.trim() || undefined,
            cost: scheduleForm.cost.trim() || undefined,
            notes: scheduleForm.notes.trim() || undefined,
          }),
        },
        'Unable to schedule firearm maintenance',
      )
      setScheduleForm(EMPTY_SCHEDULE)
      setShowScheduleForm(false)
      setSuccess('Firearm maintenance scheduled successfully.')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to schedule firearm maintenance')
    } finally {
      setSubmitting(null)
    }
  }

  const openCompletionForm = (maintenance: Maintenance) => {
    setError('')
    setSuccess('')
    setCompletionTarget(maintenance)
    setCompletionForm({ ...EMPTY_COMPLETION, performedBy: defaultPerformer })
  }

  const handleComplete = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!completionTarget) return

    setError('')
    setSuccess('')
    setSubmitting('complete')
    try {
      await fetchJsonOrThrow(
        `${API_BASE_URL}/api/firearm-maintenance/${completionTarget.id}/complete`,
        {
          method: 'POST',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            performedBy: completionForm.performedBy.trim() || undefined,
            cost: completionForm.cost.trim() || undefined,
            notes: completionForm.notes.trim() || undefined,
          }),
        },
        'Unable to complete firearm maintenance',
      )
      setCompletionTarget(null)
      setCompletionForm(EMPTY_COMPLETION)
      setSuccess('Firearm maintenance completed and the firearm is available again.')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete firearm maintenance')
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <OperationalShell
      user={user}
      title="MAINTENANCE"
      navItems={getSidebarNav(user.role)}
      activeView={currentView}
      onNavigate={(view) => onViewChange?.(view)}
      onLogout={onLogout}
      mobileMenuOpen={mobileMenuOpen}
      onMenuOpen={() => setMobileMenuOpen(true)}
      onMenuClose={() => setMobileMenuOpen(false)}
      onLogoClick={() => onViewChange?.('dashboard')}
    >
      {loading && maintenances.length === 0 ? (
        <div className="flex-1 p-4 text-center text-text-secondary md:p-8">Loading firearm maintenance records...</div>
      ) : (
        <div className="flex-1 space-y-5 overflow-y-auto p-4 md:p-8">
          <section className="table-glass rounded p-4 md:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="soc-kicker">FIREARM GOVERNANCE</p>
                <h2 className="text-2xl font-black uppercase tracking-wide text-text-primary">Maintenance Controls</h2>
                <p className="mt-1 text-sm text-text-secondary">Schedule service and close completed maintenance records from one operational view.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void loadData()} className="soc-btn inline-flex min-h-10 items-center gap-2 px-3" title="Refresh maintenance records">
                  <RefreshCw size={16} aria-hidden="true" /> Refresh
                </button>
                <button type="button" onClick={() => setShowScheduleForm((value) => !value)} className="soc-btn-primary inline-flex min-h-10 items-center gap-2 px-3" title="Schedule firearm maintenance">
                  {showScheduleForm ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                  {showScheduleForm ? 'Close form' : 'Schedule maintenance'}
                </button>
              </div>
            </div>
            {error ? <p role="alert" className="mt-4 rounded border border-danger-border bg-danger-bg p-3 text-sm text-danger-text">{error}</p> : null}
            {success ? <p role="status" className="mt-4 rounded border border-success-border bg-success-bg p-3 text-sm text-success-text">{success}</p> : null}
          </section>

          {showScheduleForm ? (
            <section className="table-glass rounded p-4 md:p-6">
              <div className="mb-4 flex items-center gap-2">
                <Plus size={18} className="text-info-text" aria-hidden="true" />
                <h3 className="text-lg font-bold text-text-primary">Schedule firearm maintenance</h3>
              </div>
              <form onSubmit={handleSchedule} className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-semibold text-text-secondary">Firearm
                  <select required value={scheduleForm.firearmId} onChange={(event) => setScheduleForm({ ...scheduleForm, firearmId: event.target.value })} className="mt-1 min-h-10 w-full rounded border border-border bg-surface px-3 text-text-primary">
                    <option value="">Select an available firearm</option>
                    {availableFirearms.map((firearm) => <option key={firearm.id} value={firearm.id}>{firearm.serialNumber} - {firearm.model}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold text-text-secondary">Maintenance type
                  <input required value={scheduleForm.maintenanceType} onChange={(event) => setScheduleForm({ ...scheduleForm, maintenanceType: event.target.value })} placeholder="Inspection, cleaning, repair" className="mt-1 min-h-10 w-full rounded border border-border bg-surface px-3 text-text-primary" />
                </label>
                <label className="text-sm font-semibold text-text-secondary">Scheduled date and time
                  <input required type="datetime-local" value={scheduleForm.scheduledDate} onChange={(event) => setScheduleForm({ ...scheduleForm, scheduledDate: event.target.value })} className="mt-1 min-h-10 w-full rounded border border-border bg-surface px-3 text-text-primary" />
                </label>
                <label className="text-sm font-semibold text-text-secondary">Assigned technician / performer
                  <input value={scheduleForm.performedBy} onChange={(event) => setScheduleForm({ ...scheduleForm, performedBy: event.target.value })} placeholder="Optional" className="mt-1 min-h-10 w-full rounded border border-border bg-surface px-3 text-text-primary" />
                </label>
                <label className="text-sm font-semibold text-text-secondary md:col-span-2">Description
                  <textarea required value={scheduleForm.description} onChange={(event) => setScheduleForm({ ...scheduleForm, description: event.target.value })} rows={3} className="mt-1 w-full rounded border border-border bg-surface px-3 py-2 text-text-primary" />
                </label>
                <label className="text-sm font-semibold text-text-secondary">Estimated cost
                  <input value={scheduleForm.cost} onChange={(event) => setScheduleForm({ ...scheduleForm, cost: event.target.value })} inputMode="decimal" placeholder="Optional" className="mt-1 min-h-10 w-full rounded border border-border bg-surface px-3 text-text-primary" />
                </label>
                <label className="text-sm font-semibold text-text-secondary">Notes
                  <input value={scheduleForm.notes} onChange={(event) => setScheduleForm({ ...scheduleForm, notes: event.target.value })} placeholder="Optional" className="mt-1 min-h-10 w-full rounded border border-border bg-surface px-3 text-text-primary" />
                </label>
                <div className="flex justify-end md:col-span-2">
                  <button type="submit" disabled={submitting !== null || availableFirearms.length === 0} className="soc-btn-primary inline-flex min-h-10 items-center gap-2 px-4 disabled:cursor-not-allowed disabled:opacity-60">
                    <CheckCircle2 size={16} aria-hidden="true" />
                    {submitting === 'schedule' ? 'Scheduling...' : 'Schedule maintenance'}
                  </button>
                </div>
                {availableFirearms.length === 0 ? <p className="text-sm text-warning-text md:col-span-2">No available firearms can be scheduled for maintenance.</p> : null}
              </form>
            </section>
          ) : null}

          {completionTarget ? (
            <section className="table-glass rounded border border-info-border p-4 md:p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="soc-kicker">COMPLETE RECORD</p>
                  <h3 className="text-lg font-bold text-text-primary">Complete maintenance for {firearmLabel(completionTarget.firearmId)}</h3>
                </div>
                <button type="button" onClick={() => setCompletionTarget(null)} className="soc-btn inline-flex min-h-10 items-center gap-2 px-3" title="Cancel completion">
                  <X size={16} aria-hidden="true" /> Cancel
                </button>
              </div>
              <form onSubmit={handleComplete} className="grid gap-4 md:grid-cols-3">
                <label className="text-sm font-semibold text-text-secondary">Performed by
                  <input required value={completionForm.performedBy} onChange={(event) => setCompletionForm({ ...completionForm, performedBy: event.target.value })} className="mt-1 min-h-10 w-full rounded border border-border bg-surface px-3 text-text-primary" />
                </label>
                <label className="text-sm font-semibold text-text-secondary">Actual cost
                  <input value={completionForm.cost} onChange={(event) => setCompletionForm({ ...completionForm, cost: event.target.value })} inputMode="decimal" placeholder="Optional" className="mt-1 min-h-10 w-full rounded border border-border bg-surface px-3 text-text-primary" />
                </label>
                <label className="text-sm font-semibold text-text-secondary">Completion notes
                  <input value={completionForm.notes} onChange={(event) => setCompletionForm({ ...completionForm, notes: event.target.value })} placeholder="Optional" className="mt-1 min-h-10 w-full rounded border border-border bg-surface px-3 text-text-primary" />
                </label>
                <div className="flex justify-end md:col-span-3">
                  <button type="submit" disabled={submitting !== null} className="soc-btn-primary inline-flex min-h-10 items-center gap-2 px-4 disabled:cursor-not-allowed disabled:opacity-60">
                    <CheckCircle2 size={16} aria-hidden="true" />
                    {submitting === 'complete' ? 'Completing...' : 'Complete maintenance'}
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          <section className="table-glass rounded p-4 md:p-6">
            <div className="mb-4 flex items-center gap-3">
              <ClipboardCheck size={18} className="text-info-text" aria-hidden="true" />
              <div>
                <h3 className="text-lg font-bold text-text-primary">Maintenance records ({maintenances.length})</h3>
                <p className="text-sm text-text-secondary">Pending records can be completed from this table.</p>
              </div>
            </div>
            {maintenances.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse text-sm">
                  <thead className="thead-glass">
                    <tr>
                      {['Firearm', 'Type', 'Scheduled', 'Status', 'Description', 'Actions'].map((heading) => <th key={heading} className="border-b-2 border-border px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">{heading}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {maintenances.map((maintenance) => {
                      const canComplete = ['pending', 'in_progress'].includes(maintenance.status.toLowerCase())
                      return (
                        <tr key={maintenance.id} className="border-b border-border hover:bg-surface-hover">
                          <td className="px-3 py-3 font-semibold text-text-primary">{firearmLabel(maintenance.firearmId)}</td>
                          <td className="px-3 py-3 text-text-primary">{maintenance.maintenanceType}</td>
                          <td className="px-3 py-3 text-text-primary">{formatDate(maintenance.scheduledDate)}</td>
                          <td className="px-3 py-3"><span className={`inline-block rounded px-2 py-1 text-xs font-semibold uppercase ${getStatusBadgeColor(maintenance.status)}`}>{maintenance.status.replace('_', ' ')}</span></td>
                          <td className="max-w-[28rem] px-3 py-3 text-text-secondary">{maintenance.description}</td>
                          <td className="px-3 py-3 text-right">
                            {canComplete ? <button type="button" onClick={() => openCompletionForm(maintenance)} className="soc-btn inline-flex min-h-10 items-center gap-2 px-3 text-xs" title="Complete maintenance"><CheckCircle2 size={15} aria-hidden="true" /> Complete</button> : <span className="text-xs text-text-tertiary">Completed</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className="py-8 text-center text-text-secondary">No firearm maintenance records found.</p>}
          </section>
        </div>
      )}
    </OperationalShell>
  )
}

export default FirearmMaintenance
