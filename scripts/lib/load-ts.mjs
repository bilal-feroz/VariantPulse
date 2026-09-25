/**
 * Import this first to let a script `await import("@/…")` the application's
 * TypeScript modules. Static imports are resolved before this runs, so the
 * application modules must be imported dynamically after it.
 */

import { register } from "node:module";

register("./ts-hooks.mjs", import.meta.url);
