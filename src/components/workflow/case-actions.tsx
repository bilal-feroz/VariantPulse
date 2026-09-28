"use client";

/**
 * The actions on a case, in the order the workflow takes them: owner and
 * deadline, review, decision, follow-up, closure, and what leaves the case.
 *
 * Each card offers only what the signed-in role may do and says why anything
 * else is unavailable. None of them changes a classification, writes to a
 * record or contacts a patient: a decision is recorded, a follow-up is a task
 * for the care team, and a patient letter is a draft the care team releases.
 */

import * as React from "react";
import {
  Check,
  CheckCheck,
  FolderOpen,
  Lock,
  MessageSquarePlus,
  RotateCcw,
  Search,
  Undo2,
  UserCheck,
  X,
} from "lucide-react";

import { DecisionBlock, DecisionButtons } from "@/components/decision";
import { EvidenceBriefButton } from "@/components/evidence-brief";
import { FhirExportButton } from "@/components/fhir-export";
import { PatientLetterButton } from "@/components/patient-letter";
import { Timestamp } from "@/components/clinical/timestamp";
import { Badge, Button, Card, Field, SectionHeading } from "@/components/ui";
import { DeadlineBadge } from "@/components/workflow/badges";
import { RoleNote } from "@/components/workflow/role-note";
import { CASE_OWNERS, SERVICE_LEAD } from "@/data/workspace";
import type { VariantAssessment } from "@/lib/analysis";
import {
  DECISION_NOTE_MIN,
  currentDecision,
  isDecisionNoteValid,
  isSettled,
  type Decision,
} from "@/lib/decision";
import { canApproveFollowUp, canCloseCase, denial } from "@/lib/roles";
import { cn, formatDate } from "@/lib/utils";
import {
  CLOSURE_NOTE_MIN,
  FOLLOW_UP_KINDS,
  REVIEW_SLA_DAYS,
  activeFollowUps,
  closureBlocker,
  letterApproved,
  pendingApprovals,
  reviewDeadline,
  suggestedFollowUps,
  type CaseState,
  type FollowUpDraft,
  type FollowUpKind,
  type FollowUpTask,
} from "@/lib/workflow";
import { useWorkspace } from "@/state/workspace";

const EVIDENCE_REQUEST =
  "Asked the reporting laboratory for functional or segregation data not present in the current submission set.";

const TEXTAREA =
  "w-full resize-y rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink outline-none transition-colors placeholder:text-faint focus:border-accent-ring focus:bg-surface";

const LABEL = "text-[11px] font-medium uppercase tracking-[0.07em] text-faint";

interface CaseProps {
  caseId: string;
  assessment: VariantAssessment;
  state: CaseState;
}

/* -- Owner and deadline ---------------------------------------------------- */

export function OwnerCard({ caseId, assessment, state }: CaseProps) {
  const { persona, can, now, assignOwner } = useWorkspace();
  const closed = Boolean(state.closure);
  const level = assessment.priority.level;
  const dueAt = state.raisedAt ? reviewDeadline(state.raisedAt, level) : null;
  const canAssign = can("case:assign") && !closed;
  const canTake = !state.owner && can("case:own") && !closed;

  return (
    <Card className="p-5">
      <SectionHeading title="Owner and deadline" icon={<UserCheck className="h-4 w-4" />} />
      <dl className="mt-4 space-y-3.5">
        <Field
          label="Case owner"
          value={
            state.owner ? (
              <span className="font-medium">
                {state.owner}
                {state.owner === persona.name ? <span className="font-normal text-muted"> (you)</span> : null}
              </span>
            ) : (
              <span className="text-warn">Unassigned</span>
            )
          }
        />
        <Field
          label="Review deadline"
          value={
            <span className="flex flex-wrap items-center gap-2">
              <DeadlineBadge state={state} level={level} now={now} />
              {dueAt ? (
                <span className="text-[12px] text-muted">
                  {formatDate(dueAt)} · {REVIEW_SLA_DAYS[level]} days for {level.toLowerCase()} priority
                </span>
              ) : null}
            </span>
          }
        />
        {state.escalatedAt ? (
          <Field
            label="Escalated"
            value={
              <span className="text-[12.5px] text-crit">
                To {SERVICE_LEAD.name}, <Timestamp value={state.escalatedAt} />
              </span>
            }
          />
        ) : null}
      </dl>

      {canAssign ? (
        <div className="mt-4 border-t border-line pt-4">
          <label htmlFor={`${caseId}-owner`} className={LABEL}>
            {state.owner ? "Reassign owner" : "Assign owner"}
          </label>
          <select
            id={`${caseId}-owner`}
            value={state.owner ?? ""}
            onChange={(event) => assignOwner(caseId, event.target.value)}
            className="mt-2 w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-[13px] text-ink outline-none transition-colors focus:border-accent-ring focus:bg-surface"
          >
            <option value="" disabled>
              Unassigned
            </option>
            {CASE_OWNERS.map((name) => (
              <option key={name} value={name}>
                {name}
                {name === persona.name ? " (you)" : ""}
              </option>
            ))}
          </select>
        </div>
      ) : canTake ? (
        <Button className="mt-4 w-full" onClick={() => assignOwner(caseId, persona.name)}>
          <UserCheck className="h-4 w-4" />
          Take ownership
        </Button>
      ) : !closed && !state.owner ? (
        <RoleNote className="mt-4" reason={denial(persona, "case:own")} switchTo="kassim" />
      ) : null}

      <p className="mt-4 text-[11.5px] leading-relaxed text-faint">
        Deadlines run from when the case was raised and are met by the first documented decision. Past it,
        an undecided case goes to the service lead. The days per priority are placeholders a pilot agrees
        with the partner.
      </p>
    </Card>
  );
}

/* -- Review ---------------------------------------------------------------- */

export function ReviewCard({ caseId, state }: CaseProps) {
  const { persona, can, openReview, requestEvidence, addNote } = useWorkspace();
  const [note, setNote] = React.useState("");
  const closed = Boolean(state.closure);
  const reviewDenied = denial(persona, "case:review");
  const needsOwnership = !state.owner && !can("case:own");

  const submitNote = (event: React.FormEvent) => {
    event.preventDefault();
    if (!note.trim()) return;
    addNote(caseId, note);
    setNote("");
  };

  return (
    <Card className="p-5">
      <SectionHeading
        title="Review"
        description="Each action is recorded in the case history and the audit trail. None changes a classification or a diagnosis."
      />
      <div className="mt-4 space-y-2">
        <Button
          variant="primary"
          className="w-full justify-start"
          onClick={() => openReview(caseId)}
          disabled={Boolean(state.reviewOpenedAt) || closed || Boolean(reviewDenied) || needsOwnership}
        >
          <FolderOpen className="h-4 w-4" />
          {state.reviewOpenedAt
            ? "Clinical review open"
            : state.owner
              ? "Open clinical review"
              : "Take ownership and open review"}
        </Button>
        <Button
          className="w-full justify-start"
          onClick={() => requestEvidence(caseId, EVIDENCE_REQUEST)}
          disabled={state.evidenceRequested || closed || Boolean(reviewDenied)}
        >
          <Search className="h-4 w-4" />
          {state.evidenceRequested ? "More evidence requested" : "Request more evidence"}
        </Button>
      </div>
      {state.reviewOpenedAt ? (
        <p className="mt-2 text-[11.5px] text-faint">
          Review opened <Timestamp value={state.reviewOpenedAt} className="vp-num" />
        </p>
      ) : null}
      <RoleNote className="mt-3" reason={reviewDenied} switchTo="kassim" />

      {!reviewDenied && !closed ? (
        <form onSubmit={submitNote} className="mt-4 border-t border-line pt-4">
          <label htmlFor={`${caseId}-note`} className={LABEL}>
            Add a note
          </label>
          <textarea
            id={`${caseId}-note`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            placeholder="A working note for the case history"
            className={cn(TEXTAREA, "mt-2")}
          />
          <Button type="submit" size="sm" className="mt-2" disabled={!note.trim()}>
            <MessageSquarePlus className="h-3.5 w-3.5" />
            Add note
          </Button>
        </form>
      ) : null}
    </Card>
  );
}

/* -- Decision -------------------------------------------------------------- */

export function DecisionCard({ caseId, state }: CaseProps) {
  const { persona, recordDecision } = useWorkspace();
  const [rationale, setRationale] = React.useState("");
  const [amending, setAmending] = React.useState(false);
  const noteRef = React.useRef<HTMLTextAreaElement>(null);

  const closed = Boolean(state.closure);
  const decision = currentDecision(state.decisions);
  const denied = denial(persona, "case:decide");
  const deciding = !closed && !denied && (!decision || amending);
  const trimmed = rationale.trim();
  const ready = isDecisionNoteValid(rationale) && Boolean(state.owner);
  const remaining = DECISION_NOTE_MIN - trimmed.length;

  const decide = (value: Decision) => {
    if (!ready) return;
    recordDecision(caseId, value, trimmed);
    setRationale("");
    setAmending(false);
  };

  const startAmendment = () => {
    setAmending(true);
    window.setTimeout(() => noteRef.current?.focus(), 0);
  };

  return (
    <>
      <DecisionBlock
        history={state.decisions}
        amending={amending}
        onAmend={!closed && !denied ? startAmendment : undefined}
      />

      {deciding ? (
        <Card className="p-5">
          <SectionHeading
            title={amending ? "Amend the decision" : "Decision"}
            description="Refer to genetics, hold for further evidence, or take no action. Every decision carries its rationale."
          />
          <label htmlFor={`${caseId}-rationale`} className={cn(LABEL, "mt-4 block")}>
            Rationale
          </label>
          <textarea
            ref={noteRef}
            id={`${caseId}-rationale`}
            value={rationale}
            onChange={(event) => setRationale(event.target.value)}
            rows={3}
            placeholder="Why this decision, in terms a colleague could check against the evidence..."
            aria-describedby={`${caseId}-decision-help`}
            className={cn(TEXTAREA, "mt-2")}
          />
          <DecisionButtons disabled={!ready} onDecide={decide} className="mt-3" />
          {amending ? (
            <button
              type="button"
              onClick={() => setAmending(false)}
              className="mt-2 text-[12px] font-medium text-muted transition-colors hover:text-accent"
            >
              Cancel amendment
            </button>
          ) : null}
          <p id={`${caseId}-decision-help`} className="mt-2 text-[11.5px] leading-relaxed text-faint">
            {!state.owner
              ? "Assign an owner first: every decision has a named clinician accountable for the case."
              : `A decision needs a rationale of at least ${DECISION_NOTE_MIN} characters${trimmed && remaining > 0 ? ` (${remaining} more)` : ""}. It records the outcome of the review; it writes to no patient record and issues no diagnosis.`}
          </p>
        </Card>
      ) : !decision ? (
        <Card className="p-5">
          <SectionHeading title="Decision" />
          <p className="mt-3 text-[12.5px] text-muted">
            {closed ? "The case was closed without a decision." : "No decision recorded yet."}
          </p>
          <RoleNote className="mt-3" reason={closed ? null : denied} switchTo="kassim" />
        </Card>
      ) : null}
    </>
  );
}

/* -- Follow-up ------------------------------------------------------------- */

const STATUS_TONE: Record<FollowUpTask["status"], "warning" | "positive" | "muted" | "neutral"> = {
  Proposed: "warning",
  Approved: "positive",
  Declined: "muted",
  Done: "neutral",
  Withdrawn: "muted",
  Superseded: "muted",
};

function statusLabel(task: FollowUpTask): string {
  if (task.status === "Done") return FOLLOW_UP_KINDS[task.kind].doneLabel;
  if (task.status === "Proposed") return "Awaiting approval";
  return task.status;
}

function reviewTrail(task: FollowUpTask): string {
  const kind = FOLLOW_UP_KINDS[task.kind];
  const parts = [`Proposed by ${task.proposedBy}`];
  if (task.reviewedBy && (task.status === "Approved" || task.status === "Done")) parts.push(`approved by ${task.reviewedBy}`);
  if (task.reviewedBy && task.status === "Declined") parts.push(`declined by ${task.reviewedBy}`);
  if (task.status === "Withdrawn") parts.push("withdrawn by its proposer");
  if (task.completedBy) parts.push(`${kind.doneLabel.toLowerCase()} by ${task.completedBy}`);
  return parts.join(" · ") + (task.reviewNote ? ` · "${task.reviewNote}"` : "");
}

export function FollowUpCard({ caseId, assessment, state }: CaseProps) {
  const { persona, can, silentMode, proposeFollowUps, reviewFollowUp, withdrawFollowUp, completeFollowUp } =
    useWorkspace();
  const decision = currentDecision(state.decisions);
  const settled = decision ? isSettled(decision.decision) : false;
  const closed = Boolean(state.closure);
  const canPropose = can("follow-up:propose") && settled && !closed;

  // Only the decision in force has live follow-ups; the rest are history.
  const active = activeFollowUps(state);
  const earlier = state.followUps.filter((task) => !active.includes(task));

  const proposedTitles = new Set(
    active.filter((t) => t.status !== "Declined" && t.status !== "Withdrawn").map((t) => t.title),
  );
  const suggestions = decision
    ? suggestedFollowUps({
        decision: decision.decision,
        gene: assessment.variant.gene,
        records: assessment.impactedPatients,
      }).filter((draft) => !proposedTitles.has(draft.title))
    : [];

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [custom, setCustom] = React.useState("");
  const [declining, setDeclining] = React.useState<string | null>(null);
  const [declineNote, setDeclineNote] = React.useState("");

  // New suggestions start selected; the reviewer unticks what does not apply.
  const suggestionKey = suggestions.map((s) => s.title).join("|");
  React.useEffect(() => {
    setSelected(new Set(suggestionKey ? suggestionKey.split("|") : []));
  }, [suggestionKey]);

  const propose = () => {
    const drafts: FollowUpDraft[] = suggestions.filter((s) => selected.has(s.title));
    if (custom.trim()) {
      drafts.push({ kind: "other", title: custom.trim().slice(0, 120), detail: custom.trim() });
    }
    if (drafts.length === 0) return;
    proposeFollowUps(caseId, drafts);
    setCustom("");
  };

  const pending = pendingApprovals(state);
  const approvable = pending.filter((task) => !canApproveFollowUp(persona, task.proposedBy));
  const approvalNote =
    pending.length > 0 && approvable.length === 0 ? canApproveFollowUp(persona, pending[0].proposedBy) : null;

  const toggle = (title: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });

  return (
    <Card className="p-5">
      <SectionHeading
        title="Follow-up"
        count={active.length || undefined}
        description="Tasks for the care team. Anything that could reach a patient waits for approval by someone other than its proposer."
      />

      {active.length > 0 ? (
        <ul className="mt-4 space-y-2.5">
          {active.map((task) => {
            const kind = FOLLOW_UP_KINDS[task.kind];
            const approveDenied = canApproveFollowUp(persona, task.proposedBy);
            const heldBySilence = silentMode && kind.patientFacing;
            const mine = task.proposedBy === persona.name;
            return (
              <li key={task.id} className="rounded-xl border border-line bg-surface-2 p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={STATUS_TONE[task.status]} dot>
                    {statusLabel(task)}
                  </Badge>
                  <span className="text-[11px] font-medium uppercase tracking-[0.07em] text-faint">{kind.label}</span>
                </div>
                <p className="mt-2 text-[13px] font-medium text-ink">{task.title}</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-2">{task.detail}</p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-faint">{reviewTrail(task)}</p>

                {task.status === "Proposed" && !closed && !approveDenied ? (
                  declining === task.id ? (
                    <div className="mt-2.5">
                      <label htmlFor={`${task.id}-decline`} className={LABEL}>
                        Reason for declining
                      </label>
                      <input
                        id={`${task.id}-decline`}
                        value={declineNote}
                        onChange={(event) => setDeclineNote(event.target.value)}
                        className={cn(TEXTAREA, "mt-1.5 py-2")}
                      />
                      <div className="mt-2 flex gap-2">
                        <Button
                          size="sm"
                          disabled={!declineNote.trim()}
                          onClick={() => {
                            reviewFollowUp(caseId, task.id, "Declined", declineNote);
                            setDeclining(null);
                            setDeclineNote("");
                          }}
                        >
                          Decline
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeclining(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2.5 flex gap-2">
                      <Button size="sm" variant="primary" onClick={() => reviewFollowUp(caseId, task.id, "Approved")}>
                        <Check className="h-3.5 w-3.5" />
                        Approve
                      </Button>
                      <Button size="sm" onClick={() => setDeclining(task.id)}>
                        <X className="h-3.5 w-3.5" />
                        Decline
                      </Button>
                    </div>
                  )
                ) : null}

                {task.status === "Proposed" && !closed && mine ? (
                  <button
                    type="button"
                    onClick={() => withdrawFollowUp(caseId, task.id)}
                    className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-muted transition-colors hover:text-accent"
                  >
                    <Undo2 className="h-3 w-3" />
                    Withdraw
                  </button>
                ) : null}

                {task.status === "Approved" && can("follow-up:complete") ? (
                  heldBySilence ? (
                    <p className="mt-2.5 flex items-start gap-2 text-[11.5px] leading-relaxed text-warn">
                      <Lock className="mt-[3px] h-3 w-3 shrink-0" aria-hidden />
                      Silent pilot: approved and recorded for evaluation, but not carried out.
                    </p>
                  ) : (
                    <Button size="sm" className="mt-2.5" onClick={() => completeFollowUp(caseId, task.id)}>
                      <CheckCheck className="h-3.5 w-3.5" />
                      {kind.completeAction}
                    </Button>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {approvable.length > 1 && !closed ? (
        <Button
          variant="primary"
          size="sm"
          className="mt-3"
          onClick={() => approvable.forEach((task) => reviewFollowUp(caseId, task.id, "Approved"))}
        >
          <CheckCheck className="h-3.5 w-3.5" />
          Approve all {approvable.length}
        </Button>
      ) : null}
      <RoleNote className="mt-3" reason={approvalNote} switchTo={SERVICE_LEAD.id} />

      {canPropose ? (
        <div className={cn("space-y-2.5", active.length > 0 ? "mt-4 border-t border-line pt-4" : "mt-4")}>
          {suggestions.length > 0 ? (
            <>
              <p className={LABEL}>Suggested for &ldquo;{decision?.decision}&rdquo;</p>
              {suggestions.map((draft) => (
                <label
                  key={draft.title}
                  className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 transition-colors hover:bg-surface-2"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(draft.title)}
                    onChange={() => toggle(draft.title)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-garnet"
                  />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-ink">{draft.title}</span>
                    <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">{draft.detail}</span>
                    <KindNote kind={draft.kind} />
                  </span>
                </label>
              ))}
            </>
          ) : null}
          <label htmlFor={`${caseId}-custom-task`} className={cn(LABEL, "block pt-1")}>
            Another follow-up
          </label>
          <input
            id={`${caseId}-custom-task`}
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            placeholder="For example: Offer cascade testing to first-degree relatives"
            className={cn(TEXTAREA, "py-2")}
          />
          <Button
            className="w-full"
            onClick={propose}
            disabled={suggestions.filter((s) => selected.has(s.title)).length === 0 && !custom.trim()}
          >
            Propose for approval
          </Button>
        </div>
      ) : active.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-muted">
          {!decision
            ? "Follow-ups are proposed once a decision is recorded."
            : !settled
              ? "Held while further evidence is awaited. Record a final decision to propose follow-ups."
              : closed
                ? "The case closed without follow-up."
                : "No follow-up proposed."}
        </p>
      ) : null}
      {settled && !closed && !can("follow-up:propose") ? (
        <RoleNote className="mt-3" reason={denial(persona, "follow-up:propose")} switchTo="kassim" />
      ) : null}

      {earlier.length > 0 ? (
        <div className="mt-4 border-t border-line pt-3.5">
          <p className={LABEL}>From earlier decisions</p>
          <ul className="mt-2 space-y-1.5">
            {earlier.map((task) => (
              <li key={task.id} className="text-[12px] leading-relaxed text-muted">
                <Badge tone={STATUS_TONE[task.status]} className="mr-1.5">
                  {statusLabel(task)}
                </Badge>
                {task.title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

function KindNote({ kind }: { kind: FollowUpKind }) {
  return FOLLOW_UP_KINDS[kind].patientFacing ? (
    <span className="mt-1 block text-[11px] font-medium text-warn">Reaches a patient: needs approval</span>
  ) : (
    <span className="mt-1 block text-[11px] text-faint">Internal: still approved before it is done</span>
  );
}

/* -- Closure --------------------------------------------------------------- */

export function ClosureCard({ caseId, state }: CaseProps) {
  const { persona, can, closeCase, reopenCase } = useWorkspace();
  const [note, setNote] = React.useState("");
  const blocker = closureBlocker(state);
  const closeDenied = canCloseCase(persona, state.owner);
  const noteReady = note.trim().length >= CLOSURE_NOTE_MIN;

  if (state.closure) {
    const reopenDenied = denial(persona, "case:reopen");
    return (
      <Card className="p-5">
        <SectionHeading title="Closed" />
        <p className="mt-3 text-[13px] leading-relaxed text-ink-2">{state.closure.note}</p>
        <p className="mt-2 text-[11.5px] text-faint">
          {state.closure.by} · <Timestamp value={state.closure.at} className="vp-num" />
        </p>
        {!reopenDenied ? (
          <div className="mt-4 border-t border-line pt-4">
            <label htmlFor={`${caseId}-reopen`} className={LABEL}>
              Reason for reopening
            </label>
            <textarea
              id={`${caseId}-reopen`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              className={cn(TEXTAREA, "mt-2")}
            />
            <Button
              className="mt-2 w-full"
              disabled={!noteReady}
              onClick={() => {
                reopenCase(caseId, note);
                setNote("");
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Reopen case
            </Button>
          </div>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <SectionHeading
        title="Close the case"
        description="Closed by the case owner or the service lead, with a note. Reopening is recorded too."
      />
      {blocker ? (
        <p className="mt-3 text-[12.5px] leading-relaxed text-muted">{blocker}</p>
      ) : closeDenied ? (
        <RoleNote className="mt-3" reason={closeDenied} switchTo={SERVICE_LEAD.id} />
      ) : (
        <div className="mt-4">
          <label htmlFor={`${caseId}-closure`} className={LABEL}>
            Closing note
          </label>
          <textarea
            id={`${caseId}-closure`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            placeholder="What was done, and where any follow-up now sits"
            className={cn(TEXTAREA, "mt-2")}
          />
          <Button
            variant="primary"
            className="mt-2 w-full"
            disabled={!noteReady}
            onClick={() => {
              closeCase(caseId, note);
              setNote("");
            }}
          >
            <CheckCheck className="h-4 w-4" />
            Close case
          </Button>
          {!can("case:close") ? (
            <p className="mt-2 text-[11.5px] text-faint">You can close this case because you own it.</p>
          ) : null}
        </div>
      )}
    </Card>
  );
}

/* -- Outputs --------------------------------------------------------------- */

export function OutputsCard({ assessment, state }: CaseProps) {
  const { can, silentMode, persona } = useWorkspace();
  const decision = currentDecision(state.decisions);
  const letterReady = letterApproved(state);
  const exportDenied = denial(persona, "output:export");

  return (
    <Card className="p-5">
      <SectionHeading
        title="Outputs"
        description="What can leave the case: a brief for colleagues, a FHIR bundle for hospital systems, and a patient letter once one is approved."
      />
      <div className="mt-4 space-y-2">
        <EvidenceBriefButton assessment={assessment} state={state} />

        {silentMode ? (
          <p className="flex items-start gap-2 rounded-xl border border-warn-border bg-warn-soft px-3 py-2.5 text-[12px] leading-relaxed text-warn">
            <Lock className="mt-[3px] h-3 w-3 shrink-0" aria-hidden />
            Silent pilot: FHIR export and patient letters are held, so nothing reaches a patient or a hospital
            system. The evidence brief stays available for the review itself.
          </p>
        ) : exportDenied ? (
          <RoleNote reason={exportDenied} switchTo="kassim" />
        ) : (
          <>
            <FhirExportButton assessment={assessment} decision={decision} />
            {letterReady && can("follow-up:complete") ? (
              <PatientLetterButton assessment={assessment} />
            ) : (
              <p className="text-[11.5px] leading-relaxed text-faint">
                A patient letter is drafted only through an approved &ldquo;Patient explanation&rdquo; follow-up.
              </p>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
