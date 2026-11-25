import type { CommandResult, FileOperation } from '../types'

export interface CommandHandler {
  name: string
  description: string
  usage: string
  handler: (args: string, context: CommandContext) => Promise<CommandResult>
}

export interface CommandContext {
  activeBot: any
  config: any
  electron: any
  addMessage: (message: any) => void
  setIsStreaming: (streaming: boolean) => void
}

const commandRegistry: Map<string, CommandHandler> = new Map()

export function registerCommand(handler: CommandHandler) {
  commandRegistry.set(handler.name, handler)
}

export function getCommand(name: string): CommandHandler | undefined {
  return commandRegistry.get(name)
}

export function getAllCommands(): CommandHandler[] {
  return Array.from(commandRegistry.values())
}

export async function executeCommand(input: string, context: CommandContext): Promise<CommandResult | null> {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) return null

  const [rawCommand, ...args] = trimmed.slice(1).split(' ')
  const command = rawCommand.toLowerCase()
  const argsString = args.join(' ')

  const handler = commandRegistry.get(command)
  if (!handler) {
    return {
      success: false,
      error: `Unknown command: /${command}. Type /help for available commands.`,
      type: 'text',
    }
  }

  try {
    return await handler.handler(argsString, context)
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Command failed',
      type: 'text',
    }
  }
}

// Built-in commands
registerCommand({
  name: 'help',
  description: 'Show all available commands',
  usage: '/help',
  handler: async () => ({
    success: true,
    output: getAllCommands().map(c => `\`/${c.name}\` - ${c.description}\n  Usage: ${c.usage}`).join('\n\n'),
    type: 'text',
  }),
})

registerCommand({
  name: 'personality',
  description: 'Switch personality mode',
  usage: '/personality <name>',
  handler: async (args) => {
    const name = args.trim().toLowerCase()
    if (!name) {
      const personalities = [
        'default', 'freebot', 'coder', 'creative',
        'analyst', 'teacher', 'skeptic'
      ]
      return {
        success: true,
        output: `Available personalities: ${personalities.join(', ')}`,
        type: 'text',
      }
    }
    // This will be handled by the UI to update the bot's personality
    return {
      success: true,
      output: `Personality set to: ${name}`,
      type: 'text',
    }
  },
})

registerCommand({
  name: 'search',
  description: 'Web search via DuckDuckGo',
  usage: '/search <query>',
  handler: async (args, context) => {
    const query = args.trim()
    if (!query) {
      return { success: false, error: 'Usage: /search <query>', type: 'text' }
    }

    try {
      const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })
      const html = await response.text()

      // Simple HTML parsing for results
      const results = parseSearchResults(html)
      if (results.length === 0) {
        return { success: true, output: 'No results found.', type: 'search' }
      }

      const output = results.slice(0, 5).map((r, i) =>
        `${i + 1}. **${r.title}**\n   ${r.snippet}\n   ${r.url}`
      ).join('\n\n')

      return { success: true, output, type: 'search' }
    } catch (error) {
      return { success: false, error: `Search failed: ${error}`, type: 'text' }
    }
  },
})

registerCommand({
  name: 'code',
  description: 'Execute Python/JS code',
  usage: '/code <language> <code>',
  handler: async (args, context) => {
    const match = args.match(/^(python|js|javascript)\s+([\s\S]+)$/i)
    if (!match) {
      return { success: false, error: 'Usage: /code python|js <code>', type: 'text' }
    }

    const [, lang, code] = match
    try {
      const result = await context.electron.fs.write(
        `${context.electron.app.getPath('temp')}/freebot_code_${Date.now()}.${lang === 'python' ? 'py' : 'js'}`,
        code
      )
      // In a real implementation, this would execute via the main process
      return {
        success: true,
        output: `Code saved for execution. Language: ${lang}`,
        type: 'code'
      }
    } catch (error) {
      return { success: false, error: `Failed to save code: ${error}`, type: 'text' }
    }
  },
})

registerCommand({
  name: 'translate',
  description: 'Translate text',
  usage: '/translate <language> | <text>',
  handler: async (args) => {
    const [lang, ...textParts] = args.split('|')
    const language = lang?.trim()
    const text = textParts.join('|').trim()

    if (!language || !text) {
      return { success: false, error: 'Usage: /translate <language> | <text>', type: 'text' }
    }

    return {
      success: true,
      output: `Translation to ${language}: [Would translate "${text}"]`,
      type: 'text'
    }
  },
})

registerCommand({
  name: 'math',
  description: 'Evaluate math expression',
  usage: '/math <expression>',
  handler: async (args) => {
    const expr = args.trim()
    if (!expr) {
      return { success: false, error: 'Usage: /math <expression>', type: 'text' }
    }

    try {
      // Safe math evaluation
      const result = safeEval(expr)
      return { success: true, output: `${expr} = ${result}`, type: 'text' }
    } catch (error) {
      return { success: false, error: `Invalid expression: ${error}`, type: 'text' }
    }
  },
})

registerCommand({
  name: 'summarize',
  description: 'Summarize text',
  usage: '/summarize <text>',
  handler: async (args) => {
    const text = args.trim()
    if (!text) {
      return { success: false, error: 'Usage: /summarize <text>', type: 'text' }
    }

    return {
      success: true,
      output: `Summary: [Would summarize "${text.substring(0, 100)}..."]`,
      type: 'text'
    }
  },
})

registerCommand({
  name: 'write',
  description: 'Draft content',
  usage: '/write <prompt>',
  handler: async (args) => {
    const prompt = args.trim()
    if (!prompt) {
      return { success: false, error: 'Usage: /write <prompt>', type: 'text' }
    }

    return {
      success: true,
      output: `Draft for: ${prompt}\n\n[Content would be generated here]`,
      type: 'text'
    }
  },
})

registerCommand({
  name: 'research',
  description: 'Deep multi-step research',
  usage: '/research <topic>',
  handler: async (args) => {
    const topic = args.trim()
    if (!topic) {
      return { success: false, error: 'Usage: /research <topic>', type: 'text' }
    }

    return {
      success: true,
      output: `Researching: ${topic}\n\n[Multi-step research would be performed]`,
      type: 'research'
    }
  },
})

// Helper functions
function parseSearchResults(html: string): Array<{ title: string; snippet: string; url: string }> {
  const results: Array<{ title: string; snippet: string; url: string }> = []
  const linkRegex = /<a[^>]*class="result__url"[^>]*>([^<]+)<\/a>/g
  const titleRegex = /<a[^>]*class="result__snippet"[^>]*>([^<]+)<\/a>/g
  const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([^<]+)<\/a>/g

  // Simplified parsing - in production use a proper HTML parser
  const urlMatches = html.matchAll(/class="result__url"[^>]*>([^<]+)</g)
  const titleMatches = html.matchAll(/class="result__title"[^>]*>([^<]+)</g)
  const snippetMatches = html.matchAll(/class="result__snippet"[^>]*>([^<]+)</g)

  // This is a placeholder - real implementation would use DOMParser
  return results
}

function safeEval(expr: string): number {
  // Only allow safe math operations
  const sanitized = expr.replace(/[^0-9+\-*/().\s]/g, '')
  if (sanitized !== expr.replace(/\s/g, '')) {
    throw new Error('Invalid characters in expression')
  }

  // Use Function constructor for safe evaluation (still limited)
  return Function(`"use strict"; return (${sanitized})`)()
}