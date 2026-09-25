"use client";

/**
 * Workspace session state.
 *
 * The analysis itself is computed on the server and is authoritative. What
 * lives here is the part a reviewer changes during a session: case assignment,
 * notes, status, the running activity trail, and the state of an in-flight
 * evidence sync.
 *
 * Workflow state is held for the session only and is never written back to any
 * record system. That is deliberate: VariantPulse raises a case, a clinician
 * decides the outcome, and the record of record stays where it is.
 */

import * as React from "react";
import type { ClientAnalysis } from "@/lib/dto";
import type { VariantAssessment } from "@/lib/analysis";
import {
  currentDecision,
  isDecisionNoteValid,
  type Decision,
  type DecisionRecord,
} from "@/lib/decision";
import { EVIDENCE_MODES } from "@/lib/evidence-mode";
import { parseScanTiming } from "@/lib/impact";
import { composeReviewReason, workspaceScope } from "@/lib/narrative";
import { CURRENT_USER } from "@/data/workspace";

export type CaseStatus = "Needs review" | "Assigned" | "In review" | "Reviewed";

export interface CaseNote {
  id: string;
  author: string;
  body: string;
  at: string;
  kind?:
    | "note"
    | "review-opened"
    | "assignment"
    | "evidence-request"
    | "follow-up"
    | "decision"
    | "amendment";
}

export interface CaseState {
  status: CaseStatus;
  assignee: string | null;
  notes: CaseNote[];
  evidenceRequested: boolean;
  followUps: number;
  /**
   * The clinician's decisions, oldest first: the decision as made, then each
   * amendment. Appended to, never rewritten. Never a classification.
   */
  decisions: DecisionRecord[];
}

export interface ActivityEntry {
  id: string;
  at: string;
  title: string;
  detail?: string;
  /** Who performed the action: a named clinician, or VariantPulse for engine events. */
  actor: string;
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
    | "review";
}

export type SyncStage =
  | { phase: "idle" }
  | { phase: "running"; step: number; label: string; detail: string }
  | { phase: "done"; at: string; changed: number; impacted: number };

interface WorkspaceValue {
  analysis: ClientAnalysis;
  /** How long the analysis run behind `analysis` took, in milliseconds. */
  scanMs: number | null;
  cases: Record<string, CaseState>;
  activity: ActivityEntry[];
  sync: SyncStage;
  runSync: () => Promise<void>;
  getCase: (caseId: string) => CaseState;
  openReview: (caseId: string) => void;
  requestEvidence: (caseId: string, detail: string) => void;
  assignReviewer: (caseId: string, assignee: string) => void;
  createFollowUp: (caseId: string, body: string) => void;
  /** Records a decision, or an amendment when the case already has one. */
  recordDecision: (caseId: string, decision: Decision, clinicianNote: string) => void;
  addNote: (caseId: string, body: string) => void;
}

const WorkspaceContext = React.createContext<WorkspaceValue | null>(null);

// v3: a case carries a decision history in place of a single review note.
const STORAGE_KEY = "variantpulse.session.v3";

const SYNC_STEPS = [
  { label: "Reading historical findings", detail: "Opening the connected record system" },
  { label: "Normalising variant nomenclature", detail: "Resolving HGVS to stable identifiers" },
  { label: "Retrieving current evidence", detail: "Querying ClinVar for each monitored variant" },
  { label: "Comparing classifications", detail: "Diffing recorded against current interpretation" },
  { label: "Comparing regional evidence", detail: "Checking the regional index for divergence" },
  { label: "Mapping impacted records", detail: "Identifying findings that carry a changed variant" },
  { label: "Preparing evidence briefs", detail: "Composing summaries from the cited records" },
];

function defaultCase(): CaseState {
  return {
    status: "Needs review",
    assignee: null,
    notes: [],
    evidenceRequested: false,
    followUps: 0,
    decisions: [],
  };
}

/** Fills in any field a case saved by an earlier build does not carry. */
function withDefaults(state: CaseState | undefined): CaseState {
  return { ...defaultCase(), ...state };
}

const SYSTEM_ACTOR = "VariantPulse";

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
      title: "Evidence sync completed",
      detail: `${analysis.scan.findingsChecked.toLocaleString("en-US")} findings checked against ${EVIDENCE_MODES[analysis.mode].noun} evidence`,
    },
  ];

  const reviewable = analysis.assessments
    .filter((a) => a.caseId)
    .sort((a, b) => (a.caseId ?? "").localeCompare(b.caseId ?? ""));

  reviewable.forEach((assessment, index) => {
    entries.push({
      id: `seed-detect-${assessment.variant.key}`,
      at: at(30 + index * 22),
      kind: "detection",
      actor: SYSTEM_ACTOR,
      caseId: assessment.caseId ?? undefined,
      title: composeReviewReason(assessment.changeType, assessment.variant.gene),
      detail: `${assessment.variant.gene} ${assessment.variant.hgvsCoding}`,
    });
    entries.push({
      id: `seed-impact-${assessment.variant.key}`,
      at: at(38 + index * 22),
      kind: "impact",
      actor: SYSTEM_ACTOR,
      caseId: assessment.caseId ?? undefined,
      title: `${assessment.impactedRecordCount} historical record${assessment.impactedRecordCount === 1 ? "" : "s"} mapped`,
      detail: `${assessment.variant.gene} ${assessment.variant.hgvsCoding}`,
    });
    entries.push({
      id: `seed-case-${assessment.variant.key}`,
      at: at(46 + index * 22),
      kind: "case",
      actor: SYSTEM_ACTOR,
      caseId: assessment.caseId ?? undefined,
      title: `Clinical review case ${assessment.caseId} created`,
      detail: `Priority ${assessment.priority.level.toLowerCase()}`,
    });
  });

  return entries.sort((a, b) => b.at.localeCompare(a.at));
}

interface Persisted {
  cases: Record<string, CaseState>;
  activity: ActivityEntry[];
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
  const [cases, setCases] = React.useState<Record<string, CaseState>>({});
  const [activity, setActivity] = React.useState<ActivityEntry[]>(() => seedActivity(initial));
  const [sync, setSync] = React.useState<SyncStage>({ phase: "idle" });
  const [hydrated, setHydrated] = React.useState(false);

  // Session state is restored after mount so the server and first client render
  // agree, which keeps hydration clean.
  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Persisted;
        if (parsed.cases) setCases(parsed.cases);
        if (parsed.activity?.length) setActivity(parsed.activity);
      }
    } catch {
      // A blocked or unavailable sessionStorage is not an error worth showing.
    }
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ cases, activity }));
    } catch {
      // Ignore quota or private-mode failures.
    }
  }, [cases, activity, hydrated]);

  const log = React.useCallback((entry: Omit<ActivityEntry, "id" | "at">) => {
    setActivity((prev) => [
      { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at: new Date().toISOString() },
      ...prev,
    ]);
  }, []);

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
      setSync({
        phase: "running",
        step,
        label: SYNC_STEPS[step].label,
        detail: SYNC_STEPS[step].detail,
      });
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
      title: "Evidence sync completed",
      detail: `${result.scan.findingsChecked.toLocaleString("en-US")} findings checked against ${EVIDENCE_MODES[result.mode].noun} evidence · ${workspaceScope(result.metrics)}`,
    });
  }, [analysis, log]);

  const getCase = React.useCallback(
    (caseId: string) => withDefaults(cases[caseId]),
    [cases],
  );

  const mutate = React.useCallback(
    (caseId: string, fn: (state: CaseState) => CaseState) => {
      setCases((prev) => ({ ...prev, [caseId]: fn(withDefaults(prev[caseId])) }));
    },
    [],
  );

  /* -- Review actions ------------------------------------------------------
     The only actions a reviewer can take. None of them changes a
     classification or a diagnosis; each one is written to the audit trail with
     the acting clinician and a timestamp. */

  const note = React.useCallback(
    (caseId: string, body: string, kind: CaseNote["kind"]) => {
      const entry: CaseNote = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        author: CURRENT_USER.name,
        body,
        at: new Date().toISOString(),
        kind,
      };
      mutate(caseId, (s) => ({ ...s, notes: [...s.notes, entry] }));
    },
    [mutate],
  );

  const openReview = React.useCallback(
    (caseId: string) => {
      mutate(caseId, (s) => ({
        ...s,
        status: s.status === "Reviewed" ? s.status : "In review",
      }));
      note(caseId, "Clinical review opened.", "review-opened");
      log({ kind: "case", actor: CURRENT_USER.name, caseId, title: `Clinical review opened on ${caseId}` });
    },
    [mutate, note, log],
  );

  const requestEvidence = React.useCallback(
    (caseId: string, detail: string) => {
      mutate(caseId, (s) => ({ ...s, evidenceRequested: true }));
      note(caseId, detail, "evidence-request");
      log({
        kind: "evidence-request",
        actor: CURRENT_USER.name,
        caseId,
        title: `More evidence requested for ${caseId}`,
        detail,
      });
    },
    [mutate, note, log],
  );

  const assignReviewer = React.useCallback(
    (caseId: string, assignee: string) => {
      mutate(caseId, (s) => ({
        ...s,
        assignee,
        status: s.status === "Needs review" ? "Assigned" : s.status,
      }));
      note(caseId, `${assignee} assigned as reviewer.`, "assignment");
      log({
        kind: "assignment",
        actor: CURRENT_USER.name,
        caseId,
        title: `${assignee} assigned as reviewer on ${caseId}`,
      });
    },
    [mutate, note, log],
  );

  const createFollowUp = React.useCallback(
    (caseId: string, body: string) => {
      mutate(caseId, (s) => ({ ...s, followUps: s.followUps + 1 }));
      note(caseId, body, "follow-up");
      log({
        kind: "follow-up",
        actor: CURRENT_USER.name,
        caseId,
        title: `Follow-up created on ${caseId}`,
        detail: body,
      });
    },
    [mutate, note, log],
  );

  /* A decision is appended, never written over. When the case already has one
     the new entry is an amendment, and the trail says what it replaced. */
  const recordDecision = React.useCallback(
    (caseId: string, decision: Decision, clinicianNote: string) => {
      const body = clinicianNote.trim();
      if (!isDecisionNoteValid(body)) return;

      const previous = currentDecision(withDefaults(cases[caseId]).decisions);
      const record: DecisionRecord = {
        decision,
        note: body,
        reviewer: CURRENT_USER.name,
        at: new Date().toISOString(),
      };

      mutate(caseId, (s) => ({ ...s, status: "Reviewed", decisions: [...s.decisions, record] }));
      note(caseId, `${decision}: ${body}`, previous ? "amendment" : "decision");
      log({
        kind: "review",
        actor: CURRENT_USER.name,
        caseId,
        title: previous
          ? `Decision on ${caseId} amended to ${decision}`
          : `Decision on ${caseId}: ${decision}`,
        detail: previous
          ? `Previously ${previous.decision}. Clinician note: ${body}`
          : `Clinician note: ${body}`,
      });
    },
    [cases, mutate, note, log],
  );

  const addNote = React.useCallback(
    (caseId: string, body: string) => {
      note(caseId, body, "note");
      log({
        kind: "note",
        actor: CURRENT_USER.name,
        caseId,
        title: `Note added to ${caseId}`,
        detail: body.slice(0, 96),
      });
    },
    [note, log],
  );

  const value = React.useMemo<WorkspaceValue>(
    () => ({
      analysis,
      scanMs,
      cases,
      activity,
      sync,
      runSync,
      getCase,
      openReview,
      requestEvidence,
      assignReviewer,
      createFollowUp,
      recordDecision,
      addNote,
    }),
    [
      analysis,
      scanMs,
      cases,
      activity,
      sync,
      runSync,
      getCase,
      openReview,
      requestEvidence,
      assignReviewer,
      createFollowUp,
      recordDecision,
      addNote,
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
