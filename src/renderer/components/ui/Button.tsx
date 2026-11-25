import { forwardRef, ButtonHTMLAttributes } from 'react'
import { cn } from '../../utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-mac-accent disabled:opacity-50 disabled:cursor-not-allowed'

    const variants = {
      primary: 'bg-mac-accent text-white hover:bg-mac-accentHover',
      secondary: 'bg-mac-hover text-mac-text hover:bg-mac-border',
      ghost: 'bg-transparent hover:bg-mac-hover text-mac-text',
      danger: 'bg-mac-red/20 text-mac-red hover:bg-mac-red/30',
    }

    const sizes = {
      sm: 'px-2.5 py-1 text-xs gap-1.5',
      md: 'px-3 py-1.5 text-sm gap-2',
      lg: 'px-4 py-2 text-base gap-2',
    }

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'