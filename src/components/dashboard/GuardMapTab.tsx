import { FC } from 'react'
import { MapPin } from 'lucide-react'
import SectionHeader from './ui/SectionHeader'

interface LastKnownLocation {
  latitude: number
  longitude: number
  accuracyMeters: number | null
  recordedAt: string
  source: string
}

interface GuardMapTabProps {
  mapEmbedUrl: string | null
  mapExternalUrl: string | null
  lastKnownLocation: LastKnownLocation | null
  trackingStatusLabel?: string
  trackingActiveWithoutSchedule?: boolean
  onSwitchToMission?: () => void
}

const GuardMapTab: FC<GuardMapTabProps> = ({
  mapEmbedUrl,
  mapExternalUrl,
  lastKnownLocation,
  trackingStatusLabel,
  trackingActiveWithoutSchedule,
  onSwitchToMission,
}) => {
  const locationUpdatedAt = lastKnownLocation
    ? new Date(lastKnownLocation.recordedAt).toLocaleString()
    : 'No updates yet'

  return (
    <section className="guard-section-frame" aria-label="Guard map workspace">
      <SectionHeader
        title="Live Map"
        subtitle={
          lastKnownLocation
            ? `Updated ${locationUpdatedAt}`
            : 'No heartbeat location yet. Map is centered on Tagum City without a live location marker.'
        }
      />

      <div className="mb-3 rounded border border-border-subtle bg-surface-elevated px-3 py-2 text-xs text-text-secondary">
        <p className="font-semibold text-text-primary">{trackingStatusLabel || 'Tracking status unavailable'}</p>
        {trackingActiveWithoutSchedule ? (
          <p className="mt-1">Tracking is active even without a scheduled shift.</p>
        ) : null}
      </div>

      {mapEmbedUrl ? (
        <div className="relative overflow-hidden rounded border border-border-subtle bg-surface-elevated">
          <iframe
            title="Guard location map"
            src={mapEmbedUrl}
            className="h-[calc(100dvh-14rem)] w-full"
            loading="lazy"
          />

          {lastKnownLocation ? (
            <div className="absolute bottom-2 left-2 z-10 flex items-center gap-2 rounded-full bg-surface/90 px-3 py-1.5 text-[11px] font-medium text-text-secondary backdrop-blur-sm">
              <span>{lastKnownLocation.latitude.toFixed(6)}, {lastKnownLocation.longitude.toFixed(6)}</span>
              {lastKnownLocation.accuracyMeters != null ? (
                <span>±{Math.round(lastKnownLocation.accuracyMeters)}m</span>
              ) : null}
              <span>via {lastKnownLocation.source}</span>
            </div>
          ) : (
            <div className="absolute left-2 top-2 z-10 max-w-xs rounded border border-info-border bg-info-bg/95 px-3 py-2 text-[11px] text-info-text backdrop-blur-sm">
              No location heartbeat yet. This fallback view is centered on Tagum City and does not indicate your live position.
            </div>
          )}

          {mapExternalUrl ? (
            <a
              href={mapExternalUrl}
              target="_blank"
              rel="noreferrer"
              className="absolute top-2 right-2 z-10 inline-flex items-center rounded-full bg-surface/90 px-3 py-1.5 text-xs font-semibold text-text-primary backdrop-blur-sm"
            >
              Open Full Map
            </a>
          ) : null}
        </div>
      ) : (
        <div className="rounded border border-border-subtle bg-surface-elevated p-6 text-center">
          <MapPin className="mx-auto h-8 w-8 text-text-tertiary" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-text-secondary">Location Not Active</p>
          <p className="mt-1 text-xs text-text-tertiary">Your GPS position will appear here once location tracking is enabled.</p>
          {onSwitchToMission ? (
            <button
              type="button"
              onClick={onSwitchToMission}
              className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-md border border-primary-border bg-primary-bg px-4 py-2 text-sm font-semibold text-primary-text transition-colors hover:bg-primary-bg/80"
            >
              Go to Mission
            </button>
          ) : null}
        </div>
      )}
    </section>
  )
}

export default GuardMapTab
