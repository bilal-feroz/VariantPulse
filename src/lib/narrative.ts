/**
 * Evidence summaries.
 *
 * These are composed from the structured fields of the records they cite, by
 * fixed templates: the classification on record and where it came from, the
 * current classification with its review status and evaluation date, the
 * regional evidence, and the synthetic records that carry the variant. Nothing
 * is inferred beyond what those fields state, no language model is involved,
 * and no summary is used to decide whether a change occurred — that is settled
 * deterministically in `classification.ts` before a summary is written.
 *
 * The output is decision support. It is written to be checked against the
 * citations shown beside it, not taken on trust.
 */

import type {
  ChangeType,
  ClassificationCode,
  RegionalSignal,
  ReviewConfidence,
} from "./classification";
import { meta } from "./classification";
import type { EvidenceMode, EvidenceRecord } from "./clinvar";
import type { MonitoredVariant, PatientRecord } from "@/data/workspace";
import { formatDate } from "./utils";

export interface SummaryInput {
  variant: MonitoredVariant;
  evidence: EvidenceRecord;
  mode: EvidenceMode;
  recordedCode: ClassificationCode;
  currentCode: ClassificationCode;
  changeType: ChangeType;
  confidence: ReviewConfidence;
  regionalSignal: RegionalSignal;
  impactedPatients: PatientRecord[];
}

function submissionPhrase(count: number): string {
  if (count === 0) return "no submissions on file";
  if (count === 1) return "a single submission";
  return `${count} submissions`;
}

/** Where the interpretation on record came from, in one sentence. */
function historicalSentence(variant: MonitoredVariant, recordedCode: ClassificationCode): string {
  const label = `${variant.gene} ${variant.hgvsCoding}`;
  if (variant.historicalSource.kind === "modelled-report") {
    return `${label} was not in ClinVar in January 2023; the synthetic hospital reported it as a novel finding of ${meta(recordedCode).label.toLowerCase()}.`;
  }
  const text = (variant.historicalClinvarText ?? meta(recordedCode).label).toLowerCase();
  return `In ClinVar's ${variant.historicalSource.label} release, ${label} was classified as ${text} (${variant.historicalReviewStatus}).`;
}

function currentSentence(evidence: EvidenceRecord, mode: EvidenceMode): string {
  const source = mode === "live" ? "Live ClinVar evidence" : "The cached, verified ClinVar snapshot";
  return `${source} now reads ${evidence.classification.toLowerCase()}: ${evidence.reviewStatus}, last evaluated ${formatDate(evidence.lastEvaluated)}, ${submissionPhrase(evidence.submissionCount)}.`;
}

function regionalSentence(signal: RegionalSignal): string {
  if (signal.kind === "CURATED_CONTEXT") {
    return `Regional context deserves review. ${signal.frequencySummary}`;
  }
  if (signal.flagged) return `Regional evidence deserves review. ${signal.reason}`;
  return signal.kind === "NONE" ? signal.frequencySummary : signal.reason;
}

/** Full sentence, so subject and verb agree for every count. */
function recordSentence(patients: PatientRecord[], material: boolean): string {
  const count = patients.length;
  if (count === 0) return "No synthetic records carry this variant.";
  const subject =
    count === 1 ? "One synthetic record carries this variant" : `${count} synthetic records carry this variant`;
  if (!material) return `${subject}, and nothing is raised for ${count === 1 ? "it" : "them"}.`;

  const unreviewed = patients.filter((p) => p.reviewState === "Not reviewed").length;
  if (unreviewed === count) {
    return `${subject}, ${count === 1 ? "not" : "none"} reassessed since the original report.`;
  }
  const states = [...new Set(patients.map((p) => p.reviewState.toLowerCase()))].join(" or ");
  return `${subject}; the record system marks ${count === 1 ? "it" : "them"} ${states}.`;
}

export function composeEvidenceSummary(input: SummaryInput): string {
  const {
    variant,
    evidence,
    mode,
    recordedCode,
    currentCode,
    changeType,
    regionalSignal,
    impactedPatients,
  } = input;

  const after = meta(currentCode);
  const sentences: string[] = [
    historicalSentence(variant, recordedCode),
    currentSentence(evidence, mode),
  ];

  switch (changeType) {
    case "CLASSIFICATION_DRIFT":
      sentences.push(
        after.band === "pathogenic"
          ? "That crosses into the clinically actionable band, so guidance issued on the earlier reading may no longer be the right guidance."
          : "That moves the variant out of the clinically actionable band, so surveillance or management started on the earlier reading may no longer be indicated.",
      );
      break;

    case "EVIDENCE_STRENGTHENED":
      sentences.push(
        "The clinical band is unchanged; the evidence has moved further toward pathogenicity.",
      );
      break;

    case "EVIDENCE_WEAKENED":
      sentences.push(
        "The evidence now favours a more benign reading than the one on record. Where the earlier result prompted further testing or follow-up, that basis may no longer apply.",
      );
      break;

    case "CONSENSUS_CONFLICT":
      sentences.push(
        "Submitters now disagree rather than resolving to a single classification. A conflicting record is not a benign one, and it is not a pathogenic one.",
      );
      break;

    case "REGIONAL_CONFLICT":
      sentences.push("The global classification has not changed since the record was issued.");
      break;

    default:
      sentences.push(
        "That is the same clinical reading as the record, so no reclassification has occurred and no case is opened.",
      );
      break;
  }

  sentences.push(regionalSentence(regionalSignal));
  sentences.push(recordSentence(impactedPatients, changeType !== "NO_MATERIAL_CHANGE"));

  return sentences.join(" ");
}

/**
 * A single-line reason for the review queue. Deliberately terse — the queue is
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
      return `${gene} regional evidence deserves review`;
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
      return `Manual review recommended: regional evidence differs from the global reference, and VariantPulse does not rank one above the other. Frequency is evidence to weigh, not a classification; a clinician should weigh it against the patient context.`;
    case "CONSENSUS_CONFLICT":
      return `Manual review recommended: no single consensus classification is available. Consider requesting a specialist opinion before altering any guidance.`;
    case "EVIDENCE_STRENGTHENED":
      return `Confirm whether the strengthened evidence changes management for ${records}. The clinical band is unchanged.`;
    case "EVIDENCE_WEAKENED":
      return `Review whether follow-up driven by the original interpretation is still indicated for ${records}.`;
    default:
      return "No action required. Current evidence agrees with the interpretation on record.";
  }
}
