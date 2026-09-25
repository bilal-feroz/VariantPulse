import { EVIDENCE_MODES, type EvidenceModeMeta } from "@/lib/evidence-mode";
import type { EvidenceMode } from "@/lib/clinvar";

function isEvidenceMode(mode: string): mode is EvidenceMode {
  return Object.prototype.hasOwnProperty.call(EVIDENCE_MODES, mode);
}

/** Presentation for whichever mode the server reports. Unknown modes read as cached. */
export function evidenceModeMeta(mode: string | null | undefined): EvidenceModeMeta {
  return mode && isEvidenceMode(mode) ? EVIDENCE_MODES[mode] : EVIDENCE_MODES.cached;
}
