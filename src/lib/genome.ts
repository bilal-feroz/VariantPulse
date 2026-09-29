/**
 * The human genome at the scale the visual layer draws it.
 *
 * Lengths are the GRCh38 primary-assembly chromosome sizes (UCSC hg38
 * chrom.sizes). Each centromere is the boundary between the p11 and q11 `acen`
 * bands in the UCSC hg38 cytoBand table, which is where an ideogram draws the
 * constriction. Neither is fetched: they are fixed properties of the assembly
 * ClinVar reports positions against.
 *
 * Variant positions are never modelled here. They come from ClinVar's own
 * GRCh38 location for each record, so a marker sits exactly where the evidence
 * says the variant is.
 */

import type { EvidenceRecord } from "./clinvar";

export interface Chromosome {
  /** `1`–`22`, `X` or `Y`, as ClinVar writes it. */
  name: string;
  /** Length in base pairs. */
  length: number;
  /** Centromere position in base pairs from the p-arm end. */
  centromere: number;
}

export const GRCH38: readonly Chromosome[] = [
  { name: "1", length: 248_956_422, centromere: 123_400_000 },
  { name: "2", length: 242_193_529, centromere: 93_900_000 },
  { name: "3", length: 198_295_559, centromere: 90_900_000 },
  { name: "4", length: 190_214_555, centromere: 50_000_000 },
  { name: "5", length: 181_538_259, centromere: 48_800_000 },
  { name: "6", length: 170_805_979, centromere: 59_800_000 },
  { name: "7", length: 159_345_973, centromere: 60_100_000 },
  { name: "8", length: 145_138_636, centromere: 45_200_000 },
  { name: "9", length: 138_394_717, centromere: 43_000_000 },
  { name: "10", length: 133_797_422, centromere: 39_800_000 },
  { name: "11", length: 135_086_622, centromere: 53_400_000 },
  { name: "12", length: 133_275_309, centromere: 35_500_000 },
  { name: "13", length: 114_364_328, centromere: 17_700_000 },
  { name: "14", length: 107_043_718, centromere: 17_200_000 },
  { name: "15", length: 101_991_189, centromere: 19_000_000 },
  { name: "16", length: 90_338_345, centromere: 36_800_000 },
  { name: "17", length: 83_257_441, centromere: 25_100_000 },
  { name: "18", length: 80_373_285, centromere: 18_500_000 },
  { name: "19", length: 58_617_616, centromere: 26_200_000 },
  { name: "20", length: 64_444_167, centromere: 28_100_000 },
  { name: "21", length: 46_709_983, centromere: 12_000_000 },
  { name: "22", length: 50_818_468, centromere: 15_000_000 },
  { name: "X", length: 156_040_895, centromere: 61_000_000 },
  { name: "Y", length: 57_227_415, centromere: 10_400_000 },
];

export const CHROMOSOME_BY_NAME = new Map(GRCH38.map((c) => [c.name, c]));

/** A variant's place on the genome, read from its evidence record. */
export interface Locus {
  chromosome: Chromosome;
  /** GRCh38 start, in base pairs. */
  position: number;
  /** Cytogenetic band as ClinVar gives it, e.g. `17q21.31`. */
  band: string | null;
  /** Which arm the position falls on, from the centromere above. */
  arm: "p" | "q";
}

/**
 * Where the evidence places a variant, or null when the record carries no
 * GRCh38 location this table can draw (another assembly, or an unplaced
 * contig). A chromosome written `chr17` is read as `17`.
 */
export function locusOf(evidence: Pick<EvidenceRecord, "location">): Locus | null {
  const location = evidence.location;
  if (!location || location.assembly !== "GRCh38") return null;

  const chromosome = CHROMOSOME_BY_NAME.get(location.chr.replace(/^chr/i, "").toUpperCase());
  const position = Number(location.start);
  if (!chromosome || !Number.isInteger(position) || position < 1 || position > chromosome.length) {
    return null;
  }

  return {
    chromosome,
    position,
    band: location.band?.trim() || null,
    arm: position < chromosome.centromere ? "p" : "q",
  };
}

/** Karyotype order: 1–22, then X and Y. */
export function chromosomeRank(name: string): number {
  const index = GRCH38.findIndex((c) => c.name === name);
  return index === -1 ? GRCH38.length : index;
}

/** Orders loci the way the genome reads: by chromosome, then by position. */
export function compareLoci(a: Locus, b: Locus): number {
  return chromosomeRank(a.chromosome.name) - chromosomeRank(b.chromosome.name) || a.position - b.position;
}

/** `43067626` as `43,067,626`. */
export function formatPosition(position: number): string {
  return new Intl.NumberFormat("en-US").format(position);
}
