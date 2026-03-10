import { FC, useEffect, useMemo, useState } from 'react'
import SectionPanel from './SectionPanel'
import OpsMetricCard from './OpsMetricCard'
import OpsSectionGrid from './OpsSectionGrid'
import OpsTableWidget from './OpsTableWidget'
import QuickActionsPanel, { QuickActionItem } from './QuickActionsPanel'
import OperationalSummaryStrip from './OperationalSummaryStrip'
import LiveOperationsFeed, { LiveFeedItem } from './LiveOperationsFeed'
import SystemInfrastructureStatus, { ServiceHealthItem } from './SystemInfrastructureStatus'
import MissionTimelinePanel, { MissionTimelineItem } from './MissionTimelinePanel'
import OperationalMapPlaceholder from './OperationalMapPlaceholder'
import IncidentAlertFeed from './IncidentAlertFeed'
import GuardDeploymentOverview from './GuardDeploymentOverview'
import SentinelLogo from '../SentinelLogo'
import { useOpsSummary } from '../../hooks/useOpsSummary'
import { getOpsAlerts } from '../../hooks/useOpsAlerts'
import { useOpsShifts } from '../../hooks/useOpsShifts'
import { useOpsAssets } from '../../hooks/useOpsAssets'
import { useServiceHealth } from '../../hooks/useServiceHealth'

interface CommandCenterDashboardProps {
  quickActions: QuickActionItem[]
}

const CommandCenterDashboard: FC<CommandCenterDashboardProps> = ({ quickActions }) => {
  const summaryState = useOpsSummary()
  const shiftsState = useOpsShifts()
  const assetsState = useOpsAssets()
  const serviceState = useServiceHealth()
  const [clock, setClock] = useState(() => new Date())
  const [storyTicks, setStoryTicks] = useState(0)

  const summary = summaryState.summary
  const alerts = useMemo(() => getOpsAlerts(summary), [summary])
  const now = summaryState.lastUpdated || '--'
  const staleNote = `Last updated ${now}`

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const refresher = window.setInterval(() => {
      summaryState.refresh()
      shiftsState.refresh()
      assetsState.refresh()
      setStoryTicks((value) => value + 1)
    }, 15000)

    return () => window.clearInterval(refresher)
  }, [summaryState.refresh, shiftsState.refresh, assetsState.refresh])

  const systemStatus = alerts.some((alert) => alert.severity === 'critical')
    ? 'Critical'
    : alerts.some((alert) => alert.severity === 'warning')
      ? 'Warning'
      : 'Operational'
  const threatLevel = alerts.length >= 3 || summary.guardsAbsentToday > 0
    ? 'High'
    : alerts.length > 0 || summary.pendingGuardApprovals > 0
      ? 'Medium'
      : 'Low'
  const systemTone = systemStatus === 'Critical' ? 'danger' : systemStatus === 'Warning' ? 'warning' : 'success'
  const threatTone = threatLevel === 'High' ? 'danger' : threatLevel === 'Medium' ? 'warning' : 'info'

  const liveFeed = useMemo<LiveFeedItem[]>(() => {
    const events: LiveFeedItem[] = []
    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

    shiftsState.shifts
      .filter((shift: any) => shift.status === 'in_progress' || shift.status === 'scheduled')
      .slice(0, 4)
      .forEach((shift: any, index: number) => {
        const guardName = shift.guard_name || shift.guard_username || 'Guard'
        const site = shift.client_site || 'field post'
        events.push({
          id: `shift-${shift.id || index}-${storyTicks}`,
          category: 'guard',
          timestamp: currentTime,
          description: `${guardName} ${shift.status === 'in_progress' ? 'started shift' : 'scheduled deployment'} at ${site}`,
        })
      })

    assetsState.vehicles.slice(0, 2).forEach((vehicle: any, index: number) => {
      const plate = vehicle.license_plate || vehicle.id || `V${index + 1}`
      const destination = vehicle.model || 'assigned route'
      events.push({
        id: `vehicle-${vehicle.id || index}-${storyTicks}`,
        category: 'vehicle',
        timestamp: currentTime,
        description: `Vehicle ${plate} dispatched for ${destination}`,
      })
    })

    if (summary.firearmsCurrentlyIssued > 0) {
      events.push({
        id: `equipment-${summary.firearmsCurrentlyIssued}-${storyTicks}`,
        category: 'equipment',
        timestamp: currentTime,
        description: `${summary.firearmsCurrentlyIssued} firearm allocations currently active`,
      })
    }

    events.push({
      id: `mission-active-${summary.activeArmoredCarTrips}-${storyTicks}`,
      category: 'mission',
      timestamp: currentTime,
      description: summary.activeArmoredCarTrips > 0
        ? `Active mission tracking ${summary.activeArmoredCarTrips} armored trip unit(s)`
        : 'No active mission movement detected',
    })

    if (summary.pendingGuardApprovals > 0 || summary.overdueFirearmReturns > 0) {
      events.push({
        id: `system-alert-${summary.pendingGuardApprovals}-${summary.overdueFirearmReturns}-${storyTicks}`,
        category: 'system',
        timestamp: currentTime,
        description: `System alert: ${summary.pendingGuardApprovals} pending approvals, ${summary.overdueFirearmReturns} overdue returns`,
      })
    }

    return events.slice(0, 10)
  }, [shiftsState.shifts, assetsState.vehicles, summary.firearmsCurrentlyIssued, summary.activeArmoredCarTrips, summary.pendingGuardApprovals, summary.overdueFirearmReturns, storyTicks])

  const serviceHealth = useMemo<ServiceHealthItem[]>(() => {
    return [
      {
        name: 'Database',
        status: serviceState.services.database,
        detail: serviceState.services.database === 'online' ? 'Database endpoint reachable' : 'Database endpoint unreachable',
      },
      {
        name: 'API Gateway',
        status: serviceState.services.apiGateway,
        detail: serviceState.services.apiGateway === 'online' ? 'Gateway responding to probes' : 'Gateway not responding',
      },
      {
        name: 'Monitoring Nodes',
        status: serviceState.services.monitoringNodes,
        detail: serviceState.services.monitoringNodes === 'online' ? 'Shift telemetry route reachable' : 'Shift telemetry route unreachable',
      },
      {
        name: 'Vehicle Telemetry',
        status: serviceState.services.vehicleTelemetry,
        detail: serviceState.services.vehicleTelemetry === 'online' ? 'Vehicle endpoint responding' : 'Vehicle endpoint unavailable',
      },
      {
        name: 'Authentication Service',
        status: serviceState.services.authenticationService,
        detail: serviceState.services.authenticationService === 'online' ? 'Auth-protected route reachable' : 'Auth route unavailable',
      },
    ]
  }, [serviceState.services])

  const missionTimeline = useMemo<MissionTimelineItem[]>(() => {
    const timeline: MissionTimelineItem[] = [
      {
        id: `mission-start-${storyTicks}`,
        title: 'Mission cycle started',
        detail: summary.activeArmoredCarTrips > 0
          ? `${summary.activeArmoredCarTrips} active trip unit(s) currently in the field.`
          : 'Mission unit is in standby preparation.',
        time: clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        state: summary.activeArmoredCarTrips > 0 ? 'active' : 'queued',
      },
      {
        id: `guard-stage-${summary.activeGuardsOnDuty}`,
        title: 'Guard deployment checkpoint',
        detail: `${summary.activeGuardsOnDuty} guards on-duty. ${summary.guardsAbsentToday} marked absent/no-show.`,
        time: staleNote,
        state: summary.guardsAbsentToday > 0 ? 'active' : 'completed',
      },
      {
        id: `equipment-stage-${summary.firearmsCurrentlyIssued}`,
        title: 'Equipment allocation sync',
        detail: `${summary.firearmsCurrentlyIssued} issued firearm(s) and ${summary.overdueFirearmReturns} overdue return(s).`,
        time: staleNote,
        state: summary.overdueFirearmReturns > 0 ? 'active' : 'completed',
      },
      {
        id: `mission-end-${summary.pendingGuardApprovals}`,
        title: 'Mission cycle completed',
        detail: summary.pendingGuardApprovals > 0
          ? `${summary.pendingGuardApprovals} pending guard approval task(s) queued post-mission.`
          : 'No pending approval tasks after completion cycle.',
        time: clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        state: summary.pendingGuardApprovals > 0 ? 'queued' : 'completed',
      },
    ]

    return timeline
  }, [storyTicks, summary.activeArmoredCarTrips, summary.activeGuardsOnDuty, summary.guardsAbsentToday, summary.firearmsCurrentlyIssued, summary.overdueFirearmReturns, summary.pendingGuardApprovals, staleNote, clock])

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

  return (
    <div className="space-y-6">
      <SectionPanel
        title="Security Operations Command Center"
        subtitle="Real-time situational overview for daily security operations"
        icon={<SentinelLogo size={22} variant="IconOnly" className="shrink-0" animated />}
        actions={<QuickActionsPanel actions={quickActions} />}
        collapsible
      >
        <OperationalSummaryStrip
          metrics={[
            { label: 'System Status', value: systemStatus, tone: systemTone, hint: staleNote },
            { label: 'Threat Level', value: threatLevel, tone: threatTone, hint: staleNote },
            { label: 'Active Guards', value: summary.activeGuardsOnDuty, tone: 'success', hint: staleNote },
            { label: 'Active Missions', value: summary.activeArmoredCarTrips, tone: 'info', hint: staleNote },
            { label: 'Alert Count', value: alerts.length, tone: alerts.length > 0 ? 'warning' : 'neutral', hint: staleNote },
            { label: 'Live Clock', value: clock.toLocaleTimeString(), tone: 'info', hint: 'Command time' },
          ]}
        />
      </SectionPanel>

      <section className="grid grid-cols-1 gap-6 2xl:grid-cols-12">
        <div className="space-y-6 2xl:col-span-4">
          <LiveOperationsFeed items={liveFeed} />
          <MissionTimelinePanel items={missionTimeline} />
          <SystemInfrastructureStatus services={serviceHealth} />
          <IncidentAlertFeed alerts={alerts} nowLabel={clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} />
        </div>

        <div className="space-y-6 2xl:col-span-8">
          <OperationalMapPlaceholder activeTrips={summary.activeArmoredCarTrips} activeGuards={summary.activeGuardsOnDuty} />

          <GuardDeploymentOverview shifts={shiftsState.shifts} />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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
          Command center loaded with partial data. Last service check: {serviceState.services.lastChecked}.
        </div>
      )}
    </div>
  )
}

export default CommandCenterDashboard
