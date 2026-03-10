import { FC } from 'react'

interface OperationalMapPlaceholderProps {
  activeTrips: number
  activeGuards: number
}

const OperationalMapPlaceholder: FC<OperationalMapPlaceholderProps> = ({ activeTrips, activeGuards }) => {
  return (
    <section className="command-panel p-4 md:p-5" aria-label="Operational map">
      <div className="mb-4 border-b border-border-subtle pb-3">
        <h3 className="text-base font-bold uppercase tracking-wide text-text-primary">Operational Map</h3>
        <p className="text-xs uppercase tracking-[0.16em] text-text-tertiary">Animated tactical area monitor</p>
      </div>

      <div className="map-grid-surface relative h-72 overflow-hidden rounded-xl border border-border-elevated bg-surface">
        <div className="map-radar-ping" aria-hidden="true" />
        <div className="map-radar-sweep" aria-hidden="true" />

        <div className="absolute left-[20%] top-[26%]">
          <span className="status-light status-light-info status-light-pulse" aria-hidden="true" />
        </div>
        <div className="absolute left-[58%] top-[48%]">
          <span className="status-light status-light-warning status-light-pulse" aria-hidden="true" />
        </div>
        <div className="absolute left-[74%] top-[34%]">
          <span className="status-light status-light-success status-light-pulse" aria-hidden="true" />
        </div>

        <div className="absolute bottom-3 left-3 right-3 grid grid-cols-2 gap-2">
          <div className="rounded-md border border-info-border bg-info-bg px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Active Trips</p>
            <p className="text-xl font-black text-text-primary">{activeTrips}</p>
          </div>
          <div className="rounded-md border border-success-border bg-success-bg px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">Deployed Guards</p>
            <p className="text-xl font-black text-text-primary">{activeGuards}</p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default OperationalMapPlaceholder
