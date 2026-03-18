import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { CopilotAdapter, CopilotProcess } from './adapters/copilot/index.js'

const PORT = Number(process.env['PORT'] ?? 3001)

const adapter = new CopilotAdapter(
  ({ onExit, onSessionUpdate }) => new CopilotProcess({ onExit, onSessionUpdate })
)

const app = createApp(adapter)

serve({ fetch: app.fetch, hostname: '127.0.0.1', port: PORT }, () => {
  console.log(`ACP backend listening on http://127.0.0.1:${PORT}`)
})
