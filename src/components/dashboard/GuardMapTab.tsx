import { FC } from 'react'
import DashboardCard from './ui/DashboardCard'
import SectionHeader from './ui/SectionHeader'
import StatCard from './ui/StatCard'

interface LastKnownLocation {
  latitude: number
  longitude: number
  accuracyMeters: number | null
  recordedAt: string
  source: string
}

interface GuardMapTabProps {
  mapExpanded: boolean
  onToggleExpand: () => void
  mapEmbedUrl: string | null
  mapExternalUrl: string | null
  lastKnownLocation: LastKnownLocation | null
}

const GuardMapTab: FC<GuardMapTabProps> = ({
  mapExpanded,
  onToggleExpand,
  mapEmbedUrl,
  mapExternalUrl,
  lastKnownLocation,
}) => {
  const mapStatus = mapEmbedUrl ? 'Live feed ready' : 'Awaiting coordinates'
  const locationUpdatedAt = lastKnownLocation
    ? new Date(lastKnownLocation.recordedAt).toLocaleString()
    : 'No updates yet'

  return (
    <section className="guard-section-frame" aria-label="Guard map workspace">
      <SectionHeader
        title="Location Status"
        subtitle="Confirm the latest location telemetry before expanding the live map."
      />

      <div className="guard-kpi-row md:grid-cols-3">
        <StatCard
          label="Map Feed"
          value={mapStatus}
          hint={mapExpanded ? 'Map panel currently expanded' : 'Map panel currently collapsed'}
          tone={mapEmbedUrl ? 'analytics' : 'default'}
        />
        <StatCard
          label="Last Update"
          value={lastKnownLocation ? 'Tracked' : 'Unavailable'}
          hint={locationUpdatedAt}
          tone={lastKnownLocation ? 'guard' : 'vehicle'}
        />
        <StatCard
          label="Accuracy"
          value={lastKnownLocation?.accuracyMeters != null ? `${Math.round(lastKnownLocation.accuracyMeters)}m` : 'N/A'}
          hint={lastKnownLocation ? `Source ${lastKnownLocation.source}` : 'Enable tracking from Mission'}
          tone="mission"
        />
      </div>

      <DashboardCard
        title="Map Screen"
        actions={
          <button
            type="button"
            onClick={onToggleExpand}
            className="min-h-11 rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm font-semibold text-text-primary"
          >
            {mapExpanded ? 'Collapse Live Map' : 'Expand Live Map'}
          </button>
        }
      >
        <p className="text-sm text-text-secondary">
          Map is separated from mission controls so it never blocks action buttons or check-in workflows.
        </p>

        {mapExpanded ? (
          <div className="mt-3 space-y-3">
            {mapEmbedUrl ? (
              <>
                <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-elevated">
                  <iframe
                    title="Guard location map"
                    src={mapEmbedUrl}
                    className="h-[320px] w-full"
                    loading="lazy"
                  />
                </div>
                {mapExternalUrl ? (
                  <a
                    href={mapExternalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm font-semibold text-text-primary"
                  >
                    Open Full Map in New Tab
                  </a>
                ) : null}
              </>
            ) : (
              <p className="soc-empty-state">
                No live coordinates yet. Enable tracking from Mission screen, then reopen map.
              </p>
            )}
          </div>
        ) : null}

        {lastKnownLocation ? (
          <div className="mt-3 rounded-lg border border-border-subtle bg-surface-elevated p-3 text-xs text-text-secondary">
            <p>
              Last known position: {lastKnownLocation.latitude.toFixed(6)},{' '}
              {lastKnownLocation.longitude.toFixed(6)}
            </p>
            <p>Source: {lastKnownLocation.source}</p>
            <p>Updated: {new Date(lastKnownLocation.recordedAt).toLocaleString()}</p>
          </div>
        ) : null}
      </DashboardCard>
    </section>
  )
}

export default GuardMapTab
