import { FC, useState, useRef, ChangeEvent } from 'react'
import { User } from '../App'
import { API_BASE_URL } from '../config'
import Sidebar from './Sidebar'
import Header from './Header'

interface ProfileDashboardProps {
  user: User
  onLogout: () => void
  onBack: () => void
  onProfilePhotoUpdate?: (photoUrl: string) => void
}

const ProfileDashboard: FC<ProfileDashboardProps> = ({ user, onLogout, onBack, onProfilePhotoUpdate }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [profilePhoto, setProfilePhoto] = useState<string>(user.profilePhoto || '')
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [formData, setFormData] = useState({
    fullName: user.fullName || '',
    phoneNumber: user.phoneNumber || '',
    email: user.email || '',
    licenseNumber: user.licenseNumber || '',
    licenseExpiryDate: user.licenseExpiryDate ? new Date(user.licenseExpiryDate).toISOString().split('T')[0] : ''
  })
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePhotoClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage('Image size should be less than 5MB')
      return
    }

    setUploading(true)
    setMessage('')

    try {
      // Convert to base64
      const reader = new FileReader()
      reader.onloadend = async () => {
        try {
          const base64String = reader.result as string

          // Upload to backend
          const response = await fetch(`${API_BASE_URL}/api/user/${user.id}/profile-photo`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profilePhoto: base64String })
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.message || 'Failed to upload photo')
          }

          setProfilePhoto(base64String)
          if (onProfilePhotoUpdate) {
            onProfilePhotoUpdate(base64String)
          }
          setMessage('Profile photo updated successfully!')
          setTimeout(() => setMessage(''), 3000)
          setUploading(false)
        } catch (error) {
          console.error('Error uploading photo:', error)
          setMessage('Failed to upload photo. Please try again.')
          setUploading(false)
        }
      }

      reader.onerror = () => {
        setMessage('Failed to read image file')
        setUploading(false)
      }

      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Error reading file:', error)
      setMessage('Failed to read image file. Please try again.')
      setUploading(false)
    }
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    setMessage('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/user/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName,
          phoneNumber: formData.phoneNumber,
          email: formData.email,
          licenseNumber: formData.licenseNumber || undefined,
          licenseExpiryDate: formData.licenseExpiryDate || undefined
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update profile')
      }

      setMessage('Profile updated successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      console.error('Error updating profile:', error)
      setMessage('Failed to update profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const getInitials = () => {
    if (formData.fullName) {
      const names = formData.fullName.split(' ')
      if (names.length >= 2) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
      }
      return formData.fullName.substring(0, 2).toUpperCase()
    }
    return user.username.substring(0, 2).toUpperCase()
  }

  const navItems = user.role === 'superadmin' || user.role === 'admin' ? [
    { view: 'dashboard', label: 'Dashboard' },
    { view: 'schedule', label: 'Schedule' },
    { view: 'firearms', label: 'Firearms' },
    { view: 'allocation', label: 'Allocation' },
    { view: 'permits', label: 'Permits' },
    { view: 'maintenance', label: 'Maintenance' },
    { view: 'armored-cars', label: 'Armored Cars' },
    { view: 'analytics', label: 'Analytics' }
  ] : [
    { view: 'overview', label: 'Dashboard' },
    { view: 'schedule', label: 'Schedule' },
    { view: 'firearms', label: 'Firearms' },
    { view: 'permits', label: 'My Permits' },
    { view: 'support', label: 'Support' }
  ]

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50">
      <Sidebar
        activeView="profile"
        items={navItems}
        onNavigate={() => onBack()}
        onLogoClick={onBack}
        onLogout={onLogout}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <Header
          title="Account Settings"
          badgeLabel="Profile"
          onLogout={onLogout}
          onMenuClick={() => setMobileMenuOpen(true)}
          user={user}
          rightSlot={
            <button
              onClick={onBack}
              className="px-3 md:px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="hidden md:inline">Back</span>
            </button>
          }
        />

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-4xl mx-auto">
            {/* Success/Error Message */}
            {message && (
              <div className={`mb-6 p-4 rounded-lg ${message.includes('success') ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                {message}
              </div>
            )}

            {/* Profile Photo Section */}
            <div className="bg-white rounded-xl shadow-md p-6 md:p-8 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Profile Photo</h2>
              
              <div className="flex flex-col md:flex-row items-center gap-6">
                {/* Photo Preview */}
                <div className="relative group">
                  <div className="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
                    {profilePhoto ? (
                      <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-4xl font-bold">{getInitials()}</span>
                    )}
                  </div>
                  
                  {/* Overlay on hover */}
                  <div className="absolute inset-0 rounded-full bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={handlePhotoClick}>
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                </div>

                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload New Photo</h3>
                  <p className="text-sm text-gray-600 mb-4">JPG, PNG or GIF. Max size 5MB.</p>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={handlePhotoClick}
                      disabled={uploading}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
                    >
                      {uploading ? 'Uploading...' : 'Choose Photo'}
                    </button>
                    
                    {profilePhoto && (
                      <button
                        onClick={async () => {
                          try {
                            await fetch(`${API_BASE_URL}/api/user/${user.id}/profile-photo`, {
                              method: 'DELETE'
                            })
                            setProfilePhoto('')
                            setMessage('Profile photo removed')
                            setTimeout(() => setMessage(''), 3000)
                          } catch (error) {
                            setMessage('Failed to remove photo')
                          }
                        }}
                        className="px-6 py-2.5 bg-white border border-red-300 text-red-600 hover:bg-red-50 font-semibold rounded-lg transition-colors"
                      >
                        Remove Photo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Account Information */}
            <div className="bg-white rounded-xl shadow-md p-6 md:p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Account Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter your full name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter your email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
                  <input
                    type="text"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="+63-###-###-####"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Username</label>
                  <input
                    type="text"
                    value={user.username}
                    disabled
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                  />
                </div>

                {user.role !== 'admin' && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">License Number</label>
                      <input
                        type="text"
                        name="licenseNumber"
                        value={formData.licenseNumber}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Enter license number"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">License Expiry Date</label>
                      <input
                        type="date"
                        name="licenseExpiryDate"
                        value={formData.licenseExpiryDate}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Role</label>
                  <input
                    type="text"
                    value={user.role.toUpperCase()}
                    disabled
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">User ID</label>
                  <input
                    type="text"
                    value={user.id}
                    disabled
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 text-sm"
                  />
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors shadow-md hover:shadow-lg"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default ProfileDashboard
