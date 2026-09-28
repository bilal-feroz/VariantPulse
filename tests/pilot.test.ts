import { describe, expect, it } from "vitest";

import {
  UNSET_CRITERIA,
  adjudicationsFromReference,
  criteriaResults,
  evaluate,
  median,
  replayReleases,
  type Adjudication,
  type AdjudicationLabel,
} from "@/lib/pilot";

const AT = "2026-09-28T10:00:00.000Z";

const adjudication = (variantKey: string, label: AdjudicationLabel): Adjudication => ({
  variantKey,
  label,
  reviewer: "Reference panel",
  at: AT,
  source: "session",
});

describe("retrospective replay", () => {
  const replay = replayReleases();
  const row = (key: string) => {
    const found = replay.rows.find((r) => r.key === key);
    if (!found) throw new Error(`${key} not in the replay`);
    return found;
  };

  it("replays every archived checkpoint after January 2023", () => {
    expect(replay.baseline.release).toBe("2023-01");
    expect(replay.checkpoints.map((c) => c.release)).toEqual(["2024-01", "2025-01", "2026-09"]);
  });

  it("would have flagged BRCA1 c.5056C>T as contested in January 2024, and as drift by September 2026", () => {
    const brca1 = row("BRCA1:c.5056C>T");
    expect(brca1.firstAlert).toMatchObject({ release: "2024-01", changeType: "CONSENSUS_CONFLICT" });
    expect(brca1.cells.map((c) => c.changeType)).toEqual([
      "CONSENSUS_CONFLICT",
      "CONSENSUS_CONFLICT",
      "CLASSIFICATION_DRIFT",
    ]);
  });

  it("leaves checkpoints the dataset does not hold uncaptured rather than guessing", () => {
    const hbd = row("HBB:c.364G>C");
    expect(hbd.cells.map((c) => c.captured)).toEqual([false, false, true]);
    expect(hbd.firstAlert?.release).toBe("2026-09");
  });

  it("never alerts on the unchanged controls", () => {
    for (const key of ["LDLR:c.2479G>A", "BRCA1:c.1140dup", "CFTR:c.601G>A"]) {
      expect(row(key).firstAlert, key).toBeNull();
    }
  });

  it("counts alerts open at each checkpoint from the engine, not from a table", () => {
    expect(replay.alertsAt).toEqual({ "2024-01": 4, "2025-01": 7, "2026-09": 12 });
    expect(replay.recordsAt["2026-09"]).toBe(22);
  });
});

describe("evaluation", () => {
  const alertKeys = ["A", "B", "C", "D"];
  const silentKeys = ["E", "F"];

  it("measures nothing until someone has adjudicated", () => {
    const result = evaluate({ alertKeys, silentKeys, adjudications: {}, reviewDurationsMs: [], importTotals: null });
    expect(result.adjudicated).toBe(0);
    expect(result.agreement).toBeNull();
    expect(result.precision).toBeNull();
    expect(result.falseOrDuplicateRate).toBeNull();
    expect(result.medianReviewMs).toBeNull();
    expect(result.pending).toEqual({ alerts: 4, silent: 2 });
    expect(criteriaResults(result, UNSET_CRITERIA).every((c) => c.status === "not-agreed")).toBe(true);
  });

  it("computes agreement, precision, misses and false alerts from the labels alone", () => {
    const result = evaluate({
      alertKeys,
      silentKeys,
      adjudications: {
        A: adjudication("A", "relevant"),
        B: adjudication("B", "relevant"),
        C: adjudication("C", "not-relevant"),
        D: adjudication("D", "duplicate"),
        E: adjudication("E", "missed"),
        F: adjudication("F", "correctly-silent"),
      },
      reviewDurationsMs: [10 * 60_000, 30 * 60_000, 20 * 60_000],
      importTotals: null,
    });
    expect(result.counts).toEqual({ TP: 2, FP: 1, DUP: 1, FN: 1, TN: 1 });
    expect(result.agreement).toBeCloseTo(3 / 6);
    expect(result.precision).toBeCloseTo(2 / 4);
    expect(result.missed).toBe(1);
    expect(result.falseOrDuplicateRate).toBeCloseTo(2 / 4);
    expect(result.medianReviewMs).toBe(20 * 60_000);
  });

  it("ignores a label that contradicts what VariantPulse did", () => {
    const result = evaluate({
      alertKeys,
      silentKeys,
      adjudications: { A: adjudication("A", "missed"), E: adjudication("E", "relevant") },
      reviewDurationsMs: [],
      importTotals: null,
    });
    expect(result.inconsistent).toBe(2);
    expect(result.adjudicated).toBe(0);
  });

  it("judges agreed criteria only once they can be measured", () => {
    const criteria = { ...UNSET_CRITERIA, minAgreement: 0.8, maxMissed: 0 };
    const unmeasured = evaluate({ alertKeys, silentKeys, adjudications: {}, reviewDurationsMs: [], importTotals: null });
    expect(criteriaResults(unmeasured, criteria).slice(0, 2).map((c) => c.status)).toEqual(["not-measured", "not-measured"]);

    const measured = evaluate({
      alertKeys,
      silentKeys,
      adjudications: { A: adjudication("A", "relevant"), E: adjudication("E", "missed") },
      reviewDurationsMs: [],
      importTotals: null,
    });
    const [agreement, missed] = criteriaResults(measured, criteria);
    expect(agreement).toMatchObject({ observed: "50%", status: "not-met" });
    expect(missed).toMatchObject({ observed: "1", status: "not-met" });
  });

  it("takes a median of an even count as the mean of the middle two", () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("reference sets", () => {
  it("derives each label from what the reviewers expected and what VariantPulse did", () => {
    const { adjudications, problems } = adjudicationsFromReference(
      [
        { variant: "BRCA1:c.5056C>T", expected: "alert" },
        { variant: "VCV000036462", expected: "no alert", reviewer: "Panel B" },
        { variant: "BRCA2:c.9538C>T", expected: "no_alert" },
        { variant: "LDLR:c.2479G>A", expected: "alert" },
        { variant: "MLH1:c.350C>T", expected: "alert" },
        { variant: "BRCA1:c.1140dup", expected: "duplicate" },
      ],
      ["BRCA1:c.5056C>T", "BRCA2:c.9538C>T"],
      AT,
    );
    expect(adjudications.map((a) => [a.variantKey, a.label])).toEqual([
      ["BRCA1:c.5056C>T", "relevant"],
      ["LDLR:c.2479G>A", "correctly-silent"],
      ["BRCA2:c.9538C>T", "not-relevant"],
      ["LDLR:c.2479G>A", "missed"],
    ]);
    expect(adjudications[1].reviewer).toBe("Panel B");
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/MLH1:c.350C>T" is not a monitored variant/);
  });
});
