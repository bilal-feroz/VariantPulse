import { describe, expect, it } from "vitest";

import { analyseWorkspace } from "@/lib/analysis";
import {
  MINUTES_PER_MANUAL_CHECK,
  estimatedHoursSaved,
  formatScanSeconds,
  parseScanTiming,
  scanTimingHeader,
  timed,
} from "@/lib/impact";

describe("impact row", () => {
  it("estimates time saved at two minutes per manual ClinVar lookup", () => {
    expect(MINUTES_PER_MANUAL_CHECK).toBe(2);
    expect(estimatedHoursSaved(12_482)).toBeCloseTo((12_482 * 2) / 60, 10);
    expect(estimatedHoursSaved(0)).toBe(0);
  });

  it("carries the scan duration through a Server-Timing header", () => {
    expect(scanTimingHeader(37.24)).toBe("analysis;dur=37.2");
    expect(parseScanTiming(scanTimingHeader(37.24))).toBe(37.2);
    expect(parseScanTiming("cache;desc=hit, analysis;dur=12.5")).toBe(12.5);
    expect(parseScanTiming("db;dur=4")).toBeNull();
    expect(parseScanTiming("analysis;desc=no-duration")).toBeNull();
    expect(parseScanTiming(null)).toBeNull();
  });

  it("shows the duration in seconds", () => {
    expect(formatScanSeconds(37)).toBe("0.04 s");
    expect(formatScanSeconds(1_340)).toBe("1.3 s");
    expect(formatScanSeconds(2)).toBe("< 0.01 s");
  });

  it("measures how long a run actually takes", async () => {
    const { durationMs } = await timed(() => new Promise((resolve) => setTimeout(resolve, 25)));
    expect(durationMs).toBeGreaterThanOrEqual(20);
  });

  it("times the real analysis, returning its result untouched", async () => {
    const { result, durationMs } = await timed(() => analyseWorkspace({ mode: "demo" }));
    expect(result.scan.findingsChecked).toBeGreaterThan(0);
    expect(Number.isFinite(durationMs) && durationMs >= 0).toBe(true);
  });
});
