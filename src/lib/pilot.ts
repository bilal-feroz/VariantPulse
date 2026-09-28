/**
 * The silent pilot: how a partner evaluates VariantPulse on historical data
 * without any notification reaching a patient or any change to care.
 *
 * Two instruments, both pure and client-safe:
 *
 *  - A retrospective replay. ClinVar's archived releases are run against the
 *    classifications on record, checkpoint by checkpoint, so the pilot can see
 *    when each alert would first have fired. It uses the same deterministic
 *    engine as the live workspace and nothing else.
 *  - An evaluation. Independent reviewers label each alert, and each variant
 *    that raised nothing, against their own judgement; the metrics are
 *    computed from those labels and from timings recorded in the session.
 *
 * No number here is supplied: with nothing adjudicated, every metric reads as
 * not yet measured. Success criteria start unset, because they are agreed with
 * the partner, not assumed.
 */

import { CHANGE_TYPES, detectChange, type ChangeType, type ClassificationCode } from "./classification";
import type { ImportTotals } from "./onboarding";
import { MONITORED_VARIANTS, PATIENTS, type MonitoredVariant } from "@/data/workspace";
import { PROVENANCE_BY_KEY, type VariantProvenance } from "@/data/provenance";

/* -- Retrospective replay -------------------------------------------------- */

export interface Checkpoint {
  release: string;
  label: string;
}

export interface ReplayCell {
  release: string;
  /** Whether the dataset holds ClinVar's reading at this checkpoint. */
  captured: boolean;
  code: ClassificationCode | null;
  changeType: ChangeType | null;
  alert: boolean;
}

export interface ReplayRow {
  key: string;
  gene: string;
  hgvs: string;
  baseline: ClassificationCode;
  baselineSource: string;
  records: number;
  cells: ReplayCell[];
  firstAlert: { release: string; label: string; changeType: ChangeType } | null;
}

export interface Replay {
  baseline: Checkpoint;
  checkpoints: Checkpoint[];
  rows: ReplayRow[];
  /** Alerts that would be open at each checkpoint. */
  alertsAt: Record<string, number>;
  /** Records those alerts cover, at each checkpoint. */
  recordsAt: Record<string, number>;
}

const BASELINE: Checkpoint = { release: "2023-01", label: "Jan 2023" };

/**
 * Replays every archived ClinVar checkpoint after January 2023 against the
 * classification on record. A checkpoint the dataset does not hold for a
 * variant is left uncaptured rather than guessed. Regional evidence is not
 * part of the replay: it was read once, not release by release.
 */
export function replayReleases(
  variants: readonly MonitoredVariant[] = MONITORED_VARIANTS,
  provenance: Map<string, VariantProvenance> = PROVENANCE_BY_KEY,
): Replay {
  const carriers = new Map<string, number>();
  for (const patient of PATIENTS) carriers.set(patient.variantKey, (carriers.get(patient.variantKey) ?? 0) + 1);

  const labels = new Map<string, string>();
  for (const variant of variants) {
    for (const entry of provenance.get(variant.key)?.releases ?? []) {
      if (entry.release > BASELINE.release) labels.set(entry.release, entry.label);
    }
  }
  const checkpoints = [...labels.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([release, label]) => ({ release, label }));

  const rows: ReplayRow[] = variants.map((variant) => {
    const releases = new Map((provenance.get(variant.key)?.releases ?? []).map((r) => [r.release, r]));
    const records = carriers.get(variant.key) ?? 0;

    const cells: ReplayCell[] = checkpoints.map(({ release }) => {
      const entry = releases.get(release);
      if (!entry) return { release, captured: false, code: null, changeType: null, alert: false };
      const changeType = detectChange(variant.historicalClassification, entry.code ?? "NOT_PROVIDED").type;
      return {
        release,
        captured: true,
        code: entry.code,
        changeType,
        alert: CHANGE_TYPES[changeType].material && records > 0,
      };
    });

    const first = cells.find((cell) => cell.alert);
    return {
      key: variant.key,
      gene: variant.gene,
      hgvs: variant.hgvsCoding,
      baseline: variant.historicalClassification,
      baselineSource: variant.historicalSource.kind === "clinvar-release" ? "ClinVar Jan 2023" : "Hospital report",
      records,
      cells,
      firstAlert:
        first && first.changeType
          ? {
              release: first.release,
              label: labels.get(first.release) ?? first.release,
              changeType: first.changeType,
            }
          : null,
    };
  });

  const alertsAt: Record<string, number> = {};
  const recordsAt: Record<string, number> = {};
  for (const { release } of checkpoints) {
    const alerting = rows.filter((row) => row.cells.find((c) => c.release === release)?.alert);
    alertsAt[release] = alerting.length;
    recordsAt[release] = alerting.reduce((total, row) => total + row.records, 0);
  }

  return { baseline: BASELINE, checkpoints, rows, alertsAt, recordsAt };
}

/* -- Adjudication ---------------------------------------------------------- */

export type AdjudicationLabel = "relevant" | "not-relevant" | "duplicate" | "missed" | "correctly-silent";

export type Outcome = "TP" | "FP" | "DUP" | "FN" | "TN";

export const ADJUDICATION: Record<
  AdjudicationLabel,
  { label: string; description: string; outcome: Outcome; forAlert: boolean }
> = {
  relevant: {
    label: "Relevant alert",
    description: "A qualified reviewer would want this case raised.",
    outcome: "TP",
    forAlert: true,
  },
  "not-relevant": {
    label: "Not relevant",
    description: "The alert creates work without clinical value.",
    outcome: "FP",
    forAlert: true,
  },
  duplicate: {
    label: "Duplicate",
    description: "Repeats a change already raised or already known.",
    outcome: "DUP",
    forAlert: true,
  },
  missed: {
    label: "Missed change",
    description: "Nothing was raised, but a qualified reviewer would have wanted a case.",
    outcome: "FN",
    forAlert: false,
  },
  "correctly-silent": {
    label: "Correctly silent",
    description: "Nothing was raised, and nothing needed to be.",
    outcome: "TN",
    forAlert: false,
  },
};

export const ALERT_LABELS = (Object.keys(ADJUDICATION) as AdjudicationLabel[]).filter(
  (label) => ADJUDICATION[label].forAlert,
);
export const SILENT_LABELS = (Object.keys(ADJUDICATION) as AdjudicationLabel[]).filter(
  (label) => !ADJUDICATION[label].forAlert,
);

export interface Adjudication {
  variantKey: string;
  label: AdjudicationLabel;
  reviewer: string;
  at: string;
  note?: string;
  /** Labelled in this session, or loaded from a reference set. */
  source: "session" | "reference-set";
}

/* -- Evaluation ------------------------------------------------------------ */

export interface EvaluationInput {
  /** Variants VariantPulse raised a case on. */
  alertKeys: readonly string[];
  /** Monitored variants that raised nothing. */
  silentKeys: readonly string[];
  adjudications: Readonly<Record<string, Adjudication>>;
  /** Review opened to first decision, per decided case, in milliseconds. */
  reviewDurationsMs: readonly number[];
  importTotals: ImportTotals | null;
}

export interface Evaluation {
  counts: Record<Outcome, number>;
  adjudicated: number;
  /** Alerts and silent variants nobody has labelled yet. */
  pending: { alerts: number; silent: number };
  /** Labels that contradict what VariantPulse did (e.g. "missed" on an alert); ignored. */
  inconsistent: number;
  /** (TP + TN) / adjudicated. */
  agreement: number | null;
  /** TP / every adjudicated alert. */
  precision: number | null;
  missed: number;
  falseOrDuplicate: number;
  /** (FP + DUP) / every adjudicated alert. */
  falseOrDuplicateRate: number | null;
  medianReviewMs: number | null;
  reviewSamples: number;
  importTotals: ImportTotals | null;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function evaluate(input: EvaluationInput): Evaluation {
  const counts: Record<Outcome, number> = { TP: 0, FP: 0, DUP: 0, FN: 0, TN: 0 };
  const alerts = new Set(input.alertKeys);
  const silent = new Set(input.silentKeys);
  let inconsistent = 0;
  let labelledAlerts = 0;
  let labelledSilent = 0;

  for (const adjudication of Object.values(input.adjudications)) {
    const meta = ADJUDICATION[adjudication.label];
    const alerted = alerts.has(adjudication.variantKey);
    if (!alerted && !silent.has(adjudication.variantKey)) continue;
    if (meta.forAlert !== alerted) {
      inconsistent += 1;
      continue;
    }
    counts[meta.outcome] += 1;
    if (alerted) labelledAlerts += 1;
    else labelledSilent += 1;
  }

  const adjudicated = labelledAlerts + labelledSilent;
  const ratio = (numerator: number, denominator: number) =>
    denominator > 0 ? numerator / denominator : null;

  return {
    counts,
    adjudicated,
    pending: { alerts: alerts.size - labelledAlerts, silent: silent.size - labelledSilent },
    inconsistent,
    agreement: ratio(counts.TP + counts.TN, adjudicated),
    precision: ratio(counts.TP, labelledAlerts),
    missed: counts.FN,
    falseOrDuplicate: counts.FP + counts.DUP,
    falseOrDuplicateRate: ratio(counts.FP + counts.DUP, labelledAlerts),
    medianReviewMs: median(input.reviewDurationsMs),
    reviewSamples: input.reviewDurationsMs.length,
    importTotals: input.importTotals,
  };
}

/* -- Success criteria ------------------------------------------------------ */

/** Agreed with the partner before the silent run; unset until then. */
export interface SuccessCriteria {
  /** Minimum agreement with expert review, 0–1. */
  minAgreement: number | null;
  /** Most missed relevant changes tolerated. */
  maxMissed: number | null;
  /** Highest share of alerts that are false or duplicate, 0–1. */
  maxFalseOrDuplicateRate: number | null;
  /** Median minutes from opening a review to a documented decision. */
  maxMedianReviewMinutes: number | null;
  agreedWith: string | null;
}

export const UNSET_CRITERIA: SuccessCriteria = {
  minAgreement: null,
  maxMissed: null,
  maxFalseOrDuplicateRate: null,
  maxMedianReviewMinutes: null,
  agreedWith: null,
};

export type CriterionStatus = "not-agreed" | "not-measured" | "met" | "not-met";

export interface CriterionResult {
  key: keyof Omit<SuccessCriteria, "agreedWith">;
  label: string;
  target: string;
  observed: string;
  status: CriterionStatus;
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

export function criteriaResults(evaluation: Evaluation, criteria: SuccessCriteria): CriterionResult[] {
  const judge = (
    target: number | null,
    observed: number | null,
    passes: (observed: number, target: number) => boolean,
  ): CriterionStatus =>
    target === null ? "not-agreed" : observed === null ? "not-measured" : passes(observed, target) ? "met" : "not-met";

  const medianMinutes = evaluation.medianReviewMs === null ? null : evaluation.medianReviewMs / 60_000;
  const labelledAlerts = evaluation.counts.TP + evaluation.counts.FP + evaluation.counts.DUP;
  const silentLabelled = evaluation.counts.FN + evaluation.counts.TN;

  return [
    {
      key: "minAgreement",
      label: "Agreement with expert review",
      target: criteria.minAgreement === null ? "Not agreed" : `At least ${percent(criteria.minAgreement)}`,
      observed: evaluation.agreement === null ? "Not measured" : percent(evaluation.agreement),
      status: judge(criteria.minAgreement, evaluation.agreement, (o, t) => o >= t),
    },
    {
      key: "maxMissed",
      label: "Missed relevant changes",
      target: criteria.maxMissed === null ? "Not agreed" : `At most ${criteria.maxMissed}`,
      observed: silentLabelled === 0 ? "Not measured" : String(evaluation.missed),
      status: judge(criteria.maxMissed, silentLabelled === 0 ? null : evaluation.missed, (o, t) => o <= t),
    },
    {
      key: "maxFalseOrDuplicateRate",
      label: "False or duplicate alerts",
      target:
        criteria.maxFalseOrDuplicateRate === null
          ? "Not agreed"
          : `At most ${percent(criteria.maxFalseOrDuplicateRate)} of alerts`,
      observed:
        evaluation.falseOrDuplicateRate === null
          ? "Not measured"
          : `${percent(evaluation.falseOrDuplicateRate)} (${evaluation.falseOrDuplicate} of ${labelledAlerts})`,
      status: judge(criteria.maxFalseOrDuplicateRate, evaluation.falseOrDuplicateRate, (o, t) => o <= t),
    },
    {
      key: "maxMedianReviewMinutes",
      label: "Median review time per case",
      target:
        criteria.maxMedianReviewMinutes === null ? "Not agreed" : `At most ${criteria.maxMedianReviewMinutes} min`,
      observed: medianMinutes === null ? "Not measured" : formatMinutes(medianMinutes),
      status: judge(criteria.maxMedianReviewMinutes, medianMinutes, (o, t) => o <= t),
    },
  ];
}

export function formatMinutes(minutes: number): string {
  if (minutes < 1) return "under 1 min";
  if (minutes < 90) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  return hours < 48 ? `${hours.toFixed(1)} h` : `${Math.round(hours / 24)} days`;
}

/* -- Reference sets -------------------------------------------------------- */

/**
 * Turns an independently reviewed reference set into adjudications. Each row
 * names a variant (its key, or its ClinVar variation ID) and what the reviewers
 * expected: `alert`, `no alert` or `duplicate`. The label follows from
 * comparing that with what VariantPulse did. Rows naming a variant that is not
 * monitored are reported back, never guessed at.
 */
export function adjudicationsFromReference(
  rows: { variant: string; expected: string; reviewer?: string; note?: string; line?: number }[],
  alertKeys: readonly string[],
  at: string,
): { adjudications: Adjudication[]; problems: string[] } {
  const alerts = new Set(alertKeys);
  const byClinvar = new Map(MONITORED_VARIANTS.map((v) => [v.clinvarId, v.key]));
  const byKey = new Set(MONITORED_VARIANTS.map((v) => v.key));
  const adjudications: Adjudication[] = [];
  const problems: string[] = [];

  rows.forEach((row, index) => {
    const line = row.line ?? index + 2;
    const raw = row.variant.trim();
    const key = byKey.has(raw) ? raw : byClinvar.get(raw.replace(/^VCV0*/i, ""));
    if (!key) {
      problems.push(`Row ${line}: "${raw}" is not a monitored variant.`);
      return;
    }
    const expected = row.expected.trim().toLowerCase().replace(/[_-]+/g, " ");
    const alerted = alerts.has(key);
    let label: AdjudicationLabel;
    if (expected === "duplicate") {
      if (!alerted) {
        problems.push(`Row ${line}: ${key} raised no alert, so it cannot be a duplicate.`);
        return;
      }
      label = "duplicate";
    } else if (expected === "alert" || expected === "yes") {
      label = alerted ? "relevant" : "missed";
    } else if (expected === "no alert" || expected === "no") {
      label = alerted ? "not-relevant" : "correctly-silent";
    } else {
      problems.push(`Row ${line}: expected "${row.expected}" is not one of alert, no alert, duplicate.`);
      return;
    }
    adjudications.push({
      variantKey: key,
      label,
      reviewer: row.reviewer?.trim() || "Reference panel",
      at,
      note: row.note?.trim() || undefined,
      source: "reference-set",
    });
  });

  return { adjudications, problems };
}
