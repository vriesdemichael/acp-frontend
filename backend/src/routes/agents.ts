import { Hono } from 'hono'
import type { AgentRegistry } from '../agents/registry.js'
import {
  readHistorySourcesConfig,
  updateHistorySource,
  type HistoryProvider,
} from '../history/sources-config.js'
import { getHistorySourceDescriptors } from '../history/index.js'
import type { HistorySourceDescriptor } from '../agents/types.js'

const VALID_PROVIDERS = new Set<string>(['gemini', 'copilot', 'opencode'])

const PROVIDER_AGENT_ID: Record<HistoryProvider, string> = {
  copilot: 'copilot',
  gemini: 'gemini-cli',
  opencode: 'opencode',
}

interface HistorySourceStatus {
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

  // --- History Sources ---

  app.get('/history-sources', (c) => {
    const sources = readHistorySourcesConfig()
    return c.json(sources)
  })

  app.get('/history-sources/status', (c) => {
    const sources = readHistorySourcesConfig()
    const status: HistorySourceStatus[] = sources.map((source) => {
      const agentId = PROVIDER_AGENT_ID[source.provider]
      const discoveredSources = getHistorySourceDescriptors(
        agentId,
        source.paths,
        source.cliPaths ?? []
      )

      const summary = discoveredSources.reduce(
        (acc, descriptor) => {
          if (descriptor.access === 'readable') acc.readable += 1
          if (descriptor.access === 'missing') acc.missing += 1
          if (descriptor.access === 'invalid') acc.invalid += 1
          if (descriptor.signal === 'contains_history') acc.containsHistory += 1
          acc.totalSessions += descriptor.sessionCount ?? 0
          return acc
        },
        { readable: 0, missing: 0, invalid: 0, containsHistory: 0, totalSessions: 0 }
      )

      return {
        provider: source.provider,
        discoveredSources,
        summary,
      }
    })

    return c.json(status)
  })

  app.patch('/history-sources/:provider', async (c) => {
    const provider = c.req.param('provider')

    if (!VALID_PROVIDERS.has(provider)) {
      return c.json({ error: `Unknown provider: ${provider}` }, 404)
    }

    try {
      const body = await c.req.json<{
        paths?: string[]
        cliPaths?: string[]
      }>()

      const updated = updateHistorySource(provider as HistoryProvider, {
        paths: body.paths,
        cliPaths: body.cliPaths,
      })
      const record = updated.find((s) => s.provider === provider)
      return c.json(record)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return c.json({ error: message }, 400)
    }
  })

  return app
}
