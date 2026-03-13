import type { ClaudeResponse } from '../types'
import { isValidClaudeResponse } from '../types'

// ── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Strip markdown code fences that Claude occasionally wraps JSON in despite
 * being instructed not to. Handles both ```json ... ``` and ``` ... ```.
 */
function extractJSON(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  return fenced ? fenced[1].trim() : raw.trim()
}

// ── Primary export: transcript → diagram ─────────────────────────────────────

/**
 * Send a spoken transcript to claude-sonnet-4-6 and receive a structured
 * diagram definition. Throws a user-friendly Error on any failure.
 *
 * The actual HTTP call is made from the Electron main process via the
 * `call-claude` IPC handler (net.fetch). Direct renderer fetch to
 * api.anthropic.com is blocked by Chromium's CORS enforcement.
 */
export async function sendTranscriptToClaude(
  transcript: string,
  _apiKey: string,  // key is read securely from storage in the main process
): Promise<ClaudeResponse> {
  if (!transcript.trim()) {
    throw new Error('Transcript is empty. Please record some speech first.')
  }

  // IPC call — runs entirely in the main process; rejects with a user-friendly
  // Error if the key is missing, the network fails, or the API returns an error.
  const responseText = await window.electronAPI.callClaude(transcript)

  // Parse the API envelope
  let envelope: unknown
  try {
    envelope = JSON.parse(responseText)
  } catch {
    throw new Error('Received an unreadable response from the API. Please try again.')
  }

  // Guard against max_tokens truncation — truncated JSON will fail to parse
  const stopReason = (envelope as { stop_reason?: string })?.stop_reason
  if (stopReason === 'max_tokens') {
    throw new Error(
      "Claude's response was cut off before it finished. Please try again with a shorter description."
    )
  }

  // Extract the text block from the content array
  const raw: string =
    (envelope as { content?: Array<{ type: string; text: string }> })
      ?.content
      ?.find((b) => b.type === 'text')
      ?.text ?? ''

  if (!raw) {
    throw new Error("Claude returned an empty response. Please try again.")
  }

  // Strip any accidental markdown fences before parsing
  const jsonText = extractJSON(raw)

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    const preview = raw.slice(0, 200).replace(/\n/g, ' ')
    throw new Error(
      `Claude returned a response that could not be parsed as JSON. Please try again.\n\nReceived: ${preview}…`
    )
  }

  // Full structural validation
  if (!isValidClaudeResponse(parsed)) {
    throw new Error(
      "Claude's response was missing required fields (diagramType, reason, title, nodes, or edges). Please try again."
    )
  }

  // Enforce the 4–12 node range
  const nodeCount = parsed.nodes.length
  if (nodeCount < 4 || nodeCount > 12) {
    throw new Error(
      `Claude generated ${nodeCount} node${nodeCount !== 1 ? 's' : ''}, but the diagram requires between 4 and 12. Please try again.`
    )
  }

  return parsed
}

// ── Settings screen connection test ─────────────────────────────────────────

/**
 * Validate a key by making a real (minimal) API call.
 * Routes through the Electron IPC bridge so the call uses main-process
 * net.fetch — avoids the same CORS restriction as sendTranscriptToClaude.
 */
export async function testConnection(
  apiKey: string,
): Promise<{ ok: boolean; message: string }> {
  if (!apiKey.trim()) {
    return { ok: false, message: 'Please enter an API key before testing.' }
  }
  return window.electronAPI.testApiKey(apiKey)
}
