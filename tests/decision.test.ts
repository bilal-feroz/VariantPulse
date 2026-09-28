import { describe, expect, it } from "vitest";

import {
  DECISION_NOTE_MIN,
  DECISIONS,
  actsOnChange,
  currentDecision,
  isDecisionNoteValid,
  isSettled,
  type DecisionRecord,
} from "@/lib/decision";

const record = (decision: DecisionRecord["decision"], at: string): DecisionRecord => ({
  decision,
  note: "Reviewed against the current submission set.",
  reviewer: "Dr. A. Kassim",
  at,
});

describe("clinician decisions", () => {
  it("offers exactly the three decisions", () => {
    expect(DECISIONS).toEqual(["Refer to genetics", "Needs further evidence", "No action"]);
  });

  it("requires a rationale of at least ten characters, ignoring surrounding space", () => {
    expect(DECISION_NOTE_MIN).toBe(10);
    expect(isDecisionNoteValid("too short")).toBe(false);
    expect(isDecisionNoteValid("   123456789   ")).toBe(false);
    expect(isDecisionNoteValid("1234567890")).toBe(true);
  });

  it("has no decision in force until one is recorded", () => {
    expect(currentDecision([])).toBeNull();
  });

  it("takes the latest entry as the decision in force and keeps the original", () => {
    const history = [
      record("No action", "2026-09-25T10:00:00.000Z"),
      record("Refer to genetics", "2026-09-25T11:00:00.000Z"),
    ];
    expect(currentDecision(history)?.decision).toBe("Refer to genetics");
    expect(history[0].decision).toBe("No action");
  });

  it("holds the case open only while evidence is awaited", () => {
    expect(isSettled("Needs further evidence")).toBe(false);
    expect(isSettled("Refer to genetics")).toBe(true);
    expect(isSettled("No action")).toBe(true);
  });

  it("treats only a referral as acting on the change", () => {
    expect(DECISIONS.filter(actsOnChange)).toEqual(["Refer to genetics"]);
  });
});
