import { spawnSync } from 'node:child_process'

export interface CommandDetection {
  detected: boolean
  command: string | null
}

export function detectAvailableCommand(commands: string[]): CommandDetection {
  for (const command of commands) {
    const result = spawnSync(command, ['--version'], {
      stdio: 'ignore',
      timeout: 3_000,
    })

    if (result.error === undefined && result.status === 0) {
      return {
        detected: true,
        command,
      }
    }
  }

  return {
    detected: false,
    command: null,
  }
}
