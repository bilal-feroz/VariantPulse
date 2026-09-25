/**
 * Data coherence checks.
 *
 *   node scripts/verify-data.mjs
 *
 * These catch the failure modes type-checking cannot see: a monitored variant
 * with no evidence behind it, identifiers that disagree between sources, a
 * patient pointing at a variant that is not on the panel, historical and current
 * evidence mixed up, a frequency outside 0–1, or a reclassification that the
 * supplied historical and current data cannot reproduce.
 *
 * The data modules are imported as the application imports them, and the counts
 * at the end come from the application's own engine run against the bundled
 * snapshot, so they are the numbers the interface shows with the network off.
 */

import "./lib/load-ts.mjs";

const { CLINVAR_JAN_2023, MONITORED_VARIANTS, PATIENTS, REVIEWERS } = await import("@/data/workspace");
const { PROVENANCE } = await import("@/data/provenance");
const { REGIONAL_EVIDENCE } = await import("@/data/regional");
const { CLASSIFICATIONS, detectChange, meta, normaliseClassification } = await import(
  "@/lib/classification"
);
const { readSnapshotEvidence } = await import("@/lib/clinvar");
const { buildAnalysis } = await import("@/lib/analysis");
const snapshot = (await import("@/data/evidence-snapshot.json")).default;

const failures = [];
const fail = (message) => failures.push(message);
const check = (condition, message) => {
  if (!condition) fail(message);
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** HGVS coding notation for the change types a single-variant panel carries. */
const HGVS_CODING =
  /^c\.[*-]?\d+(?:[+-]\d+)?(?:_[*-]?\d+(?:[+-]\d+)?)?(?:[ACGT]>[ACGT]|del(?:ins[ACGT]+)?|dup|ins[ACGT]+)$/;
const label = (key) => key.replace(":", " ");

/* -- 1. The rules themselves ------------------------------------------------ */

const NORMALISATION = [
  ["Pathogenic", "PATHOGENIC"],
  ["pathogenic", "PATHOGENIC"],
  ["Likely pathogenic", "LIKELY_PATHOGENIC"],
  ["LIKELY_PATHOGENIC", "LIKELY_PATHOGENIC"],
  ["Pathogenic/Likely pathogenic", "PATHOGENIC"],
  ["Likely Pathogenic, Pathogenic", "PATHOGENIC"],
  ["Pathogenic, low penetrance", "PATHOGENIC"],
  ["Benign", "BENIGN"],
  ["Likely benign", "LIKELY_BENIGN"],
  ["LIKELY_BENIGN", "LIKELY_BENIGN"],
  ["Benign/Likely benign", "BENIGN"],
  ["Uncertain significance", "VUS"],
  ["uncertain  significance", "VUS"],
  ["VUS", "VUS"],
  ["Conflicting classifications of pathogenicity", "CONFLICTING"],
  ["Conflicting interpretations of pathogenicity", "CONFLICTING"],
  ["Benign, Likely Pathogenic, Pathogenic, Uncertain Significance", "CONFLICTING"],
  ["not provided", "NOT_PROVIDED"],
  ["drug response", "NOT_PROVIDED"],
  ["", "NOT_PROVIDED"],
];
for (const [input, expected] of NORMALISATION) {
  const actual = normaliseClassification(input);
  check(actual === expected, `Normaliser maps "${input}" to ${actual}, expected ${expected}.`);
}

const DETECTION = [
  ["VUS", "LIKELY_PATHOGENIC", "CLASSIFICATION_DRIFT"],
  ["PATHOGENIC", "VUS", "CLASSIFICATION_DRIFT"],
  ["CONFLICTING", "PATHOGENIC", "CLASSIFICATION_DRIFT"],
  ["LIKELY_PATHOGENIC", "PATHOGENIC", "EVIDENCE_STRENGTHENED"],
  ["VUS", "BENIGN", "EVIDENCE_WEAKENED"],
  ["VUS", "CONFLICTING", "CONSENSUS_CONFLICT"],
  ["BENIGN", "BENIGN", "NO_MATERIAL_CHANGE"],
  ["LIKELY_BENIGN", "BENIGN", "NO_MATERIAL_CHANGE"],
  ["PATHOGENIC", "PATHOGENIC", "NO_MATERIAL_CHANGE"],
  ["VUS", "NOT_PROVIDED", "NO_MATERIAL_CHANGE"],
];
for (const [recorded, current, expected] of DETECTION) {
  const actual = detectChange(recorded, current).type;
  check(actual === expected, `${recorded} → ${current} is ${actual}, expected ${expected}.`);
}

/* -- 2. The monitored panel ------------------------------------------------- */

const panelKeys = new Set();
const clinvarIds = new Set();
for (const v of MONITORED_VARIANTS) {
  check(!panelKeys.has(v.key), `Duplicate variant key ${v.key}.`);
  check(!clinvarIds.has(v.clinvarId), `Duplicate ClinVar ID ${v.clinvarId}.`);
  panelKeys.add(v.key);
  clinvarIds.add(v.clinvarId);

  check(/^[A-Z0-9-]+$/.test(v.gene), `${v.key} has a malformed gene symbol.`);
  check(HGVS_CODING.test(v.hgvsCoding), `${v.key} has malformed HGVS coding notation "${v.hgvsCoding}".`);
  check(v.key === `${v.gene}:${v.hgvsCoding}`, `${v.key} is not keyed as GENE:hgvsCoding.`);
  check(/^\d+$/.test(v.clinvarId), `${v.key} has a malformed ClinVar ID.`);
  check(v.rsid === null || /^rs\d+$/.test(v.rsid), `${v.key} has a malformed rsID.`);
  check(v.proteinChange === null || /^p\./.test(v.proteinChange), `${v.key} protein change is not p. notation.`);
  check(ISO_DATE.test(v.recordedOn), `${v.key} has a malformed report date.`);

  check(v.historicalClassification in CLASSIFICATIONS, `${v.key} has unsupported historical code ${v.historicalClassification}.`);
  check(v.historicalClassification !== "NOT_PROVIDED", `${v.key} has no historical classification.`);

  if (v.historicalSource.kind === "clinvar-release") {
    check(v.historicalSource.release === CLINVAR_JAN_2023.release, `${v.key} cites a historical release other than ${CLINVAR_JAN_2023.release}.`);
    check(Boolean(v.historicalReviewStatus), `${v.key} has no historical review status.`);
    check(
      normaliseClassification(v.historicalClinvarText) === v.historicalClassification,
      `${v.key}: historical text "${v.historicalClinvarText}" does not normalise to ${v.historicalClassification}.`,
    );
  } else {
    check(v.historicalSource.kind === "modelled-report", `${v.key} has an unknown historical source kind.`);
    check(
      v.historicalClinvarText === null && v.historicalReviewStatus === null,
      `${v.key} is a modelled report but carries ClinVar wording or review status.`,
    );
  }
}
check(panelKeys.size > 0, "No monitored variants were loaded.");

/* -- 3. The snapshot: current evidence, and only current evidence ---------- */

const records = snapshot.records ?? {};
check(snapshot.recordCount === Object.keys(records).length, "Snapshot recordCount disagrees with its records.");
check(Object.keys(records).length === panelKeys.size, `Snapshot holds ${Object.keys(records).length} records for a panel of ${panelKeys.size}.`);
for (const key of Object.keys(records)) {
  check(panelKeys.has(key), `Snapshot holds ${key}, which is not on the panel.`);
}
check(Boolean(snapshot.provenance?.verifiedAgainstLive?.at), "Snapshot does not record when it was verified against live ClinVar.");

for (const v of MONITORED_VARIANTS) {
  const r = records[v.key];
  if (!r) {
    fail(`${v.key} is on the panel but has no evidence snapshot record.`);
    continue;
  }
  check(r.clinvarId === v.clinvarId, `${v.key}: panel ClinVar ${v.clinvarId}, snapshot ${r.clinvarId}.`);
  check(r.accession === `VCV${v.clinvarId.padStart(9, "0")}`, `${v.key}: accession ${r.accession} does not match ClinVar ${v.clinvarId}.`);
  check(r.gene === v.gene, `${v.key}: snapshot gene ${r.gene}.`);
  // ClinVar sometimes carries the fully qualified form (NM_...:c.123A>G).
  check(!r.cdnaChange || r.cdnaChange.endsWith(v.hgvsCoding), `${v.key}: ClinVar reports ${r.cdnaChange}.`);
  check(r.title.includes(`(${v.gene}):${v.hgvsCoding}`), `${v.key}: ClinVar title "${r.title}" names a different change.`);
  check(!v.proteinChange || r.title.includes(`(${v.proteinChange})`), `${v.key}: ClinVar title does not carry ${v.proteinChange}.`);
  check(r.rsid === v.rsid, `${v.key}: panel rsID ${v.rsid}, ClinVar ${r.rsid}.`);
  check(normaliseClassification(r.classification) !== "NOT_PROVIDED", `${v.key}: snapshot classification "${r.classification}" is unsupported.`);
  check(Boolean(r.reviewStatus), `${v.key}: snapshot has no review status.`);
  check(r.lastEvaluated === null || ISO_DATE.test(r.lastEvaluated), `${v.key}: malformed lastEvaluated.`);
  check(
    !Object.keys(r).some((field) => field.startsWith("historical")),
    `${v.key}: the current-evidence snapshot carries historical fields.`,
  );
  const pmids = new Set();
  for (const c of r.citations ?? []) {
    // A citation with no title renders as a link with no accessible name.
    check(Boolean(c.title?.trim()), `${v.key} cites PMID ${c.pmid} with no title.`);
    check(/^\d+$/.test(c.pmid), `${v.key} cites a malformed PMID "${c.pmid}".`);
    check(!pmids.has(c.pmid), `${v.key} cites PMID ${c.pmid} twice.`);
    pmids.add(c.pmid);
  }
}

/* -- 4. Provenance: the supplied release history --------------------------- */

const provenanceByKey = new Map(PROVENANCE.map((p) => [p.key, p]));
check(provenanceByKey.size === panelKeys.size, `provenance.json covers ${provenanceByKey.size} variants for a panel of ${panelKeys.size}.`);
for (const v of MONITORED_VARIANTS) {
  const p = provenanceByKey.get(v.key);
  if (!p) {
    fail(`${v.key} has no provenance record.`);
    continue;
  }
  check(p.clinvarId === v.clinvarId, `${v.key}: provenance ClinVar ${p.clinvarId}, panel ${v.clinvarId}.`);
  const first = p.releases.find((r) => r.release === CLINVAR_JAN_2023.release);
  const last = p.releases.at(-1);
  check(Boolean(first), `${v.key}: provenance has no ${CLINVAR_JAN_2023.release} entry.`);
  if (first) {
    // Historical and current evidence must never be swapped or blended.
    if (v.historicalSource.kind === "clinvar-release") {
      check(first.code === v.historicalClassification, `${v.key}: provenance says ${first.code} in ${first.release}, panel says ${v.historicalClassification}.`);
    } else {
      check(first.code === null, `${v.key} is modelled as absent from ClinVar in ${first.release}, but provenance holds ${first.code}.`);
    }
  }
  const record = records[v.key];
  if (last && record) {
    check(
      last.code === normaliseClassification(record.classification),
      `${v.key}: provenance says ${last.code} in ${last.release}, the snapshot says "${record.classification}".`,
    );
  }
  const carriers = PATIENTS.filter((patient) => patient.variantKey === v.key).length;
  check(p.patients === carriers, `${v.key}: provenance expects ${p.patients} patients, the records hold ${carriers}.`);
}

/* -- 5. Synthetic patients -------------------------------------------------- */

const patientIds = new Set();
const owners = new Set(REVIEWERS.map((r) => r.name));
for (const patient of PATIENTS) {
  check(!patientIds.has(patient.id), `Duplicate patient ID ${patient.id}.`);
  patientIds.add(patient.id);
  check(/^VP-\d{5}$/.test(patient.id), `Patient ${patient.id} does not use the synthetic VP-xxxxx form.`);
  check(panelKeys.has(patient.variantKey), `Patient ${patient.id} references ${patient.variantKey}, which is not on the panel.`);
  check(ISO_DATE.test(patient.testedOn) && ISO_DATE.test(patient.lastContact), `Patient ${patient.id} has a malformed date.`);
  check(patient.lastContact >= patient.testedOn, `Patient ${patient.id} was last contacted before being tested.`);
  check(owners.has(patient.clinicalOwner), `Patient ${patient.id} is owned by ${patient.clinicalOwner}, who is not on the care team.`);
}
for (const key of panelKeys) {
  check(PATIENTS.some((p) => p.variantKey === key), `${key} is monitored but no record carries it.`);
}

/* -- 6. Regional evidence --------------------------------------------------- */

const regionalKeys = new Set();
for (const entry of REGIONAL_EVIDENCE) {
  check(panelKeys.has(entry.variantKey), `Regional evidence holds ${entry.variantKey}, which is not on the panel.`);
  check(!regionalKeys.has(entry.variantKey), `Regional evidence holds ${entry.variantKey} twice.`);
  regionalKeys.add(entry.variantKey);
  check(entry.inGnomad === (entry.callSet !== null), `${entry.variantKey}: gnomAD presence and call set disagree.`);
  for (const [name, f] of [["global", entry.global], ["Middle Eastern", entry.middleEastern]]) {
    if (!f) {
      check(!entry.inGnomad, `${entry.variantKey}: in gnomAD but has no ${name} counts.`);
      continue;
    }
    check(Number.isInteger(f.alleleCount) && Number.isInteger(f.alleleNumber), `${entry.variantKey}: ${name} counts are not whole numbers.`);
    check(f.alleleCount >= 0 && f.alleleCount <= f.alleleNumber, `${entry.variantKey}: ${name} allele count exceeds allele number.`);
    if (f.frequency !== null) {
      check(f.frequency >= 0 && f.frequency <= 1, `${entry.variantKey}: ${name} frequency ${f.frequency} is outside 0–1.`);
      check(Math.abs(f.frequency - f.alleleCount / f.alleleNumber) < 1e-12, `${entry.variantKey}: ${name} frequency does not equal AC/AN.`);
    }
  }
  const p = provenanceByKey.get(entry.variantKey);
  if (p && entry.global && entry.middleEastern) {
    check(
      entry.global.alleleCount === p.gnomad.global.alleleCount &&
        entry.global.alleleNumber === p.gnomad.global.alleleNumber &&
        entry.middleEastern.alleleCount === p.gnomad.middleEastern.alleleCount &&
        entry.middleEastern.alleleNumber === p.gnomad.middleEastern.alleleNumber,
      `${entry.variantKey}: gnomAD counts differ from the supplied provenance.`,
    );
  }
  if (entry.catalogue) {
    check(normaliseClassification(entry.catalogue.significance) !== "NOT_PROVIDED", `${entry.variantKey}: CTGA significance is unreadable.`);
    check(entry.catalogue.url.startsWith("https://cags.org.ae/"), `${entry.variantKey}: CTGA link is not a CTGA page.`);
    check(ISO_DATE.test(entry.catalogue.listedSince), `${entry.variantKey}: malformed CTGA listing date.`);
  }
  for (const c of entry.context?.citations ?? []) {
    check(/^\d+$/.test(c.pmid) && Boolean(c.title), `${entry.variantKey}: regional citation ${c.pmid} is incomplete.`);
  }
}

/* -- 7. The engine: every verdict reproducible from the supplied data ------ */

const analysis = buildAnalysis(readSnapshotEvidence("verify-data"), new Date("2026-09-25T00:00:00Z"));
check(analysis.assessments.length === panelKeys.size, `The engine assessed ${analysis.assessments.length} of ${panelKeys.size} variants.`);

const caseIds = new Set();
for (const a of analysis.assessments) {
  const key = a.variant.key;
  const record = records[key];
  const expected = detectChange(a.variant.historicalClassification, normaliseClassification(record.classification)).type;
  check(a.verdict.type === expected, `${key}: engine verdict ${a.verdict.type} cannot be reproduced (${expected}).`);

  const p = provenanceByKey.get(key);
  const first = p?.releases.find((r) => r.release === CLINVAR_JAN_2023.release)?.code;
  const last = p?.releases.at(-1)?.code;
  if (first && last) {
    const moved = meta(first).band !== meta(last).band;
    check(
      moved === (a.verdict.type !== "NO_MATERIAL_CHANGE"),
      `${key}: provenance ${first} → ${last} but the engine says ${a.verdict.type}.`,
    );
  }

  const carriers = PATIENTS.filter((patient) => patient.variantKey === key).map((patient) => patient.id);
  check(
    JSON.stringify(a.impactedPatients.map((patient) => patient.id)) === JSON.stringify(carriers),
    `${key}: impacted records do not match the patients carrying it.`,
  );

  // No false alarms: an unchanged classification with no regional signal opens nothing.
  if (a.verdict.type === "NO_MATERIAL_CHANGE" && !a.regionalSignal.flagged) {
    check(a.caseId === null && !a.requiresReview, `${key} changed nothing but opened a review case.`);
  }
  if (a.caseId) {
    check(!caseIds.has(a.caseId), `Duplicate case ID ${a.caseId}.`);
    caseIds.add(a.caseId);
    check(a.impactedRecordCount > 0, `${key} opened a case with no records.`);
  }

  // The premise: evidence moved after the classification on record, and before
  // every record carrying it was reported with the old reading.
  if (a.verdict.type !== "NO_MATERIAL_CHANGE" && record.lastEvaluated) {
    const since =
      a.variant.historicalSource.kind === "clinvar-release"
        ? `${CLINVAR_JAN_2023.release}-01`
        : a.variant.recordedOn;
    check(
      record.lastEvaluated >= since,
      `${key} is presented as reclassified since ${since}, but ClinVar last evaluated it on ${record.lastEvaluated}.`,
    );
    for (const patient of a.impactedPatients) {
      check(
        patient.testedOn <= record.lastEvaluated,
        `Patient ${patient.id} was tested after ${key} was re-evaluated, so the record would not carry the old reading.`,
      );
    }
  }
}

/* -- Report ----------------------------------------------------------------- */

const m = analysis.metrics;
const byVerdict = (type) => analysis.assessments.filter((a) => a.verdict.type === type);
const changes = analysis.assessments.filter((a) =>
  ["CLASSIFICATION_DRIFT", "EVIDENCE_STRENGTHENED", "EVIDENCE_WEAKENED"].includes(a.verdict.type),
);
const againstRelease = changes.filter((a) => a.variant.historicalSource.kind === "clinvar-release");
const unchanged = byVerdict("NO_MATERIAL_CHANGE");
const silent = unchanged.filter((a) => !a.caseId);
const lead = analysis.reviewable[0];
const list = (items) => items.map((a) => label(a.variant.key)).join(", ");
const fromRelease = MONITORED_VARIANTS.filter((v) => v.historicalSource.kind === "clinvar-release").length;

console.log(`  ${MONITORED_VARIANTS.length} monitored ClinVar variants (${fromRelease} classified in ClinVar's ${CLINVAR_JAN_2023.label} release, ${MONITORED_VARIANTS.length - fromRelease} modelled hospital report)`);
console.log(`  ${PATIENTS.length} synthetic patient records`);
console.log(`  ${changes.length} reclassifications (${againstRelease.length} against the ${CLINVAR_JAN_2023.label} release, ${changes.length - againstRelease.length} against a modelled hospital report)`);
console.log(`  ${m.consensusConflicts} consensus conflict${m.consensusConflicts === 1 ? "" : "s"} (${list(byVerdict("CONSENSUS_CONFLICT"))})`);
console.log(`  ${m.regionalConflicts} regional evidence signal${m.regionalConflicts === 1 ? "" : "s"} (${list(analysis.regionalConflicts)})`);
console.log(`  ${unchanged.length} unchanged classifications: ${silent.length} raise nothing (${list(silent)})${unchanged.length > silent.length ? `, ${unchanged.length - silent.length} a regional signal only (${list(unchanged.filter((a) => a.caseId))})` : ""}`);
console.log(`  ${m.openCases} review cases covering ${m.patientsImpacted} synthetic patients`);
if (lead) {
  console.log(
    `  Lead case ${lead.caseId}: ${label(lead.variant.key)}, ${meta(lead.recordedCode).label} → ${meta(lead.currentCode).label}, ${lead.impactedRecordCount} patients, ${lead.priority.level}`,
  );
}

if (failures.length > 0) {
  console.error(`\n${failures.length} problem${failures.length === 1 ? "" : "s"}:\n`);
  for (const failure of failures) console.error(`  x ${failure}`);
  process.exit(1);
}

console.log("\nData is coherent.");
