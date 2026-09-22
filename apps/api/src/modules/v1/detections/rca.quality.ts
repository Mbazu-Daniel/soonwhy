import type { RcaAnalysis, RcaEvidence } from './rca.types';

const NOT_ESTABLISHED_PATTERN = /not established|insufficient evidence|cannot establish|cannot determine|unknown/i;

export function validateRcaQuality(
  analysis: RcaAnalysis,
  evidence: RcaEvidence,
): void {
  const supportCount = evidence.supportingFindings.length + evidence.traces.length;

  if (supportCount === 0) {
    if (analysis.confidence === 'high') {
      throw new Error('RCA confidence cannot be high without supporting evidence');
    }

    if (!NOT_ESTABLISHED_PATTERN.test(analysis.rootCause)) {
      throw new Error('RCA must state that root cause is not established when supporting evidence is absent');
    }

    if (analysis.suggestedChanges.some((change) => !/candidate|investigate|review|consider/i.test(change))) {
      throw new Error('RCA remediation must be framed as an investigation or remediation candidate without supporting evidence');
    }
  }

  const hasConflictingEvidence = [
    ...evidence.supportingFindings,
    ...evidence.traces,
    ...evidence.recommendations,
  ].some((item) => item.context?.conflict === true);

  if (hasConflictingEvidence) {
    if (analysis.confidence === 'high') {
      throw new Error('RCA confidence cannot be high when evidence is conflicting');
    }

    if (analysis.limitations.length === 0) {
      throw new Error('RCA must describe limitations when evidence is conflicting');
    }
  }
}
