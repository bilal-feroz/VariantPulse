"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Database,
  Dna,
  Globe2,
  Microscope,
  ShieldCheck,
  Users,
} from "lucide-react";

import { ActivityItem, EvidenceAlert, MetricCard, SourceCard, ThenNow } from "@/components/domain";
import { EvidencePipeline } from "@/components/evidence-pipeline";
import { ScienceTimeline } from "@/components/panels";
import { SyncButton } from "@/components/sync";
import {
  Button,
  Card,
  ClassificationBadge,
  Eyebrow,
  EmptyState,
  SectionHeading,
  StatusDot,
} from "@/components/ui";
import { pick } from "@/lib/dto";
import { formatDate, formatYear } from "@/lib/utils";
import { useWorkspace } from "@/state/workspace";
import { RelativeTime } from "@/components/relative-time";

export default function HomePage() {
  const { analysis, activity, sync } = useWorkspace();

  const reviewable = pick(analysis, analysis.reviewableKeys);
  const lead = reviewable[0];
  const conflicts = pick(analysis, analysis.regionalConflictKeys);
  const leadPatients = lead?.impactedPatients ?? [];
  const live = analysis.mode === "live";
  const lastChecked = sync.phase === "done" ? sync.at : analysis.checkedAt;

  return (
    <div className="mx-auto w-full max-w-[1360px] px-5 pb-12 sm:px-6 lg:px-8">
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="grid gap-6 xl:grid-cols-[minmax(0,430px)_minmax(0,1fr)_minmax(0,232px)] xl:gap-5">
        <div className="pt-4 xl:pt-8">
          <Eyebrow>Monitoring genetic knowledge</Eyebrow>
          <h1 className="mt-4 text-[34px] font-semibold leading-[1.06] tracking-[-0.032em] text-ink sm:text-[40px] 2xl:text-[44px]">
            The same DNA.
            <br />A different meaning.
          </h1>
          <p className="mt-5 max-w-[26rem] text-[15px] leading-relaxed text-muted">
            VariantPulse continuously monitors genetic findings and detects when new
            scientific evidence changes what they mean.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            {lead ? (
              <Link href={lead.caseId ? `/review/${lead.caseId}` : "/review"}>
                <Button variant="primary" size="lg">
                  See a real example
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : null}
            <SyncButton size="lg" />
          </div>

          {lead && leadPatients[0] ? (
            <div className="vp-float vp-drift mt-8 max-w-[23rem] p-4 xl:mt-10">
              <div className="flex items-start gap-3.5">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                  <Dna className="h-6 w-6" strokeWidth={1.6} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[14.5px] font-semibold tracking-tight text-ink">
                      Patient {leadPatients[0].id}
                    </p>
                    <span className="rounded-md bg-warn-soft px-1.5 py-0.5 text-[11px] font-semibold text-warn vp-num">
                      {formatYear(leadPatients[0].testedOn)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13px] text-ink-2">
                    <span className="font-semibold">{lead.variant.gene}</span>{" "}
                    <span className="font-mono text-[12px] text-muted">
                      {lead.variant.hgvsCoding}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-muted">
                    Originally reported as {ClassificationText(lead.recordedCode)}
                  </p>
                  <Link
                    href={`/patients/${leadPatients[0].id}`}
                    className="mt-2.5 inline-flex items-center gap-1.5 text-[11.5px] text-faint transition-colors hover:text-accent"
                  >
                    <span className="grid h-4 w-4 place-items-center rounded border border-line-2">
                      <span className="h-1.5 w-1.5 rounded-[1px] bg-faint" />
                    </span>
                    Genetic test report
                  </Link>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Centre composition */}
        <div className="relative min-h-[420px] xl:h-[clamp(430px,53vh,580px)] xl:min-h-0">
          {lead ? (
            <div className="vp-float absolute left-1/2 top-2 z-10 flex w-[min(340px,92%)] -translate-x-1/2 items-center gap-3 px-4 py-3">
              <StatusDot tone="accent" pulse />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-ink">
                  New evidence detected
                </span>
                <span className="block truncate text-[11.5px] text-muted">
                  {lead.variant.gene} variant reclassified
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-accent-soft px-2 py-1 text-[11px] font-semibold text-accent vp-num">
                {lead.impactedRecordCount} affected
              </span>
            </div>
          ) : null}

          {/* Bleeds into the column gaps so the helix reads at full scale. */}
          <EvidencePipeline className="absolute inset-0" />
        </div>

        {/* Sources */}
        <div className="space-y-2.5 xl:pt-8">
          <SourceCard
            name="ClinVar"
            description="Global submissions"
            status={live ? "live" : "cached"}
            detail={<RelativeTime value={lastChecked} />}
            glyph={<Database className="h-4 w-4" />}
          />
          <SourceCard
            name="Regional evidence"
            description="Arab and Gulf cohorts"
            status="connected"
            detail="Index"
            glyph={<Globe2 className="h-4 w-4" />}
          />
          <SourceCard
            name="Medical literature"
            description="Indexed publications"
            status="connected"
            detail="PubMed"
            glyph={<Microscope className="h-4 w-4" />}
          />
          <SourceCard
            name="Hospital records"
            description="Historical findings"
            status="connected"
            detail={`${analysis.scan.findingsChecked.toLocaleString("en-US")} on file`}
            glyph={<Building2 className="h-4 w-4" />}
          />
        </div>
      </section>

      {/* ── Three-card summary ─────────────────────────────────────────── */}
      <section className="mt-8 grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <SectionHeading
            title="Science has updated"
            count={analysis.metrics.evidenceChanges}
            icon={<Dna className="h-4 w-4" />}
            action={
              <Link
                href="/variants"
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-muted transition-colors hover:text-accent"
              >
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          {lead ? (
            <>
              <ThenNow assessment={lead} size="sm" className="mt-4" />
              <p className="mt-3.5 text-[12.5px] leading-relaxed text-muted">
                {lead.variant.gene} {lead.variant.hgvsCoding} — evidence last evaluated{" "}
                {formatDate(lead.evidence.lastEvaluated)}.
              </p>
            </>
          ) : (
            <EmptyState title="No changes detected" description="Current evidence agrees with every interpretation on record." />
          )}
        </Card>

        <Card className="p-5">
          <SectionHeading
            title="Patients affected"
            count={analysis.metrics.patientsImpacted}
            icon={<Users className="h-4 w-4" />}
            action={
              <Link
                href="/patients"
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-muted transition-colors hover:text-accent"
              >
                View patients
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="mt-5 flex -space-x-2">
            {reviewable
              .flatMap((a) => a.impactedPatients)
              .slice(0, 7)
              .map((patient, index) => (
                <Link
                  key={patient.id}
                  href={`/patients/${patient.id}`}
                  title={`${patient.id} · ${patient.orderingDepartment}`}
                  className="grid h-11 w-11 place-items-center rounded-full border-2 border-surface bg-accent-soft text-[11px] font-semibold text-accent transition-transform hover:-translate-y-0.5"
                  style={{ zIndex: 10 - index }}
                >
                  {patient.id.slice(-3)}
                </Link>
              ))}
            {analysis.metrics.patientsImpacted > 7 ? (
              <span className="grid h-11 w-11 place-items-center rounded-full border-2 border-white bg-surface-3 text-[11px] font-semibold text-muted">
                +{analysis.metrics.patientsImpacted - 7}
              </span>
            ) : null}
          </div>
          <p className="mt-5 text-[13.5px] leading-relaxed text-ink-2">
            <span className="font-semibold">
              {analysis.metrics.patientsImpacted} records on file
            </span>{" "}
            carry a variant whose interpretation has moved, and may require clinical review.
          </p>
        </Card>

        <Card className="p-5">
          <SectionHeading
            title="Not a diagnosis"
            icon={<ShieldCheck className="h-4 w-4" />}
          />
          <p className="mt-4 text-[13.5px] leading-relaxed text-ink-2">
            VariantPulse highlights changes in scientific evidence and helps clinical teams
            review affected patients. It does not alter any record and does not decide any
            diagnosis.
          </p>
          <Link href="/review" className="mt-5 block">
            <Button variant="primary" size="lg" className="w-full justify-between">
              Open clinical review
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <p className="mt-2.5 text-center text-[11.5px] text-faint">
            AI assists. Clinicians decide.
          </p>
        </Card>
      </section>

      {/* ── Metrics ────────────────────────────────────────────────────── */}
      <section className="mt-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Historical findings monitored"
            value={analysis.metrics.findingsMonitored}
            hint={<>Checked <RelativeTime value={lastChecked} /></>}
          />
          <MetricCard
            label="Evidence changes detected"
            value={analysis.metrics.evidenceChanges}
            tone={analysis.metrics.evidenceChanges > 0 ? "critical" : "positive"}
            hint="Reclassifications since reporting"
            href="/variants"
          />
          <MetricCard
            label="Patients potentially impacted"
            value={analysis.metrics.patientsImpacted}
            tone={analysis.metrics.patientsImpacted > 0 ? "warning" : "positive"}
            hint="Records awaiting clinical review"
            href="/patients"
          />
          <MetricCard
            label="Regional evidence conflicts"
            value={analysis.metrics.regionalConflicts}
            tone={analysis.metrics.regionalConflicts > 0 ? "warning" : "positive"}
            hint="Global and regional readings differ"
            href="/regional"
          />
        </div>
      </section>

      {/* ── Evidence changes requiring attention ───────────────────────── */}
      <section className="mt-8">
        <SectionHeading
          title="Evidence changes requiring attention"
          description="Every item below opens a clinical review case. None of them changes a record."
          action={
            <Link
              href="/review"
              className="inline-flex items-center gap-1 text-[12.5px] font-medium text-muted transition-colors hover:text-accent"
            >
              Review queue
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        {reviewable.length === 0 ? (
          <Card className="mt-4">
            <EmptyState
              icon={<ShieldCheck className="h-5 w-5" />}
              title="No material evidence changes detected"
              description="Every monitored finding agrees with the current interpretation on record."
            />
          </Card>
        ) : (
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {reviewable.slice(0, 4).map((assessment) => (
              <EvidenceAlert key={assessment.variant.key} assessment={assessment} />
            ))}
          </div>
        )}
      </section>

      {/* ── Timeline and activity ──────────────────────────────────────── */}
      <section className="mt-8 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {lead ? <ScienceTimeline assessment={lead} /> : <div />}

        <Card className="flex flex-col p-5">
          <SectionHeading
            title="Recent activity"
            action={
              <Link
                href="/activity"
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-muted transition-colors hover:text-accent"
              >
                Full trail
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <ol className="mt-5 flex-1">
            {activity.slice(0, 7).map((entry, index, list) => (
              <ActivityItem
                key={entry.id}
                at={entry.at}
                title={entry.title}
                detail={entry.detail}
                kind={entry.kind}
                last={index === list.length - 1}
              />
            ))}
          </ol>
        </Card>
      </section>

      {conflicts.length > 0 ? (
        <section className="mt-8">
          <SectionHeading
            title="Regional evidence conflicts"
            count={conflicts.length}
            icon={<Globe2 className="h-4 w-4" />}
            description="Global consensus and regional evidence reach different conclusions. Neither is ranked above the other."
            action={
              <Link
                href="/regional"
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-muted transition-colors hover:text-accent"
              >
                Compare sources
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {conflicts.map((assessment) => (
              <EvidenceAlert key={assessment.variant.key} assessment={assessment} />
            ))}
          </div>
        </section>
      ) : null}

      <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <p className="text-[11.5px] text-faint">
          VariantPulse · Built by Team Kanban
        </p>
        <p className="text-[11.5px] text-faint">
          Synthetic patient dataset · Variant evidence read from ClinVar
        </p>
      </footer>
    </div>
  );
}

function ClassificationText(code: Parameters<typeof ClassificationBadge>[0]["code"]) {
  return (
    <span className="font-medium text-warn">
      {code === "VUS" ? "uncertain significance" : code.toLowerCase().replace(/_/g, " ")}
    </span>
  );
}
