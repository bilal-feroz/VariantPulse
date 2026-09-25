"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";

import { parseScanTiming } from "@/lib/impact";

import { FINAL_STEP, STEP, STEP_STARTS_MS } from "./timeline";

/**
 * Drives the choreography from fixed timings. Pure client state: a reload
 * returns to idle, and under reduced motion Run jumps straight to the end.
 */
export function useStoryTimeline() {
  const reduceMotion = useReducedMotion();
  const [step, setStep] = React.useState<number>(STEP.idle);
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  const clear = React.useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  React.useEffect(() => clear, [clear]);

  const run = React.useCallback(() => {
    clear();
    if (reduceMotion) {
      setStep(FINAL_STEP);
      return;
    }
    setStep(STEP.sources);
    for (let s = STEP.sources + 1; s <= FINAL_STEP; s += 1) {
      timers.current.push(setTimeout(() => setStep(s), STEP_STARTS_MS[s]));
    }
  }, [clear, reduceMotion]);

  const skip = React.useCallback(() => {
    clear();
    setStep(FINAL_STEP);
  }, [clear]);

  const running = step > STEP.idle && step < FINAL_STEP;
  return { step, run, skip, running, done: step === FINAL_STEP };
}

/**
 * Fires the real sync in the background. It never touches the choreography;
 * it only reports which evidence mode the server ended up serving, and how long
 * its scan took.
 */
export function useBackgroundSync() {
  const [mode, setMode] = React.useState<string | null>(null);
  const [scanMs, setScanMs] = React.useState<number | null>(null);
  const controller = React.useRef<AbortController | null>(null);

  React.useEffect(() => () => controller.current?.abort(), []);

  const start = React.useCallback(() => {
    controller.current?.abort();
    if (!navigator.onLine) return;
    const next = new AbortController();
    controller.current = next;
    fetch("/api/sync", { method: "POST", signal: next.signal })
      .then((r) => {
        if (!r.ok) return null;
        const duration = parseScanTiming(r.headers.get("Server-Timing"));
        if (duration !== null) setScanMs(duration);
        return r.json() as Promise<{ mode?: unknown }>;
      })
      .then((body) => {
        if (body && typeof body.mode === "string") setMode(body.mode);
      })
      .catch(() => {
        // Offline or aborted: the indicator keeps the mode the page loaded with.
      });
  }, []);

  return { mode, scanMs, start };
}
