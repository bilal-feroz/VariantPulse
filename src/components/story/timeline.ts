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
  { id: "detect", caption: "New evidence found." },
  { id: "reclassify", caption: "Classification changed." },
  { id: "records", caption: "Searching historical hospital records." },
  { id: "patients", caption: "Historical patients located." },
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
export const STEP_STARTS_MS = [0, 0, 600, 1300, 2100, 2700, 3850, 4450, 5250] as const;

/** Total length of the sequence, from click to the settled end state. */
export const STORY_DURATION_MS = 5800;

export function patientsLocated(count: number): string {
  return `${count} historical patient${count === 1 ? "" : "s"} located`;
}

/** Screen-reader caption for a step, filled in from the story's own data. */
export function storyCaption(
  step: number,
  story: { gene: string; hgvs: string; recorded: string; current: string; patients: number },
): string {
  switch (STORY_STEPS[step]?.id) {
    case "detect":
      return `New evidence found for ${story.gene} ${story.hgvs}.`;
    case "reclassify":
      return `Classification changed: ${story.recorded} to ${story.current}.`;
    case "patients":
      return `${patientsLocated(story.patients)}.`;
    default:
      return STORY_STEPS[step]?.caption ?? "";
  }
}
