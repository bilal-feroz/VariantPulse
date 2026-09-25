/**
 * Domain components: the pieces that render an assessment.
 *
 * These are server-renderable and take a `VariantAssessment` straight from the
 * engine, so what appears on screen is what the engine concluded — there is no
 * second, looser interpretation layer between them.
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { VariantAssessment } from "@/lib/analysis";
import { meta } from "@/lib/classification";
import { cn, formatMonth, formatYear } from "@/lib/utils";
import { RelativeTime } from "@/components/relative-time";
import {
  Badge,
  ChangeTypeBadge,
  ClassificationBadge,
  PriorityBadge,
  VariantLabel,
} from "@/components/ui";

/* -- Then and now ---------------------------------------------------------- */

/**
 * The comparison the whole product turns on. Deliberately literal: two states,
 * when each was stated, and the fact that only the evidence moved. "Then" is
 * dated by the source of the classification on record — the ClinVar release it
 * was read from, or the hospital report when ClinVar held no record — never by
 * a patient's test date.
 */
export function ThenNow({
  assessment,
  size = "md",
  stacked = false,
  className,
}: {
  assessment: VariantAssessment;
  size?: "sm" | "md" | "lg";
  /**
   * Stacks the two states vertically. Side by side, each panel gets under half
   * the container, which is not enough for a label like "Likely pathogenic" in
   * a narrow column — it would hyphenate mid-word.
   */
  stacked?: boolean;
  className?: string;
}) {
  const { variant, recordedCode, currentCode, evidence } = assessment;
  const source = variant.historicalSource;
  const thenYear = source.kind === "clinvar-release" ? source.shortLabel : formatMonth(variant.recordedOn);
  const changed = assessment.verdict.type !== "NO_MATERIAL_CHANGE";
  // "Now" carries the year ClinVar last evaluated the reading, unless that
  // predates the record, where a year would read as time running backwards.
  const evaluated = formatYear(evidence.lastEvaluated);
  const recordYear = source.release ? source.release.slice(0, 4) : formatYear(variant.recordedOn);
  const nowYear = evidence.lastEvaluated && evaluated >= recordYear ? evaluated : "";

  // Normalisation can shorten what ClinVar said ("Pathogenic/Likely pathogenic"
  // becomes Pathogenic), so the verbatim wording is kept beside it.
  const thenNote =
    source.kind === "modelled-report"
      ? "Hospital report · not in ClinVar"
      : variant.historicalClinvarText && variant.historicalClinvarText !== meta(recordedCode).label
        ? `ClinVar: ${variant.historicalClinvarText}`
        : "ClinVar release, as on record";

  const then = (
    <Panel
      year={thenYear}
      label="Then"
      code={recordedCode}
      note={thenNote}
      tone="muted"
      size={size}
    />
  );
  const now = (
    <Panel
      year={nowYear}
      label="Now"
      code={currentCode}
      note={assessment.confidence.label}
      tone="accent"
      size={size}
    />
  );

  if (stacked) {
    return (
      <div className={cn("grid gap-2.5", className)}>
        {then}
        <div className="flex items-center justify-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full border border-line-2 bg-surface text-muted">
            <ArrowRight className="h-3.5 w-3.5 rotate-90" />
          </span>
          <span className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-faint">
            {changed ? "Science changed" : "No change"}
          </span>
        </div>
        {now}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-3",
        className,
      )}
    >
      {then}
      <div className="flex flex-col items-center justify-center gap-2 px-1">
        <span className="grid h-8 w-8 place-items-center rounded-full border border-line-2 bg-surface text-muted">
          <ArrowRight className="h-4 w-4" />
        </span>
        <span className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-faint whitespace-nowrap">
          {changed ? "Science" : "No"}
          <br />
          {changed ? "changed" : "change"}
        </span>
      </div>
      {now}
    </div>
  );
}

function Panel({
  year,
  label,
  code,
  note,
  tone,
  size,
}: {
  year: string;
  label: string;
  code: Parameters<typeof ClassificationBadge>[0]["code"];
  note: string;
  tone: "muted" | "accent";
  size: "sm" | "md" | "lg";
}) {
  const info = meta(code);
  return (
    <div
      className={cn(
        "rounded-xl border p-3.5",
        tone === "muted" ? "border-line bg-surface-2" : "border-accent-ring/60 bg-accent-soft/50",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
          {label}
        </span>
        <span className="text-[11px] font-medium text-muted vp-num">{year}</span>
      </div>
      <p
        className={cn(
          "mt-2 font-semibold leading-tight tracking-tight [overflow-wrap:break-word]",
          size === "lg" ? "text-[20px]" : size === "md" ? "text-[16px]" : "text-[15px]",
          info.tone === "critical" && "text-crit",
          info.tone === "warning" && "text-warn",
          info.tone === "positive" && "text-ok",
          info.tone === "muted" && "text-ink-2",
          info.tone === "neutral" && "text-info",
        )}
      >
        {size === "sm" ? info.short : info.label}
      </p>
      <p className="mt-1.5 text-[11.5px] leading-snug text-muted">{note}</p>
    </div>
  );
}

/* -- Compact row used in dense lists --------------------------------------- */

export function VariantRow({ assessment }: { assessment: VariantAssessment }) {
  const { variant, changeType, impactedRecordCount, priority, caseId } = assessment;

  return (
    <Link
      href={`/variants/${encodeURIComponent(variant.key)}`}
      className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-2"
    >
      <span className="min-w-0 flex-1">
        <VariantLabel
          gene={variant.gene}
          hgvs={variant.hgvsCoding}
          protein={variant.proteinChange}
          size="sm"
        />
        <span className="mt-1 block truncate text-[11.5px] text-muted">{variant.condition}</span>
      </span>

      <span className="hidden items-center gap-2 md:flex">
        <ClassificationBadge code={assessment.recordedCode} />
        <ArrowRight className="h-3 w-3 text-faint" />
        <ClassificationBadge code={assessment.currentCode} />
      </span>

      <span className="hidden w-20 text-right text-[12.5px] text-ink-2 sm:block vp-num">
        {impactedRecordCount} rec.
      </span>

      <span className="hidden w-[132px] justify-end lg:flex">
        <ChangeTypeBadge type={changeType} />
      </span>

      <span className="w-[86px] justify-end flex">
        {caseId ? <PriorityBadge level={priority.level} /> : <Badge tone="muted">None</Badge>}
      </span>
    </Link>
  );
}

/* -- Activity -------------------------------------------------------------- */

const ACTIVITY_TONE: Record<string, string> = {
  sync: "bg-info",
  detection: "bg-crit",
  impact: "bg-warn",
  case: "bg-accent",
  assignment: "bg-accent",
  note: "bg-faint",
  decision: "bg-ok",
};

export function ActivityItem({
  at,
  title,
  detail,
  kind,
  last = false,
}: {
  at: string;
  title: string;
  detail?: string;
  kind: string;
  last?: boolean;
}) {
  return (
    <li className="relative flex gap-3.5 pb-4 last:pb-0">
      {!last ? (
        <span aria-hidden className="absolute left-[5px] top-4 h-[calc(100%-8px)] w-px bg-line" />
      ) : null}
      <span
        aria-hidden
        className={cn("relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", ACTIVITY_TONE[kind] ?? "bg-faint")}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium leading-snug text-ink">{title}</span>
        {detail ? (
          <span className="mt-0.5 block text-[12px] leading-snug text-muted">{detail}</span>
        ) : null}
<RelativeTime value={at} className="mt-1 block text-[11px] text-faint vp-num" />
      </span>
    </li>
  );
}
