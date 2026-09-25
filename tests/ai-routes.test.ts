import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { analyseWorkspace } from "@/lib/analysis";
import { composePatientLetter, type LetterInput } from "@/lib/letter";
import { composeFallbackSummary, summaryFacts } from "@/lib/summary";

const post = (body: unknown) =>
  new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const modelReply = (text: string) =>
  vi.fn(async () =>
    new Response(
      JSON.stringify({ model: "claude-opus-5", stop_reason: "end_turn", content: [{ type: "text", text }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  );

async function brca1() {
  const analysis = await analyseWorkspace({ mode: "demo" });
  const assessment = analysis.assessments.find((a) => a.variant.key === "BRCA1:c.5056C>T");
  if (!assessment?.caseId) throw new Error("The BRCA1 case is missing from the demo analysis.");
  return assessment;
}

// Each test gets a fresh route module, and with it an empty cache.
beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("POST /api/summary", () => {
  it("answers an unknown case with 404", async () => {
    const { POST } = await import("@/app/api/summary/route");
    expect((await POST(post({ caseId: "VP-R-0000-000" }))).status).toBe(404);
  });

  it("serves the deterministic summary when no key is set", async () => {
    vi.stubEnv("AI_API_KEY", "");
    const assessment = await brca1();
    const { POST } = await import("@/app/api/summary/route");
    const body = await (await POST(post({ caseId: assessment.caseId }))).json();
    expect(body).toMatchObject({ caseId: assessment.caseId, source: "fallback", reason: "no-key" });
    expect(body.sentences).toEqual(composeFallbackSummary(summaryFacts(assessment)));
  });

  it("uses a model summary that passes the checks, then serves it from the cache", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");
    const assessment = await brca1();
    const facts = summaryFacts(assessment);
    const fetchSpy = modelReply(
      [
        "The record on file lists BRCA1 c.5056C>T as uncertain significance [Record].",
        "ClinVar now reads likely pathogenic, reviewed by an expert panel [ClinVar].",
        `A publication linked by ClinVar discusses this change ${facts.citations[0].tag}.`,
      ].join("\n"),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const { POST } = await import("@/app/api/summary/route");

    const first = await (await POST(post({ caseId: assessment.caseId }))).json();
    expect(first).toMatchObject({ source: "ai", model: "claude-opus-5", cached: false });
    expect(first.sentences).toHaveLength(3);

    const second = await (await POST(post({ caseId: assessment.caseId }))).json();
    expect(second).toMatchObject({ source: "ai", cached: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("falls back when the model's summary fails the checks", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.stubGlobal("fetch", modelReply("It is pathogenic. Screen the family. Consider surgery."));
    const assessment = await brca1();
    const { POST } = await import("@/app/api/summary/route");
    const body = await (await POST(post({ caseId: assessment.caseId }))).json();
    expect(body).toMatchObject({ source: "fallback", reason: "failed-checks" });
    expect(body.sentences).toEqual(composeFallbackSummary(summaryFacts(assessment)));
  });
});

describe("POST /api/letter", () => {
  async function letterInput(): Promise<LetterInput> {
    const assessment = await brca1();
    const record = assessment.impactedPatients[0];
    return {
      caseId: assessment.caseId as string,
      recordId: record.id,
      gene: assessment.variant.gene,
      testedOn: record.testedOn,
      department: record.orderingDepartment,
      clinicalOwner: record.clinicalOwner,
    };
  }

  it("answers an unknown record with 404", async () => {
    const input = await letterInput();
    const { POST } = await import("@/app/api/letter/route");
    expect((await POST(post({ caseId: input.caseId, recordId: "VP-00000" }))).status).toBe(404);
  });

  it("keeps the template when no key is set", async () => {
    vi.stubEnv("AI_API_KEY", "");
    const input = await letterInput();
    const { POST } = await import("@/app/api/letter/route");
    const body = await (await POST(post({ caseId: input.caseId, recordId: input.recordId }))).json();
    expect(body).toMatchObject({ source: "template", reason: "no-key", ...composePatientLetter(input) });
  });

  it("uses a rewording that keeps every fact", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");
    const input = await letterInput();
    const template = composePatientLetter(input);
    const english = template.english.replace(
      "We would like to explain this to you in person.",
      "We would like to talk this through with you in person.",
    );
    vi.stubGlobal("fetch", modelReply(`=== ENGLISH ===\n${english}\n=== ARABIC ===\n${template.arabic}`));
    const { POST } = await import("@/app/api/letter/route");
    const body = await (await POST(post({ caseId: input.caseId, recordId: input.recordId }))).json();
    expect(body).toMatchObject({ source: "ai", english, arabic: template.arabic });
  });

  it("keeps the template when the rewording drops a fact", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");
    const input = await letterInput();
    const template = composePatientLetter(input);
    const english = template.english.replaceAll(input.gene, "a gene");
    vi.stubGlobal("fetch", modelReply(`=== ENGLISH ===\n${english}\n=== ARABIC ===\n${template.arabic}`));
    const { POST } = await import("@/app/api/letter/route");
    const body = await (await POST(post({ caseId: input.caseId, recordId: input.recordId }))).json();
    expect(body).toMatchObject({ source: "template", reason: "failed-checks", ...template });
  });
});
