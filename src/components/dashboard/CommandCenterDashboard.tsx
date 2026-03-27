import { FC, useEffect, useMemo, useState } from 'react'
import { Activity, ShieldAlert, Siren, TimerReset } from 'lucide-react'
import SectionPanel from './SectionPanel'
import QuickActionsPanel, { QuickActionItem } from './QuickActionsPanel'
import OperationalSummaryStrip from './OperationalSummaryStrip'
import OperationalMap from './OperationalMap'
import GuardDeploymentOverview from './GuardDeploymentOverview'
import LiveOperationsFeed, { LiveFeedItem } from './LiveOperationsFeed'
import IncidentAlertFeed from './IncidentAlertFeed'
import PredictiveAlertsPanel from './PredictiveAlertsPanel'
import GuardAbsencePredictionPanel from './GuardAbsencePredictionPanel'
import ReplacementSuggestionPanel from './ReplacementSuggestionPanel'
import VehicleMaintenancePredictionPanel from './VehicleMaintenancePredictionPanel'
import IncidentSeverityMonitoringPanel from './IncidentSeverityMonitoringPanel'
import IncidentSeverityClassifier from './IncidentSeverityClassifier'
import IncidentSummaryGenerator from './IncidentSummaryGenerator'
import TodaysShiftOperations from './TodaysShiftOperations'
import FirearmsStatusPanel from './FirearmsStatusPanel'
import SystemStatusBanner from './SystemStatusBanner'
import SentinelLogo from '../SentinelLogo'
import SectionHeader from './ui/SectionHeader'
import StatCard from './ui/StatCard'
import StatusBadge from './ui/StatusBadge'
import LiveFreshnessPill from './ui/LiveFreshnessPill'
import { useOpsSummary } from '../../hooks/useOpsSummary'
import { getOpsAlerts } from '../../hooks/useOpsAlerts'
import { useOpsShifts } from '../../hooks/useOpsShifts'
import { useOpsAssets } from '../../hooks/useOpsAssets'
import { useServiceHealth } from '../../hooks/useServiceHealth'
import { useIncidents } from '../../hooks/useIncidents'
import { usePredictiveAlerts } from '../../hooks/usePredictiveAlerts'
import { useGuardAbsencePrediction } from '../../hooks/useGuardAbsencePrediction'
import { useReplacementSuggestions } from '../../hooks/useReplacementSuggestions'
import { useVehicleMaintenancePrediction } from '../../hooks/useVehicleMaintenancePrediction'

interface CommandCenterDashboardProps {
  quickActions: QuickActionItem[]
}

const CommandCenterDashboard: FC<CommandCenterDashboardProps> = ({ quickActions }) => {
  const summaryState = useOpsSummary()
  const shiftsState = useOpsShifts()
  const assetsState = useOpsAssets()
  const serviceState = useServiceHealth()
  const incidentsState = useIncidents()
  const predictiveAlertsState = usePredictiveAlerts()
  const guardAbsencePredictionState = useGuardAbsencePrediction()
  const replacementSuggestionsState = useReplacementSuggestions()
  const vehicleMaintenancePredictionState = useVehicleMaintenancePrediction()
  const [clock, setClock] = useState(() => new Date())
  const [lastRefreshAt, setLastRefreshAt] = useState<number>(() => Date.now())

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
      incidentsState.refresh()
      predictiveAlertsState.refresh()
      guardAbsencePredictionState.refresh()
      replacementSuggestionsState.refresh()
      vehicleMaintenancePredictionState.refresh()
      setLastRefreshAt(Date.now())
    }, 15000)

    return () => window.clearInterval(refresher)
  }, [summaryState.refresh, shiftsState.refresh, assetsState.refresh, incidentsState.refresh, predictiveAlertsState.refresh, guardAbsencePredictionState.refresh, replacementSuggestionsState.refresh, vehicleMaintenancePredictionState.refresh])

  const systemStatus = alerts.some((alert) => alert.severity === 'critical')
    ? 'Critical'
    : alerts.some((alert) => alert.severity === 'warning')
      ? 'Warning'
      : 'Operational'
  const systemHealthState = systemStatus.toLowerCase() as 'operational' | 'warning' | 'critical'
  const activeIncidents = incidentsState.activeCount > 0
    ? incidentsState.activeCount
    : alerts.filter((alert) => alert.severity === 'critical' || alert.severity === 'warning').length
  const guardsCapacity = Math.max(summary.activeGuardsOnDuty + summary.guardsAbsentToday, 1)
  const threatLevel = alerts.length >= 3 || summary.guardsAbsentToday > 0
    ? 'High'
    : alerts.length > 0 || summary.pendingGuardApprovals > 0
      ? 'Medium'
      : 'Low'
  const systemTone = systemStatus === 'Critical' ? 'danger' : systemStatus === 'Warning' ? 'warning' : 'success'
  const threatTone = threatLevel === 'High' ? 'danger' : threatLevel === 'Medium' ? 'warning' : 'info'

  const formatTime = (value: Date | string) =>
    new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const displayShifts = shiftsState.shifts
  const displayIncidents = incidentsState.incidents
  const displayGuardPredictions = guardAbsencePredictionState.predictions
  const displayReplacementSuggestions = replacementSuggestionsState.suggestions
  const displayVehiclePredictions = vehicleMaintenancePredictionState.predictions

  const liveOperationsItems = useMemo<LiveFeedItem[]>(() => {
    const items: LiveFeedItem[] = []

    displayShifts.slice(0, 4).forEach((shift: any, index: number) => {
      const guardName = shift.guard_name || shift.guard_username || 'Guard'
      const site = shift.client_site || 'assigned post'
      const status = (shift.status || '').toLowerCase()

      if (status === 'in_progress') {
        items.push({
          id: `shift-in-${shift.id || index}`,
          category: 'guard',
          timestamp: formatTime(shift.updated_at || clock),
          description: `${guardName} is currently deployed at ${site}.`,
        })
      } else if (status === 'scheduled') {
        items.push({
          id: `shift-sch-${shift.id || index}`,
          category: 'guard',
          timestamp: formatTime(shift.start_time || clock),
          description: `${guardName} scheduled for ${site}.`,
        })
      }
    })

    assetsState.vehicles.slice(0, 3).forEach((vehicle: any, index: number) => {
      const status = (vehicle.status || '').toLowerCase()
      const plate = vehicle.license_plate || vehicle.id || `Fleet-${index + 1}`
      if (status === 'dispatched' || status === 'on_mission' || status === 'active') {
        items.push({
          id: `veh-active-${vehicle.id || index}`,
          category: 'vehicle',
          timestamp: formatTime(clock),
          description: `Armored vehicle ${plate} is active in field operations.`,
        })
      }
    })

    displayIncidents.slice(0, 4).forEach((incident) => {
      items.push({
        id: `incident-${incident.id}`,
        category: incident.status === 'resolved' ? 'system' : 'mission',
        timestamp: formatTime(incident.created_at),
        description: `${incident.title} reported at ${incident.location}.`,
      })
    })

    assetsState.firearms.slice(0, 2).forEach((firearm: any, index: number) => {
      if ((firearm.status || '').toLowerCase() === 'issued') {
        items.push({
          id: `firearm-issued-${firearm.id || index}`,
          category: 'equipment',
          timestamp: formatTime(clock),
          description: `Firearm ${firearm.serial_number || firearm.id || 'asset'} is currently issued.`,
        })
      }
    })

    return items.slice(0, 12)
  }, [assetsState.firearms, assetsState.vehicles, clock, displayIncidents, displayShifts])

  const incidentAlerts = useMemo(() => {
    const incidentDriven = displayIncidents
      .filter((incident) => incident.status !== 'resolved')
      .slice(0, 4)
      .map((incident) => ({
        id: `incident-alert-${incident.id}`,
        severity: (incident.priority === 'critical'
          ? 'critical'
          : incident.priority === 'high'
            ? 'warning'
            : 'info') as 'critical' | 'warning' | 'info',
        title: incident.title,
        detail: `${incident.location} • ${incident.status.toUpperCase()}`,
      }))

    return [...incidentDriven, ...alerts].slice(0, 6)
  }, [alerts, displayIncidents])

  return (
    <main className="space-y-6" aria-label="Security operations command center overview">
      <section className="soc-surface p-4 md:p-5" aria-labelledby="command-center-title">
        <SectionHeader
          title="Security Operations Command Center"
          subtitle="Unified tactical view for incidents, deployments, and predictive risk activity."
          actions={
            <div className="flex items-center gap-2">
              <LiveFreshnessPill updatedAt={lastRefreshAt} label="SOC stream" />
              <StatusBadge label={`System ${systemStatus}`} tone={systemTone === 'danger' ? 'danger' : systemTone === 'warning' ? 'warning' : 'success'} />
              <StatusBadge label={`Threat ${threatLevel}`} tone={threatTone === 'danger' ? 'danger' : threatTone === 'warning' ? 'warning' : 'analytics'} />
            </div>
          }
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="System" value={systemStatus} tone="analytics" hint={staleNote} />
          <StatCard label="Threat" value={threatLevel} tone={threatLevel === 'High' ? 'maintenance' : threatLevel === 'Medium' ? 'vehicle' : 'guard'} hint={staleNote} />
          <StatCard label="Incidents" value={activeIncidents} tone="mission" hint="Open or active incident threads" />
          <StatCard label="Clock" value={clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} tone="default" hint="Command time" />
        </div>
      </section>

      <SystemStatusBanner
        status={systemHealthState}
        guardsActive={summary.activeGuardsOnDuty}
        guardsCapacity={guardsCapacity}
        activeIncidents={activeIncidents}
        firearmsCheckedOut={summary.firearmsCurrentlyIssued}
        vehiclesDeployed={summary.activeArmoredCarTrips}
      />

      <SectionPanel
        title="System Status"
        subtitle="Operational Summary, quick action controls, and current command posture"
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

      <SectionPanel
        title="Tactical View"
        subtitle="Live geospatial operations map and guard deployment grid"
        icon={<Activity className="h-4 w-4" aria-hidden="true" />}
      >
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <OperationalMap activeTrips={summary.activeArmoredCarTrips} activeGuards={summary.activeGuardsOnDuty} />
          <GuardDeploymentOverview shifts={displayShifts} />
        </div>
      </SectionPanel>

      <SectionPanel
        title="Live Operations"
        subtitle="Streaming feed, incident escalation, and AI-assisted incident triage"
        icon={<Siren className="h-4 w-4" aria-hidden="true" />}
      >
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <LiveOperationsFeed items={liveOperationsItems} />
          <IncidentAlertFeed
            alerts={incidentAlerts}
            nowLabel={clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          />
        </div>
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-4">
          <IncidentSeverityMonitoringPanel
            incidents={displayIncidents}
            loading={incidentsState.loading}
            error={incidentsState.error}
            lastUpdated={incidentsState.lastUpdated || staleNote}
          />
          <PredictiveAlertsPanel
            alerts={predictiveAlertsState.alerts}
            loading={predictiveAlertsState.loading}
            error={predictiveAlertsState.error}
            lastUpdated={predictiveAlertsState.lastUpdated || staleNote}
            title="AI Operational Insights"
            subtitle="Model-driven alerts and emerging risk vectors"
          />
          <IncidentSeverityClassifier incidents={displayIncidents} />
          <IncidentSummaryGenerator incidents={displayIncidents} />
        </div>
      </SectionPanel>

      <SectionPanel
        title="Operations Management"
        subtitle="Shift execution and staffing resilience with predictive staffing support"
        icon={<TimerReset className="h-4 w-4" aria-hidden="true" />}
      >
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <TodaysShiftOperations
            shifts={displayShifts}
            loading={shiftsState.loading}
            error={shiftsState.error}
            lastUpdated={shiftsState.lastUpdated || staleNote}
          />
          <GuardAbsencePredictionPanel
            predictions={displayGuardPredictions}
            loading={guardAbsencePredictionState.loading}
            error={guardAbsencePredictionState.error}
            lastUpdated={guardAbsencePredictionState.lastUpdated || staleNote}
          />
          <ReplacementSuggestionPanel
            postName={replacementSuggestionsState.postName}
            suggestions={displayReplacementSuggestions}
            loading={replacementSuggestionsState.loading}
            error={replacementSuggestionsState.error}
            lastUpdated={replacementSuggestionsState.lastUpdated || staleNote}
          />
        </div>
      </SectionPanel>

      <SectionPanel
        title="Asset Monitoring"
        subtitle="Maintenance outlook and firearm readiness across active operations"
        icon={<ShieldAlert className="h-4 w-4" aria-hidden="true" />}
      >
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <VehicleMaintenancePredictionPanel
            predictions={displayVehiclePredictions}
            loading={vehicleMaintenancePredictionState.loading}
            error={vehicleMaintenancePredictionState.error}
            lastUpdated={vehicleMaintenancePredictionState.lastUpdated || staleNote}
          />
          <FirearmsStatusPanel
            firearms={assetsState.firearms}
            loading={assetsState.loading}
            error={assetsState.error}
            lastUpdated={assetsState.lastUpdated || staleNote}
          />
        </div>
      </SectionPanel>

      {(summaryState.error || shiftsState.error || assetsState.error) && (
        <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-100">
          Command center loaded with partial data. Last service check: {serviceState.services.lastChecked}.
        </div>
      )}
    </main>
  )
}

export default CommandCenterDashboard
