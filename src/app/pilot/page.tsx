"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Download, FileUp, Lock, ShieldCheck } from "lucide-react";

import { PageHeader, PageShell } from "@/components/page-header";
import { Badge, Button, Card, ChangeTypeBadge, Eyebrow, SectionHeading } from "@/components/ui";
import { RoleNote } from "@/components/workflow/role-note";
import { REFERENCE_SET_HEADER } from "@/data/onboarding-sample";
import { MONITORED_VARIANTS, SERVICE_LEAD } from "@/data/workspace";
import { CHANGE_TYPES, meta, type ChangeType } from "@/lib/classification";
import { parseDelimited } from "@/lib/onboarding";
import {
  ADJUDICATION,
  ALERT_LABELS,
  SILENT_LABELS,
  adjudicationsFromReference,
  criteriaResults,
  evaluate,
  formatMinutes,
  replayReleases,
  type AdjudicationLabel,
  type CriterionStatus,
  type SuccessCriteria,
} from "@/lib/pilot";
import { denial } from "@/lib/roles";
import { cn, formatDate } from "@/lib/utils";
import { reviewDurationMs } from "@/lib/workflow";
import { useWorkspace } from "@/state/workspace";

const percent = (value: number | null) => (value === null ? null : `${Math.round(value * 100)}%`);

function download(name: string, type: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

const csvCell = (value: string) => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

export default function PilotPage() {
  const { analysis, getCase, adjudications, lastImport, criteria } = useWorkspace();

  const alertKeys = analysis.reviewableKeys;
  const silentKeys = analysis.assessments.filter((a) => !a.caseId).map((a) => a.variant.key);
  const durations = analysis.assessments
    .filter((a) => a.caseId)
    .map((a) => reviewDurationMs(getCase(a.caseId as string)))
    .filter((ms): ms is number => ms !== null);

  const evaluation = evaluate({
    alertKeys,
    silentKeys,
    adjudications,
    reviewDurationsMs: durations,
    importTotals: lastImport?.totals ?? null,
  });

  return (
    <PageShell>
      <PageHeader
        eyebrow="Silent pilot"
        title="Evaluate before anything changes"
        description="Run VariantPulse over a partner's historical results with no notification reaching a patient and no change to care, then measure it against independent expert review."
        actions={<SilentSwitch />}
      />

      <SilentScope />
      <Replay />

      <SectionHeading
        className="mt-8"
        title="Evaluation"
        description="Computed only from labels entered in this session or loaded from a reference set, and from timings the workflow records. No figure is supplied."
      />
      <Metrics evaluation={evaluation} />

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <Worklist alertKeys={alertKeys} />
        <div className="min-w-0 space-y-5">
          <Criteria evaluation={evaluation} criteria={criteria} />
          <Protocol />
        </div>
      </div>

      <Walkthrough />
    </PageShell>
  );
}

/* -- Silent mode ----------------------------------------------------------- */

function SilentSwitch() {
  const { silentMode, setSilentMode, can, persona } = useWorkspace();
  const allowed = can("pilot:configure");
  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        role="switch"
        aria-checked={silentMode}
        onClick={() => setSilentMode(!silentMode)}
        disabled={!allowed}
        className={cn(
          "inline-flex items-center gap-3 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          silentMode ? "border-warn-border bg-warn-soft text-warn" : "border-line bg-surface text-ink-2 hover:bg-surface-2",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "relative h-5 w-9 rounded-full transition-colors",
            silentMode ? "bg-amber" : "bg-line-2",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
              silentMode ? "translate-x-[18px]" : "translate-x-0.5",
            )}
          />
        </span>
        Silent pilot mode {silentMode ? "on" : "off"}
      </button>
      {!allowed ? (
        <RoleNote reason={denial(persona, "pilot:configure")} switchTo={SERVICE_LEAD.id} className="max-w-[340px]" />
      ) : null}
    </div>
  );
}

function SilentScope() {
  const { silentMode } = useWorkspace();
  return (
    <Card className={cn("p-5", silentMode && "border-warn-border")}>
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-warn" />
            <Eyebrow>Held while silent</Eyebrow>
          </div>
          <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-ink-2">
            <li>Patient explanation letters: not drafted or released.</li>
            <li>Referrals and anything else that reaches a patient: approved and recorded, never carried out.</li>
            <li>FHIR export to hospital systems: unavailable.</li>
          </ul>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-ok" />
            <Eyebrow>Carries on, so it can be measured</Eyebrow>
          </div>
          <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-ink-2">
            <li>Detection, record matching and the review queue.</li>
            <li>Owners, deadlines, decisions and approvals, with their timings.</li>
            <li>The case histories and the audit trail.</li>
          </ul>
        </div>
      </div>
      <p className="mt-4 border-t border-line pt-3.5 text-[12px] leading-relaxed text-muted">
        {silentMode
          ? "Silent pilot mode is on for this session. A banner on every case says so."
          : "Silent pilot mode is off. The service lead switches it on for an evaluation run."}
      </p>
    </Card>
  );
}

/* -- Retrospective replay -------------------------------------------------- */

const CELL_TONE: Record<string, string> = {
  critical: "border-crit-border bg-crit-soft text-crit",
  warning: "border-warn-border bg-warn-soft text-warn",
  positive: "border-ok-border bg-ok-soft text-ok",
  neutral: "border-info-border bg-info-soft text-info",
  muted: "border-line bg-surface-2 text-muted",
};

function Replay() {
  const { analysis } = useWorkspace();
  const replay = React.useMemo(() => replayReleases(), []);
  const byKey = new Map(analysis.assessments.map((a) => [a.variant.key, a]));
  const [first, second, third] = replay.checkpoints;

  return (
    <Card className="mt-5 overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <SectionHeading
          title="Retrospective replay"
          description="ClinVar's archived releases, run checkpoint by checkpoint against the classifications on record, through the same engine as the live workspace."
        />
        {first && second && third ? (
          <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-ink-2">
            Had VariantPulse been watching since {replay.baseline.label}, it would have held{" "}
            <strong className="font-semibold text-ink vp-num">{replay.alertsAt[first.release]}</strong> open
            alert{replay.alertsAt[first.release] === 1 ? "" : "s"} by {first.label},{" "}
            <strong className="font-semibold text-ink vp-num">{replay.alertsAt[second.release]}</strong> by{" "}
            {second.label} and{" "}
            <strong className="font-semibold text-ink vp-num">{replay.alertsAt[third.release]}</strong> by{" "}
            {third.label}, covering {replay.recordsAt[third.release]} historical records.
          </p>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-surface-2">
              <Th>Variant</Th>
              <Th>On record</Th>
              {replay.checkpoints.map((c) => (
                <Th key={c.release}>{c.label}</Th>
              ))}
              <Th>First alert</Th>
              <Th>Today</Th>
            </tr>
          </thead>
          <tbody>
            {replay.rows.map((row) => {
              const today = byKey.get(row.key);
              return (
                <tr key={row.key} className="border-b border-line last:border-0">
                  <th scope="row" className="px-4 py-2.5">
                    <Link href={`/variants/${encodeURIComponent(row.key)}`} className="hover:text-accent">
                      <span className="text-[13px] font-semibold text-ink">{row.gene}</span>{" "}
                      <span className="font-mono text-[11.5px] text-muted">{row.hgvs}</span>
                    </Link>
                    <span className="block text-[11px] text-faint">
                      {row.records} record{row.records === 1 ? "" : "s"}
                    </span>
                  </th>
                  <td className="px-4 py-2.5">
                    <span className="text-[12.5px] font-medium text-ink-2">{meta(row.baseline).short}</span>
                    <span className="block text-[11px] text-faint">{row.baselineSource}</span>
                  </td>
                  {row.cells.map((cell) => (
                    <td key={cell.release} className="px-4 py-2.5">
                      {!cell.captured ? (
                        <span className="text-[12px] text-faint" title="The dataset holds no reading for this checkpoint">
                          Not captured
                        </span>
                      ) : (
                        <ReplayCell code={cell.code} changeType={cell.changeType} alert={cell.alert} />
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-[12.5px] text-ink-2 vp-num">
                    {row.firstAlert ? row.firstAlert.label : <span className="text-faint">None</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {today ? (
                      <ReplayCell
                        code={today.currentCode}
                        changeType={today.changeType}
                        alert={Boolean(today.caseId)}
                      />
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-5 py-3.5 text-[12px] leading-relaxed text-muted">
        Archived readings exist only at these checkpoints, so each change is dated to the first one that shows
        it. Regional signals are not replayed: the regional sources were read once, on 25 Sep 2026. &ldquo;Today&rdquo;
        is the current analysis, which is how CFTR c.601G&gt;A carries a case with no global change.
      </p>
    </Card>
  );
}

function ReplayCell({
  code,
  changeType,
  alert,
}: {
  code: Parameters<typeof meta>[0] | null;
  changeType: ChangeType | null;
  alert: boolean;
}) {
  const label = code ? meta(code).short : "Not in ClinVar";
  if (!alert || !changeType) {
    return <span className="text-[12.5px] text-muted">{label}</span>;
  }
  const tone = CHANGE_TYPES[changeType].tone;
  return (
    <span
      className={cn("inline-flex flex-col rounded-lg border px-2 py-1 leading-tight", CELL_TONE[tone])}
      title={CHANGE_TYPES[changeType].description}
    >
      <span className="text-[12px] font-semibold">{label}</span>
      <span className="text-[10.5px] font-medium">{CHANGE_TYPES[changeType].label}</span>
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-faint">
      {children}
    </th>
  );
}

/* -- Metrics --------------------------------------------------------------- */

function Metrics({ evaluation }: { evaluation: ReturnType<typeof evaluate> }) {
  const alertsLabelled = evaluation.counts.TP + evaluation.counts.FP + evaluation.counts.DUP;
  const silentLabelled = evaluation.counts.FN + evaluation.counts.TN;
  const imports = evaluation.importTotals;

  const tiles = [
    {
      label: "Agreement with expert review",
      value: percent(evaluation.agreement),
      n: `${evaluation.adjudicated} of ${evaluation.adjudicated + evaluation.pending.alerts + evaluation.pending.silent} variants labelled`,
      establishes: "Whether alerts identify the cases reviewers would want.",
    },
    {
      label: "Missed relevant changes",
      value: silentLabelled > 0 ? String(evaluation.missed) : null,
      n: `${silentLabelled} silent variant${silentLabelled === 1 ? "" : "s"} labelled`,
      establishes: "What the system fails to detect.",
    },
    {
      label: "False or duplicate alerts",
      value:
        evaluation.falseOrDuplicateRate === null
          ? null
          : `${evaluation.falseOrDuplicate} · ${percent(evaluation.falseOrDuplicateRate)}`,
      n: `${alertsLabelled} alert${alertsLabelled === 1 ? "" : "s"} labelled`,
      establishes: "The extra workload alerts create.",
    },
    {
      label: "Review time per case",
      value: evaluation.medianReviewMs === null ? null : formatMinutes(evaluation.medianReviewMs / 60_000),
      n: `Median of ${evaluation.reviewSamples} decided case${evaluation.reviewSamples === 1 ? "" : "s"}`,
      establishes: "Whether the workflow saves effort. Review opened to first decision.",
    },
    {
      label: "Import and matching errors",
      value: imports ? `${imports.rejected} of ${imports.rows}` : null,
      n: imports
        ? `${imports.conflicts} conflicting, ${imports.unmatched} unmatched, ${imports.duplicates} duplicate`
        : "No import reviewed yet",
      establishes: "Whether the data pipeline is reliable. Rows rejected by validation.",
      href: "/onboarding",
    },
  ];

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {tiles.map((tile) => (
        <Card key={tile.label} className="flex flex-col p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-faint">{tile.label}</p>
          <p
            className={cn(
              "mt-2 text-[22px] font-semibold leading-none tracking-tight vp-num",
              tile.value === null ? "text-faint" : "text-ink",
            )}
          >
            {tile.value ?? "Not measured"}
          </p>
          <p className="mt-1.5 text-[11.5px] text-muted vp-num">{tile.n}</p>
          <p className="mt-auto pt-3 text-[11.5px] leading-snug text-ink-2">{tile.establishes}</p>
          {tile.href && !imports ? (
            <Link href={tile.href} className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline">
              Review an import
              <ArrowRight className="h-3 w-3" />
            </Link>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

/* -- Adjudication worklist ------------------------------------------------- */

function Worklist({ alertKeys }: { alertKeys: string[] }) {
  const { analysis, adjudications, adjudicate, loadReferenceSet, can, persona } = useWorkspace();
  const [problems, setProblems] = React.useState<string[]>([]);
  const [loaded, setLoaded] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const canLabel = can("pilot:adjudicate");
  const canLoad = can("pilot:configure");

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const { rows, lines } = parseDelimited(await file.text());
    const [header, ...body] = rows;
    const index = (name: string) => header?.findIndex((cell) => cell.trim().toLowerCase() === name) ?? -1;
    const [variant, expected, reviewer, note] = ["variant", "expected", "reviewer", "note"].map(index);
    if (variant < 0 || expected < 0) {
      setProblems([`The file needs "variant" and "expected" columns (${REFERENCE_SET_HEADER}).`]);
      setLoaded(null);
      return;
    }
    const result = adjudicationsFromReference(
      body.map((cells, index) => ({
        line: lines[index + 1],
        variant: cells[variant] ?? "",
        expected: cells[expected] ?? "",
        reviewer: reviewer >= 0 ? cells[reviewer] : undefined,
        note: note >= 0 ? cells[note] : undefined,
      })),
      alertKeys,
      new Date().toISOString(),
    );
    loadReferenceSet(result.adjudications, file.name);
    setProblems(result.problems);
    setLoaded(`${result.adjudications.length} label${result.adjudications.length === 1 ? "" : "s"} loaded from ${file.name}.`);
  };

  const template = () =>
    download(
      "reference-set-template.csv",
      "text/csv;charset=utf-8",
      [REFERENCE_SET_HEADER, ...MONITORED_VARIANTS.map((v) => `${v.key},,,`)].join("\r\n"),
    );

  const exportLabels = () =>
    download(
      "silent-pilot-adjudications.csv",
      "text/csv;charset=utf-8",
      [
        "variant,variantpulse,label,outcome,reviewer,at,source,note",
        ...analysis.assessments.map((a) => {
          const label = adjudications[a.variant.key];
          return [
            a.variant.key,
            a.caseId ? `alert ${a.caseId} (${a.changeType})` : "no alert",
            label ? ADJUDICATION[label.label].label : "",
            label ? ADJUDICATION[label.label].outcome : "",
            label?.reviewer ?? "",
            label?.at ?? "",
            label?.source ?? "",
            label?.note ?? "",
          ]
            .map(csvCell)
            .join(",");
        }),
      ].join("\r\n"),
    );

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <SectionHeading
          title="Adjudication worklist"
          description="Each alert, and each variant that raised nothing, labelled by an independent reviewer against their own judgement."
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={template}>
            <Download className="h-3.5 w-3.5" />
            Template
          </Button>
          <Button size="sm" onClick={() => fileRef.current?.click()} disabled={!canLoad}>
            <FileUp className="h-3.5 w-3.5" />
            Load reference set
          </Button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
          <Button size="sm" onClick={exportLabels}>
            <Download className="h-3.5 w-3.5" />
            Labels
          </Button>
        </div>
      </div>

      {loaded || problems.length > 0 ? (
        <div className="border-b border-line bg-surface-2 px-5 py-3 text-[12.5px] leading-relaxed">
          {loaded ? <p className="text-ok">{loaded}</p> : null}
          {problems.map((problem) => (
            <p key={problem} className="text-warn">
              {problem}
            </p>
          ))}
        </div>
      ) : null}
      {!canLabel ? (
        <div className="border-b border-line px-5 py-3">
          <RoleNote reason={denial(persona, "pilot:adjudicate")} switchTo="kassim" />
        </div>
      ) : null}

      <ul className="divide-y divide-line">
        {analysis.assessments.map((assessment) => {
          const key = assessment.variant.key;
          const alerted = Boolean(assessment.caseId);
          const current = adjudications[key];
          const options: AdjudicationLabel[] = alerted ? ALERT_LABELS : SILENT_LABELS;
          return (
            <li key={key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
              <div className="min-w-0 flex-1 basis-56">
                <p className="text-[13px] text-ink">
                  <span className="font-semibold">{assessment.variant.gene}</span>{" "}
                  <span className="font-mono text-[11.5px] text-muted">{assessment.variant.hgvsCoding}</span>
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted">
                  {alerted ? (
                    <>
                      <Badge tone="muted">{assessment.caseId}</Badge>
                      <ChangeTypeBadge type={assessment.changeType} />
                    </>
                  ) : (
                    <Badge tone="muted">No alert</Badge>
                  )}
                </p>
              </div>
              <div className="flex min-w-0 flex-col items-start gap-1 sm:items-end">
                <label className="sr-only" htmlFor={`adj-${key}`}>
                  Label for {assessment.variant.gene} {assessment.variant.hgvsCoding}
                </label>
                <select
                  id={`adj-${key}`}
                  value={current?.label ?? ""}
                  disabled={!canLabel}
                  onChange={(event) => adjudicate(key, (event.target.value || null) as AdjudicationLabel | null)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-[12.5px] outline-none transition-colors focus:border-accent-ring disabled:opacity-60",
                    current ? "border-accent-ring bg-accent-soft text-ink" : "border-line bg-surface-2 text-muted",
                  )}
                >
                  <option value="">Not yet labelled</option>
                  {options.map((label) => (
                    <option key={label} value={label} title={ADJUDICATION[label].description}>
                      {ADJUDICATION[label].label}
                    </option>
                  ))}
                </select>
                {current ? (
                  <span className="text-[11px] text-faint">
                    {current.reviewer} · {formatDate(current.at)}
                    {current.source === "reference-set" ? " · reference set" : ""}
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* -- Success criteria ------------------------------------------------------ */

const CRITERION_TONE: Record<CriterionStatus, "muted" | "positive" | "critical"> = {
  "not-agreed": "muted",
  "not-measured": "muted",
  met: "positive",
  "not-met": "critical",
};

const CRITERION_LABEL: Record<CriterionStatus, string> = {
  "not-agreed": "Not agreed",
  "not-measured": "Not measured",
  met: "Met",
  "not-met": "Not met",
};

function Criteria({ evaluation, criteria }: { evaluation: ReturnType<typeof evaluate>; criteria: SuccessCriteria }) {
  const { can, setCriteria, persona } = useWorkspace();
  const [editing, setEditing] = React.useState(false);
  const results = criteriaResults(evaluation, criteria);
  const canEdit = can("pilot:configure");

  return (
    <Card className="p-5">
      <SectionHeading
        title="Success criteria"
        description="Agreed with the partner before the silent run, and unset until then."
        action={
          canEdit && !editing ? (
            <Button size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          ) : undefined
        }
      />
      {editing ? (
        <CriteriaForm
          criteria={criteria}
          onCancel={() => setEditing(false)}
          onSave={(next) => {
            setCriteria(next);
            setEditing(false);
          }}
        />
      ) : (
        <>
          <ul className="mt-4 divide-y divide-line">
            {results.map((result) => (
              <li key={result.key} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 py-2.5">
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-ink">{result.label}</span>
                  <span className="block text-[11.5px] text-muted">
                    Target: {result.target} · Observed: {result.observed}
                  </span>
                </span>
                <Badge tone={CRITERION_TONE[result.status]} dot>
                  {CRITERION_LABEL[result.status]}
                </Badge>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
            {criteria.agreedWith ? `Agreed with ${criteria.agreedWith}.` : "Not yet agreed with a partner."}
          </p>
          {!canEdit ? <RoleNote className="mt-2" reason={denial(persona, "pilot:configure")} switchTo={SERVICE_LEAD.id} /> : null}
        </>
      )}
    </Card>
  );
}

function CriteriaForm({
  criteria,
  onSave,
  onCancel,
}: {
  criteria: SuccessCriteria;
  onSave: (criteria: SuccessCriteria) => void;
  onCancel: () => void;
}) {
  const [agreement, setAgreement] = React.useState(criteria.minAgreement === null ? "" : String(Math.round(criteria.minAgreement * 100)));
  const [missed, setMissed] = React.useState(criteria.maxMissed === null ? "" : String(criteria.maxMissed));
  const [falseRate, setFalseRate] = React.useState(
    criteria.maxFalseOrDuplicateRate === null ? "" : String(Math.round(criteria.maxFalseOrDuplicateRate * 100)),
  );
  const [minutes, setMinutes] = React.useState(criteria.maxMedianReviewMinutes === null ? "" : String(criteria.maxMedianReviewMinutes));
  const [agreedWith, setAgreedWith] = React.useState(criteria.agreedWith ?? "");

  const num = (value: string, max?: number) => {
    const n = Number(value);
    return value.trim() === "" || !Number.isFinite(n) || n < 0 || (max !== undefined && n > max) ? null : n;
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const a = num(agreement, 100);
    const f = num(falseRate, 100);
    onSave({
      minAgreement: a === null ? null : a / 100,
      maxMissed: num(missed),
      maxFalseOrDuplicateRate: f === null ? null : f / 100,
      maxMedianReviewMinutes: num(minutes),
      agreedWith: agreedWith.trim() || null,
    });
  };

  const field = (id: string, label: string, value: string, set: (v: string) => void, suffix: string) => (
    <label htmlFor={id} className="block">
      <span className="text-[11px] font-medium uppercase tracking-[0.07em] text-faint">{label}</span>
      <span className="mt-1.5 flex items-center gap-2">
        <input
          id={id}
          inputMode="numeric"
          value={value}
          onChange={(event) => set(event.target.value)}
          placeholder="Not agreed"
          className="w-28 rounded-xl border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink outline-none focus:border-accent-ring focus:bg-surface"
        />
        <span className="text-[12px] text-muted">{suffix}</span>
      </span>
    </label>
  );

  return (
    <form onSubmit={save} className="mt-4 space-y-3">
      {field("crit-agreement", "Agreement with expert review, at least", agreement, setAgreement, "%")}
      {field("crit-missed", "Missed relevant changes, at most", missed, setMissed, "variants")}
      {field("crit-false", "False or duplicate alerts, at most", falseRate, setFalseRate, "% of alerts")}
      {field("crit-minutes", "Median review time, at most", minutes, setMinutes, "minutes")}
      <label htmlFor="crit-agreed" className="block">
        <span className="text-[11px] font-medium uppercase tracking-[0.07em] text-faint">Agreed with</span>
        <input
          id="crit-agreed"
          value={agreedWith}
          onChange={(event) => setAgreedWith(event.target.value)}
          placeholder="The partner's clinical sponsor, and when"
          className="mt-1.5 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink outline-none focus:border-accent-ring focus:bg-surface"
        />
      </label>
      <div className="flex gap-2 pt-1">
        <Button type="submit" variant="primary" size="sm">
          Save criteria
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <p className="text-[11.5px] leading-relaxed text-faint">Leave a field empty until it has been agreed.</p>
    </form>
  );
}

/* -- Protocol and walkthrough ---------------------------------------------- */

const PROTOCOL = [
  "Agree one clinical use case, and these success criteria, with the partner's clinical sponsor.",
  "Load de-identified historical results through the validated import, and review the import report.",
  "An independent panel labels a reference set, blind to what VariantPulse raised.",
  "Run silently: no notification, no change to a record, no export.",
  "Compare against the reference set, and measure review time and import quality from the run itself.",
  "Report the results with their limitations before any live use is considered.",
];

function Protocol() {
  return (
    <Card className="p-5">
      <SectionHeading title="Evaluation protocol" description="How a partner could evaluate VariantPulse, step by step." />
      <ol className="mt-4 space-y-2.5">
        {PROTOCOL.map((step, index) => (
          <li key={step} className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[11.5px] font-semibold text-accent vp-num">
              {index + 1}
            </span>
            <span className="text-[13px] leading-relaxed text-ink-2">{step}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function Walkthrough() {
  const { analysis } = useWorkspace();
  const lead = analysis.assessments.find((a) => a.variant.key === "BRCA1:c.5056C>T" && a.caseId);
  const patient = lead?.impactedPatients[0];

  const steps = [
    { title: "The historical result", detail: `${patient?.id ?? "A synthetic patient"}, reported in 2023 as uncertain significance.`, href: patient ? `/patients/${patient.id}` : "/patients" },
    { title: "New evidence and the matched records", detail: "What changed, and how every record carrying it was found.", href: lead ? `/review/${lead.caseId}` : "/review" },
    { title: "A named owner and a documented decision", detail: "Take ownership, open the review and record the decision with its rationale.", href: lead ? `/review/${lead.caseId}#case-actions` : "/review" },
    { title: "Approved follow-up, then a closed case", detail: `Sign in as ${SERVICE_LEAD.name} to approve, then close with a note.`, href: lead ? `/review/${lead.caseId}#case-actions` : "/review" },
    { title: "How a partner evaluates it", detail: "Switch on silent mode, label alerts, and read the metrics above.", href: "/pilot" },
    { title: "Onboarding, oversight and governance", detail: "A validated import, the sponsor's view, and the deployment package.", href: "/onboarding" },
  ];

  return (
    <Card className="mt-5 p-5">
      <SectionHeading
        title="Partner walkthrough"
        description="One synthetic patient, from historical result to documented review, then how a partner would evaluate it."
      />
      <ol className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title}>
            <Link
              href={step.href}
              className="flex h-full gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-accent-ring hover:bg-accent-soft/30"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-[12.5px] font-semibold text-accent vp-num">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold text-ink">{step.title}</span>
                <span className="mt-1 block text-[12.5px] leading-relaxed text-muted">{step.detail}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}
