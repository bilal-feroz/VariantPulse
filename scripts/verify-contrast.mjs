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
 * The brand accent and the critical status colour are both red. They are
 * checked for separation so the alarm never reads as decoration.
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

const checks = [
  ["primary text", t.ink, SURFACES, 4.5],
  ["secondary text", t["ink-2"], SURFACES, 4.5],
  ["tertiary text", t.muted, SURFACES, 4.5],
  ["label text", t.faint, SURFACES, 4.5],
  ["accent text and links", t.accent, [...SURFACES, t["accent-soft"]], 4.5],
  ["positive badge", t.ok, [t.surface, t["ok-soft"]], 4.5],
  ["warning badge", t.warn, [t.surface, t["warn-soft"]], 4.5],
  ["critical badge", t.crit, [t.surface, t["crit-soft"]], 4.5],
  ["info badge", t.info, [t.surface, t["info-soft"]], 4.5],
  ["white on critical fill", "#ffffff", [t.crit], 4.5],
  ["white on primary button", "#ffffff", [t.ink], 4.5],
  ["white on accent avatar", "#ffffff", [t.accent], 4.5],
  ["focus ring", t.accent, SURFACES, 3.0],
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

if (failures.length > 0) {
  console.error(`\n${failures.length} problem(s):\n`);
  for (const f of failures) console.error(`  x ${f}`);
  process.exit(1);
}

console.log("\nContrast is compliant.");
