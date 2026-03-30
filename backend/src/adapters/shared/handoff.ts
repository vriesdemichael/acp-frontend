import type { ContentBlock } from '@agentclientprotocol/sdk'
import type { SessionMessage } from '../../agents/types.js'

/** URI used to identify a session-handoff resource. */
export const HANDOFF_RESOURCE_URI = 'acp-frontend://session-handoff'

/**
 * Build the ACP prompt payload that hands off a prior conversation transcript
 * to a new session. Extracted here so both GenericAcpAdapter and
 * CopilotAdapter stay in sync when the format changes.
 */
export function buildHandoffPrompt(messages: SessionMessage[]): ContentBlock[] {
  const transcript = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n')

  return [
    {
      type: 'resource',
      resource: {
        uri: HANDOFF_RESOURCE_URI,
        mimeType: 'text/plain',
        text:
          `[Context from a previous conversation being continued here]\n\n${transcript}\n\n` +
          `[End of previous conversation. Please acknowledge you have the context and are ready to continue.]`,
      },
    },
  ] satisfies ContentBlock[]
}
