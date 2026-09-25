"use client";

/**
 * The changed variant drawn as a node, linked to every historical record that
 * carries it. Selecting a record opens its detail beside the graph.
 *
 * The patient nodes are real buttons in a single tab stop: arrow keys move the
 * selection, so the graph is fully operable from the keyboard.
 */

import * as React from "react";
import Link from "next/link";
import { ArrowRight, UserRound } from "lucide-react";

import type { VariantAssessment } from "@/lib/analysis";
import type { PatientRecord, ReviewState } from "@/data/workspace";
import { meta } from "@/lib/classification";
import { cn, formatDate } from "@/lib/utils";
import { Badge, ClassificationBadge } from "@/components/ui";
import type { CaseStatus } from "@/state/workspace";
import { CHANGE, CURRENT, HISTORICAL } from "@/components/clinical/tokens";

const STATE_TONE: Record<ReviewState, "warning" | "neutral" | "positive" | "muted"> = {
  "Not reviewed": "warning",
  "In review": "neutral",
  Reviewed: "positive",
  Closed: "muted",
};

/** A record's review state as this session's case has moved it. */
export function reviewStateFor(patient: PatientRecord, caseStatus?: CaseStatus): ReviewState {
  if (caseStatus === "Reviewed") return "Reviewed";
  if (caseStatus === "In review" || caseStatus === "Assigned") return "In review";
  return patient.reviewState;
}

export function SyntheticDataLabel({ className }: { className?: string }) {
  return (
    <Badge tone="muted" className={className}>
      Synthetic demonstration data
    </Badge>
  );
}

export function PatientImpactGraph({
  assessment,
  caseStatus,
  className,
}: {
  assessment: VariantAssessment;
  caseStatus?: CaseStatus;
  className?: string;
}) {
  const { variant, impactedPatients: patients, recordedCode, currentCode, evidence } = assessment;
  const [selectedId, setSelectedId] = React.useState(patients[0]?.id ?? null);
  const buttons = React.useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = React.useId();
  const detailId = `${baseId}-detail`;

  const selectedIndex = Math.max(
    0,
    patients.findIndex((p) => p.id === selectedId),
  );
  const selected = patients[selectedIndex];
  const changed = recordedCode !== currentCode;

  const onKeyDown = (event: React.KeyboardEvent) => {
    const keys: Record<string, number> = {
      ArrowDown: 1,
      ArrowRight: 1,
      ArrowUp: -1,
      ArrowLeft: -1,
    };
    let next: number | null = null;
    if (event.key in keys) next = (selectedIndex + keys[event.key] + patients.length) % patients.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = patients.length - 1;
    if (next === null) return;
    event.preventDefault();
    setSelectedId(patients[next].id);
    buttons.current[next]?.focus();
  };

  if (patients.length === 0) {
    return (
      <p className={cn("text-[12.5px] text-muted", className)}>
        No historical records carry this variant.
      </p>
    );
  }

  const n = patients.length;
  const centre = (i: number) => ((i + 0.5) / n) * 100;

  return (
    <div className={cn("@container", className)}>
    <div className="grid gap-5 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
      <div
        className="grid min-w-0 grid-cols-1 gap-3 @lg:grid-cols-[minmax(0,190px)_minmax(48px,1fr)_minmax(0,210px)] @lg:gap-0"
        style={{ minHeight: `${Math.max(n, 3) * 58}px` }}
      >
        {/* Variant node */}
        <div className="flex items-center">
          <div
            className={cn(
              "relative w-full overflow-hidden rounded-xl border bg-surface p-3.5 pl-4",
              changed ? "border-vermilion-soft" : "border-line",
            )}
          >
            <span aria-hidden className={cn("absolute inset-y-0 left-0 w-[3px]", changed ? CHANGE.fill : "bg-line-2")} />
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-faint">
              {changed ? "Changed variant" : "Variant"}
            </p>
            <p className="mt-1 text-[14px] font-semibold text-ink">{variant.gene}</p>
            <p className="font-mono text-[11.5px] text-muted [overflow-wrap:anywhere]">{variant.hgvsCoding}</p>
            <p className="mt-2 flex flex-wrap items-center gap-1 text-[11.5px] font-medium">
              <span className={HISTORICAL.text}>{meta(recordedCode).short}</span>
              <ArrowRight aria-hidden className={cn("h-3 w-3", changed ? CHANGE.icon : "text-faint")} />
              <span className={changed ? CURRENT.text : "text-ink-2"}>{meta(currentCode).short}</span>
            </p>
          </div>
        </div>

        {/* Links */}
        <svg
          aria-hidden
          className="hidden h-full w-full overflow-visible @lg:block"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {patients.map((patient, i) => {
            const active = patient.id === selected?.id;
            return (
              <path
                key={patient.id}
                d={`M0 50 C 50 50, 50 ${centre(i)}, 100 ${centre(i)}`}
                fill="none"
                vectorEffect="non-scaling-stroke"
                className={cn(
                  "transition-[stroke] duration-200",
                  active ? CURRENT.stroke : "stroke-line-2",
                )}
                strokeWidth={active ? 2 : 1.25}
              />
            );
          })}
        </svg>

        {/* Patient nodes */}
        <div
          role="group"
          aria-label={`Records carrying ${variant.gene} ${variant.hgvsCoding}. Use the arrow keys to move between records.`}
          className="flex flex-col border-l border-line pl-3 @lg:border-l-0 @lg:pl-0"
          onKeyDown={onKeyDown}
        >
          {patients.map((patient, i) => {
            const active = patient.id === selected?.id;
            return (
              <div key={patient.id} className="flex flex-1 items-center py-1">
                <button
                  ref={(el) => {
                    buttons.current[i] = el;
                  }}
                  type="button"
                  aria-pressed={active}
                  aria-controls={detailId}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setSelectedId(patient.id)}
                  className={cn(
                    "relative flex w-full items-center gap-2.5 overflow-hidden rounded-xl border px-3 py-2 text-left transition-colors",
                    active ? "vp-selected" : "border-line bg-surface hover:bg-surface-2",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-full",
                      active ? "bg-active-bg text-garnet" : "bg-surface-3 text-muted",
                    )}
                  >
                    <UserRound className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-mono text-[12.5px] font-medium text-ink">{patient.id}</span>
                    <span className="block truncate text-[11px] text-muted vp-num">
                      Tested {formatDate(patient.testedOn)}
                    </span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected record */}
      {selected ? (
        <div
          id={detailId}
          aria-live="polite"
          className="min-w-0 rounded-xl border border-line bg-surface-2 p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[15px] font-semibold text-ink">{selected.id}</p>
            <Badge tone={STATE_TONE[reviewStateFor(selected, caseStatus)]} dot>
              {reviewStateFor(selected, caseStatus)}
            </Badge>
          </div>
          <p className="mt-0.5 text-[11.5px] text-muted">
            {selected.ageBand} · {selected.orderingDepartment}
          </p>
          <dl className="mt-3.5 space-y-3">
            <Detail label="Synthetic ID" value={<span className="font-mono">{selected.id}</span>} />
            <Detail label="Test date" value={formatDate(selected.testedOn)} />
            <Detail
              label="Original classification"
              value={
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <ClassificationBadge code={recordedCode} full />
                  <span className="text-[11.5px] text-muted">reported {formatDate(variant.recordedOn)}</span>
                </span>
              }
            />
            <Detail
              label="Current evidence"
              value={
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <ClassificationBadge code={currentCode} full />
                  <span className="text-[11.5px] text-muted">
                    ClinVar, evaluated {formatDate(evidence.lastEvaluated)}
                  </span>
                </span>
              }
            />
            <Detail label="Clinical owner" value={selected.clinicalOwner} />
            <Detail label="Review status" value={reviewStateFor(selected, caseStatus)} />
          </dl>
          <Link
            href={`/patients/${selected.id}`}
            className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-accent hover:underline"
          >
            Open record
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : null}
    </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] items-baseline gap-3">
      <dt className="text-[11px] font-medium uppercase tracking-[0.07em] text-faint">{label}</dt>
      <dd className="min-w-0 text-[13px] text-ink">{value}</dd>
    </div>
  );
}
