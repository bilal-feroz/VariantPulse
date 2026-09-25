import { NextResponse } from "next/server";

import { analyseWorkspace } from "@/lib/analysis";
import { invalidateEvidenceCache } from "@/lib/clinvar";
import { serialiseAnalysis } from "@/lib/dto";

export const dynamic = "force-dynamic";

/**
 * Runs a full evidence sync: drops the cached evidence read, queries the
 * source again, and re-walks the record corpus.
 */
export async function POST() {
  invalidateEvidenceCache();
  const analysis = await analyseWorkspace({ force: true });
  return NextResponse.json(serialiseAnalysis(analysis));
}
