"use client";

import * as React from "react";
import { MotionConfig } from "framer-motion";
import { FastForward, RefreshCw } from "lucide-react";

import { evidenceModeMeta } from "@/components/story/mode";
import { StoryGraph, StoryStack, type StoryData } from "@/components/story/story-graph";
import { STORY_STEPS, STORY_VARIANT_KEY } from "@/components/story/timeline";
import { useBackgroundSync, useStoryTimeline } from "@/components/story/use-story";
import { Button, StatusDot } from "@/components/ui";
import { useWorkspace } from "@/state/workspace";

export default function HomePage() {
  const { analysis } = useWorkspace();
  const { step, run, skip, running, done } = useStoryTimeline();
  const background = useBackgroundSync();
  const mode = evidenceModeMeta(background.mode ?? analysis.mode);

  const data = React.useMemo<StoryData | null>(() => {
    const lead =
      analysis.assessments.find((a) => a.variant.key === STORY_VARIANT_KEY) ??
      analysis.assessments.find((a) => analysis.reviewableKeys.includes(a.variant.key));
    if (!lead) return null;
    return {
      gene: lead.variant.gene,
      hgvs: lead.variant.hgvsCoding,
      recordedCode: lead.recordedCode,
      recordedOn: lead.variant.recordedOn,
      currentCode: lead.currentCode,
      lastEvaluated: lead.evidence.lastEvaluated,
      patients: lead.impactedPatients.map((p) => ({ id: p.id, testedOn: p.testedOn })),
      caseId: lead.caseId,
      variantKeys: analysis.assessments.map((a) => a.variant.key),
      leadKey: lead.variant.key,
    };
  }, [analysis]);

  const start = () => {
    background.start();
    run();
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto flex min-h-full w-full max-w-[1400px] flex-col px-4 pb-5 pt-2 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-ink sm:text-[30px]">
              The same DNA. A different meaning.
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-faint">
              <span className="inline-flex items-center gap-1.5" title={mode.detail}>
                <StatusDot tone={mode.tone} />
                <span className="font-medium text-ink-2">{mode.label}</span>
              </span>
              <span aria-hidden>·</span>
              <span>Synthetic demonstration data</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {running ? (
              <Button variant="secondary" onClick={skip}>
                <FastForward className="h-4 w-4" />
                Skip
              </Button>
            ) : null}
            <Button variant="primary" size="lg" onClick={start} disabled={running}>
              <RefreshCw className={running ? "h-4 w-4 vp-spin" : "h-4 w-4"} />
              {running ? "Syncing evidence" : done ? "Run evidence sync again" : "Run evidence sync"}
            </Button>
          </div>
        </header>

        <p className="sr-only" aria-live="polite">
          {STORY_STEPS[step]?.caption}
        </p>

        <section className="flex flex-1 items-center py-4" aria-label="Genomic change story">
          {data ? (
            <>
              <div className="mx-auto hidden w-full max-w-[min(100%,calc((100dvh-250px)*1280/540))] lg:block">
                <StoryGraph data={data} step={step} />
              </div>
              <div className="w-full lg:hidden">
                <StoryStack data={data} step={step} />
              </div>
            </>
          ) : (
            <p className="mx-auto text-[13px] text-muted">No monitored variant to show.</p>
          )}
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
          <p
            className={
              done
                ? "text-[15px] font-semibold tracking-tight text-ink transition-opacity duration-500"
                : "text-[15px] font-semibold tracking-tight text-ink opacity-0 transition-opacity duration-500"
            }
            aria-hidden={!done}
          >
            Your DNA didn&rsquo;t change. Science did.
            <span className="ml-3 font-medium text-muted">AI assists. Clinicians decide.</span>
          </p>
          <p className="text-[11px] text-faint">Built by Team Kanban</p>
        </footer>
      </div>
    </MotionConfig>
  );
}
