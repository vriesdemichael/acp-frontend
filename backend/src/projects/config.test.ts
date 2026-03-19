import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const envKey = 'ACP_PROJECTS_CONFIG_PATH'

afterEach(() => {
  vi.resetModules()
  delete process.env[envKey]
})

describe('project config bootstrap', () => {
  it('creates a default projects config when missing', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'acp-projects-'))
    const configPath = join(tempDir, 'projects.json')
    process.env[envKey] = configPath

    const { readProjectConfig } = await import('./config.js')
    const projects = readProjectConfig()

    expect(existsSync(configPath)).toBe(true)
    expect(projects).toHaveLength(1)
    expect(projects[0]).toMatchObject({
      id: 'acp-frontend',
      name: 'acp-frontend',
      path: process.cwd(),
    })

    const file = JSON.parse(readFileSync(configPath, 'utf8')) as {
      projects: Array<{ id: string; path: string }>
    }
    expect(file.projects[0]).toMatchObject({ id: 'acp-frontend', path: process.cwd() })
  })
})
