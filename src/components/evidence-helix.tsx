"use client";

/**
 * The interactive helix in the home hero.
 *
 * The drawing is three.js (see `three/helix-scene`), loaded only once the page
 * is in the browser. Until then, and wherever WebGL is unavailable, the
 * illustrated SVG helix stands in, so the hero never shows an empty column.
 *
 * Every monitored finding is a real link laid over its base pair: hovering one
 * or reaching it from the keyboard shows what changed, and choosing it opens
 * the variant. The links form one tab stop, and the arrow keys move between
 * them in genome order, turning the helix to bring each one round.
 */

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { HeroHelix } from "@/components/hero-helix";
import { ClassificationBadge } from "@/components/ui";
import { useDisplayed } from "@/components/use-displayed";
import type { VariantAssessment } from "@/lib/analysis";
import { CHANGE_TYPES, meta } from "@/lib/classification";
import { compareLoci, locusOf } from "@/lib/genome";
import { SIGNALS, SIGNAL_OF, SIGNAL_ORDER, type Signal } from "@/lib/signal";
import { cn } from "@/lib/utils";

import type { HelixController, HelixPoint } from "./three/helix-scene";

interface Finding {
  key: string;
  assessment: VariantAssessment;
  signal: Signal;
  band: string | null;
}

/** Genome order, so neighbours on the helix are neighbours on the genome. */
function orderFindings(assessments: VariantAssessment[]): Finding[] {
  return assessments
    .map((assessment) => ({
      key: assessment.variant.key,
      assessment,
      signal: SIGNAL_OF[assessment.changeType],
      locus: locusOf(assessment.evidence),
    }))
    .sort((a, b) => {
      if (a.locus && b.locus) return compareLoci(a.locus, b.locus);
      // Anything the evidence cannot place goes last, in its original order.
      return a.locus ? -1 : b.locus ? 1 : 0;
    })
    .map(({ locus, ...finding }) => ({ ...finding, band: locus?.band ?? null }));
}

const TIP_WIDTH = 262;
const TIP_GAP = 16;

export function EvidenceHelix({
  assessments,
  leadKey,
  scanning,
  className,
}: {
  assessments: VariantAssessment[];
  leadKey: string | null;
  scanning: boolean;
  className?: string;
}) {
  const findings = React.useMemo(() => orderFindings(assessments), [assessments]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "failed">("loading");
  const [dragging, setDragging] = React.useState(false);
  const [hoverKey, setHoverKey] = React.useState<string | null>(null);
  const [focusKey, setFocusKey] = React.useState<string | null>(null);
  const [roving, setRoving] = React.useState(0);

  const activeKey = dragging ? null : (hoverKey ?? focusKey);
  const active = findings.find((f) => f.key === activeKey) ?? null;

  const stageRef = React.useRef<HTMLDivElement>(null);
  const interactiveRef = React.useRef<HTMLDivElement>(null);
  const tipRef = React.useRef<HTMLDivElement>(null);
  const controllerRef = React.useRef<HelixController | null>(null);
  const spotRefs = React.useRef(new Map<string, HTMLAnchorElement>());
  const points = React.useRef(new Map<string, HelixPoint>());
  const activeRef = React.useRef<string | null>(null);
  activeRef.current = activeKey;
  // Hidden below the md breakpoint: nothing is loaded until the column is on screen.
  const displayed = useDisplayed(interactiveRef);

  const sceneFindings = React.useMemo(
    () => findings.map(({ key, signal }) => ({ key, signal })),
    [findings],
  );
  const latest = React.useRef({ sceneFindings, leadKey });
  latest.current = { sceneFindings, leadKey };

  /** Lays the tooltip beside its finding, inside the stage, flipping below near the top. */
  const placeTip = React.useCallback(() => {
    const tip = tipRef.current;
    const stage = stageRef.current;
    const key = activeRef.current;
    const point = key ? points.current.get(key) : undefined;
    if (!tip || !stage || !point) return;
    const width = stage.clientWidth;
    const height = tip.offsetHeight;
    const x = Math.min(Math.max(point.x - TIP_WIDTH / 2, -12), width - TIP_WIDTH + 12);
    const above = point.y - height - TIP_GAP;
    // Above the finding when it fits inside the stage, otherwise below it.
    const y = above < 0 ? point.y + TIP_GAP : above;
    tip.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
  }, []);

  const placeSpot = (key: string, element: HTMLAnchorElement) => {
    const point = points.current.get(key);
    if (!point) return;
    element.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
    // Round the back of the helix a nucleotide is hidden, so it cannot be picked there.
    element.dataset.front = String(point.front);
  };

  // Mount the scene once; later changes reach it through the controller.
  React.useEffect(() => {
    const stageHost = stageRef.current;
    const interactive = interactiveRef.current;
    if (!displayed || !stageHost || !interactive) return;

    let cancelled = false;
    let controller: HelixController | null = null;

    import("./three/helix-scene").then(
      ({ mountHelix }) => {
        if (cancelled) return;
        try {
          controller = mountHelix(stageHost, interactive, {
            findings: latest.current.sceneFindings,
            leadKey: latest.current.leadKey,
            onProject(projected) {
              for (const point of projected) {
                points.current.set(point.key, point);
                const spot = spotRefs.current.get(point.key);
                if (spot) placeSpot(point.key, spot);
              }
              placeTip();
            },
            onReady: () => setStatus("ready"),
            onLost: () => {
              // Nothing is drawn again after a lost context: free it and keep the illustration.
              controller?.dispose();
              controller = null;
              controllerRef.current = null;
              setStatus("failed");
            },
            onDragChange: setDragging,
          });
          controllerRef.current = controller;
        } catch {
          setStatus("failed");
        }
      },
      () => {
        if (!cancelled) setStatus("failed");
      },
    );

    return () => {
      cancelled = true;
      controller?.dispose();
      controllerRef.current = null;
    };
  }, [displayed, placeTip]);

  React.useEffect(() => {
    controllerRef.current?.setFindings(sceneFindings, leadKey);
  }, [sceneFindings, leadKey]);

  React.useEffect(() => {
    controllerRef.current?.setActive(activeKey, hoverKey === null && focusKey !== null);
  }, [activeKey, hoverKey, focusKey]);

  React.useEffect(() => {
    controllerRef.current?.setScanning(scanning);
  }, [scanning, status]);

  React.useLayoutEffect(() => {
    placeTip();
  }, [activeKey, placeTip]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let next: number | null = null;
    if (event.key in moves) next = (roving + moves[event.key] + findings.length) % findings.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = findings.length - 1;
    if (next === null) return;
    event.preventDefault();
    setRoving(next);
    spotRefs.current.get(findings[next].key)?.focus();
  };

  const counts = SIGNAL_ORDER.map((signal) => ({
    signal,
    count: findings.filter((f) => f.signal === signal).length,
  })).filter((c) => c.count > 0);

  const ready = status === "ready";

  return (
    <figure className={cn("relative m-0", className)}>
      <div
        ref={interactiveRef}
        className={cn(
          "relative h-[210px] touch-pan-y select-none xl:h-[232px]",
          ready && (dragging ? "cursor-grabbing" : "cursor-grab"),
        )}
      >
        {/* The illustration holds the column until the 3D helix has drawn its first frame. */}
        <HeroHelix
          className={cn(
            "pointer-events-none absolute inset-0 m-auto h-[184px] w-full transition-opacity duration-700",
            ready ? "opacity-0" : "opacity-100",
          )}
        />

        {/* A soft blush behind the form, as on the illustration. */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-[6%] inset-y-[4%] rounded-[50%] bg-[radial-gradient(closest-side,rgba(232,197,204,0.5),transparent)] transition-opacity duration-700",
            ready ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          ref={stageRef}
          className={cn(
            "absolute inset-0 transition-opacity duration-700 [mask-image:radial-gradient(ellipse_62%_60%_at_50%_50%,#000_62%,transparent_100%)]",
            ready ? "opacity-100" : "opacity-0",
          )}
        />

        {ready ? (
          <div
            role="group"
            aria-label="Monitored findings in genome order. Use the arrow keys to move between them."
            onKeyDown={onKeyDown}
            className={cn("absolute inset-0", dragging && "pointer-events-none")}
          >
            {findings.map((finding, index) => {
              const { variant, recordedCode, currentCode } = finding.assessment;
              return (
                <Link
                  key={finding.key}
                  href={`/variants/${encodeURIComponent(finding.key)}`}
                  ref={(element) => {
                    if (element) {
                      spotRefs.current.set(finding.key, element);
                      placeSpot(finding.key, element);
                    } else {
                      spotRefs.current.delete(finding.key);
                    }
                  }}
                  tabIndex={index === roving ? 0 : -1}
                  draggable={false}
                  aria-label={`${variant.gene} ${variant.hgvsCoding}: ${meta(recordedCode).label} on record, ${meta(currentCode).label} now. ${SIGNALS[finding.signal].label}.`}
                  onPointerEnter={() => setHoverKey(finding.key)}
                  onPointerLeave={() => setHoverKey((key) => (key === finding.key ? null : key))}
                  onFocus={(event) => {
                    setRoving(index);
                    // Only keyboard focus turns the helix; a press that starts a drag also focuses the link.
                    if (event.currentTarget.matches(":focus-visible")) setFocusKey(finding.key);
                  }}
                  onBlur={() => setFocusKey((key) => (key === finding.key ? null : key))}
                  className="absolute left-0 top-0 -ml-3 -mt-3 h-6 w-6 cursor-pointer rounded-full focus-visible:outline-offset-0 data-[front=false]:pointer-events-none"
                />
              );
            })}
          </div>
        ) : null}

        {active ? (
          <div
            ref={tipRef}
            aria-hidden
            style={{ width: TIP_WIDTH }}
            className="vp-float pointer-events-none absolute left-0 top-0 z-20 px-3.5 py-3"
          >
            <p className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-[13px] font-semibold text-ink">
                {active.assessment.variant.gene}{" "}
                <span className="font-normal text-ink-2">{active.assessment.variant.hgvsCoding}</span>
              </span>
              {active.band ? (
                <span className="shrink-0 text-[11px] text-faint vp-num">{active.band}</span>
              ) : null}
            </p>
            <span className="mt-2 flex flex-wrap items-center gap-1.5">
              <ClassificationBadge code={active.assessment.recordedCode} />
              <ArrowRight className="h-3 w-3 text-faint" />
              <ClassificationBadge code={active.assessment.currentCode} />
            </span>
            <span className="mt-2 flex items-center gap-1.5 text-[11.5px] text-muted">
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", SIGNALS[active.signal].dot)} />
              {CHANGE_TYPES[active.assessment.changeType].label}
              <span className="text-faint">·</span>
              <span className="vp-num">
                {active.assessment.impactedRecordCount} record
                {active.assessment.impactedRecordCount === 1 ? "" : "s"}
              </span>
            </span>
          </div>
        ) : null}
      </div>

      <figcaption
        className={cn(
          "mt-1 text-center transition-opacity duration-700",
          ready ? "opacity-100" : "opacity-0",
        )}
      >
        <span className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[11px] text-muted">
          {counts.map(({ signal, count }) => (
            <span key={signal} className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span className={cn("h-2 w-2 rounded-full", SIGNALS[signal].dot)} />
              <span className="font-medium text-ink-2 vp-num">{count}</span>
              {SIGNALS[signal].label.toLowerCase()}
            </span>
          ))}
        </span>
        <span className="mt-0.5 block text-[10.5px] text-faint">
          Genome order, not to scale · drag to turn
        </span>
      </figcaption>
    </figure>
  );
}
