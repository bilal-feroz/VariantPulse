import { describe, expect, it } from "vitest";

import {
  CHANGE_TYPES,
  detectChange,
  detectDisagreement,
  normaliseClassification,
} from "@/lib/classification";

describe("normaliseClassification", () => {
  it.each([
    ["Pathogenic", "PATHOGENIC"],
    ["Likely pathogenic", "LIKELY_PATHOGENIC"],
    ["Pathogenic/Likely pathogenic", "PATHOGENIC"],
    ["Uncertain significance", "VUS"],
    ["VUS", "VUS"],
    ["Likely benign", "LIKELY_BENIGN"],
    ["Benign", "BENIGN"],
    ["Benign/Likely benign", "BENIGN"],
    ["Conflicting classifications of pathogenicity", "CONFLICTING"],
    ["not provided", "NOT_PROVIDED"],
    ["", "NOT_PROVIDED"],
  ])("maps %j to %s", (raw, code) => {
    expect(normaliseClassification(raw)).toBe(code);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(normaliseClassification("  LIKELY PATHOGENIC ")).toBe("LIKELY_PATHOGENIC");
  });
});

describe("detectChange", () => {
  it("flags VUS to Likely pathogenic as drift toward pathogenic", () => {
    const verdict = detectChange("VUS", "LIKELY_PATHOGENIC");
    expect(verdict.type).toBe("CLASSIFICATION_DRIFT");
    expect(verdict.direction).toBe("toward-pathogenic");
  });

  it("flags leaving the pathogenic band as drift toward benign", () => {
    const verdict = detectChange("LIKELY_PATHOGENIC", "VUS");
    expect(verdict.type).toBe("CLASSIFICATION_DRIFT");
    expect(verdict.direction).toBe("toward-benign");
  });

  it("grades movement inside the pathogenic band as strengthened", () => {
    expect(detectChange("LIKELY_PATHOGENIC", "PATHOGENIC").type).toBe("EVIDENCE_STRENGTHENED");
  });

  it("grades VUS to benign as weakened", () => {
    expect(detectChange("VUS", "LIKELY_BENIGN").type).toBe("EVIDENCE_WEAKENED");
  });

  it("reports a new conflict as consensus conflict", () => {
    expect(detectChange("VUS", "CONFLICTING").type).toBe("CONSENSUS_CONFLICT");
  });

  it("reports identical or missing classifications as no material change", () => {
    expect(detectChange("VUS", "VUS").type).toBe("NO_MATERIAL_CHANGE");
    expect(detectChange("VUS", "NOT_PROVIDED").type).toBe("NO_MATERIAL_CHANGE");
    expect(CHANGE_TYPES.NO_MATERIAL_CHANGE.material).toBe(false);
  });

  it("always explains its verdict", () => {
    expect(detectChange("VUS", "LIKELY_PATHOGENIC").rationale.length).toBeGreaterThanOrEqual(3);
  });
});

describe("detectDisagreement", () => {
  it("treats an actionable split as a high-severity conflict", () => {
    expect(detectDisagreement("LIKELY_PATHOGENIC", "LIKELY_BENIGN")).toMatchObject({
      conflicting: true,
      severity: "high",
    });
  });

  it("does not treat an indeterminate reading as a regional conflict", () => {
    expect(detectDisagreement("CONFLICTING", "BENIGN").conflicting).toBe(false);
  });
});
