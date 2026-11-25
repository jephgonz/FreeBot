import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import '../index.css'

// Error boundary for graceful error handling
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

const root = createRoot(document.getElementById('root')!)

root.render(
  <StrictMode>
    <ErrorBoundary
      fallback={
        <div className="min-h-screen bg-mac-bg flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-mac-red/10 flex items-center justify-center mx-auto mb-4">
              <svg className="h-8 w-8 text-mac-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-mac-text mb-2">Something went wrong</h2>
            <p className="text-mac-textMuted text-sm mb-4">
              An unexpected error occurred. Please restart the app.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-mac-accent text-white rounded-lg hover:bg-mac-accentHover transition-colors"
            >
              Reload App
            </button>
          </div>
        </div>
      }
    >
      <App />
    </ErrorBoundary>
  </StrictMode>
)