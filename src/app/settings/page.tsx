"use client";

import {
  Building2,
  ClipboardList,
  Database,
  GitCompareArrows,
  Globe2,
  Microscope,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
  Workflow,
} from "lucide-react";

import { PageHeader, PageShell } from "@/components/page-header";
import { Badge, Card, Field, SectionHeading } from "@/components/ui";
import { CURRENT_USER, PATIENTS } from "@/data/workspace";
import { cn, formatNumber } from "@/lib/utils";
import { useWorkspace } from "@/state/workspace";
import { RelativeTime } from "@/components/relative-time";

const STAGES = [
  {
    icon: Building2,
    title: "Record system",
    detail: "Historical genomic findings, read-only.",
    tone: "muted" as const,
  },
  {
    icon: GitCompareArrows,
    title: "Variant normaliser",
    detail: "HGVS resolved to stable identifiers and a single internal key.",
    tone: "muted" as const,
  },
  {
    icon: Database,
    title: "Evidence sources",
    detail: "Live ClinVar, its January 2023 release, gnomAD v4, CTGA and PubMed.",
    tone: "accent" as const,
  },
  {
    icon: Workflow,
    title: "Diff engine",
    detail: "Deterministic band comparison. No model involved.",
    tone: "accent" as const,
  },
  {
    icon: Users,
    title: "Impact mapper",
    detail: "Finds every record carrying a changed variant.",
    tone: "accent" as const,
  },
  {
    icon: Sparkles,
    title: "Evidence intelligence",
    detail: "Composes the brief from the cited records.",
    tone: "accent" as const,
  },
  {
    icon: ClipboardList,
    title: "Review queue",
    detail: "Prioritised cases with full reasoning attached.",
    tone: "accent" as const,
  },
  {
    icon: Stethoscope,
    title: "Human decision",
    detail: "A clinician decides. Nothing is written automatically.",
    tone: "ok" as const,
  },
];

const AGENTS = [
  {
    name: "Evidence",
    icon: Microscope,
    role: "Reads current classifications and summarises what the sources state.",
  },
  {
    name: "Regional",
    icon: Globe2,
    role: "Compares Middle Eastern frequencies and regional catalogue records with the global reading.",
  },
  {
    name: "Impact",
    icon: Users,
    role: "Maps a changed variant back onto the historical records that carry it.",
  },
  {
    name: "Briefing",
    icon: ClipboardList,
    role: "Assembles a clinician-ready brief with its citations attached.",
  },
];

export default function SettingsPage() {
  const { analysis, sync } = useWorkspace();
  const lastChecked = sync.phase === "done" ? sync.at : analysis.checkedAt;

  return (
    <PageShell>
      <PageHeader
        eyebrow="About this workspace"
        title="Settings"
        description="How VariantPulse is put together, what it is allowed to do, and what it deliberately does not do."
      />

      <Card className="mb-5 p-5">
        <SectionHeading title="Signed in" />
        <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Name" value={CURRENT_USER.name} />
          <Field label="Role" value={CURRENT_USER.role} />
          <Field label="Department" value={CURRENT_USER.department} />
          <Field label="Organisation" value={CURRENT_USER.organisation} />
        </dl>
      </Card>

      {/* ── Architecture ──────────────────────────────────────────────── */}
      <Card className="mb-5 p-5">
        <SectionHeading
          title="System architecture"
          description="Evidence flows in one direction. The record system is only ever read."
        />

        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STAGES.map((stage, index) => {
            const Icon = stage.icon;
            return (
              <li key={stage.title} className="relative">
                <div
                  className={cn(
                    "h-full rounded-xl border p-4",
                    stage.tone === "accent" && "border-accent-ring/50 bg-accent-soft/40",
                    stage.tone === "ok" && "border-ok/25 bg-ok-soft/60",
                    stage.tone === "muted" && "border-line bg-surface-2",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface",
                        stage.tone === "accent" && "text-accent",
                        stage.tone === "ok" && "text-ok",
                        stage.tone === "muted" && "text-muted",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-[10.5px] font-semibold text-faint vp-num">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <p className="mt-2.5 text-[13px] font-semibold text-ink">{stage.title}</p>
                  <p className="mt-1 text-[11.5px] leading-snug text-muted">{stage.detail}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <p className="mt-5 border-t border-line pt-3.5 text-[12px] leading-relaxed text-muted">
          Change detection never depends on a language model. Classifications are normalised onto a
          fixed taxonomy and compared by band, so the same inputs always produce the same verdict.
          Evidence summaries are composed from the structured fields on screen by fixed templates,
          so every sentence traces back to a cited field.
        </p>
      </Card>

      {/* ── Intelligence layer ────────────────────────────────────────── */}
      <Card className="mb-5 p-5">
        <SectionHeading
          title="VariantPulse intelligence"
          description="Four responsibilities, each one inspectable from the case it produced."
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {AGENTS.map((agent) => {
            const Icon = agent.icon;
            return (
              <div key={agent.name} className="rounded-xl border border-line bg-surface-2 p-4">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-surface text-accent">
                  <Icon className="h-4 w-4" />
                </span>
                <p className="mt-2.5 text-[13px] font-semibold text-ink">{agent.name}</p>
                <p className="mt-1 text-[11.5px] leading-snug text-muted">{agent.role}</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Governance ────────────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeading
            title="Security and privacy"
            icon={<ShieldCheck className="h-4 w-4" />}
          />
          <ul className="mt-4 space-y-3 text-[13px] leading-relaxed text-ink-2">
            <Point>
              <strong className="font-medium text-ink">Role-based access.</strong> Review actions
              are attributed to the signed-in clinician and recorded in the audit trail.
            </Point>
            <Point>
              <strong className="font-medium text-ink">Read-only on records.</strong> VariantPulse
              never writes to the record system. It raises a case; a clinician acts on it.
            </Point>
            <Point>
              <strong className="font-medium text-ink">Minimal external context.</strong> Only a
              variant identifier is ever sent to an external service. No patient identifier, no
              genotype, and no record content leaves the workspace.
            </Point>
            <Point>
              <strong className="font-medium text-ink">Synthetic records.</strong> Every patient,
              clinician and department in this workspace is fabricated. The variant evidence
              attached to them is real and independently verifiable.
            </Point>
          </ul>
          <p className="mt-4 border-t border-line pt-3.5 text-[11.5px] leading-relaxed text-faint">
            This workspace is not a certified medical device and has not been through regulatory
            assessment. It is decision support for a clinical team, not a diagnostic system.
          </p>
        </Card>

        <Card className="p-5">
          <SectionHeading title="Current state" />
          <dl className="mt-4 space-y-3.5">
            <Field
              label="Evidence mode"
              value={
                <span className="inline-flex items-center gap-2">
                  <Badge tone={analysis.mode === "live" ? "positive" : "warning"} dot>
                    {analysis.mode === "live" ? "Live" : "Cached"}
                  </Badge>
                  {analysis.reason ? (
                    <span className="text-[12px] text-muted">{analysis.reason}</span>
                  ) : null}
                </span>
              }
            />
            <Field label="Last checked" value={<RelativeTime value={lastChecked} />} />
            <Field
              label="Synthetic patient records"
              value={formatNumber(PATIENTS.length)}
            />
            <Field label="Variants on panel" value={String(analysis.assessments.length)} />
            <Field label="Open review cases" value={String(analysis.metrics.openCases)} />
            <Field
              label="Snapshot fallback"
              value={`Verified ClinVar snapshot, ${analysis.snapshot.recordCount} records${
                analysis.snapshot.verifiedAt
                  ? `, identical to live ClinVar on ${new Date(analysis.snapshot.verifiedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`
                  : ""
              }`}
            />
          </dl>
        </Card>
      </div>

      <Card className="mt-5 p-5">
        <SectionHeading title="Built for population-scale genomic programmes" />
        <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-ink-2">
          Reclassification is not an edge case. It is the normal behaviour of a field where
          evidence accumulates faster than reports are revisited. A programme sequencing at
          population scale accumulates that debt continuously, and the gap widens quietly. Watching
          it is a systems problem, and it is the problem VariantPulse is built to solve.
        </p>
      </Card>
    </PageShell>
  );
}

function Point({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
      <span>{children}</span>
    </li>
  );
}
