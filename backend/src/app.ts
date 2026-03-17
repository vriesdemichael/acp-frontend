import { Hono } from 'hono'
import { healthRoutes } from './routes/health.js'
import { streamRoute } from './routes/stream.js'
import { copilotRoutes } from './adapters/copilot/routes.js'
import type { CopilotAdapter } from './adapters/copilot/adapter.js'

export function createApp(adapter: CopilotAdapter): Hono {
  const app = new Hono()
  app.route('/', healthRoutes())
  app.route('/api', streamRoute(adapter))
  app.route('/api/agents/copilot', copilotRoutes(adapter))
  return app
}
