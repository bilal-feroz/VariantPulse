"use client";

import { Building2, Database, ExternalLink, Globe2, Microscope } from "lucide-react";

import { PageHeader, PageShell } from "@/components/page-header";
import { SyncButton } from "@/components/sync";
import { Badge, Card, SectionHeading, StatusDot } from "@/components/ui";
import { REGIONAL_EVIDENCE, REGIONAL_SOURCE } from "@/data/regional";
import { formatDate, formatNumber } from "@/lib/utils";
import { useWorkspace } from "@/state/workspace";
import { RelativeTime } from "@/components/relative-time";

export default function SourcesPage() {
  const { analysis, sync } = useWorkspace();
  const live = analysis.mode === "live";
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
      status: live ? ("Live" as const) : ("Cached" as const),
      tone: live ? ("positive" as const) : ("warning" as const),
      detail: live
        ? "Read directly from the NCBI E-utilities endpoint at each sync."
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
      status: "Connected" as const,
      tone: "positive" as const,
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
      description: REGIONAL_SOURCE.scope,
      icon: Globe2,
      status: "Connected" as const,
      tone: "positive" as const,
      detail: REGIONAL_SOURCE.coverageNote,
      stats: [
        { label: "Variants held", value: formatNumber(REGIONAL_EVIDENCE.length) },
        {
          label: "Observations",
          value: formatNumber(REGIONAL_EVIDENCE.reduce((t, r) => t + r.observations, 0)),
        },
        {
          label: "Last updated",
          value: formatDate(
            REGIONAL_EVIDENCE.map((r) => r.lastUpdated).sort().at(-1) ?? null,
          ),
        },
      ],
    },
    {
      name: "Hospital record system",
      description: "Historical genomic findings on file",
      icon: Building2,
      status: "Connected" as const,
      tone: "positive" as const,
      detail:
        "Read-only. VariantPulse walks the finding corpus at each sync and never writes back to it.",
      stats: [
        { label: "Findings on file", value: formatNumber(analysis.scan.findingsChecked) },
        { label: "On monitored variants", value: formatNumber(analysis.scan.monitoredFindings) },
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
          <StatusDot tone={live ? "positive" : "warning"} pulse={live} />
          <span className="text-[14px] font-semibold text-ink">
            {live ? "All sources reachable" : "Running on cached evidence"}
          </span>
        </span>
        <span className="text-[12.5px] text-muted">
          Last sync <RelativeTime value={lastChecked} /> ·{" "}
          {formatNumber(analysis.scan.findingsChecked)} findings checked ·{" "}
          {analysis.metrics.evidenceChanges} change
          {analysis.metrics.evidenceChanges === 1 ? "" : "s"} found
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
            A live read that fails or times out falls back to the bundled evidence snapshot, and
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
    </PageShell>
  );
}
