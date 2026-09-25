"use client";

import * as React from "react";

import { relativeTime } from "@/lib/utils";

/**
 * A timestamp rendered relative to now.
 *
 * These are a hydration hazard: the server renders "just now" and the client,
 * a second later, renders "1m ago". React then treats the whole subtree as
 * mismatched and regenerates it. Branching on mount would fix the warning but
 * flash a placeholder, so instead the expected difference is suppressed and the
 * value re-renders on a timer — which it needs to do anyway to stay honest
 * about how stale the evidence is.
 */
export function RelativeTime({
  value,
  className,
  /** Re-render interval. Defaults to 30s, which matches the coarsest unit. */
  intervalMs = 30_000,
}: {
  value: string | null | undefined;
  className?: string;
  intervalMs?: number;
}) {
  const [, refresh] = React.useReducer((n: number) => n + 1, 0);

  React.useEffect(() => {
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return (
    <time dateTime={value ?? undefined} className={className} suppressHydrationWarning>
      {relativeTime(value)}
    </time>
  );
}
