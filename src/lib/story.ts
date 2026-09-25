/**
 * Picks the headline case for the home story from the analysis.
 *
 * The story is the highest-priority review case where a result reported as a
 * VUS now reads (likely) pathogenic. Nothing here is hard-coded to a variant,
 * so the story follows the dataset.
 */

import { meta, type ChangeType, type ClassificationCode } from "./classification";
import { comparePriority, type PriorityAssessment } from "./priority";

export interface StoryCandidate {
  recordedCode: ClassificationCode;
  currentCode: ClassificationCode;
  verdict: { type: ChangeType };
  priority: PriorityAssessment;
  requiresReview: boolean;
}

export function isHeadlineChange(a: StoryCandidate): boolean {
  return (
    a.requiresReview &&
    a.verdict.type === "CLASSIFICATION_DRIFT" &&
    a.recordedCode === "VUS" &&
    meta(a.currentCode).band === "pathogenic"
  );
}

export function selectStoryAssessment<T extends StoryCandidate>(assessments: readonly T[]): T | undefined {
  return assessments.filter(isHeadlineChange).sort(comparePriority)[0];
}
