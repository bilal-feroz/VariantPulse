/**
 * Current-evidence retrieval.
 *
 * Evidence is read live from NCBI ClinVar in a single batched request. If that
 * call fails or is slow, the bundled snapshot is served instead and the
 * workspace says so rather than quietly presenting stale data as current.
 *
 * The snapshot is only ever written by `npm run evidence:refresh`. A live read
 * that differs from it is used as-is and the difference is reported, but the
 * snapshot is never overwritten at runtime: it stays the known-good fallback.
 */

import "server-only";

import snapshot from "@/data/evidence-snapshot.json";
import { MONITORED_VARIANTS } from "@/data/workspace";

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const REQUEST_TIMEOUT_MS = 5_000;
/** How long a successful live read stays authoritative before refetching. */
const CACHE_TTL_MS = 5 * 60 * 1000;
/**
 * How long a failed live read is remembered, so an unreachable network costs
 * one timeout rather than one per page load. An explicit sync always retries.
 */
const FAILURE_TTL_MS = 30 * 1000;

export interface EvidenceCitation {
  pmid: string;
  title: string;
  journal: string;
  year: string;
}

export interface EvidenceRecord {
  clinvarId: string;
  accession: string | null;
  title: string;
  gene: string | null;
  cdnaChange: string | null;
  variantType: string | null;
  molecularConsequence: string | null;
  proteinChange: string | null;
  rsid: string | null;
  /** Raw classification text exactly as the source states it. */
  classification: string;
  reviewStatus: string;
  lastEvaluated: string | null;
  fdaRecognised: boolean;
  submissionCount: number;
  conditions: string[];
  location: {
    assembly: string;
    chr: string;
    band: string;
    start: string;
    stop: string;
  } | null;
  peakAlleleFrequency: { value: number; source: string } | null;
  citations: EvidenceCitation[];
}

export type EvidenceMode = "live" | "cached";

/** What is known about the bundled snapshot the fallback serves. */
export interface SnapshotInfo {
  /** When the records were captured at source; null when the supplier did not record it. */
  generatedAt: string | null;
  /** When the records were last confirmed identical to a live read. */
  verifiedAt: string | null;
  verifiedMatched: number;
  verifiedCompared: number;
  recordCount: number;
}

/** A field on which a live read disagrees with the bundled snapshot. */
export interface SnapshotDifference {
  key: string;
  field: "classification" | "reviewStatus" | "lastEvaluated" | "submissionCount";
  snapshot: string;
  live: string;
}

export interface EvidenceResult {
  mode: EvidenceMode;
  /** Present when live evidence was not served. */
  reason?: string;
  checkedAt: string;
  /** When the served data was produced at source: the live read, or the snapshot's verification. */
  sourceUpdatedAt: string | null;
  snapshot: SnapshotInfo;
  /** Live reads only: where ClinVar has moved on since the snapshot was taken. */
  snapshotDrift: SnapshotDifference[];
  records: Record<string, EvidenceRecord>;
}

interface Snapshot {
  generatedAt?: string | null;
  source: string;
  sourceUrl: string;
  recordCount: number;
  provenance?: {
    verifiedAgainstLive?: { at: string; compared: number; matched: number };
  };
  records: Record<string, EvidenceRecord>;
}

const SNAPSHOT = snapshot as unknown as Snapshot;

export const EVIDENCE_SOURCE_URL = SNAPSHOT.sourceUrl;

export const SNAPSHOT_INFO: SnapshotInfo = {
  generatedAt: SNAPSHOT.generatedAt ?? null,
  verifiedAt: SNAPSHOT.provenance?.verifiedAgainstLive?.at ?? null,
  verifiedMatched: SNAPSHOT.provenance?.verifiedAgainstLive?.matched ?? 0,
  verifiedCompared: SNAPSHOT.provenance?.verifiedAgainstLive?.compared ?? 0,
  recordCount: SNAPSHOT.recordCount,
};

/** Live ClinVar reads can be switched off for a session, for a room with no reliable network. */
function liveReadsDisabled(): boolean {
  const flag = process.env.VARIANTPULSE_OFFLINE?.trim().toLowerCase();
  return flag === "1" || flag === "true";
}

/** The bundled snapshot, labelled as such. */
export function readSnapshotEvidence(reason?: string): EvidenceResult {
  return {
    mode: "cached",
    reason,
    checkedAt: new Date().toISOString(),
    sourceUpdatedAt: SNAPSHOT_INFO.verifiedAt ?? SNAPSHOT_INFO.generatedAt,
    snapshot: SNAPSHOT_INFO,
    snapshotDrift: [],
    records: SNAPSHOT.records,
  };
}

/* -- Live read ------------------------------------------------------------ */

type Summary = Record<string, unknown>;

function get<T>(source: unknown, path: string): T | undefined {
  let cursor: unknown = source;
  for (const part of path.split(".")) {
    if (cursor === null || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor as T | undefined;
}

function normaliseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const [date] = raw.split(" ");
  return date ? date.replace(/\//g, "-") : null;
}

/**
 * Reshapes an E-utilities summary into an `EvidenceRecord`. The bundled
 * snapshot is written in exactly this shape by `scripts/refresh-evidence.mjs`,
 * so live and cached records are interchangeable downstream.
 */
function shape(raw: Summary, fallback: EvidenceRecord | undefined): EvidenceRecord | null {
  const uid = get<string>(raw, "uid");
  if (!uid) return null;

  const variation = get<Summary[]>(raw, "variation_set")?.[0];
  const xrefs = get<Array<{ db_source?: string; db_id?: string }>>(variation ?? {}, "variation_xrefs") ?? [];
  const rs = xrefs.find((x) => x.db_source === "dbSNP")?.db_id;

  const locations =
    get<Array<Record<string, string>>>(variation ?? {}, "variation_loc") ?? [];
  const loc = locations.find((l) => l.assembly_name === "GRCh38") ?? locations[0];

  const classification = get<string>(raw, "germline_classification.description");
  if (!classification) return null;

  const traits =
    get<Array<{ trait_name?: string }>>(raw, "germline_classification.trait_set") ?? [];
  const scv = get<string[]>(raw, "supporting_submissions.scv") ?? [];

  return {
    clinvarId: uid,
    accession: get<string>(raw, "accession") ?? null,
    title: get<string>(raw, "title") ?? fallback?.title ?? "",
    gene: get<Array<{ symbol?: string }>>(raw, "genes")?.[0]?.symbol ?? fallback?.gene ?? null,
    cdnaChange: get<string>(variation ?? {}, "cdna_change") ?? fallback?.cdnaChange ?? null,
    variantType:
      get<string>(variation ?? {}, "variant_type") ?? get<string>(raw, "obj_type") ?? null,
    molecularConsequence:
      get<string[]>(raw, "molecular_consequence_list")?.[0] ?? fallback?.molecularConsequence ?? null,
    proteinChange:
      get<string>(raw, "protein_change")?.split(",")[0]?.trim() || fallback?.proteinChange || null,
    rsid: rs ? `rs${rs}` : (fallback?.rsid ?? null),
    classification,
    reviewStatus:
      get<string>(raw, "germline_classification.review_status") ??
      "no assertion criteria provided",
    lastEvaluated: normaliseDate(get<string>(raw, "germline_classification.last_evaluated")),
    fdaRecognised: get<string>(raw, "fda_recognized_database") === "true",
    submissionCount: scv.length,
    conditions: traits
      .map((t) => t.trait_name)
      .filter((n): n is string => Boolean(n) && n !== "not provided" && n !== "not specified"),
    location: loc?.assembly_name
      ? {
          assembly: loc.assembly_name,
          chr: loc.chr,
          band: loc.band,
          start: loc.display_start,
          stop: loc.display_stop,
        }
      : (fallback?.location ?? null),
    // Allele frequency and PubMed links need extra round trips, so the
    // snapshot's values are reused rather than refetched on every sync.
    peakAlleleFrequency: fallback?.peakAlleleFrequency ?? null,
    citations: fallback?.citations ?? [],
  };
}

const COMPARED_FIELDS: SnapshotDifference["field"][] = [
  "classification",
  "reviewStatus",
  "lastEvaluated",
  "submissionCount",
];

function diffAgainstSnapshot(records: Record<string, EvidenceRecord>): SnapshotDifference[] {
  const differences: SnapshotDifference[] = [];
  for (const [key, live] of Object.entries(records)) {
    const saved = SNAPSHOT.records[key];
    if (!saved) continue;
    for (const field of COMPARED_FIELDS) {
      if (String(saved[field]) !== String(live[field])) {
        differences.push({ key, field, snapshot: String(saved[field]), live: String(live[field]) });
      }
    }
  }
  return differences;
}

let cache: { value: EvidenceResult; expiresAt: number } | null = null;

/**
 * Returns the current classification for every monitored variant.
 *
 * Never throws: an unreachable or malformed upstream response degrades to the
 * bundled snapshot with `mode: "cached"`.
 */
export async function fetchCurrentEvidence(options?: { force?: boolean }): Promise<EvidenceResult> {
  if (liveReadsDisabled()) {
    return readSnapshotEvidence("Live ClinVar reads are switched off (VARIANTPULSE_OFFLINE)");
  }

  if (!options?.force && cache && cache.expiresAt > Date.now()) {
    return cache.value;
  }

  const ids = MONITORED_VARIANTS.map((v) => v.clinvarId);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const fallBack = (reason: string): EvidenceResult => {
    const value = readSnapshotEvidence(reason);
    cache = { value, expiresAt: Date.now() + FAILURE_TTL_MS };
    return value;
  };

  try {
    const response = await fetch(
      `${EUTILS}/esummary.fcgi?db=clinvar&retmode=json&tool=variantpulse&id=${ids.join(",")}`,
      {
        signal: controller.signal,
        headers: { "User-Agent": "VariantPulse/1.0" },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return fallBack(`ClinVar responded ${response.status}`);
    }

    const body = (await response.json()) as { result?: Record<string, Summary> };
    const result = body.result;
    if (!result) return fallBack("ClinVar returned an unexpected payload");

    const records: Record<string, EvidenceRecord> = {};
    for (const variant of MONITORED_VARIANTS) {
      const raw = result[variant.clinvarId];
      const shaped = raw ? shape(raw, SNAPSHOT.records[variant.key]) : null;
      // A partial response is not a live read. Fall back rather than mix sources.
      if (!shaped) return fallBack("ClinVar response was incomplete");
      records[variant.key] = shaped;
    }

    const snapshotDrift = diffAgainstSnapshot(records);
    if (snapshotDrift.length > 0) {
      console.info(
        `[VariantPulse] Live ClinVar differs from the bundled snapshot on ${snapshotDrift.length} field(s):`,
        snapshotDrift.map((d) => `${d.key} ${d.field}: ${d.snapshot} -> ${d.live}`).join("; "),
      );
    }

    const now = new Date().toISOString();
    const value: EvidenceResult = {
      mode: "live",
      checkedAt: now,
      sourceUpdatedAt: now,
      snapshot: SNAPSHOT_INFO,
      snapshotDrift,
      records,
    };
    cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  } catch (error) {
    return fallBack(
      error instanceof Error && error.name === "AbortError"
        ? "ClinVar did not respond within the timeout"
        : "ClinVar is unreachable",
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Clears the in-process evidence cache so the next read goes upstream. */
export function invalidateEvidenceCache(): void {
  cache = null;
}
