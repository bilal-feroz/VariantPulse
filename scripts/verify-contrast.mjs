/**
 * Colour contrast checks.
 *
 *   node scripts/verify-contrast.mjs
 *
 * Reads the tokens straight out of globals.css and asserts every foreground
 * clears WCAG 2.1 AA against each surface it actually appears on.
 *
 * Two things this deliberately does not relax:
 *
 * Small uppercase labels are still "normal text" under 1.4.3, so the faintest
 * tone is held to 4.5:1 rather than the 3:1 allowed for large text. The
 * lightness hierarchy is therefore shallow by design — size, case and tracking
 * carry it instead.
 *
 * Garnet (brand), clinical red (critical) and vermilion (change) are all
 * warm reds. They are checked for separation so the alarm and the change
 * signal never read as decoration.
 *
 * Vermilion is only 3:1-capable on bone, so it is checked as a non-text /
 * large-indicator colour and must never be used for small text.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(HERE, "../src/app/globals.css"), "utf8");

const tokens = {};
for (const match of css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) {
  tokens[match[1]] = match[2];
}

const rgb = (h) => {
  const n = Number.parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const channel = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = (h) => {
  const [r, g, b] = rgb(h).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const hue = (h) => {
  const [r, g, b] = rgb(h).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (!d) return 0;
  const raw = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (raw * 60 + 360) % 360;
};

const t = tokens;
/** Every background a foreground is actually painted on. */
const SURFACES = [t.surface, t["surface-2"], t["surface-3"], t.canvas];
/** Surfaces every small-text token must clear: bone, warm white, selected. */
const TEXT_SURFACES = [...SURFACES, t.bone, t["warm-white"], t["selected-bg"]];
/** Text allowed on the active navigation / accent-soft fill. */
const ACTIVE_SURFACES = [t["active-bg"], t["accent-soft"]];
const WHITE = "#ffffff";

const checks = [
  // Text ramp on bone, warm white and the neutral fills.
  ["primary text (carbon)", t.ink, [...TEXT_SURFACES, ...ACTIVE_SURFACES], 4.5],
  ["secondary text", t["ink-2"], [...TEXT_SURFACES, ...ACTIVE_SURFACES], 4.5],
  ["tertiary text", t.muted, [...TEXT_SURFACES, ...ACTIVE_SURFACES], 4.5],
  ["label text (text-safe slate)", t.faint, TEXT_SURFACES, 4.5],

  // Brand.
  ["white on primary CTA (oxblood)", WHITE, [t.oxblood, t["accent-hover"]], 4.5],
  ["white on CTA hover (garnet)", WHITE, [t.garnet, t.accent], 4.5],
  [
    "garnet text on bone / warm white / active / selected",
    t.accent,
    [...TEXT_SURFACES, ...ACTIVE_SURFACES],
    4.5,
  ],

  // Semantic chips: text on its own soft background and on plain surfaces.
  ["low / stable chip (clinical green)", t.ok, [t.surface, t.canvas, t["ok-soft"]], 4.5],
  ["medium priority chip (text-safe amber)", t.warn, [t.surface, t.canvas, t["warn-soft"]], 4.5],
  ["high priority chip (clinical red)", t.crit, [t.surface, t.canvas, t["crit-soft"]], 4.5],
  ["evidence chip (evidence blue)", t.info, [t.surface, t.canvas, t["info-soft"]], 4.5],
  ["white on critical fill", WHITE, [t.crit], 4.5],
  ["white on connected fill", WHITE, [t.ok], 4.5],
  ["white on medium fill", WHITE, [t.warn], 4.5],

  // Non-text (1.4.11): focus ring, status dots and the change pulse.
  ["focus ring (garnet)", t.accent, SURFACES, 3.0],
  ["connected dot (clinical green)", t.ok, SURFACES.slice(0, 2).concat(t.canvas), 3.0],
  ["change indicator (vermilion, non-text/large only)", t.vermilion, [t.surface, t.canvas], 3.0],
];

const failures = [];

for (const [label, fg, backgrounds, min] of checks) {
  if (!fg) {
    failures.push(`${label}: token missing from globals.css`);
    continue;
  }
  let worst = Infinity;
  let worstBg = "";
  for (const bg of backgrounds) {
    const r = contrast(fg, bg);
    if (r < worst) {
      worst = r;
      worstBg = bg;
    }
  }
  const ok = worst >= min;
  if (!ok) failures.push(`${label}: ${worst.toFixed(2)}:1 on ${worstBg} (needs ${min}:1)`);
  console.log(
    `  ${ok ? "PASS" : "FAIL"} ${worst.toFixed(2).padStart(6)}:1  ${label}  (worst on ${worstBg})`,
  );
}

/* -- Hierarchy and alarm separation --------------------------------------- */

const ramp = ["ink", "ink-2", "muted", "faint"];
console.log("\n  text ramp against white:");
let previous = null;
for (const name of ramp) {
  const r = contrast(t[name], t.surface);
  console.log(
    `    ${name.padEnd(6)} ${r.toFixed(2).padStart(6)}:1${previous ? `   step ${(previous / r).toFixed(2)}x` : ""}`,
  );
  if (previous && previous / r < 1.12) {
    failures.push(`text ramp: ${name} is too close to the tone above it to read as a level`);
  }
  previous = r;
}

const separation = Math.abs(hue(t.accent) - hue(t.crit));
const apart = Math.min(separation, 360 - separation);
const accentVsCrit = contrast(t.accent, t.crit);
console.log(
  `\n  accent ${t.accent} (${hue(t.accent).toFixed(0)}deg) vs critical ${t.crit} (${hue(t.crit).toFixed(0)}deg): ${apart.toFixed(0)}deg apart`,
);
// They are both red by design, so hue alone cannot carry the distinction. The
// interface fills the critical badge and tints everything else; this only
// guards against the two becoming literally the same colour.
if (apart < 8 && accentVsCrit < 1.3) {
  failures.push("accent and critical are indistinguishable by both hue and lightness");
}

const vermVsCrit = Math.abs(hue(t.vermilion) - hue(t.crit));
const vermApart = Math.min(vermVsCrit, 360 - vermVsCrit);
console.log(
  `  vermilion ${t.vermilion} (${hue(t.vermilion).toFixed(0)}deg) vs critical: ${vermApart.toFixed(0)}deg apart, ${contrast(t.vermilion, t.crit).toFixed(2)}:1`,
);
if (vermApart < 8 && contrast(t.vermilion, t.crit) < 1.3) {
  failures.push("vermilion (change) and critical are indistinguishable");
}

/* -- Palette slate is non-text only -------------------------------------- */

const TEXT_TOKENS = ["ink", "ink-2", "muted", "faint", "accent", "ok", "warn", "crit", "info"];
for (const name of TEXT_TOKENS) {
  if ((t[name] ?? "").toLowerCase() === t.slate.toLowerCase()) {
    failures.push(`--color-${name} uses palette slate ${t.slate}, which fails 4.5:1 as small text`);
  }
}
const slateOnBone = contrast(t.slate, t.bone);
console.log(`  palette slate ${t.slate} on bone: ${slateOnBone.toFixed(2)}:1 (non-text only)`);
if (slateOnBone < 3) failures.push("palette slate no longer clears 3:1 as a non-text colour");

/* -- Palette fidelity: explicit tokens match docs/color-system.md --------- */

const PALETTE = {
  garnet: "#7a263a",
  oxblood: "#481a27",
  vermilion: "#e85d4a",
  bone: "#f7f4ed",
  "warm-white": "#fffefb",
  carbon: "#17191c",
  slate: "#74777d",
  mineral: "#dddad2",
  "clinical-green": "#277c66",
  amber: "#d99a28",
  "clinical-red": "#c63d3d",
  "evidence-blue": "#416b8c",
  "active-bg": "#f0dfe2",
  "selected-bg": "#fff8f6",
  "selected-border": "#e8c5cc",
  canvas: "#f7f4ed",
  surface: "#fffefb",
  ink: "#17191c",
  accent: "#7a263a",
  "accent-hover": "#481a27",
};
for (const [name, hex] of Object.entries(PALETTE)) {
  if ((t[name] ?? "").toLowerCase() !== hex) {
    failures.push(`palette: --color-${name} is ${t[name] ?? "missing"}, expected ${hex}`);
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} problem(s):\n`);
  for (const f of failures) console.error(`  x ${f}`);
  process.exit(1);
}

console.log("\nContrast is compliant.");
