"use client";

/**
 * One compact row on the home dashboard: what the scan covered and what it
 * stands in for. The first two figures are read from the analysis and the scan
 * time is measured; the third is an estimate and says so beneath it.
 */

import * as React from "react";

import { Card } from "@/components/ui";
import { MINUTES_PER_MANUAL_CHECK, estimatedHoursSaved, formatScanSeconds } from "@/lib/impact";
import { cn, formatNumber } from "@/lib/utils";

export function ImpactPanel({
  findingsChecked,
  casesSurfaced,
  scanMs,
  className,
}: {
  findingsChecked: number;
  casesSurfaced: number;
  /** Measured duration of the analysis run, when known. */
  scanMs: number | null;
  className?: string;
}) {
  const hours = estimatedHoursSaved(findingsChecked);

  return (
    <Card
      role="group"
      aria-label="Impact"
      className={cn(
        "grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0",
        className,
      )}
    >
      <ImpactStat
        label="Findings scanned"
        value={formatNumber(findingsChecked)}
        detail={scanMs === null ? "At the last evidence sync" : `Scanned in ${formatScanSeconds(scanMs)}`}
      />
      <ImpactStat
        label="Cases surfaced"
        value={formatNumber(casesSurfaced)}
        detail="Evidence changes detected"
      />
      <ImpactStat
        label="Estimated clinician time saved"
        value={`${formatNumber(Math.round(hours))} hours`}
        detail={`Estimate · assumes ~${MINUTES_PER_MANUAL_CHECK} min manual ClinVar lookup per finding`}
      />
    </Card>
  );
}

function ImpactStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 px-5 py-3">
      <p className="text-[10.5px] font-medium uppercase tracking-[0.07em] text-faint">{label}</p>
      <p className="mt-1 text-[18px] font-semibold leading-tight tracking-tight text-ink vp-num">
        {value}
      </p>
      <p className="mt-0.5 text-[11.5px] leading-snug text-muted">{detail}</p>
    </div>
  );
}
