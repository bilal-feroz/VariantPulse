"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ClipboardCheck, Users } from "lucide-react";

import { DecisionBadge } from "@/components/decision";
import { PageHeader, PageShell } from "@/components/page-header";
import { SyncButton } from "@/components/sync";
import {
  Badge,
  Card,
  ChangeTypeBadge,
  ConfidenceMeter,
  EmptyState,
  PriorityBadge,
  VariantLabel,
} from "@/components/ui";
import { currentDecision } from "@/lib/decision";
import { composeReviewReason } from "@/lib/narrative";
import { cn } from "@/lib/utils";
import { pick } from "@/lib/dto";
import { useWorkspace, type CaseStatus } from "@/state/workspace";
import { RelativeTime } from "@/components/relative-time";

const TABS: CaseStatus[] = ["Needs review", "Assigned", "In review", "Reviewed"];

export default function ReviewPage() {
  const { analysis, getCase } = useWorkspace();
  const [tab, setTab] = React.useState<CaseStatus>("Needs review");

  const cases = pick(analysis, analysis.reviewableKeys);

  const counts = React.useMemo(() => {
    const result = Object.fromEntries(TABS.map((t) => [t, 0])) as Record<CaseStatus, number>;
    for (const assessment of cases) {
      const state = getCase(assessment.caseId as string);
      result[state.status] += 1;
    }
    return result;
  }, [cases, getCase]);

  const rows = cases.filter((a) => getCase(a.caseId as string).status === tab);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Clinical review"
        title="Review queue"
        description="Cases raised by the evidence engine. VariantPulse prepares the evidence; the clinical team decides the outcome."
        actions={<SyncButton />}
      />

      <div className="mb-5 flex flex-wrap items-center gap-1 rounded-xl bg-surface-3 p-1" role="tablist">
        {TABS.map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={tab === option}
            onClick={() => setTab(option)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium transition-colors",
              tab === option
                ? "bg-surface text-ink shadow-sm"
                : "text-muted hover:text-ink",
            )}
          >
            {option}
            <span
              className={cn(
                "grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-semibold vp-num",
                tab === option ? "bg-accent-soft text-accent" : "bg-surface text-faint",
              )}
            >
              {counts[option]}
            </span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardCheck className="h-5 w-5" />}
            title={`Nothing in ${tab.toLowerCase()}`}
            description={
              tab === "Needs review"
                ? "Every open case has been picked up. Run an evidence sync to check for new changes."
                : "Cases will appear here as they move through the queue."
            }
            action={tab === "Needs review" ? <SyncButton /> : undefined}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((assessment) => {
            const state = getCase(assessment.caseId as string);
            const decision = currentDecision(state.decisions);
            return (
              <Card key={assessment.caseId} className="p-5 transition-shadow hover:border-line-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <PriorityBadge level={assessment.priority.level} />
                  <ChangeTypeBadge type={assessment.changeType} />
                  <Badge tone="muted">{assessment.caseId}</Badge>
                  {decision ? <DecisionBadge decision={decision.decision} /> : null}
                  <span className="ml-auto text-[11.5px] text-faint">
                    Raised <RelativeTime value={analysis.checkedAt} />
                  </span>
                </div>

                <div className="mt-3.5 flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <VariantLabel
                      gene={assessment.variant.gene}
                      hgvs={assessment.variant.hgvsCoding}
                      protein={assessment.variant.proteinChange}
                    />
                    <p className="mt-1.5 text-[13px] text-ink-2">
                      {composeReviewReason(assessment.changeType, assessment.variant.gene)}
                    </p>
                  </div>
                  <Link
                    href={`/review/${assessment.caseId}`}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-oxblood px-4 py-2.5 text-[13px] font-medium text-warm-white transition-colors hover:bg-garnet"
                  >
                    Open case
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                <dl className="mt-4 grid gap-x-6 gap-y-3 border-t border-line pt-3.5 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-[0.07em] text-faint">
                      Records impacted
                    </dt>
                    <dd className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink">
                      <Users className="h-3.5 w-3.5 text-faint" />
                      <span className="vp-num">{assessment.impactedRecordCount}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-[0.07em] text-faint">
                      Evidence confidence
                    </dt>
                    <dd className="mt-1">
                      <ConfidenceMeter
                        stars={assessment.confidence.stars}
                        strength={assessment.confidence.strength}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-[0.07em] text-faint">
                      Assigned
                    </dt>
                    <dd className="mt-1 text-[13px] text-ink">
                      {state.assignee ?? <span className="text-muted">Unassigned</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-[0.07em] text-faint">
                      Status
                    </dt>
                    <dd className="mt-1">
                      <Badge
                        tone={
                          state.status === "Reviewed"
                            ? "positive"
                            : state.status === "Needs review"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {state.status}
                      </Badge>
                    </dd>
                  </div>
                </dl>
              </Card>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
