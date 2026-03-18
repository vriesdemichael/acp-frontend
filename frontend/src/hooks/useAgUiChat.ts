import { useState, useEffect, useCallback } from 'react'
import { EventType } from '@ag-ui/core'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export function useAgUiChat() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [thinking, setThinking] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Create session on mount
  useEffect(() => {
    setLoading(true)
    setErrorMessage(null)

    fetch('/api/agents/copilot/session/new', { method: 'POST' })
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(`Session create failed with status ${r.status}`)
        }

        return (await r.json()) as { sessionId: string }
      })
      .then((body: { sessionId: string }) => setSessionId(body.sessionId))
      .catch((err: unknown) => {
        console.error('[useAgUiChat] session create failed:', err)
        setErrorMessage(
          'Unable to start a chat session right now. Reload or try again in a moment.'
        )
      })
      .finally(() => setLoading(false))
  }, [])

  // Open SSE connection once we have a sessionId
  useEffect(() => {
    if (!sessionId) return

    const sse = new EventSource(`/api/stream?sessionId=${encodeURIComponent(sessionId)}`)

    sse.addEventListener(EventType.RUN_STARTED, () => {
      setThinking(true)
    })

    sse.addEventListener(EventType.TEXT_MESSAGE_START, (e: MessageEvent<string>) => {
      const { messageId } = JSON.parse(e.data) as { messageId: string }
      setMessages((prev) => [...prev, { id: messageId, role: 'assistant', content: '' }])
    })

    sse.addEventListener(EventType.TEXT_MESSAGE_CONTENT, (e: MessageEvent<string>) => {
      const { messageId, delta } = JSON.parse(e.data) as { messageId: string; delta: string }
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, content: m.content + delta } : m))
      )
    })

    sse.addEventListener(EventType.RUN_FINISHED, () => {
      setThinking(false)
    })

    sse.addEventListener(EventType.RUN_ERROR, () => {
      setThinking(false)
    })

    sse.onerror = () => {
      setThinking(false)
      setErrorMessage((current) => current ?? 'The live chat stream disconnected unexpectedly.')
    }

    return () => {
      sse.close()
    }
  }, [sessionId])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!sessionId) return

      setErrorMessage(null)
      setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: 'user', content: text }])

      try {
        const response = await fetch('/api/agents/copilot/session/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, message: text }),
        })

        if (!response.ok) {
          throw new Error(`Message send failed with status ${response.status}`)
        }
      } catch (err) {
        console.error('[useAgUiChat] message send failed:', err)
        setErrorMessage('Message failed to send. Check the agent connection and try again.')
        throw err
      }
    },
    [sessionId]
  )

  return {
    sessionId,
    messages,
    thinking,
    sendMessage,
    ready: sessionId !== null,
    loading,
    errorMessage,
  }
}
