/**
 * The evidence summary drafted for a clinician at the top of a case.
 *
 * Everything here is pure and runs on either side of the network. The fact
 * sheet is the only material a summary may draw on, whoever writes it: the
 * language model behind /api/summary, or the fixed template used whenever the
 * model is unavailable, slow, declines, or writes something that fails the
 * checks below.
 *
 * Every sentence ends with the tag of the source its facts came from, so each
 * claim can be checked against the evidence shown beside it:
 *
 *   [Record]          the classification on file at this institution
 *   [ClinVar]         the current ClinVar record
 *   [CTGA]            a regional reading attributed to CTGA
 *   [Regional index]  the workspace's modelled regional index
 *   [PMID n]          a publication linked to the ClinVar record
 *
 * The case data carries no CTGA source URL, so CTGA is cited by name only.
 */

import type { VariantAssessment } from "./analysis";
import { meta } from "./classification";
import { formatDate, formatNumber } from "./utils";

/** The most publications a summary is given to cite. */
const MAX_CITATIONS = 6;

export interface SummaryFacts {
  caseId: string;
  variant: { gene: string; hgvs: string; protein: string | null; condition: string };
  record: { tag: "[Record]"; classification: string; recordedOn: string };
  clinvar: {
    tag: "[ClinVar]";
    accession: string;
    classification: string;
    reviewStatus: string;
    submissions: number;
    lastEvaluated: string | null;
  };
  regional: {
    tag: "[Regional index]";
    /** Present when the regional reading comes from CTGA. */
    ctgaTag: "[CTGA]" | null;
    source: string;
    assertion: string;
    observations: number;
    cohortSize: number;
    note: string;
  } | null;
  /** How many publications ClinVar links to the record; `citations` holds the first few. */
  publicationCount: number;
  citations: { tag: string; pmid: string; title: string; journal: string; year: string }[];
}

export interface SummaryResult {
  caseId: string;
  sentences: string[];
  source: "ai" | "fallback";
  model?: string;
  /** Why the fixed template was used in place of the model. */
  reason?: string;
}

export function summaryFacts(assessment: VariantAssessment): SummaryFacts {
  const { variant, evidence, regional } = assessment;
  const ctga = regional?.contributingCentres.some((centre) => centre.startsWith("CTGA")) ?? false;

  return {
    caseId: assessment.caseId ?? variant.key,
    variant: {
      gene: variant.gene,
      hgvs: variant.hgvsCoding,
      protein: variant.proteinChange,
      condition: variant.condition,
    },
    record: {
      tag: "[Record]",
      classification: meta(assessment.recordedCode).label,
      recordedOn: variant.recordedOn,
    },
    clinvar: {
      tag: "[ClinVar]",
      accession: evidence.accession ?? evidence.clinvarId,
      classification: meta(assessment.currentCode).label,
      reviewStatus: evidence.reviewStatus,
      submissions: evidence.submissionCount,
      lastEvaluated: evidence.lastEvaluated,
    },
    regional: regional
      ? {
          tag: "[Regional index]",
          ctgaTag: ctga ? "[CTGA]" : null,
          source: regional.contributingCentres.join("; "),
          assertion: meta(regional.assertion).label,
          observations: regional.observations,
          cohortSize: regional.cohortSize,
          note: regional.note,
        }
      : null,
    publicationCount: evidence.citations.length,
    citations: evidence.citations.slice(0, MAX_CITATIONS).map((citation) => ({
      tag: `[PMID ${citation.pmid}]`,
      pmid: citation.pmid,
      title: citation.title,
      journal: citation.journal,
      year: citation.year,
    })),
  };
}

/** A short, stable fingerprint of the facts, so a cached summary is dropped when they change. */
export function summaryFingerprint(facts: SummaryFacts): string {
  const text = JSON.stringify(facts);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

const lower = (label: string) => label.charAt(0).toLowerCase() + label.slice(1);
const count = (n: number, noun: string) => `${formatNumber(n)} ${noun}${n === 1 ? "" : "s"}`;

/** The deterministic summary: four sentences from the same facts, each tagged. */
export function composeFallbackSummary(facts: SummaryFacts): string[] {
  const { variant, record, clinvar, regional, citations, publicationCount } = facts;
  const label = `${variant.gene} ${variant.hgvs}`;

  const regionalSentence = regional
    ? regional.ctgaTag
      ? `CTGA records it as ${lower(regional.assertion)} (${regional.source}), and the regional index counts ${count(regional.observations, "observation")} in a cohort of ${formatNumber(regional.cohortSize)} ${regional.ctgaTag} ${regional.tag}.`
      : `The regional index reads ${lower(regional.assertion)}, with ${count(regional.observations, "observation")} in a cohort of ${formatNumber(regional.cohortSize)} ${regional.tag}.`
    : "No regional record is held for this variant, so there is insufficient evidence to compare it with regional data [Regional index].";

  const literatureSentence =
    citations.length > 0
      ? `ClinVar links ${count(publicationCount, "publication")} to this record, including "${citations[0].title.replace(/\.$/, "")}" (${citations[0].journal}, ${citations[0].year}) ${citations[0].tag}.`
      : `No publication is linked to this record, so there is insufficient evidence from the literature ${clinvar.tag}.`;

  return [
    `The record on file reports ${label} as ${lower(record.classification)}, recorded on ${formatDate(record.recordedOn)} ${record.tag}.`,
    `ClinVar now classifies it as ${lower(clinvar.classification)} (${clinvar.reviewStatus}) from ${count(clinvar.submissions, "submission")}, last evaluated ${formatDate(clinvar.lastEvaluated)} ${clinvar.tag}.`,
    regionalSentence,
    literatureSentence,
  ];
}

export const SUMMARY_SYSTEM_PROMPT = `You summarise the evidence behind a genetic variant for a clinician reviewing an earlier test result.

Write three or four plain-English sentences, each on its own line, and nothing else: no heading, list marker or preamble.
Use only the facts in the case file. Where the file does not settle a point, write "insufficient evidence" rather than inferring or drawing on outside knowledge.
End every sentence with the tag of the source its facts come from, in square brackets, before the full stop, for example: "... last evaluated on 18 Aug 2025 [ClinVar]." The tags are given in the case file next to each source. A sentence that draws on two sources carries both tags. Never invent a tag or a PMID.
Describe the evidence only. Do not suggest a diagnosis, a treatment or any clinical action.`;

/** The user turn: the fact sheet, with each source's tag beside it. */
export function buildSummaryPrompt(facts: SummaryFacts): string {
  const file = {
    variant: facts.variant,
    classificationOnFile: facts.record,
    clinvarNow: facts.clinvar,
    regionalEvidence: facts.regional
      ? {
          tag: facts.regional.ctgaTag
            ? `${facts.regional.ctgaTag} for the reading CTGA records; ${facts.regional.tag} for the cohort figures`
            : facts.regional.tag,
          source: facts.regional.source,
          assertion: facts.regional.assertion,
          observations: facts.regional.observations,
          cohortSize: facts.regional.cohortSize,
          note: facts.regional.note,
        }
      : "No regional record is held for this variant. Tag: [Regional index]",
    publicationsLinkedByClinVar: facts.publicationCount,
    publicationsYouMayCite: facts.citations.map(({ tag, title, journal, year }) => ({
      tag,
      title,
      journal,
      year,
    })),
  };
  return `Case file for ${facts.caseId}. These are the only facts you may use.\n\n${JSON.stringify(file, null, 2)}`;
}

function allowedTags(facts: SummaryFacts): Set<string> {
  const tags = new Set<string>(["[Record]", "[ClinVar]", "[Regional index]"]);
  if (facts.regional?.ctgaTag) tags.add(facts.regional.ctgaTag);
  for (const citation of facts.citations) tags.add(citation.tag);
  return tags;
}

/** Wording that strays from describing evidence into clinical advice. */
const ADVICE =
  /\b(recommend\w*|advis\w*|should (?:be|undergo|receive|start|stop|consider|have)|consider(?:ing)? (?:testing|surgery|screening|treatment)|diagnos\w* (?:of|with)|treat(?:ment|ed)? (?:with|for)|prescrib\w*)\b/i;

const TRAILING_TAGS = /((?:\s*\[[^\]]+\])+)\s*\.?\s*$/;

const tidy = (line: string) => line.trim().replace(/^(?:[-*•]|\d+[.)])\s+/, "");

/**
 * The model's sentences if they meet every condition, otherwise null: three or
 * four sentences, each ending in tags drawn only from this case's sources, and
 * none of them advice.
 */
export function parseSummary(text: string, facts: SummaryFacts): string[] | null {
  let lines = text.split(/\r?\n/).map(tidy).filter(Boolean);
  // One paragraph instead of one sentence per line: split after each tagged full stop.
  if (lines.length === 1) {
    lines = lines[0].replace(/\]\.\s+/g, "].\n").split("\n").map(tidy).filter(Boolean);
  }
  if (lines.length < 3 || lines.length > 4) return null;

  const allowed = allowedTags(facts);
  const sentences: string[] = [];
  for (const line of lines) {
    const match = TRAILING_TAGS.exec(line);
    if (!match || match.index < 12) return null;
    const tags = match[1].match(/\[[^\]]+\]/g) ?? [];
    if (tags.length === 0 || tags.some((tag) => !allowed.has(tag))) return null;
    // Quoted text is a cited title, not the summary's own words.
    if (ADVICE.test(line.replace(/"[^"]*"|“[^”]*”/g, ""))) return null;
    sentences.push(line.endsWith(".") ? line : `${line}.`);
  }
  return sentences;
}
