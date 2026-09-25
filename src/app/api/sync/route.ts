import { NextResponse } from "next/server";

import { analyseWorkspace } from "@/lib/analysis";
import { invalidateEvidenceCache } from "@/lib/clinvar";
import { serialiseAnalysis } from "@/lib/dto";
import { scanTimingHeader, timed } from "@/lib/impact";

export const dynamic = "force-dynamic";

/**
 * Runs a full evidence sync: drops the cached evidence read, queries the
 * source again, and re-walks the record corpus. In demo mode the source is the
 * bundled snapshot, so the result is identical on every call.
 *
 * How long the run took is reported in a Server-Timing header, leaving the
 * analysis in the body exactly as it was.
 */
export async function POST() {
  try {
    invalidateEvidenceCache();
    const { result, durationMs } = await timed(() => analyseWorkspace({ force: true }));
    return NextResponse.json(serialiseAnalysis(result), {
      headers: { "Server-Timing": scanTimingHeader(durationMs) },
    });
  } catch {
    return NextResponse.json({ error: "Evidence sync failed" }, { status: 503 });
  }
}
