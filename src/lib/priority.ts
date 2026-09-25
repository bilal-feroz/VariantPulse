/**
 * Review priority.
 *
 * This ranks how urgently a human should look at an evidence change. It is a
 * workflow triage signal, not a clinical risk score, and it says nothing about
 * any individual patient's likelihood of disease. Every level is derived from
 * the factors listed alongside it so a reviewer can audit the ranking.
 */

import type { ChangeType, ClassificationCode } from "./classification";
import { meta } from "./classification";

export type PriorityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface PriorityMeta {
  level: PriorityLevel;
  label: string;
  /** What this level means for the review queue. */
  guidance: string;
  tone: "critical" | "warning" | "neutral" | "muted";
}

export const PRIORITIES: Record<PriorityLevel, PriorityMeta> = {
  CRITICAL: {
    level: "CRITICAL",
    label: "Critical",
    guidance: "Actionable reclassification affecting several records on file.",
    tone: "critical",
  },
  HIGH: {
    level: "HIGH",
    label: "High",
    guidance: "Reclassification that changes what a clinical team would act on.",
    tone: "critical",
  },
  MEDIUM: {
    level: "MEDIUM",
    label: "Medium",
    guidance: "Sources disagree, or evidence shifted without changing the band.",
    tone: "warning",
  },
  LOW: {
    level: "LOW",
    label: "Low",
    guidance: "Evidence moved toward benign, or was updated without material effect.",
    tone: "muted",
  },
};

export interface PriorityFactor {
  label: string;
  detail: string;
  /** Contribution to the ordering score. */
  weight: number;
}

export interface PriorityAssessment {
  level: PriorityLevel;
  score: number;
  factors: PriorityFactor[];
}

export interface PriorityInput {
  changeType: ChangeType;
  recorded: ClassificationCode;
  current: ClassificationCode;
  /** Records on file that carry this variant. */
  impactedRecords: number;
  /** Set when regional evidence disagrees with the global consensus. */
  regionalConflict?: boolean;
  /** 0-4 review confidence of the current classification. */
  confidenceStars?: number;
}

/** Records on file at or above which an actionable drift is escalated. */
const MULTI_RECORD_THRESHOLD = 3;

export function assessPriority(input: PriorityInput): PriorityAssessment {
  const {
    changeType,
    recorded,
    current,
    impactedRecords,
    regionalConflict = false,
    confidenceStars = 0,
  } = input;

  const factors: PriorityFactor[] = [];
  let score = 0;

  const movedIntoActionable =
    meta(recorded).band !== "pathogenic" && meta(current).band === "pathogenic";
  const movedOutOfActionable =
    meta(recorded).band === "pathogenic" && meta(current).band !== "pathogenic";

  if (movedIntoActionable) {
    score += 60;
    factors.push({
      label: "Moved into the actionable band",
      detail: `${meta(recorded).label} to ${meta(current).label}.`,
      weight: 60,
    });
  } else if (movedOutOfActionable) {
    score += 45;
    factors.push({
      label: "Moved out of the actionable band",
      detail: `${meta(recorded).label} to ${meta(current).label}. Earlier guidance may no longer apply.`,
      weight: 45,
    });
  }

  if (changeType === "EVIDENCE_STRENGTHENED") {
    score += 20;
    factors.push({
      label: "Evidence strengthened",
      detail: "Current evidence supports the interpretation more firmly than before.",
      weight: 20,
    });
  }

  if (changeType === "EVIDENCE_WEAKENED" && !movedOutOfActionable) {
    score += 10;
    factors.push({
      label: "Evidence weakened",
      detail: "Current evidence favours a more benign reading than the one on record.",
      weight: 10,
    });
  }

  if (changeType === "CONSENSUS_CONFLICT") {
    score += 30;
    factors.push({
      label: "Submitters disagree",
      detail: "No single consensus classification is available.",
      weight: 30,
    });
  }

  if (regionalConflict) {
    score += 30;
    factors.push({
      label: "Regional evidence conflicts",
      detail: "Regional and global sources reach different conclusions.",
      weight: 30,
    });
  }

  if (impactedRecords > 0) {
    const weight = Math.min(25, impactedRecords * 5);
    score += weight;
    factors.push({
      label: `${impactedRecords} record${impactedRecords === 1 ? "" : "s"} on file`,
      detail: "Historical results carrying this variant that a reviewer would reassess.",
      weight,
    });
  }

  if (confidenceStars >= 3) {
    score += 10;
    factors.push({
      label: "High review confidence",
      detail: "The current classification carries expert-panel or guideline review.",
      weight: 10,
    });
  } else if (confidenceStars <= 1) {
    score -= 5;
    factors.push({
      label: "Limited review confidence",
      detail: "The current classification rests on a narrow submission base.",
      weight: -5,
    });
  }

  let level: PriorityLevel;
  if (movedIntoActionable && impactedRecords >= MULTI_RECORD_THRESHOLD) {
    level = "CRITICAL";
  } else if (movedIntoActionable || movedOutOfActionable) {
    level = "HIGH";
  } else if (
    regionalConflict ||
    changeType === "CONSENSUS_CONFLICT" ||
    changeType === "EVIDENCE_STRENGTHENED"
  ) {
    level = "MEDIUM";
  } else {
    level = "LOW";
  }

  return { level, score, factors };
}

const ORDER: Record<PriorityLevel, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

/** Sorts by level first, then by score so ties resolve deterministically. */
export function comparePriority(
  a: { priority: PriorityAssessment },
  b: { priority: PriorityAssessment },
): number {
  const byLevel = ORDER[a.priority.level] - ORDER[b.priority.level];
  return byLevel !== 0 ? byLevel : b.priority.score - a.priority.score;
}
