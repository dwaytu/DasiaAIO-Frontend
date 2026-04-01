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
  payload?: any
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

    if (response.status >= 500) {
      return { reachable: false }
    }

    let payload: any = null
    try {
      payload = await response.json()
    } catch {
      payload = null
    }

    return { reachable: true, payload }
  } catch {
    return { reachable: false }
  }
}

export function useServiceHealth() {
  const [services, setServices] = useState<ServiceHealthResult>(initialState)

  const refresh = useCallback(async () => {
    const healthProbe = await probe(`${API_BASE_URL}/api/health/system`)
    const servicesPayload = healthProbe.payload?.services || {}
    const databaseOnline = servicesPayload?.database === 'up'
    const apiOnline = servicesPayload?.api === 'up'
    const websocketOnline = servicesPayload?.websocket?.status === 'up'

    setServices({
      database: healthProbe.reachable && databaseOnline ? 'online' : 'offline',
      apiGateway: healthProbe.reachable && apiOnline ? 'online' : 'offline',
      monitoringNodes: healthProbe.reachable && websocketOnline ? 'online' : 'offline',
      vehicleTelemetry: healthProbe.reachable && websocketOnline ? 'online' : 'offline',
      authenticationService: healthProbe.reachable && apiOnline ? 'online' : 'offline',
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
