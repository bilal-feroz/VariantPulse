"use client";

/**
 * Where a case stands: its stage in the workflow, and its review deadline.
 *
 * The deadline renders its absolute date on the server and adds the relative
 * "in 4 days" only once the session knows the time, so the first paint and
 * the hydrated page never disagree.
 */

import { AlarmClock, CalendarClock } from "lucide-react";

import { Badge } from "@/components/ui";
import type { PriorityLevel } from "@/lib/priority";
import { formatDate } from "@/lib/utils";
import {
  DEADLINE_TONE,
  REVIEW_SLA_DAYS,
  STAGE_META,
  caseStage,
  deadlineStatus,
  describeDeadline,
  reviewDeadline,
  type CaseStage,
  type CaseState,
} from "@/lib/workflow";

export function CaseStageBadge({ stage, className }: { stage: CaseStage; className?: string }) {
  const meta = STAGE_META[stage];
  return (
    <Badge tone={meta.tone} dot className={className} title={meta.description}>
      {stage}
    </Badge>
  );
}

export function StageOf({ state, className }: { state: CaseState; className?: string }) {
  return <CaseStageBadge stage={caseStage(state)} className={className} />;
}

export function DeadlineBadge({
  state,
  level,
  now,
  className,
}: {
  state: CaseState;
  level: PriorityLevel;
  /** Null before the session is hydrated: the badge shows the date alone. */
  now: Date | null;
  className?: string;
}) {
  if (!state.raisedAt) return null;

  const dueAt = reviewDeadline(state.raisedAt, level);
  const title = `Review deadline: ${formatDate(dueAt)}, ${REVIEW_SLA_DAYS[level]} days from the case being raised for ${level.toLowerCase()} priority.`;

  if (!now) {
    return (
      <Badge tone="muted" className={className} title={title}>
        <CalendarClock className="h-3 w-3" />
        Due {formatDate(dueAt)}
      </Badge>
    );
  }

  const status = deadlineStatus(state, level, now);
  if (!status) return null;
  const Icon = status.state === "overdue" ? AlarmClock : CalendarClock;
  // Tinted even when overdue: only a critical priority is ever filled.
  return (
    <Badge tone={DEADLINE_TONE[status.state]} className={className} title={title}>
      <Icon className="h-3 w-3" />
      {describeDeadline(status)}
    </Badge>
  );
}
