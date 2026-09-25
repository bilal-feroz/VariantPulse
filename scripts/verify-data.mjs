/**
 * Data coherence checks.
 *
 *   node scripts/verify-data.mjs
 *
 * These catch the failure modes that type-checking cannot see: a monitored
 * variant with no evidence record behind it, a patient pointing at a variant
 * that is not on the panel, or a reclassification whose evidence predates the
 * report it is supposed to have superseded.
 *
 * The last one matters most. If a hospital reported a variant in 2023 and the
 * source last evaluated it in 2018, then nothing changed after the report and
 * the whole premise of the case is wrong.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const root = (p) => resolve(HERE, "..", p);
// Normalised so the block parser below behaves the same on CRLF checkouts.
const read = (p) => readFileSync(root(p), "utf8").replace(/\r\n/g, "\n");

const failures = [];
const notes = [];
const fail = (message) => failures.push(message);

/* -- Parse the literals out of the data modules --------------------------- */

const workspaceSource = read("src/data/workspace.ts");
const regionalSource = read("src/data/regional.ts");
const snapshot = JSON.parse(read("src/data/evidence-snapshot.json"));

/** Pulls `field: "value"` pairs out of a TypeScript object literal list. */
function collectObjects(source, startMarker, fields) {
  const start = source.indexOf(startMarker);
  if (start === -1) throw new Error(`Could not find ${startMarker}`);
  // Bound the slice at the array's closing bracket so the next declaration in
  // the file is not swept in with it.
  const rest = source.slice(start + startMarker.length);
  const end = rest.indexOf("\n];");
  if (end === -1) throw new Error(`Could not find the end of ${startMarker}`);
  const blocks = rest.slice(0, end).split(/\n {2}\{\n/).slice(1);

  return blocks.map((block) => {
    const record = {};
    for (const field of fields) {
      const match = new RegExp(`${field}:\\s*"([^"]*)"`).exec(block);
      if (match) record[field] = match[1];
    }
    return record;
  });
}

const variants = collectObjects(workspaceSource, "MONITORED_VARIANTS: MonitoredVariant[] = [", [
  "key",
  "gene",
  "hgvsCoding",
  "clinvarId",
  "recordedClassification",
  "recordedOn",
]);

const patients = collectObjects(workspaceSource, "PATIENTS: PatientRecord[] = [", [
  "id",
  "variantKey",
  "testedOn",
]);

const regional = collectObjects(regionalSource, "REGIONAL_EVIDENCE: RegionalEvidence[] = [", [
  "variantKey",
  "assertion",
  "lastUpdated",
]);

const panelKeys = new Set(variants.map((v) => v.key));

/* -- Checks ---------------------------------------------------------------- */

if (variants.length === 0) fail("No monitored variants were parsed.");
if (patients.length === 0) fail("No patient records were parsed.");

for (const variant of variants) {
  const record = snapshot.records[variant.key];
  if (!record) {
    fail(`${variant.key} is on the panel but has no evidence snapshot record.`);
    continue;
  }
  if (record.clinvarId !== variant.clinvarId) {
    fail(
      `${variant.key} points at ClinVar ${variant.clinvarId} but the snapshot holds ${record.clinvarId}.`,
    );
  }
  // ClinVar sometimes carries the fully qualified form (NM_...:c.123A>G) in
  // this field, so a suffix match is the right comparison.
  if (record.cdnaChange && !record.cdnaChange.endsWith(variant.hgvsCoding)) {
    fail(
      `${variant.key} declares ${variant.hgvsCoding} but ClinVar reports ${record.cdnaChange}.`,
    );
  }
}

for (const key of Object.keys(snapshot.records)) {
  if (!panelKeys.has(key)) {
    fail(`Snapshot holds ${key}, which is no longer on the monitored panel.`);
  }
  for (const citation of snapshot.records[key].citations ?? []) {
    // A citation with no title renders as a link with no accessible name.
    if (!citation.title?.trim()) {
      fail(`${key} cites PMID ${citation.pmid} with no title.`);
    }
  }
}

for (const patient of patients) {
  if (!panelKeys.has(patient.variantKey)) {
    fail(`Patient ${patient.id} references ${patient.variantKey}, which is not on the panel.`);
  }
}

for (const entry of regional) {
  if (!panelKeys.has(entry.variantKey)) {
    fail(`Regional index holds ${entry.variantKey}, which is not on the panel.`);
  }
}

/* -- Narrative coherence --------------------------------------------------- */

const BAND = {
  PATHOGENIC: "pathogenic",
  LIKELY_PATHOGENIC: "pathogenic",
  VUS: "uncertain",
  LIKELY_BENIGN: "benign",
  BENIGN: "benign",
  CONFLICTING: "indeterminate",
  NOT_PROVIDED: "indeterminate",
};

function normalise(raw) {
  const value = (raw ?? "").toLowerCase();
  if (value.includes("conflicting")) return "CONFLICTING";
  if (value.includes("pathogenic/likely pathogenic")) return "PATHOGENIC";
  if (value.includes("benign/likely benign")) return "BENIGN";
  if (value.includes("likely pathogenic")) return "LIKELY_PATHOGENIC";
  if (value.includes("likely benign")) return "LIKELY_BENIGN";
  if (value.includes("pathogenic")) return "PATHOGENIC";
  if (value.includes("benign")) return "BENIGN";
  if (value === "vus" || value.includes("uncertain")) return "VUS";
  return "NOT_PROVIDED";
}

let changed = 0;
let conflicts = 0;

for (const variant of variants) {
  const record = snapshot.records[variant.key];
  if (!record) continue;

  const current = normalise(record.classification);
  const recorded = variant.recordedClassification;
  const moved = current !== recorded;

  if (moved) {
    changed += 1;
    if (record.lastEvaluated && record.lastEvaluated < variant.recordedOn) {
      fail(
        `${variant.key} is presented as reclassified since ${variant.recordedOn}, but the source last ` +
          `evaluated it on ${record.lastEvaluated}. Nothing changed after the report, so the case premise is false.`,
      );
    }
  }

  const regionalEntry = regional.find((r) => r.variantKey === variant.key);
  if (regionalEntry) {
    const a = BAND[current];
    const b = BAND[regionalEntry.assertion];
    if (a !== "indeterminate" && b !== "indeterminate" && a !== b) conflicts += 1;
  }

  // Every patient on a variant must have been tested before the evidence moved,
  // or the record would already carry the current interpretation.
  for (const patient of patients.filter((p) => p.variantKey === variant.key)) {
    if (moved && record.lastEvaluated && patient.testedOn > record.lastEvaluated) {
      fail(
        `Patient ${patient.id} was tested on ${patient.testedOn}, after ${variant.key} was ` +
          `re-evaluated on ${record.lastEvaluated}. That record would not carry the old interpretation.`,
      );
    }
  }
}

const impacted = new Set(
  patients
    .filter((p) => {
      const variant = variants.find((v) => v.key === p.variantKey);
      const record = variant && snapshot.records[variant.key];
      if (!variant || !record) return false;
      const current = normalise(record.classification);
      const regionalEntry = regional.find((r) => r.variantKey === variant.key);
      const a = BAND[current];
      const b = regionalEntry ? BAND[regionalEntry.assertion] : null;
      const regionalConflict =
        b !== null && a !== "indeterminate" && b !== "indeterminate" && a !== b;
      return current !== variant.recordedClassification || regionalConflict;
    })
    .map((p) => p.id),
);

notes.push(`${variants.length} variants on the panel, all backed by a ClinVar record`);
notes.push(`${patients.length} patient records, ${impacted.size} on a variant that moved`);
notes.push(`${changed} reclassifications, ${conflicts} regional conflicts`);

/* -- Report ---------------------------------------------------------------- */

for (const note of notes) console.log(`  ${note}`);

if (failures.length > 0) {
  console.error(`\n${failures.length} problem${failures.length === 1 ? "" : "s"}:\n`);
  for (const failure of failures) console.error(`  x ${failure}`);
  process.exit(1);
}

console.log("\nData is coherent.");
