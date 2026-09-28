/**
 * Hospital data onboarding: a structured file of historical genetic results,
 * validated row by row before anything is accepted.
 *
 * The point is the report, not the parser. Every row ends up accepted,
 * accepted with warnings, or rejected, and every decision names the field and
 * the reason, so bad data is shown to the data steward rather than quietly
 * accepted. Checks cover missing fields, identifiers that look personal,
 * reference-genome builds, HGVS notation, identifiers that disagree with each
 * other, duplicates, and records that match nothing VariantPulse monitors.
 *
 * Pure and client-safe: a file is validated in the browser that opened it, and
 * nothing in it is sent anywhere.
 */

import type { VariantAssessment } from "./analysis";
import {
  detectChange,
  meta,
  normaliseClassification,
  type ChangeType,
  type ClassificationCode,
} from "./classification";
import { TRANSCRIPT, normaliseHgvs, panelTranscript } from "./hgvs";
import { MONITORED_VARIANTS, PATIENT_BY_ID, type MonitoredVariant } from "@/data/workspace";

/* -- Columns --------------------------------------------------------------- */

export type ColumnKey =
  | "record_id"
  | "gene"
  | "hgvs_c"
  | "transcript"
  | "clinvar_id"
  | "classification"
  | "report_date"
  | "genome_build"
  | "department"
  | "clinical_owner";

export interface ImportColumn {
  key: ColumnKey;
  label: string;
  required: boolean;
  /** Other headers a hospital export commonly uses for the same field. */
  aliases: string[];
  description: string;
  example: string;
}

export const IMPORT_COLUMNS: ImportColumn[] = [
  {
    key: "record_id",
    label: "Record ID",
    required: true,
    aliases: ["record", "record_ref", "patient_ref", "pseudonym", "study_id"],
    description: "A pseudonymous record key. Never a name, a national ID or contact details.",
    example: "PX-20011",
  },
  {
    key: "gene",
    label: "Gene",
    required: true,
    aliases: ["gene_symbol", "hgnc_symbol", "symbol"],
    description: "HGNC gene symbol.",
    example: "BRCA1",
  },
  {
    key: "hgvs_c",
    label: "HGVS (c.)",
    required: true,
    aliases: ["hgvs", "hgvs_coding", "c_hgvs", "cdna", "cdna_change", "variant"],
    description: "Coding-DNA HGVS notation. A transcript written inline is moved to its own field.",
    example: "c.5056C>T",
  },
  {
    key: "transcript",
    label: "Transcript",
    required: false,
    aliases: ["refseq", "refseq_transcript", "transcript_id", "nm"],
    description: "RefSeq transcript with its version.",
    example: "NM_007294.4",
  },
  {
    key: "clinvar_id",
    label: "ClinVar variation ID",
    required: false,
    aliases: ["clinvar", "clinvar_variation_id", "variation_id", "vcv"],
    description: "Numeric ClinVar variation ID or VCV accession. Checked against the HGVS.",
    example: "531444",
  },
  {
    key: "classification",
    label: "Reported classification",
    required: true,
    aliases: ["reported_classification", "interpretation", "significance", "acmg_classification"],
    description: "The classification as reported, in any common wording.",
    example: "Uncertain significance",
  },
  {
    key: "report_date",
    label: "Report date",
    required: true,
    aliases: ["reported_on", "date_reported", "test_date", "report_issued"],
    description: "YYYY-MM-DD. DD/MM/YYYY is read with a warning.",
    example: "2023-05-18",
  },
  {
    key: "genome_build",
    label: "Genome build",
    required: true,
    aliases: ["build", "assembly", "reference_genome", "genome"],
    description: "GRCh38 (hg38) or GRCh37 (hg19).",
    example: "GRCh38",
  },
  {
    key: "department",
    label: "Ordering department",
    required: false,
    aliases: ["ordering_department", "service", "specialty"],
    description: "Where the test was ordered.",
    example: "Clinical Genetics",
  },
  {
    key: "clinical_owner",
    label: "Clinical owner",
    required: false,
    aliases: ["owner", "clinician", "ordering_clinician", "responsible_clinician"],
    description: "The clinician responsible for the result.",
    example: "Dr. L. Haddad",
  },
];

const COLUMN_BY_KEY = new Map(IMPORT_COLUMNS.map((column) => [column.key, column]));

/** Rows checked in one file; enough for a pilot extract, bounded for a browser tab. */
export const MAX_ROWS = 5_000;

/* -- Parsing --------------------------------------------------------------- */

type Delimiter = "," | ";" | "\t";

function detectDelimiter(firstLine: string): Delimiter {
  const counts: Record<Delimiter, number> = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (const char of firstLine) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && char in counts) counts[char as Delimiter] += 1;
  }
  return (Object.keys(counts) as Delimiter[]).reduce((best, d) => (counts[d] > counts[best] ? d : best), ",");
}

/**
 * RFC 4180 parsing: quoted fields, doubled quotes, embedded delimiters and
 * newlines. Blank rows are dropped, and `lines` keeps the physical line each
 * remaining row starts on, so a report points at the line a person would find
 * in their editor, whatever came before it.
 */
export function parseDelimited(text: string): { delimiter: Delimiter; rows: string[][]; lines: number[] } {
  const source = text.replace(/^\uFEFF/, "");
  const firstLine = source.split(/\r\n|\n|\r/).find((candidate) => candidate.trim() !== "") ?? "";
  const delimiter = detectDelimiter(firstLine);
  const rows: string[][] = [];
  const lines: number[] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let line = 1;
  let rowStart = 1;

  const endRow = () => {
    row.push(field);
    if (row.some((cell) => cell.trim() !== "")) {
      rows.push(row);
      lines.push(rowStart);
    }
    row = [];
    field = "";
  };

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        // A newline inside quotes belongs to the value but still starts a new physical line.
        if (char === "\n" || (char === "\r" && source[i + 1] !== "\n")) line += 1;
        field += char;
      }
    } else if (char === '"' && field === "") {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i += 1;
      endRow();
      line += 1;
      rowStart = line;
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) endRow();

  return { delimiter, rows, lines };
}

function headerKey(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/* -- Report ---------------------------------------------------------------- */

export type Severity = "error" | "warning" | "info";

export interface ImportIssue {
  /** File line the issue is on; the header is line 1. */
  line: number;
  field: ColumnKey | null;
  severity: Severity;
  message: string;
}

export type RowStatus = "accepted" | "warnings" | "rejected";
export type MatchStatus = "matched" | "unmatched" | "conflict" | "not-checked";

export interface ImportRow {
  line: number;
  recordId: string;
  gene: string;
  hgvs: string;
  transcript: string | null;
  clinvarId: string | null;
  classification: ClassificationCode | null;
  reportDate: string | null;
  build: "GRCh38" | "GRCh37" | null;
  department: string;
  clinicalOwner: string;
  status: RowStatus;
  match: { status: MatchStatus; variantKey: string | null; basis: string | null };
  issues: ImportIssue[];
}

export interface ImportTotals {
  rows: number;
  accepted: number;
  withWarnings: number;
  rejected: number;
  matched: number;
  unmatched: number;
  conflicts: number;
  duplicates: number;
  grch37: number;
}

export interface ImportReport {
  fileName: string | null;
  delimiter: Delimiter;
  columns: {
    found: string[];
    mapped: Partial<Record<ColumnKey, string>>;
    unknown: string[];
    missingRequired: ColumnKey[];
  };
  /** Problems that stop the whole file from being read. */
  fileErrors: string[];
  /** Notes about the file as a whole that do not reject it. */
  fileNotes: string[];
  rows: ImportRow[];
  totals: ImportTotals;
}

const EMPTY_TOTALS: ImportTotals = {
  rows: 0,
  accepted: 0,
  withWarnings: 0,
  rejected: 0,
  matched: 0,
  unmatched: 0,
  conflicts: 0,
  duplicates: 0,
  grch37: 0,
};

/* -- Field checks ---------------------------------------------------------- */

const EMIRATES_ID = /^784[-\s]?\d{4}[-\s]?\d{7}[-\s]?\d$/;
const EMAIL = /\S+@\S+\.\S+/;
/** An international number written with its prefix: unmistakably contact details. */
const PHONE = /^\+\d[\d\s-]{7,}$|^00971\d{8,9}$/;
/** A UAE mobile number, which a numeric record key can also look like. */
const UAE_MOBILE = /^05\d{8}$/;
const PERSONAL_NAME = /^[A-Za-z][A-Za-z'.-]*(?:\s+[A-Za-z][A-Za-z'.-]*)+$/;

function checkRecordId(value: string): { severity: Severity; message: string } | null {
  if (EMIRATES_ID.test(value)) {
    return {
      severity: "error",
      message:
        "Looks like an Emirates ID. Import a pseudonymous record key instead: VariantPulse must never receive national identifiers.",
    };
  }
  if (EMAIL.test(value) || PHONE.test(value)) {
    return { severity: "error", message: "Looks like contact details. Import a pseudonymous record key instead." };
  }
  if (UAE_MOBILE.test(value)) {
    return {
      severity: "warning",
      message: "Has the shape of a UAE mobile number. Confirm it is a pseudonymous record key, not contact details.",
    };
  }
  if (PERSONAL_NAME.test(value)) {
    return { severity: "error", message: "Looks like a personal name. Import a pseudonymous record key instead." };
  }
  return null;
}

function parseBuild(raw: string): { build: "GRCh38" | "GRCh37" | null; exact: boolean } {
  // Patch releases (GRCh38.p14) share their coordinates with the major build.
  const value = raw.trim().toLowerCase().replace(/[\s_-]+/g, "").replace(/\.p\d+$/, "");
  if (["grch38", "hg38", "38", "b38"].includes(value)) return { build: "GRCh38", exact: raw.trim() === "GRCh38" };
  if (["grch37", "hg19", "37", "b37"].includes(value)) return { build: "GRCh37", exact: raw.trim() === "GRCh37" };
  return { build: null, exact: false };
}

function validIsoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

function parseReportDate(raw: string): { iso: string | null; dayFirst: boolean } {
  const value = raw.trim();
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) return { iso: validIsoDate(Number(match[1]), Number(match[2]), Number(match[3])), dayFirst: false };
  match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (match) return { iso: validIsoDate(Number(match[3]), Number(match[2]), Number(match[1])), dayFirst: true };
  return { iso: null, dayFirst: false };
}

const label = (key: ColumnKey) => COLUMN_BY_KEY.get(key)?.label ?? key;
const variantName = (variant: Pick<MonitoredVariant, "gene" | "hgvsCoding">) =>
  `${variant.gene} ${variant.hgvsCoding}`;

/* -- Validation ------------------------------------------------------------ */

export interface ValidateOptions {
  fileName?: string | null;
  /** Today, `YYYY-MM-DD`; report dates after it are rejected. */
  today: string;
  variants?: readonly MonitoredVariant[];
}

export function validateImport(text: string, options: ValidateOptions): ImportReport {
  const variants = options.variants ?? MONITORED_VARIANTS;
  const byKey = new Map(variants.map((v) => [v.key, v]));
  const byClinvar = new Map(variants.map((v) => [v.clinvarId, v]));
  const { delimiter, rows: table, lines: lineOf } = parseDelimited(text);

  const report: ImportReport = {
    fileName: options.fileName ?? null,
    delimiter,
    columns: { found: [], mapped: {}, unknown: [], missingRequired: [] },
    fileErrors: [],
    fileNotes: [],
    rows: [],
    totals: { ...EMPTY_TOTALS },
  };

  if (table.length === 0) {
    report.fileErrors.push("The file is empty.");
    return report;
  }

  // Map each header onto a column, by name or by a common alias.
  const header = table[0].map((cell) => cell.trim());
  report.columns.found = header;
  const indexOf = new Map<ColumnKey, number>();
  header.forEach((cell, index) => {
    const key = headerKey(cell);
    const column = IMPORT_COLUMNS.find((c) => c.key === key || c.aliases.includes(key));
    if (column && !indexOf.has(column.key)) {
      indexOf.set(column.key, index);
      report.columns.mapped[column.key] = cell;
    } else if (!column) {
      report.columns.unknown.push(cell);
    }
  });
  report.columns.missingRequired = IMPORT_COLUMNS.filter((c) => c.required && !indexOf.has(c.key)).map(
    (c) => c.key,
  );
  if (report.columns.missingRequired.length > 0) {
    report.fileErrors.push(
      `Missing required column${report.columns.missingRequired.length === 1 ? "" : "s"}: ${report.columns.missingRequired.map(label).join(", ")}. No rows were read.`,
    );
    return report;
  }
  if (report.columns.unknown.length > 0) {
    report.fileNotes.push(
      `Ignored column${report.columns.unknown.length === 1 ? "" : "s"} not in the template: ${report.columns.unknown.join(", ")}.`,
    );
  }

  let body = table.slice(1);
  let bodyLines = lineOf.slice(1);
  if (body.length > MAX_ROWS) {
    report.fileNotes.push(`Only the first ${MAX_ROWS.toLocaleString("en-US")} of ${body.length.toLocaleString("en-US")} rows were checked.`);
    body = body.slice(0, MAX_ROWS);
    bodyLines = bodyLines.slice(0, MAX_ROWS);
  }
  if (body.length === 0) {
    report.fileErrors.push("The file has a header but no rows.");
    return report;
  }

  const seen = new Map<string, number>();

  body.forEach((cells, index) => {
    const line = bodyLines[index] ?? index + 2;
    const cell = (key: ColumnKey) => {
      const at = indexOf.get(key);
      return at === undefined ? "" : (cells[at] ?? "").trim();
    };
    const issues: ImportIssue[] = [];
    const issue = (field: ColumnKey | null, severity: Severity, message: string) =>
      issues.push({ line, field, severity, message });

    for (const column of IMPORT_COLUMNS) {
      if (column.required && !cell(column.key)) issue(column.key, "error", `${column.label} is missing.`);
    }

    // A value with an unquoted delimiter in it shifts every field after it.
    const extra = cells.slice(header.length).filter((value) => value.trim() !== "");
    if (extra.length > 0) {
      issue(
        null,
        "error",
        `This row has ${header.length + extra.length} values but the header has ${header.length}, so its fields cannot be matched to columns. A value probably contains an unquoted ${delimiter === "\t" ? "tab" : delimiter === ";" ? "semicolon" : "comma"}.`,
      );
    } else if (cells.length < header.length) {
      issue(
        null,
        "warning",
        `This row has ${cells.length} values but the header has ${header.length}; the missing ones at the end were read as empty.`,
      );
    }

    // Record identifier: pseudonymous, never personal.
    const recordId = cell("record_id");
    const personal = recordId ? checkRecordId(recordId) : null;
    if (personal) issue("record_id", personal.severity, personal.message);

    // Gene.
    const rawGene = cell("gene");
    let gene = rawGene.toUpperCase();
    if (rawGene && gene !== rawGene) issue("gene", "info", `Gene symbol upper-cased to ${gene}.`);
    if (gene && !/^[A-Z][A-Z0-9-]*$/.test(gene)) {
      issue("gene", "error", `"${rawGene}" is not a gene symbol.`);
      gene = "";
    }

    // HGVS, with any inline transcript lifted out.
    const rawHgvs = cell("hgvs_c");
    let hgvs = "";
    let transcript: string | null = cell("transcript").toUpperCase() || null;
    if (rawHgvs) {
      const parsed = normaliseHgvs(rawHgvs);
      if (parsed.protein) {
        issue("hgvs_c", "error", `"${rawHgvs}" is protein (p.) notation; this column needs coding (c.) notation.`);
      } else if (!parsed.valid) {
        issue("hgvs_c", "error", `"${rawHgvs}" is not valid coding HGVS notation.`);
      } else {
        hgvs = parsed.value;
        const cosmetic = parsed.changes.filter((c) => c !== "moved the inline transcript to its own field");
        if (cosmetic.length > 0) {
          issue("hgvs_c", "warning", `Read as ${hgvs} (${cosmetic.join(", ")}). Check that is what the report meant.`);
        }
      }
      if (parsed.transcript) {
        if (transcript && transcript !== parsed.transcript) {
          issue(
            "transcript",
            "error",
            `The HGVS names transcript ${parsed.transcript}, but the transcript column says ${transcript}.`,
          );
        } else {
          transcript = parsed.transcript;
          issue("transcript", "info", `Transcript ${parsed.transcript} taken from the HGVS expression.`);
        }
      }
      if (parsed.gene && gene && parsed.gene !== gene) {
        issue("gene", "error", `The HGVS names ${parsed.gene}, but the gene column says ${gene}.`);
      }
    }
    if (transcript && !TRANSCRIPT.test(transcript)) {
      issue(
        "transcript",
        /^N[MRC]_\d+$/.test(transcript) ? "warning" : "error",
        /^N[MRC]_\d+$/.test(transcript)
          ? `Transcript ${transcript} has no version, so positions cannot be confirmed against the panel.`
          : `"${transcript}" is not a RefSeq transcript.`,
      );
    }

    // ClinVar identifier.
    const rawClinvar = cell("clinvar_id");
    let clinvarId: string | null = null;
    if (rawClinvar) {
      // VCV000531444.5 names version 5 of variation 531444.
      const digits = rawClinvar.replace(/^VCV0*/i, "").replace(/\.\d+$/, "");
      if (/^\d+$/.test(digits)) clinvarId = String(Number(digits));
      else issue("clinvar_id", "warning", `"${rawClinvar}" is not a ClinVar variation ID, so it was ignored.`);
    }

    // Classification as reported.
    const rawClassification = cell("classification");
    let classification: ClassificationCode | null = null;
    if (rawClassification) {
      const code = normaliseClassification(rawClassification);
      if (code === "NOT_PROVIDED") issue("classification", "error", `"${rawClassification}" is not a recognised classification.`);
      else classification = code;
    }

    // Report date.
    const rawDate = cell("report_date");
    let reportDate: string | null = null;
    if (rawDate) {
      const parsed = parseReportDate(rawDate);
      if (!parsed.iso) {
        issue("report_date", "error", `"${rawDate}" is not a date. Use YYYY-MM-DD.`);
      } else if (parsed.iso > options.today) {
        issue("report_date", "error", `${parsed.iso} is in the future.`);
      } else {
        reportDate = parsed.iso;
        if (parsed.dayFirst) {
          issue("report_date", "warning", `"${rawDate}" read as day/month/year: ${parsed.iso}. Use YYYY-MM-DD to remove the ambiguity.`);
        }
      }
    }

    // Reference genome.
    const rawBuild = cell("genome_build");
    let build: ImportRow["build"] = null;
    if (rawBuild) {
      const parsed = parseBuild(rawBuild);
      build = parsed.build;
      if (!build) issue("genome_build", "error", `"${rawBuild}" is not a recognised genome build (GRCh38 or GRCh37).`);
      else if (build === "GRCh37") {
        issue(
          "genome_build",
          "warning",
          "Reported on GRCh37. Matched on HGVS and ClinVar ID only; genomic coordinates would need liftover to GRCh38 first.",
        );
      } else if (!parsed.exact) {
        issue("genome_build", "info", `"${rawBuild}" read as GRCh38.`);
      }
    }

    // Match against the monitored panel.
    const match: ImportRow["match"] = { status: "not-checked", variantKey: null, basis: null };
    if (gene && hgvs) {
      const key = `${gene}:${hgvs}`;
      const onPanel = byKey.get(key);
      const byId = clinvarId ? byClinvar.get(clinvarId) : undefined;

      if (clinvarId && byId && byId.key !== key) {
        match.status = "conflict";
        issue(
          "clinvar_id",
          "error",
          `Identifiers disagree: ClinVar ${clinvarId} is ${variantName(byId)}, but this row says ${gene} ${hgvs}.`,
        );
      } else if (clinvarId && !byId && onPanel) {
        match.status = "conflict";
        issue(
          "clinvar_id",
          "error",
          `Identifiers disagree: ${gene} ${hgvs} is ClinVar ${onPanel.clinvarId}, but this row gives ${clinvarId}.`,
        );
      } else if (onPanel) {
        match.status = "matched";
        match.variantKey = onPanel.key;
        match.basis = clinvarId ? "HGVS and ClinVar ID agree" : "HGVS only";
        if (!clinvarId) issue("clinvar_id", "info", "No ClinVar ID supplied; matched on HGVS alone.");

        const expected = panelTranscript(onPanel.key);
        if (transcript && expected && transcript !== expected) {
          const sameAccession = transcript.split(".")[0] === expected.split(".")[0];
          issue(
            "transcript",
            sameAccession ? "warning" : "error",
            sameAccession
              ? `Transcript ${transcript} is a different version from the panel's ${expected}; c. positions can move between versions, so confirm before relying on the match.`
              : `Transcript ${transcript} is not the panel's ${expected} for this gene, so the c. position may name a different variant.`,
          );
        }
      } else {
        match.status = "unmatched";
        issue(
          null,
          "warning",
          `${gene} ${hgvs} is not on the monitored panel. It can be held in the corpus, but no evidence is monitored for it until it is added.`,
        );
      }
    }

    // Duplicates: the same record carrying the same variant twice.
    if (recordId && gene && hgvs) {
      const identity = `${recordId}|${match.variantKey ?? `${gene}:${hgvs}`}`;
      const first = seen.get(identity);
      if (first !== undefined) {
        issue(null, "error", `Duplicate of line ${first}: the same record with the same variant.`);
        report.totals.duplicates += 1;
      } else {
        seen.set(identity, line);
      }
      const existing = PATIENT_BY_ID.get(recordId);
      if (existing) {
        issue(
          "record_id",
          "warning",
          existing.variantKey === match.variantKey
            ? `${recordId} is already on file with this variant; importing it would add nothing new.`
            : `${recordId} is already on file with another finding; this row would add a second one.`,
        );
      }
    }

    const status: RowStatus = issues.some((i) => i.severity === "error")
      ? "rejected"
      : issues.some((i) => i.severity === "warning")
        ? "warnings"
        : "accepted";

    report.rows.push({
      line,
      recordId,
      gene,
      hgvs,
      transcript,
      clinvarId,
      classification,
      reportDate,
      build,
      department: cell("department"),
      clinicalOwner: cell("clinical_owner"),
      status,
      match,
      issues,
    });
  });

  const totals = report.totals;
  totals.rows = report.rows.length;
  for (const row of report.rows) {
    if (row.status === "accepted") totals.accepted += 1;
    if (row.status === "warnings") totals.withWarnings += 1;
    if (row.status === "rejected") totals.rejected += 1;
    if (row.match.status === "conflict") totals.conflicts += 1;
    if (row.status !== "rejected" && row.match.status === "matched") totals.matched += 1;
    if (row.status !== "rejected" && row.match.status === "unmatched") totals.unmatched += 1;
    if (row.build === "GRCh37") totals.grch37 += 1;
  }

  return report;
}

/* -- Impact of an import --------------------------------------------------- */

export interface ImportImpact {
  variantKey: string;
  gene: string;
  hgvs: string;
  caseId: string | null;
  currentCode: ClassificationCode;
  rows: { line: number; recordId: string; reported: ClassificationCode; change: ChangeType }[];
}

/**
 * What the accepted, matched rows would do: for each monitored variant they
 * carry, the case they would join and how their own reported classification
 * compares with the evidence today. Rows are compared on the classification
 * they report, not on the one the workspace holds for the variant.
 */
export function importImpact(report: ImportReport, assessments: readonly VariantAssessment[]): ImportImpact[] {
  const byKey = new Map(assessments.map((a) => [a.variant.key, a]));
  const groups = new Map<string, ImportImpact>();

  for (const row of report.rows) {
    if (row.status === "rejected" || row.match.status !== "matched" || !row.match.variantKey || !row.classification) {
      continue;
    }
    const assessment = byKey.get(row.match.variantKey);
    if (!assessment) continue;
    const group = groups.get(row.match.variantKey) ?? {
      variantKey: row.match.variantKey,
      gene: assessment.variant.gene,
      hgvs: assessment.variant.hgvsCoding,
      caseId: assessment.caseId,
      currentCode: assessment.currentCode,
      rows: [],
    };
    group.rows.push({
      line: row.line,
      recordId: row.recordId,
      reported: row.classification,
      change: detectChange(row.classification, assessment.currentCode).type,
    });
    groups.set(row.match.variantKey, group);
  }

  return [...groups.values()];
}

/* -- Files ----------------------------------------------------------------- */

const csvCell = (value: string) => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/** The template: every column, and one example row. */
export function importTemplate(): string {
  return [
    IMPORT_COLUMNS.map((c) => c.key).join(","),
    IMPORT_COLUMNS.map((c) => csvCell(c.example)).join(","),
  ].join("\r\n");
}

/** The report as CSV, one line per issue, for the data steward's records. */
export function reportCsv(report: ImportReport): string {
  const lines = [["line", "record_id", "status", "match", "severity", "field", "message"].join(",")];
  for (const row of report.rows) {
    const base = [String(row.line), row.recordId, row.status, row.match.status];
    if (row.issues.length === 0) {
      lines.push([...base, "", "", ""].map(csvCell).join(","));
    }
    for (const issue of row.issues) {
      lines.push([...base, issue.severity, issue.field ?? "", issue.message].map(csvCell).join(","));
    }
  }
  return lines.join("\r\n");
}

export function describeCode(code: ClassificationCode | null): string {
  return code ? meta(code).label : "Not read";
}
