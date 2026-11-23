import { RCA_MAX_ITEM_CHARACTERS, RCA_MAX_LIST_ITEMS, RCA_MAX_SUMMARY_CHARACTERS } from "./rca.prompt.constants";
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
  const parsed = shortened(RcaAnalysisSchema.parse(analysis));
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

  const capped = capByRankingConfidence(result, evidence);
  validateRcaQuality(capped, evidence);
  return capped;
}

const MAX_LIMITATIONS = RCA_MAX_LIST_ITEMS;

function shorten(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  const sentenceEnd = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "));
  if (sentenceEnd >= max * 0.4) return head.slice(0, sentenceEnd + 1);
  const wordEnd = head.lastIndexOf(" ");
  return `${head.slice(0, wordEnd > 0 ? wordEnd : max - 1).trimEnd()}…`;
}

const shortList = (items: string[]) => items.slice(0, RCA_MAX_LIST_ITEMS).map((item) => shorten(item, RCA_MAX_ITEM_CHARACTERS));

function shortened(analysis: RcaAnalysis): RcaAnalysis {
  return {
    ...analysis,
    summary: shorten(analysis.summary, RCA_MAX_SUMMARY_CHARACTERS),
    rootCause: shorten(analysis.rootCause, RCA_MAX_ITEM_CHARACTERS),
    contributingFactors: shortList(analysis.contributingFactors),
    investigationSteps: shortList(analysis.investigationSteps),
    suggestedChanges: shortList(analysis.suggestedChanges),
    limitations: shortList(analysis.limitations),
  };
}
const LOW_RANKING_NOTE = "The ranked candidates have low confidence, so the suspect is not presented as established.";

function capByRankingConfidence(analysis: RcaAnalysis, evidence: RcaEvidence): RcaAnalysis {
  if (evidence.rankingConfidence !== "low" || analysis.confidence !== "high") return analysis;
  return {
    ...analysis,
    confidence: "medium",
    limitations: [...analysis.limitations.slice(0, MAX_LIMITATIONS - 1), LOW_RANKING_NOTE],
  };
}

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
