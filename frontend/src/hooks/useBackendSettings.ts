import { useCallback, useEffect, useState } from 'react'

export interface BackendEndpointSupport {
  source: 'connection' | 'unknown'
  implemented: string[]
  unknown: string[]
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
      patch: { enabled?: boolean; command?: string | null; args?: string[]; name?: string }
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
