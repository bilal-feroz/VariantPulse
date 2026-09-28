/**
 * HGVS coding notation: the checks and the normalisation every source of
 * variant strings goes through. Client-safe and pure.
 *
 * Normalisation only ever makes a string canonical (case, spacing, the `c.`
 * prefix, a transcript written inline). It never guesses at a different
 * variant, so a string it cannot read stays unreadable and is reported.
 */

import { PROVENANCE_BY_KEY } from "@/data/provenance";

/** Coding notation for the change types a single-variant panel carries. */
export const HGVS_CODING =
  /^c\.[*-]?\d+(?:[+-]\d+)?(?:_[*-]?\d+(?:[+-]\d+)?)?(?:[ACGT]>[ACGT]|del(?:ins[ACGT]+)?|dup|ins[ACGT]+)$/;

/** A RefSeq transcript, version included: NM_007294.4. */
export const TRANSCRIPT = /^N[MRC]_\d+\.\d+$/;

/** The RefSeq transcript the dataset names for a monitored variant, e.g. NM_007294.4. */
export function panelTranscript(variantKey: string): string | null {
  const name = PROVENANCE_BY_KEY.get(variantKey)?.name ?? "";
  return /^(N[MRC]_\d+\.\d+)\(/.exec(name)?.[1] ?? null;
}

export interface NormalisedHgvs {
  /** The canonical coding notation, or the input unchanged if it cannot be read. */
  value: string;
  /** A transcript that was written inline, `NM_007294.4:c.…` or `NM_007294.4(BRCA1):c.…`. */
  transcript: string | null;
  /** A gene written inline, `NM_…(BRCA1):c.…`. */
  gene: string | null;
  /** What was changed to reach the canonical form, in words. */
  changes: string[];
  valid: boolean;
  /** Set when the string is protein notation rather than coding notation. */
  protein: boolean;
}

export function normaliseHgvs(raw: string): NormalisedHgvs {
  const changes: string[] = [];
  let value = raw.trim();

  const spaced = value.replace(/\s+/g, "");
  if (spaced !== value) changes.push("removed spaces");
  value = spaced;

  let transcript: string | null = null;
  let gene: string | null = null;
  const inline = /^(N[MRC]_\d+(?:\.\d+)?)(?:\(([A-Za-z0-9-]+)\))?:(.+)$/i.exec(value);
  if (inline) {
    transcript = inline[1].toUpperCase();
    gene = inline[2]?.toUpperCase() ?? null;
    value = inline[3];
    changes.push("moved the inline transcript to its own field");
  }

  if (/^p\./i.test(value)) {
    return { value, transcript, gene, changes, valid: false, protein: true };
  }

  if (/^C\./.test(value)) {
    value = `c.${value.slice(2)}`;
    changes.push("lower-cased the c. prefix");
  } else if (/^[*-]?\d/.test(value)) {
    value = `c.${value}`;
    changes.push("added the missing c. prefix");
  }

  const cased = value
    .replace(/delins|del|dup|ins/gi, (keyword) => keyword.toLowerCase())
    .replace(/([acgt])>([acgt])$/i, (_, from: string, to: string) => `${from.toUpperCase()}>${to.toUpperCase()}`)
    .replace(/(ins)([acgt]+)$/i, (_, keyword: string, bases: string) => `${keyword}${bases.toUpperCase()}`);
  if (cased !== value) changes.push("normalised the case of bases and keywords");
  value = cased;

  // c.5266dupC and c.68_69delAG are legal, and common in older reports, but
  // current HGVS leaves the bases out: the reference sequence already names
  // them. Dropping them is what lets the change match its canonical form.
  const bare = value.replace(/(del|dup)([ACGT]+)$/i, "$1");
  if (bare !== value) {
    changes.push("dropped the bases after del/dup, which current HGVS leaves out");
    value = bare;
  }

  return { value, transcript, gene, changes, valid: HGVS_CODING.test(value), protein: false };
}
