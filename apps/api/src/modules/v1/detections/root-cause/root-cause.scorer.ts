/**
 * Root Cause Scorer
 *
 * Calculates weighted scores from signal values.
 */

import type { ScoringWeights, SignalScores } from "./root-cause.types";

type SignalKey = keyof SignalScores;

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

export function calculateScoreWithMissingSignals(
  signalScores: Partial<SignalScores>,
  weights: ScoringWeights,
): { score: number; availableSignals: string[] } {
  const availableSignals: SignalKey[] = [];

  if (signalScores.anomalySeverity !== undefined) {
    availableSignals.push("anomalySeverity");
  }
  if (signalScores.graphPosition !== undefined) {
    availableSignals.push("graphPosition");
  }
  if (signalScores.criticalPathContribution !== undefined) {
    availableSignals.push("criticalPathContribution");
  }
  if (signalScores.errorPropagation !== undefined) {
    availableSignals.push("errorPropagation");
  }

  if (availableSignals.length === 4) {
    return {
      score: calculateScore(signalScores as SignalScores, weights),
      availableSignals,
    };
  }

  const totalWeight = availableSignals.reduce(
    (sum, signal) => sum + weights[signal],
    0,
  );

  if (totalWeight === 0) {
    return { score: 0, availableSignals };
  }

  let score = 0;
  for (const signal of availableSignals) {
    const signalScore = signalScores[signal];
    if (signalScore === undefined) {
      continue;
    }
    score += (weights[signal] / totalWeight) * signalScore;
  }

  return { score, availableSignals };
}
