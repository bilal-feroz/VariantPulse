import { NextResponse } from "next/server";

import { analyseWorkspace } from "@/lib/analysis";
import { serialiseAnalysis } from "@/lib/dto";

export const dynamic = "force-dynamic";

/** The current analysis, served from the cached evidence read when it is warm. */
export async function GET() {
  try {
    const analysis = await analyseWorkspace();
    return NextResponse.json(serialiseAnalysis(analysis));
  } catch {
    return NextResponse.json({ error: "Analysis unavailable" }, { status: 503 });
  }
}
