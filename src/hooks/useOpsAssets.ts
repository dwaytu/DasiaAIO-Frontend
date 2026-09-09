import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'

export function useOpsAssets() {
  const [firearms, setFirearms] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')
  const hasLoadedOnceRef = useRef(false)

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      if (!hasLoadedOnceRef.current) {
        setLoading(true)
      }
      const headers = getAuthHeaders()

      const [firearmsRes, vehiclesRes] = await Promise.allSettled([
        fetchJsonOrThrow<any>(`${API_BASE_URL}/api/firearms`, { headers, signal }, 'Failed to load firearms'),
        fetchJsonOrThrow<any>(`${API_BASE_URL}/api/armored-cars`, { headers, signal }, 'Failed to load vehicles'),
      ])

      if (signal?.aborted) return

      const firearmData = firearmsRes.status === 'fulfilled' ? firearmsRes.value : []
      const vehicleData = vehiclesRes.status === 'fulfilled' ? vehiclesRes.value : []

      setFirearms(Array.isArray(firearmData) ? firearmData : firearmData.firearms || [])
      setVehicles(Array.isArray(vehicleData) ? vehicleData : vehicleData.armored_cars || vehicleData.vehicles || [])
      setError('')
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (err) {
      if (signal?.aborted) return
      setError(err instanceof Error ? err.message : 'Failed to load assets')
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
        hasLoadedOnceRef.current = true
      }
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void refresh(controller.signal)
    return () => controller.abort()
  }, [refresh])

  return { firearms, vehicles, loading, error, lastUpdated, refresh }
}
