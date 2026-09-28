"use client";

import * as React from "react";
import { Download, History } from "lucide-react";

import { ActivityItem } from "@/components/domain";
import { PageHeader, PageShell } from "@/components/page-header";
import { SyncButton } from "@/components/sync";
import { Button, Card, EmptyState, Eyebrow } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useWorkspace, type ActivityEntry } from "@/state/workspace";

type Kind = ActivityEntry["kind"];

const REVIEW_KINDS: Kind[] = [
  "case",
  "assignment",
  "evidence-request",
  "follow-up",
  "approval",
  "review",
  "note",
  "escalation",
  "closure",
];

const FILTERS: { id: string; label: string; kinds: Kind[] | null }[] = [
  { id: "all", label: "Everything", kinds: null },
  { id: "review", label: "Review actions", kinds: REVIEW_KINDS },
  { id: "approvals", label: "Approvals and closures", kinds: ["approval", "closure"] },
  { id: "escalations", label: "Escalations", kinds: ["escalation"] },
  { id: "system", label: "Syncs and detections", kinds: ["sync", "detection", "impact"] },
  { id: "pilot", label: "Pilot and data", kinds: ["pilot", "import", "session"] },
];

/** Groups entries under a day heading so a long trail stays readable. */
function dayKey(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  if (isToday) return "Today";
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(
    date,
  );
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

export default function ActivityPage() {
  const { activity, hydrated } = useWorkspace();
  const [filter, setFilter] = React.useState("all");

  const kinds = FILTERS.find((option) => option.id === filter)?.kinds ?? null;
  const rows = kinds ? activity.filter((entry) => kinds.includes(entry.kind)) : activity;

  const groups = React.useMemo(() => {
    const map = new Map<string, ActivityEntry[]>();
    for (const entry of rows) {
      const key = dayKey(entry.at);
      const bucket = map.get(key);
      if (bucket) bucket.push(entry);
      else map.set(key, [entry]);
    }
    return [...map.entries()];
  }, [rows]);

  const stamp = () => new Date().toISOString().slice(0, 10);

  const exportCsv = () => {
    const lines = [
      ["at", "kind", "actor", "role", "case_id", "title", "detail"].join(","),
      ...activity.map((e) =>
        [e.at, e.kind, e.actor, e.role ?? "", e.caseId ?? "", e.title, e.detail ?? ""].map(csvCell).join(","),
      ),
    ];
    download(`variantpulse-audit-${stamp()}.csv`, "text/csv;charset=utf-8", lines.join("\r\n"));
  };

  const exportJson = () =>
    download(
      `variantpulse-audit-${stamp()}.json`,
      "application/json",
      JSON.stringify(
        { exportedAt: new Date().toISOString(), note: "Synthetic demonstration data. Session trail.", entries: activity },
        null,
        2,
      ),
    );

  return (
    <PageShell>
      <PageHeader
        eyebrow="Audit trail"
        title="Activity"
        description="Every sync, detection, review action, approval and escalation recorded in this workspace, newest first, with who took it, in which role, and when."
        actions={
          <>
            <Button size="sm" onClick={exportCsv} disabled={!hydrated}>
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
            <Button size="sm" onClick={exportJson} disabled={!hydrated}>
              <Download className="h-3.5 w-3.5" />
              JSON
            </Button>
            <SyncButton />
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-1 rounded-xl bg-surface-3 p-1">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setFilter(option.id)}
            aria-pressed={filter === option.id}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors",
              filter === option.id
                ? "bg-surface text-ink shadow-sm"
                : "text-muted hover:text-ink",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={<History className="h-5 w-5" />}
            title="Nothing recorded here yet"
            description="Run an evidence sync, or work a case, and the trail will fill in."
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map(([day, entries]) => (
            <Card key={day} className="p-5">
              <Eyebrow>{day}</Eyebrow>
              <ol className="mt-4">
                {entries.map((entry, index) => (
                  <ActivityItem
                    key={entry.id}
                    at={entry.at}
                    title={entry.title}
                    detail={entry.detail}
                    kind={entry.kind}
                    actor={entry.actor}
                    role={entry.role}
                    absolute
                    last={index === entries.length - 1}
                  />
                ))}
              </ol>
            </Card>
          ))}
        </div>
      )}

      <p className="mt-4 text-[11.5px] leading-relaxed text-faint">
        The trail is held for this browser session only and exports as it stands. In a pilot it would be
        written to an append-only, server-side audit store. No entry records a change of classification or
        diagnosis: VariantPulse surfaces evidence, clinicians decide.
      </p>
    </PageShell>
  );
}
