/**
 * Root Cause Scorer
 *
 * Calculates weighted scores from signal values.
 */

import type {
  SignalScores,
  ScoringWeights,
} from './root-cause.types';

/**
 * Calculate overall score from signal scores using weights
 */
function calculateScore(
  signalScores: SignalScores,
  weights: ScoringWeights,
): number {
  return (
    weights.anomalySeverity * signalScores.anomalySeverity +
    weights.graphPosition * signalScores.graphPosition +
    weights.criticalPathContribution * signalScores.criticalPathContribution +
    weights.errorPropagation * signalScores.errorPropagation
  );
}

/**
 * Calculate score with renormalized weights for missing signals
 */
export function calculateScoreWithMissingSignals(
  signalScores: Partial<SignalScores>,
  weights: ScoringWeights,
): { score: number; availableSignals: string[] } {
  const availableSignals: string[] = [];

  if (signalScores.anomalySeverity !== undefined) availableSignals.push('anomalySeverity');
  if (signalScores.graphPosition !== undefined) availableSignals.push('graphPosition');
  if (signalScores.criticalPathContribution !== undefined) availableSignals.push('criticalPathContribution');
  if (signalScores.errorPropagation !== undefined) availableSignals.push('errorPropagation');

  // If all signals available, use standard calculation
  if (availableSignals.length === 4) {
    return {
      score: calculateScore(signalScores as SignalScores, weights),
      availableSignals,
    };
  }

  // Renormalize weights for available signals
  const totalWeight = availableSignals.reduce(
    (sum, signal) => sum + (weights as any)[signal],
    0,
  );

  if (totalWeight === 0) {
    return { score: 0, availableSignals };
  }

  let score = 0;
  for (const signal of availableSignals) {
    const normalizedWeight = (weights as any)[signal] / totalWeight;
    score += normalizedWeight * (signalScores as any)[signal]!;
  }

  return { score, availableSignals };
}
