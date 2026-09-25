/**
 * The engine.
 *
 * One pass over the synthetic record set produces everything the interface
 * renders: which interpretations moved, which records carry them, what the
 * regional evidence says, and what a reviewer should look at first.
 *
 * The whole pass is deterministic. Given the same records and the same
 * evidence payload it always returns the same result, and every verdict
 * carries the reasoning that produced it.
 */

import "server-only";

import {
  assessRegionalSignal,
  detectChange,
  meta,
  normaliseClassification,
  regionalStatement,
  reviewConfidence,
  type ChangeType,
  type ChangeVerdict,
  type ClassificationCode,
  type RegionalSignal,
  type ReviewConfidence,
} from "./classification";
import { assessPriority, comparePriority, type PriorityAssessment } from "./priority";
import { scanCorpus, type CorpusScan } from "./corpus";
import {
  fetchCurrentEvidence,
  type EvidenceMode,
  type EvidenceRecord,
  type EvidenceResult,
} from "./clinvar";
import { PROVENANCE_BY_KEY, type ReleaseClassification } from "@/data/provenance";
import { REGIONAL_BY_KEY, type RegionalEvidence } from "@/data/regional";
import {
  MONITORED_VARIANTS,
  patientsForVariant,
  type MonitoredVariant,
  type PatientRecord,
} from "@/data/workspace";
import { composeEvidenceSummary } from "./narrative";
import { formatDate } from "./utils";

export interface PipelineStep {
  label: string;
  detail: string;
}

export interface VariantAssessment {
  variant: MonitoredVariant;
  evidence: EvidenceRecord;
  /** Whether `evidence` was read live or served from the verified snapshot. */
  evidenceMode: EvidenceMode;
  /** ClinVar's classification in each archived release the dataset records, oldest first. */
  releaseHistory: ReleaseClassification[];
  recordedCode: ClassificationCode;
  currentCode: ClassificationCode;
  verdict: ChangeVerdict;
  /**
   * What the interface leads with. A global reclassification always leads;
   * regional evidence heads the case only when the global reading has not moved.
   */
  changeType: ChangeType;
  confidence: ReviewConfidence;
  regional: RegionalEvidence | null;
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
  /** Synthetic patient records walked by the scan. */
  findingsMonitored: number;
  /** Global reclassifications: drift, strengthened or weakened evidence. */
  evidenceChanges: number;
  /** Synthetic records on a variant with an open review case. */
  patientsImpacted: number;
  /** Variants whose regional evidence is flagged for review. */
  regionalConflicts: number;
  consensusConflicts: number;
  /** Variants whose classification has not materially changed. */
  unchanged: number;
  openCases: number;
}

export interface WorkspaceAnalysis {
  evidence: EvidenceResult;
  scan: CorpusScan;
  assessments: VariantAssessment[];
  /** Global reclassifications, highest priority first. */
  changes: VariantAssessment[];
  /** Variants whose regional evidence is flagged for review. */
  regionalConflicts: VariantAssessment[];
  /** Everything that opens a review case, highest priority first. */
  reviewable: VariantAssessment[];
  metrics: WorkspaceMetrics;
  generatedAt: string;
}

const RECLASSIFICATIONS: ChangeType[] = [
  "CLASSIFICATION_DRIFT",
  "EVIDENCE_STRENGTHENED",
  "EVIDENCE_WEAKENED",
];

function historicalDetail(variant: MonitoredVariant): string {
  const label = `${variant.gene} ${variant.hgvsCoding}`;
  if (variant.historicalSource.kind === "modelled-report") {
    return `${label} was not in ClinVar in January 2023. The synthetic hospital reported it as ${meta(variant.historicalClassification).label.toLowerCase()} on ${formatDate(variant.recordedOn)}; that modelled report is the interpretation on record.`;
  }
  return `ClinVar's ${variant.historicalSource.label} release classified ${label} as ${(variant.historicalClinvarText ?? meta(variant.historicalClassification).label).toLowerCase()} (${variant.historicalReviewStatus}).`;
}

function buildPipeline(input: {
  variant: MonitoredVariant;
  evidence: EvidenceRecord;
  verdict: ChangeVerdict;
  signal: RegionalSignal;
  impacted: number;
  scan: CorpusScan;
  mode: EvidenceMode;
  requiresReview: boolean;
}): PipelineStep[] {
  const { variant, evidence, verdict, signal, impacted, scan, mode, requiresReview } = input;

  return [
    {
      label: "Historical classification retrieved",
      detail: historicalDetail(variant),
    },
    {
      label: "Variant normalised",
      detail: `Resolved to ClinVar ${evidence.accession ?? evidence.clinvarId}${evidence.rsid ? ` (${evidence.rsid})` : ""} and keyed as ${variant.key}.`,
    },
    {
      label: "Current evidence retrieved",
      detail: `${mode === "live" ? "Read live from NCBI ClinVar" : "Served from the cached verified snapshot"}: ${evidence.classification}, ${evidence.reviewStatus}, last evaluated ${formatDate(evidence.lastEvaluated)}, ${evidence.submissionCount} submission${evidence.submissionCount === 1 ? "" : "s"}.`,
    },
    {
      label: "Classifications compared",
      detail: verdict.rationale.join(" "),
    },
    {
      label: "Regional evidence compared",
      detail: regionalStatement(signal),
    },
    {
      label: "Synthetic records scanned",
      detail: `${scan.findingsChecked.toLocaleString("en-US")} synthetic patient records checked; ${impacted} carr${impacted === 1 ? "ies" : "y"} this variant.`,
    },
    {
      label: "Evidence brief generated",
      detail: "Composed from the structured fields above by fixed templates. No model decides or phrases the verdict.",
    },
    requiresReview
      ? {
          label: "Human review requested",
          detail: "VariantPulse does not change any record. A clinician decides what happens next.",
        }
      : {
          label: "No review case opened",
          detail: "Nothing material has changed, so no case is raised and no one is interrupted.",
        },
  ];
}

function assessVariant(
  variant: MonitoredVariant,
  evidence: EvidenceRecord,
  scan: CorpusScan,
  mode: EvidenceMode,
): Omit<VariantAssessment, "caseId"> {
  const recordedCode = variant.historicalClassification;
  const currentCode = normaliseClassification(evidence.classification);
  const verdict = detectChange(recordedCode, currentCode);
  const confidence = reviewConfidence(evidence.reviewStatus);

  const regional = REGIONAL_BY_KEY.get(variant.key) ?? null;
  const regionalSignal = assessRegionalSignal(regional, variant, currentCode);

  const impactedPatients = patientsForVariant(variant.key);
  const impactedRecordCount = scan.byVariant.get(variant.key)?.length ?? impactedPatients.length;

  // A reclassification is the fact a reviewer must see first. Regional
  // evidence carries no classification of its own, so it only heads the case
  // when the global reading has not moved.
  const changeType: ChangeType =
    verdict.type === "NO_MATERIAL_CHANGE" && regionalSignal.flagged ? "REGIONAL_CONFLICT" : verdict.type;

  const priority = assessPriority({
    changeType,
    recorded: recordedCode,
    current: currentCode,
    impactedRecords: impactedRecordCount,
    regionalConflict: regionalSignal.flagged,
    confidenceStars: confidence.stars,
  });

  const requiresReview = changeType !== "NO_MATERIAL_CHANGE" && impactedRecordCount > 0;

  return {
    variant,
    evidence,
    evidenceMode: mode,
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
      mode,
      recordedCode,
      currentCode,
      changeType,
      confidence,
      regionalSignal,
      impactedPatients,
    }),
    pipeline: buildPipeline({
      variant,
      evidence,
      verdict,
      signal: regionalSignal,
      impacted: impactedRecordCount,
      scan,
      mode,
      requiresReview,
    }),
  };
}

/** Case identifiers are stable: same records, same evidence, same ids. */
function caseIdFor(index: number, year: number): string {
  return `VP-R-${year}-${String(index + 1).padStart(3, "0")}`;
}

/**
 * The analysis for a given evidence payload. Pure: the same evidence always
 * yields the same assessments, cases and counts, which is what lets the data
 * checks run the engine itself rather than a copy of its rules.
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

  const year = now.getUTCFullYear();
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

  const regionalConflicts = assessments
    .filter((a) => a.regionalSignal.flagged)
    .sort(comparePriority);
  const consensusConflicts = assessments.filter((a) => a.verdict.type === "CONSENSUS_CONFLICT");

  // A "change" is a global reclassification. Conflicts and regional signals
  // are counted separately because they describe disagreement, not movement.
  const changes = assessments
    .filter((a) => RECLASSIFICATIONS.includes(a.verdict.type))
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
      unchanged: assessments.filter((a) => a.verdict.type === "NO_MATERIAL_CHANGE").length,
      openCases: reviewable.length,
    },
    generatedAt: now.toISOString(),
  };
}

export async function analyseWorkspace(options?: { force?: boolean }): Promise<WorkspaceAnalysis> {
  return buildAnalysis(await fetchCurrentEvidence({ force: options?.force }));
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
