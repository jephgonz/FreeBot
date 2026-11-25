export interface ApiKey {
  id: string
  name: string
  key: string
  createdAt: number
}

export interface Bot {
  id: string
  name: string
  avatarColor: string
  systemPrompt: string
  temperature: number
  model: string
  apiKeyId: string
  createdAt: number
}

export interface AppSettings {
  launchAtStartup: boolean
  notificationsEnabled: boolean
  streamingEnabled: boolean
  autoSaveHistory: boolean
}

export interface AppConfig {
  gatewayUrl: string
  apiKeys: ApiKey[]
  bots: Bot[]
  activeBotId: string | null
  theme: 'dark' | 'light'
  settings: AppSettings
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  isStreaming?: boolean
}

export interface ChatHistory {
  botId: string
  messages: ChatMessage[]
  updatedAt: number
}

export interface Personality {
  id: string
  name: string
  description: string
  systemPrompt: string
  temperature: number
  avatarColor: string
}

export interface CommandResult {
  success: boolean
  output?: string
  error?: string
  type: 'text' | 'code' | 'file' | 'search' | 'research'
}

export interface FileOperation {
  type: 'create' | 'read' | 'list' | 'mkdir' | 'delete'
  path: string
  content?: string
}

export interface GatewayModel {
  id: string
  object: string
  owned_by: string
  permission: any[]
}