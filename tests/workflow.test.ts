import { describe, expect, it } from "vitest";

import type { DecisionRecord } from "@/lib/decision";
import {
  REVIEW_SLA_DAYS,
  activeFollowUps,
  caseJourney,
  caseStage,
  closureBlocker,
  deadlineStatus,
  describeDeadline,
  emptyCase,
  letterApproved,
  needsEscalation,
  pendingApprovals,
  reviewDeadline,
  reviewDurationMs,
  suggestedFollowUps,
  supersedeFollowUps,
  timeToDecisionMs,
  type CaseState,
  type FollowUpTask,
} from "@/lib/workflow";

const RAISED = "2026-09-25T12:00:00.000Z";
const DAY = 86_400_000;
const at = (days: number) => new Date(Date.parse(RAISED) + days * DAY);

const decision = (value: DecisionRecord["decision"], day: number): DecisionRecord => ({
  decision: value,
  note: "Reviewed against the expert-panel reading.",
  reviewer: "Dr. A. Kassim",
  at: at(day).toISOString(),
});

/** A follow-up serving `under`, the decision it was proposed for. */
const task = (under: DecisionRecord, overrides: Partial<FollowUpTask> = {}): FollowUpTask => ({
  id: `t-${Math.random().toString(36).slice(2, 7)}`,
  kind: "genetics-referral",
  title: "Refer to Clinical Genetics",
  detail: "Refer the records for review.",
  status: "Proposed",
  proposedBy: "Dr. A. Kassim",
  proposedAt: under.at,
  decisionAt: under.at,
  ...overrides,
});

const raised = (overrides: Partial<CaseState> = {}): CaseState => ({
  ...emptyCase(),
  raisedAt: RAISED,
  ...overrides,
});

const JOURNEY_CONTEXT = {
  change: "Uncertain significance → Likely pathogenic",
  source: "ClinVar",
  evaluatedAt: "2025-08-18",
  recordsMatched: 4,
};

describe("case stage", () => {
  it("moves from new to closed as the history grows, never ahead of it", () => {
    const refer = decision("Refer to genetics", 2);
    expect(caseStage(raised())).toBe("New");
    expect(caseStage(raised({ owner: "Dr. A. Kassim" }))).toBe("Assigned");
    expect(caseStage(raised({ owner: "Dr. A. Kassim", reviewOpenedAt: at(1).toISOString() }))).toBe("In review");
    expect(caseStage(raised({ decisions: [decision("Needs further evidence", 2)] }))).toBe("Awaiting evidence");
    expect(caseStage(raised({ decisions: [refer] }))).toBe("Decision recorded");
    expect(caseStage(raised({ decisions: [refer], followUps: [task(refer, { status: "Approved" })] }))).toBe(
      "Follow-up approved",
    );
    expect(
      caseStage(
        raised({
          decisions: [decision("No action", 2)],
          closure: { by: "Dr. S. Hamdan", at: at(3).toISOString(), note: "Closed after review." },
        }),
      ),
    ).toBe("Closed");
  });

  it("does not count a declined or withdrawn follow-up as approved", () => {
    const refer = decision("Refer to genetics", 2);
    for (const status of ["Declined", "Withdrawn"] as const) {
      expect(caseStage(raised({ decisions: [refer], followUps: [task(refer, { status })] }))).toBe("Decision recorded");
    }
  });
});

describe("review deadline", () => {
  it("runs from the day the case was raised, by priority", () => {
    expect(REVIEW_SLA_DAYS).toEqual({ CRITICAL: 7, HIGH: 14, MEDIUM: 30, LOW: 60 });
    expect(reviewDeadline(RAISED, "CRITICAL")).toBe(at(7).toISOString());
    expect(reviewDeadline(RAISED, "LOW")).toBe(at(60).toISOString());
  });

  it("is on track, then due soon, then overdue while nothing is decided", () => {
    const state = raised();
    expect(deadlineStatus(state, "CRITICAL", at(1))?.state).toBe("on-track");
    expect(deadlineStatus(state, "CRITICAL", at(5.5))?.state).toBe("due-soon");
    expect(deadlineStatus(state, "CRITICAL", at(9))?.state).toBe("overdue");
    expect(describeDeadline(deadlineStatus(state, "CRITICAL", at(1))!)).toBe("Due in 6 days");
    expect(describeDeadline(deadlineStatus(state, "CRITICAL", at(6.6))!)).toBe("Due within a day");
    expect(describeDeadline(deadlineStatus(state, "CRITICAL", at(9))!)).toBe("Overdue by 2 days");
  });

  it("is met by the first documented decision, even one that awaits evidence", () => {
    const onTime = raised({ decisions: [decision("Needs further evidence", 3)] });
    expect(deadlineStatus(onTime, "CRITICAL", at(20))?.state).toBe("met");
    expect(describeDeadline(deadlineStatus(onTime, "CRITICAL", at(20))!)).toBe("Decided on time");

    const late = raised({ decisions: [decision("Refer to genetics", 10)] });
    expect(deadlineStatus(late, "CRITICAL", at(20))?.state).toBe("met-late");
    expect(describeDeadline(deadlineStatus(late, "CRITICAL", at(20))!)).toBe("Decided 3 days late");
  });

  it("has no deadline until the case has been raised", () => {
    expect(deadlineStatus(emptyCase(), "CRITICAL", at(1))).toBeNull();
  });

  it("escalates an overdue, undecided case once", () => {
    expect(needsEscalation(raised(), "CRITICAL", at(6))).toBe(false);
    expect(needsEscalation(raised(), "CRITICAL", at(8))).toBe(true);
    expect(needsEscalation(raised({ escalatedAt: at(8).toISOString() }), "CRITICAL", at(9))).toBe(false);
    expect(needsEscalation(raised({ decisions: [decision("No action", 8)] }), "CRITICAL", at(9))).toBe(false);
    expect(needsEscalation(raised(), "LOW", at(8))).toBe(false);
  });
});

describe("follow-ups and closure", () => {
  it("suggests a referral, the clinicians and a patient explanation for a referral", () => {
    const drafts = suggestedFollowUps({
      decision: "Refer to genetics",
      gene: "BRCA1",
      records: [
        { id: "VP-10247", clinicalOwner: "Dr. L. Haddad" },
        { id: "VP-10284", clinicalOwner: "Dr. N. Farouk" },
        { id: "VP-10358", clinicalOwner: "Dr. L. Haddad" },
      ],
    });
    expect(drafts.map((d) => d.kind)).toEqual(["genetics-referral", "notify-clinician", "patient-letter"]);
    expect(drafts[0].detail).toContain("3 records (VP-10247, VP-10284 and VP-10358)");
    expect(drafts[1].detail).toContain("Dr. L. Haddad and Dr. N. Farouk");
  });

  it("suggests nothing while evidence is awaited", () => {
    expect(
      suggestedFollowUps({
        decision: "Needs further evidence",
        gene: "BRCA1",
        records: [{ id: "VP-10247", clinicalOwner: "Dr. L. Haddad" }],
      }),
    ).toEqual([]);
  });

  it("closes only with a settled decision and no follow-up awaiting approval", () => {
    const refer = decision("Refer to genetics", 1);
    expect(closureBlocker(raised())).toMatch(/Record a decision/);
    expect(closureBlocker(raised({ decisions: [decision("Needs further evidence", 1)] }))).toMatch(
      /awaiting further evidence/,
    );
    expect(closureBlocker(raised({ decisions: [refer] }))).toMatch(/approved genetics referral/);
    expect(closureBlocker(raised({ decisions: [refer], followUps: [task(refer)] }))).toBe(
      "1 follow-up still awaits approval.",
    );
    expect(closureBlocker(raised({ decisions: [refer], followUps: [task(refer, { status: "Approved" })] }))).toBeNull();
    expect(closureBlocker(raised({ decisions: [decision("No action", 1)] }))).toBeNull();
  });

  it("will not close a referral on a notification or letter alone", () => {
    const refer = decision("Refer to genetics", 1);
    const state = raised({
      decisions: [refer],
      followUps: [
        task(refer, { kind: "genetics-referral", status: "Withdrawn" }),
        task(refer, { kind: "notify-clinician", status: "Approved" }),
        task(refer, { kind: "patient-letter", status: "Approved" }),
      ],
    });
    expect(closureBlocker(state)).toMatch(/approved genetics referral/);
  });

  it("releases a patient letter only through an approved letter follow-up", () => {
    const refer = decision("Refer to genetics", 1);
    const withTask = (overrides: Partial<FollowUpTask>) =>
      letterApproved(raised({ decisions: [refer], followUps: [task(refer, overrides)] }));
    expect(withTask({ kind: "patient-letter" })).toBe(false);
    expect(withTask({ kind: "patient-letter", status: "Approved" })).toBe(true);
    expect(withTask({ kind: "genetics-referral", status: "Approved" })).toBe(false);
  });
});

describe("amending a decision", () => {
  it("supersedes what was open under the old decision, and keeps what was done as history", () => {
    const refer = decision("Refer to genetics", 1);
    const tasks = [
      task(refer, { id: "a", status: "Proposed" }),
      task(refer, { id: "b", status: "Approved", kind: "patient-letter" }),
      task(refer, { id: "c", status: "Done", kind: "notify-clinician" }),
      task(refer, { id: "d", status: "Declined" }),
    ];
    const after = supersedeFollowUps(tasks, refer.at, at(3).toISOString());
    expect(after.map((t) => t.status)).toEqual(["Superseded", "Superseded", "Done", "Declined"]);
  });

  it("leaves no referral follow-up in force after amending to no action", () => {
    const refer = decision("Refer to genetics", 1);
    const noAction = decision("No action", 3);
    const state = raised({
      owner: "Dr. A. Kassim",
      decisions: [refer, noAction],
      followUps: supersedeFollowUps(
        [task(refer, { status: "Approved" }), task(refer, { kind: "patient-letter", status: "Approved" })],
        refer.at,
        noAction.at,
      ),
    });
    expect(activeFollowUps(state)).toEqual([]);
    expect(caseStage(state)).toBe("Decision recorded");
    expect(letterApproved(state)).toBe(false);
    expect(closureBlocker(state)).toBeNull();
  });

  it("will not close a referral on follow-up approved under an earlier no-action decision", () => {
    const noAction = decision("No action", 1);
    const refer = decision("Refer to genetics", 3);
    const state = raised({
      owner: "Dr. A. Kassim",
      decisions: [noAction, refer],
      followUps: [task(noAction, { kind: "notify-clinician", status: "Done" })],
    });
    expect(closureBlocker(state)).toMatch(/approved genetics referral/);
    expect(pendingApprovals(state)).toEqual([]);
  });

  it("does not show follow-up as done once the case is held for evidence again", () => {
    const refer = decision("Refer to genetics", 1);
    const hold = decision("Needs further evidence", 3);
    const state = raised({
      owner: "Dr. A. Kassim",
      decisions: [refer, hold],
      followUps: [task(refer, { status: "Done" })],
    });
    const steps = caseJourney(state, JOURNEY_CONTEXT);
    expect(steps.find((s) => s.key === "decision")?.status).toBe("current");
    expect(steps.find((s) => s.key === "follow-up")?.status).toBe("upcoming");
  });
});

describe("timings", () => {
  it("measures review time from opening the review to the first decision", () => {
    const state = raised({
      reviewOpenedAt: at(1).toISOString(),
      decisions: [decision("Refer to genetics", 1.5), decision("No action", 4)],
    });
    expect(reviewDurationMs(state)).toBe(0.5 * DAY);
    expect(timeToDecisionMs(state)).toBe(1.5 * DAY);
    expect(reviewDurationMs(raised())).toBeNull();
  });
});

describe("case journey", () => {
  it("starts with the evidence and the matched records done and the owner next", () => {
    const steps = caseJourney(raised(), JOURNEY_CONTEXT);
    expect(steps.map((s) => s.key)).toEqual(["evidence", "matched", "owner", "decision", "follow-up", "closed"]);
    expect(steps.map((s) => s.status)).toEqual(["done", "done", "current", "upcoming", "upcoming", "upcoming"]);
    expect(steps[1].detail).toBe("4 historical records");
  });

  it("names who approved the follow-up and who closed the case", () => {
    const refer = decision("Refer to genetics", 1);
    const state = raised({
      owner: "Dr. A. Kassim",
      events: [
        { id: "e1", at: at(0.5).toISOString(), type: "owner", actor: "Dr. S. Hamdan", role: "Service lead", summary: "Owner assigned" },
      ],
      decisions: [refer],
      followUps: [task(refer, { status: "Approved", reviewedBy: "Dr. S. Hamdan", reviewedAt: at(2).toISOString() })],
      closure: { by: "Dr. S. Hamdan", at: at(3).toISOString(), note: "Referral sent and letter approved." },
    });
    const steps = caseJourney(state, JOURNEY_CONTEXT);
    expect(steps.every((s) => s.status === "done")).toBe(true);
    expect(steps.find((s) => s.key === "owner")?.actor).toBe("Dr. S. Hamdan");
    expect(steps.find((s) => s.key === "follow-up")?.actor).toBe("Dr. S. Hamdan");
    expect(steps.find((s) => s.key === "closed")?.actor).toBe("Dr. S. Hamdan");
  });

  it("skips the follow-up step for no action, and holds at the decision while evidence is awaited", () => {
    const noAction = caseJourney(raised({ owner: "Dr. A. Kassim", decisions: [decision("No action", 1)] }), JOURNEY_CONTEXT);
    expect(noAction.find((s) => s.key === "follow-up")?.status).toBe("skipped");
    expect(noAction.find((s) => s.key === "closed")?.status).toBe("current");

    const waiting = caseJourney(
      raised({ owner: "Dr. A. Kassim", decisions: [decision("Needs further evidence", 1)] }),
      JOURNEY_CONTEXT,
    );
    const step = waiting.find((s) => s.key === "decision");
    expect(step?.status).toBe("current");
    expect(step?.detail).toBe("Awaiting further evidence");
  });
});
