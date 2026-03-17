import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { BaseEvent } from '@ag-ui/core'
import type { CopilotAdapter } from '../adapters/copilot/adapter.js'

export function streamRoute(adapter: CopilotAdapter): Hono {
  const app = new Hono()

  app.get('/stream', (c) => {
    const sessionId = c.req.query('sessionId')
    if (!sessionId) {
      return c.json({ error: 'sessionId query parameter is required' }, 400)
    }

    return streamSSE(c, async (stream) => {
      const listener = (event: BaseEvent) => {
        void stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        })
      }

      adapter.events.on(sessionId, listener)
      stream.onAbort(() => {
        adapter.events.off(sessionId, listener)
      })

      // Keep the connection open until the client disconnects
      await new Promise<void>((resolve) => {
        stream.onAbort(resolve)
      })
    })
  })

  return app
}
