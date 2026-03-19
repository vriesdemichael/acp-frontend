import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const envKey = 'ACP_PROJECTS_CONFIG_PATH'

afterEach(() => {
  vi.resetModules()
  delete process.env[envKey]
})

describe('project service helpers', () => {
  it('allows child paths that start with dots but stay inside the project', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'acp-project-service-'))
    const projectRoot = join(tempDir, 'repo')
    mkdirSync(join(projectRoot, '..fixtures'), { recursive: true })
    writeFileSync(join(projectRoot, '..fixtures', 'notes.txt'), 'hello')

    process.env[envKey] = join(tempDir, 'projects.json')
    const { __projectServiceTestUtils } = await import('./service.js')

    await expect(
      __projectServiceTestUtils.directoryHasChildren(join(projectRoot, '..fixtures'))
    ).resolves.toBe(true)

    expect(() =>
      __projectServiceTestUtils.ensureWithinProject(
        projectRoot,
        join(projectRoot, '..fixtures', 'notes.txt')
      )
    ).not.toThrow()
  })
})
