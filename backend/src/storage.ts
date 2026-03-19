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
