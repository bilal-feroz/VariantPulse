"use client";

/**
 * The patient letter: an English and an Arabic draft side by side, each
 * editable, for one affected record at a time.
 *
 * It is offered only once a clinician has confirmed the change. The drafts
 * start from the fixed templates in `lib/letter`, filled from the record, and
 * edits are kept per record so switching between records loses nothing. What is
 * copied or downloaded is what is on screen, headed by the draft notice.
 */

import * as React from "react";
import { Noto_Sans_Arabic } from "next/font/google";
import { Check, Copy, Download, Mail, RotateCcw, Sparkles, X } from "lucide-react";

import { Badge, Button } from "@/components/ui";
import type { VariantAssessment } from "@/lib/analysis";
import {
  LETTER_DRAFT_NOTE,
  LETTER_WORD_LIMIT,
  composePatientLetter,
  countWords,
  letterFileText,
  type LetterImprovement,
  type LetterInput,
  type PatientLetter,
} from "@/lib/letter";
import { cn } from "@/lib/utils";

/** A little past the server's own model timeout, so the server gets to answer first. */
const AI_REQUEST_TIMEOUT_MS = 12_000;

// Inter carries no Arabic glyphs. Not preloaded: it is only needed once a
// letter is open.
const arabicFont = Noto_Sans_Arabic({
  subsets: ["arabic"],
  display: "swap",
  preload: false,
  fallback: ["Segoe UI", "Geeza Pro", "Tahoma", "sans-serif"],
});

export function PatientLetterButton({ assessment }: { assessment: VariantAssessment }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button variant="secondary" className="w-full justify-start" onClick={() => setOpen(true)}>
        <Mail className="h-4 w-4" />
        Draft patient letter
      </Button>
      {open ? (
        <PatientLetterDialog assessment={assessment} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

/** Writes to the clipboard, falling back to a selection copy where the API is unavailable. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand("copy");
      area.remove();
      return copied;
    } catch {
      return false;
    }
  }
}

function PatientLetterDialog({
  assessment,
  onClose,
}: {
  assessment: VariantAssessment;
  onClose: () => void;
}) {
  const records = assessment.impactedPatients;
  const [recordId, setRecordId] = React.useState(records[0]?.id ?? "");
  const [drafts, setDrafts] = React.useState<Record<string, PatientLetter>>({});
  const [copyState, setCopyState] = React.useState<"idle" | "copied" | "manual">("idle");
  const [improving, setImproving] = React.useState(false);
  /** Per record: what "Improve with AI" did, and the draft it replaced. */
  const [aiOutcome, setAiOutcome] = React.useState<
    Record<string, { reworded: boolean; reason?: string; previous?: PatientLetter }>
  >({});

  const record = records.find((r) => r.id === recordId) ?? records[0];
  const input = React.useMemo<LetterInput | null>(
    () =>
      record
        ? {
            caseId: assessment.caseId ?? assessment.variant.key,
            recordId: record.id,
            gene: assessment.variant.gene,
            testedOn: record.testedOn,
            department: record.orderingDepartment,
            clinicalOwner: record.clinicalOwner,
          }
        : null,
    [assessment, record],
  );
  const template = React.useMemo(() => (input ? composePatientLetter(input) : null), [input]);
  const letter = (record && drafts[record.id]) || template;

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  React.useEffect(() => {
    if (copyState === "idle") return;
    const timer = window.setTimeout(() => setCopyState("idle"), 2400);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const edit = (field: keyof PatientLetter, value: string) => {
    if (!record || !template) return;
    setDrafts((prev) => ({ ...prev, [record.id]: { ...(prev[record.id] ?? template), [field]: value } }));
  };

  const forget = <T,>(map: Record<string, T>, id: string): Record<string, T> => {
    const next = { ...map };
    delete next[id];
    return next;
  };

  const resetDraft = () => {
    if (!record) return;
    setDrafts((prev) => forget(prev, record.id));
    setAiOutcome((prev) => forget(prev, record.id));
  };

  /** Optional. Any failure leaves the draft as it was and says so plainly. */
  const improve = async () => {
    if (!record || !input || !letter) return;
    const id = record.id;
    const previous = letter;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
    setImproving(true);

    let result: LetterImprovement | null = null;
    try {
      const response = await fetch("/api/letter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId: input.caseId, recordId: id }),
        signal: controller.signal,
      });
      result = response.ok ? ((await response.json()) as LetterImprovement) : null;
    } catch {
      result = null;
    } finally {
      window.clearTimeout(timer);
      setImproving(false);
    }

    const improved = result;
    if (improved?.source === "ai" && improved.english && improved.arabic) {
      setDrafts((prev) => ({ ...prev, [id]: { english: improved.english, arabic: improved.arabic } }));
      setAiOutcome((prev) => ({ ...prev, [id]: { reworded: true, previous } }));
    } else {
      setAiOutcome((prev) => ({ ...prev, [id]: { reworded: false, reason: improved?.reason } }));
    }
  };

  const undoImprovement = () => {
    const previous = record ? aiOutcome[record.id]?.previous : undefined;
    if (!record || !previous) return;
    setDrafts((prev) => ({ ...prev, [record.id]: previous }));
    setAiOutcome((prev) => forget(prev, record.id));
  };

  const outcome = record ? aiOutcome[record.id] : undefined;

  const copy = async () => {
    if (!input || !letter) return;
    setCopyState((await copyText(letterFileText(input, letter))) ? "copied" : "manual");
  };

  const download = () => {
    if (!input || !letter) return;
    // The byte-order mark lets older editors recognise the Arabic as UTF-8.
    const blob = new Blob(["﻿", letterFileText(input, letter)], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${input.caseId}-${input.recordId}-patient-letter.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto vp-fade"
      role="dialog"
      aria-modal="true"
      aria-labelledby="patient-letter-title"
    >
      <button
        type="button"
        aria-label="Close letter"
        onClick={onClose}
        className="fixed inset-0 cursor-default bg-carbon/30 backdrop-blur-[2px]"
      />

      <div className="relative mx-auto my-8 w-[min(1120px,calc(100vw-2rem))]">
        <div className="mb-3 flex items-center justify-end gap-2">
          <Button size="sm" onClick={improve} disabled={!letter || improving}>
            <Sparkles className={cn("h-3.5 w-3.5", improving && "vp-spin")} />
            {improving ? "Improving" : "Improve with AI"}
          </Button>
          <Button size="sm" onClick={copy} disabled={!letter}>
            {copyState === "copied" ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copyState === "copied" ? "Copied" : "Copy"}
          </Button>
          <Button size="sm" onClick={download} disabled={!letter}>
            <Download className="h-3.5 w-3.5" />
            Download .txt
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <article className="rounded-2xl border border-line-2 bg-surface p-6 shadow-xl sm:p-8">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
                Patient letter · English and Arabic
              </p>
              <h2 id="patient-letter-title" className="mt-1.5 text-[20px] font-semibold tracking-tight text-ink">
                {assessment.variant.gene} · {assessment.caseId}
              </h2>
            </div>
            <Badge tone="warning" dot>
              {LETTER_DRAFT_NOTE}
            </Badge>
          </header>

          {records.length > 1 ? (
            <div className="mt-4">
              <label
                htmlFor="letter-record"
                className="text-[11px] font-medium uppercase tracking-[0.07em] text-faint"
              >
                Letter for record
              </label>
              <select
                id="letter-record"
                value={record?.id ?? ""}
                onChange={(event) => setRecordId(event.target.value)}
                className="mt-2 w-full max-w-md rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-[13px] text-ink outline-none transition-colors focus:border-accent-ring focus:bg-surface"
              >
                {records.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id} · {r.orderingDepartment} · {r.clinicalOwner}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {letter ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <LetterField
                id="letter-en"
                label="English"
                lang="en"
                value={letter.english}
                onChange={(value) => edit("english", value)}
              />
              <LetterField
                id="letter-ar"
                label="العربية"
                lang="ar"
                value={letter.arabic}
                onChange={(value) => edit("arabic", value)}
                className={arabicFont.className}
              />
            </div>
          ) : (
            <p className="mt-6 text-center text-[13px] text-muted">
              No affected record on this case to address a letter to.
            </p>
          )}

          <footer className="mt-4 flex flex-wrap items-start justify-between gap-3 border-t border-line pt-4">
            <p className="max-w-2xl text-[12px] leading-relaxed text-muted">
              <strong className="font-semibold text-ink">{LETTER_DRAFT_NOTE}.</strong> Filled from
              the record: test date, gene, ordering department and clinical owner. It states no
              diagnosis and no risk figures.
              {copyState === "manual" ? " Copying is not available here; select the text instead." : ""}
              {outcome?.reworded ? (
                <>
                  {" "}
                  Reworded by Claude from the template, with every fact from the record kept.{" "}
                  <button
                    type="button"
                    onClick={undoImprovement}
                    className="font-medium text-ink-2 underline-offset-2 transition-colors hover:text-accent hover:underline"
                  >
                    Undo
                  </button>
                </>
              ) : outcome ? (
                outcome.reason === "no-key" ? (
                  " AI wording is not set up here, so the template wording stands."
                ) : (
                  " The template wording was kept."
                )
              ) : null}
            </p>
            {record && drafts[record.id] ? (
              <button
                type="button"
                onClick={resetDraft}
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-muted transition-colors hover:text-accent"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset to template
              </button>
            ) : null}
          </footer>
        </article>
      </div>
    </div>
  );
}

function LetterField({
  id,
  label,
  lang,
  value,
  onChange,
  className,
}: {
  id: string;
  label: string;
  lang: "en" | "ar";
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const words = countWords(value);
  const rtl = lang === "ar";

  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor={id}
          lang={lang}
          className={cn(
            "text-[11px] font-medium uppercase tracking-[0.07em] text-faint",
            rtl && "text-[13px] normal-case tracking-normal",
            rtl && className,
          )}
        >
          {label}
        </label>
        <span
          className={cn("text-[11px] vp-num", words > LETTER_WORD_LIMIT ? "text-warn" : "text-faint")}
        >
          {words} words
          {words > LETTER_WORD_LIMIT ? ` · over the ~${LETTER_WORD_LIMIT}-word guide` : ""}
        </span>
      </div>
      <textarea
        id={id}
        lang={lang}
        dir={rtl ? "rtl" : "ltr"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={19}
        spellCheck
        className={cn(
          "mt-2 w-full resize-y rounded-xl border border-line bg-surface-2 px-4 py-3 leading-relaxed text-ink outline-none transition-colors focus:border-accent-ring focus:bg-surface",
          rtl ? "text-[15px]" : "text-[13.5px]",
          className,
        )}
      />
    </div>
  );
}
