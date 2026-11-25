import { useState } from 'react'
import { Plus, Settings, Bot, MessageSquare, HelpCircle, ChevronDown, Sun, Moon } from 'lucide-react'
import { cn } from '../utils'
import { useAppStore } from '../stores/appStore'
import { useConfig, useBots } from '../hooks/useConfig'
import { Avatar } from './ui/Avatar'
import { Button } from './ui/Button'
import { Dialog, DialogHeader, DialogContent, DialogFooter } from './ui/Dialog'
import { Input, Textarea } from './ui/Input'
import { Select } from './ui/Select'
import { PERSONALITIES, getPersonality } from '../stores/personalities'

export function Sidebar() {
  const sidebarOpen = useAppStore(state => state.sidebarOpen)
  const setSidebarOpen = useAppStore(state => state.setSidebarOpen)
  const settingsOpen = useAppStore(state => state.settingsOpen)
  const toggleSettings = useAppStore(state => state.toggleSettings)
  const { config, initialized, updateTheme } = useConfig()
  const { bots, activeBotId, addBot, updateBot, deleteBot, setActiveBotId } = useBots()
  const theme = config?.theme || 'dark'

  const [newBotDialog, setNewBotDialog] = useState(false)
  const [editingBot, setEditingBot] = useState<any>(null)
  const [newBotForm, setNewBotForm] = useState({
    name: '',
    avatarColor: '#007acc',
    systemPrompt: '',
    temperature: 0.7,
    model: '',
    personality: 'default',
  })

  const handlePersonalityChange = (personalityId: string) => {
    const personality = getPersonality(personalityId)
    if (personality) {
      setNewBotForm(prev => ({
        ...prev,
        systemPrompt: personality.systemPrompt,
        temperature: personality.temperature,
        avatarColor: personality.avatarColor,
      }))
    }
  }

  const handleSubmitBot = async () => {
    if (!newBotForm.name.trim()) return

    const apiKeys = config.config?.apiKeys || []
    if (apiKeys.length === 0) {
      alert('Please add an API key first in Settings')
      return
    }

    try {
      if (editingBot) {
        await updateBot(editingBot.id, newBotForm)
      } else {
        await addBot({
          ...newBotForm,
          apiKeyId: apiKeys[0].id,
        })
      }
      setNewBotDialog(false)
      setEditingBot(null)
      setNewBotForm({
        name: '',
        avatarColor: '#007acc',
        systemPrompt: '',
        temperature: 0.7,
        model: '',
        personality: 'default',
      })
    } catch (error) {
      console.error('Failed to save bot:', error)
    }
  }

  const handleEditBot = (bot: any) => {
    setEditingBot(bot)
    setNewBotForm({
      name: bot.name,
      avatarColor: bot.avatarColor,
      systemPrompt: bot.systemPrompt,
      temperature: bot.temperature,
      model: bot.model,
      personality: 'default',
    })
    setNewBotDialog(true)
  }

  const handleDeleteBot = async (id: string) => {
    if (confirm('Delete this bot?')) {
      await deleteBot(id)
    }
  }

  const handleNewBot = () => {
    setEditingBot(null)
    setNewBotForm({
      name: '',
      avatarColor: '#007acc',
      systemPrompt: '',
      temperature: 0.7,
      model: '',
      personality: 'default',
    })
    setNewBotDialog(true)
  }

  if (!sidebarOpen) {
    return (
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed left-2 top-2 z-30 p-2 rounded-lg bg-mac-sidebar border border-mac-border hover:bg-mac-hover transition-colors"
        aria-label="Open sidebar"
      >
        <MessageSquare className="h-5 w-5 text-mac-text" />
      </button>
    )
  }

  if (!initialized) {
    return (
      <aside className="fixed left-0 top-0 bottom-0 w-72 bg-mac-sidebar border-r border-mac-border z-20 flex items-center justify-center">
        <div className="text-center text-mac-textMuted">
          <div className="w-8 h-8 border-2 border-mac-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm">Loading...</p>
        </div>
      </aside>
    )
  }

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-72 bg-mac-sidebar border-r border-mac-border z-20 flex flex-col transition-transform duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-mac-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-mac-accent flex items-center justify-center">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <span className="font-semibold text-mac-text">FreeBot</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
          className="lg:hidden"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      {/* Bots List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {bots.length === 0 ? (
          <div className="text-center py-8 text-mac-textMuted">
            <Bot className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No bots yet</p>
            <p className="text-xs mt-1">Click + to create one</p>
          </div>
        ) : (
          bots.map(bot => (
            <div
              key={bot.id}
              className={cn(
                'relative group flex items-center gap-3 p-2 rounded-lg transition-colors',
                activeBotId === bot.id ? 'bg-mac-hover' : 'hover:bg-mac-hover'
              )}
            >
              <Avatar name={bot.name} color={bot.avatarColor} size="sm" />
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-sm font-medium truncate',
                  activeBotId === bot.id ? 'text-mac-accent' : 'text-mac-text'
                )}>
                  {bot.name}
                </p>
                <p className="text-xs text-mac-textMuted truncate">
                  {bot.model || 'No model selected'}
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleEditBot(bot)}
                  className="p-1.5 rounded hover:bg-mac-border text-mac-textMuted hover:text-mac-text transition-colors"
                  aria-label="Edit bot"
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
                {bots.length > 1 && (
                  <button
                    onClick={() => handleDeleteBot(bot.id)}
                    className="p-1.5 rounded hover:bg-mac-red/20 text-mac-textMuted hover:text-mac-red transition-colors"
                    aria-label="Delete bot"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-3 border-t border-mac-border space-y-2">
        <Button
          className="w-full justify-start"
          variant="secondary"
          onClick={handleNewBot}
        >
          <Plus className="h-4 w-4" />
          New Bot
        </Button>

        <Button
          className="w-full justify-start"
          variant="ghost"
          onClick={toggleSettings}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Button>

        <div className="flex items-center justify-between text-xs text-mac-textMuted pt-2">
          <span>Theme</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => updateTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* New/Edit Bot Dialog */}
      <Dialog
        open={newBotDialog}
        onClose={() => {
          setNewBotDialog(false)
          setEditingBot(null)
        }}
        title={editingBot ? 'Edit Bot' : 'Create New Bot'}
        size="lg"
      >
        <DialogContent className="space-y-4">
          <Input
            label="Bot Name"
            value={newBotForm.name}
            onChange={e => setNewBotForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="My Assistant"
            required
          />

          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-mac-text mb-1">Avatar Color</label>
              <div className="flex flex-wrap gap-2">
                {['#007acc', '#ff6b35', '#28ca42', '#a855f7', '#0ea5e9', '#f59e0b', '#ef4444', '#ec4899'].map(c => (
                  <button
                    key={c}
                    onClick={() => setNewBotForm(prev => ({ ...prev, avatarColor: c }))}
                    className={cn(
                      'w-8 h-8 rounded-full border-2 transition-all',
                      newBotForm.avatarColor === c ? 'border-mac-accent scale-110' : 'border-transparent hover:border-mac-border'
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={`Color ${c}`}
                    aria-pressed={newBotForm.avatarColor === c}
                  />
                ))}
              </div>
            </div>
          </div>

          <Select
            label="Personality"
            value={newBotForm.personality}
            onChange={e => {
              const personalityId = e.target.value
              setNewBotForm(prev => ({ ...prev, personality: personalityId }))
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
            value={newBotForm.temperature}
            onChange={e => setNewBotForm(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
            helperText="0 = focused, 2 = creative"
          />

          <Input
            label="Model"
            value={newBotForm.model}
            onChange={e => setNewBotForm(prev => ({ ...prev, model: e.target.value }))}
            placeholder="e.g., gpt-4, llama-3"
          />

          <Textarea
            label="System Prompt"
            value={newBotForm.systemPrompt}
            onChange={e => setNewBotForm(prev => ({ ...prev, systemPrompt: e.target.value }))}
            placeholder="You are a helpful assistant..."
            rows={4}
          />
        </DialogContent>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setNewBotDialog(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmitBot}>
            {editingBot ? 'Save Changes' : 'Create Bot'}
          </Button>
        </DialogFooter>
      </Dialog>
    </aside>
  )
}