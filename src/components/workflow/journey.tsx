"use client";

/**
 * The whole journey of a case in one row: updated evidence, matched records,
 * a named owner, a documented decision, approved follow-up and a closed case,
 * each with who did it and when. Stacks vertically on narrow screens.
 */

import { Check, Minus } from "lucide-react";

import { cn, formatDate } from "@/lib/utils";
import type { JourneyStep } from "@/lib/workflow";

export function CaseJourney({ steps, className }: { steps: JourneyStep[]; className?: string }) {
  const done = steps.filter((s) => s.status === "done" || s.status === "skipped").length;

  return (
    <nav aria-label="Case journey" className={cn("vp-card px-5 py-4", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-faint">Case journey</p>
        <p className="text-[11.5px] text-muted vp-num">
          {done} of {steps.length} steps complete
        </p>
      </div>
      <ol className="mt-3.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 xl:gap-0">
        {steps.map((step, index) => (
          <li
            key={step.key}
            aria-current={step.status === "current" ? "step" : undefined}
            className="relative flex gap-3 xl:flex-col xl:gap-2.5 xl:pr-4"
          >
            {index < steps.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[34px] right-0 top-[13px] hidden h-px xl:block",
                  step.status === "done" || step.status === "skipped" ? "bg-ok/50" : "bg-line",
                )}
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 grid h-[27px] w-[27px] shrink-0 place-items-center rounded-full border text-[11px] font-semibold vp-num",
                step.status === "done" && "border-ok bg-ok text-white",
                step.status === "skipped" && "border-dashed border-line-2 bg-surface text-faint",
                step.status === "current" && "border-accent bg-accent-soft text-accent ring-4 ring-accent-soft/70",
                step.status === "upcoming" && "border-line-2 bg-surface text-faint",
              )}
            >
              {step.status === "done" ? (
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              ) : step.status === "skipped" ? (
                <Minus className="h-3.5 w-3.5" />
              ) : (
                index + 1
              )}
            </span>
            <span className="min-w-0">
              <span
                className={cn(
                  "block text-[13px] font-semibold leading-snug",
                  step.status === "upcoming" || step.status === "skipped" ? "text-muted" : "text-ink",
                )}
              >
                {step.label}
                <span className="sr-only">
                  {step.status === "done"
                    ? ", complete"
                    : step.status === "current"
                      ? ", next"
                      : step.status === "skipped"
                        ? ", not required"
                        : ", not started"}
                </span>
              </span>
              {step.detail ? (
                <span className="mt-0.5 block text-[12px] leading-snug text-ink-2 [overflow-wrap:anywhere]">
                  {step.detail}
                </span>
              ) : step.status === "current" ? (
                <span className="mt-0.5 block text-[12px] leading-snug text-accent">Next step</span>
              ) : null}
              {step.actor || step.at ? (
                <span className="mt-0.5 block text-[11px] leading-snug text-faint vp-num">
                  {[step.actor, step.at ? formatDate(step.at) : null].filter(Boolean).join(" · ")}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
