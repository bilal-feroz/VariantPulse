/**
 * Explanatory panels: the timeline, the reasoning trail, and the source and
 * regional comparisons.
 *
 * Each one is built from the assessment it is given. Where a date or a count
 * appears it came from the evidence record, not from prose written around it.
 */

import { ChevronRight, ExternalLink, Globe2, Info, MapPin, Sparkles } from "lucide-react";

import type { VariantAssessment } from "@/lib/analysis";
import { meta } from "@/lib/classification";
import { REGIONAL_SOURCE } from "@/data/regional";
import { cn, formatDate, formatNumber, formatYear } from "@/lib/utils";
import {
  Badge,
  Card,
  ClassificationBadge,
  ConfidenceMeter,
  Eyebrow,
  SectionHeading,
} from "@/components/ui";

/* -- Science timeline ------------------------------------------------------ */

interface Milestone {
  year: string;
  title: string;
  detail: string;
  tone: "muted" | "warn" | "accent" | "crit";
}

function milestones(assessment: VariantAssessment): Milestone[] {
  const { variant, evidence, recordedCode, currentCode } = assessment;
  const events: Milestone[] = [];

  const earliestTest = assessment.impactedPatients
    .map((p) => p.testedOn)
    .sort()[0];

  if (earliestTest) {
    events.push({
      year: formatYear(earliestTest),
      title: "Genetic test performed",
      detail: `First record on file carrying ${variant.gene} ${variant.hgvsCoding}.`,
      tone: "muted",
    });
  }

  events.push({
    year: formatYear(variant.recordedOn),
    title: `Reported as ${meta(recordedCode).label.toLowerCase()}`,
    detail: variant.recordedEvidenceNote,
    tone: "warn",
  });

  // Real citations carry real publication years.
  const years = evidence.citations
    .map((c) => Number(c.year))
    .filter((y) => Number.isFinite(y) && y > Number(formatYear(variant.recordedOn)))
    .sort((a, b) => a - b);

  if (years.length > 0) {
    events.push({
      year: String(years[0]),
      title: "Further literature published",
      detail: `${years.length} indexed publication${years.length === 1 ? "" : "s"} appeared after the original report.`,
      tone: "muted",
    });
  }

  if (evidence.submissionCount > 1) {
    events.push({
      year: formatYear(evidence.lastEvaluated),
      title: "Submissions accumulated",
      detail: `${evidence.submissionCount} independent submissions now contribute to the classification.`,
      tone: "muted",
    });
  }

  if (currentCode !== recordedCode) {
    events.push({
      year: formatYear(evidence.lastEvaluated),
      title: `Classification now ${meta(currentCode).label.toLowerCase()}`,
      detail: `Last evaluated ${formatDate(evidence.lastEvaluated)} · ${assessment.confidence.label}.`,
      tone: "crit",
    });
  }

  events.push({
    year: "Today",
    title: "VariantPulse identified the affected records",
    detail:
      assessment.impactedRecordCount === 1
        ? "One historical record carries this variant and was flagged for clinical review."
        : `${assessment.impactedRecordCount} historical records carry this variant and were flagged for clinical review.`,
    tone: "accent",
  });

  return events;
}

export function ScienceTimeline({
  assessment,
  className,
}: {
  assessment: VariantAssessment;
  className?: string;
}) {
  const events = milestones(assessment);

  return (
    <Card className={cn("p-5", className)}>
      <SectionHeading
        title="How the interpretation changed"
        description={`${assessment.variant.gene} ${assessment.variant.hgvsCoding} — the DNA is unchanged. The evidence around it is not.`}
      />

      <ol className="mt-5">
        {events.map((event, index) => {
          const last = index === events.length - 1;
          return (
            <li key={`${event.year}-${event.title}`} className="relative flex gap-4 pb-5 last:pb-0">
              {!last ? (
                <span
                  aria-hidden
                  className="absolute left-[27px] top-7 h-[calc(100%-12px)] w-px bg-line"
                />
              ) : null}
              <span
                className={cn(
                  "z-10 grid h-14 w-14 shrink-0 place-items-center rounded-xl border text-[12px] font-semibold vp-num",
                  event.tone === "muted" && "border-line bg-surface-2 text-muted",
                  event.tone === "warn" && "border-warn/20 bg-warn-soft text-warn",
                  event.tone === "crit" && "border-crit/20 bg-crit-soft text-crit",
                  event.tone === "accent" && "border-accent-ring/60 bg-accent-soft text-accent",
                )}
              >
                {event.year}
              </span>
              <span className="min-w-0 flex-1 pt-1.5">
                <span className="block text-[13.5px] font-medium leading-snug text-ink">
                  {event.title}
                </span>
                <span className="mt-1 block text-[12.5px] leading-relaxed text-muted">
                  {event.detail}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/* -- Reasoning trail ------------------------------------------------------- */

/**
 * The full derivation, collapsed by default. Uses a native disclosure so it
 * works without JavaScript and is keyboard-operable by default.
 */
export function ReasoningPanel({
  assessment,
  defaultOpen = false,
  className,
}: {
  assessment: VariantAssessment;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details open={defaultOpen} className={cn("vp-card group overflow-hidden", className)}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
          <Info className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold text-ink">
            How VariantPulse reached this result
          </span>
          <span className="block text-[12px] text-muted">
            Eight steps, each one inspectable
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-faint transition-transform group-open:rotate-90" />
      </summary>

      <ol className="border-t border-line px-5 py-4">
        {assessment.pipeline.map((step, index) => (
          <li key={step.label} className="relative flex gap-4 pb-4 last:pb-0">
            {index < assessment.pipeline.length - 1 ? (
              <span aria-hidden className="absolute left-3 top-7 h-[calc(100%-12px)] w-px bg-line" />
            ) : null}
            <span className="z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line bg-surface text-[11px] font-semibold text-muted vp-num">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-ink">{step.label}</span>
              <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted">
                {step.detail}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}

/* -- Evidence summary ------------------------------------------------------ */

export function EvidenceSummaryPanel({
  assessment,
  className,
}: {
  assessment: VariantAssessment;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent-soft text-accent">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-[13.5px] font-semibold text-ink">Evidence summary</h3>
        <Badge tone="muted" className="ml-auto">
          Decision support
        </Badge>
      </div>
      <div className="px-5 py-4">
        <p className="text-[14px] leading-relaxed text-ink-2">{assessment.summary}</p>
        <p className="mt-3.5 border-t border-line pt-3 text-[11.5px] leading-relaxed text-faint">
          Composed from the structured fields of the records cited on this page. Requires
          clinical verification before it informs any decision.
        </p>
      </div>
    </Card>
  );
}

/* -- Source-by-source comparison ------------------------------------------- */

interface SourceRow {
  source: string;
  classification: React.ReactNode;
  reviewLevel: string;
  updated: string;
  strength: React.ReactNode;
  reference?: { label: string; href: string };
  note?: string;
}

export function EvidenceComparison({
  assessment,
  className,
}: {
  assessment: VariantAssessment;
  className?: string;
}) {
  const { evidence, variant, regional, recordedCode, currentCode } = assessment;

  const rows: SourceRow[] = [
    {
      source: "ClinVar",
      classification: <ClassificationBadge code={currentCode} full />,
      reviewLevel: assessment.confidence.label,
      updated: formatDate(evidence.lastEvaluated),
      strength: (
        <ConfidenceMeter stars={assessment.confidence.stars} strength={assessment.confidence.strength} />
      ),
      reference: {
        label: evidence.accession ?? `VCV${evidence.clinvarId}`,
        href: `https://www.ncbi.nlm.nih.gov/clinvar/variation/${evidence.clinvarId}/`,
      },
      note: `${evidence.submissionCount} submission${evidence.submissionCount === 1 ? "" : "s"} on record.`,
    },
    {
      source: "Population frequency",
      classification: evidence.peakAlleleFrequency ? (
        <span className="font-mono text-[12.5px] text-ink">
          {evidence.peakAlleleFrequency.value < 0.0001
            ? evidence.peakAlleleFrequency.value.toExponential(2)
            : evidence.peakAlleleFrequency.value.toFixed(5)}
        </span>
      ) : (
        <span className="text-[12.5px] text-muted">Not reported</span>
      ),
      reviewLevel: evidence.peakAlleleFrequency?.source ?? "No frequency data",
      updated: formatDate(evidence.lastEvaluated),
      strength: <span className="text-[12.5px] text-muted">Reference observation</span>,
      note: "Highest reported allele frequency carried on the source record.",
    },
    {
      source: "Literature",
      classification: (
        <span className="text-[12.5px] text-ink">
          {evidence.citations.length} indexed publication
          {evidence.citations.length === 1 ? "" : "s"}
        </span>
      ),
      reviewLevel: "PubMed index",
      updated: evidence.citations.length
        ? `Latest ${evidence.citations.map((c) => c.year).sort().at(-1)}`
        : "No linked publications",
      strength: <span className="text-[12.5px] text-muted">Supporting context</span>,
      note: "Publications linked to this variant record.",
    },
    {
      source: REGIONAL_SOURCE.name,
      classification: regional ? (
        <ClassificationBadge code={regional.assertion} full />
      ) : (
        <span className="text-[12.5px] text-muted">No regional record</span>
      ),
      reviewLevel: regional ? `${regional.observations} regional observations` : "Not held",
      updated: regional ? formatDate(regional.lastUpdated) : "—",
      strength: regional ? (
        <span className="text-[12.5px] text-muted">
          Cohort {formatNumber(regional.cohortSize)}
        </span>
      ) : (
        <span className="text-[12.5px] text-muted">—</span>
      ),
      note: REGIONAL_SOURCE.provenance,
    },
    {
      source: "This institution",
      classification: <ClassificationBadge code={recordedCode} full />,
      reviewLevel: "Internal report",
      updated: formatDate(variant.recordedOn),
      strength: <span className="text-[12.5px] text-muted">On record</span>,
      note: "The interpretation issued to the patient at the time of testing.",
    },
  ];

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="border-b border-line px-5 py-4">
        <SectionHeading
          title="Evidence by source"
          description="Each source is shown as it reports itself. VariantPulse does not merge them into a single verdict."
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-surface-2">
              {["Source", "Classification", "Review level", "Last updated", "Strength", ""].map(
                (heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-faint"
                  >
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.source} className="border-b border-line last:border-0 align-top">
                <th scope="row" className="px-5 py-3.5 text-[13px] font-medium text-ink">
                  {row.source}
                  {row.note ? (
                    <span className="mt-1 block max-w-[15rem] text-[11.5px] font-normal leading-snug text-faint">
                      {row.note}
                    </span>
                  ) : null}
                </th>
                <td className="px-5 py-3.5">{row.classification}</td>
                <td className="px-5 py-3.5 text-[12.5px] text-ink-2">{row.reviewLevel}</td>
                <td className="px-5 py-3.5 text-[12.5px] text-muted vp-num">{row.updated}</td>
                <td className="px-5 py-3.5">{row.strength}</td>
                <td className="px-5 py-3.5">
                  {row.reference ? (
                    <a
                      href={row.reference.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline"
                    >
                      {row.reference.label}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {evidence.citations.length > 0 ? (
        <div className="border-t border-line px-5 py-4">
          <Eyebrow>Cited publications</Eyebrow>
          <ul className="mt-2.5 space-y-2">
            {evidence.citations.map((citation) => (
              <li key={citation.pmid} className="text-[12.5px] leading-snug">
                <a
                  href={`https://pubmed.ncbi.nlm.nih.gov/${citation.pmid}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink-2 transition-colors hover:text-accent"
                >
                  {citation.title || `PubMed ${citation.pmid}`}
                </a>
                <span className="text-faint">
                  {" "}
                  — {citation.journal} {citation.year} · PMID {citation.pmid}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

/* -- Global versus regional ------------------------------------------------ */

export function RegionalComparison({
  assessment,
  className,
}: {
  assessment: VariantAssessment;
  className?: string;
}) {
  const { regional, regionalDisagreement, currentCode, evidence } = assessment;
  if (!regional) return null;

  const conflicting = Boolean(regionalDisagreement?.conflicting);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <h3 className="text-[14px] font-semibold text-ink">Global and regional evidence</h3>
        {conflicting ? (
          <Badge tone="warning" dot>
            Regional conflict
          </Badge>
        ) : (
          <Badge tone="positive" dot>
            Sources agree
          </Badge>
        )}
      </div>

      <div className="grid gap-px bg-line md:grid-cols-2">
        <div className="bg-surface p-5">
          <div className="flex items-center gap-2">
            <Globe2 className="h-4 w-4 text-muted" />
            <Eyebrow>Global</Eyebrow>
          </div>
          <div className="mt-3">
            <ClassificationBadge code={currentCode} full />
          </div>
          <dl className="mt-4 space-y-2.5">
            <Row label="Submissions" value={`${evidence.submissionCount}`} />
            <Row label="Review status" value={assessment.confidence.label} />
            <Row label="Last evaluated" value={formatDate(evidence.lastEvaluated)} />
            <Row
              label="Reference frequency"
              value={
                evidence.peakAlleleFrequency
                  ? evidence.peakAlleleFrequency.value.toExponential(2)
                  : "Not reported"
              }
            />
          </dl>
          <p className="mt-4 text-[12px] leading-relaxed text-faint">
            Read from ClinVar, which aggregates submissions dominated by European-ancestry
            cohorts.
          </p>
        </div>

        <div className="bg-surface p-5">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted" />
            <Eyebrow>Regional</Eyebrow>
          </div>
          <div className="mt-3">
            <ClassificationBadge code={regional.assertion} full />
          </div>
          <dl className="mt-4 space-y-2.5">
            <Row label="Observations" value={`${regional.observations}`} />
            <Row label="Cohort size" value={formatNumber(regional.cohortSize)} />
            <Row label="Last updated" value={formatDate(regional.lastUpdated)} />
            <Row
              label="Regional frequency"
              value={
                regional.regionalFrequency !== null
                  ? regional.regionalFrequency.toExponential(2)
                  : "Not reported"
              }
            />
          </dl>
          <p className="mt-4 text-[12px] leading-relaxed text-faint">
            {REGIONAL_SOURCE.provenance}.
          </p>
        </div>
      </div>

      <div className="border-t border-line bg-surface-2 px-5 py-4">
        <Eyebrow>VariantPulse analysis</Eyebrow>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
          {conflicting
            ? regionalDisagreement?.reason
            : "Both sources place this variant in the same band, so there is no divergence to resolve."}{" "}
          {regional.note}
        </p>
        {conflicting ? (
          <p className="mt-3 text-[12.5px] font-medium text-ink">
            VariantPulse recommends manual review due to conflicting interpretation across
            evidence sources. It does not rank one source above the other.
          </p>
        ) : null}

        {regional.citations.length > 0 ? (
          <ul className="mt-3.5 space-y-1.5 border-t border-line pt-3">
            {regional.citations.map((citation) => (
              <li key={citation.pmid} className="text-[12px] leading-snug">
                <a
                  href={`https://pubmed.ncbi.nlm.nih.gov/${citation.pmid}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink-2 transition-colors hover:text-accent"
                >
                  {citation.title}
                </a>
                <span className="text-faint">
                  {" "}
                  — {citation.journal} {citation.year} · PMID {citation.pmid}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="text-[12.5px] font-medium text-ink vp-num">{value}</dd>
    </div>
  );
}

/* -- Priority explanation -------------------------------------------------- */

export function PriorityPanel({
  assessment,
  className,
}: {
  assessment: VariantAssessment;
  className?: string;
}) {
  return (
    <Card className={cn("p-5", className)}>
      <SectionHeading
        title="Review priority"
        description="A triage signal for the queue. Not a clinical risk score, and not a statement about any individual."
      />
      <ul className="mt-4 space-y-2.5">
        {assessment.priority.factors.map((factor) => (
          <li key={factor.label} className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold vp-num",
                factor.weight >= 0 ? "bg-accent-soft text-accent" : "bg-surface-3 text-muted",
              )}
            >
              {factor.weight >= 0 ? "+" : ""}
              {factor.weight}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-ink">{factor.label}</span>
              <span className="block text-[12px] leading-snug text-muted">{factor.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between border-t border-line pt-3.5">
        <span className="text-[12.5px] text-muted">Ordering score</span>
        <span className="text-[13px] font-semibold text-ink vp-num">
          {assessment.priority.score}
        </span>
      </div>
    </Card>
  );
}
