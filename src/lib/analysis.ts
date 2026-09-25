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
  meta,
  normaliseClassification,
  reviewConfidence,
  assessRegionalSignal,
  type ChangeType,
  type ChangeVerdict,
  type ClassificationCode,
  type ReviewConfidence,
  type RegionalSignal,
} from "./classification";
import { assessPriority, comparePriority, type PriorityAssessment } from "./priority";
import { scanCorpus, type CorpusScan } from "./corpus";
import {
  fetchCurrentEvidence,
  type EvidenceRecord,
  type EvidenceResult,
  type RequestedEvidenceMode,
} from "./clinvar";
import { REGIONAL_BY_KEY, REGIONAL_SOURCE } from "@/data/regional";
import { PROVENANCE_BY_KEY, type ReleaseClassification } from "@/data/provenance";
import { regionalView, type RegionalView } from "@/lib/regional-view";
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

export interface VariantAssessment {
  variant: MonitoredVariant;
  evidence: EvidenceRecord;
  /** ClinVar's reading at each archived release, oldest first. */
  releaseHistory: ReleaseClassification[];
  recordedCode: ClassificationCode;
  currentCode: ClassificationCode;
  verdict: ChangeVerdict;
  /** What the interface leads with. Regional conflict outranks a global shift. */
  changeType: ChangeType;
  confidence: ReviewConfidence;
  regional: RegionalView | null;
  regionalSignal: RegionalSignal;
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
  regional: RegionalView | null;
  signal: RegionalSignal;
  impacted: number;
  scan: CorpusScan;
  mode: EvidenceResult["mode"];
}): PipelineStep[] {
  const { variant, evidence, verdict, regional, signal, impacted, scan, mode } = input;

  return [
    {
      label: "Historical record retrieved",
      detail: `${variant.gene} ${variant.hgvsCoding} reported as ${meta(variant.historicalClassification).label} on ${variant.recordedOn}.`,
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
        ? `${REGIONAL_SOURCE.catalogueShortName} records it as ${meta(regional.assertion).label.toLowerCase()}. ${signal.reason}`
        : signal.frequencySummary,
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
  const recordedCode = variant.historicalClassification;
  const currentCode = normaliseClassification(evidence.classification);
  const verdict = detectChange(recordedCode, currentCode);
  const confidence = reviewConfidence(evidence.reviewStatus);

  const regionalEvidence = REGIONAL_BY_KEY.get(variant.key) ?? null;
  const regional = regionalView(regionalEvidence);
  const regionalSignal = assessRegionalSignal(regionalEvidence, variant, currentCode);

  const impactedPatients = patientsForVariant(variant.key);
  const impactedRecordCount = scan.byVariant.get(variant.key)?.length ?? impactedPatients.length;

  // Regional conflict is what a reviewer needs to see first, so it takes the
  // headline even when the global reading also moved.
  const changeType: ChangeType = regionalSignal.flagged
    ? "REGIONAL_CONFLICT"
    : verdict.type;

  const priority = assessPriority({
    changeType,
    recorded: recordedCode,
    current: currentCode,
    impactedRecords: impactedRecordCount,
    regionalConflict: Boolean(regionalSignal.flagged),
    confidenceStars: confidence.stars,
  });

  const requiresReview =
    changeType !== "NO_MATERIAL_CHANGE" && impactedRecordCount > 0;

  return {
    variant,
    evidence,
    releaseHistory: PROVENANCE_BY_KEY.get(variant.key)?.releases ?? [],
    recordedCode,
    currentCode,
    verdict,
    changeType,
    confidence,
    regional,
    regionalSignal,
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
      signal: regionalSignal,
      impactedRecordCount,
    }),
    pipeline: buildPipeline({
      variant,
      evidence,
      verdict,
      regional,
      signal: regionalSignal,
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

/**
 * The analysis itself, as a pure function of an evidence read.
 *
 * Kept separate from the fetch so the same engine that renders the workspace
 * can be run against the bundled snapshot by `verify:data`, with no network
 * and a fixed clock.
 */
export function buildAnalysis(evidence: EvidenceResult, now: Date = new Date()): WorkspaceAnalysis {
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

  const regionalConflicts = assessments.filter((a) => a.regionalSignal.flagged);
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
    .filter((a) => !a.regionalSignal.flagged)
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
    generatedAt: evidence.mode === "demo" ? evidence.checkedAt : now.toISOString(),
  };
}


/** Reads current evidence, then runs the analysis over it. */
export async function analyseWorkspace(options?: {
  force?: boolean;
  mode?: RequestedEvidenceMode;
}): Promise<WorkspaceAnalysis> {
  const evidence = await fetchCurrentEvidence({ force: options?.force, mode: options?.mode });
  return buildAnalysis(evidence);
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
