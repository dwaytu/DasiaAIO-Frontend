import { useCallback, useEffect, useState } from 'react'
import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow } from '../utils/api'

export function useOpsAssets() {
  const [firearms, setFirearms] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const headers = { Authorization: `Bearer ${token}` }

      const [firearmsRes, vehiclesRes] = await Promise.allSettled([
        fetchJsonOrThrow<any>(`${API_BASE_URL}/api/firearms`, { headers }, 'Failed to load firearms'),
        fetchJsonOrThrow<any>(`${API_BASE_URL}/api/armored-cars`, { headers }, 'Failed to load vehicles'),
      ])

      const firearmData = firearmsRes.status === 'fulfilled' ? firearmsRes.value : []
      const vehicleData = vehiclesRes.status === 'fulfilled' ? vehiclesRes.value : []

      setFirearms(Array.isArray(firearmData) ? firearmData : firearmData.firearms || [])
      setVehicles(Array.isArray(vehicleData) ? vehicleData : vehicleData.armored_cars || vehicleData.vehicles || [])
      setError('')
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assets')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { firearms, vehicles, loading, error, lastUpdated, refresh }
}
