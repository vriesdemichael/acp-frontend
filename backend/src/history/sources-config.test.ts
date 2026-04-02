import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  getHistoryHintsForProvider,
  readHistorySourcesConfig,
  updateHistorySource,
  writeHistorySourcesConfig,
} from './sources-config.js'

function makeTempDir(): string {
  const dir = join(tmpdir(), `acp-sources-config-test-${Date.now()}-${Math.random()}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

describe('sources-config', () => {
  let tempDir: string
  let origEnv: string | undefined

  beforeEach(() => {
    tempDir = makeTempDir()
    origEnv = process.env['ACP_HISTORY_SOURCES_CONFIG_PATH']
    process.env['ACP_HISTORY_SOURCES_CONFIG_PATH'] = join(tempDir, 'history-sources.json')
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
    if (origEnv === undefined) {
      delete process.env['ACP_HISTORY_SOURCES_CONFIG_PATH']
    } else {
      process.env['ACP_HISTORY_SOURCES_CONFIG_PATH'] = origEnv
    }
  })

  describe('readHistorySourcesConfig', () => {
    it('returns defaults when no config file exists', () => {
      const result = readHistorySourcesConfig()

      expect(result).toHaveLength(3)
      expect(result.map((r) => r.provider)).toEqual(['copilot', 'gemini', 'opencode'])
    })

    it('writes the defaults when the config file is missing', () => {
      readHistorySourcesConfig()

      const path = process.env['ACP_HISTORY_SOURCES_CONFIG_PATH']!
      expect(existsSync(path)).toBe(true)
    })

    it('reads configured sources from the file', () => {
      const configPath = process.env['ACP_HISTORY_SOURCES_CONFIG_PATH']!
      writeFileSync(
        configPath,
        JSON.stringify({
          sources: [
            { provider: 'copilot', paths: ['/a/b'], cliPaths: ['/c/d'] },
            { provider: 'gemini', paths: ['/e/f'] },
          ],
        }),
        'utf8'
      )

      const result = readHistorySourcesConfig()

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ provider: 'copilot', paths: ['/a/b'], cliPaths: ['/c/d'] })
      expect(result[1]).toEqual({ provider: 'gemini', paths: ['/e/f'] })
    })

    it('normalizes malformed paths arrays', () => {
      const configPath = process.env['ACP_HISTORY_SOURCES_CONFIG_PATH']!
      writeFileSync(
        configPath,
        JSON.stringify({
          sources: [{ provider: 'opencode', paths: [42, null, '/valid'] }],
        }),
        'utf8'
      )

      const result = readHistorySourcesConfig()
      expect(result[0]!.paths).toEqual(['/valid'])
    })

    it('returns defaults when file contains empty sources array', () => {
      const configPath = process.env['ACP_HISTORY_SOURCES_CONFIG_PATH']!
      writeFileSync(configPath, JSON.stringify({ sources: [] }), 'utf8')

      const result = readHistorySourcesConfig()
      expect(result).toHaveLength(3)
    })

    it('returns defaults on invalid JSON', () => {
      const configPath = process.env['ACP_HISTORY_SOURCES_CONFIG_PATH']!
      writeFileSync(configPath, 'not json', 'utf8')

      const result = readHistorySourcesConfig()
      expect(result).toHaveLength(3)
    })
  })

  describe('writeHistorySourcesConfig', () => {
    it('writes sources to JSON file', () => {
      writeHistorySourcesConfig([
        { provider: 'copilot', paths: ['/a'], cliPaths: ['/b'] },
        { provider: 'gemini', paths: [] },
      ])

      const result = readHistorySourcesConfig()
      expect(result[0]).toEqual({ provider: 'copilot', paths: ['/a'], cliPaths: ['/b'] })
    })

    it('creates parent directories as needed', () => {
      const nested = join(tempDir, 'nested', 'deeply', 'history-sources.json')
      process.env['ACP_HISTORY_SOURCES_CONFIG_PATH'] = nested

      writeHistorySourcesConfig([{ provider: 'opencode', paths: ['/foo'] }])

      const result = readHistorySourcesConfig()
      expect(result[0]!.paths).toEqual(['/foo'])
    })
  })

  describe('updateHistorySource', () => {
    it('updates paths for an existing provider', () => {
      writeHistorySourcesConfig([{ provider: 'gemini', paths: ['/old'] }])

      const result = updateHistorySource('gemini', { paths: ['/new1', '/new2'] })

      expect(result.find((s) => s.provider === 'gemini')?.paths).toEqual(['/new1', '/new2'])
    })

    it('updates cliPaths for copilot without touching paths', () => {
      writeHistorySourcesConfig([
        { provider: 'copilot', paths: ['/vscode'], cliPaths: ['/cli-old'] },
      ])

      const result = updateHistorySource('copilot', { cliPaths: ['/cli-new'] })

      const copilot = result.find((s) => s.provider === 'copilot')
      expect(copilot?.paths).toEqual(['/vscode'])
      expect(copilot?.cliPaths).toEqual(['/cli-new'])
    })

    it('adds provider entry when not present', () => {
      writeHistorySourcesConfig([{ provider: 'gemini', paths: [] }])

      const result = updateHistorySource('opencode', { paths: ['/foo'] })

      expect(result.find((s) => s.provider === 'opencode')?.paths).toEqual(['/foo'])
    })

    it('persists changes to disk', () => {
      writeHistorySourcesConfig([{ provider: 'gemini', paths: [] }])

      updateHistorySource('gemini', { paths: ['/persisted'] })
      const result = readHistorySourcesConfig()

      expect(result.find((s) => s.provider === 'gemini')?.paths).toEqual(['/persisted'])
    })
  })

  describe('getHistoryHintsForProvider', () => {
    it('returns empty arrays for unknown provider', () => {
      readHistorySourcesConfig() // init defaults

      const result = getHistoryHintsForProvider('gemini')
      expect(result).toEqual({ historyPathHints: [], cliHistoryPathHints: [] })
    })

    it('returns configured paths and cliPaths for copilot', () => {
      writeHistorySourcesConfig([{ provider: 'copilot', paths: ['/a', '/b'], cliPaths: ['/c'] }])

      const result = getHistoryHintsForProvider('copilot')
      expect(result).toEqual({ historyPathHints: ['/a', '/b'], cliHistoryPathHints: ['/c'] })
    })

    it('returns paths and empty cliPaths for gemini', () => {
      writeHistorySourcesConfig([{ provider: 'gemini', paths: ['/g'] }])

      const result = getHistoryHintsForProvider('gemini')
      expect(result).toEqual({ historyPathHints: ['/g'], cliHistoryPathHints: [] })
    })
  })
})
