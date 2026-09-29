import { describe, expect, it } from "vitest";

import snapshot from "@/data/evidence-snapshot.json";
import { MONITORED_VARIANTS } from "@/data/workspace";
import { CHANGE_TYPES, type ChangeType } from "@/lib/classification";
import type { EvidenceRecord } from "@/lib/clinvar";
import { GRCH38, compareLoci, formatPosition, locusOf } from "@/lib/genome";
import { SIGNAL_OF } from "@/lib/signal";

const records = snapshot.records as unknown as Record<string, EvidenceRecord>;

describe("the genome table", () => {
  it("holds the 24 GRCh38 chromosomes in karyotype order, each centromere inside its chromosome", () => {
    expect(GRCH38.map((c) => c.name)).toEqual([
      ...Array.from({ length: 22 }, (_, i) => String(i + 1)),
      "X",
      "Y",
    ]);
    for (const chromosome of GRCH38) {
      expect(chromosome.centromere, chromosome.name).toBeGreaterThan(0);
      expect(chromosome.centromere, chromosome.name).toBeLessThan(chromosome.length);
    }
  });

  it("places every monitored variant on the arm ClinVar's cytogenetic band names", () => {
    for (const variant of MONITORED_VARIANTS) {
      const locus = locusOf(records[variant.key]);
      expect(locus, variant.key).not.toBeNull();
      // `17q21.31` names the q arm of chromosome 17; the centromere table has to agree.
      expect(locus!.band, variant.key).toMatch(new RegExp(`^${locus!.chromosome.name}${locus!.arm}`));
    }
  });

  it("refuses a location it cannot draw rather than guessing one", () => {
    const at = (location: EvidenceRecord["location"]) => locusOf({ location });
    expect(at(null)).toBeNull();
    expect(at({ assembly: "GRCh37", chr: "17", band: "17q21.31", start: "41215920", stop: "41215920" })).toBeNull();
    expect(at({ assembly: "GRCh38", chr: "MT", band: "", start: "8993", stop: "8993" })).toBeNull();
    expect(at({ assembly: "GRCh38", chr: "21", band: "", start: "90000000", stop: "90000000" })).toBeNull();
    expect(at({ assembly: "GRCh38", chr: "chrX", band: " ", start: "100", stop: "100" })).toMatchObject({
      chromosome: { name: "X" },
      band: null,
      arm: "p",
    });
  });

  it("orders loci by chromosome, then position", () => {
    const loci = MONITORED_VARIANTS.map((v) => locusOf(records[v.key])!).sort(compareLoci);
    expect(loci.map((l) => l.chromosome.name)).toEqual(
      [...loci.map((l) => l.chromosome.name)].sort((a, b) => Number(a) - Number(b)),
    );
    expect(loci[0].chromosome.name).toBe("7");
    expect(formatPosition(43067626)).toBe("43,067,626");
  });
});

describe("signals", () => {
  it("gives every change type exactly one signal, and only material changes a loud one", () => {
    for (const type of Object.keys(CHANGE_TYPES) as ChangeType[]) {
      expect(SIGNAL_OF[type] === "quiet", type).toBe(!CHANGE_TYPES[type].material);
    }
  });
});
