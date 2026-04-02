import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { resolveConfigPath } from '../storage.js'

export type HistoryProvider = 'gemini' | 'copilot' | 'opencode'

export interface HistorySourceRecord {
  provider: HistoryProvider
  /** VS Code workspace storage roots (or generic search roots for non-Copilot providers). */
  paths: string[]
  /** CLI session-state directory paths. Only meaningful for the `copilot` provider. */
  cliPaths?: string[]
}

interface HistorySourcesConfigFile {
  sources?: HistorySourceRecord[]
}

function getConfigPath(): string {
  return resolveConfigPath('history-sources.json', 'ACP_HISTORY_SOURCES_CONFIG_PATH')
}

const DEFAULT_SOURCES: HistorySourceRecord[] = [
  { provider: 'copilot', paths: [], cliPaths: [] },
  { provider: 'gemini', paths: [] },
  { provider: 'opencode', paths: [] },
]

export function readHistorySourcesConfig(): HistorySourceRecord[] {
  ensureHistorySourcesConfigExists()
  const file = readHistorySourcesConfigFile()
  const configured = file.sources

  if (!configured || configured.length === 0) {
    return DEFAULT_SOURCES
  }

  return configured.map(normalizeHistorySourceRecord)
}

export function writeHistorySourcesConfig(sources: HistorySourceRecord[]): void {
  const configPath = getConfigPath()
  const parentDir = dirname(configPath)
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true })
  }

  writeFileSync(configPath, JSON.stringify({ sources }, null, 2))
}

export function updateHistorySource(
  provider: HistoryProvider,
  patch: { paths?: string[]; cliPaths?: string[] }
): HistorySourceRecord[] {
  const config = readHistorySourcesConfig()
  const index = config.findIndex((s) => s.provider === provider)

  if (index === -1) {
    config.push(
      normalizeHistorySourceRecord({
        provider,
        paths: patch.paths ?? [],
        cliPaths: patch.cliPaths,
      })
    )
  } else {
    const current = config[index]!
    config[index] = normalizeHistorySourceRecord({
      provider,
      paths: Array.isArray(patch.paths) ? patch.paths : current.paths,
      cliPaths: patch.cliPaths !== undefined ? patch.cliPaths : current.cliPaths,
    })
  }

  writeHistorySourcesConfig(config)
  return config
}

/**
 * Returns the `BackendHistoryConfig`-compatible shape for a given provider ID so
 * that `history/index.ts` functions can be called without change.
 */
export function getHistoryHintsForProvider(provider: HistoryProvider): {
  historyPathHints: string[]
  cliHistoryPathHints: string[]
} {
  const config = readHistorySourcesConfig()
  const record = config.find((s) => s.provider === provider)
  return {
    historyPathHints: record?.paths ?? [],
    cliHistoryPathHints: record?.cliPaths ?? [],
  }
}

function readHistorySourcesConfigFile(): HistorySourcesConfigFile {
  const configPath = getConfigPath()
  if (!existsSync(configPath)) {
    return {}
  }

  try {
    return JSON.parse(readFileSync(configPath, 'utf8')) as HistorySourcesConfigFile
  } catch {
    return {}
  }
}

function ensureHistorySourcesConfigExists(): void {
  if (existsSync(getConfigPath())) {
    return
  }

  writeHistorySourcesConfig(DEFAULT_SOURCES)
}

function normalizeHistorySourceRecord(record: HistorySourceRecord): HistorySourceRecord {
  const normalized: HistorySourceRecord = {
    provider: record.provider,
    paths: Array.isArray(record.paths)
      ? record.paths.filter((p): p is string => typeof p === 'string')
      : [],
  }

  // Only include cliPaths for copilot; include it (even empty) when present so
  // the key is persisted.
  if (record.provider === 'copilot' || record.cliPaths !== undefined) {
    normalized.cliPaths = Array.isArray(record.cliPaths)
      ? record.cliPaths.filter((p): p is string => typeof p === 'string')
      : []
  }

  return normalized
}
