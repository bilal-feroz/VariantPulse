/**
 * Global and regional evidence drawn as two lanes. When the sources disagree
 * the lanes pull apart and meet at a human-review node; neither lane is styled
 * as the authority, because VariantPulse never decides between them.
 */

import { Globe2, MapPin, ShieldCheck, UserCheck } from "lucide-react";

import type { RegionalDisagreement } from "@/lib/analysis";
import type { RegionalEvidence } from "@/data/regional";
import { REGIONAL_SOURCE } from "@/data/regional";
import { meta } from "@/lib/classification";
import { cn, formatDate } from "@/lib/utils";
import { ClassificationBadge } from "@/components/ui";
import { REVIEW } from "@/components/clinical/tokens";

export function EvidenceLanes({
  disagreement,
  regional,
  globalEvaluated,
  globalMeta,
  className,
}: {
  disagreement: RegionalDisagreement;
  regional: RegionalEvidence;
  /** ClinVar's last evaluation date for this record. */
  globalEvaluated: string | null;
  /** A short line describing the global record, e.g. review status. */
  globalMeta?: string;
  className?: string;
}) {
  const conflict = disagreement.conflicting;
  const { globalCode, regionalCode } = disagreement;

  return (
    <figure className={cn("min-w-0", className)}>
      <div
        className={cn(
          "grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(56px,110px)_minmax(0,220px)] md:gap-0",
        )}
      >
        <div className={cn("flex flex-col", conflict ? "md:py-0" : "md:py-6")}>
          <Lane
            icon={<Globe2 className="h-3.5 w-3.5" />}
            source="Global · ClinVar"
            code={globalCode}
            detail={[
              globalMeta,
              globalEvaluated ? `Last evaluated ${formatDate(globalEvaluated)}` : "Evaluation date not recorded",
            ]
              .filter(Boolean)
              .join(" · ")}
          />
          {conflict ? (
            <div className="flex items-center gap-2 py-2.5 pl-4" aria-hidden>
              <span className="h-px w-6 border-t border-dashed border-warn" />
              <span className={cn("text-[10.5px] font-semibold uppercase tracking-[0.12em]", REVIEW.text)}>
                Interpretations diverge
              </span>
            </div>
          ) : (
            <div className="h-2" aria-hidden />
          )}
          <Lane
            icon={<MapPin className="h-3.5 w-3.5" />}
            source={`Regional · ${REGIONAL_SOURCE.name}`}
            code={regionalCode}
            detail={`${regional.observations} observations in ${regional.cohortSize.toLocaleString("en-US")} · updated ${formatDate(regional.lastUpdated)}`}
          />
        </div>

        <svg
          aria-hidden
          className="hidden h-full w-full md:block"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {[conflict ? 18 : 30, conflict ? 82 : 70].map((y) => (
            <path
              key={y}
              d={`M0 ${y} C 55 ${y}, 45 50, 100 50`}
              fill="none"
              vectorEffect="non-scaling-stroke"
              strokeWidth={1.5}
              strokeDasharray={conflict ? "4 3" : undefined}
              className={conflict ? REVIEW.stroke : "stroke-ok"}
            />
          ))}
        </svg>

        <div className="flex items-center">
          {conflict ? (
            <div
              className={cn(
                "relative w-full overflow-hidden rounded-xl border p-3.5 pl-4",
                REVIEW.border,
                REVIEW.surface,
              )}
            >
              <span aria-hidden className={cn("absolute inset-y-0 left-0 w-[3px]", REVIEW.fill)} />
              <p className={cn("flex items-center gap-1.5 text-[13px] font-semibold", REVIEW.text)}>
                <UserCheck className="h-4 w-4" />
                Human review required
              </p>
              <p className="mt-1 text-[11.5px] leading-snug text-ink-2">
                {meta(globalCode).short} globally, {meta(regionalCode).short} regionally. A clinician
                weighs both; neither source is treated as correct.
              </p>
            </div>
          ) : (
            <div className="relative w-full overflow-hidden rounded-xl border border-ok-border bg-ok-soft p-3.5 pl-4">
              <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-ok" />
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ok">
                <ShieldCheck className="h-4 w-4" />
                Sources consistent
              </p>
              <p className="mt-1 text-[11.5px] leading-snug text-ink-2">
                Both lanes fall in the same clinical band.
              </p>
            </div>
          )}
        </div>
      </div>
      <figcaption className="mt-3.5 text-[12px] leading-relaxed text-muted">
        {disagreement.reason}
      </figcaption>
    </figure>
  );
}

function Lane({
  icon,
  source,
  code,
  detail,
}: {
  icon: React.ReactNode;
  source: string;
  code: RegionalDisagreement["globalCode"];
  detail: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-[11.5px] font-medium text-muted">
          <span className="text-faint">{icon}</span>
          <span className="truncate">{source}</span>
        </p>
        <ClassificationBadge code={code} full />
      </div>
      <p className="mt-1.5 text-[11.5px] text-faint vp-num">{detail}</p>
    </div>
  );
}
