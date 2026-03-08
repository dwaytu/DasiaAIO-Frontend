import { useState, FC, FormEvent, ChangeEvent } from 'react'
import SentinelLogo from './SentinelLogo'
import ParticleBackground from './ParticleBackground'
import { User } from '../App'
import { API_BASE_URL } from '../config'

interface LoginPageProps {
  onLogin: (user: User) => void
}

async function parseResponseBody(response: Response): Promise<any> {
  const raw = await response.text()
  if (!raw) return {}

  try {
    return JSON.parse(raw)
  } catch {
    return { error: raw }
  }
}

// Format phone number to +63-###-###-####
function formatPhoneNumber(value: string): string {
  // Remove all non-digits
  let cleaned = value.replace(/\D/g, '')
  
  // If it starts with 0, replace with 63
  if (cleaned.startsWith('0')) {
    cleaned = '63' + cleaned.slice(1)
  }
  
  // Ensure it starts with 63
  if (!cleaned.startsWith('63')) {
    cleaned = '63' + cleaned
  }
  
  // Limit to 12 digits (63 + 10 digits)
  cleaned = cleaned.slice(0, 12)
  
  // Format as +63-###-###-####
  if (cleaned.length <= 2) {
    return '+' + cleaned
  } else if (cleaned.length <= 5) {
    return '+' + cleaned.slice(0, 2) + '-' + cleaned.slice(2)
  } else if (cleaned.length <= 8) {
    return '+' + cleaned.slice(0, 2) + '-' + cleaned.slice(2, 5) + '-' + cleaned.slice(5)
  } else {
    return '+' + cleaned.slice(0, 2) + '-' + cleaned.slice(2, 5) + '-' + cleaned.slice(5, 8) + '-' + cleaned.slice(8)
  }
}

const LoginPage: FC<LoginPageProps> = ({ onLogin }) => {
  const [identifier, setIdentifier] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [username, setUsername] = useState<string>('')
  const [fullName, setFullName] = useState<string>('')
  const [email, setEmail] = useState<string>('')
  const [phoneNumber, setPhoneNumber] = useState<string>('')
  const [licenseNumber, setLicenseNumber] = useState<string>('')
  const [licenseIssuedDate, setLicenseIssuedDate] = useState<string>('')
  const [licenseExpiryDate, setLicenseExpiryDate] = useState<string>('')
  const [address, setAddress] = useState<string>('')
  const [role, setRole] = useState<string>('guard')
  const [error, setError] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isRegistering, setIsRegistering] = useState<boolean>(false)
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

      if (isRegistering) {
        if (!email || !password || !username || !role) {
          setError('All fields are required')
          setIsLoading(false)
          return
        }

        if (!fullName || !phoneNumber) {
          setError('Full name and phone number are required')
          setIsLoading(false)
          return
        }

        if (!licenseNumber || !licenseIssuedDate || !licenseExpiryDate) {
          setError('License number, issued date, and expiry date are required for guard registration')
          setIsLoading(false)
          return
        }

        if (!email.endsWith('@gmail.com')) {
          setError('You must use a Gmail account (email must end with @gmail.com)')
          setIsLoading(false)
          return
        }

        if (password.length < 6) {
          setError('Password must be at least 6 characters')
          setIsLoading(false)
          return
        }

        const requestBody: any = { 
          email, 
          password, 
          username, 
          role,
          fullName,
          phoneNumber
        }

        requestBody.licenseNumber = licenseNumber
        requestBody.licenseIssuedDate = licenseIssuedDate
        requestBody.licenseExpiryDate = licenseExpiryDate
        requestBody.address = address
        
        const response = await fetch(`${API_BASE_URL}/api/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        })

        const data = await parseResponseBody(response)

        if (!response.ok) {
          setError(data.error || data.message || 'Registration failed')
          setIsLoading(false)
          return
        }

        if (data.requiresVerification) {
          setRequiresVerification(true)
          setVerificationEmail(email)
          setError('Check your Gmail for the confirmation code!')
          setIdentifier('')
          setEmail('')
          setPassword('')
          setUsername('')
          setFullName('')
          setPhoneNumber('')
          setLicenseNumber('')
          setLicenseIssuedDate('')
          setLicenseExpiryDate('')
          setAddress('')
          setIsLoading(false)
          return
        }

        setIsRegistering(false)
        setPassword('')
        setError('Registration successful! Please login.')
        setIsLoading(false)
        return
      } else {
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
            setVerificationEmail(email)
            setError('Please verify your email first. Check your Gmail for the confirmation code.')
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
        // Store token in localStorage for authentication persistence
        if (data.token) {
          localStorage.setItem('token', data.token)
        }
        onLogin(user)
      }
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

        if (newPassword.length < 6) {
          setError('Password must be at least 6 characters')
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

  const inputClass = "w-full px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
  const inputStyle = { background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }
  const labelClass = "block text-sm font-semibold mb-2"
  const labelStyle = { color: 'var(--text-secondary)' }

  const renderForm = () => {
    // Show forgot password form if in forgot password mode
    if (forgotPasswordMode !== null) {
      return (
        <form onSubmit={handleForgotPassword} className="space-y-4">
          {forgotPasswordMode === 'email' && (
            <>
              <div>
                <label htmlFor="reset-email" className={labelClass} style={labelStyle}>Email Address</label>
                <input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setResetEmail(e.target.value)}
                  placeholder="Enter your email"
                  disabled={isLoading}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>

              {error && (
                <div className={`p-3 rounded-lg text-sm border`} style={error.includes('sent') ? { background: 'rgba(34,197,94,0.1)', color: '#4ADE80', borderColor: 'rgba(34,197,94,0.3)' } : { background: 'rgba(239,68,68,0.1)', color: '#FCA5A5', borderColor: 'rgba(239,68,68,0.3)' }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={isLoading} className="w-full text-white font-bold py-3 rounded-lg transition-all disabled:opacity-50" style={{ background: 'var(--accent)' }}>
                {isLoading ? 'Sending...' : 'Send Reset Code'}
              </button>
            </>
          )}

          {forgotPasswordMode === 'code' && (
            <>
              <div>
                <label htmlFor="reset-code" className={labelClass} style={labelStyle}>Reset Code</label>
                <input
                  id="reset-code"
                  type="text"
                  value={resetCode}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setResetCode(e.target.value.slice(0, 6))}
                  placeholder="000000"
                  disabled={isLoading}
                  maxLength={6}
                  className={`${inputClass} text-center text-2xl tracking-widest`}
                  style={inputStyle}
                />
              </div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Check your email for the 6-digit code</p>

              {error && (
                <div className={`p-3 rounded-lg text-sm border`} style={error.includes('verified') ? { background: 'rgba(34,197,94,0.1)', color: '#4ADE80', borderColor: 'rgba(34,197,94,0.3)' } : { background: 'rgba(239,68,68,0.1)', color: '#FCA5A5', borderColor: 'rgba(239,68,68,0.3)' }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={isLoading} className="w-full text-white font-bold py-3 rounded-lg transition-all disabled:opacity-50" style={{ background: 'var(--accent)' }}>
                {isLoading ? 'Verifying...' : 'Verify Code'}
              </button>
            </>
          )}

          {forgotPasswordMode === 'newPassword' && (
            <>
              <div>
                <label htmlFor="new-password" className={labelClass} style={labelStyle}>New Password</label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  disabled={isLoading}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>

              <div>
                <label htmlFor="confirm-password" className={labelClass} style={labelStyle}>Confirm Password</label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  disabled={isLoading}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>

              {error && (
                <div className={`p-3 rounded-lg text-sm border`} style={error.includes('successful') ? { background: 'rgba(34,197,94,0.1)', color: '#4ADE80', borderColor: 'rgba(34,197,94,0.3)' } : { background: 'rgba(239,68,68,0.1)', color: '#FCA5A5', borderColor: 'rgba(239,68,68,0.3)' }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={isLoading} className="w-full text-white font-bold py-3 rounded-lg transition-all disabled:opacity-50" style={{ background: 'var(--accent)' }}>
                {isLoading ? 'Resetting...' : 'Reset Password'}
              </button>
            </>
          )}

          <div className="text-center">
            <button
              type="button"
              className="font-semibold transition-colors disabled:opacity-40 text-sm"
              style={{ color: '#60A5FA' }}
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
            <label htmlFor="code" className={labelClass} style={labelStyle}>Confirmation Code</label>
            <input
              id="code"
              type="text"
              value={verificationCode}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setVerificationCode(e.target.value.slice(0, 6))}
              placeholder="000000"
              disabled={isLoading}
              maxLength={6}
              className={`${inputClass} text-center text-2xl tracking-widest`}
              style={inputStyle}
            />
          </div>

          {error && (
            <div className={`p-3 rounded-lg text-sm border`} style={error.includes('verified') ? { background: 'rgba(34,197,94,0.1)', color: '#4ADE80', borderColor: 'rgba(34,197,94,0.3)' } : { background: 'rgba(239,68,68,0.1)', color: '#FCA5A5', borderColor: 'rgba(239,68,68,0.3)' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={isLoading} className="w-full text-white font-bold py-3 rounded-lg transition-all disabled:opacity-50" style={{ background: 'var(--accent)' }}>
            {isLoading ? 'Verifying...' : 'Verify'}
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 px-3 py-2 font-semibold rounded-lg transition-colors disabled:opacity-40 text-sm"
              style={{ border: '1px solid rgba(59,130,246,0.4)', color: '#60A5FA', background: 'rgba(59,130,246,0.08)' }}
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
              className="flex-1 px-3 py-2 font-semibold rounded-lg transition-colors disabled:opacity-40 text-sm"
              style={{ border: '1px solid var(--border-color)', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.04)' }}
              onClick={() => {
                setRequiresVerification(false)
                setVerificationCode('')
                setVerificationEmail('')
                setError('')
                setIsRegistering(false)
                setIdentifier('')
              }}
              disabled={isLoading}
            >
              Back to Login
            </button>
          </div>
        </>
      ) : isRegistering ? (
        <>
          <div>
            <label htmlFor="username" className={labelClass} style={labelStyle}>Username</label>
            <input id="username" type="text" value={username} onChange={(e: ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)} placeholder="Enter your username" disabled={isLoading} className={inputClass} style={inputStyle} />
          </div>

          <div>
            <label htmlFor="fullName" className={labelClass} style={labelStyle}>Full Name</label>
            <input id="fullName" type="text" value={fullName} onChange={(e: ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)} placeholder="Enter your full name" disabled={isLoading} className={inputClass} style={inputStyle} />
          </div>

          <div>
            <label htmlFor="phoneNumber" className={labelClass} style={labelStyle}>Phone Number</label>
            <input id="phoneNumber" type="text" value={phoneNumber} onChange={(e: ChangeEvent<HTMLInputElement>) => setPhoneNumber(formatPhoneNumber(e.target.value))} placeholder="+63-###-###-####" disabled={isLoading} className={inputClass} style={inputStyle} />
          </div>

          <>
            <div>
              <label htmlFor="licenseNumber" className={labelClass} style={labelStyle}>License Number</label>
              <input id="licenseNumber" type="text" value={licenseNumber} onChange={(e: ChangeEvent<HTMLInputElement>) => setLicenseNumber(e.target.value)} placeholder="Enter your license number" disabled={isLoading} className={inputClass} style={inputStyle} />
            </div>

            <div>
              <label htmlFor="licenseIssuedDate" className={labelClass} style={labelStyle}>License Issued Date</label>
              <input id="licenseIssuedDate" type="date" value={licenseIssuedDate} onChange={(e: ChangeEvent<HTMLInputElement>) => setLicenseIssuedDate(e.target.value)} disabled={isLoading} className={inputClass} style={inputStyle} />
            </div>

            <div>
              <label htmlFor="licenseExpiryDate" className={labelClass} style={labelStyle}>License Expiry Date</label>
              <input id="licenseExpiryDate" type="date" value={licenseExpiryDate} onChange={(e: ChangeEvent<HTMLInputElement>) => setLicenseExpiryDate(e.target.value)} disabled={isLoading} className={inputClass} style={inputStyle} />
            </div>

            <div>
              <label htmlFor="address" className={labelClass} style={labelStyle}>Full Address</label>
              <textarea id="address" value={address} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setAddress(e.target.value)} placeholder="Enter your complete address" disabled={isLoading} rows={2} className={inputClass} style={inputStyle} />
            </div>
          </>

          <div>
            <label htmlFor="email" className={labelClass} style={labelStyle}>Email</label>
            <input id="email" type="email" value={email} onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} placeholder="Enter your email" disabled={isLoading} className={inputClass} style={inputStyle} />
          </div>

          <div>
            <label htmlFor="password" className={labelClass} style={labelStyle}>Password</label>
            <input id="password" type="password" value={password} onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} placeholder="Enter your password" disabled={isLoading} className={inputClass} style={inputStyle} />
          </div>

          <div>
            <label htmlFor="role" className={labelClass} style={labelStyle}>Account Type</label>
            <select id="role" value={role} onChange={(e: ChangeEvent<HTMLSelectElement>) => setRole(e.target.value)} disabled={isLoading} className={inputClass} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="guard" style={{ background: '#1C1F35' }}>Guard</option>
            </select>
            <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
              Admin and supervisor accounts are created internally.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg text-sm border" style={error.includes('successful') ? { background: 'rgba(34,197,94,0.1)', color: '#4ADE80', borderColor: 'rgba(34,197,94,0.3)' } : { background: 'rgba(239,68,68,0.1)', color: '#FCA5A5', borderColor: 'rgba(239,68,68,0.3)' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={isLoading} className="w-full text-white font-bold py-3 rounded-lg transition-all disabled:opacity-50" style={{ background: 'var(--accent)' }}>
            {isLoading ? 'Processing...' : 'Create Account'}
          </button>

          <div className="text-center">
            <button type="button" className="font-semibold transition-colors disabled:opacity-40 text-sm" style={{ color: '#60A5FA' }} onClick={() => { setIsRegistering(false); setError(''); setPassword(''); setIdentifier('') }} disabled={isLoading}>
              Already have an account? Login
            </button>
          </div>
        </>
      ) : (
        <>
          <div>
            <label htmlFor="identifier" className={labelClass} style={labelStyle}>Email, Username, or Phone Number</label>
            <input id="identifier" type="text" value={identifier} onChange={(e: ChangeEvent<HTMLInputElement>) => setIdentifier(e.target.value)} placeholder="Enter your email, username, or phone number" disabled={isLoading} className={inputClass} style={inputStyle} />
          </div>

          <div>
            <label htmlFor="password" className={labelClass} style={labelStyle}>Password</label>
            <input id="password" type="password" value={password} onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} placeholder="Enter your password" disabled={isLoading} className={inputClass} style={inputStyle} />
          </div>

          {error && (
            <div className="p-3 rounded-lg text-sm border" style={{ background: 'rgba(239,68,68,0.1)', color: '#FCA5A5', borderColor: 'rgba(239,68,68,0.3)' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={isLoading} className="w-full text-white font-bold py-3 rounded-lg transition-all disabled:opacity-50" style={{ background: 'var(--accent)', boxShadow: '0 0 20px rgba(59,130,246,0.25)' }}>
            {isLoading ? 'Processing...' : 'Login'}
          </button>

          <div className="text-center">
            <button type="button" className="font-semibold transition-colors disabled:opacity-40 text-sm" style={{ color: '#60A5FA' }} onClick={() => { setIsRegistering(true); setError(''); setPassword(''); setIdentifier('') }} disabled={isLoading}>
              Don't have an account? Register
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              className="font-semibold transition-colors disabled:opacity-40 text-sm"
              style={{ color: '#FF9966' }}
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
      <div className="relative min-h-screen overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden="true">
          <div className="h-full w-full" style={{
            backgroundImage: 'linear-gradient(rgba(56,189,248,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.08) 1px, transparent 1px)',
            backgroundSize: '42px 42px'
          }} />
        </div>

        <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden="true">
          <ParticleBackground particleCount={65} color="56, 189, 248" connectDistance={120} mouseRadius={120} />
        </div>

        <div className="relative z-10 grid min-h-screen grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
          <main id="auth-main" className="flex items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
            <section className="w-full max-w-xl rounded-2xl border border-border-elevated bg-surface/85 p-6 shadow-modal backdrop-blur-md sm:p-8" aria-labelledby="auth-title">
              <div className="mb-6 flex justify-center">
                <SentinelLogo size="lg" stacked showText />
              </div>

              {!requiresVerification && !isRegistering && (
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

              {isRegistering && !requiresVerification && (
                <div className="mb-6 text-center">
                  <h1 id="auth-title" className="text-3xl font-bold uppercase tracking-wide text-text-primary">Register Guard Profile</h1>
                  <p className="mt-2 text-sm font-medium text-text-secondary">Provide operator details for approval workflow.</p>
                </div>
              )}

              {renderForm()}
            </section>
          </main>

          <aside className="hidden border-l border-border-subtle bg-surface-elevated/70 p-10 lg:flex lg:flex-col lg:justify-between">
            <div>
              <SentinelLogo size="md" showText />
              <p className="mt-5 max-w-md text-sm text-text-secondary">
                Real-time protection platform for mission planning, personnel readiness, and critical asset oversight.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-text-tertiary">System Status</h2>
              <div className="grid gap-3">
                {[
                  { label: 'System Status', value: 'Operational', tone: 'success' },
                  { label: 'Network', value: 'Secure', tone: 'info' },
                  { label: 'Monitoring Nodes', value: 'Active', tone: 'warning' },
                ].map((item) => (
                  <div key={item.label} className={`bento-card ${item.tone === 'success' ? 'status-bar-success' : item.tone === 'warning' ? 'status-bar-warning' : 'status-bar-info'}`}>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">{item.label}</p>
                    <p className="mt-1 text-lg font-bold text-text-primary">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs font-medium uppercase tracking-[0.16em] text-text-tertiary">Davao Security & Investigation Agency</p>
          </aside>
        </div>
      </div>
    </>
  )
}

export default LoginPage
