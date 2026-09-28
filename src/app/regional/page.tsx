"use client";

import Link from "next/link";
import { ArrowRight, CircleCheck, CircleDashed, ExternalLink, Globe2, MapPin, TriangleAlert } from "lucide-react";

import { PageHeader, PageShell } from "@/components/page-header";
import { RegionalComparison } from "@/components/panels";
import { SyncButton } from "@/components/sync";
import {
  Badge,
  Button,
  Card,
  ClassificationBadge,
  EmptyState,
  Eyebrow,
  SectionHeading,
  VariantLabel,
} from "@/components/ui";
import {
  EVIDENCE_SOURCES,
  REGIONAL_BY_KEY,
  REGIONAL_SOURCE,
  SOURCE_KIND,
  gnomadVariantUrl,
  type SourceKind,
} from "@/data/regional";
import type { VariantAssessment } from "@/lib/analysis";
import { regionalStatement } from "@/lib/classification";
import { pick } from "@/lib/dto";
import { formatNumber } from "@/lib/utils";
import { useWorkspace } from "@/state/workspace";

const KIND_TONE: Record<SourceKind, "positive" | "neutral" | "warning"> = {
  live: "positive",
  bundled: "neutral",
  curated: "warning",
};

const SIGNAL_LABEL: Record<string, string> = {
  CATALOGUE_DISAGREES: "Catalogue disagrees",
  FREQUENCY_ENRICHED: "Frequency difference",
  CURATED_CONTEXT: "Curated context",
  CATALOGUE_AHEAD: "Regional record was ahead",
  CATALOGUE_AGREES: "Catalogue agrees",
  NONE: "No signal",
};

export default function RegionalPage() {
  const { analysis } = useWorkspace();

  const conflicts = pick(analysis, analysis.regionalConflictKeys);
  const catalogued = analysis.assessments.filter((a) => a.regional);
  const agreeing = catalogued.filter((a) => !a.regionalSignal.flagged);
  const inGnomad = analysis.assessments.filter((a) => REGIONAL_BY_KEY.get(a.variant.key)?.inGnomad).length;
  const absent = analysis.assessments.length - inGnomad;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Regional evidence"
        title="Regional insights"
        description="Global genomic interpretation beside evidence relevant to Arab and Gulf populations. Where the two disagree, VariantPulse surfaces the disagreement for a clinician rather than picking a winner."
        actions={<SyncButton />}
      />

      <Card className="mb-5 p-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <div>
            <div className="flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-muted" />
              <Eyebrow>Global</Eyebrow>
            </div>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-2">
              ClinVar submissions, reference population frequencies and published international evidence. The
              reference cohorts behind these datasets are predominantly of European ancestry.
            </p>
          </div>
          <div className="hidden w-px bg-line lg:block" aria-hidden />
          <div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted" />
              <Eyebrow>Regional</Eyebrow>
            </div>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-2">
              gnomAD v4 allele counts for the {REGIONAL_SOURCE.population}, and catalogue readings from{" "}
              {REGIONAL_SOURCE.catalogueShortName}, quoted and attributed.
            </p>
          </div>
        </div>

        <p className="mt-5 border-t border-line pt-3.5 text-[13px] leading-relaxed text-ink-2">
          gnomAD v4 holds <span className="font-medium text-ink vp-num">{inGnomad}</span> of the{" "}
          <span className="vp-num">{analysis.assessments.length}</span> monitored variants;{" "}
          <span className="font-medium text-ink vp-num">{absent}</span> are absent altogether.{" "}
          {REGIONAL_SOURCE.catalogueShortName} records <span className="font-medium text-ink vp-num">{catalogued.length}</span>,
          and <span className="font-medium text-ok vp-num">{agreeing.length}</span> of those sit in the same clinical band as
          ClinVar today. <span className="font-medium text-warn vp-num">{conflicts.length}</span> variant
          {conflicts.length === 1 ? " carries" : "s carry"} a regional signal for a clinician to weigh.
        </p>
        <p className="mt-3 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink-2">
          <strong className="font-semibold text-ink">Context, not a conclusion.</strong> A Middle Eastern frequency
          rests on about 3,000 people in gnomAD. VariantPulse raises it for qualified review and never turns it into a
          classification or a clinical recommendation.
        </p>
      </Card>

      <SectionHeading
        title="Regional signals"
        count={conflicts.length}
        icon={<TriangleAlert className="h-4 w-4" />}
        description="Human review required. VariantPulse does not rank one source above the other."
      />

      {conflicts.length === 0 ? (
        <Card className="mt-4">
          <EmptyState
            icon={<Globe2 className="h-5 w-5" />}
            title="No regional signals"
            description="Global and regional evidence agree across every monitored variant."
          />
        </Card>
      ) : (
        <div className="mt-4 space-y-5">
          {conflicts.map((assessment) => (
            <div key={assessment.variant.key}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <VariantLabel
                  gene={assessment.variant.gene}
                  hgvs={assessment.variant.hgvsCoding}
                  protein={assessment.variant.proteinChange}
                  size="md"
                />
                <Link href={assessment.caseId ? `/review/${assessment.caseId}` : "/review"}>
                  <Button variant="primary" size="sm">
                    Open clinical review
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
              {assessment.regional ? (
                <RegionalComparison assessment={assessment} />
              ) : (
                <SignalCard assessment={assessment} />
              )}
            </div>
          ))}
        </div>
      )}

      <Coverage />

      <SectionHeading
        className="mt-8"
        title="Consistent across sources"
        count={agreeing.length}
        description={`Variants ${REGIONAL_SOURCE.catalogueShortName} records in the same clinical band as ClinVar today.`}
      />
      <Card className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line bg-surface-2">
                {["Variant", "Global", "Regional", "Observations", "Cohort"].map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-faint"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agreeing.map((assessment) => (
                <tr key={assessment.variant.key} className="border-b border-line last:border-0">
                  <th scope="row" className="px-5 py-3">
                    <Link href={`/variants/${encodeURIComponent(assessment.variant.key)}`} className="hover:text-accent">
                      <VariantLabel gene={assessment.variant.gene} hgvs={assessment.variant.hgvsCoding} size="sm" />
                    </Link>
                  </th>
                  <td className="px-5 py-3">
                    <ClassificationBadge code={assessment.currentCode} />
                  </td>
                  <td className="px-5 py-3">
                    {assessment.regional ? <ClassificationBadge code={assessment.regional.assertion} /> : null}
                  </td>
                  <td className="px-5 py-3 text-[12.5px] text-ink-2 vp-num">
                    {assessment.regional && assessment.regional.cohortSize > 0 ? assessment.regional.observations : "-"}
                  </td>
                  <td className="px-5 py-3 text-[12.5px] text-muted vp-num">
                    {assessment.regional && assessment.regional.cohortSize > 0
                      ? formatNumber(assessment.regional.cohortSize)
                      : "Not in gnomAD"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Sources />

      <Card className="mt-5 p-5">
        <SectionHeading title="Why regional evidence matters" />
        <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-ink-2">
          A variant that is common and harmless in one population can be a founder variant in another. When the
          reference data behind a classification does not include the population a patient belongs to, a confident
          global reading can still be the wrong reading locally. VariantPulse holds both, labels where each comes
          from and how far it reaches, and asks a clinician to weigh them rather than resolving the disagreement itself.
        </p>
      </Card>
    </PageShell>
  );
}

/** A regional signal with no catalogue record behind it: frequency or curated context. */
function SignalCard({ assessment }: { assessment: VariantAssessment }) {
  const evidence = REGIONAL_BY_KEY.get(assessment.variant.key);
  const signal = assessment.regionalSignal;
  const me = evidence?.middleEastern;
  const global = evidence?.global;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3.5">
        <Badge tone="warning" dot>
          {SIGNAL_LABEL[signal.kind] ?? "Regional signal"}
        </Badge>
        <Badge tone="muted">No catalogue record</Badge>
        {signal.kind === "CURATED_CONTEXT" ? <Badge tone="warning">{SOURCE_KIND.curated.label}</Badge> : null}
      </div>
      <div className="grid gap-px bg-line md:grid-cols-2">
        <div className="bg-surface p-5">
          <Eyebrow>Global · ClinVar today</Eyebrow>
          <div className="mt-2.5">
            <ClassificationBadge code={assessment.currentCode} full />
          </div>
          {global ? (
            <p className="mt-3 text-[12.5px] text-ink-2 vp-num">
              {formatNumber(global.alleleCount)} of {formatNumber(global.alleleNumber)} alleles in all gnomAD v4 samples
            </p>
          ) : null}
        </div>
        <div className="bg-surface p-5">
          <Eyebrow>Regional · gnomAD v4 Middle Eastern</Eyebrow>
          {me ? (
            <p className="mt-2.5 text-[13px] text-ink vp-num">
              <span className="font-semibold">{formatNumber(me.alleleCount)}</span> of {formatNumber(me.alleleNumber)} alleles
              {signal.ratio !== null ? (
                <span className="text-muted"> · about {signal.ratio.toFixed(1)}× the global frequency</span>
              ) : null}
            </p>
          ) : (
            <p className="mt-2.5 text-[13px] text-muted">Absent from gnomAD v4.</p>
          )}
          {evidence?.inGnomad ? (
            <a
              href={gnomadVariantUrl(evidence.gnomadVariantId)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline"
            >
              gnomAD {evidence.gnomadVariantId}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
      </div>
      <div className="border-t border-line bg-surface-2 px-5 py-4">
        <Eyebrow>Why it is raised</Eyebrow>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{regionalStatement(signal)}</p>
        {evidence?.context?.note ? (
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{evidence.context.note}</p>
        ) : null}
        {evidence?.context?.citations.length ? (
          <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
            {evidence.context.citations.map((citation) => (
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
                  · {citation.journal} {citation.year} · PMID {citation.pmid}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-3 text-[12.5px] font-medium text-ink">
          Evidence to weigh, not a classification. A clinician decides whether it matters for these records.
        </p>
      </div>
    </Card>
  );
}

/** Every monitored variant, and what regional evidence exists for it, including none. */
function Coverage() {
  const { analysis } = useWorkspace();
  return (
    <Card className="mt-8 overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <SectionHeading
          title="Regional evidence coverage"
          description="Every monitored variant, including where there is no regional evidence at all. Absence is shown, never filled in."
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-surface-2">
              {["Variant", "gnomAD v4 Middle Eastern", "gnomAD v4 all samples", REGIONAL_SOURCE.catalogueShortName, "Regional signal"].map(
                (heading) => (
                  <th key={heading} scope="col" className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-faint">
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {analysis.assessments.map((assessment) => {
              const evidence = REGIONAL_BY_KEY.get(assessment.variant.key);
              const me = evidence?.middleEastern;
              const global = evidence?.global;
              const signal = assessment.regionalSignal;
              return (
                <tr key={assessment.variant.key} className="border-b border-line align-top last:border-0">
                  <th scope="row" className="px-5 py-3">
                    <Link href={`/variants/${encodeURIComponent(assessment.variant.key)}`} className="hover:text-accent">
                      <VariantLabel gene={assessment.variant.gene} hgvs={assessment.variant.hgvsCoding} size="sm" />
                    </Link>
                  </th>
                  <td className="px-5 py-3 text-[12.5px] vp-num">
                    {!evidence?.inGnomad ? (
                      <span className="inline-flex items-center gap-1.5 text-muted">
                        <CircleDashed className="h-3.5 w-3.5" />
                        Absent from gnomAD v4
                      </span>
                    ) : me && me.alleleCount > 0 ? (
                      <span className="text-ink">
                        {formatNumber(me.alleleCount)} of {formatNumber(me.alleleNumber)} alleles
                      </span>
                    ) : (
                      <span className="text-muted">Not observed in {formatNumber(me?.alleleNumber ?? 0)} alleles</span>
                    )}
                    {evidence?.callSet === "exomes" ? <span className="block text-[11px] text-faint">Exome counts</span> : null}
                  </td>
                  <td className="px-5 py-3 text-[12.5px] text-ink-2 vp-num">
                    {global ? `${formatNumber(global.alleleCount)} of ${formatNumber(global.alleleNumber)}` : <span className="text-muted">-</span>}
                  </td>
                  <td className="px-5 py-3 text-[12.5px]">
                    {evidence?.catalogue ? (
                      <a
                        href={evidence.catalogue.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-ink-2 hover:text-accent"
                        title={`Listed since ${evidence.catalogue.listedSince}`}
                      >
                        &ldquo;{evidence.catalogue.significance}&rdquo;
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-muted">No record</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {signal.flagged ? (
                      <Badge tone="warning" dot>
                        {SIGNAL_LABEL[signal.kind]}
                      </Badge>
                    ) : signal.kind === "NONE" ? (
                      <span className="text-[12px] text-faint">None</span>
                    ) : (
                      <Badge tone="muted">{SIGNAL_LABEL[signal.kind]}</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** Where each source comes from, how it reaches the workspace, and whether reuse is confirmed. */
function Sources() {
  return (
    <Card className="mt-5 overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <SectionHeading
          title="Sources, provenance and permissions"
          description="Live integrations, bundled public data and curated demonstration content are kept apart, and reuse is confirmed source by source."
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(SOURCE_KIND) as SourceKind[]).map((kind) => (
            <Badge key={kind} tone={KIND_TONE[kind]} title={SOURCE_KIND[kind].description}>
              {SOURCE_KIND[kind].label}
            </Badge>
          ))}
        </div>
      </div>
      <ul className="divide-y divide-line">
        {EVIDENCE_SOURCES.map((source) => (
          <li key={source.name} className="grid gap-x-6 gap-y-2 px-5 py-4 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)_minmax(0,260px)]">
            <div className="min-w-0">
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-ink hover:text-accent"
              >
                {source.name}
                <ExternalLink className="h-3 w-3" />
              </a>
              <p className="text-[12px] text-muted">{source.publisher}</p>
              <Badge tone={KIND_TONE[source.kind]} className="mt-1.5">
                {SOURCE_KIND[source.kind].label}
              </Badge>
            </div>
            <div className="min-w-0 space-y-1 text-[12.5px] leading-relaxed text-ink-2">
              <p>{source.provides}</p>
              <p className="text-muted">
                <span className="font-medium text-ink-2">Coverage: </span>
                {source.coverage}
              </p>
              <p className="text-muted">
                <span className="font-medium text-ink-2">Obtained: </span>
                {source.obtained}
              </p>
              <p className="text-muted">
                <span className="font-medium text-ink-2">Limitations: </span>
                {source.limitations}
              </p>
            </div>
            <div className="min-w-0">
              <p className="flex items-start gap-1.5 text-[12.5px] leading-relaxed">
                {source.permissionConfirmed ? (
                  <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" aria-hidden />
                ) : (
                  <CircleDashed className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" aria-hidden />
                )}
                <span className={source.permissionConfirmed ? "text-ink-2" : "text-warn"}>
                  <span className="sr-only">{source.permissionConfirmed ? "Reuse confirmed: " : "Reuse to confirm: "}</span>
                  {source.permission}
                </span>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
