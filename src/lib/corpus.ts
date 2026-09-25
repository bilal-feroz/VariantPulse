/**
 * The historical finding scan.
 *
 * A sync walks every synthetic patient record in the workspace and groups the
 * findings by the variant they carry, which is how a changed variant is joined
 * back to the records it affects.
 *
 * The scan covers the synthetic records and nothing else. There is no
 * generated background volume behind it: the number a sync reports is the
 * number of records it actually compared.
 */

import type { ClassificationCode } from "./classification";
import { PATIENTS, VARIANT_BY_KEY } from "@/data/workspace";

export interface CorpusFinding {
  recordId: string;
  variantKey: string;
  recordedCode: ClassificationCode;
  reportedOn: string;
}

export function getCorpus(): CorpusFinding[] {
  // The classification on record belongs to the variant, not the patient:
  // every record carrying a variant was reported with the interpretation of the day.
  return PATIENTS.map((patient) => ({
    recordId: patient.id,
    variantKey: patient.variantKey,
    recordedCode: VARIANT_BY_KEY.get(patient.variantKey)?.historicalClassification ?? "NOT_PROVIDED",
    reportedOn: patient.testedOn,
  }));
}

export interface CorpusScan {
  /** Synthetic patient records compared in the scan. */
  findingsChecked: number;
  distinctVariants: number;
  /** Findings grouped by the variant they sit on. */
  byVariant: Map<string, CorpusFinding[]>;
}

/** Walks every record once and groups the findings by variant. */
export function scanCorpus(): CorpusScan {
  const corpus = getCorpus();
  const byVariant = new Map<string, CorpusFinding[]>();

  for (const finding of corpus) {
    const bucket = byVariant.get(finding.variantKey);
    if (bucket) bucket.push(finding);
    else byVariant.set(finding.variantKey, [finding]);
  }

  return {
    findingsChecked: corpus.length,
    distinctVariants: byVariant.size,
    byVariant,
  };
}
