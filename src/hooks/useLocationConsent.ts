import { useContext } from 'react'
import { LocationContext } from '../context/LocationContext'
import type { LocationContextValue } from '../context/LocationContext'

export function useLocationConsent(): LocationContextValue {
  const context = useContext(LocationContext)
  if (!context) {
    throw new Error('useLocationConsent must be used within a LocationProvider')
  }
  return context
}
