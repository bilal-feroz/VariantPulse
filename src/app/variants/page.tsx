"use client";

import * as React from "react";
import { Search } from "lucide-react";

import { VariantRow } from "@/components/domain";
import { PageHeader, PageShell } from "@/components/page-header";
import { SyncButton } from "@/components/sync";
import { Card, EmptyState } from "@/components/ui";
import { CHANGE_TYPES, type ChangeType } from "@/lib/classification";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/state/workspace";

type Filter = "all" | "changed" | "conflict" | "stable";

const FILTERS: { id: Filter; label: string; matches: (type: ChangeType) => boolean }[] = [
  { id: "all", label: "All", matches: () => true },
  {
    id: "changed",
    label: "Reclassified",
    matches: (t) =>
      t === "CLASSIFICATION_DRIFT" || t === "EVIDENCE_STRENGTHENED" || t === "EVIDENCE_WEAKENED",
  },
  {
    id: "conflict",
    label: "Conflicting",
    matches: (t) => t === "REGIONAL_CONFLICT" || t === "CONSENSUS_CONFLICT",
  },
  { id: "stable", label: "Unchanged", matches: (t) => t === "NO_MATERIAL_CHANGE" },
];

export default function VariantsPage() {
  const { analysis } = useWorkspace();
  const [filter, setFilter] = React.useState<Filter>("all");
  const [query, setQuery] = React.useState("");

  const rows = React.useMemo(() => {
    const active = FILTERS.find((f) => f.id === filter)!;
    const q = query.trim().toLowerCase();
    return analysis.assessments
      .filter((a) => active.matches(a.changeType))
      .filter((a) =>
        q
          ? [a.variant.gene, a.variant.hgvsCoding, a.variant.proteinChange, a.variant.condition]
              .join(" ")
              .toLowerCase()
              .includes(q)
          : true,
      );
  }, [analysis, filter, query]);

  const counts = React.useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map((f) => [f.id, analysis.assessments.filter((a) => f.matches(a.changeType)).length]),
      ) as Record<Filter, number>,
    [analysis],
  );

  return (
    <PageShell>
      <PageHeader
        eyebrow="Monitored panel"
        title="Variants"
        description="Every variant this workspace tracks, with the interpretation on record beside the interpretation held today."
        actions={<SyncButton />}
      />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <div className="flex items-center gap-1 rounded-xl bg-surface-3 p-1" role="tablist">
            {FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={filter === option.id}
                onClick={() => setFilter(option.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                  filter === option.id
                    ? "bg-surface text-ink shadow-[0_1px_2px_rgba(18,19,26,0.07)]"
                    : "text-muted hover:text-ink",
                )}
              >
                {option.label}
                <span className="text-[11px] text-faint vp-num">{counts[option.id]}</span>
              </button>
            ))}
          </div>

          <label className="ml-auto flex h-9 min-w-[200px] items-center gap-2 rounded-xl border border-line px-3">
            <Search className="h-3.5 w-3.5 shrink-0 text-faint" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter by gene or HGVS"
              aria-label="Filter variants"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
            />
          </label>
        </div>

        <div className="hidden items-center gap-4 border-b border-line bg-surface-2 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-faint lg:flex">
          <span className="flex-1">Variant</span>
          <span className="hidden md:block">As reported → current</span>
          <span className="w-20 text-right">Records</span>
          <span className="w-[132px] text-right">Change</span>
          <span className="w-[86px] text-right">Priority</span>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="No variants match"
            description="Clear the filter or search for a different gene symbol."
          />
        ) : (
          <div className="divide-y divide-line">
            {rows.map((assessment) => (
              <VariantRow key={assessment.variant.key} assessment={assessment} />
            ))}
          </div>
        )}
      </Card>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(CHANGE_TYPES) as ChangeType[])
          .filter((type) => analysis.assessments.some((a) => a.changeType === type))
          .map((type) => (
            <div key={type} className="vp-card-flat p-3.5">
              <p className="text-[12.5px] font-semibold text-ink">{CHANGE_TYPES[type].label}</p>
              <p className="mt-1 text-[11.5px] leading-snug text-muted">
                {CHANGE_TYPES[type].description}
              </p>
            </div>
          ))}
      </div>
    </PageShell>
  );
}
