"use client";

import Link from "next/link";
import { ArrowRight, Globe2, MapPin, TriangleAlert } from "lucide-react";

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
import { REGIONAL_SOURCE } from "@/data/regional";
import { pick } from "@/lib/dto";
import { formatNumber } from "@/lib/utils";
import { useWorkspace } from "@/state/workspace";

export default function RegionalPage() {
  const { analysis } = useWorkspace();

  const conflicts = pick(analysis, analysis.regionalConflictKeys);
  const covered = analysis.assessments.filter((a) => a.regional);
  const agreeing = covered.filter((a) => !a.regionalDisagreement?.conflicting);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Regional evidence"
        title="Regional insights"
        description="Compare global genomic interpretation with evidence relevant to Arab and Gulf populations. Where the two disagree, VariantPulse surfaces the disagreement rather than picking a winner."
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
              ClinVar submissions, reference population frequencies and published international
              evidence. The reference cohorts behind these datasets are predominantly of European
              ancestry.
            </p>
            <p className="mt-3 text-[12.5px] text-muted">
              <span className="font-medium text-ink vp-num">{analysis.assessments.length}</span>{" "}
              variants read from ClinVar
            </p>
          </div>

          <div
            className="hidden w-px bg-line lg:block"
            aria-hidden
          />

          <div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted" />
              <Eyebrow>Regional</Eyebrow>
            </div>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-2">
              Observations from Arab and Gulf cohorts, where founder effects and higher
              consanguinity can make a variant behave differently from the global reference set.
            </p>
            <p className="mt-3 text-[12.5px] text-muted">
              <span className="font-medium text-ink vp-num">{covered.length}</span> variants held ·{" "}
              {REGIONAL_SOURCE.scope}
            </p>
          </div>
        </div>

        <p className="mt-5 border-t border-line pt-3.5 text-[13px] leading-relaxed text-ink-2">
          Of <span className="font-medium text-ink vp-num">{covered.length}</span> variants held in
          both sources,{" "}
          <span className="font-medium text-warn vp-num">{conflicts.length}</span> read differently
          and need a clinician to weigh them;{" "}
          <span className="font-medium text-ok vp-num">{agreeing.length}</span> fall in the same
          clinical band, across{" "}
          <span className="font-medium text-ink vp-num">
            {formatNumber(covered.reduce((total, a) => total + (a.regional?.observations ?? 0), 0))}
          </span>{" "}
          regional observations.
        </p>
        <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
          {REGIONAL_SOURCE.coverageNote} VariantPulse does not imply endorsement by, or
          integration with, any national programme or registry.
        </p>
      </Card>

      <SectionHeading
        title="Regional evidence conflicts"
        count={conflicts.length}
        icon={<TriangleAlert className="h-4 w-4" />}
        description="Human review required. VariantPulse does not rank one source above the other."
      />

      {conflicts.length === 0 ? (
        <Card className="mt-4">
          <EmptyState
            icon={<Globe2 className="h-5 w-5" />}
            title="No regional conflicts detected"
            description="Global and regional evidence agree across every variant held in the regional index."
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
              <RegionalComparison assessment={assessment} />
            </div>
          ))}
        </div>
      )}

      <SectionHeading
        className="mt-8"
        title="Consistent across sources"
        count={agreeing.length}
        description="Variants where the regional index agrees with the global consensus."
      />
      <Card className="mt-4 overflow-hidden">
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
                <td className="px-5 py-3">
                  {assessment.regional ? (
                    <ClassificationBadge code={assessment.regional.assertion} />
                  ) : (
                    <Badge tone="muted">Not held</Badge>
                  )}
                </td>
                <td className="px-5 py-3 text-[12.5px] text-ink-2 vp-num">
                  {assessment.regional?.observations ?? "-"}
                </td>
                <td className="px-5 py-3 text-[12.5px] text-muted vp-num">
                  {assessment.regional ? formatNumber(assessment.regional.cohortSize) : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="mt-5 p-5">
        <SectionHeading title="Why regional evidence matters" />
        <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-ink-2">
          A variant that is common and harmless in one population can be a founder variant in
          another. When the reference data behind a classification does not include the population
          a patient belongs to, a confident global reading can still be the wrong reading locally.
          VariantPulse holds both and asks a clinician to weigh them, rather than resolving the
          disagreement automatically.
        </p>
      </Card>
    </PageShell>
  );
}
