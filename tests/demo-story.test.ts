import { afterEach, describe, expect, it, vi } from "vitest";

import { analyseWorkspace } from "@/lib/analysis";
import { invalidateEvidenceCache, resolveEvidenceMode, SNAPSHOT_CAPTURED_AT } from "@/lib/clinvar";
import { serialiseAnalysis } from "@/lib/dto";

const BRCA1 = "BRCA1:c.5522G>T";
const STORY_PATIENTS = ["VP-10283", "VP-10491", "VP-10822", "VP-11034"];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  invalidateEvidenceCache();
});

describe("evidence mode selection", () => {
  it("defaults to demo and only goes live when asked", () => {
    expect(resolveEvidenceMode(undefined)).toBe("demo");
    expect(resolveEvidenceMode("")).toBe("demo");
    expect(resolveEvidenceMode("cached")).toBe("demo");
    expect(resolveEvidenceMode("LIVE")).toBe("live");
  });

  it("reads VARIANTPULSE_EVIDENCE_MODE", () => {
    vi.stubEnv("VARIANTPULSE_EVIDENCE_MODE", "live");
    expect(resolveEvidenceMode()).toBe("live");
  });
});

describe("the demo story", () => {
  it("never touches the network in demo mode", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const analysis = await analyseWorkspace({ mode: "demo", force: true });
    expect(analysis.evidence.mode).toBe("demo");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("moves BRCA1 c.5522G>T from VUS to Likely pathogenic for exactly four patients", async () => {
    const analysis = await analyseWorkspace({ mode: "demo" });
    const brca1 = analysis.assessments.find((a) => a.variant.key === BRCA1);

    expect(brca1).toBeDefined();
    expect(brca1?.evidence.accession).toBe("VCV000869004");
    expect(brca1?.variant.recordedOn).toBe("2023-04-18");
    expect(brca1?.evidence.lastEvaluated).toBe("2025-11-06");
    expect(brca1?.recordedCode).toBe("VUS");
    expect(brca1?.currentCode).toBe("LIKELY_PATHOGENIC");
    expect(brca1?.verdict.type).toBe("CLASSIFICATION_DRIFT");
    expect(brca1?.impactedRecordCount).toBe(4);
    expect(brca1?.impactedPatients.map((p) => p.id).sort()).toEqual(STORY_PATIENTS);
    expect(brca1?.impactedPatients.every((p) => p.reviewState === "Not reviewed")).toBe(true);
  });

  it("opens a review case for BRCA1 at the top of the queue", async () => {
    const analysis = await analyseWorkspace({ mode: "demo" });
    const brca1 = analysis.assessments.find((a) => a.variant.key === BRCA1);
    expect(brca1?.requiresReview).toBe(true);
    expect(brca1?.caseId).toMatch(/^VP-R-\d{4}-\d{3}$/);
    expect(analysis.reviewable[0]?.variant.key).toBe(BRCA1);
  });

  it("uses only VP-xxxxx patient identifiers", async () => {
    const analysis = await analyseWorkspace({ mode: "demo" });
    for (const assessment of analysis.assessments) {
      for (const patient of assessment.impactedPatients) expect(patient.id).toMatch(/^VP-\d{5}$/);
    }
  });

  it("is identical on every run, including timestamps", async () => {
    const first = serialiseAnalysis(await analyseWorkspace({ mode: "demo", force: true }));
    const second = serialiseAnalysis(await analyseWorkspace({ mode: "demo", force: true }));
    expect(second).toEqual(first);
    expect(first.checkedAt).toBe(SNAPSHOT_CAPTURED_AT);
    expect(first.generatedAt).toBe(SNAPSHOT_CAPTURED_AT);
  });
});

describe("a ClinVar failure in live mode", () => {
  async function classifications(mode: "demo" | "live") {
    const analysis = await analyseWorkspace({ mode, force: true });
    return {
      mode: analysis.evidence.mode,
      reason: analysis.evidence.reason,
      codes: Object.fromEntries(analysis.assessments.map((a) => [a.variant.key, a.currentCode])),
      caseIds: analysis.assessments.map((a) => a.caseId),
    };
  }

  it("falls back to cached with the same classifications when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const demo = await classifications("demo");
    const live = await classifications("live");
    expect(live.mode).toBe("cached");
    expect(live.reason).toBe("ClinVar is unreachable");
    expect(live.codes).toEqual(demo.codes);
  });

  it("falls back to cached when ClinVar times out", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
            );
          }),
      ),
    );
    try {
      const pending = classifications("live");
      await vi.advanceTimersByTimeAsync(10_000);
      const live = await pending;
      expect(live.mode).toBe("cached");
      expect(live.reason).toBe("ClinVar did not respond within the timeout");
      expect(live.codes).toEqual((await classifications("demo")).codes);
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back to cached on an error status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    const live = await classifications("live");
    expect(live.mode).toBe("cached");
    expect(live.codes[BRCA1]).toBe("LIKELY_PATHOGENIC");
  });
});
