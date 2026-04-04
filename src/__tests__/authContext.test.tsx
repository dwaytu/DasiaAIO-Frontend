jest.mock('../config', () => ({
  API_BASE_URL: 'https://backend-production-0c47.up.railway.app',
}))

jest.mock('../utils/api', () => ({
  clearAuthSession: jest.fn(),
  fetchJsonOrThrow: jest.fn(),
  getAuthToken: jest.fn(() => ''),
  getRefreshToken: jest.fn(() => ''),
  hydrateAuthSession: jest.fn(async () => {}),
  isAuthTokenExpired: jest.fn(() => false),
  refreshAuthSessionIfNeeded: jest.fn(async () => true),
  storeAuthSession: jest.fn(),
}))

import { render, act, renderHook } from '@testing-library/react'
import { AuthProvider, AuthContext } from '../context/AuthContext'
import type { AuthContextValue, User } from '../context/AuthContext'
import { useAuth } from '../hooks/useAuth'
import {
  clearAuthSession,
  storeAuthSession,
  getRefreshToken,
} from '../utils/api'

const mockedClearAuthSession = clearAuthSession as jest.Mock
const mockedStoreAuthSession = storeAuthSession as jest.Mock
const mockedGetRefreshToken = getRefreshToken as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
})

describe('AuthContext', () => {
  it('exports AuthProvider and AuthContext', () => {
    expect(AuthProvider).toBeDefined()
    expect(AuthContext).toBeDefined()
  })

  it('provides default auth state through useAuth', async () => {
    let result: AuthContextValue | undefined

    function Consumer() {
      result = useAuth()
      return null
    }

    await act(async () => {
      render(
        <AuthProvider>
          <Consumer />
        </AuthProvider>,
      )
    })

    expect(result).toBeDefined()
    expect(result!.user).toBeNull()
    expect(result!.isLoggedIn).toBe(false)
    expect(result!.isLoading).toBe(false)
    expect(result!.hasAcceptedToa).toBe(false)
    expect(result!.toaChecked).toBe(false)
    expect(result!.toaError).toBe('')
  })
})

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within an AuthProvider',
    )
    spy.mockRestore()
  })

  it('returns all interface members', async () => {
    let result: AuthContextValue | undefined

    function Consumer() {
      result = useAuth()
      return null
    }

    await act(async () => {
      render(
        <AuthProvider>
          <Consumer />
        </AuthProvider>,
      )
    })

    expect(typeof result!.login).toBe('function')
    expect(typeof result!.logout).toBe('function')
    expect(typeof result!.acceptToa).toBe('function')
    expect(typeof result!.declineToa).toBe('function')
    expect(typeof result!.setToaChecked).toBe('function')
    expect(typeof result!.setToaError).toBe('function')
  })
})

describe('login', () => {
  it('stores auth session and sets user state', async () => {
    let auth: AuthContextValue | undefined

    function Consumer() {
      auth = useAuth()
      return null
    }

    await act(async () => {
      render(
        <AuthProvider>
          <Consumer />
        </AuthProvider>,
      )
    })

    act(() => {
      auth!.login(
        { id: '1', email: 'test@test.com', username: 'tester', role: 'guard' } as User,
        'access-token-123',
        'refresh-token-456',
      )
    })

    expect(mockedStoreAuthSession).toHaveBeenCalledWith('access-token-123', 'refresh-token-456')
    expect(auth!.user).not.toBeNull()
    expect(auth!.user!.username).toBe('tester')
    expect(auth!.user!.role).toBe('guard')
    expect(auth!.isLoggedIn).toBe(true)
    expect(localStorage.getItem('user')).toBeTruthy()
  })

  it('rejects invalid roles', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    let auth: AuthContextValue | undefined

    function Consumer() {
      auth = useAuth()
      return null
    }

    await act(async () => {
      render(
        <AuthProvider>
          <Consumer />
        </AuthProvider>,
      )
    })

    act(() => {
      auth!.login(
        { id: '1', email: 'test@test.com', username: 'tester', role: 'hacker' as any },
        'tok',
        'ref',
      )
    })

    expect(auth!.isLoggedIn).toBe(false)
    expect(auth!.user).toBeNull()
    spy.mockRestore()
  })
})

describe('logout', () => {
  it('clears auth state and calls clearAuthSession', async () => {
    const previousFetch = globalThis.fetch
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true })
    mockedGetRefreshToken.mockReturnValue('rt-123')

    let auth: AuthContextValue | undefined

    function Consumer() {
      auth = useAuth()
      return null
    }

    await act(async () => {
      render(
        <AuthProvider>
          <Consumer />
        </AuthProvider>,
      )
    })

    act(() => {
      auth!.login(
        { id: '1', email: 'a@b.com', username: 'u', role: 'admin' } as User,
        'at',
        'rt',
      )
    })

    expect(auth!.isLoggedIn).toBe(true)

    await act(async () => {
      await auth!.logout()
    })

    expect(auth!.isLoggedIn).toBe(false)
    expect(auth!.user).toBeNull()
    expect(mockedClearAuthSession).toHaveBeenCalled()

    globalThis.fetch = previousFetch
  })
})

describe('declineToa', () => {
  it('clears auth and sets error message', async () => {
    let auth: AuthContextValue | undefined

    function Consumer() {
      auth = useAuth()
      return null
    }

    await act(async () => {
      render(
        <AuthProvider>
          <Consumer />
        </AuthProvider>,
      )
    })

    act(() => {
      auth!.login(
        { id: '1', email: 'a@b.com', username: 'u', role: 'guard' } as User,
        'at',
        'rt',
      )
    })

    act(() => {
      auth!.declineToa()
    })

    expect(auth!.isLoggedIn).toBe(false)
    expect(auth!.user).toBeNull()
    expect(auth!.toaError).toContain('Terms of Agreement')
  })
})

describe('acceptToa', () => {
  it('requires toaChecked before accepting', async () => {
    let auth: AuthContextValue | undefined

    function Consumer() {
      auth = useAuth()
      return null
    }

    await act(async () => {
      render(
        <AuthProvider>
          <Consumer />
        </AuthProvider>,
      )
    })

    await act(async () => {
      await auth!.acceptToa()
    })

    expect(auth!.toaError).toContain('read and agree')
  })
})

describe('token expiry', () => {
  it('clears auth state on auth:token-expired event', async () => {
    let auth: AuthContextValue | undefined

    function Consumer() {
      auth = useAuth()
      return null
    }

    await act(async () => {
      render(
        <AuthProvider>
          <Consumer />
        </AuthProvider>,
      )
    })

    act(() => {
      auth!.login(
        { id: '1', email: 'a@b.com', username: 'u', role: 'guard' } as User,
        'at',
        'rt',
      )
    })

    expect(auth!.isLoggedIn).toBe(true)

    act(() => {
      window.dispatchEvent(
        new CustomEvent('auth:token-expired', { detail: { message: 'expired' } }),
      )
    })

    expect(auth!.isLoggedIn).toBe(false)
    expect(auth!.user).toBeNull()
    expect(mockedClearAuthSession).toHaveBeenCalled()
  })
})
