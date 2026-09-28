import type { Metadata } from "next";

import { AI_MODEL } from "@/lib/ai";
import { resolveEvidenceMode } from "@/lib/clinvar";

import { GovernanceView } from "./view";

export const metadata: Metadata = { title: "Trust & governance" };

// Reads the deployment's own configuration, so it renders per request.
export const dynamic = "force-dynamic";

/**
 * The deployment and governance package. The page reads what only the server
 * knows (whether an AI key is configured, and which evidence mode the
 * deployment runs) and hands the facts to the view; the key itself never
 * leaves the server.
 */
export default function GovernancePage() {
  const offline = ["1", "true"].includes(process.env.VARIANTPULSE_OFFLINE?.trim().toLowerCase() ?? "");
  // The Workers runtime identifies itself here; Node reports its own name.
  const onWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
  return (
    <GovernanceView
      facts={{
        hosting: onWorkers ? "cloudflare" : "local",
        aiConfigured: Boolean(process.env.AI_API_KEY?.trim()),
        aiModel: AI_MODEL,
        evidenceMode: resolveEvidenceMode(),
        offline,
      }}
    />
  );
}
