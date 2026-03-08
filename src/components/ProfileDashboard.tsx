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
    licenseIssuedDate: user.licenseIssuedDate ? new Date(user.licenseIssuedDate).toISOString().split('T')[0] : '',
    licenseExpiryDate: user.licenseExpiryDate ? new Date(user.licenseExpiryDate).toISOString().split('T')[0] : '',
    address: user.address || ''
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
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token')}`
            },
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

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target as HTMLInputElement | HTMLTextAreaElement
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    setMessage('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/user/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          fullName: formData.fullName,
          phoneNumber: formData.phoneNumber,
          email: formData.email,
          licenseNumber: formData.licenseNumber || undefined,
          licenseIssuedDate: formData.licenseIssuedDate || undefined,
          licenseExpiryDate: formData.licenseExpiryDate || undefined,
          address: formData.address || undefined
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

  const navItems = user.role === 'admin' || user.role === 'superadmin' || user.role === 'supervisor' ? [
    { view: 'dashboard', label: 'Dashboard', group: 'MAIN MENU' },
    { view: 'analytics', label: 'Analytics', group: 'MAIN MENU' },
    { view: 'schedule', label: 'Schedule', group: 'OPERATIONS' },
    { view: 'firearms', label: 'Firearms', group: 'RESOURCES' },
    { view: 'allocation', label: 'Allocation', group: 'RESOURCES' },
    { view: 'permits', label: 'Permits', group: 'RESOURCES' },
    { view: 'maintenance', label: 'Maintenance', group: 'RESOURCES' },
    { view: 'armored-cars', label: 'Armored Cars', group: 'RESOURCES' },
  ] : [
    { view: 'overview', label: 'Dashboard', group: 'MAIN MENU' },
    { view: 'schedule', label: 'Schedule', group: 'MAIN MENU' },
    { view: 'firearms', label: 'Firearms', group: 'RESOURCES' },
    { view: 'permits', label: 'My Permits', group: 'RESOURCES' },
    { view: 'support', label: 'Support', group: 'RESOURCES' },
  ]

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
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
              className="px-3 md:px-4 py-2 text-sm font-semibold text-text-primary bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors flex items-center gap-2"
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
            <div className="bg-surface rounded-xl shadow-md p-6 md:p-8 mb-6">
              <h2 className="text-2xl font-bold text-text-primary mb-6">Profile Photo</h2>
              
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
                  <h3 className="text-lg font-semibold text-text-primary mb-2">Upload New Photo</h3>
                  <p className="text-sm text-text-secondary mb-4">JPG, PNG or GIF. Max size 5MB.</p>
                  
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
                              method: 'DELETE',
                              headers: {
                                Authorization: `Bearer ${localStorage.getItem('token')}`
                              }
                            })
                            setProfilePhoto('')
                            setMessage('Profile photo removed')
                            setTimeout(() => setMessage(''), 3000)
                          } catch (error) {
                            setMessage('Failed to remove photo')
                          }
                        }}
                      className="px-6 py-2.5 bg-surface border border-red-300 text-red-600 hover:bg-red-50 font-semibold rounded-lg transition-colors"
                      >
                        Remove Photo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Account Information */}
            <div className="bg-surface rounded-xl shadow-md p-6 md:p-8">
              <h2 className="text-2xl font-bold text-text-primary mb-6">Account Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-2">Full Name</label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter your full name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-2">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter your email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-2">Phone Number</label>
                  <input
                    type="text"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="+63-###-###-####"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-2">Username</label>
                  <input
                    type="text"
                    value={user.username}
                    disabled
                    className="w-full px-4 py-2.5 border border-border rounded-lg bg-surface-elevated text-text-tertiary"
                  />
                </div>

                {user.role !== 'admin' && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-text-primary mb-2">License Number</label>
                      <input
                        type="text"
                        name="licenseNumber"
                        value={formData.licenseNumber}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Enter license number"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-text-primary mb-2">License Issued Date</label>
                      <input
                        type="date"
                        name="licenseIssuedDate"
                        value={formData.licenseIssuedDate}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-text-primary mb-2">License Expiry Date</label>
                      <input
                        type="date"
                        name="licenseExpiryDate"
                        value={formData.licenseExpiryDate}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-text-primary mb-2">Full Address</label>
                      <textarea
                        name="address"
                        value={formData.address}
                        onChange={handleInputChange}
                        rows={2}
                        className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Enter complete address"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-2">Role</label>
                  <input
                    type="text"
                    value={user.role.toUpperCase()}
                    disabled
                    className="w-full px-4 py-2.5 border border-border rounded-lg bg-surface-elevated text-text-tertiary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-2">User ID</label>
                  <input
                    type="text"
                    value={user.id}
                    disabled
                    className="w-full px-4 py-2.5 border border-border rounded-lg bg-surface-elevated text-text-tertiary text-sm"
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
