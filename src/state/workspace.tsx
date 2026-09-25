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
import { composeReviewReason } from "@/lib/narrative";
import { CURRENT_USER } from "@/data/workspace";

export type CaseStatus = "Needs review" | "Assigned" | "In progress" | "Resolved";

export interface CaseNote {
  id: string;
  author: string;
  body: string;
  at: string;
}

export interface CaseState {
  status: CaseStatus;
  assignee: string | null;
  notes: CaseNote[];
  escalated: boolean;
  resolution: string | null;
}

export interface ActivityEntry {
  id: string;
  at: string;
  title: string;
  detail?: string;
  kind: "sync" | "detection" | "impact" | "case" | "assignment" | "note" | "decision";
}

export type SyncStage =
  | { phase: "idle" }
  | { phase: "running"; step: number; label: string; detail: string }
  | { phase: "done"; at: string; changed: number; impacted: number };

interface WorkspaceValue {
  analysis: ClientAnalysis;
  cases: Record<string, CaseState>;
  activity: ActivityEntry[];
  sync: SyncStage;
  runSync: () => Promise<void>;
  getCase: (caseId: string) => CaseState;
  assign: (caseId: string, assignee: string) => void;
  setStatus: (caseId: string, status: CaseStatus) => void;
  addNote: (caseId: string, body: string) => void;
  escalate: (caseId: string) => void;
  resolve: (caseId: string, resolution: string) => void;
}

const WorkspaceContext = React.createContext<WorkspaceValue | null>(null);

// Bumped whenever the dataset changes, so a session saved against old variants
// and case numbers is never replayed against new ones.
const STORAGE_KEY = "variantpulse.session.v2";

const SYNC_STEPS = [
  { label: "Reading historical classifications", detail: "ClinVar's January 2023 release, as on record" },
  { label: "Retrieving current ClinVar evidence", detail: "One batched NCBI request, with a verified fallback" },
  { label: "Comparing classifications", detail: "Deterministic band comparison, no model involved" },
  { label: "Scanning synthetic hospital records", detail: "Joining every record to its variant" },
  { label: "Comparing regional evidence", detail: "gnomAD v4 Middle Eastern frequencies and CTGA" },
  { label: "Preparing evidence briefs", detail: "Composed from the cited records" },
  { label: "Opening clinical review cases", detail: "Only where something material changed" },
];

function defaultCase(): CaseState {
  return { status: "Needs review", assignee: null, notes: [], escalated: false, resolution: null };
}

/** Seeds the trail with the work the engine has already done. */
function seedActivity(analysis: ClientAnalysis): ActivityEntry[] {
  const base = new Date(analysis.checkedAt).getTime();
  const at = (offsetSeconds: number) => new Date(base + offsetSeconds * 1000).toISOString();
  const entries: ActivityEntry[] = [
    {
      id: "seed-sync",
      at: at(0),
      kind: "sync",
      title: "Evidence sync completed",
      detail: `${analysis.scan.findingsChecked.toLocaleString("en-US")} synthetic records checked against ${analysis.mode === "live" ? "live" : "cached verified"} ClinVar evidence`,
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
      title: composeReviewReason(assessment.changeType, assessment.variant.gene),
      detail: `${assessment.variant.gene} ${assessment.variant.hgvsCoding}`,
    });
    entries.push({
      id: `seed-impact-${assessment.variant.key}`,
      at: at(38 + index * 22),
      kind: "impact",
      title: `${assessment.impactedRecordCount} synthetic record${assessment.impactedRecordCount === 1 ? "" : "s"} mapped`,
      detail: `${assessment.variant.gene} ${assessment.variant.hgvsCoding}`,
    });
    entries.push({
      id: `seed-case-${assessment.variant.key}`,
      at: at(46 + index * 22),
      kind: "case",
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
  children,
}: {
  initial: ClientAnalysis;
  children: React.ReactNode;
}) {
  const [analysis, setAnalysis] = React.useState(initial);
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
      .then((r) => (r.ok ? (r.json() as Promise<ClientAnalysis>) : null))
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
    if (next) setAnalysis(next);

    const result = next ?? analysis;
    setSync({
      phase: "done",
      at: new Date().toISOString(),
      changed: result.metrics.evidenceChanges,
      impacted: result.metrics.patientsImpacted,
    });

    log({
      kind: "sync",
      title: "Evidence sync completed",
      detail: `${result.scan.findingsChecked.toLocaleString("en-US")} synthetic records checked against ${result.mode === "live" ? "live" : "cached verified"} evidence · ${result.metrics.evidenceChanges} reclassification${result.metrics.evidenceChanges === 1 ? "" : "s"} · ${result.metrics.regionalConflicts} regional signal${result.metrics.regionalConflicts === 1 ? "" : "s"}`,
    });
  }, [analysis, log]);

  const getCase = React.useCallback(
    (caseId: string) => cases[caseId] ?? defaultCase(),
    [cases],
  );

  const mutate = React.useCallback(
    (caseId: string, fn: (state: CaseState) => CaseState) => {
      setCases((prev) => ({ ...prev, [caseId]: fn(prev[caseId] ?? defaultCase()) }));
    },
    [],
  );

  const assign = React.useCallback(
    (caseId: string, assignee: string) => {
      mutate(caseId, (s) => ({
        ...s,
        assignee,
        status: s.status === "Needs review" ? "Assigned" : s.status,
      }));
      log({ kind: "assignment", title: `${assignee} assigned to ${caseId}` });
    },
    [mutate, log],
  );

  const setStatus = React.useCallback(
    (caseId: string, status: CaseStatus) => {
      mutate(caseId, (s) => ({ ...s, status }));
      log({ kind: "decision", title: `${caseId} moved to ${status.toLowerCase()}` });
    },
    [mutate, log],
  );

  const addNote = React.useCallback(
    (caseId: string, body: string) => {
      const note: CaseNote = {
        id: `${Date.now()}`,
        author: CURRENT_USER.name,
        body,
        at: new Date().toISOString(),
      };
      mutate(caseId, (s) => ({ ...s, notes: [...s.notes, note] }));
      log({ kind: "note", title: `Note added to ${caseId}`, detail: body.slice(0, 96) });
    },
    [mutate, log],
  );

  const escalate = React.useCallback(
    (caseId: string) => {
      mutate(caseId, (s) => ({ ...s, escalated: true, status: "In progress" }));
      log({ kind: "decision", title: `${caseId} escalated for specialist opinion` });
    },
    [mutate, log],
  );

  const resolve = React.useCallback(
    (caseId: string, resolution: string) => {
      mutate(caseId, (s) => ({ ...s, status: "Resolved", resolution }));
      log({ kind: "decision", title: `${caseId} marked reviewed`, detail: resolution });
    },
    [mutate, log],
  );

  const value = React.useMemo<WorkspaceValue>(
    () => ({
      analysis,
      cases,
      activity,
      sync,
      runSync,
      getCase,
      assign,
      setStatus,
      addNote,
      escalate,
      resolve,
    }),
    [analysis, cases, activity, sync, runSync, getCase, assign, setStatus, addNote, escalate, resolve],
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
