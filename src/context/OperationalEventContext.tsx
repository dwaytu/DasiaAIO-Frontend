import React, { createContext, useContext, useState } from 'react'

export interface OperationalEvent {
  id: string
  type: 'incident' | 'alert' | 'guard' | 'vehicle'
  title: string
  detail?: string
}

export interface OperationalEventContextValue {
  selectedEventId: string | null
  selectedEvent: OperationalEvent | null
  selectEvent: (event: OperationalEvent | null) => void
  clearSelection: () => void
}

export const OperationalEventContext = createContext<OperationalEventContextValue | undefined>(undefined)

interface OperationalEventProviderProps {
  children: React.ReactNode
}

export const OperationalEventProvider: React.FC<OperationalEventProviderProps> = ({ children }) => {
  const [selectedEvent, setSelectedEvent] = useState<OperationalEvent | null>(null)

  const selectEvent = (event: OperationalEvent | null) => setSelectedEvent(event)
  const clearSelection = () => setSelectedEvent(null)

  const value: OperationalEventContextValue = {
    selectedEventId: selectedEvent?.id ?? null,
    selectedEvent,
    selectEvent,
    clearSelection,
  }

  return (
    <OperationalEventContext.Provider value={value}>
      {children}
    </OperationalEventContext.Provider>
  )
}

export const useOperationalEvent = (): OperationalEventContextValue => {
  const context = useContext(OperationalEventContext)
  if (context === undefined) {
    throw new Error('useOperationalEvent must be used within an OperationalEventProvider')
  }
  return context
}
