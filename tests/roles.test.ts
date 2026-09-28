import { describe, expect, it } from "vitest";

import { PERSONAS, PERSONA_BY_ID, SERVICE_LEAD } from "@/data/workspace";
import { ROLES, can, canApproveFollowUp, canCloseCase, denial } from "@/lib/roles";

const persona = (id: string) => {
  const found = PERSONA_BY_ID.get(id);
  if (!found) throw new Error(`No persona ${id}`);
  return found;
};

describe("roles", () => {
  it("signs in as one of four identities, one per role", () => {
    expect(PERSONAS.map((p) => p.role).sort()).toEqual(["approver", "data-steward", "reviewer", "sponsor"]);
    expect(SERVICE_LEAD.role).toBe("approver");
  });

  it("lets a reviewer work a case but not approve or close it", () => {
    expect(can("reviewer", "case:decide")).toBe(true);
    expect(can("reviewer", "follow-up:propose")).toBe(true);
    expect(can("reviewer", "follow-up:approve")).toBe(false);
    expect(can("reviewer", "case:close")).toBe(false);
  });

  it("gives the sponsor nothing but reading, and the data steward only imports", () => {
    expect(ROLES.sponsor.permissions).toEqual([]);
    expect(ROLES["data-steward"].permissions).toEqual(["data:import"]);
    expect(denial(persona("idris"), "case:decide")).toMatch(/reviewing clinician or service lead/);
  });

  it("never lets anyone approve their own follow-up", () => {
    const lead = persona("hamdan");
    expect(canApproveFollowUp(lead, "Dr. A. Kassim")).toBeNull();
    expect(canApproveFollowUp(lead, lead.name)).toMatch(/someone else must approve/);
    expect(canApproveFollowUp(persona("kassim"), "Dr. S. Hamdan")).toMatch(/Needs the service lead role/);
  });

  it("lets the named owner or the service lead close a case, nobody else", () => {
    const reviewer = persona("kassim");
    expect(canCloseCase(reviewer, reviewer.name)).toBeNull();
    expect(canCloseCase(reviewer, "Dr. R. Okonjo")).toMatch(/Only the case owner \(Dr. R. Okonjo\)/);
    expect(canCloseCase(persona("hamdan"), "Dr. R. Okonjo")).toBeNull();
    expect(canCloseCase(persona("mansour"), "K. Mansour")).not.toBeNull();
  });
});
