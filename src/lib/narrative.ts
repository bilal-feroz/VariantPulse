/**
 * Evidence summaries.
 *
 * These are composed from the structured fields of the records they cite:
 * classification codes, submission counts, review status, evaluation dates and
 * regional observation counts. Nothing is inferred beyond what those fields
 * state, and no summary is used to decide whether a change occurred; that is
 * settled deterministically in `classification.ts` before a summary is written.
 *
 * The output is decision support. It is written to be checked against the
 * citations shown beside it, not taken on trust.
 */

import type {
  ChangeType,
  ClassificationCode,
  ReviewConfidence,
} from "./classification";
import { meta } from "./classification";
import type { EvidenceRecord } from "./clinvar";
import type { RegionalEvidence } from "@/data/regional";
import type { MonitoredVariant } from "@/data/workspace";
import type { RegionalDisagreement } from "./analysis";
import { formatDate, formatYear } from "./utils";

export interface SummaryInput {
  variant: MonitoredVariant;
  evidence: EvidenceRecord;
  recordedCode: ClassificationCode;
  currentCode: ClassificationCode;
  changeType: ChangeType;
  confidence: ReviewConfidence;
  regional: RegionalEvidence | null;
  disagreement: RegionalDisagreement | null;
  impactedRecordCount: number;
}

function submissionPhrase(count: number): string {
  if (count === 0) return "no submissions on file";
  if (count === 1) return "a single submission";
  return `${count} submissions`;
}

/** Full sentence, so subject and verb agree for every count. */
function recordPhrase(count: number): string {
  if (count === 0) return "No records on file carry this variant.";
  if (count === 1)
    return "One record on file carries this variant and has not yet been reassessed.";
  return `${count} records on file carry this variant and have not yet been reassessed.`;
}

export function composeEvidenceSummary(input: SummaryInput): string {
  const {
    variant,
    evidence,
    recordedCode,
    currentCode,
    changeType,
    confidence,
    regional,
    disagreement,
    impactedRecordCount,
  } = input;

  const before = meta(recordedCode);
  const after = meta(currentCode);
  const reportedYear = formatYear(variant.recordedOn);
  const label = `${variant.gene} ${variant.hgvsCoding}`;
  const sentences: string[] = [];

  switch (changeType) {
    case "CLASSIFICATION_DRIFT": {
      const intoActionable = after.band === "pathogenic";
      sentences.push(
        `Since the ${reportedYear} report, the consensus for ${label} has moved from ${before.label.toLowerCase()} to ${after.label.toLowerCase()}. That reading rests on ${submissionPhrase(evidence.submissionCount)} at ${confidence.strength.toLowerCase()} review confidence, ${confidence.label.toLowerCase()}.`,
      );
      sentences.push(
        intoActionable
          ? "That crosses the clinically actionable boundary, so management guidance issued on the original interpretation may no longer be the right guidance."
          : "That moves the variant out of the clinically actionable band, so surveillance or management started on the original interpretation may no longer be indicated.",
      );
      break;
    }

    case "EVIDENCE_STRENGTHENED":
      sentences.push(
        `Evidence for ${label} has firmed up since the ${reportedYear} report: the consensus moved from ${before.label.toLowerCase()} to ${after.label.toLowerCase()} on the strength of ${submissionPhrase(evidence.submissionCount)}.`,
      );
      sentences.push(
        "The clinical band is unchanged, so this is a confidence shift rather than a reversal.",
      );
      break;

    case "EVIDENCE_WEAKENED":
      sentences.push(
        `Accumulated evidence now favours a more benign reading of ${label} than the ${before.label.toLowerCase()} interpretation issued in ${reportedYear}; the current consensus is ${after.label.toLowerCase()}.`,
      );
      sentences.push(
        "Where the original result drove additional testing or surveillance, that basis may have weakened.",
      );
      break;

    case "CONSENSUS_CONFLICT":
      sentences.push(
        `Submitters no longer agree on ${label}. The ${reportedYear} report recorded ${before.label.toLowerCase()}, and current submissions are split rather than resolving to a single classification.`,
      );
      sentences.push(
        "A conflicting record is not the same as a benign one, and it is not the same as a pathogenic one.",
      );
      break;

    case "REGIONAL_CONFLICT":
      sentences.push(
        `Global and regional evidence disagree on ${label}. The global consensus is ${after.label.toLowerCase()}, drawn from ${submissionPhrase(evidence.submissionCount)}.`,
      );
      if (regional) {
        sentences.push(
          `The regional index asserts ${meta(regional.assertion).label.toLowerCase()} on ${regional.observations} observation${regional.observations === 1 ? "" : "s"} across a cohort of ${regional.cohortSize.toLocaleString("en-US")}.`,
        );
      }
      if (disagreement?.severity === "high") {
        sentences.push(
          "One source places this variant in the clinically actionable band and the other does not, which is the form of disagreement most likely to change a care decision.",
        );
      }
      break;

    default:
      sentences.push(
        `Current evidence for ${label} agrees with the ${before.label.toLowerCase()} interpretation issued in ${reportedYear}.`,
      );
      sentences.push(
        `The classification was last evaluated on ${formatDate(evidence.lastEvaluated)} and carries ${submissionPhrase(evidence.submissionCount)}.`,
      );
      break;
  }

  if (changeType !== "NO_MATERIAL_CHANGE") {
    sentences.push(recordPhrase(impactedRecordCount));
  }

  return sentences.join(" ");
}

/**
 * A single-line reason for the review queue. Deliberately terse, because the queue is
 * for triage, and the full summary lives inside the case.
 */
export function composeReviewReason(changeType: ChangeType, gene: string): string {
  switch (changeType) {
    case "CLASSIFICATION_DRIFT":
      return `${gene} interpretation crossed the actionable boundary`;
    case "EVIDENCE_STRENGTHENED":
      return `${gene} evidence strengthened since reporting`;
    case "EVIDENCE_WEAKENED":
      return `${gene} evidence now favours a benign reading`;
    case "CONSENSUS_CONFLICT":
      return `${gene} submitters no longer agree`;
    case "REGIONAL_CONFLICT":
      return `${gene} regional and global evidence disagree`;
    default:
      return `${gene} evidence reviewed, no material change`;
  }
}

/** The recommendation shown at the foot of a case. Never a diagnosis. */
export function composeRecommendation(changeType: ChangeType, impacted: number): string {
  const records = `${impacted} record${impacted === 1 ? "" : "s"}`;

  switch (changeType) {
    case "CLASSIFICATION_DRIFT":
      return `Reassess ${records} against the current interpretation and decide whether the reporting clinician should be notified. Final interpretation remains with the clinical team.`;
    case "REGIONAL_CONFLICT":
      return `Manual review recommended: global and regional sources disagree, and VariantPulse does not rank one above the other. A clinician should weigh both against the patient context.`;
    case "CONSENSUS_CONFLICT":
      return `Manual review recommended: no single consensus classification is available. Consider requesting a specialist opinion before altering any guidance.`;
    case "EVIDENCE_STRENGTHENED":
      return `Confirm whether the strengthened evidence changes management for ${records}. The clinical band is unchanged.`;
    case "EVIDENCE_WEAKENED":
      return `Review whether surveillance driven by the original interpretation is still indicated for ${records}.`;
    default:
      return "No action required. Current evidence agrees with the interpretation on record.";
  }
}

/**
 * Workspace totals span every monitored variant, whereas the headline story is a
 * single variant (see `selectStoryAssessment`). Totals are always labelled
 * with their scope so the two numbers never read as contradicting each other.
 */
export const WORKSPACE_TOTAL_LABELS = {
  findingsMonitored: "Historical findings on file in this workspace",
  evidenceChanges: "Reclassifications across all monitored variants",
  patientsImpacted: "Records affected across all changed variants in this workspace",
  regionalConflicts: "Regional conflicts across all monitored variants",
  openCases: "Open review cases across this workspace",
} as const;

export function workspaceScope(metrics: {
  evidenceChanges: number;
  regionalConflicts: number;
  patientsImpacted: number;
}): string {
  const { evidenceChanges: changes, regionalConflicts: conflicts, patientsImpacted: records } =
    metrics;
  return (
    `${changes} change${changes === 1 ? "" : "s"} · ${conflicts} regional conflict${conflicts === 1 ? "" : "s"} · ` +
    `${records} record${records === 1 ? "" : "s"} across all changed variants in this workspace`
  );
}
