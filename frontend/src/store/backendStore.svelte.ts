/**
 * backendStore.svelte.ts
 *
 * Provides stores for:
 * - read-only agent status cards (acpx-managed)
 * - editable history source path hints
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BackendSummary {
  id: string
  name: string
  status: 'active' | 'disabled' | 'detected' | 'unavailable'
  command: string | null
  canResume: boolean
}

export type HistoryProvider = 'gemini' | 'copilot' | 'opencode'

export interface HistorySourceConfig {
  provider: HistoryProvider
  /** VS Code workspace storage roots (or generic search roots for non-Copilot providers). */
  paths: string[]
  /** CLI session-state directory paths. Only meaningful for `copilot`. */
  cliPaths?: string[]
}

export interface HistorySourceDescriptor {
  id: string
  backendId: string
  providerId: string
  kind:
    | 'cli_session_dir'
    | 'cli_history_dir'
    | 'vscode_workspace_db'
    | 'vscode_chat_sessions'
    | 'vscode_chat_editing_sessions'
    | 'vscode_extension_resources'
    | 'gemini_tmp_dir'
    | 'opencode_db'
  path: string
  platform: 'linux' | 'mounted_host' | 'windows' | 'unknown'
  access: 'readable' | 'missing' | 'permission_error' | 'invalid'
  signal: 'contains_history' | 'empty' | 'unknown'
  discoveredBy: 'auto' | 'manual'
  lastModifiedMs?: number
  sessionCount?: number
  warnings?: string[]
}

export interface HistorySourceStatus {
  provider: HistoryProvider
  discoveredSources: HistorySourceDescriptor[]
  summary: {
    readable: number
    missing: number
    invalid: number
    containsHistory: number
    totalSessions: number
  }
}

// ---------------------------------------------------------------------------
// Backend settings store
// ---------------------------------------------------------------------------

export function createBackendStore() {
  let backends = $state<BackendSummary[]>([])
  let loading = $state(true)
  let errorMessage = $state<string | null>(null)

  async function load() {
    loading = true
    errorMessage = null

    try {
      const response = await fetch('/api/agents')
      if (!response.ok) {
        throw new Error(`Agents request failed with status ${response.status}`)
      }
      backends = (await response.json()) as BackendSummary[]
    } catch (error) {
      console.error('[backendStore] load failed:', error)
      errorMessage = 'Unable to load agent status right now.'
    } finally {
      loading = false
    }
  }

  return {
    get backends() {
      return backends
    },
    get loading() {
      return loading
    },
    get errorMessage() {
      return errorMessage
    },
    load,
  }
}

// ---------------------------------------------------------------------------
// History sources store
// ---------------------------------------------------------------------------

export function createHistorySourcesStore() {
  let sources = $state<HistorySourceConfig[]>([])
  let sourceStatus = $state<HistorySourceStatus[]>([])
  let loading = $state(true)
  let savingProvider = $state<HistoryProvider | null>(null)
  let errorMessage = $state<string | null>(null)

  async function load() {
    loading = true
    errorMessage = null

    try {
      const response = await fetch('/api/history-sources')
      if (!response.ok) {
        throw new Error(`History sources failed with status ${response.status}`)
      }
      sources = (await response.json()) as HistorySourceConfig[]

      const statusResponse = await fetch('/api/history-sources/status')
      if (!statusResponse.ok) {
        throw new Error(`History source status failed with status ${statusResponse.status}`)
      }
      sourceStatus = (await statusResponse.json()) as HistorySourceStatus[]
    } catch (error) {
      console.error('[historySourcesStore] load failed:', error)
      errorMessage = 'Unable to load history sources right now.'
    } finally {
      loading = false
    }
  }

  async function saveSource(
    provider: HistoryProvider,
    patch: { paths?: string[]; cliPaths?: string[] }
  ) {
    savingProvider = provider
    errorMessage = null

    try {
      const response = await fetch(`/api/history-sources/${encodeURIComponent(provider)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })

      if (!response.ok) {
        throw new Error(`History source save failed with status ${response.status}`)
      }

      const updated = (await response.json()) as HistorySourceConfig
      const exists = sources.some((s) => s.provider === provider)
      sources = exists
        ? sources.map((s) => (s.provider === provider ? updated : s))
        : [...sources, updated]

      const statusResponse = await fetch('/api/history-sources/status')
      if (statusResponse.ok) {
        sourceStatus = (await statusResponse.json()) as HistorySourceStatus[]
      }
    } catch (error) {
      console.error('[historySourcesStore] save failed:', error)
      errorMessage = 'Unable to save history source settings right now.'
      throw error
    } finally {
      savingProvider = null
    }
  }

  return {
    get sources() {
      return sources
    },
    get sourceStatus() {
      return sourceStatus
    },
    get loading() {
      return loading
    },
    get savingProvider() {
      return savingProvider
    },
    get errorMessage() {
      return errorMessage
    },
    load,
    saveSource,
  }
}
