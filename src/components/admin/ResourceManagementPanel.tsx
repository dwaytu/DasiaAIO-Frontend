import { FC, FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, KeyRound, MapPin, Pencil, Plus, Search, Shield, Trash2, Truck, Users } from 'lucide-react'
import { API_BASE_URL } from '../../config'
import { fetchJsonOrThrow, getAuthHeaders } from '../../utils/api'
import { logError } from '../../utils/logger'
import { useOperationalMapData, ClientSiteInput } from '../../hooks/useOperationalMapData'
import { useAuth } from '../../hooks/useAuth'
import { normalizeRole, Role } from '../../types/auth'
import EmptyState from '../shared/EmptyState'
import LoadingSkeleton from '../shared/LoadingSkeleton'
import SentinelModal from '../shared/SentinelModal'
import EditUserModal from '../EditUserModal'
import CreateGuardAccountModal from './CreateGuardAccountModal'
import GuardPasswordModal from './GuardPasswordModal'

type ManageTab = 'guards' | 'firearms' | 'vehicles' | 'clients'

interface ResourceManagementPanelProps {
  users: any[]
  onDeleteUser: (id: string, email: string) => void
  onUsersChanged?: () => Promise<void> | void
  canManageUsers: boolean
  isSuperadminViewer: boolean
}

interface Firearm {
  id: string
  serialNumber: string
  model: string
  caliber: string
  status: string
  licenseExpiryDate?: string | null
  lastMaintenance?: string
}

interface ArmoredCar {
  id: string
  license_plate: string
  model: string
  manufacturer: string
  status: string
}

type UserCreateRole = 'guard' | 'supervisor' | 'admin' | 'superadmin'

const CREATABLE_ROLES_BY_VIEWER: Record<Role, UserCreateRole[]> = {
  superadmin: ['admin', 'supervisor', 'guard'],
  admin: ['supervisor', 'guard'],
  supervisor: ['guard'],
  guard: [],
}

const USER_ROLE_LABEL: Record<UserCreateRole, string> = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  supervisor: 'Supervisor',
  guard: 'Guard',
}

type UserCreationFormState = {
  fullName: string
  username: string
  email: string
  password: string
  phoneNumber: string
  role: UserCreateRole
  licenseNumber: string
  licenseIssuedDate: string
  licenseExpiryDate: string
}

type UserCreationField = keyof UserCreationFormState

type UserCreationErrors = Partial<Record<UserCreationField, string>>

const GUARD_PAGE_SIZE = 10

const TAB_CONFIG: { key: ManageTab; label: string; icon: FC<{ className?: string }> }[] = [
  { key: 'guards', label: 'Guards', icon: Users },
  { key: 'firearms', label: 'Firearms', icon: Shield },
  { key: 'vehicles', label: 'Vehicles', icon: Truck },
  { key: 'clients', label: 'Client Sites', icon: MapPin },
]

const ResourceManagementPanel: FC<ResourceManagementPanelProps> = ({
  users,
  onDeleteUser,
  onUsersChanged,
  canManageUsers,
  isSuperadminViewer,
}) => {
  const [activeTab, setActiveTab] = useState<ManageTab>('guards')

  return (
    <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full animate-fade-in space-y-6">
      <section className="soc-surface p-4 md:p-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-tertiary">Operations</p>
        <h1 className="text-2xl font-black uppercase tracking-wide text-text-primary">Resource Management</h1>
        <p className="mt-1 text-sm text-text-secondary">Centralized add, view, and remove for guards, firearms, vehicles, and client sites.</p>
      </section>

      <nav className="flex flex-wrap gap-2 rounded border border-border-subtle bg-surface p-2" aria-label="Resource tabs">
        {TAB_CONFIG.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            aria-current={activeTab === key ? 'page' : undefined}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold uppercase tracking-wide whitespace-nowrap transition-all duration-300 ${
              activeTab === key
                ? 'bg-(--color-info-bg) text-(--color-info-text) border border-(--color-info-border)'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>

      {activeTab === 'guards' && (
        <GuardsTab
          users={users}
          onDeleteUser={onDeleteUser}
          onUsersChanged={onUsersChanged}
          canManageUsers={canManageUsers}
          isSuperadminViewer={isSuperadminViewer}
        />
      )}
      {activeTab === 'firearms' && <FirearmsTab />}
      {activeTab === 'vehicles' && <VehiclesTab />}
      {activeTab === 'clients' && <ClientSitesTab />}
    </div>
  )
}

const GuardsTab: FC<{
  users: any[]
  onDeleteUser: (id: string, email: string) => void
  onUsersChanged?: () => Promise<void> | void
  canManageUsers: boolean
  isSuperadminViewer: boolean
}> = ({ users, onDeleteUser, onUsersChanged, canManageUsers, isSuperadminViewer }) => {
  const { user: currentUser } = useAuth()
  const guards = users.filter(
    (u) => (u.role || '').toLowerCase() === 'guard' || (u.role || '').toLowerCase() === 'user'
  )
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const filteredGuards = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    if (!normalizedSearch) return guards

    return guards.filter((guard) => [
      guard.full_name,
      guard.username,
      guard.email,
      guard.phone_number,
      guard.guard_number,
      guard.license_number,
    ].some((value) => String(value ?? '').toLowerCase().includes(normalizedSearch)))
  }, [guards, searchTerm])
  const pageCount = Math.max(1, Math.ceil(filteredGuards.length / GUARD_PAGE_SIZE))
  const visibleGuards = filteredGuards.slice(
    (currentPage - 1) * GUARD_PAGE_SIZE,
    currentPage * GUARD_PAGE_SIZE,
  )
  const firstVisibleGuard = filteredGuards.length === 0 ? 0 : (currentPage - 1) * GUARD_PAGE_SIZE + 1
  const lastVisibleGuard = Math.min(currentPage * GUARD_PAGE_SIZE, filteredGuards.length)
  const viewerRole = useMemo(() => normalizeRole(currentUser?.role), [currentUser?.role])
  const canManageGuardPassword = viewerRole === 'admin' || viewerRole === 'superadmin'
  const creatableRoles: UserCreateRole[] = viewerRole == null ? [] : CREATABLE_ROLES_BY_VIEWER[viewerRole]
  const nonGuardCreatableRoles = useMemo<UserCreateRole[]>(
    () => creatableRoles.filter((role) => role !== 'guard'),
    [creatableRoles],
  )
  const canCreateGuardAccount = creatableRoles.includes('guard')
  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [isCreateGuardOpen, setIsCreateGuardOpen] = useState(false)
  const [isSubmittingUser, setIsSubmittingUser] = useState(false)
  const [formErrors, setFormErrors] = useState<UserCreationErrors>({})
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')
  const [editUser, setEditUser] = useState<any>(null)
  const [passwordUser, setPasswordUser] = useState<any>(null)
  const [newUser, setNewUser] = useState<UserCreationFormState>({
    fullName: '',
    username: '',
    email: '',
    password: '',
    phoneNumber: '',
    role: nonGuardCreatableRoles[0] || 'guard',
    licenseNumber: '',
    licenseIssuedDate: '',
    licenseExpiryDate: '',
  })
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (nonGuardCreatableRoles.length > 0 && !nonGuardCreatableRoles.includes(newUser.role)) {
      setNewUser((prev) => ({ ...prev, role: nonGuardCreatableRoles[0] }))
    }
  }, [nonGuardCreatableRoles, newUser.role])

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, pageCount))
  }, [pageCount])

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSearchTerm(searchInput)
    setCurrentPage(1)
  }

  const clearSearch = () => {
    setSearchInput('')
    setSearchTerm('')
    setCurrentPage(1)
  }

  useEffect(() => {
    if (!isAddUserOpen) return

    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusTimer = window.setTimeout(() => {
      nameInputRef.current?.focus()
    }, 0)

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmittingUser) {
        setIsAddUserOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      window.clearTimeout(focusTimer)
      window.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = previousBodyOverflow
    }
  }, [isAddUserOpen, isSubmittingUser])

  const openAddUserModal = () => {
    if (nonGuardCreatableRoles.length === 0) return
    setFormErrors({})
    setCreateError('')
    setNewUser({
      fullName: '',
      username: '',
      email: '',
      password: '',
      phoneNumber: '',
      role: nonGuardCreatableRoles[0],
      licenseNumber: '',
      licenseIssuedDate: '',
      licenseExpiryDate: '',
    })
    setIsAddUserOpen(true)
  }

  const closeAddUserModal = () => {
    if (isSubmittingUser) return
    setIsAddUserOpen(false)
    setFormErrors({})
    setCreateError('')
  }

  const validateAddUserForm = (): UserCreationErrors => {
    const nextErrors: UserCreationErrors = {}
    const trimmedFullName = newUser.fullName.trim()
    const trimmedUsername = newUser.username.trim()
    const trimmedEmail = newUser.email.trim()
    const trimmedPhoneNumber = newUser.phoneNumber.trim()
    const trimmedLicenseNumber = newUser.licenseNumber.trim()

    if (!trimmedFullName) {
      nextErrors.fullName = 'Full name is required.'
    }

    if (!trimmedUsername) {
      nextErrors.username = 'Username is required.'
    } else if (trimmedUsername.length < 3) {
      nextErrors.username = 'Username must be at least 3 characters.'
    } else if (!/^[A-Za-z0-9_]+$/.test(trimmedUsername)) {
      nextErrors.username = 'Username can only include letters, numbers, and underscores.'
    }

    if (!trimmedEmail) {
      nextErrors.email = 'Email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      nextErrors.email = 'Enter a valid email address.'
    }

    if (!trimmedPhoneNumber) {
      nextErrors.phoneNumber = 'Phone number is required.'
    }

    if (!newUser.password) {
      nextErrors.password = 'Password is required.'
    } else if (newUser.password.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters.'
    }

    if (!creatableRoles.includes(newUser.role)) {
      nextErrors.role = 'Select an allowed role for your account permissions.'
    }

    if (newUser.role === 'guard') {
      if (!trimmedLicenseNumber) {
        nextErrors.licenseNumber = 'License number is required for guard accounts.'
      }

      if (!newUser.licenseIssuedDate) {
        nextErrors.licenseIssuedDate = 'License issue date is required for guard accounts.'
      }

      if (!newUser.licenseExpiryDate) {
        nextErrors.licenseExpiryDate = 'License expiry date is required for guard accounts.'
      }
    }

    return nextErrors
  }

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreateError('')
    setCreateSuccess('')

    const nextErrors = validateAddUserForm()
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors)
      return
    }

    setFormErrors({})
    setIsSubmittingUser(true)

    try {
      await fetchJsonOrThrow<any>(
        `${API_BASE_URL}/api/users`,
        {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            fullName: newUser.fullName.trim(),
            username: newUser.username.trim(),
            email: newUser.email.trim(),
            password: newUser.password,
            phoneNumber: newUser.phoneNumber.trim(),
            role: newUser.role,
            ...(newUser.role === 'guard' && {
              licenseNumber: newUser.licenseNumber.trim(),
              licenseIssuedDate: new Date(newUser.licenseIssuedDate).toISOString(),
              licenseExpiryDate: new Date(newUser.licenseExpiryDate).toISOString(),
            }),
          }),
        },
        'Failed to create user',
      )

      if (onUsersChanged) {
        await Promise.resolve(onUsersChanged())
      }

      setCreateSuccess('User created successfully.')
      setIsAddUserOpen(false)
      setNewUser({
        fullName: '',
        username: '',
        email: '',
        password: '',
        phoneNumber: '',
        role: nonGuardCreatableRoles[0] || 'guard',
        licenseNumber: '',
        licenseIssuedDate: '',
        licenseExpiryDate: '',
      })
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setIsSubmittingUser(false)
    }
  }

  const handleSaveEditUser = async (updatedData: Record<string, unknown>) => {
    if (!editUser) return

    await fetchJsonOrThrow<any>(
      `${API_BASE_URL}/api/users/${editUser.id}`,
      {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(updatedData),
      },
      'Failed to update user',
    )

    if (onUsersChanged) {
      await Promise.resolve(onUsersChanged())
    }

    setEditUser(null)
  }

  if (!canManageUsers) {
    return (
      <section className="table-glass rounded p-6">
        <EmptyState icon={Users} title="Insufficient permissions" subtitle="You do not have permission to manage users" />
      </section>
    )
  }

  return (
    <section className="soc-surface overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-border-subtle bg-surface-elevated/30 p-4 md:flex-row md:items-end md:justify-between md:p-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-tertiary">Personnel</p>
            <span className="soc-chip border border-info-border bg-info-bg text-info-text">{guards.length} registered</span>
          </div>
          <h2 className="mt-1 text-xl font-black uppercase tracking-wide text-text-primary">Guard roster</h2>
          <p className="mt-1 max-w-2xl text-sm text-text-secondary">
            Approved field personnel and their contact and license records.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {createSuccess && (
            <span className="rounded border border-success-border bg-success-bg px-3 py-2 text-xs font-semibold text-success-text" role="status">
              {createSuccess}
            </span>
          )}
          {canCreateGuardAccount && (
            <button
              type="button"
              onClick={() => setIsCreateGuardOpen(true)}
              className="soc-btn soc-btn-primary"
            >
              <Plus size={16} aria-hidden="true" />
              Create guard account
            </button>
          )}
          {nonGuardCreatableRoles.length > 0 && (
            <button
              type="button"
              onClick={openAddUserModal}
              className="soc-btn soc-btn-neutral"
            >
              <Plus size={16} aria-hidden="true" />
              Add account
            </button>
          )}
        </div>
      </div>

      <div className="p-4 md:p-6">
        {createError && (
          <div className="soc-alert-error mb-4 text-sm" role="alert">
            {createError}
          </div>
        )}

        {guards.length > 0 && (
          <form onSubmit={handleSearch} className="mb-4 flex flex-col gap-2 sm:flex-row" role="search">
            <label htmlFor="guard-roster-search" className="sr-only">Search guard roster</label>
            <input
              id="guard-roster-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search name, email, phone, or license"
              className="soc-input min-h-11 flex-1"
            />
            <button type="submit" className="soc-btn soc-btn-primary min-h-11">
              <Search size={16} aria-hidden="true" />
              Search
            </button>
            {searchTerm && (
              <button type="button" onClick={clearSearch} className="soc-btn soc-btn-neutral min-h-11">
                Clear
              </button>
            )}
          </form>
        )}

        {guards.length === 0 ? (
          <EmptyState icon={Users} title="No guards registered" subtitle="Guards will appear here once approved" />
        ) : filteredGuards.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Search size={28} className="text-text-tertiary" aria-hidden="true" />
            <div>
              <p className="font-semibold text-text-primary">No guards match your search</p>
              <p className="mt-1 text-sm text-text-secondary">Try a different name, email, phone number, or license.</p>
            </div>
            <button type="button" onClick={clearSearch} className="soc-btn soc-btn-neutral">
              Clear search
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-md border border-border-subtle">
              <table className="w-full min-w-[760px] border-collapse">
                <caption className="sr-only">Registered guard personnel</caption>
                <thead className="thead-glass">
                  <tr>
                    <th scope="col" className="w-[25%] px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">Name</th>
                    <th scope="col" className="w-[34%] px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">Email</th>
                    <th scope="col" className="w-[18%] px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.14em] text-text-secondary hidden md:table-cell">Phone</th>
                    <th scope="col" className="w-[15%] px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.14em] text-text-secondary hidden lg:table-cell">License</th>
                    {(isSuperadminViewer || canManageGuardPassword) && (
                      <th scope="col" className="w-[8%] px-4 py-3 text-right text-xs font-bold uppercase tracking-[0.14em] text-text-secondary">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visibleGuards.map((g) => (
                  <tr key={g.id} className="group border-b border-border-subtle last:border-b-0 hover:bg-surface-hover">
                    <td className="px-4 py-4 align-middle">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-info-border bg-info-bg text-xs font-black text-info-text">
                          {(g.full_name || g.username || '?').slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-text-primary">{g.full_name || g.username}</p>
                          <p className="mt-0.5 text-xs uppercase tracking-[0.12em] text-text-tertiary">Guard account</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-middle text-sm text-text-secondary">{g.email}</td>
                    <td className="px-4 py-4 align-middle text-sm tabular-nums text-text-secondary hidden md:table-cell">{g.phone_number || <span className="text-text-tertiary">Not provided</span>}</td>
                    <td className="px-4 py-4 align-middle text-sm text-text-secondary hidden lg:table-cell">
                      {g.license_number ? (
                        <div>
                          <p>{g.license_number}</p>
                          {g.license_expiry_date && (
                            <p className="mt-1 text-xs text-text-tertiary">
                              Expires {new Date(g.license_expiry_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-text-tertiary">Not provided</span>
                      )}
                    </td>
                    {(isSuperadminViewer || canManageGuardPassword) && (
                      <td className="px-4 py-4 align-middle text-right">
                        <div className="flex justify-end gap-2">
                          {canManageGuardPassword && (
                            <button
                              type="button"
                              onClick={() => setPasswordUser(g)}
                              className="soc-btn soc-btn-neutral"
                            >
                              <KeyRound size={15} aria-hidden="true" />
                              Password
                            </button>
                          )}
                          {isSuperadminViewer && (
                            <>
                          <button
                            type="button"
                            onClick={() => setEditUser(g)}
                            className="soc-btn soc-btn-neutral"
                          >
                            <Pencil size={15} aria-hidden="true" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteUser(g.id, g.email)}
                            className="soc-btn soc-btn-danger"
                          >
                            <Trash2 size={15} aria-hidden="true" />
                            Remove
                          </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t border-border-subtle pt-4 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between">
              <p>
                Showing <span className="font-semibold text-text-primary">{firstVisibleGuard}-{lastVisibleGuard}</span> of{' '}
                <span className="font-semibold text-text-primary">{filteredGuards.length}</span> guards
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                  className="soc-btn soc-btn-neutral min-h-11"
                  aria-label="Previous guard page"
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                  Previous
                </button>
                <span className="min-w-24 text-center font-semibold text-text-primary" aria-live="polite">
                  Page {currentPage} of {pageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
                  disabled={currentPage === pageCount}
                  className="soc-btn soc-btn-neutral min-h-11"
                  aria-label="Next guard page"
                >
                  Next
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <SentinelModal
        open={isAddUserOpen}
        onClose={closeAddUserModal}
        title="Add Account"
        subtitle="Create a non-guard account for personnel access."
      >
        <form onSubmit={handleCreateUser} className="space-y-4" noValidate>
              <div>
                <label htmlFor="add-user-name" className="mb-1 block text-sm font-semibold text-text-secondary">
                  Full Name <span aria-hidden="true" className="text-danger-text">*</span>
                </label>
                <input
                  id="add-user-name"
                  ref={nameInputRef}
                  type="text"
                  required
                  aria-required="true"
                  aria-invalid={formErrors.fullName ? 'true' : undefined}
                  aria-describedby={formErrors.fullName ? 'add-user-name-error' : undefined}
                  autoComplete="name"
                  value={newUser.fullName}
                  onChange={(event) => setNewUser((prev) => ({ ...prev, fullName: event.target.value }))}
                  className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-(--color-focus-ring)"
                />
                {formErrors.fullName && (
                  <p id="add-user-name-error" className="mt-1 text-xs text-danger-text">{formErrors.fullName}</p>
                )}
              </div>

              <div>
                <label htmlFor="add-user-username" className="mb-1 block text-sm font-semibold text-text-secondary">
                  Username <span aria-hidden="true" className="text-danger-text">*</span>
                </label>
                <input
                  id="add-user-username"
                  type="text"
                  required
                  aria-required="true"
                  aria-invalid={formErrors.username ? 'true' : undefined}
                  aria-describedby={formErrors.username ? 'add-user-username-error' : undefined}
                  autoComplete="username"
                  value={newUser.username}
                  onChange={(event) => setNewUser((prev) => ({ ...prev, username: event.target.value }))}
                  className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-(--color-focus-ring)"
                />
                {formErrors.username && (
                  <p id="add-user-username-error" className="mt-1 text-xs text-danger-text">{formErrors.username}</p>
                )}
              </div>

              <div>
                <label htmlFor="add-user-email" className="mb-1 block text-sm font-semibold text-text-secondary">
                  Email <span aria-hidden="true" className="text-danger-text">*</span>
                </label>
                <input
                  id="add-user-email"
                  type="email"
                  required
                  aria-required="true"
                  aria-invalid={formErrors.email ? 'true' : undefined}
                  aria-describedby={formErrors.email ? 'add-user-email-error' : undefined}
                  autoComplete="email"
                  value={newUser.email}
                  onChange={(event) => setNewUser((prev) => ({ ...prev, email: event.target.value }))}
                  className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-(--color-focus-ring)"
                />
                {formErrors.email && (
                  <p id="add-user-email-error" className="mt-1 text-xs text-danger-text">{formErrors.email}</p>
                )}
              </div>

              <div>
                <label htmlFor="add-user-password" className="mb-1 block text-sm font-semibold text-text-secondary">
                  Password <span aria-hidden="true" className="text-danger-text">*</span>
                </label>
                <input
                  id="add-user-password"
                  type="password"
                  required
                  minLength={6}
                  aria-required="true"
                  aria-invalid={formErrors.password ? 'true' : undefined}
                  aria-describedby={formErrors.password ? 'add-user-password-error' : undefined}
                  autoComplete="new-password"
                  value={newUser.password}
                  onChange={(event) => setNewUser((prev) => ({ ...prev, password: event.target.value }))}
                  className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-(--color-focus-ring)"
                />
                {formErrors.password && (
                  <p id="add-user-password-error" className="mt-1 text-xs text-danger-text">{formErrors.password}</p>
                )}
              </div>

              <div>
                <label htmlFor="add-user-phone" className="mb-1 block text-sm font-semibold text-text-secondary">
                  Phone Number <span aria-hidden="true" className="text-danger-text">*</span>
                </label>
                <input
                  id="add-user-phone"
                  type="tel"
                  required
                  aria-required="true"
                  aria-invalid={formErrors.phoneNumber ? 'true' : undefined}
                  aria-describedby={formErrors.phoneNumber ? 'add-user-phone-error' : undefined}
                  autoComplete="tel"
                  value={newUser.phoneNumber}
                  onChange={(event) => setNewUser((prev) => ({ ...prev, phoneNumber: event.target.value }))}
                  className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-(--color-focus-ring)"
                />
                {formErrors.phoneNumber && (
                  <p id="add-user-phone-error" className="mt-1 text-xs text-danger-text">{formErrors.phoneNumber}</p>
                )}
              </div>

              <div>
                <label htmlFor="add-user-role" className="mb-1 block text-sm font-semibold text-text-secondary">
                  Role <span aria-hidden="true" className="text-danger-text">*</span>
                </label>
                <select
                  id="add-user-role"
                  required
                  aria-required="true"
                  aria-invalid={formErrors.role ? 'true' : undefined}
                  aria-describedby={formErrors.role ? 'add-user-role-error' : undefined}
                  value={newUser.role}
                  onChange={(event) => setNewUser((prev) => ({ ...prev, role: event.target.value as UserCreateRole }))}
                  className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-(--color-focus-ring)"
                >
                  {nonGuardCreatableRoles.map((role: UserCreateRole) => (
                    <option key={role} value={role}>
                      {USER_ROLE_LABEL[role]}
                    </option>
                  ))}
                </select>
                {formErrors.role && (
                  <p id="add-user-role-error" className="mt-1 text-xs text-danger-text">{formErrors.role}</p>
                )}
              </div>

              {newUser.role === 'guard' && (
                <>
                  <div>
                    <label htmlFor="add-user-license" className="mb-1 block text-sm font-semibold text-text-secondary">
                      License Number <span aria-hidden="true" className="text-danger-text">*</span>
                    </label>
                    <input
                      id="add-user-license"
                      type="text"
                      required
                      aria-required="true"
                      aria-invalid={formErrors.licenseNumber ? 'true' : undefined}
                      aria-describedby={formErrors.licenseNumber ? 'add-user-license-error' : undefined}
                      value={newUser.licenseNumber}
                      onChange={(e) => setNewUser((prev) => ({ ...prev, licenseNumber: e.target.value }))}
                      className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-(--color-focus-ring)"
                    />
                    {formErrors.licenseNumber && (
                      <p id="add-user-license-error" className="mt-1 text-xs text-danger-text">{formErrors.licenseNumber}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="add-user-license-issued" className="mb-1 block text-sm font-semibold text-text-secondary">
                      License Issued Date <span aria-hidden="true" className="text-danger-text">*</span>
                    </label>
                    <input
                      id="add-user-license-issued"
                      type="date"
                      required
                      aria-required="true"
                      aria-invalid={formErrors.licenseIssuedDate ? 'true' : undefined}
                      aria-describedby={formErrors.licenseIssuedDate ? 'add-user-license-issued-error' : undefined}
                      value={newUser.licenseIssuedDate}
                      onChange={(e) => setNewUser((prev) => ({ ...prev, licenseIssuedDate: e.target.value }))}
                      className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-(--color-focus-ring)"
                    />
                    {formErrors.licenseIssuedDate && (
                      <p id="add-user-license-issued-error" className="mt-1 text-xs text-danger-text">{formErrors.licenseIssuedDate}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="add-user-license-expiry" className="mb-1 block text-sm font-semibold text-text-secondary">
                      License Expiry Date <span aria-hidden="true" className="text-danger-text">*</span>
                    </label>
                    <input
                      id="add-user-license-expiry"
                      type="date"
                      required
                      aria-required="true"
                      aria-invalid={formErrors.licenseExpiryDate ? 'true' : undefined}
                      aria-describedby={formErrors.licenseExpiryDate ? 'add-user-license-expiry-error' : undefined}
                      value={newUser.licenseExpiryDate}
                      onChange={(e) => setNewUser((prev) => ({ ...prev, licenseExpiryDate: e.target.value }))}
                      className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-(--color-focus-ring)"
                    />
                    {formErrors.licenseExpiryDate && (
                      <p id="add-user-license-expiry-error" className="mt-1 text-xs text-danger-text">{formErrors.licenseExpiryDate}</p>
                    )}
                  </div>
                </>
              )}

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeAddUserModal}
                  className="inline-flex min-h-11 items-center justify-center rounded border border-border px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-ring)"
                  disabled={isSubmittingUser}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="soc-btn soc-btn-primary"
                  disabled={isSubmittingUser}
                >
                  {isSubmittingUser ? 'Creating...' : 'Create User'}
                </button>
              </div>
        </form>
      </SentinelModal>

      <CreateGuardAccountModal
        isOpen={isCreateGuardOpen}
        onClose={() => setIsCreateGuardOpen(false)}
        viewerRole={viewerRole}
        onCreated={async () => {
          if (onUsersChanged) await Promise.resolve(onUsersChanged())
          setCreateSuccess('Guard account submitted successfully.')
        }}
      />

      <EditUserModal
        user={editUser}
        viewerRole={viewerRole ?? ''}
        onClose={() => setEditUser(null)}
        onSave={handleSaveEditUser}
      />

      <GuardPasswordModal
        user={passwordUser}
        onClose={() => setPasswordUser(null)}
        onSuccess={onUsersChanged}
      />
    </section>
  )
}

const FirearmsTab: FC = () => {
  const [firearms, setFirearms] = useState<Firearm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newFirearm, setNewFirearm] = useState({ serialNumber: '', model: '', caliber: '', licenseExpiryDate: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchFirearms()
  }, [])

  const fetchFirearms = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/api/firearms`, { headers: getAuthHeaders() })
      if (response.ok) {
        const data = await response.json()
        setFirearms(Array.isArray(data) ? data : (data.firearms || []))
      }
    } catch (err) {
      logError('Error fetching firearms:', err)
    } finally {
      setLoading(false)
    }
  }

  const addFirearm = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/firearms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(newFirearm),
      })
      if (!response.ok) throw new Error('Failed to add firearm')
      setSuccess('Firearm added successfully')
       setNewFirearm({ serialNumber: '', model: '', caliber: '', licenseExpiryDate: '' })
      setShowAddModal(false)
      await fetchFirearms()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add firearm')
    } finally {
      setSubmitting(false)
    }
  }

  const deleteFirearm = async (id: string) => {
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/firearms/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      if (!response.ok) throw new Error('Failed to remove firearm')
      setSuccess('Firearm removed successfully')
      await fetchFirearms()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove firearm')
    }
  }

  if (loading) return <LoadingSkeleton variant="table" />

  return (
    <section className="table-glass rounded p-4 md:p-6 space-y-4">
      <div className="flex flex-col gap-4 border-b border-border-subtle pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-tertiary">Armory</p>
            <span className="soc-chip border border-info-border bg-info-bg text-info-text">{firearms.length} registered</span>
          </div>
          <h2 className="mt-1 text-xl font-black uppercase tracking-wide text-text-primary">Firearm inventory</h2>
          <p className="mt-1 text-sm text-text-secondary">Registered firearms, license expiry, and current availability.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="soc-btn soc-btn-primary"
        >
          <Plus size={16} aria-hidden="true" />
          Add Firearm
        </button>
      </div>

      {error && <div className="p-3 bg-danger-bg border border-danger-border rounded text-danger-text text-sm">{error}</div>}
      {success && <div className="p-3 bg-success-bg border border-success-border rounded text-success-text text-sm">{success}</div>}

      <SentinelModal
        open={showAddModal}
        onClose={() => {
          if (!submitting) setShowAddModal(false)
        }}
        title="Add Firearm"
        subtitle="Register a new firearm in the armory"
      >
        <form onSubmit={addFirearm} noValidate className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="firearm-serial" className="soc-form-label">Serial Number</label>
              <input id="firearm-serial" type="text" required value={newFirearm.serialNumber} onChange={(e) => setNewFirearm({ ...newFirearm, serialNumber: e.target.value })} className="soc-form-control w-full" />
            </div>
            <div>
              <label htmlFor="firearm-model" className="soc-form-label">Model</label>
              <input id="firearm-model" type="text" required value={newFirearm.model} onChange={(e) => setNewFirearm({ ...newFirearm, model: e.target.value })} className="soc-form-control w-full" />
            </div>
            <div>
              <label htmlFor="firearm-caliber" className="soc-form-label">Caliber</label>
              <input id="firearm-caliber" type="text" required value={newFirearm.caliber} onChange={(e) => setNewFirearm({ ...newFirearm, caliber: e.target.value })} className="soc-form-control w-full" placeholder="e.g., 9mm" />
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="firearm-license-expiry" className="soc-form-label">License Expiration Date <span className="font-normal text-text-tertiary">(required for compliance)</span></label>
              <input id="firearm-license-expiry" type="date" value={newFirearm.licenseExpiryDate} onChange={(e) => setNewFirearm({ ...newFirearm, licenseExpiryDate: e.target.value })} className="soc-form-control w-full" />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="soc-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? 'Adding...' : 'Add Firearm'}
          </button>
        </form>
      </SentinelModal>

      {firearms.length === 0 ? (
        <EmptyState icon={Shield} title="No firearms registered" subtitle="Add firearms to the inventory to get started" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="thead-glass">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Serial</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Model</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider hidden sm:table-cell">Caliber</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">License Expiry</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {firearms.map((f) => (
                <tr key={f.id} className="border-b border-border hover:bg-surface-hover">
                  <td className="px-4 py-3 text-text-primary text-sm">{f.serialNumber}</td>
                  <td className="px-4 py-3 text-text-primary text-sm">{f.model}</td>
                  <td className="px-4 py-3 text-text-secondary text-sm hidden sm:table-cell">{f.caliber}</td>
                  <td className="px-4 py-3 text-text-primary text-sm">{f.licenseExpiryDate ? new Date(f.licenseExpiryDate).toLocaleDateString() : 'N/A'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                      f.status === 'available' ? 'bg-success-bg text-success-text ring-1 ring-success-border' :
                      f.status === 'deployed' ? 'bg-info-bg text-info-text ring-1 ring-info-border' :
                      f.status === 'maintenance' ? 'bg-warning-bg text-warning-text ring-1 ring-warning-border' :
                      'soc-status-neutral'
                    }`}>
                      {f.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => deleteFirearm(f.id)}
                      className="soc-btn soc-btn-danger"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

const VehiclesTab: FC = () => {
  const [cars, setCars] = useState<ArmoredCar[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [newCar, setNewCar] = useState({ licensePlate: '' })

  useEffect(() => {
    fetchCars()
  }, [])

  const fetchCars = async () => {
    try {
      setLoading(true)
      const data = await fetchJsonOrThrow<ArmoredCar[]>(
        `${API_BASE_URL}/api/armored-cars`,
        { headers: getAuthHeaders() },
        'Failed to fetch vehicles'
      )
      setCars(data)
    } catch (err) {
      logError('Error fetching vehicles:', err)
    } finally {
      setLoading(false)
    }
  }

  const addCar = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/armored-cars`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(newCar),
      })
      if (!response.ok) throw new Error('Failed to add vehicle')
      setSuccess('Vehicle added successfully')
      setNewCar({ licensePlate: '' })
      setShowAddModal(false)
      await fetchCars()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add vehicle')
    } finally {
      setSubmitting(false)
    }
  }

  const deleteVehicle = async (id: string) => {
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/armored-cars/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      if (!response.ok) throw new Error('Failed to remove vehicle')
      setSuccess('Vehicle removed successfully')
      await fetchCars()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove vehicle')
    }
  }

  if (loading) return <LoadingSkeleton variant="table" />

  return (
    <section className="table-glass rounded p-4 md:p-6 space-y-4">
      <div className="flex flex-col gap-4 border-b border-border-subtle pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-tertiary">Fleet</p>
            <span className="soc-chip border border-info-border bg-info-bg text-info-text">{cars.length} registered</span>
          </div>
          <h2 className="mt-1 text-xl font-black uppercase tracking-wide text-text-primary">Vehicle fleet</h2>
          <p className="mt-1 text-sm text-text-secondary">Armored vehicles are added manually and tracked by A/C number.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="soc-btn soc-btn-primary"
        >
          <Plus size={16} aria-hidden="true" />
          Add Vehicle
        </button>
      </div>

      {error && <div className="p-3 bg-danger-bg border border-danger-border rounded text-danger-text text-sm">{error}</div>}
      {success && <div className="p-3 bg-success-bg border border-success-border rounded text-success-text text-sm">{success}</div>}

      <SentinelModal
        open={showAddModal}
        onClose={() => {
          if (!submitting) setShowAddModal(false)
        }}
        title="Add Vehicle"
        subtitle="Register an armored vehicle by A/C number"
      >
        <form onSubmit={addCar} noValidate className="space-y-3">
          <div>
            <label htmlFor="vehicle-plate" className="block text-xs font-semibold text-text-secondary mb-1">A/C number</label>
            <input id="vehicle-plate" type="text" required autoFocus value={newCar.licensePlate} onChange={(e) => setNewCar({ licensePlate: e.target.value })} className="w-full px-3 py-2 text-sm border border-border rounded bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-(--color-focus-ring)" />
          </div>
          <button type="submit" disabled={submitting} className="soc-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? 'Adding...' : 'Add Vehicle'}
          </button>
        </form>
      </SentinelModal>

      {cars.length === 0 ? (
        <EmptyState icon={Truck} title="No vehicles in fleet" subtitle="Register armored vehicles to manage the fleet" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="thead-glass">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">A/C number</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cars.map((car) => (
                <tr key={car.id} className="border-b border-border hover:bg-surface-hover">
                  <td className="px-4 py-3 text-text-primary text-sm">{car.license_plate}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                      car.status === 'available' ? 'bg-success-bg text-success-text ring-1 ring-success-border' :
                      car.status === 'allocated' ? 'bg-warning-bg text-warning-text ring-1 ring-warning-border' :
                      car.status === 'maintenance' ? 'bg-info-bg text-info-text ring-1 ring-info-border' :
                      'soc-status-neutral'
                    }`}>
                      {car.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => deleteVehicle(car.id)}
                      className="soc-btn soc-btn-danger"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

const ClientSitesTab: FC = () => {
  const { clientSites, createClientSite, deleteClientSite } = useOperationalMapData()
  const [showAddModal, setShowAddModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [newSite, setNewSite] = useState<ClientSiteInput>({
    name: '',
    latitude: 7.4478,
    longitude: 125.8078,
    address: '',
  })

  const addSite = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await createClientSite(newSite)
      setSuccess('Client site created')
      setNewSite({ name: '', latitude: 7.4478, longitude: 125.8078, address: '' })
      setShowAddModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create site')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteClientSite(id)
      setSuccess('Site deleted')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete site')
    }
  }

  return (
    <section className="table-glass rounded p-4 md:p-6 space-y-4">
      <div className="flex flex-col gap-4 border-b border-border-subtle pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-tertiary">Locations</p>
            <span className="soc-chip border border-info-border bg-info-bg text-info-text">{clientSites.length} registered</span>
          </div>
          <h2 className="mt-1 text-xl font-black uppercase tracking-wide text-text-primary">Client sites</h2>
          <p className="mt-1 text-sm text-text-secondary">Geofenced sites used for assignments, attendance, and tracking.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="soc-btn soc-btn-primary"
        >
          <Plus size={16} aria-hidden="true" />
          Add Site
        </button>
      </div>

      {error && <div className="p-3 bg-danger-bg border border-danger-border rounded text-danger-text text-sm">{error}</div>}
      {success && <div className="p-3 bg-success-bg border border-success-border rounded text-success-text text-sm">{success}</div>}

      <SentinelModal
        open={showAddModal}
        onClose={() => {
          if (!submitting) setShowAddModal(false)
        }}
        title="Add Client Site"
        subtitle="Register a geofenced site for guard tracking"
      >
        <form onSubmit={addSite} noValidate className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="sm:col-span-2 lg:col-span-1">
              <label htmlFor="site-name" className="block text-xs font-semibold text-text-secondary mb-1">Site Name</label>
              <input id="site-name" type="text" required value={newSite.name} onChange={(e) => setNewSite({ ...newSite, name: e.target.value })} className="w-full px-3 py-2 text-sm border border-border rounded bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-(--color-focus-ring)" />
            </div>
            <div>
              <label htmlFor="site-lat" className="block text-xs font-semibold text-text-secondary mb-1">Latitude</label>
              <input id="site-lat" type="number" step="any" required value={newSite.latitude} onChange={(e) => setNewSite({ ...newSite, latitude: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 text-sm border border-border rounded bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-(--color-focus-ring)" />
            </div>
            <div>
              <label htmlFor="site-lng" className="block text-xs font-semibold text-text-secondary mb-1">Longitude</label>
              <input id="site-lng" type="number" step="any" required value={newSite.longitude} onChange={(e) => setNewSite({ ...newSite, longitude: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 text-sm border border-border rounded bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-(--color-focus-ring)" />
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <label htmlFor="site-address" className="block text-xs font-semibold text-text-secondary mb-1">Address</label>
              <input id="site-address" type="text" value={newSite.address || ''} onChange={(e) => setNewSite({ ...newSite, address: e.target.value })} className="w-full px-3 py-2 text-sm border border-border rounded bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-(--color-focus-ring)" />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="soc-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? 'Creating...' : 'Create Site'}
          </button>
        </form>
      </SentinelModal>

      {clientSites.length === 0 ? (
        <EmptyState icon={MapPin} title="No client sites" subtitle="Add geofenced client sites for guard tracking" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="thead-glass">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider hidden sm:table-cell">Address</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider hidden md:table-cell">Coordinates</th>
                <th className="px-4 py-3 text-right font-semibold text-text-secondary border-b-2 border-border text-sm uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clientSites.map((site) => (
                <tr key={site.id} className="border-b border-border hover:bg-surface-hover">
                  <td className="px-4 py-3 text-text-primary text-sm">{site.name}</td>
                  <td className="px-4 py-3 text-text-secondary text-sm hidden sm:table-cell">{site.address || '-'}</td>
                  <td className="px-4 py-3 text-text-secondary text-xs font-mono hidden md:table-cell">{site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(site.id)}
                      className="soc-btn soc-btn-danger"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default ResourceManagementPanel
