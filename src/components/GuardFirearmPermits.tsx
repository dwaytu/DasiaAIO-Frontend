import { useState, useEffect, FC, type FormEvent } from 'react'
import { Link } from 'react-router'
import { API_BASE_URL } from '../config'
import { logError } from '../utils/logger'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'
import OperationalShell from './layout/OperationalShell'
import { getSidebarNav } from '../config/navigation'
import { MANILA_TIME_ZONE } from '../utils/scheduleDateTime'
import { ROUTES } from '../router/routes'
import { can } from '../utils/permissions'
import GuardSearchSelect, { type GuardSearchOption } from './shared/GuardSearchSelect'
import SearchableSelect from './shared/SearchableSelect'
import { loadFirearmInventory } from '../utils/firearmInventory'

const PERMITS_PATH = '/api/guard-firearm-permits'

interface Permit {
  id: string
  guardId: string
  firearmId: string | null
  permitType: string
  issuedDate: string
  expiryDate: string
  status: string
}

interface Props {
  user: any
  onLogout: () => void
  onViewChange?: (view: string) => void
  activeView?: string
}

const GuardFirearmPermits: FC<Props> = ({ user, onLogout, onViewChange, activeView }) => {
  const [permits, setPermits] = useState<Permit[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [readWarning, setReadWarning] = useState<string>('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showRecordForm, setShowRecordForm] = useState(false)
  const [permitRevision, setPermitRevision] = useState(0)
  const [recorded, setRecorded] = useState(false)
  const canRecord = can(user.role, 'manage_permits')

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setReadWarning('')
    setPermits([])
    const permitsPath = user.role === 'guard'
      ? `${PERMITS_PATH}/${encodeURIComponent(user.id)}`
      : PERMITS_PATH
    void fetchJsonOrThrow<{ permits: Permit[] }>(`${API_BASE_URL}${permitsPath}`, {
      headers: getAuthHeaders(), signal: controller.signal,
    }, 'Unable to load permit list').then((data) => {
      if (!controller.signal.aborted) setPermits(data.permits || [])
    }).catch((err) => {
      if (controller.signal.aborted) return
      logError('Error fetching permits:', err)
      setReadWarning('Permit records are temporarily unavailable.')
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [user.id, user.role, permitRevision])

  const searchTerm = search.trim().toLowerCase()
  const now = Date.now()
  const matchingPermits = permits.map((permit) => {
    const status = permit.status.trim().toLowerCase()
    const expired = status === 'active' && Date.parse(permit.expiryDate) <= now
    return { ...permit, status: expired ? 'expired' : status }
  }).filter((permit) => (
    (!statusFilter || permit.status === statusFilter) &&
    [permit.guardId, permit.firearmId, permit.permitType].some((value) => value?.toLowerCase().includes(searchTerm))
  ))

  const getStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-success-bg text-success-text ring-1 ring-success-border'
      case 'expired': return 'bg-danger-bg text-danger-text ring-1 ring-danger-border'
      case 'pending': return 'bg-warning-bg text-warning-text ring-1 ring-warning-border'
      default: return 'soc-status-neutral'
    }
  }

  return (
    <OperationalShell
      user={user}
      title="PERMITS"
      navItems={getSidebarNav(user.role)}
      activeView={activeView || 'permits'}
      onNavigate={(view) => onViewChange?.(view)}
      onLogout={onLogout}
      mobileMenuOpen={mobileMenuOpen}
      onMenuOpen={() => setMobileMenuOpen(true)}
      onMenuClose={() => setMobileMenuOpen(false)}
      onLogoClick={() => onViewChange?.('dashboard')}
    >

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-center">
            <div className="text-info-text text-lg font-medium">Loading permits...</div>
          </div>
        ) : (
          <div className="flex-1 space-y-4 p-4 md:p-8 overflow-y-auto w-full animate-fade-in">
            {readWarning ? (
              <div role="alert" className="mb-4 rounded border border-warning-border bg-warning-bg p-3 text-sm text-warning-text">
                {readWarning}
              </div>
            ) : null}
            {recorded && <p role="status" className="rounded border border-success-border bg-success-bg p-3 text-sm text-success-text">Permit record saved.</p>}
            <section className="rounded overflow-hidden table-glass">
              <div className="shrink-0 px-6 py-5 border-b border-border-subtle">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-text-primary">Guard firearm permits</h2>
                    <p className="mt-1 text-sm text-text-secondary">Look up recorded permits and check their status and expiry dates.</p>
                  </div>
                  {canRecord && !readWarning && (
                    <button
                      type="button"
                      aria-expanded={showRecordForm}
                      aria-controls="record-permit"
                      className="soc-btn-primary min-h-11 px-4"
                      onClick={() => { setRecorded(false); setShowRecordForm((open) => !open) }}
                    >
                      {showRecordForm ? 'Close form' : 'Record issued permit'}
                    </button>
                  )}
                </div>
                {!readWarning && permits.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-text-primary">
                      Search permits
                      <input type="search" className="soc-form-control min-h-11" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Guard ID, firearm ID, or permit type" />
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-text-primary">
                      Status
                      <select className="soc-form-control min-h-11" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                        <option value="">All statuses</option>
                        <option value="active">Active</option>
                        <option value="expired">Expired</option>
                        <option value="pending">Pending</option>
                        <option value="revoked">Revoked</option>
                      </select>
                    </label>
                  </div>
                )}
              </div>
              <div id="record-permit">
                {showRecordForm && canRecord && (
                  <RecordPermitForm onSaved={() => {
                    setShowRecordForm(false)
                    setRecorded(true)
                    setSearch('')
                    setStatusFilter('')
                    setPermitRevision((revision) => revision + 1)
                  }} />
                )}
              </div>
              {readWarning ? null : matchingPermits.length > 0 ? (
                <div className="soc-scroll-area flex-1 min-h-0 overflow-auto">
                  <table className="w-full border-collapse">
                    <thead className="thead-glass">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Guard ID</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Firearm ID</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Type</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Issued Date</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Expiry Date</th>
                        <th className="px-4 py-3 text-left font-semibold text-text-primary border-b-2 border-border text-sm uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchingPermits.map((p) => (
                        <tr key={p.id} className="border-b border-border hover:bg-surface-hover">
                          <td className="px-4 py-3 text-text-primary">{p.guardId}</td>
                          <td className="px-4 py-3 text-text-primary">{p.firearmId || '—'}</td>
                          <td className="px-4 py-3 text-text-primary">{p.permitType}</td>
                          <td className="px-4 py-3 text-text-primary">{new Date(p.issuedDate).toLocaleDateString('en-PH', { timeZone: MANILA_TIME_ZONE })}</td>
                          <td className={`px-4 py-3 ${p.status === 'expired' ? 'text-danger-text font-semibold' : 'text-text-primary'}`}>
                            {new Date(p.expiryDate).toLocaleDateString('en-PH', { timeZone: MANILA_TIME_ZONE })}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadgeColor(p.status)}`}>
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-2 px-6 py-8 text-center text-sm text-text-secondary">
                  <p>{permits.length ? 'No permits match these filters.' : 'No guard firearm permits have been recorded.'}</p>
                  {!permits.length && canRecord && (
                    <p>Security guard license records are available in <Link className="text-info-text underline" to={ROUTES.DOCUMENTS}>Guard Documents</Link>.</p>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
    </OperationalShell>
  )
}

function RecordPermitForm({ onSaved }: { onSaved: () => void }) {
  const [options, setOptions] = useState<{
    guards: GuardSearchOption[]
    firearms: Array<{ id: string; value: string; label: string }>
  } | null>(null)
  const [form, setForm] = useState({ guardId: '', firearmId: '', type: '', issueDate: '', expiryDate: '', confirmed: false })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const headers = getAuthHeaders()
    void Promise.all([
      fetchJsonOrThrow<Array<{ id: string; full_name?: string; username?: string; guard_code?: string | null }>>(
        `${API_BASE_URL}/api/guards`,
        { headers, signal: controller.signal },
        'Unable to load the guard roster.',
      ),
      loadFirearmInventory(headers, controller.signal),
    ]).then(([guards, inventory]) => {
      if (controller.signal.aborted) return
      setOptions({
        guards: guards.map(({ id, full_name, username, guard_code }) => ({ id, fullName: full_name, username, guardCode: guard_code })),
        firearms: inventory.map(({ id, serialNumber, model }) => ({ id, value: id, label: `${serialNumber} - ${model}` })),
      })
    }).catch(() => {
      if (!controller.signal.aborted) setError('Unable to load permit form options. Close and reopen the form to retry.')
    })
    return () => controller.abort()
  }, [])

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving || !options || !form.confirmed || !form.guardId) return
    if (!form.type.trim() || !form.issueDate || !form.expiryDate || form.expiryDate < form.issueDate) {
      setError('Enter the permit type and check the issue and expiry dates.')
      return
    }

    const issued = new Date(`${form.issueDate}T00:00:00+08:00`)
    const expiry = new Date(`${form.expiryDate}T23:59:59+08:00`)
    setSaving(true)
    setError('')
    try {
      await fetchJsonOrThrow(`${API_BASE_URL}${PERMITS_PATH}`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          guard_id: form.guardId,
          firearm_id: form.firearmId || null,
          permit_type: form.type.trim(),
          issued_date: issued.toISOString(),
          expiry_date: expiry.toISOString(),
          status: expiry.getTime() <= Date.now() ? 'expired' : 'active',
        }),
      }, 'Unable to save the permit record.')
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save the permit record.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-4 border-b border-border-subtle p-6">
      <h3 className="text-lg font-bold text-text-primary">Record an issued permit</h3>
      <p className="text-sm text-text-secondary">Enter the details from the issued permit. Dates are in Philippine time.</p>
      {error && <p role="alert" className="text-sm text-danger-text">{error}</p>}
      {!options && !error && <p role="status" className="text-sm text-text-secondary">Loading permit form options…</p>}
      {options && (
        <fieldset disabled={saving} className="grid min-w-0 gap-4 md:grid-cols-2">
          <GuardSearchSelect id="permit-guard" label="Guard" guards={options.guards} value={form.guardId} onChange={(guardId) => setForm({ ...form, guardId })} required emptyMessage="No guards are available in the roster." />
          <SearchableSelect
            id="permit-firearm"
            label="Firearm (optional)"
            options={options.firearms}
            value={form.firearmId}
            onChange={(firearmId) => setForm({ ...form, firearmId })}
            placeholder="Search by serial number or model"
            helperText="Select a firearm if the permit identifies one."
            emptyMessage="No firearms are available in the inventory register."
            noResultsMessage={() => 'No firearms match this search.'}
            clearSelectionOnEdit
          />
          <label className="grid gap-1 text-sm text-text-primary md:col-span-2">
            Permit type
            <input required className="soc-form-control min-h-11" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} />
          </label>
          <label className="grid gap-1 text-sm text-text-primary">
            Issue date
            <input required type="date" className="soc-form-control min-h-11" value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })} />
          </label>
          <label className="grid gap-1 text-sm text-text-primary">
            Expiry date
            <input required type="date" min={form.issueDate || undefined} className="soc-form-control min-h-11" value={form.expiryDate} onChange={(event) => setForm({ ...form, expiryDate: event.target.value })} />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm text-text-primary md:col-span-2">
            <input required type="checkbox" checked={form.confirmed} onChange={(event) => setForm({ ...form, confirmed: event.target.checked })} />
            I verified these details against the issued permit.
          </label>
          <div className="md:col-span-2">
            <button type="submit" className="soc-btn-primary min-h-11 px-4" disabled={!form.guardId || !form.confirmed || saving}>
              {saving ? 'Saving…' : 'Save permit record'}
            </button>
          </div>
        </fieldset>
      )}
    </form>
  )
}

export default GuardFirearmPermits

