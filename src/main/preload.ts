import { contextBridge, ipcRenderer } from 'electron'
import type { AppConfig, ApiKey, Bot, ChatMessage } from './config.js'

// Type definitions for the exposed API
interface ElectronAPI {
  // Config
  config: {
    get: () => Promise<AppConfig>
    set: (config: Partial<AppConfig>) => Promise<AppConfig>
  }
  // API Keys
  apiKeys: {
    list: () => Promise<ApiKey[]>
    add: (apiKey: Omit<ApiKey, 'id' | 'createdAt'> & { cloudflareAccountId?: string }) => Promise<ApiKey>
    delete: (id: string) => Promise<boolean>
  }
  // Bots
  bots: {
    list: () => Promise<Bot[]>
    add: (bot: Omit<Bot, 'id' | 'createdAt'>) => Promise<Bot>
    update: (id: string, updates: Partial<Bot>) => Promise<Bot | null>
    delete: (id: string) => Promise<boolean>
    setActive: (id: string) => Promise<boolean>
  }
  // History
  history: {
    get: (botId: string) => Promise<ChatMessage[]>
    save: (botId: string, messages: ChatMessage[]) => Promise<boolean>
    clear: (botId: string) => Promise<boolean>
  }
  // Gateway
  gateway: {
    models: (baseUrl: string, apiKey: string) => Promise<any>
    chat: (options: {
      baseUrl: string
      apiKey: string
      model: string
      messages: { role: string; content: string }[]
      temperature: number
      stream: boolean
    }) => Promise<any>
  }
  // File System
  fs: {
    read: (path: string) => Promise<string>
    write: (path: string, content: string) => Promise<boolean>
    list: (path: string) => Promise<Array<{ name: string; isDirectory: boolean; isFile: boolean }>>
    mkdir: (path: string) => Promise<boolean>
    delete: (path: string) => Promise<boolean>
  }
  // Dialogs
  dialog: {
    openFile: () => Promise<string[]>
    openDirectory: () => Promise<string[]>
    saveFile: (options?: { defaultPath?: string; filters?: any[] }) => Promise<string | undefined>
  }
  // Shell
  shell: {
    openExternal: (url: string) => Promise<boolean>
    openPath: (path: string) => Promise<boolean>
  }
  // App
  app: {
    getVersion: () => Promise<string>
    getPath: (name: string) => Promise<string>
    quit: () => Promise<boolean>
  }
  // Notifications
  notification: {
    show: (options: { title: string; body: string; icon?: string }) => Promise<boolean>
  }
  // Window controls
  window: {
    minimize: () => Promise<boolean>
    maximize: () => Promise<boolean>
    close: () => Promise<boolean>
    isMaximized: () => Promise<boolean>
  }
}

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electron', {
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (config: Partial<AppConfig>) => ipcRenderer.invoke('config:set', config),
  },
  apiKeys: {
    list: () => ipcRenderer.invoke('apikeys:list'),
    add: (apiKey: Omit<ApiKey, 'id' | 'createdAt'> & { cloudflareAccountId?: string }) => ipcRenderer.invoke('apikeys:add', apiKey),
    delete: (id: string) => ipcRenderer.invoke('apikeys:delete', id),
  },
  bots: {
    list: () => ipcRenderer.invoke('bots:list'),
    add: (bot: Omit<Bot, 'id' | 'createdAt'>) => ipcRenderer.invoke('bots:add', bot),
    update: (id: string, updates: Partial<Bot>) => ipcRenderer.invoke('bots:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('bots:delete', id),
    setActive: (id: string) => ipcRenderer.invoke('bots:setActive', id),
  },
  history: {
    get: (botId: string) => ipcRenderer.invoke('history:get', botId),
    save: (botId: string, messages: ChatMessage[]) => ipcRenderer.invoke('history:save', botId, messages),
    clear: (botId: string) => ipcRenderer.invoke('history:clear', botId),
  },
  gateway: {
    models: (baseUrl: string, apiKey: string) => ipcRenderer.invoke('gateway:models', baseUrl, apiKey),
    chat: (options: {
      baseUrl: string
      apiKey: string
      model: string
      messages: { role: string; content: string }[]
      temperature: number
      stream: boolean
    }) => ipcRenderer.invoke('gateway:chat', options),
  },
  fs: {
    read: (path: string) => ipcRenderer.invoke('fs:read', path),
    write: (path: string, content: string) => ipcRenderer.invoke('fs:write', path, content),
    list: (path: string) => ipcRenderer.invoke('fs:list', path),
    mkdir: (path: string) => ipcRenderer.invoke('fs:mkdir', path),
    delete: (path: string) => ipcRenderer.invoke('fs:delete', path),
  },
  dialog: {
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
    openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
    saveFile: (options?: { defaultPath?: string; filters?: any[] }) => ipcRenderer.invoke('dialog:saveFile', options),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
    openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getPath: (name: string) => ipcRenderer.invoke('app:getPath', name),
    quit: () => ipcRenderer.invoke('app:quit'),
  },
  notification: {
    show: (options: { title: string; body: string; icon?: string }) => ipcRenderer.invoke('notification:show', options),
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  },
} satisfies ElectronAPI)

// Type augmentation for TypeScript
declare global {
  interface Window {
    electron: ElectronAPI
  }
}