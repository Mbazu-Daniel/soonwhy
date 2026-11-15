import { z } from "zod";
import type { RcaAnalysis, RcaEvidence, RcaEvidenceItem } from "./rca.types";
import { validateRcaQuality } from "./rca.quality";

const RcaString = z.string().trim().min(1).max(4_000);

export const RcaAnalysisSchema = z
  .object({
    summary: RcaString,
    rootCause: RcaString,
    contributingFactors: z.array(RcaString).max(10),
    investigationSteps: z.array(RcaString).max(10),
    suggestedChanges: z.array(RcaString).max(10),
    evidenceRefs: z.array(z.string().trim().min(1).max(200)).max(50),
    confidence: z.enum(["low", "medium", "high"]),
    limitations: z.array(RcaString).max(10),
  })
  .strict();

export function validateRcaAnalysis(
  analysis: unknown,
  evidence: RcaEvidence,
): RcaAnalysis {
  const parsed = RcaAnalysisSchema.parse(analysis);
  const allowedRefs = new Set(collectEvidenceIds(evidence));

  const matched = parsed.evidenceRefs.filter((reference) => allowedRefs.has(reference));
  const dropped = parsed.evidenceRefs.length - matched.length;
  const result: RcaAnalysis =
    dropped === 0
      ? parsed
      : {
          ...parsed,
          evidenceRefs: matched,
          limitations: [
            ...parsed.limitations.slice(0, MAX_LIMITATIONS - 1),
            unmatchedReferencesNote(dropped),
          ],
        };

  validateRcaQuality(result, evidence);
  return result;
}

const MAX_LIMITATIONS = 10;

function unmatchedReferencesNote(count: number): string {
  return count === 1
    ? "One evidence reference from the model did not match the supplied evidence and was removed."
    : `${count} evidence references from the model did not match the supplied evidence and were removed.`;
}

function collectEvidenceIds(evidence: RcaEvidence): string[] {
  const items = [
    evidence.primaryFinding,
    ...evidence.supportingFindings,
    ...evidence.traces,
    ...evidence.recommendations,
  ];
  return [
    ...items.flatMap((item) => [item.id, item.sourceFindingId]),
    ...evidence.traces.flatMap(traceIdentifiers),
  ];
}

function traceIdentifiers(item: RcaEvidenceItem): string[] {
  const fromContext = item.context?.traceId;
  return [
    ...(typeof item.value === "string" ? [item.value] : []),
    ...(typeof fromContext === "string" ? [fromContext] : []),
  ];
}
