/**
 * The synthetic clinical dataset this workspace runs against.
 *
 * Every patient, record identifier, clinician and department below is
 * fabricated. None of it derives from a real person or a real health system.
 *
 * The variants are the opposite: each one is a real ClinVar record, and for
 * fourteen of the fifteen the historical classification is exactly what ClinVar
 * itself said about that variant in its January 2023 public release (NCBI
 * archive variant_summary_2023-01). Their classification, review status and
 * dbSNP identifier were re-checked against the GRCh38 rows of that archive on
 * 2026-09-25, so every drift on them is a real, dated reclassification that
 * anyone can verify; the release-by-release history is in `provenance.json`.
 *
 * The fifteenth, MYBPC3:c.776delinsTT, was not in ClinVar at all in January
 * 2023. Its "uncertain significance" is this synthetic hospital's own report of
 * a novel variant, and `historicalSource` says so rather than borrowing
 * ClinVar's authority.
 *
 * Two dates are kept apart on purpose. `historicalSource` is when ClinVar said
 * it; `recordedOn` and each patient's `testedOn` are when this synthetic
 * hospital reported it. The gap between the historical classification and the
 * live one is the thing VariantPulse exists to surface.
 */

import type { ClassificationCode } from "@/lib/classification";

/** Findings held in the connected record system, including the detailed set below. */
export const MONITORED_FINDING_COUNT = 12_482;

/** Where a historical classification came from. */
export interface HistoricalSource {
  /**
   * `clinvar-release`: read from a dated public ClinVar release.
   * `modelled-report`: no public classification existed, so the value is the
   * synthetic hospital's own report.
   */
  kind: "clinvar-release" | "modelled-report";
  name: string;
  /** Release identifier, `YYYY-MM`, for ClinVar releases. */
  release: string | null;
  label: string;
  shortLabel: string;
  file: string | null;
  /** Public directory the release file is archived in. */
  url: string | null;
}

export const CLINVAR_JAN_2023: HistoricalSource = {
  kind: "clinvar-release",
  name: "NCBI ClinVar",
  release: "2023-01",
  label: "January 2023",
  shortLabel: "Jan 2023",
  file: "variant_summary_2023-01.txt.gz",
  url: "https://ftp.ncbi.nlm.nih.gov/pub/clinvar/tab_delimited/archive/2023/",
};

export const MODELLED_HOSPITAL_REPORT: HistoricalSource = {
  kind: "modelled-report",
  name: "Synthetic hospital report",
  release: null,
  label: "Hospital report (modelled; not in ClinVar in January 2023)",
  shortLabel: "Hospital report",
  file: null,
  url: null,
};

export interface MonitoredVariant {
  /** `GENE:cDNA` — the join key across evidence sources. */
  key: string;
  gene: string;
  hgvsCoding: string;
  proteinChange: string | null;
  clinvarId: string;
  /** dbSNP identifier carried by the ClinVar record. */
  rsid: string | null;
  /** The interpretation on record, as given by `historicalSource`. */
  historicalClassification: ClassificationCode;
  /** The same classification exactly as ClinVar worded it; null when ClinVar held no record. */
  historicalClinvarText: string | null;
  /** ClinVar review status in that release; null when ClinVar held no record. */
  historicalReviewStatus: string | null;
  historicalSource: HistoricalSource;
  /** When this synthetic hospital issued its report. Not the ClinVar release date. */
  recordedOn: string;
  /** The internal note that accompanied the original report. Synthetic. */
  recordedEvidenceNote: string;
  condition: string;
  panel: string;
}

export const MONITORED_VARIANTS: MonitoredVariant[] = [
  {
    key: "BRCA1:c.5056C>T",
    gene: "BRCA1",
    hgvsCoding: "c.5056C>T",
    proteinChange: "p.His1686Tyr",
    clinvarId: "531444",
    rsid: "rs1555579648",
    historicalClassification: "VUS",
    historicalClinvarText: "Uncertain significance",
    historicalReviewStatus: "criteria provided, multiple submitters, no conflicts",
    historicalSource: CLINVAR_JAN_2023,
    recordedOn: "2023-03-14",
    recordedEvidenceNote:
      "Missense change in the BRCT domain. Public submissions were limited and in agreement on uncertain significance at the time of reporting.",
    condition: "Hereditary breast and ovarian cancer",
    panel: "Hereditary cancer panel",
  },
  {
    key: "BRCA2:c.7847C>T",
    gene: "BRCA2",
    hgvsCoding: "c.7847C>T",
    proteinChange: "p.Ser2616Phe",
    clinvarId: "630829",
    rsid: "rs1174303167",
    historicalClassification: "VUS",
    historicalClinvarText: "Uncertain significance",
    historicalReviewStatus: "criteria provided, multiple submitters, no conflicts",
    historicalSource: CLINVAR_JAN_2023,
    recordedOn: "2023-06-19",
    recordedEvidenceNote:
      "Missense change in the DNA-binding domain. Classified as uncertain significance; functional data not yet available.",
    condition: "Hereditary breast and ovarian cancer",
    panel: "Hereditary cancer panel",
  },
  {
    key: "TP53:c.589G>A",
    gene: "TP53",
    hgvsCoding: "c.589G>A",
    proteinChange: "p.Val197Met",
    clinvarId: "188060",
    rsid: "rs786204041",
    historicalClassification: "VUS",
    historicalClinvarText: "Uncertain significance",
    historicalReviewStatus: "criteria provided, multiple submitters, no conflicts",
    historicalSource: CLINVAR_JAN_2023,
    recordedOn: "2023-02-07",
    recordedEvidenceNote:
      "Missense change in the DNA-binding domain. Multiple submitters agreed on uncertain significance at the time of reporting.",
    condition: "Li-Fraumeni syndrome",
    panel: "Hereditary cancer panel",
  },
  {
    key: "LDLR:c.1381G>T",
    gene: "LDLR",
    hgvsCoding: "c.1381G>T",
    proteinChange: "p.Gly461Cys",
    clinvarId: "183113",
    rsid: "rs193922568",
    historicalClassification: "VUS",
    historicalClinvarText: "Uncertain significance",
    historicalReviewStatus: "criteria provided, multiple submitters, no conflicts",
    historicalSource: CLINVAR_JAN_2023,
    recordedOn: "2022-10-11",
    recordedEvidenceNote:
      "Missense change in the EGF-precursor homology domain. Reported as uncertain; segregation data not available.",
    condition: "Familial hypercholesterolaemia",
    panel: "Lipid disorders panel",
  },
  {
    key: "PTEN:c.149T>C",
    gene: "PTEN",
    hgvsCoding: "c.149T>C",
    proteinChange: "p.Ile50Thr",
    clinvarId: "492727",
    rsid: "rs1554893824",
    historicalClassification: "VUS",
    historicalClinvarText: "Uncertain significance",
    historicalReviewStatus: "criteria provided, single submitter",
    historicalSource: CLINVAR_JAN_2023,
    recordedOn: "2022-12-05",
    recordedEvidenceNote:
      "Missense change reported by a single submitter as uncertain significance.",
    condition: "PTEN hamartoma tumour syndrome",
    panel: "Hereditary cancer panel",
  },
  {
    key: "MYBPC3:c.26-2A>G",
    gene: "MYBPC3",
    hgvsCoding: "c.26-2A>G",
    proteinChange: null,
    clinvarId: "42644",
    rsid: "rs376395543",
    historicalClassification: "PATHOGENIC",
    historicalClinvarText: "Pathogenic/Likely pathogenic",
    historicalReviewStatus: "criteria provided, multiple submitters, no conflicts",
    historicalSource: CLINVAR_JAN_2023,
    recordedOn: "2022-08-16",
    recordedEvidenceNote:
      "Canonical splice-site change reported as pathogenic; family cascade testing and cardiac surveillance initiated.",
    condition: "Hypertrophic cardiomyopathy",
    panel: "Inherited cardiac conditions panel",
  },
  {
    key: "HBB:c.380T>G",
    gene: "HBB",
    hgvsCoding: "c.380T>G",
    proteinChange: "p.Val127Gly",
    clinvarId: "15483",
    rsid: "rs33925391",
    historicalClassification: "PATHOGENIC",
    historicalClinvarText: "Pathogenic/Likely pathogenic",
    historicalReviewStatus: "criteria provided, multiple submitters, no conflicts",
    historicalSource: CLINVAR_JAN_2023,
    recordedOn: "2023-01-30",
    recordedEvidenceNote:
      "Reported as pathogenic following abnormal haemoglobin studies. Carrier status communicated for reproductive planning.",
    condition: "Beta-thalassaemia / haemoglobinopathy",
    panel: "Haemoglobinopathy panel",
  },
  {
    key: "BRCA2:c.9538C>T",
    gene: "BRCA2",
    hgvsCoding: "c.9538C>T",
    proteinChange: "p.Leu3180Phe",
    clinvarId: "52865",
    rsid: "rs200598289",
    historicalClassification: "VUS",
    historicalClinvarText: "Uncertain significance",
    historicalReviewStatus: "criteria provided, multiple submitters, no conflicts",
    historicalSource: CLINVAR_JAN_2023,
    recordedOn: "2023-04-24",
    recordedEvidenceNote:
      "Missense change in the C-terminal region. Reported as uncertain significance.",
    condition: "Hereditary breast and ovarian cancer",
    panel: "Hereditary cancer panel",
  },
  {
    key: "TP53:c.784G>A",
    gene: "TP53",
    hgvsCoding: "c.784G>A",
    proteinChange: "p.Gly262Ser",
    clinvarId: "141228",
    rsid: "rs200579969",
    historicalClassification: "VUS",
    historicalClinvarText: "Uncertain significance",
    historicalReviewStatus: "reviewed by expert panel",
    historicalSource: CLINVAR_JAN_2023,
    recordedOn: "2022-09-13",
    recordedEvidenceNote:
      "Reported as uncertain significance by expert-panel criteria at the time.",
    condition: "Li-Fraumeni syndrome",
    panel: "Hereditary cancer panel",
  },
  {
    key: "BRCA1:c.5123C>T",
    gene: "BRCA1",
    hgvsCoding: "c.5123C>T",
    proteinChange: "p.Ala1708Val",
    clinvarId: "37640",
    rsid: "rs28897696",
    historicalClassification: "VUS",
    historicalClinvarText: "Uncertain significance",
    historicalReviewStatus: "criteria provided, multiple submitters, no conflicts",
    historicalSource: CLINVAR_JAN_2023,
    recordedOn: "2022-11-21",
    recordedEvidenceNote:
      "Missense change in the BRCT domain. Submitters agreed on uncertain significance at the time of reporting.",
    condition: "Hereditary breast and ovarian cancer",
    panel: "Hereditary cancer panel",
  },
  {
    key: "LDLR:c.2479G>A",
    gene: "LDLR",
    hgvsCoding: "c.2479G>A",
    proteinChange: "p.Val827Ile",
    clinvarId: "36462",
    rsid: "rs137853964",
    historicalClassification: "VUS",
    historicalClinvarText: "Uncertain significance",
    historicalReviewStatus: "reviewed by expert panel",
    historicalSource: CLINVAR_JAN_2023,
    recordedOn: "2022-07-04",
    recordedEvidenceNote:
      "Reported as uncertain significance by expert-panel criteria.",
    condition: "Familial hypercholesterolaemia",
    panel: "Lipid disorders panel",
  },
  {
    key: "CFTR:c.601G>A",
    gene: "CFTR",
    hgvsCoding: "c.601G>A",
    proteinChange: "p.Val201Met",
    clinvarId: "54022",
    rsid: "rs138338446",
    historicalClassification: "VUS",
    historicalClinvarText: "Uncertain significance",
    historicalReviewStatus: "reviewed by expert panel",
    historicalSource: CLINVAR_JAN_2023,
    recordedOn: "2023-05-02",
    recordedEvidenceNote:
      "Reported as uncertain significance by expert-panel criteria. No change to reproductive advice at the time.",
    condition: "Cystic fibrosis (carrier screening)",
    panel: "Carrier screening panel",
  },

  // -- Recorded in UAE patients in the Catalogue for Transmission Genetics in
  // Arabs (CTGA, Centre for Arab Genomic Studies). --
  {
    key: "HBB:c.364G>C",
    gene: "HBB",
    hgvsCoding: "c.364G>C",
    proteinChange: "p.Glu122Gln",
    clinvarId: "15152",
    rsid: "rs33946267",
    historicalClassification: "CONFLICTING",
    historicalClinvarText: "Conflicting interpretations of pathogenicity",
    historicalReviewStatus: "criteria provided, conflicting interpretations",
    historicalSource: CLINVAR_JAN_2023,
    recordedOn: "2023-02-14",
    recordedEvidenceNote:
      "Haemoglobin D-Punjab. Global submitters disagreed at the time of reporting, so the result was filed without a firm classification. CTGA already recorded it in UAE patients with sickle cell disease and beta-thalassaemia.",
    condition: "Haemoglobinopathy (Hb D-Punjab)",
    panel: "Haemoglobinopathy panel",
  },
  {
    key: "MYBPC3:c.776delinsTT",
    gene: "MYBPC3",
    hgvsCoding: "c.776delinsTT",
    proteinChange: "p.Ala259fs",
    clinvarId: "4689837",
    rsid: null,
    historicalClassification: "VUS",
    historicalClinvarText: null,
    historicalReviewStatus: null,
    historicalSource: MODELLED_HOSPITAL_REPORT,
    recordedOn: "2023-03-20",
    recordedEvidenceNote:
      "Novel frameshift change with no public submissions at the time of reporting. Classified as uncertain pending further evidence.",
    condition: "Left ventricular non-compaction / cardiomyopathy",
    panel: "Inherited cardiac conditions panel",
  },
  {
    key: "BRCA1:c.1140dup",
    gene: "BRCA1",
    hgvsCoding: "c.1140dup",
    proteinChange: "p.Lys381fs",
    clinvarId: "231732",
    rsid: "rs876659327",
    historicalClassification: "PATHOGENIC",
    historicalClinvarText: "Pathogenic",
    historicalReviewStatus: "reviewed by expert panel",
    historicalSource: CLINVAR_JAN_2023,
    recordedOn: "2022-10-03",
    recordedEvidenceNote:
      "Frameshift change reported as pathogenic by expert-panel criteria. Surveillance and cascade testing offered.",
    condition: "Hereditary breast and ovarian cancer",
    panel: "Hereditary cancer panel",
  },
];

export const VARIANT_BY_KEY = new Map(MONITORED_VARIANTS.map((v) => [v.key, v]));

/* -- Synthetic patient records -------------------------------------------- */

export type ReviewState = "Not reviewed" | "In review" | "Reviewed" | "Closed";

export interface PatientRecord {
  id: string;
  ageBand: string;
  sex: "Female" | "Male";
  variantKey: string;
  testedOn: string;
  reportingLab: string;
  orderingDepartment: string;
  clinicalOwner: string;
  lastContact: string;
  reviewState: ReviewState;
  /** Why the test was ordered. Kept non-specific by design. */
  indication: string;
}

const LAB = {
  core: "Genomics Core Laboratory",
  reference: "Partner Reference Laboratory",
  molecular: "Molecular Pathology Unit",
  cardiac: "Cardiac Genetics Laboratory",
} as const;

export const PATIENTS: PatientRecord[] = [
  // BRCA1:c.5056C>T — the headline: uncertain in January 2023, likely pathogenic
  // after expert-panel review. Four records, none reassessed since.
  {
    id: "VP-10247",
    ageBand: "45-54",
    sex: "Female",
    variantKey: "BRCA1:c.5056C>T",
    testedOn: "2023-03-14",
    reportingLab: LAB.core,
    orderingDepartment: "Clinical Genetics",
    clinicalOwner: "Dr. L. Haddad",
    lastContact: "2023-04-02",
    reviewState: "Not reviewed",
    indication: "Family history of breast cancer",
  },
  {
    id: "VP-10284",
    ageBand: "35-44",
    sex: "Female",
    variantKey: "BRCA1:c.5056C>T",
    testedOn: "2023-05-09",
    reportingLab: LAB.core,
    orderingDepartment: "Breast Surgery",
    clinicalOwner: "Dr. N. Farouk",
    lastContact: "2023-06-01",
    reviewState: "Not reviewed",
    indication: "Diagnostic work-up",
  },
  {
    id: "VP-10321",
    ageBand: "55-64",
    sex: "Female",
    variantKey: "BRCA1:c.5056C>T",
    testedOn: "2023-08-21",
    reportingLab: LAB.reference,
    orderingDepartment: "Oncology",
    clinicalOwner: "Dr. R. Okonjo",
    lastContact: "2024-01-15",
    reviewState: "Not reviewed",
    indication: "Treatment planning",
  },
  {
    id: "VP-10358",
    ageBand: "25-34",
    sex: "Male",
    variantKey: "BRCA1:c.5056C>T",
    testedOn: "2023-11-02",
    reportingLab: LAB.core,
    orderingDepartment: "Clinical Genetics",
    clinicalOwner: "Dr. L. Haddad",
    lastContact: "2023-11-20",
    reviewState: "Not reviewed",
    indication: "Cascade testing following a family result",
  },

  // BRCA2:c.7847C>T — uncertain to pathogenic.
  {
    id: "VP-10395",
    ageBand: "35-44",
    sex: "Female",
    variantKey: "BRCA2:c.7847C>T",
    testedOn: "2023-06-19",
    reportingLab: LAB.reference,
    orderingDepartment: "Oncology",
    clinicalOwner: "Dr. R. Okonjo",
    lastContact: "2023-09-10",
    reviewState: "Not reviewed",
    indication: "Early-onset breast cancer",
  },
  {
    id: "VP-10432",
    ageBand: "45-54",
    sex: "Male",
    variantKey: "BRCA2:c.7847C>T",
    testedOn: "2023-09-04",
    reportingLab: LAB.core,
    orderingDepartment: "Clinical Genetics",
    clinicalOwner: "Dr. M. Suleiman",
    lastContact: "2023-10-01",
    reviewState: "Not reviewed",
    indication: "Family history of pancreatic cancer",
  },

  // TP53:c.589G>A — uncertain to likely pathogenic, including a child tested
  // through cascade testing.
  {
    id: "VP-10469",
    ageBand: "25-34",
    sex: "Female",
    variantKey: "TP53:c.589G>A",
    testedOn: "2023-02-07",
    reportingLab: LAB.reference,
    orderingDepartment: "Oncology",
    clinicalOwner: "Dr. R. Okonjo",
    lastContact: "2023-05-18",
    reviewState: "Not reviewed",
    indication: "Early-onset malignancy",
  },
  {
    id: "VP-10506",
    ageBand: "5-11",
    sex: "Male",
    variantKey: "TP53:c.589G>A",
    testedOn: "2023-07-25",
    reportingLab: LAB.reference,
    orderingDepartment: "Clinical Genetics",
    clinicalOwner: "Dr. M. Suleiman",
    lastContact: "2023-08-30",
    reviewState: "Not reviewed",
    indication: "Cascade testing following a family result",
  },

  // LDLR:c.1381G>T — uncertain to likely pathogenic.
  {
    id: "VP-10543",
    ageBand: "35-44",
    sex: "Male",
    variantKey: "LDLR:c.1381G>T",
    testedOn: "2022-10-11",
    reportingLab: LAB.core,
    orderingDepartment: "Lipid Clinic",
    clinicalOwner: "Dr. H. Nassar",
    lastContact: "2024-02-06",
    reviewState: "Not reviewed",
    indication: "Persistently raised LDL cholesterol",
  },
  {
    id: "VP-10580",
    ageBand: "12-17",
    sex: "Female",
    variantKey: "LDLR:c.1381G>T",
    testedOn: "2023-01-23",
    reportingLab: LAB.core,
    orderingDepartment: "Lipid Clinic",
    clinicalOwner: "Dr. H. Nassar",
    lastContact: "2023-03-14",
    reviewState: "Not reviewed",
    indication: "Cascade testing following a family result",
  },

  // PTEN:c.149T>C — uncertain to pathogenic, in a paediatric record.
  {
    id: "VP-10617",
    ageBand: "5-11",
    sex: "Male",
    variantKey: "PTEN:c.149T>C",
    testedOn: "2022-12-05",
    reportingLab: LAB.molecular,
    orderingDepartment: "Paediatric Genetics",
    clinicalOwner: "Dr. S. Aziz",
    lastContact: "2023-06-12",
    reviewState: "Not reviewed",
    indication: "Macrocephaly with developmental delay",
  },

  // MYBPC3:c.26-2A>G — the reverse case: pathogenic/likely pathogenic in
  // January 2023, uncertain now, while a family is on cardiac surveillance.
  {
    id: "VP-10654",
    ageBand: "45-54",
    sex: "Male",
    variantKey: "MYBPC3:c.26-2A>G",
    testedOn: "2022-08-16",
    reportingLab: LAB.cardiac,
    orderingDepartment: "Cardiology",
    clinicalOwner: "Dr. P. Varga",
    lastContact: "2025-03-04",
    reviewState: "Not reviewed",
    indication: "Left ventricular hypertrophy on echo",
  },
  {
    id: "VP-10691",
    ageBand: "18-24",
    sex: "Female",
    variantKey: "MYBPC3:c.26-2A>G",
    testedOn: "2022-11-29",
    reportingLab: LAB.cardiac,
    orderingDepartment: "Cardiology",
    clinicalOwner: "Dr. P. Varga",
    lastContact: "2025-01-20",
    reviewState: "Not reviewed",
    indication: "Cascade testing following a family result",
  },

  // HBB:c.380T>G — pathogenic/likely pathogenic to uncertain, on a carrier
  // result from premarital screening. Carries regional context.
  {
    id: "VP-10728",
    ageBand: "25-34",
    sex: "Female",
    variantKey: "HBB:c.380T>G",
    testedOn: "2023-01-30",
    reportingLab: LAB.molecular,
    orderingDepartment: "Haematology",
    clinicalOwner: "Dr. F. Al Mazrouei",
    lastContact: "2023-02-22",
    reviewState: "Not reviewed",
    indication: "Premarital screening follow-up",
  },

  // BRCA2:c.9538C>T — uncertain to benign.
  {
    id: "VP-10765",
    ageBand: "45-54",
    sex: "Female",
    variantKey: "BRCA2:c.9538C>T",
    testedOn: "2023-04-24",
    reportingLab: LAB.core,
    orderingDepartment: "Breast Surgery",
    clinicalOwner: "Dr. N. Farouk",
    lastContact: "2023-05-15",
    reviewState: "Not reviewed",
    indication: "Family history of breast cancer",
  },
  {
    id: "VP-10802",
    ageBand: "35-44",
    sex: "Female",
    variantKey: "BRCA2:c.9538C>T",
    testedOn: "2023-10-16",
    reportingLab: LAB.reference,
    orderingDepartment: "Clinical Genetics",
    clinicalOwner: "Dr. L. Haddad",
    lastContact: "2023-11-06",
    reviewState: "Not reviewed",
    indication: "Family history of ovarian cancer",
  },

  // TP53:c.784G>A — uncertain to likely benign.
  {
    id: "VP-10839",
    ageBand: "55-64",
    sex: "Male",
    variantKey: "TP53:c.784G>A",
    testedOn: "2022-09-13",
    reportingLab: LAB.reference,
    orderingDepartment: "Oncology",
    clinicalOwner: "Dr. R. Okonjo",
    lastContact: "2023-01-10",
    reviewState: "Not reviewed",
    indication: "Treatment planning",
  },

  // BRCA1:c.5123C>T — uncertain to conflicting: submitters now disagree.
  {
    id: "VP-10876",
    ageBand: "35-44",
    sex: "Female",
    variantKey: "BRCA1:c.5123C>T",
    testedOn: "2022-11-21",
    reportingLab: LAB.core,
    orderingDepartment: "Clinical Genetics",
    clinicalOwner: "Dr. M. Suleiman",
    lastContact: "2022-12-12",
    reviewState: "Not reviewed",
    indication: "Family history of breast cancer",
  },

  // -- Classification unchanged since January 2023. ------------------------

  // LDLR:c.2479G>A — the control: nothing moved, so nothing is raised.
  {
    id: "VP-10913",
    ageBand: "45-54",
    sex: "Male",
    variantKey: "LDLR:c.2479G>A",
    testedOn: "2022-07-04",
    reportingLab: LAB.core,
    orderingDepartment: "Lipid Clinic",
    clinicalOwner: "Dr. H. Nassar",
    lastContact: "2023-07-19",
    reviewState: "Reviewed",
    indication: "Persistently raised LDL cholesterol",
  },
  {
    id: "VP-10950",
    ageBand: "35-44",
    sex: "Female",
    variantKey: "LDLR:c.2479G>A",
    testedOn: "2023-02-13",
    reportingLab: LAB.core,
    orderingDepartment: "Lipid Clinic",
    clinicalOwner: "Dr. H. Nassar",
    lastContact: "2023-08-01",
    reviewState: "Reviewed",
    indication: "Cascade testing following a family result",
  },

  // CFTR:c.601G>A — classification unchanged; its Middle Eastern frequency in
  // gnomAD v4 is what differs.
  {
    id: "VP-10987",
    ageBand: "25-34",
    sex: "Male",
    variantKey: "CFTR:c.601G>A",
    testedOn: "2023-05-02",
    reportingLab: LAB.molecular,
    orderingDepartment: "Clinical Genetics",
    clinicalOwner: "Dr. L. Haddad",
    lastContact: "2023-05-30",
    reviewState: "Reviewed",
    indication: "Premarital screening follow-up",
  },

  // -- CTGA-backed cases. --

  // HBB:c.364G>C — Hb D-Punjab: conflicting in January 2023, now
  // pathogenic/likely pathogenic.
  {
    id: "VP-10701",
    ageBand: "25-34",
    sex: "Female",
    variantKey: "HBB:c.364G>C",
    testedOn: "2023-02-14",
    reportingLab: LAB.molecular,
    orderingDepartment: "Haematology",
    clinicalOwner: "Dr. F. Al Mazrouei",
    lastContact: "2023-03-07",
    reviewState: "Not reviewed",
    indication: "Premarital screening follow-up",
  },
  {
    id: "VP-10738",
    ageBand: "5-11",
    sex: "Male",
    variantKey: "HBB:c.364G>C",
    testedOn: "2023-06-05",
    reportingLab: LAB.molecular,
    orderingDepartment: "Haematology",
    clinicalOwner: "Dr. F. Al Mazrouei",
    lastContact: "2024-01-22",
    reviewState: "Not reviewed",
    indication: "Anaemia work-up",
  },

  // MYBPC3:c.776delinsTT — reported by the hospital as a novel VUS; ClinVar's
  // first and only classification, years later, is likely pathogenic.
  {
    id: "VP-10775",
    ageBand: "35-44",
    sex: "Male",
    variantKey: "MYBPC3:c.776delinsTT",
    testedOn: "2023-03-20",
    reportingLab: LAB.cardiac,
    orderingDepartment: "Cardiology",
    clinicalOwner: "Dr. P. Varga",
    lastContact: "2024-06-11",
    reviewState: "Not reviewed",
    indication: "Cardiomyopathy on imaging",
  },
  {
    id: "VP-10812",
    ageBand: "12-17",
    sex: "Female",
    variantKey: "MYBPC3:c.776delinsTT",
    testedOn: "2023-07-17",
    reportingLab: LAB.cardiac,
    orderingDepartment: "Cardiology",
    clinicalOwner: "Dr. P. Varga",
    lastContact: "2023-09-04",
    reviewState: "Not reviewed",
    indication: "Cascade testing following a family result",
  },

  // BRCA1:c.1140dup — pathogenic then and now: the second control.
  {
    id: "VP-10849",
    ageBand: "45-54",
    sex: "Female",
    variantKey: "BRCA1:c.1140dup",
    testedOn: "2022-10-03",
    reportingLab: LAB.core,
    orderingDepartment: "Clinical Genetics",
    clinicalOwner: "Dr. L. Haddad",
    lastContact: "2024-10-15",
    reviewState: "Closed",
    indication: "Family history of breast cancer",
  },
];

export const PATIENT_BY_ID = new Map(PATIENTS.map((p) => [p.id, p]));

export function patientsForVariant(variantKey: string): PatientRecord[] {
  return PATIENTS.filter((p) => p.variantKey === variantKey);
}

/* -- Care team ------------------------------------------------------------ */

export interface Reviewer {
  id: string;
  name: string;
  role: string;
  department: string;
}

export const REVIEWERS: Reviewer[] = [
  { id: "usr-1", name: "Dr. L. Haddad", role: "Consultant Clinical Geneticist", department: "Clinical Genetics" },
  { id: "usr-2", name: "Dr. R. Okonjo", role: "Consultant Medical Oncologist", department: "Oncology" },
  { id: "usr-3", name: "Dr. M. Suleiman", role: "Consultant Clinical Geneticist", department: "Clinical Genetics" },
  { id: "usr-4", name: "Dr. P. Varga", role: "Consultant Cardiologist", department: "Cardiology" },
  { id: "usr-5", name: "Dr. S. Aziz", role: "Consultant Paediatric Neurologist", department: "Paediatric Neurology" },
  { id: "usr-6", name: "Dr. N. Farouk", role: "Consultant Breast Surgeon", department: "Breast Surgery" },
  { id: "usr-7", name: "Dr. H. Nassar", role: "Consultant in Metabolic Medicine", department: "Lipid Clinic" },
  { id: "usr-9", name: "Dr. F. Al Mazrouei", role: "Consultant Haematologist", department: "Haematology" },
  { id: "usr-8", name: "K. Mansour", role: "Senior Clinical Scientist", department: "Genomics Core Laboratory" },
];

/** The signed-in account this workspace renders for. */
export const CURRENT_USER = {
  name: "Dr. A. Kassim",
  initials: "A",
  role: "Consultant Clinical Geneticist",
  department: "Clinical Genetics",
  organisation: "Genomic Medicine Service",
};
