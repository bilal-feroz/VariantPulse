/**
 * Regional evidence.
 *
 * Global variant databases are dominated by European-ancestry cohorts, so how
 * often a variant is seen in the populations a Gulf hospital serves can differ
 * from the global figure a classification leans on, and a regional catalogue
 * can hold clinical observations that global databases do not.
 *
 * Two kinds of regional evidence are held here, and neither is a VariantPulse
 * classification:
 *
 *  - Population frequency, for every monitored variant: gnomAD v4 allele counts
 *    for the Middle Eastern genetic ancestry group and for all samples, exactly
 *    as supplied in `provenance.json` and re-checked against the gnomAD API on
 *    2026-09-25. The Middle Eastern group is about 3,000 people out of roughly
 *    800,000 (under 0.4% of gnomAD), which is itself the regional evidence gap.
 *  - Regional catalogue records, where one exists: the Catalogue for
 *    Transmission Genetics in Arabs (CTGA), maintained by the Centre for Arab
 *    Genomic Studies. Its clinical significance is quoted verbatim and always
 *    attributed; the records were read from the CTGA database on 2026-09-25.
 *
 * The context notes cite real, published papers on why regional
 * interpretation matters. They are supporting context, not findings about the
 * variant. No national programme, registry or hospital supplied any of this.
 */

import { normaliseClassification, type ClassificationCode } from "@/lib/classification";
import { PROVENANCE, type AlleleCounts } from "./provenance";

export interface AlleleFrequency extends AlleleCounts {
  /** `alleleCount / alleleNumber`; null when the site had no coverage. */
  frequency: number | null;
}

export interface RegionalCitation {
  pmid: string;
  title: string;
  journal: string;
  year: string;
}

export interface CatalogueRecord {
  catalogue: "CTGA";
  /** The catalogue's clinical significance, verbatim. */
  significance: string;
  /** The same, normalised onto the internal taxonomy for band comparison only. */
  code: ClassificationCode;
  countries: string[];
  conditions: string[];
  /** References as the catalogue cites them. */
  references: string[];
  /** Earliest date in the catalogue's contributor and edit history. */
  listedSince: string;
  url: string;
}

export interface RegionalContext {
  note: string;
  citations: RegionalCitation[];
  /** Designated for regional review in the supplied dataset, independent of any computed signal. */
  flagForReview: boolean;
}

export interface RegionalEvidence {
  variantKey: string;
  /** gnomAD variant identifier, GRCh38 `chrom-pos-ref-alt`. */
  gnomadVariantId: string;
  /** False when gnomAD v4 holds no record of the variant at all. */
  inGnomad: boolean;
  /**
   * The gnomAD v4 call set the counts come from: `joint` combines exomes and
   * genomes; variants absent from the genomes are reported from `exomes`.
   */
  callSet: "joint" | "exomes" | null;
  global: AlleleFrequency | null;
  middleEastern: AlleleFrequency | null;
  catalogue: CatalogueRecord | null;
  context: RegionalContext | null;
}

export const REGIONAL_SOURCE = {
  name: "Regional evidence",
  frequencySource: "gnomAD v4",
  population: "Middle Eastern genetic ancestry group",
  gnomadUrl: "https://gnomad.broadinstitute.org/",
  catalogueName: "Catalogue for Transmission Genetics in Arabs (CTGA)",
  catalogueShortName: "CTGA",
  cataloguePublisher: "Centre for Arab Genomic Studies",
  catalogueUrl: "https://cags.org.ae/en/ctga-overview",
  checkedOn: "2026-09-25",
  coverageNote:
    "Frequencies are gnomAD v4 allele counts for the Middle Eastern genetic ancestry group, about 3,000 people out of roughly 800,000, against all samples. Regional catalogue readings are quoted from CTGA and attributed. Neither is a VariantPulse classification, and no national programme, registry or hospital supplied this data.",
};

export function gnomadVariantUrl(variantId: string): string {
  return `https://gnomad.broadinstitute.org/variant/${variantId}?dataset=gnomad_r4`;
}

/**
 * How a source reaches the workspace. Kept apart on every surface, so curated
 * demonstration content is never mistaken for a live integration.
 */
export type SourceKind = "live" | "bundled" | "curated";

export const SOURCE_KIND: Record<SourceKind, { label: string; description: string }> = {
  live: {
    label: "Live integration",
    description: "Read from the source at each sync, with the verified snapshot as a labelled fallback.",
  },
  bundled: {
    label: "Bundled public data",
    description: "Read from the public source once, checked, and shipped with the dataset. Not refreshed at runtime.",
  },
  curated: {
    label: "Curated demonstration content",
    description: "Written for this demonstration dataset. It cites published work but is not a finding about the variant.",
  },
};

export interface EvidenceSource {
  name: string;
  publisher: string;
  kind: SourceKind;
  /** What the workspace takes from it. */
  provides: string;
  /** Who it describes, where that matters. */
  coverage: string;
  obtained: string;
  limitations: string;
  /** Whether reuse beyond this demonstration has been confirmed. */
  permission: string;
  permissionConfirmed: boolean;
  url: string;
}

/** The register of every evidence source, with its provenance and reuse status. */
export const EVIDENCE_SOURCES: EvidenceSource[] = [
  {
    name: "ClinVar",
    publisher: "NCBI",
    kind: "live",
    provides: "Current classification, review status, last-evaluated date and submission count for each monitored variant.",
    coverage: "Global submissions, dominated by European-ancestry cohorts.",
    obtained: "E-utilities at each sync in live mode; a snapshot verified identical to a live read on 25 Sep 2026 otherwise.",
    limitations: "Aggregates submitters; \"last evaluated\" is the submitters' date, not the date the aggregate changed.",
    permission: "Public NCBI data, reused under NCBI's data-use policies.",
    permissionConfirmed: true,
    url: "https://www.ncbi.nlm.nih.gov/clinvar/",
  },
  {
    name: "ClinVar archived releases",
    publisher: "NCBI",
    kind: "bundled",
    provides: "Each variant's classification at January 2023, 2024 and 2025, and September 2026.",
    coverage: "As ClinVar.",
    obtained: "variant_summary archives from the NCBI FTP site, re-checked on 25 Sep 2026.",
    limitations: "Four checkpoints only, so a change is dated to the first checkpoint that shows it.",
    permission: "Public NCBI data, reused under NCBI's data-use policies.",
    permissionConfirmed: true,
    url: "https://ftp.ncbi.nlm.nih.gov/pub/clinvar/tab_delimited/archive/",
  },
  {
    name: "gnomAD v4",
    publisher: "Broad Institute",
    kind: "bundled",
    provides: "Allele counts for the Middle Eastern genetic ancestry group and for all samples.",
    coverage: "About 3,000 people in the Middle Eastern group, out of roughly 800,000.",
    obtained: "The gnomAD API, dataset gnomad_r4, read on 25 Sep 2026.",
    limitations: "A small regional sample: frequency is context for a reviewer, never a classification. Three monitored variants are absent altogether.",
    permission: "Public data. Its terms for clinical and commercial use to be confirmed before production.",
    permissionConfirmed: false,
    url: "https://gnomad.broadinstitute.org/",
  },
  {
    name: "CTGA",
    publisher: "Centre for Arab Genomic Studies",
    kind: "bundled",
    provides: "The catalogue's clinical significance for three variants, quoted verbatim and attributed.",
    coverage: "Variants recorded in Arab patients; the three held here are UAE records.",
    obtained: "The CTGA database, read on 25 Sep 2026.",
    limitations: "Readings are quoted, never adopted, and cover three of fifteen variants.",
    permission: "Quoted with attribution. Permission for clinical or commercial reuse not yet confirmed with the publisher.",
    permissionConfirmed: false,
    url: "https://cags.org.ae/en/ctga-overview",
  },
  {
    name: "PubMed citations",
    publisher: "NCBI",
    kind: "bundled",
    provides: "Publications ClinVar links to each variant, with title, journal and year.",
    coverage: "As ClinVar.",
    obtained: "Resolved when the evidence snapshot was refreshed.",
    limitations: "Linked, not read: VariantPulse does not interpret the papers.",
    permission: "Bibliographic records, linked to PubMed.",
    permissionConfirmed: true,
    url: "https://pubmed.ncbi.nlm.nih.gov/",
  },
  {
    name: "Regional context notes",
    publisher: "This demonstration",
    kind: "curated",
    provides: "A short note per variant on why regional interpretation matters, and one review flag (HBB c.380T>G).",
    coverage: "Seven of fifteen variants.",
    obtained: "Written for the demonstration dataset, citing published papers.",
    limitations: "Context, not evidence about the variant. A pilot replaces it with the partner's own regional knowledge.",
    permission: "Original to VariantPulse.",
    permissionConfirmed: true,
    url: "https://pubmed.ncbi.nlm.nih.gov/35330423/",
  },
];

/**
 * Variants gnomAD v4 has only in its exome call set. The supplied counts for
 * these are the exome figures; every other observed variant's are the joint
 * exome-and-genome figures. Checked against the gnomAD API on 2026-09-25.
 */
const EXOME_ONLY = new Set(["BRCA2:c.7847C>T", "TP53:c.589G>A", "PTEN:c.149T>C", "HBB:c.380T>G"]);

function frequency(counts: AlleleCounts): AlleleFrequency {
  return {
    ...counts,
    frequency: counts.alleleNumber > 0 ? counts.alleleCount / counts.alleleNumber : null,
  };
}

function ctga(record: Omit<CatalogueRecord, "catalogue" | "code">): CatalogueRecord {
  return { catalogue: "CTGA", code: normaliseClassification(record.significance), ...record };
}

/** CTGA records, read from the CTGA database on 2026-09-25. */
const CATALOGUE: Record<string, CatalogueRecord> = {
  "HBB:c.364G>C": ctga({
    significance: "Likely Pathogenic, Pathogenic",
    countries: ["United Arab Emirates"],
    conditions: ["Beta-thalassemia", "Sickle cell anemia"],
    references: [
      "El-Kalla and Baysal, 1998",
      "Baysal, 2005",
      "Baysal, 2011",
      "Belhoul et al., 2013",
      "Baysal, 2017",
    ],
    listedSince: "2021-09-20",
    url: "https://cags.org.ae/en/ctga-variant-details/2706/hb-d-punjab-nm0005185c364gc",
  }),
  "MYBPC3:c.776delinsTT": ctga({
    significance: "Likely Pathogenic",
    countries: ["United Arab Emirates"],
    conditions: ["Left ventricular noncompaction 10"],
    references: ["Al-Shamsi et al., 2016"],
    listedSince: "2020-07-20",
    url: "https://cags.org.ae/en/ctga-variant-details/1210/nm0002563c776delinstt",
  }),
  "BRCA1:c.1140dup": ctga({
    significance: "Likely Pathogenic, Pathogenic",
    countries: ["United Arab Emirates", "Yemen"],
    conditions: ["Breast-ovarian cancer, familial, susceptibility to, 1"],
    references: ["Al-Ali et al., 2023", "Rawashdeh et al., 2024"],
    listedSince: "2024-01-23",
    url: "https://cags.org.ae/en/ctga-variant-details/4468/nm0072944c1140dup",
  }),
};

const MIDDLE_EASTERN_ANNOTATION: RegionalCitation = {
  pmid: "35330423",
  title: "Middle Eastern Genetic Variation Improves Clinical Annotation of the Human Genome.",
  journal: "J Pers Med",
  year: "2022",
};

const THALASSAEMIA_UAE: RegionalCitation = {
  pmid: "22074124",
  title: "Molecular basis of β-thalassemia in the United Arab Emirates.",
  journal: "Hemoglobin",
  year: "2011",
};

/** Context supplied with the dataset, with its modelled assertions removed. */
const CONTEXT: Record<string, RegionalContext> = {
  "HBB:c.380T>G": {
    note:
      "Beta-thalassaemia carrier status is common in the UAE and drives premarital and reproductive counselling, so a downgraded carrier result has family-planning consequences. No regional population data speaks to the reclassification either way; it needs a clinician's judgement, not the software's.",
    citations: [THALASSAEMIA_UAE, MIDDLE_EASTERN_ANNOTATION],
    flagForReview: true,
  },
  "CFTR:c.601G>A": {
    note:
      "A difference like this can point either way, and it rests on a handful of alleles in about 3,000 people, so VariantPulse raises it for a clinician rather than applying it.",
    citations: [
      {
        pmid: "41496868",
        title:
          "Highly Effective Modulator Therapy in Cystic Fibrosis: Addressing Unusual Variants in the Middle East.",
        journal: "Pulm Med",
        year: "2025",
      },
      MIDDLE_EASTERN_ANNOTATION,
    ],
    flagForReview: false,
  },
  "BRCA1:c.5056C>T": {
    note:
      "Population frequency can therefore neither support nor contradict the expert-panel reclassification.",
    citations: [
      {
        pmid: "42137137",
        title:
          "Ancestry-informative markers and variants of uncertain significance on hereditary cancer panels.",
        journal: "Front Oncol",
        year: "2026",
      },
      MIDDLE_EASTERN_ANNOTATION,
    ],
    flagForReview: false,
  },
  "LDLR:c.1381G>T": {
    note:
      "Rarity is compatible with a pathogenic reading but does not establish one. The familial hypercholesterolaemia mutation spectrum in Arab countries differs from European cohorts, which is why regional follow-up of LDLR results matters.",
    citations: [
      {
        pmid: "30415195",
        title: "Spectrum of mutations of familial hypercholesterolemia in the 22 Arab countries.",
        journal: "Atherosclerosis",
        year: "2018",
      },
    ],
    flagForReview: false,
  },
  "HBB:c.364G>C": {
    note:
      "Haemoglobin D-Punjab. CTGA's UAE records concern patients with sickle cell disease and beta-thalassaemia and cite work from 1998 onwards; in that sense the regional record was ahead of the global one.",
    citations: [THALASSAEMIA_UAE],
    flagForReview: false,
  },
  "MYBPC3:c.776delinsTT": {
    note:
      "The CTGA entry concerns a UAE patient with left ventricular non-compaction and cites a 2016 report.",
    citations: [],
    flagForReview: false,
  },
  "BRCA1:c.1140dup": {
    note:
      "It is a control: nothing has changed, so nothing is raised.",
    citations: [],
    flagForReview: false,
  },
};

export const REGIONAL_EVIDENCE: RegionalEvidence[] = PROVENANCE.map((entry) => {
  const inGnomad = entry.gnomad.global.alleleNumber > 0;
  return {
    variantKey: entry.key,
    gnomadVariantId: entry.grch38,
    inGnomad,
    callSet: inGnomad ? (EXOME_ONLY.has(entry.key) ? "exomes" : "joint") : null,
    global: inGnomad ? frequency(entry.gnomad.global) : null,
    middleEastern: inGnomad ? frequency(entry.gnomad.middleEastern) : null,
    catalogue: CATALOGUE[entry.key] ?? null,
    context: CONTEXT[entry.key] ?? null,
  };
});

export const REGIONAL_BY_KEY = new Map(REGIONAL_EVIDENCE.map((r) => [r.variantKey, r]));
