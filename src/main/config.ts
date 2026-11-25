import { app } from 'electron'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = join(fileURLToPath(import.meta.url), '..')

const CONFIG_DIR = join(app.getPath('userData'), 'freebot')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')
const HISTORY_FILE = join(CONFIG_DIR, 'history.json')

export interface AppConfig {
  gatewayUrl: string
  apiKeys: ApiKey[]
  bots: Bot[]
  activeBotId: string | null
  theme: 'dark' | 'light'
  settings: AppSettings
}

export type ApiProvider = 'gemini' | 'nvidia' | 'cloudflare' | 'groq' | 'openai' | 'custom'

export interface ApiKey {
  id: string
  name: string
  key: string
  provider: ApiProvider
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

export interface ChatHistory {
  botId: string
  messages: ChatMessage[]
  updatedAt: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  isStreaming?: boolean
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

async function ensureConfigDir() {
  try {
    await mkdir(CONFIG_DIR, { recursive: true })
  } catch {
    // Directory might already exist
  }
}

export async function loadConfig(): Promise<AppConfig> {
  await ensureConfigDir()
  try {
    const data = await readFile(CONFIG_FILE, 'utf-8')
    const config = JSON.parse(data) as AppConfig
    return { ...DEFAULT_CONFIG, ...config }
  } catch {
    return DEFAULT_CONFIG
  }
}

export async function saveConfig(config: Partial<AppConfig>): Promise<AppConfig> {
  await ensureConfigDir()
  const current = await loadConfig()
  const updated = { ...current, ...config }
  await writeFile(CONFIG_FILE, JSON.stringify(updated, null, 2))
  return updated
}

export async function loadHistory(): Promise<ChatHistory[]> {
  await ensureConfigDir()
  try {
    const data = await readFile(HISTORY_FILE, 'utf-8')
    return JSON.parse(data) as ChatHistory[]
  } catch {
    return []
  }
}

export async function saveHistory(history: ChatHistory[]): Promise<void> {
  await ensureConfigDir()
  await writeFile(HISTORY_FILE, JSON.stringify(history, null, 2))
}

export async function getBotHistory(botId: string): Promise<ChatMessage[]> {
  const history = await loadHistory()
  const botHistory = history.find(h => h.botId === botId)
  return botHistory?.messages || []
}

export async function saveBotHistory(botId: string, messages: ChatMessage[]): Promise<void> {
  const history = await loadHistory()
  const index = history.findIndex(h => h.botId === botId)
  const entry: ChatHistory = {
    botId,
    messages,
    updatedAt: Date.now(),
  }
  if (index >= 0) {
    history[index] = entry
  } else {
    history.push(entry)
  }
  await saveHistory(history)
}

export { CONFIG_DIR, CONFIG_FILE, HISTORY_FILE }