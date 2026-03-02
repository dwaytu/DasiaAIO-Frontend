import { useState, FC, FormEvent, ChangeEvent } from 'react'
import Logo from './Logo'
import ParticleBackground from './ParticleBackground'
import { User } from '../App'
import { API_BASE_URL } from '../config'

interface LoginPageProps {
  onLogin: (user: User) => void
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
  const [role, setRole] = useState<string>('user')
  const [adminCode, setAdminCode] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isRegistering, setIsRegistering] = useState<boolean>(false)
  const [requiresVerification, setRequiresVerification] = useState<boolean>(false)
  const [verificationCode, setVerificationCode] = useState<string>('')
  const [verificationEmail, setVerificationEmail] = useState<string>('')

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

        if (!response.ok) {
          const data = await response.json()
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

        if (role !== 'admin' && (!licenseNumber || !licenseIssuedDate || !licenseExpiryDate)) {
          setError('License number, issued date, and expiry date are required for regular users')
          setIsLoading(false)
          return
        }

        if (!email.endsWith('@gmail.com')) {
          setError('You must use a Gmail account (email must end with @gmail.com)')
          setIsLoading(false)
          return
        }

        if (role === 'admin' && !adminCode) {
          setError('Admin code is required for admin account')
          setIsLoading(false)
          return
        }

        if (role === 'admin' && adminCode !== '122601') {
          setError('Invalid admin code')
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
          adminCode,
          fullName,
          phoneNumber
        }
        
        if (role !== 'admin') {
          requestBody.licenseNumber = licenseNumber
          requestBody.licenseIssuedDate = licenseIssuedDate
          requestBody.licenseExpiryDate = licenseExpiryDate
          requestBody.address = address
        }
        
        const response = await fetch(`${API_BASE_URL}/api/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
          const data = await response.json()
          setError(data.error || 'Registration failed')
          setIsLoading(false)
          return
        }

        const data = await response.json()
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
          setAdminCode('')
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

        if (!response.ok) {
          const data = await response.json()
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

        const data = await response.json()
        setIsLoading(false)
        const user: User = {
          ...data.user,
          role: data.user.role as 'admin' | 'superadmin' | 'user' | 'guard'
        }
        onLogin(user)
      }
    } catch (err) {
      setError('Error: ' + (err instanceof Error ? err.message : String(err)))
      setIsLoading(false)
    }
  }

  const inputClass = "w-full px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
  const inputStyle = { background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }
  const labelClass = "block text-sm font-semibold mb-2"
  const labelStyle = { color: 'var(--text-secondary)' }

  const renderForm = () => (
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
                  const data = await response.json()
                  setError(data.message || 'Code resent!')
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

          {role !== 'admin' && (
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
          )}

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
              <option value="user" style={{ background: '#1C1F35' }}>User</option>
              <option value="admin" style={{ background: '#1C1F35' }}>Admin</option>
            </select>
          </div>

          {role === 'admin' && (
            <div>
              <label htmlFor="adminCode" className={labelClass} style={labelStyle}>Admin Code</label>
              <input id="adminCode" type="password" value={adminCode} onChange={(e: ChangeEvent<HTMLInputElement>) => setAdminCode(e.target.value)} placeholder="Enter admin code" disabled={isLoading} className={inputClass} style={inputStyle} />
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg text-sm border" style={error.includes('successful') ? { background: 'rgba(34,197,94,0.1)', color: '#4ADE80', borderColor: 'rgba(34,197,94,0.3)' } : { background: 'rgba(239,68,68,0.1)', color: '#FCA5A5', borderColor: 'rgba(239,68,68,0.3)' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={isLoading} className="w-full text-white font-bold py-3 rounded-lg transition-all disabled:opacity-50" style={{ background: 'var(--accent)' }}>
            {isLoading ? 'Processing...' : 'Create Account'}
          </button>

          <div className="text-center">
            <button type="button" className="font-semibold transition-colors disabled:opacity-40 text-sm" style={{ color: '#60A5FA' }} onClick={() => { setIsRegistering(false); setError(''); setPassword(''); setAdminCode(''); setIdentifier('') }} disabled={isLoading}>
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
            <button type="button" className="font-semibold transition-colors disabled:opacity-40 text-sm" style={{ color: '#60A5FA' }} onClick={() => { setIsRegistering(true); setError(''); setPassword(''); setAdminCode(''); setIdentifier('') }} disabled={isLoading}>
              Don't have an account? Register
            </button>
          </div>
        </>
      )}
    </form>
  )

  return (
    <>
      {/* MOBILE LAYOUT */}
      <div className="lg:hidden min-h-screen w-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
        <div className="w-full max-w-md">
          {/* Form Card */}
          <div className="rounded-3xl shadow-2xl p-7 max-h-[90vh] overflow-y-auto" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <Logo onClick={() => {}} />
            </div>

            {/* Accent Line */}
            <div className="w-16 h-0.5 mx-auto mb-5 rounded-full" style={{ background: 'linear-gradient(to right, #3B82F6, #6366F1)' }}></div>

            {/* Page Title */}
            {!requiresVerification && !isRegistering && (
              <div className="mb-5 text-center">
                <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Welcome Back!</h1>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Please enter your details</p>
              </div>
            )}

            {requiresVerification && (
              <div className="mb-5 text-center">
                <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Verify Your Email</h1>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Enter the 6-digit code sent to {verificationEmail}</p>
              </div>
            )}

            {isRegistering && !requiresVerification && (
              <div className="mb-5 text-center">
                <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Create Account</h1>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Fill in your details to get started</p>
              </div>
            )}

            {/* Form */}
            {renderForm()}
          </div>
        </div>
      </div>

      {/* DESKTOP LAYOUT */}
      <div className="hidden lg:flex min-h-screen w-screen" style={{ background: 'var(--bg-primary)' }}>
        {/* Left Section - Form */}
        <div className="flex-1 flex flex-col relative max-h-screen overflow-y-auto" style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}>          
          {/* Particle background */}
          <div className="absolute inset-0 pointer-events-none">
            <ParticleBackground particleCount={90} color="0, 190, 220" connectDistance={130} mouseRadius={160} />
          </div>

          {/* Logo top-left */}
          {!isRegistering && (
            <div className="relative z-10 pt-6 pl-8">
              <Logo size="md" logoOnly />
            </div>
          )}

          {/* Form centered */}
          <div 
            className={`flex-1 flex ${isRegistering ? 'items-start' : 'items-center'} justify-center p-8 relative z-10`}
          >
          <style>{`
            .flex-1.flex.flex-col::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          <div className="w-full max-w-md py-8">
            {!requiresVerification && !isRegistering && (
              <div className="mb-8">
                <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Welcome Back!</h1>
                <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>Please enter your details</p>
              </div>
            )}

            {requiresVerification && (
              <div className="mb-8">
                <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Verify Your Email</h1>
                <p className="text-base" style={{ color: 'var(--text-secondary)' }}>Enter the 6-digit code sent to {verificationEmail}</p>
              </div>
            )}

            {isRegistering && !requiresVerification && (
              <div className="mb-8">
                <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Create Account</h1>
                <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>Fill in your details to get started</p>
              </div>
            )}

            {renderForm()}
          </div>
          </div>
        </div>

        {/* Right Section - Design */}
        <div className="flex-1 flex items-center justify-center flex-col gap-8 p-12" style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 50%, #0D0F1A 100%)', borderLeft: '1px solid var(--border-color)' }}>
          <Logo size="lg" forceDark />
          
          <div className="grid grid-cols-2 gap-6 w-full max-w-md">
            {[
              { value: '24/7', label: 'Security' },
              { value: '100%', label: 'Encrypted' },
              { value: '∞', label: 'Scalable' },
              { value: '✓', label: 'Verified' },
            ].map(item => (
              <div key={item.label} className="rounded-lg p-4 text-center" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
                <div className="text-2xl font-bold text-white mb-2">{item.value}</div>
                <p className="text-sm" style={{ color: '#93C5FD' }}>{item.label}</p>
              </div>
            ))}
          </div>
          
          <div className="text-center">
            <p className="text-sm" style={{ color: '#64748B' }}>Davao Security & Investigation Agency Inc.</p>
          </div>
        </div>
      </div>
    </>
  )
}

export default LoginPage
