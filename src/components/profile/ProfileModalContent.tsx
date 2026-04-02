import { ChangeEvent, FC, useEffect, useRef, useState } from 'react'
import { User } from '../../App'
import { API_BASE_URL } from '../../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../../utils/api'
import {
  registerServiceWorker,
  requestPushPermission,
  subscribeToPush,
  unsubscribeFromPush,
} from '../../utils/pushNotifications'
import { logError } from '../../utils/logger'

type ProfileModalContentProps = {
  user: User
  mode?: 'page' | 'modal'
  onBack?: () => void
  onClose?: () => void
  onProfilePhotoUpdate?: (photoUrl: string) => void
}

type ProfileFormState = {
  fullName: string
  phoneNumber: string
  email: string
  licenseNumber: string
  licenseIssuedDate: string
  licenseExpiryDate: string
  address: string
}

const HeadingTag = {
  page: 'h1',
  modal: 'h2',
} as const

function toDateInputValue(value?: string): string {
  if (!value) return ''

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString().split('T')[0]
}

function getReadableRequestMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback
  }

  if (/timed out/i.test(error.message)) {
    return 'The request timed out. Try again when your connection is stable.'
  }

  if (/offline/i.test(error.message)) {
    return 'You appear to be offline. Reconnect and try again.'
  }

  return error.message || fallback
}

export const ProfileModalContent: FC<ProfileModalContentProps> = ({
  user,
  mode = 'page',
  onBack,
  onClose,
  onProfilePhotoUpdate,
}) => {
  const [profilePhoto, setProfilePhoto] = useState<string>(user.profilePhoto || '')
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [formData, setFormData] = useState<ProfileFormState>({
    fullName: user.fullName || '',
    phoneNumber: user.phoneNumber || '',
    email: user.email || '',
    licenseNumber: user.licenseNumber || '',
    licenseIssuedDate: toDateInputValue(user.licenseIssuedDate),
    licenseExpiryDate: toDateInputValue(user.licenseExpiryDate),
    address: user.address || '',
  })
  const [saving, setSaving] = useState(false)
  const [isAvailable, setIsAvailable] = useState<boolean>(true)
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [isPushEnabled, setIsPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isErrorMessage = /failed|error|invalid|unable|offline|timed out/i.test(message)
  const TitleTag = HeadingTag[mode]

  useEffect(() => {
    if (!message) return undefined

    const timer = window.setTimeout(() => setMessage(''), 3000)
    return () => window.clearTimeout(timer)
  }, [message])

  useEffect(() => {
    if (user.role !== 'guard') return undefined

    let cancelled = false

    const fetchAvailability = async () => {
      try {
        const data = await fetchJsonOrThrow<{ available?: boolean }>(
          `${API_BASE_URL}/api/guard-replacement/availability/${user.id}`,
          { headers: getAuthHeaders() },
          'Unable to load availability status.',
        )

        if (!cancelled) {
          setIsAvailable(data.available ?? true)
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(getReadableRequestMessage(error, 'Unable to load availability status.'))
        }
      }
    }

    void fetchAvailability()

    return () => {
      cancelled = true
    }
  }, [user.id, user.role])

  useEffect(() => {
    let cancelled = false

    const checkPushState = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

      await registerServiceWorker()
      const registration = await navigator.serviceWorker.getRegistration('/sw.js')
      if (!registration || cancelled) return

      const subscription = await registration.pushManager.getSubscription()
      if (!cancelled) {
        setIsPushEnabled(subscription !== null)
      }
    }

    void checkPushState()

    return () => {
      cancelled = true
    }
  }, [])

  const handlePhotoClick = () => {
    fileInputRef.current?.click()
  }

  const handleToggleAvailability = async () => {
    setAvailabilityLoading(true)

    try {
      const nextAvailability = !isAvailable
      await fetchJsonOrThrow(
        `${API_BASE_URL}/api/guard-replacement/set-availability`,
        {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ guardId: user.id, available: nextAvailability }),
        },
        'Unable to update availability status.',
      )

      setIsAvailable(nextAvailability)
      setMessage(nextAvailability ? 'Availability marked as active.' : 'Availability marked as unavailable.')
    } catch (error) {
      setMessage(getReadableRequestMessage(error, 'Unable to update availability status.'))
    } finally {
      setAvailabilityLoading(false)
    }
  }

  const handleTogglePush = async () => {
    setPushLoading(true)

    try {
      if (isPushEnabled) {
        await unsubscribeFromPush()
        setIsPushEnabled(false)
        setMessage('Push notifications disabled for this device.')
      } else {
        const granted = await requestPushPermission()
        if (!granted) {
          setMessage('Push permission was not granted on this device.')
          return
        }

        const subscribed = await subscribeToPush(user.id)
        if (!subscribed) {
          setMessage('Unable to enable push notifications right now.')
          return
        }

        setIsPushEnabled(true)
        setMessage('Push notifications enabled for this device.')
      }
    } catch (error) {
      setMessage(getReadableRequestMessage(error, 'Unable to update push notification status.'))
    } finally {
      setPushLoading(false)
    }
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setMessage('Please select an image file.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage('Image size should be less than 5MB.')
      return
    }

    setUploading(true)
    setMessage('')

    try {
      const base64String = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('Failed to read image file.'))
        reader.readAsDataURL(file)
      })

      await fetchJsonOrThrow(
        `${API_BASE_URL}/api/user/${user.id}/profile-photo`,
        {
          method: 'PUT',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ profilePhoto: base64String }),
        },
        'Failed to upload photo.',
      )

      setProfilePhoto(base64String)
      onProfilePhotoUpdate?.(base64String)
      setMessage('Profile photo updated successfully!')
    } catch (error) {
      logError('Error uploading photo:', error)
      setMessage(getReadableRequestMessage(error, 'Failed to upload photo. Please try again.'))
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  const handleRemovePhoto = async () => {
    try {
      await fetchJsonOrThrow(
        `${API_BASE_URL}/api/user/${user.id}/profile-photo`,
        {
          method: 'DELETE',
          headers: getAuthHeaders(),
        },
        'Failed to remove photo.',
      )

      setProfilePhoto('')
      onProfilePhotoUpdate?.('')
      setMessage('Profile photo removed.')
    } catch (error) {
      setMessage(getReadableRequestMessage(error, 'Failed to remove photo.'))
    }
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target
    setFormData((previous) => ({ ...previous, [name]: value }))
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    setMessage('')

    try {
      await fetchJsonOrThrow(
        `${API_BASE_URL}/api/user/${user.id}`,
        {
          method: 'PUT',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            fullName: formData.fullName,
            phoneNumber: formData.phoneNumber,
            email: formData.email,
            licenseNumber: formData.licenseNumber || undefined,
            licenseIssuedDate: formData.licenseIssuedDate || undefined,
            licenseExpiryDate: formData.licenseExpiryDate || undefined,
            address: formData.address || undefined,
          }),
        },
        'Failed to update profile.',
      )

      setMessage('Profile updated successfully!')
    } catch (error) {
      logError('Error updating profile:', error)
      setMessage(getReadableRequestMessage(error, 'Failed to update profile. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  const getInitials = () => {
    const name = formData.fullName || user.fullName || user.username
    const nameParts = name.split(' ').filter(Boolean)
    if (nameParts.length >= 2) {
      return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
    }

    return name.substring(0, 2).toUpperCase()
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="soc-surface p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-tertiary">Profile Control</p>
            <TitleTag className="mt-1 text-2xl font-bold text-text-primary md:text-3xl">
              Account Settings
            </TitleTag>
            <p className="mt-2 text-sm text-text-secondary">
              Manage identity details, contact data, and profile media used across operational dashboards.
            </p>
          </div>
          {mode === 'modal' ? (
            <div className="flex flex-wrap gap-2">
              {onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="min-h-11 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-primary hover:bg-surface-hover"
                  aria-label="Back to mission shell"
                >
                  Back to Mission Shell
                </button>
              ) : null}
              {onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-11 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-primary hover:bg-surface-hover"
                  aria-label="Close profile"
                >
                  Close
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {message ? (
        <div className={`rounded-lg p-4 ${isErrorMessage ? 'soc-alert-error' : 'soc-alert-success'}`}>
          {message}
        </div>
      ) : null}

      <div className="command-panel p-4 md:p-6">
        <h3 className="mb-4 text-xl font-bold text-text-primary md:text-2xl">Profile Photo</h3>

        <div className="flex flex-col items-center gap-6 md:flex-row">
          <div className="relative group">
            <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-500 to-blue-700 text-4xl font-bold text-white shadow-lg">
              {profilePhoto ? (
                <img src={profilePhoto} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span>{getInitials()}</span>
              )}
            </div>

            <button
              type="button"
              className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
              onClick={handlePhotoClick}
              aria-label="Change profile photo"
            >
              <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>

          <div className="flex-1 text-center md:text-left">
            <h4 className="mb-2 text-lg font-semibold text-text-primary">Upload New Photo</h4>
            <p className="mb-4 text-sm text-text-secondary">JPG, PNG or GIF. Max size 5MB.</p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(event) => void handleFileChange(event)}
              className="hidden"
            />

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handlePhotoClick}
                disabled={uploading}
                className="soc-btn min-h-11"
              >
                {uploading ? 'Uploading...' : 'Choose Photo'}
              </button>

              {profilePhoto ? (
                <button
                  type="button"
                  onClick={() => void handleRemovePhoto()}
                  className="min-h-11 rounded-lg border border-danger-border bg-surface px-6 py-2.5 font-semibold text-danger-text transition-colors hover:bg-danger-bg"
                >
                  Remove Photo
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {user.role === 'guard' ? (
        <div className="command-panel p-4 md:p-6">
          <h3 className="mb-1 text-xl font-bold text-text-primary md:text-2xl">Availability Status</h3>
          <p className="mb-4 text-sm text-text-secondary">Signal to supervisors whether you are available for shift assignments or replacements.</p>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface p-4">
            <div>
              <p className="font-semibold text-text-primary">
                {isAvailable ? 'Available for Duty' : 'Not Available'}
              </p>
              <p className="text-xs text-text-secondary">
                {isAvailable
                  ? 'You will appear in replacement and scheduling pools.'
                  : 'You are marked unavailable. Supervisors will not assign you.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isAvailable}
              disabled={availabilityLoading}
              onClick={() => void handleToggleAvailability()}
              className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 ${
                isAvailable ? 'bg-green-500' : 'bg-zinc-500'
              }`}
              aria-label={isAvailable ? 'Mark yourself as unavailable' : 'Mark yourself as available'}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isAvailable ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      ) : null}

      {'Notification' in window ? (
        <div className="command-panel p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text-primary">Push Notifications</p>
              <p className="text-xs text-text-secondary">
                {isPushEnabled
                  ? 'You will receive alerts for geofence exits, incidents, and shift changes.'
                  : 'Enable to receive real-time alerts on this device.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isPushEnabled}
              disabled={pushLoading}
              onClick={() => void handleTogglePush()}
              className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 ${
                isPushEnabled ? 'bg-indigo-500' : 'bg-zinc-500'
              }`}
              aria-label={isPushEnabled ? 'Disable push notifications' : 'Enable push notifications'}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isPushEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      ) : null}

      <div className="command-panel p-4 md:p-6">
        <h3 className="mb-4 text-xl font-bold text-text-primary md:text-2xl">Account Information</h3>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label htmlFor="profile-full-name" className="mb-2 block text-sm font-semibold text-text-primary">Full Name</label>
            <input
              id="profile-full-name"
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter your full name"
            />
          </div>

          <div>
            <label htmlFor="profile-email" className="mb-2 block text-sm font-semibold text-text-primary">Email</label>
            <input
              id="profile-email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label htmlFor="profile-phone-number" className="mb-2 block text-sm font-semibold text-text-primary">Phone Number</label>
            <input
              id="profile-phone-number"
              type="text"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="+63-###-###-####"
            />
          </div>

          <div>
            <label htmlFor="profile-username" className="mb-2 block text-sm font-semibold text-text-primary">Username</label>
            <input
              id="profile-username"
              type="text"
              value={user.username}
              disabled
              className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-text-tertiary"
            />
          </div>

          {user.role !== 'admin' ? (
            <>
              <div>
                <label htmlFor="profile-license-number" className="mb-2 block text-sm font-semibold text-text-primary">License Number</label>
                <input
                  id="profile-license-number"
                  type="text"
                  name="licenseNumber"
                  value={formData.licenseNumber}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter license number"
                />
              </div>

              <div>
                <label htmlFor="profile-license-issued-date" className="mb-2 block text-sm font-semibold text-text-primary">License Issued Date</label>
                <input
                  id="profile-license-issued-date"
                  type="date"
                  name="licenseIssuedDate"
                  value={formData.licenseIssuedDate}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="profile-license-expiry-date" className="mb-2 block text-sm font-semibold text-text-primary">License Expiry Date</label>
                <input
                  id="profile-license-expiry-date"
                  type="date"
                  name="licenseExpiryDate"
                  value={formData.licenseExpiryDate}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="profile-address" className="mb-2 block text-sm font-semibold text-text-primary">Full Address</label>
                <textarea
                  id="profile-address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  rows={2}
                  className="w-full rounded-lg border border-border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter complete address"
                />
              </div>
            </>
          ) : null}

          <div>
            <label htmlFor="profile-role" className="mb-2 block text-sm font-semibold text-text-primary">Role</label>
            <input
              id="profile-role"
              type="text"
              value={user.role.toUpperCase()}
              disabled
              className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-text-tertiary"
            />
          </div>

          <div>
            <label htmlFor="profile-user-id" className="mb-2 block text-sm font-semibold text-text-primary">User ID</label>
            <input
              id="profile-user-id"
              type="text"
              value={user.id}
              disabled
              className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-sm text-text-tertiary"
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={() => void handleSaveProfile()}
            disabled={saving}
            className="soc-btn"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProfileModalContent