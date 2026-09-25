"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  ClipboardList,
  Clock,
  Database,
  Dna,
  FileSearch,
  FileText,
  Globe2,
  History,
  Shield,
  ShieldCheck,
  Users,
} from "lucide-react";

import { HeroHelix } from "@/components/hero-helix";
import { ImpactPanel } from "@/components/impact-panel";
import { evidenceModeMeta } from "@/components/story/mode";
import { SyncButton } from "@/components/sync";
import { Badge, Card, EmptyState, StatusDot } from "@/components/ui";
import { REGIONAL_SOURCE } from "@/data/regional";
import type { VariantAssessment } from "@/lib/analysis";
import { meta, type ClassificationCode, type Tone } from "@/lib/classification";
import { pick } from "@/lib/dto";
import { selectStoryAssessment } from "@/lib/story";
import { cn, formatDate } from "@/lib/utils";
import { useWorkspace } from "@/state/workspace";

export default function HomePage() {
  const { analysis, scanMs } = useWorkspace();
  // The headline change the story tests pin down, else the top-ranked case, so
  // the page always shows a change the dataset really holds.
  const lead =
    selectStoryAssessment(analysis.assessments) ?? pick(analysis, analysis.reviewableKeys)[0];

  return (
    <div className="mx-auto w-full max-w-[1360px] space-y-3.5 px-5 pb-3 pt-2 sm:px-6 lg:px-8">
      <Hero lead={lead} />

      <ImpactPanel
        findingsChecked={analysis.scan.findingsChecked}
        casesSurfaced={analysis.metrics.evidenceChanges}
        scanMs={scanMs}
      />

      {lead ? (
        <>
          <HowItWorks lead={lead} />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.72fr)_minmax(0,1fr)]">
            <RealExample lead={lead} />
            <DataSources mode={analysis.mode} />
          </div>
        </>
      ) : (
        <Card>
          <EmptyState
            icon={<ShieldCheck className="h-5 w-5" />}
            title="No evidence changes right now"
            description="Every result on record still matches current evidence."
          />
        </Card>
      )}

      <Card className="flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap sm:px-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1 basis-60">
          <p className="text-[14px] font-semibold text-ink">AI assists. Clinicians decide.</p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
            VariantPulse highlights changes in scientific evidence to support clinical teams. It does
            not alter patient records and does not make a diagnosis.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-line-2 bg-surface px-3.5 py-2 text-[13px] font-medium text-ink-2">
          <Shield className="h-4 w-4 text-muted" />
          Not a diagnosis
        </span>
      </Card>
    </div>
  );
}

/* -- Hero ------------------------------------------------------------------ */

function Hero({ lead }: { lead: VariantAssessment | undefined }) {
  return (
    <section className="grid items-center gap-5 md:grid-cols-[minmax(0,1fr)_240px] min-[86.25rem]:grid-cols-[minmax(0,1fr)_250px_330px]">
      <div className="py-2">
        <h1 className="text-[34px] font-semibold leading-[1.05] tracking-[-0.035em] text-ink sm:text-[42px] min-[86.25rem]:text-[46px]">
          The same DNA.
          <span className="block text-accent">A different meaning.</span>
        </h1>
        <p className="mt-3 max-w-[30rem] text-[15px] leading-relaxed text-muted">
          VariantPulse watches old genetic test results and flags when new scientific evidence
          changes what they mean.
        </p>
      </div>

      <HeroHelix className="hidden h-[184px] w-full md:block" />

      {/* Narrower screens show this card at the foot of the sidebar instead. */}
      <Link
        href={lead ? `/variants/${encodeURIComponent(lead.variant.key)}` : "/variants"}
        className="group hidden rounded-[20px] border border-accent-ring/60 bg-gradient-to-br from-accent-soft to-surface p-5 transition-shadow hover:shadow-[0_14px_34px_-22px_rgba(120,20,50,0.45)] min-[86.25rem]:block"
      >
        <span className="flex items-start gap-3.5">
          <Dna className="h-10 w-10 shrink-0 text-accent/70" strokeWidth={1.3} />
          <span className="min-w-0 flex-1 text-[15.5px] font-semibold leading-snug tracking-tight text-ink">
            Your DNA didn&rsquo;t change.
            <span className="block text-[19px] text-accent">Science did.</span>
          </span>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface text-accent shadow-[0_1px_3px_rgba(18,19,26,0.12)] transition-transform group-hover:translate-x-0.5">
            <ArrowRight className="h-4 w-4" />
          </span>
        </span>
        <span className="mt-3.5 block text-[12.5px] leading-relaxed text-muted">
          We monitor scientific evidence so patients can benefit from new knowledge.
        </span>
      </Link>
    </section>
  );
}

/* -- How it works ---------------------------------------------------------- */

function HowItWorks({ lead }: { lead: VariantAssessment }) {
  const { variant, recordedCode, currentCode, impactedRecordCount, caseId } = lead;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle
          inline
          title="How it works"
          subtitle="From new scientific evidence to a clinical review, automatically."
        />
        <SyncButton size="sm" />
      </div>

      <ol className="mt-3.5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:gap-7">
        <Step number={1} title="Historical result" when={recordedWhen(lead)}>
          <StepIcon tone="muted">
            <FileText className="h-5 w-5" />
          </StepIcon>
          <VariantAndCode gene={variant.gene} hgvs={variant.hgvsCoding} code={recordedCode} />
        </Step>

        <Step number={2} title="New evidence detected" when={currentWhen(lead)}>
          <StepIcon>
            <FileSearch className="h-5 w-5" />
          </StepIcon>
          <VariantAndCode gene={variant.gene} hgvs={variant.hgvsCoding} code={currentCode} />
        </Step>

        <Step number={3} title="Patient impact">
          <StepIcon round>
            <Users className="h-5 w-5" />
          </StepIcon>
          <span className="min-w-0">
            <span className="block text-[24px] font-semibold leading-none text-accent vp-num">
              {impactedRecordCount}
            </span>
            <span className="mt-1 block text-[12.5px] leading-snug text-muted">
              affected patient record{impactedRecordCount === 1 ? "" : "s"} identified
            </span>
          </span>
        </Step>

        <Step number={4} title="Clinical review" href={caseId ? `/review/${caseId}` : "/review"} last>
          <StepIcon>
            <ClipboardList className="h-5 w-5" />
          </StepIcon>
          <span className="text-[12.5px] leading-snug text-muted">
            Review case opened for the care team
          </span>
        </Step>
      </ol>
    </Card>
  );
}

function Step({
  number,
  title,
  when,
  href,
  last = false,
  children,
}: {
  number: number;
  title: string;
  when?: string;
  href?: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  const body = (
    <>
      <span className="flex items-start gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent vp-num">
          {number}
        </span>
        <span className="min-w-0">
          <span className="block text-[13.5px] font-semibold leading-tight text-ink">{title}</span>
          {when ? <span className="mt-0.5 block text-[12px] text-muted vp-num">{when}</span> : null}
        </span>
      </span>
      <span className="mt-3 flex items-center gap-3">{children}</span>
    </>
  );

  return (
    <li className="relative">
      {href ? (
        <Link
          href={href}
          className="block h-full rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-accent-ring hover:bg-accent-soft/30"
        >
          {body}
        </Link>
      ) : (
        <div className="h-full rounded-2xl border border-line bg-surface p-4">{body}</div>
      )}
      {!last ? (
        <ArrowRight
          aria-hidden
          className="absolute -right-[22px] top-1/2 hidden h-4 w-4 -translate-y-1/2 text-accent xl:block"
        />
      ) : null}
    </li>
  );
}

function StepIcon({
  tone = "accent",
  round = false,
  children,
}: {
  tone?: "accent" | "muted";
  round?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "grid h-11 w-11 shrink-0 place-items-center",
        round ? "rounded-full" : "rounded-xl",
        tone === "accent" ? "bg-accent-soft text-accent" : "bg-surface-3 text-muted",
      )}
    >
      {children}
    </span>
  );
}

function VariantAndCode({ gene, hgvs, code }: { gene: string; hgvs: string; code: ClassificationCode }) {
  return (
    <span className="min-w-0">
      <span className="block truncate text-[13px] text-ink">
        <span className="font-semibold">{gene}</span> {hgvs}
      </span>
      <ClassificationPill code={code} className="mt-1.5" />
    </span>
  );
}

/* -- Real example ---------------------------------------------------------- */

function RealExample({ lead }: { lead: VariantAssessment }) {
  const { variant, recordedCode, currentCode, evidence } = lead;

  return (
    <Card className="flex flex-col p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle
          title="Real example"
          subtitle={`${variant.gene} ${variant.hgvsCoding}: the same DNA, a different meaning.`}
        />
        {evidence.lastEvaluated ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[12px] text-muted">
            <Clock className="h-3.5 w-3.5" />
            Evidence updated {formatDate(evidence.lastEvaluated)}
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid flex-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <ExamplePanel
          label="Then"
          when={recordedWhen(lead)}
          assessment={lead}
          code={recordedCode}
          note={`Reported ${formatDate(variant.recordedOn)}`}
        />
        <div className="flex items-center justify-center gap-2 sm:flex-col sm:px-1">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-line-2 bg-surface text-ink-2">
            <ArrowRight className="h-4 w-4 rotate-90 sm:rotate-0" />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted sm:text-center">
            Science
            <br className="hidden sm:block" /> changed
          </span>
        </div>
        <ExamplePanel
          label="Now"
          when={currentWhen(lead)}
          assessment={lead}
          code={currentCode}
          note={lead.confidence.label}
          current
        />
      </div>
    </Card>
  );
}

function ExamplePanel({
  label,
  when,
  assessment,
  code,
  note,
  current = false,
}: {
  label: string;
  when: string;
  assessment: VariantAssessment;
  code: ClassificationCode;
  note: string;
  current?: boolean;
}) {
  const { gene, hgvsCoding, proteinChange } = assessment.variant;
  return (
    <div
      className={cn(
        "flex flex-col items-start rounded-2xl border p-4",
        current ? "border-accent-ring/70 bg-accent-soft/60" : "border-line bg-surface-2",
      )}
    >
      <p className="flex items-baseline gap-2">
        <span
          className={cn(
            "text-[12px] font-bold uppercase tracking-[0.08em]",
            current ? "text-accent" : "text-ink",
          )}
        >
          {label}
        </span>
        {when ? <span className="text-[12px] text-muted vp-num">{when}</span> : null}
      </p>
      <p className="mt-2.5 text-[14px] leading-snug text-ink">
        <span className="font-semibold">{gene}</span>{" "}
        <span className="text-ink-2">
          {hgvsCoding}
          {proteinChange ? ` (${proteinChange})` : ""}
        </span>
      </p>
      <ClassificationPill code={code} className="mt-2.5" />
      <p className="mt-auto pt-2.5 text-[12px] text-muted">{note}</p>
    </div>
  );
}

/* -- Data sources ---------------------------------------------------------- */

function DataSources({ mode }: { mode: string }) {
  const clinvar = evidenceModeMeta(mode);
  const clinvarName =
    clinvar.mode === "live"
      ? "Live ClinVar evidence"
      : clinvar.mode === "demo"
        ? "ClinVar demo snapshot"
        : "Cached ClinVar evidence";

  return (
    <Card className="p-5">
      <SectionTitle title="Our data sources" subtitle="Trusted, complementary evidence." />
      <ul className="mt-4 space-y-2">
        <SourceRow
          icon={<Database className="h-[18px] w-[18px]" />}
          tile="bg-ok-soft text-ok"
          name={clinvarName}
          description="Current classifications"
          status={clinvar.label}
          tone={clinvar.tone}
          pulse={clinvar.pulse}
        />
        <SourceRow
          icon={<History className="h-[18px] w-[18px]" />}
          tile="bg-accent-soft text-accent"
          name="Jan 2023 snapshot"
          description="Classification history"
          status="Archived release"
        />
        <SourceRow
          icon={<Globe2 className="h-[18px] w-[18px]" />}
          tile="bg-warn-soft text-warn"
          name={REGIONAL_SOURCE.name}
          description="gnomAD v4, Middle Eastern"
          status="Modelled"
        />
        <SourceRow
          icon={<Building2 className="h-[18px] w-[18px]" />}
          tile="bg-info-soft text-info"
          name="Synthetic hospital records"
          description="Demonstration data"
          status="Synthetic"
        />
      </ul>
    </Card>
  );
}

function SourceRow({
  icon,
  tile,
  name,
  description,
  status,
  tone = "muted",
  pulse = false,
}: {
  icon: React.ReactNode;
  tile: string;
  name: string;
  description: string;
  status: string;
  tone?: Tone;
  pulse?: boolean;
}) {
  return (
    <li className="flex items-center gap-3">
      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", tile)}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-ink">{name}</span>
        <span className="block truncate text-[12px] text-muted">{description}</span>
      </span>
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 text-[12px]",
          tone === "positive" && "font-medium text-ok",
          tone === "warning" && "font-medium text-warn",
          tone === "neutral" && "font-medium text-info",
          tone === "critical" && "font-medium text-crit",
          tone === "muted" && "text-muted",
        )}
      >
        <StatusDot tone={tone} pulse={pulse} />
        {status}
      </span>
    </li>
  );
}

/* -- Shared pieces --------------------------------------------------------- */

function SectionTitle({
  title,
  subtitle,
  inline = false,
}: {
  title: string;
  subtitle: string;
  inline?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span aria-hidden className="mt-[3px] h-[18px] w-[3px] shrink-0 rounded-full bg-accent" />
      <div className={cn("min-w-0", inline && "flex flex-wrap items-baseline gap-x-3 gap-y-0.5")}>
        <h2 className="text-[16.5px] font-semibold tracking-tight text-ink">{title}</h2>
        <p className={cn("text-[12.5px] text-muted", !inline && "mt-0.5")}>{subtitle}</p>
      </div>
    </div>
  );
}

function ClassificationPill({ code, className }: { code: ClassificationCode; className?: string }) {
  const info = meta(code);
  return (
    <Badge
      tone={info.tone}
      title={info.label}
      className={cn("px-3 py-1.5 text-[12.5px] font-semibold", className)}
    >
      {info.short}
    </Badge>
  );
}

const MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

/** `2023-03-14` as `Mar 2023`. */
function monthLabel(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? "" : MONTH.format(date);
}

/** When the result on file was reported. */
function recordedWhen(assessment: VariantAssessment): string {
  return monthLabel(assessment.variant.recordedOn);
}

/**
 * When ClinVar last evaluated today's reading. Left blank when that predates the
 * report, where a date would read as time running backwards.
 */
function currentWhen(assessment: VariantAssessment): string {
  const evaluated = assessment.evidence.lastEvaluated;
  return evaluated && evaluated.slice(0, 7) >= assessment.variant.recordedOn.slice(0, 7)
    ? monthLabel(evaluated)
    : "";
}
