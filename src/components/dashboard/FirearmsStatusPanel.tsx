import { FC } from 'react'

interface FirearmsStatusPanelProps {
  firearms: any[]
  loading?: boolean
  error?: string
  lastUpdated?: string
}

const FirearmsStatusPanel: FC<FirearmsStatusPanelProps> = ({
  firearms,
  loading = false,
  error = '',
  lastUpdated,
}) => {
  const issued = firearms.filter((item) => item.status === 'issued').length
  const maintenance = firearms.filter((item) => item.status === 'maintenance').length
  const available = Math.max(firearms.length - issued - maintenance, 0)

  return (
    <section className="command-panel rounded border border-(--color-border) bg-(--color-surface)" aria-label="Firearms status">
      <div className="flex items-center justify-between border-b border-(--color-border) px-4 py-3">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-(--color-text)">Firearms Status</p>
          <p className="font-mono text-[11px] text-(--color-muted-text)">Availability and assignment posture</p>
        </div>
        {lastUpdated && <span className="font-mono text-[11px] text-(--color-muted-text)">Updated {lastUpdated}</span>}
      </div>

      <div className="space-y-3 px-4 py-3" role="region" aria-live="polite">
        <div className="grid grid-cols-3 gap-2">
          <div className="soc-status-success flex-col items-center w-full justify-center rounded-md px-2 py-1.5 text-center">
            <p className="font-mono text-[11px] uppercase tracking-wide">Available</p>
            <p className="font-mono text-lg font-bold">{available}</p>
          </div>
          <div className="soc-status-info flex-col items-center w-full justify-center rounded-md px-2 py-1.5 text-center">
            <p className="font-mono text-[11px] uppercase tracking-wide">Issued</p>
            <p className="font-mono text-lg font-bold">{issued}</p>
          </div>
          <div className="soc-status-warning flex-col items-center w-full justify-center rounded-md px-2 py-1.5 text-center">
            <p className="font-mono text-[11px] uppercase tracking-wide">Maint.</p>
            <p className="font-mono text-lg font-bold">{maintenance}</p>
          </div>
        </div>

        {loading && <p className="text-center font-mono text-xs text-(--color-muted-text)">Loading firearm status...</p>}

        {!loading && error && (
          <p role="alert" className="text-center font-mono text-xs text-danger-text">
            {error}
          </p>
        )}

        {!loading && !error && firearms.length === 0 && (
          <p className="text-center font-mono text-xs text-(--color-muted-text)">No firearm records available.</p>
        )}

        {!loading && !error && firearms.length > 0 && (
          <ul className="space-y-2" role="list">
            {firearms.slice(0, 6).map((item, index) => {
              const serial = item.serial_number || item.serialNumber || `Asset ${index + 1}`
              const weaponType = item.weapon_type || item.type || 'Firearm'
              const status = (item.status || 'available').toUpperCase()

              return (
                <li key={item.id || `${serial}-${index}`} className="rounded-md border border-(--color-border)/60 bg-(--color-bg)/30 px-3 py-2 shadow-inner shadow-black/20">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs font-semibold text-(--color-text)">{serial}</p>
                      <p className="truncate font-mono text-[11px] text-(--color-muted-text)">{weaponType}</p>
                    </div>
                    <span className="inline-flex rounded-full border border-(--color-border) px-2 py-0.5 font-mono text-[11px] uppercase text-(--color-text)">
                      {status}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

export default FirearmsStatusPanel
