import { useCallback, useRef, useState } from 'react'
import { useAppStore, useActiveBot, useMessages, useIsStreaming } from '../stores/appStore'
import { sendChatRequest, buildMessages } from '../services/gateway'
import { executeCommand } from '../services/commands'
import { executeFileOperation, parseFileCommand } from '../services/fileSystem'
import type { ChatMessage } from '../types'
import { generateId } from '../utils'

export function useChat() {
  const config = useAppStore(state => state.config)
  const activeBot = useActiveBot()
  const messages = useMessages()
  const isStreaming = useIsStreaming()
  const setMessages = useAppStore(state => state.setMessages)
  const addMessage = useAppStore(state => state.addMessage)
  const updateMessage = useAppStore(state => state.updateMessage)
  const setIsStreaming = useAppStore(state => state.setIsStreaming)
  const setError = useAppStore(state => state.setError)
  const setIsLoading = useAppStore(state => state.setIsLoading)

  const abortControllerRef = useRef<AbortController | null>(null)
  const [pendingCommand, setPendingCommand] = useState<string | null>(null)

  const sendMessage = useCallback(async (content: string) => {
    if (!activeBot || !config) {
      setError('No active bot or configuration')
      return
    }

    if (isStreaming) return

    // Check for commands
    const trimmed = content.trim()
    if (trimmed.startsWith('/')) {
      const commandResult = await executeCommand(trimmed, {
        activeBot,
        config,
        electron: window.electron,
        addMessage: (msg: ChatMessage) => addMessage(msg),
        setIsStreaming,
      })

      if (commandResult) {
        const resultMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: commandResult.success ? commandResult.output || '' : `Error: ${commandResult.error}`,
          timestamp: Date.now(),
        }
        addMessage(resultMessage)
      }
      return
    }

    // Check for natural language file operations
    const fileOp = await parseFileCommand(content)
    if (fileOp) {
      const result = await executeFileOperation(fileOp)
      const resultMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: result,
        timestamp: Date.now(),
      }
      addMessage(resultMessage)
      return
    }

    // Regular chat message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: Date.now(),
    }
    addMessage(userMessage)

    const assistantMessage: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    }
    addMessage(assistantMessage)
    setIsStreaming(true)

    abortControllerRef.current = new AbortController()

    try {
      const apiKey = config.apiKeys.find(k => k.id === activeBot.apiKeyId)
      if (!apiKey) {
        throw new Error('API key not found for active bot')
      }

      const personality = config.bots.find(b => b.id === activeBot.id)
      const systemPrompt = personality?.systemPrompt || ''

      const chatMessages = buildMessages(systemPrompt, messages, content)

      await sendChatRequest({
        baseUrl: config.gatewayUrl,
        apiKey: apiKey.key,
        model: activeBot.model,
        messages: chatMessages,
        temperature: activeBot.temperature,
        stream: config.settings.streamingEnabled,
        onChunk: (chunk) => {
          updateMessage(assistantMessage.id, {
            content: assistantMessage.content + chunk,
          })
        },
        onComplete: (fullResponse) => {
          updateMessage(assistantMessage.id, {
            content: fullResponse,
            isStreaming: false,
          })
          setIsStreaming(false)
        },
        onError: (error) => {
          updateMessage(assistantMessage.id, {
            content: `Error: ${error.message}`,
            isStreaming: false,
          })
          setIsStreaming(false)
          setError(error.message)
        },
        signal: abortControllerRef.current.signal,
      })
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        updateMessage(assistantMessage.id, {
          content: `Error: ${error.message}`,
          isStreaming: false,
        })
        setError(error.message)
      }
      setIsStreaming(false)
    }
  }, [activeBot, config, messages, isStreaming, addMessage, updateMessage, setIsStreaming, setError])

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort()
    setIsStreaming(false)
  }, [setIsStreaming])

  const clearChat = useCallback(() => {
    setMessages([])
  }, [setMessages])

  return {
    messages,
    isStreaming,
    sendMessage,
    stopStreaming,
    clearChat,
    pendingCommand,
    setPendingCommand,
  }
}