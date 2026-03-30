import { Hono } from 'hono'
import type { AgentRegistry } from '../agents/registry.js'

export function agentsRoutes(registry: AgentRegistry): Hono {
  const app = new Hono()

  app.get('/agents', (c) => c.json(registry.listAgents()))
  app.get('/backends', (c) => c.json(registry.listBackends()))

  app.post('/backends', async (c) => {
    const body = await c.req.json<{
      name?: string
      command?: string
      args?: string[]
    }>()

    if (!body.name?.trim() || !body.command?.trim()) {
      return c.json({ error: 'name and command are required' }, 400)
    }

    try {
      const backend = registry.addBackend({
        name: body.name,
        command: body.command,
        args: body.args,
      })
      return c.json(backend, 201)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return c.json({ error: message }, 400)
    }
  })

  app.patch('/backends/:id', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json<{
      enabled?: boolean
      command?: string | null
      args?: string[]
      name?: string
      historyPathHints?: string[]
      cliHistoryPathHints?: string[]
    }>()

    try {
      const backend = registry.updateBackend(id, body)
      return c.json(backend)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.startsWith('Unknown backend')) {
        return c.json({ error: message }, 404)
      }

      return c.json({ error: message }, 400)
    }
  })

  app.post('/backends/:id/test', async (c) => {
    const id = c.req.param('id')

    try {
      const backend = await registry.testBackend(id)
      return c.json(backend)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.startsWith('Unknown backend')) {
        return c.json({ error: message }, 404)
      }

      return c.json({ error: message }, 400)
    }
  })

  return app
}
