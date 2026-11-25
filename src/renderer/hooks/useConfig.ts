import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import type { AppConfig, Bot, ApiKey } from '../types'

export function useConfig() {
  const config = useAppStore(state => state.config)
  const setConfig = useAppStore(state => state.setConfig)
  const updateConfig = useAppStore(state => state.updateConfig)
  const setIsLoading = useAppStore(state => state.setIsLoading)
  const setError = useAppStore(state => state.setError)

  const [initialized, setInitialized] = useState(false)

  // Load config on mount
  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      try {
        const loadedConfig = await window.electron.config.get()
        setConfig(loadedConfig)
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to load config')
      } finally {
        setIsLoading(false)
        setInitialized(true)
      }
    }
    load()
  }, [setConfig, setIsLoading, setError])

  const saveConfig = useCallback(async (updates: Partial<AppConfig>) => {
    try {
      setIsLoading(true)
      const savedConfig = await window.electron.config.set(updates)
      setConfig(savedConfig)
      return savedConfig
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save config')
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [setConfig, setIsLoading, setError])

  const updateGatewayUrl = useCallback(async (url: string) => {
    return saveConfig({ gatewayUrl: url })
  }, [saveConfig])

  const updateTheme = useCallback(async (theme: 'dark' | 'light') => {
    return saveConfig({ theme })
  }, [saveConfig])

  const updateSettings = useCallback(async (settings: Partial<AppConfig['settings']>) => {
    const currentSettings = config?.settings || {}
    return saveConfig({ settings: { ...currentSettings, ...settings } })
  }, [config?.settings, saveConfig])

  return {
    config,
    initialized,
    saveConfig,
    updateGatewayUrl,
    updateTheme,
    updateSettings,
  }
}

// API Keys hooks
export function useApiKeys() {
  const config = useAppStore(state => state.config)
  const setConfig = useAppStore(state => state.setConfig)
  const setIsLoading = useAppStore(state => state.setIsLoading)
  const setError = useAppStore(state => state.setError)

  const addApiKey = useCallback(async (name: string, key: string, provider: string = 'openai', cloudflareAccountId?: string) => {
    try {
      setIsLoading(true)
      console.log('[useApiKeys] Adding key:', name, 'provider:', provider)
      const newKey = await window.electron.apiKeys.add({ name, key, provider, cloudflareAccountId })
      console.log('[useApiKeys] Key added:', newKey)
      setConfig(prev => {
        if (!prev) {
          console.warn('[useApiKeys] Config not loaded yet, skipping optimistic update')
          return prev
        }
        const result = {
          ...prev,
          apiKeys: [...prev.apiKeys, newKey],
        }
        console.log('[useApiKeys] setConfig result:', result)
        return result
      })
      return newKey
    } catch (error) {
      console.error('[useApiKeys] Add failed:', error)
      setError(error instanceof Error ? error.message : 'Failed to add API key')
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [setConfig, setIsLoading, setError])

  const deleteApiKey = useCallback(async (id: string) => {
    try {
      setIsLoading(true)
      console.log('[useApiKeys] Deleting key:', id)
      await window.electron.apiKeys.delete(id)
      console.log('[useApiKeys] Key deleted')
      setConfig(prev => {
        if (!prev) {
          console.warn('[useApiKeys] Config not loaded yet, skipping optimistic update')
          return prev
        }
        const result = {
          ...prev,
          apiKeys: prev.apiKeys.filter(k => k.id !== id),
        }
        console.log('[useApiKeys] setConfig after delete:', result)
        return result
      })
    } catch (error) {
      console.error('[useApiKeys] Delete failed:', error)
      setError(error instanceof Error ? error.message : 'Failed to delete API key')
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [setConfig, setIsLoading, setError])

  return {
    apiKeys: config?.apiKeys || [],
    addApiKey,
    deleteApiKey,
  }
}

// Bots hooks
export function useBots() {
  const config = useAppStore(state => state.config)
  const setConfig = useAppStore(state => state.setConfig)
  const setActiveBot = useAppStore(state => state.setActiveBot)
  const setIsLoading = useAppStore(state => state.setIsLoading)
  const setError = useAppStore(state => state.setError)

  const addBot = useCallback(async (bot: Omit<Bot, 'id' | 'createdAt'>) => {
    try {
      setIsLoading(true)
      const newBot = await window.electron.bots.add(bot)
      setConfig(prev => prev ? {
        ...prev,
        bots: [...prev.bots, newBot],
        activeBotId: prev.activeBotId || newBot.id,
      } : null)
      setActiveBot(newBot)
      return newBot
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to add bot')
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [setConfig, setActiveBot, setIsLoading, setError])

  const updateBot = useCallback(async (id: string, updates: Partial<Bot>) => {
    try {
      setIsLoading(true)
      const updatedBot = await window.electron.bots.update(id, updates)
      setConfig(prev => prev ? {
        ...prev,
        bots: prev.bots.map(b => b.id === id ? updatedBot! : b),
      } : null)
      if (updatedBot) setActiveBot(updatedBot)
      return updatedBot
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update bot')
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [setConfig, setActiveBot, setIsLoading, setError])

  const deleteBot = useCallback(async (id: string) => {
    try {
      setIsLoading(true)
      await window.electron.bots.delete(id)
      setConfig(prev => {
        if (!prev) return null
        const newBots = prev.bots.filter(b => b.id !== id)
        return {
          ...prev,
          bots: newBots,
          activeBotId: prev.activeBotId === id ? (newBots[0]?.id || null) : prev.activeBotId,
        }
      })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete bot')
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [setConfig, setIsLoading, setError])

  const setActiveBotId = useCallback(async (id: string) => {
    try {
      await window.electron.bots.setActive(id)
      setConfig(prev => prev ? { ...prev, activeBotId: id } : null)
      const bot = config?.bots.find(b => b.id === id)
      if (bot) setActiveBot(bot)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to set active bot')
      throw error
    }
  }, [config?.bots, setConfig, setActiveBot, setError])

  return {
    bots: config?.bots || [],
    activeBotId: config?.activeBotId || null,
    addBot,
    updateBot,
    deleteBot,
    setActiveBotId,
  }
}