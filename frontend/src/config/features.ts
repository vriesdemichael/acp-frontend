/**
 * Feature flags for the acp-frontend application.
 *
 * These are source-level booleans. To disable a feature, set the constant to
 * false here. No environment-variable plumbing is required.
 */

/**
 * When true, AG-UI CUSTOM events with name "a2ui:*" are consumed and rendered
 * as structured UI blocks inside the chat transcript.
 *
 * When false, CUSTOM events are silently ignored and all assistant output
 * continues to render as plain text (the original behaviour).
 */
export const ENABLE_A2UI = true
