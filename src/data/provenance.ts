/**
 * Typed access to `provenance.json`, the dataset's record of where each
 * variant's evidence comes from.
 *
 * For every monitored variant the file holds ClinVar's classification in
 * archived monthly releases (NCBI variant_summary), the gnomAD v4 allele counts
 * for all samples and for the Middle Eastern genetic ancestry group, and the
 * GRCh38 identifier gnomAD knows the variant by. The CTGA-backed cases add a
 * note on the regional catalogue's reading.
 *
 * The JSON is kept exactly as supplied. Its later entries write values such as
 * "PATHOGENIC (expert panel)" or "NOT IN CLINVAR" where earlier ones use a bare
 * code, so this module parses both forms and nothing downstream has to.
 */

import raw from "./provenance.json";
import { CLASSIFICATIONS, type ClassificationCode } from "@/lib/classification";

export interface AlleleCounts {
  alleleCount: number;
  alleleNumber: number;
}

export interface ReleaseClassification {
  /** Release identifier, `YYYY-MM`. */
  release: string;
  label: string;
  /** Null when ClinVar held no record of the variant in that release. */
  code: ClassificationCode | null;
  /** Qualifier supplied beside the value, such as "expert panel". */
  note: string | null;
}

export interface VariantProvenance {
  key: string;
  clinvarId: string;
  name: string;
  /** Oldest first. */
  releases: ReleaseClassification[];
  /** gnomAD variant identifier, GRCh38 `chrom-pos-ref-alt`. */
  grch38: string;
  gnomad: { global: AlleleCounts; middleEastern: AlleleCounts };
  /** How many synthetic patients the dataset says carry the variant. */
  patients: number;
  /** The supplied summary of the regional catalogue's reading, CTGA-backed cases only. */
  ctga: string | null;
}

interface RawEntry {
  key: string;
  clinvarVariationId: string;
  name: string;
  grch38: string;
  gnomad_v4_global_ac_an: number[];
  gnomad_v4_middle_eastern_ac_an: number[];
  patients: number;
  ctga?: string;
  [field: string]: unknown;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function releaseLabel(release: string): string {
  const [year, month] = release.split("-");
  return `${MONTHS[Number(month) - 1] ?? month} ${year}`;
}

/** Reads "VUS", "PATHOGENIC (expert panel)" or "NOT IN CLINVAR". */
export function parseReleaseValue(value: string): Pick<ReleaseClassification, "code" | "note"> {
  const text = value.trim();
  if (/^not in clinvar$/i.test(text)) return { code: null, note: "Not in ClinVar" };
  const match = /^([A-Z_]+)(?:\s*\((.*)\))?$/.exec(text);
  if (match && match[1] in CLASSIFICATIONS) {
    return { code: match[1] as ClassificationCode, note: match[2]?.trim() || null };
  }
  throw new Error(`provenance.json holds an unrecognised classification: "${value}"`);
}

function counts(pair: number[]): AlleleCounts {
  return { alleleCount: pair[0] ?? 0, alleleNumber: pair[1] ?? 0 };
}

export const PROVENANCE: VariantProvenance[] = (raw as RawEntry[]).map((entry) => ({
  key: entry.key,
  clinvarId: entry.clinvarVariationId,
  name: entry.name,
  releases: Object.keys(entry)
    .filter((field) => /^clinvar_\d{4}_\d{2}$/.test(field))
    .sort()
    .map((field) => {
      const release = field.slice("clinvar_".length).replace("_", "-");
      return { release, label: releaseLabel(release), ...parseReleaseValue(String(entry[field])) };
    }),
  grch38: entry.grch38,
  gnomad: {
    global: counts(entry.gnomad_v4_global_ac_an),
    middleEastern: counts(entry.gnomad_v4_middle_eastern_ac_an),
  },
  patients: entry.patients,
  ctga: entry.ctga ?? null,
}));

export const PROVENANCE_BY_KEY = new Map(PROVENANCE.map((p) => [p.key, p]));
