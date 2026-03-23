import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const APP_NAME = 'acp-frontend'

/**
 * Returns the XDG config directory for this application.
 *
 * Resolution order:
 *   1. ACP_CONFIG_DIR env var (explicit override, useful for tests and custom setups)
 *   2. $XDG_CONFIG_HOME/<app> (XDG spec)
 *   3. ~/.config/<app> (XDG default fallback)
 */
export function getConfigDir(): string {
  if (process.env['ACP_CONFIG_DIR']) {
    return process.env['ACP_CONFIG_DIR']
  }

  const xdgConfigHome = process.env['XDG_CONFIG_HOME']
  const base =
    xdgConfigHome && xdgConfigHome.trim() ? xdgConfigHome.trim() : join(homedir(), '.config')

  return join(base, APP_NAME)
}

/**
 * Returns the absolute path to a named config file inside the XDG config dir.
 */
export function getConfigPath(filename: string): string {
  return join(getConfigDir(), filename)
}

/**
 * Resolves the effective config path for a file, preferring the XDG path but
 * falling back to the legacy cwd-relative `.acp/<filename>` path when it
 * exists and the XDG path does not. This preserves backwards compatibility for
 * installs that already have data in the old location.
 *
 * Resolution order (when no env override is active):
 *   1. XDG config path — if the file already exists there, use it.
 *   2. Legacy `.acp/<filename>` (cwd-relative) — if the file exists there, use it.
 *   3. XDG config path — new installs land here by default.
 */
export function resolveConfigPath(filename: string, envVar?: string): string {
  if (envVar && process.env[envVar]) {
    return process.env[envVar]!
  }

  const xdgPath = getConfigPath(filename)
  if (existsSync(xdgPath)) {
    return xdgPath
  }

  const legacyPath = join(process.cwd(), '.acp', filename)
  if (existsSync(legacyPath)) {
    return legacyPath
  }

  return xdgPath
}
