"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { PatientRecord } from "@/data/workspace";
import type { VariantAssessment } from "@/lib/analysis";
import { cn, formatDate } from "@/lib/utils";
import { Badge, ClassificationBadge, EmptyState } from "@/components/ui";
import { RelativeTime } from "@/components/relative-time";
import { reviewStateFor } from "@/components/clinical/patient-impact-graph";
import type { CaseStatus } from "@/state/workspace";

const STATE_TONE = {
  "Not reviewed": "warning",
  "In review": "neutral",
  Reviewed: "positive",
  Closed: "muted",
} as const;

export function PatientImpactTable({
  rows,
  byKey,
  showVariant = true,
  caseStatus,
  className,
}: {
  rows: PatientRecord[];
  /** Assessment for each variant key, used for the interpretation columns. */
  byKey: Map<string, VariantAssessment>;
  showVariant?: boolean;
  /** The review case these rows belong to, when the table shows a single case. */
  caseStatus?: CaseStatus;
  className?: string;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No records match"
        description="Try clearing the filters, or search for a record identifier directly."
        className={className}
      />
    );
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[900px] border-collapse text-left">
        <thead>
          <tr className="border-b border-line bg-surface-2">
            {[
              "Record",
              "Age band",
              "Test date",
              ...(showVariant ? ["Variant"] : []),
              "On record",
              "Current",
              "Department",
              "Clinical owner",
              "Last contact",
              "Review state",
              "",
            ].map((heading) => (
              <th
                key={heading}
                scope="col"
                className="whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-faint"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((patient) => {
            const assessment = byKey.get(patient.variantKey);
            return (
              <tr
                key={patient.id}
                className="border-b border-line transition-colors last:border-0 hover:bg-surface-2"
              >
                <th scope="row" className="whitespace-nowrap px-4 py-3">
                  <Link
                    href={`/patients/${patient.id}`}
                    className="font-mono text-[12.5px] font-medium text-ink hover:text-accent"
                  >
                    {patient.id}
                  </Link>
                </th>
                <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-ink-2 vp-num">
                  {patient.ageBand}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-muted vp-num">
                  {formatDate(patient.testedOn)}
                </td>
                {showVariant ? (
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link
                      href={`/variants/${encodeURIComponent(patient.variantKey)}`}
                      className="text-[12.5px] text-ink-2 hover:text-accent"
                    >
                      <span className="font-semibold">{patient.variantKey.split(":")[0]}</span>{" "}
                      <span className="font-mono text-[11.5px] text-muted">
                        {patient.variantKey.split(":")[1]}
                      </span>
                    </Link>
                  </td>
                ) : null}
                <td className="px-4 py-3">
                  {assessment ? <ClassificationBadge code={assessment.recordedCode} /> : "-"}
                </td>
                <td className="px-4 py-3">
                  {assessment ? <ClassificationBadge code={assessment.currentCode} /> : "-"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-ink-2">
                  {patient.orderingDepartment}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-ink-2">
                  {patient.clinicalOwner}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-muted vp-num">
                  <RelativeTime value={patient.lastContact} />
                </td>
                <td className="px-4 py-3">
                  <Badge tone={STATE_TONE[reviewStateFor(patient, caseStatus)]}>
                    {reviewStateFor(patient, caseStatus)}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/patients/${patient.id}`}
                    aria-label={`Open record ${patient.id}`}
                    className="grid h-7 w-7 place-items-center rounded-lg text-faint transition-colors hover:bg-surface-3 hover:text-accent"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
