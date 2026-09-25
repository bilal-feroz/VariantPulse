/**
 * The double helix beside the home heading.
 *
 * The helix is drawn as individually depth-sorted pieces rather than two flat
 * paths. Every piece carries a z derived from its phase, and the whole set is
 * painted back to front, so strands genuinely pass behind one another. Stroke
 * weight and opacity scale with depth, and near segments get a pale halo so a
 * crossing reads as one strand passing in front of the other.
 *
 * Base-pair rungs are split at the axis. Each half inherits the depth of the
 * strand it attaches to, so its near half paints in front of the near strand
 * and its far half behind the far one, which is most of what makes the form
 * read as solid.
 *
 * Rotation is a translation, not a recomputation: the geometry is periodic
 * along the axis with a period of one PITCH, so sliding the strands by exactly
 * that distance lands every piece on a position of identical phase. The loop is
 * seamless and costs no JavaScript. The whole form is then leaned onto the
 * diagonal it holds on screen.
 *
 * It is decorative, so it is hidden from assistive technology.
 */

import { cn } from "@/lib/utils";

const WIDTH = 260;
const HEIGHT = 240;

/** Visible length along the helix's own axis, and its radius. */
const LENGTH = 316;
const AMPLITUDE = 30;
const TURNS = 3.2;
/** Distance along the axis covered by one full turn. The animation slides by this. */
const PITCH = LENGTH / TURNS;
/** Degrees the axis leans clockwise from vertical, so it rises to the right. */
const LEAN = 44;
/** Spacing between sample points, in user units. */
const STEP = 3;
/** A base pair every nth sample. */
const RUNG_EVERY = 4;

const TOP = -LENGTH / 2;
const BOTTOM = LENGTH / 2;

/**
 * Quantises a value before it reaches the DOM.
 *
 * ECMAScript does not require Math.sin and Math.cos to be correctly rounded,
 * so Node and the browser can disagree in the last bit. Those floats become SVG
 * attributes, and React would report a hydration mismatch. Rounding first makes
 * the two agree.
 */
const q = (value: number, places = 3): number => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

interface Node {
  x: number;
  y: number;
  /** Depth: +1 nearest the viewer, -1 furthest. */
  z: number;
}

/** Samples one strand from a full turn before the visible start, so it has somewhere to slide in from. */
function strandNodes(phase: number): Node[] {
  const start = TOP - PITCH;
  const count = Math.round((BOTTOM - start) / STEP);

  return Array.from({ length: count + 1 }, (_, i) => {
    const y = start + i * STEP;
    // The angle advances with absolute position, which is what makes the slide seamless.
    const angle = ((y - TOP) / PITCH) * Math.PI * 2 + phase;
    return { x: q(AMPLITUDE * Math.sin(angle), 4), y: q(y, 4), z: q(Math.cos(angle), 6) };
  });
}

type Piece =
  | { kind: "strand"; strand: 0 | 1; z: number; x1: number; y1: number; x2: number; y2: number }
  | { kind: "rung"; z: number; x1: number; y1: number; x2: number; y2: number };

function buildHelix(): Piece[] {
  const a = strandNodes(0);
  const b = strandNodes(Math.PI);
  const pieces: Piece[] = [];

  for (let i = 0; i < a.length - 1; i += 1) {
    for (const [strand, nodes] of [[0, a], [1, b]] as const) {
      pieces.push({
        kind: "strand",
        strand,
        z: (nodes[i].z + nodes[i + 1].z) / 2,
        x1: nodes[i].x,
        y1: nodes[i].y,
        x2: nodes[i + 1].x,
        y2: nodes[i + 1].y,
      });
    }
  }

  // Both strands are sampled at the same positions, so a[i] and b[i] face each other.
  for (let i = 0; i < a.length; i += RUNG_EVERY) {
    pieces.push({ kind: "rung", z: a[i].z * 0.7, x1: a[i].x, y1: a[i].y, x2: 0, y2: a[i].y });
    pieces.push({ kind: "rung", z: b[i].z * 0.7, x1: 0, y1: b[i].y, x2: b[i].x, y2: b[i].y });
  }

  return pieces.sort((p, r) => p.z - r.z);
}

const HELIX = buildHelix();

/** Maps depth to 0 (furthest) … 1 (nearest). */
const near = (z: number) => (z + 1) / 2;

/**
 * Strand colour by depth band, far to near: garnet up close, paler with
 * distance, as on a light ground. Each band is opaque. Translucent segments would double up wherever
 * neighbours overlap and ripple the strand with darker stripes.
 */
const SHADES = [
  ["#F6E8EB", "#E9C9D1", "#DCAAB6"],
  ["#F1DCE1", "#DDADBA", "#C98C9C"],
  ["#EBC9D1", "#C9798D", "#A95A6F"],
  ["#E3AFBC", "#B04F68", "#8A3A4F"],
  ["#D98FA2", "#96334D", "#6E2338"],
  ["#CF7890", "#7A263A", "#481A27"],
];

const shade = (n: number) => Math.min(SHADES.length - 1, Math.floor(n * SHADES.length));

/** Loose particles around the helix, in viewBox units. `soft` ones sit out of focus. */
const PARTICLES: { x: number; y: number; r: number; opacity: number; soft?: boolean }[] = [
  { x: 30, y: 214, r: 3.4, opacity: 0.75 },
  { x: 12, y: 176, r: 5.5, opacity: 0.28, soft: true },
  { x: 58, y: 236, r: 2, opacity: 0.5 },
  { x: 70, y: 160, r: 2.2, opacity: 0.55 },
  { x: 104, y: 222, r: 1.8, opacity: 0.45 },
  { x: 118, y: 66, r: 2.4, opacity: 0.45 },
  { x: 160, y: 196, r: 2.8, opacity: 0.55 },
  { x: 186, y: 150, r: 1.6, opacity: 0.4 },
  { x: 204, y: 26, r: 3, opacity: 0.75 },
  { x: 232, y: 70, r: 2.2, opacity: 0.55 },
  { x: 248, y: 12, r: 4.6, opacity: 0.3, soft: true },
  { x: 250, y: 128, r: 6.5, opacity: 0.2, soft: true },
  { x: 146, y: 20, r: 1.7, opacity: 0.4 },
];

export function HeroHelix({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={cn("block", className)}
      aria-hidden
      focusable="false"
    >
      <defs>
        {/* Gradients run across the axis in the helix's own frame, so the
            light stays put while the strands slide through it. */}
        {SHADES.map(([light, mid, dark], band) => (
          <linearGradient
            key={band}
            id={`vp-hero-shade-${band}`}
            gradientUnits="userSpaceOnUse"
            x1={-AMPLITUDE}
            y1="0"
            x2={AMPLITUDE}
            y2="0"
          >
            <stop offset="0%" stopColor={light} />
            <stop offset="50%" stopColor={mid} />
            <stop offset="100%" stopColor={dark} />
          </linearGradient>
        ))}

        {/* Fades both ends so the helix does not look cropped. */}
        <linearGradient id="vp-hero-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0" />
          <stop offset="10%" stopColor="#fff" stopOpacity="1" />
          <stop offset="90%" stopColor="#fff" stopOpacity="1" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </linearGradient>
        <mask
          id="vp-hero-mask"
          maskUnits="userSpaceOnUse"
          x={-AMPLITUDE * 2}
          y={TOP}
          width={AMPLITUDE * 4}
          height={LENGTH}
        >
          <rect
            x={-AMPLITUDE * 2}
            y={TOP}
            width={AMPLITUDE * 4}
            height={LENGTH}
            fill="url(#vp-hero-fade)"
          />
        </mask>

        <filter id="vp-hero-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
        <filter id="vp-hero-soft" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>

      <g transform={`translate(${WIDTH / 2} ${HEIGHT / 2}) rotate(${LEAN})`}>
        {/* Ambient wash behind the form. */}
        <ellipse
          rx={AMPLITUDE * 2.4}
          ry={LENGTH * 0.4}
          fill="#E8C5CC"
          opacity="0.55"
          filter="url(#vp-hero-glow)"
        />

        <g mask="url(#vp-hero-mask)">
          <g className="vp-helix" style={{ ["--vp-pitch" as string]: `${q(PITCH)}px` }}>
            {HELIX.map((piece, index) => {
              const n = near(piece.z);

              if (piece.kind === "rung") {
                return (
                  <line
                    key={index}
                    x1={piece.x1}
                    y1={piece.y1}
                    x2={piece.x2}
                    y2={piece.y2}
                    stroke="#D4A0AE"
                    strokeWidth={q(1.4 + 1.8 * n)}
                    strokeLinecap="round"
                    opacity={q(0.3 + 0.6 * n)}
                  />
                );
              }

              const width = q(4 + 7 * n);
              return (
                <g key={index}>
                  {/* Only the nearest stretch, where it crosses the other strand,
                      needs a halo to read as passing in front. Butt ends keep
                      each halo off its neighbour, which would stripe the strand. */}
                  {n > 0.8 ? (
                    <line
                      x1={piece.x1}
                      y1={piece.y1}
                      x2={piece.x2}
                      y2={piece.y2}
                      stroke="#FFFEFB"
                      strokeWidth={q(width + 4)}
                      strokeLinecap="butt"
                      opacity={q((n - 0.8) * 5)}
                    />
                  ) : null}
                  <line
                    x1={piece.x1}
                    y1={piece.y1}
                    x2={piece.x2}
                    y2={piece.y2}
                    stroke={`url(#vp-hero-shade-${shade(n)})`}
                    strokeWidth={width}
                    strokeLinecap="round"
                  />
                </g>
              );
            })}
          </g>
        </g>
      </g>

      <g className="vp-drift">
        {PARTICLES.map((particle) => (
          <circle
            key={`${particle.x}-${particle.y}`}
            cx={particle.x}
            cy={particle.y}
            r={particle.r}
            fill="#E85D4A"
            opacity={particle.opacity}
            filter={particle.soft ? "url(#vp-hero-soft)" : undefined}
          />
        ))}
      </g>
    </svg>
  );
}
