"use client";

import Link from "next/link";
import { ArrowRight, Building2, Database, ExternalLink, Globe2, Microscope } from "lucide-react";

import { PageHeader, PageShell } from "@/components/page-header";
import { SyncButton } from "@/components/sync";
import { Badge, Card, SectionHeading, StatusDot } from "@/components/ui";
import { REGIONAL_EVIDENCE, REGIONAL_SOURCE, SOURCE_KIND } from "@/data/regional";
import { formatDate, formatNumber } from "@/lib/utils";
import { EVIDENCE_MODES } from "@/lib/evidence-mode";
import { workspaceScope } from "@/lib/narrative";
import { useWorkspace } from "@/state/workspace";
import { RelativeTime } from "@/components/relative-time";

/**
 * How data reaches VariantPulse and how a reviewed case leaves it, stated as
 * what exists and how it is tested. Nothing is listed as available that has
 * not been built.
 */
const INTEGRATIONS: {
  name: string;
  status: string;
  tone: "positive" | "muted";
  detail: string;
  href?: string;
}[] = [
  {
    name: "Structured-file import",
    status: "Built · validated in the browser",
    tone: "positive",
    detail:
      "CSV or tab-separated historical results, checked row by row with a downloadable report. A preview: accepted rows are not loaded into the workspace.",
    href: "/onboarding",
  },
  {
    name: "FHIR R4 export",
    status: "Built · covered by automated tests",
    tone: "positive",
    detail:
      "One collection Bundle per case: a Patient, a variant Observation (LOINC 69548-6) and a review Task for each record. Not yet exercised against a partner's FHIR server.",
  },
  {
    name: "FHIR or HL7 v2 import from a record system",
    status: "Not built",
    tone: "muted",
    detail: "Scoped with a partner, against a specific workflow and tested with their systems.",
  },
  {
    name: "Health information exchange",
    status: "Not built",
    tone: "muted",
    detail: "Would follow the exchange's own onboarding and approvals. No connection exists or is implied.",
  },
];

export default function SourcesPage() {
  const { analysis, sync } = useWorkspace();
  const live = analysis.mode === "live";
  const modeMeta = EVIDENCE_MODES[analysis.mode];
  const lastChecked = sync.phase === "done" ? sync.at : analysis.checkedAt;

  const citations = analysis.assessments.reduce(
    (total, a) => total + a.evidence.citations.length,
    0,
  );
  const submissions = analysis.assessments.reduce(
    (total, a) => total + a.evidence.submissionCount,
    0,
  );

  const sources = [
    {
      name: "ClinVar",
      description: "Global variant submissions and expert-panel classifications",
      icon: Database,
      status: modeMeta.label,
      tone: modeMeta.tone,
      detail: live
        ? "Read directly from the NCBI E-utilities endpoint at each sync."
        : analysis.mode === "demo"
          ? `${modeMeta.description} Set VARIANTPULSE_EVIDENCE_MODE=live to read ClinVar directly.`
          : `Serving the bundled snapshot. ${analysis.reason ?? "The live endpoint was unavailable."}`,
      stats: [
        { label: "Variants monitored", value: formatNumber(analysis.assessments.length) },
        { label: "Submissions aggregated", value: formatNumber(submissions) },
        { label: "Last checked", value: <RelativeTime value={lastChecked} /> },
      ],
      href: "https://www.ncbi.nlm.nih.gov/clinvar/",
    },
    {
      name: "Literature index",
      description: "Publications linked to each variant record",
      icon: Microscope,
      status: SOURCE_KIND.bundled.label,
      tone: "neutral" as const,
      detail:
        "Citations are resolved from PubMed when the evidence snapshot is refreshed, and are shown with the variant they support.",
      stats: [
        { label: "Linked publications", value: formatNumber(citations) },
        { label: "Index", value: "PubMed" },
        { label: "Refreshed with", value: "Evidence snapshot" },
      ],
      href: "https://pubmed.ncbi.nlm.nih.gov/",
    },
    {
      name: REGIONAL_SOURCE.name,
      description: "gnomAD v4 Middle Eastern and global allele counts, and CTGA readings",
      icon: Globe2,
      status: SOURCE_KIND.bundled.label,
      tone: "neutral" as const,
      detail: `${REGIONAL_SOURCE.coverageNote} Read from each source on ${formatDate(REGIONAL_SOURCE.checkedOn)} and not refreshed at runtime.`,
      stats: [
        { label: "Variants held", value: formatNumber(REGIONAL_EVIDENCE.length) },
        {
          label: "Middle Eastern alleles seen",
          value: formatNumber(REGIONAL_EVIDENCE.reduce((t, r) => t + (r.middleEastern?.alleleCount ?? 0), 0)),
        },
        { label: "Checked on", value: formatDate(REGIONAL_SOURCE.checkedOn) },
      ],
    },
    {
      name: "Hospital record system",
      description: "Historical genomic findings on file",
      icon: Building2,
      status: "Synthetic dataset",
      tone: "muted" as const,
      detail:
        "The demonstration's synthetic records, read-only. VariantPulse walks them at each sync and never writes back. No hospital system is connected.",
      stats: [
        { label: "Findings on file", value: formatNumber(analysis.scan.findingsChecked) },
        { label: "Distinct variants", value: formatNumber(analysis.scan.distinctVariants) },
      ],
    },
  ];

  return (
    <PageShell>
      <PageHeader
        eyebrow="System health"
        title="Data sources"
        description="Where each piece of evidence comes from, when it was last read, and what happens when a source is unreachable."
        actions={<SyncButton />}
      />

      <Card className="mb-5 flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4">
        <span className="inline-flex items-center gap-2.5">
          <StatusDot tone={modeMeta.tone} pulse={modeMeta.pulse} />
          <span className="text-[14px] font-semibold text-ink">
            {live
              ? "Live ClinVar reads · other sources bundled"
              : analysis.mode === "demo"
                ? "Demo mode · bundled evidence snapshot"
                : "Running on cached evidence"}
          </span>
          <Badge tone={modeMeta.tone} dot>
            {modeMeta.label}
          </Badge>
        </span>
        <span className="text-[12.5px] text-muted">
          Last sync <RelativeTime value={lastChecked} /> ·{" "}
          {formatNumber(analysis.scan.findingsChecked)} findings checked ·{" "}
          {workspaceScope(analysis.metrics)}
        </span>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {sources.map((source) => {
          const Icon = source.icon;
          return (
            <Card key={source.name} className="p-5">
              <div className="flex items-start gap-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-3 text-muted">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[15px] font-semibold text-ink">{source.name}</h2>
                    <Badge tone={source.tone} dot>
                      {source.status}
                    </Badge>
                    {source.href ? (
                      <a
                        href={source.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline"
                      >
                        Source
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[12.5px] text-muted">{source.description}</p>
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-4 border-t border-line pt-3.5">
                {source.stats.map((stat) => (
                  <div key={stat.label}>
                    <dt className="text-[10.5px] font-medium uppercase tracking-[0.07em] text-faint">
                      {stat.label}
                    </dt>
                    <dd className="mt-1 text-[13.5px] font-medium text-ink vp-num">{stat.value}</dd>
                  </div>
                ))}
              </dl>

              <p className="mt-3.5 text-[12px] leading-relaxed text-muted">{source.detail}</p>
            </Card>
          );
        })}
      </div>

      <Card className="mt-5 p-5">
        <SectionHeading
          title="When a source is unreachable"
          description="The workspace degrades visibly rather than silently."
        />
        <ul className="mt-4 space-y-2.5 text-[13px] leading-relaxed text-ink-2">
          <li className="flex gap-2.5">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
            Demo mode, the default, serves the bundled snapshot with no network access, so every
            run shows the same evidence.
          </li>
          <li className="flex gap-2.5">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
            In live mode, a read that fails or times out falls back to the bundled evidence snapshot, and
            every surface switches from <strong className="font-medium">live</strong> to{" "}
            <strong className="font-medium">cached</strong>.
          </li>
          <li className="flex gap-2.5">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
            A partial response is discarded rather than mixed with cached records, so a single
            comparison never spans two different reads.
          </li>
          <li className="flex gap-2.5">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-ok" />
            Change detection is deterministic and runs locally, so the queue stays correct even
            when every external source is down.
          </li>
        </ul>
      </Card>

      <Card className="mt-5 p-5">
        <SectionHeading
          title="Integration readiness"
          description="How data reaches VariantPulse and how a reviewed case leaves it: what is built, how it is tested, and what is not built yet."
        />
        <dl className="mt-3 divide-y divide-line">
          {INTEGRATIONS.map((integration) => (
            <div key={integration.name} className="grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
              <dt className="min-w-0">
                <span className="block text-[13.5px] font-medium text-ink">{integration.name}</span>
                <Badge tone={integration.tone} dot className="mt-1.5">
                  {integration.status}
                </Badge>
              </dt>
              <dd className="text-[12.5px] leading-relaxed text-ink-2">
                {integration.detail}
                {integration.href ? (
                  <Link href={integration.href} className="ml-1.5 inline-flex items-center gap-1 font-medium text-accent hover:underline">
                    Open
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </PageShell>
  );
}
