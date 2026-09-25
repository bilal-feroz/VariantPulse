"use client";

import * as React from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  MessageSquarePlus,
  Search,
  UserPlus,
} from "lucide-react";

import { ThenNow } from "@/components/domain";
import { EvidenceBriefButton } from "@/components/evidence-brief";
import { PageHeader, PageShell } from "@/components/page-header";
import {
  EvidenceComparison,
  EvidenceSummaryPanel,
  PriorityPanel,
  ReasoningPanel,
  RegionalComparison,
  ScienceTimeline,
} from "@/components/panels";
import { PatientImpactTable } from "@/components/patient-table";
import {
  Badge,
  Button,
  Card,
  ChangeTypeBadge,
  DecisionNotice,
  Field,
  PriorityBadge,
  SectionHeading,
} from "@/components/ui";
import { REVIEWERS } from "@/data/workspace";
import { composeRecommendation } from "@/lib/narrative";
import { formatDate } from "@/lib/utils";
import { useWorkspace } from "@/state/workspace";
import { RelativeTime } from "@/components/relative-time";

export default function ReviewCasePage() {
  const params = useParams<{ caseId: string }>();
  const caseId = decodeURIComponent(params.caseId);
  const { analysis, getCase, assign, addNote, escalate, resolve, setStatus } = useWorkspace();

  const assessment = analysis.assessments.find((a) => a.caseId === caseId);
  const [note, setNote] = React.useState("");
  const [requested, setRequested] = React.useState(false);

  if (!assessment) notFound();

  const state = getCase(caseId);
  const byKey = new Map(analysis.assessments.map((a) => [a.variant.key, a]));
  const recommendation = composeRecommendation(
    assessment.changeType,
    assessment.impactedRecordCount,
  );

  const submitNote = (event: React.FormEvent) => {
    event.preventDefault();
    const body = note.trim();
    if (!body) return;
    addNote(caseId, body);
    setNote("");
  };

  const requestEvidence = () => {
    addNote(
      caseId,
      "Additional evidence requested: asked the reporting laboratory for functional or segregation data not present in the current submission set.",
    );
    setStatus(caseId, "In progress");
    setRequested(true);
  };

  return (
    <PageShell>
      <PageHeader
        back={{ href: "/review", label: "Review queue" }}
        eyebrow={caseId}
        title={`${assessment.variant.gene} ${assessment.variant.hgvsCoding}`}
        description={assessment.variant.condition}
        actions={
          <>
            <Badge tone={state.status === "Resolved" ? "positive" : "neutral"} dot>
              {state.escalated ? "Escalated" : state.status}
            </Badge>
            <PriorityBadge level={assessment.priority.level} />
          </>
        }
      />

      {/* Three columns only once there is room for them. At the xl breakpoint
          the centre column drops to ~300px, which is too narrow for the
          evidence table and the reasoning trail. */}
      <div className="grid gap-5 min-[1400px]:grid-cols-[minmax(0,320px)_minmax(0,1fr)_minmax(0,300px)]">
        {/* ── Left: what is affected ──────────────────────────────────── */}
        <div className="space-y-5">
          <Card className="p-5">
            <SectionHeading title="Classification change" />
            <ThenNow assessment={assessment} stacked className="mt-4" />
            <div className="mt-4 border-t border-line pt-3.5">
              <ChangeTypeBadge type={assessment.changeType} />
            </div>
          </Card>

          <Card className="p-5">
            <SectionHeading title="Variant" />
            <dl className="mt-4 space-y-3.5">
              <Field label="Gene" value={assessment.variant.gene} />
              <Field label="HGVS (coding)" value={assessment.variant.hgvsCoding} mono />
              <Field label="Protein" value={assessment.variant.proteinChange ?? "Not applicable"} mono />
              <Field
                label="ClinVar"
                value={assessment.evidence.accession ?? assessment.evidence.clinvarId}
                mono
              />
              <Field label="dbSNP" value={assessment.evidence.rsid ?? "Not linked"} mono />
              <Field label="Panel" value={assessment.variant.panel} />
              <Field
                label="Molecular consequence"
                value={assessment.evidence.molecularConsequence ?? "Not stated"}
              />
            </dl>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-line px-5 py-4">
              <SectionHeading
                title="Patient impact"
                count={assessment.impactedRecordCount}
                description="Records carrying this variant."
              />
            </div>
            <ul className="divide-y divide-line">
              {assessment.impactedPatients.map((patient) => (
                <li key={patient.id}>
                  <Link
                    href={`/patients/${patient.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-[12.5px] font-medium text-ink">
                        {patient.id}
                      </span>
                      <span className="block truncate text-[11.5px] text-muted">
                        {patient.ageBand} · {patient.orderingDepartment}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[11.5px] text-muted vp-num">
                        {formatDate(patient.testedOn)}
                      </span>
                      <span className="block text-[11px] text-faint">{patient.clinicalOwner}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <ScienceTimeline assessment={assessment} />
        </div>

        {/* ── Centre: the evidence ────────────────────────────────────── */}
        <div className="min-w-0 space-y-5">
          <EvidenceSummaryPanel assessment={assessment} />
          <EvidenceComparison assessment={assessment} />
          {assessment.regional ? <RegionalComparison assessment={assessment} /> : null}
          <ReasoningPanel assessment={assessment} />
          <PriorityPanel assessment={assessment} />

          <Card className="overflow-hidden">
            <div className="border-b border-line px-5 py-4">
              <SectionHeading title="Case notes" count={state.notes.length} />
            </div>
            {state.notes.length > 0 ? (
              <ul className="divide-y divide-line">
                {state.notes.map((entry) => (
                  <li key={entry.id} className="px-5 py-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-[12.5px] font-medium text-ink">{entry.author}</p>
<RelativeTime value={entry.at} className="text-[11px] text-faint" />
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{entry.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-center text-[12.5px] text-muted">
                No notes on this case yet.
              </p>
            )}
            <form onSubmit={submitNote} className="border-t border-line p-4">
              <label htmlFor="case-note" className="sr-only">
                Add a note
              </label>
              <textarea
                id="case-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="Record your reasoning for the next reviewer..."
                className="w-full resize-y rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink outline-none transition-colors placeholder:text-faint focus:border-accent-ring focus:bg-surface"
              />
              <div className="mt-2.5 flex justify-end">
                <Button type="submit" size="sm" disabled={!note.trim()}>
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                  Add note
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* ── Right: the decision ─────────────────────────────────────── */}
        <div className="space-y-5">
          <Card className="p-5">
            <SectionHeading title="Recommendation" />
            <p className="mt-3 text-[13px] leading-relaxed text-ink-2">{recommendation}</p>

            {state.status === "Resolved" ? (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-ok/20 bg-ok-soft p-3.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium text-ink">Reviewed</p>
                  <p className="mt-0.5 text-[12px] leading-snug text-ink-2">{state.resolution}</p>
                </div>
              </div>
            ) : (
              <Button
                variant="primary"
                className="mt-4 w-full"
                onClick={() =>
                  resolve(
                    caseId,
                    "Reviewer accepted the recommendation. Affected records flagged for clinical follow-up.",
                  )
                }
              >
                <Check className="h-4 w-4" />
                Approve review recommendation
              </Button>
            )}

            <Button
              className="mt-2 w-full"
              onClick={requestEvidence}
              disabled={requested}
            >
              <Search className="h-4 w-4" />
              {requested ? "Evidence requested" : "Request more evidence"}
            </Button>

            <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
              Approving records a review decision inside VariantPulse. It does not write to any
              patient record and does not issue a diagnosis.
            </p>
          </Card>

          <Card className="p-5">
            <SectionHeading title="Assign reviewer" icon={<UserPlus className="h-4 w-4" />} />
            <label htmlFor="assignee" className="sr-only">
              Assign a reviewer
            </label>
            <select
              id="assignee"
              value={state.assignee ?? ""}
              onChange={(event) => assign(caseId, event.target.value)}
              className="mt-3 w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-[13px] text-ink outline-none transition-colors focus:border-accent-ring focus:bg-surface"
            >
              <option value="" disabled>
                Unassigned
              </option>
              {REVIEWERS.map((reviewer) => (
                <option key={reviewer.id} value={reviewer.name}>
                  {reviewer.name} — {reviewer.role}
                </option>
              ))}
            </select>

            <div className="mt-4 space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-faint">
                Move case
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(["Assigned", "In progress"] as const).map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    onClick={() => setStatus(caseId, status)}
                    className={state.status === status ? "border-accent-ring bg-accent-soft" : ""}
                  >
                    {status}
                  </Button>
                ))}
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <SectionHeading title="Actions" />
            <div className="mt-3 space-y-2">
              <EvidenceBriefButton assessment={assessment} state={state} />
              <Button
                className="w-full justify-start"
                onClick={() => escalate(caseId)}
                disabled={state.escalated}
              >
                <AlertTriangle className="h-4 w-4" />
                {state.escalated ? "Escalated" : "Escalate for specialist opinion"}
              </Button>
              <Button
                className="w-full justify-start"
                onClick={() =>
                  addNote(
                    caseId,
                    "Follow-up task created: contact the ordering department to confirm whether the affected records need re-reporting.",
                  )
                }
              >
                <MessageSquarePlus className="h-4 w-4" />
                Create follow-up task
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <SectionHeading title="Case detail" />
            <dl className="mt-3.5 space-y-3">
              <Field label="Case" value={caseId} mono />
              <Field label="Raised" value={<RelativeTime value={analysis.checkedAt} />} />
              <Field label="Assigned" value={state.assignee ?? "Unassigned"} />
              <Field
                label="Evidence source"
                value={analysis.mode === "live" ? "ClinVar (live)" : "ClinVar (cached snapshot)"}
              />
              <Field
                label="Records impacted"
                value={String(assessment.impactedRecordCount)}
              />
            </dl>
          </Card>

          <DecisionNotice className="px-1" />
        </div>
      </div>

      <Card className="mt-5 overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <SectionHeading
            title="Affected records in full"
            count={assessment.impactedPatients.length}
          />
        </div>
        <PatientImpactTable
          rows={assessment.impactedPatients}
          byKey={byKey}
          showVariant={false}
        />
      </Card>
    </PageShell>
  );
}
