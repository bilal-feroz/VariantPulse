"use client";

import { Building2, Database, ExternalLink, Globe2, Microscope } from "lucide-react";

import { PageHeader, PageShell } from "@/components/page-header";
import { SyncButton } from "@/components/sync";
import { Badge, Card, SectionHeading, StatusDot } from "@/components/ui";
import { REGIONAL_EVIDENCE, REGIONAL_SOURCE } from "@/data/regional";
import { formatDate, formatNumber } from "@/lib/utils";
import { EVIDENCE_MODES } from "@/lib/evidence-mode";
import { workspaceScope } from "@/lib/narrative";
import { useWorkspace } from "@/state/workspace";
import { RelativeTime } from "@/components/relative-time";

/** Status text only: where a reviewed case can go, and how far each route has got. */
const INTEGRATIONS = [
  { name: "FHIR R4 export", status: "Available" },
  { name: "HL7 v2 / EHR connector", status: "Pilot" },
  { name: "Malaffi (Abu Dhabi HIE)", status: "Pilot target" },
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
          <StatusDot tone={modeMeta.tone} pulse={modeMeta.pulse} />
          <span className="text-[14px] font-semibold text-ink">
            {live
              ? "All sources reachable"
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
          title="Integrations"
          description="How a reviewed case reaches hospital systems."
        />
        <dl className="mt-3 divide-y divide-line">
          {INTEGRATIONS.map((integration) => (
            <div
              key={integration.name}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5"
            >
              <dt className="text-[13.5px] font-medium text-ink">{integration.name}</dt>
              <dd className="text-[13px] text-muted">{integration.status}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </PageShell>
  );
}
