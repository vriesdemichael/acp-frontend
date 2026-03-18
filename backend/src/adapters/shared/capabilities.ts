import type { InitializeResponse } from '@agentclientprotocol/sdk'
import type { BackendEndpointSupport } from '../../agents/types.js'

export function deriveEndpointSupport(info: InitializeResponse | null): BackendEndpointSupport {
  if (!info) {
    return {
      source: 'unknown',
      implemented: [],
      unknown: [
        'session/new',
        'session/prompt',
        'session/update',
        'session/list',
        'session/resume',
        'session/fork',
        'fs/readTextFile',
        'fs/writeTextFile',
        'terminal/*',
        'permission/request',
      ],
    }
  }

  const implemented = ['session/new', 'session/prompt', 'session/update']
  const unknown: string[] = []
  const capabilities = info.agentCapabilities as Record<string, unknown> | undefined
  const sessionCapabilities = readRecord(capabilities?.['sessionCapabilities'])

  if (sessionCapabilities?.['list']) implemented.push('session/list')
  else unknown.push('session/list')

  if (sessionCapabilities?.['resume']) implemented.push('session/resume')
  else unknown.push('session/resume')

  if (sessionCapabilities?.['fork']) implemented.push('session/fork')
  else unknown.push('session/fork')

  if (capabilities?.['fs']) {
    const fsCapabilities = readRecord(capabilities['fs'])
    if (fsCapabilities?.['readTextFile']) implemented.push('fs/readTextFile')
    else unknown.push('fs/readTextFile')

    if (fsCapabilities?.['writeTextFile']) implemented.push('fs/writeTextFile')
    else unknown.push('fs/writeTextFile')
  } else {
    unknown.push('fs/readTextFile', 'fs/writeTextFile')
  }

  if (capabilities?.['terminal']) implemented.push('terminal/*')
  else unknown.push('terminal/*')

  if (capabilities?.['requestPermission']) implemented.push('permission/request')
  else unknown.push('permission/request')

  return {
    source: 'connection',
    implemented,
    unknown,
  }
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}
