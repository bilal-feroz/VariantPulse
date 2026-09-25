/**
 * How each evidence mode presents itself. Client-safe: no server imports.
 */

import type { Tone } from "./classification";
import type { EvidenceMode } from "./clinvar";

export interface EvidenceModeMeta {
  mode: EvidenceMode;
  /** Short badge label. */
  label: string;
  /** Compact status used by the workspace indicator. */
  indicator: string;
  /** Adjective used in sentences such as "checked against demo evidence". */
  noun: string;
  /** Where a pipeline step says the evidence came from. */
  pipelineSource: string;
  description: string;
  tone: Tone;
  /** Only a live read is worth animating. */
  pulse: boolean;
}

export const EVIDENCE_MODES: Record<EvidenceMode, EvidenceModeMeta> = {
  demo: {
    mode: "demo",
    label: "Demo",
    indicator: "Demo snapshot",
    noun: "demo snapshot",
    pipelineSource: "Served from the bundled demo snapshot",
    description:
      "Demo mode: evidence is served from the bundled ClinVar snapshot, so every run is identical and no network is used.",
    tone: "neutral",
    pulse: false,
  },
  live: {
    mode: "live",
    label: "Live",
    indicator: "Evidence monitor live",
    noun: "live",
    pipelineSource: "Read live from ClinVar",
    description: "Evidence is being read live from ClinVar.",
    tone: "positive",
    pulse: true,
  },
  cached: {
    mode: "cached",
    label: "Cached",
    indicator: "Cached evidence",
    noun: "cached",
    pipelineSource: "Served from the bundled snapshot",
    description: "The live ClinVar read failed, so the bundled snapshot is being served.",
    tone: "warning",
    pulse: false,
  },
};
