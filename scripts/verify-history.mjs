/**
 * Historical versus current, variant by variant.
 *
 *   node scripts/verify-history.mjs            # the bundled snapshot, offline
 *   node scripts/verify-history.mjs --live     # also compare with live ClinVar
 *   node scripts/verify-history.mjs --archive  # also re-read ClinVar's January
 *                                              # 2023 archive (~150 MB, streamed)
 *
 * Prints, for every monitored variant, the classification on record and where
 * it came from, the release-by-release history, the current classification and
 * the verdict the engine reaches, so the demonstration can be reproduced by
 * anyone. `--live` reports where ClinVar has moved on since the snapshot without
 * touching it. `--archive` checks every historical value against NCBI's own
 * archived release and fails if one disagrees.
 */

import "./lib/load-ts.mjs";
import { Readable } from "node:stream";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";

const { CLINVAR_JAN_2023, MONITORED_VARIANTS } = await import("@/data/workspace");
const { CHANGE_TYPES, meta, normaliseClassification } = await import("@/lib/classification");
const { readSnapshotEvidence } = await import("@/lib/clinvar");
const { buildAnalysis } = await import("@/lib/analysis");

const args = new Set(process.argv.slice(2));
const failures = [];

const analysis = buildAnalysis(readSnapshotEvidence("verify-history"));

/* -- Optional: live ClinVar ------------------------------------------------- */

let live = null;
if (args.has("--live")) {
  const ids = MONITORED_VARIANTS.map((v) => v.clinvarId).join(",");
  try {
    const response = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=clinvar&retmode=json&tool=variantpulse&id=${ids}`,
      { headers: { "User-Agent": "VariantPulse/1.0" }, signal: AbortSignal.timeout(15_000) },
    );
    live = (await response.json()).result ?? null;
  } catch (error) {
    console.log(`Live ClinVar unreachable (${error.message}); showing the snapshot only.\n`);
  }
}

/* -- Optional: ClinVar's own January 2023 archive -------------------------- */

let archive = null;
if (args.has("--archive")) {
  const url = `https://ftp.ncbi.nlm.nih.gov/pub/clinvar/tab_delimited/archive/${CLINVAR_JAN_2023.release.slice(0, 4)}/${CLINVAR_JAN_2023.file}`;
  console.log(`Streaming ${url} …`);
  const wanted = new Set(MONITORED_VARIANTS.map((v) => v.clinvarId));
  archive = new Map();
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  const lines = createInterface({ input: Readable.fromWeb(response.body).pipe(createGunzip()) });
  for await (const line of lines) {
    const cols = line.split("\t");
    // Columns: 3 Name, 7 ClinicalSignificance, 10 RS#, 17 Assembly, 25 ReviewStatus, 31 VariationID.
    if (cols[16] === "GRCh38" && wanted.has(cols[30])) {
      archive.set(cols[30], { text: cols[6], reviewStatus: cols[24], rs: cols[9] });
    }
  }
  console.log(`Found ${archive.size} of ${wanted.size} monitored variants in the archive.\n`);
}

/* -- Report ----------------------------------------------------------------- */

const pad = (label) => `  ${label.padEnd(18)}`;

for (const a of analysis.assessments) {
  const v = a.variant;
  const e = a.evidence;
  const control = a.verdict.type === "NO_MATERIAL_CHANGE" && !a.caseId;

  console.log(`${control ? "CONTROL  " : ""}${v.gene} ${v.hgvsCoding}  (ClinVar ${v.clinvarId}${v.rsid ? `, ${v.rsid}` : ""})`);

  if (v.historicalSource.kind === "clinvar-release") {
    console.log(`${pad(`${v.historicalSource.shortLabel}:`)}${v.historicalClinvarText} — ${v.historicalReviewStatus}`);
  } else {
    console.log(`${pad("On record:")}${meta(v.historicalClassification).label} — synthetic hospital report, ${v.recordedOn}; not in ClinVar in ${CLINVAR_JAN_2023.label}`);
  }

  const later = a.releaseHistory.slice(1);
  if (later.length > 0) {
    console.log(
      `${pad("Release history:")}${later
        .map((r) => `${r.label} ${r.code ? meta(r.code).short : "not in ClinVar"}`)
        .join(" · ")}`,
    );
  }

  console.log(`${pad("Current snapshot:")}${e.classification} — ${e.reviewStatus}, last evaluated ${e.lastEvaluated}`);

  if (live) {
    const raw = live[v.clinvarId]?.germline_classification;
    if (!raw) {
      console.log(`${pad("Live ClinVar:")}no record returned`);
    } else if (raw.description === e.classification && raw.review_status === e.reviewStatus) {
      console.log(`${pad("Live ClinVar:")}same as the snapshot`);
    } else {
      console.log(`${pad("Live ClinVar:")}${raw.description} — ${raw.review_status} (differs from the snapshot; the snapshot is kept as the fallback)`);
    }
  }

  if (archive) {
    const row = archive.get(v.clinvarId);
    if (v.historicalSource.kind === "modelled-report") {
      if (row) failures.push(`${v.key} is modelled as absent in ${CLINVAR_JAN_2023.label}, but the archive holds "${row.text}".`);
      console.log(`${pad("Archive:")}${row ? `present ("${row.text}")` : "absent, as modelled"}`);
    } else if (!row) {
      failures.push(`${v.key} is missing from the ${CLINVAR_JAN_2023.label} archive.`);
      console.log(`${pad("Archive:")}missing`);
    } else {
      const same =
        row.text === v.historicalClinvarText &&
        row.reviewStatus === v.historicalReviewStatus &&
        `rs${row.rs}` === v.rsid &&
        normaliseClassification(row.text) === v.historicalClassification;
      if (!same) failures.push(`${v.key}: archive says "${row.text}" / ${row.reviewStatus} / rs${row.rs}.`);
      console.log(`${pad("Archive:")}${same ? "matches the historical classification" : `DIFFERS: "${row.text}" — ${row.reviewStatus}`}`);
    }
  }

  const change = CHANGE_TYPES[a.changeType].label;
  const regional =
    a.regionalSignal.flagged && a.changeType !== "REGIONAL_CONFLICT" ? " + regional signal" : "";
  console.log(
    `${pad("Result:")}${change}${regional} · ${a.impactedRecordCount} synthetic patient${a.impactedRecordCount === 1 ? "" : "s"} · ${a.caseId ? `case ${a.caseId} (${a.priority.level})` : "no case opened"}`,
  );
  console.log("");
}

if (failures.length > 0) {
  console.error(`${failures.length} historical value${failures.length === 1 ? "" : "s"} disagree with the archive:`);
  for (const failure of failures) console.error(`  x ${failure}`);
  process.exit(1);
}
