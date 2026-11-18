import { FC, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, Loader2, Trash2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router'
import { getSidebarNav } from '../../config/navigation'
import { normalizeRole } from '../../types/auth'
import { API_BASE_URL } from '../../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../../utils/api'
import OperationalShell from '../layout/OperationalShell'
import SentinelModal from '../shared/SentinelModal'
import MdrBatchList from './MdrBatchList'
import MdrBatchReview from './MdrBatchReview'
import MdrUploader from './MdrUploader'

interface MdrImportPageProps {
  user: any
  onLogout: () => void
  onViewChange: (view: string) => void
  activeView: string
}

type MdrWorkspaceTab = 'import' | 'history'

const MdrImportPage: FC<MdrImportPageProps> = ({ user, onLogout, onViewChange, activeView }) => {
  const navigate = useNavigate()
  const { batchId } = useParams<{ batchId: string }>()

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [tab, setTab] = useState<MdrWorkspaceTab>('import')
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [showClearModal, setShowClearModal] = useState(false)
  const [clearConfirmation, setClearConfirmation] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')

  const normalizedRole = normalizeRole(user?.role)
  const canManageMdr = normalizedRole === 'superadmin' || normalizedRole === 'admin'
  const resolvedActiveView = activeView.startsWith('mdr-import') ? 'mdr-import' : activeView

  const openBatch = (targetBatchId: string) => {
    navigate(`/mdr-import/${encodeURIComponent(targetBatchId)}`)
  }

  const returnToHistory = () => {
    setTab('history')
    navigate('/mdr-import')
  }

  const handleExport = async (): Promise<void> => {
    setIsExporting(true)
    setActionMessage('')
    setActionError('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/mdr/export`, {
        headers: getAuthHeaders(),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(body?.error || 'Unable to export current MDR data.')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `sentinel-mdr-resources-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setActionMessage('Current MDR guard, firearm, and vehicle data was exported successfully.')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to export current MDR data.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleClearResources = async (): Promise<void> => {
    setIsClearing(true)
    setActionMessage('')
    setActionError('')

    try {
      const response = await fetchJsonOrThrow<{
        status: string
        deleted: { guards: number; firearms: number; vehicles: number }
      }>(
        `${API_BASE_URL}/api/mdr/resources`,
        {
          method: 'DELETE',
          headers: getAuthHeaders(),
        },
        'Unable to clear current MDR resources.',
      )

      setShowClearModal(false)
      setClearConfirmation('')
      setActionMessage(
        `MDR resources cleared: ${response.deleted.guards} guards, ${response.deleted.firearms} firearms, and ${response.deleted.vehicles} vehicles deleted.`,
      )
      setHistoryRefreshKey((current) => current + 1)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to clear current MDR resources.')
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <OperationalShell
      user={user}
      title="Import Agency Records"
      badgeLabel="MDR"
      navItems={getSidebarNav(user.role)}
      activeView={resolvedActiveView}
      onNavigate={onViewChange}
      onLogout={onLogout}
      mobileMenuOpen={mobileMenuOpen}
      onMenuOpen={() => setMobileMenuOpen(true)}
      onMenuClose={() => setMobileMenuOpen(false)}
      onLogoClick={() => onViewChange('dashboard')}
    >
      <div className="space-y-4">
        {canManageMdr ? (
          <>
            <section className="rounded border border-border bg-surface-elevated p-4 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Master Data Register</p>
                  <h2 className="text-xl font-semibold text-text-primary">Import agency records (MDR)</h2>
                  <p className="max-w-2xl text-sm text-text-secondary">
                    Upload a supported workbook, check its rows, review the staged result, then save valid guard, firearm, and vehicle records.
                  </p>
                  <ol className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-text-secondary" aria-label="Import steps">
                    <li className="rounded border border-border-subtle bg-surface px-2 py-1">1. Select file</li>
                    <li className="rounded border border-border-subtle bg-surface px-2 py-1">2. Review changes</li>
                    <li className="rounded border border-border-subtle bg-surface px-2 py-1">3. Import records</li>
                  </ol>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="soc-btn soc-btn-neutral inline-flex min-h-11 items-center gap-2"
                    onClick={() => { void handleExport() }}
                    disabled={isExporting || isClearing}
                    title="Export current MDR resource data as CSV"
                  >
                    {isExporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
                    {isExporting ? 'Exporting...' : 'Export current records'}
                  </button>
                </div>
              </div>
            </section>

            <details className="rounded border border-danger-border bg-danger-bg/30 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-danger-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">Danger zone</summary>
              <p className="mt-2 max-w-2xl text-sm text-text-secondary">Delete all imported guard accounts, firearms, and armored vehicle records only when you have confirmed the exact impact and have exported any required records.</p>
              <button
                type="button"
                className="soc-btn soc-btn-danger mt-3 inline-flex min-h-11 items-center gap-2"
                onClick={() => {
                  setActionMessage('')
                  setActionError('')
                  setClearConfirmation('')
                  setShowClearModal(true)
                }}
                disabled={isExporting || isClearing}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete imported resource records
              </button>
            </details>

            {actionError ? (
              <div className="flex items-start gap-2 rounded border border-danger bg-danger/10 p-3 text-sm text-danger" role="alert">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{actionError}</span>
              </div>
            ) : null}

            {actionMessage ? (
              <div className="flex items-start gap-2 rounded border border-success bg-success/10 p-3 text-sm text-success" role="status">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{actionMessage}</span>
              </div>
            ) : null}

            {!batchId ? (
              <div className="inline-flex rounded border border-border bg-surface p-1">
                <button
                  type="button"
                  className={`soc-btn soc-btn-neutral px-4 text-sm ${
                    tab === 'import'
                      ? 'bg-accent text-text-primary'
                      : 'text-text-secondary'
                  }`}
                  onClick={() => setTab('import')}
                >
                  Import New
                </button>
                <button
                  type="button"
                  className={`soc-btn soc-btn-neutral px-4 text-sm ${
                    tab === 'history'
                      ? 'bg-accent text-text-primary'
                      : 'text-text-secondary'
                  }`}
                  onClick={() => setTab('history')}
                >
                  Batch History
                </button>
              </div>
            ) : null}

            {batchId ? (
              <MdrBatchReview
                batchId={batchId}
                userRole={user.role}
                onBackToHistory={returnToHistory}
                onBatchUpdated={() => {
                  setHistoryRefreshKey((current) => current + 1)
                }}
              />
            ) : tab === 'import' ? (
              <MdrUploader
                onUploadSuccess={(targetBatchId) => {
                  setHistoryRefreshKey((current) => current + 1)
                  openBatch(targetBatchId)
                }}
              />
            ) : (
              <MdrBatchList
                onSelectBatch={(targetBatchId) => {
                  openBatch(targetBatchId)
                }}
                refreshKey={historyRefreshKey}
              />
            )}
          </>
        ) : (
          <section className="rounded border border-warning bg-warning/10 p-4 text-sm text-warning">
            Import agency records is available for admin and superadmin roles.
          </section>
        )}
      </div>

      <SentinelModal
        open={showClearModal}
        onClose={() => {
          if (!isClearing) setShowClearModal(false)
        }}
        title="Delete All MDR Resources?"
        subtitle="This action cannot be undone."
        size="sm"
      >
        <div className="space-y-4">
          <div className="rounded border border-danger bg-danger/10 p-3 text-sm text-text-primary">
            <p className="font-semibold text-danger">Permanent deletion</p>
            <p className="mt-1 text-text-secondary">
              This will delete every guard account, firearm, and armored vehicle record. Admin, superadmin, supervisor, client, MDR batch history, and audit records will remain.
            </p>
          </div>
          <label className="block text-sm font-semibold text-text-primary" htmlFor="mdr-clear-confirmation">
            Type <span className="font-mono">DELETE MDR RESOURCES</span> to confirm
            <input
              id="mdr-clear-confirmation"
              value={clearConfirmation}
              onChange={(event) => setClearConfirmation(event.target.value)}
              className="soc-input mt-2 w-full"
              autoComplete="off"
            />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="soc-btn soc-btn-neutral"
              onClick={() => setShowClearModal(false)}
              disabled={isClearing || clearConfirmation !== 'DELETE MDR RESOURCES'}
            >
              Cancel
            </button>
            <button
              type="button"
              className="soc-btn soc-btn-danger inline-flex items-center gap-2"
              onClick={() => { void handleClearResources() }}
              disabled={isClearing}
            >
              {isClearing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
              {isClearing ? 'Deleting...' : 'Delete All'}
            </button>
          </div>
        </div>
      </SentinelModal>
    </OperationalShell>
  )
}

export default MdrImportPage
