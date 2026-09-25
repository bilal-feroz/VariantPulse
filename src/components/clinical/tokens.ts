/**
 * Semantic class sets for the clinical views, so each colour role is decided
 * in one place:
 *   historical — the interpretation on file (slate)
 *   current    — today's interpretation, VariantPulse identity (garnet)
 *   change     — the knowledge-change signal (vermilion), used for nothing else
 *   review     — human review required (amber)
 *   cta        — primary clinical action (oxblood)
 */
export const HISTORICAL = {
  text: "text-muted",
  border: "border-line-2",
  surface: "bg-surface-2",
  fill: "bg-muted",
  stroke: "stroke-muted",
} as const;

export const CURRENT = {
  text: "text-accent",
  border: "border-accent-ring",
  surface: "bg-accent-soft",
  fill: "bg-accent",
  stroke: "stroke-accent",
} as const;

export const CHANGE = {
  text: "text-crit",
  border: "border-crit",
  surface: "bg-crit-soft",
  fill: "bg-crit",
  stroke: "stroke-crit",
} as const;

export const REVIEW = {
  text: "text-warn",
  border: "border-warn",
  surface: "bg-warn-soft",
  fill: "bg-warn",
  stroke: "stroke-warn",
} as const;

export const CTA =
  "bg-ink text-white hover:bg-ink/90 focus-visible:outline-accent";
