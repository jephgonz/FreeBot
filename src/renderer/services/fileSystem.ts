import type { FileOperation } from '../types'

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  isFile: boolean
  size?: number
  modified?: Date
}

export async function readFile(path: string): Promise<string> {
  return window.electron.fs.read(path)
}

export async function writeFile(path: string, content: string): Promise<boolean> {
  return window.electron.fs.write(path, content)
}

export async function listDirectory(path: string): Promise<FileEntry[]> {
  const entries = await window.electron.fs.list(path)
  return entries.map(e => ({
    name: e.name,
    path: `${path}/${e.name}`.replace(/\/+/g, '/'),
    isDirectory: e.isDirectory,
    isFile: e.isFile,
  }))
}

export async function createDirectory(path: string): Promise<boolean> {
  return window.electron.fs.mkdir(path)
}

export async function deletePath(path: string): Promise<boolean> {
  return window.electron.fs.delete(path)
}

export async function openFileDialog(): Promise<string[]> {
  return window.electron.dialog.openFile()
}

export async function openDirectoryDialog(): Promise<string[]> {
  return window.electron.dialog.openDirectory()
}

export async function saveFileDialog(options?: { defaultPath?: string; filters?: any[] }): Promise<string | undefined> {
  return window.electron.dialog.saveFile(options)
}

// Natural language file operations
export async function parseFileCommand(input: string): Promise<FileOperation | null> {
  const lower = input.toLowerCase().trim()

  // Create file
  let match = lower.match(/^create file named\s+(.+?)\s+with content\s+(.+)$/i)
  if (match) {
    return {
      type: 'create',
      path: match[1].trim(),
      content: match[2].trim(),
    }
  }

  // Create file (alternative)
  match = lower.match(/^create file\s+(.+)$/i)
  if (match) {
    return {
      type: 'create',
      path: match[1].trim(),
      content: '',
    }
  }

  // Read file
  match = lower.match(/^read file\s+(.+)$/i)
  if (match) {
    return {
      type: 'read',
      path: match[1].trim(),
    }
  }

  // List files
  match = lower.match(/^list files in\s+(.+)$/i)
  if (match) {
    return {
      type: 'list',
      path: match[1].trim(),
    }
  }

  match = lower.match(/^list files$/i)
  if (match) {
    return {
      type: 'list',
      path: '.',
    }
  }

  // Create folder
  match = lower.match(/^create folder\s+(.+)$/i)
  if (match) {
    return {
      type: 'mkdir',
      path: match[1].trim(),
    }
  }

  // Delete file
  match = lower.match(/^delete file\s+(.+)$/i)
  if (match) {
    return {
      type: 'delete',
      path: match[1].trim(),
    }
  }

  return null
}

export async function executeFileOperation(op: FileOperation): Promise<string> {
  try {
    switch (op.type) {
      case 'create':
        await writeFile(op.path, op.content || '')
        return `Created file: ${op.path}`

      case 'read': {
        const content = await readFile(op.path)
        return `Content of ${op.path}:\n\`\`\`\n${content}\n\`\`\``
      }

      case 'list': {
        const entries = await listDirectory(op.path)
        if (entries.length === 0) {
          return `Directory "${op.path}" is empty`
        }
        const lines = entries.map(e =>
          `${e.isDirectory ? '📁' : '📄'} ${e.name}`
        )
        return `Files in ${op.path}:\n${lines.join('\n')}`
      }

      case 'mkdir':
        await createDirectory(op.path)
        return `Created directory: ${op.path}`

      case 'delete':
        await deletePath(op.path)
        return `Deleted: ${op.path}`

      default:
        return `Unknown operation: ${op.type}`
    }
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

// Get home directory
export async function getHomeDir(): Promise<string> {
  return window.electron.app.getPath('home')
}

// Get desktop directory
export async function getDesktopDir(): Promise<string> {
  return window.electron.app.getPath('desktop')
}

// Get documents directory
export async function getDocumentsDir(): Promise<string> {
  return window.electron.app.getPath('documents')
}

// Get downloads directory
export async function getDownloadsDir(): Promise<string> {
  return window.electron.app.getPath('downloads')
}

// Get temp directory
export async function getTempDir(): Promise<string> {
  return window.electron.app.getPath('temp')
}