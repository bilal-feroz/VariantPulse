"use client";

import Link from "next/link";
import { ArrowRight, ExternalLink, Globe2, History, MapPin, TriangleAlert } from "lucide-react";

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
import { REGIONAL_SOURCE, type AlleleFrequency } from "@/data/regional";
import type { VariantAssessment } from "@/lib/analysis";
import { pick } from "@/lib/dto";
import { cn, formatNumber } from "@/lib/utils";
import { useWorkspace } from "@/state/workspace";

/** The CTGA entry itself, opened beside the workspace rather than in place of it. */
function CtgaLink({ href, className }: { href: string; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-medium text-accent hover:underline",
        className,
      )}
    >
      View on CTGA
      <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  );
}

function frequencyCell(value: AlleleFrequency | null) {
  if (!value || value.frequency === null) {
    return <span className="text-muted">Not in gnomAD v4</span>;
  }
  return (
    <>
      <span className="font-mono text-ink">
        {value.frequency === 0 ? "0" : value.frequency.toExponential(2)}
      </span>
      <span className="block text-[11px] text-faint vp-num">
        {formatNumber(value.alleleCount)} of {formatNumber(value.alleleNumber)}
      </span>
    </>
  );
}

function signalBadge(assessment: VariantAssessment) {
  const { kind, flagged } = assessment.regionalSignal;
  if (flagged) return <Badge tone="warning" dot>Signal</Badge>;
  if (kind === "CATALOGUE_AHEAD") return <Badge tone="neutral">Regional record ahead</Badge>;
  if (kind === "CATALOGUE_AGREES") return <Badge tone="positive">Agrees</Badge>;
  return <Badge tone="muted">None</Badge>;
}

export default function RegionalPage() {
  const { analysis } = useWorkspace();

  const flagged = pick(analysis, analysis.regionalConflictKeys);
  const ahead = analysis.assessments.filter((a) => a.regionalSignal.kind === "CATALOGUE_AHEAD");
  const inGnomad = analysis.assessments.filter((a) => a.regional?.inGnomad);
  const observedRegionally = inGnomad.filter((a) => (a.regional?.middleEastern?.alleleCount ?? 0) > 0);
  const catalogued = analysis.assessments.filter((a) => a.regional?.catalogue);
  const live = analysis.mode === "live";

  return (
    <PageShell>
      <PageHeader
        eyebrow="Regional evidence"
        title="Regional insights"
        description="Global interpretation beside Middle Eastern population frequencies from gnomAD v4 and records from the Catalogue for Transmission Genetics in Arabs. Regional evidence is weighed by a clinician; VariantPulse never turns it into a classification."
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
              ClinVar classifications and gnomAD v4 frequencies across all samples. The cohorts
              behind these datasets are predominantly of European ancestry.
            </p>
            <p className="mt-3 text-[12.5px] text-muted">
              <span className="font-medium text-ink vp-num">{analysis.assessments.length}</span>{" "}
              variants compared against {live ? "live ClinVar evidence" : "the cached, verified ClinVar snapshot"}
            </p>
          </div>

          <div className="hidden w-px bg-line lg:block" aria-hidden />

          <div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted" />
              <Eyebrow>Regional</Eyebrow>
            </div>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-2">
              gnomAD v4&rsquo;s {REGIONAL_SOURCE.population}, about 3,000 people out of roughly
              800,000, and CTGA&rsquo;s records of variants seen in Arab patients.
            </p>
            <p className="mt-3 text-[12.5px] text-muted">
              <span className="font-medium text-ink vp-num">{inGnomad.length}</span> of{" "}
              {analysis.assessments.length} variants in gnomAD v4 ·{" "}
              <span className="font-medium text-ink vp-num">{catalogued.length}</span> with a CTGA
              record
            </p>
          </div>
        </div>

        <p className="mt-5 border-t border-line pt-3.5 text-[11.5px] leading-relaxed text-faint">
          {REGIONAL_SOURCE.coverageNote} VariantPulse does not imply endorsement by, or integration
          with, any national programme or registry.
        </p>
      </Card>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-[28px] font-semibold leading-none text-warn vp-num">{flagged.length}</p>
          <p className="mt-2 text-[13px] font-medium text-ink-2">Regional signals</p>
          <p className="mt-1 text-[11.5px] text-faint">Deserve a clinician&rsquo;s review</p>
        </Card>
        <Card className="p-5">
          <p className="text-[28px] font-semibold leading-none text-info vp-num">{ahead.length}</p>
          <p className="mt-2 text-[13px] font-medium text-ink-2">Regional record was ahead</p>
          <p className="mt-1 text-[11.5px] text-faint">CTGA held today&rsquo;s reading first</p>
        </Card>
        <Card className="p-5">
          <p className="text-[28px] font-semibold leading-none text-ink vp-num">
            {observedRegionally.length}
          </p>
          <p className="mt-2 text-[13px] font-medium text-ink-2">Seen in the Middle Eastern group</p>
          <p className="mt-1 text-[11.5px] text-faint">Variants with at least one gnomAD v4 allele</p>
        </Card>
      </div>

      <SectionHeading
        title="Regional signals"
        count={flagged.length}
        icon={<TriangleAlert className="h-4 w-4" />}
        description="Human review required. Frequency is evidence, not a diagnosis, and VariantPulse does not rank one source above another."
      />

      {flagged.length === 0 ? (
        <Card className="mt-4">
          <EmptyState
            icon={<Globe2 className="h-5 w-5" />}
            title="No regional signals"
            description="Regional frequencies and catalogue records raise nothing that needs review."
          />
        </Card>
      ) : (
        <div className="mt-4 space-y-5">
          {flagged.map((assessment) => (
            <RegionalCase key={assessment.variant.key} assessment={assessment} />
          ))}
        </div>
      )}

      {ahead.length > 0 ? (
        <>
          <SectionHeading
            className="mt-8"
            title="Where regional evidence was ahead"
            count={ahead.length}
            icon={<History className="h-4 w-4" />}
            description="A regional catalogue recorded today's reading before ClinVar's January 2023 release did."
          />
          <div className="mt-4 space-y-5">
            {ahead.map((assessment) => (
              <RegionalCase key={assessment.variant.key} assessment={assessment} />
            ))}
          </div>
        </>
      ) : null}

      <SectionHeading
        className="mt-8"
        title="Frequency context for every monitored variant"
        count={analysis.assessments.length}
        description="gnomAD v4 allele frequency in the Middle Eastern group and across all samples, beside ClinVar today."
      />
      <Card className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line bg-surface-2">
                {["Variant", "ClinVar now", "Middle Eastern", "All samples", "CTGA", "Regional"].map(
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
              {analysis.assessments.map((assessment) => (
                <tr key={assessment.variant.key} className="border-b border-line last:border-0 align-top">
                  <th scope="row" className="px-5 py-3">
                    <Link
                      href={`/variants/${encodeURIComponent(assessment.variant.key)}`}
                      className="hover:text-accent"
                    >
                      <VariantLabel
                        gene={assessment.variant.gene}
                        hgvs={assessment.variant.hgvsCoding}
                        size="sm"
                      />
                    </Link>
                  </th>
                  <td className="px-5 py-3">
                    <ClassificationBadge code={assessment.currentCode} />
                  </td>
                  <td className="px-5 py-3 text-[12.5px]">
                    {frequencyCell(assessment.regional?.middleEastern ?? null)}
                  </td>
                  <td className="px-5 py-3 text-[12.5px]">
                    {frequencyCell(assessment.regional?.global ?? null)}
                  </td>
                  <td className="px-5 py-3 text-[12.5px] text-ink-2">
                    {assessment.regional?.catalogue ? (
                      <>
                        <span className="block">{assessment.regional.catalogue.significance}</span>
                        <CtgaLink href={assessment.regional.catalogue.url} className="mt-1" />
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">{signalBadge(assessment)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-5 p-5">
        <SectionHeading title="Why regional evidence matters" />
        <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-ink-2">
          A variant that is rare in one population can be a founder variant in another. When the
          reference data behind a classification barely includes the population a patient belongs
          to — gnomAD v4&rsquo;s Middle Eastern group is under 0.4% of its samples — a confident global
          reading can still miss what is known locally. VariantPulse holds both and asks a clinician
          to weigh them, rather than resolving the difference automatically.
        </p>
      </Card>
    </PageShell>
  );
}

function RegionalCase({ assessment }: { assessment: VariantAssessment }) {
  const catalogue = assessment.regional?.catalogue;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <VariantLabel
          gene={assessment.variant.gene}
          hgvs={assessment.variant.hgvsCoding}
          protein={assessment.variant.proteinChange}
          size="md"
        />
        <div className="flex items-center gap-4">
          {catalogue ? <CtgaLink href={catalogue.url} /> : null}
          <Link
            href={
              assessment.caseId
                ? `/review/${assessment.caseId}`
                : `/variants/${encodeURIComponent(assessment.variant.key)}`
            }
          >
            <Button variant="primary" size="sm">
              {assessment.caseId ? "Open review case" : "View variant"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
      <RegionalComparison assessment={assessment} />
    </div>
  );
}
