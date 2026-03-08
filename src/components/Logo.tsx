import { FC, MouseEvent } from 'react'
import SentinelLogo from './SentinelLogo'

interface LogoProps {
  onClick?: (e: MouseEvent<HTMLDivElement>) => void
  size?: 'sm' | 'md' | 'lg'
  horizontal?: boolean
  logoOnly?: boolean
  forceDark?: boolean
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
      <SentinelLogo size={size} stacked={!horizontal} showText={!logoOnly} />
    </div>
  )
}

export default Logo
