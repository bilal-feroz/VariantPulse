"use client";

/**
 * The clinician's decision on a review case: the badge the queue shows, the
 * three decision buttons, and the read-only record on the case page.
 *
 * The three buttons are styled alike on purpose. The interface should not nudge
 * a reviewer toward confirming a change any more than toward setting it aside.
 */

import * as React from "react";
import { CircleCheck, CircleSlash2, FileSearch, PenLine } from "lucide-react";

import { Timestamp } from "@/components/clinical/timestamp";
import { Badge, Button, Card, SectionHeading } from "@/components/ui";
import type { Tone } from "@/lib/classification";
import {
  DECISION_GUIDANCE,
  DECISIONS,
  currentDecision,
  type Decision,
  type DecisionRecord,
} from "@/lib/decision";
import { cn } from "@/lib/utils";

const DECISION_TONE: Record<Decision, Tone> = {
  "Confirm change": "positive",
  "Not applicable": "muted",
  "Needs more evidence": "warning",
};

const DECISION_ICON: Record<Decision, React.ComponentType<{ className?: string }>> = {
  "Confirm change": CircleCheck,
  "Not applicable": CircleSlash2,
  "Needs more evidence": FileSearch,
};

export function DecisionBadge({
  decision,
  className,
}: {
  decision: Decision;
  className?: string;
}) {
  return (
    <Badge
      tone={DECISION_TONE[decision]}
      dot
      className={className}
      title={`Clinician decision: ${DECISION_GUIDANCE[decision]}`}
    >
      {decision}
    </Badge>
  );
}

export function DecisionButtons({
  disabled,
  onDecide,
  className,
}: {
  disabled: boolean;
  onDecide: (decision: Decision) => void;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-2 sm:grid-cols-3 min-[1400px]:grid-cols-1", className)}>
      {DECISIONS.map((decision) => {
        const Icon = DECISION_ICON[decision];
        return (
          <Button
            key={decision}
            type="button"
            className="w-full justify-start"
            disabled={disabled}
            title={DECISION_GUIDANCE[decision]}
            onClick={() => onDecide(decision)}
          >
            <Icon className="h-4 w-4" />
            {decision}
          </Button>
        );
      })}
    </div>
  );
}

/** The decision in force, who made it and when, and every entry it amended. */
export function DecisionBlock({
  history,
  amending,
  onAmend,
}: {
  history: DecisionRecord[];
  amending: boolean;
  onAmend: () => void;
}) {
  const latest = currentDecision(history);
  if (!latest) return null;
  const earlier = history.slice(0, -1).reverse();

  return (
    <Card className="p-5">
      <SectionHeading
        title="Decision"
        action={
          <button
            type="button"
            onClick={onAmend}
            disabled={amending}
            className="inline-flex items-center gap-1 text-[12.5px] font-medium text-muted transition-colors hover:text-accent disabled:pointer-events-none disabled:text-faint"
          >
            <PenLine className="h-3.5 w-3.5" />
            {amending ? "Amending" : "Amend"}
          </button>
        }
      />
      <DecisionEntry record={latest} className="mt-3.5" />

      {earlier.length > 0 ? (
        <div className="mt-4 border-t border-line pt-3.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-faint">
            Amended {earlier.length === 1 ? "once" : `${earlier.length} times`} · earlier entries
          </p>
          <ol className="mt-2.5 space-y-3">
            {earlier.map((record) => (
              <li key={record.at}>
                <DecisionEntry record={record} muted />
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <p className="mt-4 text-[11.5px] leading-relaxed text-faint">
        Read-only. An amendment is added to this record; it never replaces what was decided.
      </p>
    </Card>
  );
}

function DecisionEntry({
  record,
  muted = false,
  className,
}: {
  record: DecisionRecord;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <DecisionBadge decision={record.decision} />
      <p className="mt-2 text-[12px] text-faint">
        <span className="font-medium text-ink-2">{record.reviewer}</span>
        <span aria-hidden> · </span>
        <Timestamp value={record.at} className="vp-num" />
      </p>
      <p
        className={cn(
          "mt-1.5 text-[13px] leading-relaxed [overflow-wrap:anywhere]",
          muted ? "text-muted" : "text-ink-2",
        )}
      >
        {record.note}
      </p>
    </div>
  );
}
