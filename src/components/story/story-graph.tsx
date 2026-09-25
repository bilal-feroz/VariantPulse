"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Building2,
  ClipboardCheck,
  Database,
  Globe2,
  User,
} from "lucide-react";

import { buttonClasses, ClassificationBadge } from "@/components/ui";
import { meta, type ClassificationCode } from "@/lib/classification";
import { cn } from "@/lib/utils";
import { STEP, STEP_STARTS_MS } from "./timeline";

export interface StoryPatient {
  id: string;
  testedOn: string;
}

export interface StoryData {
  gene: string;
  hgvs: string;
  recordedCode: ClassificationCode;
  recordedOn: string;
  currentCode: ClassificationCode;
  lastEvaluated: string | null;
  patients: StoryPatient[];
  caseId: string | null;
  /** Monitored variant keys, drawn as the nodes the core scans. */
  variantKeys: string[];
  leadKey: string;
}

/* -- Geometry -------------------------------------------------------------
   One coordinate space shared by the SVG connectors and the HTML nodes, so
   the two never drift apart at any width. */

const W = 1280;
const H = 540;
const CY = 290;
const CORE = { x: 470, r: 86, ring: 112 };
const PAST = { x: 134, w: 220 };
const PRESENT = { x: 750, w: 220 };
const FORK_X = 905;
const PATIENT_X = 990;
const PATIENT_YS = [170, 250, 330, 410];
const REVIEW = { x: 1174, w: 196 };
const SOURCES_Y = 62;

const SOURCES = [
  { name: "ClinVar", icon: Database, x: 275 },
  { name: "Literature", icon: BookOpen, x: 405 },
  { name: "Regional evidence", icon: Globe2, x: 535 },
  { name: "Hospital records", icon: Building2, x: 665 },
] as const;

const COLUMNS = [
  { label: "Past", x: PAST.x },
  { label: "VariantPulse", x: CORE.x },
  { label: "Present", x: PRESENT.x },
  { label: "Affected patients", x: PATIENT_X },
  { label: "Clinical review", x: REVIEW.x },
];

const px = (x: number) => `${(x / W) * 100}%`;
const py = (y: number) => `${(y / H) * 100}%`;
const secs = (from: number, to: number) => (STEP_STARTS_MS[to] - STEP_STARTS_MS[from]) / 1000;

function sourcePath(x: number): string {
  const tx = CORE.x + (x - CORE.x) * 0.3;
  const ty = CY - CORE.ring + 6;
  return `M ${x} ${SOURCES_Y + 44} C ${x} ${SOURCES_Y + 100}, ${tx} ${ty - 56}, ${tx} ${ty}`;
}

function patientPath(y: number): string {
  return `M ${PRESENT.x + PRESENT.w / 2} ${CY} L ${FORK_X} ${CY} C ${FORK_X + 40} ${CY}, ${PATIENT_X - 60} ${y}, ${PATIENT_X - 24} ${y}`;
}

function reviewPath(y: number): string {
  const x0 = PATIENT_X + 24;
  const x1 = REVIEW.x - REVIEW.w / 2;
  return `M ${x0} ${y} C ${x0 + 40} ${y}, ${x1 - 40} ${CY}, ${x1} ${CY}`;
}

const PATHS = {
  sources: SOURCES.map((s) => sourcePath(s.x)),
  past: `M ${PAST.x + PAST.w / 2} ${CY} L ${CORE.x - CORE.ring} ${CY}`,
  present: `M ${CORE.x + CORE.ring} ${CY} L ${PRESENT.x - PRESENT.w / 2} ${CY}`,
  patients: PATIENT_YS.map(patientPath),
  review: PATIENT_YS.map(reviewPath),
};

/* -- Connectors ----------------------------------------------------------- */

function Connector({
  d,
  active,
  tone = "garnet",
  duration = 0.6,
  delay = 0,
  flowing = false,
}: {
  d: string;
  active: boolean;
  tone?: "garnet" | "vermilion";
  duration?: number;
  delay?: number;
  flowing?: boolean;
}) {
  const stroke = tone === "vermilion" ? "var(--color-vermilion)" : "var(--color-garnet)";
  return (
    <g>
      <path d={d} fill="none" stroke="var(--color-line-2)" strokeWidth={1.4} strokeDasharray="3 5" />
      <motion.path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={tone === "vermilion" ? 2.4 : 1.8}
        strokeLinecap="round"
        initial={false}
        animate={{ pathLength: active ? 1 : 0, opacity: active ? 1 : 0 }}
        transition={{ duration: active ? duration : 0, delay: active ? delay : 0, ease: "easeInOut" }}
      />
      {flowing ? (
        <motion.path
          d={d}
          fill="none"
          stroke="var(--color-surface)"
          strokeWidth={2}
          strokeDasharray="4 18"
          initial={{ strokeDashoffset: 0 }}
          animate={{ strokeDashoffset: -44 }}
          transition={{ duration: 0.7, ease: "linear", repeat: Infinity }}
        />
      ) : null}
    </g>
  );
}

/* -- Nodes ---------------------------------------------------------------- */

function Place({
  x,
  y,
  w,
  children,
  className,
}: {
  x: number;
  y: number;
  w?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("absolute -translate-x-1/2 -translate-y-1/2", className)}
      style={{ left: px(x), top: py(y), width: w ? px(w) : undefined }}
    >
      {children}
    </div>
  );
}

function SourceTile({
  name,
  icon: Icon,
  active,
  index,
}: {
  name: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  active: boolean;
  index: number;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <span className="relative grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-ink-2">
        <Icon className="h-4 w-4" strokeWidth={1.8} />
        <motion.span
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface"
          initial={false}
          animate={{
            backgroundColor: active ? "var(--color-ok)" : "var(--color-line-2)",
            scale: active ? [1, 1.35, 1] : 1,
          }}
          transition={{ duration: 0.4, delay: active ? index * 0.12 : 0 }}
        />
      </span>
      <span className="text-[11px] font-medium leading-tight text-ink-2">{name}</span>
      <span className="sr-only">{active ? "connected" : "standby"}</span>
    </div>
  );
}

export function PastCard({ data, step }: { data: StoryData; step: number }) {
  const patient = data.patients[0];
  const linked = step >= STEP.records;
  return (
    <div
      className={cn(
        "vp-card-flat p-3.5 transition-colors duration-500",
        linked && "vp-selected",
      )}
    >
      <p className="whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint">
        Hospital record · {data.recordedOn.slice(0, 4)}
      </p>
      <p className="mt-1.5 text-[14px] font-semibold tracking-tight text-ink">
        Patient {patient?.id ?? "—"}
      </p>
      <p className="mt-0.5 text-[12.5px] text-ink-2">
        {data.gene} <span className="font-mono text-[11.5px]">{data.hgvs}</span>
      </p>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <ClassificationBadge code={data.recordedCode} />
        <span className="text-[11px] text-faint vp-num">{data.recordedOn}</span>
      </div>
    </div>
  );
}

function CoreCentre({ data, step }: { data: StoryData; step: number }) {
  const found = step >= STEP.detect;
  return (
    <div className="text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
        {step >= STEP.scan && !found ? "Scanning" : "Genomic object"}
      </p>
      <p className="mt-1 text-[17px] font-semibold tracking-tight text-ink">{data.gene}</p>
      <p className="font-mono text-[11.5px] text-ink-2">{data.hgvs}</p>
    </div>
  );
}

export function PresentCard({ data, step }: { data: StoryData; step: number }) {
  const changed = step >= STEP.reclassify;
  const checking = step >= STEP.sources && !changed;
  return (
    <div
      className={cn(
        "vp-card-flat p-3.5 transition-opacity duration-500",
        !changed && "opacity-70",
      )}
    >
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-faint">
        ClinVar today
      </p>
      {changed ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-vermilion-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-vermilion" />
            New evidence found
          </span>
          <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-[13.5px] font-semibold leading-tight">
            <span className="text-faint line-through decoration-slate">{meta(data.recordedCode).short}</span>
            <ArrowRight className="h-4 w-4 text-vermilion" strokeWidth={2.4} aria-label="to" />
            <span className="text-accent">{meta(data.currentCode).label}</span>
          </p>
          <p className="mt-1.5 text-[11px] text-faint vp-num">
            Evaluated {data.lastEvaluated ?? "not stated"}
          </p>
        </motion.div>
      ) : (
        <p className="mt-2 text-[12.5px] text-muted">
          {checking ? "Checking current evidence…" : "Not yet checked"}
        </p>
      )}
    </div>
  );
}

function PatientAvatar({ id, shown, index }: { id: string; shown: boolean; index: number }) {
  return (
    <motion.div
      className="flex flex-col items-center gap-1"
      initial={false}
      animate={{ opacity: shown ? 1 : 0.4, scale: shown ? 1 : 0.92 }}
      transition={{ duration: 0.35, delay: shown ? index * 0.12 : 0 }}
    >
      <span
        className={cn(
          "grid h-10 w-10 place-items-center rounded-full border transition-colors duration-300",
          shown
            ? "border-selected-border bg-active-bg text-accent"
            : "border-dashed border-line-2 bg-surface text-slate",
        )}
      >
        <User className="h-4 w-4" strokeWidth={2} />
      </span>
      <span className={cn("font-mono text-[10.5px]", shown ? "text-ink-2" : "text-faint")}>
        {id}
      </span>
    </motion.div>
  );
}

export function ReviewCard({ data, step }: { data: StoryData; step: number }) {
  const created = step >= STEP.review;
  return (
    <div className={cn("vp-card-flat p-3.5 transition-opacity duration-500", !created && "opacity-70")}>
      <span
        className={cn(
          "grid h-8 w-8 place-items-center rounded-full",
          created ? "bg-active-bg text-accent" : "bg-surface-3 text-slate",
        )}
      >
        <ClipboardCheck className="h-4 w-4" strokeWidth={1.9} />
      </span>
      {created ? (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <p className="mt-2 text-[13px] font-semibold leading-snug text-ink">Clinical review case created</p>
          {data.caseId ? (
            <p className="mt-0.5 font-mono text-[11px] text-faint">{data.caseId}</p>
          ) : null}
          <Link
            href={data.caseId ? `/review/${data.caseId}` : "/review"}
            className={buttonClasses("primary", "sm", "mt-2.5 w-full whitespace-nowrap px-2 text-[12px]")}
          >
            Open clinical review
          </Link>
        </motion.div>
      ) : (
        <>
          <p className="mt-2 text-[13px] font-semibold text-ink">Clinician review</p>
          <p className="mt-0.5 text-[11.5px] text-muted">A clinician decides</p>
        </>
      )}
    </div>
  );
}

/* -- Desktop graph -------------------------------------------------------- */

export function StoryGraph({ data, step }: { data: StoryData; step: number }) {
  const n = data.variantKeys.length;
  const leadIndex = Math.max(0, data.variantKeys.indexOf(data.leadKey));
  const scanning = step === STEP.scan;
  const detected = step >= STEP.detect;
  const flowing = step === STEP.flow || step === STEP.scan;

  return (
    <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden focusable="false">
        {PATHS.sources.map((d, i) => (
          <Connector
            key={d}
            d={d}
            active={step >= STEP.flow}
            delay={i * 0.08}
            duration={secs(STEP.flow, STEP.scan) - 0.3}
            flowing={flowing}
          />
        ))}
        <Connector d={PATHS.past} active={step >= STEP.flow} duration={0.5} flowing={flowing} />
        <Connector
          d={PATHS.present}
          active={step >= STEP.reclassify}
          tone="vermilion"
          duration={0.35}
        />
        {PATHS.patients.map((d, i) => (
          <Connector
            key={d}
            d={d}
            active={step >= STEP.records}
            delay={i * 0.08}
            duration={secs(STEP.records, STEP.patients) - 0.3}
          />
        ))}
        {PATHS.review.map((d, i) => (
          <Connector key={d} d={d} active={step >= STEP.review} delay={i * 0.05} duration={0.4} />
        ))}

        {/* Core: the genomic object and the variants it watches. */}
        <circle
          cx={CORE.x}
          cy={CY}
          r={CORE.ring}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={1}
        />
        <circle
          cx={CORE.x}
          cy={CY}
          r={CORE.r}
          fill="var(--color-surface)"
          stroke={detected ? "var(--color-garnet)" : "var(--color-line-2)"}
          strokeWidth={detected ? 1.6 : 1.2}
          style={{ transition: "stroke 400ms ease" }}
        />
        {scanning ? (
          <g transform={`translate(${CORE.x} ${CY})`}>
            <motion.g
              initial={{ rotate: 0 }}
              animate={{ rotate: 360 }}
              transition={{ duration: secs(STEP.scan, STEP.detect), ease: "linear" }}
            >
              <circle r={CORE.ring + 8} fill="transparent" />
              <line x1={0} y1={0} x2={CORE.ring + 8} y2={0} stroke="var(--color-garnet)" strokeOpacity={0.5} strokeWidth={1.4} />
            </motion.g>
          </g>
        ) : null}
        {data.variantKeys.map((key, i) => {
          const angle = ((i - leadIndex) / n) * Math.PI * 2;
          const x = CORE.x + CORE.ring * Math.cos(angle);
          const y = CY + CORE.ring * Math.sin(angle);
          const isLead = i === leadIndex;
          const lit = isLead && detected;
          return (
            <g key={key}>
              {lit ? (
                <motion.circle
                  cx={x}
                  cy={y}
                  r={7}
                  fill="var(--color-vermilion)"
                  initial={{ opacity: 0.55, scale: 1 }}
                  animate={{ opacity: 0, scale: 3 }}
                  transition={{ duration: 1.1, repeat: 2, ease: "easeOut" }}
                  style={{ originX: `${x}px`, originY: `${y}px` }}
                />
              ) : null}
              <circle
                cx={x}
                cy={y}
                r={lit ? 7 : 4.5}
                fill={lit ? "var(--color-vermilion)" : step >= STEP.scan ? "var(--color-slate)" : "var(--color-line-2)"}
                stroke="var(--color-surface)"
                strokeWidth={2}
                style={{ transition: "fill 300ms ease" }}
              />
            </g>
          );
        })}
      </svg>

      {SOURCES.map((s, i) => (
        <Place key={s.name} x={s.x} y={SOURCES_Y} w={120}>
          <SourceTile name={s.name} icon={s.icon} active={step >= STEP.sources} index={i} />
        </Place>
      ))}

      <Place x={PAST.x} y={CY} w={PAST.w}>
        <PastCard data={data} step={step} />
      </Place>

      <Place x={CORE.x} y={CY} w={CORE.r * 2 - 20}>
        <CoreCentre data={data} step={step} />
      </Place>

      <Place x={PRESENT.x} y={CY} w={PRESENT.w}>
        <PresentCard data={data} step={step} />
      </Place>

      {data.patients.map((p, i) => (
        <Place key={p.id} x={PATIENT_X} y={PATIENT_YS[i] ?? CY}>
          <PatientAvatar id={p.id} shown={step >= STEP.patients} index={i} />
        </Place>
      ))}

      <Place x={REVIEW.x} y={CY} w={REVIEW.w}>
        <ReviewCard data={data} step={step} />
      </Place>

      {COLUMNS.map((c) => (
        <Place key={c.label} x={c.x} y={H - 22}>
          <p className="whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-[0.14em] text-faint">
            {c.label}
          </p>
        </Place>
      ))}
    </div>
  );
}

/* -- Vertical story (tablet and mobile) ----------------------------------- */

function Rail({ active, tone = "garnet" }: { active: boolean; tone?: "garnet" | "vermilion" }) {
  return (
    <div className="flex justify-center py-1" aria-hidden>
      <span
        className={cn(
          "h-6 w-0.5 rounded-full transition-colors duration-500",
          active ? (tone === "vermilion" ? "bg-vermilion" : "bg-garnet") : "bg-line-2",
        )}
      />
    </div>
  );
}

function StageLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-faint">
      {children}
    </p>
  );
}

export function StoryStack({ data, step }: { data: StoryData; step: number }) {
  return (
    <div className="mx-auto w-full max-w-md">
      <StageLabel>Past</StageLabel>
      <PastCard data={data} step={step} />
      <Rail active={step >= STEP.flow} />

      <StageLabel>VariantPulse</StageLabel>
      <div
        className={cn(
          "vp-card-flat p-3.5 transition-colors duration-500",
          step >= STEP.detect && "border-garnet",
        )}
      >
        <div className="grid grid-cols-4 gap-2">
          {SOURCES.map((s, i) => (
            <SourceTile key={s.name} name={s.name} icon={s.icon} active={step >= STEP.sources} index={i} />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 border-t border-line pt-3">
          {step >= STEP.detect ? <span className="h-2 w-2 rounded-full bg-vermilion" aria-hidden /> : null}
          <CoreCentre data={data} step={step} />
        </div>
      </div>
      <Rail active={step >= STEP.reclassify} tone="vermilion" />

      <StageLabel>Present</StageLabel>
      <PresentCard data={data} step={step} />
      <Rail active={step >= STEP.records} />

      <StageLabel>Affected patients</StageLabel>
      <div className="vp-card-flat flex justify-around p-3.5">
        {data.patients.map((p, i) => (
          <PatientAvatar key={p.id} id={p.id} shown={step >= STEP.patients} index={i} />
        ))}
      </div>
      <Rail active={step >= STEP.review} />

      <StageLabel>Clinical review</StageLabel>
      <ReviewCard data={data} step={step} />
    </div>
  );
}
