"use client";

/**
 * Evidence sync.
 *
 * The button triggers a real read: the server drops its cached evidence, queries
 * the source again, and re-walks the synthetic records. The overlay paces that
 * work so a reviewer can see which stage is running and what it found, rather
 * than watching an indeterminate spinner. The result it ends on, namely the
 * highest-priority change, the records it touches and the case it opened, is
 * read from the analysis the server returned, never scripted.
 */

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check, RefreshCw, X } from "lucide-react";

import { Button, ClassificationBadge } from "@/components/ui";
import { pick } from "@/lib/dto";
import { SYNC_STEPS, useWorkspace } from "@/state/workspace";
import { cn, formatNumber } from "@/lib/utils";

export function SyncButton({
  variant = "secondary",
  size = "md",
  className,
}: {
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { sync, runSync } = useWorkspace();
  const running = sync.phase === "running";

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => void runSync()}
      disabled={running}
      className={className}
    >
      <RefreshCw className={cn("h-4 w-4", running && "vp-spin")} />
      {running ? "Syncing evidence" : "Run evidence sync"}
    </Button>
  );
}

/** Counts up to `value` so the scale of the scan registers visually. */
function useCountUp(value: number, active: boolean) {
  const [display, setDisplay] = React.useState(0);

  React.useEffect(() => {
    if (!active) {
      setDisplay(0);
      return;
    }
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }

    let frame = 0;
    const started = performance.now();
    const duration = SYNC_STEPS.length * 340;

    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / duration);
      // Ease out so the number settles rather than snapping.
      setDisplay(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, active]);

  return display;
}

export function SyncOverlay() {
  const { sync, analysis } = useWorkspace();
  const [dismissed, setDismissed] = React.useState(false);

  const running = sync.phase === "running";
  const done = sync.phase === "done";
  const checked = useCountUp(analysis.scan.findingsChecked, running);
  const lead = pick(analysis, analysis.reviewableKeys)[0];
  const { consensusConflicts, regionalConflicts } = analysis.metrics;

  React.useEffect(() => {
    if (running) setDismissed(false);
  }, [running]);

  React.useEffect(() => {
    if (!done || dismissed) return;
    const timer = setTimeout(() => setDismissed(true), 14_000);
    return () => clearTimeout(timer);
  }, [done, dismissed, sync]);

  if (dismissed || sync.phase === "idle") return null;

  return (
    <div
      className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4 vp-no-print"
      role="status"
      aria-live="polite"
    >
      <div className="vp-rise w-[min(480px,100%)] overflow-hidden rounded-2xl border border-line-2 bg-surface/95 shadow-[0_28px_70px_-26px_rgba(var(--vp-shadow-rgb),0.4)] backdrop-blur-xl">
        {running ? (
          <div className="p-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[14px] font-semibold text-ink">Scanning synthetic records</p>
              <p className="text-[13px] font-medium text-accent vp-num">
                {formatNumber(checked)}
                <span className="text-faint"> / {formatNumber(analysis.scan.findingsChecked)}</span>
              </p>
            </div>

            <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
                style={{ width: `${((sync.step + 1) / SYNC_STEPS.length) * 100}%` }}
              />
            </div>

            <div className="mt-4 space-y-1.5">
              {SYNC_STEPS.map((step, index) => {
                const state = index < sync.step ? "done" : index === sync.step ? "active" : "pending";
                return (
                  <div
                    key={step.label}
                    className={cn(
                      "flex items-center gap-2.5 text-[12.5px] transition-opacity",
                      state === "pending" && "opacity-35",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-4 w-4 shrink-0 place-items-center rounded-full border",
                        state === "done" && "border-ok bg-ok text-white",
                        state === "active" && "border-accent bg-accent-soft",
                        state === "pending" && "border-line-2",
                      )}
                    >
                      {state === "done" ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
                      {state === "active" ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      ) : null}
                    </span>
                    <span className={cn(state === "active" ? "font-medium text-ink" : "text-muted")}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {done ? (
          <div className="p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ok-soft text-ok">
                <Check className="h-4 w-4" strokeWidth={2.6} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-ink">Evidence sync complete</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                  {formatNumber(analysis.scan.findingsChecked)} synthetic records checked against{" "}
                  {analysis.mode === "live" ? "live ClinVar evidence" : "cached verified ClinVar evidence"}.{" "}
                  {sync.changed > 0 || consensusConflicts > 0 || regionalConflicts > 0 ? (
                    <>
                      <span className="font-medium text-ink">
                        {sync.changed} reclassification{sync.changed === 1 ? "" : "s"}
                      </span>
                      , {consensusConflicts} consensus conflict{consensusConflicts === 1 ? "" : "s"}{" "}
                      and {regionalConflicts} regional signal{regionalConflicts === 1 ? "" : "s"} affect{" "}
                      <span className="font-medium text-ink">{sync.impacted} records</span>.
                    </>
                  ) : (
                    "No material evidence changes were detected."
                  )}
                </p>

                {lead ? (
                  <div className="vp-rise mt-3.5 rounded-xl border border-line bg-surface-2 p-3.5">
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-faint">
                      Highest priority
                    </p>
                    <p className="mt-1.5 text-[13px] font-semibold text-ink">
                      {lead.variant.gene}{" "}
                      <span className="font-mono text-[12px] font-normal text-muted">
                        {lead.variant.hgvsCoding}
                      </span>
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <ClassificationBadge code={lead.recordedCode} />
                      <ArrowRight className="h-3 w-3 text-faint" />
                      <span className="vp-rise" style={{ animationDelay: "0.35s" }}>
                        <ClassificationBadge code={lead.currentCode} />
                      </span>
                    </div>
                    <p className="mt-2 text-[12px] text-muted">
                      {lead.impactedRecordCount} synthetic record
                      {lead.impactedRecordCount === 1 ? "" : "s"} identified · case {lead.caseId}{" "}
                      opened
                    </p>
                  </div>
                ) : null}

                <div className="mt-3.5 flex items-center gap-2">
                  <Link href={lead?.caseId ? `/review/${lead.caseId}` : "/review"}>
                    <Button size="sm" variant="primary">
                      {lead?.caseId ? "Open clinical review" : "Open review queue"}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
                    Dismiss
                  </Button>
                </div>
                <p className="mt-3 border-t border-line pt-2.5 text-[11.5px] text-faint">
                  Your DNA didn&rsquo;t change. Science did. · AI assists. Clinicians decide.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                aria-label="Dismiss"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-faint hover:bg-surface-3 hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
