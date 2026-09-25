"use client";

/**
 * Global search.
 *
 * Indexes what a reviewer actually types: a record identifier, a gene, an HGVS
 * string, a ClinVar accession, or a review case number. Matching is plain
 * substring scoring rather than anything fuzzy — in a clinical context a
 * near-miss on a variant string is worse than no match at all.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  CornerDownLeft,
  Dna,
  FileText,
  Search,
  User,
  X,
} from "lucide-react";

import { PATIENTS } from "@/data/workspace";
import { useWorkspace } from "@/state/workspace";
import { cn } from "@/lib/utils";
import { meta } from "@/lib/classification";

interface Entry {
  id: string;
  kind: "patient" | "variant" | "case" | "page";
  title: string;
  subtitle: string;
  href: string;
  /** Everything a user might type to reach this entry. */
  terms: string[];
}

const PAGES: Entry[] = [
  { id: "p-home", kind: "page", title: "Home", subtitle: "Workspace overview", href: "/", terms: ["home", "overview", "command centre", "command center"] },
  { id: "p-patients", kind: "page", title: "Patients", subtitle: "Records on file", href: "/patients", terms: ["patients", "records"] },
  { id: "p-variants", kind: "page", title: "Variants", subtitle: "Monitored panel", href: "/variants", terms: ["variants", "panel", "genes"] },
  { id: "p-evidence", kind: "page", title: "Evidence", subtitle: "Source-by-source comparison", href: "/evidence", terms: ["evidence", "clinvar", "sources", "explorer"] },
  { id: "p-review", kind: "page", title: "Clinical Review", subtitle: "Review queue", href: "/review", terms: ["review", "queue", "cases", "clinical"] },
  { id: "p-regional", kind: "page", title: "Regional Insights", subtitle: "Global and regional comparison", href: "/regional", terms: ["regional", "arab", "gulf", "global", "conflict"] },
  { id: "p-activity", kind: "page", title: "Activity", subtitle: "Audit trail", href: "/activity", terms: ["activity", "audit", "log", "trail"] },
  { id: "p-sources", kind: "page", title: "Data Sources", subtitle: "Connection health", href: "/sources", terms: ["sources", "health", "connections", "status"] },
  { id: "p-settings", kind: "page", title: "Settings", subtitle: "Architecture and governance", href: "/settings", terms: ["settings", "architecture", "about", "governance"] },
];

const ICONS: Record<Entry["kind"], React.ComponentType<{ className?: string }>> = {
  patient: User,
  variant: Dna,
  case: ClipboardList,
  page: FileText,
};

const KIND_LABEL: Record<Entry["kind"], string> = {
  patient: "Patient",
  variant: "Variant",
  case: "Review case",
  page: "Page",
};

function score(entry: Entry, query: string): number {
  const q = query.toLowerCase();
  let best = 0;
  for (const term of entry.terms) {
    const t = term.toLowerCase();
    if (t === q) return 100;
    if (t.startsWith(q)) best = Math.max(best, 80);
    else if (t.includes(q)) best = Math.max(best, 55);
  }
  return best;
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { analysis } = useWorkspace();
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const entries = React.useMemo<Entry[]>(() => {
    const variantEntries: Entry[] = analysis.assessments.map((a) => ({
      id: `v-${a.variant.key}`,
      kind: "variant",
      title: `${a.variant.gene} ${a.variant.hgvsCoding}`,
      subtitle: `${meta(a.currentCode).label} · ${a.impactedRecordCount} record${a.impactedRecordCount === 1 ? "" : "s"}`,
      href: `/variants/${encodeURIComponent(a.variant.key)}`,
      terms: [
        a.variant.gene,
        a.variant.hgvsCoding,
        a.variant.proteinChange ?? "",
        a.variant.key,
        a.evidence.rsid ?? "",
        a.evidence.clinvarId,
        a.evidence.accession ?? "",
        a.variant.condition,
      ].filter(Boolean),
    }));

    const caseEntries: Entry[] = analysis.assessments
      .filter((a) => a.caseId)
      .map((a) => ({
        id: `c-${a.caseId}`,
        kind: "case",
        title: a.caseId as string,
        subtitle: `${a.variant.gene} ${a.variant.hgvsCoding} · ${a.priority.level.toLowerCase()} priority`,
        href: `/review/${a.caseId}`,
        terms: [a.caseId as string, a.variant.gene, a.variant.hgvsCoding],
      }));

    const patientEntries: Entry[] = PATIENTS.map((p) => ({
      id: `pt-${p.id}`,
      kind: "patient",
      title: p.id,
      subtitle: `${p.orderingDepartment} · ${p.variantKey}`,
      href: `/patients/${p.id}`,
      terms: [p.id, p.variantKey, p.orderingDepartment, p.clinicalOwner, p.reportingLab],
    }));

    return [...variantEntries, ...caseEntries, ...patientEntries, ...PAGES];
  }, [analysis]);

  const results = React.useMemo(() => {
    const q = query.trim();
    if (!q) {
      return [
        ...entries.filter((e) => e.kind === "case").slice(0, 4),
        ...PAGES.slice(0, 5),
      ];
    }
    return entries
      .map((entry) => ({ entry, value: score(entry, q) }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 12)
      .map((r) => r.entry);
  }, [entries, query]);

  React.useEffect(() => setActive(0), [query]);

  React.useEffect(() => {
    if (open) {
      setQuery("");
      // Focus after paint so the dialog is in the tree first.
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  React.useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  const go = (entry: Entry) => {
    onOpenChange(false);
    router.push(entry.href);
  };

  return (
    <div className="fixed inset-0 z-50 vp-fade" role="dialog" aria-modal="true" aria-label="Search">
      <button
        type="button"
        aria-label="Close search"
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 cursor-default bg-ink/25 backdrop-blur-[2px]"
      />
      <div className="relative mx-auto mt-[12vh] w-[min(620px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line-2 bg-surface shadow-[0_24px_70px_-20px_rgba(18,19,50,0.45)]">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 shrink-0 text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((i) => (i + 1) % Math.max(results.length, 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((i) => (i - 1 + results.length) % Math.max(results.length, 1));
              } else if (event.key === "Enter" && results[active]) {
                event.preventDefault();
                go(results[active]);
              }
            }}
            placeholder="Search records, genes, variants or review cases"
            aria-label="Search records, genes, variants or review cases"
            className="h-14 flex-1 bg-transparent text-[14.5px] text-ink outline-none placeholder:text-faint"
          />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-lg text-faint transition-colors hover:bg-surface-3 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div ref={listRef} className="vp-scroll max-h-[56vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-10 text-center text-[13px] text-muted">
              Nothing matches{" "}
              <span className="font-medium text-ink">&ldquo;{query}&rdquo;</span>. Try a gene
              symbol, a record ID such as VP-10283, or an HGVS string.
            </p>
          ) : (
            results.map((entry, index) => {
              const Icon = ICONS[entry.kind];
              return (
                <button
                  key={entry.id}
                  type="button"
                  data-active={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(entry)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                    index === active ? "bg-accent-soft" : "hover:bg-surface-2",
                  )}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-muted">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-ink">
                      {entry.title}
                    </span>
                    <span className="block truncate text-[12px] text-muted">{entry.subtitle}</span>
                  </span>
                  <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-faint">
                    {KIND_LABEL[entry.kind]}
                  </span>
                  {index === active ? (
                    <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-accent" />
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
