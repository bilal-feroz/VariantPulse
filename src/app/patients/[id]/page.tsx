"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { ArrowRight, ExternalLink, FlaskConical, Stethoscope, UserRound } from "lucide-react";

import { ThenNow } from "@/components/domain";
import { PageHeader, PageShell } from "@/components/page-header";
import {
  EvidenceSummaryPanel,
  ReasoningPanel,
  RegionalComparison,
  ScienceTimeline,
} from "@/components/panels";
import {
  Badge,
  Button,
  Card,
  ChangeTypeBadge,
  ClassificationBadge,
  ConfidenceMeter,
  DecisionNotice,
  Field,
  PriorityBadge,
  SectionHeading,
  VariantLabel,
} from "@/components/ui";
import { PATIENT_BY_ID } from "@/data/workspace";
import { CHANGE_TYPES } from "@/lib/classification";
import { formatDate, formatMonth } from "@/lib/utils";
import { useWorkspace } from "@/state/workspace";

export default function PatientPage() {
  const params = useParams<{ id: string }>();
  const { analysis } = useWorkspace();

  const patient = PATIENT_BY_ID.get(decodeURIComponent(params.id));
  if (!patient) notFound();

  const assessment = analysis.assessments.find((a) => a.variant.key === patient.variantKey);
  if (!assessment) notFound();

  const { variant, evidence, changeType } = assessment;
  const changed = changeType !== "NO_MATERIAL_CHANGE";

  return (
    <PageShell>
      <PageHeader
        back={{ href: "/patients", label: "All records" }}
        eyebrow="Patient record"
        title={patient.id}
        description={`${patient.ageBand} · ${patient.sex} · ${patient.indication}`}
        actions={
          <>
            {changed && assessment.caseId ? (
              <Link href={`/review/${assessment.caseId}`}>
                <Button variant="primary">
                  Open review case
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : null}
            <Link href={`/variants/${encodeURIComponent(variant.key)}`}>
              <Button>View variant</Button>
            </Link>
          </>
        }
      />

      {changed ? (
        <Card className="mb-5 overflow-hidden border-l-0">
          <div className="flex flex-wrap items-center gap-2.5 border-b border-line bg-surface-2 px-5 py-3">
            <PriorityBadge level={assessment.priority.level} />
            <ChangeTypeBadge type={changeType} />
            <p className="text-[12.5px] text-muted">{CHANGE_TYPES[changeType].description}</p>
          </div>
          <div className="p-5">
            <ThenNow assessment={assessment} size="lg" />
          </div>
        </Card>
      ) : (
        <Card className="mb-5 flex flex-wrap items-center gap-3 px-5 py-4">
          <Badge tone="positive" dot>
            No material change
          </Badge>
          <p className="text-[13px] text-muted">
            Current evidence agrees with the interpretation issued for this record.
          </p>
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <SectionHeading title="Patient summary" icon={<UserRound className="h-4 w-4" />} />
          <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4">
            <Field label="Record" value={patient.id} mono />
            <Field label="Age band" value={patient.ageBand} />
            <Field label="Sex" value={patient.sex} />
            <Field label="Test date" value={formatDate(patient.testedOn)} />
            <Field label="Reporting laboratory" value={patient.reportingLab} />
            <Field label="Ordering department" value={patient.orderingDepartment} />
            <Field label="Clinical owner" value={patient.clinicalOwner} />
            <Field label="Last contact" value={formatDate(patient.lastContact)} />
            <Field label="Indication" value={patient.indication} className="col-span-2" />
          </dl>
          <p className="mt-4 border-t border-line pt-3 text-[11.5px] text-faint">
            Synthetic record. No identifiers in this workspace correspond to a real person.
          </p>
        </Card>

        <Card className="p-5">
          <SectionHeading
            title="Historical finding"
            icon={<FlaskConical className="h-4 w-4" />}
            action={
              <a
                href={`https://www.ncbi.nlm.nih.gov/clinvar/variation/${evidence.clinvarId}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline"
              >
                ClinVar
                <ExternalLink className="h-3 w-3" />
              </a>
            }
          />
          <div className="mt-4">
            <VariantLabel
              gene={variant.gene}
              hgvs={variant.hgvsCoding}
              protein={variant.proteinChange}
              size="md"
            />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4">
            <Field label="Panel" value={variant.panel} />
            <Field label="Condition" value={variant.condition} />
            <Field label="ClinVar" value={evidence.accession ?? `VCV${evidence.clinvarId}`} mono />
            <Field label="dbSNP" value={evidence.rsid ?? "Not linked"} mono />
            <Field
              label="Classification on record"
              value={<ClassificationBadge code={assessment.recordedCode} full />}
            />
            <Field
              label="Source of that classification"
              value={
                variant.historicalSource.kind === "clinvar-release"
                  ? `ClinVar, ${variant.historicalSource.label} release`
                  : `Hospital report, ${formatMonth(variant.recordedOn)}`
              }
            />
            <Field
              label="Review status then"
              value={variant.historicalReviewStatus ?? "Not in ClinVar in January 2023"}
            />
            <Field label="Reported on (synthetic)" value={formatDate(variant.recordedOn)} />
          </dl>
          <p className="mt-4 border-t border-line pt-3 text-[12.5px] leading-relaxed text-muted">
            <span className="font-medium text-ink-2">Original report note (synthetic): </span>
            {variant.recordedEvidenceNote}
          </p>
        </Card>
      </div>

      <Card className="mt-5 p-5">
        <SectionHeading
          title="Current interpretation"
          icon={<Stethoscope className="h-4 w-4" />}
          description={
            analysis.mode === "live"
              ? "Read live from NCBI ClinVar at the last evidence sync."
              : "From the cached, verified ClinVar snapshot; live ClinVar was not reachable."
          }
        />
        <dl className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label="Classification"
            value={<ClassificationBadge code={assessment.currentCode} full />}
          />
          <Field label="Consensus status" value={assessment.confidence.label} />
          <Field
            label="Evidence confidence"
            value={
              <ConfidenceMeter
                stars={assessment.confidence.stars}
                strength={assessment.confidence.strength}
              />
            }
          />
          <Field label="Last evaluated" value={formatDate(evidence.lastEvaluated)} />
          <Field label="Submissions" value={String(evidence.submissionCount)} />
          <Field
            label="Molecular consequence"
            value={evidence.molecularConsequence ?? "Not stated"}
          />
          <Field label="Variant type" value={evidence.variantType ?? "Not stated"} />
          <Field
            label="Location"
            value={
              evidence.location
                ? `chr${evidence.location.chr}:${evidence.location.start} (${evidence.location.assembly})`
                : "Not stated"
            }
            mono
          />
        </dl>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <EvidenceSummaryPanel assessment={assessment} />
          <ReasoningPanel assessment={assessment} />
          {assessment.regional ? <RegionalComparison assessment={assessment} /> : null}
        </div>
        <ScienceTimeline assessment={assessment} />
      </div>

      <Card className="mt-5 flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <DecisionNotice className="max-w-xl" />
        {assessment.caseId ? (
          <Link href={`/review/${assessment.caseId}`}>
            <Button variant="primary">
              Open clinical review
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        ) : null}
      </Card>
    </PageShell>
  );
}
