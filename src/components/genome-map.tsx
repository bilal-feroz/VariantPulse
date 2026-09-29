"use client";

/**
 * Where the monitored variants sit on the genome, drawn in three dimensions.
 *
 * The drawing is three.js (see `three/genome-scene`), loaded only in the
 * browser. Chromosome lengths are the GRCh38 sizes and every marker stands at
 * the position ClinVar gives for that variant, so the figure is a map, not an
 * illustration. Where WebGL is unavailable the figure is simply left out: every
 * fact it shows is also in the text and tables around it.
 *
 * The markers are links for pointer users. They are hidden from assistive
 * technology and the tab order because the list or page beside the map already
 * carries the same links; the figure describes itself in one sentence instead.
 */

import * as React from "react";
import Link from "next/link";

import { ClassificationBadge } from "@/components/ui";
import { useDisplayed } from "@/components/use-displayed";
import type { VariantAssessment } from "@/lib/analysis";
import { CHANGE_TYPES } from "@/lib/classification";
import { GRCH38, formatPosition, locusOf, type Locus } from "@/lib/genome";
import { SIGNALS, SIGNAL_OF, SIGNAL_ORDER, type Signal } from "@/lib/signal";
import { cn } from "@/lib/utils";

import type { GenomeController, GenomeLabel, GenomePoint } from "./three/genome-scene";

interface Placed {
  key: string;
  assessment: VariantAssessment;
  signal: Signal;
  locus: Locus;
}

const TIP_WIDTH = 262;

export function GenomeMap({
  assessments,
  mode = "karyotype",
  focusKey = null,
  visibleKeys = null,
  activeKey = null,
  onActiveChange,
  label,
  className,
  stageClassName,
}: {
  assessments: VariantAssessment[];
  mode?: "karyotype" | "locus";
  /** Locus mode: the variant the figure is about. */
  focusKey?: string | null;
  /** Keys the page's filter keeps; null keeps every variant. */
  visibleKeys?: ReadonlySet<string> | null;
  /** A variant highlighted from outside the map, such as a hovered table row. */
  activeKey?: string | null;
  onActiveChange?: (key: string | null) => void;
  /** One sentence describing the figure for assistive technology. */
  label: string;
  className?: string;
  stageClassName?: string;
}) {
  const placed = React.useMemo(() => {
    const list: Placed[] = [];
    for (const assessment of assessments) {
      const locus = locusOf(assessment.evidence);
      if (locus) list.push({ key: assessment.variant.key, assessment, signal: SIGNAL_OF[assessment.changeType], locus });
    }
    return list;
  }, [assessments]);

  const shownPlaced = React.useMemo(() => {
    if (mode !== "locus") return placed;
    const chromosome = placed.find((p) => p.key === focusKey)?.locus.chromosome.name;
    return placed.filter((p) => p.locus.chromosome.name === chromosome);
  }, [placed, mode, focusKey]);

  const [status, setStatus] = React.useState<"loading" | "ready" | "failed">("loading");
  const [dragging, setDragging] = React.useState(false);
  const [hoverKey, setHoverKey] = React.useState<string | null>(null);

  const stageRef = React.useRef<HTMLDivElement>(null);
  const interactiveRef = React.useRef<HTMLDivElement>(null);
  const tipRef = React.useRef<HTMLDivElement>(null);
  const focusTagRef = React.useRef<HTMLSpanElement>(null);
  const controllerRef = React.useRef<GenomeController | null>(null);
  const spotRefs = React.useRef(new Map<string, HTMLAnchorElement>());
  const labelRefs = React.useRef(new Map<string, HTMLSpanElement>());
  const points = React.useRef(new Map<string, GenomePoint>());
  const labelsAt = React.useRef(new Map<string, GenomeLabel>());
  const hoverRef = React.useRef<string | null>(null);
  hoverRef.current = hoverKey;
  const displayed = useDisplayed(interactiveRef);

  // Remount only when what is drawn changes: which variants, and their signals.
  const signature = shownPlaced.map((p) => `${p.key}:${p.signal}`).join("|");
  const latest = React.useRef({ shownPlaced, mode, focusKey, visibleKeys, activeKey });
  latest.current = { shownPlaced, mode, focusKey, visibleKeys, activeKey };

  const placeTip = React.useCallback(() => {
    const tip = tipRef.current;
    const stage = stageRef.current;
    const key = hoverRef.current;
    const point = key ? points.current.get(key) : undefined;
    if (!tip || !stage || !point) return;
    const width = stage.clientWidth;
    const x = Math.min(Math.max(point.x - TIP_WIDTH / 2, 4), width - TIP_WIDTH - 4);
    const above = point.y - tip.offsetHeight - 14;
    const y = above < 0 ? point.y + 14 : above;
    tip.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
  }, []);

  const placeSpot = (key: string, element: HTMLElement) => {
    const point = points.current.get(key);
    if (!point) return;
    element.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
    element.dataset.live = String(point.front && point.shown);
  };

  const placeFocusTag = () => {
    const tag = focusTagRef.current;
    const point = latest.current.focusKey ? points.current.get(latest.current.focusKey) : undefined;
    if (tag && point) tag.style.transform = `translate3d(${Math.round(point.x)}px, ${Math.round(point.y)}px, 0)`;
  };

  const placeLabel = (id: string, element: HTMLElement) => {
    const at = labelsAt.current.get(id);
    if (!at) return;
    element.style.transform = `translate3d(${Math.round(at.x)}px, ${Math.round(at.y)}px, 0)`;
    element.dataset.shown = String(at.shown);
  };

  React.useEffect(() => {
    const stageHost = stageRef.current;
    const interactive = interactiveRef.current;
    if (!displayed || !stageHost || !interactive) return;

    let cancelled = false;
    let controller: GenomeController | null = null;
    setStatus("loading");

    import("./three/genome-scene").then(
      ({ mountGenome }) => {
        if (cancelled) return;
        const current = latest.current;
        try {
          controller = mountGenome(stageHost, interactive, {
            findings: current.shownPlaced.map((p) => ({
              key: p.key,
              signal: p.signal,
              chromosome: p.locus.chromosome.name,
              position: p.locus.position,
            })),
            mode: current.mode,
            focusKey: current.focusKey,
            onProject(projected, labels) {
              for (const point of projected) {
                points.current.set(point.key, point);
                const spot = spotRefs.current.get(point.key);
                if (spot) placeSpot(point.key, spot);
              }
              for (const at of labels) {
                labelsAt.current.set(at.id, at);
                const element = labelRefs.current.get(at.id);
                if (element) placeLabel(at.id, element);
              }
              placeFocusTag();
              placeTip();
            },
            onReady: () => setStatus("ready"),
            onLost: () => {
              // Nothing is drawn again after a lost context: free it and leave the figure out.
              controller?.dispose();
              controller = null;
              controllerRef.current = null;
              setStatus("failed");
            },
            onDragChange: setDragging,
          });
          controller.setVisible(current.visibleKeys);
          controller.setActive(current.activeKey);
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
  }, [displayed, signature, mode, focusKey, placeTip]);

  React.useEffect(() => {
    controllerRef.current?.setVisible(visibleKeys);
  }, [visibleKeys]);

  React.useEffect(() => {
    controllerRef.current?.setActive(hoverKey ?? activeKey);
  }, [hoverKey, activeKey]);

  React.useLayoutEffect(() => {
    placeTip();
  }, [hoverKey, placeTip]);

  const hover = (key: string | null) => {
    setHoverKey(key);
    onActiveChange?.(key);
  };

  const hovered = dragging ? null : (shownPlaced.find((p) => p.key === hoverKey) ?? null);
  const focus = shownPlaced.find((p) => p.key === focusKey) ?? null;
  const carriers = new Set(shownPlaced.map((p) => p.locus.chromosome.name));
  const labels =
    mode === "locus"
      ? [
          { id: "p", text: "p arm", carrier: false },
          { id: "q", text: "q arm", carrier: false },
        ]
      : GRCH38.map((c) => ({ id: c.name, text: c.name, carrier: carriers.has(c.name) }));

  if (status === "failed") return null;

  const counts = SIGNAL_ORDER.map((signal) => ({
    signal,
    count: shownPlaced.filter((p) => p.signal === signal).length,
  })).filter((c) => c.count > 0);

  return (
    <figure className={cn("relative m-0", className)}>
      <div
        ref={interactiveRef}
        className={cn(
          "relative touch-pan-y select-none",
          status === "ready" && (dragging ? "cursor-grabbing" : "cursor-grab"),
          stageClassName ?? "h-[300px]",
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-[10%] inset-y-[6%] rounded-[50%] bg-[radial-gradient(closest-side,rgba(232,197,204,0.38),transparent)]"
        />
        {/* The drawing speaks for itself in one sentence; the links laid over it are
            a pointer convenience that the list beside the map already provides. */}
        <div
          ref={stageRef}
          role="img"
          aria-label={label}
          className={cn(
            "absolute inset-0 transition-opacity duration-700",
            status === "ready" ? "opacity-100" : "opacity-0",
          )}
        />

        {status === "ready" ? (
          <div aria-hidden className={cn("vp-fade absolute inset-0", dragging && "pointer-events-none")}>
            {labels.map((item) => (
              <span
                key={item.id}
                ref={(element) => {
                  if (element) {
                    labelRefs.current.set(item.id, element);
                    placeLabel(item.id, element);
                  } else {
                    labelRefs.current.delete(item.id);
                  }
                }}
                className={cn(
                  "pointer-events-none absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[10.5px] vp-num data-[shown=false]:hidden",
                  item.carrier ? "font-semibold text-ink-2" : "text-faint",
                )}
              >
                {item.text}
              </span>
            ))}

            {shownPlaced.map((item) => (
              <Link
                key={item.key}
                href={`/variants/${encodeURIComponent(item.key)}`}
                tabIndex={-1}
                draggable={false}
                ref={(element) => {
                  if (element) {
                    spotRefs.current.set(item.key, element);
                    placeSpot(item.key, element);
                  } else {
                    spotRefs.current.delete(item.key);
                  }
                }}
                onPointerEnter={() => hover(item.key)}
                onPointerLeave={() => hover(hoverRef.current === item.key ? null : hoverRef.current)}
                className="absolute left-0 top-0 -ml-2.5 -mt-2.5 h-5 w-5 cursor-pointer rounded-full data-[live=false]:pointer-events-none"
              />
            ))}
          </div>
        ) : null}

        {mode === "locus" && status === "ready" && focus ? (
          // The band and position of the variant the page is about, standing over its marker.
          <span
            ref={(element) => {
              focusTagRef.current = element;
              placeFocusTag();
            }}
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 z-10 whitespace-nowrap"
          >
            <span className="absolute bottom-3.5 left-0 -translate-x-1/2 rounded-full border border-accent-ring bg-surface px-2.5 py-1 text-[11.5px] font-semibold text-accent shadow-[0_6px_18px_-10px_rgba(122,38,58,0.5)] vp-num">
              {focus.locus.band ?? `chr${focus.locus.chromosome.name}`}
            </span>
          </span>
        ) : null}

        {hovered ? (
          <div
            ref={tipRef}
            aria-hidden
            style={{ width: TIP_WIDTH }}
            className="vp-float pointer-events-none absolute left-0 top-0 z-20 px-3.5 py-3"
          >
            <p className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-[13px] font-semibold text-ink">
                {hovered.assessment.variant.gene}{" "}
                <span className="font-normal text-ink-2">{hovered.assessment.variant.hgvsCoding}</span>
              </span>
              <span className="shrink-0 text-[11px] text-faint vp-num">{hovered.locus.band}</span>
            </p>
            <span className="mt-2 flex flex-wrap items-center gap-1.5">
              <ClassificationBadge code={hovered.assessment.recordedCode} />
              <span className="text-[11px] text-faint">→</span>
              <ClassificationBadge code={hovered.assessment.currentCode} />
            </span>
            <span className="mt-2 flex items-center gap-1.5 text-[11.5px] text-muted">
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", SIGNALS[hovered.signal].dot)} />
              {CHANGE_TYPES[hovered.assessment.changeType].label}
            </span>
            <span className="mt-1 block text-[11px] text-faint vp-num">
              GRCh38 chr{hovered.locus.chromosome.name}:{formatPosition(hovered.locus.position)}
            </span>
          </div>
        ) : null}
      </div>

      <figcaption
        className={cn(
          "flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pt-2 text-[11px] text-muted transition-opacity duration-700",
          status === "ready" ? "opacity-100" : "opacity-0",
        )}
      >
        {counts.map(({ signal, count }) => (
          <span key={signal} className="inline-flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", SIGNALS[signal].dot)} />
            <span className="font-medium text-ink-2 vp-num">{count}</span>
            {SIGNALS[signal].label.toLowerCase()}
          </span>
        ))}
        <span className="ml-auto text-[10.5px] text-faint">
          GRCh38 positions from ClinVar · lengths to scale · drag to turn
        </span>
      </figcaption>
    </figure>
  );
}
