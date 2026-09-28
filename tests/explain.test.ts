import { describe, expect, it } from "vitest";

import { analyseWorkspace } from "@/lib/analysis";
import { serialiseAnalysis } from "@/lib/dto";
import {
  evidenceSnapshot,
  firstVisibleChange,
  freshness,
  limitations,
  recordMatches,
  sourceChange,
} from "@/lib/explain";

async function demo() {
  const analysis = serialiseAnalysis(await analyseWorkspace({ mode: "demo" }));
  const find = (key: string) => {
    const found = analysis.assessments.find((a) => a.variant.key === key);
    if (!found) throw new Error(`${key} is not on the panel`);
    return found;
  };
  return { analysis, find };
}

describe("what changed", () => {
  it("states the source's reading then and now in its own words, with links", async () => {
    const { find } = await demo();
    const change = sourceChange(find("BRCA1:c.5056C>T"));
    expect(change.changed).toBe(true);
    expect(change.then).toMatchObject({
      wording: "Uncertain significance",
      source: "ClinVar, January 2023 release",
      hrefLabel: "variant_summary_2023-01.txt.gz",
    });
    expect(change.now).toMatchObject({
      wording: "Likely pathogenic",
      reviewStatus: "reviewed by expert panel",
      dateLabel: "Last evaluated 18 Aug 2025",
      href: "https://www.ncbi.nlm.nih.gov/clinvar/variation/531444/",
      hrefLabel: "VCV000531444",
    });
    expect(change.trajectory.map((r) => r.code)).toEqual(["VUS", "CONFLICTING", "CONFLICTING", "LIKELY_PATHOGENIC"]);
  });

  it("dates a change to the first archived checkpoint that shows it", async () => {
    const { find } = await demo();
    expect(firstVisibleChange(find("BRCA1:c.5056C>T"))?.release).toBe("2024-01");
    expect(firstVisibleChange(find("LDLR:c.2479G>A"))).toBeNull();
  });

  it("says where the classification on record is the hospital's own report", async () => {
    const { analysis, find } = await demo();
    const mybpc3 = find("MYBPC3:c.776delinsTT");
    expect(sourceChange(mybpc3).then.source).toBe("Hospital report; not in ClinVar at the time");
    expect(limitations(mybpc3, analysis).map((l) => l.text).join(" ")).toMatch(/hospital's own report/);
  });

  it("lists conflicts and limitations drawn from the fields, including demo mode", async () => {
    const { analysis, find } = await demo();
    const conflicting = limitations(find("BRCA1:c.5123C>T"), analysis);
    expect(conflicting.some((l) => l.kind === "conflict")).toBe(true);
    const brca1 = limitations(find("BRCA1:c.5056C>T"), analysis).map((l) => l.text);
    expect(brca1.some((t) => t.startsWith("Demo mode"))).toBe(true);
    expect(brca1.some((t) => t.includes("Absent from gnomAD v4"))).toBe(true);
    expect(brca1.some((t) => t.includes("Jan 2023, Jan 2024, Jan 2025, Sep 2026"))).toBe(true);
  });

  it("explains how every record was matched", async () => {
    const { find } = await demo();
    const matches = recordMatches(find("BRCA1:c.5056C>T"));
    expect(matches.transcript).toBe("NM_007294.4");
    expect(matches.basis).toContain("NM_007294.4:c.5056C>T");
    expect(matches.basis).toContain("variation 531444 (VCV000531444)");
    expect(matches.records.map((r) => r.id).sort()).toEqual(["VP-10247", "VP-10284", "VP-10321", "VP-10358"]);
  });

  it("reports data freshness honestly for the mode it is in", async () => {
    const { analysis, find } = await demo();
    const rows = freshness(find("BRCA1:c.5056C>T"), analysis);
    expect(rows[0]).toMatchObject({ value: "Bundled snapshot (demo mode)", tone: "neutral" });
    expect(rows[1].value).toBe("Not attempted in demo mode");
  });

  it("exports the evidence it was computed from, with inference labelled as such", async () => {
    const { analysis, find } = await demo();
    const snapshot = evidenceSnapshot(find("BRCA1:c.5056C>T"), analysis, "2026-09-28T10:00:00.000Z");
    expect(snapshot.current.classification).toBe("Likely pathogenic");
    expect(snapshot.onRecord.classification).toBe("VUS");
    expect(snapshot.variantPulseInference.label).toMatch(/not a statement by any source/);
    expect(snapshot.read.mode).toBe("demo");
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});
