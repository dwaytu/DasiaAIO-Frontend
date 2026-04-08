import { FC, useCallback, useEffect, useMemo, useState } from 'react'
import { OperationalEventProvider } from '../../context/OperationalEventContext'
import { ShieldAlert, Siren, TimerReset } from 'lucide-react'
import SectionPanel from './SectionPanel'
import QuickActionsPanel, { QuickActionItem } from './QuickActionsPanel'
import OperationalSummaryStrip from './OperationalSummaryStrip'

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
import SectionHeader from './ui/SectionHeader'
import StatusBadge from './ui/StatusBadge'
import LiveFreshnessPill from './ui/LiveFreshnessPill'
import MetricStatCard from './ui/MetricStatCard'
import { DashboardLoadingState } from './ui/DashboardLoadingState'
import { formatCompactNumber, formatRatioLabel } from '../../utils/numberFormat'
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

const humanizeStatus = (status: string): string => {
  const map: Record<string, string> = {
    open: 'Open',
    investigating: 'Under Investigation',
    resolved: 'Resolved',
    closed: 'Closed',
    pending: 'Pending Review',
  }
  return map[status?.toLowerCase()] || status
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
  const [dismissedFeedIds, setDismissedFeedIds] = useState<Set<string>>(new Set())

  const summary = summaryState.summary
  const alerts = useMemo(() => getOpsAlerts(summary), [summary])
  const now = summaryState.lastUpdated || '--'
  const staleNote = `Last updated ${now}`
  const isBootstrapping =
    summaryState.loading &&
    shiftsState.loading &&
    assetsState.loading &&
    incidentsState.loading &&
    predictiveAlertsState.loading

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let isCancelled = false

    const runRefreshCycle = async () => {
      const refreshTasks: Array<() => Promise<void> | void> = [
        summaryState.refresh,
        shiftsState.refresh,
        assetsState.refresh,
        incidentsState.refresh,
        predictiveAlertsState.refresh,
        guardAbsencePredictionState.refresh,
        replacementSuggestionsState.refresh,
        vehicleMaintenancePredictionState.refresh,
      ]

      for (const refreshTask of refreshTasks) {
        if (isCancelled) return
        try {
          await Promise.resolve(refreshTask())
        } catch {
          // Individual modules already surface their own error state.
        }
      }

      if (!isCancelled) {
        setLastRefreshAt(Date.now())
      }
    }

    const refresher = window.setInterval(() => {
      void runRefreshCycle()
    }, 15000)

    return () => {
      isCancelled = true
      window.clearInterval(refresher)
    }
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
  const onlineServices = Object.values(serviceState.services).filter((status) => status === 'online').length
  const totalServices = Object.keys(serviceState.services).length

  const formatTime = (value: Date | string) =>
    new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const displayShifts = shiftsState.shifts
  const displayIncidents = incidentsState.incidents
  const displayGuardPredictions = guardAbsencePredictionState.predictions
  const displayReplacementSuggestions = replacementSuggestionsState.suggestions
  const displayVehiclePredictions = vehicleMaintenancePredictionState.predictions

  const handleDismissFeedItem = useCallback((itemId: string) => {
    setDismissedFeedIds((previous) => {
      const next = new Set(previous)
      next.add(itemId)
      return next
    })
  }, [])

  const handleIncidentStatusUpdate = useCallback(async (incidentId: string, status: 'investigating' | 'resolved') => {
    await incidentsState.updateStatus(incidentId, status)
  }, [incidentsState.updateStatus])

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

  const visibleLiveOperationsItems = useMemo(
    () => liveOperationsItems.filter((item) => !dismissedFeedIds.has(item.id)),
    [dismissedFeedIds, liveOperationsItems],
  )

  const incidentAlerts = useMemo(() => {
    const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 }

    const incidentDriven = displayIncidents
      .filter((incident) => incident.status !== 'resolved')
      .map((incident) => ({
        id: `incident-alert-${incident.id}`,
        incidentId: incident.id,
        severity: (incident.priority === 'critical'
          ? 'critical'
          : incident.priority === 'high'
            ? 'warning'
            : 'info') as 'critical' | 'warning' | 'info',
        title: incident.title,
        detail: `${incident.location} - ${humanizeStatus(incident.status)}`,
        createdAt: incident.created_at || '',
        isPanic: incident.title?.includes('SOS EMERGENCY') ?? false,
      }))

    const combined = [...incidentDriven, ...alerts.map(a => ({ ...a, createdAt: a.createdAt ?? '', isPanic: a.isPanic ?? false }))]

    combined.sort((a, b) => {
      if (a.isPanic && !b.isPanic) return -1
      if (!a.isPanic && b.isPanic) return 1
      const sevDiff = (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2)
      if (sevDiff !== 0) return sevDiff
      if (a.createdAt && b.createdAt) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      return 0
    })

    return combined.slice(0, 25)
  }, [alerts, displayIncidents])

  if (isBootstrapping) {
    return (
      <DashboardLoadingState
        title="Security Operations Command Center"
        subtitle="Unified tactical view for incidents, deployments, and predictive risk activity."
        heroCards={4}
        lowerSections={2}
      />
    )
  }

  return (
    <OperationalEventProvider>
      <main className="space-y-4" aria-label="Security operations command center overview">
      <SystemStatusBanner
        status={systemHealthState}
        guardsActive={summary.activeGuardsOnDuty}
        guardsCapacity={guardsCapacity}
        activeIncidents={activeIncidents}
        firearmsCheckedOut={summary.firearmsCurrentlyIssued}
        vehiclesDeployed={summary.activeArmoredCarTrips}
      />

      <section className="animate-section-enter soc-surface p-4 md:p-5" aria-labelledby="command-center-title">
        <SectionHeader
          title="Security Operations Command Center"
          subtitle="Unified tactical view for incidents, deployments, and predictive risk activity."
          actions={
            <div className="flex items-center gap-2">
              <LiveFreshnessPill updatedAt={lastRefreshAt} label="SOC stream" />
              <StatusBadge label={`System ${systemStatus}`} tone={systemTone === 'danger' ? 'danger' : systemTone === 'warning' ? 'warning' : 'success'} />
              <StatusBadge label={`Threat ${threatLevel}`} tone={threatTone === 'danger' ? 'danger' : threatTone === 'warning' ? 'warning' : 'success'} />
            </div>
          }
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricStatCard
            label="System"
            value={systemStatus}
            tone="analytics"
            hint={staleNote}
            meter={{
              value: onlineServices,
              max: totalServices,
              label: formatRatioLabel(onlineServices, totalServices, 'services online'),
            }}
          />
          <MetricStatCard
            label="Threat"
            value={threatLevel}
            tone={threatLevel === 'High' ? 'maintenance' : threatLevel === 'Medium' ? 'vehicle' : 'guard'}
            hint={`${formatCompactNumber(alerts.length)} active alerts`}
          />
          <MetricStatCard
            label="Incidents"
            value={formatCompactNumber(activeIncidents)}
            tone="mission"
            hint="Open or active incident threads"
            meter={{
              value: activeIncidents,
              max: Math.max(summary.activeGuardsOnDuty, 1),
              label: `${formatCompactNumber(summary.activeGuardsOnDuty)} active guards covering the field`,
            }}
          />
          <MetricStatCard
            label="Clock"
            value={clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            tone="default"
            hint="Command time"
          />
        </div>

        <div className="mt-4 border-t border-border-subtle pt-4">
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-text-tertiary">Quick Actions</h4>
          <QuickActionsPanel actions={quickActions} />
        </div>

        <div className="mt-4">
          <OperationalSummaryStrip
            metrics={[
              { label: 'Active Guards', value: summary.activeGuardsOnDuty, tone: 'success', hint: staleNote },
              { label: 'Active Missions', value: summary.activeArmoredCarTrips, tone: 'info', hint: staleNote },
              { label: 'Alert Count', value: alerts.length, tone: alerts.length > 0 ? 'warning' : 'neutral', hint: staleNote },
            ]}
          />
        </div>
      </section>

      <SectionPanel
        title="Live Operations"
        subtitle="Streaming feed, incident escalation, and AI-assisted incident triage"
        icon={<Siren className="h-4 w-4" aria-hidden="true" />}
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <LiveOperationsFeed
            items={visibleLiveOperationsItems}
            onDismiss={handleDismissFeedItem}
            onUpdateIncidentStatus={handleIncidentStatusUpdate}
          />
          <IncidentAlertFeed
            alerts={incidentAlerts}
            nowLabel={clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            onUpdateStatus={handleIncidentStatusUpdate}
          />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:grid-flow-dense xl:grid-cols-4">
          <IncidentSeverityMonitoringPanel
            incidents={displayIncidents}
            loading={incidentsState.loading}
            error={incidentsState.error}
            lastUpdated={incidentsState.lastUpdated || staleNote}
          />
          <div className="sm:col-span-2 xl:col-span-1">
            <PredictiveAlertsPanel
              alerts={predictiveAlertsState.alerts}
              loading={predictiveAlertsState.loading}
              error={predictiveAlertsState.error}
              lastUpdated={predictiveAlertsState.lastUpdated || staleNote}
              title="AI Operational Insights"
              subtitle="Model-driven alerts and emerging risk vectors"
            />
          </div>
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
        <div className="rounded border border-warning-border bg-warning-bg p-3 text-sm text-warning-text" role="status" aria-live="polite">
          Command center loaded with partial data. Last service check: {serviceState.services.lastChecked}.
        </div>
      )}
      </main>
    </OperationalEventProvider>
  )
}

export default CommandCenterDashboard
