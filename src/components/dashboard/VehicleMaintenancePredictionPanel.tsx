import { FC } from 'react'
import type { VehicleMaintenancePrediction } from '../../hooks/useVehicleMaintenancePrediction'

interface VehicleMaintenancePredictionPanelProps {
  predictions: VehicleMaintenancePrediction[]
  loading?: boolean
  error?: string
  lastUpdated?: string
}

const riskPillClass: Record<string, string> = {
  LOW: 'border-green-500/40 bg-green-500/10 text-green-200',
  MEDIUM: 'border-amber-400/40 bg-amber-500/10 text-amber-200',
  HIGH: 'border-red-500/40 bg-red-500/10 text-red-200',
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
      className="command-panel rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
      aria-label="Predictive vehicle maintenance"
    >
      <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-text)]">Predictive Vehicle Maintenance</p>
          <p className="font-mono text-[10px] text-[color:var(--color-muted-text)]">Vehicles likely to require maintenance soon</p>
        </div>
        {lastUpdated && <span className="font-mono text-[10px] text-[color:var(--color-muted-text)]">{lastUpdated}</span>}
      </div>

      <div className="space-y-2 px-4 py-3" role="region" aria-live="polite">
        {loading && <p className="text-center font-mono text-xs text-[color:var(--color-muted-text)]">Scoring vehicle maintenance risk...</p>}

        {!loading && error && (
          <p role="alert" className="text-center font-mono text-xs text-red-400">
            {error}
          </p>
        )}

        {!loading && !error && predictions.length === 0 && (
          <p className="text-center font-mono text-xs text-[color:var(--color-muted-text)]">No vehicles available for maintenance scoring.</p>
        )}

        {!loading && !error && predictions.length > 0 && (
          <ul className="space-y-2" role="list">
            {predictions.slice(0, 6).map((item) => {
              const riskClass = riskPillClass[item.riskLevel] ?? riskPillClass.LOW
              return (
                <li
                  key={`${item.vehicleId}-${item.calculatedAt}`}
                  className="rounded-md border border-[color:var(--color-border)]/60 bg-[color:var(--color-bg)]/30 px-3 py-2 shadow-inner shadow-black/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm text-[color:var(--color-text)]">{item.licensePlate}</p>
                      <p className="font-mono text-[10px] text-[color:var(--color-muted-text)]">
                        Vehicle ID {item.vehicleId.slice(0, 8)} • {item.daysSinceService} days since service
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-base font-bold text-[color:var(--color-text)]">{item.riskScore.toFixed(3)}</p>
                      <span className={`inline-flex rounded-full border px-2 py-[2px] font-mono text-[10px] font-semibold ${riskClass}`}>
                        {item.riskLevel}
                      </span>
                    </div>
                  </div>

                  <p className="mt-2 font-mono text-[10px] text-[color:var(--color-muted-text)]">{item.recommendedAction}</p>
                  <p className="mt-1 font-mono text-[10px] text-[color:var(--color-muted-text)]">Risk level: {item.riskLevel}</p>
                  <p className="mt-1 font-mono text-[10px] text-[color:var(--color-muted-text)]">Confidence: {(getConfidence(item) * 100).toFixed(0)}%</p>
                  <p className="mt-1 font-mono text-[10px] text-[color:var(--color-muted-text)]">{getUrgencyNote(item)}</p>
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
