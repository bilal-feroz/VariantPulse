import "server-only";

/**
 * The one place VariantPulse asks a language model to write.
 *
 * A plain fetch against the Claude Messages API, so no SDK dependency. The key
 * is read from AI_API_KEY on the server and never reaches the browser. Nothing
 * here throws: no key, a timeout, a refusal, an error status or an empty reply
 * each resolve to a reason, so every caller can fall back to its deterministic
 * text and the interface never shows an error.
 */

const MESSAGES_URL = "https://api.anthropic.com/v1/messages";

export const AI_MODEL = "claude-opus-5";
export const AI_TIMEOUT_MS = 8_000;

export type DraftFailure = "no-key" | "timeout" | "refusal" | "empty" | "error";

export type DraftResult =
  | { ok: true; text: string; model: string }
  | { ok: false; reason: DraftFailure };

interface MessagesResponse {
  model?: string;
  stop_reason?: string;
  content?: { type: string; text?: string }[];
}

export async function draftWithClaude({
  system,
  prompt,
  maxTokens = 4_096,
  timeoutMs = AI_TIMEOUT_MS,
  apiKey = process.env.AI_API_KEY,
}: {
  system: string;
  prompt: string;
  maxTokens?: number;
  timeoutMs?: number;
  apiKey?: string;
}): Promise<DraftResult> {
  if (!apiKey) return { ok: false, reason: "no-key" };

  try {
    const response = await fetch(MESSAGES_URL, {
      method: "POST",
      cache: "no-store",
      // Covers the whole exchange, body included, not just the headers.
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        // A request the safety classifiers decline is re-run on Anthropic's
        // recommended fallback model instead of coming back as a refusal.
        "anthropic-beta": "server-side-fallback-2026-07-01",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: maxTokens,
        // Short factual writing: low effort keeps the reply well inside the timeout.
        output_config: { effort: "low" },
        fallbacks: "default",
        system,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) return { ok: false, reason: "error" };

    const body = (await response.json()) as MessagesResponse;
    // Read the stop reason before the content: a declined request carries no answer.
    if (body.stop_reason === "refusal") return { ok: false, reason: "refusal" };

    const text = (body.content ?? [])
      .flatMap((block) => (block.type === "text" && typeof block.text === "string" ? [block.text] : []))
      .join("")
      .trim();
    return text ? { ok: true, text, model: body.model ?? AI_MODEL } : { ok: false, reason: "empty" };
  } catch (error) {
    return { ok: false, reason: (error as Error | null)?.name === "TimeoutError" ? "timeout" : "error" };
  }
}
