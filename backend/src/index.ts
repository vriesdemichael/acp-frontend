import { serve } from '@hono/node-server'
import { createApp } from './app.js'

const PORT = Number(process.env['PORT'] ?? 3001)

const app = createApp()

serve({ fetch: app.fetch, hostname: '127.0.0.1', port: PORT }, () => {
  console.log(`ACP backend listening on http://127.0.0.1:${PORT}`)
})
