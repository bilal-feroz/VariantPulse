/**
 * The regional evidence index.
 *
 * Global variant databases are dominated by European-ancestry cohorts. A
 * variant that looks common and harmless in that reference set can behave very
 * differently in a population with different founder history and higher
 * consanguinity — which is exactly when an old report deserves a second look.
 *
 * Scope and honesty: `observations`, `cohortSize`, `regionalFrequency` and
 * `globalFrequency` are REAL figures from gnomAD v4 (Middle Eastern genetic
 * ancestry group vs all samples), pulled from the gnomAD API. The Middle
 * Eastern group is ~3,000 people out of ~800,000 (<0.4% of gnomAD), which is
 * the regional evidence gap this index exists to fill. The per-variant
 * `assertion` values and contributing centres are a MODELLED regional index
 * built for this workspace. They are not
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
    "Frequencies are real gnomAD v4 Middle Eastern figures. Regional assertions are modelled for this workspace. Cited literature is real and is provided as supporting context.",
};

export const REGIONAL_EVIDENCE: RegionalEvidence[] = [
  {
    variantKey: "HBB:c.380T>G",
    assertion: "PATHOGENIC",
    // gnomAD v4 Middle Eastern group: 0 alleles of 5768 (11-5225662-A-C)
    observations: 0,
    cohortSize: 2884,
    regionalFrequency: 0.0,
    globalFrequency: 2.1e-06,
    contributingCentres: ["Regional Haemoglobinopathy Network", "Premarital Screening Programme"],
    lastUpdated: "2026-05-12",
    note:
      "Global submitters downgraded this change to uncertain significance in April 2026. The regional index still carries the earlier pathogenic reading from haemoglobinopathy work-ups. Beta-thalassaemia carrier status is common in the UAE and drives premarital and reproductive counselling, so a disagreement here has direct family-planning consequences and must be resolved by a clinician, not by the software.",
    citations: [
      {"pmid": "22074124", "title": "Molecular basis of β-thalassemia in the United Arab Emirates.", "journal": "Hemoglobin", "year": "2011"},
      {"pmid": "35330423", "title": "Middle Eastern Genetic Variation Improves Clinical Annotation of the Human Genome.", "journal": "J Pers Med", "year": "2022"}
    ],
  },
  {
    variantKey: "CFTR:c.601G>A",
    assertion: "LIKELY_BENIGN",
    // gnomAD v4 Middle Eastern group: 4 alleles of 6060 (7-117535269-G-A)
    observations: 4,
    cohortSize: 3030,
    regionalFrequency: 0.0006601,
    globalFrequency: 0.0001685,
    contributingCentres: ["Carrier Screening Programme"],
    lastUpdated: "2026-03-02",
    note:
      "In gnomAD v4 this change is about four times more frequent in the Middle Eastern reference group than globally. Higher-than-expected population frequency is a recognised line of evidence toward a benign reading, but the Middle Eastern group is only about 3,000 people, so the signal is flagged for review rather than applied automatically.",
    citations: [
      {"pmid": "41496868", "title": "Highly Effective Modulator Therapy in Cystic Fibrosis: Addressing Unusual Variants in the Middle East.", "journal": "Pulm Med", "year": "2025"},
      {"pmid": "35330423", "title": "Middle Eastern Genetic Variation Improves Clinical Annotation of the Human Genome.", "journal": "J Pers Med", "year": "2022"}
    ],
  },
  {
    variantKey: "BRCA1:c.5056C>T",
    assertion: "LIKELY_PATHOGENIC",
    // Absent from gnomAD v4 (17-43067626-G-A); Middle Eastern group is 3,042 people
    observations: 0,
    cohortSize: 3_042,
    regionalFrequency: 0,
    globalFrequency: 0,
    contributingCentres: ["Regional Hereditary Cancer Network"],
    lastUpdated: "2026-02-18",
    note:
      "Absent from gnomAD v4 entirely, including its ~3,000 Middle Eastern individuals. Regional data neither supports nor contradicts the expert-panel reclassification; the global reading stands.",
    citations: [
      {"pmid": "42137137", "title": "Ancestry-informative markers and variants of uncertain significance on hereditary cancer panels.", "journal": "Front Oncol", "year": "2026"},
      {"pmid": "35330423", "title": "Middle Eastern Genetic Variation Improves Clinical Annotation of the Human Genome.", "journal": "J Pers Med", "year": "2022"}
    ],
  },
  {
    variantKey: "LDLR:c.1381G>T",
    assertion: "LIKELY_PATHOGENIC",
    // gnomAD v4 Middle Eastern group: 0 alleles of 6084 (19-11113557-G-T)
    observations: 0,
    cohortSize: 3042,
    regionalFrequency: 0.0,
    globalFrequency: 5e-06,
    contributingCentres: ["Regional Lipid Registry"],
    lastUpdated: "2026-01-27",
    note:
      "Consistent with the global expert-panel reading. The familial hypercholesterolaemia mutation spectrum in Arab countries differs from European cohorts, which is why regional follow-up of LDLR results matters.",
    citations: [
      {"pmid": "30415195", "title": "Spectrum of mutations of familial hypercholesterolemia in the 22 Arab countries.", "journal": "Atherosclerosis", "year": "2018"}
    ],
  },
  // -- CTGA-backed regional cases (Catalogue of Transmission Genetics in Arabs,
  // Centre for Arab Genomic Studies, cags.org.ae). Assertion = CTGA clinical
  // significance for UAE records. Frequencies = gnomAD v4. --
  {
    variantKey: "HBB:c.364G>C",
    assertion: "PATHOGENIC",
    // gnomAD v4 Middle Eastern: 11 of 6,062 alleles vs 717 of 1,614,096 globally (~4x enriched)
    observations: 11,
    cohortSize: 3_031,
    regionalFrequency: 0.0018146,
    globalFrequency: 0.0004442,
    contributingCentres: ["CTGA — Centre for Arab Genomic Studies (UAE records)"],
    lastUpdated: "2026-09-25",
    note:
      "Haemoglobin D-Punjab. CTGA records it in UAE patients as likely pathogenic / pathogenic for sickle cell disease and beta-thalassaemia, and it is about four times more frequent in gnomAD's Middle Eastern group than globally. Global ClinVar submitters were still in conflict in January 2023 and only converged on pathogenic / likely pathogenic in March 2026: regional evidence was ahead of the global record.",
    citations: [
      {"pmid":"22074124","title":"Molecular basis of β-thalassemia in the United Arab Emirates.","journal":"Hemoglobin","year":"2011"}
    ],
  },
  {
    variantKey: "MYBPC3:c.776delinsTT",
    assertion: "LIKELY_PATHOGENIC",
    // Absent from gnomAD v4
    observations: 0,
    cohortSize: 3_042,
    regionalFrequency: 0,
    globalFrequency: 0,
    contributingCentres: ["CTGA — Centre for Arab Genomic Studies (UAE records)"],
    lastUpdated: "2026-09-25",
    note:
      "CTGA lists this frameshift in a UAE patient as likely pathogenic for left ventricular non-compaction (record dated 2020). It did not appear in ClinVar until after January 2023 (first classified likely pathogenic, July 2025, single submitter). Another case where a regional catalogue carried the answer before global databases did.",
    citations: [],
  },
  {
    variantKey: "BRCA1:c.1140dup",
    assertion: "PATHOGENIC",
    // Absent from gnomAD v4
    observations: 0,
    cohortSize: 3_042,
    regionalFrequency: 0,
    globalFrequency: 0,
    contributingCentres: ["CTGA — Centre for Arab Genomic Studies (UAE and Yemen records)"],
    lastUpdated: "2026-09-25",
    note:
      "CTGA records this frameshift in a UAE family (Rawashdeh et al. 2024) and a Yemeni patient (Al-Ali et al. 2023). Regional and global readings agree: pathogenic. Included as a control, so the system shows it does not raise an alert when nothing has changed.",
    citations: [],
  },
];

export const REGIONAL_BY_KEY = new Map(REGIONAL_EVIDENCE.map((r) => [r.variantKey, r]));
