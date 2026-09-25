/**
 * A presentation view over the regional evidence model.
 *
 * `RegionalEvidence` holds what the sources actually publish: gnomAD v4 allele
 * counts and, where one exists, a CTGA catalogue record. The views built here
 * are what the interface talks about: an assertion, how often it was seen, and
 * why. Keeping the mapping in one place means no component invents its own
 * reading of the counts.
 *
 * A variant with no catalogue record has no regional assertion to show, so the
 * view is null rather than a half-populated object. gnomAD frequencies alone
 * are a frequency observation, never a regional interpretation.
 */

import type { ClassificationCode } from "@/lib/classification";
import {
  REGIONAL_SOURCE,
  type RegionalCitation,
  type RegionalEvidence,
} from "@/data/regional";

export interface RegionalView {
  variantKey: string;
  /** The classification the regional catalogue carries. */
  assertion: ClassificationCode;
  /** The catalogue's own wording, kept verbatim for attribution. */
  assertionText: string;
  /** Allele observations in the Middle Eastern genetic ancestry group. */
  observations: number;
  /** Alleles called in that group, which is what the observations are out of. */
  cohortSize: number;
  regionalFrequency: number | null;
  globalFrequency: number | null;
  contributingCentres: string[];
  lastUpdated: string;
  note: string;
  citations: RegionalCitation[];
  /** Designated for regional review by the dataset, independent of any computed signal. */
  flagForReview: boolean;
}

export function regionalView(
  evidence: RegionalEvidence | null | undefined,
): RegionalView | null {
  if (!evidence?.catalogue) return null;
  const { catalogue, context, middleEastern, global } = evidence;

  return {
    variantKey: evidence.variantKey,
    assertion: catalogue.code,
    assertionText: catalogue.significance,
    observations: middleEastern?.alleleCount ?? 0,
    cohortSize: middleEastern?.alleleNumber ?? 0,
    regionalFrequency: middleEastern?.frequency ?? null,
    globalFrequency: global?.frequency ?? null,
    contributingCentres: catalogue.countries.map(
      (country) => `${REGIONAL_SOURCE.catalogueShortName}, ${REGIONAL_SOURCE.cataloguePublisher} (${country} records)`,
    ),
    lastUpdated: catalogue.listedSince,
    note: context?.note ?? "",
    citations: context?.citations ?? [],
    flagForReview: context?.flagForReview ?? false,
  };
}
