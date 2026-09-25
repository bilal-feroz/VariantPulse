"use client";

import {
  Building2,
  Database,
  ExternalLink,
  Globe2,
  History,
  Library,
  Microscope,
} from "lucide-react";

import { PageHeader, PageShell } from "@/components/page-header";
import { SyncButton } from "@/components/sync";
import { Badge, Card, SectionHeading, StatusDot } from "@/components/ui";
import { REGIONAL_SOURCE } from "@/data/regional";
import { CLINVAR_JAN_2023, MONITORED_VARIANTS, PATIENTS } from "@/data/workspace";
import { formatDate, formatNumber } from "@/lib/utils";
import { useWorkspace } from "@/state/workspace";
import { RelativeTime } from "@/components/relative-time";

type Status = "Live" | "Cached" | "Snapshot" | "Synthetic";

const STATUS_TONE = {
  Live: "positive",
  Cached: "warning",
  Snapshot: "neutral",
  Synthetic: "muted",
} as const;

export default function SourcesPage() {
  const { analysis, sync } = useWorkspace();
  const live = analysis.mode === "live";
  const lastChecked = sync.phase === "done" ? sync.at : analysis.checkedAt;
  const { snapshot, snapshotDrift } = analysis;

  const citations = analysis.assessments.reduce(
    (total, a) => total + a.evidence.citations.length,
    0,
  );
  const submissions = analysis.assessments.reduce(
    (total, a) => total + a.evidence.submissionCount,
    0,
  );
  const fromRelease = MONITORED_VARIANTS.filter((v) => v.historicalSource.kind === "clinvar-release");
  const modelled = MONITORED_VARIANTS.length - fromRelease.length;
  const inGnomad = analysis.assessments.filter((a) => a.regional?.inGnomad).length;
  const catalogued = analysis.assessments.filter((a) => a.regional?.catalogue);
  const countries = [...new Set(catalogued.flatMap((a) => a.regional?.catalogue?.countries ?? []))];

  const snapshotLine = `${snapshot.recordCount} records${
    snapshot.verifiedAt
      ? `, ${snapshot.verifiedMatched} of ${snapshot.verifiedCompared} identical to live ClinVar on ${formatDate(snapshot.verifiedAt)}`
      : ""
  }`;

  const sources: {
    name: string;
    description: string;
    icon: typeof Database;
    status: Status;
    detail: string;
    stats: { label: string; value: React.ReactNode }[];
    href?: string;
  }[] = [
    {
      name: "NCBI ClinVar",
      description: "Current classifications, review status and submissions",
      icon: Database,
      status: live ? "Live" : "Cached",
      detail: live
        ? `Read directly from NCBI E-utilities in one batched request at each sync. ${
            snapshotDrift.length === 0
              ? "Live evidence matches the verified snapshot on every compared field."
              : `Live evidence differs from the snapshot on ${snapshotDrift.length} field${snapshotDrift.length === 1 ? "" : "s"}; the live values are used and the snapshot stays the fallback.`
          }`
        : `Serving the cached verified snapshot (${snapshotLine}). ${analysis.reason ?? "The live endpoint was unavailable"}.`,
      stats: [
        { label: "Variants monitored", value: formatNumber(analysis.assessments.length) },
        { label: "Submissions aggregated", value: formatNumber(submissions) },
        { label: "Last checked", value: <RelativeTime value={lastChecked} /> },
      ],
      href: "https://www.ncbi.nlm.nih.gov/clinvar/",
    },
    {
      name: `ClinVar, ${CLINVAR_JAN_2023.label} release`,
      description: "The historical classification on record",
      icon: History,
      status: "Snapshot",
      detail: `For ${fromRelease.length} of ${MONITORED_VARIANTS.length} variants the classification on record is ClinVar's own classification in ${CLINVAR_JAN_2023.file}, re-checked against the archive. ${
        modelled > 0
          ? `${modelled === 1 ? "One variant was" : `${modelled} variants were`} not in ClinVar then; its classification on record is the synthetic hospital's report and is labelled as such.`
          : ""
      }`,
      stats: [
        { label: "From the release", value: formatNumber(fromRelease.length) },
        { label: "Modelled reports", value: formatNumber(modelled) },
        { label: "Reclassified since", value: formatNumber(analysis.metrics.evidenceChanges) },
      ],
      href: CLINVAR_JAN_2023.url ?? undefined,
    },
    {
      name: "gnomAD v4",
      description: "Middle Eastern and global allele frequencies",
      icon: Globe2,
      status: "Snapshot",
      detail: `Allele counts for the ${REGIONAL_SOURCE.population} and all samples, supplied with the dataset and re-checked against the gnomAD API on ${formatDate(REGIONAL_SOURCE.checkedOn)}. Evidence to weigh, never a classification.`,
      stats: [
        { label: "Variants in gnomAD", value: `${inGnomad} of ${analysis.assessments.length}` },
        { label: "Regional signals", value: formatNumber(analysis.metrics.regionalConflicts) },
        { label: "Middle Eastern group", value: "~3,000 people" },
      ],
      href: REGIONAL_SOURCE.gnomadUrl,
    },
    {
      name: REGIONAL_SOURCE.catalogueShortName,
      description: REGIONAL_SOURCE.catalogueName,
      icon: Library,
      status: "Snapshot",
      detail: `Clinical significance quoted verbatim from the catalogue of the ${REGIONAL_SOURCE.cataloguePublisher}, read on ${formatDate(REGIONAL_SOURCE.checkedOn)}. Always attributed, never merged into a VariantPulse classification.`,
      stats: [
        { label: "Variants recorded", value: formatNumber(catalogued.length) },
        { label: "Countries", value: countries.join(", ") || "—" },
        {
          label: "Regional record ahead",
          value: formatNumber(
            analysis.assessments.filter((a) => a.regionalSignal.kind === "CATALOGUE_AHEAD").length,
          ),
        },
      ],
      href: REGIONAL_SOURCE.catalogueUrl,
    },
    {
      name: "Literature index",
      description: "Publications linked to each variant record",
      icon: Microscope,
      status: "Snapshot",
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
      name: "Hospital record system",
      description: "Historical genomic findings on file",
      icon: Building2,
      status: "Synthetic",
      detail:
        "Fabricated demonstration records: no real patient, clinician or institution. Read-only; VariantPulse walks every record at each sync and never writes back.",
      stats: [
        { label: "Synthetic records", value: formatNumber(PATIENTS.length) },
        { label: "Variants carried", value: formatNumber(analysis.scan.distinctVariants) },
        { label: "Requiring review", value: formatNumber(analysis.metrics.patientsImpacted) },
      ],
    },
  ];

  return (
    <PageShell>
      <PageHeader
        eyebrow="System health"
        title="Data sources"
        description="Where each piece of evidence comes from, whether it is live, a dated snapshot or synthetic, and what happens when a source is unreachable."
        actions={<SyncButton />}
      />

      <Card className="mb-5 flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4">
        <span className="inline-flex items-center gap-2.5">
          <StatusDot tone={live ? "positive" : "warning"} pulse={live} />
          <span className="text-[14px] font-semibold text-ink">
            {live ? "Live ClinVar evidence" : "Cached verified evidence"}
          </span>
        </span>
        <span className="text-[12.5px] text-muted">
          Last sync <RelativeTime value={lastChecked} /> ·{" "}
          {formatNumber(analysis.scan.findingsChecked)} synthetic records checked ·{" "}
          {analysis.metrics.evidenceChanges} reclassification
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
                    <Badge tone={STATUS_TONE[source.status]} dot>
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
            A live read that fails or times out falls back to the verified snapshot, and every
            surface switches from <strong className="font-medium">live</strong> to{" "}
            <strong className="font-medium">cached verified evidence</strong>.
          </li>
          <li className="flex gap-2.5">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
            A partial response is discarded rather than mixed with cached records, so a single
            comparison never spans two different reads. A failed read is remembered for 30 seconds,
            so a dead network costs one timeout rather than one per page; a sync always retries.
          </li>
          <li className="flex gap-2.5">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-ok" />
            The snapshot is never overwritten at runtime. If live ClinVar has moved on, the live
            values are used and the difference is reported; refreshing the snapshot is a deliberate
            step (<code className="font-mono text-[12px]">npm run evidence:refresh</code>).
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
