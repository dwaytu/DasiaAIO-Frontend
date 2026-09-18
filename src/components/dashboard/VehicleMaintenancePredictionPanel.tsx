import { FC } from 'react'
import type { VehicleMaintenancePrediction } from '../../hooks/useVehicleMaintenancePrediction'

interface VehicleMaintenancePredictionPanelProps {
  predictions: VehicleMaintenancePrediction[]
  loading?: boolean
  error?: string
  lastUpdated?: string
}

const riskPillClass: Record<string, string> = {
  LOW: 'soc-status-success',
  MEDIUM: 'soc-status-warning',
  HIGH: 'soc-status-danger',
}

const getUrgencyNote = (item: VehicleMaintenancePrediction): string => {
  if (item.riskLevel === 'HIGH') return 'High wear trend detected. Reserve this unit for emergency-only use.'
  if (item.riskLevel === 'MEDIUM') return 'Maintenance window should be booked before next heavy dispatch cycle.'
  return 'Routine servicing cadence remains healthy for this vehicle.'
}

const getConfidence = (item: VehicleMaintenancePrediction): number => {
  const normalized = item.riskScore <= 1 ? item.riskScore : item.riskScore / 100
  return Math.max(0.58, Math.min(0.98, 0.58 + normalized * 0.38))
}

const VehicleMaintenancePredictionPanel: FC<VehicleMaintenancePredictionPanelProps> = ({
  predictions,
  loading = false,
  error = '',
  lastUpdated,
}) => {
  return (
    <section
      className="command-panel flex h-[28rem] min-h-0 flex-col rounded border border-(--color-border) bg-(--color-surface) md:h-[32rem]"
      aria-label="Vehicle maintenance risk"
    >
      <div className="flex items-center justify-between border-b border-(--color-border) px-4 py-3">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-(--color-text)">Vehicle Maintenance Risk</p>
          <p className="font-mono text-[11px] text-(--color-muted-text)">Vehicles likely to require maintenance soon</p>
        </div>
        {lastUpdated && <span className="font-mono text-[11px] text-(--color-muted-text)">{lastUpdated}</span>}
      </div>

      <div className="soc-scroll-hidden min-h-0 flex-1 overflow-y-auto px-4 py-3" role="region" aria-live="polite">
        {loading && <p className="text-center font-mono text-xs text-(--color-muted-text)">Scoring vehicle maintenance risk...</p>}

        {!loading && error && (
          <p role="alert" className="text-center font-mono text-xs text-danger-text">
            {error}
          </p>
        )}

        {!loading && !error && predictions.length === 0 && (
          <p className="text-center font-mono text-xs text-(--color-muted-text)">No vehicles available for maintenance scoring.</p>
        )}

        {!loading && !error && predictions.length > 0 && (
          <ul className="space-y-2" role="list">
            {predictions.slice(0, 6).map((item) => {
              const riskClass = riskPillClass[item.riskLevel] ?? riskPillClass.LOW
              return (
                <li
                  key={`${item.vehicleId}-${item.calculatedAt}`}
                  className="rounded-md border border-(--color-border)/60 bg-(--color-bg)/30 px-3 py-2 shadow-inner shadow-black/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm text-(--color-text)">{item.licensePlate}</p>
                      <p className="font-mono text-[11px] text-(--color-muted-text)">
                        Vehicle ID {item.vehicleId.slice(0, 8)} • {item.daysSinceService} days since service
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-base font-bold text-(--color-text)">{item.riskScore.toFixed(3)}</p>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 font-mono text-[11px] font-semibold ${riskClass}`}>
                        {item.riskLevel}
                      </span>
                    </div>
                  </div>

                  <p className="mt-2 font-mono text-[11px] text-(--color-muted-text)">{item.recommendedAction}</p>
                  <p className="mt-1 font-mono text-[11px] text-(--color-muted-text)">Risk level: {item.riskLevel}</p>
                  <p className="mt-1 font-mono text-[11px] text-(--color-muted-text)">Confidence: {(getConfidence(item) * 100).toFixed(0)}%</p>
                  <p className="mt-1 font-mono text-[11px] text-(--color-muted-text)">{getUrgencyNote(item)}</p>
                  {item.riskLevel === 'HIGH' && (
                    <div className="mt-2 flex gap-1">
                      <button
                        type="button"
                        onClick={() => alert(`Flag ${item.licensePlate} for immediate inspection`)}
                        className="soc-btn soc-btn-danger min-h-11 px-2 py-1 font-mono text-[11px]"
                      >
                        Flag for Inspection
                      </button>
                      <button
                        type="button"
                        onClick={() => alert(`Remove ${item.licensePlate} from dispatch pool`)}
                        className="soc-btn soc-btn-warning min-h-11 px-2 py-1 font-mono text-[11px]"
                      >
                        Remove from Dispatch
                      </button>
                    </div>
                  )}
                  {item.riskLevel === 'MEDIUM' && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => alert(`Schedule maintenance for ${item.licensePlate}`)}
                        className="soc-btn soc-btn-warning min-h-11 px-2 py-1 font-mono text-[11px]"
                      >
                        Book Maintenance
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

export default VehicleMaintenancePredictionPanel
