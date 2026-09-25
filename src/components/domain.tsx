/**
 * Domain components: the pieces that render an assessment.
 *
 * These are server-renderable and take a `VariantAssessment` straight from the
 * engine, so what appears on screen is what the engine concluded — there is no
 * second, looser interpretation layer between them.
 */

import Link from "next/link";
import { ArrowRight, ArrowUpRight, Clock, FileText, Users } from "lucide-react";

import type { VariantAssessment } from "@/lib/analysis";
import { CHANGE_TYPES, meta } from "@/lib/classification";
import { cn, formatDate, formatMonth, formatNumber, formatYear } from "@/lib/utils";
import { RelativeTime } from "@/components/relative-time";
import {
  Badge,
  Card,
  ChangeTypeBadge,
  ClassificationBadge,
  ConfidenceMeter,
  PriorityBadge,
  VariantLabel,
} from "@/components/ui";

/* -- Metrics --------------------------------------------------------------- */

export function MetricCard({
  label,
  value,
  hint,
  tone = "neutral",
  href,
}: {
  label: string;
  value: number | string;
  hint?: React.ReactNode;
  tone?: "neutral" | "critical" | "warning" | "positive";
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            "text-[30px] font-semibold leading-none tracking-tight vp-num",
            tone === "critical" && "text-crit",
            tone === "warning" && "text-warn",
            tone === "positive" && "text-ok",
            tone === "neutral" && "text-ink",
          )}
        >
          {typeof value === "number" ? formatNumber(value) : value}
        </span>
        {href ? (
          <ArrowUpRight className="h-4 w-4 text-faint transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        ) : null}
      </div>
      <p className="mt-2 text-[13px] font-medium leading-snug text-ink-2">{label}</p>
      {hint ? <p className="mt-1 text-[11.5px] leading-snug text-faint">{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="group vp-card block p-5 transition-colors hover:bg-surface-2">
        {body}
      </Link>
    );
  }
  return <Card className="p-5">{body}</Card>;
}

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

/* -- Evidence alert -------------------------------------------------------- */

export function EvidenceAlert({
  assessment,
  className,
}: {
  assessment: VariantAssessment;
  className?: string;
}) {
  const { variant, evidence, changeType, priority, impactedRecordCount, caseId } = assessment;
  const change = CHANGE_TYPES[changeType];

  return (
    <Card
      className={cn(
        "relative overflow-hidden p-5 transition-shadow hover:shadow-[0_14px_38px_-22px_rgba(18,19,50,0.34)]",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-[3px]",
          change.tone === "critical" && "bg-crit",
          change.tone === "warning" && "bg-warn",
          change.tone === "positive" && "bg-ok",
          change.tone === "neutral" && "bg-info",
          change.tone === "muted" && "bg-line-2",
        )}
      />

      <div className="flex flex-wrap items-center gap-2">
        <PriorityBadge level={priority.level} />
        <ChangeTypeBadge type={changeType} />
        {assessment.regionalSignal.flagged && changeType !== "REGIONAL_CONFLICT" ? (
          <Badge tone="warning" title={assessment.regionalSignal.reason}>
            Regional signal
          </Badge>
        ) : null}
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] text-faint">
          <Clock className="h-3 w-3" />
          {evidence.lastEvaluated
            ? `Evidence updated ${formatDate(evidence.lastEvaluated)}`
            : "Evaluation date not recorded"}
        </span>
      </div>

      <div className="mt-3.5">
        <VariantLabel
          gene={variant.gene}
          hgvs={variant.hgvsCoding}
          protein={variant.proteinChange}
          size="lg"
        />
        <p className="mt-1 text-[12.5px] text-muted">{variant.condition}</p>
      </div>

      <ThenNow assessment={assessment} className="mt-4" />

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2.5 border-t border-line pt-3.5">
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2">
          <Users className="h-3.5 w-3.5 text-faint" />
          <span className="font-semibold vp-num">{impactedRecordCount}</span> record
          {impactedRecordCount === 1 ? "" : "s"} on file
        </span>
        <ConfidenceMeter stars={assessment.confidence.stars} strength={assessment.confidence.strength} />
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted">
          <FileText className="h-3.5 w-3.5 text-faint" />
          <span className="vp-num">{evidence.submissionCount}</span> submission
          {evidence.submissionCount === 1 ? "" : "s"}
        </span>

        <Link
          href={caseId ? `/review/${caseId}` : `/variants/${encodeURIComponent(variant.key)}`}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 text-[12.5px] font-medium text-white transition-colors hover:bg-ink/90"
        >
          {changeType === "REGIONAL_CONFLICT" ? "Investigate evidence" : "Review change"}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Card>
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

/* -- Source status --------------------------------------------------------- */

export function SourceCard({
  name,
  description,
  status,
  detail,
  glyph,
}: {
  name: string;
  description: string;
  /** `snapshot`: a dated, verified capture. `synthetic`: fabricated demonstration data. */
  status: "live" | "connected" | "cached" | "degraded" | "snapshot" | "synthetic";
  detail?: React.ReactNode;
  glyph: React.ReactNode;
}) {
  const tone =
    status === "live" || status === "connected"
      ? "positive"
      : status === "cached"
        ? "warning"
        : status === "snapshot"
          ? "neutral"
          : status === "synthetic"
            ? "muted"
            : "critical";

  return (
    <div className="vp-card flex items-center gap-3 p-3.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-3 text-muted">
        {glyph}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-ink">{name}</span>
        <span className="block truncate text-[11.5px] text-muted">{description}</span>
        <span className="mt-1.5 flex items-center gap-1.5">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              tone === "positive" && "bg-ok",
              tone === "warning" && "bg-warn",
              tone === "critical" && "bg-crit",
              tone === "neutral" && "bg-info",
              tone === "muted" && "bg-faint",
            )}
          />
          <span
            className={cn(
              "text-[11px] font-medium capitalize",
              tone === "positive" && "text-ok",
              tone === "warning" && "text-warn",
              tone === "critical" && "text-crit",
              tone === "neutral" && "text-info",
              tone === "muted" && "text-muted",
            )}
          >
            {status}
          </span>
          {detail ? <span className="text-[11px] text-faint">· {detail}</span> : null}
        </span>
      </span>
    </div>
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
