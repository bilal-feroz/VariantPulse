/**
 * The engine.
 *
 * One pass over the record corpus produces everything the interface renders:
 * which interpretations moved, which records carry them, where regional and
 * global evidence disagree, and what a reviewer should look at first.
 *
 * The whole pass is deterministic. Given the same corpus and the same evidence
 * payload it always returns the same result, and every verdict carries the
 * reasoning that produced it.
 */

import "server-only";

import {
  detectChange,
  detectDisagreement,
  meta,
  normaliseClassification,
  reviewConfidence,
  type ChangeType,
  type ChangeVerdict,
  type ClassificationCode,
  type ReviewConfidence,
} from "./classification";
import { assessPriority, comparePriority, type PriorityAssessment } from "./priority";
import { scanCorpus, type CorpusScan } from "./corpus";
import {
  fetchCurrentEvidence,
  type EvidenceRecord,
  type EvidenceResult,
  type RequestedEvidenceMode,
} from "./clinvar";
import { REGIONAL_BY_KEY, type RegionalEvidence } from "@/data/regional";
import {
  MONITORED_VARIANTS,
  patientsForVariant,
  type MonitoredVariant,
  type PatientRecord,
} from "@/data/workspace";
import { composeEvidenceSummary } from "./narrative";
import { EVIDENCE_MODES } from "./evidence-mode";

export interface PipelineStep {
  label: string;
  detail: string;
}

export interface RegionalDisagreement {
  conflicting: boolean;
  severity: "none" | "moderate" | "high";
  reason: string;
  globalCode: ClassificationCode;
  regionalCode: ClassificationCode;
}

export interface VariantAssessment {
  variant: MonitoredVariant;
  evidence: EvidenceRecord;
  recordedCode: ClassificationCode;
  currentCode: ClassificationCode;
  verdict: ChangeVerdict;
  /** What the interface leads with. Regional conflict outranks a global shift. */
  changeType: ChangeType;
  confidence: ReviewConfidence;
  regional: RegionalEvidence | null;
  regionalDisagreement: RegionalDisagreement | null;
  impactedPatients: PatientRecord[];
  impactedRecordCount: number;
  priority: PriorityAssessment;
  /** True when this assessment opens a clinical review case. */
  requiresReview: boolean;
  caseId: string | null;
  summary: string;
  pipeline: PipelineStep[];
}

export interface WorkspaceMetrics {
  findingsMonitored: number;
  evidenceChanges: number;
  patientsImpacted: number;
  regionalConflicts: number;
  consensusConflicts: number;
  unchanged: number;
  openCases: number;
}

export interface WorkspaceAnalysis {
  evidence: EvidenceResult;
  scan: CorpusScan;
  assessments: VariantAssessment[];
  /** Material global changes, highest priority first. */
  changes: VariantAssessment[];
  regionalConflicts: VariantAssessment[];
  /** Everything that opens a review case, highest priority first. */
  reviewable: VariantAssessment[];
  metrics: WorkspaceMetrics;
  generatedAt: string;
}

function buildPipeline(input: {
  variant: MonitoredVariant;
  evidence: EvidenceRecord;
  verdict: ChangeVerdict;
  regional: RegionalEvidence | null;
  disagreement: RegionalDisagreement | null;
  impacted: number;
  scan: CorpusScan;
  mode: EvidenceResult["mode"];
}): PipelineStep[] {
  const { variant, evidence, verdict, regional, disagreement, impacted, scan, mode } = input;

  return [
    {
      label: "Historical record retrieved",
      detail: `${variant.gene} ${variant.hgvsCoding} reported as ${meta(variant.recordedClassification).label} on ${variant.recordedOn}.`,
    },
    {
      label: "Variant normalised",
      detail: `Resolved to ClinVar ${evidence.accession ?? evidence.clinvarId}${evidence.rsid ? ` (${evidence.rsid})` : ""} and keyed as ${variant.key}.`,
    },
    {
      label: "Current evidence retrieved",
      detail: `${EVIDENCE_MODES[mode].pipelineSource}: ${evidence.classification}, ${evidence.submissionCount} submission${evidence.submissionCount === 1 ? "" : "s"}, ${evidence.reviewStatus}.`,
    },
    {
      label: "Classification difference detected",
      detail: verdict.rationale.join(" "),
    },
    {
      label: "Regional sources compared",
      detail: regional
        ? disagreement?.conflicting
          ? `Regional index asserts ${meta(regional.assertion).label} across ${regional.observations} observations. ${disagreement.reason}`
          : `Regional index asserts ${meta(regional.assertion).label}, consistent with the global reading.`
        : "No regional evidence is held for this variant.",
    },
    {
      label: "Impacted records identified",
      detail: `${scan.findingsChecked.toLocaleString("en-US")} findings checked; ${impacted} carr${impacted === 1 ? "ies" : "y"} this variant.`,
    },
    {
      label: "Evidence brief generated",
      detail: "Composed from the structured fields of the cited records above.",
    },
    {
      label: "Human review requested",
      detail: "VariantPulse does not change any record. A clinician decides what happens next.",
    },
  ];
}

function assessVariant(
  variant: MonitoredVariant,
  evidence: EvidenceRecord,
  scan: CorpusScan,
  mode: EvidenceResult["mode"],
): Omit<VariantAssessment, "caseId"> {
  const recordedCode = variant.recordedClassification;
  const currentCode = normaliseClassification(evidence.classification);
  const verdict = detectChange(recordedCode, currentCode);
  const confidence = reviewConfidence(evidence.reviewStatus);

  const regional = REGIONAL_BY_KEY.get(variant.key) ?? null;
  const raw = regional ? detectDisagreement(currentCode, regional.assertion) : null;
  const regionalDisagreement: RegionalDisagreement | null =
    regional && raw
      ? { ...raw, globalCode: currentCode, regionalCode: regional.assertion }
      : null;

  const impactedPatients = patientsForVariant(variant.key);
  const impactedRecordCount = scan.byVariant.get(variant.key)?.length ?? impactedPatients.length;

  // Regional conflict is what a reviewer needs to see first, so it takes the
  // headline even when the global reading also moved.
  const changeType: ChangeType = regionalDisagreement?.conflicting
    ? "REGIONAL_CONFLICT"
    : verdict.type;

  const priority = assessPriority({
    changeType,
    recorded: recordedCode,
    current: currentCode,
    impactedRecords: impactedRecordCount,
    regionalConflict: Boolean(regionalDisagreement?.conflicting),
    confidenceStars: confidence.stars,
  });

  const requiresReview =
    changeType !== "NO_MATERIAL_CHANGE" && impactedRecordCount > 0;

  return {
    variant,
    evidence,
    recordedCode,
    currentCode,
    verdict,
    changeType,
    confidence,
    regional,
    regionalDisagreement,
    impactedPatients,
    impactedRecordCount,
    priority,
    requiresReview,
    summary: composeEvidenceSummary({
      variant,
      evidence,
      recordedCode,
      currentCode,
      changeType,
      confidence,
      regional,
      disagreement: regionalDisagreement,
      impactedRecordCount,
    }),
    pipeline: buildPipeline({
      variant,
      evidence,
      verdict,
      regional,
      disagreement: regionalDisagreement,
      impacted: impactedRecordCount,
      scan,
      mode,
    }),
  };
}

/** Case identifiers are stable: same corpus, same evidence, same ids. */
function caseIdFor(index: number, year: number): string {
  return `VP-R-${year}-${String(index + 1).padStart(3, "0")}`;
}

export async function analyseWorkspace(options?: {
  force?: boolean;
  mode?: RequestedEvidenceMode;
}): Promise<WorkspaceAnalysis> {
  const evidence = await fetchCurrentEvidence({ force: options?.force, mode: options?.mode });
  const scan = scanCorpus();

  const partial = MONITORED_VARIANTS.map((variant) => {
    const record = evidence.records[variant.key];
    return record ? assessVariant(variant, record, scan, evidence.mode) : null;
  }).filter((a): a is Omit<VariantAssessment, "caseId"> => a !== null);

  const reviewableSorted = partial
    .filter((a) => a.requiresReview)
    .sort(comparePriority);

  // Derived from the evidence read, so demo mode yields the same ids on every run.
  const year = new Date(evidence.checkedAt).getUTCFullYear();
  const caseIds = new Map<string, string>();
  reviewableSorted.forEach((assessment, index) => {
    caseIds.set(assessment.variant.key, caseIdFor(index, year));
  });

  const assessments: VariantAssessment[] = partial.map((a) => ({
    ...a,
    caseId: caseIds.get(a.variant.key) ?? null,
  }));

  const byKey = new Map(assessments.map((a) => [a.variant.key, a]));
  const reviewable = reviewableSorted
    .map((a) => byKey.get(a.variant.key))
    .filter((a): a is VariantAssessment => Boolean(a));

  const regionalConflicts = assessments.filter((a) => a.regionalDisagreement?.conflicting);
  const consensusConflicts = assessments.filter((a) => a.verdict.type === "CONSENSUS_CONFLICT");

  // A "change" is a global reclassification. Conflicts are counted separately
  // because they describe disagreement, not movement.
  const changes = assessments
    .filter(
      (a) =>
        a.verdict.type === "CLASSIFICATION_DRIFT" ||
        a.verdict.type === "EVIDENCE_STRENGTHENED" ||
        a.verdict.type === "EVIDENCE_WEAKENED",
    )
    .filter((a) => !a.regionalDisagreement?.conflicting)
    .sort(comparePriority);

  const impactedIds = new Set<string>();
  for (const assessment of assessments) {
    if (!assessment.requiresReview) continue;
    for (const patient of assessment.impactedPatients) impactedIds.add(patient.id);
  }

  return {
    evidence,
    scan,
    assessments,
    changes,
    regionalConflicts,
    reviewable,
    metrics: {
      findingsMonitored: scan.findingsChecked,
      evidenceChanges: changes.length,
      patientsImpacted: impactedIds.size,
      regionalConflicts: regionalConflicts.length,
      consensusConflicts: consensusConflicts.length,
      unchanged: assessments.filter((a) => a.changeType === "NO_MATERIAL_CHANGE").length,
      openCases: reviewable.length,
    },
    generatedAt: evidence.mode === "demo" ? evidence.checkedAt : new Date().toISOString(),
  };
}

/** Looks up a single assessment by variant key. */
export async function assessmentFor(variantKey: string): Promise<VariantAssessment | null> {
  const analysis = await analyseWorkspace();
  return analysis.assessments.find((a) => a.variant.key === variantKey) ?? null;
}

/** Looks up a single assessment by its review case identifier. */
export async function assessmentForCase(caseId: string): Promise<VariantAssessment | null> {
  const analysis = await analyseWorkspace();
  return analysis.assessments.find((a) => a.caseId === caseId) ?? null;
}
