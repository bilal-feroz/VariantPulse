"use client";

/**
 * A case's history: who reviewed, decided, approved or changed it, and when,
 * oldest first, exportable as it stands. Entries are appended and never
 * edited, so an amendment or a reopening sits beside what it changed.
 */

import { Download } from "lucide-react";

import { Timestamp } from "@/components/clinical/timestamp";
import { Button, Card, SectionHeading } from "@/components/ui";
import { cn } from "@/lib/utils";
import { CASE_EVENT_LABEL, type CaseEvent, type CaseEventType, type CaseState } from "@/lib/workflow";

const TONE: Partial<Record<CaseEventType, string>> = {
  raised: "bg-vermilion",
  escalated: "bg-crit",
  decision: "bg-garnet",
  amendment: "bg-garnet",
  "follow-up-approved": "bg-ok",
  "follow-up-done": "bg-ok",
  closed: "bg-ok",
  "follow-up-declined": "bg-slate",
  reopened: "bg-amber",
  "evidence-request": "bg-amber",
  "follow-up-proposed": "bg-amber",
};

/** The case's own events, headed by the moment VariantPulse raised it. */
export function caseHistory(caseId: string, state: CaseState, records: number): CaseEvent[] {
  const raised: CaseEvent[] = state.raisedAt
    ? [
        {
          id: `${caseId}-raised`,
          at: state.raisedAt,
          type: "raised",
          actor: "VariantPulse",
          role: "System",
          summary: "Case raised",
          detail: `Evidence change detected and ${records} historical record${records === 1 ? "" : "s"} matched.`,
        },
      ]
    : [];
  return [...raised, ...state.events].sort((a, b) => a.at.localeCompare(b.at));
}

const csvCell = (value: string) => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

function download(name: string, type: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function CaseHistory({
  caseId,
  state,
  records,
  className,
}: {
  caseId: string;
  state: CaseState;
  records: number;
  className?: string;
}) {
  const events = caseHistory(caseId, state, records);

  const exportCsv = () => {
    const lines = [
      ["case_id", "at", "type", "actor", "role", "summary", "detail"].join(","),
      ...events.map((e) =>
        [caseId, e.at, e.type, e.actor, e.role, e.summary, e.detail ?? ""]
          .map(csvCell)
          .join(","),
      ),
    ];
    download(`${caseId}-history.csv`, "text/csv;charset=utf-8", lines.join("\r\n"));
  };

  const exportJson = () =>
    download(
      `${caseId}-history.json`,
      "application/json",
      JSON.stringify({ caseId, exportedAt: new Date().toISOString(), note: "Synthetic demonstration data.", state, events }, null, 2),
    );

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <SectionHeading
          title="Case history"
          count={events.length}
          description="Who reviewed, decided, approved or changed this case, and when. Appended, never edited."
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
          <Button size="sm" onClick={exportJson}>
            <Download className="h-3.5 w-3.5" />
            JSON
          </Button>
        </div>
      </div>
      <ol className="px-5 py-4">
        {events.map((event, index) => (
          <li key={event.id} className="relative flex gap-3.5 pb-4 last:pb-0">
            {index < events.length - 1 ? (
              <span aria-hidden className="absolute left-[5px] top-4 h-[calc(100%-8px)] w-px bg-line" />
            ) : null}
            <span
              aria-hidden
              className={cn("relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", TONE[event.type] ?? "bg-info")}
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[13px] font-medium leading-snug text-ink">{event.summary}</span>
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint">
                  {CASE_EVENT_LABEL[event.type]}
                </span>
              </span>
              {event.detail ? (
                <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-2 [overflow-wrap:anywhere]">
                  {event.detail}
                </span>
              ) : null}
              <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] text-faint">
                <span className="font-medium text-ink-2">{event.actor}</span>
                <span aria-hidden>·</span>
                <span>{event.role}</span>
                <span aria-hidden>·</span>
                <Timestamp value={event.at} className="vp-num" />
              </span>
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
