import { NextResponse } from "next/server";

import { draftWithClaude } from "@/lib/ai";
import { assessmentForCase } from "@/lib/analysis";
import {
  SUMMARY_SYSTEM_PROMPT,
  buildSummaryPrompt,
  composeFallbackSummary,
  parseSummary,
  summaryFacts,
  summaryFingerprint,
  type SummaryResult,
} from "@/lib/summary";

export const dynamic = "force-dynamic";

/** Summaries by case and by the facts they were written from, for the life of the server. */
const cache = new Map<string, { result: SummaryResult; expires: number }>();

/** How long a template stands in after a failed model call before the model is tried again. */
const RETRY_AFTER_MS = 2 * 60 * 1000;

/**
 * Drafts the evidence summary for one case.
 *
 * The prompt is built from that case's assessment alone. Whatever the model
 * returns is checked (sentence count, a source tag on every sentence drawn only
 * from this case, no clinical advice) before it is used; anything that fails,
 * like a missing key, a timeout or a refusal, is answered with the
 * deterministic summary from the same facts, so the response is always usable.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { caseId?: unknown } | null;
  const caseId = typeof body?.caseId === "string" ? body.caseId : null;
  const assessment = caseId ? await assessmentForCase(caseId).catch(() => null) : null;
  if (!caseId || !assessment) {
    return NextResponse.json({ error: "Unknown case" }, { status: 404 });
  }

  const facts = summaryFacts(assessment);
  const key = `${caseId}:${summaryFingerprint(facts)}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return NextResponse.json({ ...hit.result, cached: true });

  const draft = await draftWithClaude({
    system: SUMMARY_SYSTEM_PROMPT,
    prompt: buildSummaryPrompt(facts),
  });

  let result: SummaryResult;
  if (draft.ok) {
    const sentences = parseSummary(draft.text, facts);
    result = sentences
      ? { caseId, sentences, source: "ai", model: draft.model }
      : { caseId, sentences: composeFallbackSummary(facts), source: "fallback", reason: "failed-checks" };
  } else {
    result = { caseId, sentences: composeFallbackSummary(facts), source: "fallback", reason: draft.reason };
  }

  // A model summary, or the absence of a key, will not change until the facts
  // or the server do; a failed call is worth retrying after a pause.
  const lasting = result.source === "ai" || result.reason === "no-key";
  cache.set(key, { result, expires: lasting ? Number.POSITIVE_INFINITY : Date.now() + RETRY_AFTER_MS });

  return NextResponse.json({ ...result, cached: false });
}
