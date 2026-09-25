/**
 * Classification taxonomy and the deterministic change-detection engine.
 *
 * Nothing in this file is probabilistic and nothing calls a language model.
 * Whether a variant's interpretation changed is decided by comparing two
 * normalised codes, so the same inputs always produce the same verdict and the
 * reasoning can be shown to a reviewer in full.
 */

import type { RegionalEvidence } from "@/data/regional";
import type { MonitoredVariant } from "@/data/workspace";

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

/** Maps one term of an assertion, such as "likely pathogenic", onto the taxonomy. */
function normaliseTerm(term: string): ClassificationCode {
  if (term.includes("conflicting")) return "CONFLICTING";
  if (term.includes("likely pathogenic")) return "LIKELY_PATHOGENIC";
  if (term.includes("likely benign")) return "LIKELY_BENIGN";
  if (term.includes("pathogenic")) return "PATHOGENIC";
  if (term.includes("benign")) return "BENIGN";
  if (term === "vus" || term.includes("uncertain")) return "VUS";
  return "NOT_PROVIDED";
}

/**
 * Maps a free-text classification from any source onto the internal taxonomy.
 *
 * Case, underscores and spacing carry no meaning, so "LIKELY_PATHOGENIC" and
 * "Likely pathogenic" are the same assertion. Combined assertions such as
 * "Pathogenic/Likely pathogenic" or "Likely Pathogenic, Pathogenic" resolve to
 * the stronger member, which is how a reviewer reads them; qualifiers such as
 * "low penetrance" or "drug response" do not change the band. Terms that span
 * two bands can only mean the sources disagree.
 */
export function normaliseClassification(raw: string | null | undefined): ClassificationCode {
  if (!raw) return "NOT_PROVIDED";
  const value = raw.trim().toLowerCase().replace(/[_\s]+/g, " ");

  const codes = value
    .split(/[/,;]/)
    .map((term) => normaliseTerm(term.trim()))
    .filter((code) => code !== "NOT_PROVIDED");

  if (codes.length === 0) return "NOT_PROVIDED";
  if (codes.includes("CONFLICTING")) return "CONFLICTING";

  const bands = new Set(codes.map((code) => CLASSIFICATIONS[code].band));
  if (bands.size > 1) return "CONFLICTING";

  // One band: the member furthest from uncertain is the stronger assertion.
  return codes.reduce((strongest, code) =>
    Math.abs(CLASSIFICATIONS[code].tier ?? 0) > Math.abs(CLASSIFICATIONS[strongest].tier ?? 0)
      ? code
      : strongest,
  );
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
    label: "Regional signal",
    description:
      "The global classification has not moved, but regional evidence deserves review. It is evidence to weigh, not a classification.",
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
    `Interpretation on record normalised to ${before.label}.`,
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

  // Benign and likely benign lead to the same clinical reading, so movement
  // between them is noise rather than a case.
  if (before.band === "benign" && after.band === "benign") {
    rationale.push(
      "Both readings sit in the benign band, so the clinical reading of this result is unchanged.",
    );
    return { type: "NO_MATERIAL_CHANGE", direction: "none", rationale };
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

/* -- Regional evidence ---------------------------------------------------- */

/** Middle Eastern alleles required before a frequency difference is read as a signal. */
export const MIN_REGIONAL_ALLELES = 3;
/** How many times the global frequency the Middle Eastern one must reach to count. */
export const ENRICHMENT_RATIO = 2;

export type RegionalSignalKind =
  /** A regional catalogue places the variant in a different band from ClinVar today. */
  | "CATALOGUE_DISAGREES"
  /** Markedly more frequent in the Middle Eastern group, with no regional record speaking to it. */
  | "FREQUENCY_ENRICHED"
  /** Designated for regional review in the supplied dataset. */
  | "CURATED_CONTEXT"
  /** A regional catalogue held today's reading before ClinVar's historical release did. */
  | "CATALOGUE_AHEAD"
  | "CATALOGUE_AGREES"
  | "NONE";

export interface RegionalSignal {
  kind: RegionalSignalKind;
  /** True when the regional evidence should open, or join, a review case. */
  flagged: boolean;
  /** Middle Eastern allele frequency over the global one, when both were observed. */
  ratio: number | null;
  /** Why the signal is what it is, stated from the structured fields only. */
  reason: string;
  /** The frequency evidence in one sentence, whatever the signal. */
  frequencySummary: string;
}

const count = (value: number) => value.toLocaleString("en-US");

function frequencyText(value: number | null): string {
  if (value === null) return "not measurable";
  return value === 0 ? "0" : value.toExponential(2);
}

function describeFrequency(regional: RegionalEvidence | null, ratio: number | null): string {
  if (!regional) return "No regional evidence is held for this variant.";
  const { global, middleEastern: me } = regional;
  if (!regional.inGnomad || !global || !me) {
    return "Absent from gnomAD v4, including its Middle Eastern group.";
  }
  const globalText = `${count(global.alleleCount)} of ${count(global.alleleNumber)} alleles globally`;
  if (me.alleleCount === 0) {
    return `Not observed in ${count(me.alleleNumber)} Middle Eastern alleles in gnomAD v4; ${globalText}.`;
  }
  const enriched =
    ratio !== null && ratio >= ENRICHMENT_RATIO && me.alleleCount >= MIN_REGIONAL_ALLELES
      ? `, about ${ratio.toFixed(1)} times the global frequency`
      : "";
  return `Observed in ${count(me.alleleCount)} of ${count(me.alleleNumber)} Middle Eastern alleles in gnomAD v4 (${frequencyText(me.frequency)}) against ${globalText} (${frequencyText(global.frequency)})${enriched}.`;
}

/** A catalogue's listed readings for a sentence: "likely pathogenic or pathogenic". */
function reading(significance: string): string {
  return significance.toLowerCase().replace(/, /g, " or ");
}

/** Joins country names for a sentence: "the UAE and Yemen". */
function list(values: string[]): string {
  const names = values.map((name) => (name === "United Arab Emirates" ? "the UAE" : name));
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** The signal's reason with the frequency evidence beside it, each stated once. */
export function regionalStatement(signal: RegionalSignal): string {
  if (signal.kind === "FREQUENCY_ENRICHED" || signal.reason.includes(signal.frequencySummary)) {
    return signal.reason;
  }
  return `${signal.reason} ${signal.frequencySummary}`;
}

/**
 * Reads the regional evidence for one variant against its classification.
 *
 * Nothing here produces a classification. Population frequency is compared
 * with the global figure, and a regional catalogue's own reading is compared by
 * band with ClinVar's, and the result says only whether a clinician should look.
 * A frequency difference raises a signal only when no regional record already
 * speaks to the variant, because a catalogue of regional patients accounts for
 * how often the variant is seen there.
 */
export function assessRegionalSignal(
  regional: RegionalEvidence | null,
  variant: Pick<
    MonitoredVariant,
    "historicalClassification" | "historicalClinvarText" | "historicalSource"
  >,
  current: ClassificationCode,
): RegionalSignal {
  const global = regional?.global ?? null;
  const me = regional?.middleEastern ?? null;
  const ratio =
    global?.frequency && me?.frequency && me.alleleCount > 0 ? me.frequency / global.frequency : null;
  const frequencySummary = describeFrequency(regional, ratio);
  const signal = (kind: RegionalSignalKind, flagged: boolean, reason: string): RegionalSignal => ({
    kind,
    flagged,
    ratio,
    reason,
    frequencySummary,
  });

  if (!regional) return signal("NONE", false, frequencySummary);

  const catalogue = regional.catalogue;
  const catalogueBand = catalogue ? CLASSIFICATIONS[catalogue.code].band : null;
  const currentBand = CLASSIFICATIONS[current].band;
  const determinate = (band: ClassificationBand | null) =>
    band !== null && band !== "indeterminate";

  if (catalogue && determinate(catalogueBand) && determinate(currentBand) && catalogueBand !== currentBand) {
    return signal(
      "CATALOGUE_DISAGREES",
      true,
      `CTGA records it as ${reading(catalogue.significance)} in ${list(catalogue.countries)}, while ClinVar now reads ${CLASSIFICATIONS[current].label.toLowerCase()}. The two place the variant in different clinical bands, and VariantPulse does not rank one above the other.`,
    );
  }

  const enriched =
    ratio !== null && ratio >= ENRICHMENT_RATIO && (me?.alleleCount ?? 0) >= MIN_REGIONAL_ALLELES;
  if (enriched && !catalogue && me && global) {
    return signal(
      "FREQUENCY_ENRICHED",
      true,
      `Observed in ${count(me.alleleCount)} of ${count(me.alleleNumber)} Middle Eastern alleles in gnomAD v4, about ${ratio.toFixed(1)} times the global frequency (${count(global.alleleCount)} of ${count(global.alleleNumber)} alleles). Frequency is evidence to weigh, not a classification, and the Middle Eastern sample is small.`,
    );
  }

  if (regional.context?.flagForReview) {
    return signal(
      "CURATED_CONTEXT",
      true,
      `Regional context flagged for review in the supplied dataset. ${frequencySummary}`,
    );
  }

  if (catalogue && determinate(catalogueBand) && catalogueBand === currentBand) {
    const historicalBand = CLASSIFICATIONS[variant.historicalClassification].band;
    const fromClinvar = variant.historicalSource.kind === "clinvar-release";
    const release = variant.historicalSource.release ?? "2023-01";
    const ahead =
      catalogue.listedSince.slice(0, 7) <= release && (!fromClinvar || historicalBand !== catalogueBand);
    if (ahead) {
      const then = fromClinvar
        ? `ClinVar's ${variant.historicalSource.label} release read ${(variant.historicalClinvarText ?? CLASSIFICATIONS[variant.historicalClassification].label).toLowerCase()}`
        : "ClinVar held no record of it in its January 2023 release";
      return signal(
        "CATALOGUE_AHEAD",
        false,
        `CTGA has listed it as ${reading(catalogue.significance)} in ${list(catalogue.countries)} since ${catalogue.listedSince.slice(0, 4)}. ${then}; ClinVar has since reached the same band.`,
      );
    }
    return signal(
      "CATALOGUE_AGREES",
      false,
      `CTGA records it as ${reading(catalogue.significance)} in ${list(catalogue.countries)}, in the same clinical band as ClinVar.`,
    );
  }

  return signal("NONE", false, frequencySummary);
}
