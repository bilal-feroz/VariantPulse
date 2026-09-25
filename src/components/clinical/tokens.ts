/**
 * Semantic class sets for the clinical views, so each colour role is decided
 * in one place:
 *   historical — the interpretation on file (slate)
 *   current    — today's interpretation, VariantPulse identity (garnet)
 *   change     — the knowledge-change signal (vermilion), used for nothing else
 *   review     — human review required (amber)
 *   cta        — primary clinical action (oxblood)
 * Palette slate is non-text only; historical text uses `text-muted`.
 */
export const HISTORICAL = {
  text: "text-muted",
  border: "border-line-2",
  surface: "bg-surface-2",
  fill: "bg-slate",
  stroke: "stroke-slate",
} as const;

export const CURRENT = {
  text: "text-garnet",
  border: "border-selected-border",
  surface: "bg-selected-bg",
  fill: "bg-garnet",
  stroke: "stroke-garnet",
} as const;

export const CHANGE = {
  /* Vermilion is below 4.5:1 on bone, so change labels are ink and the
     vermilion rides on the connector, dot and icon. */
  text: "text-ink",
  icon: "text-vermilion",
  border: "border-vermilion",
  surface: "bg-vermilion-soft",
  fill: "bg-vermilion",
  stroke: "stroke-vermilion",
} as const;

export const REVIEW = {
  text: "text-warn",
  border: "border-warn-border",
  surface: "bg-warn-soft",
  fill: "bg-amber",
  stroke: "stroke-amber",
} as const;

export const CTA = "bg-oxblood text-warm-white hover:bg-garnet focus-visible:outline-garnet";
