import { describe, expect, it } from "vitest";

import {
  CHANGE_TYPES,
  detectChange,
  assessRegionalSignal,
  normaliseClassification,
} from "@/lib/classification";
import { CLINVAR_JAN_2023 } from "@/data/workspace";

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

describe("assessRegionalSignal", () => {
  const variant = {
    historicalClassification: "VUS" as const,
    historicalClinvarText: "Uncertain significance",
    historicalSource: CLINVAR_JAN_2023,
  };

  const withCatalogue = (code: "LIKELY_PATHOGENIC" | "BENIGN") => ({
    variantKey: "GENE:c.1A>T",
    gnomadVariantId: "1-1-A-T",
    inGnomad: true,
    callSet: "joint" as const,
    global: { alleleCount: 10, alleleNumber: 100000, frequency: 0.0001 },
    middleEastern: { alleleCount: 4, alleleNumber: 6000, frequency: 0.00067 },
    catalogue: {
      catalogue: "CTGA" as const,
      significance: code === "BENIGN" ? "Benign" : "Likely pathogenic",
      code,
      countries: ["United Arab Emirates"],
      conditions: [],
      references: [],
      listedSince: "2020-01-01",
      url: "https://cags.org.ae/",
    },
    context: null,
  });

  it("flags a catalogue that places the variant in another band", () => {
    const signal = assessRegionalSignal(withCatalogue("BENIGN"), variant, "LIKELY_PATHOGENIC");
    expect(signal).toMatchObject({ kind: "CATALOGUE_DISAGREES", flagged: true });
  });

  it("does not flag a catalogue that agrees with the current band", () => {
    const signal = assessRegionalSignal(withCatalogue("LIKELY_PATHOGENIC"), variant, "LIKELY_PATHOGENIC");
    expect(signal.flagged).toBe(false);
  });

  it("raises nothing when no regional evidence is held", () => {
    expect(assessRegionalSignal(null, variant, "PATHOGENIC")).toMatchObject({ kind: "NONE", flagged: false });
  });
});
