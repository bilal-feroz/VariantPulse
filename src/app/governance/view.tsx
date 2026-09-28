"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Download, Server, ShieldCheck, Sparkles, Trash2 } from "lucide-react";

import { PageHeader, PageShell } from "@/components/page-header";
import { Badge, Button, Card, Eyebrow, SectionHeading } from "@/components/ui";
import {
  AI_INVENTORY,
  CONTROLS,
  CONTROL_STATUS,
  DATA_FLOWS,
  HOSTING_OPTIONS,
  HUMAN_OVERSIGHT,
  KNOWN_LIMITATIONS,
} from "@/data/governance";
import { deploymentPackage, type DeploymentFacts } from "@/lib/governance";
import { ROLES, denial } from "@/lib/roles";
import { RoleNote } from "@/components/workflow/role-note";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/state/workspace";

export function GovernanceView({ facts }: { facts: DeploymentFacts }) {
  const downloadPackage = () => {
    const body = deploymentPackage(facts, new Date().toISOString());
    const url = URL.createObjectURL(new Blob([body], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "variantpulse-governance-package.md";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Trust and governance"
        title="What is controlled, and how"
        description="A deployment and governance package for a partner's security, privacy and clinical-governance review. It describes this demonstration and plans a pilot. It does not establish compliance with any standard."
        actions={
          <Button variant="primary" onClick={downloadPackage}>
            <Download className="h-4 w-4" />
            Download package
          </Button>
        }
      />

      <ThisDeployment facts={facts} />

      <SectionHeading className="mt-8" title="Hosting options" description="Where a pilot could run. Agreed with the partner before any real record is loaded." />
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {HOSTING_OPTIONS.map((option, index) => (
          <Card key={option.name} className={cn("p-5", index === HOSTING_OPTIONS.length - 1 && "bg-surface-2")}>
            <p className="text-[14px] font-semibold text-ink">{option.name}</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{option.summary}</p>
            <p className="mt-3 border-t border-line pt-2.5 text-[12px] text-muted">
              <span className="font-medium text-ink-2">Suits: </span>
              {option.suits}
            </p>
          </Card>
        ))}
      </div>

      <Controls />
      <DataFlows aiConfigured={facts.aiConfigured} />
      <Inventory facts={facts} />

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeading title="Human oversight" icon={<ShieldCheck className="h-4 w-4" />} />
          <ul className="mt-4 space-y-2.5">
            {HUMAN_OVERSIGHT.map((line) => (
              <Point key={line}>{line}</Point>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <SectionHeading title="Known limitations" />
          <ul className="mt-4 space-y-2.5">
            {KNOWN_LIMITATIONS.map((line) => (
              <Point key={line} muted>
                {line}
              </Point>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SessionData />
        <Card className="p-5">
          <SectionHeading title="Responsible-AI alignment" />
          <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">
            Aligning VariantPulse with the Department of Health – Abu Dhabi&rsquo;s requirements for responsible
            AI in healthcare is a separate workstream, done with the partner. Its inputs are on this page and
            the next: the AI inventory, the silent pilot&rsquo;s evaluation results, the known limitations and the
            human-oversight controls.
          </p>
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
            Nothing here establishes compliance. The controls marked &ldquo;not in this demo&rdquo; are plans for a
            pilot, not features.
          </p>
          <Link href="/pilot" className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-accent hover:underline">
            Silent pilot evaluation
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Card>
      </div>
    </PageShell>
  );
}

function ThisDeployment({ facts }: { facts: DeploymentFacts }) {
  const { analysis } = useWorkspace();
  const evidence = facts.offline
    ? "Live reads switched off; verified snapshot"
    : facts.evidenceMode === "live"
      ? analysis.mode === "live"
        ? "Live ClinVar reads"
        : "Live ClinVar, currently on the snapshot fallback"
      : "Demo mode: verified ClinVar snapshot";

  const items = [
    {
      icon: Server,
      label: "Hosting",
      value: facts.hosting === "cloudflare" ? "Cloudflare Workers" : "Local development server",
      note: "Synthetic records only; no server-side patient or case data.",
    },
    { icon: ShieldCheck, label: "Evidence", value: evidence, note: "Every surface labels the mode it is in." },
    {
      icon: Sparkles,
      label: "AI drafting",
      value: facts.aiConfigured ? `Enabled · ${facts.aiModel}` : "Not configured",
      note: facts.aiConfigured
        ? "Outputs are checked and labelled as drafts; templates stand in on any failure."
        : "Every summary and letter comes from fixed templates. No AI service is called.",
    },
  ];

  return (
    <Card className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      {items.map((item) => (
        <div key={item.label} className="flex gap-3 p-5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-3 text-muted">
            <item.icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <Eyebrow>{item.label}</Eyebrow>
            <p className="mt-1 text-[13.5px] font-semibold text-ink">{item.value}</p>
            <p className="mt-0.5 text-[12px] leading-snug text-muted">{item.note}</p>
          </div>
        </div>
      ))}
    </Card>
  );
}

function Controls() {
  return (
    <Card className="mt-8 overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <SectionHeading
          title="Controls"
          description="Each control as this demonstration has it today, and what a pilot deployment needs."
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-surface-2">
              {["Control", "Here", "In this demonstration", "For a pilot"].map((heading) => (
                <th key={heading} scope="col" className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-faint">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CONTROLS.map((control) => (
              <tr key={control.area} className="border-b border-line align-top last:border-0">
                <th scope="row" className="whitespace-nowrap px-5 py-3 text-[13px] font-medium text-ink">
                  {control.area}
                </th>
                <td className="px-5 py-3">
                  <Badge tone={CONTROL_STATUS[control.status].tone} dot>
                    {CONTROL_STATUS[control.status].label}
                  </Badge>
                </td>
                <td className="px-5 py-3 text-[12.5px] leading-relaxed text-ink-2">{control.demo}</td>
                <td className="px-5 py-3 text-[12.5px] leading-relaxed text-muted">{control.pilot}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-line bg-surface-2 px-5 py-4">
        <Eyebrow>Roles</Eyebrow>
        <dl className="mt-2.5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Object.values(ROLES).map((role) => (
            <div key={role.role}>
              <dt className="text-[13px] font-medium text-ink">{role.label}</dt>
              <dd className="mt-0.5 text-[12px] leading-snug text-muted">{role.description}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Card>
  );
}

function DataFlows({ aiConfigured }: { aiConfigured: boolean }) {
  return (
    <Card className="mt-5 overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <SectionHeading
          title="External data flows"
          description="Everywhere data goes, AI services included: when, what is sent, what never is, and what switches it off."
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-surface-2">
              {["Destination", "When", "Sends", "Never sends", "Control"].map((heading) => (
                <th key={heading} scope="col" className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-faint">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DATA_FLOWS.map((flow) => (
              <tr key={flow.destination} className="border-b border-line align-top last:border-0">
                <th scope="row" className="px-5 py-3 text-[13px] font-medium text-ink">
                  {flow.destination}
                  {flow.ai ? (
                    <Badge tone={aiConfigured ? "warning" : "muted"} className="mt-1.5 flex w-fit">
                      {aiConfigured ? "Active here" : "Off here: no key"}
                    </Badge>
                  ) : null}
                </th>
                <td className="px-5 py-3 text-[12.5px] leading-relaxed text-ink-2">{flow.when}</td>
                <td className="px-5 py-3 text-[12.5px] leading-relaxed text-ink-2">{flow.sends}</td>
                <td className="px-5 py-3 text-[12.5px] leading-relaxed text-ok">{flow.never}</td>
                <td className="px-5 py-3 text-[12.5px] leading-relaxed text-muted">{flow.control}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Inventory({ facts }: { facts: DeploymentFacts }) {
  return (
    <>
      <SectionHeading
        className="mt-8"
        title="AI and automated components"
        description="Every component that decides, orders or writes anything, with its inputs, oversight, limits and evaluation to date."
      />
      <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {AI_INVENTORY.map((component) => {
          const model = component.kind === "Language model, optional";
          return (
            <Card key={component.name} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[14px] font-semibold text-ink">{component.name}</p>
                <Badge tone={model ? "warning" : "neutral"}>{component.kind}</Badge>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{component.purpose}</p>
              {model ? (
                <p className="mt-1.5 text-[12px] font-medium text-muted">
                  {facts.aiConfigured ? `On this deployment: ${facts.aiModel}` : "On this deployment: off, fixed templates used"}
                </p>
              ) : null}
              <dl className="mt-3 space-y-2 border-t border-line pt-3">
                {[
                  ["Inputs", component.inputs],
                  ["Outputs", component.outputs],
                  ["Human oversight", component.oversight],
                  ["Limitations", component.limitations],
                  ["Evaluation to date", component.evaluation],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[10.5px] font-medium uppercase tracking-[0.07em] text-faint">{label}</dt>
                    <dd className="mt-0.5 text-[12.5px] leading-relaxed text-ink-2">{value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          );
        })}
      </div>
    </>
  );
}

function SessionData() {
  const { cases, activity, adjudications, lastImport, clearSession, hydrated, can, persona } = useWorkspace();
  const deleteDenied = denial(persona, "session:delete");
  const [confirming, setConfirming] = React.useState(false);
  const [cleared, setCleared] = React.useState(false);
  const worked = Object.values(cases).filter((c) => c.events.length > 0).length;

  return (
    <Card className="p-5">
      <SectionHeading
        title="Retention and deletion"
        description="What this session holds. It lives in this browser tab only and is cleared when the tab closes."
      />
      <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3">
        {[
          ["Cases worked", worked],
          ["Audit trail entries", activity.length],
          ["Adjudications", Object.keys(adjudications).length],
          ["Import reviews", lastImport ? 1 : 0],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-[11px] font-medium uppercase tracking-[0.07em] text-faint">{label}</dt>
            <dd className="mt-0.5 text-[16px] font-semibold text-ink vp-num">{hydrated ? value : "–"}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {confirming ? (
          <>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                clearSession();
                setConfirming(false);
                setCleared(true);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete everything
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={() => setConfirming(true)} disabled={!hydrated || !can("session:delete")}>
            <Trash2 className="h-3.5 w-3.5" />
            Delete session data
          </Button>
        )}
        <span className="text-[12px] text-muted" role="status">
          {cleared ? "Deleted. The trail records that it happened." : confirming ? "This cannot be undone." : null}
        </span>
      </div>
      <RoleNote className="mt-3" reason={deleteDenied} switchTo="mansour" />
    </Card>
  );
}

function Point({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <li className="flex gap-2.5 text-[13px] leading-relaxed">
      <span className={cn("mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full", muted ? "bg-slate" : "bg-accent")} />
      <span className="text-ink-2">{children}</span>
    </li>
  );
}
