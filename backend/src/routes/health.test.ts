import { describe, it, expect } from 'vitest'
import { healthRoutes } from '../routes/health.js'

describe('GET /health', () => {
  const app = healthRoutes()

  it('returns 200', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
  })

  it('returns { status: "ok" }', async () => {
    const res = await app.request('/health')
    const body = await res.json()
    expect(body).toEqual({ status: 'ok' })
  })

  it('responds with application/json content-type', async () => {
    const res = await app.request('/health')
    expect(res.headers.get('content-type')).toContain('application/json')
  })
})
