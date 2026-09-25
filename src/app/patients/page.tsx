"use client";

import * as React from "react";
import { Search, Users } from "lucide-react";

import { PageHeader, PageShell } from "@/components/page-header";
import { PatientImpactTable } from "@/components/patient-table";
import { SyncButton } from "@/components/sync";
import { Badge, Card } from "@/components/ui";
import { PATIENTS } from "@/data/workspace";
import { useWorkspace } from "@/state/workspace";
import { cn } from "@/lib/utils";

type Filter = "impacted" | "all" | "unchanged";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "impacted", label: "Needs review" },
  { id: "all", label: "All records" },
  { id: "unchanged", label: "No change" },
];

export default function PatientsPage() {
  const { analysis } = useWorkspace();
  const [filter, setFilter] = React.useState<Filter>("impacted");
  const [query, setQuery] = React.useState("");

  const byKey = React.useMemo(
    () => new Map(analysis.assessments.map((a) => [a.variant.key, a])),
    [analysis],
  );

  const impactedKeys = React.useMemo(
    () => new Set(analysis.assessments.filter((a) => a.requiresReview).map((a) => a.variant.key)),
    [analysis],
  );

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return PATIENTS.filter((patient) => {
      if (filter === "impacted" && !impactedKeys.has(patient.variantKey)) return false;
      if (filter === "unchanged" && impactedKeys.has(patient.variantKey)) return false;
      if (!q) return true;
      return [
        patient.id,
        patient.variantKey,
        patient.orderingDepartment,
        patient.clinicalOwner,
        patient.reportingLab,
        patient.indication,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [filter, query, impactedKeys]);

  const counts = {
    impacted: PATIENTS.filter((p) => impactedKeys.has(p.variantKey)).length,
    all: PATIENTS.length,
    unchanged: PATIENTS.filter((p) => !impactedKeys.has(p.variantKey)).length,
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Patient impact"
        title="Records on file"
        description="Synthetic patient records in the demonstration hospital dataset, and whether the evidence behind each one has moved since it was reported."
        actions={<SyncButton />}
      />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <div
            className="flex items-center gap-1 rounded-xl bg-surface-3 p-1"
            role="tablist"
            aria-label="Filter records"
          >
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

          <label className="ml-auto flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-line px-3 sm:max-w-[280px] sm:flex-none">
            <Search className="h-3.5 w-3.5 shrink-0 text-faint" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter records"
              aria-label="Filter records"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
            />
          </label>
        </div>

        <PatientImpactTable rows={rows} byKey={byKey} />
      </Card>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Badge tone="muted" dot>
          <Users className="mr-0.5 h-3 w-3" />
          Synthetic patient dataset
        </Badge>
        <p className="text-[12px] text-muted">
          Record identifiers, departments and clinicians are fabricated. The variant evidence
          attached to them is real.
        </p>
      </div>
    </PageShell>
  );
}
