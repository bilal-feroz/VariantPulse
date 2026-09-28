"use client";

/**
 * "What changed?": everything behind one alert, in the order a reviewer checks
 * it. What the source reported comes first and is labelled as the source's
 * statement; what VariantPulse made of it is set apart and labelled as
 * inference; then how the records were matched, what limits the evidence, and
 * how fresh each input is. The whole of it downloads as an evidence snapshot.
 */

import * as React from "react";
import { ArrowRight, Download, ExternalLink } from "lucide-react";

import { RelativeTime } from "@/components/relative-time";
import {
  Badge,
  Card,
  ChangeTypeBadge,
  ClassificationBadge,
  Eyebrow,
  PriorityBadge,
  SectionHeading,
} from "@/components/ui";
import type { VariantAssessment } from "@/lib/analysis";
import { CHANGE_TYPES, meta, type ClassificationCode, type Tone } from "@/lib/classification";
import {
  LIMITATION_LABEL,
  evidenceSnapshot,
  firstVisibleChange,
  freshness,
  limitations,
  recordMatches,
  sourceChange,
  type EvidenceRead,
  type Limitation,
  type Reading,
} from "@/lib/explain";
import { cn, formatDate } from "@/lib/utils";

const LIMITATION_TONE: Record<Limitation["kind"], Tone> = {
  conflict: "warning",
  evidence: "neutral",
  data: "muted",
  method: "muted",
};

const TONE_TEXT: Record<Tone, string> = {
  positive: "text-ok",
  warning: "text-warn",
  critical: "text-crit",
  neutral: "text-info",
  muted: "text-ink-2",
};

export function WhatChanged({
  assessment,
  read,
  className,
}: {
  assessment: VariantAssessment;
  read: EvidenceRead;
  className?: string;
}) {
  const change = sourceChange(assessment);
  const first = firstVisibleChange(assessment);
  const matches = recordMatches(assessment);
  const notes = limitations(assessment, read);
  const rows = freshness(assessment, read);

  const downloadSnapshot = () => {
    const body = JSON.stringify(evidenceSnapshot(assessment, read, new Date().toISOString()), null, 2);
    const url = URL.createObjectURL(new Blob([body], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${assessment.caseId ?? assessment.variant.key.replace(/[:>]/g, "-")}-evidence-snapshot.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <SectionHeading
          title="What changed?"
          description="What the source reported, what VariantPulse made of it, how the records were matched, what limits the evidence and how fresh it is."
        />
        <button
          type="button"
          onClick={downloadSnapshot}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-[12.5px] font-medium text-accent transition-colors hover:bg-canvas"
        >
          <Download className="h-3.5 w-3.5" />
          Evidence snapshot
        </button>
      </div>

      {/* The source's own statement. */}
      <section className="px-5 py-4" aria-labelledby="wc-source">
        <div className="flex flex-wrap items-center gap-2">
          <Eyebrow>
            <span id="wc-source">Reported by the source</span>
          </Eyebrow>
          <Badge tone="neutral">Source statement</Badge>
        </div>
        <div className="mt-3 grid gap-2.5">
          <ReadingRow label="Then" reading={change.then} />
          <ReadingRow label="Now" reading={change.now} current={change.changed} />
        </div>

        {change.trajectory.length > 0 ? (
          <div className="mt-3.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-faint">
              ClinVar at each archived checkpoint
            </p>
            <ol className="mt-2 flex flex-wrap items-center gap-1.5">
              {change.trajectory.map((entry, index) => (
                <li key={entry.release} className="flex items-center gap-1.5">
                  {index > 0 ? <ArrowRight aria-hidden className="h-3 w-3 text-faint" /> : null}
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2 py-1">
                    <span className="text-[11px] font-medium text-muted vp-num">{entry.label}</span>
                    <CheckpointCode code={entry.code} />
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-[12px] leading-relaxed text-muted">
              {first
                ? `The change first shows at the ${first.label} checkpoint.`
                : "No archived checkpoint differs from the classification on record."}{" "}
              {change.changed && assessment.evidence.lastEvaluated
                ? `ClinVar's current reading was last evaluated on ${formatDate(assessment.evidence.lastEvaluated)}.`
                : null}
            </p>
          </div>
        ) : null}
      </section>

      {/* VariantPulse's own reading, kept apart from the source's. */}
      <section className="border-t border-line bg-surface-2 px-5 py-4" aria-labelledby="wc-inference">
        <div className="flex flex-wrap items-center gap-2">
          <Eyebrow>
            <span id="wc-inference">VariantPulse&rsquo;s reading</span>
          </Eyebrow>
          <Badge tone="muted">Inference, not a source statement</Badge>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ChangeTypeBadge type={assessment.changeType} />
          {assessment.caseId ? <PriorityBadge level={assessment.priority.level} /> : null}
        </div>
        <p className="mt-2.5 text-[13px] leading-relaxed text-ink-2">
          {CHANGE_TYPES[assessment.changeType].description}{" "}
          {assessment.caseId
            ? `The priority is a triage signal built from ${assessment.priority.factors.length} listed factors; it is not a clinical risk score.`
            : "No case is raised for it."}
        </p>
      </section>

      {/* How the records were joined to the variant. */}
      <section className="border-t border-line px-5 py-4" aria-labelledby="wc-records">
        <Eyebrow>
          <span id="wc-records">Records matched, and why</span>
        </Eyebrow>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{matches.basis}</p>
        {matches.records.length > 0 ? (
          <ul className="mt-2.5 divide-y divide-line rounded-xl border border-line">
            {matches.records.map((record) => (
              <li key={record.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3.5 py-2">
                <span className="font-mono text-[12.5px] font-medium text-ink">{record.id}</span>
                <span className="text-[12px] text-muted">
                  Tested {formatDate(record.testedOn)} · {record.department} · {record.owner}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[12.5px] text-muted">No record on file carries this variant.</p>
        )}
      </section>

      {/* What limits the evidence. */}
      <section className="border-t border-line px-5 py-4" aria-labelledby="wc-limits">
        <Eyebrow>
          <span id="wc-limits">Conflicts and limitations</span>
        </Eyebrow>
        <ul className="mt-2.5 space-y-2">
          {notes.map((note) => (
            <li key={note.text} className="flex items-start gap-2.5">
              <Badge tone={LIMITATION_TONE[note.kind]} className="mt-px shrink-0">
                {LIMITATION_LABEL[note.kind]}
              </Badge>
              <span className="text-[12.5px] leading-relaxed text-ink-2">{note.text}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* How fresh each input is. */}
      <section className="border-t border-line px-5 py-4" aria-labelledby="wc-freshness">
        <Eyebrow>
          <span id="wc-freshness">Data freshness</span>
        </Eyebrow>
        <dl className="mt-2.5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label} className="min-w-0">
              <dt className="text-[11px] font-medium uppercase tracking-[0.07em] text-faint">{row.label}</dt>
              <dd className="mt-0.5 text-[13px] leading-snug">
                <span className={cn("font-medium", TONE_TEXT[row.tone])}>{row.value}</span>
                {row.at ? (
                  <span className="text-muted">
                    {" "}
                    · <RelativeTime value={row.at} />
                  </span>
                ) : null}
                {row.note ? <span className="mt-0.5 block text-[11.5px] text-muted">{row.note}</span> : null}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </Card>
  );
}

function ReadingRow({ label, reading, current = false }: { label: string; reading: Reading; current?: boolean }) {
  return (
    <div
      className={cn(
        "grid gap-x-4 gap-y-1.5 rounded-xl border px-3.5 py-3 sm:grid-cols-[56px_minmax(0,1fr)]",
        current ? "border-selected-border bg-selected-bg" : "border-line bg-surface",
      )}
    >
      <p className={cn("text-[11px] font-bold uppercase tracking-[0.1em]", current ? "text-garnet" : "text-muted")}>
        {label}
      </p>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2">
          {reading.code ? <ClassificationBadge code={reading.code} full /> : null}
          <span className="text-[12.5px] text-ink-2">&ldquo;{reading.wording}&rdquo;</span>
        </p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
          {reading.source}
          {reading.reviewStatus ? ` · ${reading.reviewStatus}` : ""} · {reading.dateLabel}
          {reading.href && reading.hrefLabel ? (
            <>
              {" · "}
              <a
                href={reading.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
              >
                {reading.hrefLabel}
                <ExternalLink className="h-3 w-3" />
              </a>
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}

function CheckpointCode({ code }: { code: ClassificationCode | null }) {
  if (!code) return <span className="text-[11.5px] text-faint">Not in ClinVar</span>;
  return <span className="text-[11.5px] font-semibold text-ink">{meta(code).short}</span>;
}
