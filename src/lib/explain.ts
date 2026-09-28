/**
 * "What changed?": the facts behind an alert, laid out so a reviewer can check
 * each one against its source.
 *
 * Two things are kept apart throughout. What the source reported, ClinVar's
 * classification then and now in its own words and with links, is evidence.
 * What VariantPulse made of it, the change type and the review priority, is
 * inference, and every surface that shows it says so.
 *
 * Client-safe and pure: everything is read from the assessment and the
 * evidence read that produced it.
 */

import type { VariantAssessment } from "./analysis";
import type { ClassificationCode, Tone } from "./classification";
import { meta } from "./classification";
import type { ClientAnalysis } from "./dto";
import { EVIDENCE_MODES } from "./evidence-mode";
import { panelTranscript } from "./hgvs";
import { formatDate, formatMonth } from "./utils";
import { REGIONAL_BY_KEY, REGIONAL_SOURCE } from "@/data/regional";

/** The parts of an analysis that describe the evidence read, not the variants. */
export type EvidenceRead = Pick<
  ClientAnalysis,
  "mode" | "reason" | "checkedAt" | "lastLiveReadAt" | "snapshot" | "snapshotDrift"
>;

/* -- The source's own statement ------------------------------------------- */

export interface Reading {
  code: ClassificationCode | null;
  /** The classification in the source's own words. */
  wording: string;
  source: string;
  reviewStatus: string | null;
  /** What the date is: a release, an evaluation, a report. */
  dateLabel: string;
  href: string | null;
  hrefLabel: string | null;
}

export interface SourceChange {
  then: Reading;
  now: Reading;
  /** ClinVar's reading at each archived checkpoint, oldest first. */
  trajectory: VariantAssessment["releaseHistory"];
  changed: boolean;
}

export function clinvarUrl(clinvarId: string): string {
  return `https://www.ncbi.nlm.nih.gov/clinvar/variation/${clinvarId}/`;
}

export function sourceChange(assessment: VariantAssessment): SourceChange {
  const { variant, evidence } = assessment;
  const history = variant.historicalSource;
  const fromClinvar = history.kind === "clinvar-release";

  return {
    then: {
      code: variant.historicalClassification,
      wording: variant.historicalClinvarText ?? `${meta(variant.historicalClassification).label} (hospital report)`,
      source: fromClinvar ? `ClinVar, ${history.label} release` : "Hospital report; not in ClinVar at the time",
      reviewStatus: variant.historicalReviewStatus,
      dateLabel: fromClinvar
        ? `Archived release ${history.release}`
        : `Reported ${formatDate(variant.recordedOn)}`,
      href: history.url,
      hrefLabel: history.file,
    },
    now: {
      code: assessment.currentCode,
      wording: evidence.classification,
      source: "ClinVar",
      reviewStatus: evidence.reviewStatus,
      dateLabel: evidence.lastEvaluated
        ? `Last evaluated ${formatDate(evidence.lastEvaluated)}`
        : "Evaluation date not recorded",
      href: clinvarUrl(evidence.clinvarId),
      hrefLabel: evidence.accession ?? `VCV${evidence.clinvarId}`,
    },
    trajectory: assessment.releaseHistory,
    changed: assessment.recordedCode !== assessment.currentCode,
  };
}

/** The first archived checkpoint whose reading differs from the one on record. */
export function firstVisibleChange(assessment: VariantAssessment): { release: string; label: string } | null {
  const baseline = assessment.variant.historicalSource.release;
  for (const entry of assessment.releaseHistory) {
    if (baseline && entry.release <= baseline) continue;
    if (entry.code !== null && entry.code !== assessment.recordedCode) {
      return { release: entry.release, label: entry.label };
    }
  }
  return null;
}

/* -- Conflicts and limitations -------------------------------------------- */

export interface Limitation {
  kind: "conflict" | "evidence" | "data" | "method";
  text: string;
}

export const LIMITATION_LABEL: Record<Limitation["kind"], string> = {
  conflict: "Conflict",
  evidence: "Evidence",
  data: "Data",
  method: "Method",
};

/**
 * What a reviewer should hold in mind before relying on this alert, drawn only
 * from the fields on the assessment and the evidence read.
 */
export function limitations(assessment: VariantAssessment, read: EvidenceRead): Limitation[] {
  const { variant, evidence, regionalSignal } = assessment;
  const out: Limitation[] = [];
  const status = evidence.reviewStatus.toLowerCase();

  if (assessment.currentCode === "CONFLICTING" || status.includes("conflicting")) {
    out.push({ kind: "conflict", text: "Current ClinVar submitters disagree; there is no single consensus classification." });
  }
  if ((variant.historicalReviewStatus ?? "").includes("conflicting")) {
    out.push({ kind: "conflict", text: "Submitters already disagreed when the result was reported." });
  }
  if (regionalSignal.kind === "CATALOGUE_DISAGREES") {
    out.push({
      kind: "conflict",
      text: `${REGIONAL_SOURCE.catalogueShortName} places the variant in a different clinical band from ClinVar. VariantPulse does not rank one above the other.`,
    });
  }

  if (status.includes("single submitter")) {
    out.push({ kind: "evidence", text: "The current reading rests on a single submitter." });
  } else if (status.includes("no assertion")) {
    out.push({ kind: "evidence", text: "The current reading carries no assertion criteria." });
  }
  if (evidence.citations.length === 0) {
    out.push({ kind: "evidence", text: "No publication is linked to the ClinVar record." });
  }
  const regional = REGIONAL_BY_KEY.get(variant.key);
  if (regional && !regional.inGnomad) {
    out.push({ kind: "evidence", text: "Absent from gnomAD v4, so population frequency cannot inform this change." });
  } else if (regional?.middleEastern && regional.middleEastern.alleleCount > 0) {
    out.push({
      kind: "evidence",
      text: "The gnomAD Middle Eastern group is about 3,000 people, so regional frequency rests on few alleles. It is context for review, not a classification.",
    });
  }

  if (variant.historicalSource.kind === "modelled-report") {
    out.push({
      kind: "data",
      text: "The classification on record is the hospital's own report: ClinVar held no record of this variant in January 2023.",
    });
  }
  if (evidence.lastEvaluated && evidence.lastEvaluated < variant.recordedOn) {
    out.push({ kind: "data", text: "ClinVar's last evaluation predates the hospital report on file." });
  }
  if (read.mode === "demo") {
    out.push({
      kind: "data",
      text: `Demo mode: the current reading is the bundled snapshot${read.snapshot.verifiedAt ? `, verified identical to live ClinVar on ${formatDate(read.snapshot.verifiedAt)}` : ""}, not a live read.`,
    });
  } else if (read.mode === "cached") {
    out.push({
      kind: "data",
      text: `Live ClinVar was unavailable${read.reason ? ` (${read.reason.toLowerCase()})` : ""}, so the bundled snapshot is shown.`,
    });
  }
  for (const drift of read.snapshotDrift.filter((d) => d.key === variant.key)) {
    out.push({
      kind: "data",
      text: `Live ClinVar has moved on since the verified snapshot: ${drift.field} was "${drift.snapshot}", now "${drift.live}".`,
    });
  }

  if (assessment.releaseHistory.length > 0) {
    const labels = assessment.releaseHistory.map((r) => r.label);
    out.push({
      kind: "method",
      text: `Archived readings are held for ${labels.join(", ")}. A change is dated to the first checkpoint that shows it, not to the day it happened.`,
    });
  }
  out.push({
    kind: "method",
    text: "\"Last evaluated\" is when submitters last assessed the variant, which need not be when the aggregate classification changed.",
  });

  return out;
}

/* -- Record matching ------------------------------------------------------- */

export interface RecordMatch {
  id: string;
  testedOn: string;
  department: string;
  owner: string;
}

export interface MatchExplanation {
  /** How every record on this case was joined to the variant. */
  basis: string;
  transcript: string | null;
  records: RecordMatch[];
}

export function recordMatches(assessment: VariantAssessment): MatchExplanation {
  const { variant, evidence } = assessment;
  const transcript = panelTranscript(variant.key);
  const hgvs = transcript ? `${transcript}:${variant.hgvsCoding}` : `${variant.gene} ${variant.hgvsCoding}`;

  return {
    basis: `Exact match on the normalised variant ${hgvs}, which ClinVar holds as variation ${evidence.clinvarId}${evidence.accession ? ` (${evidence.accession})` : ""}. Every record on file carrying it is included; nothing is matched on gene alone.`,
    transcript,
    records: assessment.impactedPatients.map((patient) => ({
      id: patient.id,
      testedOn: patient.testedOn,
      department: patient.orderingDepartment,
      owner: patient.clinicalOwner,
    })),
  };
}

/* -- Freshness ------------------------------------------------------------- */

export interface FreshnessRow {
  label: string;
  value: string;
  /** Timestamp behind the value, for a relative "3 min ago" beside it. */
  at: string | null;
  note: string | null;
  tone: Tone;
}

export function freshness(assessment: VariantAssessment, read: EvidenceRead): FreshnessRow[] {
  const { variant, evidence } = assessment;
  const verified = read.snapshot.verifiedAt;
  const verifiedNote = verified
    ? `Verified identical to live ClinVar on ${formatDate(verified)} (${read.snapshot.verifiedMatched} of ${read.snapshot.verifiedCompared} records).`
    : null;

  const current: FreshnessRow =
    read.mode === "live"
      ? { label: "Current evidence", value: "Read live from ClinVar", at: read.checkedAt, note: null, tone: "positive" }
      : read.mode === "demo"
        ? { label: "Current evidence", value: "Bundled snapshot (demo mode)", at: verified, note: verifiedNote, tone: "neutral" }
        : {
            label: "Current evidence",
            value: "Bundled snapshot (live read failed)",
            at: verified,
            note: read.reason ?? EVIDENCE_MODES.cached.description,
            tone: "warning",
          };

  return [
    current,
    {
      label: "Last successful live read",
      value: read.lastLiveReadAt
        ? "ClinVar E-utilities"
        : read.mode === "demo"
          ? "Not attempted in demo mode"
          : "None since this server started",
      at: read.lastLiveReadAt,
      note: null,
      tone: read.lastLiveReadAt ? "positive" : "muted",
    },
    {
      label: "ClinVar last evaluated",
      value: formatDate(evidence.lastEvaluated),
      at: null,
      note: null,
      tone: "muted",
    },
    {
      label: "Historical baseline",
      value:
        variant.historicalSource.kind === "clinvar-release"
          ? `ClinVar ${variant.historicalSource.label} release`
          : `Hospital report, ${formatMonth(variant.recordedOn)}`,
      at: null,
      note: variant.historicalSource.file,
      tone: "muted",
    },
    {
      label: "Regional evidence",
      value: `gnomAD v4 and ${REGIONAL_SOURCE.catalogueShortName}, read ${formatDate(REGIONAL_SOURCE.checkedOn)}`,
      at: null,
      note: "Bundled with the dataset; not refreshed at runtime.",
      tone: "muted",
    },
  ];
}

/* -- Evidence snapshot ----------------------------------------------------- */

/**
 * Everything this alert was computed from, as one JSON document a reviewer can
 * keep with the case: the record on file, the evidence record as read, the
 * archived readings, the regional counts and the read's own provenance.
 */
export function evidenceSnapshot(assessment: VariantAssessment, read: EvidenceRead, exportedAt: string) {
  const { variant, evidence } = assessment;
  return {
    kind: "VariantPulse evidence snapshot",
    exportedAt,
    caseId: assessment.caseId,
    note: "Synthetic patient records; real public genomic evidence. Decision support only.",
    variant: {
      key: variant.key,
      gene: variant.gene,
      hgvsCoding: variant.hgvsCoding,
      transcript: panelTranscript(variant.key),
      proteinChange: variant.proteinChange,
      clinvarVariationId: evidence.clinvarId,
    },
    onRecord: {
      classification: variant.historicalClassification,
      wording: variant.historicalClinvarText,
      reviewStatus: variant.historicalReviewStatus,
      source: variant.historicalSource,
      reportedOn: variant.recordedOn,
    },
    current: evidence,
    archivedReadings: assessment.releaseHistory,
    regional: REGIONAL_BY_KEY.get(variant.key) ?? null,
    read: {
      mode: read.mode,
      reason: read.reason ?? null,
      checkedAt: read.checkedAt,
      lastLiveReadAt: read.lastLiveReadAt,
      snapshot: read.snapshot,
      driftFromSnapshot: read.snapshotDrift.filter((d) => d.key === variant.key),
    },
    variantPulseInference: {
      label: "Triage by VariantPulse, not a statement by any source",
      changeType: assessment.changeType,
      verdict: assessment.verdict,
      priority: assessment.priority,
      regionalSignal: assessment.regionalSignal,
    },
    matchedRecords: assessment.impactedPatients.map((p) => p.id),
  };
}
