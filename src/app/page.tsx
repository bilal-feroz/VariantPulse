"use client";

import * as React from "react";
import { motion, MotionConfig } from "framer-motion";
import { FastForward, RefreshCw } from "lucide-react";

import { evidenceModeMeta } from "@/components/story/mode";
import { FittedStoryGraph, StoryStack, type StoryData } from "@/components/story/story-graph";
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

  const payoff = (
    <div className="flex h-full flex-col items-center justify-center text-center" aria-live="polite">
      {done ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <p className="text-[22px] font-semibold tracking-tight text-ink sm:text-[30px]">
            Your DNA didn&rsquo;t change. Science did.
          </p>
          <motion.p
            className="mt-1 text-[15px] font-medium text-muted sm:text-[18px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            AI assists. Clinicians decide.
          </motion.p>
        </motion.div>
      ) : null}
    </div>
  );

  const start = () => {
    background.start();
    run();
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto flex w-full max-w-[1760px] flex-col px-4 pb-6 pt-2 sm:px-6 lg:h-full lg:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-ink sm:text-[30px]">
              The same DNA. A different meaning.
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-faint">
              <span className="inline-flex items-center gap-1.5" title={mode.description}>
                <StatusDot tone={mode.tone} pulse={mode.pulse} />
                <span className="font-medium text-ink-2">{mode.indicator}</span>
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

        <section
          className="flex flex-col py-4 lg:min-h-[420px] lg:flex-1 lg:py-2"
          aria-label="Genomic change story"
        >
          {data ? (
            <>
              <div className="hidden min-h-0 flex-1 lg:block">
                <FittedStoryGraph data={data} step={step} footer={payoff} footerHeight={96} />
              </div>
              <div className="lg:hidden">
                <StoryStack data={data} step={step} />
                <div className="mt-6">{payoff}</div>
              </div>
            </>
          ) : (
            <p className="m-auto text-[13px] text-muted">No monitored variant to show.</p>
          )}
        </section>
      </div>
    </MotionConfig>
  );
}
