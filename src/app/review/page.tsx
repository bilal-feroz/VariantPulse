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
import { CaseStageBadge, DeadlineBadge } from "@/components/workflow/badges";
import { currentDecision } from "@/lib/decision";
import { pick } from "@/lib/dto";
import { composeReviewReason } from "@/lib/narrative";
import { cn } from "@/lib/utils";
import { caseStage, deadlineStatus, pendingApprovals, type CaseState } from "@/lib/workflow";
import { useWorkspace } from "@/state/workspace";
import type { VariantAssessment } from "@/lib/analysis";

type Tab = "open" | "overdue" | "approval" | "closed" | "all";

const TABS: { id: Tab; label: string; empty: string }[] = [
  { id: "open", label: "Open", empty: "Every case is closed. Run an evidence sync to check for new changes." },
  { id: "overdue", label: "Overdue", empty: "No open case has passed its review deadline." },
  { id: "approval", label: "Awaiting approval", empty: "No follow-up is waiting for approval." },
  { id: "closed", label: "Closed", empty: "Closed cases appear here, with who closed them and why." },
  { id: "all", label: "All", empty: "No review cases are open in this workspace." },
];

export default function ReviewPage() {
  const { analysis, getCase, now, persona } = useWorkspace();
  const [tab, setTab] = React.useState<Tab>("open");
  const [mine, setMine] = React.useState(false);

  const rows = React.useMemo(
    () =>
      pick(analysis, analysis.reviewableKeys).map((assessment) => ({
        assessment,
        state: getCase(assessment.caseId as string),
      })),
    [analysis, getCase],
  );

  const matches = React.useCallback(
    (id: Tab, { assessment, state }: { assessment: VariantAssessment; state: CaseState }) => {
      const closed = Boolean(state.closure);
      switch (id) {
        case "open":
          return !closed;
        case "overdue":
          return !closed && now !== null && deadlineStatus(state, assessment.priority.level, now)?.state === "overdue";
        case "approval":
          return !closed && pendingApprovals(state).length > 0;
        case "closed":
          return closed;
        default:
          return true;
      }
    },
    [now],
  );

  const scoped = mine ? rows.filter((row) => row.state.owner === persona.name) : rows;
  const counts = Object.fromEntries(TABS.map((t) => [t.id, scoped.filter((row) => matches(t.id, row)).length])) as Record<
    Tab,
    number
  >;
  const visible = scoped.filter((row) => matches(tab, row));
  const active = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Clinical review"
        title="Review queue"
        description="Cases raised by the evidence engine, each with a named owner, a review deadline and its history. VariantPulse prepares the evidence; the clinical team decides the outcome."
        actions={<SyncButton />}
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-xl bg-surface-3 p-1" role="tablist" aria-label="Case filter">
          {TABS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={tab === option.id}
              onClick={() => setTab(option.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium transition-colors",
                tab === option.id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
              )}
            >
              {option.label}
              <span
                className={cn(
                  "grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-semibold vp-num",
                  tab === option.id
                    ? option.id === "overdue" && counts.overdue > 0
                      ? "bg-crit-soft text-crit"
                      : "bg-accent-soft text-accent"
                    : "bg-surface text-faint",
                )}
              >
                {counts[option.id]}
              </span>
            </button>
          ))}
        </div>
        <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-[13px] text-ink-2">
          <input
            type="checkbox"
            checked={mine}
            onChange={(event) => setMine(event.target.checked)}
            className="h-4 w-4 accent-garnet"
          />
          Only cases I own
        </label>
      </div>

      {visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardCheck className="h-5 w-5" />}
            title={mine ? `None of your cases in ${active.label.toLowerCase()}` : `Nothing in ${active.label.toLowerCase()}`}
            description={mine ? "Clear “Only cases I own” to see every case." : active.empty}
            action={tab === "open" && !mine ? <SyncButton /> : undefined}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map(({ assessment, state }) => {
            const decision = currentDecision(state.decisions);
            const pending = pendingApprovals(state).length;
            const approved = state.followUps.filter((t) => t.status === "Approved" || t.status === "Done").length;
            return (
              <Card key={assessment.caseId} className="p-5 transition-shadow hover:border-line-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <PriorityBadge level={assessment.priority.level} />
                  <ChangeTypeBadge type={assessment.changeType} />
                  <Badge tone="muted">{assessment.caseId}</Badge>
                  <CaseStageBadge stage={caseStage(state)} />
                  {decision ? <DecisionBadge decision={decision.decision} /> : null}
                  <span className="ml-auto">
                    <DeadlineBadge state={state} level={assessment.priority.level} now={now} />
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
                    <dt className="text-[11px] font-medium uppercase tracking-[0.07em] text-faint">Owner</dt>
                    <dd className="mt-1 text-[13px] text-ink">
                      {state.owner ?? <span className="text-warn">Unassigned</span>}
                    </dd>
                  </div>
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
                      <ConfidenceMeter stars={assessment.confidence.stars} strength={assessment.confidence.strength} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-[0.07em] text-faint">Follow-up</dt>
                    <dd className="mt-1 text-[13px] text-ink">
                      {state.followUps.length === 0 ? (
                        <span className="text-muted">None yet</span>
                      ) : (
                        <span className="vp-num">
                          {approved} approved{pending > 0 ? <span className="text-warn"> · {pending} awaiting</span> : null}
                        </span>
                      )}
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
