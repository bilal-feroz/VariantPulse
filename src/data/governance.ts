/**
 * The deployment and governance package.
 *
 * How VariantPulse would be hosted, what each security control looks like in
 * this demonstration against what a pilot needs, where data goes, and what
 * every automated component does, with its limits and the human oversight
 * around it. Written for a partner's security, privacy and clinical-governance
 * reviewers.
 *
 * It describes; it does not certify. Nothing here establishes compliance with
 * any standard or regulation, and every "pilot" entry is a plan to agree with
 * the partner, not a claim about what exists today.
 */

export type ControlStatus = "demonstrated" | "partial" | "not-in-demo";

export const CONTROL_STATUS: Record<ControlStatus, { label: string; tone: "positive" | "warning" | "muted" }> = {
  demonstrated: { label: "Demonstrated here", tone: "positive" },
  partial: { label: "Partly here", tone: "warning" },
  "not-in-demo": { label: "Not in this demo", tone: "muted" },
};

export interface Control {
  area: string;
  status: ControlStatus;
  /** What this demonstration does today. */
  demo: string;
  /** What a pilot deployment would need, to be agreed with the partner. */
  pilot: string;
}

export const CONTROLS: Control[] = [
  {
    area: "Hosting",
    status: "partial",
    demo: "Runs on Cloudflare Workers. Every record is synthetic, and no case or patient data is stored on a server: workflow state stays in the browser tab.",
    pilot: "Facility-controlled hosting, or an approved UAE hosting option agreed with the partner, with data residency confirmed before any real record is loaded.",
  },
  {
    area: "Role-based access",
    status: "demonstrated",
    demo: "Four roles with fixed permissions. The interface offers only what the signed-in role may do, and says which role an unavailable action needs.",
    pilot: "Roles mapped from the facility's identity-provider groups. No local accounts.",
  },
  {
    area: "Separation of duties",
    status: "demonstrated",
    demo: "A follow-up that could reach a patient is approved by someone other than the clinician who proposed it. A case is closed only by its owner or the service lead.",
    pilot: "The same rules, enforced on the server as well as in the interface.",
  },
  {
    area: "Multi-factor authentication",
    status: "not-in-demo",
    demo: "Identities are a demonstration switch in the top bar.",
    pilot: "Single sign-on through the facility's identity provider, with MFA enforced there.",
  },
  {
    area: "Separation between organisations",
    status: "not-in-demo",
    demo: "One synthetic organisation.",
    pilot: "A separate tenant, data store and keys per facility, with no query that crosses facilities.",
  },
  {
    area: "Encryption",
    status: "partial",
    demo: "HTTPS in transit. Nothing patient-related is stored server-side, so nothing is held at rest.",
    pilot: "TLS in transit, and encryption at rest with facility-managed keys for the case store and the audit log.",
  },
  {
    area: "Audit log",
    status: "demonstrated",
    demo: "Every sync, detection and review action is recorded with who, when and what. Each case keeps an append-only history, and the trail exports as CSV or JSON.",
    pilot: "Server-side, append-only and tamper-evident, retained to the facility's schedule and readable by its auditors.",
  },
  {
    area: "Backup and restore",
    status: "not-in-demo",
    demo: "Nothing to back up: the demonstration keeps no server-side data.",
    pilot: "Scheduled backups of the case store and audit log, with a restore tested before go-live and at an agreed interval.",
  },
  {
    area: "Retention and deletion",
    status: "demonstrated",
    demo: "Session data lives in this browser tab only, is cleared when the tab closes, and can be deleted at any time from this page.",
    pilot: "A retention schedule agreed with the facility, deletion on request, and a record kept of each deletion.",
  },
  {
    area: "External data flows",
    status: "demonstrated",
    demo: "Registered below, flow by flow, including AI services. No patient identifier is sent anywhere.",
    pilot: "The same register, reviewed by the facility's privacy officer, with each flow approved or switched off.",
  },
];

export interface DataFlow {
  destination: string;
  /** Whether the flow is an AI service; its live status depends on the deployment. */
  ai: boolean;
  when: string;
  sends: string;
  never: string;
  control: string;
}

export const DATA_FLOWS: DataFlow[] = [
  {
    destination: "NCBI E-utilities (ClinVar)",
    ai: false,
    when: "Each evidence sync in live mode; never in demo mode.",
    sends: "The ClinVar variation IDs of the monitored panel, in one batched request.",
    never: "Any record identifier, patient attribute, genotype or clinician.",
    control: "Off in demo mode, or entirely with VARIANTPULSE_OFFLINE=1.",
  },
  {
    destination: "Claude API (Anthropic): evidence summary",
    ai: true,
    when: "When a case is opened, and only if an AI key is configured.",
    sends: "The case's variant facts: gene, HGVS, classifications, ClinVar review status and dates, regional counts, linked publication titles.",
    never: "Any record identifier, patient attribute or clinician.",
    control: "Off unless AI_API_KEY is set. Every sentence must carry a source tag from the case; any failure falls back to a fixed template.",
  },
  {
    destination: "Claude API (Anthropic): patient letter wording",
    ai: true,
    when: "Only when a clinician presses Improve with AI on an approved letter, and only if an AI key is configured.",
    sends: "The template letter with the record reference, test date, team and clinician replaced by placeholders, and the gene name.",
    never: "The record reference, test date, team, clinician, or any other record content.",
    control: "Off unless AI_API_KEY is set. The reply is used only if every placeholder survives and it passes the letter's checks.",
  },
  {
    destination: "Browser session storage",
    ai: false,
    when: "Throughout a session.",
    sends: "Case workflow and history, the activity trail, adjudications, the last import summary and the signed-in role.",
    never: "Anything beyond this browser tab: none of it is written to a server.",
    control: "Cleared when the tab closes, or deleted from this page at any time.",
  },
  {
    destination: "Import files",
    ai: false,
    when: "When a data steward validates a file.",
    sends: "Nothing. The file is read and validated in the browser that opened it.",
    never: "The file's contents, to any server.",
    control: "The report can be downloaded; rows are previewed, never loaded into the workspace.",
  },
];

export interface AiComponent {
  name: string;
  kind: "Deterministic rules" | "Language model, optional";
  purpose: string;
  inputs: string;
  outputs: string;
  oversight: string;
  limitations: string;
  evaluation: string;
}

export const AI_INVENTORY: AiComponent[] = [
  {
    name: "Change detection",
    kind: "Deterministic rules",
    purpose: "Decides whether a variant's interpretation has materially changed since it was reported.",
    inputs: "The classification on record and the current source classification, normalised onto a fixed taxonomy.",
    outputs: "A change type, with the rationale written out step by step.",
    oversight: "Opens a case for a clinician. Changes no record and no classification.",
    limitations: "Only as current as the evidence it reads. Compares clinical bands, not the ACMG criteria behind them.",
    evaluation: "Unit tests and the data-coherence gate. Not yet evaluated against an independent expert reference set.",
  },
  {
    name: "Review priority",
    kind: "Deterministic rules",
    purpose: "Orders the review queue and sets each case's review deadline.",
    inputs: "Change type, band movement, records affected, review confidence and regional flags.",
    outputs: "A level and a score, always shown with the factors behind them.",
    oversight: "A triage signal. Clinicians decide the order of work and every outcome.",
    limitations: "Not a validated clinical risk score. Its weights and the deadlines per level are design choices awaiting clinical agreement.",
    evaluation: "Ordering is unit-tested. Weights and deadlines not yet validated with clinicians.",
  },
  {
    name: "Regional signal",
    kind: "Deterministic rules",
    purpose: "Flags variants where regional evidence deserves a clinician's attention.",
    inputs: "gnomAD v4 Middle Eastern and global allele counts, and CTGA catalogue readings.",
    outputs: "A signal and its reason. Never a classification.",
    oversight: "Raises a case for review and never ranks one source above another.",
    limitations: "Its thresholds (twice the global frequency, at least three alleles) are placeholders, and the Middle Eastern group is about 3,000 people.",
    evaluation: "Unit-tested. Thresholds not yet validated.",
  },
  {
    name: "Evidence summary drafting",
    kind: "Language model, optional",
    purpose: "Drafts a short, cited summary of a case's evidence for the reviewing clinician.",
    inputs: "The case's fact sheet only; no patient data.",
    outputs: "Three or four sentences, each ending with the source it came from.",
    oversight: "Labelled as a draft, editable, and checked automatically for source tags, length and advice before it is shown; a fixed template stands in on any failure.",
    limitations: "Can only restate its fact sheet, and may phrase things less precisely than the template.",
    evaluation: "The checks are unit-tested. Drafts not yet evaluated by clinicians.",
  },
  {
    name: "Patient letter wording",
    kind: "Language model, optional",
    purpose: "Rewords the English and Arabic explanation letter for readability.",
    inputs: "The template letter with every identifying fact replaced by a placeholder.",
    outputs: "Both letters, with the record's facts restored after checking.",
    oversight: "Offered only after a letter follow-up is approved by a second clinician, and released only by the care team after review.",
    limitations: "Arabic wording not yet reviewed by native-speaking clinicians.",
    evaluation: "The checks are unit-tested. Letters not yet evaluated with clinicians or patients.",
  },
];

export const HUMAN_OVERSIGHT: string[] = [
  "Nothing in VariantPulse writes to a patient record or changes a classification.",
  "Every case has a named owner and a review deadline, and passes to the service lead if the deadline goes by undecided.",
  "Every decision carries the clinician's rationale, and amendments are added, never written over.",
  "Anything that could reach a patient is a follow-up that someone other than its proposer must approve.",
  "Silent pilot mode holds every patient-facing action and every export, so a partner can evaluate on real history without changing care.",
  "Language-model output is labelled as a draft, checked automatically, editable, and replaced by a fixed template on any failure.",
];

export const KNOWN_LIMITATIONS: string[] = [
  "Every patient record, clinician and department is synthetic. VariantPulse is not connected to any hospital system.",
  "Live ClinVar reads cover classification, review status, dates and submissions; allele frequencies and citations come from the verified snapshot.",
  "Archived ClinVar readings exist for four checkpoints (January 2023, 2024 and 2025, and September 2026), so a change is dated to a checkpoint, not a day.",
  "Workflow state is held in one browser session. There is no shared server-side case store, and no concurrent editing.",
  "Identities are a demonstration switch. There is no authentication or MFA.",
  "Review priority, review deadlines and regional thresholds are design choices that have not been validated clinically.",
  "Permission to reuse the regional catalogue (CTGA) clinically or commercially has not been confirmed.",
  "VariantPulse is decision support. It is not a certified medical device and has not been through regulatory assessment.",
];

export interface HostingOption {
  name: string;
  summary: string;
  suits: string;
}

export const HOSTING_OPTIONS: HostingOption[] = [
  {
    name: "Facility-controlled",
    summary: "Runs inside the facility's own environment. Reads ClinVar through the facility's controlled egress, or offline from a verified snapshot.",
    suits: "A first pilot, where data must not leave the facility.",
  },
  {
    name: "Approved UAE hosting",
    summary: "A separate tenant per facility in a UAE hosting environment the partner approves, with keys the facility manages.",
    suits: "Several sites, once residency, access and audit terms are agreed.",
  },
  {
    name: "This demonstration",
    summary: "Cloudflare Workers, serving synthetic records only, with no server-side data.",
    suits: "Showing the workflow. Not for real patient data.",
  },
];
