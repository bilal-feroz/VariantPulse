/**
 * Module hooks that let the Node scripts import the application's TypeScript
 * modules directly, so a check runs the same code the interface does.
 *
 * - `@/…` resolves to `src/…`, as in tsconfig.json.
 * - Extensionless relative imports from TypeScript files resolve to `.ts`/`.tsx`.
 * - TypeScript is transpiled with the project's own compiler, types erased.
 * - JSON imports become plain modules, as the bundler treats them.
 * - `server-only` becomes an empty module: the scripts run outside React.
 *
 * Registered by `load-ts.mjs`.
 */

import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = resolvePath(ROOT, "src");
const EMPTY_MODULE = "data:text/javascript,export%20%7B%7D";

function asFile(base) {
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, resolvePath(base, "index.ts")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return pathToFileURL(candidate).href;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: EMPTY_MODULE, shortCircuit: true };

  if (specifier.startsWith("@/")) {
    const url = asFile(resolvePath(SRC, specifier.slice(2)));
    if (url) return { url, shortCircuit: true };
  }

  const parent = context.parentURL;
  if (/^\.{1,2}\//.test(specifier) && parent?.startsWith("file:") && /\.tsx?$/.test(parent)) {
    const url = asFile(resolvePath(dirname(fileURLToPath(parent)), specifier));
    if (url) return { url, shortCircuit: true };
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith("file:") && /\.tsx?$/.test(url)) {
    const fileName = fileURLToPath(url);
    const { outputText } = ts.transpileModule(await readFile(fileName, "utf8"), {
      fileName,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    });
    return { format: "module", source: outputText, shortCircuit: true };
  }

  if (url.startsWith("file:") && url.endsWith(".json") && !context.importAttributes?.type) {
    const json = await readFile(fileURLToPath(url), "utf8");
    return { format: "module", source: `export default ${json};`, shortCircuit: true };
  }

  return nextLoad(url, context);
}
