"use client";

import * as React from "react";
import { History } from "lucide-react";

import { ActivityItem } from "@/components/domain";
import { PageHeader, PageShell } from "@/components/page-header";
import { SyncButton } from "@/components/sync";
import { Card, EmptyState, Eyebrow } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useWorkspace, type ActivityEntry } from "@/state/workspace";

type Kind = ActivityEntry["kind"];

const REVIEW_KINDS: Kind[] = ["case", "assignment", "evidence-request", "follow-up", "review", "note"];

const FILTERS: { id: string; label: string; kinds: Kind[] | null }[] = [
  { id: "all", label: "Everything", kinds: null },
  { id: "review", label: "Review actions", kinds: REVIEW_KINDS },
  { id: "sync", label: "Syncs", kinds: ["sync"] },
  { id: "detection", label: "Detections", kinds: ["detection"] },
  { id: "impact", label: "Impact", kinds: ["impact"] },
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

  return (
    <PageShell>
      <PageHeader
        eyebrow="Audit trail"
        title="Activity"
        description="Every sync, detection and review action recorded in this workspace, newest first, with who took it and when."
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
                    actor={entry.actor}
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
        The trail is held for this session. In a deployed system it would be written to an
        append-only audit store. No entry records a change of classification or diagnosis:
        VariantPulse surfaces evidence, clinicians decide.
      </p>
    </PageShell>
  );
}
