/**
 * The review workflow: what happens to a case after VariantPulse raises it.
 *
 *   updated evidence → matched records → named owner → documented decision
 *     → approved follow-up → closed case
 *
 * Pure and client-safe. The state a session holds per case is `CaseState`;
 * everything else here is derived from it (the stage, the deadline, whether the
 * case needs escalating or can close, the journey drawn at the top of a case),
 * so the interface can never show a stage the history does not support.
 *
 * Nothing here writes to a record or changes a classification. A follow-up is
 * a task for the care team, and one that would reach a patient stays a
 * proposal until someone other than its proposer approves it.
 */

import {
  actsOnChange,
  currentDecision,
  isSettled,
  type Decision,
  type DecisionRecord,
} from "./decision";
import type { Tone } from "./classification";
import type { PriorityLevel } from "./priority";

const DAY_MS = 86_400_000;

/* -- Case state ------------------------------------------------------------ */

export type CaseStage =
  | "New"
  | "Assigned"
  | "In review"
  | "Awaiting evidence"
  | "Decision recorded"
  | "Follow-up approved"
  | "Closed";

export type CaseEventType =
  | "raised"
  | "owner"
  | "review-opened"
  | "evidence-request"
  | "decision"
  | "amendment"
  | "follow-up-proposed"
  | "follow-up-approved"
  | "follow-up-declined"
  | "follow-up-withdrawn"
  | "follow-up-done"
  | "escalated"
  | "closed"
  | "reopened"
  | "note"
  | "summary";

/** One entry in a case's history. Appended, never edited. */
export interface CaseEvent {
  id: string;
  at: string;
  type: CaseEventType;
  /** Who acted: a named person, or VariantPulse for automatic events. */
  actor: string;
  /** The actor's role at the time. */
  role: string;
  summary: string;
  detail?: string;
}

export type FollowUpKind = "genetics-referral" | "notify-clinician" | "patient-letter" | "other";

/**
 * `Withdrawn`: taken back by its proposer before a decision on it.
 * `Superseded`: still open when the decision it served was amended, so it
 * no longer applies; the new decision needs its own follow-up.
 */
export type FollowUpStatus = "Proposed" | "Approved" | "Declined" | "Done" | "Withdrawn" | "Superseded";

export interface FollowUpTask {
  id: string;
  kind: FollowUpKind;
  title: string;
  detail: string;
  status: FollowUpStatus;
  proposedBy: string;
  proposedAt: string;
  /** The decision this follow-up serves, by the time it was recorded. */
  decisionAt: string;
  /** Who approved or declined it, when, and why. */
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  completedBy?: string;
  completedAt?: string;
}

export interface ClosureRecord {
  by: string;
  at: string;
  note: string;
}

export interface CaseState {
  /** When VariantPulse raised the case; the review deadline runs from here. */
  raisedAt: string | null;
  /** The named clinician accountable for the case. */
  owner: string | null;
  reviewOpenedAt: string | null;
  evidenceRequested: boolean;
  /** Oldest first: the decision as made, then each amendment. */
  decisions: DecisionRecord[];
  followUps: FollowUpTask[];
  closure: ClosureRecord | null;
  /** When the case passed its deadline undecided and went to the service lead. */
  escalatedAt: string | null;
  events: CaseEvent[];
}

export function emptyCase(): CaseState {
  return {
    raisedAt: null,
    owner: null,
    reviewOpenedAt: null,
    evidenceRequested: false,
    decisions: [],
    followUps: [],
    closure: null,
    escalatedAt: null,
    events: [],
  };
}

export const CASE_EVENT_LABEL: Record<CaseEventType, string> = {
  raised: "Raised",
  owner: "Owner",
  "review-opened": "Review opened",
  "evidence-request": "Evidence request",
  decision: "Decision",
  amendment: "Decision amended",
  "follow-up-proposed": "Follow-up proposed",
  "follow-up-approved": "Follow-up approved",
  "follow-up-declined": "Follow-up declined",
  "follow-up-withdrawn": "Follow-up withdrawn",
  "follow-up-done": "Follow-up done",
  escalated: "Escalated",
  closed: "Closed",
  reopened: "Reopened",
  note: "Note",
  summary: "Evidence summary",
};

/* -- Stage ----------------------------------------------------------------- */

export const STAGES: readonly CaseStage[] = [
  "New",
  "Assigned",
  "In review",
  "Awaiting evidence",
  "Decision recorded",
  "Follow-up approved",
  "Closed",
];

export const STAGE_META: Record<CaseStage, { tone: Tone; description: string }> = {
  New: { tone: "warning", description: "Raised by VariantPulse; no owner yet." },
  Assigned: { tone: "neutral", description: "A named owner is accountable; review not yet opened." },
  "In review": { tone: "neutral", description: "The owner is reviewing the evidence." },
  "Awaiting evidence": {
    tone: "warning",
    description: "Held open until further evidence arrives and a final decision is recorded.",
  },
  "Decision recorded": {
    tone: "neutral",
    description: "A decision and its rationale are on file; follow-up not yet approved.",
  },
  "Follow-up approved": {
    tone: "positive",
    description: "Follow-up approved by someone other than its proposer; ready to close.",
  },
  Closed: { tone: "muted", description: "Closed with a note. Reopening is recorded." },
};

const isApproved = (task: FollowUpTask) => task.status === "Approved" || task.status === "Done";

/**
 * The follow-ups that serve the decision in force. Those proposed under an
 * earlier decision stay in the list as history, but no longer approve,
 * block or release anything.
 */
export function activeFollowUps(state: CaseState): FollowUpTask[] {
  const decision = currentDecision(state.decisions);
  return decision ? state.followUps.filter((task) => task.decisionAt === decision.at) : [];
}

/**
 * What an amendment does to the follow-ups of the decision it replaces: any
 * still awaiting approval, or approved but not yet carried out, no longer
 * apply. Those already done or declined stay as they were, as history.
 */
export function supersedeFollowUps(tasks: FollowUpTask[], previousAt: string, at: string): FollowUpTask[] {
  return tasks.map((task) =>
    task.decisionAt === previousAt && (task.status === "Proposed" || task.status === "Approved")
      ? { ...task, status: "Superseded", reviewedAt: at, reviewNote: "The decision it served was amended." }
      : task,
  );
}

export function caseStage(state: CaseState): CaseStage {
  if (state.closure) return "Closed";
  const decision = currentDecision(state.decisions);
  if (decision) {
    if (!isSettled(decision.decision)) return "Awaiting evidence";
    return activeFollowUps(state).some(isApproved) ? "Follow-up approved" : "Decision recorded";
  }
  if (state.reviewOpenedAt) return "In review";
  if (state.owner) return "Assigned";
  return "New";
}

/* -- Deadline and escalation ---------------------------------------------- */

/**
 * Days from a case being raised to a documented decision, by review priority.
 * Placeholders: a pilot agrees its own with the partner's clinical governance.
 */
export const REVIEW_SLA_DAYS: Record<PriorityLevel, number> = {
  CRITICAL: 7,
  HIGH: 14,
  MEDIUM: 30,
  LOW: 60,
};

/** Within this many days of the deadline an undecided case is due soon. */
export const DUE_SOON_DAYS = 2;

export function reviewDeadline(raisedAt: string, level: PriorityLevel): string {
  return new Date(Date.parse(raisedAt) + REVIEW_SLA_DAYS[level] * DAY_MS).toISOString();
}

export type DeadlineState = "on-track" | "due-soon" | "overdue" | "met" | "met-late";

export interface DeadlineStatus {
  dueAt: string;
  state: DeadlineState;
  /** Milliseconds until the deadline; negative once it has passed. */
  msLeft: number;
  /** The first documented decision, which is what meets the deadline. */
  metAt: string | null;
}

/**
 * Where a case stands against its review deadline. The deadline is met by the
 * first documented decision, including one that holds the case open for more
 * evidence: the clock measures whether someone looked, not how it ended.
 */
export function deadlineStatus(
  state: CaseState,
  level: PriorityLevel,
  now: Date,
): DeadlineStatus | null {
  if (!state.raisedAt) return null;
  const dueAt = reviewDeadline(state.raisedAt, level);
  const due = Date.parse(dueAt);
  const msLeft = due - now.getTime();
  const first = state.decisions[0] ?? null;

  if (first) {
    return { dueAt, state: Date.parse(first.at) > due ? "met-late" : "met", msLeft, metAt: first.at };
  }
  if (msLeft < 0) return { dueAt, state: "overdue", msLeft, metAt: null };
  if (msLeft <= DUE_SOON_DAYS * DAY_MS) return { dueAt, state: "due-soon", msLeft, metAt: null };
  return { dueAt, state: "on-track", msLeft, metAt: null };
}

function days(ms: number): number {
  return Math.max(1, Math.round(Math.abs(ms) / DAY_MS));
}

/** "Due in 4 days", "Overdue by 2 days", "Decided on time". */
export function describeDeadline(status: DeadlineStatus): string {
  switch (status.state) {
    case "met":
      return "Decided on time";
    case "met-late": {
      const late = Date.parse(status.metAt ?? status.dueAt) - Date.parse(status.dueAt);
      return `Decided ${days(late)} day${days(late) === 1 ? "" : "s"} late`;
    }
    case "overdue":
      return `Overdue by ${days(status.msLeft)} day${days(status.msLeft) === 1 ? "" : "s"}`;
    default:
      return status.msLeft < DAY_MS
        ? "Due within a day"
        : `Due in ${days(status.msLeft)} day${days(status.msLeft) === 1 ? "" : "s"}`;
  }
}

export const DEADLINE_TONE: Record<DeadlineState, Tone> = {
  "on-track": "muted",
  "due-soon": "warning",
  overdue: "critical",
  met: "positive",
  "met-late": "warning",
};

/** An open case past its deadline with no decision goes to the service lead, once. */
export function needsEscalation(state: CaseState, level: PriorityLevel, now: Date): boolean {
  if (state.closure || state.escalatedAt) return false;
  return deadlineStatus(state, level, now)?.state === "overdue";
}

/* -- Follow-up tasks ------------------------------------------------------- */

export interface FollowUpKindMeta {
  label: string;
  /** What a completed task says it did. */
  doneLabel: string;
  /** The button that completes an approved task. */
  completeAction: string;
  /** Whether carrying it out would reach a patient; blocked in a silent pilot. */
  patientFacing: boolean;
}

export const FOLLOW_UP_KINDS: Record<FollowUpKind, FollowUpKindMeta> = {
  "genetics-referral": {
    label: "Genetics referral",
    doneLabel: "Referral sent",
    completeAction: "Mark referral sent",
    patientFacing: true,
  },
  "notify-clinician": {
    label: "Clinician notification",
    doneLabel: "Clinician notified",
    completeAction: "Mark clinician notified",
    patientFacing: false,
  },
  "patient-letter": {
    label: "Patient explanation",
    doneLabel: "Letter released",
    completeAction: "Mark letter released",
    patientFacing: true,
  },
  other: {
    label: "Follow-up",
    doneLabel: "Done",
    completeAction: "Mark done",
    patientFacing: false,
  },
};

export type FollowUpDraft = Pick<FollowUpTask, "kind" | "title" | "detail">;

interface SuggestionInput {
  decision: Decision;
  gene: string;
  records: { id: string; clinicalOwner: string }[];
}

const listOf = (values: string[]) =>
  values.length <= 1 ? values.join("") : `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`;

/**
 * The follow-ups a decision usually leads to, offered to the reviewer to
 * propose. A referral acts on the change, so it suggests the referral, telling
 * the ordering clinicians, and a patient explanation. "No action" suggests only
 * recording it with the clinicians. Awaiting evidence suggests nothing.
 */
export function suggestedFollowUps({ decision, gene, records }: SuggestionInput): FollowUpDraft[] {
  const ids = records.map((r) => r.id);
  const owners = [...new Set(records.map((r) => r.clinicalOwner))];
  const recordText = `${ids.length} record${ids.length === 1 ? "" : "s"} (${listOf(ids)})`;

  if (decision === "Refer to genetics") {
    return [
      {
        kind: "genetics-referral",
        title: "Refer to Clinical Genetics",
        detail: `Refer ${recordText} for clinical genetics review of the ${gene} result, through the ordering clinician.`,
      },
      {
        kind: "notify-clinician",
        title: "Notify the ordering clinicians",
        detail: `Tell ${listOf(owners)} that the interpretation of the ${gene} result has changed and that a referral is proposed.`,
      },
      {
        kind: "patient-letter",
        title: "Patient explanation letter (English and Arabic)",
        detail:
          "Prepare a plain-language letter for each record. It is released by the care team only once approved; VariantPulse sends nothing to patients.",
      },
    ];
  }
  if (decision === "No action") {
    return [
      {
        kind: "notify-clinician",
        title: "Record the decision with the ordering clinicians",
        detail: `Tell ${listOf(owners)} that the ${gene} change was reviewed and does not alter management, with the rationale on this case.`,
      },
    ];
  }
  return [];
}

export function pendingApprovals(state: CaseState): FollowUpTask[] {
  return activeFollowUps(state).filter((task) => task.status === "Proposed");
}

/** A patient letter is released only through an approved follow-up of the decision in force. */
export function letterApproved(state: CaseState): boolean {
  return activeFollowUps(state).some((task) => task.kind === "patient-letter" && isApproved(task));
}

/* -- Closure --------------------------------------------------------------- */

/** A closing note is required, and must say something. */
export const CLOSURE_NOTE_MIN = 10;

/** Why the case cannot close yet, or null when it can. */
export function closureBlocker(state: CaseState): string | null {
  if (state.closure) return "The case is already closed.";
  const decision = currentDecision(state.decisions);
  if (!decision) return "Record a decision before closing the case.";
  if (!isSettled(decision.decision)) {
    return "The case is awaiting further evidence. Record a final decision before closing it.";
  }
  const pending = pendingApprovals(state).length;
  if (pending > 0) {
    return `${pending} follow-up${pending === 1 ? " still awaits" : "s still await"} approval.`;
  }
  // A referral decision is carried out by a referral, not by a notification
  // or a letter on their own.
  if (
    actsOnChange(decision.decision) &&
    !activeFollowUps(state).some((task) => task.kind === "genetics-referral" && isApproved(task))
  ) {
    return "A referral decision needs an approved genetics referral before the case can close.";
  }
  return null;
}

/* -- Timing ---------------------------------------------------------------- */

/** From opening the review to the first documented decision: the reviewer's working time. */
export function reviewDurationMs(state: CaseState): number | null {
  const first = state.decisions[0];
  if (!state.reviewOpenedAt || !first) return null;
  const ms = Date.parse(first.at) - Date.parse(state.reviewOpenedAt);
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}

/** From the case being raised to the first documented decision. */
export function timeToDecisionMs(state: CaseState): number | null {
  const first = state.decisions[0];
  if (!state.raisedAt || !first) return null;
  const ms = Date.parse(first.at) - Date.parse(state.raisedAt);
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}

/* -- Journey --------------------------------------------------------------- */

export type JourneyKey = "evidence" | "matched" | "owner" | "decision" | "follow-up" | "closed";

export interface JourneyStep {
  key: JourneyKey;
  label: string;
  status: "done" | "current" | "upcoming" | "skipped";
  detail: string | null;
  at: string | null;
  actor: string | null;
}

export interface JourneyContext {
  /** "Uncertain significance → Likely pathogenic". */
  change: string;
  /** Who reported the change: the evidence source. */
  source: string;
  /** When the source last evaluated the current reading. */
  evaluatedAt: string | null;
  recordsMatched: number;
}

function latest(state: CaseState, type: CaseEventType): CaseEvent | undefined {
  for (let i = state.events.length - 1; i >= 0; i -= 1) {
    if (state.events[i].type === type) return state.events[i];
  }
  return undefined;
}

/** The six steps from new evidence to a closed case, with who did each and when. */
export function caseJourney(state: CaseState, context: JourneyContext): JourneyStep[] {
  const decision = currentDecision(state.decisions);
  const settled = decision ? isSettled(decision.decision) : false;
  const active = activeFollowUps(state);
  const approved = active.filter(isApproved);
  const firstApproved = [...approved].sort((a, b) =>
    (a.reviewedAt ?? "").localeCompare(b.reviewedAt ?? ""),
  )[0];
  const ownerEvent = latest(state, "owner");
  // "No action" needs no follow-up to close, unless one has been proposed and
  // is waiting on approval; nothing else skips the step.
  const followUpSkipped = Boolean(
    decision &&
      settled &&
      !actsOnChange(decision.decision) &&
      approved.length === 0 &&
      pendingApprovals(state).length === 0,
  );

  const draft: (Omit<JourneyStep, "status"> & { done: boolean; skipped?: boolean })[] = [
    {
      key: "evidence",
      label: "Evidence updated",
      done: true,
      detail: context.change,
      at: context.evaluatedAt,
      actor: context.source,
    },
    {
      key: "matched",
      label: "Records matched",
      done: true,
      detail: `${context.recordsMatched} historical record${context.recordsMatched === 1 ? "" : "s"}`,
      at: state.raisedAt,
      actor: "VariantPulse",
    },
    {
      key: "owner",
      label: "Owner assigned",
      done: Boolean(state.owner),
      detail: state.owner,
      at: state.owner ? (ownerEvent?.at ?? null) : null,
      actor: state.owner ? (ownerEvent?.actor ?? null) : null,
    },
    {
      key: "decision",
      label: "Decision documented",
      done: settled,
      detail: decision
        ? settled
          ? decision.decision
          : "Awaiting further evidence"
        : null,
      at: decision?.at ?? null,
      actor: decision?.reviewer ?? null,
    },
    {
      key: "follow-up",
      label: "Follow-up approved",
      done: approved.length > 0,
      skipped: followUpSkipped,
      detail: followUpSkipped
        ? "Not required for no action"
        : approved.length > 0
          ? `${approved.length} of ${active.filter((t) => t.status !== "Declined" && t.status !== "Withdrawn").length} approved`
          : null,
      at: firstApproved?.reviewedAt ?? null,
      actor: firstApproved?.reviewedBy ?? null,
    },
    {
      key: "closed",
      label: "Case closed",
      done: Boolean(state.closure),
      detail: state.closure ? "Closed with a note" : null,
      at: state.closure?.at ?? null,
      actor: state.closure?.by ?? null,
    },
  ];

  let currentFound = false;
  return draft.map(({ done, skipped, ...step }) => {
    if (skipped) return { ...step, status: "skipped" as const };
    if (done) return { ...step, status: "done" as const };
    if (!currentFound) {
      currentFound = true;
      return { ...step, status: "current" as const };
    }
    return { ...step, status: "upcoming" as const };
  });
}
