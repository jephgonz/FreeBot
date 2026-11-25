import { useState } from 'react'
import { X, Key, Save, TestTube, Trash2, Check, Copy, Eye, EyeOff, Bot, Plus, Settings as SettingsIcon, Sparkles, Zap, Cloud, Brain } from 'lucide-react'
import { cn } from '../utils'
import { useAppStore } from '../stores/appStore'
import { useConfig, useApiKeys, useBots } from '../hooks/useConfig'
import { Dialog, DialogHeader, DialogContent, DialogFooter } from './ui/Dialog'
import { Input } from './ui/Input'
import { Button } from './ui/Button'
import { Select } from './ui/Select'
import { Textarea } from './ui/Input'
import { PERSONALITIES, getPersonality } from '../stores/personalities'

// Provider configurations with icons and default endpoints
const PROVIDERS = [
  { id: 'gemini', name: 'Google Gemini', icon: Sparkles, color: 'text-blue-400', endpoint: 'https://generativelanguage.googleapis.com/v1beta' },
  { id: 'nvidia', name: 'NVIDIA NIM', icon: Zap, color: 'text-green-400', endpoint: 'https://integrate.api.nvidia.com/v1' },
  { id: 'cloudflare', name: 'Cloudflare Workers AI', icon: Cloud, color: 'text-orange-400', endpoint: 'https://api.cloudflare.com/client/v4/accounts' },
  { id: 'groq', name: 'Groq', icon: Brain, color: 'text-purple-400', endpoint: 'https://api.groq.com/openai/v1' },
  { id: 'openai', name: 'OpenAI / Custom', icon: Key, color: 'text-emerald-400', endpoint: 'https://api.openai.com/v1' },
] as const

type ProviderId = typeof PROVIDERS[number]['id']

export function Settings() {
  const { settingsOpen, toggleSettings } = useAppStore()
  const { config, initialized, updateGatewayUrl, updateSettings, updateTheme } = useConfig()
  const { apiKeys, addApiKey, deleteApiKey } = useApiKeys()
  const { bots, addBot, updateBot, deleteBot } = useBots()

  const [gatewayUrl, setGatewayUrl] = useState(config?.gatewayUrl || 'http://127.0.0.1:8000/v1')
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyValue, setNewKeyValue] = useState('')
  const [newKeyProvider, setNewKeyProvider] = useState<ProviderId>('openai')
  const [cloudflareAccountId, setCloudflareAccountId] = useState('')
  const [showKeyValue, setShowKeyValue] = useState(false)
  const [testingKey, setTestingKey] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'general' | 'keys' | 'bots' | 'advanced'>('general')

  // Bot form state
  const [botDialogOpen, setBotDialogOpen] = useState(false)
  const [editingBot, setEditingBot] = useState<any>(null)
  const [botForm, setBotForm] = useState({
    name: '',
    avatarColor: '#007acc',
    systemPrompt: '',
    temperature: 0.7,
    model: '',
    personality: 'default',
    apiKeyId: '',
  })

  const handlePersonalityChange = (personalityId: string) => {
    const personality = getPersonality(personalityId)
    if (personality) {
      setBotForm(prev => ({
        ...prev,
        systemPrompt: personality.systemPrompt,
        temperature: personality.temperature,
        avatarColor: personality.avatarColor,
      }))
    }
  }

  const handleOpenBotDialog = (bot?: any) => {
    if (bot) {
      setEditingBot(bot)
      setBotForm({
        name: bot.name,
        avatarColor: bot.avatarColor,
        systemPrompt: bot.systemPrompt,
        temperature: bot.temperature,
        model: bot.model,
        personality: 'default',
        apiKeyId: bot.apiKeyId,
      })
    } else {
      setEditingBot(null)
      setBotForm({
        name: '',
        avatarColor: '#007acc',
        systemPrompt: '',
        temperature: 0.7,
        model: '',
        personality: 'default',
        apiKeyId: apiKeys[0]?.id || '',
      })
    }
    setBotDialogOpen(true)
  }

  const handleSaveBot = async () => {
    if (!botForm.name.trim()) return
    if (!botForm.apiKeyId && apiKeys.length > 0) {
      setBotForm(prev => ({ ...prev, apiKeyId: apiKeys[0].id }))
    }
    if (!botForm.apiKeyId) {
      alert('Please add an API key first')
      return
    }

    try {
      if (editingBot) {
        await updateBot(editingBot.id, botForm)
      } else {
        await addBot(botForm)
      }
      setBotDialogOpen(false)
      setEditingBot(null)
    } catch (error) {
      console.error('Failed to save bot:', error)
      alert('Failed to save bot')
    }
  }

  const handleDeleteBot = async (id: string) => {
    if (confirm('Delete this bot? This cannot be undone.')) {
      await deleteBot(id)
    }
  }

  const handleSaveGeneral = async () => {
    try {
      await updateGatewayUrl(gatewayUrl)
      setTestResult({ success: true, message: 'Settings saved' })
      setTimeout(() => setTestResult(null), 3000)
    } catch (error) {
      setTestResult({ success: false, message: error instanceof Error ? error.message : 'Failed to save' })
    }
  }

  const handleAddKey = async () => {
    if (!newKeyName.trim() || !newKeyValue.trim()) return
    if (newKeyProvider === 'cloudflare' && !cloudflareAccountId.trim()) return
    try {
      await addApiKey(newKeyName, newKeyValue, newKeyProvider, cloudflareAccountId)
      setNewKeyName('')
      setNewKeyValue('')
      setNewKeyProvider('openai')
      setCloudflareAccountId('')
      setShowKeyValue(false)
      setTestResult({ success: true, message: 'API key added' })
      setTimeout(() => setTestResult(null), 3000)
    } catch (error) {
      setTestResult({ success: false, message: error instanceof Error ? error.message : 'Failed to add key' })
    }
  }

  const getProviderEndpoint = (provider: ProviderId, accountId?: string) => {
    const p = PROVIDERS.find(x => x.id === provider)
    if (!p) return gatewayUrl
    if (provider === 'cloudflare' && accountId) {
      return `${p.endpoint}/${accountId}/ai/run`
    }
    return p.endpoint
  }

  const handleTestKey = async (keyValue: string, keyId: string, provider?: ProviderId) => {
    setTestingKey(keyId)
    setTestResult(null)
    try {
      const endpoint = provider ? getProviderEndpoint(provider, cloudflareAccountId) : gatewayUrl
      const response = await fetch(`${endpoint}/models`, {
        headers: {
          'Authorization': `Bearer ${keyValue}`,
          'Content-Type': 'application/json',
        },
      })
      if (response.ok) {
        const data = await response.json()
        const modelCount = data.data?.length || 0
        setTestResult({ success: true, message: `Key valid! Found ${modelCount} models.` })
      } else {
        setTestResult({ success: false, message: `Invalid key: ${response.status}` })
      }
    } catch (error) {
      setTestResult({ success: false, message: error instanceof Error ? error.message : 'Test failed' })
    } finally {
      setTestingKey(null)
    }
  }

  const handleCopyKey = async (key: string) => {
    await navigator.clipboard.writeText(key)
    setTestResult({ success: true, message: 'API key copied to clipboard' })
    setTimeout(() => setTestResult(null), 2000)
  }

  if (!settingsOpen) return null

  const tabs = [
    { id: 'general', label: 'General', icon: SettingsIcon },
    { id: 'keys', label: 'API Keys', icon: Key },
    { id: 'bots', label: 'Bots', icon: Bot },
    { id: 'advanced', label: 'Advanced', icon: TestTube },
  ]

  return (
    <Dialog
      open={settingsOpen}
      onClose={toggleSettings}
      title="Settings"
      size="xl"
    >
      <DialogContent className="space-y-0">
        {/* Tabs */}
        <div className="flex border-b border-border mb-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Gateway Configuration</h3>
              <Input
                label="Gateway URL"
                value={gatewayUrl}
                onChange={e => setGatewayUrl(e.target.value)}
                placeholder="http://127.0.0.1:8000/v1"
                helperText="OpenAI-compatible API endpoint (e.g., freeLLM, Ollama, LM Studio)"
              />
            </div>

            <div className="border-t border-border pt-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Preferences</h3>
              <div className="space-y-4">
                <label className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={config?.settings?.streamingEnabled}
                      onChange={e => updateSettings({ streamingEnabled: e.target.checked })}
                      className="w-4 h-4 rounded border-border bg-input text-primary focus:ring-primary"
                    />
                    <div>
                      <p className="font-medium text-foreground">Stream Responses</p>
                      <p className="text-sm text-muted-foreground">Show tokens as they arrive</p>
                    </div>
                  </div>
                </label>

                <label className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={config?.settings?.autoSaveHistory}
                      onChange={e => updateSettings({ autoSaveHistory: e.target.checked })}
                      className="w-4 h-4 rounded border-border bg-input text-primary focus:ring-primary"
                    />
                    <div>
                      <p className="font-medium text-foreground">Auto-save History</p>
                      <p className="text-sm text-muted-foreground">Automatically persist chat history</p>
                    </div>
                  </div>
                </label>

                <label className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={config?.settings?.notificationsEnabled}
                      onChange={e => updateSettings({ notificationsEnabled: e.target.checked })}
                      className="w-4 h-4 rounded border-border bg-input text-primary focus:ring-primary"
                    />
                    <div>
                      <p className="font-medium text-foreground">Desktop Notifications</p>
                      <p className="text-sm text-muted-foreground">Show notifications for completed responses</p>
                    </div>
                  </div>
                </label>

                <label className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={config?.settings?.launchAtStartup}
                      onChange={e => updateSettings({ launchAtStartup: e.target.checked })}
                      className="w-4 h-4 rounded border-border bg-input text-primary focus:ring-primary"
                    />
                    <div>
                      <p className="font-medium text-foreground">Launch at Startup</p>
                      <p className="text-sm text-muted-foreground">Start FreeBot when you log in</p>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="border-t border-border pt-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Appearance</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Theme</p>
                  <p className="text-sm text-muted-foreground">Choose your preferred color scheme</p>
                </div>
                <div className="flex gap-2">
                  {['dark', 'light', 'system'].map(theme => (
                    <button
                      key={theme}
                      onClick={() => updateTheme(theme as 'dark' | 'light')}
                      className={cn(
                        'px-4 py-2 rounded-lg text-sm font-medium border transition-all',
                        config?.theme === theme
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-foreground border-border hover:bg-accent/10'
                      )}
                    >
                      {theme.charAt(0).toUpperCase() + theme.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {testResult && (
              <div className={cn(
                'p-3 rounded-lg text-sm border',
                testResult.success
                  ? 'bg-green-500/10 text-green-500 border-green-500/20'
                  : 'bg-red-500/10 text-red-500 border-red-500/20'
              )}>
                {testResult.message}
              </div>
            )}
          </div>
        )}

        {/* API Keys Tab */}
        {activeTab === 'keys' && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">API Keys</h3>
              <Button variant="secondary" size="sm" onClick={() => setActiveTab('bots')}>
                <Bot className="h-4 w-4 mr-2" />
                Manage Bots
              </Button>
            </div>

            {apiKeys.length === 0 ? (
              <div className="text-center py-12">
                <Key className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg text-foreground mb-1">No API Keys Configured</p>
                <p className="text-sm text-muted-foreground mb-6">Add an API key to connect to your LLM provider</p>
                <Button onClick={() => setActiveTab('keys')} className="w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Key
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {apiKeys.map(key => {
                  const provider = PROVIDERS.find(p => p.id === (key as any).provider) || PROVIDERS[4]
                  const ProviderIcon = provider.icon
                  return (
                    <div
                      key={key.id}
                      className="flex items-center justify-between p-4 bg-card border border-border rounded-xl"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <ProviderIcon className={`h-5 w-5 ${provider.color}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground">{key.name}</p>
                            <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                              {provider.name}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground font-mono">
                            {key.key.slice(0, 8)}...{key.key.slice(-4)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestKey(key.key, key.id, (key as any).provider)}
                          disabled={testingKey === key.id}
                        >
                          {testingKey === key.id ? (
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            'Test'
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyKey(key.key)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowKeyValue(key.id === newKeyName ? '' : key.id)}
                        >
                          {showKeyValue === key.id ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteApiKey(key.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="border-t border-border pt-6">
              <h4 className="font-medium text-foreground mb-4">Add New API Key</h4>
              <div className="space-y-4">
                <Select
                  label="Provider"
                  value={newKeyProvider}
                  onChange={e => setNewKeyProvider(e.target.value as ProviderId)}
                  options={PROVIDERS.map(p => ({ value: p.id, label: p.name }))}
                  placeholder="Select provider"
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Key Name"
                    value={newKeyName}
                    onChange={e => setNewKeyName(e.target.value)}
                    placeholder={`My ${PROVIDERS.find(p => p.id === newKeyProvider)?.name || 'API'} Key`}
                  />
                  <div className="relative">
                    <Input
                      label="API Key"
                      type={showKeyValue ? 'text' : 'password'}
                      value={newKeyValue}
                      onChange={e => setNewKeyValue(e.target.value)}
                      placeholder={newKeyProvider === 'cloudflare' ? 'cfat_...' : 'sk-...'}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-3 top-[38px] h-8 w-8 p-0"
                      onClick={() => setShowKeyValue(!showKeyValue)}
                    >
                      {showKeyValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                {newKeyProvider === 'cloudflare' && (
                  <Input
                    label="Cloudflare Account ID"
                    value={cloudflareAccountId}
                    onChange={e => setCloudflareAccountId(e.target.value)}
                    placeholder="7cce459f4d7434502bb47a76f20a0f19"
                    helperText="Required for Cloudflare Workers AI"
                  />
                )}
                <Button onClick={handleAddKey} disabled={!newKeyName.trim() || !newKeyValue.trim() || (newKeyProvider === 'cloudflare' && !cloudflareAccountId.trim())}>
                  <Save className="h-4 w-4 mr-2" />
                  Add API Key
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Bots Tab */}
        {activeTab === 'bots' && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Bots</h3>
              <Button onClick={() => handleOpenBotDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Create Bot
              </Button>
            </div>

            {bots.length === 0 ? (
              <div className="text-center py-12">
                <Bot className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg text-foreground mb-1">No Bots Created</p>
                <p className="text-sm text-muted-foreground mb-6">Create a bot to start chatting</p>
                <Button onClick={() => handleOpenBotDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Bot
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {bots.map(bot => {
                  const key = apiKeys.find(k => k.id === bot.apiKeyId)
                  return (
                    <div
                      key={bot.id}
                      className="flex items-center justify-between p-4 bg-card border border-border rounded-xl"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                          style={{ backgroundColor: bot.avatarColor }}
                        >
                          {bot.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{bot.name}</p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="font-mono">{bot.model || 'No model'}</span>
                            <span>•</span>
                            <span>{key?.name || 'No API key'}</span>
                            <span>•</span>
                            <span>Temp: {bot.temperature}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenBotDialog(bot)}
                        >
                          <SettingsIcon className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteBot(bot.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Create/Edit Bot Dialog */}
            <Dialog
              open={botDialogOpen}
              onClose={() => {
                setBotDialogOpen(false)
                setEditingBot(null)
              }}
              title={editingBot ? 'Edit Bot' : 'Create New Bot'}
              size="xl"
            >
              <DialogContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Bot Name"
                    value={botForm.name}
                    onChange={e => setBotForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="My Assistant"
                    required
                  />
                  <Select
                    label="API Key"
                    value={botForm.apiKeyId}
                    onChange={e => setBotForm(prev => ({ ...prev, apiKeyId: e.target.value }))}
                    options={apiKeys.map(k => ({ value: k.id, label: k.name }))}
                    placeholder="Select API key"
                    disabled={apiKeys.length === 0}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Select
                    label="Personality"
                    value={botForm.personality}
                    onChange={e => {
                      const personalityId = e.target.value
                      setBotForm(prev => ({ ...prev, personality: personalityId }))
                      handlePersonalityChange(personalityId)
                    }}
                    options={PERSONALITIES.map(p => ({ value: p.id, label: p.name }))}
                    placeholder="Select personality"
                  />
                  <Input
                    label="Temperature"
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={botForm.temperature}
                    onChange={e => setBotForm(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                    helperText="0 = focused, 2 = creative"
                  />
                </div>

                <Input
                  label="Model"
                  value={botForm.model}
                  onChange={e => setBotForm(prev => ({ ...prev, model: e.target.value }))}
                  placeholder="e.g., gpt-4, llama-3.1-70b"
                />

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Avatar Color</label>
                  <div className="flex flex-wrap gap-2">
                    {['#007acc', '#ff6b35', '#28ca42', '#a855f7', '#0ea5e9', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#8b5cf6', '#f97316', '#6366f1'].map(c => (
                      <button
                        key={c}
                        onClick={() => setBotForm(prev => ({ ...prev, avatarColor: c }))}
                        className={cn(
                          'w-9 h-9 rounded-full border-2 transition-all',
                          botForm.avatarColor === c ? 'border-primary scale-110' : 'border-transparent hover:border-border'
                        )}
                        style={{ backgroundColor: c }}
                        aria-label={`Color ${c}`}
                        aria-pressed={botForm.avatarColor === c}
                      />
                    ))}
                  </div>
                </div>

                <Textarea
                  label="System Prompt"
                  value={botForm.systemPrompt}
                  onChange={e => setBotForm(prev => ({ ...prev, systemPrompt: e.target.value }))}
                  placeholder="You are a helpful assistant..."
                  rows={5}
                />
              </DialogContent>
              <DialogFooter>
                <Button variant="secondary" onClick={() => { setBotDialogOpen(false); setEditingBot(null); }}>
                  Cancel
                </Button>
                <Button onClick={handleSaveBot}>
                  {editingBot ? 'Save Changes' : 'Create Bot'}
                </Button>
              </DialogFooter>
            </Dialog>
          </div>
        )}

        {/* Advanced Tab */}
        {activeTab === 'advanced' && (
          <div className="p-6 space-y-6">
            <h3 className="text-lg font-semibold text-foreground">Advanced Settings</h3>

            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Debug Mode</p>
                  <p className="text-sm text-muted-foreground">Enable verbose logging</p>
                </div>
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-border bg-input text-primary focus:ring-primary"
                />
              </label>

              <label className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Log to Console</p>
                  <p className="text-sm text-muted-foreground">Output debug logs to developer console</p>
                </div>
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-border bg-input text-primary focus:ring-primary"
                />
              </label>
            </div>

            <div className="border-t border-border pt-6">
              <h4 className="font-medium text-foreground mb-4">Data Management</h4>
              <div className="space-y-2">
                <Button variant="destructive" className="w-full justify-start">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All Chat History
                </Button>
                <Button variant="destructive" className="w-full justify-start">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Reset All Settings
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  Export Configuration
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  Import Configuration
                </Button>
              </div>
            </div>

            <div className="border-t border-border pt-6">
              <h4 className="font-medium text-foreground mb-4">About</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>FreeBot v1.0.0</p>
                <p>Electron + React + TypeScript</p>
                <p>OpenAI-compatible gateway client</p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={toggleSettings}>
            Close
          </Button>
          {activeTab === 'general' && (
            <Button onClick={handleSaveGeneral}>
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}