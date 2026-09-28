/**
 * Clinician decisions on a review case.
 *
 * A decision records the outcome of a clinical review: what the service will
 * do about a change in evidence for the records the case covers. It never
 * changes a classification, never writes to a patient record and never issues
 * a diagnosis. Every decision carries the clinician's rationale.
 *
 * The history is append-only. The first entry is the decision as made and
 * every later one is an amendment, so the trail always shows who decided what,
 * and when, rather than only the latest answer.
 */

export const DECISIONS = ["Refer to genetics", "Needs further evidence", "No action"] as const;

export type Decision = (typeof DECISIONS)[number];

export interface DecisionRecord {
  decision: Decision;
  /** The clinician's rationale, as written. */
  note: string;
  /** The clinician who recorded it. */
  reviewer: string;
  /** ISO 8601 timestamp. */
  at: string;
}

/** What each decision asserts, in words a reviewer can check against. */
export const DECISION_GUIDANCE: Record<Decision, string> = {
  "Refer to genetics":
    "The updated evidence applies to the records on this case. Refer them for clinical genetics review; follow-up tasks need approval before anything reaches a patient.",
  "Needs further evidence":
    "The evidence is not yet sufficient to act on. The case stays open until the requested evidence arrives and a final decision is recorded.",
  "No action":
    "The updated evidence does not change management for the records on this case. The rationale is kept, and the case can be closed.",
};

/** A decision is recorded only with a rationale at least this long. */
export const DECISION_NOTE_MIN = 10;

export function isDecisionNoteValid(note: string): boolean {
  return note.trim().length >= DECISION_NOTE_MIN;
}

/** The decision in force: the latest entry, amendments included. */
export function currentDecision(history: readonly DecisionRecord[]): DecisionRecord | null {
  return history.length > 0 ? history[history.length - 1] : null;
}

/** Whether a decision settles the review, rather than holding it open for evidence. */
export function isSettled(decision: Decision): boolean {
  return decision !== "Needs further evidence";
}

/** Only a referral acts on the change, so only a referral leads to follow-up that reaches a patient. */
export function actsOnChange(decision: Decision): boolean {
  return decision === "Refer to genetics";
}
