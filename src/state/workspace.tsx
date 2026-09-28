"use client";

/**
 * Workspace session state.
 *
 * The analysis itself is computed on the server and is authoritative. What
 * lives here is what people do with it during a session: who is signed in,
 * each case's workflow (owner, decision, follow-ups, closure) and its history,
 * the running activity trail, the silent pilot's settings and adjudications,
 * the last data import, and the state of an in-flight evidence sync.
 *
 * All of it is held in this browser tab's session storage and never written to
 * any record system or server. That is deliberate: VariantPulse raises a case,
 * a clinician decides the outcome, and the record of record stays where it is.
 * Closing the tab, or deleting the session from Trust & governance, removes it.
 *
 * Every action checks the signed-in role itself, as well as the interface
 * offering only what the role may do, so a control that slipped through the
 * interface still cannot act.
 *
 * Case state is keyed by variant, not by case identifier. A case identifier is
 * a position in the priority order, so a live resync that reorders the queue
 * would otherwise move an owner or a decision onto a different variant.
 */

import * as React from "react";
import type { ClientAnalysis } from "@/lib/dto";
import type { VariantAssessment } from "@/lib/analysis";
import {
  currentDecision,
  isDecisionNoteValid,
  isSettled,
  type Decision,
  type DecisionRecord,
} from "@/lib/decision";
import { EVIDENCE_MODES } from "@/lib/evidence-mode";
import { parseScanTiming } from "@/lib/impact";
import { composeReviewReason, workspaceScope } from "@/lib/narrative";
import type { ImportTotals } from "@/lib/onboarding";
import {
  ADJUDICATION,
  UNSET_CRITERIA,
  type Adjudication,
  type AdjudicationLabel,
  type SuccessCriteria,
} from "@/lib/pilot";
import { ROLES, can as roleCan, canApproveFollowUp, canCloseCase, type Permission } from "@/lib/roles";
import { formatDate } from "@/lib/utils";
import {
  CLOSURE_NOTE_MIN,
  FOLLOW_UP_KINDS,
  closureBlocker,
  emptyCase,
  needsEscalation,
  reviewDeadline,
  supersedeFollowUps,
  type CaseEvent,
  type CaseEventType,
  type CaseState,
  type FollowUpDraft,
  type FollowUpTask,
} from "@/lib/workflow";
import { DEFAULT_PERSONA, PERSONA_BY_ID, SERVICE_LEAD, type Persona } from "@/data/workspace";

export type { CaseState } from "@/lib/workflow";

export interface ActivityEntry {
  id: string;
  at: string;
  title: string;
  detail?: string;
  /** Who performed the action: a named person, or VariantPulse for engine events. */
  actor: string;
  /** The actor's role at the time. */
  role?: string;
  caseId?: string;
  kind:
    | "sync"
    | "detection"
    | "impact"
    | "case"
    | "assignment"
    | "note"
    | "evidence-request"
    | "follow-up"
    | "approval"
    | "review"
    | "escalation"
    | "closure"
    | "import"
    | "pilot"
    | "session";
}

export type SyncStage =
  | { phase: "idle" }
  | { phase: "running"; step: number; label: string; detail: string }
  | { phase: "done"; at: string; changed: number; impacted: number };

export interface ImportSummary {
  fileName: string | null;
  at: string;
  by: string;
  totals: ImportTotals;
}

interface WorkspaceValue {
  analysis: ClientAnalysis;
  /** How long the analysis run behind `analysis` took, in milliseconds. */
  scanMs: number | null;
  sync: SyncStage;
  runSync: () => Promise<void>;
  /** False until session state has been restored from storage. */
  hydrated: boolean;
  /** What deadlines are judged against; ticks each minute. Null until hydrated. */
  now: Date | null;

  persona: Persona;
  switchPersona: (id: string) => void;
  can: (permission: Permission) => boolean;

  /** Case state by variant key. Read a case through `getCase`. */
  cases: Record<string, CaseState>;
  getCase: (caseId: string) => CaseState;
  assignOwner: (caseId: string, owner: string) => void;
  openReview: (caseId: string) => void;
  requestEvidence: (caseId: string, detail: string) => void;
  /** Records a decision, or an amendment when the case already has one. */
  recordDecision: (caseId: string, decision: Decision, rationale: string) => void;
  proposeFollowUps: (caseId: string, drafts: FollowUpDraft[]) => void;
  reviewFollowUp: (caseId: string, taskId: string, verdict: "Approved" | "Declined", note?: string) => void;
  /** The proposer takes back a follow-up nobody has approved yet. */
  withdrawFollowUp: (caseId: string, taskId: string) => void;
  completeFollowUp: (caseId: string, taskId: string) => void;
  closeCase: (caseId: string, note: string) => void;
  reopenCase: (caseId: string, reason: string) => void;
  /** `summary` marks an evidence summary filed for the brief. */
  addNote: (caseId: string, body: string, kind?: "note" | "summary") => void;

  activity: ActivityEntry[];

  /** While on, nothing reaches a patient and nothing is exported to hospital systems. */
  silentMode: boolean;
  setSilentMode: (on: boolean) => void;
  adjudications: Record<string, Adjudication>;
  /** Labels a variant for the pilot evaluation; null clears the label. */
  adjudicate: (variantKey: string, label: AdjudicationLabel | null, note?: string) => void;
  loadReferenceSet: (adjudications: Adjudication[], fileName: string | null) => void;
  criteria: SuccessCriteria;
  setCriteria: (criteria: SuccessCriteria) => void;

  lastImport: ImportSummary | null;
  recordImport: (summary: Omit<ImportSummary, "at" | "by">) => void;

  /** Deletes everything this session holds and starts again. */
  clearSession: () => void;
}

const WorkspaceContext = React.createContext<WorkspaceValue | null>(null);

// v5: case state keyed by variant, and follow-ups tied to the decision they
// serve. Earlier shapes are discarded rather than migrated.
const STORAGE_KEY = "variantpulse.session.v5";
const RETIRED_KEYS = [
  "variantpulse.session.v4",
  "variantpulse.session.v3",
  "variantpulse.session.v2",
  "variantpulse.session.v1",
];

const SYNC_STEPS = [
  { label: "Reading historical findings", detail: "Opening the connected record system" },
  { label: "Normalising variant nomenclature", detail: "Resolving HGVS to stable identifiers" },
  { label: "Retrieving current evidence", detail: "Querying ClinVar for each monitored variant" },
  { label: "Comparing classifications", detail: "Diffing recorded against current interpretation" },
  { label: "Comparing regional evidence", detail: "Checking the regional index for divergence" },
  { label: "Mapping impacted records", detail: "Identifying findings that carry a changed variant" },
  { label: "Preparing evidence briefs", detail: "Composing summaries from the cited records" },
];

const SYSTEM_ACTOR = "VariantPulse";
const SYSTEM_ROLE = "System";

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Seeds the trail with the work the engine has already done. */
function seedActivity(analysis: ClientAnalysis): ActivityEntry[] {
  const base = new Date(analysis.checkedAt).getTime();
  const at = (offsetSeconds: number) => new Date(base + offsetSeconds * 1000).toISOString();
  const entries: ActivityEntry[] = [
    {
      id: "seed-sync",
      at: at(0),
      kind: "sync",
      actor: SYSTEM_ACTOR,
      role: SYSTEM_ROLE,
      title: "Evidence sync completed",
      detail: `${analysis.scan.findingsChecked.toLocaleString("en-US")} findings checked against ${EVIDENCE_MODES[analysis.mode].noun} evidence`,
    },
  ];

  const reviewable = analysis.assessments
    .filter((a) => a.caseId)
    .sort((a, b) => (a.caseId ?? "").localeCompare(b.caseId ?? ""));

  reviewable.forEach((assessment, index) => {
    const caseId = assessment.caseId ?? undefined;
    const label = `${assessment.variant.gene} ${assessment.variant.hgvsCoding}`;
    entries.push(
      {
        id: `seed-detect-${assessment.variant.key}`,
        at: at(30 + index * 22),
        kind: "detection",
        actor: SYSTEM_ACTOR,
        role: SYSTEM_ROLE,
        caseId,
        title: composeReviewReason(assessment.changeType, assessment.variant.gene),
        detail: label,
      },
      {
        id: `seed-impact-${assessment.variant.key}`,
        at: at(38 + index * 22),
        kind: "impact",
        actor: SYSTEM_ACTOR,
        role: SYSTEM_ROLE,
        caseId,
        title: `${assessment.impactedRecordCount} historical record${assessment.impactedRecordCount === 1 ? "" : "s"} mapped`,
        detail: label,
      },
      {
        id: `seed-case-${assessment.variant.key}`,
        at: at(46 + index * 22),
        kind: "case",
        actor: SYSTEM_ACTOR,
        role: SYSTEM_ROLE,
        caseId,
        title: `Clinical review case ${assessment.caseId} created`,
        detail: `Priority ${assessment.priority.level.toLowerCase()}`,
      },
    );
  });

  return entries.sort((a, b) => b.at.localeCompare(a.at));
}

interface Persisted {
  /** When this session's cases were raised; deadlines run from here. */
  raisedAt: string;
  /** Case state by variant key. */
  personaId: string;
  cases: Record<string, CaseState>;
  activity: ActivityEntry[];
  silentMode: boolean;
  adjudications: Record<string, Adjudication>;
  criteria: SuccessCriteria;
  lastImport: ImportSummary | null;
}

export function WorkspaceProvider({
  initial,
  initialScanMs = null,
  children,
}: {
  initial: ClientAnalysis;
  /** Measured on the server around the analysis run that produced `initial`. */
  initialScanMs?: number | null;
  children: React.ReactNode;
}) {
  const [analysis, setAnalysis] = React.useState(initial);
  const [scanMs, setScanMs] = React.useState<number | null>(initialScanMs);
  const [raisedAt, setRaisedAt] = React.useState(initial.checkedAt);
  const [personaId, setPersonaId] = React.useState(DEFAULT_PERSONA.id);
  const [cases, setCases] = React.useState<Record<string, CaseState>>({});
  const [activity, setActivity] = React.useState<ActivityEntry[]>(() => seedActivity(initial));
  const [silentMode, setSilentModeState] = React.useState(false);
  const [adjudications, setAdjudications] = React.useState<Record<string, Adjudication>>({});
  const [criteria, setCriteriaState] = React.useState<SuccessCriteria>(UNSET_CRITERIA);
  const [lastImport, setLastImport] = React.useState<ImportSummary | null>(null);
  const [sync, setSync] = React.useState<SyncStage>({ phase: "idle" });
  const [hydrated, setHydrated] = React.useState(false);
  const [now, setNow] = React.useState<Date | null>(null);

  const persona = PERSONA_BY_ID.get(personaId) ?? DEFAULT_PERSONA;
  const roleLabel = ROLES[persona.role].label;

  // Session state is restored after mount so the server and first client render
  // agree, which keeps hydration clean.
  React.useEffect(() => {
    try {
      for (const key of RETIRED_KEYS) sessionStorage.removeItem(key);
      const raw = sessionStorage.getItem(STORAGE_KEY);
      const saved = raw ? (JSON.parse(raw) as Partial<Persisted>) : null;
      // A case is raised in this workspace when the session first sees it. In
      // demo mode the evidence read carries the snapshot's fixed date, which
      // would put every deadline in the past once that date is far enough
      // behind; the session's own start is the honest clock.
      setRaisedAt(saved?.raisedAt ?? new Date().toISOString());
      if (saved) {
        if (saved.personaId && PERSONA_BY_ID.has(saved.personaId)) setPersonaId(saved.personaId);
        if (saved.cases) setCases(saved.cases);
        if (saved.activity?.length) setActivity(saved.activity);
        if (typeof saved.silentMode === "boolean") setSilentModeState(saved.silentMode);
        if (saved.adjudications) setAdjudications(saved.adjudications);
        if (saved.criteria) setCriteriaState({ ...UNSET_CRITERIA, ...saved.criteria });
        if (saved.lastImport) setLastImport(saved.lastImport);
      }
    } catch {
      // A blocked or unavailable sessionStorage is not an error worth showing.
    }
    setNow(new Date());
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, [hydrated]);

  React.useEffect(() => {
    if (!hydrated) return;
    const saved: Persisted = {
      raisedAt,
      personaId,
      cases,
      activity,
      silentMode,
      adjudications,
      criteria,
      lastImport,
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      // Ignore quota or private-mode failures.
    }
  }, [hydrated, raisedAt, personaId, cases, activity, silentMode, adjudications, criteria, lastImport]);

  /* -- Recording ----------------------------------------------------------- */

  const log = React.useCallback((entry: Omit<ActivityEntry, "id" | "at"> & { at?: string }) => {
    setActivity((prev) => [{ ...entry, id: newId(), at: entry.at ?? new Date().toISOString() }, ...prev]);
  }, []);

  const withDefaults = React.useCallback(
    (state: CaseState | undefined): CaseState => ({ ...emptyCase(), raisedAt, ...state }),
    [raisedAt],
  );

  const byCase = React.useMemo(
    () => new Map(analysis.assessments.filter((a) => a.caseId).map((a) => [a.caseId as string, a])),
    [analysis],
  );

  /** The variant a case identifier currently belongs to: where its state is kept. */
  const keyOf = React.useCallback((caseId: string) => byCase.get(caseId)?.variant.key ?? caseId, [byCase]);

  /** A case's state as of this render. */
  const read = React.useCallback(
    (caseId: string) => withDefaults(cases[keyOf(caseId)]),
    [cases, keyOf, withDefaults],
  );

  const getCase = read;

  /** Applies a change to one case and appends its history entry in the same update. */
  const change = React.useCallback(
    (
      caseId: string,
      type: CaseEventType,
      summary: string,
      apply: (state: CaseState, at: string) => CaseState,
      detail?: string,
    ) => {
      const at = new Date().toISOString();
      const event: CaseEvent = {
        id: newId(),
        at,
        type,
        actor: persona.name,
        role: roleLabel,
        summary,
        ...(detail ? { detail } : {}),
      };
      const key = keyOf(caseId);
      setCases((prev) => {
        const next = apply(withDefaults(prev[key]), at);
        return { ...prev, [key]: { ...next, events: [...next.events, event] } };
      });
    },
    [persona.name, roleLabel, withDefaults, keyOf],
  );

  const allowed = React.useCallback((permission: Permission) => roleCan(persona.role, permission), [persona.role]);

  /* -- Evidence sync ------------------------------------------------------- */

  const runSync = React.useCallback(async () => {
    setSync({ phase: "running", step: 0, label: SYNC_STEPS[0].label, detail: SYNC_STEPS[0].detail });

    // The request and the stage animation run together: the animation paces the
    // interface, the request decides the result.
    const request = fetch("/api/sync", { method: "POST" })
      .then(async (r) =>
        r.ok
          ? {
              analysis: (await r.json()) as ClientAnalysis,
              durationMs: parseScanTiming(r.headers.get("Server-Timing")),
            }
          : null,
      )
      .catch(() => null);

    for (let step = 0; step < SYNC_STEPS.length; step += 1) {
      setSync({ phase: "running", step, label: SYNC_STEPS[step].label, detail: SYNC_STEPS[step].detail });
      await new Promise((resolve) => setTimeout(resolve, 340));
    }

    const next = await request;
    if (next) {
      setAnalysis(next.analysis);
      if (next.durationMs !== null) setScanMs(next.durationMs);
    }

    const result = next?.analysis ?? analysis;
    setSync({
      phase: "done",
      at: new Date().toISOString(),
      changed: result.metrics.evidenceChanges,
      impacted: result.metrics.patientsImpacted,
    });

    log({
      kind: "sync",
      actor: SYSTEM_ACTOR,
      role: SYSTEM_ROLE,
      title: "Evidence sync completed",
      detail: `${result.scan.findingsChecked.toLocaleString("en-US")} findings checked against ${EVIDENCE_MODES[result.mode].noun} evidence · ${workspaceScope(result.metrics)}`,
    });
  }, [analysis, log]);

  /* -- Escalation ----------------------------------------------------------
     An open case that passes its review deadline with no documented decision
     goes to the service lead, once, and the history says so. */

  React.useEffect(() => {
    if (!hydrated || !now) return;
    const due: VariantAssessment[] = [];
    for (const assessment of byCase.values()) {
      if (needsEscalation(withDefaults(cases[assessment.variant.key]), assessment.priority.level, now)) {
        due.push(assessment);
      }
    }
    if (due.length === 0) return;

    const at = now.toISOString();
    setCases((prev) => {
      const next = { ...prev };
      for (const assessment of due) {
        const key = assessment.variant.key;
        const state = withDefaults(prev[key]);
        if (!needsEscalation(state, assessment.priority.level, now)) continue;
        const dueAt = reviewDeadline(state.raisedAt ?? raisedAt, assessment.priority.level);
        next[key] = {
          ...state,
          escalatedAt: at,
          events: [
            ...state.events,
            {
              id: newId(),
              at,
              type: "escalated",
              actor: SYSTEM_ACTOR,
              role: SYSTEM_ROLE,
              summary: `Escalated to ${SERVICE_LEAD.name}, ${SERVICE_LEAD.title}`,
              detail: `The review deadline of ${formatDate(dueAt)} passed with no documented decision.`,
            },
          ],
        };
      }
      return next;
    });
    for (const assessment of due) {
      log({
        kind: "escalation",
        actor: SYSTEM_ACTOR,
        role: SYSTEM_ROLE,
        caseId: assessment.caseId ?? undefined,
        title: `${assessment.caseId} escalated to ${SERVICE_LEAD.name}`,
        detail: "Review deadline passed with no documented decision.",
      });
    }
  }, [hydrated, now, byCase, cases, withDefaults, raisedAt, log]);

  /* -- Identity ------------------------------------------------------------ */

  const switchPersona = React.useCallback(
    (id: string) => {
      const next = PERSONA_BY_ID.get(id);
      if (!next || next.id === personaId) return;
      setPersonaId(next.id);
      log({
        kind: "session",
        actor: next.name,
        role: ROLES[next.role].label,
        title: `Signed in as ${next.name}`,
        detail: `${ROLES[next.role].label} · demonstration identity`,
      });
    },
    [personaId, log],
  );

  /* -- Review actions ------------------------------------------------------
     None of them changes a classification or a diagnosis; each one is written
     to the case history and the audit trail with the acting person, their
     role and a timestamp. */

  const assignOwner = React.useCallback(
    (caseId: string, owner: string) => {
      const state = read(caseId);
      if (!owner || owner === state.owner || state.closure) return;
      // A reviewer can take a case on; handing it to someone else, or
      // reassigning it, is the service lead's.
      const self = owner === persona.name && !state.owner;
      if (!(allowed("case:assign") || (self && allowed("case:own")))) return;

      const summary = state.owner ? `Owner changed to ${owner}` : self ? `${owner} took ownership` : `${owner} assigned as owner`;
      change(caseId, "owner", summary, (s) => ({ ...s, owner }), state.owner ? `Previously ${state.owner}.` : undefined);
      log({ kind: "assignment", actor: persona.name, role: roleLabel, caseId, title: `${summary} on ${caseId}` });
    },
    [read, persona.name, roleLabel, allowed, change, log],
  );

  const openReview = React.useCallback(
    (caseId: string) => {
      const state = read(caseId);
      if (!allowed("case:review") || state.reviewOpenedAt || state.closure) return;
      // Opening an unowned case takes ownership of it: someone is accountable
      // from the moment review starts.
      if (!state.owner) {
        if (!allowed("case:own")) return;
        change(caseId, "owner", `${persona.name} took ownership`, (s) => ({ ...s, owner: persona.name }));
        log({ kind: "assignment", actor: persona.name, role: roleLabel, caseId, title: `${persona.name} took ownership of ${caseId}` });
      }
      change(caseId, "review-opened", "Clinical review opened", (s, at) => ({ ...s, reviewOpenedAt: at }));
      log({ kind: "case", actor: persona.name, role: roleLabel, caseId, title: `Clinical review opened on ${caseId}` });
    },
    [read, persona.name, roleLabel, allowed, change, log],
  );

  const requestEvidence = React.useCallback(
    (caseId: string, detail: string) => {
      const state = read(caseId);
      if (!allowed("case:review") || state.evidenceRequested || state.closure) return;
      change(caseId, "evidence-request", "More evidence requested", (s) => ({ ...s, evidenceRequested: true }), detail);
      log({ kind: "evidence-request", actor: persona.name, role: roleLabel, caseId, title: `More evidence requested for ${caseId}`, detail });
    },
    [read, persona.name, roleLabel, allowed, change, log],
  );

  /* A decision is appended, never written over. When the case already has one
     the new entry is an amendment, and the history says what it replaced. */
  const recordDecision = React.useCallback(
    (caseId: string, decision: Decision, rationale: string) => {
      const body = rationale.trim();
      const state = read(caseId);
      if (!allowed("case:decide") || !isDecisionNoteValid(body) || !state.owner || state.closure) return;

      const previous = currentDecision(state.decisions);
      const record: DecisionRecord = { decision, note: body, reviewer: persona.name, at: new Date().toISOString() };
      const superseded = previous
        ? state.followUps.filter(
            (t) => t.decisionAt === previous.at && (t.status === "Proposed" || t.status === "Approved"),
          ).length
        : 0;
      change(
        caseId,
        previous ? "amendment" : "decision",
        previous ? `Decision amended to ${decision}` : `Decision: ${decision}`,
        (s, at) => ({
          ...s,
          decisions: [...s.decisions, record],
          // Follow-ups still open under the replaced decision no longer apply.
          followUps: previous ? supersedeFollowUps(s.followUps, previous.at, at) : s.followUps,
        }),
        previous
          ? `Previously ${previous.decision}. Rationale: ${body}${superseded ? ` ${superseded} open follow-up${superseded === 1 ? " was" : "s were"} superseded.` : ""}`
          : `Rationale: ${body}`,
      );
      log({
        kind: "review",
        actor: persona.name,
        role: roleLabel,
        caseId,
        title: previous ? `Decision on ${caseId} amended to ${decision}` : `Decision on ${caseId}: ${decision}`,
        detail: previous ? `Previously ${previous.decision}. Rationale: ${body}` : `Rationale: ${body}`,
      });
    },
    [read, persona.name, roleLabel, allowed, change, log],
  );

  const proposeFollowUps = React.useCallback(
    (caseId: string, drafts: FollowUpDraft[]) => {
      const state = read(caseId);
      const decision = currentDecision(state.decisions);
      if (!allowed("follow-up:propose") || !decision || !isSettled(decision.decision) || state.closure) return;
      const valid = drafts.filter((d) => d.title.trim() && d.detail.trim());
      if (valid.length === 0) return;

      const at = new Date().toISOString();
      const tasks: FollowUpTask[] = valid.map((draft) => ({
        id: newId(),
        kind: draft.kind,
        title: draft.title.trim(),
        detail: draft.detail.trim(),
        status: "Proposed",
        proposedBy: persona.name,
        proposedAt: at,
        decisionAt: decision.at,
      }));
      change(
        caseId,
        "follow-up-proposed",
        tasks.length === 1 ? `Follow-up proposed: ${tasks[0].title}` : `${tasks.length} follow-ups proposed`,
        (s) => ({ ...s, followUps: [...s.followUps, ...tasks] }),
        tasks.map((t) => t.title).join("; "),
      );
      log({
        kind: "follow-up",
        actor: persona.name,
        role: roleLabel,
        caseId,
        title: `${tasks.length} follow-up${tasks.length === 1 ? "" : "s"} proposed on ${caseId}, awaiting approval`,
        detail: tasks.map((t) => t.title).join("; "),
      });
    },
    [read, persona.name, roleLabel, allowed, change, log],
  );

  const reviewFollowUp = React.useCallback(
    (caseId: string, taskId: string, verdict: "Approved" | "Declined", note?: string) => {
      const state = read(caseId);
      const task = state.followUps.find((t) => t.id === taskId);
      if (!task || task.status !== "Proposed" || state.closure) return;
      if (task.decisionAt !== currentDecision(state.decisions)?.at) return;
      if (canApproveFollowUp(persona, task.proposedBy)) return;
      const reason = note?.trim() || undefined;

      change(
        caseId,
        verdict === "Approved" ? "follow-up-approved" : "follow-up-declined",
        `${verdict}: ${task.title}`,
        (s, at) => ({
          ...s,
          followUps: s.followUps.map((t) =>
            t.id === taskId ? { ...t, status: verdict, reviewedBy: persona.name, reviewedAt: at, reviewNote: reason } : t,
          ),
        }),
        `Proposed by ${task.proposedBy}.${reason ? ` ${reason}` : ""}`,
      );
      log({
        kind: "approval",
        actor: persona.name,
        role: roleLabel,
        caseId,
        title: `${task.title} ${verdict.toLowerCase()} on ${caseId}`,
        detail: `Proposed by ${task.proposedBy}.${reason ? ` ${reason}` : ""}`,
      });
    },
    [read, persona, roleLabel, change, log],
  );

  const withdrawFollowUp = React.useCallback(
    (caseId: string, taskId: string) => {
      const state = read(caseId);
      const task = state.followUps.find((t) => t.id === taskId);
      if (!task || task.status !== "Proposed" || state.closure || task.proposedBy !== persona.name) return;

      change(caseId, "follow-up-withdrawn", `Withdrawn: ${task.title}`, (s, at) => ({
        ...s,
        followUps: s.followUps.map((t) =>
          t.id === taskId ? { ...t, status: "Withdrawn", reviewedBy: persona.name, reviewedAt: at } : t,
        ),
      }));
      log({ kind: "follow-up", actor: persona.name, role: roleLabel, caseId, title: `${task.title} withdrawn on ${caseId}` });
    },
    [read, persona.name, roleLabel, change, log],
  );

  const completeFollowUp = React.useCallback(
    (caseId: string, taskId: string) => {
      const state = read(caseId);
      const task = state.followUps.find((t) => t.id === taskId);
      if (!task || task.status !== "Approved" || !allowed("follow-up:complete")) return;
      if (task.decisionAt !== currentDecision(state.decisions)?.at) return;
      if (silentMode && FOLLOW_UP_KINDS[task.kind].patientFacing) return;
      const done = FOLLOW_UP_KINDS[task.kind].doneLabel;

      change(caseId, "follow-up-done", `${done}: ${task.title}`, (s, at) => ({
        ...s,
        followUps: s.followUps.map((t) =>
          t.id === taskId ? { ...t, status: "Done", completedBy: persona.name, completedAt: at } : t,
        ),
      }));
      log({ kind: "follow-up", actor: persona.name, role: roleLabel, caseId, title: `${done} on ${caseId}`, detail: task.title });
    },
    [read, persona.name, roleLabel, allowed, silentMode, change, log],
  );

  const closeCase = React.useCallback(
    (caseId: string, note: string) => {
      const body = note.trim();
      const state = read(caseId);
      if (body.length < CLOSURE_NOTE_MIN || closureBlocker(state) || canCloseCase(persona, state.owner)) return;

      change(caseId, "closed", "Case closed", (s, at) => ({ ...s, closure: { by: persona.name, at, note: body } }), body);
      log({ kind: "closure", actor: persona.name, role: roleLabel, caseId, title: `${caseId} closed`, detail: body });
    },
    [read, persona, roleLabel, change, log],
  );

  const reopenCase = React.useCallback(
    (caseId: string, reason: string) => {
      const body = reason.trim();
      const state = read(caseId);
      if (!state.closure || !allowed("case:reopen") || body.length < CLOSURE_NOTE_MIN) return;

      change(caseId, "reopened", "Case reopened", (s) => ({ ...s, closure: null }), body);
      log({ kind: "closure", actor: persona.name, role: roleLabel, caseId, title: `${caseId} reopened`, detail: body });
    },
    [read, persona.name, roleLabel, allowed, change, log],
  );

  const addNote = React.useCallback(
    (caseId: string, body: string, kind: "note" | "summary" = "note") => {
      const text = body.trim();
      if (!text || !allowed("case:review")) return;
      change(caseId, kind, kind === "summary" ? "Evidence summary filed for the brief" : "Note added", (s) => s, text);
      log({
        kind: "note",
        actor: persona.name,
        role: roleLabel,
        caseId,
        title: kind === "summary" ? `Evidence summary added to ${caseId}` : `Note added to ${caseId}`,
        detail: text.slice(0, 96),
      });
    },
    [persona.name, roleLabel, allowed, change, log],
  );

  /* -- Silent pilot -------------------------------------------------------- */

  const setSilentMode = React.useCallback(
    (on: boolean) => {
      if (on === silentMode || !allowed("pilot:configure")) return;
      setSilentModeState(on);
      log({
        kind: "pilot",
        actor: persona.name,
        role: roleLabel,
        title: on ? "Silent pilot mode switched on" : "Silent pilot mode switched off",
        detail: on
          ? "Patient-facing follow-ups, patient letters and exports to hospital systems are held. Review continues for evaluation."
          : "Patient-facing follow-ups and exports are available again.",
      });
    },
    [silentMode, allowed, persona.name, roleLabel, log],
  );

  const adjudicate = React.useCallback(
    (variantKey: string, label: AdjudicationLabel | null, note?: string) => {
      if (!allowed("pilot:adjudicate")) return;
      const name = variantKey.replace(":", " ");
      setAdjudications((prev) => {
        const next = { ...prev };
        if (label) {
          next[variantKey] = {
            variantKey,
            label,
            reviewer: persona.name,
            at: new Date().toISOString(),
            ...(note?.trim() ? { note: note.trim() } : {}),
            source: "session",
          };
        } else {
          delete next[variantKey];
        }
        return next;
      });
      log({
        kind: "pilot",
        actor: persona.name,
        role: roleLabel,
        title: label ? `Adjudicated ${name}: ${ADJUDICATION[label].label}` : `Adjudication cleared for ${name}`,
        ...(note?.trim() ? { detail: note.trim() } : {}),
      });
    },
    [allowed, persona.name, roleLabel, log],
  );

  const loadReferenceSet = React.useCallback(
    (loaded: Adjudication[], fileName: string | null) => {
      if (!allowed("pilot:configure") || loaded.length === 0) return;
      setAdjudications((prev) => {
        const next = { ...prev };
        for (const adjudication of loaded) next[adjudication.variantKey] = adjudication;
        return next;
      });
      log({
        kind: "pilot",
        actor: persona.name,
        role: roleLabel,
        title: `Reference set loaded: ${loaded.length} label${loaded.length === 1 ? "" : "s"}`,
        detail: fileName ?? undefined,
      });
    },
    [allowed, persona.name, roleLabel, log],
  );

  const setCriteria = React.useCallback(
    (next: SuccessCriteria) => {
      if (!allowed("pilot:configure")) return;
      setCriteriaState(next);
      log({
        kind: "pilot",
        actor: persona.name,
        role: roleLabel,
        title: "Pilot success criteria updated",
        detail: next.agreedWith ? `Agreed with ${next.agreedWith}` : "Not yet marked as agreed with the partner",
      });
    },
    [allowed, persona.name, roleLabel, log],
  );

  /* -- Onboarding ---------------------------------------------------------- */

  const recordImport = React.useCallback(
    (summary: Omit<ImportSummary, "at" | "by">) => {
      if (!allowed("data:import")) return;
      const entry: ImportSummary = { ...summary, at: new Date().toISOString(), by: persona.name };
      setLastImport(entry);
      const { totals } = summary;
      log({
        kind: "import",
        actor: persona.name,
        role: roleLabel,
        title: `Import report reviewed${summary.fileName ? `: ${summary.fileName}` : ""}`,
        detail: `${totals.accepted + totals.withWarnings} of ${totals.rows} rows would be accepted (${totals.withWarnings} with warnings), ${totals.rejected} rejected, ${totals.unmatched} unmatched, ${totals.conflicts} with conflicting identifiers.`,
      });
    },
    [allowed, persona.name, roleLabel, log],
  );

  /* -- Session ------------------------------------------------------------- */

  const clearSession = React.useCallback(() => {
    if (!allowed("session:delete")) return;
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing stored to remove.
    }
    const at = new Date().toISOString();
    setRaisedAt(at);
    setPersonaId(DEFAULT_PERSONA.id);
    setCases({});
    setSilentModeState(false);
    setAdjudications({});
    setCriteriaState(UNSET_CRITERIA);
    setLastImport(null);
    setActivity([
      {
        id: newId(),
        at,
        kind: "session",
        actor: persona.name,
        role: roleLabel,
        title: "Session data deleted",
        detail: "Case workflow, history, adjudications and import summaries for this session were removed.",
      },
      ...seedActivity(analysis),
    ]);
  }, [analysis, persona.name, roleLabel, allowed]);

  const value = React.useMemo<WorkspaceValue>(
    () => ({
      analysis,
      scanMs,
      sync,
      runSync,
      hydrated,
      now,
      persona,
      switchPersona,
      can: allowed,
      cases,
      getCase,
      assignOwner,
      openReview,
      requestEvidence,
      recordDecision,
      proposeFollowUps,
      reviewFollowUp,
      withdrawFollowUp,
      completeFollowUp,
      closeCase,
      reopenCase,
      addNote,
      activity,
      silentMode,
      setSilentMode,
      adjudications,
      adjudicate,
      loadReferenceSet,
      criteria,
      setCriteria,
      lastImport,
      recordImport,
      clearSession,
    }),
    [
      analysis,
      scanMs,
      sync,
      runSync,
      hydrated,
      now,
      persona,
      switchPersona,
      allowed,
      cases,
      getCase,
      assignOwner,
      openReview,
      requestEvidence,
      recordDecision,
      proposeFollowUps,
      reviewFollowUp,
      withdrawFollowUp,
      completeFollowUp,
      closeCase,
      reopenCase,
      addNote,
      activity,
      silentMode,
      setSilentMode,
      adjudications,
      adjudicate,
      loadReferenceSet,
      criteria,
      setCriteria,
      lastImport,
      recordImport,
      clearSession,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const context = React.useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return context;
}

/** Convenience lookup used by the pages that render a single case. */
export function useAssessment(variantKey: string): VariantAssessment | undefined {
  const { analysis } = useWorkspace();
  return analysis.assessments.find((a) => a.variant.key === variantKey);
}

export { SYNC_STEPS };
