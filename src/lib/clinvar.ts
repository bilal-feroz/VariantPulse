/**
 * Current-evidence retrieval.
 *
 * Three modes, chosen by `VARIANTPULSE_EVIDENCE_MODE`:
 *
 * - `demo` (default): the bundled snapshot, with its timestamps taken from the
 *   snapshot itself. No network, identical on every run and every render.
 * - `live`: read from NCBI ClinVar. If that call fails or is slow, the bundled
 *   snapshot is served instead with mode `cached`, and the workspace says so
 *   rather than quietly presenting stale data as current.
 * - `cached`: only ever reported, never selected — it is what `live` degrades to.
 */

import "server-only";

import snapshot from "@/data/evidence-snapshot.json";
import { MONITORED_VARIANTS } from "@/data/workspace";

/** Overridable so a ClinVar outage can be simulated with an unroutable host. */
const EUTILS =
  process.env.VARIANTPULSE_EUTILS_URL ?? "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const REQUEST_TIMEOUT_MS = 6_000;
/** How long a successful live read stays authoritative before refetching. */
const CACHE_TTL_MS = 5 * 60 * 1000;

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

export type EvidenceMode = "demo" | "live" | "cached";

/** The mode a deployment asks for. `cached` is a fallback, not a choice. */
export type RequestedEvidenceMode = Exclude<EvidenceMode, "cached">;

export interface EvidenceResult {
  mode: EvidenceMode;
  /** Present when a live read was attempted and failed. */
  reason?: string;
  checkedAt: string;
  /** When the served data was produced at source; the capture time for the bundled snapshot. */
  sourceUpdatedAt: string | null;
  records: Record<string, EvidenceRecord>;
}

interface Snapshot {
  source: string;
  /** ISO timestamp of when the snapshot was captured. */
  capturedAt: string;
  sourceUrl: string;
  recordCount: number;
  records: Record<string, EvidenceRecord>;
}

const SNAPSHOT = snapshot as unknown as Snapshot;

export const EVIDENCE_SOURCE_URL = SNAPSHOT.sourceUrl;
export const SNAPSHOT_CAPTURED_AT = SNAPSHOT.capturedAt;

export const EVIDENCE_MODE_ENV = "VARIANTPULSE_EVIDENCE_MODE";

/** Anything other than an explicit `live` runs the deterministic demo. */
export function resolveEvidenceMode(
  raw: string | undefined = process.env[EVIDENCE_MODE_ENV],
): RequestedEvidenceMode {
  return raw?.trim().toLowerCase() === "live" ? "live" : "demo";
}

function demoResult(): EvidenceResult {
  return {
    mode: "demo",
    checkedAt: SNAPSHOT.capturedAt,
    sourceUpdatedAt: SNAPSHOT.capturedAt,
    records: SNAPSHOT.records,
  };
}

function cachedResult(reason?: string): EvidenceResult {
  return {
    mode: "cached",
    reason,
    checkedAt: new Date().toISOString(),
    sourceUpdatedAt: SNAPSHOT.capturedAt,
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

let cache: { value: EvidenceResult; expiresAt: number } | null = null;

/**
 * Returns the current classification for every monitored variant.
 *
 * Never throws: in live mode an unreachable or malformed upstream response
 * degrades to the bundled snapshot with `mode: "cached"`.
 */
export async function fetchCurrentEvidence(options?: {
  force?: boolean;
  mode?: RequestedEvidenceMode;
}): Promise<EvidenceResult> {
  if ((options?.mode ?? resolveEvidenceMode()) === "demo") {
    return demoResult();
  }

  if (!options?.force && cache && cache.expiresAt > Date.now()) {
    return cache.value;
  }

  const ids = MONITORED_VARIANTS.map((v) => v.clinvarId);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${EUTILS}/esummary.fcgi?db=clinvar&retmode=json&id=${ids.join(",")}`,
      {
        signal: controller.signal,
        headers: { "User-Agent": "VariantPulse/1.0" },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return cachedResult(`ClinVar responded ${response.status}`);
    }

    const body = (await response.json()) as { result?: Record<string, Summary> };
    const result = body.result;
    if (!result) return cachedResult("ClinVar returned an unexpected payload");

    const records: Record<string, EvidenceRecord> = {};
    let missing = false;
    for (const variant of MONITORED_VARIANTS) {
      const raw = result[variant.clinvarId];
      const fallback = SNAPSHOT.records[variant.key];
      const shaped = raw ? shape(raw, fallback) : null;
      const record = shaped ?? fallback;
      // A variant with neither a live record nor a snapshot entry means the
      // panel and the snapshot have drifted apart. Never serve a hole.
      if (!record) {
        missing = true;
        break;
      }
      records[variant.key] = record;
    }

    // A partial response is not a live read. Fall back rather than mix sources.
    if (missing) {
      return cachedResult("ClinVar response was incomplete");
    }

    const value: EvidenceResult = {
      mode: "live",
      checkedAt: new Date().toISOString(),
      sourceUpdatedAt: new Date().toISOString(),
      records,
    };
    cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "AbortError"
        ? "ClinVar did not respond within the timeout"
        : "ClinVar is unreachable";
    return cachedResult(reason);
  } finally {
    clearTimeout(timer);
  }
}

/** Clears the in-process evidence cache so the next read goes upstream. */
export function invalidateEvidenceCache(): void {
  cache = null;
}
