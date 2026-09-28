/**
 * Role-based access for the review workflow. Client-safe: no server imports.
 *
 * Every action a person can take in the workspace is a permission, and every
 * role is a fixed set of them. The interface asks `can` before it offers an
 * action and says which role would be needed when it does not, so what an
 * identity may do is visible rather than implied.
 *
 * Two rules sit on top of the role sets, because they depend on the case and
 * not only on who is asking:
 *
 *  - separation of duties: nobody approves a follow-up they proposed;
 *  - accountability: a case is closed by its named owner or the service lead.
 *
 * In this demonstration the identity is a switch. In a pilot it would come
 * from the facility's identity provider, with MFA, and this module would only
 * map the provider's groups onto these roles.
 */

import type { Persona, Role } from "@/data/workspace";

export type Permission =
  | "case:own"
  | "case:assign"
  | "case:review"
  | "case:decide"
  | "follow-up:propose"
  | "follow-up:approve"
  | "follow-up:complete"
  | "case:close"
  | "case:reopen"
  | "output:export"
  | "pilot:adjudicate"
  | "pilot:configure"
  | "data:import"
  | "session:delete";

export interface RoleMeta {
  role: Role;
  label: string;
  description: string;
  permissions: readonly Permission[];
}

const CLINICAL: readonly Permission[] = [
  "case:own",
  "case:review",
  "case:decide",
  "follow-up:propose",
  "follow-up:complete",
  "output:export",
  "pilot:adjudicate",
];

export const ROLES: Record<Role, RoleMeta> = {
  reviewer: {
    role: "reviewer",
    label: "Reviewing clinician",
    description:
      "Works cases: takes ownership, reviews the evidence, records decisions and proposes follow-ups.",
    permissions: CLINICAL,
  },
  approver: {
    role: "approver",
    label: "Service lead",
    description:
      "Reviews and decides like a clinician, approves the follow-ups others propose, assigns owners, closes and reopens cases, and sets the pilot's terms. Proposes no follow-up, so every approval has a second person.",
    // Everything clinical except proposing a follow-up: the service lead is
    // the only approver, and nobody approves their own proposal.
    permissions: [
      ...CLINICAL.filter((permission) => permission !== "follow-up:propose"),
      "case:assign",
      "follow-up:approve",
      "case:close",
      "case:reopen",
      "pilot:configure",
      "session:delete",
    ],
  },
  "data-steward": {
    role: "data-steward",
    label: "Data steward",
    description:
      "Imports and validates historical results, and holds the retention controls. Reads cases but takes no clinical action.",
    permissions: ["data:import", "session:delete"],
  },
  sponsor: {
    role: "sponsor",
    label: "Pilot sponsor",
    description: "Read-only. Sees the queue, the oversight view and the pilot evaluation.",
    permissions: [],
  },
};

export function can(role: Role, permission: Permission): boolean {
  return ROLES[role].permissions.includes(permission);
}

/** The roles that hold a permission, for "needs the … role" explanations. */
export function rolesWith(permission: Permission): Role[] {
  return (Object.keys(ROLES) as Role[]).filter((role) => can(role, permission));
}

/** Why a person cannot take an action, or null when they can. */
export function denial(persona: Persona, permission: Permission): string | null {
  if (can(persona.role, permission)) return null;
  const holders = rolesWith(permission).map((role) => ROLES[role].label.toLowerCase());
  return holders.length > 0
    ? `Needs the ${holders.join(" or ")} role. You are signed in as ${ROLES[persona.role].label.toLowerCase()}.`
    : "No role can take this action.";
}

/** Separation of duties: approving your own proposal is never allowed. */
export function canApproveFollowUp(persona: Persona, proposedBy: string): string | null {
  const denied = denial(persona, "follow-up:approve");
  if (denied) return denied;
  return persona.name === proposedBy
    ? "You proposed this follow-up, so someone else must approve it."
    : null;
}

/** A case is closed by its named owner or the service lead, and nobody else. */
export function canCloseCase(persona: Persona, owner: string | null): string | null {
  if (can(persona.role, "case:close")) return null;
  if (owner && persona.name === owner && can(persona.role, "case:decide")) return null;
  return owner
    ? `Only the case owner (${owner}) or the service lead can close this case.`
    : "Only the case owner or the service lead can close a case. Assign an owner first.";
}
