import { Fragment, ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../utils'
import { Button } from './Button'

interface DialogProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  showClose?: boolean
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-4xl',
}

export function Dialog({ open, onClose, title, description, children, size = 'md', showClose = true }: DialogProps) {
  if (!open) return null

  return (
    <Fragment>
      <div
        className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-slide-up">
        <div
          className={cn(
            'w-full bg-mac-sidebar border border-mac-border rounded-xl shadow-xl overflow-hidden',
            sizes[size]
          )}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'dialog-title' : undefined}
          aria-describedby={description ? 'dialog-description' : undefined}
          onClick={e => e.stopPropagation()}
        >
          {(title || showClose) && (
            <div className="flex items-center justify-between px-4 py-3 border-b border-mac-border">
              <div>
                {title && (
                  <h2 id="dialog-title" className="text-lg font-semibold text-mac-text">
                    {title}
                  </h2>
                )}
                {description && (
                  <p id="dialog-description" className="text-sm text-mac-textMuted mt-0.5">
                    {description}
                  </p>
                )}
              </div>
              {showClose && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
          <div className="p-4 max-h-[70vh] overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    </Fragment>
  )
}

interface DialogHeaderProps {
  title: string
  description?: string
}

export function DialogHeader({ title, description }: DialogHeaderProps) {
  return (
    <div className="mb-4">
      <h3 className="text-lg font-semibold text-mac-text">{title}</h3>
      {description && (
        <p className="text-sm text-mac-textMuted mt-1">{description}</p>
      )}
    </div>
  )
}

export function DialogContent({ children }: { children: ReactNode }) {
  return <div>{children}</div>
}

interface DialogFooterProps {
  children: ReactNode
}

export function DialogFooter({ children }: DialogFooterProps) {
  return (
    <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-mac-border">
      {children}
    </div>
  )
}