import { useCallback, useEffect, useState } from 'react'
import { API_BASE_URL } from '../config'

export type BinaryServiceStatus = 'online' | 'offline'

export interface ServiceHealthResult {
  database: BinaryServiceStatus
  apiGateway: BinaryServiceStatus
  monitoringNodes: BinaryServiceStatus
  vehicleTelemetry: BinaryServiceStatus
  authenticationService: BinaryServiceStatus
  lastChecked: string
}

interface ProbeResult {
  reachable: boolean
}

const initialState: ServiceHealthResult = {
  database: 'offline',
  apiGateway: 'offline',
  monitoringNodes: 'offline',
  vehicleTelemetry: 'offline',
  authenticationService: 'offline',
  lastChecked: '--',
}

async function probe(url: string, headers: Record<string, string> = {}): Promise<ProbeResult> {
  try {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 5000)

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    })

    window.clearTimeout(timeout)

    // Any non-5xx response confirms service is reachable.
    return { reachable: response.status < 500 }
  } catch {
    return { reachable: false }
  }
}

export function useServiceHealth() {
  const [services, setServices] = useState<ServiceHealthResult>(initialState)

  const refresh = useCallback(async () => {
    const token = localStorage.getItem('token')
    const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

    const [healthProbe, monitoringProbe, vehiclesProbe, authProbe] = await Promise.all([
      probe(`${API_BASE_URL}/api/health`),
      probe(`${API_BASE_URL}/api/guard-replacement/shifts`, authHeaders),
      probe(`${API_BASE_URL}/api/armored-cars`, authHeaders),
      probe(`${API_BASE_URL}/api/users/pending-approvals`, authHeaders),
    ])

    setServices({
      database: healthProbe.reachable ? 'online' : 'offline',
      apiGateway: healthProbe.reachable ? 'online' : 'offline',
      monitoringNodes: monitoringProbe.reachable ? 'online' : 'offline',
      vehicleTelemetry: vehiclesProbe.reachable ? 'online' : 'offline',
      authenticationService: authProbe.reachable ? 'online' : 'offline',
      lastChecked: new Date().toLocaleTimeString(),
    })
  }, [])

  useEffect(() => {
    refresh()
    const id = window.setInterval(refresh, 15000)
    return () => window.clearInterval(id)
  }, [refresh])

  return { services, refresh }
}
