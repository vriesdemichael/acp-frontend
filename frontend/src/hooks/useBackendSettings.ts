import { useCallback, useEffect, useState } from 'react'

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
  historyPathHints: string[]
  /** CLI session-state directory hints. Only used by the `copilot` backend. */
  cliHistoryPathHints: string[]
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

export function useBackendSettings() {
  const [backends, setBackends] = useState<BackendSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadBackends = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)

    try {
      const response = await fetch('/api/backends')
      if (!response.ok) {
        throw new Error(`Backend settings failed with status ${response.status}`)
      }

      setBackends((await response.json()) as BackendSummary[])
    } catch (error) {
      console.error('[useBackendSettings] load failed:', error)
      setErrorMessage('Unable to load backend settings right now.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadBackends()
  }, [loadBackends])

  const saveBackend = useCallback(
    async (
      backendId: string,
      patch: {
        enabled?: boolean
        command?: string | null
        args?: string[]
        name?: string
        historyPathHints?: string[]
        cliHistoryPathHints?: string[]
      }
    ) => {
      setSavingId(backendId)
      setErrorMessage(null)

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
        setBackends((current) =>
          current.map((backend) => (backend.id === backendId ? updated : backend))
        )
      } catch (error) {
        console.error('[useBackendSettings] save failed:', error)
        setErrorMessage('Unable to save backend settings right now.')
        throw error
      } finally {
        setSavingId(null)
      }
    },
    []
  )

  const testBackend = useCallback(async (backendId: string) => {
    setTestingId(backendId)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/backends/${encodeURIComponent(backendId)}/test`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error(`Backend test failed with status ${response.status}`)
      }

      const updated = (await response.json()) as BackendSummary
      setBackends((current) =>
        current.map((backend) => (backend.id === backendId ? updated : backend))
      )
    } catch (error) {
      console.error('[useBackendSettings] test failed:', error)
      setErrorMessage('Unable to test this backend right now.')
      throw error
    } finally {
      setTestingId(null)
    }
  }, [])

  const addBackend = useCallback(
    async (input: { name: string; command: string; args?: string[] }) => {
      setErrorMessage(null)

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
        setBackends((current) => [...current, created])
      } catch (error) {
        console.error('[useBackendSettings] create failed:', error)
        setErrorMessage('Unable to add a backend right now.')
        throw error
      }
    },
    []
  )

  return {
    addBackend,
    backends,
    errorMessage,
    loading,
    saveBackend,
    savingId,
    testBackend,
    testingId,
  }
}
