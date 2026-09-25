import { NextResponse } from "next/server";

import { draftWithClaude } from "@/lib/ai";
import { assessmentForCase } from "@/lib/analysis";
import {
  LETTER_SYSTEM_PROMPT,
  buildLetterPrompt,
  composePatientLetter,
  parseImprovedLetter,
  type LetterImprovement,
  type LetterInput,
} from "@/lib/letter";

export const dynamic = "force-dynamic";

/** Rewordings by case and record, for the life of the server. */
const cache = new Map<string, LetterImprovement>();

/**
 * "Improve with AI" for the patient letter.
 *
 * The letter is rebuilt here from the case and the record, never taken from the
 * browser, and the model is asked only to reword it. Its reply is used only if
 * it still carries every fact and stays inside the letter's limits (see
 * `parseImprovedLetter`); otherwise, or if the model cannot be reached in time,
 * the template comes back unchanged.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    caseId?: unknown;
    recordId?: unknown;
  } | null;
  const caseId = typeof body?.caseId === "string" ? body.caseId : null;
  const assessment = caseId ? await assessmentForCase(caseId).catch(() => null) : null;
  const record = assessment?.impactedPatients.find((p) => p.id === body?.recordId);
  if (!caseId || !assessment || !record) {
    return NextResponse.json({ error: "Unknown case or record" }, { status: 404 });
  }

  const input: LetterInput = {
    caseId,
    recordId: record.id,
    gene: assessment.variant.gene,
    testedOn: record.testedOn,
    department: record.orderingDepartment,
    clinicalOwner: record.clinicalOwner,
  };
  const key = JSON.stringify(input);
  const hit = cache.get(key);
  if (hit) return NextResponse.json(hit);

  const template = composePatientLetter(input);
  const draft = await draftWithClaude({
    system: LETTER_SYSTEM_PROMPT,
    prompt: buildLetterPrompt(template),
  });
  const improved = draft.ok ? parseImprovedLetter(draft.text, input) : null;

  const result: LetterImprovement = improved
    ? { ...improved, source: "ai" }
    : { ...template, source: "template", reason: draft.ok ? "failed-checks" : draft.reason };
  // Only a usable rewording is kept; a failed call is tried again next time.
  if (result.source === "ai") cache.set(key, result);

  return NextResponse.json(result);
}
