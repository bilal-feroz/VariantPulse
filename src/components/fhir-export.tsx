"use client";

/**
 * Downloads the case as a FHIR R4 Bundle a hospital system can import.
 *
 * The builder is loaded when the button is pressed, so the case page does not
 * carry the export code, or the dataset it reads transcripts from, until
 * someone asks for it.
 */

import * as React from "react";
import { Check, FileDown } from "lucide-react";

import { Button } from "@/components/ui";
import type { VariantAssessment } from "@/lib/analysis";
import type { DecisionRecord } from "@/lib/decision";

export function FhirExportButton({
  assessment,
  decision,
}: {
  assessment: VariantAssessment;
  decision: DecisionRecord | null;
}) {
  const [state, setState] = React.useState<"idle" | "working" | "done">("idle");

  React.useEffect(() => {
    if (state !== "done") return;
    const timer = window.setTimeout(() => setState("idle"), 2400);
    return () => window.clearTimeout(timer);
  }, [state]);

  const exportBundle = async () => {
    setState("working");
    try {
      const { buildFhirBundle, fhirFileName } = await import("@/lib/fhir");
      const bundle = buildFhirBundle({ assessment, decision });
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/fhir+json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fhirFileName(bundle.identifier.value);
      anchor.click();
      URL.revokeObjectURL(url);
      setState("done");
    } catch (error) {
      // The export is an extra; if its code cannot load, the page carries on.
      console.warn("FHIR export could not be prepared", error);
      setState("idle");
    }
  };

  return (
    <Button
      variant="secondary"
      className="w-full justify-start"
      onClick={exportBundle}
      disabled={state === "working"}
      title="Download this case as a FHIR R4 Bundle: a review Task, the synthetic Patient identifier and the variant Observation for each affected record."
    >
      {state === "done" ? <Check className="h-4 w-4" /> : <FileDown className="h-4 w-4" />}
      {state === "done" ? "FHIR bundle downloaded" : "Export FHIR"}
    </Button>
  );
}
