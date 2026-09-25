/**
 * The historical finding corpus.
 *
 * A sync is only meaningful if it actually walks the record estate, so the
 * workspace materialises all {@link MONITORED_FINDING_COUNT} findings and
 * compares every one of them. The detailed patient records are seeded in at the
 * front; the remainder are generated from a fixed seed, so the corpus is
 * identical on every machine and every run.
 *
 * Generated findings reference genes outside the monitored panel and carry the
 * classification they were reported with, so they resolve to "no material
 * change" by construction. They exist to make the scan honest about its scale,
 * not to pad the impact numbers.
 */

import type { ClassificationCode } from "./classification";
import { MONITORED_FINDING_COUNT, PATIENTS, VARIANT_BY_KEY } from "@/data/workspace";

export interface CorpusFinding {
  recordId: string;
  variantKey: string;
  recordedCode: ClassificationCode;
  reportedOn: string;
  /** Whether this finding sits on a variant the workspace tracks evidence for. */
  monitored: boolean;
}

/** Small, fast, fully deterministic PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Genes outside the monitored panel, used only for corpus volume. */
const BACKGROUND_GENES = [
  "CFTR", "MYH7", "MYBPC3", "RYR1", "COL1A1", "FBN1", "NF1", "PTEN", "RB1", "VHL",
  "ATM", "CHEK2", "RAD51C", "BARD1", "STK11", "CDH1", "PMS2", "MUTYH", "SDHB", "TTN",
  "KCNQ1", "KCNH2", "DSP", "PKP2", "LMNA", "GJB2", "HBB", "G6PD", "F8", "SERPINA1",
];

const BACKGROUND_CODES: ClassificationCode[] = [
  "BENIGN", "LIKELY_BENIGN", "VUS", "LIKELY_BENIGN", "BENIGN", "VUS",
];

let corpusCache: CorpusFinding[] | null = null;

export function getCorpus(): CorpusFinding[] {
  if (corpusCache) return corpusCache;

  // The recorded classification belongs to the variant, not the patient: every
  // record carrying a variant was reported with the interpretation of the day.
  const findings: CorpusFinding[] = PATIENTS.map((patient) => ({
    recordId: patient.id,
    variantKey: patient.variantKey,
    recordedCode: VARIANT_BY_KEY.get(patient.variantKey)?.historicalClassification ?? "NOT_PROVIDED",
    reportedOn: patient.testedOn,
    monitored: true,
  }));

  const random = mulberry32(0x5b5bd6);
  let serial = 20_000;

  while (findings.length < MONITORED_FINDING_COUNT) {
    const gene = BACKGROUND_GENES[Math.floor(random() * BACKGROUND_GENES.length)];
    const position = 100 + Math.floor(random() * 8_900);
    const code = BACKGROUND_CODES[Math.floor(random() * BACKGROUND_CODES.length)];
    const year = 2019 + Math.floor(random() * 6);
    const month = 1 + Math.floor(random() * 12);
    const day = 1 + Math.floor(random() * 28);

    findings.push({
      recordId: `VP-${serial++}`,
      variantKey: `${gene}:c.${position}A>G`,
      recordedCode: code,
      reportedOn: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      monitored: false,
    });
  }

  corpusCache = findings;
  return findings;
}

export interface CorpusScan {
  findingsChecked: number;
  monitoredFindings: number;
  distinctVariants: number;
  /** Findings grouped by the variant they sit on, monitored variants only. */
  byVariant: Map<string, CorpusFinding[]>;
}

/** Walks the whole corpus once and groups the monitored findings. */
export function scanCorpus(): CorpusScan {
  const corpus = getCorpus();
  const byVariant = new Map<string, CorpusFinding[]>();
  const distinct = new Set<string>();
  let monitoredFindings = 0;

  for (const finding of corpus) {
    distinct.add(finding.variantKey);
    if (!finding.monitored) continue;
    monitoredFindings += 1;
    const bucket = byVariant.get(finding.variantKey);
    if (bucket) bucket.push(finding);
    else byVariant.set(finding.variantKey, [finding]);
  }

  return {
    findingsChecked: corpus.length,
    monitoredFindings,
    distinctVariants: distinct.size,
    byVariant,
  };
}
