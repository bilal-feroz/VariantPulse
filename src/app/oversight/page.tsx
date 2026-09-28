"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, Mail, Send, Users } from "lucide-react";

import { PageHeader, PageShell } from "@/components/page-header";
import { Badge, Card, EmptyState, PriorityBadge, SectionHeading } from "@/components/ui";
import { CaseStageBadge, DeadlineBadge } from "@/components/workflow/badges";
import { SERVICE_LEAD } from "@/data/workspace";
import type { VariantAssessment } from "@/lib/analysis";
import { currentDecision } from "@/lib/decision";
import { pick } from "@/lib/dto";
import { formatMinutes, median } from "@/lib/pilot";
import { cn, formatDate } from "@/lib/utils";
import {
  STAGES,
  caseStage,
  deadlineStatus,
  pendingApprovals,
  reviewDeadline,
  timeToDecisionMs,
  type CaseState,
} from "@/lib/workflow";
import { useWorkspace } from "@/state/workspace";

const DAY = 86_400_000;
const HORIZONS = [0, 7, 14, 30] as const;

interface Row {
  assessment: VariantAssessment;
  state: CaseState;
}

export default function OversightPage() {
  const { analysis, getCase, now } = useWorkspace();
  const [horizon, setHorizon] = React.useState<(typeof HORIZONS)[number]>(0);

  const rows: Row[] = pick(analysis, analysis.reviewableKeys).map((assessment) => ({
    assessment,
    state: getCase(assessment.caseId as string),
  }));

  const open = rows.filter((r) => !r.state.closure);
  const undecided = open.filter((r) => !currentDecision(r.state.decisions));
  const overdue = now ? open.filter((r) => deadlineStatus(r.state, r.assessment.priority.level, now)?.state === "overdue") : [];
  const awaitingApproval = rows.reduce((total, r) => total + pendingApprovals(r.state).length, 0);
  const closed = rows.filter((r) => r.state.closure);
  const decisionTimes = rows.map((r) => timeToDecisionMs(r.state)).filter((ms): ms is number => ms !== null);
  const medianDecision = median(decisionTimes);

  const tiles = [
    { label: "Records monitored", value: String(analysis.scan.findingsChecked), hint: `${analysis.assessments.length} variants on the panel` },
    { label: "Cases open", value: String(open.length), hint: `${rows.length} raised in this workspace` },
    { label: "Awaiting a decision", value: String(undecided.length), hint: "Open, with nothing decided yet", tone: undecided.length ? "warn" : undefined },
    { label: "Overdue", value: now ? String(overdue.length) : "–", hint: `Escalate to ${SERVICE_LEAD.name}`, tone: overdue.length ? "crit" : undefined },
    { label: "Follow-ups awaiting approval", value: String(awaitingApproval), hint: "Across every case" },
    { label: "Median time to decision", value: medianDecision === null ? "Not yet" : formatMinutes(medianDecision / 60_000), hint: `From raised to first decision, ${decisionTimes.length} case${decisionTimes.length === 1 ? "" : "s"}` },
  ];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Programme oversight"
        title="Is anything waiting too long?"
        description="What a pilot sponsor needs to see: records monitored, cases awaiting review, turnaround, unresolved cases and each reviewer's load. Read-only for every role."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {tiles.map((tile) => (
          <Card key={tile.label} className="p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-faint">{tile.label}</p>
            <p
              className={cn(
                "mt-2 text-[26px] font-semibold leading-none tracking-tight vp-num",
                tile.tone === "crit" ? "text-crit" : tile.tone === "warn" ? "text-warn" : "text-ink",
              )}
            >
              {tile.value}
            </p>
            <p className="mt-1.5 text-[11.5px] leading-snug text-muted">{tile.hint}</p>
          </Card>
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Unresolved rows={open} />
        <div className="min-w-0 space-y-5">
          <Stages rows={rows} />
          <Communication rows={rows} />
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Workload rows={rows} />
        <Forecast rows={open} horizon={horizon} setHorizon={setHorizon} />
      </div>

      <p className="mt-5 text-[11.5px] leading-relaxed text-faint">
        Figures cover this session&rsquo;s workflow, computed from the case histories. In a pilot they come from the
        shared case store, across every reviewer. {closed.length} case{closed.length === 1 ? " is" : "s are"} closed.
      </p>
    </PageShell>
  );
}

function Unresolved({ rows }: { rows: Row[] }) {
  const { now } = useWorkspace();
  const sorted = [...rows].sort((a, b) => {
    const dueA = a.state.raisedAt ? reviewDeadline(a.state.raisedAt, a.assessment.priority.level) : "";
    const dueB = b.state.raisedAt ? reviewDeadline(b.state.raisedAt, b.assessment.priority.level) : "";
    return dueA.localeCompare(dueB);
  });

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <SectionHeading title="Unresolved cases" count={rows.length} description="Every open case, earliest deadline first." />
      </div>
      {sorted.length === 0 ? (
        <EmptyState title="Nothing unresolved" description="Every case raised in this workspace is closed." />
      ) : (
        <ul className="divide-y divide-line">
          {sorted.map(({ assessment, state }) => (
            <li key={assessment.caseId}>
              <Link
                href={`/review/${assessment.caseId}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 transition-colors hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1 basis-52">
                  <span className="block text-[13px] text-ink">
                    <span className="font-semibold">{assessment.variant.gene}</span>{" "}
                    <span className="font-mono text-[11.5px] text-muted">{assessment.variant.hgvsCoding}</span>
                  </span>
                  <span className="mt-0.5 block text-[11.5px] text-muted">
                    {assessment.caseId} · {state.owner ?? "Unassigned"}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <PriorityBadge level={assessment.priority.level} />
                  <CaseStageBadge stage={caseStage(state)} />
                  <DeadlineBadge state={state} level={assessment.priority.level} now={now} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Stages({ rows }: { rows: Row[] }) {
  const counts = STAGES.map((stage) => ({ stage, count: rows.filter((r) => caseStage(r.state) === stage).length }));
  const max = Math.max(1, ...counts.map((c) => c.count));
  return (
    <Card className="p-5">
      <SectionHeading title="Where cases stand" description="Each case by its stage in the workflow." />
      <ul className="mt-4 space-y-2">
        {counts.map(({ stage, count }) => (
          <li key={stage} className="grid grid-cols-[140px_minmax(0,1fr)_28px] items-center gap-3">
            <span className="text-[12.5px] text-ink-2">{stage}</span>
            <span className="h-2 overflow-hidden rounded-full bg-surface-3" aria-hidden>
              <span className="block h-full rounded-full bg-garnet" style={{ width: `${(count / max) * 100}%` }} />
            </span>
            <span className="text-right text-[12.5px] font-semibold text-ink vp-num">{count}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Communication({ rows }: { rows: Row[] }) {
  const tasks = rows.flatMap((r) => r.state.followUps);
  const of = (kind: string) => tasks.filter((t) => t.kind === kind);
  const tally = (kind: string) => {
    const list = of(kind);
    return {
      proposed: list.filter((t) => t.status === "Proposed").length,
      approved: list.filter((t) => t.status === "Approved").length,
      done: list.filter((t) => t.status === "Done").length,
    };
  };
  const referrals = tally("genetics-referral");
  const letters = tally("patient-letter");

  return (
    <Card className="p-5">
      <SectionHeading
        title="Referrals and patient communication"
        description="Every one passes through a follow-up approved by someone other than its proposer."
      />
      <dl className="mt-4 grid grid-cols-2 gap-4">
        {[
          { icon: Send, label: "Genetics referrals", ...referrals, doneLabel: "sent" },
          { icon: Mail, label: "Patient letters", ...letters, doneLabel: "released" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-line bg-surface-2 p-3.5">
            <dt className="flex items-center gap-1.5 text-[12px] font-medium text-ink-2">
              <item.icon className="h-3.5 w-3.5 text-faint" />
              {item.label}
            </dt>
            <dd className="mt-2 space-y-0.5 text-[12px] text-muted vp-num">
              <span className="block">
                <span className="font-semibold text-warn">{item.proposed}</span> awaiting approval
              </span>
              <span className="block">
                <span className="font-semibold text-ok">{item.approved}</span> approved
              </span>
              <span className="block">
                <span className="font-semibold text-ink">{item.done}</span> {item.doneLabel}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function Workload({ rows }: { rows: Row[] }) {
  const { now } = useWorkspace();
  const owners = new Map<string, { open: number; overdue: number; decided: number; closed: number }>();
  for (const { assessment, state } of rows) {
    const name = state.owner ?? "Unassigned";
    const entry = owners.get(name) ?? { open: 0, overdue: 0, decided: 0, closed: 0 };
    if (state.closure) entry.closed += 1;
    else entry.open += 1;
    if (!state.closure && now && deadlineStatus(state, assessment.priority.level, now)?.state === "overdue") entry.overdue += 1;
    if (state.decisions.length > 0) entry.decided += 1;
    owners.set(name, entry);
  }
  const table = [...owners.entries()].sort(([a, x], [b, y]) =>
    a === "Unassigned" ? -1 : b === "Unassigned" ? 1 : y.open - x.open || a.localeCompare(b),
  );

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <SectionHeading title="Reviewer workload" icon={<Users className="h-4 w-4" />} description="Cases by owner. Unassigned cases lead." />
      </div>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-line bg-surface-2">
            {["Owner", "Open", "Overdue", "Decided", "Closed"].map((heading) => (
              <th key={heading} scope="col" className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-faint">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.map(([name, entry]) => (
            <tr key={name} className="border-b border-line last:border-0">
              <th scope="row" className={cn("px-5 py-2.5 text-[13px] font-medium", name === "Unassigned" ? "text-warn" : "text-ink")}>
                {name}
              </th>
              <td className="px-5 py-2.5 text-[13px] text-ink vp-num">{entry.open}</td>
              <td className={cn("px-5 py-2.5 text-[13px] vp-num", entry.overdue ? "font-semibold text-crit" : "text-muted")}>
                {entry.overdue}
              </td>
              <td className="px-5 py-2.5 text-[13px] text-ink-2 vp-num">{entry.decided}</td>
              <td className="px-5 py-2.5 text-[13px] text-ink-2 vp-num">{entry.closed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function Forecast({
  rows,
  horizon,
  setHorizon,
}: {
  rows: Row[];
  horizon: (typeof HORIZONS)[number];
  setHorizon: (horizon: (typeof HORIZONS)[number]) => void;
}) {
  const { now } = useWorkspace();
  const at = now ? new Date(now.getTime() + horizon * DAY) : null;
  const late = at
    ? rows.filter((r) => !currentDecision(r.state.decisions) && deadlineStatus(r.state, r.assessment.priority.level, at)?.state === "overdue")
    : [];

  return (
    <Card className="p-5">
      <SectionHeading
        title="Deadline forecast"
        icon={<CalendarClock className="h-4 w-4" />}
        description="If nothing moves: which open, undecided cases will have passed their review deadline."
      />
      <div className="mt-4 flex flex-wrap items-center gap-1 rounded-xl bg-surface-3 p-1" role="tablist" aria-label="Forecast horizon">
        {HORIZONS.map((days) => (
          <button
            key={days}
            type="button"
            role="tab"
            aria-selected={horizon === days}
            onClick={() => setHorizon(days)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors",
              horizon === days ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            {days === 0 ? "Today" : `In ${days} days`}
          </button>
        ))}
      </div>
      {at ? (
        <>
          <p className="mt-4 text-[13.5px] text-ink-2">
            By <span className="font-medium text-ink">{formatDate(at.toISOString())}</span>,{" "}
            <span className={cn("font-semibold vp-num", late.length ? "text-crit" : "text-ok")}>{late.length}</span> of{" "}
            {rows.length} open case{rows.length === 1 ? "" : "s"} will be overdue and with {SERVICE_LEAD.name}.
          </p>
          {late.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {late.map((r) => (
                <li key={r.assessment.caseId}>
                  <Link href={`/review/${r.assessment.caseId}`}>
                    <Badge tone="critical" className="hover:underline">
                      {r.assessment.caseId} · {r.assessment.variant.gene}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
      <Link href="/review" className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-accent hover:underline">
        Open the review queue
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </Card>
  );
}
