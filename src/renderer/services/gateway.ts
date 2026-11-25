import type { ChatMessage } from '../types'

export interface ChatOptions {
  baseUrl: string
  apiKey: string
  model: string
  messages: { role: string; content: string }[]
  temperature: number
  stream: boolean
  onChunk?: (chunk: string) => void
  onComplete?: (fullResponse: string) => void
  onError?: (error: Error) => void
  signal?: AbortSignal
}

export interface ModelListResponse {
  object: string
  data: Array<{
    id: string
    object: string
    owned_by: string
    permission: any[]
  }>
}

export async function fetchModels(baseUrl: string, apiKey: string): Promise<ModelListResponse> {
  const response = await fetch(`${baseUrl}/models`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to fetch models: ${response.status} - ${error}`)
  }

  return response.json()
}

export async function sendChatRequest(options: ChatOptions): Promise<string> {
  const { baseUrl, apiKey, model, messages, temperature, stream, onChunk, onComplete, onError, signal } = options

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        stream,
      }),
      signal,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Chat request failed: ${response.status} - ${error}`)
    }

    if (stream) {
      return handleStreamingResponse(response, onChunk, onComplete, onError)
    } else {
      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''
      onComplete?.(content)
      return content
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error
    }
    const err = error instanceof Error ? error : new Error(String(error))
    onError?.(err)
    throw err
  }
}

async function handleStreamingResponse(
  response: Response,
  onChunk?: (chunk: string) => void,
  onComplete?: (fullResponse: string) => void,
  onError?: (error: Error) => void
): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let fullResponse = ''
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') {
            onComplete?.(fullResponse)
            return fullResponse
          }

          try {
            const parsed = JSON.parse(data)
            const chunk = parsed.choices?.[0]?.delta?.content || ''
            if (chunk) {
              fullResponse += chunk
              onChunk?.(chunk)
            }
          } catch {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  onComplete?.(fullResponse)
  return fullResponse
}

export function buildMessages(
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string
): { role: string; content: string }[] {
  const messages: { role: string; content: string }[] = []

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt })
  }

  for (const msg of history) {
    if (msg.role !== 'system' || msg.content !== systemPrompt) {
      messages.push({ role: msg.role, content: msg.content })
    }
  }

  messages.push({ role: 'user', content: userMessage })

  return messages
}