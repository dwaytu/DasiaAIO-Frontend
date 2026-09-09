import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../utils/api'

export type VehicleRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export interface VehicleMaintenancePrediction {
  vehicleId: string
  licensePlate: string
  riskScore: number
  riskLevel: VehicleRiskLevel
  mileageSinceService: number
  daysSinceService: number
  maintenanceHistoryCount: number
  recommendedAction: string
  formula: string
  calculatedAt: string
}

interface UseVehicleMaintenancePredictionState {
  predictions: VehicleMaintenancePrediction[]
  loading: boolean
  error: string
  lastUpdated: string
  refresh: () => Promise<void>
}

export function useVehicleMaintenancePrediction(): UseVehicleMaintenancePredictionState {
  const [predictions, setPredictions] = useState<VehicleMaintenancePrediction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')
  const hasLoadedOnceRef = useRef(false)

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      if (!hasLoadedOnceRef.current) {
        setLoading(true)
      }
      const data = await fetchJsonOrThrow<VehicleMaintenancePrediction[]>(
        `${API_BASE_URL}/api/analytics/vehicle-maintenance-risk`,
        { headers: getAuthHeaders(), signal },
        'Failed to load vehicle maintenance risk',
      )

      setPredictions(Array.isArray(data) ? data : [])
      setError('')
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (err) {
      if (signal?.aborted) return
      setError(err instanceof Error ? err.message : 'Failed to load vehicle maintenance risk')
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

  return {
    predictions,
    loading,
    error,
    lastUpdated,
    refresh,
  }
}
