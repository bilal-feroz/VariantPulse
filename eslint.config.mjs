import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import { defineConfig, globalIgnores } from "eslint/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default defineConfig([
  // Generated output is never linted. `npm run cf:build` writes ~1,400 bundled
  // files into .open-next/ and `wrangler dev` writes local state into
  // .wrangler/; linting either buries real findings under thousands of errors
  // in minified code. `npm run verify:tree` separately fails if any of it is
  // ever committed again.
  globalIgnores([
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    ".open-next/**",
    ".wrangler/**",
    ".vercel/**",
    "qa-report/**",
    "next-env.d.ts",
    "cloudflare-env.d.ts",
  ]),
  ...compat.extends("next/core-web-vitals", "next/typescript"),
]);
