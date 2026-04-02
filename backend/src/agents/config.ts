import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { resolveConfigPath } from '../storage.js'

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

const BACKEND_CONFIG_PATH = resolveConfigPath('backends.json', 'ACP_BACKENDS_CONFIG_PATH')

const LEGACY_COPILOT_IDS = new Set([
  'copilot-cli-wsl',
  'copilot-cli-host',
  'copilot-vscode-host',
  'copilot-vscode-wsl',
])

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

  return migrateLegacyCopilotBackends(configured.map(normalizeBackendRecord))
}

/**
 * Migrate old split Copilot backend records (copilot-cli-wsl, copilot-cli-host,
 * copilot-vscode-host, copilot-vscode-wsl) into a single `copilot` backend.
 * Any user-customized command/args from the CLI backends are preserved.
 * History path hints previously stored on these records are no longer part of
 * `BackendDefinitionRecord` — they live in `history-sources.json` now.
 * Non-Copilot backends are unchanged.
 * Does not delete unknown custom user backends.
 */
function migrateLegacyCopilotBackends(
  backends: BackendDefinitionRecord[]
): BackendDefinitionRecord[] {
  const legacyBackends = backends.filter((b) => LEGACY_COPILOT_IDS.has(b.id))
  const otherBackends = backends.filter((b) => !LEGACY_COPILOT_IDS.has(b.id))

  // Already migrated or no legacy backends present
  if (legacyBackends.length === 0) {
    return backends
  }

  // If a 'copilot' backend already exists alongside legacy ones, just remove legacy
  if (otherBackends.some((b) => b.id === 'copilot')) {
    return otherBackends
  }

  // Merge legacy backends into a single copilot record.
  // Prefer a backend with an explicit command (i.e., the CLI backend the user configured)
  // over a history-only record that only has commandCandidates but no resolved command.
  const cliBackend =
    legacyBackends.find((b) => b.command !== null) ??
    legacyBackends.find((b) => b.commandCandidates.length > 0)
  const enabled = legacyBackends.some((b) => b.enabled)

  const merged: BackendDefinitionRecord = {
    id: 'copilot',
    name: 'GitHub Copilot',
    enabled,
    commandCandidates: cliBackend?.commandCandidates ?? ['copilot'],
    command: cliBackend?.command ?? null,
    args: cliBackend?.args ?? ['--acp'],
  }

  return [merged, ...otherBackends]
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
    enabled: (record as { enabled?: boolean }).enabled ?? true,
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
