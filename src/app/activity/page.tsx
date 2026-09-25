"use client";

import * as React from "react";
import { History } from "lucide-react";

import { ActivityItem } from "@/components/domain";
import { PageHeader, PageShell } from "@/components/page-header";
import { SyncButton } from "@/components/sync";
import { Card, EmptyState, Eyebrow } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useWorkspace, type ActivityEntry } from "@/state/workspace";

const FILTERS: { id: ActivityEntry["kind"] | "all"; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "sync", label: "Syncs" },
  { id: "detection", label: "Detections" },
  { id: "impact", label: "Impact" },
  { id: "case", label: "Cases" },
  { id: "decision", label: "Decisions" },
  { id: "note", label: "Notes" },
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

export default function ActivityPage() {
  const { activity } = useWorkspace();
  const [filter, setFilter] = React.useState<ActivityEntry["kind"] | "all">("all");

  const rows = filter === "all" ? activity : activity.filter((entry) => entry.kind === filter);

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

  return (
    <PageShell>
      <PageHeader
        eyebrow="Audit trail"
        title="Activity"
        description="Every sync, detection, case and decision recorded in this workspace, in order."
        actions={<SyncButton />}
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
                ? "bg-surface text-ink shadow-[0_1px_2px_rgba(18,19,26,0.07)]"
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
            title="Nothing recorded yet"
            description="Run an evidence sync, or open a case, and the trail will fill in here."
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
                    last={index === entries.length - 1}
                  />
                ))}
              </ol>
            </Card>
          ))}
        </div>
      )}

      <p className="mt-4 text-[11.5px] leading-relaxed text-faint">
        The trail is held for this session. In a deployed system it would be written to an
        append-only audit store alongside the identity of every actor.
      </p>
    </PageShell>
  );
}
