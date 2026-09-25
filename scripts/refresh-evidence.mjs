/**
 * Refreshes the bundled ClinVar evidence snapshot.
 *
 * VariantPulse reads current evidence live from NCBI ClinVar at runtime. This
 * script captures the same records to disk so the workspace keeps working —
 * with an honest "cached" badge — when the upstream service is unreachable.
 *
 *   node scripts/refresh-evidence.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../src/data/evidence-snapshot.json");
const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

/** The variant panel this workspace monitors. Every id is a real ClinVar VCV record. */
const PANEL = [
  { key: "BRCA1:c.5056C>T", clinvarId: "531444" },
  { key: "BRCA2:c.7847C>T", clinvarId: "630829" },
  { key: "TP53:c.589G>A", clinvarId: "188060" },
  { key: "LDLR:c.1381G>T", clinvarId: "183113" },
  { key: "PTEN:c.149T>C", clinvarId: "492727" },
  { key: "MYBPC3:c.26-2A>G", clinvarId: "42644" },
  { key: "HBB:c.380T>G", clinvarId: "15483" },
  { key: "BRCA2:c.9538C>T", clinvarId: "52865" },
  { key: "TP53:c.784G>A", clinvarId: "141228" },
  { key: "BRCA1:c.5123C>T", clinvarId: "37640" },
  { key: "LDLR:c.2479G>A", clinvarId: "36462" },
  { key: "CFTR:c.601G>A", clinvarId: "54022" },
  { key: "HBB:c.364G>C", clinvarId: "15152" },
  { key: "MYBPC3:c.776delinsTT", clinvarId: "4689837" },
  { key: "BRCA1:c.1140dup", clinvarId: "231732" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url) {
  const res = await fetch(url, { headers: { "User-Agent": "VariantPulse/1.0" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

async function fetchSummaries(ids) {
  const data = await getJSON(
    `${EUTILS}/esummary.fcgi?db=clinvar&retmode=json&id=${ids.join(",")}`,
  );
  return data.result ?? {};
}

async function fetchCitations(id) {
  try {
    const data = await getJSON(
      `${EUTILS}/elink.fcgi?dbfrom=clinvar&db=pubmed&retmode=json&id=${id}`,
    );
    const sets = data.linksets?.[0]?.linksetdbs ?? [];
    const links = sets.find((s) => s.linkname?.includes("pubmed"))?.links ?? [];
    return links.slice(0, 8).map(String);
  } catch {
    return [];
  }
}

async function fetchArticles(pmids) {
  if (!pmids.length) return [];
  try {
    const data = await getJSON(
      `${EUTILS}/esummary.fcgi?db=pubmed&retmode=json&id=${pmids.join(",")}`,
    );
    const r = data.result ?? {};
    return (r.uids ?? [])
      .map((u) => {
        const record = r[u] ?? {};
        // Books and monographs carry their title in `booktitle` and leave
        // `title` empty, which would otherwise produce a citation with no
        // visible text and a link with no accessible name.
        const title = (record.title || record.booktitle || "").trim();
        const journal = (record.source || record.publishername || "").trim();
        return { pmid: u, title, journal, year: (record.pubdate ?? "").slice(0, 4) };
      })
      .filter((c) => c.title.length > 0);
  } catch {
    return [];
  }
}

/** Highest reported population allele frequency across the sources ClinVar carries. */
function peakAlleleFrequency(set = []) {
  let peak = null;
  for (const entry of set) {
    const value = Number(entry?.value);
    if (!Number.isFinite(value)) continue;
    if (peak === null || value > peak.value) {
      peak = { value, source: entry.source ?? "unknown" };
    }
  }
  return peak;
}

function normaliseDate(raw) {
  if (!raw) return null;
  const [date] = String(raw).split(" ");
  return date.replace(/\//g, "-") || null;
}

function shape(record, citations) {
  const variation = record.variation_set?.[0] ?? {};
  const xrefs = variation.variation_xrefs ?? [];
  const rs = xrefs.find((x) => x.db_source === "dbSNP")?.db_id;
  const loc =
    (variation.variation_loc ?? []).find((l) => l.assembly_name === "GRCh38") ??
    (variation.variation_loc ?? [])[0] ??
    {};
  const germline = record.germline_classification ?? {};
  const scv = record.supporting_submissions?.scv ?? [];

  return {
    clinvarId: record.uid,
    accession: record.accession,
    title: record.title,
    gene: record.genes?.[0]?.symbol ?? null,
    cdnaChange: variation.cdna_change ?? null,
    variantType: variation.variant_type ?? record.obj_type ?? null,
    molecularConsequence: (record.molecular_consequence_list ?? [])[0] ?? null,
    proteinChange: (record.protein_change ?? "").split(",")[0]?.trim() || null,
    rsid: rs ? `rs${rs}` : null,
    classification: germline.description ?? "not provided",
    reviewStatus: germline.review_status ?? "no assertion criteria provided",
    lastEvaluated: normaliseDate(germline.last_evaluated),
    fdaRecognised: record.fda_recognized_database === "true",
    submissionCount: scv.length,
    conditions: (germline.trait_set ?? [])
      .map((t) => t.trait_name)
      .filter((n) => n && n !== "not provided" && n !== "not specified"),
    location: loc.assembly_name
      ? {
          assembly: loc.assembly_name,
          chr: loc.chr,
          band: loc.band,
          start: loc.display_start,
          stop: loc.display_stop,
        }
      : null,
    peakAlleleFrequency: peakAlleleFrequency(variation.allele_freq_set),
    citations,
  };
}

async function main() {
  const ids = PANEL.map((p) => p.clinvarId);
  console.log(`Fetching ${ids.length} ClinVar records…`);
  const summaries = await fetchSummaries(ids);

  const records = {};
  for (const entry of PANEL) {
    const raw = summaries[entry.clinvarId];
    if (!raw || raw.error) {
      console.warn(`  ! no record for ${entry.key} (${entry.clinvarId})`);
      continue;
    }
    await sleep(350);
    const pmids = await fetchCitations(entry.clinvarId);
    await sleep(350);
    const citations = await fetchArticles(pmids);
    records[entry.key] = shape(raw, citations);
    const r = records[entry.key];
    console.log(
      `  ✓ ${entry.key.padEnd(22)} ${r.classification} · ${r.submissionCount} submissions · ${citations.length} citations`,
    );
  }

  const snapshot = {
    source: "NCBI ClinVar (E-utilities)",
    sourceUrl: "https://www.ncbi.nlm.nih.gov/clinvar/",
    capturedAt: new Date().toISOString(),
    recordCount: Object.keys(records).length,
    records,
  };

  writeFileSync(OUT, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`\nWrote ${snapshot.recordCount} records to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
