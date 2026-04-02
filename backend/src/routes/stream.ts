import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { BaseStreamEvent } from '../stream-events.js'
import type { AgentRegistry } from '../agents/registry.js'

export function streamRoute(registry: AgentRegistry): Hono {
  const app = new Hono()

  app.get('/stream', (c) => {
    const sessionId = c.req.query('sessionId')
    if (!sessionId) {
      return c.json({ error: 'sessionId query parameter is required' }, 400)
    }

    return streamSSE(c, async (stream) => {
      const bus = registry.eventsForSession(sessionId)
      if (!bus) {
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({ error: 'Session not found' }),
        })
        return
      }

      const listener = (event: BaseStreamEvent) => {
        void stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        })
      }

      bus.on(sessionId, listener)
      stream.onAbort(() => {
        bus.off(sessionId, listener)
      })

      // Keep the connection open until the client disconnects
      await new Promise<void>((resolve) => {
        stream.onAbort(resolve)
      })
    })
  })

  return app
}
