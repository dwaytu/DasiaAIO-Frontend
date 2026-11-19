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
  checkedAt: number | null
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
  checkedAt: null,
}

async function probe(url: string, signal?: AbortSignal): Promise<ProbeResult> {
  if (signal?.aborted) return { reachable: false }

  const controller = new AbortController()
  const abort = () => controller.abort()
  const timeout = window.setTimeout(abort, 5000)
  signal?.addEventListener('abort', abort, { once: true })

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    })

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
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}

export function useServiceHealth() {
  const [services, setServices] = useState<ServiceHealthResult>(initialState)

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const healthProbe = await probe(`${API_BASE_URL}/api/health/system`, signal)
    if (signal?.aborted) return
    const servicesPayload = healthProbe.payload?.services
    const databaseOnline = servicesPayload?.database === 'up'
    const apiOnline = servicesPayload?.api === 'up'
    const websocketOnline = servicesPayload?.websocket?.status === 'up'
    const checkedAt = Date.now()

    setServices({
      database: healthProbe.reachable && databaseOnline ? 'online' : 'offline',
      apiGateway: healthProbe.reachable && apiOnline ? 'online' : 'offline',
      monitoringNodes: healthProbe.reachable && websocketOnline ? 'online' : 'offline',
      vehicleTelemetry: healthProbe.reachable && websocketOnline ? 'online' : 'offline',
      authenticationService: healthProbe.reachable && apiOnline ? 'online' : 'offline',
      lastChecked: new Date(checkedAt).toLocaleTimeString(),
      checkedAt: healthProbe.reachable && servicesPayload ? checkedAt : null,
    })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void refresh(controller.signal)
    const id = window.setInterval(() => void refresh(controller.signal), 15000)
    return () => {
      controller.abort()
      window.clearInterval(id)
    }
  }, [refresh])

  return { services, refresh }
}
