/**
 * FHIR R4 export of a review case, built by hand.
 *
 * One `collection` Bundle per case. For each affected record it carries three
 * resources, linked by `urn:uuid` references so the bundle stands on its own:
 *
 * - a Patient holding nothing but the synthetic record identifier, tagged as
 *   test data;
 * - an Observation, LOINC 69548-6 "Genetic variant assessment", whose value is
 *   the current classification and whose components give the gene, the HGVS c.
 *   notation and the ClinVar variation, with a note stating the classification
 *   on record and the date it was recorded;
 * - a Task asking for the record to be reviewed, prioritised from the case and
 *   annotated with the clinician's decision when one has been made.
 *
 * A Task can be `for` only one patient, which is why the three repeat per
 * record rather than the case sharing one Task.
 *
 * Nothing is inferred. Every value comes from the assessment, the case's
 * decision, or the transcript the verified dataset gives for the variant.
 */

import provenance from "@/data/provenance.json";
import type { VariantAssessment } from "./analysis";
import { meta, type ClassificationCode } from "./classification";
import type { DecisionRecord } from "./decision";
import type { PriorityLevel } from "./priority";
import { formatDate } from "./utils";

interface Coding {
  system?: string;
  code?: string;
  display?: string;
}

interface CodeableConcept {
  coding?: Coding[];
  text?: string;
}

interface Reference {
  reference: string;
}

interface Annotation {
  text: string;
  authorString?: string;
  time?: string;
}

interface Identifier {
  system: string;
  value: string;
}

export type TaskPriority = "routine" | "urgent" | "asap" | "stat";

export interface FhirPatient {
  resourceType: "Patient";
  id: string;
  meta: { tag: Coding[] };
  identifier: Identifier[];
}

export interface FhirObservation {
  resourceType: "Observation";
  id: string;
  status: "preliminary" | "final";
  category: CodeableConcept[];
  code: CodeableConcept;
  subject: Reference;
  effectiveDateTime?: string;
  issued: string;
  valueCodeableConcept: CodeableConcept;
  component: { code: CodeableConcept; valueCodeableConcept: CodeableConcept }[];
  note: Annotation[];
}

export interface FhirTask {
  resourceType: "Task";
  id: string;
  identifier: Identifier[];
  status: "requested";
  intent: "order";
  priority: TaskPriority;
  description: string;
  focus: Reference;
  for: Reference;
  authoredOn: string;
  note?: Annotation[];
}

export type FhirResource = FhirPatient | FhirObservation | FhirTask;

export interface FhirBundle {
  resourceType: "Bundle";
  id: string;
  identifier: Identifier;
  type: "collection";
  timestamp: string;
  entry: { fullUrl: string; resource: FhirResource }[];
}

const LOINC = "http://loinc.org";
const RECORD_SYSTEM = "urn:variantpulse:record";
const CASE_SYSTEM = "urn:variantpulse:case";

export const TASK_DESCRIPTION = "Review reclassified genetic variant";

/**
 * Case priority as a FHIR request priority. `stat` means an emergency, which a
 * review of changed evidence is not, so the scale tops out at `asap`.
 */
export const FHIR_TASK_PRIORITY: Record<PriorityLevel, TaskPriority> = {
  CRITICAL: "asap",
  HIGH: "urgent",
  MEDIUM: "routine",
  LOW: "routine",
};

/** LOINC answers for the ACMG classifications (answer list LL4034-6). */
const LOINC_CLASSIFICATION: Partial<Record<ClassificationCode, string>> = {
  PATHOGENIC: "LA6668-3",
  LIKELY_PATHOGENIC: "LA26332-9",
  VUS: "LA26333-7",
  LIKELY_BENIGN: "LA26334-5",
  BENIGN: "LA6675-8",
};

const TEST_DATA_TAG: Coding = {
  system: "http://terminology.hl7.org/CodeSystem/v3-ActReason",
  code: "HTEST",
  display: "test health data",
};

const loinc = (code: string, display: string): CodeableConcept => ({
  coding: [{ system: LOINC, code, display }],
  text: display,
});

/** RefSeq names from the verified dataset, e.g. `NM_007294.4(BRCA1):c.5056C>T (…)`. */
const DATASET_NAMES = new Map(
  (provenance as { key: string; name?: string }[]).map((entry) => [entry.key, entry.name ?? ""]),
);

/** The full HGVS expression, when the dataset names the transcript for this change. */
export function hgvsExpression(variantKey: string, cdna: string): string | null {
  const name = DATASET_NAMES.get(variantKey) ?? "";
  const transcript = /^(N[MRC]_\d+\.\d+)\(/.exec(name)?.[1];
  return transcript && name.includes(`):${cdna}`) ? `${transcript}:${cdna}` : null;
}

function classificationConcept(code: ClassificationCode): CodeableConcept {
  const label = meta(code).label;
  const answer = LOINC_CLASSIFICATION[code];
  return answer ? { coding: [{ system: LOINC, code: answer, display: label }], text: label } : { text: label };
}

/** A random v4 UUID, including where `randomUUID` is unavailable (insecure contexts). */
function randomUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface FhirExportInput {
  assessment: VariantAssessment;
  /** The decision in force, if the clinician has made one. */
  decision: DecisionRecord | null;
  now?: Date;
  /** Supplies `urn:uuid` identifiers; injectable so tests are deterministic. */
  uuid?: () => string;
}

export function buildFhirBundle({
  assessment,
  decision,
  now = new Date(),
  uuid = randomUuid,
}: FhirExportInput): FhirBundle {
  const { variant, evidence } = assessment;
  const caseId = assessment.caseId ?? variant.key;
  const timestamp = now.toISOString();
  const hgvs = hgvsExpression(variant.key, variant.hgvsCoding);

  const entry: FhirBundle["entry"] = [];

  for (const record of assessment.impactedPatients) {
    const patientUrl = `urn:uuid:${uuid()}`;
    const observationUrl = `urn:uuid:${uuid()}`;

    const patient: FhirPatient = {
      resourceType: "Patient",
      id: record.id,
      meta: { tag: [TEST_DATA_TAG] },
      identifier: [{ system: RECORD_SYSTEM, value: record.id }],
    };

    const observation: FhirObservation = {
      resourceType: "Observation",
      id: `${record.id}-assessment`,
      // Final only once a clinician has confirmed the change applies.
      status: decision?.decision === "Confirm change" ? "final" : "preliminary",
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/observation-category",
              code: "laboratory",
              display: "Laboratory",
            },
          ],
        },
      ],
      code: loinc("69548-6", "Genetic variant assessment"),
      subject: { reference: patientUrl },
      ...(evidence.lastEvaluated ? { effectiveDateTime: evidence.lastEvaluated } : {}),
      issued: timestamp,
      valueCodeableConcept: classificationConcept(assessment.currentCode),
      component: [
        {
          code: loinc("48018-6", "Gene studied [ID]"),
          valueCodeableConcept: { text: variant.gene },
        },
        {
          code: loinc("48004-6", "DNA change (c.HGVS)"),
          valueCodeableConcept: hgvs
            ? { coding: [{ system: "http://varnomen.hgvs.org", code: hgvs }], text: hgvs }
            : { text: variant.hgvsCoding },
        },
        {
          code: loinc("81252-9", "Discrete genetic variant"),
          valueCodeableConcept: {
            coding: [
              {
                system: "http://www.ncbi.nlm.nih.gov/clinvar",
                code: evidence.clinvarId,
                ...(evidence.accession ? { display: evidence.accession } : {}),
              },
            ],
            text: `ClinVar ${evidence.accession ?? evidence.clinvarId}`,
          },
        },
      ],
      note: [
        {
          text: `Previous classification: ${meta(assessment.recordedCode).label}, recorded ${formatDate(variant.recordedOn)}.`,
        },
      ],
    };

    const task: FhirTask = {
      resourceType: "Task",
      id: `${record.id}-review`,
      identifier: [{ system: CASE_SYSTEM, value: caseId }],
      status: "requested",
      intent: "order",
      priority: FHIR_TASK_PRIORITY[assessment.priority.level],
      description: TASK_DESCRIPTION,
      focus: { reference: observationUrl },
      for: { reference: patientUrl },
      authoredOn: timestamp,
      ...(decision
        ? {
            note: [
              {
                authorString: decision.reviewer,
                time: decision.at,
                text: `Clinician decision: ${decision.decision}. ${decision.note}`,
              },
            ],
          }
        : {}),
    };

    entry.push(
      { fullUrl: patientUrl, resource: patient },
      { fullUrl: observationUrl, resource: observation },
      { fullUrl: `urn:uuid:${uuid()}`, resource: task },
    );
  }

  return {
    resourceType: "Bundle",
    id: uuid(),
    identifier: { system: CASE_SYSTEM, value: caseId },
    type: "collection",
    timestamp,
    entry,
  };
}

export function fhirFileName(caseId: string): string {
  return `${caseId}-fhir.json`;
}
