import { ChangeEvent, FC, useEffect, useMemo, useRef, useState } from 'react'
import type { User } from '../../context/AuthContext'
import { API_BASE_URL } from '../../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../../utils/api'
import { useAuth } from '../../hooks/useAuth'
import { logError } from '../../utils/logger'
import ConfirmationDialog from '../shared/ConfirmationDialog'
import ProfilePhotoCropDialog from './ProfilePhotoCropDialog'

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

type ProfileDetails = {
  guardCode?: string
  verified?: boolean
  lastSeenAt?: string
  createdAt?: string
  updatedAt?: string
}

type ProfileResponse = Record<string, unknown>

const HeadingTag = { page: 'h1', modal: 'h2' } as const

const toDateInputValue = (value?: string): string => {
  if (!value) return ''
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10)
}

const readValue = (source: Record<string, unknown>, camelKey: string, snakeKey: string): string | undefined => {
  const value = source[camelKey] ?? source[snakeKey]
  return typeof value === 'string' ? value : undefined
}

const formFromUser = (source: User): ProfileFormState => ({
  fullName: source.fullName || source.full_name || '',
  phoneNumber: source.phoneNumber || source.phone_number || '',
  email: source.email || '',
  licenseNumber: source.licenseNumber || source.license_number || '',
  licenseIssuedDate: toDateInputValue(source.licenseIssuedDate || source.license_issued_date),
  licenseExpiryDate: toDateInputValue(source.licenseExpiryDate || source.license_expiry_date),
  address: source.address || '',
})

const normalizeForm = (form: ProfileFormState): ProfileFormState => ({
  fullName: form.fullName.trim(),
  phoneNumber: form.phoneNumber.trim(),
  email: form.email.trim(),
  licenseNumber: form.licenseNumber.trim(),
  licenseIssuedDate: form.licenseIssuedDate,
  licenseExpiryDate: form.licenseExpiryDate,
  address: form.address.trim(),
})

const readProfileDetails = (source: Record<string, unknown>): ProfileDetails => ({
  guardCode: readValue(source, 'guardCode', 'guard_code'),
  verified: typeof source.verified === 'boolean' ? source.verified : undefined,
  lastSeenAt: readValue(source, 'lastSeenAt', 'last_seen_at'),
  createdAt: readValue(source, 'createdAt', 'created_at'),
  updatedAt: readValue(source, 'updatedAt', 'updated_at'),
})

const formatDate = (value?: string): string => {
  if (!value) return 'Not available'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 'Not available' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed)
}

const getReadableRequestMessage = (error: unknown, fallback: string): string => {
  if (!(error instanceof Error)) return fallback
  if (/timed out/i.test(error.message)) return 'The request timed out. Try again when your connection is stable.'
  if (/offline/i.test(error.message)) return 'You appear to be offline. Reconnect and try again.'
  return error.message || fallback
}

export const ProfileModalContent: FC<ProfileModalContentProps> = ({ user, mode = 'page', onBack, onClose, onProfilePhotoUpdate }) => {
  const { updateUser } = useAuth()
  const [profilePhoto, setProfilePhoto] = useState<string>(user.profilePhoto || user.profile_photo || '')
  const [formData, setFormData] = useState<ProfileFormState>(() => formFromUser(user))
  const [savedFormData, setSavedFormData] = useState<ProfileFormState>(() => formFromUser(user))
  const [details, setDetails] = useState<ProfileDetails>(() => readProfileDetails(user))
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [removingPhoto, setRemovingPhoto] = useState(false)
  const [removePhotoOpen, setRemovePhotoOpen] = useState(false)
  const [photoToCrop, setPhotoToCrop] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const TitleTag = HeadingTag[mode]
  const isGuard = user.role === 'guard'
  const isDirty = useMemo(() => JSON.stringify(normalizeForm(formData)) !== JSON.stringify(normalizeForm(savedFormData)), [formData, savedFormData])
  const isErrorMessage = /failed|error|invalid|unable|offline|timed out/i.test(message)

  useEffect(() => {
    setProfilePhoto(user.profilePhoto || user.profile_photo || '')
  }, [user.profilePhoto, user.profile_photo])

  useEffect(() => {
    const controller = new AbortController()
    const loadProfileDetails = async () => {
      try {
        const response = await fetchJsonOrThrow<ProfileResponse>(
          `${API_BASE_URL}/api/user/${user.id}`,
          { headers: getAuthHeaders(), signal: controller.signal },
          'Unable to load account details.',
        )
        if (controller.signal.aborted) return
        const currentDetails = readProfileDetails(response)
        setDetails(currentDetails)
        updateUser({
          guardCode: currentDetails.guardCode,
          guard_code: currentDetails.guardCode,
          verified: currentDetails.verified,
          lastSeenAt: currentDetails.lastSeenAt,
          last_seen_at: currentDetails.lastSeenAt,
          createdAt: currentDetails.createdAt,
          created_at: currentDetails.createdAt,
          updatedAt: currentDetails.updatedAt,
          updated_at: currentDetails.updatedAt,
        })
      } catch (error) {
        if ((error as Error)?.name !== 'AbortError') logError('Unable to load profile details:', error)
      }
    }
    void loadProfileDetails()
    return () => controller.abort()
  }, [updateUser, user.id])

  useEffect(() => {
    if (!message) return undefined
    const timer = window.setTimeout(() => setMessage(''), 4000)
    return () => window.clearTimeout(timer)
  }, [message])

  useEffect(() => {
    if (!photoToCrop) return undefined
    return () => URL.revokeObjectURL(photoToCrop)
  }, [photoToCrop])

  const getInitials = () => {
    const parts = (formData.fullName || user.username).split(' ').filter(Boolean)
    return parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() : (parts[0] || '').slice(0, 2).toUpperCase()
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target
    setFormData((previous) => ({ ...previous, [name]: value }))
    setValidationErrors((previous) => ({ ...previous, [name]: '' }))
  }

  const validateProfile = (): boolean => {
    const nextErrors: Record<string, string> = {}
    const normalized = normalizeForm(formData)
    if (!normalized.fullName) nextErrors.fullName = 'Enter your full name.'
    if (!normalized.email) nextErrors.email = 'Enter an email address.'
    else if (!/^\S+@\S+\.\S+$/.test(normalized.email)) nextErrors.email = 'Enter a valid email address, such as name@example.com.'
    setValidationErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSaveProfile = async () => {
    if (!isDirty || saving || !validateProfile()) return
    const nextForm = normalizeForm(formData)
    setSaving(true)
    setMessage('')
    try {
      await fetchJsonOrThrow(
        `${API_BASE_URL}/api/user/${user.id}`,
        {
          method: 'PUT',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            fullName: nextForm.fullName,
            phoneNumber: nextForm.phoneNumber || undefined,
            email: nextForm.email,
            licenseNumber: nextForm.licenseNumber || undefined,
            licenseIssuedDate: nextForm.licenseIssuedDate || undefined,
            licenseExpiryDate: nextForm.licenseExpiryDate || undefined,
            address: nextForm.address || undefined,
          }),
        },
        'Unable to save your profile.',
      )
      setFormData(nextForm)
      setSavedFormData(nextForm)
      updateUser({
        fullName: nextForm.fullName, full_name: nextForm.fullName,
        phoneNumber: nextForm.phoneNumber || undefined, phone_number: nextForm.phoneNumber || undefined,
        email: nextForm.email,
        licenseNumber: nextForm.licenseNumber || undefined, license_number: nextForm.licenseNumber || undefined,
        licenseIssuedDate: nextForm.licenseIssuedDate || undefined, license_issued_date: nextForm.licenseIssuedDate || undefined,
        licenseExpiryDate: nextForm.licenseExpiryDate || undefined, license_expiry_date: nextForm.licenseExpiryDate || undefined,
        address: nextForm.address || undefined,
      })
      setMessage('Profile updated successfully.')
    } catch (error) {
      logError('Unable to save profile:', error)
      setMessage(getReadableRequestMessage(error, 'Unable to save your profile. Check the highlighted fields and try again.'))
    } finally {
      setSaving(false)
    }
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage('Choose a JPG, PNG, or WebP image.')
      event.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage('Choose an image smaller than 5 MB.')
      event.target.value = ''
      return
    }
    setMessage('')
    setPhotoToCrop(URL.createObjectURL(file))
    event.target.value = ''
  }

  const uploadProfilePhoto = async (profilePhotoData: string) => {
    if (uploading) return
    setUploading(true)
    setMessage('')
    try {
      await fetchJsonOrThrow(`${API_BASE_URL}/api/user/${user.id}/profile-photo`, {
        method: 'PUT', headers: getAuthHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ profilePhoto: profilePhotoData }),
      }, 'Unable to upload photo.')
      setProfilePhoto(profilePhotoData)
      updateUser({ profilePhoto: profilePhotoData, profile_photo: profilePhotoData })
      onProfilePhotoUpdate?.(profilePhotoData)
      setMessage('Profile photo updated successfully.')
    } catch (error) {
      logError('Unable to upload profile photo:', error)
      const readableMessage = getReadableRequestMessage(error, 'Unable to upload photo. Try again.')
      setMessage(readableMessage)
      throw new Error(readableMessage)
    } finally {
      setUploading(false)
    }
  }

  const removePhoto = async () => {
    setRemovingPhoto(true)
    try {
      await fetchJsonOrThrow(`${API_BASE_URL}/api/user/${user.id}/profile-photo`, { method: 'DELETE', headers: getAuthHeaders() }, 'Unable to remove photo.')
      setProfilePhoto('')
      updateUser({ profilePhoto: '', profile_photo: '' })
      onProfilePhotoUpdate?.('')
      setMessage('Profile photo removed.')
    } catch (error) {
      setMessage(getReadableRequestMessage(error, 'Unable to remove photo. Try again.'))
    } finally {
      setRemovingPhoto(false)
    }
  }

  const metadata = [
    ['Username', user.username],
    ['Role', user.role.charAt(0).toUpperCase() + user.role.slice(1)],
    ['Account status', details.verified === true ? 'Verified' : details.verified === false ? 'Verification required' : 'Not available'],
    ...(isGuard && details.guardCode ? [['Guard ID', details.guardCode]] : []),
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="soc-surface p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-text-tertiary">Account</p><TitleTag className="mt-1 text-2xl font-bold text-text-primary md:text-3xl">Profile</TitleTag><p className="mt-2 text-sm leading-6 text-text-secondary">Review your identity, contact details, and role-relevant credentials.</p></div>
          {mode === 'modal' ? <div className="flex flex-wrap gap-2">{onBack ? <button type="button" onClick={onBack} className="soc-btn soc-btn-neutral min-h-11">Back to Mission Shell</button> : null}{onClose ? <button type="button" onClick={onClose} aria-label="Close profile" className="soc-btn soc-btn-neutral min-h-11">Close</button> : null}</div> : null}
        </div>
      </section>

      {message ? <div className={`rounded p-4 text-sm ${isErrorMessage ? 'soc-alert-error' : 'soc-alert-success'}`} role={isErrorMessage ? 'alert' : 'status'}>{message}</div> : null}

      <section className="command-panel p-4 md:p-6" aria-labelledby="profile-photo-title">
        <h2 id="profile-photo-title" className="text-xl font-bold text-text-primary md:text-2xl">Profile Photo</h2>
        <div className="mt-4 flex flex-col items-center gap-6 md:flex-row">
          <div className="relative group"><div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-500 to-blue-700 text-4xl font-bold text-white shadow-lg">{profilePhoto ? <img src={profilePhoto} alt="Profile" className="h-full w-full object-cover" /> : <span>{getInitials()}</span>}</div><button type="button" className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100" onClick={() => fileInputRef.current?.click()} aria-label={profilePhoto ? 'Change profile photo' : 'Upload profile photo'}><span className="text-sm font-semibold text-white">{profilePhoto ? 'Change' : 'Upload'}</span></button></div>
          <div className="flex-1 text-center md:text-left"><h3 className="text-lg font-semibold text-text-primary">{profilePhoto ? 'Change photo' : 'Upload photo'}</h3><p className="mt-2 text-sm leading-6 text-text-secondary">JPG, PNG, or WebP. Maximum file size: 5 MB. You can position the photo before saving.</p><input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} className="sr-only" /><div className="mt-4 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="soc-btn min-h-11">{uploading ? 'Saving Photo...' : profilePhoto ? 'Change Photo' : 'Upload Photo'}</button>{profilePhoto ? <button type="button" onClick={() => setRemovePhotoOpen(true)} disabled={removingPhoto} className="soc-btn-danger min-h-11 disabled:cursor-not-allowed disabled:opacity-50">Remove Photo</button> : null}</div></div>
        </div>
      </section>

      <section className="command-panel p-4 md:p-6" aria-labelledby="personal-information-title">
        <h2 id="personal-information-title" className="text-xl font-bold text-text-primary md:text-2xl">Personal Information</h2>
        <p className="mt-2 text-sm leading-6 text-text-secondary">Keep your contact information current so operations staff can reach you when needed.</p>
        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
          {([
            ['fullName', 'Full Name', 'Enter your full name', 'text', true],
            ['email', 'Email', 'name@example.com', 'email', true],
            ['phoneNumber', 'Phone Number', '+63-###-###-####', 'tel', false],
          ] as const).map(([name, label, placeholder, type, required]) => <div key={name}><label htmlFor={`profile-${name}`} className="soc-form-label">{label}{required ? <> <span aria-hidden="true">*</span></> : null}</label><input id={`profile-${name}`} type={type} name={name} value={formData[name]} onChange={handleInputChange} className="soc-form-control w-full" placeholder={placeholder} aria-required={required} aria-invalid={Boolean(validationErrors[name])} aria-describedby={validationErrors[name] ? `profile-${name}-error` : undefined} />{validationErrors[name] ? <p id={`profile-${name}-error`} className="mt-1 text-sm text-danger-text" role="alert">{validationErrors[name]}</p> : null}</div>)}
          <div className="md:col-span-2"><label htmlFor="profile-address" className="soc-form-label">Address</label><textarea id="profile-address" name="address" value={formData.address} onChange={handleInputChange} rows={3} className="soc-form-control w-full" placeholder="Enter your complete address" /></div>
        </div>
      </section>

      {isGuard ? <section className="command-panel p-4 md:p-6" aria-labelledby="credentials-title"><h2 id="credentials-title" className="text-xl font-bold text-text-primary md:text-2xl">License and Credentials</h2><p className="mt-2 text-sm leading-6 text-text-secondary">Keep your guard license details current for compliance review.</p><div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-3"><div><label htmlFor="profile-license-number" className="soc-form-label">License Number</label><input id="profile-license-number" type="text" name="licenseNumber" value={formData.licenseNumber} onChange={handleInputChange} className="soc-form-control w-full" placeholder="Enter license number" /></div><div><label htmlFor="profile-license-issued-date" className="soc-form-label">Issued Date</label><input id="profile-license-issued-date" type="date" name="licenseIssuedDate" value={formData.licenseIssuedDate} onChange={handleInputChange} className="soc-form-control w-full" /></div><div><label htmlFor="profile-license-expiry-date" className="soc-form-label">Expiry Date</label><input id="profile-license-expiry-date" type="date" name="licenseExpiryDate" value={formData.licenseExpiryDate} onChange={handleInputChange} className="soc-form-control w-full" /></div></div></section> : null}

      <section className="command-panel p-4 md:p-6" aria-labelledby="account-information-title"><h2 id="account-information-title" className="text-xl font-bold text-text-primary md:text-2xl">Account Information</h2><dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">{metadata.map(([label, value]) => <div key={label} className="rounded border border-border bg-surface p-4"><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">{label}</dt><dd className="mt-1 break-words font-semibold text-text-primary">{value}</dd></div>)}</dl></section>

      <section className="command-panel p-4 md:p-6" aria-labelledby="account-activity-title"><h2 id="account-activity-title" className="text-xl font-bold text-text-primary md:text-2xl">Account Activity</h2><p className="mt-2 text-sm leading-6 text-text-secondary">Recent account metadata recorded by SENTINEL.</p><dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3"><div className="rounded border border-border bg-surface p-4"><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">Recent activity</dt><dd className="mt-1 text-sm font-semibold text-text-primary">{formatDate(details.lastSeenAt)}</dd></div><div className="rounded border border-border bg-surface p-4"><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">Account created</dt><dd className="mt-1 text-sm font-semibold text-text-primary">{formatDate(details.createdAt)}</dd></div><div className="rounded border border-border bg-surface p-4"><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">Profile updated</dt><dd className="mt-1 text-sm font-semibold text-text-primary">{formatDate(details.updatedAt)}</dd></div></dl></section>

      <div className="flex justify-end"><button type="button" onClick={() => void handleSaveProfile()} disabled={!isDirty || saving} className="soc-btn min-h-11 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving...' : 'Save Profile'}</button></div>

      <ConfirmationDialog open={removePhotoOpen} onClose={() => setRemovePhotoOpen(false)} onConfirm={removePhoto} title="Remove profile photo?" description="Your profile will show your initials until you upload another photo." confirmLabel="Remove Photo" confirmingLabel="Removing..." tone="danger" />
      <ProfilePhotoCropDialog open={Boolean(photoToCrop)} imageSource={photoToCrop} onClose={() => setPhotoToCrop(null)} onConfirm={uploadProfilePhoto} />
    </div>
  )
}

export default ProfileModalContent
