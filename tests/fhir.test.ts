import { describe, expect, it } from "vitest";

import { MONITORED_VARIANTS } from "@/data/workspace";
import { analyseWorkspace } from "@/lib/analysis";
import type { DecisionRecord } from "@/lib/decision";
import {
  FHIR_TASK_PRIORITY,
  TASK_DESCRIPTION,
  buildFhirBundle,
  fhirFileName,
  hgvsExpression,
  type FhirBundle,
  type FhirObservation,
  type FhirPatient,
  type FhirTask,
} from "@/lib/fhir";

const now = new Date("2026-09-25T14:00:00.000Z");

const decision: DecisionRecord = {
  decision: "Confirm change",
  note: "Reassessed against the expert-panel reading.",
  reviewer: "Dr. A. Kassim",
  at: "2026-09-25T13:00:00.000Z",
};

function sequentialUuid(): () => string {
  let next = 0;
  return () => `00000000-0000-4000-8000-${String(++next).padStart(12, "0")}`;
}

async function brca1Case() {
  const analysis = await analyseWorkspace({ mode: "demo" });
  const assessment = analysis.assessments.find((a) => a.variant.key === "BRCA1:c.5056C>T");
  if (!assessment?.caseId) throw new Error("The BRCA1 case is missing from the demo analysis.");
  return assessment;
}

const ofType = <T extends FhirBundle["entry"][number]["resource"]>(
  bundle: FhirBundle,
  type: T["resourceType"],
) => bundle.entry.map((e) => e.resource).filter((r): r is T => r.resourceType === type);

describe("FHIR R4 export", () => {
  it("builds a collection Bundle with a Patient, Observation and Task per affected record", async () => {
    const assessment = await brca1Case();
    const bundle = buildFhirBundle({ assessment, decision: null, now, uuid: sequentialUuid() });
    const records = assessment.impactedPatients.length;

    expect(bundle.resourceType).toBe("Bundle");
    expect(bundle.type).toBe("collection");
    expect(bundle.identifier.value).toBe(assessment.caseId);
    expect(bundle.timestamp).toBe(now.toISOString());
    expect(records).toBeGreaterThan(0);
    expect(ofType<FhirPatient>(bundle, "Patient")).toHaveLength(records);
    expect(ofType<FhirObservation>(bundle, "Observation")).toHaveLength(records);
    expect(ofType<FhirTask>(bundle, "Task")).toHaveLength(records);
  });

  it("resolves every reference within the bundle", async () => {
    const bundle = buildFhirBundle({ assessment: await brca1Case(), decision, now, uuid: sequentialUuid() });
    const urls = bundle.entry.map((e) => e.fullUrl);
    expect(new Set(urls).size).toBe(urls.length);
    for (const task of ofType<FhirTask>(bundle, "Task")) {
      expect(urls).toContain(task.focus.reference);
      expect(urls).toContain(task.for.reference);
    }
    for (const observation of ofType<FhirObservation>(bundle, "Observation")) {
      expect(urls).toContain(observation.subject.reference);
    }
  });

  it("carries nothing on a Patient but the synthetic record identifier", async () => {
    const bundle = buildFhirBundle({ assessment: await brca1Case(), decision: null, now });
    for (const patient of ofType<FhirPatient>(bundle, "Patient")) {
      expect(Object.keys(patient).sort()).toEqual(["id", "identifier", "meta", "resourceType"]);
      expect(patient.id).toMatch(/^VP-\d+$/);
      expect(patient.identifier).toEqual([{ system: "urn:variantpulse:record", value: patient.id }]);
      expect(patient.meta.tag[0].code).toBe("HTEST");
    }
  });

  it("records the variant assessment on the Observation", async () => {
    const assessment = await brca1Case();
    const pending = buildFhirBundle({ assessment, decision: null, now });
    const observation = ofType<FhirObservation>(pending, "Observation")[0];

    expect(observation.code.coding?.[0]).toMatchObject({ system: "http://loinc.org", code: "69548-6" });
    expect(observation.valueCodeableConcept).toEqual({
      coding: [{ system: "http://loinc.org", code: "LA26332-9", display: "Likely pathogenic" }],
      text: "Likely pathogenic",
    });
    expect(observation.component.map((c) => c.code.coding?.[0].code)).toEqual([
      "48018-6",
      "48004-6",
      "81252-9",
    ]);
    expect(observation.component[0].valueCodeableConcept.text).toBe("BRCA1");
    expect(observation.component[1].valueCodeableConcept.coding?.[0].code).toBe("NM_007294.4:c.5056C>T");
    expect(observation.component[2].valueCodeableConcept.coding?.[0]).toMatchObject({
      code: "531444",
      display: "VCV000531444",
    });
    expect(observation.note[0].text).toBe(
      "Previous classification: Uncertain significance, recorded 14 Mar 2023.",
    );
    expect(observation.status).toBe("preliminary");

    const confirmed = buildFhirBundle({ assessment, decision, now });
    expect(ofType<FhirObservation>(confirmed, "Observation")[0].status).toBe("final");
  });

  it("asks for a review Task prioritised from the case, with the decision as its note", async () => {
    const assessment = await brca1Case();
    const pending = ofType<FhirTask>(buildFhirBundle({ assessment, decision: null, now }), "Task")[0];

    expect(pending).toMatchObject({
      status: "requested",
      intent: "order",
      description: TASK_DESCRIPTION,
      priority: FHIR_TASK_PRIORITY[assessment.priority.level],
      authoredOn: now.toISOString(),
    });
    expect(pending.note).toBeUndefined();

    const decided = ofType<FhirTask>(buildFhirBundle({ assessment, decision, now }), "Task")[0];
    expect(decided.note).toEqual([
      {
        authorString: "Dr. A. Kassim",
        time: "2026-09-25T13:00:00.000Z",
        text: "Clinician decision: Confirm change. Reassessed against the expert-panel reading.",
      },
    ]);
  });

  it("never marks a review as an emergency", () => {
    expect(Object.values(FHIR_TASK_PRIORITY)).not.toContain("stat");
    expect(FHIR_TASK_PRIORITY.CRITICAL).toBe("asap");
  });

  it("names a full HGVS expression for every monitored variant", () => {
    for (const variant of MONITORED_VARIANTS) {
      expect(hgvsExpression(variant.key, variant.hgvsCoding)).toMatch(/^N[MRC]_\d+\.\d+:c\./);
    }
  });

  it("names the file after the case", () => {
    expect(fhirFileName("VP-R-2026-001")).toBe("VP-R-2026-001-fhir.json");
  });
});
