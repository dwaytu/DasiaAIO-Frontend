import { useState, FC, FormEvent, ChangeEvent } from 'react'
import Logo from './Logo'
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
  const [licenseExpiryDate, setLicenseExpiryDate] = useState<string>('')
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
        // Verify email code
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
        // Register
        console.log('Registration attempt:', { email, password, username, role, fullName, phoneNumber })
        
        if (!email || !password || !username || !role) {
          console.log('Missing basic fields:', { email: !email, password: !password, username: !username, role: !role })
          setError('All fields are required')
          setIsLoading(false)
          return
        }

        // Validate required fields
        if (!fullName || !phoneNumber) {
          console.log('Missing personal info:', { fullName: !fullName, phoneNumber: !phoneNumber })
          setError('Full name and phone number are required')
          setIsLoading(false)
          return
        }

        // For regular users, license fields are required
        if (role !== 'admin' && (!licenseNumber || !licenseExpiryDate)) {
          console.log('Missing license fields for user:', { licenseNumber: !licenseNumber, licenseExpiryDate: !licenseExpiryDate })
          setError('License number and expiry date are required for regular users')
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

        // Call backend register
        const requestBody: any = { 
          email, 
          password, 
          username, 
          role, 
          adminCode,
          fullName,
          phoneNumber
        }
        
        // Only include license fields if not admin
        if (role !== 'admin') {
          requestBody.licenseNumber = licenseNumber
          requestBody.licenseExpiryDate = licenseExpiryDate
        }
        
        console.log('Registering with:', requestBody)
        
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
          setLicenseExpiryDate('')
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
        // Login
        if (!identifier || !password) {
          setError('Email, username, phone number, and password are required')
          setIsLoading(false)
          return
        }

        console.log('Attempting login with:', { identifier, password: '***' })

        // Call backend login
        const response = await fetch(`${API_BASE_URL}/api/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password })
        })

        console.log('Login response status:', response.status)

        if (!response.ok) {
          const data = await response.json()
          console.log('Login error data:', data)
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

  return (
    <div className="min-h-screen flex w-screen bg-white overflow-hidden">
      {/* Desktop Logo - Only on login page */}
      {!isRegistering && (
        <div className="absolute top-8 left-8 z-10 hidden lg:block">
          <Logo onClick={() => {}} />
        </div>
      )}
      
      {/* Mobile Layout - Completely different design */}
      <div className="flex-1 flex items-center justify-center min-h-screen lg:hidden bg-gradient-to-br from-indigo-600 to-purple-700">
        <div className="w-full max-w-md mx-4">
          {/* Mobile Logo - Single centered logo */}
          <div className="flex justify-center mb-8">
            <div className="bg-white rounded-2xl p-4 shadow-lg">
              <svg viewBox="0 0 200 200" width="80" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="mobilePurpleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{stopColor:'#667eea',stopOpacity:1}} />
                    <stop offset="100%" style={{stopColor:'#764ba2',stopOpacity:1}} />
                  </linearGradient>
                </defs>
                <path d="M 100 20 L 160 55 L 160 115 C 160 160 100 180 100 180 C 100 180 40 160 40 115 L 40 55 Z" 
                      fill="url(#mobilePurpleGradient)"/>
                <path d="M 100 30 L 155 60 L 155 115 C 155 155 100 172 100 172 C 100 172 45 155 45 115 L 45 60 Z" 
                      fill="none" stroke="white" strokeWidth="2" opacity="0.3"/>
                <circle cx="100" cy="100" r="25" fill="white" opacity="0.1"/>
                <path d="M 88 102 L 95 109 L 112 92" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          
          {/* White Card Container */}
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-1">Davao Security &</h2>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Investigation Agency</h2>
            </div>
            
            {!requiresVerification && !isRegistering && (
              <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back!</h1>
                <p className="text-sm text-gray-600">Please enter your details</p>
              </div>
            )}
            
            {requiresVerification ? (
              <>
                <div className="mb-6 text-center">
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Email</h1>
                  <p className="text-gray-600 text-sm">Enter the 6-digit code sent to {verificationEmail}</p>
                </div>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="code" className="block text-sm font-semibold text-gray-700 mb-2">Confirmation Code</label>
                  <input
                    id="code"
                    type="text"
                    value={verificationCode}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setVerificationCode(e.target.value.slice(0, 6))}
                    placeholder="000000"
                    disabled={isLoading}
                    maxLength={6}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 text-center text-2xl tracking-widest"
                  />
                </div>

                {error && (
                  <div className={`p-4 rounded-lg text-sm md:text-base ${error.includes('verified successfully') ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition-colors text-sm md:text-base">
                  {isLoading ? 'Verifying...' : 'Verify'}
                </button>

                <div className="flex gap-3">
                  <button
                    type="button"
                    className="flex-1 px-4 py-2 border border-indigo-600 text-indigo-600 font-semibold rounded-lg hover:bg-indigo-50 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-300 text-xs md:text-sm"
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
                    className="flex-1 px-4 py-2 text-gray-700 font-semibold border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:bg-gray-100 disabled:text-gray-400 text-xs md:text-sm"
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
              </form>
            </>
          ) : (
            <>
              {/* Mobile Logo for registration page */}
              <div className="flex justify-center mb-8 lg:hidden">
                <Logo onClick={() => {}} />
              </div>
              
              {isRegistering && (
                <div className="mb-8 text-center lg:text-left">
                  <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Create Account</h1>
                  <p className="text-base md:text-lg text-gray-600">Fill in your details to get started</p>
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-5">
                {isRegistering && (
                  <div>
                      <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-2">Username</label>
                      <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                        placeholder="Enter your username"
                        disabled={isLoading}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                      />
                    </div>
                  )}

                  {isRegistering && (
                    <div>
                      <label htmlFor="fullName" className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                      <input
                        id="fullName"
                        type="text"
                        value={fullName}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
                        placeholder="Enter your full name"
                        disabled={isLoading}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                      />
                    </div>
                  )}

                  {isRegistering && (
                    <div>
                      <label htmlFor="phoneNumber" className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
                      <input
                        id="phoneNumber"
                        type="text"
                        value={phoneNumber}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setPhoneNumber(formatPhoneNumber(e.target.value))}
                        placeholder="+63-###-###-####"
                        disabled={isLoading}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                      />
                    </div>
                  )}

                  {isRegistering && role !== 'admin' && (
                    <div>
                      <label htmlFor="licenseNumber" className="block text-sm font-semibold text-gray-700 mb-2">License Number</label>
                      <input
                        id="licenseNumber"
                        type="text"
                        value={licenseNumber}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setLicenseNumber(e.target.value)}
                        placeholder="Enter your license number"
                        disabled={isLoading}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                      />
                    </div>
                  )}

                  {isRegistering && role !== 'admin' && (
                    <div>
                      <label htmlFor="licenseExpiryDate" className="block text-sm font-semibold text-gray-700 mb-2">License Expiry Date</label>
                      <input
                        id="licenseExpiryDate"
                        type="date"
                        value={licenseExpiryDate}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setLicenseExpiryDate(e.target.value)}
                        disabled={isLoading}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                      />
                    </div>
                  )}

                  {isRegistering && (
                    <div>
                      <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        disabled={isLoading}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                      />
                    </div>
                  )}

                  {!isRegistering && (
                    <div>
                      <label htmlFor="identifier" className="block text-sm font-semibold text-gray-700 mb-2">Email, Username, or Phone Number</label>
                      <input
                        id="identifier"
                        type="text"
                        value={identifier}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setIdentifier(e.target.value)}
                        placeholder="Enter your email, username, or phone number"
                        disabled={isLoading}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                      />
                    </div>
                  )}

                  <div>
                    <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      disabled={isLoading}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                    />
                  </div>

                  {isRegistering && (
                    <div>
                      <label htmlFor="role" className="block text-sm font-semibold text-gray-700 mb-2">Account Type</label>
                      <select
                        id="role"
                        value={role}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => setRole(e.target.value)}
                        disabled={isLoading}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 bg-white"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  )}

                  {isRegistering && role === 'admin' && (
                    <div>
                      <label htmlFor="adminCode" className="block text-sm font-semibold text-gray-700 mb-2">Admin Code</label>
                      <input
                        id="adminCode"
                        type="password"
                        value={adminCode}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setAdminCode(e.target.value)}
                        placeholder="Enter admin code"
                        disabled={isLoading}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                      />
                    </div>
                  )}

                  {error && (
                    <div className={`p-4 rounded-lg ${isRegistering && !error.includes('successful') ? 'bg-red-50 text-red-800 border border-red-200' : error.includes('successful') ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                      {error}
                    </div>
                  )}

                  <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition-colors text-sm md:text-base">
                    {isLoading ? 'Processing...' : isRegistering ? 'Create Account' : 'Login'}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <button
                    type="button"
                    className="text-indigo-600 hover:text-indigo-700 font-semibold transition-colors disabled:text-gray-400"
                    onClick={() => {
                      setIsRegistering(!isRegistering)
                      setError('')
                      setPassword('')
                      setAdminCode('')
                      setIdentifier('')
                    }}
                    disabled={isLoading}
                  >
                    {isRegistering ? 'Already have an account? Login' : "Don't have an account? Register"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

      {/* Right Section - Design */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-indigo-600 to-purple-700 items-center justify-center overflow-hidden max-h-screen flex-col gap-8 p-12">
        <style>{`
          @keyframes shieldPulse {
            0%, 100% {
              transform: scale(1);
              box-shadow: 0 0 0px rgba(255, 255, 255, 0);
            }
            50% {
              transform: scale(1.05);
              box-shadow: 0 0 30px rgba(255, 255, 255, 0.6), 0 0 60px rgba(99, 102, 241, 0.4);
            }
          }
          .shield-pulse {
            animation: shieldPulse 2s ease-in-out infinite;
          }
        `}</style>
        <div className="text-center space-y-4">
          <div className="w-24 h-24 mx-auto bg-white/10 rounded-full flex items-center justify-center shield-pulse">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-10 h-10">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-white">Secure Access</h2>
          <p className="text-indigo-100 text-lg">Guard & Firearm Management System</p>
        </div>
        
        <div className="grid grid-cols-2 gap-6 w-full max-w-md">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white mb-2">24/7</div>
            <p className="text-sm text-indigo-100">Security</p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white mb-2">100%</div>
            <p className="text-sm text-indigo-100">Encrypted</p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white mb-2">∞</div>
            <p className="text-sm text-indigo-100">Scalable</p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white mb-2">✓</div>
            <p className="text-sm text-indigo-100">Verified</p>
          </div>
        </div>
        
        <div className="text-center">
          <p className="text-indigo-100 text-sm">Davao Security & Investigation Agency</p>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
