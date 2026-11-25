import { Minimize, Maximize, X, Menu, Square } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import { cn } from '../utils'
import { Button } from './ui/Button'

export function TitleBar() {
  const sidebarOpen = useAppStore(state => state.sidebarOpen)
  const toggleSidebar = useAppStore(state => state.toggleSidebar)

  const handleMinimize = () => window.electron.window.minimize()
  const handleMaximize = () => window.electron.window.maximize()
  const handleClose = () => window.electron.window.close()

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 h-10 bg-background/80 backdrop-blur-sm border-b border-border z-50 flex items-center justify-between px-4',
        'select-none -webkit-app-region: drag'
      )}
      style={{ WebkitAppRegion: 'drag' }}
    >
      <div className="flex items-center gap-3 h-full -webkit-app-region: no-drag" style={{ WebkitAppRegion: 'no-drag' }}>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          <Menu className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <svg className="h-4 w-4 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-medium text-foreground text-sm">FreeBot</span>
        </div>
      </div>

      <div className="flex items-center gap-1 h-full -webkit-app-region: no-drag" style={{ WebkitAppRegion: 'no-drag' }}>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-10 p-0 hover:bg-accent/10 transition-colors"
          onClick={handleMinimize}
          aria-label="Minimize"
        >
          <Minimize className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-10 p-0 hover:bg-accent/10 transition-colors"
          onClick={handleMaximize}
          aria-label="Maximize"
        >
          <Square className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-10 p-0 hover:bg-destructive/20 hover:text-destructive transition-colors"
          onClick={handleClose}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}