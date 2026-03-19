import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { getConfigPath } from '../storage.js'

export interface BackendDefinitionRecord {
  id: string
  name: string
  enabled: boolean
  commandCandidates: string[]
  command: string | null
  args: string[]
}

interface BackendConfigFile {
  backends?: BackendDefinitionRecord[]
}

const BACKEND_CONFIG_PATH =
  process.env['ACP_BACKENDS_CONFIG_PATH'] ?? getConfigPath('backends.json')

const DEFAULT_BACKENDS: BackendDefinitionRecord[] = [
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    enabled: true,
    commandCandidates: ['copilot'],
    command: null,
    args: ['--acp'],
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    enabled: true,
    commandCandidates: ['claude', 'claude-code'],
    command: null,
    args: ['--acp'],
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    enabled: true,
    commandCandidates: ['gemini'],
    command: null,
    args: ['--acp'],
  },
  {
    id: 'codex',
    name: 'OpenAI Codex',
    enabled: true,
    commandCandidates: ['codex'],
    command: null,
    args: ['--acp'],
  },
  {
    id: 'opencode',
    name: 'opencode',
    enabled: true,
    commandCandidates: ['opencode'],
    command: null,
    args: ['acp'],
  },
]

export function readBackendConfig(): BackendDefinitionRecord[] {
  ensureBackendConfigExists()
  const file = readBackendConfigFile()
  const configured = file.backends

  if (!configured || configured.length === 0) {
    return DEFAULT_BACKENDS
  }

  return configured.map(normalizeBackendRecord)
}

export function writeBackendConfig(backends: BackendDefinitionRecord[]): void {
  const parentDir = dirname(BACKEND_CONFIG_PATH)
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true })
  }

  writeFileSync(BACKEND_CONFIG_PATH, JSON.stringify({ backends }, null, 2))
}

export function createBackendId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || `backend-${Date.now()}`
}

function readBackendConfigFile(): BackendConfigFile {
  if (!existsSync(BACKEND_CONFIG_PATH)) {
    return {}
  }

  try {
    return JSON.parse(readFileSync(BACKEND_CONFIG_PATH, 'utf8')) as BackendConfigFile
  } catch {
    return {}
  }
}

function ensureBackendConfigExists(): void {
  if (existsSync(BACKEND_CONFIG_PATH)) {
    return
  }

  writeBackendConfig(DEFAULT_BACKENDS)
}

function normalizeBackendRecord(record: BackendDefinitionRecord): BackendDefinitionRecord {
  return {
    id: record.id,
    name: record.name,
    enabled: record.enabled ?? true,
    commandCandidates: Array.isArray(record.commandCandidates)
      ? record.commandCandidates.filter((value): value is string => typeof value === 'string')
      : [],
    command:
      typeof record.command === 'string' && record.command.trim() ? record.command.trim() : null,
    args: Array.isArray(record.args)
      ? record.args.filter((value): value is string => typeof value === 'string')
      : [],
  }
}
