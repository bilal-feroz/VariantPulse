/**
 * Serialisable shapes shared between the server engine and the client.
 *
 * The analysis holds a `Map` for record grouping, which cannot cross the
 * server/client boundary. Everything that has to reach a client component goes
 * through `serialiseAnalysis` first.
 */

import type { VariantAssessment, WorkspaceAnalysis, WorkspaceMetrics } from "./analysis";
import type { EvidenceMode } from "./clinvar";

export interface ClientAnalysis {
  mode: EvidenceMode;
  /** Present when a live read was attempted and failed. */
  reason?: string;
  checkedAt: string;
  sourceUpdatedAt: string | null;
  generatedAt: string;
  metrics: WorkspaceMetrics;
  scan: {
    findingsChecked: number;
    monitoredFindings: number;
    distinctVariants: number;
  };
  assessments: VariantAssessment[];
  changeKeys: string[];
  regionalConflictKeys: string[];
  reviewableKeys: string[];
}

export function serialiseAnalysis(analysis: WorkspaceAnalysis): ClientAnalysis {
  return {
    mode: analysis.evidence.mode,
    reason: analysis.evidence.reason,
    checkedAt: analysis.evidence.checkedAt,
    sourceUpdatedAt: analysis.evidence.sourceUpdatedAt,
    generatedAt: analysis.generatedAt,
    metrics: analysis.metrics,
    scan: {
      findingsChecked: analysis.scan.findingsChecked,
      monitoredFindings: analysis.scan.monitoredFindings,
      distinctVariants: analysis.scan.distinctVariants,
    },
    assessments: analysis.assessments,
    changeKeys: analysis.changes.map((a) => a.variant.key),
    regionalConflictKeys: analysis.regionalConflicts.map((a) => a.variant.key),
    reviewableKeys: analysis.reviewable.map((a) => a.variant.key),
  };
}

export function pick(analysis: ClientAnalysis, keys: string[]): VariantAssessment[] {
  const byKey = new Map(analysis.assessments.map((a) => [a.variant.key, a]));
  return keys.map((k) => byKey.get(k)).filter((a): a is VariantAssessment => Boolean(a));
}
