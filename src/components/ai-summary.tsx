"use client";

/**
 * The drafted evidence summary at the top of a case.
 *
 * The text is editable, because it is a draft for a clinician to check and
 * correct, not a finding. "Use in brief" files the text, as edited, in the case
 * trail, where the evidence brief picks it up. If the summary route cannot be
 * reached at all, the same deterministic summary the server would have fallen
 * back to is composed here, so the panel never shows an error.
 */

import * as React from "react";
import { Check, ClipboardCopy, Sparkles } from "lucide-react";

import { Badge, Button, Card, SectionHeading, Skeleton } from "@/components/ui";
import type { VariantAssessment } from "@/lib/analysis";
import { composeFallbackSummary, summaryFacts, type SummaryResult } from "@/lib/summary";

/** A little past the server's own model timeout, so the server gets to answer first. */
const REQUEST_TIMEOUT_MS = 12_000;

type Draft = Pick<SummaryResult, "source" | "model">;

export function AiSummaryPanel({
  assessment,
  onUseInBrief,
}: {
  assessment: VariantAssessment;
  onUseInBrief: (text: string) => void;
}) {
  const caseId = assessment.caseId ?? assessment.variant.key;
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [text, setText] = React.useState("");
  const [filed, setFiled] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    setDraft(null);

    fetch("/api/summary", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ caseId }),
      signal: controller.signal,
    })
      .then((response) => (response.ok ? (response.json() as Promise<SummaryResult>) : null))
      .catch(() => null)
      .then((result) => {
        if (!active) return;
        const usable = result && Array.isArray(result.sentences) && result.sentences.length > 0;
        const sentences = usable ? result.sentences : composeFallbackSummary(summaryFacts(assessment));
        setText(sentences.join("\n"));
        setDraft(usable ? { source: result.source, model: result.model } : { source: "fallback" });
      })
      .finally(() => window.clearTimeout(timer));

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [caseId, assessment]);

  React.useEffect(() => {
    if (!filed) return;
    const timer = window.setTimeout(() => setFiled(false), 2400);
    return () => window.clearTimeout(timer);
  }, [filed]);

  const useInBrief = () => {
    const body = text.trim();
    if (!body) return;
    onUseInBrief(body);
    setFiled(true);
  };

  return (
    <Card className="p-5">
      <SectionHeading
        title="Evidence summary draft"
        icon={<Sparkles className="h-4 w-4" />}
        action={
          <Badge tone="warning" dot>
            AI draft · clinician must review
          </Badge>
        }
      />

      {draft === null ? (
        <div className="mt-4 space-y-2" aria-busy="true" aria-label="Drafting the summary">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-[92%]" />
          <Skeleton className="h-3.5 w-[96%]" />
          <Skeleton className="h-3.5 w-[70%]" />
        </div>
      ) : (
        <>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={6}
            aria-label="Evidence summary draft"
            className="mt-4 w-full resize-y rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink outline-none transition-colors focus:border-accent-ring focus:bg-surface"
          />
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-[11.5px] leading-relaxed text-faint">
              {draft.source === "ai"
                ? "Drafted by Claude from this case's data only."
                : "Composed from this case's data by a fixed template."}{" "}
              Each sentence ends with its source; check it against the evidence below.
            </p>
            <Button size="sm" onClick={useInBrief} disabled={!text.trim()}>
              {filed ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
              {filed ? "Added to case note" : "Use in brief"}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
