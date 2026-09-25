/**
 * The home composition: a double helix feeding three stacked stages.
 *
 * The helix is drawn as individually depth-sorted pieces rather than two flat
 * paths. Every piece carries a z derived from its phase, and the whole set is
 * painted back to front, so strands genuinely pass behind one another. Stroke
 * weight, bead radius and opacity all scale with depth, and near segments get a
 * white halo so a crossing reads as one strand passing in front of the other.
 *
 * Base-pair rungs are split at the axis. Each half inherits the depth of the
 * strand it attaches to, so a rung is not a flat bar lying at mid-depth: its
 * near half paints in front of the near strand and its far half behind the far
 * one. That single detail is most of what makes the form read as solid.
 *
 * Rotation is a translation, not a recomputation: the geometry is periodic in y
 * with a period of one PITCH, so sliding the group down by exactly that
 * distance lands every element on a position of identical phase. The loop is
 * seamless, the depth ordering stays correct, and it costs no JavaScript.
 *
 * It is decorative — every figure it stands for is stated in text nearby — so
 * it is hidden from assistive technology.
 */

import { cn } from "@/lib/utils";

// The viewBox aspect is tuned to the column the composition sits in, so the
// artwork fills its space rather than letterboxing inside it.
const WIDTH = 500;
const HEIGHT = 696;
const CENTRE = 250;

const HELIX_TOP = 8;
const HELIX_BOTTOM = 382;
const AMPLITUDE = 120;
const TURNS = 2.3;

/** Vertical distance covered by one full turn. The animation slides by this. */
const PITCH = (HELIX_BOTTOM - HELIX_TOP) / TURNS;
/** Spacing between sample points, in user units. */
const STEP = 6;
/** A rung (base pair) every nth sample. */
const RUNG_EVERY = 3;

interface Node {
  x: number;
  y: number;
  /** Depth: +1 nearest the viewer, -1 furthest. */
  z: number;
}

/**
 * Quantises a value before it reaches the DOM.
 *
 * ECMAScript does not require Math.sin and Math.cos to be correctly rounded,
 * so Node and the browser can disagree in the last bit or two. Those raw floats
 * become SVG attributes, and React then reports a hydration mismatch and throws
 * away the server-rendered subtree. Rounding first makes the two agree, and it
 * trims a good deal of markup at the same time. IEEE +, -, * and / are exact,
 * so everything derived from a rounded value stays in step.
 */
const q = (value: number, places = 3): number => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

/**
 * Samples one strand from a full turn above the visible top, so the group has
 * somewhere to slide in from.
 */
function strandNodes(strand: 0 | 1): Node[] {
  const phase = strand === 0 ? 0 : Math.PI;
  const start = HELIX_TOP - PITCH;
  const count = Math.round((HELIX_BOTTOM - start) / STEP);

  return Array.from({ length: count + 1 }, (_, i) => {
    const y = start + i * STEP;
    // The angle advances with absolute y, which is what makes the pattern
    // periodic and the slide seamless.
    const angle = ((y - HELIX_TOP) / PITCH) * Math.PI * 2 + phase;
    return {
      x: q(CENTRE + AMPLITUDE * Math.sin(angle), 4),
      y: q(y, 4),
      z: q(Math.cos(angle), 6),
    };
  });
}

type Item =
  | { kind: "seg"; z: number; strand: 0 | 1; x1: number; y1: number; x2: number; y2: number }
  | { kind: "rung"; z: number; pair: 0 | 1; x1: number; y1: number; x2: number; y2: number }
  | { kind: "bead"; z: number; strand: 0 | 1; x: number; y: number };

function buildHelix(): Item[] {
  const a = strandNodes(0);
  const b = strandNodes(1);
  const items: Item[] = [];

  for (let i = 0; i < a.length - 1; i += 1) {
    items.push({
      kind: "seg",
      strand: 0,
      z: (a[i].z + a[i + 1].z) / 2,
      x1: a[i].x,
      y1: a[i].y,
      x2: a[i + 1].x,
      y2: a[i + 1].y,
    });
    items.push({
      kind: "seg",
      strand: 1,
      z: (b[i].z + b[i + 1].z) / 2,
      x1: b[i].x,
      y1: b[i].y,
      x2: b[i + 1].x,
      y2: b[i + 1].y,
    });
  }

  for (let i = 0; i < a.length; i += RUNG_EVERY) {
    const pair = ((i / RUNG_EVERY) % 2) as 0 | 1;
    const midY = (a[i].y + b[i].y) / 2;

    // Split at the axis so each half sorts with the strand it belongs to.
    items.push({
      kind: "rung",
      pair,
      z: a[i].z * 0.72,
      x1: a[i].x,
      y1: a[i].y,
      x2: CENTRE,
      y2: midY,
    });
    items.push({
      kind: "rung",
      pair,
      z: b[i].z * 0.72,
      x1: CENTRE,
      y1: midY,
      x2: b[i].x,
      y2: b[i].y,
    });

    items.push({ kind: "bead", strand: 0, z: a[i].z, x: a[i].x, y: a[i].y });
    items.push({ kind: "bead", strand: 1, z: b[i].z, x: b[i].x, y: b[i].y });
  }

  return items.sort((p, q) => p.z - q.z);
}

const HELIX = buildHelix();

/** Maps depth to 0 (furthest) … 1 (nearest). */
const near = (z: number) => (z + 1) / 2;

interface Stage {
  label: string;
  y: number;
  rx: number;
  ry: number;
  hue: string;
  shade: string;
  delay: string;
}

const STAGES: Stage[] = [
  { label: "New evidence", y: 424, rx: 152, ry: 38, hue: "var(--color-vermilion)", shade: "var(--color-garnet)", delay: "0s" },
  { label: "Analysis", y: 512, rx: 176, ry: 44, hue: "var(--color-garnet)", shade: "var(--color-oxblood)", delay: "0.5s" },
  { label: "Affected patients", y: 600, rx: 200, ry: 50, hue: "var(--color-oxblood)", shade: "var(--color-carbon)", delay: "1s" },
];

/** Where the evidence lines converge: the rim of the first disc. */
const INTAKE_Y = STAGES[0].y;

export function EvidencePipeline({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={cn("block h-full w-full", className)}
      aria-hidden
      focusable="false"
    >
      <defs>
        {/* The mark pairs a garnet ribbon with a pale one. The two strands
            keep to separate tones so they stay legible where they
            cross: one garnet, one pale rose.

            These are in user space and run horizontally, for two reasons. A
            bounding-box gradient would restart inside every one of the ~130
            segments, averaging each to a muddy mid-tone; and a horizontal axis
            is unaffected by the vertical slide, so the lighting stays put while
            the helix turns. The result reads as a light source to the left. */}
        <linearGradient
          id="vp-strand-a"
          gradientUnits="userSpaceOnUse"
          x1={CENTRE - AMPLITUDE}
          y1="0"
          x2={CENTRE + AMPLITUDE}
          y2="0"
        >
          <stop offset="0%" stopColor="var(--color-vermilion)" />
          <stop offset="50%" stopColor="var(--color-garnet)" />
          <stop offset="100%" stopColor="var(--color-oxblood)" />
        </linearGradient>
        <linearGradient
          id="vp-strand-b"
          gradientUnits="userSpaceOnUse"
          x1={CENTRE - AMPLITUDE}
          y1="0"
          x2={CENTRE + AMPLITUDE}
          y2="0"
        >
          <stop offset="0%" stopColor="var(--color-selected-border)" />
          <stop offset="50%" stopColor="var(--color-garnet)" />
          <stop offset="100%" stopColor="var(--color-oxblood)" />
        </linearGradient>

        {/* Beads are lit from the upper left, which is what reads as spherical. */}
        <radialGradient id="vp-bead-a" cx="33%" cy="27%" r="80%">
          <stop offset="0%" stopColor="var(--color-surface)" />
          <stop offset="26%" stopColor="var(--color-selected-border)" />
          <stop offset="100%" stopColor="var(--color-oxblood)" />
        </radialGradient>
        <radialGradient id="vp-bead-b" cx="33%" cy="27%" r="80%">
          <stop offset="0%" stopColor="var(--color-surface)" />
          <stop offset="26%" stopColor="var(--color-active-bg)" />
          <stop offset="100%" stopColor="var(--color-garnet)" />
        </radialGradient>

        <linearGradient id="vp-column" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-garnet)" stopOpacity="0" />
          <stop offset="50%" stopColor="var(--color-garnet)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--color-garnet)" stopOpacity="0" />
        </linearGradient>

        {STAGES.map((stage, index) => (
          <radialGradient key={stage.label} id={`vp-disc-${index}`} cx="50%" cy="36%" r="64%">
            <stop offset="0%" stopColor="var(--color-surface)" stopOpacity="0.45" />
            <stop offset="42%" stopColor={stage.hue} stopOpacity="0.32" />
            <stop offset="100%" stopColor={stage.shade} stopOpacity="0.17" />
          </radialGradient>
        ))}

        {/* Fades the helix into the stack at the base. The top barely fades so
            the form does not look cropped. */}
        <linearGradient id="vp-helix-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="black" stopOpacity="0" />
          <stop offset="3%" stopColor="white" stopOpacity="1" />
          <stop offset="90%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="black" stopOpacity="0" />
        </linearGradient>
        <mask id="vp-helix-mask">
          <rect
            x="0"
            y={HELIX_TOP - 10}
            width={WIDTH}
            height={HELIX_BOTTOM - HELIX_TOP + 24}
            fill="url(#vp-helix-fade)"
          />
        </mask>

        <filter id="vp-soft" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="11" />
        </filter>
        <filter id="vp-contact" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      {/* Ambient wash behind the whole composition. */}
      <ellipse cx={CENTRE} cy={508} rx={232} ry={176} fill="var(--color-garnet)" opacity="0.09" filter="url(#vp-soft)" />

      {/* The column of light linking the helix to the stack. */}
      <rect x={CENTRE - 46} y={160} width={92} height={432} fill="url(#vp-column)" />

      {/* Stacked stages, back to front. Each disc gets a cast shadow, a side
          wall for thickness, a lit top face and a rim highlight. */}
      {STAGES.map((stage, index) => (
        <g key={stage.label}>
          <ellipse
            cx={CENTRE}
            cy={stage.y + 18}
            rx={stage.rx * 0.92}
            ry={stage.ry * 0.7}
            fill={stage.shade}
            opacity="0.16"
            filter="url(#vp-soft)"
          />
          <ellipse cx={CENTRE} cy={stage.y + 9} rx={stage.rx} ry={stage.ry} fill={stage.shade} opacity="0.14" />
          <ellipse cx={CENTRE} cy={stage.y} rx={stage.rx} ry={stage.ry} fill={`url(#vp-disc-${index})`} />
          <ellipse
            cx={CENTRE}
            cy={stage.y}
            rx={stage.rx}
            ry={stage.ry}
            fill="none"
            stroke={stage.hue}
            strokeOpacity="0.56"
            strokeWidth="1.4"
          />
          {/* Rim highlight along the upper edge only. */}
          <path
            d={`M ${CENTRE - stage.rx} ${stage.y} A ${stage.rx} ${stage.ry} 0 0 1 ${CENTRE + stage.rx} ${stage.y}`}
            fill="none"
            stroke="var(--color-surface)"
            strokeOpacity="0.85"
            strokeWidth="1.7"
          />
          <ellipse
            cx={CENTRE}
            cy={stage.y}
            rx={stage.rx * 0.6}
            ry={stage.ry * 0.6}
            fill="none"
            stroke={stage.hue}
            strokeOpacity="0.2"
            strokeWidth="1"
          />
          <text
            x={CENTRE}
            y={stage.y + 4}
            textAnchor="middle"
            className="fill-ink-2"
            style={{ font: "500 13px var(--font-inter), sans-serif", letterSpacing: "0.01em" }}
          >
            {stage.label}
          </text>
          <circle r="3.4" fill={stage.hue} opacity="0.9">
            <animateMotion
              dur="9s"
              begin={stage.delay}
              repeatCount="indefinite"
              path={`M ${CENTRE + stage.rx} ${stage.y} a ${stage.rx} ${stage.ry} 0 1 1 -0.1 0`}
            />
          </circle>
        </g>
      ))}

      {/* Where the helix meets the top disc. */}
      <ellipse cx={CENTRE} cy={HELIX_BOTTOM + 12} rx={90} ry={16} fill="var(--color-oxblood)" opacity="0.26" filter="url(#vp-contact)" />

      {/* The helix. Depth-sorted, and sliding by exactly one turn. */}
      <g mask="url(#vp-helix-mask)">
        <g className="vp-helix" style={{ ["--vp-pitch" as string]: `${q(PITCH)}px` }}>
          {HELIX.map((item, index) => {
            const n = near(item.z);

            if (item.kind === "seg") {
              const width = q(4.4 + 8 * n);
              return (
                <g key={index}>
                  {/* A halo on near segments separates them from whatever they
                      cross in front of. Far segments do not need one. */}
                  {n > 0.55 ? (
                    <line
                      x1={item.x1}
                      y1={item.y1}
                      x2={item.x2}
                      y2={item.y2}
                      stroke="var(--color-surface)"
                      strokeWidth={q(width + 6)}
                      strokeLinecap="round"
                      opacity={q((n - 0.55) * 2.1)}
                    />
                  ) : null}
                  <line
                    x1={item.x1}
                    y1={item.y1}
                    x2={item.x2}
                    y2={item.y2}
                    stroke={item.strand === 0 ? "url(#vp-strand-a)" : "url(#vp-strand-b)"}
                    strokeWidth={width}
                    strokeLinecap="round"
                    opacity={q(0.2 + 0.8 * n)}
                  />
                </g>
              );
            }

            if (item.kind === "rung") {
              return (
                <line
                  key={index}
                  x1={item.x1}
                  y1={item.y1}
                  x2={item.x2}
                  y2={item.y2}
                  stroke={item.pair === 0 ? "var(--color-garnet)" : "var(--color-selected-border)"}
                  strokeWidth={q(1.5 + 1.6 * n)}
                  strokeLinecap="round"
                  opacity={q(0.14 + 0.5 * n)}
                />
              );
            }

            return (
              <circle
                key={index}
                cx={item.x}
                cy={item.y}
                r={q(2.2 + 4.8 * n)}
                fill={item.strand === 0 ? "url(#vp-bead-a)" : "url(#vp-bead-b)"}
                opacity={q(0.16 + 0.84 * n)}
              />
            );
          })}
        </g>
      </g>

      {/* Evidence arriving from the sources on the right. */}
      {[
        { y: 166, curve: 104 },
        { y: 248, curve: 74 },
        { y: 328, curve: 48 },
        { y: 400, curve: 22 },
      ].map((line, index) => {
        const path = `M ${WIDTH - 4} ${line.y} C ${WIDTH - 118} ${line.y}, ${CENTRE + line.curve + 74} ${INTAKE_Y}, ${CENTRE + line.curve} ${INTAKE_Y}`;
        return (
          <g key={line.y}>
            <path d={path} fill="none" stroke="var(--color-selected-border)" strokeOpacity="0.5" strokeWidth="1.1" />
            <circle r="2.9" fill="var(--color-garnet)">
              <animateMotion dur="4.5s" begin={`${index * 0.9}s`} repeatCount="indefinite" path={path} />
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                dur="4.5s"
                begin={`${index * 0.9}s`}
                repeatCount="indefinite"
              />
            </circle>
          </g>
        );
      })}

      {/* Records flowing out to the left, toward the patient panel. */}
      {[
        { y: 548, curve: -128 },
        { y: 606, curve: -162 },
      ].map((line, index) => (
        <path
          key={line.y}
          d={`M ${CENTRE + line.curve} ${line.y} C ${CENTRE + line.curve - 74} ${line.y}, 70 ${line.y + 14}, 6 ${line.y + 18}`}
          fill="none"
          stroke="var(--color-garnet)"
          strokeOpacity={0.24 - index * 0.06}
          strokeWidth="1.1"
        />
      ))}
    </svg>
  );
}
