/**
 * backendStore.svelte.ts — Svelte 5 runes port of useBackendSettings.ts
 *
 * Provides createBackendStore() and createHistorySourcesStore() factory functions.
 * Auto-loads on mount via the returned `load()` method (called from onMount in components).
 */

// ---------------------------------------------------------------------------
// Re-exported types (kept identical to useBackendSettings.ts for compat)
// ---------------------------------------------------------------------------

export interface BackendEndpointSupport {
  source: 'connection' | 'unknown'
  implemented: string[]
  unknown: string[]
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

export interface HistorySourceDiscoverySummary {
  family: string
  readable: number
  missing: number
  invalid: number
  containsHistory: number
}

export interface HistorySupport {
  source: 'none' | 'derived' | 'native'
  supported: Array<
    | 'text'
    | 'markdown'
    | 'reasoning'
    | 'tool_calls'
    | 'skills'
    | 'subagents'
    | 'attachments'
    | 'rich_media'
    | 'file_operations'
    | 'patches'
    | 'compaction'
    | 'truncation'
  >
  discoveredSources: HistorySourceDescriptor[]
  discoverySummary?: HistorySourceDiscoverySummary[]
}

export interface BackendSummary {
  id: string
  name: string
  status: 'active' | 'disabled' | 'detected' | 'unavailable'
  command: string | null
  detectedCommand: string | null
  args: string[]
  defaultArgs: string[]
  enabled: boolean
  usesCustomCommand: boolean
  endpointSupport: BackendEndpointSupport
  historySupport: HistorySupport
  lastTestResult: {
    ok: boolean
    message: string
    testedAt: string
  } | null
}

export type HistoryProvider = 'gemini' | 'copilot' | 'opencode'

export interface HistorySourceConfig {
  provider: HistoryProvider
  /** VS Code workspace storage roots (or generic search roots for non-Copilot providers). */
  paths: string[]
  /** CLI session-state directory paths. Only meaningful for `copilot`. */
  cliPaths?: string[]
}

// ---------------------------------------------------------------------------
// Backend settings store
// ---------------------------------------------------------------------------

export function createBackendStore() {
  let backends = $state<BackendSummary[]>([])
  let loading = $state(true)
  let savingId = $state<string | null>(null)
  let errorMessage = $state<string | null>(null)

  async function load() {
    loading = true
    errorMessage = null

    try {
      const response = await fetch('/api/backends')
      if (!response.ok) {
        throw new Error(`Backend settings failed with status ${response.status}`)
      }
      backends = (await response.json()) as BackendSummary[]
    } catch (error) {
      console.error('[backendStore] load failed:', error)
      errorMessage = 'Unable to load backend settings right now.'
    } finally {
      loading = false
    }
  }

  async function saveBackend(
    backendId: string,
    patch: {
      enabled?: boolean
      command?: string | null
      args?: string[]
      name?: string
    }
  ) {
    savingId = backendId
    errorMessage = null

    try {
      const response = await fetch(`/api/backends/${encodeURIComponent(backendId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })

      if (!response.ok) {
        throw new Error(`Backend save failed with status ${response.status}`)
      }

      const updated = (await response.json()) as BackendSummary
      backends = backends.map((backend) => (backend.id === backendId ? updated : backend))
    } catch (error) {
      console.error('[backendStore] save failed:', error)
      errorMessage = 'Unable to save backend settings right now.'
      throw error
    } finally {
      savingId = null
    }
  }

  async function addBackend(input: { name: string; command: string; args?: string[] }) {
    errorMessage = null

    try {
      const response = await fetch('/api/backends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      if (!response.ok) {
        throw new Error(`Backend create failed with status ${response.status}`)
      }

      const created = (await response.json()) as BackendSummary
      backends = [...backends, created]
    } catch (error) {
      console.error('[backendStore] create failed:', error)
      errorMessage = 'Unable to add a backend right now.'
      throw error
    }
  }

  return {
    get backends() {
      return backends
    },
    get loading() {
      return loading
    },
    get savingId() {
      return savingId
    },
    get errorMessage() {
      return errorMessage
    },
    load,
    saveBackend,
    addBackend,
  }
}

// ---------------------------------------------------------------------------
// History sources store
// ---------------------------------------------------------------------------

export function createHistorySourcesStore() {
  let sources = $state<HistorySourceConfig[]>([])
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
