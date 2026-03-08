import { FC, ReactNode } from 'react'
import { can, Permission } from '../../utils/permissions'

interface AllowedProps {
  role: unknown
  permission: Permission
  fallback?: ReactNode
  children: ReactNode
}

const Allowed: FC<AllowedProps> = ({ role, permission, fallback = null, children }) => {
  if (!can(role, permission)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

export default Allowed
