/**
 * The synthetic clinical dataset this workspace runs against.
 *
 * Every patient, record identifier, clinician and department below is
 * fabricated. None of it derives from a real person or a real health system.
 *
 * The variants are the opposite: each one is a real ClinVar record, and the
 * `recordedClassification` field is what this synthetic hospital is modelled as
 * having reported at the time of testing. The gap between that field and the
 * live classification is the thing VariantPulse exists to surface.
 */

import type { ClassificationCode } from "@/lib/classification";

/** Findings held in the connected record system, including the detailed set below. */
export const MONITORED_FINDING_COUNT = 12_482;

export interface MonitoredVariant {
  /** `GENE:cDNA` — the join key across evidence sources. */
  key: string;
  gene: string;
  hgvsCoding: string;
  proteinChange: string | null;
  clinvarId: string;
  /** What this hospital reported when the results were issued. */
  recordedClassification: ClassificationCode;
  /** When this interpretation was last affirmed internally. */
  recordedOn: string;
  /** The internal note that accompanied the original report. */
  recordedEvidenceNote: string;
  condition: string;
  panel: string;
}

export const MONITORED_VARIANTS: MonitoredVariant[] = [
  {
    key: "BRCA1:c.5522G>T",
    gene: "BRCA1",
    hgvsCoding: "c.5522G>T",
    proteinChange: "p.Ser1841Ile",
    clinvarId: "869004",
    recordedClassification: "VUS",
    recordedOn: "2023-04-18",
    recordedEvidenceNote:
      "Missense change in the BRCT domain. Insufficient functional and segregation data at the time of reporting to classify beyond uncertain significance.",
    condition: "Hereditary breast and ovarian cancer",
    panel: "Hereditary cancer panel",
  },
  {
    key: "TP53:c.440T>G",
    gene: "TP53",
    hgvsCoding: "c.440T>G",
    proteinChange: "p.Val147Gly",
    clinvarId: "3602769",
    recordedClassification: "LIKELY_PATHOGENIC",
    recordedOn: "2023-09-02",
    recordedEvidenceNote:
      "DNA-binding domain missense change with supportive functional assay data. Reported as likely pathogenic pending further submissions.",
    condition: "Li-Fraumeni syndrome",
    panel: "Hereditary cancer panel",
  },
  {
    key: "SCN5A:c.3287A>G",
    gene: "SCN5A",
    hgvsCoding: "c.3287A>G",
    proteinChange: "p.Gln1096Arg",
    clinvarId: "4758118",
    recordedClassification: "VUS",
    recordedOn: "2022-06-27",
    recordedEvidenceNote:
      "Identified during an arrhythmia work-up. Population frequency data was limited at the time of reporting.",
    condition: "Cardiac arrhythmia / Brugada syndrome",
    panel: "Inherited cardiac conditions panel",
  },
  {
    key: "GLRA1:c.1214G>A",
    gene: "GLRA1",
    hgvsCoding: "c.1214G>A",
    proteinChange: "p.Arg405Gln",
    clinvarId: "352307",
    recordedClassification: "VUS",
    recordedOn: "2022-11-14",
    recordedEvidenceNote:
      "Reported in a neonatal hyperekplexia work-up. Classified as uncertain pending segregation data.",
    condition: "Hereditary hyperekplexia",
    panel: "Paediatric neurology panel",
  },
  {
    key: "LDLR:c.1706-10G>A",
    gene: "LDLR",
    hgvsCoding: "c.1706-10G>A",
    proteinChange: null,
    clinvarId: "226368",
    recordedClassification: "VUS",
    recordedOn: "2021-08-09",
    recordedEvidenceNote:
      "Intronic change near the splice acceptor. Splicing impact undetermined at the time of reporting.",
    condition: "Familial hypercholesterolaemia",
    panel: "Lipid disorders panel",
  },
  {
    key: "MSH2:c.1006C>G",
    gene: "MSH2",
    hgvsCoding: "c.1006C>G",
    proteinChange: "p.Pro336Ala",
    clinvarId: "4532893",
    recordedClassification: "VUS",
    recordedOn: "2023-02-21",
    recordedEvidenceNote:
      "Missense change identified during Lynch syndrome screening. Mismatch repair assay not performed.",
    condition: "Lynch syndrome",
    panel: "Hereditary cancer panel",
  },
  {
    key: "BRCA1:c.5585A>G",
    gene: "BRCA1",
    hgvsCoding: "c.5585A>G",
    proteinChange: "p.His1862Arg",
    clinvarId: "462678",
    recordedClassification: "VUS",
    recordedOn: "2023-06-30",
    recordedEvidenceNote:
      "Missense change with limited submission history. Reported as uncertain significance.",
    condition: "Hereditary breast and ovarian cancer",
    panel: "Hereditary cancer panel",
  },
  {
    key: "PALB2:c.682C>T",
    gene: "PALB2",
    hgvsCoding: "c.682C>T",
    proteinChange: "p.Gln228Ter",
    clinvarId: "484222",
    recordedClassification: "PATHOGENIC",
    recordedOn: "2022-03-12",
    recordedEvidenceNote:
      "Nonsense change predicted to result in loss of function. Reported as pathogenic with management guidance.",
    condition: "Hereditary breast cancer",
    panel: "Hereditary cancer panel",
  },
  {
    key: "APC:c.4399C>T",
    gene: "APC",
    hgvsCoding: "c.4399C>T",
    proteinChange: "p.Pro1467Ser",
    clinvarId: "411419",
    recordedClassification: "BENIGN",
    recordedOn: "2022-09-05",
    recordedEvidenceNote:
      "Observed at appreciable population frequency. Reported as benign and excluded from the clinical summary.",
    condition: "Familial adenomatous polyposis",
    panel: "Gastrointestinal cancer panel",
  },
  {
    key: "MLH1:c.1612T>G",
    gene: "MLH1",
    hgvsCoding: "c.1612T>G",
    proteinChange: "p.Trp538Gly",
    clinvarId: "633500",
    recordedClassification: "VUS",
    recordedOn: "2023-01-17",
    recordedEvidenceNote:
      "Missense change reviewed against mismatch repair criteria. Insufficient evidence to reclassify.",
    condition: "Lynch syndrome",
    panel: "Hereditary cancer panel",
  },
  {
    key: "BRCA2:c.9028C>A",
    gene: "BRCA2",
    hgvsCoding: "c.9028C>A",
    proteinChange: "p.His3010Asn",
    clinvarId: "4919695",
    recordedClassification: "VUS",
    recordedOn: "2023-11-08",
    recordedEvidenceNote:
      "Missense change outside the DNA-binding domain. Classified as uncertain significance.",
    condition: "Hereditary breast and ovarian cancer",
    panel: "Hereditary cancer panel",
  },
  {
    key: "MSH2:c.2083G>A",
    gene: "MSH2",
    hgvsCoding: "c.2083G>A",
    proteinChange: "p.Val695Met",
    clinvarId: "633496",
    recordedClassification: "PATHOGENIC",
    recordedOn: "2022-05-19",
    recordedEvidenceNote:
      "Classified as pathogenic by expert-panel criteria. Surveillance pathway initiated at the time of reporting.",
    condition: "Lynch syndrome",
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
  // BRCA1:c.5309G>T — four records, the case that drives the review queue.
  {
    id: "VP-10283",
    ageBand: "45-54",
    sex: "Female",
    variantKey: "BRCA1:c.5522G>T",
    testedOn: "2023-04-18",
    reportingLab: LAB.core,
    orderingDepartment: "Clinical Genetics",
    clinicalOwner: "Dr. L. Haddad",
    lastContact: "2023-05-02",
    reviewState: "Not reviewed",
    indication: "Family history of breast cancer",
  },
  {
    id: "VP-10491",
    ageBand: "35-44",
    sex: "Female",
    variantKey: "BRCA1:c.5522G>T",
    testedOn: "2023-05-22",
    reportingLab: LAB.core,
    orderingDepartment: "Breast Surgery",
    clinicalOwner: "Dr. N. Farouk",
    lastContact: "2023-06-11",
    reviewState: "Not reviewed",
    indication: "Diagnostic work-up",
  },
  {
    id: "VP-10822",
    ageBand: "55-64",
    sex: "Female",
    variantKey: "BRCA1:c.5522G>T",
    testedOn: "2023-08-30",
    reportingLab: LAB.reference,
    orderingDepartment: "Oncology",
    clinicalOwner: "Dr. R. Okonjo",
    lastContact: "2024-01-19",
    reviewState: "Not reviewed",
    indication: "Treatment planning",
  },
  {
    id: "VP-11034",
    ageBand: "25-34",
    sex: "Male",
    variantKey: "BRCA1:c.5522G>T",
    testedOn: "2023-11-06",
    reportingLab: LAB.core,
    orderingDepartment: "Clinical Genetics",
    clinicalOwner: "Dr. L. Haddad",
    lastContact: "2023-11-27",
    reviewState: "Not reviewed",
    indication: "Cascade testing following a family result",
  },

  // TP53:c.440T>G — evidence strengthened.
  {
    id: "VP-11290",
    ageBand: "35-44",
    sex: "Female",
    variantKey: "TP53:c.440T>G",
    testedOn: "2023-09-02",
    reportingLab: LAB.reference,
    orderingDepartment: "Oncology",
    clinicalOwner: "Dr. R. Okonjo",
    lastContact: "2024-03-04",
    reviewState: "Not reviewed",
    indication: "Early-onset malignancy",
  },
  {
    id: "VP-11317",
    ageBand: "18-24",
    sex: "Male",
    variantKey: "TP53:c.440T>G",
    testedOn: "2023-10-14",
    reportingLab: LAB.reference,
    orderingDepartment: "Clinical Genetics",
    clinicalOwner: "Dr. M. Suleiman",
    lastContact: "2023-12-02",
    reviewState: "Not reviewed",
    indication: "Cascade testing following a family result",
  },

  // SCN5A:c.3287A>G — evidence weakened.
  {
    id: "VP-10655",
    ageBand: "45-54",
    sex: "Male",
    variantKey: "SCN5A:c.3287A>G",
    testedOn: "2022-06-27",
    reportingLab: LAB.cardiac,
    orderingDepartment: "Cardiology",
    clinicalOwner: "Dr. P. Varga",
    lastContact: "2024-02-15",
    reviewState: "Not reviewed",
    indication: "Arrhythmia work-up",
  },
  {
    id: "VP-10708",
    ageBand: "35-44",
    sex: "Female",
    variantKey: "SCN5A:c.3287A>G",
    testedOn: "2022-08-19",
    reportingLab: LAB.cardiac,
    orderingDepartment: "Cardiology",
    clinicalOwner: "Dr. P. Varga",
    lastContact: "2023-09-28",
    reviewState: "Not reviewed",
    indication: "Cascade testing following a family result",
  },

  // GLRA1:c.1214G>A — regional conflict.
  {
    id: "VP-10914",
    ageBand: "0-4",
    sex: "Male",
    variantKey: "GLRA1:c.1214G>A",
    testedOn: "2022-11-14",
    reportingLab: LAB.molecular,
    orderingDepartment: "Paediatric Neurology",
    clinicalOwner: "Dr. S. Aziz",
    lastContact: "2024-04-08",
    reviewState: "Not reviewed",
    indication: "Neonatal presentation",
  },

  // LDLR:c.1706-10G>A — regional conflict.
  {
    id: "VP-10122",
    ageBand: "45-54",
    sex: "Male",
    variantKey: "LDLR:c.1706-10G>A",
    testedOn: "2021-08-09",
    reportingLab: LAB.core,
    orderingDepartment: "Lipid Clinic",
    clinicalOwner: "Dr. H. Nassar",
    lastContact: "2024-05-21",
    reviewState: "Not reviewed",
    indication: "Persistently raised LDL cholesterol",
  },

  // MSH2:c.1006C>G — consensus conflict.
  {
    id: "VP-11188",
    ageBand: "55-64",
    sex: "Female",
    variantKey: "MSH2:c.1006C>G",
    testedOn: "2023-02-21",
    reportingLab: LAB.reference,
    orderingDepartment: "Gastroenterology",
    clinicalOwner: "Dr. M. Suleiman",
    lastContact: "2023-04-30",
    reviewState: "Not reviewed",
    indication: "Lynch syndrome screening",
  },

  // -- Records on variants whose interpretation has not materially changed. --
  {
    id: "VP-10346",
    ageBand: "35-44",
    sex: "Female",
    variantKey: "BRCA1:c.5585A>G",
    testedOn: "2023-06-30",
    reportingLab: LAB.core,
    orderingDepartment: "Clinical Genetics",
    clinicalOwner: "Dr. L. Haddad",
    lastContact: "2023-07-18",
    reviewState: "Reviewed",
    indication: "Family history of breast cancer",
  },
  {
    id: "VP-10397",
    ageBand: "45-54",
    sex: "Female",
    variantKey: "BRCA1:c.5585A>G",
    testedOn: "2023-07-11",
    reportingLab: LAB.core,
    orderingDepartment: "Breast Surgery",
    clinicalOwner: "Dr. N. Farouk",
    lastContact: "2023-08-02",
    reviewState: "Reviewed",
    indication: "Diagnostic work-up",
  },
  {
    id: "VP-10423",
    ageBand: "25-34",
    sex: "Female",
    variantKey: "BRCA1:c.5585A>G",
    testedOn: "2023-09-19",
    reportingLab: LAB.reference,
    orderingDepartment: "Clinical Genetics",
    clinicalOwner: "Dr. M. Suleiman",
    lastContact: "2023-10-05",
    reviewState: "Reviewed",
    indication: "Cascade testing following a family result",
  },
  {
    id: "VP-10501",
    ageBand: "45-54",
    sex: "Female",
    variantKey: "PALB2:c.682C>T",
    testedOn: "2022-03-12",
    reportingLab: LAB.core,
    orderingDepartment: "Oncology",
    clinicalOwner: "Dr. R. Okonjo",
    lastContact: "2024-03-12",
    reviewState: "Closed",
    indication: "Treatment planning",
  },
  {
    id: "VP-10534",
    ageBand: "35-44",
    sex: "Female",
    variantKey: "PALB2:c.682C>T",
    testedOn: "2022-04-25",
    reportingLab: LAB.core,
    orderingDepartment: "Breast Surgery",
    clinicalOwner: "Dr. N. Farouk",
    lastContact: "2024-04-25",
    reviewState: "Closed",
    indication: "Family history of breast cancer",
  },
  {
    id: "VP-10570",
    ageBand: "55-64",
    sex: "Male",
    variantKey: "PALB2:c.682C>T",
    testedOn: "2022-07-08",
    reportingLab: LAB.reference,
    orderingDepartment: "Clinical Genetics",
    clinicalOwner: "Dr. L. Haddad",
    lastContact: "2024-01-30",
    reviewState: "Closed",
    indication: "Cascade testing following a family result",
  },
  {
    id: "VP-10611",
    ageBand: "45-54",
    sex: "Male",
    variantKey: "APC:c.4399C>T",
    testedOn: "2022-09-05",
    reportingLab: LAB.molecular,
    orderingDepartment: "Gastroenterology",
    clinicalOwner: "Dr. M. Suleiman",
    lastContact: "2022-09-29",
    reviewState: "Closed",
    indication: "Polyposis screening",
  },
  {
    id: "VP-10639",
    ageBand: "35-44",
    sex: "Female",
    variantKey: "APC:c.4399C>T",
    testedOn: "2022-10-17",
    reportingLab: LAB.molecular,
    orderingDepartment: "Gastroenterology",
    clinicalOwner: "Dr. M. Suleiman",
    lastContact: "2022-11-08",
    reviewState: "Closed",
    indication: "Polyposis screening",
  },
  {
    id: "VP-10684",
    ageBand: "55-64",
    sex: "Male",
    variantKey: "APC:c.4399C>T",
    testedOn: "2023-01-24",
    reportingLab: LAB.core,
    orderingDepartment: "Gastroenterology",
    clinicalOwner: "Dr. H. Nassar",
    lastContact: "2023-02-14",
    reviewState: "Closed",
    indication: "Family history of colorectal cancer",
  },
  {
    id: "VP-10742",
    ageBand: "25-34",
    sex: "Female",
    variantKey: "APC:c.4399C>T",
    testedOn: "2023-03-06",
    reportingLab: LAB.core,
    orderingDepartment: "Clinical Genetics",
    clinicalOwner: "Dr. L. Haddad",
    lastContact: "2023-03-28",
    reviewState: "Closed",
    indication: "Cascade testing following a family result",
  },
  {
    id: "VP-10788",
    ageBand: "45-54",
    sex: "Female",
    variantKey: "MLH1:c.1612T>G",
    testedOn: "2023-01-17",
    reportingLab: LAB.reference,
    orderingDepartment: "Gastroenterology",
    clinicalOwner: "Dr. M. Suleiman",
    lastContact: "2023-02-09",
    reviewState: "Reviewed",
    indication: "Lynch syndrome screening",
  },
  {
    id: "VP-10853",
    ageBand: "35-44",
    sex: "Male",
    variantKey: "MLH1:c.1612T>G",
    testedOn: "2023-02-28",
    reportingLab: LAB.reference,
    orderingDepartment: "Oncology",
    clinicalOwner: "Dr. R. Okonjo",
    lastContact: "2023-03-21",
    reviewState: "Reviewed",
    indication: "Treatment planning",
  },
  {
    id: "VP-10896",
    ageBand: "55-64",
    sex: "Female",
    variantKey: "MLH1:c.1612T>G",
    testedOn: "2023-04-11",
    reportingLab: LAB.core,
    orderingDepartment: "Clinical Genetics",
    clinicalOwner: "Dr. L. Haddad",
    lastContact: "2023-05-03",
    reviewState: "Reviewed",
    indication: "Family history of colorectal cancer",
  },
  {
    id: "VP-10958",
    ageBand: "25-34",
    sex: "Female",
    variantKey: "BRCA2:c.9028C>A",
    testedOn: "2023-11-08",
    reportingLab: LAB.core,
    orderingDepartment: "Clinical Genetics",
    clinicalOwner: "Dr. L. Haddad",
    lastContact: "2023-11-30",
    reviewState: "Reviewed",
    indication: "Family history of breast cancer",
  },
  {
    id: "VP-11002",
    ageBand: "35-44",
    sex: "Female",
    variantKey: "BRCA2:c.9028C>A",
    testedOn: "2023-12-12",
    reportingLab: LAB.core,
    orderingDepartment: "Breast Surgery",
    clinicalOwner: "Dr. N. Farouk",
    lastContact: "2024-01-08",
    reviewState: "Reviewed",
    indication: "Diagnostic work-up",
  },
  {
    id: "VP-11076",
    ageBand: "45-54",
    sex: "Male",
    variantKey: "BRCA2:c.9028C>A",
    testedOn: "2024-01-23",
    reportingLab: LAB.reference,
    orderingDepartment: "Oncology",
    clinicalOwner: "Dr. R. Okonjo",
    lastContact: "2024-02-14",
    reviewState: "Reviewed",
    indication: "Treatment planning",
  },
  {
    id: "VP-11125",
    ageBand: "55-64",
    sex: "Female",
    variantKey: "BRCA2:c.9028C>A",
    testedOn: "2024-02-29",
    reportingLab: LAB.core,
    orderingDepartment: "Clinical Genetics",
    clinicalOwner: "Dr. M. Suleiman",
    lastContact: "2024-03-20",
    reviewState: "Reviewed",
    indication: "Cascade testing following a family result",
  },
  {
    id: "VP-11201",
    ageBand: "45-54",
    sex: "Female",
    variantKey: "MSH2:c.2083G>A",
    testedOn: "2022-05-19",
    reportingLab: LAB.reference,
    orderingDepartment: "Gastroenterology",
    clinicalOwner: "Dr. M. Suleiman",
    lastContact: "2024-05-19",
    reviewState: "Closed",
    indication: "Lynch syndrome screening",
  },
  {
    id: "VP-11244",
    ageBand: "35-44",
    sex: "Male",
    variantKey: "MSH2:c.2083G>A",
    testedOn: "2022-07-30",
    reportingLab: LAB.reference,
    orderingDepartment: "Clinical Genetics",
    clinicalOwner: "Dr. L. Haddad",
    lastContact: "2024-02-02",
    reviewState: "Closed",
    indication: "Cascade testing following a family result",
  },
  {
    id: "VP-11352",
    ageBand: "55-64",
    sex: "Male",
    variantKey: "MSH2:c.2083G>A",
    testedOn: "2022-11-22",
    reportingLab: LAB.core,
    orderingDepartment: "Oncology",
    clinicalOwner: "Dr. R. Okonjo",
    lastContact: "2024-04-12",
    reviewState: "Closed",
    indication: "Treatment planning",
  },
  {
    id: "VP-11408",
    ageBand: "65+",
    sex: "Female",
    variantKey: "MSH2:c.2083G>A",
    testedOn: "2023-03-15",
    reportingLab: LAB.core,
    orderingDepartment: "Gastroenterology",
    clinicalOwner: "Dr. H. Nassar",
    lastContact: "2024-03-15",
    reviewState: "Closed",
    indication: "Family history of colorectal cancer",
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
