"use client";

import * as React from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { ArrowDown, Lock } from "lucide-react";

import { AiSummaryPanel } from "@/components/ai-summary";
import { ThenNow } from "@/components/domain";
import { PageHeader, PageShell } from "@/components/page-header";
import {
  EvidenceComparison,
  PriorityPanel,
  ReasoningPanel,
  RegionalComparison,
  ScienceTimeline,
} from "@/components/panels";
import { PatientImpactTable } from "@/components/patient-table";
import { PatientImpactGraph, SyntheticDataLabel } from "@/components/clinical/patient-impact-graph";
import { Card, ChangeTypeBadge, DecisionNotice, Field, PriorityBadge, SectionHeading } from "@/components/ui";
import { WhatChanged } from "@/components/what-changed";
import { CaseStageBadge, DeadlineBadge } from "@/components/workflow/badges";
import {
  ClosureCard,
  DecisionCard,
  FollowUpCard,
  OutputsCard,
  OwnerCard,
  ReviewCard,
} from "@/components/workflow/case-actions";
import { CaseHistory } from "@/components/workflow/case-history";
import { CaseJourney } from "@/components/workflow/journey";
import { meta } from "@/lib/classification";
import { composeRecommendation } from "@/lib/narrative";
import { caseJourney, caseStage } from "@/lib/workflow";
import { useWorkspace } from "@/state/workspace";

export default function ReviewCasePage() {
  const params = useParams<{ caseId: string }>();
  const caseId = decodeURIComponent(params.caseId);
  const { analysis, getCase, addNote, now, silentMode } = useWorkspace();

  const assessment = analysis.assessments.find((a) => a.caseId === caseId);
  if (!assessment) notFound();

  const state = getCase(caseId);
  const stage = caseStage(state);
  const byKey = new Map(analysis.assessments.map((a) => [a.variant.key, a]));
  const steps = caseJourney(state, {
    change: `${meta(assessment.recordedCode).label} → ${meta(assessment.currentCode).label}`,
    source: "ClinVar",
    evaluatedAt: assessment.evidence.lastEvaluated,
    recordsMatched: assessment.impactedRecordCount,
  });
  const props = { caseId, assessment, state };

  return (
    <PageShell>
      <PageHeader
        back={{ href: "/review", label: "Review queue" }}
        eyebrow={caseId}
        title={`${assessment.variant.gene} ${assessment.variant.hgvsCoding}`}
        description={assessment.variant.condition}
        actions={
          <span className="flex flex-wrap items-center justify-end gap-2">
            <CaseStageBadge stage={stage} />
            <DeadlineBadge state={state} level={assessment.priority.level} now={now} />
            <PriorityBadge level={assessment.priority.level} />
          </span>
        }
      />

      <p className="mb-4 text-[13.5px] text-muted">
        <span className="font-semibold text-ink">Your DNA didn&rsquo;t change. Science did.</span> AI assists.
        Clinicians decide.
      </p>

      {silentMode ? (
        <p className="mb-4 flex items-start gap-2.5 rounded-2xl border border-warn-border bg-warn-soft px-4 py-3 text-[13px] leading-relaxed text-warn">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            <strong className="font-semibold">Silent pilot.</strong> Review, decisions and approvals are
            recorded for evaluation, but nothing reaches a patient and nothing is exported to hospital systems.{" "}
            <Link href="/pilot" className="font-medium underline underline-offset-2">
              Pilot settings
            </Link>
          </span>
        </p>
      ) : null}

      <CaseJourney steps={steps} />
      <a
        href="#case-actions"
        className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-accent hover:underline xl:hidden"
      >
        <ArrowDown className="h-3.5 w-3.5" />
        Go to the case actions
      </a>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        {/* ── Evidence and explanation ───────────────────────────────── */}
        <div className="min-w-0 space-y-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card className="p-5">
              <SectionHeading title="Classification change" />
              <ThenNow assessment={assessment} stacked caption className="mt-4" />
              <div className="mt-4 border-t border-line pt-3.5">
                <ChangeTypeBadge type={assessment.changeType} />
              </div>
            </Card>
            <Card className="p-5">
              <SectionHeading title="Variant" />
              <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3.5">
                <Field label="Gene" value={assessment.variant.gene} />
                <Field label="HGVS (coding)" value={assessment.variant.hgvsCoding} mono />
                <Field label="Protein" value={assessment.variant.proteinChange ?? "Not applicable"} mono />
                <Field
                  label="ClinVar"
                  value={assessment.evidence.accession ?? assessment.evidence.clinvarId}
                  mono
                />
                <Field label="dbSNP" value={assessment.evidence.rsid ?? "Not linked"} mono />
                <Field label="Panel" value={assessment.variant.panel} />
                <Field
                  label="Molecular consequence"
                  value={assessment.evidence.molecularConsequence ?? "Not stated"}
                  className="col-span-2"
                />
              </dl>
            </Card>
          </div>

          <WhatChanged assessment={assessment} read={analysis} />

          <AiSummaryPanel assessment={assessment} onUseInBrief={(text) => addNote(caseId, text, "summary")} />

          <Card className="p-5">
            <SectionHeading
              title="Patient impact"
              count={assessment.impactedRecordCount}
              description="The changed variant and every historical record that carries it. Select a record to see its detail."
            />
            <SyntheticDataLabel className="mt-3" />
            <PatientImpactGraph assessment={assessment} caseStatus={stage} className="mt-5" />
          </Card>

          <EvidenceComparison assessment={assessment} />
          {assessment.regional ? <RegionalComparison assessment={assessment} /> : null}
          <div className="grid gap-5 lg:grid-cols-2">
            <ScienceTimeline assessment={assessment} />
            <div className="min-w-0 space-y-5">
              <ReasoningPanel assessment={assessment} />
              <PriorityPanel assessment={assessment} />
            </div>
          </div>
          <CaseHistory caseId={caseId} state={state} records={assessment.impactedRecordCount} />
        </div>

        {/* ── The workflow ───────────────────────────────────────────── */}
        <div id="case-actions" className="min-w-0 scroll-mt-4 space-y-5">
          <OwnerCard {...props} />
          <ReviewCard {...props} />
          <DecisionCard {...props} />
          <FollowUpCard {...props} />
          <ClosureCard {...props} />
          <OutputsCard {...props} />
          <Card className="p-5">
            <SectionHeading title="Recommendation" />
            <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
              {composeRecommendation(assessment.changeType, assessment.impactedRecordCount)}
            </p>
          </Card>
          <DecisionNotice className="px-1" />
        </div>
      </div>

      <Card className="mt-5 overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <SectionHeading title="Affected records in full" count={assessment.impactedPatients.length} />
          <SyntheticDataLabel className="mt-3" />
        </div>
        <PatientImpactTable
          rows={assessment.impactedPatients}
          byKey={byKey}
          showVariant={false}
          caseStatus={stage}
        />
      </Card>
    </PageShell>
  );
}
