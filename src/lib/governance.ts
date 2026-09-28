/**
 * The deployment and governance package as one Markdown document a partner's
 * reviewers can keep, annotate and circulate. Built from the same data the
 * Trust & governance page renders, so the two cannot drift apart.
 *
 * Client-safe and pure. It states what this deployment does and plans what a
 * pilot needs; it never states compliance.
 */

import {
  AI_INVENTORY,
  CONTROLS,
  CONTROL_STATUS,
  DATA_FLOWS,
  HOSTING_OPTIONS,
  HUMAN_OVERSIGHT,
  KNOWN_LIMITATIONS,
} from "@/data/governance";
import { EVIDENCE_SOURCES, SOURCE_KIND } from "@/data/regional";
import type { EvidenceMode } from "./clinvar";
import { ROLES } from "./roles";
import { REVIEW_SLA_DAYS } from "./workflow";

export interface DeploymentFacts {
  /** Where this instance is running: the Workers runtime, or a local Node server. */
  hosting: "cloudflare" | "local";
  /** Whether a Claude API key is configured on this deployment. */
  aiConfigured: boolean;
  aiModel: string;
  /** The evidence mode the deployment asks for. */
  evidenceMode: Exclude<EvidenceMode, "cached">;
  /** VARIANTPULSE_OFFLINE: live reads switched off entirely. */
  offline: boolean;
}

const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\n/g, " ");

export function deploymentPackage(facts: DeploymentFacts, generatedAt: string): string {
  const lines: string[] = [];
  const add = (...more: string[]) => lines.push(...more);

  add(
    "# VariantPulse: deployment and governance package",
    "",
    `Draft for discussion, generated ${generatedAt.slice(0, 10)}. It describes this demonstration and plans a pilot. It does not establish compliance with any standard or regulation.`,
    "",
    "## This deployment",
    "",
    `- Hosting: ${facts.hosting === "cloudflare" ? "Cloudflare Workers" : "a local development server"}, serving synthetic patient records only, with no server-side patient or case data.`,
    `- Evidence: ${facts.offline ? "live reads switched off; the verified snapshot is served" : facts.evidenceMode === "live" ? "live ClinVar reads, with the verified snapshot as a labelled fallback" : "demo mode; the verified ClinVar snapshot, no network reads"}.`,
    `- AI drafting: ${facts.aiConfigured ? `enabled (${facts.aiModel}), behind the checks listed below` : "not configured; every summary and letter comes from fixed templates"}.`,
    "",
    "## Hosting options",
    "",
    "| Option | What it is | Suits |",
    "|---|---|---|",
    ...HOSTING_OPTIONS.map((o) => `| ${cell(o.name)} | ${cell(o.summary)} | ${cell(o.suits)} |`),
    "",
    "## Controls",
    "",
    "| Area | Status here | In this demonstration | For a pilot |",
    "|---|---|---|---|",
    ...CONTROLS.map(
      (c) => `| ${cell(c.area)} | ${CONTROL_STATUS[c.status].label} | ${cell(c.demo)} | ${cell(c.pilot)} |`,
    ),
    "",
    "### Roles",
    "",
    ...Object.values(ROLES).map((r) => `- **${r.label}**: ${r.description}`),
    "",
    "### Review deadlines",
    "",
    `From the case being raised to a documented decision, by review priority: ${Object.entries(REVIEW_SLA_DAYS)
      .map(([level, days]) => `${level.toLowerCase()} ${days} days`)
      .join(", ")}. Placeholders, to be agreed with the partner's clinical governance. An undecided case past its deadline is escalated to the service lead.`,
    "",
    "## External data flows",
    "",
    "| Destination | When | Sends | Never sends | Control |",
    "|---|---|---|---|---|",
    ...DATA_FLOWS.map((f) => {
      const live = f.ai ? (facts.aiConfigured ? " (active here)" : " (off here: no key configured)") : "";
      return `| ${cell(f.destination)}${live} | ${cell(f.when)} | ${cell(f.sends)} | ${cell(f.never)} | ${cell(f.control)} |`;
    }),
    "",
    "## Evidence sources",
    "",
    "| Source | Publisher | Kind | Coverage | Limitations | Reuse |",
    "|---|---|---|---|---|---|",
    ...EVIDENCE_SOURCES.map(
      (s) =>
        `| ${cell(s.name)} | ${cell(s.publisher)} | ${SOURCE_KIND[s.kind].label} | ${cell(s.coverage)} | ${cell(s.limitations)} | ${cell(s.permission)} |`,
    ),
    "",
    "## AI and automated components",
    "",
  );

  for (const component of AI_INVENTORY) {
    add(
      `### ${component.name}`,
      "",
      `- Kind: ${component.kind}`,
      `- Purpose: ${component.purpose}`,
      `- Inputs: ${component.inputs}`,
      `- Outputs: ${component.outputs}`,
      `- Human oversight: ${component.oversight}`,
      `- Known limitations: ${component.limitations}`,
      `- Evaluation to date: ${component.evaluation}`,
      "",
    );
  }

  add(
    "## Human oversight",
    "",
    ...HUMAN_OVERSIGHT.map((line) => `- ${line}`),
    "",
    "## Known limitations",
    "",
    ...KNOWN_LIMITATIONS.map((line) => `- ${line}`),
    "",
    "## Responsible-AI alignment",
    "",
    "Aligning VariantPulse with the Department of Health – Abu Dhabi's requirements for responsible AI in healthcare is a separate workstream, to be done with the partner. The inputs are the AI inventory, the silent pilot's evaluation results, the known limitations and the human-oversight controls above.",
    "",
    "---",
    "",
    "Synthetic patient records · Real public genomic evidence · Decision support only.",
    "",
  );

  return lines.join("\n");
}
