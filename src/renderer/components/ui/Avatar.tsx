import { cn } from '../../utils'

interface AvatarProps {
  name: string
  color?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  src?: string
}

const sizes = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
  xl: 'w-12 h-12 text-lg',
}

export function Avatar({ name, color, size = 'md', className, src }: AvatarProps) {
  const initials = name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const avatarColor = color || getColorFromName(name)

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn('rounded-full object-cover', sizes[size], className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-bold text-white select-none',
        sizes[size],
        className
      )}
      style={{ backgroundColor: avatarColor }}
      aria-label={name}
    >
      {initials}
    </div>
  )
}

function getColorFromName(name: string): string {
  const colors = [
    '#007acc', '#ff6b35', '#28ca42', '#a855f7',
    '#0ea5e9', '#f59e0b', '#ef4444', '#ec4899',
    '#14b8a6', '#8b5cf6', '#f97316', '#6366f1',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}