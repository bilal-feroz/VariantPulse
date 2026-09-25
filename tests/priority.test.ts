import { describe, expect, it } from "vitest";

import { assessPriority, comparePriority, type PriorityInput } from "@/lib/priority";

const drift: PriorityInput = {
  changeType: "CLASSIFICATION_DRIFT",
  recorded: "VUS",
  current: "LIKELY_PATHOGENIC",
  impactedRecords: 4,
  confidenceStars: 2,
};

describe("assessPriority", () => {
  it("is deterministic for the same input", () => {
    expect(assessPriority(drift)).toEqual(assessPriority({ ...drift }));
  });

  it("escalates an actionable drift across several records to critical", () => {
    expect(assessPriority(drift).level).toBe("CRITICAL");
    expect(assessPriority({ ...drift, impactedRecords: 1 }).level).toBe("HIGH");
  });

  it("ranks a regional conflict as medium and a weakened reading as low", () => {
    expect(
      assessPriority({
        changeType: "REGIONAL_CONFLICT",
        recorded: "LIKELY_BENIGN",
        current: "LIKELY_BENIGN",
        impactedRecords: 2,
        regionalConflict: true,
      }).level,
    ).toBe("MEDIUM");
    expect(
      assessPriority({
        changeType: "EVIDENCE_WEAKENED",
        recorded: "VUS",
        current: "LIKELY_BENIGN",
        impactedRecords: 2,
      }).level,
    ).toBe("LOW");
  });

  it("orders by level, then by score", () => {
    const critical = { priority: assessPriority(drift) };
    const high = { priority: assessPriority({ ...drift, impactedRecords: 1 }) };
    expect([high, critical].sort(comparePriority)).toEqual([critical, high]);
  });
});
