/**
 * The three signals the visual layer draws, collapsed from the six change
 * types the engine reports. They carry the colour system's meanings and
 * nothing else: vermilion when the science changed, amber when evidence is
 * unresolved and a person has to weigh it, slate when the reading on record
 * still holds. The groups are the same ones the variant list filters by.
 */

import type { ChangeType } from "./classification";

export type Signal = "changed" | "review" | "quiet";

export const SIGNAL_OF: Record<ChangeType, Signal> = {
  CLASSIFICATION_DRIFT: "changed",
  EVIDENCE_STRENGTHENED: "changed",
  EVIDENCE_WEAKENED: "changed",
  CONSENSUS_CONFLICT: "review",
  REGIONAL_CONFLICT: "review",
  NO_MATERIAL_CHANGE: "quiet",
};

export interface SignalMeta {
  label: string;
  /** Hex, for canvases and WebGL; the palette tokens it mirrors are named beside it. */
  color: string;
  /** Tailwind background class for legend dots in HTML. */
  dot: string;
}

export const SIGNALS: Record<Signal, SignalMeta> = {
  // Vermilion, the colour system's "something changed".
  changed: { label: "Reclassified", color: "#E85D4A", dot: "bg-vermilion" },
  // Amber, "unresolved context".
  review: { label: "Conflict or regional", color: "#D99A28", dot: "bg-amber" },
  // Palette slate, the historical, quiet state.
  quiet: { label: "Unchanged", color: "#74777D", dot: "bg-slate" },
};

export const SIGNAL_ORDER: readonly Signal[] = ["changed", "review", "quiet"];
