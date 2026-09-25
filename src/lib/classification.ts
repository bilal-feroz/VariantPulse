/**
 * Classification taxonomy and the deterministic change-detection engine.
 *
 * Nothing in this file is probabilistic and nothing calls a language model.
 * Whether a variant's interpretation changed is decided by comparing two
 * normalised codes, so the same inputs always produce the same verdict and the
 * reasoning can be shown to a reviewer in full.
 */

export type ClassificationCode =
  | "PATHOGENIC"
  | "LIKELY_PATHOGENIC"
  | "VUS"
  | "LIKELY_BENIGN"
  | "BENIGN"
  | "CONFLICTING"
  | "NOT_PROVIDED";

/** Clinically meaningful grouping. Band crossings are what reviewers act on. */
export type ClassificationBand = "pathogenic" | "uncertain" | "benign" | "indeterminate";

export type Tone = "critical" | "warning" | "neutral" | "positive" | "muted";

export interface ClassificationMeta {
  code: ClassificationCode;
  /** Short label for dense surfaces such as tables and pills. */
  short: string;
  /** Full label for headings and reports. */
  label: string;
  band: ClassificationBand;
  /** Ordinal position on the benign-to-pathogenic axis. Null when undirected. */
  tier: number | null;
  tone: Tone;
}

export const CLASSIFICATIONS: Record<ClassificationCode, ClassificationMeta> = {
  PATHOGENIC: {
    code: "PATHOGENIC",
    short: "Pathogenic",
    label: "Pathogenic",
    band: "pathogenic",
    tier: 2,
    tone: "critical",
  },
  LIKELY_PATHOGENIC: {
    code: "LIKELY_PATHOGENIC",
    short: "Likely pathogenic",
    label: "Likely pathogenic",
    band: "pathogenic",
    tier: 1,
    tone: "critical",
  },
  VUS: {
    code: "VUS",
    short: "VUS",
    label: "Uncertain significance",
    band: "uncertain",
    tier: 0,
    tone: "warning",
  },
  LIKELY_BENIGN: {
    code: "LIKELY_BENIGN",
    short: "Likely benign",
    label: "Likely benign",
    band: "benign",
    tier: -1,
    tone: "positive",
  },
  BENIGN: {
    code: "BENIGN",
    short: "Benign",
    label: "Benign",
    band: "benign",
    tier: -2,
    tone: "positive",
  },
  CONFLICTING: {
    code: "CONFLICTING",
    short: "Conflicting",
    label: "Conflicting classifications",
    band: "indeterminate",
    tier: null,
    tone: "warning",
  },
  NOT_PROVIDED: {
    code: "NOT_PROVIDED",
    short: "Not provided",
    label: "No classification provided",
    band: "indeterminate",
    tier: null,
    tone: "muted",
  },
};

export function meta(code: ClassificationCode): ClassificationMeta {
  return CLASSIFICATIONS[code] ?? CLASSIFICATIONS.NOT_PROVIDED;
}

/**
 * Maps a free-text classification from any source onto the internal taxonomy.
 * Combined assertions such as "Pathogenic/Likely pathogenic" resolve to the
 * stronger member, which is how a reviewer reads them.
 */
export function normaliseClassification(raw: string | null | undefined): ClassificationCode {
  if (!raw) return "NOT_PROVIDED";
  const value = raw.trim().toLowerCase();

  if (value.includes("conflicting")) return "CONFLICTING";
  if (value.includes("pathogenic/likely pathogenic")) return "PATHOGENIC";
  if (value.includes("benign/likely benign")) return "BENIGN";
  if (value.includes("likely pathogenic")) return "LIKELY_PATHOGENIC";
  if (value.includes("likely benign")) return "LIKELY_BENIGN";
  if (value.includes("pathogenic")) return "PATHOGENIC";
  if (value.includes("benign")) return "BENIGN";
  if (value === "vus" || value.includes("uncertain")) return "VUS";
  return "NOT_PROVIDED";
}

/* -- Review confidence ---------------------------------------------------- */

export interface ReviewConfidence {
  /** The 0-4 review-status rating ClinVar assigns. */
  stars: number;
  label: string;
  /** Plain-language strength used across the interface. */
  strength: "Definitive" | "Strong" | "Moderate" | "Limited" | "Minimal";
}

export function reviewConfidence(reviewStatus: string | null | undefined): ReviewConfidence {
  const value = (reviewStatus ?? "").toLowerCase();

  if (value.includes("practice guideline")) {
    return { stars: 4, label: "Practice guideline", strength: "Definitive" };
  }
  if (value.includes("expert panel")) {
    return { stars: 3, label: "Reviewed by expert panel", strength: "Strong" };
  }
  if (value.includes("conflicting")) {
    return { stars: 1, label: "Conflicting submissions", strength: "Limited" };
  }
  if (value.includes("multiple submitters")) {
    return { stars: 2, label: "Multiple submitters, no conflicts", strength: "Moderate" };
  }
  if (value.includes("single submitter")) {
    return { stars: 1, label: "Single submitter", strength: "Limited" };
  }
  return { stars: 0, label: "No assertion criteria", strength: "Minimal" };
}

/* -- Change detection ----------------------------------------------------- */

export type ChangeType =
  | "CLASSIFICATION_DRIFT"
  | "EVIDENCE_STRENGTHENED"
  | "EVIDENCE_WEAKENED"
  | "CONSENSUS_CONFLICT"
  | "REGIONAL_CONFLICT"
  | "NO_MATERIAL_CHANGE";

export interface ChangeTypeMeta {
  type: ChangeType;
  label: string;
  description: string;
  tone: Tone;
  /** Whether the change warrants a clinical review case. */
  material: boolean;
}

export const CHANGE_TYPES: Record<ChangeType, ChangeTypeMeta> = {
  CLASSIFICATION_DRIFT: {
    type: "CLASSIFICATION_DRIFT",
    label: "Classification drift",
    description:
      "The interpretation moved across the clinically actionable boundary since this result was reported.",
    tone: "critical",
    material: true,
  },
  EVIDENCE_STRENGTHENED: {
    type: "EVIDENCE_STRENGTHENED",
    label: "Evidence strengthened",
    description:
      "The interpretation moved further toward pathogenicity without crossing a band boundary.",
    tone: "warning",
    material: true,
  },
  EVIDENCE_WEAKENED: {
    type: "EVIDENCE_WEAKENED",
    label: "Evidence weakened",
    description:
      "Accumulated evidence now favours a more benign interpretation than the one reported.",
    tone: "positive",
    material: true,
  },
  CONSENSUS_CONFLICT: {
    type: "CONSENSUS_CONFLICT",
    label: "Consensus conflict",
    description: "Submitters no longer agree on how this variant should be classified.",
    tone: "warning",
    material: true,
  },
  REGIONAL_CONFLICT: {
    type: "REGIONAL_CONFLICT",
    label: "Regional conflict",
    description: "Regional evidence reaches a different conclusion from the global consensus.",
    tone: "warning",
    material: true,
  },
  NO_MATERIAL_CHANGE: {
    type: "NO_MATERIAL_CHANGE",
    label: "No material change",
    description: "Current evidence agrees with the interpretation on record.",
    tone: "muted",
    material: false,
  },
};

export interface ChangeVerdict {
  type: ChangeType;
  /** Direction along the benign-to-pathogenic axis, when defined. */
  direction: "toward-pathogenic" | "toward-benign" | "none";
  /** Ordered, human-readable reasoning behind the verdict. */
  rationale: string[];
}

/**
 * Compares the classification on record with the current one.
 *
 * Crossings into or out of the pathogenic band count as drift because they
 * change what a clinical team would act on. Movement inside a band, or between
 * the uncertain and benign bands, is graded as strengthened or weakened
 * evidence instead.
 */
export function detectChange(
  recorded: ClassificationCode,
  current: ClassificationCode,
): ChangeVerdict {
  const before = meta(recorded);
  const after = meta(current);
  const rationale: string[] = [
    `Recorded interpretation normalised to ${before.label}.`,
    `Current interpretation normalised to ${after.label}.`,
  ];

  if (current === "NOT_PROVIDED") {
    rationale.push("No current classification is available to compare against.");
    return { type: "NO_MATERIAL_CHANGE", direction: "none", rationale };
  }

  if (current === "CONFLICTING" && recorded !== "CONFLICTING") {
    rationale.push("Current submissions disagree, so no single consensus exists.");
    return { type: "CONSENSUS_CONFLICT", direction: "none", rationale };
  }

  if (recorded === current) {
    rationale.push("Codes are identical, so no reclassification has occurred.");
    return { type: "NO_MATERIAL_CHANGE", direction: "none", rationale };
  }

  const tierBefore = before.tier;
  const tierAfter = after.tier;
  const direction: ChangeVerdict["direction"] =
    tierBefore === null || tierAfter === null
      ? "none"
      : tierAfter > tierBefore
        ? "toward-pathogenic"
        : tierAfter < tierBefore
          ? "toward-benign"
          : "none";

  const crossedIntoPathogenic = before.band !== "pathogenic" && after.band === "pathogenic";
  const crossedOutOfPathogenic = before.band === "pathogenic" && after.band !== "pathogenic";

  if (crossedIntoPathogenic) {
    rationale.push(
      "The interpretation crossed into the clinically actionable band, so records carrying it may need review.",
    );
    return { type: "CLASSIFICATION_DRIFT", direction, rationale };
  }

  if (crossedOutOfPathogenic) {
    rationale.push(
      "The interpretation left the clinically actionable band, so earlier management guidance may no longer apply.",
    );
    return { type: "CLASSIFICATION_DRIFT", direction, rationale };
  }

  if (direction === "toward-pathogenic") {
    rationale.push("Evidence moved toward pathogenicity within the same band.");
    return { type: "EVIDENCE_STRENGTHENED", direction, rationale };
  }

  if (direction === "toward-benign") {
    rationale.push("Evidence moved toward a benign interpretation.");
    return { type: "EVIDENCE_WEAKENED", direction, rationale };
  }

  rationale.push("The change does not alter the clinical reading of this result.");
  return { type: "NO_MATERIAL_CHANGE", direction: "none", rationale };
}

/**
 * Detects disagreement between two independently derived classifications for
 * the same variant. Used for the global versus regional comparison.
 */
export function detectDisagreement(
  global: ClassificationCode,
  regional: ClassificationCode,
): { conflicting: boolean; severity: "none" | "moderate" | "high"; reason: string } {
  const a = meta(global);
  const b = meta(regional);

  // An indeterminate reading on either side is not a disagreement between
  // regions — it is an absence of a settled position to disagree with. That
  // belongs to consensus conflict, which is detected separately.
  if (a.band === "indeterminate" || b.band === "indeterminate") {
    return {
      conflicting: false,
      severity: "none",
      reason:
        "At least one source has no settled classification, so there is no regional disagreement to resolve.",
    };
  }

  if (a.band === b.band) {
    return {
      conflicting: false,
      severity: "none",
      reason: "Both sources place this variant in the same band.",
    };
  }

  const crossesActionable = (a.band === "pathogenic") !== (b.band === "pathogenic");

  if (crossesActionable) {
    return {
      conflicting: true,
      severity: "high",
      reason:
        "One source places this variant in the clinically actionable band and the other does not.",
    };
  }

  return {
    conflicting: true,
    severity: "moderate",
    reason:
      "The sources place this variant in different bands without crossing the actionable boundary.",
  };
}
