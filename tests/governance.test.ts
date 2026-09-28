import { describe, expect, it } from "vitest";

import { AI_INVENTORY, CONTROLS, DATA_FLOWS } from "@/data/governance";
import { EVIDENCE_SOURCES } from "@/data/regional";
import { deploymentPackage, type DeploymentFacts } from "@/lib/governance";

const facts: DeploymentFacts = {
  hosting: "cloudflare",
  aiConfigured: false,
  aiModel: "claude-opus-5",
  evidenceMode: "live",
  offline: false,
};
const AT = "2026-09-28T10:00:00.000Z";

describe("the governance package", () => {
  it("says what this deployment actually runs", () => {
    const off = deploymentPackage(facts, AT);
    expect(off).toContain("AI drafting: not configured; every summary and letter comes from fixed templates.");
    expect(off).toContain("(off here: no key configured)");
    expect(off).toContain("live ClinVar reads, with the verified snapshot as a labelled fallback");
    expect(off).toContain("Hosting: Cloudflare Workers");
    expect(deploymentPackage({ ...facts, hosting: "local" }, AT)).toContain("Hosting: a local development server");

    const on = deploymentPackage({ ...facts, aiConfigured: true, evidenceMode: "demo" }, AT);
    expect(on).toContain("AI drafting: enabled (claude-opus-5)");
    expect(on).toContain("(active here)");
    expect(on).toContain("demo mode");
  });

  it("carries every control, flow, source and AI component", () => {
    const text = deploymentPackage(facts, AT);
    for (const control of CONTROLS) expect(text).toContain(`| ${control.area} |`);
    for (const flow of DATA_FLOWS) expect(text).toContain(flow.destination);
    for (const source of EVIDENCE_SOURCES) expect(text).toContain(`| ${source.name} |`);
    for (const component of AI_INVENTORY) expect(text).toContain(`### ${component.name}`);
  });

  it("never claims compliance", () => {
    const text = deploymentPackage(facts, AT);
    expect(text).toContain("It does not establish compliance with any standard or regulation.");
    expect(text).not.toMatch(/\b(is|are|fully) compliant\b|certified (by|as)|meets (all|the) requirements/i);
  });

  it("registers no flow that sends a patient identifier", () => {
    for (const flow of DATA_FLOWS) {
      expect(flow.sends).not.toMatch(/record identifier|patient identifier|clinician name/i);
    }
  });
});
