/**
 * Clinician decisions on a review case.
 *
 * A decision records the outcome of a clinical review: whether the change in
 * evidence applies to the records the case covers. It never changes a
 * classification, never writes to a patient record and never issues a
 * diagnosis.
 *
 * The history is append-only. The first entry is the decision as made and
 * every later one is an amendment, so the trail always shows who decided what,
 * and when, rather than only the latest answer.
 */

export const DECISIONS = ["Confirm change", "Not applicable", "Needs more evidence"] as const;

export type Decision = (typeof DECISIONS)[number];

export interface DecisionRecord {
  decision: Decision;
  note: string;
  /** The clinician who recorded it. */
  reviewer: string;
  /** ISO 8601 timestamp. */
  at: string;
}

/** What each decision asserts, in words a reviewer can check against. */
export const DECISION_GUIDANCE: Record<Decision, string> = {
  "Confirm change":
    "The new evidence applies to the records on this case, and they need clinical follow-up.",
  "Not applicable":
    "The change in evidence does not alter what the records on this case mean.",
  "Needs more evidence":
    "The evidence is not yet sufficient to act on. The case stays open to further evidence.",
};

/** A decision is recorded only with a clinician note at least this long. */
export const DECISION_NOTE_MIN = 10;

export function isDecisionNoteValid(note: string): boolean {
  return note.trim().length >= DECISION_NOTE_MIN;
}

/** The decision in force: the latest entry, amendments included. */
export function currentDecision(history: readonly DecisionRecord[]): DecisionRecord | null {
  return history.length > 0 ? history[history.length - 1] : null;
}
