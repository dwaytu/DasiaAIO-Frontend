import { FC, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { getSidebarNav } from '../../config/navigation'
import OperationalShell from '../layout/OperationalShell'
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

  const canManageMdr = user?.role === 'superadmin' || user?.role === 'admin'
  const resolvedActiveView = activeView.startsWith('mdr-import') ? 'mdr-import' : activeView

  const openBatch = (targetBatchId: string) => {
    navigate(`/mdr-import/${encodeURIComponent(targetBatchId)}`)
  }

  const returnToHistory = () => {
    setTab('history')
    navigate('/mdr-import')
  }

  return (
    <OperationalShell
      user={user}
      title="MDR IMPORT"
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
            {!batchId ? (
              <div className="inline-flex rounded border border-border bg-surface p-1">
                <button
                  type="button"
                  className={`min-h-11 rounded px-4 text-sm font-semibold ${
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
                  className={`min-h-11 rounded px-4 text-sm font-semibold ${
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
            MDR import workspace is available for admin and superadmin roles.
          </section>
        )}
      </div>
    </OperationalShell>
  )
}

export default MdrImportPage
