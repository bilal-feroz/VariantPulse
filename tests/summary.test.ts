import { describe, expect, it } from "vitest";

import { analyseWorkspace } from "@/lib/analysis";
import {
  buildSummaryPrompt,
  composeFallbackSummary,
  parseSummary,
  summaryFacts,
  summaryFingerprint,
  type SummaryFacts,
} from "@/lib/summary";

async function reviewable() {
  const analysis = await analyseWorkspace({ mode: "demo" });
  return analysis.assessments.filter((a) => a.caseId);
}

async function brca1Facts(): Promise<SummaryFacts> {
  const cases = await reviewable();
  const brca1 = cases.find((a) => a.variant.key === "BRCA1:c.5056C>T");
  if (!brca1) throw new Error("The BRCA1 case is missing from the demo analysis.");
  return summaryFacts(brca1);
}

function goodSummary(facts: SummaryFacts): string {
  return [
    "The record on file lists BRCA1 c.5056C>T as uncertain significance [Record].",
    "ClinVar now reads likely pathogenic, reviewed by an expert panel [ClinVar].",
    "The regional index records no observations in its cohort [Regional index].",
    `A publication linked by ClinVar discusses this change ${facts.citations[0].tag}.`,
  ].join("\n");
}

describe("summary facts", () => {
  it("draws only on the case's own sources, each with its tag", async () => {
    const facts = await brca1Facts();
    expect(facts.record).toMatchObject({ tag: "[Record]", classification: "Uncertain significance" });
    expect(facts.clinvar).toMatchObject({
      tag: "[ClinVar]",
      accession: "VCV000531444",
      classification: "Likely pathogenic",
      reviewStatus: "reviewed by expert panel",
    });
    expect(facts.citations.length).toBeGreaterThan(0);
    expect(facts.citations.length).toBeLessThanOrEqual(6);
    expect(facts.citations.every((c) => c.tag === `[PMID ${c.pmid}]`)).toBe(true);
    expect(facts.regional).toBeNull();
  });

  it("flags a CTGA-backed regional reading", async () => {
    const cases = await reviewable();
    const ctga = cases.map(summaryFacts).filter((f) => f.regional?.ctgaTag === "[CTGA]");
    expect(ctga.length).toBeGreaterThan(0);
  });

  it("puts no other case's variant in the prompt", async () => {
    const facts = await brca1Facts();
    const prompt = buildSummaryPrompt(facts);
    expect(prompt).toContain("c.5056C>T");
    expect(prompt).toContain(facts.citations[0].tag);
    for (const other of ["LDLR", "MYBPC3", "HBB", "CFTR"]) expect(prompt).not.toContain(other);
  });

  it("fingerprints the facts, so a cached summary goes stale when they change", async () => {
    const facts = await brca1Facts();
    expect(summaryFingerprint(facts)).toBe(summaryFingerprint(structuredClone(facts)));
    const changed = { ...facts, clinvar: { ...facts.clinvar, submissions: facts.clinvar.submissions + 1 } };
    expect(summaryFingerprint(changed)).not.toBe(summaryFingerprint(facts));
  });
});

describe("deterministic summary", () => {
  it("meets the same checks as a model's summary, for every case", async () => {
    for (const assessment of await reviewable()) {
      const facts = summaryFacts(assessment);
      const sentences = composeFallbackSummary(facts);
      expect(sentences).toHaveLength(4);
      expect(parseSummary(sentences.join("\n"), facts), `${facts.caseId}: ${sentences.join(" | ")}`).toEqual(
        sentences,
      );
    }
  });

  it("counts every linked publication, not only the ones offered for citing", async () => {
    const facts = await brca1Facts();
    expect(facts.publicationCount).toBeGreaterThan(facts.citations.length);
    expect(composeFallbackSummary(facts).at(-1)).toContain(`${facts.publicationCount} publications`);
  });

  it("says insufficient evidence where the case holds none", async () => {
    const cases = await reviewable();
    const bare = cases.map(summaryFacts).find((f) => f.citations.length === 0);
    expect(bare).toBeDefined();
    expect(composeFallbackSummary(bare!).at(-1)).toContain("insufficient evidence");
  });
});

describe("checking a model's summary", () => {
  it("accepts tagged sentences, one per line or as one paragraph", async () => {
    const facts = await brca1Facts();
    const text = goodSummary(facts);
    expect(parseSummary(text, facts)).toHaveLength(4);
    expect(parseSummary(text.replace(/\n/g, " "), facts)).toHaveLength(4);
    expect(parseSummary(text.split("\n").map((l, i) => `${i + 1}. ${l}`).join("\n"), facts)).toHaveLength(4);
  });

  it("rejects the wrong number of sentences", async () => {
    const facts = await brca1Facts();
    const lines = goodSummary(facts).split("\n");
    expect(parseSummary(lines.slice(0, 2).join("\n"), facts)).toBeNull();
    expect(parseSummary([...lines, lines[0]].join("\n"), facts)).toBeNull();
  });

  it("rejects a sentence without a tag, or with one the case does not hold", async () => {
    const facts = await brca1Facts();
    const lines = goodSummary(facts).split("\n");
    expect(parseSummary([...lines.slice(0, 3), "The variant is well studied."].join("\n"), facts)).toBeNull();
    expect(parseSummary([...lines.slice(0, 3), "It is widely cited [PMID 1]."].join("\n"), facts)).toBeNull();
    expect(parseSummary([...lines.slice(0, 3), "CTGA also lists it [CTGA]."].join("\n"), facts)).toBeNull();
  });

  it("rejects clinical advice", async () => {
    const facts = await brca1Facts();
    const lines = goodSummary(facts).split("\n");
    const advice = "We recommend enhanced screening for carriers [ClinVar].";
    expect(parseSummary([...lines.slice(0, 3), advice].join("\n"), facts)).toBeNull();
  });

  it("does not mistake a quoted title for advice", async () => {
    const facts = await brca1Facts();
    const lines = goodSummary(facts).split("\n");
    const title = `ClinVar links "Evidence-based recommendations for variant classification" ${facts.citations[0].tag}.`;
    expect(parseSummary([...lines.slice(0, 3), title].join("\n"), facts)).toHaveLength(4);
  });
});
