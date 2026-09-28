import type { EvidenceObservation, EvidenceWindow } from './evidence.types';

export interface EvidenceConfidenceInput {
  observations: EvidenceObservation[];
  windows: EvidenceWindow[];
  requiredWindows?: number;
  minimumObservations?: number;
  minimumIndependentSources?: number;
}

export interface EvidenceConfidence {
  score: number;
  status: 'candidate' | 'supported' | 'confirmed';
  observationCount: number;
  windowCount: number;
  independentSourceCount: number;
}

export interface EvidenceConfidenceWeights {
  repeatedWindows: number;
  observationDepth: number;
  sourceDiversity: number;
}

export const DEFAULT_CONFIDENCE_WEIGHTS: EvidenceConfidenceWeights = {
  repeatedWindows: 0.5,
  observationDepth: 0.25,
  sourceDiversity: 0.25,
};

export function evaluateEvidenceConfidence(
  input: EvidenceConfidenceInput,
  weights: EvidenceConfidenceWeights = DEFAULT_CONFIDENCE_WEIGHTS,
): EvidenceConfidence {
  const requiredWindows = Math.max(1, input.requiredWindows ?? 3);
  const minimumObservations = Math.max(1, input.minimumObservations ?? 5);
  const minimumIndependentSources = Math.max(1, input.minimumIndependentSources ?? 2);
  const observationCount = input.observations.length;
  const windowCount = uniqueWindows(input.windows);
  const independentSourceCount = new Set(input.observations.map((item) => item.source)).size;

  const windowScore = Math.min(windowCount / requiredWindows, 1);
  const observationScore = Math.min(observationCount / minimumObservations, 1);
  const sourceScore = Math.min(independentSourceCount / minimumIndependentSources, 1);
  const score = clamp(
    windowScore * weights.repeatedWindows +
      observationScore * weights.observationDepth +
      sourceScore * weights.sourceDiversity,
  );

  let status: EvidenceConfidence['status'] = 'candidate';
  if (
    windowCount >= requiredWindows &&
    observationCount >= minimumObservations &&
    independentSourceCount >= minimumIndependentSources
  ) {
    status = score >= 0.9 ? 'confirmed' : 'supported';
  } else if (score >= 0.5) {
    status = 'supported';
  }

  return {
    score,
    status,
    observationCount,
    windowCount,
    independentSourceCount,
  };
}

function uniqueWindows(windows: EvidenceWindow[]): number {
  return new Set(windows.map((window) => `${window.start}:${window.end}`)).size;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
