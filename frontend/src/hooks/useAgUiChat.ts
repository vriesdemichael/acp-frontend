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

  // Create session on mount
  useEffect(() => {
    fetch('/api/agents/copilot/session/new', { method: 'POST' })
      .then((r) => r.json())
      .then((body: { sessionId: string }) => setSessionId(body.sessionId))
      .catch((err: unknown) => console.error('[useAgUiChat] session create failed:', err))
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
        prev.map((m) => (m.id === messageId ? { ...m, content: m.content + delta } : m)),
      )
    })

    sse.addEventListener(EventType.RUN_FINISHED, () => {
      setThinking(false)
    })

    sse.addEventListener(EventType.RUN_ERROR, () => {
      setThinking(false)
    })

    return () => {
      sse.close()
    }
  }, [sessionId])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!sessionId) return
      setMessages((prev) => [
        ...prev,
        { id: `user-${Date.now()}`, role: 'user', content: text },
      ])
      await fetch('/api/agents/copilot/session/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: text }),
      })
    },
    [sessionId],
  )

  return { messages, thinking, sendMessage, ready: sessionId !== null }
}
