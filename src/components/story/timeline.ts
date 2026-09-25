/**
 * The Run evidence sync choreography.
 *
 * Fixed, deterministic timings: the sequence is identical on every run and
 * never waits on the network. Each entry is the moment (ms after the click)
 * the step begins.
 */

export const STORY_STEPS = [
  { id: "idle", caption: "Ready to check the record against current evidence." },
  { id: "sources", caption: "Evidence sources connected." },
  { id: "flow", caption: "Evidence flowing into VariantPulse." },
  { id: "scan", caption: "Scanning monitored variants." },
  { id: "detect", caption: "New evidence found for BRCA1 c.5522G>T." },
  { id: "reclassify", caption: "Classification changed: VUS to Likely pathogenic." },
  { id: "records", caption: "Searching historical hospital records." },
  { id: "patients", caption: "4 historical patients located." },
  { id: "review", caption: "Clinical review case created." },
] as const;

export type StoryStepId = (typeof STORY_STEPS)[number]["id"];

export const STEP = {
  idle: 0,
  sources: 1,
  flow: 2,
  scan: 3,
  detect: 4,
  reclassify: 5,
  records: 6,
  patients: 7,
  review: 8,
} as const satisfies Record<StoryStepId, number>;

export const FINAL_STEP = STEP.review;

/** Start time of each step, in ms after Run is pressed. Index = step. */
export const STEP_STARTS_MS = [0, 0, 650, 1450, 2450, 3150, 3950, 4650, 5450] as const;

/** Total length of the sequence, from click to the settled end state. */
export const STORY_DURATION_MS = 6000;

/** The variant the home story is about. */
export const STORY_VARIANT_KEY = "BRCA1:c.5522G>T";
