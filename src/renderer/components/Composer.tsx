import { useRef, useState, useEffect, KeyboardEvent } from 'react'
import { Send, Mic, Paperclip, Smile, ArrowUp } from 'lucide-react'
import { cn } from '../utils'
import { useChat } from '../hooks/useChat'
import { Button } from './ui/Button'

export function Composer() {
  const { sendMessage, isStreaming, stopStreaming, pendingCommand, setPendingCommand } = useChat()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [value, setValue] = useState('')
  const [showCommands, setShowCommands] = useState(false)
  const [inputHeight, setInputHeight] = useState(44)

  const commands = [
    { name: 'search', description: 'Web search' },
    { name: 'research', description: 'Deep research' },
    { name: 'code', description: 'Execute code' },
    { name: 'translate', description: 'Translate text' },
    { name: 'math', description: 'Evaluate math' },
    { name: 'summarize', description: 'Summarize text' },
    { name: 'write', description: 'Draft content' },
    { name: 'personality', description: 'Switch personality' },
    { name: 'help', description: 'Show all commands' },
  ]

  const filteredCommands = commands.filter(c =>
    c.name.includes(pendingCommand?.toLowerCase() || '')
  )

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const height = Math.min(textarea.scrollHeight, 200)
      textarea.style.height = `${height}px`
      setInputHeight(height)
    }
  }, [value])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return

    if (trimmed.startsWith('/') && pendingCommand) {
      // Command is being typed, let it continue
      return
    }

    sendMessage(trimmed)
    setValue('')
    setShowCommands(false)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    } else if (e.key === '/' && value === '') {
      setShowCommands(true)
    } else if (e.key === 'Escape') {
      setShowCommands(false)
      setPendingCommand(null)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setValue(newValue)

    // Check for command trigger
    if (newValue.startsWith('/') && !newValue.includes(' ')) {
      setPendingCommand(newValue.slice(1))
      setShowCommands(true)
    } else if (!newValue.startsWith('/')) {
      setPendingCommand(null)
      setShowCommands(false)
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text')
    if (text.includes('\n')) {
      e.preventDefault()
      const lines = text.split('\n')
      setValue(prev => prev + lines.join('\n'))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-mac-border bg-mac-sidebar/50">
      {/* Command Suggestions */}
      {showCommands && filteredCommands.length > 0 && (
        <div className="px-4 py-2 border-b border-mac-border animate-slide-up">
          <div className="flex items-center gap-2 text-xs text-mac-textMuted mb-1">
            <kbd className="px-1.5 py-0.5 bg-mac-bg border border-mac-border rounded">/</kbd>
            <span>Type a command</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {filteredCommands.map(cmd => (
              <button
                key={cmd.name}
                type="button"
                onClick={() => {
                  setValue(`/${cmd.name} `)
                  setPendingCommand(null)
                  setShowCommands(false)
                  textareaRef.current?.focus()
                }}
                className="px-2 py-1 text-xs bg-mac-hover hover:bg-mac-border rounded text-mac-textMuted hover:text-mac-text transition-colors"
              >
                /{cmd.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="p-3">
        <div className="relative flex items-end gap-2">
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={isStreaming ? 'Streaming...' : 'Message... (Shift+Enter for new line)'}
              className={cn(
                'w-full px-4 py-3 pr-12 rounded-xl bg-mac-bg border border-mac-border',
                'text-mac-text placeholder-mac-textMuted',
                'focus:outline-none focus:ring-2 focus:ring-mac-accent focus:border-transparent',
                'resize-none font-sans text-sm leading-relaxed',
                'min-h-[44px] max-h-[200px]'
              )}
              rows={1}
              disabled={isStreaming}
              aria-label="Message input"
            />
            <div className="absolute right-3 bottom-3 flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-mac-textMuted hover:text-mac-text"
                aria-label="Attach file"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-mac-textMuted hover:text-mac-text"
                aria-label="Voice input"
              >
                <Mic className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={!value.trim() || isStreaming}
            className="h-10 w-10 p-0 rounded-xl flex-shrink-0"
            aria-label={isStreaming ? 'Stop streaming' : 'Send message'}
          >
            {isStreaming ? (
              <ArrowUp className="h-5 w-5" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>

        <div className="flex items-center justify-between mt-2 text-xs text-mac-textMuted">
          <span>Shift+Enter for new line • / for commands</span>
          <span>FreeBot</span>
        </div>
      </div>
    </form>
  )
}