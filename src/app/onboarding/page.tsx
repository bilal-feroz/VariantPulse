"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  FileUp,
  Info,
} from "lucide-react";

import { PageHeader, PageShell } from "@/components/page-header";
import { Badge, Button, Card, ChangeTypeBadge, ClassificationBadge, EmptyState, SectionHeading } from "@/components/ui";
import { RoleNote } from "@/components/workflow/role-note";
import { SAMPLE_CSV, SAMPLE_FILE_NAME } from "@/data/onboarding-sample";
import { meta } from "@/lib/classification";
import {
  IMPORT_COLUMNS,
  MAX_ROWS,
  importImpact,
  importTemplate,
  reportCsv,
  validateImport,
  type ImportReport,
  type ImportRow,
  type RowStatus,
  type Severity,
} from "@/lib/onboarding";
import { denial } from "@/lib/roles";
import { cn, formatDate } from "@/lib/utils";
import { useWorkspace } from "@/state/workspace";

type Filter = "all" | RowStatus;

const STATUS: Record<RowStatus, { label: string; tone: "positive" | "warning" | "critical" }> = {
  accepted: { label: "Accepted", tone: "positive" },
  warnings: { label: "Accepted with warnings", tone: "warning" },
  rejected: { label: "Rejected", tone: "critical" },
};

const SEVERITY_ICON: Record<Severity, React.ComponentType<{ className?: string }>> = {
  error: CircleX,
  warning: CircleAlert,
  info: Info,
};

const SEVERITY_TEXT: Record<Severity, string> = {
  error: "text-crit",
  warning: "text-warn",
  info: "text-muted",
};

function download(name: string, type: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

// The reader's own calendar day: a report dated today is not in the future anywhere it is read.
const today = () => new Date().toLocaleDateString("en-CA");

export default function OnboardingPage() {
  const { analysis, recordImport, persona, lastImport } = useWorkspace();
  const [report, setReport] = React.useState<ImportReport | null>(null);
  const [pasted, setPasted] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [recorded, setRecorded] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const run = (text: string, fileName: string | null) => {
    setReport(validateImport(text, { fileName, today: today() }));
    setFilter("all");
    setRecorded(false);
  };

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) run(await file.text(), file.name);
  };

  const impact = React.useMemo(
    () => (report ? importImpact(report, analysis.assessments) : []),
    [report, analysis],
  );

  const importDenied = denial(persona, "data:import");

  return (
    <PageShell>
      <PageHeader
        eyebrow="Data onboarding"
        title="Validate historical results before they are accepted"
        description="A structured file of historical genetic results, checked row by row. Nothing is accepted silently: every row is accepted, accepted with warnings, or rejected, with the field and the reason."
        actions={
          <>
            <Button size="sm" onClick={() => download("variantpulse-import-template.csv", "text/csv;charset=utf-8", importTemplate())}>
              <Download className="h-3.5 w-3.5" />
              Template
            </Button>
            <Button size="sm" variant="primary" onClick={() => run(SAMPLE_CSV, SAMPLE_FILE_NAME)}>
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Load sample file
            </Button>
          </>
        }
      />

      <Card className="p-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <SectionHeading
              title="Check a file"
              description={`CSV or tab-separated, with the template's columns; common hospital header names are recognised. Up to ${MAX_ROWS.toLocaleString("en-US")} rows.`}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-4 flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line-2 bg-surface-2 px-6 py-8 text-center transition-colors hover:border-accent-ring hover:bg-accent-soft/30"
            >
              <FileUp className="h-6 w-6 text-accent" />
              <span className="text-[13.5px] font-medium text-ink">Choose a file to validate</span>
              <span className="text-[12px] text-muted">Read in this browser. Nothing is uploaded.</span>
            </button>
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv" className="hidden" onChange={onFile} />
          </div>
          <div>
            <label htmlFor="paste" className="text-[11px] font-medium uppercase tracking-[0.07em] text-faint">
              Or paste rows, header first
            </label>
            <textarea
              id="paste"
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
              rows={7}
              spellCheck={false}
              placeholder={IMPORT_COLUMNS.map((c) => c.key).join(",")}
              className="mt-2 w-full resize-y rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 font-mono text-[12px] leading-relaxed text-ink outline-none transition-colors placeholder:text-faint focus:border-accent-ring focus:bg-surface"
            />
            <Button size="sm" className="mt-2" disabled={!pasted.trim()} onClick={() => run(pasted, "Pasted rows")}>
              Validate pasted rows
            </Button>
          </div>
        </div>
      </Card>

      {report ? (
        <Report
          report={report}
          filter={filter}
          setFilter={setFilter}
          impact={impact}
          recorded={recorded}
          onRecord={() => {
            recordImport({ fileName: report.fileName, totals: report.totals });
            setRecorded(true);
          }}
          importDenied={importDenied}
        />
      ) : (
        <Card className="mt-5">
          <EmptyState
            icon={<ClipboardCheck className="h-5 w-5" />}
            title="No file checked yet"
            description="Load the sample file to see a full report. It is a synthetic partner extract with one seeded problem per row."
            action={
              <Button variant="primary" size="sm" onClick={() => run(SAMPLE_CSV, SAMPLE_FILE_NAME)}>
                Load sample file
              </Button>
            }
          />
          {lastImport ? (
            <p className="border-t border-line px-5 py-3 text-center text-[12px] text-muted">
              Last review recorded: {lastImport.fileName ?? "a file"} by {lastImport.by}, {formatDate(lastImport.at)}.
            </p>
          ) : null}
        </Card>
      )}

      <Columns />

      <Card className="mt-5 p-5">
        <SectionHeading title="From file import to integration" />
        <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-ink-2">
          A validated structured-file import is the first step, because it works with any laboratory or record
          system and shows its problems plainly. The integration a partner actually needs comes next, scoped to
          their workflow and tested against their systems. VariantPulse already exports a reviewed case as a FHIR
          R4 bundle, covered by automated tests; it has not yet been exercised against a partner&rsquo;s FHIR server.
        </p>
        <Link href="/sources" className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-accent hover:underline">
          Integration readiness
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Card>
    </PageShell>
  );
}

function Report({
  report,
  filter,
  setFilter,
  impact,
  recorded,
  onRecord,
  importDenied,
}: {
  report: ImportReport;
  filter: Filter;
  setFilter: (filter: Filter) => void;
  impact: ReturnType<typeof importImpact>;
  recorded: boolean;
  onRecord: () => void;
  importDenied: string | null;
}) {
  const { totals } = report;
  const rows = filter === "all" ? report.rows : report.rows.filter((row) => row.status === filter);
  const unreadable = report.fileErrors.length > 0;

  const tiles = [
    { label: "Rows read", value: totals.rows, tone: "text-ink" },
    { label: "Accepted", value: totals.accepted, tone: "text-ok" },
    { label: "With warnings", value: totals.withWarnings, tone: "text-warn" },
    { label: "Rejected", value: totals.rejected, tone: "text-crit" },
    { label: "Matched to the panel", value: totals.matched, tone: "text-ink" },
    { label: "Not monitored", value: totals.unmatched, tone: "text-ink" },
    { label: "Identifiers disagree", value: totals.conflicts, tone: "text-ink" },
    { label: "Duplicates", value: totals.duplicates, tone: "text-ink" },
    { label: "GRCh37 rows", value: totals.grch37, tone: "text-ink" },
  ];

  return (
    <>
      <Card className="mt-5 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <SectionHeading
            title="Import report"
            description={`${report.fileName ?? "File"} · ${report.delimiter === "\t" ? "tab" : report.delimiter === ";" ? "semicolon" : "comma"}-separated`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={unreadable}
              onClick={() => download(`${(report.fileName ?? "import").replace(/\.[^.]+$/, "")}-report.csv`, "text/csv;charset=utf-8", reportCsv(report))}
            >
              <Download className="h-3.5 w-3.5" />
              Report CSV
            </Button>
            <Button size="sm" variant="primary" disabled={unreadable || recorded || Boolean(importDenied)} onClick={onRecord}>
              <CircleCheck className="h-3.5 w-3.5" />
              {recorded ? "Review recorded" : "Record review in audit trail"}
            </Button>
          </div>
        </div>
        {importDenied ? (
          <div className="border-b border-line px-5 py-3">
            <RoleNote reason={importDenied} switchTo="mansour" />
          </div>
        ) : null}

        {unreadable ? (
          <div className="px-5 py-4">
            {report.fileErrors.map((error) => (
              <p key={error} className="flex items-start gap-2 text-[13px] text-crit">
                <CircleX className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            ))}
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-2 divide-line border-b border-line sm:grid-cols-3 lg:grid-cols-9 lg:divide-x">
              {tiles.map((tile) => (
                <div key={tile.label} className="px-4 py-3">
                  <dt className="text-[10.5px] font-medium uppercase tracking-[0.07em] text-faint">{tile.label}</dt>
                  <dd className={cn("mt-1 text-[20px] font-semibold leading-none vp-num", tile.tone)}>{tile.value}</dd>
                </div>
              ))}
            </dl>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-3">
              <span className="text-[11px] font-medium uppercase tracking-[0.07em] text-faint">Columns read</span>
              {Object.entries(report.columns.mapped).map(([key, header]) => (
                <Badge key={key} tone="muted" title={`Read "${header}" as ${key}`}>
                  {header === key ? key : `${header} → ${key}`}
                </Badge>
              ))}
              {report.fileNotes.map((note) => (
                <span key={note} className="text-[12px] text-muted">
                  {note}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1 border-b border-line bg-surface-2 px-4 py-2.5" role="tablist" aria-label="Filter rows">
              {(
                [
                  ["all", `All ${totals.rows}`],
                  ["rejected", `Rejected ${totals.rejected}`],
                  ["warnings", `Warnings ${totals.withWarnings}`],
                  ["accepted", `Accepted ${totals.accepted}`],
                ] as [Filter, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={filter === id}
                  onClick={() => setFilter(id)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                    filter === id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line">
                    {["Line", "Record", "Variant", "Reported", "Date", "Build", "Match", "Outcome and reasons"].map((heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className="whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-faint"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <RowView key={row.line} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {!unreadable ? (
        <Card className="mt-5 p-5">
          <SectionHeading
            title="What the accepted rows would join"
            description="Accepted rows that match a monitored variant, compared on the classification each row reports against the evidence today. A preview: nothing is added to the workspace."
          />
          {impact.length === 0 ? (
            <p className="mt-3 text-[12.5px] text-muted">No accepted row matches a monitored variant.</p>
          ) : (
            <ul className="mt-4 grid gap-3 lg:grid-cols-2">
              {impact.map((group) => (
                <li key={group.variantKey} className="rounded-2xl border border-line bg-surface-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13.5px] text-ink">
                      <span className="font-semibold">{group.gene}</span>{" "}
                      <span className="font-mono text-[12px] text-muted">{group.hgvs}</span>
                    </p>
                    {group.caseId ? (
                      <Link href={`/review/${group.caseId}`} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent hover:underline">
                        Joins {group.caseId}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    ) : (
                      <Badge tone="muted">No case open</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-[12px] text-muted">
                    ClinVar today: {meta(group.currentCode).label}
                  </p>
                  <ul className="mt-2.5 space-y-1.5">
                    {group.rows.map((row) => (
                      <li key={row.line} className="flex flex-wrap items-center gap-2 text-[12.5px]">
                        <span className="font-mono font-medium text-ink">{row.recordId}</span>
                        <ClassificationBadge code={row.reported} />
                        <ArrowRight className="h-3 w-3 text-faint" aria-hidden />
                        <ChangeTypeBadge type={row.change} />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 border-t border-line pt-3.5 text-[11.5px] leading-relaxed text-faint">
            In a pilot, accepted rows enter the monitored corpus only after the data steward signs the report off,
            and rows for variants not yet monitored wait until the panel is extended.
          </p>
        </Card>
      ) : null}
    </>
  );
}

function RowView({ row }: { row: ImportRow }) {
  const status = STATUS[row.status];
  return (
    <tr className="border-b border-line align-top last:border-0">
      <td className="px-4 py-3 text-[12.5px] text-muted vp-num">{row.line}</td>
      <td className="whitespace-nowrap px-4 py-3 font-mono text-[12.5px] text-ink">{row.recordId || <span className="text-faint">Missing</span>}</td>
      <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-ink">
        {row.gene ? <span className="font-semibold">{row.gene}</span> : null}{" "}
        <span className="font-mono text-[11.5px] text-muted">{row.hgvs || "Unreadable"}</span>
        {row.transcript ? <span className="block font-mono text-[11px] text-faint">{row.transcript}</span> : null}
      </td>
      <td className="px-4 py-3">{row.classification ? <ClassificationBadge code={row.classification} /> : <span className="text-[12px] text-faint">Not read</span>}</td>
      <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-ink-2 vp-num">{row.reportDate ? formatDate(row.reportDate) : <span className="text-faint">Not read</span>}</td>
      <td className="px-4 py-3 text-[12.5px] text-ink-2">{row.build ?? <span className="text-faint">Not read</span>}</td>
      <td className="px-4 py-3">
        <Badge
          tone={
            row.match.status === "conflict"
              ? "critical"
              : row.match.status === "matched" && row.status !== "rejected"
                ? "positive"
                : "muted"
          }
        >
          {row.match.status === "matched" ? "Matched" : row.match.status === "conflict" ? "Conflict" : row.match.status === "unmatched" ? "Not monitored" : "Not checked"}
        </Badge>
        {row.match.basis ? <span className="mt-1 block text-[11px] text-faint">{row.match.basis}</span> : null}
      </td>
      <td className="min-w-[320px] px-4 py-3">
        <Badge tone={status.tone} dot>
          {status.label}
        </Badge>
        {row.issues.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {row.issues.map((issue, index) => {
              const Icon = SEVERITY_ICON[issue.severity];
              return (
                <li key={index} className="flex items-start gap-1.5 text-[12px] leading-snug">
                  <Icon className={cn("mt-px h-3.5 w-3.5 shrink-0", SEVERITY_TEXT[issue.severity])} aria-hidden />
                  <span className="text-ink-2">
                    <span className="sr-only">{issue.severity}: </span>
                    {issue.message}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </td>
    </tr>
  );
}

function Columns() {
  return (
    <Card className="mt-5 overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <SectionHeading
          title="Template columns"
          description="What each column holds, whether it is required, and the other header names read as the same field."
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-surface-2">
              {["Column", "Required", "Holds", "Example", "Also read from"].map((heading) => (
                <th key={heading} scope="col" className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-faint">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {IMPORT_COLUMNS.map((column) => (
              <tr key={column.key} className="border-b border-line last:border-0 align-top">
                <th scope="row" className="whitespace-nowrap px-4 py-2.5 font-mono text-[12px] font-medium text-ink">
                  {column.key}
                </th>
                <td className="px-4 py-2.5 text-[12.5px]">{column.required ? <Badge tone="warning">Required</Badge> : <span className="text-muted">Optional</span>}</td>
                <td className="px-4 py-2.5 text-[12.5px] leading-relaxed text-ink-2">{column.description}</td>
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[12px] text-muted">{column.example}</td>
                <td className="px-4 py-2.5 font-mono text-[11.5px] leading-relaxed text-faint">{column.aliases.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
