"use client";

import * as React from "react";
import { notFound, useParams } from "next/navigation";
import { FolderOpen, ListPlus, Search, UserPlus } from "lucide-react";

import { DecisionBlock, DecisionButtons } from "@/components/decision";
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
import { PatientImpactGraph, SyntheticDataLabel } from "@/components/clinical/patient-impact-graph";
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
import {
  DECISION_NOTE_MIN,
  currentDecision,
  isDecisionNoteValid,
  type Decision,
} from "@/lib/decision";
import { composeRecommendation } from "@/lib/narrative";
import { EVIDENCE_MODES } from "@/lib/evidence-mode";
import { useWorkspace, type CaseNote, type CaseStatus } from "@/state/workspace";
import { RelativeTime } from "@/components/relative-time";

const STATUS_TONE: Record<CaseStatus, "warning" | "neutral" | "positive"> = {
  "Needs review": "warning",
  Assigned: "neutral",
  "In review": "neutral",
  Reviewed: "positive",
};

const NOTE_LABEL: Record<NonNullable<CaseNote["kind"]>, string> = {
  note: "Note",
  "review-opened": "Review opened",
  assignment: "Reviewer assigned",
  "evidence-request": "Evidence request",
  "follow-up": "Follow-up",
  decision: "Decision",
  amendment: "Decision amended",
};

const EVIDENCE_REQUEST =
  "Asked the reporting laboratory for functional or segregation data not present in the current submission set.";

const FOLLOW_UP_DEFAULT =
  "Contact the ordering department to confirm whether the affected records need re-reporting.";

export default function ReviewCasePage() {
  const params = useParams<{ caseId: string }>();
  const caseId = decodeURIComponent(params.caseId);
  const { analysis, getCase, openReview, requestEvidence, assignReviewer, createFollowUp, recordDecision } =
    useWorkspace();

  const assessment = analysis.assessments.find((a) => a.caseId === caseId);
  const [clinicianNote, setClinicianNote] = React.useState("");
  const [amending, setAmending] = React.useState(false);
  const noteRef = React.useRef<HTMLTextAreaElement>(null);

  if (!assessment) notFound();

  const state = getCase(caseId);
  const byKey = new Map(analysis.assessments.map((a) => [a.variant.key, a]));
  const recommendation = composeRecommendation(
    assessment.changeType,
    assessment.impactedRecordCount,
  );
  const reviewOpen = state.status === "In review" || state.status === "Reviewed";
  const trimmed = clinicianNote.trim();
  const decision = currentDecision(state.decisions);
  // The buttons are offered until a decision exists, and again while amending.
  const deciding = !decision || amending;
  const noteReady = isDecisionNoteValid(clinicianNote);
  const remaining = DECISION_NOTE_MIN - trimmed.length;

  const followUp = () => {
    createFollowUp(caseId, trimmed || FOLLOW_UP_DEFAULT);
    setClinicianNote("");
  };

  const decide = (value: Decision) => {
    if (!noteReady) return;
    recordDecision(caseId, value, trimmed);
    setClinicianNote("");
    setAmending(false);
  };

  const startAmendment = () => {
    setAmending(true);
    noteRef.current?.focus();
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
            <Badge tone={STATUS_TONE[state.status]} dot>
              {state.status}
            </Badge>
            <PriorityBadge level={assessment.priority.level} />
          </>
        }
      />

      <p className="mb-5 text-[13.5px] text-muted">
        <span className="font-semibold text-ink">Your DNA didn&rsquo;t change. Science did.</span>{" "}
        AI assists. Clinicians decide.
      </p>

      {/* Three columns only once there is room for them. At the xl breakpoint
          the centre column drops to ~300px, which is too narrow for the
          evidence table and the reasoning trail. */}
      <div className="grid gap-5 min-[1400px]:grid-cols-[minmax(0,320px)_minmax(0,1fr)_minmax(0,300px)]">
        {/* ── Left: what is affected ──────────────────────────────────── */}
        <div className="min-w-0 space-y-5">
          <Card className="p-5">
            <SectionHeading title="Classification change" />
            <ThenNow assessment={assessment} stacked caption className="mt-4" />
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

          <ScienceTimeline assessment={assessment} />
        </div>

        {/* ── Centre: the evidence ────────────────────────────────────── */}
        <div className="min-w-0 space-y-5">
          <EvidenceSummaryPanel assessment={assessment} />
          <Card className="p-5">
            <SectionHeading
              title="Patient impact"
              count={assessment.impactedRecordCount}
              description="The changed variant and every historical record that carries it. Select a record to see its detail."
            />
            <SyntheticDataLabel className="mt-3" />
            <PatientImpactGraph assessment={assessment} caseStatus={state.status} className="mt-5" />
          </Card>
          <EvidenceComparison assessment={assessment} />
          {assessment.regional ? <RegionalComparison assessment={assessment} /> : null}
          <ReasoningPanel assessment={assessment} />
          <PriorityPanel assessment={assessment} />

          <Card className="overflow-hidden">
            <div className="border-b border-line px-5 py-4">
              <SectionHeading
                title="Case trail"
                count={state.notes.length}
                description="Every review action on this case, with who took it and when."
              />
            </div>
            {state.notes.length > 0 ? (
              <ul className="divide-y divide-line">
                {state.notes.map((entry) => (
                  <li key={entry.id} className="px-5 py-3.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <p className="text-[12.5px] font-medium text-ink">
                        {entry.author}
                        <span className="ml-2 text-[11px] font-medium uppercase tracking-[0.07em] text-faint">
                          {NOTE_LABEL[entry.kind ?? "note"]}
                        </span>
                      </p>
                      <RelativeTime value={entry.at} className="text-[11px] text-faint" />
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{entry.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-center text-[12.5px] text-muted">
                No review actions on this case yet.
              </p>
            )}
          </Card>
        </div>

        {/* ── Right: the decision ─────────────────────────────────────── */}
        <div className="min-w-0 space-y-5">
          <DecisionBlock history={state.decisions} amending={amending} onAmend={startAmendment} />

          <Card className="p-5">
            <SectionHeading title="Recommendation" />
            <p className="mt-3 text-[13px] leading-relaxed text-ink-2">{recommendation}</p>
          </Card>

          <Card className="p-5">
            <SectionHeading
              title="Review actions"
              description="Each action is recorded in the audit trail. None changes a classification or a diagnosis."
            />
            <div className="mt-4 space-y-2">
              <Button
                variant="primary"
                className="w-full justify-start"
                onClick={() => openReview(caseId)}
                disabled={reviewOpen}
              >
                <FolderOpen className="h-4 w-4" />
                {reviewOpen ? "Clinical review open" : "Open clinical review"}
              </Button>
              <Button
                className="w-full justify-start"
                onClick={() => requestEvidence(caseId, EVIDENCE_REQUEST)}
                disabled={state.evidenceRequested}
              >
                <Search className="h-4 w-4" />
                {state.evidenceRequested ? "More evidence requested" : "Request more evidence"}
              </Button>
            </div>

            <div className="mt-4 border-t border-line pt-4">
              <label
                htmlFor="assignee"
                className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.07em] text-faint"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Assign reviewer
              </label>
              <select
                id="assignee"
                value={state.assignee ?? ""}
                onChange={(event) => assignReviewer(caseId, event.target.value)}
                className="mt-2 w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-[13px] text-ink outline-none transition-colors focus:border-accent-ring focus:bg-surface"
              >
                <option value="" disabled>
                  Unassigned
                </option>
                {REVIEWERS.map((reviewer) => (
                  <option key={reviewer.id} value={reviewer.name}>
                    {reviewer.name} · {reviewer.role}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 border-t border-line pt-4">
              <label
                htmlFor="clinician-note"
                className="text-[11px] font-medium uppercase tracking-[0.07em] text-faint"
              >
                Clinician note
              </label>
              <textarea
                ref={noteRef}
                id="clinician-note"
                value={clinicianNote}
                onChange={(event) => setClinicianNote(event.target.value)}
                rows={3}
                placeholder="Record your reasoning for the decision or the follow-up..."
                aria-describedby="decision-help"
                className="mt-2 w-full resize-y rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink outline-none transition-colors placeholder:text-faint focus:border-accent-ring focus:bg-surface"
              />
              <Button type="button" className="mt-2 w-full" onClick={followUp}>
                <ListPlus className="h-4 w-4" />
                Create follow-up
              </Button>

              {deciding ? (
                <div className="mt-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-faint">
                    {amending ? "Amend decision" : "Decision"}
                  </p>
                  <DecisionButtons disabled={!noteReady} onDecide={decide} className="mt-2" />
                  {amending ? (
                    <button
                      type="button"
                      onClick={() => setAmending(false)}
                      className="mt-2 text-[12px] font-medium text-muted transition-colors hover:text-accent"
                    >
                      Cancel amendment
                    </button>
                  ) : null}
                </div>
              ) : null}

              <p id="decision-help" className="mt-2 text-[11.5px] leading-relaxed text-faint">
                {deciding
                  ? `A decision needs a clinician note of at least ${DECISION_NOTE_MIN} characters${
                      trimmed && remaining > 0 ? ` (${remaining} more)` : ""
                    }. It records the outcome of the review; it does not write to any patient record or issue a diagnosis.`
                  : "Decision recorded. Amend it from the Decision panel; the original stays on file."}
              </p>
            </div>

            <div className="mt-4 border-t border-line pt-4">
              <EvidenceBriefButton assessment={assessment} state={state} />
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
                value={`ClinVar · ${EVIDENCE_MODES[analysis.mode].indicator}`}
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
          <SyntheticDataLabel className="mt-3" />
        </div>
        <PatientImpactTable
          rows={assessment.impactedPatients}
          byKey={byKey}
          showVariant={false}
          caseStatus={state.status}
        />
      </Card>
    </PageShell>
  );
}
