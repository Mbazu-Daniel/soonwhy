import { z } from 'zod';
import type { RcaAnalysis, RcaEvidence } from './rca.types';
import { validateRcaQuality } from './rca.quality';

const RcaString = z.string().trim().min(1).max(4_000);

export const RcaAnalysisSchema = z
  .object({
    summary: RcaString,
    rootCause: RcaString,
    contributingFactors: z.array(RcaString).max(10),
    investigationSteps: z.array(RcaString).max(10),
    suggestedChanges: z.array(RcaString).max(10),
    evidenceRefs: z.array(z.string().trim().min(1).max(200)).max(50),
    confidence: z.enum(['low', 'medium', 'high']),
    limitations: z.array(RcaString).max(10),
  })
  .strict();

export function validateRcaAnalysis(
  analysis: unknown,
  evidence: RcaEvidence,
): RcaAnalysis {
  const parsed = RcaAnalysisSchema.parse(analysis);
  const allowedRefs = new Set(collectEvidenceIds(evidence));

  for (const reference of parsed.evidenceRefs) {
    if (!allowedRefs.has(reference)) {
      throw new Error(`RCA referenced unknown evidence ID: ${reference}`);
    }
  }

  validateRcaQuality(parsed, evidence);
  return parsed;
}

function collectEvidenceIds(evidence: RcaEvidence): string[] {
  return [
    evidence.primaryFinding,
    ...evidence.supportingFindings,
    ...evidence.traces,
    ...evidence.recommendations,
  ].map((item) => item.id);
}
