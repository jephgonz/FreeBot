import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { AppConfig, Bot, ChatMessage, ApiKey, Personality } from '../types'
import { PERSONALITIES, getPersonality } from './personalities'

interface AppState {
  // Config
  config: AppConfig | null
  setConfig: (config: AppConfig) => void
  updateConfig: (updates: Partial<AppConfig>) => void

  // Active bot
  activeBot: Bot | null
  setActiveBot: (bot: Bot | null) => void

  // Chat
  messages: ChatMessage[]
  setMessages: (messages: ChatMessage[]) => void
  addMessage: (message: ChatMessage) => void
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void
  clearMessages: () => void

  // Streaming
  isStreaming: boolean
  setIsStreaming: (streaming: boolean) => void

  // UI State
  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void

  settingsOpen: boolean
  toggleSettings: () => void

  // Personalities
  personalities: Personality[]
  getPersonality: (id: string) => Personality | undefined

  // Loading states
  isLoading: boolean
  setIsLoading: (loading: boolean) => void

  // Error handling
  error: string | null
  setError: (error: string | null) => void
}

const DEFAULT_CONFIG: AppConfig = {
  gatewayUrl: 'http://127.0.0.1:8000/v1',
  apiKeys: [],
  bots: [],
  activeBotId: null,
  theme: 'dark',
  settings: {
    launchAtStartup: false,
    notificationsEnabled: true,
    streamingEnabled: true,
    autoSaveHistory: true,
  },
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Config
      config: null,
      setConfig: (config) => set({ config, activeBot: config?.bots?.find(b => b.id === config.activeBotId) || null }),
      updateConfig: (updates) => set((state) => ({
        config: state.config ? { ...state.config, ...updates } : { ...DEFAULT_CONFIG, ...updates },
      })),

      // Active bot
      activeBot: null,
      setActiveBot: (bot) => set({ activeBot: bot }),

      // Chat
      messages: [],
      setMessages: (messages) => set({ messages }),
      addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
      updateMessage: (id, updates) => set((state) => ({
        messages: state.messages.map(m => m.id === id ? { ...m, ...updates } : m),
      })),
      clearMessages: () => set({ messages: [] }),

      // Streaming
      isStreaming: false,
      setIsStreaming: (streaming) => set({ isStreaming: streaming }),

      // UI State
      sidebarOpen: true,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      settingsOpen: false,
      toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),

      // Personalities
      personalities: PERSONALITIES,
      getPersonality: (id) => getPersonality(id),

      // Loading
      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }),

      // Error
      error: null,
      setError: (error) => set({ error }),
    }),
    {
      name: 'freebot-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        config: state.config,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
)

// Selectors
export const useConfig = () => useAppStore((state) => state.config)
export const useActiveBot = () => useAppStore((state) => state.activeBot)
export const useMessages = () => useAppStore((state) => state.messages)
export const useIsStreaming = () => useAppStore((state) => state.isStreaming)
export const useSidebarOpen = () => useAppStore((state) => state.sidebarOpen)
export const useSettingsOpen = () => useAppStore((state) => state.settingsOpen)
export const usePersonalities = () => useAppStore((state) => state.personalities)
export const useIsLoading = () => useAppStore((state) => state.isLoading)
export const useError = () => useAppStore((state) => state.error)