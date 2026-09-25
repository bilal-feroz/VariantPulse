/**
 * The impact row on the home dashboard: what one scan covered, and how much
 * manual checking it stands in for.
 *
 * The findings count and the cases surfaced come straight from the analysis.
 * The scan duration is measured around the analysis run itself, on the server,
 * and travels to the browser with the analysis it timed. Only the time saving
 * is an estimate, and it is labelled as one wherever it is shown.
 */

/** Assumed minutes a clinician spends looking one finding up in ClinVar by hand. */
export const MINUTES_PER_MANUAL_CHECK = 2;

export function estimatedHoursSaved(findingsChecked: number): number {
  return (findingsChecked * MINUTES_PER_MANUAL_CHECK) / 60;
}

/** Runs `run` and reports how long it took, in milliseconds. */
export async function timed<T>(run: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const started = performance.now();
  const result = await run();
  return { result, durationMs: performance.now() - started };
}

/** The Server-Timing metric an analysis run is reported under. */
const SCAN_METRIC = "analysis";

export function scanTimingHeader(durationMs: number): string {
  return `${SCAN_METRIC};dur=${durationMs.toFixed(1)}`;
}

/** The analysis duration from a Server-Timing header, or null when it is absent. */
export function parseScanTiming(header: string | null | undefined): number | null {
  if (!header) return null;
  for (const metric of header.split(",")) {
    const [name, ...params] = metric.split(";").map((part) => part.trim());
    if (name !== SCAN_METRIC) continue;
    const duration = params.find((param) => param.startsWith("dur="));
    const value = duration ? Number(duration.slice(4)) : Number.NaN;
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  return null;
}

/** `0.04 s`, `1.3 s`; a run too quick to register reads `< 0.01 s`. */
export function formatScanSeconds(durationMs: number): string {
  const seconds = durationMs / 1000;
  if (seconds < 0.005) return "< 0.01 s";
  return `${seconds < 1 ? seconds.toFixed(2) : seconds.toFixed(1)} s`;
}
