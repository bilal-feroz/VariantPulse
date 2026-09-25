/**
 * The regional evidence index.
 *
 * Global variant databases are dominated by European-ancestry cohorts. A
 * variant that looks common and harmless in that reference set can behave very
 * differently in a population with different founder history and higher
 * consanguinity — which is exactly when an old report deserves a second look.
 *
 * Scope and honesty: the cohort counts and the per-variant `assertion` values
 * below are a MODELLED regional index built for this workspace. They are not
 * live extracts from any national programme or registry, and nothing here is
 * endorsed by the institutions named in the literature. The `citations` are
 * real, published papers that establish why regional interpretation can
 * diverge; they are supporting context, not per-variant assertions.
 */

import type { ClassificationCode } from "@/lib/classification";

export interface RegionalCitation {
  pmid: string;
  title: string;
  journal: string;
  year: string;
}

export interface RegionalEvidence {
  variantKey: string;
  /** The classification carried by this workspace's regional index. */
  assertion: ClassificationCode;
  /** Regional cohorts in which the variant has been observed. */
  observations: number;
  /** Size of the regional cohort the observations are drawn from. */
  cohortSize: number;
  /** Allele frequency within the regional cohort. */
  regionalFrequency: number | null;
  /** Allele frequency in the global reference set, for contrast. */
  globalFrequency: number | null;
  contributingCentres: string[];
  lastUpdated: string;
  /** Why the regional reading is what it is. */
  note: string;
  citations: RegionalCitation[];
}

export const REGIONAL_SOURCE = {
  name: "Regional Evidence Index",
  scope: "Arab and Gulf population evidence",
  provenance: "Modelled regional aggregation maintained inside this workspace",
  coverageNote:
    "Cohort counts and assertions are modelled for this workspace. Cited literature is real and is provided as supporting context.",
};

export const REGIONAL_EVIDENCE: RegionalEvidence[] = [
  {
    variantKey: "GLRA1:c.1214G>A",
    assertion: "LIKELY_PATHOGENIC",
    observations: 9,
    cohortSize: 4_120,
    regionalFrequency: 0.0011,
    globalFrequency: 0.000_21,
    contributingCentres: [
      "Paediatric Neurology Network",
      "Regional Neurogenetics Consortium",
      "Consanguinity Cohort Study",
    ],
    lastUpdated: "2026-01-22",
    note:
      "Observed in nine regional probands with a consistent neonatal hyperekplexia phenotype, several from consanguineous families where the change segregated with disease. Published work reports that GLRA1 genotype in hyperekplexia tracks with ethnicity, which is the mechanism by which a globally benign reading and a regional pathogenic reading can both be internally consistent.",
    citations: [
      {
        pmid: "24970905",
        title: "Ethnicity can predict GLRA1 genotypes in hyperekplexia.",
        journal: "J Neurol Neurosurg Psychiatry",
        year: "2015",
      },
      {
        pmid: "35841715",
        title: "Hereditary Hyperekplexia in Saudi Arabia.",
        journal: "Pediatr Neurol",
        year: "2022",
      },
      {
        pmid: "16832093",
        title: "Hyperekplexia in Kurdish families: a possible GLRA1 founder mutation.",
        journal: "Neurology",
        year: "2006",
      },
    ],
  },
  {
    variantKey: "LDLR:c.1706-10G>A",
    assertion: "LIKELY_PATHOGENIC",
    observations: 14,
    cohortSize: 6_850,
    regionalFrequency: 0.0021,
    globalFrequency: 0.0009,
    contributingCentres: [
      "Regional Lipid Registry",
      "Cardiovascular Genomics Programme",
      "Metabolic Medicine Network",
    ],
    lastUpdated: "2026-02-11",
    note:
      "Enriched in regional familial hypercholesterolaemia cohorts relative to the global reference set, with a splice-impact signal reported in affected families. The mutation spectrum of familial hypercholesterolaemia across Arab countries is documented as distinct from European cohorts, so a benign reading derived largely from European data does not settle the question here.",
    citations: [
      {
        pmid: "30415195",
        title: "Spectrum of mutations of familial hypercholesterolemia in the 22 Arab countries.",
        journal: "Atherosclerosis",
        year: "2018",
      },
      {
        pmid: "28868092",
        title:
          "The Spectrum of Familial Hypercholesterolemia (FH) in Saudi Arabia: Prime Time for Patient FH Registry.",
        journal: "Open Cardiovasc Med J",
        year: "2017",
      },
    ],
  },
  {
    variantKey: "BRCA1:c.5522G>T",
    assertion: "PATHOGENIC",
    observations: 3,
    cohortSize: 5_400,
    regionalFrequency: 0.000_28,
    globalFrequency: 0.000_31,
    contributingCentres: ["Regional Hereditary Cancer Network"],
    lastUpdated: "2026-03-04",
    note:
      "Regional observations are limited but fall in the same clinical band as the global consensus. No divergence to resolve.",
    citations: [],
  },
  {
    variantKey: "TP53:c.440T>G",
    assertion: "PATHOGENIC",
    observations: 2,
    cohortSize: 5_400,
    regionalFrequency: 0.000_18,
    globalFrequency: 0.000_2,
    contributingCentres: ["Regional Hereditary Cancer Network"],
    lastUpdated: "2026-02-27",
    note: "Regional cohorts agree with the global classification.",
    citations: [],
  },
  {
    variantKey: "MSH2:c.1006C>G",
    assertion: "VUS",
    observations: 4,
    cohortSize: 5_400,
    regionalFrequency: 0.000_37,
    globalFrequency: 0.000_4,
    contributingCentres: ["Regional Hereditary Cancer Network", "Gastrointestinal Genomics Group"],
    lastUpdated: "2026-01-09",
    note:
      "Regional observations remain uncertain. This does not resolve the disagreement among global submitters, but it does not add to it either.",
    citations: [],
  },
  {
    variantKey: "SCN5A:c.3287A>G",
    assertion: "LIKELY_BENIGN",
    observations: 11,
    cohortSize: 3_900,
    regionalFrequency: 0.0028,
    globalFrequency: 0.0031,
    contributingCentres: ["Inherited Cardiac Conditions Registry"],
    lastUpdated: "2026-03-18",
    note:
      "Regional frequency is consistent with the global reference set and supports the benign reading.",
    citations: [],
  },
  {
    variantKey: "PALB2:c.682C>T",
    assertion: "PATHOGENIC",
    observations: 5,
    cohortSize: 5_400,
    regionalFrequency: 0.000_46,
    globalFrequency: 0.000_44,
    contributingCentres: ["Regional Hereditary Cancer Network"],
    lastUpdated: "2026-02-02",
    note: "Loss-of-function mechanism is not population dependent. Regional and global readings agree.",
    citations: [],
  },
  {
    variantKey: "APC:c.4399C>T",
    assertion: "BENIGN",
    observations: 87,
    cohortSize: 5_400,
    regionalFrequency: 0.0161,
    globalFrequency: 0.0154,
    contributingCentres: ["Gastrointestinal Genomics Group"],
    lastUpdated: "2026-01-30",
    note: "Common in both regional and global cohorts. Benign in both readings.",
    citations: [],
  },
];

export const REGIONAL_BY_KEY = new Map(REGIONAL_EVIDENCE.map((r) => [r.variantKey, r]));
