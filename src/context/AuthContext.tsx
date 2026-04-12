import { createContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { API_BASE_URL } from '../config'
import { sanitizeErrorMessage } from '../utils/sanitize'
import { normalizeRole, isLegacyRole, Role } from '../types/auth'
import {
  clearAuthSession,
  fetchJsonOrThrow,
  getAuthToken,
  getRefreshToken,
  hydrateAuthSession,
  isAuthTokenExpired,
  refreshAuthSessionIfNeeded,
  storeAuthSession,
} from '../utils/api'
import { useSessionSync } from '../hooks/useSessionSync'

export interface User {
  id: string
  email: string
  username: string
  role: Role
  [key: string]: any
}

type LegalConsentResponse = {
  consentAcceptedAt?: string
  consentVersion?: string
  token?: string
  refreshToken?: string
  legalConsentAccepted?: boolean
}

const TOA_ACCEPTANCE_KEY = 'dasi.toa.accepted.v1'
const TOA_ACCEPTANCE_VALUE = 'accepted'

function hasServerLegalConsent(currentUser: User | null): boolean {
  if (!currentUser) return false
  if (currentUser.legalConsentAccepted === true) return true
  return Boolean(currentUser.consentAcceptedAt)
}

export interface AuthContextValue {
  user: User | null
  isLoggedIn: boolean
  isLoading: boolean
  hasAcceptedToa: boolean
  toaChecked: boolean
  toaError: string
  login: (userData: User, accessToken: string, refreshToken: string) => void
  logout: () => Promise<void>
  acceptToa: () => Promise<boolean>
  declineToa: () => void
  setToaChecked: (checked: boolean) => void
  setToaError: (error: string) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasAcceptedToa, setHasAcceptedToa] = useState(false)
  const [toaChecked, setToaChecked] = useState(false)
  const [toaError, setToaError] = useState('')

  // Clears all local auth state without making an API call.
  // Used by both the local logout path and the cross-tab remote-logout handler.
  const clearAuthState = useCallback(() => {
    clearAuthSession()
    localStorage.removeItem('user')
    setUser(null)
    setIsLoggedIn(false)
    setHasAcceptedToa(false)
  }, [])

  // No-op: a login signal from another tab means that tab is now authenticated.
  // The current tab's token will still be valid; no action needed here.
  const handleRemoteLogin = useCallback(() => {}, [])

  const { broadcastLogout, broadcastLogin } = useSessionSync(clearAuthState, handleRemoteLogin)

  useEffect(() => {
    const restoreAuth = async () => {
      try {
        setHasAcceptedToa(false)

        await hydrateAuthSession()
        const storedUser = localStorage.getItem('user')
        const storedToken = getAuthToken()

        if (storedUser && storedToken) {
          const sessionReady = await refreshAuthSessionIfNeeded()
          const activeToken = getAuthToken()

          if (!sessionReady || !activeToken || isAuthTokenExpired(activeToken)) {
            clearAuthSession()
            localStorage.removeItem('user')
            setUser(null)
            setIsLoggedIn(false)
            setHasAcceptedToa(false)
            return
          }

          const parsedUser = JSON.parse(storedUser) as User
          const normalizedRole = normalizeRole(parsedUser.role)
          if (normalizedRole == null) {
            clearAuthSession()
            localStorage.removeItem('user')
            setUser(null)
            setIsLoggedIn(false)
            setHasAcceptedToa(false)
            return
          }

          parsedUser.role = normalizedRole
          setUser(parsedUser)
          setIsLoggedIn(true)
          setHasAcceptedToa(hasServerLegalConsent(parsedUser))
        }
      } catch (error) {
        console.error('Failed to restore authentication:', error)
        clearAuthSession()
        localStorage.removeItem('user')
        setHasAcceptedToa(false)
      } finally {
        setIsLoading(false)
      }
    }

    void restoreAuth()
  }, [])

  useEffect(() => {
    const handleTokenExpiry = () => {
      clearAuthSession()
      localStorage.removeItem('user')
      setUser(null)
      setIsLoggedIn(false)
    }

    window.addEventListener('auth:token-expired', handleTokenExpiry)
    return () => {
      window.removeEventListener('auth:token-expired', handleTokenExpiry)
    }
  }, [])

  const login = (userData: User, accessToken: string, refreshToken: string) => {
    if (!isLegacyRole(userData.role)) {
      console.error('Invalid role:', userData.role)
      return
    }

    const normalizedRole = normalizeRole(userData.role)
    if (normalizedRole == null) {
      console.error('Invalid normalized role:', userData.role)
      return
    }

    storeAuthSession(accessToken, refreshToken)

    const typedUser: User = {
      ...userData,
      role: normalizedRole,
    }

    localStorage.setItem('user', JSON.stringify(typedUser))
    setUser(typedUser)
    setIsLoggedIn(true)
    setHasAcceptedToa(hasServerLegalConsent(typedUser))
    broadcastLogin()
  }

  const logout = async () => {
    broadcastLogout()

    const currentRefreshToken = getRefreshToken()
    if (currentRefreshToken) {
      try {
        await fetch(`${API_BASE_URL}/api/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: currentRefreshToken }),
        })
      } catch {
        // Server logout is best-effort
      }
    }

    clearAuthState()
  }

  const acceptToa = async () => {
    if (!toaChecked) {
      setToaError('Please confirm that you have read and agree to the Terms of Agreement.')
      return false
    }

    if (!user) {
      setToaError('No active user session was found. Please log in again.')
      return false
    }

    const sessionReady = await refreshAuthSessionIfNeeded()
    const activeToken = getAuthToken()
    if (!sessionReady || !activeToken || isAuthTokenExpired(activeToken)) {
      clearAuthSession()
      localStorage.removeItem('user')
      setUser(null)
      setIsLoggedIn(false)
      setHasAcceptedToa(false)
      setToaError('Session expired. Please log in again.')
      return false
    }

    try {
      const consent = await fetchJsonOrThrow<LegalConsentResponse>(
        `${API_BASE_URL}/api/legal/consent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            termsAccepted: true,
            privacyAccepted: true,
            acceptableUseAccepted: true,
            consentVersion: '2026-03-28',
          }),
        },
        'Failed to record legal consent',
      )

      if (consent.token) {
        storeAuthSession(consent.token, consent.refreshToken)
      }

      const updatedUser: User = {
        ...user,
        legalConsentAccepted: true,
        consentAcceptedAt: consent.consentAcceptedAt || new Date().toISOString(),
        consentVersion: consent.consentVersion || '2026-03-28',
      }

      localStorage.setItem('user', JSON.stringify(updatedUser))
      setUser(updatedUser)
    } catch (error) {
      const message =
        sanitizeErrorMessage(error instanceof Error ? error.message : 'Failed to record legal consent. Please try again.')
      setToaError(message)
      return false
    }

    localStorage.setItem(TOA_ACCEPTANCE_KEY, TOA_ACCEPTANCE_VALUE)
    setHasAcceptedToa(true)
    setToaError('')
    return true
  }

  const declineToa = () => {
    clearAuthSession()
    localStorage.removeItem('user')
    setUser(null)
    setIsLoggedIn(false)
    setToaError('You must agree to the Terms of Agreement to use SENTINEL.')
  }

  const value: AuthContextValue = {
    user,
    isLoggedIn,
    isLoading,
    hasAcceptedToa,
    toaChecked,
    toaError,
    login,
    logout,
    acceptToa,
    declineToa,
    setToaChecked,
    setToaError,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
