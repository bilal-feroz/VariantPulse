import type { Tone } from "@/lib/classification";

export interface EvidenceModeMeta {
  label: string;
  detail: string;
  tone: Tone;
}

/** How the active evidence mode is shown. Unknown modes are treated as cached. */
export function evidenceModeMeta(mode: string | undefined): EvidenceModeMeta {
  switch (mode) {
    case "demo":
      return {
        label: "Demo evidence",
        detail: "Deterministic demo using the bundled ClinVar snapshot.",
        tone: "neutral",
      };
    case "live":
      return { label: "Live ClinVar", detail: "Evidence read live from NCBI ClinVar.", tone: "positive" };
    default:
      return {
        label: "Cached evidence",
        detail: "Serving the bundled ClinVar snapshot; the live source was unavailable.",
        tone: "warning",
      };
  }
}
