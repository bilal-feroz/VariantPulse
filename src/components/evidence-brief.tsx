"use client";

/**
 * The clinician-facing evidence brief.
 *
 * Everything in it is drawn from the assessment and the case state, so the
 * printed page and the screen cannot drift apart. It is explicitly labelled as
 * decision support and carries its sources so it can be checked.
 */

import * as React from "react";
import { Download, FileText, Printer, X } from "lucide-react";

import type { VariantAssessment } from "@/lib/analysis";
import { meta, regionalStatement } from "@/lib/classification";
import { composeRecommendation } from "@/lib/narrative";
import { REGIONAL_SOURCE, type AlleleFrequency } from "@/data/regional";
import { CURRENT_USER, type MonitoredVariant } from "@/data/workspace";
import { formatDate, formatNumber } from "@/lib/utils";

/** Where the classification on record came from, in one line. */
function historicalSourceLine(variant: MonitoredVariant): string {
  const source = variant.historicalSource;
  if (source.kind === "modelled-report") {
    return `hospital report, ${formatDate(variant.recordedOn)}; not in ClinVar in January 2023`;
  }
  const verbatim =
    variant.historicalClinvarText && variant.historicalClinvarText !== meta(variant.historicalClassification).label
      ? `; recorded as "${variant.historicalClinvarText}"`
      : "";
  return `ClinVar ${source.label} release, ${variant.historicalReviewStatus}${verbatim}`;
}

function alleles(value: AlleleFrequency | null): string {
  if (!value || value.frequency === null) return "not in gnomAD v4";
  return `${formatNumber(value.alleleCount)} of ${formatNumber(value.alleleNumber)} alleles`;
}

function frequencyLine(assessment: VariantAssessment): string {
  const regional = assessment.regional;
  if (!regional?.inGnomad) return "absent from gnomAD v4, including its Middle Eastern group";
  return `Middle Eastern ${alleles(regional.middleEastern)}; all samples ${alleles(regional.global)}`;
}
import { Button } from "@/components/ui";
import type { CaseState } from "@/state/workspace";

function briefText(assessment: VariantAssessment, state: CaseState, generatedAt: string): string {
  const { variant, evidence, regional } = assessment;
  const catalogue = regional?.catalogue ?? null;
  const lines = [
    "VARIANTPULSE — CLINICAL EVIDENCE BRIEF",
    "",
    `Case:                ${assessment.caseId ?? "—"}`,
    `Generated:           ${generatedAt}`,
    `Prepared for:        ${CURRENT_USER.name}, ${CURRENT_USER.role}`,
    "",
    "VARIANT",
    `  Gene:              ${variant.gene}`,
    `  HGVS (coding):     ${variant.hgvsCoding}`,
    `  Protein:           ${variant.proteinChange ?? "—"}`,
    `  Condition:         ${variant.condition}`,
    `  ClinVar:           ${evidence.accession ?? evidence.clinvarId}`,
    `  dbSNP:             ${evidence.rsid ?? "—"}`,
    "",
    "CLASSIFICATION",
    `  On record:         ${meta(assessment.recordedCode).label} (${historicalSourceLine(variant)})`,
    `  Reported on:       ${formatDate(variant.recordedOn)} (synthetic hospital report)`,
    `  Current:           ${meta(assessment.currentCode).label} (last evaluated ${formatDate(evidence.lastEvaluated)}; ${assessment.evidenceMode === "live" ? "read live" : "cached verified snapshot"})`,
    `  Change type:       ${assessment.changeType}`,
    `  Review priority:   ${assessment.priority.level}`,
    "",
    "SOURCES REVIEWED",
    `  ClinVar, current:  ${evidence.classification} — ${evidence.reviewStatus} (${evidence.submissionCount} submissions)`,
    `  ClinVar, history:  ${historicalSourceLine(variant)}`,
    `  gnomAD v4:         ${frequencyLine(assessment)}`,
    catalogue
      ? `  CTGA:              ${catalogue.significance} (${catalogue.countries.join(", ")}; quoted, not a VariantPulse classification)`
      : "  CTGA:              no record held",
    `  Literature:        ${evidence.citations.length} indexed publications`,
    `  This hospital:     ${meta(assessment.recordedCode).label} (synthetic record)`,
    "",
    "EVIDENCE SUMMARY",
    ...wrap(assessment.summary, 78).map((l) => `  ${l}`),
    "",
    "REGIONAL EVIDENCE",
    ...wrap(
      `${regionalStatement(assessment.regionalSignal)}${regional?.context ? ` ${regional.context.note}` : ""}`,
      78,
    ).map((l) => `  ${l}`),
    "",
    "AFFECTED RECORDS",
    ...assessment.impactedPatients.map(
      (p) => `  ${p.id}  ${p.ageBand}  ${formatDate(p.testedOn)}  ${p.orderingDepartment}  ${p.clinicalOwner}`,
    ),
    "",
    "RECOMMENDATION",
    ...wrap(composeRecommendation(assessment.changeType, assessment.impactedRecordCount), 78).map(
      (l) => `  ${l}`,
    ),
    "",
    "CASE STATE",
    `  Status:            ${state.status}`,
    `  Assigned:          ${state.assignee ?? "Unassigned"}`,
    `  Notes:             ${state.notes.length}`,
    ...state.notes.map((n) => `    - ${n.author}: ${n.body}`),
    "",
    "DISCLAIMER",
    "  Decision support only. Final interpretation remains with the qualified",
    "  clinical team. Synthetic patient records; real public genomic evidence",
    "  (NCBI ClinVar, gnomAD v4, CTGA).",
    "",
    "VariantPulse · Built by Team Kanban",
  ];
  return lines.join("\n");
}

function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line + word).length + 1 > width) {
      lines.push(line.trim());
      line = "";
    }
    line += `${word} `;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

export function EvidenceBriefButton({
  assessment,
  state,
}: {
  assessment: VariantAssessment;
  state: CaseState;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button variant="secondary" className="w-full justify-start" onClick={() => setOpen(true)}>
        <FileText className="h-4 w-4" />
        Generate evidence brief
      </Button>
      {open ? (
        <EvidenceBrief assessment={assessment} state={state} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function EvidenceBrief({
  assessment,
  state,
  onClose,
}: {
  assessment: VariantAssessment;
  state: CaseState;
  onClose: () => void;
}) {
  const { variant, evidence, regional } = assessment;
  const catalogue = regional?.catalogue ?? null;
  const [generatedAt, setGeneratedAt] = React.useState("");

  // Rendered after mount so the printed timestamp is the reader's local time
  // and the server and client markup agree.
  React.useEffect(() => {
    setGeneratedAt(new Date().toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" }));
  }, []);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const download = () => {
    const blob = new Blob([briefText(assessment, state, generatedAt)], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${assessment.caseId ?? variant.key.replace(/[:>]/g, "-")}-evidence-brief.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto vp-fade" role="dialog" aria-modal="true" aria-label="Evidence brief">
      <button
        type="button"
        aria-label="Close brief"
        onClick={onClose}
        className="fixed inset-0 cursor-default bg-ink/30 backdrop-blur-[2px] vp-no-print"
      />

      <div className="relative mx-auto my-8 w-[min(820px,calc(100vw-2rem))]">
        <div className="mb-3 flex items-center justify-end gap-2 vp-no-print">
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>
          <Button size="sm" onClick={download}>
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <article className="rounded-2xl border border-line-2 bg-white p-8 shadow-[0_28px_80px_-30px_rgba(18,19,50,0.5)] sm:p-10">
          <header className="flex items-start justify-between gap-6 border-b border-line pb-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
                Clinical evidence brief
              </p>
              <h1 className="mt-2 text-[24px] font-semibold tracking-tight text-ink">
                {variant.gene}{" "}
                <span className="font-mono text-[18px] font-normal text-muted">
                  {variant.hgvsCoding}
                </span>
              </h1>
              <p className="mt-1 text-[13px] text-muted">{variant.condition}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[15px] font-semibold tracking-tight text-ink">VariantPulse</p>
              <p className="mt-0.5 text-[11px] text-faint">Genomic Change Intelligence</p>
              <p className="mt-2 font-mono text-[12px] text-ink-2">{assessment.caseId}</p>
              <p className="mt-0.5 text-[11px] text-faint">{generatedAt}</p>
            </div>
          </header>

          <Section title="Classification">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              <Item label="On record" value={meta(assessment.recordedCode).label} />
              <Item
                label="Record source"
                value={
                  variant.historicalSource.kind === "clinvar-release"
                    ? `ClinVar, ${variant.historicalSource.shortLabel}`
                    : "Hospital report"
                }
              />
              <Item label="Current" value={meta(assessment.currentCode).label} strong />
              <Item label="Last evaluated" value={formatDate(evidence.lastEvaluated)} />
              <Item label="Change" value={assessment.changeType.replace(/_/g, " ").toLowerCase()} />
              <Item label="Review priority" value={assessment.priority.level} />
              <Item label="Review status" value={assessment.confidence.label} />
              <Item label="Submissions" value={String(evidence.submissionCount)} />
            </dl>
          </Section>

          <Section title="Sources reviewed">
            <ul className="space-y-1.5 text-[13px] text-ink-2">
              <li>
                <strong className="font-medium text-ink">ClinVar, current</strong> —{" "}
                {evidence.classification}, {evidence.reviewStatus} (
                {evidence.accession ?? evidence.clinvarId};{" "}
                {assessment.evidenceMode === "live" ? "read live" : "cached verified snapshot"})
              </li>
              <li>
                <strong className="font-medium text-ink">Classification on record</strong> —{" "}
                {meta(assessment.recordedCode).label}, {historicalSourceLine(variant)}
              </li>
              <li>
                <strong className="font-medium text-ink">gnomAD v4</strong> — {frequencyLine(assessment)}
              </li>
              <li>
                <strong className="font-medium text-ink">{REGIONAL_SOURCE.catalogueShortName}</strong> —{" "}
                {catalogue
                  ? `${catalogue.significance} (${catalogue.countries.join(", ")}), quoted from the ${REGIONAL_SOURCE.catalogueName}`
                  : "no record held"}
              </li>
              <li>
                <strong className="font-medium text-ink">Literature</strong> —{" "}
                {evidence.citations.length} indexed publications linked to this record
              </li>
              <li>
                <strong className="font-medium text-ink">This hospital</strong> —{" "}
                {meta(assessment.recordedCode).label}, reported {formatDate(variant.recordedOn)} (synthetic
                record)
              </li>
            </ul>
          </Section>

          <Section title="Evidence summary">
            <p className="text-[13.5px] leading-relaxed text-ink-2">{assessment.summary}</p>
          </Section>

          {regional ? (
            <Section title="Regional evidence">
              <p className="text-[13.5px] leading-relaxed text-ink-2">
                {regionalStatement(assessment.regionalSignal)}
                {regional.context ? ` ${regional.context.note}` : ""}
              </p>
            </Section>
          ) : null}

          <Section title={`Affected records (${assessment.impactedPatients.length})`}>
            <table className="w-full border-collapse text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-line">
                  {["Record", "Age band", "Test date", "Department", "Clinical owner"].map((h) => (
                    <th key={h} className="py-1.5 pr-4 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-faint">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assessment.impactedPatients.map((patient) => (
                  <tr key={patient.id} className="border-b border-line last:border-0">
                    <td className="py-2 pr-4 font-mono text-[12px] text-ink">{patient.id}</td>
                    <td className="py-2 pr-4 text-ink-2">{patient.ageBand}</td>
                    <td className="py-2 pr-4 text-muted">{formatDate(patient.testedOn)}</td>
                    <td className="py-2 pr-4 text-ink-2">{patient.orderingDepartment}</td>
                    <td className="py-2 pr-4 text-ink-2">{patient.clinicalOwner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Review recommendation">
            <p className="text-[13.5px] leading-relaxed text-ink-2">
              {composeRecommendation(assessment.changeType, assessment.impactedRecordCount)}
            </p>
            <dl className="mt-3 grid grid-cols-3 gap-4">
              <Item label="Status" value={state.status} />
              <Item label="Assigned" value={state.assignee ?? "Unassigned"} />
              <Item label="Notes on file" value={String(state.notes.length)} />
            </dl>
          </Section>

          {evidence.citations.length > 0 ? (
            <Section title="Citations">
              <ol className="space-y-1 text-[12px] text-ink-2">
                {evidence.citations.map((citation) => (
                  <li key={citation.pmid}>
                    {citation.title} — {citation.journal} {citation.year}. PMID {citation.pmid}.
                  </li>
                ))}
              </ol>
            </Section>
          ) : null}

          <footer className="mt-7 border-t border-line pt-4">
            <p className="text-[12px] leading-relaxed text-muted">
              <strong className="font-semibold text-ink">Decision support only.</strong> Final
              interpretation remains with the qualified clinical team. VariantPulse does not alter
              any record and does not issue a diagnosis. Synthetic patient records · Real public
              genomic evidence (NCBI ClinVar, gnomAD v4, CTGA).
            </p>
            <p className="mt-2.5 text-[11px] text-faint">VariantPulse · Built by Team Kanban</p>
          </footer>
        </article>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Item({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-[10.5px] font-medium uppercase tracking-[0.07em] text-faint">{label}</dt>
      <dd className={`mt-0.5 text-[13px] ${strong ? "font-semibold text-ink" : "text-ink-2"}`}>
        {value}
      </dd>
    </div>
  );
}
