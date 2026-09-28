/**
 * Fails when generated output or secrets are tracked by git.
 *
 *   node scripts/verify-tree.mjs
 *
 * `npm run cf:build` writes ~1,400 bundled files into .open-next/, and
 * `wrangler dev` keeps local state, SQLite included, in .wrangler/. Both are in
 * .gitignore, but .gitignore only stops untracked files: once a directory has
 * been committed, every later build churns it, and lint and type-check walk
 * thousands of minified files. That happened once (commit 9fb4e96), so this
 * gate makes sure it cannot happen quietly again.
 */

import { execFileSync } from "node:child_process";

const FORBIDDEN = [
  { test: (path) => path.startsWith(".open-next/"), what: "OpenNext build output (.open-next/)" },
  { test: (path) => path.startsWith(".wrangler/"), what: "Wrangler local state (.wrangler/)" },
  { test: (path) => path.startsWith(".next/"), what: "Next.js build output (.next/)" },
  { test: (path) => /^(out|build|coverage)\//.test(path), what: "build or coverage output" },
  { test: (path) => path.split("/").includes("node_modules"), what: "installed dependencies (node_modules/)" },
  { test: (path) => path.endsWith(".tsbuildinfo"), what: "TypeScript incremental state (*.tsbuildinfo)" },
  { test: (path) => path === "next-env.d.ts", what: "generated Next.js types (next-env.d.ts)" },
  {
    test: (path) => /(^|\/)\.env(\..+)?$/.test(path) && !path.endsWith(".env.example"),
    what: "environment files, which can hold secrets (.env*)",
  },
  { test: (path) => /(^|\/)\.dev\.vars(\..+)?$/.test(path), what: "Wrangler secrets (.dev.vars)" },
];

let tracked;
try {
  tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
    .split("\0")
    .filter(Boolean);
} catch {
  console.log("  Not a git checkout, so there is no tracked tree to check. Skipped.");
  process.exit(0);
}

const offending = new Map();
for (const path of tracked) {
  const rule = FORBIDDEN.find((candidate) => candidate.test(path));
  if (!rule) continue;
  const bucket = offending.get(rule.what) ?? [];
  bucket.push(path);
  offending.set(rule.what, bucket);
}

if (offending.size === 0) {
  console.log(`  ${tracked.length} tracked files, none generated or secret.`);
  console.log("\nTree is clean.");
  process.exit(0);
}

console.error("Generated output or secrets are tracked by git:\n");
const roots = new Set();
for (const [what, paths] of offending) {
  console.error(`  ${what}: ${paths.length} file${paths.length === 1 ? "" : "s"}`);
  for (const path of paths.slice(0, 3)) console.error(`    ${path}`);
  if (paths.length > 3) console.error(`    ...and ${paths.length - 3} more`);
  for (const path of paths) roots.add(path.includes("/") ? `${path.split("/")[0]}/` : path);
}
console.error(
  `\nStop tracking them (the files stay on disk) and commit the removal:\n\n  git rm -r --cached ${[...roots].join(" ")}\n`,
);
process.exit(1);
