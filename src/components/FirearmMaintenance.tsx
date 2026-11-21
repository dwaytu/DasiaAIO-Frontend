import { useCallback, useEffect, useMemo, useRef, useState, type FC } from 'react'
import { CheckCircle2, ClipboardCheck, Clock3, PackageCheck, Plus, RefreshCw, Wrench, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'
import OperationalShell from './layout/OperationalShell'
import { getSidebarNav } from '../config/navigation'
import OperationalPageHeader from './shared/OperationalPageHeader'
import OperationalSummaryBand from './shared/OperationalSummaryBand'
import { ROUTES, VEHICLE_MAINTENANCE_URL } from '../router/routes'
import { formatVehicleIdentifier } from '../utils/vehicleIdentifier'
import type { User } from '../context/AuthContext'

interface Maintenance {
  id: string
  assetId: string
  maintenanceType: string
  description: string
  scheduledDate?: string | null
  completionDate?: string | null
  performedBy?: string | null
  cost?: string | null
  status: string
  notes?: string | null
}

interface MaintenanceResponse {
  total: number
  maintenances: Array<Omit<Maintenance, 'assetId'> & { firearmId: string }>
}

interface VehicleMaintenanceRecord {
  id: string
  car_id: string | null
  maintenance_type: string | null
  description: string | null
  scheduled_date?: string | null
  status: string | null
}

interface MaintenanceAsset {
  id: string
  label: string
  status: string
}

interface MaintenanceData {
  assets: MaintenanceAsset[]
  records: Maintenance[]
}

const VEHICLE_MAINTENANCE_TYPES = {
  routine_service: 'Routine service',
  repairs: 'Repairs',
  inspection: 'Inspection',
  tire_replacement: 'Tire replacement',
  armor_check: 'Armor check',
}

async function loadVehicleMaintenance(headers: HeadersInit, signal?: AbortSignal): Promise<MaintenanceData> {
  const cars = await fetchJsonOrThrow<Array<{
    id: string; license_plate?: string; plate_number?: string | null; status: string
  }>>(
    `${API_BASE_URL}/api/armored-cars`,
    { headers, signal },
    'Unable to load armored car inventory',
  )
  const results = await Promise.all(cars.map(({ id }) => fetchJsonOrThrow<VehicleMaintenanceRecord[]>(
    `${API_BASE_URL}/api/car-maintenance/${encodeURIComponent(id)}`,
    { headers, signal },
    'Unable to load armored car maintenance records',
  )))
  const records = results.flat().map((item) => ({
    id: item.id,
    assetId: item.car_id ?? 'Not recorded',
    maintenanceType: item.maintenance_type ?? 'Not recorded',
    description: item.description ?? '',
    scheduledDate: item.scheduled_date,
    status: item.status ?? 'Not recorded',
  }))
  records.sort((left, right) => (right.scheduledDate ?? '').localeCompare(left.scheduledDate ?? ''))
  return {
    assets: cars.map((car) => ({
      id: car.id,
      label: formatVehicleIdentifier(car.license_plate, car.plate_number) || car.id,
      status: car.status,
    })),
    records,
  }
}

interface Firearm {
  id: string
  serialNumber: string
  model: string
  status: string
}

interface FirearmPage {
  total?: number
  firearms?: Firearm[]
}

async function loadFirearmInventory(headers: HeadersInit, signal?: AbortSignal): Promise<Firearm[]> {
  const firearms: Firearm[] = []

  for (let page = 1; ; page += 1) {
    const params = new URLSearchParams({ page: String(page), page_size: '200' })
    const response = await fetchJsonOrThrow<Firearm[] | FirearmPage>(
      `${API_BASE_URL}/api/firearms?${params}`,
      { headers, signal },
      'Unable to load firearm inventory',
    )
    const batch = Array.isArray(response) ? response : response.firearms ?? []
    firearms.push(...batch)
    if (Array.isArray(response) || response.total === undefined || firearms.length >= response.total) return firearms
    if (batch.length === 0) throw new Error('Firearm inventory changed while loading. Refresh and try again.')
  }
}

interface Props {
  user: User
  onLogout: () => void
  onViewChange?: (view: string) => void
  activeView?: string
}

interface ScheduleForm {
  assetId: string
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
  assetId: '',
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
    case 'scheduled':
      return 'bg-warning-bg text-warning-text ring-1 ring-warning-border'
    case 'in_progress':
      return 'bg-info-bg text-info-text ring-1 ring-info-border'
    default:
      return 'soc-status-neutral'
  }
}

function canCompleteRecord(status: string): boolean {
  return ['scheduled', 'pending', 'in_progress'].includes(status.toLowerCase())
}

const FirearmMaintenance: FC<Props> = ({ user, onLogout, onViewChange, activeView }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [params] = useSearchParams()
  const showVehicles = params.get('asset') === 'armored-cars'
  const views = [
    { href: ROUTES.MAINTENANCE, label: 'Firearms', active: !showVehicles },
    { href: VEHICLE_MAINTENANCE_URL, label: 'Armored Cars', active: showVehicles },
  ]

  return (
    <OperationalShell
      user={user}
      title="MAINTENANCE"
      navItems={getSidebarNav(user.role)}
      activeView={activeView || 'maintenance'}
      onNavigate={(view) => onViewChange?.(view)}
      onLogout={onLogout}
      mobileMenuOpen={mobileMenuOpen}
      onMenuOpen={() => setMobileMenuOpen(true)}
      onMenuClose={() => setMobileMenuOpen(false)}
      onLogoClick={() => onViewChange?.('dashboard')}
    >
      <div className="flex-1 space-y-5 overflow-y-auto p-4 md:p-8">
        <nav aria-label="Maintenance assets" className="grid grid-cols-2 gap-1 rounded-lg border border-border-subtle bg-surface p-1 sm:inline-grid">
          {views.map(({ href, label, active }) => (
            <Link
              key={href}
              to={href}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-11 items-center justify-center rounded-md border px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-(--color-focus-ring) ${
                active ? 'border-info-border bg-info-bg text-info-text' : 'border-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <MaintenanceRecords key={String(showVehicles)} user={user} showVehicles={showVehicles} />
      </div>
    </OperationalShell>
  )
}

function MaintenanceRecords({ user, showVehicles }: { user: Props['user']; showVehicles: boolean }) {
  const assetName = showVehicles ? 'armored car' : 'firearm'
  const assetHeading = showVehicles ? 'Armored car' : 'Firearm'
  const endpoint = `${API_BASE_URL}/api/${showVehicles ? 'car-maintenance' : 'firearm-maintenance'}`
  const [maintenances, setMaintenances] = useState<Maintenance[]>([])
  const [assets, setAssets] = useState<MaintenanceAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [dataAvailable, setDataAvailable] = useState(false)
  const [submitting, setSubmitting] = useState<'schedule' | 'complete' | null>(null)
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [completionTarget, setCompletionTarget] = useState<Maintenance | null>(null)
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>(EMPTY_SCHEDULE)
  const [completionForm, setCompletionForm] = useState<CompletionForm>(EMPTY_COMPLETION)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const scheduleAssetInput = useRef<HTMLSelectElement>(null)
  const completionHeading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (showScheduleForm) scheduleAssetInput.current?.focus()
  }, [showScheduleForm])

  useEffect(() => {
    if (completionTarget) completionHeading.current?.focus()
  }, [completionTarget])

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const headers = getAuthHeaders()
      let data: MaintenanceData
      if (showVehicles) {
        data = await loadVehicleMaintenance(headers, signal)
      } else {
        const [maintenanceResponse, firearmResponse] = await Promise.all([
          fetchJsonOrThrow<MaintenanceResponse>(endpoint, { headers, signal }, 'Unable to load firearm maintenance records'),
          loadFirearmInventory(headers, signal),
        ])
        data = {
          records: (maintenanceResponse.maintenances ?? []).map(({ firearmId, ...record }) => ({ ...record, assetId: firearmId })),
          assets: firearmResponse.map(({ id, serialNumber, model, status }) => ({ id, label: `${serialNumber} - ${model}`, status })),
        }
      }
      if (signal?.aborted) return
      setMaintenances(data.records)
      setAssets(data.assets)
      setDataAvailable(true)
      setError('')
    } catch (err) {
      if (signal?.aborted) return
      setDataAvailable(false)
      setError(err instanceof Error ? err.message : `Unable to load ${assetName} maintenance records`)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [assetName, endpoint, showVehicles])

  useEffect(() => {
    const controller = new AbortController()
    void loadData(controller.signal)
    return () => controller.abort()
  }, [loadData])

  const availableAssets = assets.filter(({ status }) => status.trim().toLowerCase() === 'available')
  const schedulableAssets = showVehicles ? assets : availableAssets
  const maintenanceSummary = useMemo(() => {
    const countStatus = (status: string) => maintenances.filter((item) => item.status.toLowerCase() === status).length

    return {
      pending: countStatus('pending') + countStatus('scheduled'),
      inProgress: countStatus('in_progress'),
      completed: countStatus('completed'),
    }
  }, [maintenances])
  const inventoryInMaintenance = assets.filter(({ status }) => status.trim().toLowerCase() === 'maintenance')
  const openJobAssetIds = new Set(maintenances.filter(({ status }) => canCompleteRecord(status)).map(({ assetId }) => assetId))
  const maintenanceWithoutOpenJob = inventoryInMaintenance.filter(({ id }) => !openJobAssetIds.has(id)).length
  const openJobCount = maintenanceSummary.pending + maintenanceSummary.inProgress

  const assetLabel = (assetId: string) => assets.find(({ id }) => id === assetId)?.label ?? assetId

  const defaultPerformer = String(user?.full_name || user?.fullName || user?.username || '')

  const handleSchedule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    const scheduledDate = scheduleForm.scheduledDate ? new Date(scheduleForm.scheduledDate) : null
    if ((!showVehicles && !scheduledDate) || (scheduledDate && Number.isNaN(scheduledDate.getTime()))) {
      setError('Choose a valid scheduled date and time.')
      return
    }

    setSubmitting('schedule')
    try {
      await fetchJsonOrThrow(
        `${endpoint}/schedule`,
        {
          method: 'POST',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            [showVehicles ? 'carId' : 'firearmId']: scheduleForm.assetId,
            maintenanceType: scheduleForm.maintenanceType.trim(),
            description: scheduleForm.description.trim(),
            scheduledDate: scheduledDate?.toISOString() ?? null,
            cost: scheduleForm.cost.trim() || undefined,
            ...(!showVehicles && {
              performedBy: scheduleForm.performedBy.trim() || undefined,
              notes: scheduleForm.notes.trim() || undefined,
            }),
          }),
        },
        `Unable to schedule ${assetName} maintenance`,
      )
      setScheduleForm(EMPTY_SCHEDULE)
      setShowScheduleForm(false)
      setSuccess(`${assetHeading} maintenance scheduled successfully.`)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to schedule ${assetName} maintenance`)
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
        `${endpoint}/${encodeURIComponent(completionTarget.id)}/complete`,
        {
          method: 'POST',
          headers: showVehicles ? getAuthHeaders() : getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: showVehicles ? undefined : JSON.stringify({
              performedBy: completionForm.performedBy.trim() || undefined,
              cost: completionForm.cost.trim() || undefined,
              notes: completionForm.notes.trim() || undefined,
            }),
        },
        `Unable to complete ${assetName} maintenance`,
      )
      setCompletionTarget(null)
      setCompletionForm(EMPTY_COMPLETION)
      setSuccess(showVehicles ? 'Armored car maintenance completed.' : 'Firearm maintenance completed and the firearm is available again.')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to complete ${assetName} maintenance`)
    } finally {
      setSubmitting(null)
    }
  }

  if (loading && maintenances.length === 0) {
    return <p role="status" className="p-4 text-center text-text-secondary md:p-8">Loading {assetName} maintenance records…</p>
  }

  return (
    <>
      <section className="soc-surface p-4 md:p-5">
        <OperationalPageHeader
          eyebrow={showVehicles ? 'Armored cars' : 'Firearms'}
          title="Maintenance controls"
          description="Schedule service and close completed maintenance records from one operational view."
          icon={Wrench}
          status={(
            <span className={`soc-chip ${!dataAvailable || openJobCount > 0 || maintenanceWithoutOpenJob > 0 ? 'status-warning' : 'status-success'}`}>
              {!dataAvailable ? 'Maintenance overview unavailable' : openJobCount > 0
                ? `${openJobCount} open maintenance ${openJobCount === 1 ? 'record' : 'records'}`
                : 'No open maintenance records'}
            </span>
          )}
          actions={(
            <>
            <button type="button" onClick={() => void loadData()} className="soc-btn inline-flex min-h-10 items-center gap-2 px-3" title="Refresh maintenance records">
              <RefreshCw size={16} aria-hidden="true" /> Refresh
            </button>
            <button type="button" onClick={() => setShowScheduleForm((value) => !value)} disabled={!dataAvailable || submitting !== null} className="soc-btn-primary inline-flex min-h-10 items-center gap-2 px-3" title={`Schedule ${assetName} maintenance`}>
              {showScheduleForm ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
              {showScheduleForm ? 'Close form' : 'Schedule maintenance'}
            </button>
            </>
          )}
        />
        {error ? <p role="alert" className="mt-4 rounded border border-danger-border bg-danger-bg p-3 text-sm text-danger-text">{error}</p> : null}
        {success ? <p role="status" className="mt-4 rounded border border-success-border bg-success-bg p-3 text-sm text-success-text">{success}</p> : null}
      </section>

      <OperationalSummaryBand
        items={[
          {
            label: 'Pending',
            value: dataAvailable ? maintenanceSummary.pending : 'Unavailable',
            detail: 'Awaiting service',
            tone: maintenanceSummary.pending > 0 ? 'warning' : 'neutral',
            icon: Clock3,
          },
          {
            label: 'In progress',
            value: dataAvailable ? maintenanceSummary.inProgress : 'Unavailable',
            detail: 'Service underway',
            tone: maintenanceSummary.inProgress > 0 ? 'info' : 'neutral',
            icon: Wrench,
          },
          {
            label: 'Completed',
            value: dataAvailable ? maintenanceSummary.completed : 'Unavailable',
            detail: 'Closed records',
            tone: 'success',
            icon: CheckCircle2,
          },
          {
            label: showVehicles ? 'Available armored cars' : 'Available firearms',
            value: dataAvailable ? availableAssets.length : 'Unavailable',
            detail: 'Inventory status',
            tone: !dataAvailable ? 'neutral' : availableAssets.length > 0 ? 'success' : 'danger',
            icon: PackageCheck,
          },
        ]}
      />

      {dataAvailable && maintenanceWithoutOpenJob > 0 ? (
        <p className="rounded border border-warning-border bg-warning-bg p-3 text-sm text-warning-text" role="status">
          {maintenanceWithoutOpenJob} {maintenanceWithoutOpenJob === 1 ? `${assetName} is` : `${assetName}s are`} marked Maintenance in Inventory without an open maintenance record.
        </p>
      ) : null}

      {showScheduleForm ? (
        <section className="table-glass rounded p-4 md:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Plus size={18} className="text-info-text" aria-hidden="true" />
            <h3 className="text-lg font-bold text-text-primary">Schedule {assetName} maintenance</h3>
          </div>
          <form onSubmit={handleSchedule} className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-text-secondary">{assetHeading}
              <select ref={scheduleAssetInput} required value={scheduleForm.assetId} onChange={(event) => setScheduleForm({ ...scheduleForm, assetId: event.target.value })} className="mt-1 min-h-10 w-full rounded border border-border bg-surface px-3 text-text-primary">
                <option value="">{showVehicles ? 'Select an armored car' : 'Select an available firearm'}</option>
                {schedulableAssets.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-text-secondary">Maintenance type
              {showVehicles ? (
                <select required value={scheduleForm.maintenanceType} onChange={(event) => setScheduleForm({ ...scheduleForm, maintenanceType: event.target.value })} className="mt-1 min-h-10 w-full rounded border border-border bg-surface px-3 text-text-primary">
                  <option value="">Select a maintenance type</option>
                  {Object.entries(VEHICLE_MAINTENANCE_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              ) : <input required value={scheduleForm.maintenanceType} onChange={(event) => setScheduleForm({ ...scheduleForm, maintenanceType: event.target.value })} placeholder="Inspection, cleaning, repair" className="mt-1 min-h-10 w-full rounded border border-border bg-surface px-3 text-text-primary" />}
            </label>
            <label className="text-sm font-semibold text-text-secondary">Scheduled date and time
              <input required={!showVehicles} type="datetime-local" value={scheduleForm.scheduledDate} onChange={(event) => setScheduleForm({ ...scheduleForm, scheduledDate: event.target.value })} className="mt-1 min-h-10 w-full rounded border border-border bg-surface px-3 text-text-primary" />
            </label>
            {!showVehicles ? <label className="text-sm font-semibold text-text-secondary">Assigned technician / performer
              <input value={scheduleForm.performedBy} onChange={(event) => setScheduleForm({ ...scheduleForm, performedBy: event.target.value })} placeholder="Optional" className="mt-1 min-h-10 w-full rounded border border-border bg-surface px-3 text-text-primary" />
            </label> : null}
            <label className="text-sm font-semibold text-text-secondary md:col-span-2">Description
              <textarea required value={scheduleForm.description} onChange={(event) => setScheduleForm({ ...scheduleForm, description: event.target.value })} rows={3} className="mt-1 w-full rounded border border-border bg-surface px-3 py-2 text-text-primary" />
            </label>
            <label className="text-sm font-semibold text-text-secondary">Estimated cost
              <input value={scheduleForm.cost} onChange={(event) => setScheduleForm({ ...scheduleForm, cost: event.target.value })} inputMode="decimal" placeholder="Optional" className="mt-1 min-h-10 w-full rounded border border-border bg-surface px-3 text-text-primary" />
            </label>
            {!showVehicles ? <label className="text-sm font-semibold text-text-secondary">Notes
              <input value={scheduleForm.notes} onChange={(event) => setScheduleForm({ ...scheduleForm, notes: event.target.value })} placeholder="Optional" className="mt-1 min-h-10 w-full rounded border border-border bg-surface px-3 text-text-primary" />
            </label> : null}
            <div className="flex justify-end md:col-span-2">
              <button type="submit" disabled={submitting !== null || schedulableAssets.length === 0} className="soc-btn-primary inline-flex min-h-10 items-center gap-2 px-4 disabled:cursor-not-allowed disabled:opacity-60">
                <CheckCircle2 size={16} aria-hidden="true" />
                {submitting === 'schedule' ? 'Scheduling...' : 'Schedule maintenance'}
              </button>
            </div>
            {schedulableAssets.length === 0 ? <p className="text-sm text-warning-text md:col-span-2">No {showVehicles ? 'armored cars' : 'available firearms'} can be scheduled for maintenance.</p> : null}
          </form>
        </section>
      ) : null}

      {completionTarget ? (
        <section className="table-glass rounded border border-info-border p-4 md:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="soc-kicker">COMPLETE RECORD</p>
              <h3 ref={completionHeading} tabIndex={-1} className="text-lg font-bold text-text-primary">Complete maintenance for {assetLabel(completionTarget.assetId)}</h3>
            </div>
            <button type="button" onClick={() => setCompletionTarget(null)} className="soc-btn inline-flex min-h-10 items-center gap-2 px-3" title="Cancel completion">
              <X size={16} aria-hidden="true" /> Cancel
            </button>
          </div>
          <form onSubmit={handleComplete} className="grid gap-4 md:grid-cols-3">
            {showVehicles ? (
              <p className="text-sm text-text-secondary md:col-span-3">Confirm that this service is complete.</p>
            ) : <>
            <label className="text-sm font-semibold text-text-secondary">Performed by
              <input required value={completionForm.performedBy} onChange={(event) => setCompletionForm({ ...completionForm, performedBy: event.target.value })} className="mt-1 min-h-10 w-full rounded border border-border bg-surface px-3 text-text-primary" />
            </label>
            <label className="text-sm font-semibold text-text-secondary">Actual cost
              <input value={completionForm.cost} onChange={(event) => setCompletionForm({ ...completionForm, cost: event.target.value })} inputMode="decimal" placeholder="Optional" className="mt-1 min-h-10 w-full rounded border border-border bg-surface px-3 text-text-primary" />
            </label>
            <label className="text-sm font-semibold text-text-secondary">Completion notes
              <input value={completionForm.notes} onChange={(event) => setCompletionForm({ ...completionForm, notes: event.target.value })} placeholder="Optional" className="mt-1 min-h-10 w-full rounded border border-border bg-surface px-3 text-text-primary" />
            </label>
            </>}
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
            <h3 className="text-lg font-bold text-text-primary">Maintenance records{dataAvailable ? ` (${maintenances.length})` : ''}</h3>
            <p className="text-sm text-text-secondary">Pending records can be completed from this table.</p>
          </div>
        </div>
        {maintenances.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead className="thead-glass">
                <tr>
                  {[assetHeading, 'Type', 'Scheduled', 'Status', 'Description', 'Actions'].map((heading) => <th key={heading} scope="col" className="border-b-2 border-border px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {maintenances.map((maintenance) => {
                  const canComplete = canCompleteRecord(maintenance.status)
                  return (
                    <tr key={maintenance.id} className="border-b border-border hover:bg-surface-hover">
                      <td className="px-3 py-3 font-semibold text-text-primary">{assetLabel(maintenance.assetId)}</td>
                      <td className="px-3 py-3 text-text-primary">{showVehicles ? VEHICLE_MAINTENANCE_TYPES[maintenance.maintenanceType as keyof typeof VEHICLE_MAINTENANCE_TYPES] ?? maintenance.maintenanceType : maintenance.maintenanceType}</td>
                      <td className="px-3 py-3 text-text-primary">{formatDate(maintenance.scheduledDate)}</td>
                      <td className="px-3 py-3"><span className={`inline-block rounded px-2 py-1 text-xs font-semibold uppercase ${getStatusBadgeColor(maintenance.status)}`}>{maintenance.status.replace('_', ' ')}</span></td>
                      <td className="max-w-[28rem] px-3 py-3 text-text-secondary">{maintenance.description}</td>
                      <td className="px-3 py-3 text-right">
                        {canComplete && <button type="button" onClick={() => openCompletionForm(maintenance)} className="soc-btn inline-flex min-h-10 items-center gap-2 px-3 text-xs" title="Complete maintenance"><CheckCircle2 size={15} aria-hidden="true" /> Complete</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="py-8 text-center text-text-secondary">{dataAvailable ? `No ${assetName} maintenance records found.` : 'Maintenance records are unavailable.'}</p>}
      </section>
    </>
  )
}

export default FirearmMaintenance
