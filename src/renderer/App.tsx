import { useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { Sidebar } from './components/Sidebar'
import { ChatArea } from './components/ChatArea'
import { Composer } from './components/Composer'
import { Settings } from './components/Settings'
import { TitleBar } from './components/TitleBar'
import { useAppStore } from './stores/appStore'
import { useConfig, useBots } from './hooks/useConfig'

export function App() {
  const { config, setConfig, setActiveBot, initialized } = useConfig()
  const { bots, activeBotId, setActiveBotId } = useBots()
  const sidebarOpen = useAppStore(state => state.sidebarOpen)

  // Sync active bot when config loads
  useEffect(() => {
    if (config && activeBotId) {
      const bot = bots.find(b => b.id === activeBotId)
      if (bot) setActiveBot(bot)
    }
  }, [config, bots, activeBotId, setActiveBot])

  if (!initialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading FreeBot...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Custom Title Bar */}
      <TitleBar />

      {/* Main Content */}
      <div className="flex-1 flex pt-10">
        <Sidebar />

        <main className="flex-1 flex flex-col min-w-0 ml-72 transition-all duration-200">
          <ChatArea />
          <Composer />
        </main>
      </div>

      {/* Settings Dialog */}
      <Settings />

      {/* Toasts */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: 'bg-card border border-border text-foreground',
          duration: 4000,
          style: {
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-foreground)',
          },
          success: {
            iconTheme: {
              primary: '#28ca42',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ff5f57',
              secondary: '#fff',
            },
          },
        }}
      />
    </div>
  )
}