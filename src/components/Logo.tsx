import { FC, MouseEvent } from 'react'
import SentinelLogo from './SentinelLogo'

interface LogoProps {
  onClick?: (e: MouseEvent<HTMLDivElement>) => void
  size?: 'sm' | 'md' | 'lg'
  horizontal?: boolean
  logoOnly?: boolean
  forceDark?: boolean
}

const sizeToPixels: Record<'sm' | 'md' | 'lg', number> = {
  sm: 32,
  md: 40,
  lg: 56,
}

const Logo: FC<LogoProps> = ({ onClick, size = 'md', horizontal = true, logoOnly = false }) => {
  return (
    <div
      onClick={onClick}
      className={onClick ? 'cursor-pointer' : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(e as unknown as MouseEvent<HTMLDivElement>)
        }
      } : undefined}
    >
      <SentinelLogo size={sizeToPixels[size]} variant={logoOnly ? 'IconOnly' : 'FullLogo'} className={!horizontal ? '' : 'items-center'} animated />
    </div>
  )
}

export default Logo
