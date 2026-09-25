"use client";

import * as React from "react";
import { Database, ExternalLink } from "lucide-react";

import { PageHeader, PageShell } from "@/components/page-header";
import {
  EvidenceComparison,
  EvidenceSummaryPanel,
  ReasoningPanel,
  RegionalComparison,
} from "@/components/panels";
import { SyncButton } from "@/components/sync";
import { Badge, Card, ClassificationBadge, SectionHeading, StatusDot } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";
import { useWorkspace } from "@/state/workspace";
import { RelativeTime } from "@/components/relative-time";

export default function EvidencePage() {
  const { analysis, sync } = useWorkspace();
  const [selected, setSelected] = React.useState(
    () => analysis.reviewableKeys[0] ?? analysis.assessments[0]?.variant.key,
  );

  const assessment =
    analysis.assessments.find((a) => a.variant.key === selected) ?? analysis.assessments[0];

  const live = analysis.mode === "live";
  const lastChecked = sync.phase === "done" ? sync.at : analysis.checkedAt;

  if (!assessment) return null;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Evidence explorer"
        title="Evidence"
        description="Every source that contributes to an interpretation, shown separately. VariantPulse does not collapse them into a single verdict."
        actions={<SyncButton />}
      />

      <Card className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3.5">
        <span className="inline-flex items-center gap-2">
          <StatusDot tone={live ? "positive" : "warning"} pulse={live} />
          <span className="text-[13px] font-medium text-ink">
            {live ? "Reading live from ClinVar" : "Serving cached evidence"}
          </span>
        </span>
        <span className="text-[12.5px] text-muted">
          Checked <RelativeTime value={lastChecked} />
        </span>
        <span className="text-[12.5px] text-muted">
          {analysis.assessments.length} variants on the monitored panel
        </span>
        {!live && analysis.reason ? (
          <Badge tone="warning">{analysis.reason}</Badge>
        ) : null}
        <a
          href="https://www.ncbi.nlm.nih.gov/clinvar/"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-medium text-accent hover:underline"
        >
          ClinVar
          <ExternalLink className="h-3 w-3" />
        </a>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="h-fit overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <SectionHeading title="Select a variant" icon={<Database className="h-4 w-4" />} />
          </div>
          <ul className="vp-scroll max-h-[640px] overflow-y-auto">
            {analysis.assessments.map((item) => {
              const active = item.variant.key === assessment.variant.key;
              return (
                <li key={item.variant.key}>
                  <button
                    type="button"
                    onClick={() => setSelected(item.variant.key)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex w-full items-start gap-2.5 border-b border-line px-4 py-3 text-left transition-colors last:border-0",
                      active ? "bg-accent-soft" : "hover:bg-surface-2",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-ink">
                        {item.variant.gene}
                      </span>
                      <span className="block truncate font-mono text-[11.5px] text-muted">
                        {item.variant.hgvsCoding}
                      </span>
                      <span className="mt-1.5 block">
                        <ClassificationBadge code={item.currentCode} />
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="min-w-0 space-y-5">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-[19px] font-semibold tracking-tight text-ink">
                  {assessment.variant.gene}{" "}
                  <span className="font-mono text-[15px] font-normal text-muted">
                    {assessment.variant.hgvsCoding}
                  </span>
                </h2>
                <p className="mt-1 text-[13px] text-muted">
                  {assessment.variant.condition} · {assessment.variant.panel}
                </p>
              </div>
              <div className="text-right">
                <ClassificationBadge code={assessment.currentCode} full />
                <p className="mt-1.5 text-[11.5px] text-faint">
                  Last evaluated {formatDate(assessment.evidence.lastEvaluated)}
                </p>
              </div>
            </div>
          </Card>

          <EvidenceSummaryPanel assessment={assessment} />
          <EvidenceComparison assessment={assessment} />
          {assessment.regional ? <RegionalComparison assessment={assessment} /> : null}
          <ReasoningPanel assessment={assessment} />
        </div>
      </div>
    </PageShell>
  );
}
