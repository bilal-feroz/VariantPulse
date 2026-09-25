"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { ArrowRight, ExternalLink } from "lucide-react";

import { ThenNow } from "@/components/domain";
import { PageHeader, PageShell } from "@/components/page-header";
import {
  EvidenceComparison,
  EvidenceSummaryPanel,
  PriorityPanel,
  ReasoningPanel,
  RegionalComparison,
  ScienceTimeline,
} from "@/components/panels";
import { PatientImpactTable } from "@/components/patient-table";
import { SyncButton } from "@/components/sync";
import {
  Badge,
  Button,
  Card,
  ChangeTypeBadge,
  DecisionNotice,
  PriorityBadge,
  SectionHeading,
} from "@/components/ui";
import { CHANGE_TYPES } from "@/lib/classification";
import { composeRecommendation } from "@/lib/narrative";
import { useWorkspace } from "@/state/workspace";

export default function VariantPage() {
  const params = useParams<{ key: string }>();
  const { analysis } = useWorkspace();

  const key = decodeURIComponent(params.key);
  const assessment = analysis.assessments.find((a) => a.variant.key === key);
  if (!assessment) notFound();

  const { variant, evidence, changeType, impactedPatients, caseId } = assessment;
  const byKey = new Map(analysis.assessments.map((a) => [a.variant.key, a]));

  return (
    <PageShell>
      <PageHeader
        back={{ href: "/variants", label: "All variants" }}
        eyebrow={variant.panel}
        title={`${variant.gene} ${variant.hgvsCoding}`}
        description={`${variant.proteinChange ? `${variant.proteinChange} · ` : ""}${variant.condition}`}
        actions={
          <>
            <SyncButton />
            {caseId ? (
              <Link href={`/review/${caseId}`}>
                <Button variant="primary">
                  Open review case
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : null}
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <ChangeTypeBadge type={changeType} />
        {caseId ? <PriorityBadge level={assessment.priority.level} /> : null}
        {caseId ? (
          <Badge tone="muted">{caseId}</Badge>
        ) : (
          <Badge tone="positive" dot>
            No review required
          </Badge>
        )}
        <a
          href={`https://www.ncbi.nlm.nih.gov/clinvar/variation/${evidence.clinvarId}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent hover:underline"
        >
          {evidence.accession ?? `VCV${evidence.clinvarId}`}
          <ExternalLink className="h-3 w-3" />
        </a>
        {evidence.rsid ? (
          <a
            href={`https://www.ncbi.nlm.nih.gov/snp/${evidence.rsid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent hover:underline"
          >
            {evidence.rsid}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>

      <Card className="mb-5 p-5">
        <SectionHeading
          title="Then and now"
          description={CHANGE_TYPES[changeType].description}
        />
        <ThenNow assessment={assessment} size="lg" className="mt-5" />
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <EvidenceSummaryPanel assessment={assessment} />
          <EvidenceComparison assessment={assessment} />
          {assessment.regional ? <RegionalComparison assessment={assessment} /> : null}
        </div>

        <div className="space-y-5">
          <ScienceTimeline assessment={assessment} />
          <ReasoningPanel assessment={assessment} />
          {caseId ? <PriorityPanel assessment={assessment} /> : null}
        </div>
      </div>

      <Card className="mt-5 overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <SectionHeading
            title="Records carrying this variant"
            count={impactedPatients.length}
            description="Historical findings in the connected record system that reference this variant."
          />
        </div>
        <PatientImpactTable rows={impactedPatients} byKey={byKey} showVariant={false} />
      </Card>

      <Card className="mt-5 p-5">
        <SectionHeading title="Recommendation" />
        <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
          {composeRecommendation(changeType, impactedPatients.length)}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
          <DecisionNotice className="max-w-xl" />
          {caseId ? (
            <Link href={`/review/${caseId}`}>
              <Button variant="primary">
                Open clinical review
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          ) : null}
        </div>
      </Card>
    </PageShell>
  );
}
