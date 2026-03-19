import { homedir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const envKeys = ['ACP_CONFIG_DIR', 'XDG_CONFIG_HOME'] as const

afterEach(() => {
  vi.resetModules()
  for (const key of envKeys) {
    delete process.env[key]
  }
})

describe('getConfigDir', () => {
  it('uses ACP_CONFIG_DIR when set', async () => {
    process.env['ACP_CONFIG_DIR'] = '/custom/config/dir'
    const { getConfigDir } = await import('./storage.js')
    expect(getConfigDir()).toBe('/custom/config/dir')
  })

  it('uses XDG_CONFIG_HOME when set', async () => {
    process.env['XDG_CONFIG_HOME'] = '/xdg/config'
    const { getConfigDir } = await import('./storage.js')
    expect(getConfigDir()).toBe('/xdg/config/acp-frontend')
  })

  it('falls back to ~/.config/acp-frontend when neither env var is set', async () => {
    const { getConfigDir } = await import('./storage.js')
    expect(getConfigDir()).toBe(join(homedir(), '.config', 'acp-frontend'))
  })

  it('ignores a blank XDG_CONFIG_HOME and falls back to ~/.config', async () => {
    process.env['XDG_CONFIG_HOME'] = '   '
    const { getConfigDir } = await import('./storage.js')
    expect(getConfigDir()).toBe(join(homedir(), '.config', 'acp-frontend'))
  })
})

describe('getConfigPath', () => {
  it('joins the config dir with the given filename', async () => {
    process.env['ACP_CONFIG_DIR'] = '/my/config'
    const { getConfigPath } = await import('./storage.js')
    expect(getConfigPath('backends.json')).toBe('/my/config/backends.json')
  })
})
