import { useState, FC, FormEvent, ChangeEvent } from 'react'
import SentinelLogo from './SentinelLogo'
import ParticleBackground from './ParticleBackground'
import type { User } from '../context/AuthContext'
import { API_BASE_URL } from '../config'
import { parseResponseBody, storeAuthSession } from '../utils/api'

interface LoginPageProps {
  onLogin: (user: User) => void
}

function isStrongPassword(password: string): boolean {
  if (password.length < 12) return false
  if (!/[a-z]/.test(password)) return false
  if (!/[A-Z]/.test(password)) return false
  if (!/\d/.test(password)) return false
  return /[^A-Za-z0-9]/.test(password)
}

const LoginPage: FC<LoginPageProps> = ({ onLogin }) => {
  const [identifier, setIdentifier] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [requiresVerification, setRequiresVerification] = useState<boolean>(false)
  const [verificationCode, setVerificationCode] = useState<string>('')
  const [verificationEmail, setVerificationEmail] = useState<string>('')
  const [forgotPasswordMode, setForgotPasswordMode] = useState<'email' | 'code' | 'newPassword' | null>(null)
  const [resetEmail, setResetEmail] = useState<string>('')
  const [resetCode, setResetCode] = useState<string>('')
  const [newPassword, setNewPassword] = useState<string>('')
  const [confirmPassword, setConfirmPassword] = useState<string>('')

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      if (requiresVerification) {
        if (!verificationCode) {
          setError('Please enter the verification code')
          setIsLoading(false)
          return
        }

        const response = await fetch(`${API_BASE_URL}/api/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: verificationEmail, code: verificationCode })
        })

        const data = await parseResponseBody(response)

        if (!response.ok) {
          setError(data.error || 'Verification failed')
          setIsLoading(false)
          return
        }

        setError('Email verified! You can now login.')
        setRequiresVerification(false)
        setVerificationCode('')
        setVerificationEmail('')
        setIsLoading(false)
        return
      }

      if (!identifier || !password) {
        setError('Email, username, phone number, and password are required')
        setIsLoading(false)
        return
      }

      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      })

      const data = await parseResponseBody(response)

      if (!response.ok) {
        if (data.requiresVerification) {
          setRequiresVerification(true)
          setVerificationEmail(identifier)
          setError('Please verify your email first. Check your email for the confirmation code.')
          setPassword('')
          setIsLoading(false)
          return
        }
        setError(data.error || 'Login failed')
        setIsLoading(false)
        return
      }

      setIsLoading(false)
      const user: User = {
        ...data.user,
        role: data.user.role as 'superadmin' | 'admin' | 'supervisor' | 'guard' | 'user'
      }
      if (data.token) {
        storeAuthSession(data.token, data.refreshToken)
      }
      onLogin(user)
    } catch (err) {
      setError('Error: ' + (err instanceof Error ? err.message : String(err)))
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      if (forgotPasswordMode === 'email') {
        if (!resetEmail) {
          setError('Email is required')
          setIsLoading(false)
          return
        }

        const response = await fetch(`${API_BASE_URL}/api/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: resetEmail })
        })

        const data = await parseResponseBody(response)

        if (!response.ok) {
          setError(data.error || 'Failed to send reset code')
          setIsLoading(false)
          return
        }

        setError('Reset code sent to your email!')
        setForgotPasswordMode('code')
        setIsLoading(false)
        return
      } else if (forgotPasswordMode === 'code') {
        if (!resetCode) {
          setError('Reset code is required')
          setIsLoading(false)
          return
        }

        const response = await fetch(`${API_BASE_URL}/api/verify-reset-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: resetEmail, code: resetCode })
        })

        const data = await parseResponseBody(response)

        if (!response.ok) {
          setError(data.error || 'Invalid or expired code')
          setIsLoading(false)
          return
        }

        setError('Code verified! Enter your new password.')
        setForgotPasswordMode('newPassword')
        setIsLoading(false)
        return
      } else if (forgotPasswordMode === 'newPassword') {
        if (!newPassword || !confirmPassword) {
          setError('Both password fields are required')
          setIsLoading(false)
          return
        }

        if (!isStrongPassword(newPassword)) {
          setError('Password must be at least 12 characters and include uppercase, lowercase, number, and special character')
          setIsLoading(false)
          return
        }

        if (newPassword !== confirmPassword) {
          setError('Passwords do not match')
          setIsLoading(false)
          return
        }

        const response = await fetch(`${API_BASE_URL}/api/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: resetEmail, code: resetCode, new_password: newPassword })
        })

        const data = await parseResponseBody(response)

        if (!response.ok) {
          setError(data.error || 'Failed to reset password')
          setIsLoading(false)
          return
        }

        setError('Password reset successful! You can now login with your new password.')
        setForgotPasswordMode(null)
        setResetEmail('')
        setResetCode('')
        setNewPassword('')
        setConfirmPassword('')
        setIsLoading(false)
        return
      }
    } catch (err) {
      setError('Error: ' + (err instanceof Error ? err.message : String(err)))
      setIsLoading(false)
    }
  }

  const handleCancelForgotPassword = () => {
    setForgotPasswordMode(null)
    setResetEmail('')
    setResetCode('')
    setNewPassword('')
    setConfirmPassword('')
    setError('')
  }

  const inputClass = "w-full px-4 py-2.5 rounded bg-surface border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-[color:var(--color-focus-ring)] transition-colors"
  const labelClass = "block text-sm font-semibold text-text-secondary mb-2"

  const renderForm = () => {
    // Show forgot password form if in forgot password mode
    if (forgotPasswordMode !== null) {
      return (
        <form onSubmit={handleForgotPassword} className="space-y-4">
          {forgotPasswordMode === 'email' && (
            <>
              <div>
                <label htmlFor="reset-email" className={labelClass}>Email Address</label>
                <input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setResetEmail(e.target.value)}
                  placeholder="Enter your email"
                  disabled={isLoading}
                  className={inputClass}
                />
              </div>

              {error && (
                <div className={`p-3 rounded text-sm border ${error.includes('sent') ? 'soc-auth-alert-success' : 'soc-auth-alert-error'}`}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={isLoading} className="soc-btn-primary w-full font-bold py-3 rounded transition-all disabled:opacity-50">
                {isLoading ? 'Sending...' : 'Send Reset Code'}
              </button>
            </>
          )}

          {forgotPasswordMode === 'code' && (
            <>
              <div>
                <label htmlFor="reset-code" className={labelClass}>Reset Code</label>
                <input
                  id="reset-code"
                  type="text"
                  value={resetCode}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setResetCode(e.target.value.slice(0, 8))}
                  placeholder="00000000"
                  disabled={isLoading}
                  maxLength={8}
                  className={`${inputClass} text-center text-2xl tracking-widest`}
                />
              </div>
              <p className="text-xs text-text-secondary">Check your email for the 8-digit reset code</p>

              {error && (
                <div className={`p-3 rounded text-sm border ${error.includes('verified') ? 'soc-auth-alert-success' : 'soc-auth-alert-error'}`}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={isLoading} className="soc-btn-primary w-full font-bold py-3 rounded transition-all disabled:opacity-50">
                {isLoading ? 'Verifying...' : 'Verify Code'}
              </button>
            </>
          )}

          {forgotPasswordMode === 'newPassword' && (
            <>
              <div>
                <label htmlFor="new-password" className={labelClass}>New Password</label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  disabled={isLoading}
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="confirm-password" className={labelClass}>Confirm Password</label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  disabled={isLoading}
                  className={inputClass}
                />
              </div>

              {error && (
                <div className={`p-3 rounded text-sm border ${error.includes('successful') ? 'soc-auth-alert-success' : 'soc-auth-alert-error'}`}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={isLoading} className="soc-btn-primary w-full font-bold py-3 rounded transition-all disabled:opacity-50">
                {isLoading ? 'Resetting...' : 'Reset Password'}
              </button>
            </>
          )}

          <div className="text-center">
            <button
              type="button"
              className="soc-link-button font-semibold transition-colors disabled:opacity-40 text-sm"
              onClick={handleCancelForgotPassword}
              disabled={isLoading}
            >
              Back to Login
            </button>
          </div>
        </form>
      )
    }

    return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {requiresVerification ? (
        <>
          <div>
            <label htmlFor="code" className={labelClass}>Confirmation Code</label>
            <input
              id="code"
              type="text"
              value={verificationCode}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setVerificationCode(e.target.value.slice(0, 6))}
              placeholder="000000"
              disabled={isLoading}
              maxLength={6}
              className={`${inputClass} text-center text-2xl tracking-widest`}
            />
          </div>

          {error && (
            <div className={`p-3 rounded text-sm border ${error.includes('verified') ? 'soc-auth-alert-success' : 'soc-auth-alert-error'}`}>
              {error}
            </div>
          )}

          <button type="submit" disabled={isLoading} className="soc-btn-primary w-full font-bold py-3 rounded transition-all disabled:opacity-50">
            {isLoading ? 'Verifying...' : 'Verify'}
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              className="soc-btn-secondary flex-1 px-3 py-2 font-semibold rounded transition-colors disabled:opacity-40 text-sm"
              onClick={async () => {
                setIsLoading(true)
                try {
                  const response = await fetch(`${API_BASE_URL}/api/resend-code`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: verificationEmail })
                  })
                  const data = await parseResponseBody(response)
                  if (!response.ok) {
                    setError(data.error || data.message || 'Failed to resend code')
                  } else {
                    setError(data.message || 'Code resent!')
                  }
                } catch (err) {
                  setError('Error: ' + (err instanceof Error ? err.message : String(err)))
                } finally {
                  setIsLoading(false)
                }
              }}
              disabled={isLoading}
            >
              Resend Code
            </button>
            <button
              type="button"
              className="soc-btn-secondary flex-1 px-3 py-2 font-semibold rounded transition-colors disabled:opacity-40 text-sm"
              onClick={() => {
                setRequiresVerification(false)
                setVerificationCode('')
                setVerificationEmail('')
                setError('')
                setIdentifier('')
              }}
              disabled={isLoading}
            >
              Back to Login
            </button>
          </div>
        </>
      ) : (
        <>
          <div>
            <label htmlFor="identifier" className={labelClass}>Email, Username, or Phone Number</label>
            <input id="identifier" type="text" value={identifier} onChange={(e: ChangeEvent<HTMLInputElement>) => setIdentifier(e.target.value)} placeholder="Enter your email, username, or phone number" disabled={isLoading} className={inputClass} />
          </div>

          <div>
            <label htmlFor="password" className={labelClass}>Password</label>
            <input id="password" type="password" value={password} onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} placeholder="Enter your password" disabled={isLoading} className={inputClass} />
          </div>

          {error && (
            <div className="soc-auth-alert-error p-3 rounded text-sm border">
              {error}
            </div>
          )}

          <button type="submit" disabled={isLoading} className="soc-btn-primary w-full min-h-11 py-3 font-bold uppercase tracking-wide rounded disabled:opacity-50">
            {isLoading ? 'Processing...' : 'Login'}
          </button>

          <p className="text-sm text-text-secondary text-center">
            Need an account?{' '}
            <span className="text-accent-primary">Contact your administrator</span>
            {' '}for access.
          </p>

          <div className="text-center">
            <button
              type="button"
              className="font-semibold transition-colors disabled:opacity-40 text-sm text-warning"
              onClick={() => {
                setForgotPasswordMode('email')
                setError('')
                setIdentifier('')
                setPassword('')
              }}
              disabled={isLoading}
            >
              Forgot your password?
            </button>
          </div>
        </>
      )}
    </form>
  )
}

  return (
    <>
      <a href="#auth-main" className="skip-link">Skip to main content</a>
      <div className="relative min-h-screen bg-background overflow-hidden">
        <ParticleBackground className="z-0 opacity-60" />
        <div className="relative z-10 grid min-h-screen grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
          <main id="auth-main" className="flex items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
            <section
              className="login-panel w-full max-w-xl rounded p-6 sm:p-8"
              aria-labelledby="auth-title"
            >
              <div className="mb-6 flex justify-center">
                <SentinelLogo size={62} variant="FullLogo" animated />
              </div>

              {!requiresVerification && (
                <div className="mb-6 text-center">
                  <h1 id="auth-title" className="text-3xl font-bold uppercase tracking-wide text-text-primary">Mission Access Terminal</h1>
                  <p className="mt-2 text-sm font-medium text-text-secondary">Authenticate to enter SENTINEL command operations.</p>
                </div>
              )}

              {requiresVerification && (
                <div className="mb-6 text-center">
                  <h1 id="auth-title" className="text-3xl font-bold uppercase tracking-wide text-text-primary">Verify Clearance Code</h1>
                  <p className="mt-2 text-sm font-medium text-text-secondary">Enter the 6-digit code sent to {verificationEmail}.</p>
                </div>
              )}

              {renderForm()}
            </section>
          </main>

          <aside className="hidden lg:flex lg:flex-col lg:justify-center login-aside relative overflow-hidden" aria-label="Platform capabilities">
            <div className="relative z-10 flex flex-col gap-10 px-10 py-12">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent mb-3">Operational Platform</p>
                <p className="text-lg font-medium text-text-primary leading-relaxed max-w-sm">
                  Real-time protection, mission oversight, and personnel coordination — in one integrated command surface.
                </p>
              </div>

              <div className="grid gap-4" role="list" aria-label="Key capabilities">
                <div className="login-capability-card" role="listitem">
                  <div className="login-capability-icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Live Guard Tracking</p>
                    <p className="text-xs text-text-secondary mt-0.5">GPS heartbeat monitoring with geofence alerts</p>
                  </div>
                </div>
                <div className="login-capability-card" role="listitem">
                  <div className="login-capability-icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Incident Intelligence</p>
                    <p className="text-xs text-text-secondary mt-0.5">AI-assisted classification, severity analysis, and response</p>
                  </div>
                </div>
                <div className="login-capability-card" role="listitem">
                  <div className="login-capability-icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Mission Scheduling</p>
                    <p className="text-xs text-text-secondary mt-0.5">Shift management, swap workflow, and duty calendar</p>
                  </div>
                </div>
              </div>

              <div className="login-status-strip" aria-label="System readiness">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-success" aria-hidden="true" />
                  <span className="text-xs font-medium text-text-secondary">Platform ready</span>
                </div>
                <span className="text-xs text-text-tertiary tracking-wide uppercase">DAVAO SECURITY & INVESTIGATION AGENCY</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}

export default LoginPage
