"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Building2, ClipboardCheck, Database, Globe2, User } from "lucide-react";

import { buttonClasses, ClassificationBadge } from "@/components/ui";
import { meta, type ClassificationCode } from "@/lib/classification";
import { cn } from "@/lib/utils";
import { patientsLocated, STEP, STEP_STARTS_MS } from "./timeline";

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
  /** Monitored variant keys, drawn as the nodes on the core's variant track. */
  variantKeys: string[];
  leadKey: string;
}

/* -- Geometry -------------------------------------------------------------
   One design space shared by the SVG connectors and the HTML nodes. The
   whole graph is scaled as a unit to fit the available canvas. */

export const GRAPH_W = 1100;
export const GRAPH_H = 560;
const CY = 292;
const PAST = { x: 104, w: 196 };
const CORE = { x: 392, w: 240, h: 150 };
const PRESENT = { x: 654, w: 220 };
const FORK_X = 776;
const PATIENT_X = 842;
const PATIENT_R = 24;
const PATIENT_YS = [178, 254, 330, 406];
const REVIEW = { x: 1006, w: 184 };
const SOURCES_Y = 58;

const SOURCES = [
  { name: "ClinVar", icon: Database, x: 212 },
  { name: "Literature", icon: BookOpen, x: 332 },
  { name: "Regional evidence", icon: Globe2, x: 452 },
  { name: "Hospital records", icon: Building2, x: 572 },
] as const;

const secs = (from: number, to: number) => (STEP_STARTS_MS[to] - STEP_STARTS_MS[from]) / 1000;

function sourcePath(x: number): string {
  const tx = CORE.x + (x - CORE.x) * 0.35;
  const ty = CY - CORE.h / 2;
  return `M ${x} ${SOURCES_Y + 50} C ${x} ${SOURCES_Y + 110}, ${tx} ${ty - 70}, ${tx} ${ty}`;
}

const PATHS = {
  sources: SOURCES.map((s) => sourcePath(s.x)),
  past: `M ${PAST.x + PAST.w / 2} ${CY} L ${CORE.x - CORE.w / 2} ${CY}`,
  present: `M ${CORE.x + CORE.w / 2} ${CY} L ${PRESENT.x - PRESENT.w / 2} ${CY}`,
  patients: PATIENT_YS.map(
    (y) =>
      `M ${PRESENT.x + PRESENT.w / 2} ${CY} L ${FORK_X} ${CY} C ${FORK_X + 26} ${CY}, ${PATIENT_X - PATIENT_R - 26} ${y}, ${PATIENT_X - PATIENT_R} ${y}`,
  ),
  review: PATIENT_YS.map((y) => {
    const x0 = PATIENT_X + PATIENT_R;
    const x1 = REVIEW.x - REVIEW.w / 2;
    return `M ${x0} ${y} C ${x0 + 30} ${y}, ${x1 - 30} ${CY}, ${x1} ${CY}`;
  }),
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
      <path d={d} fill="none" stroke="var(--color-line-2)" strokeWidth={1.5} strokeDasharray="3 5" />
      <motion.path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={tone === "vermilion" ? 2.6 : 2}
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
          strokeWidth={2.2}
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

function Place({ x, y, w, children }: { x: number; y: number; w?: number; children: React.ReactNode }) {
  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: x, top: y, width: w }}>
      {children}
    </div>
  );
}

/** Stage name that sits directly under its node. */
function StageLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "whitespace-nowrap text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-faint",
        className,
      )}
    >
      {children}
    </p>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <StageLabel className="absolute inset-x-0 top-full mt-3">{label}</StageLabel>
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
      <span className="relative grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-ink-2">
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
        <motion.span
          className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-surface"
          initial={false}
          animate={{
            backgroundColor: active ? "var(--color-ok)" : "var(--color-line-2)",
            scale: active ? [1, 1.35, 1] : 1,
          }}
          transition={{ duration: 0.4, delay: active ? index * 0.12 : 0 }}
        />
      </span>
      <span className="text-[12px] font-medium leading-tight text-ink-2">{name}</span>
      <span className="sr-only">{active ? "connected" : "standby"}</span>
    </div>
  );
}

export function PastCard({ data, step }: { data: StoryData; step: number }) {
  const patient = data.patients[0];
  return (
    <div className={cn("vp-card-flat p-4 transition-colors duration-500", step >= STEP.records && "vp-selected")}>
      <p className="whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint">
        Hospital record · {data.recordedOn.slice(0, 4)}
      </p>
      <p className="mt-1.5 text-[15px] font-semibold tracking-tight text-ink">{patient?.id ?? "-"}</p>
      <p className="mt-0.5 text-[12.5px] text-ink-2">
        {data.gene} <span className="font-mono text-[12px]">{data.hgvs}</span>
      </p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <ClassificationBadge code={data.recordedCode} />
        <span className="text-[11px] text-faint vp-num">{data.recordedOn}</span>
      </div>
    </div>
  );
}

/* The core: a stretch of DNA with the monitored variants on it. */

const TRACK_W = 212;
const TRACK_H = 72;
const TRACK_MID = TRACK_H / 2;
const TRACK_AMP = 20;
const TRACK_TURNS = 2.5;

function strand(phase: number): string {
  const pts: string[] = [];
  for (let i = 0; i <= 64; i += 1) {
    const x = (i / 64) * TRACK_W;
    const y = TRACK_MID + TRACK_AMP * Math.sin((i / 64) * Math.PI * 2 * TRACK_TURNS + phase);
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts.join(" ");
}

const STRANDS = [strand(0), strand(Math.PI)];
const RUNGS = Array.from({ length: 21 }, (_, i) => {
  const t = (i + 0.5) / 21;
  const x = t * TRACK_W;
  const dy = TRACK_AMP * Math.sin(t * Math.PI * 2 * TRACK_TURNS);
  return { x, y1: TRACK_MID + dy, y2: TRACK_MID - dy };
});

export function VariantTrack({ data, step }: { data: StoryData; step: number }) {
  const n = data.variantKeys.length;
  const scanning = step === STEP.scan;
  const scanned = step >= STEP.scan;
  const detected = step >= STEP.detect;
  const scanDuration = secs(STEP.scan, STEP.detect) - 0.15;
  const xs = data.variantKeys.map((_, i) => 10 + ((i + 0.5) / n) * (TRACK_W - 20));

  return (
    <svg viewBox={`0 0 ${TRACK_W} ${TRACK_H}`} className="block h-auto w-full overflow-visible" aria-hidden>
      {RUNGS.map((r) => (
        <line key={r.x} x1={r.x} x2={r.x} y1={r.y1} y2={r.y2} stroke="var(--color-line)" strokeWidth={1.4} />
      ))}
      {STRANDS.map((d, i) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={i === 0 ? "var(--color-garnet)" : "var(--color-selected-border)"}
          strokeWidth={2}
          strokeLinecap="round"
          opacity={i === 0 ? 0.55 : 1}
        />
      ))}
      <line x1={4} x2={TRACK_W - 4} y1={TRACK_MID} y2={TRACK_MID} stroke="var(--color-line-2)" strokeWidth={1} />

      {data.variantKeys.map((key, i) => {
        const lead = key === data.leadKey;
        const x = xs[i];
        const lit = lead && detected;
        return (
          <g key={key}>
            {lit ? (
              <motion.circle
                cx={x}
                cy={TRACK_MID}
                fill="var(--color-vermilion)"
                initial={{ r: 6, opacity: 0.55 }}
                animate={{ r: 18, opacity: 0 }}
                transition={{ duration: 1.1, repeat: 2, ease: "easeOut" }}
              />
            ) : null}
            <motion.circle
              cx={x}
              cy={TRACK_MID}
              stroke="var(--color-surface)"
              strokeWidth={2}
              initial={false}
              animate={{
                r: lit ? 6.5 : 4,
                fill: lit
                  ? "var(--color-vermilion)"
                  : scanned
                    ? "var(--color-slate)"
                    : "var(--color-line-2)",
              }}
              transition={{
                duration: 0.25,
                delay: scanning ? (x / TRACK_W) * scanDuration : 0,
              }}
            />
          </g>
        );
      })}

      {scanning ? (
        <motion.rect
          y={-6}
          width={2}
          height={TRACK_H + 12}
          rx={1}
          fill="var(--color-garnet)"
          initial={{ x: 0, opacity: 0.9 }}
          animate={{ x: TRACK_W, opacity: 0.9 }}
          transition={{ duration: scanDuration, ease: "linear" }}
        />
      ) : null}
    </svg>
  );
}

function CoreCard({ data, step }: { data: StoryData; step: number }) {
  const detected = step >= STEP.detect;
  return (
    <div
      className={cn(
        "vp-card-flat px-4 pb-3 pt-3.5 transition-colors duration-500",
        detected && "border-garnet",
      )}
    >
      <p className="flex items-baseline justify-center gap-2 text-center">
        <span className="text-[16px] font-semibold tracking-tight text-ink">{data.gene}</span>
        <span className="font-mono text-[12px] text-ink-2">{data.hgvs}</span>
      </p>
      <div className="mt-2">
        <VariantTrack data={data} step={step} />
      </div>
    </div>
  );
}

export function PresentCard({ data, step }: { data: StoryData; step: number }) {
  const changed = step >= STEP.reclassify;
  const holding = step === STEP.reclassify;
  return (
    <div
      className={cn(
        "vp-card-flat p-4 transition-colors duration-500",
        changed ? "border-selected-border" : "border-dashed",
      )}
    >
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint">ClinVar today</p>
      {changed ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: holding ? [0.92, 1.06, 1] : 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          aria-label={`${meta(data.recordedCode).short} to ${meta(data.currentCode).label}`}
        >
          <p className="mt-2 text-[26px] font-semibold leading-none tracking-tight text-faint line-through decoration-2">
            {meta(data.recordedCode).short}
          </p>
          <div className="my-2.5 flex items-center gap-2" aria-hidden>
            <span className="h-0.5 w-6 rounded-full bg-vermilion" />
            <span className="relative h-3 w-3 rounded-full bg-vermilion">
              <span
                className="absolute inset-0 rounded-full bg-vermilion"
                style={{ animation: "vp-pulse-ring 1.2s ease-out infinite" }}
              />
            </span>
            <ArrowRight className="h-5 w-5 text-vermilion" strokeWidth={2.6} />
          </div>
          <p className="text-[28px] font-bold leading-[1.05] tracking-tight text-garnet">
            {meta(data.currentCode).label}
          </p>
          <p className="mt-2 text-[11px] text-faint vp-num">Evaluated {data.lastEvaluated ?? "not stated"}</p>
        </motion.div>
      ) : (
        <p className="mt-2 text-[20px] font-semibold leading-none text-line-2" aria-label="Not yet checked">
          ?
        </p>
      )}
    </div>
  );
}

function PatientsLocated({ data, step }: { data: StoryData; step: number }) {
  if (step < STEP.patients) return null;
  return (
    <motion.p
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-active-bg px-3 py-1 text-[13px] font-semibold text-accent vp-num"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-vermilion" aria-hidden />
      {patientsLocated(data.patients.length)}
    </motion.p>
  );
}

function PatientAvatar({ id, shown, index }: { id: string; shown: boolean; index: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <motion.span
        className={cn(
          "grid place-items-center rounded-full border-[1.5px] transition-colors duration-300",
          shown ? "border-garnet bg-active-bg text-accent" : "border-dashed border-slate bg-surface text-slate",
        )}
        style={{ width: PATIENT_R * 2, height: PATIENT_R * 2 }}
        initial={false}
        animate={{ scale: shown ? [1, 1.14, 1] : 1 }}
        transition={{ duration: 0.4, delay: shown ? index * 0.12 : 0 }}
      >
        <User className="h-5 w-5" strokeWidth={2} />
      </motion.span>
      <span className={cn("font-mono text-[11px]", shown ? "font-medium text-ink" : "text-faint")}>{id}</span>
    </div>
  );
}

export function ReviewCard({ data, step }: { data: StoryData; step: number }) {
  const created = step >= STEP.review;
  return (
    <div
      className={cn(
        "vp-card-flat p-4 transition-colors duration-500",
        created ? "border-selected-border" : "border-dashed",
      )}
    >
      <span
        className={cn(
          "grid h-9 w-9 place-items-center rounded-full transition-colors duration-300",
          created ? "bg-active-bg text-accent" : "bg-surface-3 text-slate",
        )}
      >
        <ClipboardCheck className="h-[18px] w-[18px]" strokeWidth={1.9} />
      </span>
      {created ? (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <p className="mt-2.5 text-[13.5px] font-semibold leading-snug text-ink">Clinical review case created</p>
          {data.caseId ? <p className="mt-0.5 font-mono text-[11px] text-faint">{data.caseId}</p> : null}
          <Link
            href={data.caseId ? `/review/${data.caseId}` : "/review"}
            className={buttonClasses("primary", "sm", "mt-3 w-full whitespace-nowrap px-2 text-[12.5px]")}
          >
            Open clinical review
          </Link>
        </motion.div>
      ) : (
        <p className="mt-2.5 text-[13.5px] font-semibold text-muted">Clinician</p>
      )}
    </div>
  );
}

/* -- Desktop graph -------------------------------------------------------- */

export function StoryGraph({ data, step }: { data: StoryData; step: number }) {
  const flowing = step === STEP.flow || step === STEP.scan;

  return (
    <div className="relative" style={{ width: GRAPH_W, height: GRAPH_H }}>
      <svg
        viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`}
        className="absolute inset-0 h-full w-full"
        aria-hidden
        focusable="false"
      >
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
        <Connector d={PATHS.present} active={step >= STEP.reclassify} tone="vermilion" duration={0.35} />
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
      </svg>

      {SOURCES.map((s, i) => (
        <Place key={s.name} x={s.x} y={SOURCES_Y} w={116}>
          <SourceTile name={s.name} icon={s.icon} active={step >= STEP.sources} index={i} />
        </Place>
      ))}

      <Place x={PAST.x} y={CY} w={PAST.w}>
        <Labelled label="Past">
          <PastCard data={data} step={step} />
        </Labelled>
      </Place>

      <Place x={CORE.x} y={CY} w={CORE.w}>
        <Labelled label="VariantPulse">
          <CoreCard data={data} step={step} />
        </Labelled>
      </Place>

      <Place x={PRESENT.x} y={CY} w={PRESENT.w}>
        <Labelled label="Present">
          <PresentCard data={data} step={step} />
        </Labelled>
      </Place>

      {data.patients.map((p, i) => (
        <Place key={p.id} x={PATIENT_X} y={(PATIENT_YS[i] ?? CY) + 8}>
          <PatientAvatar id={p.id} shown={step >= STEP.patients} index={i} />
        </Place>
      ))}
      <Place x={PATIENT_X} y={(PATIENT_YS[0] ?? CY) - 50}>
        <div className="flex h-8 items-center justify-center">
          <PatientsLocated data={data} step={step} />
        </div>
      </Place>
      <Place x={PATIENT_X} y={(PATIENT_YS[PATIENT_YS.length - 1] ?? CY) + 64}>
        <StageLabel>Affected patients</StageLabel>
      </Place>

      <Place x={REVIEW.x} y={CY} w={REVIEW.w}>
        <Labelled label="Clinical review">
          <ReviewCard data={data} step={step} />
        </Labelled>
      </Place>
    </div>
  );
}

/**
 * Scales the fixed-size graph as a unit to fill its container, leaving room
 * for `footer` directly beneath it.
 */
export function FittedStoryGraph({
  data,
  step,
  footer,
  footerHeight,
}: {
  data: StoryData;
  step: number;
  footer: React.ReactNode;
  footerHeight: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState<number | null>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      setScale(Math.max(0.5, Math.min(width / GRAPH_W, (height - footerHeight) / GRAPH_H, 1.45)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [footerHeight]);

  const s = scale ?? 1;
  return (
    <div
      ref={ref}
      className="flex h-full w-full flex-col items-center justify-center"
      style={{ visibility: scale === null ? "hidden" : "visible" }}
    >
      <div className="relative shrink-0" style={{ width: GRAPH_W * s, height: GRAPH_H * s }}>
        <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${s})` }}>
          <StoryGraph data={data} step={step} />
        </div>
      </div>
      <div className="w-full shrink-0" style={{ height: footerHeight }}>
        {footer}
      </div>
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

export function StoryStack({ data, step }: { data: StoryData; step: number }) {
  return (
    <div className="mx-auto w-full max-w-md">
      <StageLabel className="mb-1.5 text-left">Past</StageLabel>
      <PastCard data={data} step={step} />
      <Rail active={step >= STEP.flow} />

      <StageLabel className="mb-1.5 text-left">VariantPulse</StageLabel>
      <div className={cn("vp-card-flat p-4 transition-colors duration-500", step >= STEP.detect && "border-garnet")}>
        <div className="grid grid-cols-4 gap-2">
          {SOURCES.map((s, i) => (
            <SourceTile key={s.name} name={s.name} icon={s.icon} active={step >= STEP.sources} index={i} />
          ))}
        </div>
        <div className="mt-4 border-t border-line pt-3">
          <p className="flex items-baseline justify-center gap-2">
            <span className="text-[15px] font-semibold text-ink">{data.gene}</span>
            <span className="font-mono text-[12px] text-ink-2">{data.hgvs}</span>
          </p>
          <div className="mx-auto mt-2 max-w-[260px]">
            <VariantTrack data={data} step={step} />
          </div>
        </div>
      </div>
      <Rail active={step >= STEP.reclassify} tone="vermilion" />

      <StageLabel className="mb-1.5 text-left">Present</StageLabel>
      <PresentCard data={data} step={step} />
      <Rail active={step >= STEP.records} />

      <StageLabel className="mb-1.5 text-left">Affected patients</StageLabel>
      <div className="mb-2 flex h-8 items-center">
        <PatientsLocated data={data} step={step} />
      </div>
      <div className="vp-card-flat flex justify-around p-4">
        {data.patients.map((p, i) => (
          <PatientAvatar key={p.id} id={p.id} shown={step >= STEP.patients} index={i} />
        ))}
      </div>
      <Rail active={step >= STEP.review} />

      <StageLabel className="mb-1.5 text-left">Clinical review</StageLabel>
      <ReviewCard data={data} step={step} />
    </div>
  );
}
