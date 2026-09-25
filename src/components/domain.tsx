/**
 * Domain components: the pieces that render an assessment.
 *
 * These are server-renderable and take a `VariantAssessment` straight from the
 * engine, so what appears on screen is what the engine concluded — there is no
 * second, looser interpretation layer between them.
 */

import Link from "next/link";
import { ArrowRight, ArrowUpRight, ChevronRight, Clock, FileText, Users } from "lucide-react";

import type { VariantAssessment } from "@/lib/analysis";
import { CHANGE_TYPES, meta } from "@/lib/classification";
import { cn, formatDate, formatNumber, formatYear } from "@/lib/utils";
import { RelativeTime } from "@/components/relative-time";
import { Timestamp } from "@/components/clinical/timestamp";
import { CHANGE, CTA, CURRENT, HISTORICAL } from "@/components/clinical/tokens";
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
 * The comparison the whole product turns on. Two interpretations of the same
 * DNA: the one on file (slate), today's (garnet), and the knowledge change
 * between them (vermilion). The current date is the evaluation date carried on
 * the evidence record, never a date written around it.
 */
export function ThenNow({
  assessment,
  size = "md",
  stacked = false,
  caption = false,
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
  /** Shows the "DNA has not changed" line beneath the comparison. */
  caption?: boolean;
  className?: string;
}) {
  const { variant, recordedCode, currentCode, evidence } = assessment;
  const changed = recordedCode !== currentCode;
  const thenYear = formatYear(variant.recordedOn);
  const evaluated = evidence.lastEvaluated
    ? `ClinVar last evaluated ${formatDate(evidence.lastEvaluated)}`
    : "ClinVar evaluation date not recorded";

  const then = (
    <Panel
      eyebrow={`${thenYear} · On file`}
      code={recordedCode}
      note={`Reported ${formatDate(variant.recordedOn)}`}
      tone="historical"
      size={size}
    />
  );
  const now = (
    <Panel
      eyebrow="Today · ClinVar"
      code={currentCode}
      note={`${evaluated} · ${assessment.confidence.label}`}
      tone={changed ? "current" : "historical"}
      size={size}
    />
  );

  const connectorLabel = changed ? "Science evolves" : "No material change";

  return (
    <figure className={cn("min-w-0", className)}>
      {stacked ? (
        <div className="grid gap-2">
          {then}
          <div className="flex items-center gap-2.5 pl-5" aria-hidden={!changed}>
            <span className="relative flex h-8 w-px flex-col items-center">
              <span className={cn("h-full w-px", changed ? CHANGE.fill : "bg-line-2")} />
              {changed ? (
                <span className={cn("absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full", CHANGE.fill)}>
                  <span
                    className={cn("absolute inset-0 rounded-full", CHANGE.fill)}
                    style={{ animation: "vp-pulse-ring 2.4s ease-out infinite" }}
                  />
                </span>
              ) : null}
            </span>
            <span
              className={cn(
                "text-[10.5px] font-semibold uppercase tracking-[0.12em]",
                changed ? CHANGE.text : "text-faint",
              )}
            >
              {connectorLabel}
            </span>
          </div>
          {now}
        </div>
      ) : (
        <div className="grid grid-cols-1 items-stretch gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(88px,auto)_minmax(0,1fr)] sm:gap-0">
          {then}
          <div className="flex items-center gap-2 px-5 sm:flex-col sm:justify-center sm:gap-1.5 sm:px-2">
            <span className="relative hidden h-px w-full min-w-16 items-center sm:flex">
              <span className={cn("h-px w-full", changed ? CHANGE.fill : "bg-line-2")} />
              <ChevronRight
                aria-hidden
                className={cn("absolute -right-1.5 h-3.5 w-3.5", changed ? CHANGE.text : "text-faint")}
              />
              {changed ? (
                <span className={cn("absolute left-1/2 h-2 w-2 -translate-x-1/2 rounded-full", CHANGE.fill)}>
                  <span
                    className={cn("absolute inset-0 rounded-full", CHANGE.fill)}
                    style={{ animation: "vp-pulse-ring 2.4s ease-out infinite" }}
                  />
                </span>
              ) : null}
            </span>
            <ArrowRight
              aria-hidden
              className={cn("h-3.5 w-3.5 rotate-90 sm:hidden", changed ? CHANGE.text : "text-faint")}
            />
            <span
              className={cn(
                "text-center text-[10.5px] font-semibold uppercase tracking-[0.12em] whitespace-nowrap",
                changed ? CHANGE.text : "text-faint",
              )}
            >
              {connectorLabel}
            </span>
          </div>
          {now}
        </div>
      )}

      {caption ? (
        <figcaption className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-line pt-3.5">
          <span className="text-[14px] font-medium text-ink">
            The DNA has not changed. Only the interpretation has.
          </span>
          <span className="font-mono text-[11.5px] text-muted">
            {variant.gene} {variant.hgvsCoding}
            {variant.proteinChange ? ` (${variant.proteinChange})` : ""} · identical in both
          </span>
        </figcaption>
      ) : null}
    </figure>
  );
}

function Panel({
  eyebrow,
  code,
  note,
  tone,
  size,
}: {
  eyebrow: string;
  code: Parameters<typeof ClassificationBadge>[0]["code"];
  note: string;
  tone: "historical" | "current";
  size: "sm" | "md" | "lg";
}) {
  const info = meta(code);
  const role = tone === "historical" ? HISTORICAL : CURRENT;
  return (
    <div
      className={cn(
        "relative min-w-0 overflow-hidden rounded-xl border bg-surface p-3.5 pl-4",
        tone === "historical" ? "border-line" : "border-accent-ring",
      )}
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-[3px]", role.fill)} />
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-faint vp-num">
        {eyebrow}
      </p>
      <p
        className={cn(
          "mt-1.5 font-semibold leading-tight tracking-tight [overflow-wrap:break-word]",
          size === "lg" ? "text-[22px]" : size === "md" ? "text-[17px]" : "text-[15px]",
          tone === "historical" ? "text-ink-2" : role.text,
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
        "relative overflow-hidden p-5 transition-shadow hover:border-line-2",
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
          className={cn("ml-auto inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12.5px] font-medium transition-colors", CTA)}
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
  status: "live" | "connected" | "cached" | "degraded";
  detail?: React.ReactNode;
  glyph: React.ReactNode;
}) {
  const tone =
    status === "live" || status === "connected"
      ? "positive"
      : status === "cached"
        ? "warning"
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
            )}
          />
          <span
            className={cn(
              "text-[11px] font-medium capitalize",
              tone === "positive" && "text-ok",
              tone === "warning" && "text-warn",
              tone === "critical" && "text-crit",
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
  sync: "bg-ok",
  detection: CHANGE.fill,
  impact: "bg-info",
  case: CURRENT.fill,
  assignment: CURRENT.fill,
  "evidence-request": "bg-warn",
  "follow-up": "bg-warn",
  note: "bg-faint",
  review: "bg-ok",
};

export function ActivityItem({
  at,
  title,
  detail,
  kind,
  actor,
  absolute = false,
  last = false,
}: {
  at: string;
  title: string;
  detail?: string;
  kind: string;
  actor?: string;
  /** Adds the full date and time next to the relative one. */
  absolute?: boolean;
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
          <span className="mt-0.5 block text-[12px] leading-snug text-muted [overflow-wrap:anywhere]">
            {detail}
          </span>
        ) : null}
        <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] text-faint">
          {actor ? <span className="font-medium text-ink-2">{actor}</span> : null}
          {actor ? <span aria-hidden>·</span> : null}
          <RelativeTime value={at} className="vp-num" />
          {absolute ? <span aria-hidden>·</span> : null}
          {absolute ? <Timestamp value={at} className="vp-num" /> : null}
        </span>
      </span>
    </li>
  );
}
