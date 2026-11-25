import { useRef, useEffect } from 'react'
import { Copy, Check, Loader2 } from 'lucide-react'
import { cn } from '../utils'
import { useChat } from '../hooks/useChat'
import { Avatar } from './ui/Avatar'
import { formatTimestamp, parseMarkdown } from '../utils'
import { Button } from './ui/Button'

export function ChatArea() {
  const { messages, isStreaming, stopStreaming } = useChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleCopy = async (content: string) => {
    await navigator.clipboard.writeText(content)
  }

  const renderMessageContent = (content: string) => {
    // Simple markdown rendering - in production use a proper library like react-markdown
    return (
      <div className="prose prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }} />
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center text-mac-textMuted">
          <div className="w-16 h-16 rounded-2xl bg-mac-hover flex items-center justify-center mx-auto mb-4">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-mac-text mb-1">Welcome to FreeBot</h3>
          <p className="text-sm">Select or create a bot from the sidebar to start chatting</p>
          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-mac-textMuted">
            <kbd className="px-2 py-1 bg-mac-bg border border-mac-border rounded">/</kbd>
            <span>for commands</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={chatContainerRef}
      className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin"
      role="log"
      aria-live="polite"
      aria-label="Chat messages"
    >
      {messages.map((message, index) => (
        <MessageBubble
          key={message.id}
          message={message}
          isLast={index === messages.length - 1}
          onCopy={handleCopy}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  )
}

interface MessageBubbleProps {
  message: any
  isLast: boolean
  onCopy: (content: string) => void
}

function MessageBubble({ message, isLast, onCopy }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  return (
    <div
      className={cn(
        'flex gap-3 animate-fade-in',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {!isUser && (
        <Avatar
          name="Assistant"
          color="#007acc"
          size="sm"
        />
      )}

      <div
        className={cn(
          'max-w-[80%] px-4 py-2.5 rounded-2xl relative',
          isUser
            ? 'bg-mac-accent text-white rounded-tr-md'
            : 'bg-mac-sidebar text-mac-text rounded-tl-md border border-mac-border'
        )}
      >
        <div className="text-sm leading-relaxed whitespace-pre-wrap">
          {renderMessageContent(message.content)}
        </div>

        {(isLast && message.isStreaming) && (
          <div className="flex items-center gap-1 mt-1 text-xs text-mac-textMuted">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Streaming...</span>
          </div>
        )}

        <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-xs text-mac-textMuted">{formatTimestamp(message.timestamp)}</span>
          {!isUser && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-mac-textMuted hover:text-mac-text"
              onClick={() => { onCopy(message.content); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              aria-label="Copy message"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-mac-green" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          )}
        </div>
      </div>

      {isUser && (
        <Avatar
          name="You"
          color="#ff6b35"
          size="sm"
        />
      )}
    </div>
  )
}

import { useState } from 'react'