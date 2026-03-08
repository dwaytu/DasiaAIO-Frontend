import { FC, useMemo } from 'react'
import SectionPanel from './SectionPanel'
import OpsMetricCard from './OpsMetricCard'
import OpsSectionGrid from './OpsSectionGrid'
import OpsTableWidget from './OpsTableWidget'
import OpsAlertFeed from './OpsAlertFeed'
import QuickActionsPanel, { QuickActionItem } from './QuickActionsPanel'
import OperationalSummaryStrip from './OperationalSummaryStrip'
import { useOpsSummary } from '../../hooks/useOpsSummary'
import { getOpsAlerts } from '../../hooks/useOpsAlerts'
import { useOpsShifts } from '../../hooks/useOpsShifts'
import { useOpsAssets } from '../../hooks/useOpsAssets'

interface CommandCenterDashboardProps {
  quickActions: QuickActionItem[]
}

const CommandCenterDashboard: FC<CommandCenterDashboardProps> = ({ quickActions }) => {
  const summaryState = useOpsSummary()
  const shiftsState = useOpsShifts()
  const assetsState = useOpsAssets()

  const summary = summaryState.summary
  const alerts = useMemo(() => getOpsAlerts(summary), [summary])
  const now = summaryState.lastUpdated || '--'

  const shiftRows = shiftsState.shifts.slice(0, 8).map((shift: any) => [
    shift.guard_name || shift.guard_username || 'Unknown guard',
    shift.client_site || 'Unknown site',
    shift.status || 'scheduled',
  ])

  const firearmRows = assetsState.firearms.slice(0, 8).map((firearm: any) => [
    firearm.serial_number || firearm.id || 'N/A',
    firearm.model || 'Unknown model',
    firearm.status || 'unknown',
  ])

  const vehicleRows = assetsState.vehicles.slice(0, 8).map((vehicle: any) => [
    vehicle.license_plate || vehicle.id || 'N/A',
    vehicle.model || 'Unknown model',
    vehicle.status || 'unknown',
  ])

  const staleNote = `Last updated ${now}`

  return (
    <div className="space-y-6">
      <SectionPanel
        title="Security Operations Command Center"
        subtitle="Real-time situational overview for daily security operations"
        icon={<span aria-hidden="true">SOC</span>}
        actions={<QuickActionsPanel actions={quickActions} />}
        collapsible
      >
        <OperationalSummaryStrip
          metrics={[
            { label: 'Active Guards', value: summary.activeGuardsOnDuty, tone: 'success', hint: staleNote },
            { label: 'Active Missions', value: summary.activeArmoredCarTrips, tone: 'info', hint: staleNote },
            { label: 'Alerts', value: alerts.length, tone: alerts.length > 0 ? 'warning' : 'neutral', hint: staleNote },
            { label: 'System Health', value: summary.guardsAbsentToday > 0 ? 'Degraded' : 'Operational', tone: summary.guardsAbsentToday > 0 ? 'danger' : 'success', hint: staleNote },
          ]}
        />
      </SectionPanel>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-1">
          <OpsAlertFeed alerts={alerts} />
        </div>

        <div className="space-y-6 xl:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <OpsMetricCard label="Pending Guard Approvals" value={summary.pendingGuardApprovals} severity={summary.pendingGuardApprovals > 0 ? 'warning' : 'normal'} updatedAt={staleNote} />
            <OpsMetricCard label="Firearms Issued" value={summary.firearmsCurrentlyIssued} severity="info" updatedAt={staleNote} />
            <OpsMetricCard label="Overdue Returns" value={summary.overdueFirearmReturns} severity={summary.overdueFirearmReturns > 0 ? 'critical' : 'normal'} updatedAt={staleNote} />
            <OpsMetricCard label="Vehicles Maintenance" value={summary.vehiclesInMaintenance} severity={summary.vehiclesInMaintenance > 0 ? 'warning' : 'normal'} updatedAt={staleNote} />
          </div>

          <OpsTableWidget
            title="Operations: Today's Shifts"
            subtitle={shiftsState.loading ? 'Loading shift activity...' : staleNote}
            headers={['Guard', 'Site', 'Status']}
            rows={shiftRows}
            emptyMessage="No shifts found."
          />
        </div>
      </section>

      <OpsSectionGrid>
        <OpsTableWidget
          title="Assets: Firearm Status"
          subtitle={assetsState.loading ? 'Loading firearm inventory...' : staleNote}
          headers={['Serial', 'Model', 'Status']}
          rows={firearmRows}
          emptyMessage="No firearms found."
        />

        <OpsTableWidget
          title="Assets: Vehicle Fleet Status"
          subtitle={assetsState.loading ? 'Loading vehicle fleet...' : staleNote}
          headers={['Plate', 'Model', 'Status']}
          rows={vehicleRows}
          emptyMessage="No vehicles found."
        />
      </OpsSectionGrid>

      {(summaryState.error || shiftsState.error || assetsState.error) && (
        <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-100">
          Command center loaded with partial data. Some modules are unavailable.
        </div>
      )}
    </div>
  )
}

export default CommandCenterDashboard
